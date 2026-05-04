import * as SecureStore from "expo-secure-store";

import type {
  AuthPayload,
  BoardingPass,
  Booking,
  DirectSendPreflight,
  FlightBookingOffer,
  GeneratedTripItineraryDraft,
  HotelBookingOffer,
  PaymentLink,
  PaymentLinkPreflight,
  PaymentQrRequest,
  Trip,
  TripExpense,
  TripItineraryDraft,
  TripItineraryItem,
  VaultGoal,
} from "@urnway/contracts";
import { getApiBaseUrl } from "@/lib/mobile-config";

const SESSION_STORAGE_KEY = "urnway.session";

export type {
  BoardingPass,
  Booking,
  DirectSendPreflight,
  FlightBookingOffer,
  GeneratedTripItineraryDraft,
  HotelBookingOffer,
  PaymentLink,
  PaymentLinkPreflight,
  PaymentQrRequest,
  Trip,
  TripExpense,
  TripItineraryDraft,
  TripItineraryItem,
  VaultGoal,
} from "@urnway/contracts";

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

export type WalletBalanceResponse = {
  summary: {
    walletAddress: string;
    nativeTokenBalance: string;
    nativeTokenSymbol: string;
    musdBalance: string;
    musdTokenSymbol: string;
    source: string;
    updatedAt: string;
  };
};

export type WalletPositionResponse = {
  position: {
    borrowProvider: string;
    borrowUrl: string;
    minimumCollateralizationRatio: string;
    source: string;
    updatedAt: string;
  };
};

export type WalletTransactionsResponse = {
  transactions: Array<{
    id: string;
    type: "receive" | "send" | "save" | "borrow" | "card";
    title: string;
    amount: string;
    currency: "MUSD";
    direction: "in" | "out";
    status: "completed";
    occurredAt: string;
    counterparty: string | null;
  }>;
  nextCursor: string | null;
  source: string;
  updatedAt: string;
};

type VaultsResponse = {
  summary: {
    totalTargetAmount: string;
    totalAllocatedAmount: string;
    activeVaultCount: number;
    currency: string;
  };
  vaults: VaultGoal[];
};

type VaultResponse = {
  vault: VaultGoal;
};

type TripsResponse = {
  summary: {
    tripCount: number;
    upcomingCount: number;
    activeCount: number;
    totalBudgetAmount: string;
    currency: string;
  };
  trips: Trip[];
};

type TripResponse = {
  trip: Trip;
};

type TripItineraryItemResponse = {
  itineraryItem: TripItineraryItem;
};

type TripItineraryDraftResponse = {
  draft: GeneratedTripItineraryDraft;
};

type TripExpenseResponse = {
  expense: TripExpense;
};

type FlightSearchOffersResponse = {
  query: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate: string | null;
    travelerCount: number;
    cabinClass: "economy" | "premium" | "business";
  };
  offers: FlightBookingOffer[];
};

type HotelSearchOffersResponse = {
  query: {
    city: string;
    checkInDate: string;
    checkOutDate: string;
    roomCount: number;
    roomTier: "standard" | "deluxe" | "suite";
  };
  offers: HotelBookingOffer[];
};

type BookingsResponse = {
  summary: {
    bookingCount: number;
    ticketedCount: number;
    confirmedCount: number;
    currency: string;
  };
  nextBoardingPassBooking: Booking | null;
  bookings: Booking[];
};

type BookingResponse = {
  booking: Booking;
};

type TicketIssueResponse = {
  booking: Booking;
  boardingPass: BoardingPass | null;
};

type BoardingPassesResponse = {
  boardingPasses: BoardingPass[];
};

type BoardingPassResponse = {
  boardingPass: BoardingPass | null;
};

type PaymentsOverviewResponse = {
  summary: {
    availableFlows: string[];
    createdLinkCount: number;
    recipient: {
      username: string | null;
      displayName: string;
      walletAddress: string;
    };
    nextUp: string[];
  };
};

