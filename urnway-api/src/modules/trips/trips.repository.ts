import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { tripItineraryItems, trips } from '../../db/schema.js';

type CreateTripRecordInput = {
  userId: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  budgetAmount: string;
  currency?: string;
  note?: string | null;
  status?: string;
};

type UpdateTripRecordInput = Partial<{
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  budgetAmount: string;
  note: string | null;
  status: string;
}>;

type CreateTripItineraryItemRecordInput = {
  tripId: string;
  userId: string;
  type: string;
  title: string;
  date: string;
  location?: string | null;
  note?: string | null;
};

type UpdateTripItineraryItemRecordInput = Partial<{
  type: string;
  title: string;
  date: string;
  location: string | null;
  note: string | null;
}>;

export async function createTripRecord(input: CreateTripRecordInput) {
  const [trip] = await db
    .insert(trips)
    .values({
      userId: input.userId,
      title: input.title,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      budgetAmount: input.budgetAmount,
      currency: input.currency ?? 'MUSD',
      note: input.note ?? null,
      status: input.status ?? 'planning',
    })
    .returning();

  return trip;
}

export async function listTripsForUser(userId: string) {
  return db
    .select()
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(asc(trips.startDate), desc(trips.createdAt));
}

export async function findTripByIdForUser(userId: string, id: string) {
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, id)))
    .limit(1);

  return trip ?? null;
}

export async function updateTripRecordByIdForUser(
  userId: string,
  id: string,
  updates: UpdateTripRecordInput
) {
  const [trip] = await db
    .update(trips)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(trips.userId, userId), eq(trips.id, id)))
    .returning();

  return trip ?? null;
}

export async function listTripItineraryItemsForUserTrip(userId: string, tripId: string) {
  return db
    .select()
    .from(tripItineraryItems)
    .where(and(eq(tripItineraryItems.userId, userId), eq(tripItineraryItems.tripId, tripId)))
    .orderBy(asc(tripItineraryItems.date), asc(tripItineraryItems.createdAt));
}

export async function createTripItineraryItemRecord(input: CreateTripItineraryItemRecordInput) {
  const [item] = await db
    .insert(tripItineraryItems)
    .values({
      tripId: input.tripId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      date: input.date,
      location: input.location ?? null,
      note: input.note ?? null,
    })
    .returning();

  return item;
}

export async function findTripItineraryItemByIdForUserTrip(
  userId: string,
  tripId: string,
  itemId: string
) {
  const [item] = await db
    .select()
    .from(tripItineraryItems)
    .where(
      and(
        eq(tripItineraryItems.userId, userId),
        eq(tripItineraryItems.tripId, tripId),
        eq(tripItineraryItems.id, itemId)
      )
    )
    .limit(1);

  return item ?? null;
}

export async function updateTripItineraryItemRecordByIdForUserTrip(
  userId: string,
  tripId: string,
  itemId: string,
  updates: UpdateTripItineraryItemRecordInput
) {
  const [item] = await db
    .update(tripItineraryItems)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tripItineraryItems.userId, userId),
        eq(tripItineraryItems.tripId, tripId),
        eq(tripItineraryItems.id, itemId)
      )
    )
    .returning();

  return item ?? null;
}
