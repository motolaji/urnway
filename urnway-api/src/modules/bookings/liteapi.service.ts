import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import type { HotelOffer, SearchHotelsInput } from './bookings.types.js';
import type { LocationSuggestion } from '@urnway/contracts';

type LiteApiErrorPayload = {
  error?:
    | {
        message?: string;
        description?: string;
        code?: string | number;
      }
    | null
    | undefined;
  errors?:
    | Array<{
        message?: string;
        description?: string;
      }>
    | null
    | undefined;
};

type LiteApiAmountNode = {
  amount?: number | string | null;
  currency?: string | null;
};

type LiteApiRateNode = {
  occupancyNumber?: number | null;
  name?: string | null;
  boardType?: string | null;
  boardName?: string | null;
  remarks?: string | null;
  retailRate?: {
    total?: LiteApiAmountNode[] | null;
  } | null;
  cancellationPolicies?: {
    refundableTag?: string | null;
  } | null;
};

type LiteApiRoomTypeNode = {
  offerId?: string | null;
  supplier?: string | null;
  supplierId?: number | null;
  offerRetailRate?: LiteApiAmountNode | null;
  roomTypeId?: string | null;
  rates?: LiteApiRateNode[] | null;
};

type LiteApiHotelDataNode = {
  name?: string | null;
  hotelName?: string | null;
  address?: string | null;
  cityName?: string | null;
  location?: {
    city?: string | null;
    address?: string | null;
  } | null;
};

type LiteApiHotelMetadataNode = {
  id?: string | null;
  hotelId?: string | null;
  name?: string | null;
  hotelName?: string | null;
  cityName?: string | null;
  address?: string | null;
  location?: {
    city?: string | null;
    address?: string | null;
  } | null;
};

type LiteApiHotelSearchNode = {
  hotelId?: string | null;
  hotelName?: string | null;
  name?: string | null;
  cityName?: string | null;
  hotelData?: LiteApiHotelDataNode | null;
  roomTypes?: LiteApiRoomTypeNode[] | null;
};

type LiteApiRatesSearchResponse = LiteApiErrorPayload & {
  data?: LiteApiHotelSearchNode[] | null;
};

type LiteApiHotelsMetadataResponse = LiteApiErrorPayload & {
  data?: LiteApiHotelMetadataNode[] | null;
};

type LiteApiPrebookResponse = LiteApiErrorPayload & {
  prebookId?: string | null;
  data?:
    | {
        prebookId?: string | null;
      }
    | null
    | undefined;
};

type LiteApiBookingResponse = LiteApiErrorPayload & {
  bookingId?: string | null;
  id?: string | null;
  bookingReference?: string | null;
  reference?: string | null;
  hotelConfirmationCode?: string | null;
  confirmationCode?: string | null;
  status?: string | null;
  retailRate?: {
    total?: LiteApiAmountNode[] | null;
  } | null;
  total?: LiteApiAmountNode | null;
  totalPrice?: LiteApiAmountNode | null;
  currency?: string | null;
  amount?: number | string | null;
  data?:
    | {
        bookingId?: string | null;
        id?: string | null;
        bookingReference?: string | null;
        reference?: string | null;
        hotelConfirmationCode?: string | null;
        confirmationCode?: string | null;
        status?: string | null;
        retailRate?: {
          total?: LiteApiAmountNode[] | null;
        } | null;
        total?: LiteApiAmountNode | null;
        totalPrice?: LiteApiAmountNode | null;
        currency?: string | null;
        amount?: number | string | null;
      }
    | null
    | undefined;
};

type LiteApiCancelResponse = LiteApiErrorPayload & {
  status?: string | null;
  refundAmount?: number | string | null;
  refundCurrency?: string | null;
  chargedAmount?: number | string | null;
  chargedCurrency?: string | null;
  data?:
    | {
        status?: string | null;
        refundAmount?: number | string | null;
        refundCurrency?: string | null;
        chargedAmount?: number | string | null;
        chargedCurrency?: string | null;
      }
    | null
    | undefined;
};

type LiteApiHotelGuestDetails = {
  guestName: string;
  email: string;
  note?: string;
  clientReference?: string;
};

