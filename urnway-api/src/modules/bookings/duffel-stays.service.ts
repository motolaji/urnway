import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { HotelOffer, SearchHotelsInput } from './bookings.types.js';

type DuffelStaysSearchResponse = {
  results: DuffelStaysSearchResult[];
};

type DuffelStaysSearchResult = {
  id: string;
  expires_at?: string | null;
  cheapest_rate_total_amount?: string | null;
  cheapest_rate_currency?: string | null;
  cheapest_rate_public_currency?: string | null;
  cheapest_rate_due_at_accommodation_amount?: string | null;
  accommodation?: DuffelAccommodation | null;
};

type DuffelAccommodation = {
  id: string;
  name?: string | null;
  location?: {
    address?: {
      city_name?: string | null;
    } | null;
  } | null;
  rooms?: DuffelRoom[];
};

type DuffelRoom = {
  id?: string | null;
  name?: string | null;
  beds?: Array<{
    type?: string | null;
    count?: number | null;
  }> | null;
  rates?: DuffelRate[];
};

type DuffelRate = {
  id: string;
  name?: string | null;
  payment_type?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
  public_amount?: string | null;
  public_currency?: string | null;
  due_at_accommodation_amount?: string | null;
  due_at_accommodation_currency?: string | null;
  expires_at?: string | null;
  cancellation_before?: string | null;
};