type PaymentLinksResponse = {
  paymentLinks: PaymentLink[];
};

type PaymentLinkResponse = {
  paymentLink: PaymentLink;
};

type PaymentQrResponse = {
  qrRequest: PaymentQrRequest;
};

type PaymentQrPreflight = {
  qrRequest: PaymentQrRequest;
  paymentLink: PaymentLink;
  preflight: PaymentLinkPreflight["preflight"];
};

type ApiEnvelope<T> = {
  data: T | null;
  error: {
    message: string;
    details: unknown;
  } | null;
  meta: Record<string, unknown> | null;
};

type VerifyResponse = {
  accessToken: string;
  refreshToken: string;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

type UpdateCurrentUserResponse = {
  profile: {
    id: string;
    walletAddress: string;
    username: string | null;
    displayName: string;
    mezoId: string | null;
    email: string | null;
    pushTokenRegistered: boolean;
    sessionId: string;
  };
};

type CurrentUserResponse = {
  profile: {
    id: string;
    walletAddress: string;
    username: string | null;
    displayName: string;
    mezoId: string | null;
    email: string | null;
    pushTokenRegistered: boolean;
    sessionId: string;
  };
};

export type SessionProfile = CurrentUserResponse["profile"];
export type UpdateCurrentUserInput = {
  username: string;
  mezoId?: string;
  email?: string;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details ?? null;
  }
}

async function apiRequest<T>(
  path: string,
  {
    method = "GET",
    body,
    accessToken,
  }: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    accessToken?: string;
  } = {}
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : null),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !envelope) {
    throw new ApiError(
      response.status,
      envelope?.error?.message || "Request failed.",
      envelope?.error?.details
    );
  }

  if (envelope.error || envelope.data === null) {
    throw new ApiError(
      response.status,
      envelope.error?.message || "Request returned no data.",
      envelope.error?.details
    );
  }

  return envelope.data;
}

export async function verifySignedPayload(payload: AuthPayload) {
  return apiRequest<VerifyResponse>("/v1/auth/verify", {
    method: "POST",
    body: payload,
  });
}

