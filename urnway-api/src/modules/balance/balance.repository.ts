import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import {
  balanceAccounts,
  balanceLedgerEntries,
  balanceTopupIntents,
  balanceWithdrawalIntents,
  bookingCheckouts,
  sendCheckouts,
} from '../../db/schema.js';

type CreateBalanceAccountInput = {
  userId: string;
  currency?: string;
};

type UpdateBalanceAccountInput = Partial<{
  availableAmountMinor: number;
  reservedAmountMinor: number;
}>;

type CreateBalanceLedgerEntryInput = {
  accountId: string;
  userId: string;
  entryType: string;
  direction: string;
  amountMinor: number;
  currency?: string;
  status?: string;
  txHash?: string | null;
  chainId?: number | null;
  explorerUrl?: string | null;
  counterpartyWalletAddress?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
};

type CreateBalanceTopupIntentInput = {
  topupId: string;
  userId: string;
  amountMinor: number;
  currency?: string;
  treasuryWalletAddress: string;
  tokenAddress: string;
  status?: string;
  expiresAt?: Date | null;
};

type UpdateBalanceTopupIntentInput = Partial<{
  status: string;
  senderWalletAddress: string | null;
  txHash: string | null;
  chainId: number | null;
  explorerUrl: string | null;
  completedAt: Date | null;
  expiresAt: Date | null;
}>;

type CreateBalanceWithdrawalIntentInput = {
  withdrawalId: string;
  userId: string;
  amountMinor: number;
  currency?: string;
  treasuryWalletAddress: string;
  destinationWalletAddress: string;
  tokenAddress: string;
  chainId: number;
  status?: string;
  expiresAt?: Date | null;
};

type UpdateBalanceWithdrawalIntentInput = Partial<{
  status: string;
  txHash: string | null;
  chainId: number | null;
  explorerUrl: string | null;
  failureReason: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
}>;

type CreateSendCheckoutInput = {
  checkoutId: string;
  userId: string;
  receiverUserId: string;
  receiverPublicUserId?: string | null;
  receiverUsername?: string | null;
  amountMinor: number;
  currency?: string;
  source: string;
  urnwayBalanceAmountMinor: number;
  externalWalletAmountMinor: number;
  note?: string | null;
  status?: string;
  expiresAt?: Date | null;
};

type UpdateSendCheckoutInput = Partial<{
  status: string;
  completedAt: Date | null;
  expiresAt: Date | null;
}>;

type CreateBookingCheckoutInput = {
  checkoutId: string;
  userId: string;
  tripId?: string | null;
  bookingId?: string | null;
  mode: string;
  source: string;
  totalAmountMinor: number;
  currency?: string;
  quoteAmount: string;
  quoteCurrency: string;
  urnwayBalanceAmountMinor: number;
  externalWalletAmountMinor: number;
  payloadJson: string;
  status?: string;
  expiresAt?: Date | null;
};

type UpdateBookingCheckoutInput = Partial<{
  bookingId: string | null;
  status: string;
  completedAt: Date | null;
  expiresAt: Date | null;
}>;

export async function findBalanceAccountByUserId(userId: string) {
  const [account] = await db
    .select()
    .from(balanceAccounts)
    .where(eq(balanceAccounts.userId, userId))
    .limit(1);

  return account ?? null;
}

export async function createBalanceAccount(input: CreateBalanceAccountInput) {
  const [account] = await db
    .insert(balanceAccounts)
    .values({
      userId: input.userId,
      currency: input.currency ?? 'MUSD',
    })
    .returning();

  return account;
}

export async function updateBalanceAccountById(
  id: string,
  updates: UpdateBalanceAccountInput
) {
  const [account] = await db
    .update(balanceAccounts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(balanceAccounts.id, id))
    .returning();

  return account ?? null;
}

export async function createBalanceLedgerEntry(input: CreateBalanceLedgerEntryInput) {
  const [entry] = await db
    .insert(balanceLedgerEntries)
    .values({
      accountId: input.accountId,
      userId: input.userId,
      entryType: input.entryType,
      direction: input.direction,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'MUSD',
      status: input.status ?? 'completed',
      txHash: input.txHash ?? null,
      chainId: input.chainId ?? null,
      explorerUrl: input.explorerUrl ?? null,
      counterpartyWalletAddress: input.counterpartyWalletAddress ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      note: input.note ?? null,
    })
    .returning();

  return entry;
}

