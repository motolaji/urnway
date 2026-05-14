import { z } from 'zod';
import { isAddress } from 'viem';

const txHashPattern = /^0x[a-fA-F0-9]{64}$/;

export const topupIdSchema = z.object({
  topupId: z.string().trim().min(1, 'topupId is required'),
});

export const withdrawalIdSchema = z.object({
  withdrawalId: z.string().trim().min(1, 'withdrawalId is required'),
});

export const prepareBalanceTopupSchema = z.object({
  amountMinor: z
    .number()
    .int('amountMinor must be an integer')
    .positive('amountMinor must be greater than zero'),
  currency: z
    .string()
    .trim()
    .min(3, 'currency must be at least 3 characters')
    .max(8, 'currency must be 8 characters or fewer')
    .transform((value) => value.toUpperCase()),
});

export const submitBalanceTopupSchema = z.object({
  txHash: z.string().regex(txHashPattern, 'txHash must be a valid transaction hash'),
  senderWalletAddress: z
    .string()
    .refine((value) => isAddress(value, { strict: false }), 'senderWalletAddress must be a valid address'),
});

export const prepareBalanceWithdrawalSchema = z.object({
  amountMinor: z
    .number()
    .int('amountMinor must be an integer')
    .positive('amountMinor must be greater than zero'),
  currency: z
    .string()
    .trim()
    .min(3, 'currency must be at least 3 characters')
    .max(8, 'currency must be 8 characters or fewer')
    .transform((value) => value.toUpperCase()),
});

export const submitBalanceWithdrawalSchema = z.object({});
