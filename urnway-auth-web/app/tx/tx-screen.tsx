'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAddress, isAddress, toHex } from 'viem';
import {
  useAccount,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';

import { switchToChainWithFallback } from '@/lib/chain-switch';
import { mezoTestnet } from '@/lib/passport';
import {
  buildTransactionDeepLink,
  buildTransactionBridgeEnvelope,
  postTransactionToReactNativeWebView,
} from '@/lib/tx-bridge';
import { resetWalletBridgeSession } from '@/lib/wallet-session';

type FlowStage =
  | 'idle'
  | 'switching_chain'
  | 'awaiting_wallet'
  | 'submitted'
  | 'error';

type TransactionRequest = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  chainId: number;
  gas?: bigint;
  gasPrice?: bigint;
};

type TransactionRuntimeConfig =
  | {
      ok: true;
      redirectUri: string;
      request: TransactionRequest;
      slug?: string | null;
      amount?: string | null;
      recipientName?: string | null;
      expectedSender?: `0x${string}` | null;
    }
  | {
      ok: false;
      error: string;
    };

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

function readRequired(value: string | null, fieldName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is missing from the transaction request.`);
  }

  return value.trim();
}

function parseOptionalHexBigInt(value: string | null) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return BigInt(value);
}

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

  return 'The transaction flow failed unexpectedly.';
}

function isUserRejectionError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('rejected the request') ||
      message.includes('rejected by user')
    );
  }

  if (typeof error === 'object' && error && 'code' in error) {
    return (error as { code?: number }).code === 4001;
  }

  return false;
}

function isMobileWalletConnector(connectorName: string | undefined) {
  if (!connectorName) return false;
  const name = connectorName.toLowerCase();
  return (
    name.includes('walletconnect') ||
    name.includes('trust') ||
    name.includes('metamask') ||
    name.includes('coinbase')
  );
}

function getTransactionTimeoutMs(connectorName: string | undefined) {
  return isMobileWalletConnector(connectorName) ? 120000 : 180000;
}

function normalizeTransactionHash(result: unknown) {
  if (typeof result === 'string' && /^0x[a-fA-F0-9]{64}$/.test(result)) {
    return result as `0x${string}`;
  }

  throw new Error('The connected wallet did not return a valid transaction hash.');
}

async function getWalletProvider(
  connector: { getProvider?: (args?: { chainId?: number }) => Promise<unknown> } | undefined,
  chainId: number
) {
  const provider =
    typeof connector?.getProvider === 'function'
      ? (((await connector.getProvider({ chainId }).catch(async () => connector.getProvider?.())) ??
          null) as Eip1193Provider | null)
      : null;

  if (provider) {
    return provider;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return (
    ((window as typeof window & {
      ethereum?: Eip1193Provider;
      okxwallet?: Eip1193Provider;
    }).ethereum ??
      (window as typeof window & {
        ethereum?: Eip1193Provider;
        okxwallet?: Eip1193Provider;
      }).okxwallet) as Eip1193Provider | undefined
  ) ?? null;
}

async function sendTransactionThroughProvider(input: {
  connector: { getProvider?: (args?: { chainId?: number }) => Promise<unknown> } | undefined;
  walletAddress: `0x${string}`;
  request: TransactionRequest;
}) {
  const provider = await getWalletProvider(input.connector, input.request.chainId);

  if (!provider) {
    throw new Error('Could not access the connected wallet provider to submit the transaction.');
  }

  const txRequest: Record<string, string> = {
    from: input.walletAddress,
    to: input.request.to,
    data: input.request.data,
    value: toHex(input.request.value),
  };

  if (input.request.gas !== undefined) {
    txRequest.gas = toHex(input.request.gas);
  }

  if (input.request.gasPrice !== undefined) {
    txRequest.gasPrice = toHex(input.request.gasPrice);
  }

  return normalizeTransactionHash(
    await provider.request({
      method: 'eth_sendTransaction',
      params: [txRequest],
    })
  );
}

function readTransactionRuntimeConfig(
  searchParams: ReturnType<typeof useSearchParams>
): TransactionRuntimeConfig {
  try {
    const redirectUri = readRequired(searchParams.get('redirect_uri'), 'redirect_uri');
    const to = readRequired(searchParams.get('to'), 'to');
    const data = readRequired(searchParams.get('data'), 'data');
    const value = readRequired(searchParams.get('value'), 'value');
    const chainId = Number(readRequired(searchParams.get('chain_id'), 'chain_id'));
    const expectedSender = searchParams.get('expected_sender')?.trim() || null;

    if (!Number.isInteger(chainId)) {
      throw new Error('chain_id must be an integer.');
    }

    if (!isAddress(to)) {
      throw new Error('to must be a valid address.');
    }

    if (!data.startsWith('0x')) {
      throw new Error('data must be a hex string.');
    }

    if (expectedSender && !isAddress(expectedSender)) {
      throw new Error('expected_sender must be a valid address.');
    }

    // Normalize addresses to checksum format for consistent comparison
    let checksumTo: `0x${string}`;
    let checksumExpectedSender: `0x${string}` | null = null;

    try {
      checksumTo = getAddress(to);
    } catch {
      throw new Error('to address has an invalid checksum.');
    }

    if (expectedSender) {
      try {
        checksumExpectedSender = getAddress(expectedSender);
      } catch {
        throw new Error('expected_sender address has an invalid checksum.');
      }
    }

    return {
      ok: true,
      redirectUri,
      request: {
        to: checksumTo,
        data: data as `0x${string}`,
        value: BigInt(value),
        chainId,
        gas: parseOptionalHexBigInt(searchParams.get('gas_limit')),
        gasPrice: parseOptionalHexBigInt(searchParams.get('gas_price')),
      },
      slug: searchParams.get('slug'),
      amount: searchParams.get('amount'),
      recipientName: searchParams.get('recipient_name'),
      expectedSender: checksumExpectedSender,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export default function TxScreen() {
  const searchParams = useSearchParams();
  const config = useMemo(() => readTransactionRuntimeConfig(searchParams), [searchParams]);
  const { address, chainId, connector, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const autoSwitchAttemptedRef = useRef(false);

  const [stage, setStage] = useState<FlowStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
  const [usedWebViewBridge, setUsedWebViewBridge] = useState(false);

  const bridgeAvailable =
    typeof window !== 'undefined' && Boolean(window.ReactNativeWebView?.postMessage);

  const senderMatches =
    config.ok && config.expectedSender && address
      ? config.expectedSender.toLowerCase() === address.toLowerCase()
      : true;

  const canSubmit =
    config.ok &&
    isConnected &&
    Boolean(address) &&
    senderMatches &&
    chainId === config.request.chainId &&
    stage !== 'switching_chain' &&
    stage !== 'awaiting_wallet';

  useEffect(() => {
    if (!config.ok || !isConnected || !address || !switchChainAsync) {
      autoSwitchAttemptedRef.current = false;
      return;
    }

    if (chainId === config.request.chainId) {
      autoSwitchAttemptedRef.current = false;
      setStage((prev) => (prev === 'switching_chain' ? 'idle' : prev));
      return;
    }

    if (autoSwitchAttemptedRef.current) {
      return;
    }

    autoSwitchAttemptedRef.current = true;
    let active = true;

    const CHAIN_SWITCH_TIMEOUT_MS = 60000; // 60 second timeout for chain switch

    void (async () => {
      try {
        setErrorMessage(null);
        setStage('switching_chain');

        // Add timeout for chain switching
        const switchPromise = switchToChainWithFallback(switchChainAsync, {
          ...mezoTestnet,
          id: config.request.chainId,
        }, connector);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Network switch timed out. Please try manually or check your wallet.'));
          }, CHAIN_SWITCH_TIMEOUT_MS);
        });

        await Promise.race([switchPromise, timeoutPromise]);

        if (active) {
          setStage('idle');
        }
      } catch (error) {
        if (!active) {
          return;
        }

        // Reset flag on error to allow manual retry
        autoSwitchAttemptedRef.current = false;
        setStage('idle');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not switch to the transaction network automatically.'
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [address, chainId, config, connector, isConnected, switchChainAsync]);

  async function handleSubmit() {
    if (!config.ok) {
      setStage('error');
      setErrorMessage(config.error);
      return;
    }

    if (!address) {
      setStage('error');
      setErrorMessage('Connect the sending wallet before submitting the transfer.');
      return;
    }

    if (config.expectedSender && config.expectedSender.toLowerCase() !== address.toLowerCase()) {
      setStage('error');
      setErrorMessage('The connected wallet does not match the wallet that ran preflight.');
      return;
    }

    try {
      setErrorMessage(null);
      setDeepLinkUrl(null);

      if (chainId !== config.request.chainId && switchChainAsync) {
        setStage('switching_chain');

        const CHAIN_SWITCH_TIMEOUT_MS = 60000;
        const switchPromise = switchToChainWithFallback(switchChainAsync, {
          ...mezoTestnet,
          id: config.request.chainId,
        }, connector);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Network switch timed out. Please try manually.'));
          }, CHAIN_SWITCH_TIMEOUT_MS);
        });

        await Promise.race([switchPromise, timeoutPromise]);
      }

      setStage('awaiting_wallet');
      const txPromise = sendTransactionThroughProvider({
        connector,
        walletAddress: getAddress(address),
        request: config.request,
      });

      const hash = await Promise.race([
        txPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                isMobileWalletConnector(connector?.name)
                  ? 'Wallet approval timed out. Open the wallet app, confirm the transfer if it is pending, then try again.'
                  : 'Transaction timed out. Please check your wallet and try again.'
              )
            );
          }, getTransactionTimeoutMs(connector?.name));
        }),
      ]);

      // Build the result payload
      const resultPayload = {
        status: 'submitted' as const,
        txHash: hash,
        slug: config.slug ?? undefined,
        source: 'urnway-auth-web',
        message: 'Transaction submitted from Passport wallet flow.',
      };

      // Try WebView bridge first (for React Native in-app browser)
      const envelope = buildTransactionBridgeEnvelope(resultPayload);
      const postedToWebView = postTransactionToReactNativeWebView(envelope);

      // Build deep link as fallback
      const callbackUrl = buildTransactionDeepLink(config.redirectUri, resultPayload);

      setTxHash(hash);
      setDeepLinkUrl(callbackUrl);
      setUsedWebViewBridge(postedToWebView);
      setStage('submitted');

      // Only redirect via deep link if WebView bridge wasn't available
      if (!postedToWebView && callbackUrl) {
        window.setTimeout(() => {
          window.location.assign(callbackUrl);
        }, 900);
      }
    } catch (error) {
      // Handle user rejection gracefully
      if (isUserRejectionError(error)) {
        setStage('idle');
        setErrorMessage('Transaction was rejected. You can try again when ready.');
        return;
      }

      setStage('error');
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleReset() {
    resetWalletBridgeSession();
    setStage('idle');
    setErrorMessage(null);
    setTxHash(null);
    setDeepLinkUrl(null);
    setUsedWebViewBridge(false);
    disconnect();
  }

  return (
    <main className="bridge-shell">
      <section className="bridge-card">
        <div className="bridge-header">
          <p className="bridge-kicker">Urnway transaction</p>
          <span className={`badge ${config.ok ? 'badge-active' : 'badge-warning'}`}>
            {config.ok ? 'mezo only' : 'invalid request'}
          </span>
        </div>

        <h1 className="bridge-title">Approve transfer</h1>
        <p className="bridge-copy">
          This transfer is prepared by Urnway and submitted through Mezo Passport. The wallet is
          switched to Mezo automatically before approval.
        </p>

        {config.ok ? (
          <div className="bridge-summary">
            <div className="bridge-summary-row">
              <span>Recipient</span>
              <strong>{config.recipientName || config.request.to}</strong>
            </div>
            <div className="bridge-summary-row">
              <span>Amount</span>
              <strong>{config.amount || 'Not provided'} MUSD</strong>
            </div>
            <div className="bridge-summary-row">
              <span>Wallet</span>
              <strong>{formatWalletAddress(address)}</strong>
            </div>
            <div className="bridge-summary-row">
              <span>Network</span>
              <strong>
                {chainId === config.request.chainId ? 'Mezo testnet' : 'Switching to Mezo...'}
              </strong>
            </div>
          </div>
        ) : null}

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
            disabled={!canSubmit}
            onClick={handleSubmit}
            type="button"
          >
            {stage === 'switching_chain'
              ? 'Switching to Mezo...'
              : stage === 'awaiting_wallet'
                ? 'Open your wallet...'
                  : 'Approve transfer'}
          </button>
        </div>

        {!senderMatches ? (
          <p className="error-text">
            The connected wallet does not match the wallet used during preflight.
          </p>
        ) : null}

        {stage === 'awaiting_wallet' ? (
          <p className="muted bridge-muted">
            {isMobileWalletConnector(connector?.name)
              ? 'Please open your wallet app to approve the transaction.'
              : 'Please confirm the transaction in your wallet popup.'}
          </p>
        ) : null}

        {stage === 'submitted' ? (
          <p className="success-text">
            {usedWebViewBridge
              ? 'Transfer submitted. Result sent to Urnway.'
              : 'Transfer submitted. Returning to Urnway now.'}
          </p>
        ) : null}

        {deepLinkUrl && !usedWebViewBridge ? (
          <a className="link-button" href={deepLinkUrl}>
            Return to app
          </a>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {!config.ok ? <p className="error-text">{config.error}</p> : null}

        <div className="bridge-footer">
          <button className="text-button" onClick={handleReset} type="button">
            Reset
          </button>
          <span>Urnway refreshes balances after the tx hash returns.</span>
        </div>
      </section>
    </main>
  );
}
