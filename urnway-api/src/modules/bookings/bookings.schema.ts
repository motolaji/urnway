import { z } from 'zod';

const amountPattern = /^\d+(\.\d+)?$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const travelLabelSchema = z
  .string()
  .trim()
  .min(2, 'Value must be at least 2 characters')
  .max(80, 'Value must be 80 characters or fewer');

export const bookingIdSchema = z.object({
  id: z.string().uuid('Booking id must be a valid UUID'),
});

export const flightSearchSchema = z
  .object({
    origin: travelLabelSchema,
    destination: travelLabelSchema,
    departDate: z.string().trim().regex(isoDatePattern, 'departDate must be YYYY-MM-DD'),
    returnDate: z
      .string()
      .trim()
      .regex(isoDatePattern, 'returnDate must be YYYY-MM-DD')
      .optional(),
    travelerCount: z.number().int().min(1).max(6).optional(),
    cabinClass: z.enum(['economy', 'premium', 'business']).optional(),
  })
  .superRefine((value, ctx) => {
    const departDate = new Date(`${value.departDate}T00:00:00.000Z`);

    if (Number.isNaN(departDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'departDate must be a valid date',
        path: ['departDate'],
      });
    }

    if (value.returnDate) {
      const returnDate = new Date(`${value.returnDate}T00:00:00.000Z`);

      if (Number.isNaN(returnDate.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'returnDate must be a valid date',
          path: ['returnDate'],
        });
      }

      if (!Number.isNaN(departDate.getTime()) && !Number.isNaN(returnDate.getTime()) && returnDate < departDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'returnDate must be on or after departDate',
          path: ['returnDate'],
        });
      }
    }
  });

export const hotelSearchSchema = z
  .object({
    city: travelLabelSchema,
    checkInDate: z.string().trim().regex(isoDatePattern, 'checkInDate must be YYYY-MM-DD'),
    checkOutDate: z.string().trim().regex(isoDatePattern, 'checkOutDate must be YYYY-MM-DD'),
    roomCount: z.number().int().min(1).max(4).optional(),
    roomTier: z.enum(['standard', 'deluxe', 'suite']).optional(),
  })
  .superRefine((value, ctx) => {
    const checkInDate = new Date(`${value.checkInDate}T00:00:00.000Z`);
    const checkOutDate = new Date(`${value.checkOutDate}T00:00:00.000Z`);

    if (Number.isNaN(checkInDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkInDate must be a valid date',
        path: ['checkInDate'],
      });
    }

    if (Number.isNaN(checkOutDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutDate must be a valid date',
        path: ['checkOutDate'],
      });
    }

    if (
      !Number.isNaN(checkInDate.getTime()) &&
      !Number.isNaN(checkOutDate.getTime()) &&
      checkOutDate <= checkInDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'checkOutDate must be after checkInDate',
        path: ['checkOutDate'],
      });
    }
  });

const flightOfferSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  originLabel: travelLabelSchema,
  originCode: z.string().trim().length(3, 'originCode must be 3 characters'),
  destinationLabel: travelLabelSchema,
  destinationCode: z.string().trim().length(3, 'destinationCode must be 3 characters'),
  departDate: z.string().trim().regex(isoDatePattern, 'departDate must be YYYY-MM-DD'),
  returnDate: z
    .string()
    .trim()
    .regex(isoDatePattern, 'returnDate must be YYYY-MM-DD')
    .optional(),
  carrierCode: z.string().trim().min(2).max(3),
  carrierName: z.string().trim().min(2).max(80),
  flightNumber: z.string().trim().min(2).max(16),
  duration: z.string().trim().min(2).max(20),
  cabinClass: z.enum(['economy', 'premium', 'business']),
  travelerCount: z.number().int().min(1).max(6),
  totalAmount: z
    .string()
    .trim()
    .regex(amountPattern, 'totalAmount must be a decimal string')
    .refine((value) => Number(value) > 0, 'totalAmount must be greater than zero'),
  currency: z.string().trim().min(3).max(8),
});

const hotelOfferSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  cityLabel: travelLabelSchema,
  cityCode: z.string().trim().length(3, 'cityCode must be 3 characters'),
  hotelName: z.string().trim().min(2).max(80),
  hotelCode: z.string().trim().min(2).max(12),
  providerCode: z.string().trim().min(2).max(6),
  providerName: z.string().trim().min(2).max(80),
  checkInDate: z.string().trim().regex(isoDatePattern, 'checkInDate must be YYYY-MM-DD'),
  checkOutDate: z.string().trim().regex(isoDatePattern, 'checkOutDate must be YYYY-MM-DD'),
  roomTier: z.enum(['standard', 'deluxe', 'suite']),
  roomCount: z.number().int().min(1).max(4),
  nightlyAmount: z
    .string()
    .trim()
    .regex(amountPattern, 'nightlyAmount must be a decimal string')
    .refine((value) => Number(value) > 0, 'nightlyAmount must be greater than zero'),
  totalAmount: z
    .string()
    .trim()
    .regex(amountPattern, 'totalAmount must be a decimal string')
    .refine((value) => Number(value) > 0, 'totalAmount must be greater than zero'),
  totalNights: z.number().int().min(1).max(30),
  currency: z.string().trim().min(3).max(8),
});

export const createFlightBookingSchema = z.object({
  offer: flightOfferSchema,
  passengerName: z
    .string()
    .trim()
    .min(2, 'passengerName is required')
    .max(80, 'passengerName must be 80 characters or fewer'),
  tripId: z.string().uuid().optional(),
  note: z.string().trim().max(240).optional(),
});

export const createHotelBookingSchema = z.object({
  offer: hotelOfferSchema,
  guestName: z
    .string()
    .trim()
    .min(2, 'guestName is required')
    .max(80, 'guestName must be 80 characters or fewer'),
  tripId: z.string().uuid().optional(),
  note: z.string().trim().max(240).optional(),
});

export const ticketIssueSchema = z.object({});
export const cancelBookingSchema = z.object({});

export const boardingPassIdSchema = z.object({
  id: z.string().uuid('Boarding pass id must be a valid UUID'),
});