export async function refreshSession(refreshToken: string) {
  return apiRequest<RefreshResponse>("/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export function fetchCurrentUser(accessToken: string) {
  return apiRequest<CurrentUserResponse>("/v1/users/me", {
    accessToken,
  }).then((data) => data.profile);
}

export function updateCurrentUserProfile(
  input: UpdateCurrentUserInput,
  accessToken: string
) {
  return apiRequest<UpdateCurrentUserResponse>("/v1/users/me", {
    method: "PATCH",
    body: input,
    accessToken,
  }).then((data) => data.profile);
}

export function fetchWalletBalance(accessToken: string) {
  return apiRequest<WalletBalanceResponse>("/v1/wallet/balance", {
    accessToken,
  }).then((data) => data.summary);
}

export function fetchWalletPosition(accessToken: string) {
  return apiRequest<WalletPositionResponse>("/v1/wallet/position", {
    accessToken,
  }).then((data) => data.position);
}

export function fetchWalletTransactions(accessToken: string) {
  return apiRequest<WalletTransactionsResponse>("/v1/wallet/transactions", {
    accessToken,
  }).then((data) => data.transactions);
}

export function fetchPaymentsOverview(accessToken: string) {
  return apiRequest<PaymentsOverviewResponse>("/v1/payments", {
    accessToken,
  }).then((data) => data.summary);
}

export function fetchVaultGoals(accessToken: string) {
  return apiRequest<VaultsResponse>("/v1/vaults", {
    accessToken,
  });
}

export function createVaultGoal(
  input: {
    name: string;
    targetAmount: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<VaultResponse>("/v1/vaults", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.vault);
}

export function fetchVaultGoal(id: string, accessToken: string) {
  return apiRequest<VaultResponse>(`/v1/vaults/${id}`, {
    accessToken,
  }).then((data) => data.vault);
}

export function fetchTrips(accessToken: string) {
  return apiRequest<TripsResponse>("/v1/trips", {
    accessToken,
  });
}

export function createTrip(
  input: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    budgetAmount: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripResponse>("/v1/trips", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.trip);
}

export function fetchTrip(id: string, accessToken: string) {
  return apiRequest<TripResponse>(`/v1/trips/${id}`, {
    accessToken,
  }).then((data) => data.trip);
}

export function updateTrip(
  id: string,
  input: {
    title?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    budgetAmount?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripResponse>(`/v1/trips/${id}`, {
    method: "PATCH",
    body: input,
    accessToken,
  }).then((data) => data.trip);
}

export function createTripItineraryItem(
  tripId: string,
  input: {
    type: "flight" | "hotel" | "activity" | "note" | "transport";
    title: string;
    date: string;
    location?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripItineraryItemResponse>(`/v1/trips/${tripId}/itinerary`, {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.itineraryItem);
}

export function updateTripItineraryItem(
  tripId: string,
  itemId: string,
  input: {
    type?: "flight" | "hotel" | "activity" | "note" | "transport";
    title?: string;
    date?: string;
    location?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripItineraryItemResponse>(
    `/v1/trips/${tripId}/itinerary/${itemId}`,
    {
      method: "PATCH",
      body: input,
      accessToken,
    }
  ).then((data) => data.itineraryItem);
}

export function generateTripItineraryDraft(
  tripId: string,
  input: {
    preferences?: string;
  },
  accessToken: string
) {
  return apiRequest<TripItineraryDraftResponse>(
    `/v1/trips/${tripId}/itinerary/generate`,
    {
      method: "POST",
      body: input,
      accessToken,
    }
  ).then((data) => data.draft);
}

export function createTripExpense(
  tripId: string,
  input: {
    category: "flight" | "hotel" | "food" | "transport" | "activity" | "misc";
    title: string;
    amount: string;
    occurredAt: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripExpenseResponse>(`/v1/trips/${tripId}/expenses`, {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.expense);
}

export function searchFlightBookingOffers(
  input: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string;
    travelerCount?: number;
    cabinClass?: "economy" | "premium" | "business";
  },
  accessToken: string
) {
  return apiRequest<FlightSearchOffersResponse>("/v1/bookings/flights/search", {
    method: "POST",
    body: input,
    accessToken,
  });
}

export function createFlightBooking(
  input: {
    offer: FlightBookingOffer;
    passengerName: string;
    tripId?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<BookingResponse>("/v1/bookings/flights/book", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.booking);
}

export function searchHotelBookingOffers(
  input: {
    city: string;
    checkInDate: string;
    checkOutDate: string;
    roomCount?: number;
    roomTier?: "standard" | "deluxe" | "suite";
  },
  accessToken: string
) {
  return apiRequest<HotelSearchOffersResponse>("/v1/bookings/hotels/search", {
    method: "POST",
    body: input,
    accessToken,
  });
}

export function createHotelBooking(
  input: {
    offer: HotelBookingOffer;
    guestName: string;
    tripId?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<BookingResponse>("/v1/bookings/hotels/book", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.booking);
}

export function fetchBookings(accessToken: string) {
  return apiRequest<BookingsResponse>("/v1/bookings", {
    accessToken,
  });
}

export function fetchBooking(id: string, accessToken: string) {
  return apiRequest<BookingResponse>(`/v1/bookings/${id}`, {
    accessToken,
  }).then((data) => data.booking);
}

export function issueBoardingPass(
  bookingId: string,
  accessToken: string
) {
  return apiRequest<TicketIssueResponse>(`/v1/bookings/${bookingId}/ticket`, {
    method: "POST",
    body: {},
    accessToken,
  });
}

export function cancelBooking(bookingId: string, accessToken: string) {
  return apiRequest<BookingResponse>(`/v1/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: {},
    accessToken,
  }).then((data) => data.booking);
}

export function fetchBoardingPasses(accessToken: string) {
  return apiRequest<BoardingPassesResponse>("/v1/boarding-passes", {
    accessToken,
  }).then((data) => data.boardingPasses);
}

export function fetchNextBoardingPass(accessToken: string) {
  return apiRequest<BoardingPassResponse>("/v1/boarding-passes/next", {
    accessToken,
  }).then((data) => data.boardingPass);
}

export function fetchBoardingPass(id: string, accessToken: string) {
  return apiRequest<BoardingPassResponse>(`/v1/boarding-passes/${id}`, {
    accessToken,
  }).then((data) => data.boardingPass);
}

export function updateTripExpense(
  tripId: string,
  expenseId: string,
  input: {
    category?: "flight" | "hotel" | "food" | "transport" | "activity" | "misc";
    title?: string;
    amount?: string;
    occurredAt?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<TripExpenseResponse>(`/v1/trips/${tripId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: input,
    accessToken,
  }).then((data) => data.expense);
}

export function fetchPaymentLinks(accessToken: string) {
  return apiRequest<PaymentLinksResponse>("/v1/payments/links", {
    accessToken,
  }).then((data) => data.paymentLinks);
}

export function createPaymentLink(
  input: {
    amount: string;
    title?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<PaymentLinkResponse>("/v1/payments/links", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.paymentLink);
}

export function generatePaymentQr(
  input: {
    amount: string;
    title?: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<PaymentQrResponse>("/v1/payments/qr/generate", {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.qrRequest);
}

export function deletePaymentLink(slug: string, accessToken: string) {
  return apiRequest<{ deleted: boolean; slug: string }>(
    `/v1/payments/links/${slug}`,
    {
      method: "DELETE",
      accessToken,
    }
  );
}

export function fetchPublicPaymentLink(slug: string) {
  return apiRequest<PaymentLinkResponse>(`/v1/payments/links/${slug}`).then(
    (data) => data.paymentLink
  );
}

export function fetchPublicPaymentQr(qrId: string) {
  return apiRequest<PaymentQrResponse>(`/v1/payments/qr/${qrId}`).then(
    (data) => data.qrRequest
  );
}

export function preflightPaymentLink(slug: string, accessToken: string) {
  return apiRequest<PaymentLinkPreflight>(`/v1/payments/links/${slug}/pay`, {
    method: "POST",
    accessToken,
  });
}

export function preflightPaymentQr(qrId: string, accessToken: string) {
  return apiRequest<PaymentQrPreflight>(`/v1/payments/qr/${qrId}/pay`, {
    method: "POST",
    accessToken,
  });
}

export function preflightDirectSend(
  input: {
    username: string;
    amount: string;
    note?: string;
  },
  accessToken: string
) {
  return apiRequest<DirectSendPreflight>("/v1/payments/send", {
    method: "POST",
    body: input,
    accessToken,
  });
}

export function submitPaymentLink(
  slug: string,
  input: {
    txHash: string;
    senderWalletAddress: string;
  },
  accessToken: string
) {
  return apiRequest<PaymentLinkResponse>(`/v1/payments/links/${slug}/submit`, {
    method: "POST",
    body: input,
    accessToken,
  }).then((data) => data.paymentLink);
}

export function resetPaymentLink(slug: string, accessToken: string) {
  return apiRequest<PaymentLinkResponse>(`/v1/payments/links/${slug}/reset`, {
    method: "POST",
    body: {},
    accessToken,
  }).then((data) => data.paymentLink);
}

export async function logoutSession(tokens: SessionTokens | null) {
  if (!tokens) {
    return;
  }

  try {
    await apiRequest<{ revokedSessionIds: string[] }>("/v1/auth/logout", {
      method: "POST",
      body: { refreshToken: tokens.refreshToken },
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
  }
}

export async function readStoredTokens() {
  const stored = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<SessionTokens>;

    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

export function storeTokens(tokens: SessionTokens) {
  return SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens() {
  return SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}
