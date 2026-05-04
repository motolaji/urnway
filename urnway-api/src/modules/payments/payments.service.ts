import { randomUUID } from 'node:crypto';

import QRCode from 'qrcode';
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
} from 'viem';

import { env } from '../../config/env.js';
import { mezoClient } from '../../lib/mezo.js';
import { HttpError } from '../../utils/http-error.js';
import { findUserById, findUserByUsername } from '../users/users.repository.js';
import {
  getMusdTokenAddress,
  getWalletAssetSnapshot,
  MUSD_TOKEN_ABI,
  NATIVE_TOKEN_DECIMALS,
} from '../wallet/wallet.service.js';
import {
  createPaymentLinkAttemptRecord,
  createPaymentLinkRecord,
  deletePaymentLinkForUser,
  findPaymentLinkAttemptByTxHash,
  findPaymentLinkById,
  findPaymentLinkBySlug,
  listPaymentLinkAttemptsForLinkIds,
  listPaymentLinksForUser,
  markSubmittedAttemptsStaleForPaymentLink,
  updatePaymentLinkAttemptRecordById,
  updatePaymentLinkRecordById,
} from './payments.repository.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type CreatePaymentLinkInput = {
  amount: string;
  title?: string;
  note?: string;
};

type SendPaymentInput = {
  username: string;
  amount: string;
  note?: string;
};

type SubmitPaymentLinkInput = {
  txHash: string;
  senderWalletAddress: string;
};

type PaymentLinkRecord = NonNullable<Awaited<ReturnType<typeof findPaymentLinkById>>>;
type PaymentLinkAttemptRecord = NonNullable<
  Awaited<ReturnType<typeof findPaymentLinkAttemptByTxHash>>
>;

type SerializedPaymentLink = {
  id: string;
  slug: string;
  title: string | null;
  note: string | null;
  amount: string;
  currency: string;
  status: string;
  recipient: {
    username: string | null;
    displayName: string;
    walletAddress: string;
  };
  shareText: string;
  expiresAt: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerSettlement: {
    canReset: boolean;
    latestAttempt: {
      txHash: string;
      status: string;
      senderWalletAddress: string;
      submittedAt: string;
      confirmedAt: string | null;
    } | null;
  } | null;
};

type SerializedPaymentQr = {
  qrId: string;
  payload: string;
  imageDataUrl: string;
  paymentLink: SerializedPaymentLink;
};

const SUBMITTED_TIMEOUT_MS = 1000 * 60 * 15;
const submittedStatuses = new Set(['submitted']);
const terminalStatuses = new Set(['confirmed', 'cancelled', 'expired']);
const MOBILE_QR_SCHEME_PREFIX = 'urnwaymobile://payments/qr/';

function buildPaymentLinkSlug() {
  return `pay-${randomUUID().slice(0, 8)}`;
}

function buildShareText({
  amount,
  slug,
  displayName,
}: {
  amount: string;
  slug: string;
  displayName: string;
}) {
  return `Pay ${displayName} ${amount} MUSD on Urnway using code ${slug}.`;
}

function buildPaymentQrPayload(qrId: string) {
  return `${MOBILE_QR_SCHEME_PREFIX}${encodeURIComponent(qrId)}`;
}

async function buildSerializedPaymentQr(
  paymentLink: SerializedPaymentLink
): Promise<SerializedPaymentQr> {
  const payload = buildPaymentQrPayload(paymentLink.slug);
  const imageDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });

  return {
    qrId: paymentLink.slug,
    payload,
    imageDataUrl,
    paymentLink,
  };
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

  return txHash.toLowerCase();
}

function getPaymentLinkExpired(link: { expiresAt: Date | null }) {
  return link.expiresAt ? link.expiresAt.getTime() <= Date.now() : false;
}

function getPaymentLinkTimedOut(link: PaymentLinkRecord) {
  return (
    submittedStatuses.has(link.status) &&
    Boolean(link.submittedAt) &&
    Date.now() - link.submittedAt!.getTime() >= SUBMITTED_TIMEOUT_MS
  );
}

