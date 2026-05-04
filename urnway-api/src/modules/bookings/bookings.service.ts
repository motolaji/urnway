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

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

type SearchFlightsInput = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  travelerCount?: number;
  cabinClass?: 'economy' | 'premium' | 'business';
};

type SearchHotelsInput = {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  roomCount?: number;
  roomTier?: 'standard' | 'deluxe' | 'suite';
};

type FlightOffer = {
  offerId: string;
  originLabel: string;
  originCode: string;
  destinationLabel: string;
  destinationCode: string;
  departDate: string;
  returnDate?: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  duration: string;
  cabinClass: 'economy' | 'premium' | 'business';
  travelerCount: number;
  totalAmount: string;
  currency: string;
};

type CreateFlightBookingInput = {
  offer: FlightOffer;
  passengerName: string;
  tripId?: string;
  note?: string;
};

type HotelOffer = {
  offerId: string;
  cityLabel: string;
  cityCode: string;
  hotelName: string;
  hotelCode: string;
  providerCode: string;
  providerName: string;
  checkInDate: string;
  checkOutDate: string;
  roomTier: 'standard' | 'deluxe' | 'suite';
  roomCount: number;
  nightlyAmount: string;
  totalAmount: string;
  totalNights: number;
  currency: string;
};

type CreateHotelBookingInput = {
  offer: HotelOffer;
  guestName: string;
  tripId?: string;
  note?: string;
};

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

function calculateNightCount(checkInDate: string, checkOutDate: string) {
  const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);
  return Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  );
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
      canCancel: booking.status === 'confirmed' || booking.status === 'ticketed',
      cancelledAt: booking.cancelRequestedAt?.toISOString() ?? null,
      policy: booking.cancellationPolicy,
    },
    refund: deriveRefundState(booking),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

export async function searchFlightOffers(input: SearchFlightsInput) {
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
      currency: 'MUSD',
    },
    nextBoardingPassBooking: nextIssuedBooking,
    bookings: serializedBookings,
  };
}

export async function createFlightBooking(
  user: AuthenticatedUser,
  input: CreateFlightBookingInput
) {
  const bookingReference = createBookingReference(
    `${user.id}:${input.offer.offerId}:${input.passengerName}:${Date.now()}`
  );

  const booking = await createBookingRecord({
    userId: user.id,
    tripId: input.tripId ?? null,
    mode: 'flight',
    status: 'confirmed',
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
    passengerName: input.passengerName.trim(),
    totalAmount: input.offer.totalAmount,
    currency: input.offer.currency,
    bookingReference,
    note: input.note?.trim() || null,
  });

  return {
    booking: await serializeBooking(user, booking),
  };
}

export async function createHotelBooking(
  user: AuthenticatedUser,
  input: CreateHotelBookingInput
) {
  const bookingReference = createBookingReference(
    `${user.id}:${input.offer.offerId}:${input.guestName}:${Date.now()}`
  );

  const booking = await createBookingRecord({
    userId: user.id,
    tripId: input.tripId ?? null,
    mode: 'hotel',
    status: 'confirmed',
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
    passengerName: input.guestName.trim(),
    totalAmount: input.offer.totalAmount,
    currency: input.offer.currency,
    bookingReference,
    note: input.note?.trim() || null,
  });

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

  const updatedBooking = await updateBookingRecordByIdForUser(user.id, id, {
    status: 'cancelled',
    refundStatus: refundPreview.status,
    refundAmount: refundPreview.amount,
    cancelRequestedAt: now,
    refundedAt: refundPreview.status === 'not_eligible' ? null : null,
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
