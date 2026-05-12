import { randomUUID } from 'node:crypto';

import {
  decodeEventLog,
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  parseUnits,
  type Hex,
} from 'viem';

import { env } from '../../config/env.js';
import { mezoClient } from '../../lib/mezo.js';
import { HttpError } from '../../utils/http-error.js';
import { findUserByPublicUserId, findUserByUsername } from '../users/users.repository.js';
import {
  createBalanceAccount,
  createBalanceLedgerEntry,
  createBalanceTopupIntentRecord,
  createBookingCheckoutRecord,
  createSendCheckoutRecord,
  findBalanceAccountByUserId,
  findBalanceTopupIntentByTopupId,
  findBalanceTopupIntentByTxHash,
  findBookingCheckoutByCheckoutId,
  findSendCheckoutByCheckoutId,
  updateBalanceAccountById,
  updateBalanceTopupIntentById,
  updateBookingCheckoutById,
  updateSendCheckoutById,
} from './balance.repository.js';
import {
  getMusdTokenAddress,
  getWalletAssetSnapshot,
  MUSD_TOKEN_ABI,
  NATIVE_TOKEN_DECIMALS,
} from '../wallet/wallet.service.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId?: string;
};

type PaymentSource = 'urnway_balance' | 'external_wallet' | 'split';

type FundingPlan = {
  source: PaymentSource;
  totalAmountMinor: number;
  totalAmount: string;
  urnwayBalanceAmountMinor: number;
  urnwayBalanceAmount: string;
  externalWalletAmountMinor: number;
  externalWalletAmount: string;
  availableBalanceAmountMinor: number;
  availableBalanceAmount: string;
  shortfallAmountMinor: number;
  shortfallAmount: string;
  requiresTopUp: boolean;
  canCompleteNow: boolean;
};

const BALANCE_TOPUP_TTL_MS = 1000 * 60 * 15;
const SEND_CHECKOUT_TTL_MS = 1000 * 60 * 15;
const BOOKING_CHECKOUT_TTL_MS = 1000 * 60 * 20;
const ERC20_TRANSFER_EVENT_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
type BalanceTopupIntentRecord = NonNullable<
  Awaited<ReturnType<typeof findBalanceTopupIntentByTopupId>>
>;
type SendCheckoutRecord = NonNullable<
  Awaited<ReturnType<typeof findSendCheckoutByCheckoutId>>
>;

