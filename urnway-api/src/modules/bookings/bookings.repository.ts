import { and, asc, desc, eq, gte } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { boardingPasses, bookings } from '../../db/schema.js';

type CreateBookingRecordInput = {
  userId: string;
  tripId?: string | null;
  provider?: string;
  providerOfferId?: string | null;
  providerOrderId?: string | null;
  holdExpiresAt?: Date | null;
  mode?: string;
  status?: string;
  originLabel: string;
  originCode: string;
  destinationLabel: string;
  destinationCode: string;
  departDate: string;
  returnDate?: string | null;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  duration: string;
  cabinClass: string;
  travelerCount: number;
  passengerName: string;
  totalAmount: string;
  currency?: string;
  bookingReference: string;
  note?: string | null;
  cancellationPolicy?: string;
};

type UpdateBookingRecordInput = Partial<{
  tripId: string | null;
  providerOrderId: string | null;
  holdExpiresAt: Date | null;
  status: string;
  refundStatus: string;
  refundAmount: string;
  cancelRequestedAt: Date | null;
  refundedAt: Date | null;
  ticketIssuedAt: Date | null;
  note: string | null;
}>;

type CreateBoardingPassRecordInput = {
  bookingId: string;
  userId: string;
  status?: string;
  passengerName: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  departDate: string;
  bookingReference: string;
  ticketNumber: string;
  gate: string;
  seat: string;
  boardingGroup: string;
  qrPayload: string;
};

export async function createBookingRecord(input: CreateBookingRecordInput) {
  const [booking] = await db
    .insert(bookings)
    .values({
      userId: input.userId,
      tripId: input.tripId ?? null,
      provider: input.provider ?? 'demo',
      providerOfferId: input.providerOfferId ?? null,
      providerOrderId: input.providerOrderId ?? null,
      holdExpiresAt: input.holdExpiresAt ?? null,
      mode: input.mode ?? 'flight',
      status: input.status ?? 'confirmed',
      originLabel: input.originLabel,
      originCode: input.originCode,
      destinationLabel: input.destinationLabel,
      destinationCode: input.destinationCode,
      departDate: input.departDate,
      returnDate: input.returnDate ?? null,
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      flightNumber: input.flightNumber,
      duration: input.duration,
      cabinClass: input.cabinClass,
      travelerCount: input.travelerCount,
      passengerName: input.passengerName,
      totalAmount: input.totalAmount,
      currency: input.currency ?? 'MUSD',
      bookingReference: input.bookingReference,
      note: input.note ?? null,
      cancellationPolicy: input.cancellationPolicy ?? 'Flexible refund policy',
    })
    .returning();

  return booking;
}

export async function listBookingsForUser(userId: string) {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt));
}

export async function findBookingByIdForUser(userId: string, id: string) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.id, id)))
    .limit(1);

  return booking ?? null;
}

export async function updateBookingRecordByIdForUser(
  userId: string,
  id: string,
  updates: UpdateBookingRecordInput
) {
  const [booking] = await db
    .update(bookings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.userId, userId), eq(bookings.id, id)))
    .returning();

  return booking ?? null;
}

export async function createBoardingPassRecord(input: CreateBoardingPassRecordInput) {
  const [boardingPass] = await db
    .insert(boardingPasses)
    .values({
      bookingId: input.bookingId,
      userId: input.userId,
      status: input.status ?? 'issued',
      passengerName: input.passengerName,
      carrierCode: input.carrierCode,
      carrierName: input.carrierName,
      flightNumber: input.flightNumber,
      originCode: input.originCode,
      destinationCode: input.destinationCode,
      departDate: input.departDate,
      bookingReference: input.bookingReference,
      ticketNumber: input.ticketNumber,
      gate: input.gate,
      seat: input.seat,
      boardingGroup: input.boardingGroup,
      qrPayload: input.qrPayload,
    })
    .returning();

  return boardingPass;
}

export async function findBoardingPassByIdForUser(userId: string, id: string) {
  const [boardingPass] = await db
    .select()
    .from(boardingPasses)
    .where(and(eq(boardingPasses.userId, userId), eq(boardingPasses.id, id)))
    .limit(1);

  return boardingPass ?? null;
}

export async function findBoardingPassByBookingIdForUser(userId: string, bookingId: string) {
  const [boardingPass] = await db
    .select()
    .from(boardingPasses)
    .where(and(eq(boardingPasses.userId, userId), eq(boardingPasses.bookingId, bookingId)))
    .limit(1);

  return boardingPass ?? null;
}

export async function updateBoardingPassByBookingIdForUser(
  userId: string,
  bookingId: string,
  updates: Partial<{
    status: string;
  }>
) {
  const [boardingPass] = await db
    .update(boardingPasses)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(boardingPasses.userId, userId), eq(boardingPasses.bookingId, bookingId)))
    .returning();

  return boardingPass ?? null;
}

export async function listBoardingPassesForUser(userId: string) {
  return db
    .select()
    .from(boardingPasses)
    .where(eq(boardingPasses.userId, userId))
    .orderBy(asc(boardingPasses.departDate), desc(boardingPasses.createdAt));
}

export async function findNextBoardingPassForUser(userId: string, today: string) {
  const [boardingPass] = await db
    .select()
    .from(boardingPasses)
    .where(
      and(
        eq(boardingPasses.userId, userId),
        eq(boardingPasses.status, 'issued'),
        gte(boardingPasses.departDate, today)
      )
    )
    .orderBy(asc(boardingPasses.departDate), asc(boardingPasses.createdAt))
    .limit(1);

  return boardingPass ?? null;
}
