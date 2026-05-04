import { z } from 'zod';

export const createNonceSchema = z.object({
  walletAddress: z.string().min(1),
});

export const verifySignatureSchema = z.object({
  walletAddress: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().min(1),
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
