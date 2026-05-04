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

const steps: Array<{ id: FlowStage | 'connected'; label: string; detail: string }> = [
  {
    id: 'idle',
    label: 'Connect wallet',
    detail: 'Use Passport to connect the wallet that should submit the MUSD transfer.',
  },
  {
    id: 'switching_chain',
    label: 'Switch network',
    detail: 'Move to the expected Mezo network before submitting the transfer.',
  },
  {
    id: 'submitting',
    label: 'Send transaction',
    detail: 'Approve the ERC-20 transfer in your wallet.',
  },
  {
    id: 'submitted',
    label: 'Return to Urnway',
    detail: 'The transaction hash is handed back to mobile for balance refresh.',
  },
];

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
  const { address, chainId, isConnected } = useAccount();
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
        await switchChainAsync({ chainId: config.request.chainId });

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
        await switchChainAsync({ chainId: config.request.chainId });
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
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Urnway Transaction Bridge</p>
        <h1>Passport sends here. Urnway refreshes after return.</h1>
        <p className="lede">
          This page receives a prepared MUSD transfer request from mobile, asks the connected
          wallet to submit it, and returns the resulting transaction hash back to Urnway.
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
            {steps.map((item) => {
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
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              {stage === 'switching_chain'
                ? 'Switching network...'
                : stage === 'submitting'
                  ? 'Waiting for wallet approval...'
                  : 'Submit transfer'}
            </button>
            <button className="secondary-button" onClick={handleReset} type="button">
              Reset flow
            </button>
          </div>

          {!senderMatches ? (
            <p className="error-text">
              The connected wallet does not match the preflight sender. Switch to the same wallet
              before submitting.
            </p>
          ) : null}

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Request</h2>
            <span className={`badge ${config.ok ? 'badge-active' : 'badge-warning'}`}>
              {config.ok ? 'ready' : 'invalid'}
            </span>
          </div>

          {config.ok ? (
            <>
              <dl className="details">
                <div>
                  <dt>Connected wallet</dt>
                  <dd>{formatWalletAddress(address)}</dd>
                </div>
                <div>
                  <dt>Recipient</dt>
                  <dd>{config.recipientName || config.request.to}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{config.amount || 'Not provided'} MUSD</dd>
                </div>
                <div>
                  <dt>Chain</dt>
                  <dd>
                    {config.request.chainId}
                    {config.request.chainId === mezoTestnet.id ? ' (Mezo testnet)' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Connected chain</dt>
                  <dd>{chainId ? `${chainId}` : 'Not connected'}</dd>
                </div>
                <div>
                  <dt>Expected sender</dt>
                  <dd>{config.expectedSender || 'Any connected wallet'}</dd>
                </div>
              </dl>

              <pre className="payload">
                {JSON.stringify(
                  {
                    to: config.request.to,
                    data: config.request.data,
                    value: `0x${config.request.value.toString(16)}`,
                    chainId: config.request.chainId,
                    gas: config.request.gas
                      ? `0x${config.request.gas.toString(16)}`
                      : null,
                    gasPrice: config.request.gasPrice
                      ? `0x${config.request.gasPrice.toString(16)}`
                      : null,
                  },
                  null,
                  2
                )}
              </pre>
            </>
          ) : (
            <p className="error-text">{config.error}</p>
          )}
        </div>
      </section>

      <section className="panel grid">
        <div className="card">
          <div className="card-header">
            <h2>Callback</h2>
            <span className={`badge ${txHash ? 'badge-active' : ''}`}>
              {txHash ? 'ready' : 'pending'}
            </span>
          </div>

          <p className="muted">
            Once the wallet submits the transfer, this callback URL returns the transaction hash to
            mobile so Urnway can refresh balances and continue the flow.
          </p>

          <pre className="payload">
            {deepLinkUrl ||
              JSON.stringify(
                {
                  status: 'submitted',
                  txHash: '<transaction hash>',
                  slug: config.ok ? config.slug : '<payment-link slug>',
                },
                null,
                2
              )}
          </pre>

          {deepLinkUrl ? (
            <div className="actions">
              <a className="link-button" href={deepLinkUrl}>
                Return to Urnway now
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
