import { HttpError } from '../../utils/http-error.js';
import { generateTripItineraryDraftWithAi } from './trips.ai.js';
import {
  createTripItineraryItemRecord,
  createTripRecord,
  findTripItineraryItemByIdForUserTrip,
  findTripByIdForUser,
  listTripItineraryItemsForUserTrip,
  listTripsForUser,
  updateTripRecordByIdForUser,
  updateTripItineraryItemRecordByIdForUserTrip,
} from './trips.repository.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type CreateTripInput = {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetAmount: string;
  note?: string;
};

type UpdateTripInput = Partial<CreateTripInput>;

type CreateTripItineraryItemInput = {
  type: 'flight' | 'hotel' | 'activity' | 'note' | 'transport';
  title: string;
  date: string;
  location?: string;
  note?: string;
};

type UpdateTripItineraryItemInput = Partial<CreateTripItineraryItemInput>;
type GenerateTripItineraryInput = {
  preferences?: string;
};

function toSafeNumber(value: string) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatAmount(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function normalizeDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calculateTripLifecycle(startDate: Date, endDate: Date) {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  today.setUTCHours(0, 0, 0, 0);

  if (today < start) {
    return 'upcoming';
  }

  if (today > end) {
    return 'completed';
  }

  return 'active';
}

function calculateDaysUntil(startDate: Date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);

  const diffMs = start.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function serializeTrip(trip: Awaited<ReturnType<typeof findTripByIdForUser>>) {
  if (!trip) {
    return null;
  }

  const lifecycle = calculateTripLifecycle(trip.startDate, trip.endDate);
  const daysUntilStart = calculateDaysUntil(trip.startDate);

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: normalizeDate(trip.startDate),
    endDate: normalizeDate(trip.endDate),
    budgetAmount: trip.budgetAmount,
    currency: trip.currency,
    note: trip.note,
    status: trip.status,
    lifecycle,
    daysUntilStart,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

function serializeTripItineraryItem(
  item: Awaited<ReturnType<typeof findTripItineraryItemByIdForUserTrip>>
) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    type: item.type as CreateTripItineraryItemInput['type'],
    title: item.title,
    date: item.date,
    location: item.location,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function assertItineraryDateWithinTrip(
  date: string,
  trip: NonNullable<Awaited<ReturnType<typeof findTripByIdForUser>>>
) {
  const tripStart = normalizeDate(trip.startDate);
  const tripEnd = normalizeDate(trip.endDate);

  if (date < tripStart || date > tripEnd) {
    throw new HttpError(
      400,
      `Itinerary date must be between ${tripStart} and ${tripEnd}`
    );
  }
}

async function buildSerializedTripDetail(
  user: AuthenticatedUser,
  trip: NonNullable<Awaited<ReturnType<typeof findTripByIdForUser>>>
) {
  const itineraryItems = await listTripItineraryItemsForUserTrip(user.id, trip.id);

  return {
    ...serializeTrip(trip),
    itinerary: itineraryItems
      .map((item) => serializeTripItineraryItem(item))
      .filter(Boolean),
    itineraryItemCount: itineraryItems.length,
  };
}

export async function listUserTrips(user: AuthenticatedUser) {
  const storedTrips = await listTripsForUser(user.id);
  const serializedTrips = storedTrips.map((trip) => serializeTrip(trip)).filter(Boolean);

  const totalBudget = storedTrips.reduce(
    (sum, trip) => sum + toSafeNumber(trip.budgetAmount),
    0
  );
  const upcomingCount = storedTrips.filter(
    (trip) => calculateTripLifecycle(trip.startDate, trip.endDate) === 'upcoming'
  ).length;
  const activeCount = storedTrips.filter(
    (trip) => calculateTripLifecycle(trip.startDate, trip.endDate) === 'active'
  ).length;

  return {
    summary: {
      tripCount: storedTrips.length,
      upcomingCount,
      activeCount,
      totalBudgetAmount: formatAmount(totalBudget),
      currency: 'MUSD',
    },
    trips: serializedTrips,
  };
}

export async function createTrip(user: AuthenticatedUser, input: CreateTripInput) {
  const createdTrip = await createTripRecord({
    userId: user.id,
    title: input.title,
    destination: input.destination,
    startDate: new Date(`${input.startDate}T00:00:00.000Z`),
    endDate: new Date(`${input.endDate}T00:00:00.000Z`),
    budgetAmount: input.budgetAmount,
    note: input.note ?? null,
  });

  return {
    trip: serializeTrip(createdTrip),
  };
}

export async function getTripById(user: AuthenticatedUser, id: string) {
  const trip = await findTripByIdForUser(user.id, id);

  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  return {
    trip: await buildSerializedTripDetail(user, trip),
  };
}

export async function updateTrip(user: AuthenticatedUser, id: string, input: UpdateTripInput) {
  const storedTrip = await findTripByIdForUser(user.id, id);

  if (!storedTrip) {
    throw new HttpError(404, 'Trip not found');
  }

  const nextStartDate = input.startDate
    ? new Date(`${input.startDate}T00:00:00.000Z`)
    : storedTrip.startDate;
  const nextEndDate = input.endDate
    ? new Date(`${input.endDate}T00:00:00.000Z`)
    : storedTrip.endDate;

  if (nextEndDate < nextStartDate) {
    throw new HttpError(400, 'endDate must be on or after startDate');
  }

  const updatedTrip = await updateTripRecordByIdForUser(user.id, id, {
    title: input.title ?? storedTrip.title,
    destination: input.destination ?? storedTrip.destination,
    startDate: nextStartDate,
    endDate: nextEndDate,
    budgetAmount: input.budgetAmount ?? storedTrip.budgetAmount,
    note: input.note !== undefined ? input.note.trim() || null : storedTrip.note,
  });

  if (!updatedTrip) {
    throw new HttpError(404, 'Trip not found');
  }

  return {
    trip: await buildSerializedTripDetail(user, updatedTrip),
  };
}

export async function createTripItineraryItem(
  user: AuthenticatedUser,
  tripId: string,
  input: CreateTripItineraryItemInput
) {
  const trip = await findTripByIdForUser(user.id, tripId);

  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  assertItineraryDateWithinTrip(input.date, trip);

  const createdItem = await createTripItineraryItemRecord({
    tripId: trip.id,
    userId: user.id,
    type: input.type,
    title: input.title.trim(),
    date: input.date,
    location: input.location?.trim() || null,
    note: input.note?.trim() || null,
  });

  return {
    itineraryItem: serializeTripItineraryItem(createdItem),
  };
}

export async function updateTripItineraryItem(
  user: AuthenticatedUser,
  tripId: string,
  itemId: string,
  input: UpdateTripItineraryItemInput
) {
  const [trip, storedItem] = await Promise.all([
    findTripByIdForUser(user.id, tripId),
    findTripItineraryItemByIdForUserTrip(user.id, tripId, itemId),
  ]);

  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  if (!storedItem) {
    throw new HttpError(404, 'Itinerary item not found');
  }

  const nextDate = input.date ?? storedItem.date;
  assertItineraryDateWithinTrip(nextDate, trip);

  const updatedItem = await updateTripItineraryItemRecordByIdForUserTrip(
    user.id,
    tripId,
    itemId,
    {
      type: input.type ?? storedItem.type,
      title: input.title?.trim() ?? storedItem.title,
      date: nextDate,
      location:
        input.location !== undefined ? input.location.trim() || null : storedItem.location,
      note: input.note !== undefined ? input.note.trim() || null : storedItem.note,
    }
  );

  if (!updatedItem) {
    throw new HttpError(404, 'Itinerary item not found');
  }

  return {
    itineraryItem: serializeTripItineraryItem(updatedItem),
  };
}

export async function generateTripItineraryDraft(
  user: AuthenticatedUser,
  tripId: string,
  input: GenerateTripItineraryInput
) {
  const trip = await findTripByIdForUser(user.id, tripId);

  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  return generateTripItineraryDraftWithAi({
    title: trip.title,
    destination: trip.destination,
    startDate: normalizeDate(trip.startDate),
    endDate: normalizeDate(trip.endDate),
    budgetAmount: trip.budgetAmount,
    currency: trip.currency,
    note: trip.note,
    preferences: input.preferences,
  });
}
