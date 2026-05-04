import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { paymentLinkAttempts, paymentLinks } from '../../db/schema.js';

type CreatePaymentLinkRecordInput = {
  userId: string;
  slug: string;
  title?: string | null;
  note?: string | null;
  amount: string;
  expiresAt?: Date | null;
};

type UpdatePaymentLinkRecordInput = Partial<{
  status: string;
  submittedAt: Date | null;
  confirmedAt: Date | null;
}>;

type CreatePaymentLinkAttemptRecordInput = {
  paymentLinkId: string;
  txHash: string;
  senderWalletAddress: string;
  recipientWalletAddress: string;
  tokenAddress: string;
  amountBaseUnits: string;
  status?: string;
  submittedAt?: Date;
};

type UpdatePaymentLinkAttemptRecordInput = Partial<{
  status: string;
  confirmedAt: Date | null;
}>;

export async function createPaymentLinkRecord(input: CreatePaymentLinkRecordInput) {
  const [paymentLink] = await db
    .insert(paymentLinks)
    .values({
      userId: input.userId,
      slug: input.slug,
      title: input.title ?? null,
      note: input.note ?? null,
      amount: input.amount,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return paymentLink;
}

export async function listPaymentLinksForUser(userId: string) {
  return db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.userId, userId))
    .orderBy(desc(paymentLinks.createdAt));
}

export async function findPaymentLinkBySlug(slug: string) {
  const [paymentLink] = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.slug, slug))
    .limit(1);

  return paymentLink ?? null;
}

export async function findPaymentLinkById(id: string) {
  const [paymentLink] = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.id, id))
    .limit(1);

  return paymentLink ?? null;
}

export async function updatePaymentLinkRecordById(
  id: string,
  updates: UpdatePaymentLinkRecordInput
) {
  const [paymentLink] = await db
    .update(paymentLinks)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(paymentLinks.id, id))
    .returning();

  return paymentLink ?? null;
}

export async function deletePaymentLinkForUser(userId: string, slug: string) {
  const [paymentLink] = await db
    .delete(paymentLinks)
    .where(and(eq(paymentLinks.userId, userId), eq(paymentLinks.slug, slug)))
    .returning();

  return paymentLink ?? null;
}

export async function createPaymentLinkAttemptRecord(
  input: CreatePaymentLinkAttemptRecordInput
) {
  const [paymentLinkAttempt] = await db
    .insert(paymentLinkAttempts)
    .values({
      paymentLinkId: input.paymentLinkId,
      txHash: input.txHash,
      senderWalletAddress: input.senderWalletAddress,
      recipientWalletAddress: input.recipientWalletAddress,
      tokenAddress: input.tokenAddress,
      amountBaseUnits: input.amountBaseUnits,
      status: input.status ?? 'submitted',
      submittedAt: input.submittedAt ?? new Date(),
    })
    .returning();

  return paymentLinkAttempt;
}

export async function findPaymentLinkAttemptByTxHash(txHash: string) {
  const [paymentLinkAttempt] = await db
    .select()
    .from(paymentLinkAttempts)
    .where(eq(paymentLinkAttempts.txHash, txHash))
    .limit(1);

  return paymentLinkAttempt ?? null;
}

export async function listPaymentLinkAttemptsForLinkIds(paymentLinkIds: string[]) {
  if (paymentLinkIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(paymentLinkAttempts)
    .where(inArray(paymentLinkAttempts.paymentLinkId, paymentLinkIds))
    .orderBy(desc(paymentLinkAttempts.submittedAt), desc(paymentLinkAttempts.createdAt));
}

export async function updatePaymentLinkAttemptRecordById(
  id: string,
  updates: UpdatePaymentLinkAttemptRecordInput
) {
  const [paymentLinkAttempt] = await db
    .update(paymentLinkAttempts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(paymentLinkAttempts.id, id))
    .returning();

  return paymentLinkAttempt ?? null;
}

export async function markSubmittedAttemptsStaleForPaymentLink(paymentLinkId: string) {
  return db
    .update(paymentLinkAttempts)
    .set({
      status: 'stale',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentLinkAttempts.paymentLinkId, paymentLinkId),
        eq(paymentLinkAttempts.status, 'submitted')
      )
    )
    .returning();
}
