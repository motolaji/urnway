'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { stringToHex } from 'viem';
import { useAccount, useChainId, useDisconnect, useSwitchChain } from 'wagmi';

import {
  buildBridgeEnvelope,
  buildDeepLink,
  postToReactNativeWebView,
  type AuthPayload,
} from '@/lib/auth-bridge';
import { switchToChainWithFallback } from '@/lib/chain-switch';
import { buildApiUrl, readClientConfig } from '@/lib/config';
import { mezoTestnet } from '@/lib/passport';
import { resetWalletBridgeSession } from '@/lib/wallet-session';

type FlowStage =
  | 'idle'
  | 'switching_chain'
  | 'requesting_nonce'
  | 'signing'
  | 'handing_off'
  | 'success'
  | 'error';

type NonceResponseBody = {
  data?: {
    walletAddress: string;
    message: string;
    expiresAt: string;
  };
  error?: {
    message?: string;
  };
};

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

function formatWalletAddress(walletAddress: string | undefined) {
  if (!walletAddress) {
    return 'Not connected';
  }

  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'The auth flow failed unexpectedly.';
}

function normalizeSignature(result: unknown) {
  if (typeof result !== 'string') {
    throw new Error('The connected wallet returned an invalid signature response.');
  }

  const signature = result.startsWith('0x') ? result : `0x${result}`;

  // A valid ECDSA signature should be 65 bytes (130 hex chars + 0x prefix = 132 chars)
  // Some wallets may return 64 bytes (128 hex chars) without recovery id
  if (signature.length < 130 || signature.length > 134) {
    throw new Error(
      `Invalid signature length: expected 130-134 characters, got ${signature.length}.`
    );
  }

  // Validate it's a valid hex string
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
    throw new Error('The signature contains invalid characters.');
  }

  return signature;
}

async function signAuthMessage(
  connector: { getProvider?: (args?: { chainId?: number }) => Promise<unknown> } | undefined,
  walletAddress: string,
  message: string
) {
  const provider =
    typeof connector?.getProvider === 'function'
      ? ((await connector.getProvider()) as Eip1193Provider | undefined)
      : undefined;

  const activeProvider =
    provider ||
    (typeof window !== 'undefined'
      ? (((window as typeof window & {
            ethereum?: Eip1193Provider;
            okxwallet?: Eip1193Provider;
          }).ethereum ??
          (window as typeof window & {
            ethereum?: Eip1193Provider;
            okxwallet?: Eip1193Provider;
          }).okxwallet) as Eip1193Provider | undefined)
      : undefined);

  if (!activeProvider) {
    throw new Error('No wallet provider was found for message signing.');
  }

  const hexMessage = stringToHex(message);

  try {
    return normalizeSignature(
      await activeProvider.request({
        method: 'personal_sign',
        params: [hexMessage, walletAddress],
      })
    );
  } catch (error) {
    const cause = error as { code?: number; message?: string } | undefined;

    if (cause?.code === 4001) {
      throw new Error('The signature request was rejected.');
    }

    throw error;
  }
}

async function fetchNonce(apiBaseUrl: string, walletAddress: string) {
  const response = await fetch(buildApiUrl(apiBaseUrl, '/v1/auth/nonce'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  });

  const body = (await response.json().catch(() => null)) as NonceResponseBody | null;

  if (!response.ok || !body?.data?.message || !body.data.walletAddress) {
    throw new Error(body?.error?.message || 'Failed to request auth nonce from the API.');
  }

  return body.data;
}

function isNonceExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) {
    return false; // No expiration means it's valid
  }

  try {
    const expirationTime = new Date(expiresAt).getTime();
    // Add 5 second buffer to account for network latency
    return Date.now() > expirationTime - 5000;
  } catch {
    return false;
  }
}