type DuffelQuote = {
  id: string;
  total_amount?: string | null;
  total_currency?: string | null;
  due_at_accommodation_amount?: string | null;
  due_at_accommodation_currency?: string | null;
  accommodation?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

type DuffelStayBooking = {
  id?: string | null;
  reference?: string | null;
  status?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
};

type DuffelStayGuestDetails = {
  guestName: string;
  bornOn: string;
  email: string;
  phoneNumber: string;
  note?: string;
};

const duffelApiBaseUrl = env.DUFFEL_API_BASE_URL;
const duffelVersion = 'v2';

const hotelLocationCoordinates: Record<string, { latitude: number; longitude: number }> = {
  london: { latitude: 51.5074, longitude: -0.1278 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
  lagos: { latitude: 6.5244, longitude: 3.3792 },
  abuja: { latitude: 9.0765, longitude: 7.3986 },
  accra: { latitude: 5.6037, longitude: -0.187 },
  barcelona: { latitude: 41.3874, longitude: 2.1686 },
  madrid: { latitude: 40.4168, longitude: -3.7038 },
  lisbon: { latitude: 38.7223, longitude: -9.1393 },
  dubai: { latitude: 25.2048, longitude: 55.2708 },
  'new york': { latitude: 40.7128, longitude: -74.006 },
  nyc: { latitude: 40.7128, longitude: -74.006 },
  amsterdam: { latitude: 52.3676, longitude: 4.9041 },
  berlin: { latitude: 52.52, longitude: 13.405 },
  rome: { latitude: 41.9028, longitude: 12.4964 },
  milan: { latitude: 45.4642, longitude: 9.19 },
  athens: { latitude: 37.9838, longitude: 23.7275 },
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  cairo: { latitude: 30.0444, longitude: 31.2357 },
  nairobi: { latitude: -1.2921, longitude: 36.8219 },
  johannesburg: { latitude: -26.2041, longitude: 28.0473 },
  'cape town': { latitude: -33.9249, longitude: 18.4241 },
  kigali: { latitude: -1.9441, longitude: 30.0619 },
};

function normalizeHotelLocation(value: string) {
  const trimmed = value.trim().toLowerCase();
  return hotelLocationCoordinates[trimmed] ?? null;
}

function mapRoomTierFromText(value: string | null | undefined): HotelOffer['roomTier'] {
  const normalized = (value ?? '').toLowerCase();

  if (normalized.includes('suite')) {
    return 'suite';
  }

  if (
    normalized.includes('deluxe') ||
    normalized.includes('executive') ||
    normalized.includes('premium')
  ) {
    return 'deluxe';
  }

  return 'standard';
}

function toTravelCode(value: string) {
  const code = value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
  return code.padEnd(3, 'X');
}

function toNightlyAmount(totalAmount: string, totalNights: number) {
  const parsed = Number.parseFloat(totalAmount);
  if (!Number.isFinite(parsed) || totalNights <= 0) {
    return totalAmount;
  }

  return (parsed / totalNights).toFixed(2);
}

function parseGuestName(guestName: string) {
  const trimmed = guestName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    throw new HttpError(
      400,
      'Duffel hotel bookings require the guest full name to include given and family names'
    );
  }

  return {
    givenName: parts.slice(0, -1).join(' '),
    familyName: parts.at(-1) ?? '',
  };
}

async function duffelStaysRequest<T>(path: string, init: RequestInit) {
  if (!env.DUFFEL_ACCESS_TOKEN) {
    throw new HttpError(503, 'Duffel Stays provider is not configured');
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
      `Duffel Stays request failed with status ${response.status}`;
    throw new HttpError(response.status >= 400 && response.status < 600 ? response.status : 502, message);
  }

  return payload.data;
}

function buildDuffelHotelOffer(
  input: SearchHotelsInput,
  result: DuffelStaysSearchResult,
  rate: DuffelRate,
  totalNights: number
): HotelOffer {
  const accommodation = result.accommodation;
  const cityLabel = accommodation?.location?.address?.city_name ?? input.city.trim();
  const cityCode = toTravelCode(cityLabel);
  const hotelName = accommodation?.name ?? `${cityLabel} Stay`;
  const hotelCode = (accommodation?.id ?? result.id).slice(-12);
  const roomTier = mapRoomTierFromText(rate.name);
  const totalAmount = rate.total_amount ?? result.cheapest_rate_total_amount ?? '0';
  const currency =
    rate.total_currency ??
    result.cheapest_rate_currency ??
    result.cheapest_rate_public_currency ??
    'GBP';

  return {
    offerId: rate.id,
    provider: 'duffel',
    providerSearchResultId: result.id,
    providerRateId: rate.id,
    providerAccommodationId: accommodation?.id ?? null,
    expiresAt: rate.expires_at ?? result.expires_at ?? null,
    paymentType: rate.payment_type ?? 'unknown',
    cityLabel,
    cityCode,
    hotelName,
    hotelCode,
    providerCode: 'DUF',
    providerName: 'Duffel Stays',
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomTier,
    roomCount: input.roomCount ?? 1,
    nightlyAmount: toNightlyAmount(totalAmount, totalNights),
    totalAmount,
    totalNights,
    currency,
  };
}

export function canResolveDuffelHotelSearch(input: SearchHotelsInput) {
  return Boolean(normalizeHotelLocation(input.city));
}

export function isDuffelStaysConfigured() {
  return Boolean(env.DUFFEL_ACCESS_TOKEN);
}

export async function searchDuffelHotelOffers(input: SearchHotelsInput) {
  const coordinates = normalizeHotelLocation(input.city);

  if (!coordinates) {
    throw new HttpError(
      400,
      'Duffel hotel search currently requires a supported city such as London, Paris, Lagos, or New York'
    );
  }

  const roomCount = input.roomCount ?? 1;
  const totalNights = Math.max(
    1,
    Math.round(
      (new Date(`${input.checkOutDate}T00:00:00.000Z`).getTime() -
        new Date(`${input.checkInDate}T00:00:00.000Z`).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const search = await duffelStaysRequest<DuffelStaysSearchResponse>('/stays/search', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        rooms: roomCount,
        mobile: true,
        location: {
          radius: 8,
          geographic_coordinates: coordinates,
        },
        guests: Array.from({ length: roomCount }).map(() => ({
          type: 'adult',
        })),
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
      },
    }),
  });

  const topResults = (search.results ?? []).slice(0, 4);
  const offers: HotelOffer[] = [];

  for (const result of topResults) {
    const fullResult = await duffelStaysRequest<DuffelStaysSearchResult>(
      `/stays/search_results/${result.id}/actions/fetch_all_rates`,
      {
        method: 'POST',
        body: JSON.stringify({ data: {} }),
      }
    );

    const rates =
      fullResult.accommodation?.rooms?.flatMap((room) => room.rates ?? []) ?? [];

    const requestedTier = input.roomTier ?? 'standard';
    const matchingRate =
      rates.find((rate) => {
        const tier = mapRoomTierFromText(rate.name);
        return rate.payment_type !== 'pay_now' && tier === requestedTier;
      }) ??
      rates.find((rate) => rate.payment_type !== 'pay_now') ??
      null;

    if (!matchingRate) {
      continue;
    }

    offers.push(buildDuffelHotelOffer(input, fullResult, matchingRate, totalNights));
  }

  return {
    query: {
      city: input.city.trim(),
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomCount,
      roomTier: input.roomTier ?? 'standard',
    },
    offers,
  };
}

export async function createDuffelStayBooking(
  offer: HotelOffer,
  guest: DuffelStayGuestDetails
) {
  if (!offer.providerRateId) {
    throw new HttpError(400, 'Duffel hotel booking requires a provider rate id');
  }

  const quote = await duffelStaysRequest<DuffelQuote>('/stays/quotes', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        rate_id: offer.providerRateId,
      },
    }),
  });

  const { givenName, familyName } = parseGuestName(guest.guestName);

  const booking = await duffelStaysRequest<DuffelStayBooking>('/stays/bookings', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        quote_id: quote.id,
        phone_number: guest.phoneNumber,
        email: guest.email,
        guests: [
          {
            given_name: givenName,
            family_name: familyName,
            born_on: guest.bornOn,
          },
        ],
        ...(guest.note
          ? {
              accommodation_special_requests: guest.note,
            }
          : {}),
      },
    }),
  });

  return {
    bookingId: booking.id ?? null,
    bookingReference: booking.reference ?? null,
    status: booking.status ?? 'confirmed',
    totalAmount: booking.total_amount ?? quote.total_amount ?? offer.totalAmount,
    currency: booking.total_currency ?? quote.total_currency ?? offer.currency,
  };
}