function mapRoomTierFromText(value: string | null | undefined): HotelOffer['roomTier'] {
  const normalized = (value ?? '').toLowerCase();

  if (normalized.includes('suite')) {
    return 'suite';
  }

  if (
    normalized.includes('deluxe') ||
    normalized.includes('premium') ||
    normalized.includes('executive') ||
    normalized.includes('club')
  ) {
    return 'deluxe';
  }

  return 'standard';
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

function toHotelCode(value: string) {
  return hashString(value).toString(36).toUpperCase().slice(0, 8).padEnd(4, 'X');
}

function toNightlyAmount(totalAmount: string, totalNights: number) {
  const parsed = Number.parseFloat(totalAmount);
  if (!Number.isFinite(parsed) || totalNights <= 0) {
    return totalAmount;
  }

  return parsed % totalNights === 0
    ? toAmountString(parsed / totalNights)
    : (parsed / totalNights).toFixed(2);
}

function extractMessage(payload: LiteApiErrorPayload | null) {
  if (!payload) {
    return null;
  }

  if (payload.error?.message || payload.error?.description) {
    return payload.error.message ?? payload.error.description ?? null;
  }

  const nested = payload.errors
    ?.map((item) => item.message ?? item.description)
    .filter(Boolean)
    .join('; ');

  return nested || null;
}

function parseNameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    throw new HttpError(
      400,
      'LiteAPI bookings require the guest full name to include given and family names'
    );
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
}

function pickHotelName(result: LiteApiHotelSearchNode) {
  return (
    result.hotelName ??
    result.name ??
    result.hotelData?.name ??
    result.hotelData?.hotelName ??
    'Hotel stay'
  );
}

function pickCityLabel(result: LiteApiHotelSearchNode, fallback: string) {
  return (
    result.cityName ??
    result.hotelData?.cityName ??
    result.hotelData?.location?.city ??
    fallback
  );
}

function pickMetadataHotelName(hotel: LiteApiHotelMetadataNode | null | undefined) {
  return hotel?.name ?? hotel?.hotelName ?? null;
}

function pickMetadataCityLabel(hotel: LiteApiHotelMetadataNode | null | undefined) {
  return hotel?.cityName ?? hotel?.location?.city ?? null;
}

function extractAmountNodeValue(node: LiteApiAmountNode | null | undefined) {
  const raw = node?.amount;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return toAmountString(raw);
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return null;
}

function extractCurrencyNodeValue(node: LiteApiAmountNode | null | undefined) {
  const raw = node?.currency;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

async function liteApiRequest<T>(baseUrl: string, path: string, init: RequestInit) {
  if (!env.LITEAPI_API_KEY) {
    throw new HttpError(503, 'LiteAPI provider is not configured');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': env.LITEAPI_API_KEY,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = (await response.json().catch(() => null)) as T | LiteApiErrorPayload | null;

  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      extractMessage(payload as LiteApiErrorPayload | null) ??
        `LiteAPI request failed with status ${response.status}`
    );
  }

  return payload as T;
}

function buildLiteApiHotelOffer(
  input: SearchHotelsInput,
  hotel: LiteApiHotelSearchNode,
  roomType: LiteApiRoomTypeNode,
  totalNights: number
): HotelOffer | null {
  const offerId = roomType.offerId?.trim();

  if (!offerId) {
    return null;
  }

  const cityLabel = pickCityLabel(hotel, input.city.trim());
  const hotelName = pickHotelName(hotel);
  const hotelId = hotel.hotelId?.trim() || `${cityLabel}:${hotelName}:${offerId}`;
  const firstRate = roomType.rates?.[0] ?? null;
  const totalNode =
    roomType.offerRetailRate ??
    firstRate?.retailRate?.total?.[0] ??
    null;
  const totalAmount = extractAmountNodeValue(totalNode) ?? '0';
  const currency =
    extractCurrencyNodeValue(totalNode) ??
    env.LITEAPI_CURRENCY;
  const roomLabel = firstRate?.name ?? roomType.roomTypeId ?? 'Standard Room';

  if (!Number.isFinite(Number.parseFloat(totalAmount)) || Number.parseFloat(totalAmount) <= 0) {
    return null;
  }

  return {
    offerId,
    provider: 'liteapi',
    providerSearchResultId: hotelId,
    providerRateId: offerId,
    providerAccommodationId: hotelId,
    expiresAt: null,
    paymentType: env.LITEAPI_PAYMENT_METHOD,
    cityLabel,
    cityCode: toTravelCode(cityLabel),
    hotelName,
    hotelCode: toHotelCode(hotelId),
    providerCode: 'LTA',
    providerName: 'liteAPI',
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomTier: mapRoomTierFromText(roomLabel),
    roomCount: input.roomCount ?? 1,
    nightlyAmount: toNightlyAmount(totalAmount, totalNights),
    totalAmount,
    totalNights,
    currency,
  };
}