function buildTopupId() {
  return `topup_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function buildSendCheckoutId() {
  return `send_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function buildBookingCheckoutId() {
  return `book_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function normalizeWalletAddress(walletAddress: string) {
  if (!isAddress(walletAddress, { strict: false })) {
    throw new HttpError(400, 'Invalid wallet address');
  }

  return getAddress(walletAddress);
}

function normalizeTxHash(txHash: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new HttpError(400, 'Invalid transaction hash');
  }

  return txHash.toLowerCase() as Hex;
}

function assertMusdCurrency(currency: string) {
  if (currency.trim().toUpperCase() !== 'MUSD') {
    throw new HttpError(400, 'Urnway balance currently supports MUSD only');
  }
}

function formatMinorAmount(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

function parseMajorAmountToMinor(amount: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
    throw new HttpError(400, 'Amount must be a decimal string with up to 2 decimals');
  }

  const parsed = Number.parseFloat(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, 'Amount must be greater than zero');
  }

  return Math.round(parsed * 100);
}

function getTreasuryWalletAddress() {
  if (!env.URNWAY_TREASURY_WALLET_ADDRESS) {
    throw new HttpError(
      503,
      'Urnway balance top-ups are not configured yet. Set URNWAY_TREASURY_WALLET_ADDRESS.'
    );
  }

  return normalizeWalletAddress(env.URNWAY_TREASURY_WALLET_ADDRESS);
}

function serializeBalanceAccount(account: {
  currency: string;
  availableAmountMinor: number;
  reservedAmountMinor: number;
}) {
  return {
    currency: account.currency,
    availableAmountMinor: account.availableAmountMinor,
    availableAmount: formatMinorAmount(account.availableAmountMinor),
    reservedAmountMinor: account.reservedAmountMinor,
    reservedAmount: formatMinorAmount(account.reservedAmountMinor),
    totalAmountMinor: account.availableAmountMinor + account.reservedAmountMinor,
    totalAmount: formatMinorAmount(
      account.availableAmountMinor + account.reservedAmountMinor
    ),
  };
}

async function ensureBalanceAccountForUser(userId: string) {
  const existingAccount = await findBalanceAccountByUserId(userId);

  if (existingAccount) {
    return existingAccount;
  }

  return createBalanceAccount({
    userId,
  });
}

async function buildExternalWalletSummary(walletAddress: string) {
  const snapshot = await getWalletAssetSnapshot(walletAddress);

  return {
    walletAddress: snapshot.walletAddress,
    nativeTokenBalance: formatUnits(snapshot.nativeBalance, NATIVE_TOKEN_DECIMALS),
    nativeTokenSymbol: 'BTC',
    musdBalance: formatUnits(snapshot.musdBalance, snapshot.musdDecimals),
    musdTokenSymbol: snapshot.musdSymbol,
    source: 'mezo' as const,
    updatedAt: new Date().toISOString(),
  };
}

function buildFundingPlan(input: {
  source: PaymentSource;
  totalAmountMinor: number;
  availableBalanceAmountMinor: number;
}): FundingPlan {
  const availableAmountMinor = Math.max(0, input.availableBalanceAmountMinor);
  const totalAmountMinor = input.totalAmountMinor;
  const shortfallAmountMinor = Math.max(0, totalAmountMinor - availableAmountMinor);

  if (input.source === 'urnway_balance') {
    return {
      source: input.source,
      totalAmountMinor,
      totalAmount: formatMinorAmount(totalAmountMinor),
      urnwayBalanceAmountMinor: Math.min(totalAmountMinor, availableAmountMinor),
      urnwayBalanceAmount: formatMinorAmount(
        Math.min(totalAmountMinor, availableAmountMinor)
      ),
      externalWalletAmountMinor: 0,
      externalWalletAmount: formatMinorAmount(0),
      availableBalanceAmountMinor: availableAmountMinor,
      availableBalanceAmount: formatMinorAmount(availableAmountMinor),
      shortfallAmountMinor,
      shortfallAmount: formatMinorAmount(shortfallAmountMinor),
      requiresTopUp: false,
      canCompleteNow: availableAmountMinor >= totalAmountMinor,
    };
  }

  if (input.source === 'external_wallet') {
    return {
      source: input.source,
      totalAmountMinor,
      totalAmount: formatMinorAmount(totalAmountMinor),
      urnwayBalanceAmountMinor: 0,
      urnwayBalanceAmount: formatMinorAmount(0),
      externalWalletAmountMinor: totalAmountMinor,
      externalWalletAmount: formatMinorAmount(totalAmountMinor),
      availableBalanceAmountMinor: availableAmountMinor,
      availableBalanceAmount: formatMinorAmount(availableAmountMinor),
      shortfallAmountMinor: totalAmountMinor,
      shortfallAmount: formatMinorAmount(totalAmountMinor),
      requiresTopUp: totalAmountMinor > 0,
      canCompleteNow: false,
    };
  }

  const urnwayBalanceAmountMinor = Math.min(totalAmountMinor, availableAmountMinor);
  const externalWalletAmountMinor = totalAmountMinor - urnwayBalanceAmountMinor;

  return {
    source: input.source,
    totalAmountMinor,
    totalAmount: formatMinorAmount(totalAmountMinor),
    urnwayBalanceAmountMinor,
    urnwayBalanceAmount: formatMinorAmount(urnwayBalanceAmountMinor),
    externalWalletAmountMinor,
    externalWalletAmount: formatMinorAmount(externalWalletAmountMinor),
    availableBalanceAmountMinor: availableAmountMinor,
    availableBalanceAmount: formatMinorAmount(availableAmountMinor),
    shortfallAmountMinor: externalWalletAmountMinor,
    shortfallAmount: formatMinorAmount(externalWalletAmountMinor),
    requiresTopUp: externalWalletAmountMinor > 0,
    canCompleteNow: externalWalletAmountMinor === 0,
  };
}

async function buildMusdTopupPreflight(input: {
  senderWalletAddress: string;
  recipientWalletAddress: string;
  amountMinor: number;
}) {
  const payerSnapshot = await getWalletAssetSnapshot(input.senderWalletAddress);
  const normalizedRecipientWalletAddress = getAddress(input.recipientWalletAddress);
  const amount = formatMinorAmount(input.amountMinor);
  const amountBaseUnits = parseUnits(amount, payerSnapshot.musdDecimals);
  const transactionData = encodeFunctionData({
    abi: MUSD_TOKEN_ABI,
    functionName: 'transfer',
    args: [normalizedRecipientWalletAddress, amountBaseUnits],
  });

  const [gasPrice, gasLimit] = await Promise.all([
    mezoClient.getGasPrice().catch(() => null),
    mezoClient
      .estimateContractGas({
        address: payerSnapshot.musdAddress,
        abi: MUSD_TOKEN_ABI,
        functionName: 'transfer',
        args: [normalizedRecipientWalletAddress, amountBaseUnits],
        account: payerSnapshot.walletAddress,
      })
      .catch(() => null),
  ]);

  const estimatedGasCost =
    gasPrice !== null && gasLimit !== null ? gasPrice * gasLimit : null;
  const hasSufficientMusd = payerSnapshot.musdBalance >= amountBaseUnits;
  const hasSufficientGas =
    estimatedGasCost !== null ? payerSnapshot.nativeBalance >= estimatedGasCost : false;

  const issues: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }> = [];

  if (!hasSufficientMusd) {
    issues.push({
      code: 'insufficient_musd',
      message: 'The current wallet does not have enough MUSD for this top-up.',
      severity: 'error',
    });
  }

  if (estimatedGasCost === null) {
    issues.push({
      code: 'gas_estimate_unavailable',
      message:
        'Urnway could not estimate gas for this top-up yet. You can retry shortly.',
      severity: 'warning',
    });
  } else if (!hasSufficientGas) {
    issues.push({
      code: 'insufficient_gas',
      message: 'The current wallet does not have enough BTC to cover gas.',
      severity: 'error',
    });
  }

  return {
    amount,
    amountBaseUnits,
    payerSnapshot,
    preflight: {
      chainId: env.MEZO_CHAIN_ID,
      senderWalletAddress: payerSnapshot.walletAddress,
      recipientWalletAddress: normalizedRecipientWalletAddress,
      musdTokenAddress: payerSnapshot.musdAddress,
      checks: {
        network: {
          expectedChainId: env.MEZO_CHAIN_ID,
          ok: true,
        },
        musdBalance: {
          requiredAmount: amount,
          availableAmount: formatUnits(
            payerSnapshot.musdBalance,
            payerSnapshot.musdDecimals
          ),
          ok: hasSufficientMusd,
        },
        gasBalance: {
          availableAmount: formatUnits(
            payerSnapshot.nativeBalance,
            NATIVE_TOKEN_DECIMALS
          ),
          requiredAmount:
            estimatedGasCost !== null
              ? formatUnits(estimatedGasCost, NATIVE_TOKEN_DECIMALS)
              : null,
          ok: hasSufficientGas,
          status:
            estimatedGasCost === null
              ? 'unavailable'
              : hasSufficientGas
                ? 'ready'
                : 'insufficient',
        },
      },
      issues,
      transactionRequest: {
        to: payerSnapshot.musdAddress,
        data: transactionData,
        value: '0x0',
        chainId: env.MEZO_CHAIN_ID,
        gasLimit: gasLimit !== null ? `0x${gasLimit.toString(16)}` : null,
        gasPrice: gasPrice !== null ? `0x${gasPrice.toString(16)}` : null,
      },
    },
  };
}

async function creditTopupIfVerified(input: {
  topupId: string;
  senderWalletAddress: string;
  txHash: Hex;
}) {
  const topupIntent = await findBalanceTopupIntentByTopupId(input.topupId);

  if (!topupIntent) {
    throw new HttpError(404, 'Top-up intent not found');
  }

  if (topupIntent.status === 'completed') {
    return topupIntent;
  }

  const senderWalletAddress = normalizeWalletAddress(input.senderWalletAddress);
  const tokenAddress = getAddress(topupIntent.tokenAddress);
  const treasuryWalletAddress = normalizeWalletAddress(
    topupIntent.treasuryWalletAddress
  );
  const senderSnapshot = await getWalletAssetSnapshot(senderWalletAddress);
  const requiredAmountBaseUnits = parseUnits(
    formatMinorAmount(topupIntent.amountMinor),
    senderSnapshot.musdDecimals
  );

  const receipt = await mezoClient
    .getTransactionReceipt({
      hash: input.txHash,
    })
    .catch(() => null);

  if (!receipt) {
    const updatedIntent = await updateBalanceTopupIntentById(topupIntent.id, {
      status: 'submitted',
      senderWalletAddress,
      txHash: input.txHash,
    });

    return updatedIntent ?? topupIntent;
  }

  if (receipt.status !== 'success') {
    const updatedIntent = await updateBalanceTopupIntentById(topupIntent.id, {
      status: 'failed',
      senderWalletAddress,
      txHash: input.txHash,
    });

    return updatedIntent ?? topupIntent;
  }

  const matchingTransfer = receipt.logs.find((log) => {
    if (getAddress(log.address) !== tokenAddress) {
      return false;
    }

    try {
      const decoded = decodeEventLog({
        abi: ERC20_TRANSFER_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== 'Transfer') {
        return false;
      }

      return (
        normalizeWalletAddress(String(decoded.args.from)) === senderWalletAddress &&
        normalizeWalletAddress(String(decoded.args.to)) === treasuryWalletAddress &&
        decoded.args.value === requiredAmountBaseUnits
      );
    } catch {
      return false;
    }
  });

  if (!matchingTransfer) {
    const updatedIntent = await updateBalanceTopupIntentById(topupIntent.id, {
      status: 'failed',
      senderWalletAddress,
      txHash: input.txHash,
    });

    return updatedIntent ?? topupIntent;
  }

  const account = await ensureBalanceAccountForUser(topupIntent.userId);
  await updateBalanceAccountById(account.id, {
    availableAmountMinor: account.availableAmountMinor + topupIntent.amountMinor,
  });
  await createBalanceLedgerEntry({
    accountId: account.id,
    userId: topupIntent.userId,
    entryType: 'topup_credit',
    direction: 'credit',
    amountMinor: topupIntent.amountMinor,
    currency: topupIntent.currency,
    referenceType: 'topup',
    referenceId: topupIntent.topupId,
    note: `Wallet top-up ${topupIntent.topupId}`,
  });

  const updatedIntent = await updateBalanceTopupIntentById(topupIntent.id, {
    status: 'completed',
    senderWalletAddress,
    txHash: input.txHash,
    completedAt: new Date(),
  });

  return updatedIntent ?? topupIntent;
}

async function synchronizeTopupLifecycleByTopupId(topupId: string) {
  const topupIntent = await findBalanceTopupIntentByTopupId(topupId);

  if (!topupIntent) {
    throw new HttpError(404, 'Top-up intent not found');
  }

  if (topupIntent.status === 'completed' || topupIntent.status === 'failed') {
    return topupIntent;
  }

  if (topupIntent.expiresAt && topupIntent.expiresAt.getTime() <= Date.now()) {
    const expiredIntent = await updateBalanceTopupIntentById(topupIntent.id, {
      status: 'expired',
    });

    return expiredIntent ?? topupIntent;
  }

  if (topupIntent.txHash && topupIntent.senderWalletAddress) {
    return creditTopupIfVerified({
      topupId: topupIntent.topupId,
      senderWalletAddress: topupIntent.senderWalletAddress,
      txHash: normalizeTxHash(topupIntent.txHash),
    });
  }

  return topupIntent;
}

function serializeTopupIntent(topupIntent: BalanceTopupIntentRecord) {
  return {
    topupId: topupIntent.topupId,
    status: topupIntent.status,
    amountMinor: topupIntent.amountMinor,
    amount: formatMinorAmount(topupIntent.amountMinor),
    currency: topupIntent.currency,
    treasuryWalletAddress: topupIntent.treasuryWalletAddress,
    tokenAddress: topupIntent.tokenAddress,
    senderWalletAddress: topupIntent.senderWalletAddress,
    txHash: topupIntent.txHash,
    completedAt: topupIntent.completedAt?.toISOString() ?? null,
    expiresAt: topupIntent.expiresAt?.toISOString() ?? null,
    createdAt: topupIntent.createdAt.toISOString(),
    updatedAt: topupIntent.updatedAt.toISOString(),
  };
}

function serializeFundingPlan(plan: FundingPlan) {
  return {
    ...plan,
  };
}

export async function getBalance(user: AuthenticatedUser) {
  const [account, externalWallet] = await Promise.all([
    ensureBalanceAccountForUser(user.id),
    buildExternalWalletSummary(user.walletAddress),
  ]);

  return {
    balance: {
      account: serializeBalanceAccount(account),
      externalWallet,
      treasuryWalletAddress: env.URNWAY_TREASURY_WALLET_ADDRESS ?? null,
      tokenAddress: getMusdTokenAddress(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function prepareBalanceTopup(
  user: AuthenticatedUser,
  input: {
    amountMinor: number;
    currency: string;
  }
) {
  assertMusdCurrency(input.currency);

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new HttpError(400, 'amountMinor must be a positive integer');
  }

  const treasuryWalletAddress = getTreasuryWalletAddress();
  await ensureBalanceAccountForUser(user.id);

  const preflight = await buildMusdTopupPreflight({
    senderWalletAddress: user.walletAddress,
    recipientWalletAddress: treasuryWalletAddress,
    amountMinor: input.amountMinor,
  });

  const topupIntent = await createBalanceTopupIntentRecord({
    topupId: buildTopupId(),
    userId: user.id,
    amountMinor: input.amountMinor,
    currency: input.currency.trim().toUpperCase(),
    treasuryWalletAddress,
    tokenAddress: preflight.payerSnapshot.musdAddress,
    expiresAt: new Date(Date.now() + BALANCE_TOPUP_TTL_MS),
  });

  return {
    topup: serializeTopupIntent(topupIntent),
    funding: {
      preflight: preflight.preflight,
    },
  };
}

export async function submitBalanceTopup(
  user: AuthenticatedUser,
  topupId: string,
  input: {
    txHash: string;
    senderWalletAddress: string;
  }
) {
  const normalizedSenderWalletAddress = normalizeWalletAddress(
    input.senderWalletAddress
  );
  const normalizedUserWalletAddress = normalizeWalletAddress(user.walletAddress);
  const normalizedTxHash = normalizeTxHash(input.txHash);

  if (normalizedSenderWalletAddress !== normalizedUserWalletAddress) {
    throw new HttpError(409, 'senderWalletAddress must match the signed-in wallet');
  }

  const topupIntent = await findBalanceTopupIntentByTopupId(topupId);

  if (!topupIntent || topupIntent.userId !== user.id) {
    throw new HttpError(404, 'Top-up intent not found');
  }

  const existingTxHashIntent = await findBalanceTopupIntentByTxHash(normalizedTxHash);

  if (existingTxHashIntent && existingTxHashIntent.topupId !== topupIntent.topupId) {
    throw new HttpError(409, 'This transaction hash has already been used for another top-up');
  }

  const synchronizedIntent = await creditTopupIfVerified({
    topupId,
    senderWalletAddress: normalizedSenderWalletAddress,
    txHash: normalizedTxHash,
  });

  return {
    topup: serializeTopupIntent(synchronizedIntent),
  };
}

export async function getBalanceTopup(user: AuthenticatedUser, topupId: string) {
  const synchronizedIntent = await synchronizeTopupLifecycleByTopupId(topupId);

  if (synchronizedIntent.userId !== user.id) {
    throw new HttpError(404, 'Top-up intent not found');
  }

  return {
    topup: serializeTopupIntent(synchronizedIntent),
  };
}

async function requireReceiverByHandle(input: {
  username?: string;
  publicUserId?: string;
}) {
  if (input.publicUserId) {
    const receiver = await findUserByPublicUserId(input.publicUserId.trim());

    if (!receiver || !receiver.publicUserId) {
      throw new HttpError(404, 'Recipient not found');
    }

    return receiver;
  }

  if (input.username) {
    const receiver = await findUserByUsername(input.username.trim());

    if (!receiver) {
      throw new HttpError(404, 'Recipient not found');
    }

    return receiver;
  }

  throw new HttpError(400, 'Recipient username or public user id is required');
}

function serializeSendCheckout(checkout: SendCheckoutRecord) {
  return {
    checkoutId: checkout.checkoutId,
    status: checkout.status,
    source: checkout.source as PaymentSource,
    amountMinor: checkout.amountMinor,
    amount: formatMinorAmount(checkout.amountMinor),
    currency: checkout.currency,
    note: checkout.note,
    receiver: {
      userId: checkout.receiverUserId,
      publicUserId: checkout.receiverPublicUserId,
      username: checkout.receiverUsername,
    },
    fundingPlan: {
      source: checkout.source as PaymentSource,
      totalAmountMinor: checkout.amountMinor,
      totalAmount: formatMinorAmount(checkout.amountMinor),
      urnwayBalanceAmountMinor: checkout.urnwayBalanceAmountMinor,
      urnwayBalanceAmount: formatMinorAmount(checkout.urnwayBalanceAmountMinor),
      externalWalletAmountMinor: checkout.externalWalletAmountMinor,
      externalWalletAmount: formatMinorAmount(checkout.externalWalletAmountMinor),
      availableBalanceAmountMinor:
        checkout.urnwayBalanceAmountMinor + checkout.externalWalletAmountMinor,
      availableBalanceAmount: formatMinorAmount(
        checkout.urnwayBalanceAmountMinor + checkout.externalWalletAmountMinor
      ),
      shortfallAmountMinor: checkout.externalWalletAmountMinor,
      shortfallAmount: formatMinorAmount(checkout.externalWalletAmountMinor),
      requiresTopUp: checkout.externalWalletAmountMinor > 0,
      canCompleteNow: checkout.externalWalletAmountMinor === 0,
    },
    completedAt: checkout.completedAt?.toISOString() ?? null,
    expiresAt: checkout.expiresAt?.toISOString() ?? null,
    createdAt: checkout.createdAt.toISOString(),
    updatedAt: checkout.updatedAt.toISOString(),
  };
}

function assertActiveCheckout(checkout: {
  status: string;
  expiresAt: Date | null;
}) {
  if (checkout.status === 'completed') {
    return;
  }

  if (checkout.expiresAt && checkout.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'Checkout has expired');
  }

  if (checkout.status !== 'prepared') {
    throw new HttpError(409, 'Checkout can no longer be completed', {
      status: checkout.status,
    });
  }
}

async function transferUrnwayBalance(input: {
  senderUserId: string;
  receiverUserId: string;
  amountMinor: number;
  referenceType: string;
  referenceId: string;
  note?: string | null;
}) {
  const senderAccount = await ensureBalanceAccountForUser(input.senderUserId);
  const receiverAccount = await ensureBalanceAccountForUser(input.receiverUserId);

  if (senderAccount.availableAmountMinor < input.amountMinor) {
    throw new HttpError(409, 'Urnway balance is not sufficient to complete this payment', {
      availableAmountMinor: senderAccount.availableAmountMinor,
      requiredAmountMinor: input.amountMinor,
    });
  }

  await updateBalanceAccountById(senderAccount.id, {
    availableAmountMinor: senderAccount.availableAmountMinor - input.amountMinor,
  });
  await updateBalanceAccountById(receiverAccount.id, {
    availableAmountMinor: receiverAccount.availableAmountMinor + input.amountMinor,
  });

  await createBalanceLedgerEntry({
    accountId: senderAccount.id,
    userId: input.senderUserId,
    entryType: 'send_debit',
    direction: 'debit',
    amountMinor: input.amountMinor,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? null,
  });
  await createBalanceLedgerEntry({
    accountId: receiverAccount.id,
    userId: input.receiverUserId,
    entryType: 'send_credit',
    direction: 'credit',
    amountMinor: input.amountMinor,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? null,
  });
}

export async function prepareSendCheckout(
  user: AuthenticatedUser,
  input: {
    username?: string;
    receiverPublicUserId?: string;
    amountMinor: number;
    currency: string;
    source: PaymentSource;
    note?: string;
  }
) {
  assertMusdCurrency(input.currency);

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new HttpError(400, 'amountMinor must be a positive integer');
  }

  const receiver = await requireReceiverByHandle({
    username: input.username,
    publicUserId: input.receiverPublicUserId,
  });

  if (receiver.id === user.id) {
    throw new HttpError(409, 'You cannot send to yourself');
  }

  const account = await ensureBalanceAccountForUser(user.id);
  const fundingPlan = buildFundingPlan({
    source: input.source,
    totalAmountMinor: input.amountMinor,
    availableBalanceAmountMinor: account.availableAmountMinor,
  });

  const checkout = await createSendCheckoutRecord({
    checkoutId: buildSendCheckoutId(),
    userId: user.id,
    receiverUserId: receiver.id,
    receiverPublicUserId: receiver.publicUserId ?? null,
    receiverUsername: receiver.username ?? null,
    amountMinor: input.amountMinor,
    currency: 'MUSD',
    source: input.source,
    urnwayBalanceAmountMinor: fundingPlan.urnwayBalanceAmountMinor,
    externalWalletAmountMinor: fundingPlan.externalWalletAmountMinor,
    note: input.note?.trim() || null,
    expiresAt: new Date(Date.now() + SEND_CHECKOUT_TTL_MS),
  });

  return {
    checkout: {
      ...serializeSendCheckout(checkout),
      fundingPlan: serializeFundingPlan(fundingPlan),
      recipient: {
        userId: receiver.id,
        publicUserId: receiver.publicUserId ?? null,
        username: receiver.username,
        displayName: receiver.username ?? receiver.mezoId ?? receiver.walletAddress,
        walletAddress: receiver.walletAddress,
      },
    },
    balance: serializeBalanceAccount(account),
  };
}

export async function getSendCheckoutStatus(
  user: AuthenticatedUser,
  checkoutId: string
) {
  const checkout = await findSendCheckoutByCheckoutId(checkoutId);

  if (!checkout) {
    throw new HttpError(404, 'Send checkout not found');
  }

  if (checkout.userId !== user.id && checkout.receiverUserId !== user.id) {
    throw new HttpError(404, 'Send checkout not found');
  }

  if (checkout.status === 'prepared' && checkout.expiresAt && checkout.expiresAt.getTime() <= Date.now()) {
    const expiredCheckout = await updateSendCheckoutById(checkout.id, {
      status: 'expired',
    });

    return {
      checkout: serializeSendCheckout(expiredCheckout ?? checkout),
    };
  }

  return {
    checkout: serializeSendCheckout(checkout),
  };
}

export async function completeSendCheckout(
  user: AuthenticatedUser,
  checkoutId: string,
  input: {
    topupId?: string;
  }
) {
  const checkout = await findSendCheckoutByCheckoutId(checkoutId);

  if (!checkout || checkout.userId !== user.id) {
    throw new HttpError(404, 'Send checkout not found');
  }

  if (checkout.status === 'completed') {
    return {
      checkout: serializeSendCheckout(checkout),
    };
  }

  assertActiveCheckout(checkout);

  if (checkout.externalWalletAmountMinor > 0 && input.topupId) {
    const topupIntent = await synchronizeTopupLifecycleByTopupId(input.topupId);

    if (topupIntent.userId !== user.id) {
      throw new HttpError(404, 'Top-up intent not found');
    }

    if (topupIntent.status !== 'completed') {
      throw new HttpError(409, 'Top-up has not completed yet', {
        status: topupIntent.status,
      });
    }

    if (topupIntent.amountMinor < checkout.externalWalletAmountMinor) {
      throw new HttpError(409, 'Top-up amount is lower than the checkout shortfall', {
        topupAmountMinor: topupIntent.amountMinor,
        requiredAmountMinor: checkout.externalWalletAmountMinor,
      });
    }
  }

  await transferUrnwayBalance({
    senderUserId: checkout.userId,
    receiverUserId: checkout.receiverUserId,
    amountMinor: checkout.amountMinor,
    referenceType: 'send_checkout',
    referenceId: checkout.checkoutId,
    note: checkout.note,
  });

  const updatedCheckout = await updateSendCheckoutById(checkout.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  return {
    checkout: serializeSendCheckout(updatedCheckout ?? checkout),
  };
}

async function reserveBookingFunds(input: {
  userId: string;
  amountMinor: number;
  referenceId: string;
  note?: string | null;
}) {
  const account = await ensureBalanceAccountForUser(input.userId);

  if (account.availableAmountMinor < input.amountMinor) {
    throw new HttpError(409, 'Urnway balance is not sufficient to cover this booking', {
      availableAmountMinor: account.availableAmountMinor,
      requiredAmountMinor: input.amountMinor,
    });
  }

  await updateBalanceAccountById(account.id, {
    availableAmountMinor: account.availableAmountMinor - input.amountMinor,
    reservedAmountMinor: account.reservedAmountMinor + input.amountMinor,
  });
  await createBalanceLedgerEntry({
    accountId: account.id,
    userId: input.userId,
    entryType: 'booking_reserve',
    direction: 'hold',
    amountMinor: input.amountMinor,
    referenceType: 'booking_checkout',
    referenceId: input.referenceId,
    note: input.note ?? null,
  });
}

async function commitReservedBookingFunds(input: {
  userId: string;
  amountMinor: number;
  referenceId: string;
  note?: string | null;
}) {
  const account = await ensureBalanceAccountForUser(input.userId);

  if (account.reservedAmountMinor < input.amountMinor) {
    throw new HttpError(409, 'Reserved booking funds are inconsistent');
  }

  await updateBalanceAccountById(account.id, {
    reservedAmountMinor: account.reservedAmountMinor - input.amountMinor,
  });
  await createBalanceLedgerEntry({
    accountId: account.id,
    userId: input.userId,
    entryType: 'booking_commit',
    direction: 'debit',
    amountMinor: input.amountMinor,
    referenceType: 'booking_checkout',
    referenceId: input.referenceId,
    note: input.note ?? null,
  });
}

export async function releaseReservedBookingFunds(input: {
  userId: string;
  amountMinor: number;
  referenceId: string;
  note?: string | null;
}) {
  const account = await ensureBalanceAccountForUser(input.userId);

  if (account.reservedAmountMinor < input.amountMinor) {
    throw new HttpError(409, 'Reserved booking funds are inconsistent');
  }

  await updateBalanceAccountById(account.id, {
    availableAmountMinor: account.availableAmountMinor + input.amountMinor,
    reservedAmountMinor: account.reservedAmountMinor - input.amountMinor,
  });
  await createBalanceLedgerEntry({
    accountId: account.id,
    userId: input.userId,
    entryType: 'booking_release',
    direction: 'release',
    amountMinor: input.amountMinor,
    referenceType: 'booking_checkout',
    referenceId: input.referenceId,
    note: input.note ?? null,
  });
}

export async function prepareBookingCheckout(
  user: AuthenticatedUser,
  input: {
    mode: 'flight' | 'hotel';
    source: PaymentSource;
    quoteAmount: string;
    quoteCurrency: string;
    tripId?: string;
    payloadJson: string;
  }
) {
  const totalAmountMinor = parseMajorAmountToMinor(input.quoteAmount);
  const account = await ensureBalanceAccountForUser(user.id);
  const fundingPlan = buildFundingPlan({
    source: input.source,
    totalAmountMinor,
    availableBalanceAmountMinor: account.availableAmountMinor,
  });

  const checkout = await createBookingCheckoutRecord({
    checkoutId: buildBookingCheckoutId(),
    userId: user.id,
    tripId: input.tripId ?? null,
    mode: input.mode,
    source: input.source,
    totalAmountMinor,
    currency: 'MUSD',
    quoteAmount: input.quoteAmount,
    quoteCurrency: input.quoteCurrency,
    urnwayBalanceAmountMinor: fundingPlan.urnwayBalanceAmountMinor,
    externalWalletAmountMinor: fundingPlan.externalWalletAmountMinor,
    payloadJson: input.payloadJson,
    expiresAt: new Date(Date.now() + BOOKING_CHECKOUT_TTL_MS),
  });

  return {
    checkout: {
      checkoutId: checkout.checkoutId,
      status: checkout.status,
      mode: checkout.mode,
      source: checkout.source as PaymentSource,
      fundingAmountMinor: checkout.totalAmountMinor,
      fundingAmount: formatMinorAmount(checkout.totalAmountMinor),
      fundingCurrency: checkout.currency,
      quoteAmount: checkout.quoteAmount,
      quoteCurrency: checkout.quoteCurrency,
      fundingPlan: serializeFundingPlan(fundingPlan),
      completedAt: checkout.completedAt?.toISOString() ?? null,
      expiresAt: checkout.expiresAt?.toISOString() ?? null,
      createdAt: checkout.createdAt.toISOString(),
      updatedAt: checkout.updatedAt.toISOString(),
    },
    balance: serializeBalanceAccount(account),
  };
}

export async function getBookingCheckoutForUser(
  user: AuthenticatedUser,
  checkoutId: string
) {
  const checkout = await findBookingCheckoutByCheckoutId(checkoutId);

  if (!checkout || checkout.userId !== user.id) {
    throw new HttpError(404, 'Booking checkout not found');
  }

  return checkout;
}

export async function markBookingCheckoutCompleted(input: {
  checkoutId: string;
  bookingId: string;
}) {
  const checkout = await findBookingCheckoutByCheckoutId(input.checkoutId);

  if (!checkout) {
    throw new HttpError(404, 'Booking checkout not found');
  }

  return updateBookingCheckoutById(checkout.id, {
    bookingId: input.bookingId,
    status: 'completed',
    completedAt: new Date(),
  });
}

export {
  assertMusdCurrency,
  commitReservedBookingFunds,
  formatMinorAmount,
  reserveBookingFunds,
  serializeBalanceAccount,
  serializeFundingPlan,
};
