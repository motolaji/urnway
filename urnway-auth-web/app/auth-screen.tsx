'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { stringToHex } from 'viem';
import { useAccount, useChainId, useDisconnect } from 'wagmi';

import {
  buildBridgeEnvelope,
  buildDeepLink,
  postToReactNativeWebView,
  type AuthPayload,
} from '@/lib/auth-bridge';
import { buildApiUrl, readClientConfig } from '@/lib/config';
import { mezoTestnet } from '@/lib/passport';
import { resetWalletBridgeSession } from '@/lib/wallet-session';

type FlowStage =
  | 'idle'
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
  if (typeof result === 'string' && result.startsWith('0x')) {
    return result;
  }

  throw new Error('The connected wallet returned an invalid signature response.');
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
    stage !== 'requesting_nonce' &&
    stage !== 'signing' &&
    stage !== 'handing_off';

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

      setStage('requesting_nonce');
      const nonce = await fetchNonce(config.apiBaseUrl, address);
      setNonceMessage(nonce.message);

      setStage('signing');
      const signature = await signAuthMessage(connector, nonce.walletAddress, nonce.message);

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
          Connect the wallet you want to use in Urnway and approve the ownership signature.
          Mezo network enforcement happens on transaction flows, not on sign-in.
        </p>

        <div className="bridge-summary">
          <div className="bridge-summary-row">
            <span>Wallet</span>
            <strong>{formatWalletAddress(address)}</strong>
          </div>
          <div className="bridge-summary-row">
            <span>Network</span>
            <strong>{onRequiredChain ? 'Mezo testnet' : 'Any connected network'}</strong>
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
