import { z } from 'zod';
import { isAddress } from 'viem';

const amountPattern = /^\d+(\.\d+)?$/;
const txHashPattern = /^0x[a-fA-F0-9]{64}$/;

export const createPaymentLinkSchema = z.object({
  amount: z
    .string()
    .regex(amountPattern, 'Amount must be a decimal string')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  title: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().min(1).max(160).optional(),
});

export const createPaymentQrSchema = createPaymentLinkSchema;

export const sendPaymentSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'username is required')
    .max(40, 'username must be 40 characters or fewer'),
  amount: z
    .string()
    .regex(amountPattern, 'Amount must be a decimal string')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  note: z.string().trim().min(1).max(160).optional(),
});

export const submitPaymentLinkSchema = z.object({
  txHash: z.string().regex(txHashPattern, 'txHash must be a valid transaction hash'),
  senderWalletAddress: z
    .string()
    .refine((value) => isAddress(value, { strict: false }), 'senderWalletAddress must be a valid address'),
});

export const resetPaymentLinkSchema = z.object({});
