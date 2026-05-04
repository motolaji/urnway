import { z } from 'zod';

const amountPattern = /^\d+(\.\d+)?$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createTripSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(80, 'title must be 80 characters or fewer'),
    destination: z
      .string()
      .trim()
      .min(1, 'destination is required')
      .max(80, 'destination must be 80 characters or fewer'),
    startDate: z.string().trim().regex(isoDatePattern, 'startDate must be in YYYY-MM-DD format'),
    endDate: z.string().trim().regex(isoDatePattern, 'endDate must be in YYYY-MM-DD format'),
    budgetAmount: z
      .string()
      .trim()
      .regex(amountPattern, 'budgetAmount must be a decimal string')
      .refine((value) => Number(value) > 0, 'budgetAmount must be greater than zero'),
    note: z.string().trim().min(1).max(240).optional(),
  })
  .superRefine((value, ctx) => {
    const start = new Date(`${value.startDate}T00:00:00.000Z`);
    const end = new Date(`${value.endDate}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be a valid date',
        path: ['startDate'],
      });
    }

    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must be a valid date',
        path: ['endDate'],
      });
    }

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must be on or after startDate',
        path: ['endDate'],
      });
    }
  });

export const tripIdSchema = z.object({
  id: z.string().uuid('Trip id must be a valid UUID'),
});

export const itineraryItemIdSchema = z.object({
  itemId: z.string().uuid('Itinerary item id must be a valid UUID'),
});

export const createTripItineraryItemSchema = z
  .object({
    type: z.enum(['flight', 'hotel', 'activity', 'note', 'transport']),
    title: z
      .string()
      .trim()
      .min(1, 'title is required')
      .max(80, 'title must be 80 characters or fewer'),
    date: z.string().trim().regex(isoDatePattern, 'date must be in YYYY-MM-DD format'),
    location: z.string().trim().min(1).max(80).optional(),
    note: z.string().trim().min(1).max(240).optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = new Date(`${value.date}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'date must be a valid date',
        path: ['date'],
      });
    }
  });

export const generateTripItinerarySchema = z.object({
  preferences: z.string().trim().max(400).optional(),
});

export const updateTripItineraryItemSchema = z
  .object({
    type: z.enum(['flight', 'hotel', 'activity', 'note', 'transport']).optional(),
    title: z
      .string()
      .trim()
      .min(1, 'title must not be empty')
      .max(80, 'title must be 80 characters or fewer')
      .optional(),
    date: z.string().trim().regex(isoDatePattern, 'date must be in YYYY-MM-DD format').optional(),
    location: z.string().trim().max(80).optional(),
    note: z.string().trim().max(240).optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update',
      });
    }

    if (value.date) {
      const parsed = new Date(`${value.date}T00:00:00.000Z`);

      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'date must be a valid date',
          path: ['date'],
        });
      }
    }
  });

export const updateTripSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'title must not be empty')
      .max(80, 'title must be 80 characters or fewer')
      .optional(),
    destination: z
      .string()
      .trim()
      .min(1, 'destination must not be empty')
      .max(80, 'destination must be 80 characters or fewer')
      .optional(),
    startDate: z
      .string()
      .trim()
      .regex(isoDatePattern, 'startDate must be in YYYY-MM-DD format')
      .optional(),
    endDate: z
      .string()
      .trim()
      .regex(isoDatePattern, 'endDate must be in YYYY-MM-DD format')
      .optional(),
    budgetAmount: z
      .string()
      .trim()
      .regex(amountPattern, 'budgetAmount must be a decimal string')
      .refine((value) => Number(value) > 0, 'budgetAmount must be greater than zero')
      .optional(),
    note: z.string().trim().max(240).optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update',
      });
    }

    if (value.startDate) {
      const start = new Date(`${value.startDate}T00:00:00.000Z`);

      if (Number.isNaN(start.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate must be a valid date',
          path: ['startDate'],
        });
      }
    }

    if (value.endDate) {
      const end = new Date(`${value.endDate}T00:00:00.000Z`);

      if (Number.isNaN(end.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate must be a valid date',
          path: ['endDate'],
        });
      }
    }

    if (value.startDate && value.endDate) {
      const start = new Date(`${value.startDate}T00:00:00.000Z`);
      const end = new Date(`${value.endDate}T00:00:00.000Z`);

      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate must be on or after startDate',
          path: ['endDate'],
        });
      }
    }
  });