export default function AuthScreen() {
  const searchParams = useSearchParams();
  const config = useMemo(() => {
    const baseConfig = readClientConfig();

    if (!baseConfig.ok) {
      return baseConfig;
    }

    const redirectOverride = searchParams.get('redirect_uri')?.trim();

    return {
      ...baseConfig,
      mobileRedirectUri: redirectOverride || baseConfig.mobileRedirectUri,
    };
  }, [searchParams]);
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const autoSwitchAttemptedRef = useRef(false);

  const [stage, setStage] = useState<FlowStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nonceMessage, setNonceMessage] = useState<string | null>(null);
  const [authPayload, setAuthPayload] = useState<AuthPayload | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [usedWebViewBridge, setUsedWebViewBridge] = useState(false);

  const bridgeAvailable =
    typeof window !== 'undefined' && Boolean(window.ReactNativeWebView?.postMessage);
  const onRequiredChain = chainId === mezoTestnet.id;

  const canStartSigning =
    config.ok &&
    isConnected &&
    Boolean(address) &&
    onRequiredChain &&
    stage !== 'switching_chain' &&
    stage !== 'requesting_nonce' &&
    stage !== 'signing' &&
    stage !== 'handing_off';

  useEffect(() => {
    if (!config.ok || !isConnected || !address) {
      autoSwitchAttemptedRef.current = false;
      return;
    }

    if (onRequiredChain) {
      autoSwitchAttemptedRef.current = false;
      return;
    }

    if (autoSwitchAttemptedRef.current) {
      return;
    }

    autoSwitchAttemptedRef.current = true;
    let active = true;

    void (async () => {
      try {
        setErrorMessage(null);
        setStage('switching_chain');
        await switchToChainWithFallback(switchChainAsync, mezoTestnet, connector);

        if (active) {
          setStage('idle');
        }
      } catch (error) {
        if (!active) {
          return;
        }

        // Reset flag on error to allow manual retry via the Continue button
        autoSwitchAttemptedRef.current = false;
        setStage('idle');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not switch to Mezo testnet automatically.'
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [address, config.ok, connector, isConnected, onRequiredChain, switchChainAsync]);

  async function handleStartAuth() {
    if (!config.ok) {
      setStage('error');
      setErrorMessage(config.error);
      return;
    }

    if (!address) {
      setStage('error');
      setErrorMessage('Connect a wallet in Passport before requesting a nonce.');
      return;
    }

    try {
      setErrorMessage(null);
      setDeepLinkUrl(null);
      setUsedWebViewBridge(false);

      if (!onRequiredChain) {
        setStage('switching_chain');
        await switchToChainWithFallback(switchChainAsync, mezoTestnet, connector);
      }

      setStage('requesting_nonce');
      const nonce = await fetchNonce(config.apiBaseUrl, address);
      setNonceMessage(nonce.message);

      // Validate nonce hasn't expired before signing
      if (isNonceExpired(nonce.expiresAt)) {
        throw new Error('The sign-in request has expired. Please try again.');
      }

      setStage('signing');

      // Add timeout for signature request (3 minutes max)
      const SIGNATURE_TIMEOUT_MS = 180000;
      const signaturePromise = signAuthMessage(connector, nonce.walletAddress, nonce.message);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Signature request timed out. Please try again.'));
        }, SIGNATURE_TIMEOUT_MS);
      });

      const signature = await Promise.race([signaturePromise, timeoutPromise]);

      const payload = {
        walletAddress: nonce.walletAddress,
        message: nonce.message,
        signature,
      };

      setAuthPayload(payload);
      setStage('handing_off');

      const envelope = buildBridgeEnvelope(payload);
      const postedToWebView = postToReactNativeWebView(envelope);
      const nextDeepLinkUrl = buildDeepLink(config.mobileRedirectUri, payload);

      setUsedWebViewBridge(postedToWebView);
      setDeepLinkUrl(nextDeepLinkUrl);
      setStage('success');

      if (!postedToWebView && nextDeepLinkUrl) {
        window.setTimeout(() => {
          window.location.assign(nextDeepLinkUrl);
        }, 800);
      }

      if (!postedToWebView && !nextDeepLinkUrl) {
        throw new Error(
          'No React Native WebView bridge was found and NEXT_PUBLIC_MOBILE_REDIRECT_URI is not configured.'
        );
      }
    } catch (error) {
      setStage('error');
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleReset() {
    resetWalletBridgeSession();
    setStage('idle');
    setErrorMessage(null);
    setNonceMessage(null);
    setAuthPayload(null);
    setDeepLinkUrl(null);
    setUsedWebViewBridge(false);
    disconnect();
  }

  return (
    <main className="bridge-shell">
      <section className="bridge-card">
        <div className="bridge-header">
          <p className="bridge-kicker">Urnway x Mezo Passport</p>
          <span className={`badge ${config.ok ? 'badge-active' : 'badge-warning'}`}>
            {config.ok ? 'mezo only' : 'setup needed'}
          </span>
        </div>

        <h1 className="bridge-title">Sign in with Mezo Passport</h1>
        <p className="bridge-copy">
          Connect the wallet you want to use in Urnway. Urnway will switch the wallet to Mezo
          testnet automatically before asking for the ownership signature.
        </p>

        <div className="bridge-summary">
          <div className="bridge-summary-row">
            <span>Wallet</span>
            <strong>{formatWalletAddress(address)}</strong>
          </div>
          <div className="bridge-summary-row">
            <span>Network</span>
            <strong>
              {stage === 'switching_chain'
                ? 'Switching to Mezo testnet...'
                : onRequiredChain
                  ? 'Mezo testnet'
                  : 'Wrong network'}
            </strong>
          </div>
        </div>

        <div className="actions bridge-actions">
          <ConnectButton.Custom>
            {({ account, mounted, openAccountModal, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && !!account;

              return (
                <button
                  className="secondary-button"
                  onClick={connected ? openAccountModal : openConnectModal}
                  type="button"
                >
                  {connected ? formatWalletAddress(account.address) : 'Connect wallet'}
                </button>
              );
            }}
          </ConnectButton.Custom>

            <button
              className="primary-button"
              disabled={!canStartSigning}
              onClick={handleStartAuth}
              type="button"
            >
              {stage === 'requesting_nonce'
                ? 'Preparing sign-in...'
                : stage === 'switching_chain'
                  ? 'Switching to Mezo...'
                : stage === 'signing'
                  ? 'Waiting for signature...'
                  : stage === 'handing_off'
                    ? 'Returning to Urnway...'
                    : 'Continue'}
            </button>
        </div>

        {stage === 'success' ? (
          <p className="success-text">
            Sign-in approved. Returning to Urnway now.
          </p>
        ) : null}

        {deepLinkUrl && !usedWebViewBridge ? (
          <a className="link-button" href={deepLinkUrl}>
            Return to app
          </a>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        {!config.ok ? <p className="muted bridge-muted">{config.error}</p> : null}
        {stage === 'switching_chain' ? (
          <p className="muted bridge-muted">Approve the Mezo testnet switch in your wallet.</p>
        ) : null}
        {nonceMessage && stage === 'signing' ? (
          <p className="muted bridge-muted">Passport is waiting for your signature.</p>
        ) : null}
        {authPayload && stage === 'success' ? (
          <p className="muted bridge-muted">Wallet proof has been handed back to mobile.</p>
        ) : null}

        <div className="bridge-footer">
          <button className="text-button" onClick={handleReset} type="button">
            Reset
          </button>
          <span>API verification happens in the mobile app.</span>
        </div>
      </section>
    </main>
  );
}
