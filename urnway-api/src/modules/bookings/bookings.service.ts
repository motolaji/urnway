import { HttpError } from '../../utils/http-error.js';
import {
  createBoardingPassRecord,
  createBookingRecord,
  findBoardingPassByBookingIdForUser,
  findBookingByIdForUser,
  listBookingsForUser,
  updateBoardingPassByBookingIdForUser,
  updateBookingRecordByIdForUser,
} from './bookings.repository.js';
import {
  createTripItineraryItemRecord,
  findTripByIdForUser,
} from '../trips/trips.repository.js';
import {
  canResolveDuffelSearch,
  createDuffelHoldOrder,
  isDuffelConfigured,
  searchDuffelFlightOffers,
} from './duffel.service.js';
import {
  canResolveDuffelHotelSearch,
  createDuffelStayBooking,
  isDuffelStaysConfigured,
  searchDuffelHotelOffers,
} from './duffel-stays.service.js';
import {
  canResolveLiteApiHotelSearch,
  cancelLiteApiBooking,
  createLiteApiHotelBooking,
  isLiteApiConfigured,
  searchLiteApiHotelOffers,
} from './liteapi.service.js';
import type {
  CreateFlightBookingInput,
  CreateHotelBookingInput,
  FlightOffer,
  HotelOffer,
  SearchFlightsInput,
  SearchHotelsInput,
} from './bookings.types.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type TripRecord = NonNullable<Awaited<ReturnType<typeof findTripByIdForUser>>>;

const carriers = [
  { code: 'MZ', name: 'Mezo Air' },
  { code: 'SKY', name: 'Sky Atlas' },
  { code: 'ORX', name: 'Orchid Express' },
  { code: 'NT', name: 'Northline' },
];

const hotels = [
  { code: 'ATL', name: 'Atlas House' },
  { code: 'LUM', name: 'Lumen Stay' },
  { code: 'CST', name: 'Coastline Suites' },
  { code: 'RIV', name: 'Riviera Rooms' },
];

