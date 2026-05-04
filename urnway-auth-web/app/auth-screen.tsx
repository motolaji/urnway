'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';

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

const stages: Array<{ id: FlowStage | 'connected'; label: string; detail: string }> = [
  {
    id: 'idle',
    label: 'Connect wallet',
    detail: 'Passport opens inside the web app and exposes the connected wallet.',
  },
  {
    id: 'switching_chain',
    label: 'Switch network',
    detail: 'Urnway moves the wallet onto Mezo testnet before requesting a signature.',
  },
  {
    id: 'requesting_nonce',
    label: 'Request nonce',
    detail: 'The web app asks urnway-api for the message that proves wallet ownership.',
  },
  {
    id: 'signing',
    label: 'Sign message',
    detail: 'Passport signs the API-provided message. The signature never gets issued by the web app itself.',
  },
  {
    id: 'handing_off',
    label: 'Return payload',
    detail: 'The web app returns walletAddress, message, and signature back to mobile.',
  },
];

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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const autoSwitchAttemptedRef = useRef(false);

  const [stage, setStage] = useState<FlowStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nonceMessage, setNonceMessage] = useState<string | null>(null);
  const [authPayload, setAuthPayload] = useState<AuthPayload | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [usedWebViewBridge, setUsedWebViewBridge] = useState(false);

  const bridgeAvailable =
    typeof window !== 'undefined' && Boolean(window.ReactNativeWebView?.postMessage);
  const onRequiredChain = !isConnected || chainId === mezoTestnet.id;

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
    if (!isConnected || !address || !switchChainAsync) {
      autoSwitchAttemptedRef.current = false;
      return;
    }

    if (chainId === mezoTestnet.id) {
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
        await switchChainAsync({ chainId: mezoTestnet.id });

        if (active) {
          setStage('idle');
        }
      } catch (error) {
        if (!active) {
          return;
        }

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
  }, [address, chainId, isConnected, switchChainAsync]);

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

      if (chainId !== mezoTestnet.id) {
        if (!switchChainAsync) {
          throw new Error('Switch the connected wallet to Mezo testnet before signing.');
        }

        setStage('switching_chain');
        await switchChainAsync({ chainId: mezoTestnet.id });
      }

      setStage('requesting_nonce');
      const nonce = await fetchNonce(config.apiBaseUrl, address);
      setNonceMessage(nonce.message);

      setStage('signing');
      const signature = await signMessageAsync({
        message: nonce.message,
      });

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
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Urnway Auth Bridge</p>
        <h1>Passport signs here. Tokens stay in the API.</h1>
        <p className="lede">
          This app is intentionally narrow. It connects the wallet, requests a nonce from
          <code> urnway-api </code>, signs the message with Mezo Passport, and returns the signed
          payload to mobile.
        </p>
      </section>

      <section className="panel grid">
        <div className="card">
          <div className="card-header">
            <h2>Flow</h2>
            <span className={`badge ${isConnected ? 'badge-active' : ''}`}>
              {isConnected ? 'wallet connected' : 'awaiting wallet'}
            </span>
          </div>

          <ol className="steps">
            {stages.map((item) => {
              const isActive = item.id === stage || (item.id === 'idle' && isConnected);

              return (
                <li className={`step ${isActive ? 'step-active' : ''}`} key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              );
            })}
          </ol>

          <div className="actions">
            <ConnectButton label={isConnected ? 'Switch wallet' : 'Connect wallet'} />
            <button
              className="primary-button"
              disabled={!canStartSigning}
              onClick={handleStartAuth}
              type="button"
            >
              {stage === 'requesting_nonce'
                ? 'Requesting nonce...'
                : stage === 'switching_chain'
                  ? 'Switching to Mezo testnet...'
                  : stage === 'signing'
                    ? 'Waiting for signature...'
                    : stage === 'handing_off'
                      ? 'Handing off...'
                      : 'Request nonce and sign'}
            </button>
            <button className="secondary-button" onClick={handleReset} type="button">
              Reset flow
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Runtime</h2>
            <span className={`badge ${config.ok ? 'badge-active' : 'badge-warning'}`}>
              {config.ok ? 'env ready' : 'env missing'}
            </span>
          </div>

          <dl className="details">
            <div>
              <dt>Wallet</dt>
              <dd>{formatWalletAddress(address)}</dd>
            </div>
            <div>
              <dt>Connected chain</dt>
              <dd>{chainId ? `${chainId}` : 'Not connected'}</dd>
            </div>
            <div>
              <dt>Required chain</dt>
              <dd>{mezoTestnet.id} (Mezo testnet)</dd>
            </div>
            <div>
              <dt>API base URL</dt>
              <dd>{config.ok ? config.apiBaseUrl : 'Missing'}</dd>
            </div>
            <div>
              <dt>WebView bridge</dt>
              <dd>{bridgeAvailable ? 'Detected' : 'Not detected'}</dd>
            </div>
            <div>
              <dt>Deep-link fallback</dt>
              <dd>{config.ok && config.mobileRedirectUri ? config.mobileRedirectUri : 'Not configured'}</dd>
            </div>
          </dl>

          {nonceMessage ? (
            <div className="message-preview">
              <p className="section-label">Nonce message</p>
              <pre>{nonceMessage}</pre>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel grid">
        <div className="card">
          <div className="card-header">
            <h2>Bridge payload</h2>
            <span className={`badge ${authPayload ? 'badge-active' : ''}`}>
              {authPayload ? 'ready' : 'empty'}
            </span>
          </div>

          <p className="muted">
            Mobile should receive this exact payload shape and forward it to
            <code> POST /v1/auth/verify </code>.
          </p>

          <pre className="payload">
            {JSON.stringify(
              authPayload ?? {
                walletAddress: '<wallet address>',
                message: '<nonce message>',
                signature: '<wallet signature>',
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Status</h2>
            <span
              className={`badge ${
                stage === 'success' ? 'badge-active' : stage === 'error' ? 'badge-warning' : ''
              }`}
            >
              {stage}
            </span>
          </div>

          <ul className="status-list">
            <li>Posted to React Native WebView: {usedWebViewBridge ? 'yes' : 'no'}</li>
            <li>Deep link generated: {deepLinkUrl ? 'yes' : 'no'}</li>
            <li>Auto-selected Mezo testnet: {onRequiredChain ? 'yes' : 'pending'}</li>
            <li>API verify happens in mobile, not in this app.</li>
          </ul>

          {deepLinkUrl ? (
            <a className="link-button" href={deepLinkUrl}>
              Open mobile fallback
            </a>
          ) : null}

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