async function requirePaymentLink(slug: string) {
  const paymentLink = await findPaymentLinkBySlug(slug);

  if (!paymentLink) {
    throw new HttpError(404, 'Payment link not found');
  }

  return paymentLink;
}

async function buildRecipient(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return {
    username: user.username,
    displayName: user.username ?? user.mezoId ?? user.walletAddress,
    walletAddress: user.walletAddress,
  };
}

async function buildRecipientByUsername(username: string) {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new HttpError(404, 'Recipient not found');
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.username ?? user.mezoId ?? user.walletAddress,
    walletAddress: user.walletAddress,
  };
}

async function synchronizePaymentLinkLifecycle(link: PaymentLinkRecord) {
  if (terminalStatuses.has(link.status)) {
    return link;
  }

  if (getPaymentLinkExpired(link)) {
    const updatedLink = await updatePaymentLinkRecordById(link.id, {
      status: 'expired',
    });

    return updatedLink ?? link;
  }

  if (!getPaymentLinkTimedOut(link)) {
    return link;
  }

  const updatedLink = await updatePaymentLinkRecordById(link.id, {
    status: 'stale',
  });

  await markSubmittedAttemptsStaleForPaymentLink(link.id);

  return updatedLink ?? link;
}

function assertPaymentLinkIsActive(link: PaymentLinkRecord) {
  if (link.status === 'active') {
    return;
  }

  if (link.status === 'submitted') {
    throw new HttpError(409, 'Payment link is waiting for confirmation', {
      status: link.status,
    });
  }

  if (link.status === 'stale') {
    throw new HttpError(
      409,
      'Payment link is stale and must be reset by the owner before retry',
      { status: link.status }
    );
  }

  if (link.status === 'confirmed') {
    throw new HttpError(409, 'Payment link has already been paid', {
      status: link.status,
    });
  }

  if (link.status === 'expired') {
    throw new HttpError(410, 'Payment link has expired', {
      status: link.status,
    });
  }

  throw new HttpError(409, 'Payment link is not available for payment', {
    status: link.status,
  });
}