function normalizeLabel(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toTravelCode(value: string) {
  const code = value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
  return code.padEnd(3, 'X');
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function toAmountString(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function createBookingReference(seed: string) {
  return `URN${hashString(seed).toString(36).toUpperCase().slice(0, 6)}`;
}

function createTicketNumber(seed: string) {
  return `016-${hashString(seed).toString().slice(0, 10).padEnd(10, '0')}`;
}

function formatIsoDate(date: Date) {
  return date.toISOString();
}

function normalizeTripDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculateNightCount(checkInDate: string, checkOutDate: string) {
  const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);
  return Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function assertTripContainsDate(trip: TripRecord, date: string, fieldName: string) {
  const tripStart = normalizeTripDate(trip.startDate);
  const tripEnd = normalizeTripDate(trip.endDate);

  if (date < tripStart || date > tripEnd) {
    throw new HttpError(
      400,
      `${fieldName} must fall within the linked trip window (${tripStart} to ${tripEnd})`
    );
  }
}

async function resolveLinkedTripForBooking(
  user: AuthenticatedUser,
  tripId: string | undefined,
  startDate: string,
  endDate?: string | null
) {
  if (!tripId) {
    return null;
  }

  const trip = await findTripByIdForUser(user.id, tripId);

  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  assertTripContainsDate(trip, startDate, 'Booking start date');

  if (endDate) {
    assertTripContainsDate(trip, endDate, 'Booking end date');
  }

  return trip;
}

async function attachBookingToTripItinerary(
  user: AuthenticatedUser,
  trip: TripRecord | null,
  booking: NonNullable<Awaited<ReturnType<typeof findBookingByIdForUser>>>
) {
  if (!trip) {
    return;
  }

  if (booking.mode === 'hotel') {
    await createTripItineraryItemRecord({
      tripId: trip.id,
      userId: user.id,
      type: 'hotel',
      title: booking.destinationLabel,
      date: booking.departDate,
      location: booking.originLabel,
      note: [
        `${booking.carrierName} booking`,
        booking.returnDate ? `Checkout ${booking.returnDate}` : null,
        `Ref ${booking.bookingReference}`,
      ]
        .filter(Boolean)
        .join(' · '),
    });

    return;
  }

  await createTripItineraryItemRecord({
    tripId: trip.id,
    userId: user.id,
    type: 'flight',
    title: `${booking.originCode} to ${booking.destinationCode}`,
    date: booking.departDate,
    location: booking.destinationLabel,
    note: [
      `${booking.carrierName} ${booking.flightNumber}`,
      booking.returnDate ? `Return ${booking.returnDate}` : null,
      `Ref ${booking.bookingReference}`,
    ]
      .filter(Boolean)
      .join(' · '),
  });
}

function serializeFlightOffer(offer: FlightOffer) {
  return {
    ...offer,
    mode: 'flight' as const,
  };
}

function serializeHotelOffer(offer: HotelOffer) {
  return {
    ...offer,
    mode: 'hotel' as const,
  };
}

function serializeBoardingPass(
  boardingPass: Awaited<ReturnType<typeof findBoardingPassByBookingIdForUser>>
) {
  if (!boardingPass) {
    return null;
  }

  return {
    id: boardingPass.id,
    bookingId: boardingPass.bookingId,
    status: boardingPass.status,
    passengerName: boardingPass.passengerName,
    bookingReference: boardingPass.bookingReference,
    ticketNumber: boardingPass.ticketNumber,
    qrPayload: boardingPass.qrPayload,
    travel: {
      carrierCode: boardingPass.carrierCode,
      carrierName: boardingPass.carrierName,
      flightNumber: boardingPass.flightNumber,
      originCode: boardingPass.originCode,
      destinationCode: boardingPass.destinationCode,
      departDate: boardingPass.departDate,
      gate: boardingPass.gate,
      seat: boardingPass.seat,
      boardingGroup: boardingPass.boardingGroup,
    },
    issuedAt: boardingPass.issuedAt.toISOString(),
    createdAt: boardingPass.createdAt.toISOString(),
    updatedAt: boardingPass.updatedAt.toISOString(),
  };
}

function calculateRefundPreview(
  booking: NonNullable<Awaited<ReturnType<typeof findBookingByIdForUser>>>
) {
  const bookingDate = booking.mode === 'hotel' ? booking.departDate : booking.departDate;
  const startDate = new Date(`${bookingDate}T00:00:00.000Z`);
  const now = new Date();
  const dayDiff = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const totalAmount = Number.parseFloat(booking.totalAmount || '0');

  if (booking.mode === 'hotel') {
    if (dayDiff <= 1) {
      return {
        policy: 'Non-refundable within 24 hours of check-in.',
        status: 'not_eligible',
        amount: '0',
      };
    }

    const ratio = dayDiff <= 3 ? 0.5 : 0.8;
    return {
      policy: dayDiff <= 3 ? '50% refund within 72 hours.' : '80% refund before the final 72 hours.',
      status: 'pending',
      amount: toAmountString(totalAmount * ratio),
    };
  }

  if (dayDiff <= 2) {
    return {
      policy: 'Non-refundable within 48 hours of departure.',
      status: 'not_eligible',
      amount: '0',
    };
  }

  const ratio = dayDiff <= 7 ? 0.6 : 0.85;
  return {
    policy: dayDiff <= 7 ? '60% refund inside 7 days.' : '85% refund before 7 days.',
    status: 'pending',
    amount: toAmountString(totalAmount * ratio),
  };
}

function deriveRefundState(
  booking: NonNullable<Awaited<ReturnType<typeof findBookingByIdForUser>>>
) {
  const baseStatus = booking.refundStatus;
  const requestedAt = booking.cancelRequestedAt;
  const preview = calculateRefundPreview(booking);

  if (!requestedAt) {
    return {
      status: 'not_requested',
      amount: booking.refundAmount,
      requestedAt: null,
      refundedAt: booking.refundedAt ? formatIsoDate(booking.refundedAt) : null,
      estimatedArrival: null,
      policy: booking.cancellationPolicy,
    };
  }

  if (baseStatus === 'not_eligible') {
    return {
      status: 'not_eligible',
      amount: booking.refundAmount,
      requestedAt: formatIsoDate(requestedAt),
      refundedAt: null,
      estimatedArrival: null,
      policy: booking.cancellationPolicy,
    };
  }

  const autoRefundAt = new Date(requestedAt.getTime() + 10 * 60 * 1000);
  const isSettled = Boolean(booking.refundedAt) || new Date() >= autoRefundAt;

  return {
    status: isSettled ? 'refunded' : 'pending',
    amount: booking.refundAmount || preview.amount,
    requestedAt: formatIsoDate(requestedAt),
    refundedAt: isSettled ? formatIsoDate(booking.refundedAt ?? autoRefundAt) : null,
    estimatedArrival: isSettled ? null : autoRefundAt.toISOString(),
    policy: booking.cancellationPolicy,
  };
}

async function serializeBooking(
  user: AuthenticatedUser,
  booking: NonNullable<Awaited<ReturnType<typeof findBookingByIdForUser>>>
) {
  const boardingPass = await findBoardingPassByBookingIdForUser(user.id, booking.id);
  const isFlight = booking.mode === 'flight';

  return {
    id: booking.id,
    tripId: booking.tripId,
    provider: {
      code: booking.provider as 'demo' | 'duffel' | 'liteapi',
      offerId: booking.providerOfferId,
      orderId: booking.providerOrderId,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    },
    mode: booking.mode,
    status: booking.status,
    passengerName: booking.passengerName,
    bookingReference: booking.bookingReference,
    note: booking.note,
    payment: {
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    },
    travel: isFlight
      ? {
          origin: {
            label: booking.originLabel,
            code: booking.originCode,
          },
          destination: {
            label: booking.destinationLabel,
            code: booking.destinationCode,
          },
          departDate: booking.departDate,
          returnDate: booking.returnDate,
          carrierCode: booking.carrierCode,
          carrierName: booking.carrierName,
          flightNumber: booking.flightNumber,
          duration: booking.duration,
          cabinClass: booking.cabinClass,
          travelerCount: booking.travelerCount,
        }
      : null,
    stay: !isFlight
      ? {
          city: {
            label: booking.originLabel,
            code: booking.originCode,
          },
          hotel: {
            label: booking.destinationLabel,
            code: booking.destinationCode,
          },
          checkInDate: booking.departDate,
          checkOutDate: booking.returnDate,
          providerCode: booking.carrierCode,
          providerName: booking.carrierName,
          roomTier: booking.cabinClass,
          roomCount: booking.travelerCount,
          nightlyAmount: booking.duration,
          totalNights: calculateNightCount(booking.departDate, booking.returnDate ?? booking.departDate),
        }
      : null,
    ticket: {
      issued: isFlight ? Boolean(boardingPass && boardingPass.status === 'issued') : false,
      boardingPassId: boardingPass?.id ?? null,
      ticketIssuedAt: booking.ticketIssuedAt?.toISOString() ?? null,
      canIssueBoardingPass:
        isFlight && booking.status === 'confirmed' && (!boardingPass || boardingPass.status !== 'issued'),
    },
    cancellation: {
      canCancel:
        booking.status === 'confirmed' ||
        booking.status === 'ticketed' ||
        (booking.status === 'held' && booking.provider !== 'duffel'),
      cancelledAt: booking.cancelRequestedAt?.toISOString() ?? null,
      policy: booking.cancellationPolicy,
    },
    refund: deriveRefundState(booking),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

export async function searchFlightOffers(input: SearchFlightsInput) {
  if (isDuffelConfigured() && canResolveDuffelSearch(input)) {
    return searchDuffelFlightOffers(input);
  }

  const originLabel = normalizeLabel(input.origin);
  const destinationLabel = normalizeLabel(input.destination);
  const originCode = toTravelCode(originLabel);
  const destinationCode = toTravelCode(destinationLabel);
  const travelerCount = input.travelerCount ?? 1;
  const cabinClass = input.cabinClass ?? 'economy';
  const seed = `${originCode}:${destinationCode}:${input.departDate}:${input.returnDate ?? ''}:${travelerCount}:${cabinClass}`;
  const baseHash = hashString(seed);

  const offers = Array.from({ length: 4 }).map((_, index) => {
    const carrier = carriers[(baseHash + index) % carriers.length];
    const amountBase = 185 + (baseHash % 140) + index * 37 + travelerCount * 42;
    const cabinMultiplier =
      cabinClass === 'business' ? 2.2 : cabinClass === 'premium' ? 1.45 : 1;
    const totalAmount = toAmountString(amountBase * cabinMultiplier);
    const durationHours = 4 + ((baseHash + index * 13) % 9);
    const durationMinutes = ((baseHash >> (index + 1)) % 2) * 30;
    const flightNumber = `${carrier.code}${120 + ((baseHash + index * 17) % 760)}`;

    return serializeFlightOffer({
      offerId: `flt_${hashString(`${seed}:${index}`).toString(36)}`,
      provider: 'demo',
      providerOfferId: null,
      providerOfferRequestId: null,
      expiresAt: null,
      requiresInstantPayment: false,
      originLabel,
      originCode,
      destinationLabel,
      destinationCode,
      departDate: input.departDate,
      returnDate: input.returnDate,
      carrierCode: carrier.code,
      carrierName: carrier.name,
      flightNumber,
      duration: `${durationHours}h ${durationMinutes.toString().padStart(2, '0')}m`,
      cabinClass,
      travelerCount,
      totalAmount,
      currency: 'MUSD',
    });
  });

  return {
    query: {
      origin: originLabel,
      destination: destinationLabel,
      departDate: input.departDate,
      returnDate: input.returnDate ?? null,
      travelerCount,
      cabinClass,
    },
    offers,
  };
}

export async function searchHotelOffers(input: SearchHotelsInput) {
  if (isLiteApiConfigured() && canResolveLiteApiHotelSearch(input)) {
    return searchLiteApiHotelOffers(input);
  }

  if (isDuffelStaysConfigured() && canResolveDuffelHotelSearch(input)) {
    try {
      return await searchDuffelHotelOffers(input);
    } catch (error) {
      if (
        error instanceof HttpError &&
        (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404)
      ) {
        // fall through to demo fallback when Stays access is not enabled
      } else {
        throw error;
      }
    }
  }

  const cityLabel = normalizeLabel(input.city);
  const cityCode = toTravelCode(cityLabel);
  const roomCount = input.roomCount ?? 1;
  const roomTier = input.roomTier ?? 'standard';
  const totalNights = calculateNightCount(input.checkInDate, input.checkOutDate);
  const seed = `${cityCode}:${input.checkInDate}:${input.checkOutDate}:${roomCount}:${roomTier}`;
  const baseHash = hashString(seed);

  const offers = Array.from({ length: 4 }).map((_, index) => {
    const hotel = hotels[(baseHash + index) % hotels.length];
    const nightlyBase = 110 + (baseHash % 90) + index * 24;
    const roomMultiplier =
      roomTier === 'suite' ? 2.35 : roomTier === 'deluxe' ? 1.55 : 1;
    const nightlyAmount = toAmountString(nightlyBase * roomMultiplier);
    const totalAmount = toAmountString(
      Number.parseFloat(nightlyAmount) * totalNights * roomCount
    );

    return serializeHotelOffer({
      offerId: `htl_${hashString(`${seed}:${index}`).toString(36)}`,
      provider: 'demo',
      providerSearchResultId: null,
      providerRateId: null,
      providerAccommodationId: null,
      expiresAt: null,
      paymentType: 'pay_later',
      cityLabel,
      cityCode,
      hotelName: `${hotel.name} ${cityLabel}`,
      hotelCode: `${hotel.code}${(baseHash + index) % 97}`,
      providerCode: hotel.code,
      providerName: hotel.name,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomTier,
      roomCount,
      nightlyAmount,
      totalAmount,
      totalNights,
      currency: 'MUSD',
    });
  });

  return {
    query: {
      city: cityLabel,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomCount,
      roomTier,
    },
    offers,
  };
}

export async function listUserBookings(user: AuthenticatedUser) {
  const storedBookings = await listBookingsForUser(user.id);
  const serializedBookings = await Promise.all(
    storedBookings.map(async (booking) => serializeBooking(user, booking))
  );

  const nextIssuedBooking =
    serializedBookings.find((booking) => booking.ticket.issued) ?? null;

  return {
    summary: {
      bookingCount: serializedBookings.length,
      ticketedCount: serializedBookings.filter((booking) => booking.ticket.issued).length,
      confirmedCount: serializedBookings.filter((booking) => booking.status === 'confirmed').length,
      currency: serializedBookings[0]?.payment.currency ?? 'MUSD',
    },
    nextBoardingPassBooking: nextIssuedBooking,
    bookings: serializedBookings,
  };
}

export async function createFlightBooking(
  user: AuthenticatedUser,
  input: CreateFlightBookingInput
) {
  const linkedTrip = await resolveLinkedTripForBooking(
    user,
    input.tripId,
    input.offer.departDate,
    input.offer.returnDate ?? null
  );

  const trimmedPassengerName = input.passengerName.trim();
  const trimmedEmail = input.email?.trim();
  const trimmedPhoneNumber = input.phoneNumber?.trim();

  let bookingReference = createBookingReference(
    `${user.id}:${input.offer.offerId}:${trimmedPassengerName}:${Date.now()}`
  );
  let bookingStatus = 'confirmed';
  let providerOrderId: string | null = null;
  let holdExpiresAt: Date | null = null;
  let totalAmount = input.offer.totalAmount;
  let currency = input.offer.currency;
  let cancellationPolicy = 'Flexible refund policy';

  if (input.offer.provider === 'duffel') {
    if (!input.bornOn || !trimmedEmail || !trimmedPhoneNumber || !input.title || !input.gender) {
      throw new HttpError(
        400,
        'Duffel flight bookings require passenger date of birth, email, phone number, title, and gender'
      );
    }

    const order = await createDuffelHoldOrder(input.offer, {
      passengerName: trimmedPassengerName,
      bornOn: input.bornOn,
      email: trimmedEmail,
      phoneNumber: trimmedPhoneNumber,
      title: input.title,
      gender: input.gender,
    });

    bookingReference = order.bookingReference ?? bookingReference;
    providerOrderId = order.orderId;
    holdExpiresAt = order.holdExpiresAt ? new Date(order.holdExpiresAt) : null;
    totalAmount = order.totalAmount;
    currency = order.currency;
    bookingStatus = 'held';
    cancellationPolicy =
      'Held with Duffel. Provider payment still needs to be completed before ticketing is available.';
  }

  const booking = await createBookingRecord({
    userId: user.id,
    tripId: linkedTrip?.id ?? null,
    provider: input.offer.provider,
    providerOfferId: input.offer.providerOfferId,
    providerOrderId,
    holdExpiresAt,
    mode: 'flight',
    status: bookingStatus,
    originLabel: input.offer.originLabel,
    originCode: input.offer.originCode,
    destinationLabel: input.offer.destinationLabel,
    destinationCode: input.offer.destinationCode,
    departDate: input.offer.departDate,
    returnDate: input.offer.returnDate ?? null,
    carrierCode: input.offer.carrierCode,
    carrierName: input.offer.carrierName,
    flightNumber: input.offer.flightNumber,
    duration: input.offer.duration,
    cabinClass: input.offer.cabinClass,
    travelerCount: input.offer.travelerCount,
    passengerName: trimmedPassengerName,
    totalAmount,
    currency,
    bookingReference,
    note: input.note?.trim() || null,
    cancellationPolicy,
  });

  await attachBookingToTripItinerary(user, linkedTrip, booking);

  return {
    booking: await serializeBooking(user, booking),
  };
}

export async function createHotelBooking(
  user: AuthenticatedUser,
  input: CreateHotelBookingInput
) {
  const linkedTrip = await resolveLinkedTripForBooking(
    user,
    input.tripId,
    input.offer.checkInDate,
    input.offer.checkOutDate
  );
  const bookingReference = createBookingReference(
    `${user.id}:${input.offer.offerId}:${input.guestName}:${Date.now()}`
  );
  const trimmedGuestName = input.guestName.trim();
  const trimmedEmail = input.email?.trim();
  const trimmedPhoneNumber = input.phoneNumber?.trim();

  let providerOrderId: string | null = null;
  let bookingStatus = 'confirmed';
  let totalAmount = input.offer.totalAmount;
  let currency = input.offer.currency;
  let resolvedBookingReference = bookingReference;
  let cancellationPolicy = 'Flexible refund policy';

  if (input.offer.provider === 'liteapi') {
    if (!trimmedEmail) {
      throw new HttpError(400, 'LiteAPI hotel bookings require the lead guest email');
    }

    const stayBooking = await createLiteApiHotelBooking(input.offer, {
      guestName: trimmedGuestName,
      email: trimmedEmail,
      note: input.note?.trim() || undefined,
      clientReference: bookingReference,
    });

    providerOrderId = stayBooking.bookingId;
    bookingStatus = stayBooking.status;
    totalAmount = stayBooking.totalAmount;
    currency = stayBooking.currency;
    resolvedBookingReference = stayBooking.bookingReference ?? bookingReference;
    cancellationPolicy =
      'Booked with liteAPI. Cancellation and refund outcomes depend on the selected rate policy.';
  } else if (input.offer.provider === 'duffel') {
    if (!input.bornOn || !trimmedEmail || !trimmedPhoneNumber) {
      throw new HttpError(
        400,
        'Duffel hotel bookings require guest date of birth, email, and phone number'
      );
    }

    const stayBooking = await createDuffelStayBooking(input.offer, {
      guestName: trimmedGuestName,
      bornOn: input.bornOn,
      email: trimmedEmail,
      phoneNumber: trimmedPhoneNumber,
      note: input.note?.trim() || undefined,
    });

    providerOrderId = stayBooking.bookingId;
    bookingStatus = stayBooking.status;
    totalAmount = stayBooking.totalAmount;
    currency = stayBooking.currency;
    resolvedBookingReference = stayBooking.bookingReference ?? bookingReference;
    cancellationPolicy =
      'Booked with Duffel Stays. Cancellation eligibility depends on the accommodation policy and provider status.';
  }

  const booking = await createBookingRecord({
    userId: user.id,
    tripId: linkedTrip?.id ?? null,
    provider: input.offer.provider,
    providerOfferId: input.offer.providerRateId,
    providerOrderId,
    mode: 'hotel',
    status: bookingStatus,
    originLabel: input.offer.cityLabel,
    originCode: input.offer.cityCode,
    destinationLabel: input.offer.hotelName,
    destinationCode: input.offer.hotelCode,
    departDate: input.offer.checkInDate,
    returnDate: input.offer.checkOutDate,
    carrierCode: input.offer.providerCode,
    carrierName: input.offer.providerName,
    flightNumber: input.offer.roomTier,
    duration: input.offer.nightlyAmount,
    cabinClass: input.offer.roomTier,
    travelerCount: input.offer.roomCount,
    passengerName: trimmedGuestName,
    totalAmount,
    currency,
    bookingReference: resolvedBookingReference,
    note: input.note?.trim() || null,
    cancellationPolicy,
  });

  await attachBookingToTripItinerary(user, linkedTrip, booking);

  return {
    booking: await serializeBooking(user, booking),
  };
}

export async function getBookingById(user: AuthenticatedUser, id: string) {
  const booking = await findBookingByIdForUser(user.id, id);

  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  return {
    booking: await serializeBooking(user, booking),
  };
}

export async function issueBoardingPass(user: AuthenticatedUser, id: string) {
  const booking = await findBookingByIdForUser(user.id, id);

  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  if (booking.mode !== 'flight') {
    throw new HttpError(400, 'Only flight bookings can issue boarding passes');
  }

  if (booking.status !== 'confirmed') {
    throw new HttpError(400, 'Boarding passes can only be issued for confirmed flight bookings');
  }

  const existingPass = await findBoardingPassByBookingIdForUser(user.id, booking.id);

  if (existingPass) {
    return {
      booking: await serializeBooking(user, booking),
      boardingPass: serializeBoardingPass(existingPass),
    };
  }

  const seed = `${booking.id}:${booking.bookingReference}:${booking.passengerName}`;
  const seatRow = 8 + (hashString(seed) % 21);
  const seatLetter = ['A', 'B', 'C', 'D', 'E', 'F'][hashString(`${seed}:seat`) % 6];
  const gateLetter = ['A', 'B', 'C', 'D'][hashString(`${seed}:gate`) % 4];
  const gateNumber = 1 + (hashString(`${seed}:gateNumber`) % 28);
  const boardingGroup = `${1 + (hashString(`${seed}:group`) % 6)}`;
  const ticketNumber = createTicketNumber(seed);

  const boardingPass = await createBoardingPassRecord({
    bookingId: booking.id,
    userId: user.id,
    passengerName: booking.passengerName,
    carrierCode: booking.carrierCode,
    carrierName: booking.carrierName,
    flightNumber: booking.flightNumber,
    originCode: booking.originCode,
    destinationCode: booking.destinationCode,
    departDate: booking.departDate,
    bookingReference: booking.bookingReference,
    ticketNumber,
    gate: `${gateLetter}${gateNumber}`,
    seat: `${seatRow}${seatLetter}`,
    boardingGroup,
    qrPayload: `URNWAYBP:${booking.bookingReference}:${ticketNumber}`,
  });

  const updatedBooking = await updateBookingRecordByIdForUser(user.id, booking.id, {
    status: 'ticketed',
    ticketIssuedAt: new Date(),
  });

  if (!updatedBooking) {
    throw new HttpError(404, 'Booking not found');
  }

  return {
    booking: await serializeBooking(user, updatedBooking),
    boardingPass: serializeBoardingPass(boardingPass),
  };
}

export async function cancelBooking(user: AuthenticatedUser, id: string) {
  const booking = await findBookingByIdForUser(user.id, id);

  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  if (booking.status === 'cancelled') {
    return {
      booking: await serializeBooking(user, booking),
    };
  }

  if (booking.status !== 'confirmed' && booking.status !== 'ticketed') {
    throw new HttpError(400, 'Only confirmed or ticketed bookings can be cancelled');
  }

  const refundPreview = calculateRefundPreview(booking);
  const now = new Date();

  let resolvedRefundStatus = refundPreview.status;
  let resolvedRefundAmount = refundPreview.amount;

  if (booking.provider === 'liteapi' && booking.providerOrderId) {
    const providerCancellation = await cancelLiteApiBooking(booking.providerOrderId);
    const providerStatus = providerCancellation.status.toUpperCase();

    if (providerCancellation.refundAmount) {
      resolvedRefundAmount = providerCancellation.refundAmount;
    }

    if (providerStatus.includes('WITH_CHARGES')) {
      resolvedRefundStatus = resolvedRefundAmount === '0' ? 'not_eligible' : 'pending';
    } else if (providerStatus.includes('CANCELLED')) {
      resolvedRefundStatus = resolvedRefundAmount === '0' ? 'not_eligible' : 'pending';
    }
  }

  const updatedBooking = await updateBookingRecordByIdForUser(user.id, id, {
    status: 'cancelled',
    refundStatus: resolvedRefundStatus,
    refundAmount: resolvedRefundAmount,
    cancelRequestedAt: now,
    refundedAt: null,
  });

  if (!updatedBooking) {
    throw new HttpError(404, 'Booking not found');
  }

  if (booking.mode === 'flight') {
    await updateBoardingPassByBookingIdForUser(user.id, booking.id, {
      status: 'voided',
    });
  }

  return {
    booking: await serializeBooking(user, updatedBooking),
  };
}

export { serializeBoardingPass };
