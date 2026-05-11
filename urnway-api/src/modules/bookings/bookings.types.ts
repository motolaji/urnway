export type SearchFlightsInput = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  travelerCount?: number;
  cabinClass?: 'economy' | 'premium' | 'business';
};

export type SearchHotelsInput = {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  roomCount?: number;
  roomTier?: 'standard' | 'deluxe' | 'suite';
};

export type FlightBookingProvider = 'demo' | 'duffel';
export type HotelBookingProvider = 'demo' | 'duffel' | 'liteapi';

export type FlightOffer = {
  offerId: string;
  provider: FlightBookingProvider;
  providerOfferId?: string | null;
  providerOfferRequestId?: string | null;
  providerPassengerIds?: string[];
  expiresAt?: string | null;
  requiresInstantPayment?: boolean;
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

export type CreateFlightBookingInput = {
  offer: FlightOffer;
  passengerName: string;
  bornOn?: string;
  email?: string;
  phoneNumber?: string;
  title?: 'mr' | 'mrs' | 'ms' | 'miss' | 'mx' | 'dr';
  gender?: 'm' | 'f' | 'x';
  tripId?: string;
  note?: string;
};

export type HotelOffer = {
  offerId: string;
  provider: HotelBookingProvider;
  providerSearchResultId?: string | null;
  providerRateId?: string | null;
  providerAccommodationId?: string | null;
  expiresAt?: string | null;
  paymentType?: string;
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

export type CreateHotelBookingInput = {
  offer: HotelOffer;
  guestName: string;
  bornOn?: string;
  email?: string;
  phoneNumber?: string;
  tripId?: string;
  note?: string;
};