async function buildMusdTransferPreflight(input: {
  senderWalletAddress: string;
  recipientWalletAddress: string;
  amount: string;
}) {
  const payerSnapshot = await getWalletAssetSnapshot(input.senderWalletAddress);
  const normalizedRecipientWalletAddress = getAddress(input.recipientWalletAddress);
  const amountBaseUnits = parseUnits(input.amount, payerSnapshot.musdDecimals);
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
    estimatedGasCost !== null
      ? payerSnapshot.nativeBalance >= estimatedGasCost
      : false;

  const issues: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }> = [];

  if (!hasSufficientMusd) {
    issues.push({
      code: 'insufficient_musd',
      message: 'The current wallet does not have enough MUSD for this payment.',
      severity: 'error',
    });
  }

  if (estimatedGasCost === null) {
    issues.push({
      code: 'gas_estimate_unavailable',
      message:
        'Urnway could not estimate gas for this transfer yet. You can retry preflight shortly.',
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
    payerSnapshot,
    recipientWalletAddress: normalizedRecipientWalletAddress,
    amountBaseUnits,
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
          requiredAmount: input.amount,
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

async function buildLatestAttemptMap(paymentLinks: PaymentLinkRecord[]) {
  const attempts = await listPaymentLinkAttemptsForLinkIds(
    paymentLinks.map((paymentLink) => paymentLink.id)
  );
  const latestAttemptMap = new Map<string, PaymentLinkAttemptRecord>();

  for (const attempt of attempts) {
    if (!latestAttemptMap.has(attempt.paymentLinkId)) {
      latestAttemptMap.set(attempt.paymentLinkId, attempt);
    }
  }

  return latestAttemptMap;
}

async function serializePaymentLink(
  link: PaymentLinkRecord,
  {
    viewer,
    latestAttempt,
  }: {
    viewer: 'owner' | 'public';
    latestAttempt?: PaymentLinkAttemptRecord | null;
  }
): Promise<SerializedPaymentLink> {
  const recipient = await buildRecipient(link.userId);

  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    note: link.note,
    amount: link.amount,
    currency: link.currency,
    status: link.status,
    recipient,
    shareText: buildShareText({
      amount: link.amount,
      slug: link.slug,
      displayName: recipient.displayName,
    }),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    submittedAt: link.submittedAt?.toISOString() ?? null,
    confirmedAt: link.confirmedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    ownerSettlement:
      viewer === 'owner'
        ? {
            canReset: link.status === 'stale',
            latestAttempt: latestAttempt
              ? {
                  txHash: latestAttempt.txHash,
                  status: latestAttempt.status,
                  senderWalletAddress: latestAttempt.senderWalletAddress,
                  submittedAt: latestAttempt.submittedAt.toISOString(),
                  confirmedAt: latestAttempt.confirmedAt?.toISOString() ?? null,
                }
              : null,
          }
        : null,
  };
}

export async function getPaymentsOverview(user: AuthenticatedUser) {
  const [recipient, links] = await Promise.all([
    buildRecipient(user.id),
    listPaymentLinksForUser(user.id),
  ]);

  return {
    summary: {
      availableFlows: ['direct_send', 'payment_links', 'qr_payments'],
      createdLinkCount: links.length,
      recipient,
      nextUp: ['nearby_payments', 'escrow'],
    },
  };
}

export async function listUserPaymentLinks(user: AuthenticatedUser) {
  const paymentLinks = await listPaymentLinksForUser(user.id);
  const synchronizedPaymentLinks = await Promise.all(
    paymentLinks.map(synchronizePaymentLinkLifecycle)
  );
  const latestAttemptMap = await buildLatestAttemptMap(synchronizedPaymentLinks);

  return {
    paymentLinks: await Promise.all(
      synchronizedPaymentLinks.map((paymentLink) =>
        serializePaymentLink(paymentLink, {
          viewer: 'owner',
          latestAttempt: latestAttemptMap.get(paymentLink.id) ?? null,
        })
      )
    ),
  };
}

export async function createPaymentLink(
  user: AuthenticatedUser,
  input: CreatePaymentLinkInput
) {
  const paymentLink = await createPaymentLinkRecord({
    userId: user.id,
    slug: buildPaymentLinkSlug(),
    title: input.title?.trim() || null,
    note: input.note?.trim() || null,
    amount: input.amount,
  });

  return {
    paymentLink: await serializePaymentLink(paymentLink, {
      viewer: 'owner',
      latestAttempt: null,
    }),
  };
}

export async function generatePaymentQr(
  user: AuthenticatedUser,
  input: CreatePaymentLinkInput
) {
  const createdLink = await createPaymentLink(user, input);

  return {
    qrRequest: await buildSerializedPaymentQr(createdLink.paymentLink),
  };
}

export async function getPublicPaymentLink(slug: string) {
  const paymentLink = await synchronizePaymentLinkLifecycle(
    await requirePaymentLink(slug)
  );

  return {
    paymentLink: await serializePaymentLink(paymentLink, {
      viewer: 'public',
      latestAttempt: null,
    }),
  };
}

export async function getPublicPaymentQr(qrId: string) {
  const paymentLink = await getPublicPaymentLink(qrId);

  return {
    qrRequest: await buildSerializedPaymentQr(paymentLink.paymentLink),
  };
}

export async function deleteUserPaymentLink(user: AuthenticatedUser, slug: string) {
  const paymentLink = await synchronizePaymentLinkLifecycle(
    await requirePaymentLink(slug)
  );

  if (paymentLink.userId !== user.id) {
    throw new HttpError(404, 'Payment link not found');
  }

  if (paymentLink.status !== 'active') {
    throw new HttpError(409, 'Only active payment links can be removed', {
      status: paymentLink.status,
    });
  }

  const deleted = await deletePaymentLinkForUser(user.id, slug);

  if (!deleted) {
    throw new HttpError(404, 'Payment link not found');
  }

  return {
    deleted: true,
    slug: deleted.slug,
  };
}

export async function preflightPaymentLinkPayment(
  user: AuthenticatedUser,
  slug: string
) {
  const paymentLink = await synchronizePaymentLinkLifecycle(
    await requirePaymentLink(slug)
  );

  if (paymentLink.userId === user.id) {
    throw new HttpError(409, 'You cannot pay your own payment link');
  }

  assertPaymentLinkIsActive(paymentLink);

  const recipient = await buildRecipient(paymentLink.userId);
  const transfer = await buildMusdTransferPreflight({
    senderWalletAddress: user.walletAddress,
    recipientWalletAddress: recipient.walletAddress,
    amount: paymentLink.amount,
  });

  return {
    paymentLink: await serializePaymentLink(paymentLink, {
      viewer: 'public',
      latestAttempt: null,
    }),
    preflight: transfer.preflight,
  };
}

export async function preflightDirectSendPayment(
  user: AuthenticatedUser,
  input: SendPaymentInput
) {
  const recipient = await buildRecipientByUsername(input.username.trim());

  if (recipient.id === user.id) {
    throw new HttpError(409, 'You cannot send MUSD to your own username');
  }

  const transfer = await buildMusdTransferPreflight({
    senderWalletAddress: user.walletAddress,
    recipientWalletAddress: recipient.walletAddress,
    amount: input.amount,
  });

  return {
    payment: {
      recipient: {
        username: recipient.username,
        displayName: recipient.displayName,
        walletAddress: recipient.walletAddress,
      },
      amount: input.amount,
      currency: 'MUSD',
      note: input.note?.trim() || null,
    },
    preflight: transfer.preflight,
  };
}

export async function preflightPaymentQrPayment(
  user: AuthenticatedUser,
  qrId: string
) {
  const preflight = await preflightPaymentLinkPayment(user, qrId);

  return {
    qrRequest: await buildSerializedPaymentQr(preflight.paymentLink),
    paymentLink: preflight.paymentLink,
    preflight: preflight.preflight,
  };
}

export async function submitPaymentLinkPayment(
  user: AuthenticatedUser,
  slug: string,
  input: SubmitPaymentLinkInput
) {
  const normalizedSenderWalletAddress = normalizeWalletAddress(
    input.senderWalletAddress
  );
  const normalizedUserWalletAddress = normalizeWalletAddress(user.walletAddress);
  const normalizedTxHash = normalizeTxHash(input.txHash);

  if (normalizedSenderWalletAddress !== normalizedUserWalletAddress) {
    throw new HttpError(
      409,
      'senderWalletAddress must match the signed-in wallet'
    );
  }

  const paymentLink = await synchronizePaymentLinkLifecycle(
    await requirePaymentLink(slug)
  );

  if (paymentLink.userId === user.id) {
    throw new HttpError(409, 'You cannot pay your own payment link');
  }

  const existingAttempt = await findPaymentLinkAttemptByTxHash(normalizedTxHash);

  if (existingAttempt) {
    if (
      existingAttempt.paymentLinkId === paymentLink.id &&
      existingAttempt.senderWalletAddress === normalizedSenderWalletAddress
    ) {
      const refreshedLink = await synchronizePaymentLinkLifecycle(
        (await findPaymentLinkById(paymentLink.id)) ?? paymentLink
      );

      return {
        paymentLink: await serializePaymentLink(refreshedLink, {
          viewer: 'public',
          latestAttempt: null,
        }),
      };
    }

    throw new HttpError(
      409,
      'This transaction hash is already attached to another payment attempt'
    );
  }

  assertPaymentLinkIsActive(paymentLink);

  const [recipient, payerSnapshot] = await Promise.all([
    buildRecipient(paymentLink.userId),
    getWalletAssetSnapshot(normalizedSenderWalletAddress),
  ]);

  const amountBaseUnits = parseUnits(
    paymentLink.amount,
    payerSnapshot.musdDecimals
  ).toString();
  const submittedAt = new Date();

  await createPaymentLinkAttemptRecord({
    paymentLinkId: paymentLink.id,
    txHash: normalizedTxHash,
    senderWalletAddress: normalizedSenderWalletAddress,
    recipientWalletAddress: getAddress(recipient.walletAddress),
    tokenAddress: payerSnapshot.musdAddress,
    amountBaseUnits,
    submittedAt,
  });

  const updatedPaymentLink = await updatePaymentLinkRecordById(paymentLink.id, {
    status: 'submitted',
    submittedAt,
    confirmedAt: null,
  });

  return {
    paymentLink: await serializePaymentLink(updatedPaymentLink ?? paymentLink, {
      viewer: 'public',
      latestAttempt: null,
    }),
  };
}

export async function resetPaymentLink(user: AuthenticatedUser, slug: string) {
  const paymentLink = await synchronizePaymentLinkLifecycle(
    await requirePaymentLink(slug)
  );

  if (paymentLink.userId !== user.id) {
    throw new HttpError(404, 'Payment link not found');
  }

  if (paymentLink.status !== 'stale') {
    throw new HttpError(409, 'Only stale payment links can be reset', {
      status: paymentLink.status,
    });
  }

  const updatedPaymentLink = await updatePaymentLinkRecordById(paymentLink.id, {
    status: 'active',
    submittedAt: null,
    confirmedAt: null,
  });
  const nextPaymentLink = updatedPaymentLink ?? paymentLink;
  const latestAttemptMap = await buildLatestAttemptMap([nextPaymentLink]);

  return {
    paymentLink: await serializePaymentLink(nextPaymentLink, {
      viewer: 'owner',
      latestAttempt: latestAttemptMap.get(nextPaymentLink.id) ?? null,
    }),
  };
}

export async function confirmPaymentLinkAttemptFromTransfer(input: {
  txHash: string;
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
}) {
  const normalizedTxHash = normalizeTxHash(input.txHash);
  const normalizedFrom = normalizeWalletAddress(input.from);
  const normalizedTo = normalizeWalletAddress(input.to);
  const normalizedTokenAddress = normalizeWalletAddress(input.tokenAddress);
  const normalizedMusdTokenAddress = getMusdTokenAddress();

  if (normalizedTokenAddress !== normalizedMusdTokenAddress) {
    return {
      outcome: 'ignored' as const,
      reason: 'token_mismatch',
    };
  }

  const paymentLinkAttempt = await findPaymentLinkAttemptByTxHash(normalizedTxHash);

  if (!paymentLinkAttempt) {
    return {
      outcome: 'ignored' as const,
      reason: 'attempt_missing',
    };
  }

  const paymentLink = await findPaymentLinkById(paymentLinkAttempt.paymentLinkId);

  if (!paymentLink) {
    return {
      outcome: 'ignored' as const,
      reason: 'payment_link_missing',
    };
  }

  const synchronizedPaymentLink = await synchronizePaymentLinkLifecycle(paymentLink);

  if (
    paymentLinkAttempt.senderWalletAddress !== normalizedFrom ||
    paymentLinkAttempt.recipientWalletAddress !== normalizedTo ||
    paymentLinkAttempt.tokenAddress !== normalizedTokenAddress ||
    paymentLinkAttempt.amountBaseUnits !== input.value
  ) {
    return {
      outcome: 'ignored' as const,
      reason: 'transfer_mismatch',
    };
  }

  if (
    paymentLinkAttempt.status === 'confirmed' ||
    paymentLinkAttempt.status === 'duplicate_confirmed'
  ) {
    return {
      outcome: 'ignored' as const,
      reason: 'attempt_already_processed',
    };
  }

  const confirmedAt = new Date();

  if (synchronizedPaymentLink.status === 'confirmed') {
    await updatePaymentLinkAttemptRecordById(paymentLinkAttempt.id, {
      status: 'duplicate_confirmed',
      confirmedAt,
    });

    return {
      outcome: 'duplicate_confirmed' as const,
      paymentLinkId: synchronizedPaymentLink.id,
      paymentLinkSlug: synchronizedPaymentLink.slug,
    };
  }

  await updatePaymentLinkAttemptRecordById(paymentLinkAttempt.id, {
    status: 'confirmed',
    confirmedAt,
  });
  await updatePaymentLinkRecordById(synchronizedPaymentLink.id, {
    status: 'confirmed',
    confirmedAt,
  });

  return {
    outcome: 'confirmed' as const,
    paymentLinkId: synchronizedPaymentLink.id,
    paymentLinkSlug: synchronizedPaymentLink.slug,
  };
}
