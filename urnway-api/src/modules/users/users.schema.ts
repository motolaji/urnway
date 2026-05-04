import { z } from 'zod';

export const updateCurrentUserSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(
        /^[a-z0-9_]+$/,
        'Username can only contain lowercase letters, numbers, and underscores'
      )
      .optional(),
    mezoId: z
      .string()
      .min(3)
      .max(30)
      .regex(
        /^[a-z0-9_]+$/,
        'Mezo ID can only contain lowercase letters, numbers, and underscores'
      )
      .optional(),
    email: z.email().max(120).optional(),
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.mezoId !== undefined ||
      value.email !== undefined,
    {
      message: 'Provide at least one field to update',
    }
  );

export const updatePushTokenSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

export const searchUsersSchema = z.object({
  q: z.string().min(1),
});