export function isLiteApiConfigured() {
  return Boolean(env.LITEAPI_API_KEY);
}

export function canResolveLiteApiHotelSearch(input: SearchHotelsInput) {
  return input.city.trim().length >= 2;
}

export async function searchLiteApiHotelSuggestions(
  input: string
): Promise<LocationSuggestion[]> {
  const query = input.trim();

  if (!query) {
    return [];
  }

  const payload = await liteApiRequest<LiteApiHotelsMetadataResponse>(
    env.LITEAPI_HOTELS_API_BASE_URL,
    `/data/hotels?aiSearch=${encodeURIComponent(query)}&limit=8`,
    {
      method: 'GET',
    }
  );

  return (payload?.data ?? []).map((hotel) => {
    const hotelId = hotel.id?.trim() ?? hotel.hotelId?.trim() ?? query;
    const primaryText = pickMetadataHotelName(hotel) ?? query;
    const cityLabel = pickMetadataCityLabel(hotel);
    const secondaryText = [cityLabel, hotel.address].filter(Boolean).join(' · ') || null;
    const label = secondaryText ? `${primaryText}, ${secondaryText}` : primaryText;

    return {
      id: `liteapi:${hotelId}`,
      placeId: null,
      label,
      primaryText,
      secondaryText,
      searchValue: cityLabel ?? primaryText,
      source: 'liteapi',
    } satisfies LocationSuggestion;
  });
}