export async function createBalanceTopupIntentRecord(
  input: CreateBalanceTopupIntentInput
) {
  const [topupIntent] = await db
    .insert(balanceTopupIntents)
    .values({
      topupId: input.topupId,
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'MUSD',
      treasuryWalletAddress: input.treasuryWalletAddress,
      tokenAddress: input.tokenAddress,
      chainId: null,
      explorerUrl: null,
      status: input.status ?? 'prepared',
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return topupIntent;
}

export async function findBalanceTopupIntentByTopupId(topupId: string) {
  const [topupIntent] = await db
    .select()
    .from(balanceTopupIntents)
    .where(eq(balanceTopupIntents.topupId, topupId))
    .limit(1);

  return topupIntent ?? null;
}

export async function findBalanceTopupIntentByTxHash(txHash: string) {
  const [topupIntent] = await db
    .select()
    .from(balanceTopupIntents)
    .where(eq(balanceTopupIntents.txHash, txHash))
    .limit(1);

  return topupIntent ?? null;
}

export async function updateBalanceTopupIntentById(
  id: string,
  updates: UpdateBalanceTopupIntentInput
) {
  const [topupIntent] = await db
    .update(balanceTopupIntents)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(balanceTopupIntents.id, id))
    .returning();

  return topupIntent ?? null;
}

export async function createBalanceWithdrawalIntentRecord(
  input: CreateBalanceWithdrawalIntentInput
) {
  const [withdrawalIntent] = await db
    .insert(balanceWithdrawalIntents)
    .values({
      withdrawalId: input.withdrawalId,
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'MUSD',
      treasuryWalletAddress: input.treasuryWalletAddress,
      destinationWalletAddress: input.destinationWalletAddress,
      tokenAddress: input.tokenAddress,
      chainId: input.chainId,
      status: input.status ?? 'prepared',
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return withdrawalIntent;
}

export async function findBalanceWithdrawalIntentByWithdrawalId(withdrawalId: string) {
  const [withdrawalIntent] = await db
    .select()
    .from(balanceWithdrawalIntents)
    .where(eq(balanceWithdrawalIntents.withdrawalId, withdrawalId))
    .limit(1);

  return withdrawalIntent ?? null;
}

export async function updateBalanceWithdrawalIntentById(
  id: string,
  updates: UpdateBalanceWithdrawalIntentInput
) {
  const [withdrawalIntent] = await db
    .update(balanceWithdrawalIntents)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(balanceWithdrawalIntents.id, id))
    .returning();

  return withdrawalIntent ?? null;
}

export async function listBalanceLedgerEntriesByUserId(userId: string, limit = 50) {
  return db
    .select()
    .from(balanceLedgerEntries)
    .where(eq(balanceLedgerEntries.userId, userId))
    .orderBy(desc(balanceLedgerEntries.createdAt))
    .limit(limit);
}

export async function createSendCheckoutRecord(input: CreateSendCheckoutInput) {
  const [checkout] = await db
    .insert(sendCheckouts)
    .values({
      checkoutId: input.checkoutId,
      userId: input.userId,
      receiverUserId: input.receiverUserId,
      receiverPublicUserId: input.receiverPublicUserId ?? null,
      receiverUsername: input.receiverUsername ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'MUSD',
      source: input.source,
      urnwayBalanceAmountMinor: input.urnwayBalanceAmountMinor,
      externalWalletAmountMinor: input.externalWalletAmountMinor,
      note: input.note ?? null,
      status: input.status ?? 'prepared',
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return checkout;
}

export async function findSendCheckoutByCheckoutId(checkoutId: string) {
  const [checkout] = await db
    .select()
    .from(sendCheckouts)
    .where(eq(sendCheckouts.checkoutId, checkoutId))
    .limit(1);

  return checkout ?? null;
}

export async function updateSendCheckoutById(
  id: string,
  updates: UpdateSendCheckoutInput
) {
  const [checkout] = await db
    .update(sendCheckouts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(sendCheckouts.id, id))
    .returning();

  return checkout ?? null;
}

export async function createBookingCheckoutRecord(input: CreateBookingCheckoutInput) {
  const [checkout] = await db
    .insert(bookingCheckouts)
    .values({
      checkoutId: input.checkoutId,
      userId: input.userId,
      tripId: input.tripId ?? null,
      bookingId: input.bookingId ?? null,
      mode: input.mode,
      source: input.source,
      totalAmountMinor: input.totalAmountMinor,
      currency: input.currency ?? 'MUSD',
      quoteAmount: input.quoteAmount,
      quoteCurrency: input.quoteCurrency,
      urnwayBalanceAmountMinor: input.urnwayBalanceAmountMinor,
      externalWalletAmountMinor: input.externalWalletAmountMinor,
      payloadJson: input.payloadJson,
      status: input.status ?? 'prepared',
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  return checkout;
}

export async function findBookingCheckoutByCheckoutId(checkoutId: string) {
  const [checkout] = await db
    .select()
    .from(bookingCheckouts)
    .where(eq(bookingCheckouts.checkoutId, checkoutId))
    .limit(1);

  return checkout ?? null;
}

export async function updateBookingCheckoutById(
  id: string,
  updates: UpdateBookingCheckoutInput
) {
  const [checkout] = await db
    .update(bookingCheckouts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(bookingCheckouts.id, id))
    .returning();

  return checkout ?? null;
}
