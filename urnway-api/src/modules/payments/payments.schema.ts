import { z } from 'zod';
import { isAddress } from 'viem';

const amountPattern = /^\d+(\.\d+)?$/;
const txHashPattern = /^0x[a-fA-F0-9]{64}$/;
const paymentSourceSchema = z.enum(['urnway_balance', 'external_wallet', 'split']);

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

export const sendCheckoutIdSchema = z.object({
  checkoutId: z.string().trim().min(1, 'checkoutId is required'),
});

export const prepareSendCheckoutSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, 'username must be at least 1 character')
      .max(40, 'username must be 40 characters or fewer')
      .optional(),
    receiverPublicUserId: z
      .string()
      .trim()
      .min(1, 'receiverPublicUserId must be at least 1 character')
      .max(40, 'receiverPublicUserId must be 40 characters or fewer')
      .optional(),
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
    source: paymentSourceSchema,
    note: z.string().trim().max(160).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.username && !value.receiverPublicUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['username'],
        message: 'username or receiverPublicUserId is required',
      });
    }
  });

export const completeSendCheckoutSchema = z.object({
  topupId: z.string().trim().min(1).optional(),
});

export const createNearbyPaymentIntentSchema = z.object({
  receiverPublicUserId: z
    .string()
    .trim()
    .min(1, 'receiverPublicUserId is required')
    .max(40, 'receiverPublicUserId must be 40 characters or fewer'),
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

export const completeNearbyPaymentIntentSchema = z.object({});

export const submitPaymentLinkSchema = z.object({
  txHash: z.string().regex(txHashPattern, 'txHash must be a valid transaction hash'),
  senderWalletAddress: z
    .string()
    .refine((value) => isAddress(value, { strict: false }), 'senderWalletAddress must be a valid address'),
});

export const resetPaymentLinkSchema = z.object({});