export async function searchLiteApiHotelOffers(input: SearchHotelsInput) {
  const roomCount = input.roomCount ?? 1;
  const totalNights = Math.max(
    1,
    Math.round(
      (new Date(`${input.checkOutDate}T00:00:00.000Z`).getTime() -
        new Date(`${input.checkInDate}T00:00:00.000Z`).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const hotelListPayload = await liteApiRequest<LiteApiHotelsMetadataResponse>(
    env.LITEAPI_HOTELS_API_BASE_URL,
    `/data/hotels?aiSearch=${encodeURIComponent(input.city.trim())}&limit=20`,
    {
      method: 'GET',
    }
  );

  const hotelIds = Array.from(
    new Set(
      (hotelListPayload?.data ?? [])
        .map((hotel) => hotel.id?.trim() ?? hotel.hotelId?.trim())
        .filter((hotelId): hotelId is string => Boolean(hotelId))
    )
  );

  if (hotelIds.length === 0) {
    return {
      query: {
        city: input.city.trim(),
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        roomCount,
        roomTier: input.roomTier ?? 'standard',
      },
      offers: [],
    };
  }

  const metadataByHotelId = new Map<string, LiteApiHotelMetadataNode>();
  for (const hotel of hotelListPayload?.data ?? []) {
    const hotelId = hotel.id?.trim() ?? hotel.hotelId?.trim();
    if (hotelId) {
      metadataByHotelId.set(hotelId, hotel);
    }
  }

  const payload = await liteApiRequest<LiteApiRatesSearchResponse>(
    env.LITEAPI_HOTELS_API_BASE_URL,
    '/hotels/rates',
    {
      method: 'POST',
      body: JSON.stringify({
        hotelIds,
        checkin: input.checkInDate,
        checkout: input.checkOutDate,
        currency: env.LITEAPI_CURRENCY,
        guestNationality: env.LITEAPI_GUEST_NATIONALITY,
        occupancies: Array.from({ length: roomCount }, () => ({
          adults: 2,
          children: [],
        })),
        maxRatesPerHotel: 1,
        includeHotelData: true,
        timeout: 10,
      }),
    }
  );

  const offers = (payload?.data ?? [])
    .flatMap((hotel) =>
      (hotel.roomTypes ?? [])
        .map((roomType) => {
          const hotelId = hotel.hotelId?.trim() ?? null;
          const metadata = hotelId ? metadataByHotelId.get(hotelId) : null;
          const enrichedHotel = metadata
            ? {
                ...hotel,
                hotelName:
                  hotel.hotelName ??
                  hotel.name ??
                  pickMetadataHotelName(metadata) ??
                  undefined,
                cityName:
                  hotel.cityName ??
                  pickMetadataCityLabel(metadata) ??
                  undefined,
                hotelData: hotel.hotelData ?? {
                  name: pickMetadataHotelName(metadata) ?? undefined,
                  cityName: pickMetadataCityLabel(metadata) ?? undefined,
                  address: metadata.address ?? metadata.location?.address ?? undefined,
                },
              }
            : hotel;

          return buildLiteApiHotelOffer(input, enrichedHotel, roomType, totalNights);
        })
        .filter((offer): offer is HotelOffer => Boolean(offer))
    )
    .sort((left, right) => Number.parseFloat(left.totalAmount) - Number.parseFloat(right.totalAmount))
    .slice(0, 12);

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

export async function createLiteApiHotelBooking(
  offer: HotelOffer,
  input: LiteApiHotelGuestDetails
) {
  const holder = parseNameParts(input.guestName);
  const prebook = await liteApiRequest<LiteApiPrebookResponse>(
    env.LITEAPI_BOOKINGS_API_BASE_URL,
    '/rates/prebook',
    {
      method: 'POST',
      body: JSON.stringify({
        offerId: offer.offerId,
        usePaymentSdk: false,
      }),
    }
  );

  const prebookId = prebook?.prebookId ?? prebook?.data?.prebookId ?? null;

  if (!prebookId) {
    throw new HttpError(502, 'LiteAPI booking did not return a prebook id');
  }

  const booking = await liteApiRequest<LiteApiBookingResponse>(
    env.LITEAPI_BOOKINGS_API_BASE_URL,
    '/rates/book',
    {
      method: 'POST',
      body: JSON.stringify({
        prebookId,
        clientReference: input.clientReference,
        holder: {
          firstName: holder.firstName,
          lastName: holder.lastName,
          email: input.email,
        },
        guests: Array.from({ length: offer.roomCount }, (_, index) => ({
          occupancyNumber: index + 1,
          firstName: holder.firstName,
          lastName: holder.lastName,
          email: input.email,
          remarks: input.note?.trim() || undefined,
        })),
        payment: {
          method: env.LITEAPI_PAYMENT_METHOD,
        },
      }),
    }
  );

  const bookingNode = booking?.data ?? booking;
  const totalNode =
    bookingNode?.retailRate?.total?.[0] ??
    bookingNode?.total ??
    bookingNode?.totalPrice ??
    null;

  return {
    bookingId: bookingNode?.bookingId ?? bookingNode?.id ?? null,
    bookingReference:
      bookingNode?.hotelConfirmationCode ??
      bookingNode?.confirmationCode ??
      bookingNode?.bookingReference ??
      bookingNode?.reference ??
      input.clientReference ??
      null,
    status: 'confirmed' as const,
    totalAmount: extractAmountNodeValue(totalNode) ?? offer.totalAmount,
    currency: extractCurrencyNodeValue(totalNode) ?? bookingNode?.currency ?? offer.currency,
  };
}

export async function cancelLiteApiBooking(providerBookingId: string) {
  const response = await liteApiRequest<LiteApiCancelResponse>(
    env.LITEAPI_BOOKINGS_API_BASE_URL,
    `/bookings/${providerBookingId}`,
    {
      method: 'PUT',
    }
  );

  const payload = response?.data ?? response;

  return {
    status: payload?.status ?? 'CANCELLED',
    refundAmount:
      payload?.refundAmount != null ? String(payload.refundAmount) : null,
    refundCurrency: payload?.refundCurrency ?? null,
    chargedAmount:
      payload?.chargedAmount != null ? String(payload.chargedAmount) : null,
    chargedCurrency: payload?.chargedCurrency ?? null,
  };
}
