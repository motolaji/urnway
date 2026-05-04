export type PaymentLink = {
  id: string;
  slug: string;
  title: string | null;
  note: string | null;
  amount: string;
  currency: string;
  status: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  recipient: {
    username: string | null;
    displayName: string;
    walletAddress: string;
  };
  shareText: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerSettlement: {
    canReset: boolean;
    latestAttempt: {
      txHash: string;
      status: string;
      senderWalletAddress: string;
      submittedAt: string;
      confirmedAt: string | null;
    } | null;
  } | null;
};

export type PaymentLinkPreflight = {
  paymentLink: PaymentLink;
  preflight: {
    chainId: number;
    senderWalletAddress: string;
    recipientWalletAddress: string;
    musdTokenAddress: string;
    checks: {
      network: {
        expectedChainId: number;
        ok: boolean;
      };
      musdBalance: {
        requiredAmount: string;
        availableAmount: string;
        ok: boolean;
      };
      gasBalance: {
        availableAmount: string;
        requiredAmount: string | null;
        ok: boolean;
        status: "ready" | "insufficient" | "unavailable";
      };
    };
    issues: Array<{
      code: string;
      message: string;
      severity: "error" | "warning";
    }>;
    transactionRequest: {
      to: string;
      data: string;
      value: string;
      chainId: number;
      gasLimit: string | null;
      gasPrice: string | null;
    };
  };
};

export type PaymentQrRequest = {
  qrId: string;
  payload: string;
  imageDataUrl: string;
  paymentLink: PaymentLink;
};

export type DirectSendPreflight = {
  payment: {
    recipient: {
      username: string | null;
      displayName: string;
      walletAddress: string;
    };
    amount: string;
    currency: string;
    note: string | null;
  };
  preflight: PaymentLinkPreflight["preflight"];
};

export type VaultGoal = {
  id: string;
  name: string;
  targetAmount: string;
  allocatedAmount: string;
  remainingAmount: string;
  progressPercent: number;
  currency: string;
  note: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetAmount: string;
  currency: string;
  note: string | null;
  status: string;
  lifecycle: "upcoming" | "active" | "completed";
  daysUntilStart: number;
  itinerary?: TripItineraryItem[];
  itineraryItemCount?: number;
  expenses?: TripExpense[];
  expenseCount?: number;
  spendSummary?: {
    budgetAmount: string;
    spentAmount: string;
    remainingAmount: string;
    overBudgetAmount: string;
    progressPercent: number;
    currency: string;
    byCategory: {
      category: string;
      amount: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
};

export type TripItineraryItem = {
  id: string;
  type: "flight" | "hotel" | "activity" | "note" | "transport";
  title: string;
  date: string;
  location: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TripItineraryDraft = {
  draftId: string;
  type: "flight" | "hotel" | "activity" | "note" | "transport";
  title: string;
  date: string;
  location: string | null;
  note: string | null;
};

export type TripExpense = {
  id: string;
  category: "flight" | "hotel" | "food" | "transport" | "activity" | "misc";
  title: string;
  amount: string;
  currency: string;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GeneratedTripItineraryDraft = {
  summary: string;
  preferences: string | null;
  generatedAt: string;
  model: string;
  droppedItemCount: number;
  items: TripItineraryDraft[];
};

export type FlightBookingOffer = {
  mode: "flight";
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
  cabinClass: "economy" | "premium" | "business";
  travelerCount: number;
  totalAmount: string;
  currency: string;
};

export type HotelBookingOffer = {
  mode: "hotel";
  offerId: string;
  cityLabel: string;
  cityCode: string;
  hotelName: string;
  hotelCode: string;
  providerCode: string;
  providerName: string;
  checkInDate: string;
  checkOutDate: string;
  roomTier: "standard" | "deluxe" | "suite";
  roomCount: number;
  nightlyAmount: string;
  totalAmount: string;
  totalNights: number;
  currency: string;
};

export type Booking = {
  id: string;
  tripId: string | null;
  mode: "flight" | "hotel";
  status: string;
  passengerName: string;
  bookingReference: string;
  note: string | null;
  payment: {
    totalAmount: string;
    currency: string;
  };
  travel:
    | {
        origin: {
          label: string;
          code: string;
        };
        destination: {
          label: string;
          code: string;
        };
        departDate: string;
        returnDate: string | null;
        carrierCode: string;
        carrierName: string;
        flightNumber: string;
        duration: string;
        cabinClass: string;
        travelerCount: number;
      }
    | null;
  stay:
    | {
        city: {
          label: string;
          code: string;
        };
        hotel: {
          label: string;
          code: string;
        };
        checkInDate: string;
        checkOutDate: string | null;
        providerCode: string;
        providerName: string;
        roomTier: string;
        roomCount: number;
        nightlyAmount: string;
        totalNights: number;
      }
    | null;
  ticket: {
    issued: boolean;
    boardingPassId: string | null;
    ticketIssuedAt: string | null;
    canIssueBoardingPass: boolean;
  };
  cancellation: {
    canCancel: boolean;
    cancelledAt: string | null;
    policy: string;
  };
  refund: {
    status: string;
    amount: string;
    requestedAt: string | null;
    refundedAt: string | null;
    estimatedArrival: string | null;
    policy: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type BoardingPass = {
  id: string;
  bookingId: string;
  status: string;
  passengerName: string;
  bookingReference: string;
  ticketNumber: string;
  qrPayload: string;
  travel: {
    carrierCode: string;
    carrierName: string;
    flightNumber: string;
    originCode: string;
    destinationCode: string;
    departDate: string;
    gate: string;
    seat: string;
    boardingGroup: string;
  };
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};
