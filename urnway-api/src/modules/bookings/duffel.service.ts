import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { FlightOffer, SearchFlightsInput } from './bookings.types.js';
import { resolveFlightLocationCode } from '../places/flight-locations.js';

type DuffelOfferRequestPassenger = {
  type: 'adult';
};

type DuffelOfferRequestSlice = {
  origin: string;
  destination: string;
  departure_date: string;
};

type DuffelOfferRequestResponse = {
  id: string;
  offers: DuffelOffer[];
};

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string | null;
  payment_requirements?: {
    requires_instant_payment?: boolean;
    payment_required_by?: string | null;
  } | null;
  owner?: {
    iata_code?: string | null;
    name?: string | null;
  } | null;
  slices?: DuffelSlice[];
  passengers?: Array<{
    id?: string | null;
    type?: string;
  }>;
  cabin_class?: 'economy' | 'premium_economy' | 'business' | 'first' | null;
};

type DuffelSlice = {
  duration?: string | null;
  segments?: DuffelSegment[];
};

type DuffelSegment = {
  departing_at?: string | null;
  arriving_at?: string | null;
  duration?: string | null;
  marketing_carrier?: {
    iata_code?: string | null;
    name?: string | null;
  } | null;
  operating_carrier?: {
    iata_code?: string | null;
    name?: string | null;
  } | null;
  marketing_carrier_flight_number?: string | null;
  origin?: {
    iata_code?: string | null;
    city_name?: string | null;
    name?: string | null;
  } | null;
  destination?: {
    iata_code?: string | null;
    city_name?: string | null;
    name?: string | null;
  } | null;
};

type DuffelOrderResponse = {
  id: string;
  booking_reference?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
  payment_status?: {
    payment_required_by?: string | null;
  } | null;
  available_actions?: string[];
};

type DuffelPassengerDetails = {
  passengerName: string;
  bornOn: string;
  email: string;
  phoneNumber?: string;
  title: 'mr' | 'mrs' | 'ms' | 'miss' | 'mx' | 'dr';
  gender: 'm' | 'f' | 'x';
};

const duffelApiBaseUrl = env.DUFFEL_API_BASE_URL;
const duffelVersion = 'v2';

function normalizeLocationCode(value: string) {
  return resolveFlightLocationCode(value);
}

function mapCabinClassToDuffel(value: SearchFlightsInput['cabinClass']) {
  switch (value) {
    case 'business':
      return 'business';
    case 'premium':
      return 'premium_economy';
    default:
      return 'economy';
  }
}

function mapCabinClassFromDuffel(value: DuffelOffer['cabin_class'], fallback: FlightOffer['cabinClass']) {
  if (value === 'business') {
    return 'business';
  }

  if (value === 'premium_economy') {
    return 'premium';
  }

  return fallback;
}

function formatIsoDuration(duration: string | null | undefined) {
  if (!duration) {
    return 'TBC';
  }

  const match = duration.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?$/i);

  if (!match) {
    return duration;
  }

  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);

  if (!hours && !minutes) {
    return '0m';
  }

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function parsePassengerName(passengerName: string) {
  const trimmed = passengerName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    throw new HttpError(
      400,
      'Duffel flight bookings require the passenger full name to include given and family names'
    );
  }

  return {
    givenName: parts.slice(0, -1).join(' '),
    familyName: parts.at(-1) ?? '',
  };
}

