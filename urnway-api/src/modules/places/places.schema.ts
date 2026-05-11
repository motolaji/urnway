import { z } from 'zod';

export const autocompletePlacesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'q must be at least 2 characters')
    .max(120, 'q must be 120 characters or fewer'),
  scope: z.enum(['flight', 'stay', 'trip']).default('trip'),
});
