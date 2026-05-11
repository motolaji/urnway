'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAddress } from 'viem';
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from 'wagmi';

import { switchToChainWithFallback } from '@/lib/chain-switch';
import { mezoTestnet } from '@/lib/passport';
import { buildTransactionDeepLink } from '@/lib/tx-bridge';
import { resetWalletBridgeSession } from '@/lib/wallet-session';

type FlowStage =
  | 'idle'
  | 'switching_chain'
  | 'submitting'
  | 'submitted'
  | 'error';

type TransactionRuntimeConfig =
  | {
      ok: true;
      redirectUri: string;
      request: {
        to: `0x${string}`;
        data: `0x${string}`;
        value: bigint;
        chainId: number;
        gas?: bigint;
        gasPrice?: bigint;
      };
      slug?: string | null;
      amount?: string | null;
      recipientName?: string | null;
      expectedSender?: `0x${string}` | null;
    }
  | {
      ok: false;
      error: string;
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

    return {
      ok: true,
      redirectUri,
      request: {
        to,
        data: data as `0x${string}`,
        value: BigInt(value),
        chainId,
        gas: parseOptionalHexBigInt(searchParams.get('gas_limit')),
        gasPrice: parseOptionalHexBigInt(searchParams.get('gas_price')),
      },
      slug: searchParams.get('slug'),
      amount: searchParams.get('amount'),
      recipientName: searchParams.get('recipient_name'),
      expectedSender: expectedSender as `0x${string}` | null,
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
  const { sendTransactionAsync } = useSendTransaction();
  const autoSwitchAttemptedRef = useRef(false);

  const [stage, setStage] = useState<FlowStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

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
    stage !== 'submitting';

  useEffect(() => {
    if (!config.ok || !isConnected || !address || !switchChainAsync) {
      autoSwitchAttemptedRef.current = false;
      return;
    }

    if (chainId === config.request.chainId) {
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
        await switchToChainWithFallback(switchChainAsync, {
          ...mezoTestnet,
          id: config.request.chainId,
        }, connector);

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
            : 'Could not switch to the transaction network automatically.'
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [address, chainId, config, isConnected, switchChainAsync]);

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
        await switchToChainWithFallback(switchChainAsync, {
          ...mezoTestnet,
          id: config.request.chainId,
        }, connector);
      }

      setStage('submitting');

      const hash = await sendTransactionAsync({
        to: config.request.to,
        data: config.request.data,
        value: config.request.value,
        chainId: config.request.chainId,
        gas: config.request.gas,
        gasPrice: config.request.gasPrice,
      });

      const callbackUrl = buildTransactionDeepLink(config.redirectUri, {
        status: 'submitted',
        txHash: hash,
        slug: config.slug,
        message: 'Transaction submitted from Passport wallet flow.',
      });

      setTxHash(hash);
      setDeepLinkUrl(callbackUrl);
      setStage('submitted');

      if (callbackUrl) {
        window.setTimeout(() => {
          window.location.assign(callbackUrl);
        }, 900);
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
    setTxHash(null);
    setDeepLinkUrl(null);
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
              : stage === 'submitting'
                ? 'Waiting for approval...'
                : 'Approve transfer'}
          </button>
        </div>

        {!senderMatches ? (
          <p className="error-text">
            The connected wallet does not match the wallet used during preflight.
          </p>
        ) : null}

        {stage === 'submitted' ? (
          <p className="success-text">Transfer submitted. Returning to Urnway now.</p>
        ) : null}

        {deepLinkUrl ? (
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