async function duffelRequest<T>(path: string, init: RequestInit) {
  if (!env.DUFFEL_ACCESS_TOKEN) {
    throw new HttpError(503, 'Duffel flight provider is not configured');
  }

  const response = await fetch(`${duffelApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Duffel-Version': duffelVersion,
      Authorization: `Bearer ${env.DUFFEL_ACCESS_TOKEN}`,
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: Array<{ title?: string; message?: string; detail?: string }> }
    | null;

  if (!response.ok || !payload?.data) {
    const message =
      payload?.errors?.map((item) => item.title ?? item.message ?? item.detail).filter(Boolean).join('; ') ||
      `Duffel request failed with status ${response.status}`;
    throw new HttpError(response.status >= 400 && response.status < 600 ? response.status : 502, message);
  }

  return payload.data;
}

function toFlightOffer(
  offerRequestId: string,
  offer: DuffelOffer,
  input: SearchFlightsInput
): FlightOffer | null {
  const slices = offer.slices ?? [];
  const outboundSlice = slices[0];
  const firstSegment = outboundSlice?.segments?.[0];
  const lastOutboundSegment = outboundSlice?.segments?.at(-1);

  const originCode = firstSegment?.origin?.iata_code?.toUpperCase();
  const destinationCode = lastOutboundSegment?.destination?.iata_code?.toUpperCase();

  if (!firstSegment || !originCode || !destinationCode) {
    return null;
  }

  const carrier = firstSegment.marketing_carrier ?? firstSegment.operating_carrier;
  const carrierCode = carrier?.iata_code?.toUpperCase() ?? 'DU';
  const carrierName = carrier?.name ?? offer.owner?.name ?? 'Duffel Airline';
  const flightNumber = `${carrierCode}${firstSegment.marketing_carrier_flight_number ?? 'TBA'}`;
  const outboundDuration = formatIsoDuration(outboundSlice?.duration ?? firstSegment.duration);
  const fallbackCabin = input.cabinClass ?? 'economy';

  return {
    offerId: offer.id,
    provider: 'duffel',
    providerOfferId: offer.id,
    providerOfferRequestId: offerRequestId,
    providerPassengerIds: (offer.passengers ?? [])
      .map((passenger) => passenger.id)
      .filter((passengerId): passengerId is string => Boolean(passengerId)),
    expiresAt:
      offer.payment_requirements?.payment_required_by ??
      offer.expires_at ??
      null,
    requiresInstantPayment: offer.payment_requirements?.requires_instant_payment ?? true,
    originLabel: firstSegment.origin?.city_name ?? firstSegment.origin?.name ?? input.origin,
    originCode,
    destinationLabel:
      lastOutboundSegment?.destination?.city_name ??
      lastOutboundSegment?.destination?.name ??
      input.destination,
    destinationCode,
    departDate: input.departDate,
    returnDate: input.returnDate,
    carrierCode,
    carrierName,
    flightNumber,
    duration: outboundDuration,
    cabinClass: mapCabinClassFromDuffel(offer.cabin_class, fallbackCabin),
    travelerCount: offer.passengers?.length ?? input.travelerCount ?? 1,
    totalAmount: offer.total_amount,
    currency: offer.total_currency,
  };
}

export function isDuffelConfigured() {
  return Boolean(env.DUFFEL_ACCESS_TOKEN);
}

export function canResolveDuffelSearch(input: SearchFlightsInput) {
  return Boolean(
    normalizeLocationCode(input.origin) && normalizeLocationCode(input.destination)
  );
}

export async function searchDuffelFlightOffers(input: SearchFlightsInput) {
  const origin = normalizeLocationCode(input.origin);
  const destination = normalizeLocationCode(input.destination);

  if (!origin || !destination) {
    throw new HttpError(
      400,
      'Duffel flight search currently requires supported airport or city codes such as LHR, LGW, NYC, or LOS'
    );
  }

  const travelerCount = input.travelerCount ?? 1;
  const cabinClass = mapCabinClassToDuffel(input.cabinClass);
  const slices: DuffelOfferRequestSlice[] = [
    {
      origin,
      destination,
      departure_date: input.departDate,
    },
  ];

  if (input.returnDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: input.returnDate,
    });
  }

  const passengers: DuffelOfferRequestPassenger[] = Array.from({
    length: travelerCount,
  }).map(() => ({
    type: 'adult',
  }));

  const response = await duffelRequest<DuffelOfferRequestResponse>('/air/offer_requests', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        slices,
        passengers,
        cabin_class: cabinClass,
      },
    }),
  });

  const offers = (response.offers ?? [])
    .map((offer) => toFlightOffer(response.id, offer, input))
    .filter((offer): offer is FlightOffer => Boolean(offer));

  return {
    query: {
      origin,
      destination,
      departDate: input.departDate,
      returnDate: input.returnDate ?? null,
      travelerCount,
      cabinClass: input.cabinClass ?? 'economy',
    },
    offers,
  };
}

export async function createDuffelHoldOrder(
  offer: FlightOffer,
  passenger: DuffelPassengerDetails
) {
  if (!offer.providerOfferId) {
    throw new HttpError(400, 'Duffel booking requires a provider offer id');
  }

  if (offer.requiresInstantPayment !== false) {
    throw new HttpError(
      409,
      'This airline offer requires instant provider payment. Urnway only supports holdable Duffel offers right now.'
    );
  }

  const providerPassengerId = offer.providerPassengerIds?.[0];

  if (!providerPassengerId) {
    throw new HttpError(
      400,
      'Duffel booking requires a provider passenger id from the selected offer'
    );
  }

  const { givenName, familyName } = parsePassengerName(passenger.passengerName);

  const order = await duffelRequest<DuffelOrderResponse>('/air/orders', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'hold',
        selected_offers: [offer.providerOfferId],
        passengers: [
          {
            id: providerPassengerId,
            type: 'adult',
            title: passenger.title,
            gender: passenger.gender,
            given_name: givenName,
            family_name: familyName,
            born_on: passenger.bornOn,
            email: passenger.email,
            ...(passenger.phoneNumber
              ? {
                  phone_number: passenger.phoneNumber,
                }
              : {}),
          },
        ],
      },
    }),
  });

  return {
    orderId: order.id,
    bookingReference: order.booking_reference ?? null,
    holdExpiresAt:
      order.payment_status?.payment_required_by ??
      offer.expiresAt ??
      null,
    totalAmount: order.total_amount ?? offer.totalAmount,
    currency: order.total_currency ?? offer.currency,
  };
}
