import { z } from 'zod';

const amountPattern = /^\d+(\.\d+)?$/;

export const createVaultSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80, 'name must be 80 characters or fewer'),
  targetAmount: z
    .string()
    .trim()
    .regex(amountPattern, 'targetAmount must be a decimal string')
    .refine((value) => Number(value) > 0, 'targetAmount must be greater than zero'),
  note: z.string().trim().min(1).max(160).optional(),
});

export const vaultIdSchema = z.object({
  id: z.string().uuid('Vault id must be a valid UUID'),
});
