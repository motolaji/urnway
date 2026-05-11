import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import DatePickerSheet from "@/components/date-picker-sheet";
import LocationPickerSheet from "@/components/location-picker-sheet";
import { Badge, Button, IconButton, Text } from "@/components/ui";
import { borderRadius, colors, spacing, typography } from "@/constants/design-tokens";
import {
  ApiError,
  createFlightBooking,
  createHotelBooking,
  fetchBookings,
  fetchNextBoardingPass,
  type LocationSuggestion,
  fetchTrips,
  searchFlightBookingOffers,
  searchHotelBookingOffers,
  type BoardingPass,
  type Booking,
  type FlightBookingOffer,
  type HotelBookingOffer,
  type Trip,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BookingsState = {
  summary: {
    bookingCount: number;
    ticketedCount: number;
    confirmedCount: number;
    currency: string;
  } | null;
  bookings: Booking[];
};

function formatTokenAmount(value: string, maximumFractionDigits = 2) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(parsed);
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function formatSingleDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateFieldValue(date: string) {
  if (!date.trim()) {
    return "";
  }

  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDateFieldValue(date: string) {
  if (!date.trim()) {
    return "";
  }

  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseIsoDateField(value?: string | null) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoDateFieldValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getBookingTitle(booking: Booking) {
  if (booking.mode === "hotel" && booking.stay) {
    return booking.stay.hotel.label;
  }
  return booking.travel
    ? `${booking.travel.origin.code} → ${booking.travel.destination.code}`
    : "Booking";
}

function getBookingSubtitle(booking: Booking) {
  if (booking.mode === "hotel" && booking.stay) {
    return `${booking.stay.city.label} · ${formatDateRange(
      booking.stay.checkInDate,
      booking.stay.checkOutDate ?? booking.stay.checkInDate
    )}`;
  }
  return booking.travel
    ? `${booking.travel.carrierName} · ${formatSingleDate(booking.travel.departDate)}`
    : booking.bookingReference;
}

function isDuffelFlightOffer(
  offer: FlightBookingOffer | HotelBookingOffer | null
): offer is FlightBookingOffer {
  return Boolean(offer && "originCode" in offer && offer.provider === "duffel");
}

function isDuffelHotelOffer(
  offer: FlightBookingOffer | HotelBookingOffer | null
): offer is HotelBookingOffer {
  return Boolean(offer && "cityCode" in offer && offer.provider === "duffel");
}

function isLiteApiHotelOffer(
  offer: FlightBookingOffer | HotelBookingOffer | null
): offer is HotelBookingOffer {
  return Boolean(offer && "cityCode" in offer && offer.provider === "liteapi");
}

function getFlightOfferBookingModeLabel(offer: FlightBookingOffer) {
  if (offer.provider !== "duffel") {
    return "Demo booking";
  }

  return offer.requiresInstantPayment
    ? "Instant provider payment required"
    : "Hold available";
}

function getHotelOfferBookingModeLabel(offer: HotelBookingOffer) {
  if (offer.provider === "liteapi") {
    return "Provider-backed stay";
  }

  if (offer.provider !== "duffel") {
    return "Demo stay booking";
  }

  return offer.paymentType === "pay_now"
    ? "Instant payment rate"
    : "Provider-backed stay";
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPlausiblePhoneNumber(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 6;
}

function getValidationMessageFromApiError(error: ApiError, fallback: string) {
  const details = error.details as
    | {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      }
    | null
    | undefined;

  if (!details) {
    return error.message || fallback;
  }

  const formError = details.formErrors?.find(Boolean);
  if (formError) {
    return formError;
  }

  const fieldEntry = Object.entries(details.fieldErrors ?? {}).find(
    ([, messages]) => Array.isArray(messages) && messages.length > 0 && messages[0]
  );

  if (fieldEntry) {
    const [field, messages] = fieldEntry;
    return `${field}: ${messages?.[0]}`;
  }

  return error.message || fallback;
}

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clearError, tokens } = useSession();

  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "bookings">("flights");
  const [bookingsState, setBookingsState] = useState<BookingsState>({
    summary: null,
    bookings: [],
  });
  const [nextBoardingPass, setNextBoardingPass] = useState<BoardingPass | null>(null);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);

  // Flight form
  const [origin, setOrigin] = useState("");
  const [originSearchValue, setOriginSearchValue] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [destinationSearchValue, setDestinationSearchValue] = useState<string | null>(null);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [cabinClass, setCabinClass] = useState<"economy" | "premium" | "business">("economy");

  // Hotel form
  const [hotelCity, setHotelCity] = useState("");
  const [hotelCitySearchValue, setHotelCitySearchValue] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [rooms, setRooms] = useState("1");
  const [roomTier, setRoomTier] = useState<"standard" | "deluxe" | "suite">("standard");

  // Search results
  const [searchResults, setSearchResults] = useState<FlightBookingOffer[]>([]);
  const [hotelResults, setHotelResults] = useState<HotelBookingOffer[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<FlightBookingOffer | HotelBookingOffer | null>(null);
  const [pendingBookingOffer, setPendingBookingOffer] = useState<
    FlightBookingOffer | HotelBookingOffer | null
  >(null);
  const [passengerName, setPassengerName] = useState("");
  const [passengerBornOn, setPassengerBornOn] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [passengerPhoneNumber, setPassengerPhoneNumber] = useState("");
  const [passengerTitle, setPassengerTitle] = useState<"mr" | "mrs" | "ms" | "miss" | "mx" | "dr">("mr");
  const [passengerGender, setPassengerGender] = useState<"m" | "f" | "x">("m");
  const [bookingNote, setBookingNote] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [bookingOfferId, setBookingOfferId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<
    "depart" | "return" | "checkIn" | "checkOut" | "passengerBornOn" | null
  >(null);
  const [showLocationPicker, setShowLocationPicker] = useState<
    "origin" | "destination" | "hotelCity" | null
  >(null);
  const [showFilters, setShowFilters] = useState(false);
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  async function loadTravelData(accessToken: string) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [bookingsData, nextPass, tripsData] = await Promise.all([
        fetchBookings(accessToken),
        fetchNextBoardingPass(accessToken),
        fetchTrips(accessToken),
      ]);

      setBookingsState({
        summary: bookingsData.summary,
        bookings: bookingsData.bookings,
      });
      setNextBoardingPass(nextPass);
      setAvailableTrips(tripsData.trips);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to load your travel data. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!tokens?.accessToken) {
      setIsLoading(false);
      return;
    }
    void loadTravelData(tokens.accessToken);
  }, [tokens?.accessToken]);

  useEffect(() => {
    if (!pendingBookingOffer || showResultsModal) {
      return;
    }

    setSelectedOffer(pendingBookingOffer);
    setShowBookingModal(true);
    setPendingBookingOffer(null);
  }, [pendingBookingOffer, showResultsModal]);

  function beginBookingFlow(offer: FlightBookingOffer | HotelBookingOffer) {
    setPassengerName("");
    setPassengerBornOn("");
    setPassengerEmail("");
    setPassengerPhoneNumber("");
    setPassengerTitle("mr");
    setPassengerGender("m");
    setBookingNote("");
    setSelectedTripId(null);
    setPendingBookingOffer(offer);
    setShowResultsModal(false);
  }

  function applyLocationSelection(field: "origin" | "destination" | "hotelCity", suggestion: LocationSuggestion) {
    if (field === "origin") {
      setOrigin(suggestion.label);
      setOriginSearchValue(suggestion.searchValue);
      return;
    }

    if (field === "destination") {
      setDestination(suggestion.label);
      setDestinationSearchValue(suggestion.searchValue);
      return;
    }

    setHotelCity(suggestion.label);
    setHotelCitySearchValue(suggestion.searchValue);
  }

  function applyTypedLocation(field: "origin" | "destination" | "hotelCity", value: string) {
    if (field === "origin") {
      setOrigin(value);
      setOriginSearchValue(null);
      return;
    }

    if (field === "destination") {
      setDestination(value);
      setDestinationSearchValue(null);
      return;
    }

    setHotelCity(value);
    setHotelCitySearchValue(null);
  }

  function openDatePicker(
    target: "depart" | "return" | "checkIn" | "checkOut" | "passengerBornOn"
  ) {
    if (Platform.OS !== "android") {
      setShowDatePicker(target);
      return;
    }

    const currentValue =
      target === "depart"
        ? departDate
        : target === "return"
        ? returnDate
        : target === "checkIn"
        ? checkIn
        : target === "checkOut"
        ? checkOut
        : passengerBornOn;

    const minimumDate =
      target === "return"
        ? departDate || undefined
        : target === "checkOut"
        ? checkIn || undefined
        : undefined;

    DateTimePickerAndroid.open({
      value: parseIsoDateField(currentValue),
      mode: "date",
      is24Hour: true,
      minimumDate: minimumDate ? parseIsoDateField(minimumDate) : undefined,
      maximumDate: target === "passengerBornOn" ? parseIsoDateField(todayIsoDate) : undefined,
      onChange: (event, selectedDate) => {
        if (event.type !== "set" || !selectedDate) {
          return;
        }

        const nextValue = toIsoDateFieldValue(selectedDate);

        if (target === "depart") {
          setDepartDate(nextValue);
          if (returnDate && returnDate < nextValue) {
            setReturnDate("");
          }
          return;
        }

        if (target === "return") {
          setReturnDate(nextValue);
          return;
        }

        if (target === "checkIn") {
          setCheckIn(nextValue);
          if (checkOut && checkOut <= nextValue) {
            setCheckOut("");
          }
          return;
        }

        if (target === "checkOut") {
          setCheckOut(nextValue);
          return;
        }

        setPassengerBornOn(nextValue);
      },
    });
  }

  async function handleSearchFlights() {
    if (!tokens?.accessToken || isSearching) return;

    if (!origin.trim() || !destination.trim() || !departDate.trim()) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    clearError();
    setIsSearching(true);
    setErrorMessage(null);

    try {
      const result = await searchFlightBookingOffers(
        {
          origin: (originSearchValue ?? origin).trim(),
          destination: (destinationSearchValue ?? destination).trim(),
          departDate: departDate.trim(),
          returnDate: returnDate.trim() || undefined,
          cabinClass,
        },
        tokens.accessToken
      );

      setSearchResults(result.offers);
      setHotelResults([]);
      setShowResultsModal(true);
      setStatusMessage(`Found ${result.offers.length} flight${result.offers.length === 1 ? "" : "s"}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to search flights. Please try again."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearchHotels() {
    if (!tokens?.accessToken || isSearching) return;

    if (!hotelCity.trim() || !checkIn.trim() || !checkOut.trim()) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    clearError();
    setIsSearching(true);
    setErrorMessage(null);

    try {
      const result = await searchHotelBookingOffers(
        {
          city: (hotelCitySearchValue ?? hotelCity).trim(),
          checkInDate: checkIn.trim(),
          checkOutDate: checkOut.trim(),
          roomCount: Number.parseInt(rooms, 10) || 1,
          roomTier,
        },
        tokens.accessToken
      );

      setHotelResults(result.offers);
      setSearchResults([]);
      setShowResultsModal(true);
      setStatusMessage(`Found ${result.offers.length} hotel${result.offers.length === 1 ? "" : "s"}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to search hotels. Please try again."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleBookFlight(offer: FlightBookingOffer) {
    if (!tokens?.accessToken || !passengerName.trim()) {
      setErrorMessage("Please enter passenger name");
      return;
    }

    if (passengerBornOn.trim() && !isIsoDateString(passengerBornOn)) {
      setErrorMessage("Date of birth must use YYYY-MM-DD");
      return;
    }

    if (passengerEmail.trim() && !isValidEmailAddress(passengerEmail)) {
      setErrorMessage("Enter a valid email address");
      return;
    }

    if (passengerPhoneNumber.trim() && !isPlausiblePhoneNumber(passengerPhoneNumber)) {
      setErrorMessage("Phone number must be at least 6 characters");
      return;
    }

    if (offer.provider === "duffel") {
      if (!passengerBornOn.trim()) {
        setErrorMessage("Date of birth is required for Duffel flight bookings");
        return;
      }

      if (!passengerEmail.trim()) {
        setErrorMessage("Email is required for Duffel flight bookings");
        return;
      }

      if (!passengerPhoneNumber.trim()) {
        setErrorMessage("Phone number is required for Duffel flight bookings");
        return;
      }

      if (!isValidEmailAddress(passengerEmail)) {
        setErrorMessage("Enter a valid email address for Duffel flight bookings");
        return;
      }

      if (!isPlausiblePhoneNumber(passengerPhoneNumber)) {
        setErrorMessage("Enter a valid phone number for Duffel flight bookings");
        return;
      }
    }

    clearError();
    setBookingOfferId(offer.offerId);

    try {
      const booking = await createFlightBooking(
        {
          offer,
          passengerName: passengerName.trim(),
          bornOn: passengerBornOn.trim() || undefined,
          email: passengerEmail.trim() || undefined,
          phoneNumber: passengerPhoneNumber.trim() || undefined,
          title: passengerTitle,
          gender: passengerGender,
          tripId: selectedTripId ?? undefined,
          note: bookingNote.trim() || undefined,
        },
        tokens.accessToken
      );

      setBookingsState((current) => {
        const nextBookings = [booking, ...current.bookings];
        return {
          summary: {
            bookingCount: nextBookings.length,
            ticketedCount: nextBookings.filter((b) => b.ticket.issued).length,
            confirmedCount: nextBookings.filter((b) => b.status === "confirmed").length,
            currency: current.summary?.currency ?? "MUSD",
          },
          bookings: nextBookings,
        };
      });

      setShowBookingModal(false);
      setShowResultsModal(false);
      setSelectedTripId(null);
      setStatusMessage(
        offer.provider === "duffel"
          ? "Flight hold created with Duffel."
          : "Flight booked successfully!"
      );
      router.push(`/bookings/${booking.id}` as Href);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? getValidationMessageFromApiError(
              error,
              "Unable to complete booking. Please try again."
            )
          : "Unable to complete booking. Please try again."
      );
    } finally {
      setBookingOfferId(null);
    }
  }

  async function handleBookHotel(offer: HotelBookingOffer) {
    if (!tokens?.accessToken || !passengerName.trim()) {
      setErrorMessage("Please enter guest name");
      return;
    }

    if (passengerBornOn.trim() && !isIsoDateString(passengerBornOn)) {
      setErrorMessage("Date of birth must use YYYY-MM-DD");
      return;
    }

    if (passengerEmail.trim() && !isValidEmailAddress(passengerEmail)) {
      setErrorMessage("Enter a valid email address");
      return;
    }

    if (passengerPhoneNumber.trim() && !isPlausiblePhoneNumber(passengerPhoneNumber)) {
      setErrorMessage("Phone number must be at least 6 characters");
      return;
    }

    if (offer.provider === "liteapi") {
      if (!passengerEmail.trim()) {
        setErrorMessage("Email is required for liteAPI hotel bookings");
        return;
      }

      if (!isValidEmailAddress(passengerEmail)) {
        setErrorMessage("Enter a valid email address for liteAPI hotel bookings");
        return;
      }
    } else if (offer.provider === "duffel") {
      if (!passengerBornOn.trim()) {
        setErrorMessage("Date of birth is required for Duffel hotel bookings");
        return;
      }

      if (!passengerEmail.trim()) {
        setErrorMessage("Email is required for Duffel hotel bookings");
        return;
      }

      if (!passengerPhoneNumber.trim()) {
        setErrorMessage("Phone number is required for Duffel hotel bookings");
        return;
      }

      if (!isValidEmailAddress(passengerEmail)) {
        setErrorMessage("Enter a valid email address for Duffel hotel bookings");
        return;
      }

      if (!isPlausiblePhoneNumber(passengerPhoneNumber)) {
        setErrorMessage("Enter a valid phone number for Duffel hotel bookings");
        return;
      }
    }

    clearError();
    setBookingOfferId(offer.offerId);

    try {
      const booking = await createHotelBooking(
        {
          offer,
          guestName: passengerName.trim(),
          bornOn: passengerBornOn.trim() || undefined,
          email: passengerEmail.trim() || undefined,
          phoneNumber: passengerPhoneNumber.trim() || undefined,
          tripId: selectedTripId ?? undefined,
          note: bookingNote.trim() || undefined,
        },
        tokens.accessToken
      );

      setBookingsState((current) => {
        const nextBookings = [booking, ...current.bookings];
        return {
          summary: {
            bookingCount: nextBookings.length,
            ticketedCount: nextBookings.filter((b) => b.ticket.issued).length,
            confirmedCount: nextBookings.filter((b) => b.status === "confirmed").length,
            currency: current.summary?.currency ?? "MUSD",
          },
          bookings: nextBookings,
        };
      });

      setShowBookingModal(false);
      setShowResultsModal(false);
      setSelectedTripId(null);
      setStatusMessage(
        offer.provider === "liteapi"
          ? "Hotel booked with liteAPI."
          : offer.provider === "duffel"
          ? "Hotel booked with Duffel Stays."
          : "Hotel booked successfully!"
      );
      router.push(`/bookings/${booking.id}` as Href);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? getValidationMessageFromApiError(
              error,
              "Unable to complete booking. Please try again."
            )
          : "Unable to complete booking. Please try again."
      );
    } finally {
      setBookingOfferId(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[4] }]}>
        <View style={styles.headerContent}>
          <Text variant="h2" style={styles.title}>
            Travel
          </Text>
          <IconButton
            variant="ghost"
            size="md"
            onPress={() => setShowMenu(true)}
            icon={<Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Messages */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.status.error} />
            <Text variant="bodySmall" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        )}

        {statusMessage && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
            <Text variant="bodySmall" style={styles.successText}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === "flights" && styles.tabActive]}
            onPress={() => setActiveTab("flights")}
          >
            <Text
              variant="body"
              weight={activeTab === "flights" ? "semiBold" : "regular"}
              style={activeTab === "flights" ? styles.tabTextActive : styles.tabText}
            >
              Flights
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "hotels" && styles.tabActive]}
            onPress={() => setActiveTab("hotels")}
          >
            <Text
              variant="body"
              weight={activeTab === "hotels" ? "semiBold" : "regular"}
              style={activeTab === "hotels" ? styles.tabTextActive : styles.tabText}
            >
              Hotels
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "bookings" && styles.tabActive]}
            onPress={() => setActiveTab("bookings")}
          >
            <Text
              variant="body"
              weight={activeTab === "bookings" ? "semiBold" : "regular"}
              style={activeTab === "bookings" ? styles.tabTextActive : styles.tabText}
            >
              My Bookings
            </Text>
          </Pressable>
        </View>

        {/* Flight Search Form */}
        {activeTab === "flights" && (
          <View style={styles.searchForm}>
            <View style={styles.originDestRow}>
              <Pressable
                style={[styles.inputPill, styles.inputHalf]}
                onPress={() => setShowLocationPicker("origin")}
              >
                <Ionicons name="airplane-outline" size={20} color={colors.text.tertiary} />
                <Text
                  variant="body"
                  style={origin ? styles.dateText : styles.datePlaceholder}
                  numberOfLines={1}
                >
                  {origin || "Origin"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.swapButton}
                onPress={() => {
                  setOrigin((currentOrigin) => {
                    const nextOrigin = destination;
                    setDestination(currentOrigin);
                    return nextOrigin;
                  });
                  setOriginSearchValue(destinationSearchValue);
                  setDestinationSearchValue(originSearchValue);
                }}
              >
                <Ionicons name="swap-horizontal" size={24} color={colors.text.secondary} />
              </Pressable>
              <Pressable
                style={[styles.inputPill, styles.inputHalf]}
                onPress={() => setShowLocationPicker("destination")}
              >
                <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
                <Text
                  variant="body"
                  style={destination ? styles.dateText : styles.datePlaceholder}
                  numberOfLines={1}
                >
                  {destination || "Destination"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.dateRow}>
              <Pressable
                style={[styles.inputPill, styles.inputHalf]}
                onPress={() => openDatePicker("depart")}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                <Text
                  variant="body"
                  style={departDate ? styles.dateText : styles.datePlaceholder}
                >
                  {formatDateFieldValue(departDate) || "Depart"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.inputPill, styles.inputHalf]}
                onPress={() => openDatePicker("return")}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                <Text
                  variant="body"
                  style={returnDate ? styles.dateText : styles.datePlaceholder}
                >
                  {formatDateFieldValue(returnDate) || "Return"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Pressable
                style={styles.filterButton}
                onPress={() => setShowFilters(true)}
              >
                <Ionicons name="options-outline" size={20} color={colors.text.primary} />
                <Text variant="body" weight="semiBold" style={styles.filterButtonText}>
                  Filters
                </Text>
                {cabinClass !== "economy" && <View style={styles.filterBadge} />}
              </Pressable>
              <Pressable
                style={[styles.searchButton, styles.searchButtonFlex]}
                onPress={() => void handleSearchFlights()}
              >
                {isSearching ? (
                  <ActivityIndicator color={colors.grays.white} />
                ) : (
                  <Text variant="body" weight="semiBold" style={styles.searchButtonText}>
                    Search Flights
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Hotel Search Form */}
        {activeTab === "hotels" && (
          <View style={styles.searchForm}>
            <Pressable
              style={styles.inputPill}
              onPress={() => setShowLocationPicker("hotelCity")}
            >
              <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
              <Text
                variant="body"
                style={hotelCity ? styles.dateText : styles.datePlaceholder}
                numberOfLines={1}
              >
                {hotelCity || 'e.g. "London" or "Marriott Hotel"'}
              </Text>
            </Pressable>

            <View style={styles.dateGuestRow}>
              <Pressable
                style={[styles.inputPill, styles.inputThird]}
                onPress={() => openDatePicker("checkIn")}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
                <Text
                  variant="bodySmall"
                  style={checkIn ? styles.dateText : styles.datePlaceholder}
                >
                  {formatDateFieldValue(checkIn) || "Check-in"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.inputPill, styles.inputThird]}
                onPress={() => openDatePicker("checkOut")}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
                <Text
                  variant="bodySmall"
                  style={checkOut ? styles.dateText : styles.datePlaceholder}
                >
                  {formatDateFieldValue(checkOut) || "Check-out"}
                </Text>
              </Pressable>
              <View style={[styles.inputPill, styles.inputThird]}>
                <Ionicons name="person-outline" size={18} color={colors.text.tertiary} />
                <TextInput
                  style={styles.pillInputSmall}
                  placeholder="Rooms"
                  placeholderTextColor={colors.text.tertiary}
                  value={rooms}
                  onChangeText={setRooms}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.searchRow}>
              <Pressable
                style={styles.filterButton}
                onPress={() => setShowFilters(true)}
              >
                <Ionicons name="options-outline" size={20} color={colors.text.primary} />
                <Text variant="body" weight="semiBold" style={styles.filterButtonText}>
                  Filters
                </Text>
                {roomTier !== "standard" && <View style={styles.filterBadge} />}
              </Pressable>
              <Pressable
                style={[styles.searchButton, styles.searchButtonFlex]}
                onPress={() => void handleSearchHotels()}
              >
                {isSearching ? (
                  <ActivityIndicator color={colors.grays.white} />
                ) : (
                  <Text variant="body" weight="semiBold" style={styles.searchButtonText}>
                    Search Hotels
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* My Bookings Tab */}
        {activeTab === "bookings" && (
          <View style={styles.bookingsSection}>
            {/* Next Flight */}
            {nextBoardingPass && (
              <>
                <Pressable
                  style={styles.nextFlightCard}
                  onPress={() => router.push(`/boarding-passes/${nextBoardingPass.id}` as Href)}
                >
                  <View style={styles.nextFlightContent}>
                    <View style={styles.nextFlightIcon}>
                      <Ionicons name="airplane" size={24} color={colors.brand.default} />
                    </View>
                    <View style={styles.nextFlightInfo}>
                      <Text variant="label" style={styles.nextFlightLabel}>
                        Upcoming Flight
                      </Text>
                      <Text variant="h4">
                        {nextBoardingPass.travel.originCode} → {nextBoardingPass.travel.destinationCode}
                      </Text>
                      <Text variant="caption" color="secondary">
                        {nextBoardingPass.travel.carrierName} · {formatSingleDate(nextBoardingPass.travel.departDate)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
                  </View>
                </Pressable>
                <Button
                  variant="secondary"
                  onPress={() => router.push("/boarding-passes")}
                >
                  View all boarding passes
                </Button>
              </>
            )}

            {/* Recent Bookings */}
            <Text variant="h4" style={styles.sectionTitle}>
              Recent Bookings
            </Text>

            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.brand.default} />
                <Text variant="bodySmall" color="secondary">
                  Loading...
                </Text>
              </View>
            ) : bookingsState.bookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color={colors.text.tertiary} />
                <Text variant="h4">Nothing booked yet</Text>
                <Text variant="bodySmall" color="secondary" align="center">
                  Use the tabs above to search for flights or hotels
                </Text>
              </View>
            ) : (
              bookingsState.bookings.map((booking) => (
                <Pressable
                  key={booking.id}
                  style={styles.bookingCard}
                  onPress={() => router.push(`/bookings/${booking.id}` as Href)}
                >
                  <View style={styles.bookingContent}>
                    <View style={styles.bookingInfo}>
                      <Text variant="body" weight="semiBold">
                        {getBookingTitle(booking)}
                      </Text>
                      <Text variant="caption" color="secondary">
                        {getBookingSubtitle(booking)}
                      </Text>
                    </View>
                <Badge
                  variant={
                    booking.status === "cancelled"
                      ? "error"
                      : booking.status === "held"
                      ? "warning"
                      : booking.mode === "hotel"
                      ? "info"
                      : booking.ticket.issued
                      ? "success"
                          : "warning"
                      }
                    >
                  {booking.status === "cancelled"
                    ? "Cancelled"
                    : booking.status === "held"
                    ? "Held"
                    : booking.mode === "hotel"
                    ? "Hotel"
                    : booking.ticket.issued
                    ? "Ticketed"
                        : "Confirmed"}
                    </Badge>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Results Modal */}
      <Modal
        visible={showResultsModal}
        animationType="slide"
        onRequestClose={() => setShowResultsModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text variant="h3">Search Results</Text>
            <IconButton
              variant="ghost"
              size="md"
              onPress={() => setShowResultsModal(false)}
              icon={<Ionicons name="close" size={28} color={colors.text.primary} />}
            />
          </View>

          <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
            {searchResults.map((offer) => (
              <Pressable
                key={offer.offerId}
                style={styles.offerCard}
                onPress={() => beginBookingFlow(offer)}
              >
                <View style={styles.offerHeader}>
                  <View style={styles.offerInfo}>
                    <Text variant="body" weight="semiBold">
                      {offer.originCode} → {offer.destinationCode}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {offer.carrierName} · {formatSingleDate(offer.departDate)}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {getFlightOfferBookingModeLabel(offer)}
                    </Text>
                  </View>
                  <Text variant="h4" style={styles.offerPrice}>
                    {formatTokenAmount(offer.totalAmount)} {offer.currency}
                  </Text>
                </View>
              </Pressable>
            ))}

            {hotelResults.map((offer) => (
              <Pressable
                key={offer.offerId}
                style={styles.offerCard}
                onPress={() => beginBookingFlow(offer)}
              >
                <View style={styles.offerHeader}>
                  <View style={styles.offerInfo}>
                    <Text variant="body" weight="semiBold">
                      {offer.hotelName}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {offer.cityLabel} · {offer.totalNights} nights
                    </Text>
                    <Text variant="caption" color="secondary">
                      {getHotelOfferBookingModeLabel(offer)}
                    </Text>
                  </View>
                  <Text variant="h4" style={styles.offerPrice}>
                    {formatTokenAmount(offer.totalAmount)} {offer.currency}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Booking Confirmation Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowBookingModal(false);
          setSelectedOffer(null);
        }}
      >
        <View style={styles.bookingModalOverlay}>
          <ScrollView
            style={styles.bookingModalScroll}
            contentContainerStyle={styles.bookingModalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.bookingModalContent, { paddingBottom: insets.bottom + spacing[4] }]}>
            <View style={styles.modalHeader}>
              <Text variant="h4">Complete Booking</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => {
                  setShowBookingModal(false);
                  setSelectedOffer(null);
                }}
                icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
              />
            </View>

            <View style={styles.inputPill}>
              <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
              <TextInput
                style={styles.pillInput}
                placeholder={
                  selectedOffer && "originCode" in selectedOffer
                    ? "Passenger Full Name"
                    : "Guest Name"
                }
                placeholderTextColor={colors.text.tertiary}
                value={passengerName}
                onChangeText={setPassengerName}
                autoCapitalize="words"
              />
            </View>

            {isDuffelFlightOffer(selectedOffer) ? (
              <>
                <View
                  style={[
                    styles.providerBanner,
                    selectedOffer.requiresInstantPayment
                      ? styles.providerBannerWarning
                      : styles.providerBannerInfo,
                  ]}
                >
                  <Ionicons
                    name={
                      selectedOffer.requiresInstantPayment
                        ? "alert-circle-outline"
                        : "business-outline"
                    }
                    size={18}
                    color={
                      selectedOffer.requiresInstantPayment
                        ? colors.status.warning
                        : colors.brand.default
                    }
                  />
                  <Text variant="bodySmall" style={styles.providerBannerText}>
                    {selectedOffer.requiresInstantPayment
                      ? "This real airline offer requires instant provider payment. Urnway can only place holdable Duffel offers right now."
                      : "This is a real Duffel flight offer. Urnway will place it as a hold order first."}
                  </Text>
                </View>

                <Pressable
                  style={styles.inputPill}
                  onPress={() => openDatePicker("passengerBornOn")}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                  <Text
                    variant="body"
                    style={passengerBornOn ? styles.dateText : styles.datePlaceholder}
                  >
                    {formatFullDateFieldValue(passengerBornOn) || "Date of Birth"}
                  </Text>
                </Pressable>

                <View style={styles.inputPill}>
                  <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.pillInput}
                    placeholder="Passenger Email"
                    placeholderTextColor={colors.text.tertiary}
                    value={passengerEmail}
                    onChangeText={setPassengerEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.providerOptionSection}>
                  <Text variant="label" style={styles.tripAttachLabel}>
                    Title
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tripAttachRow}
                  >
                    {(["mr", "mrs", "ms", "miss", "mx", "dr"] as const).map((title) => (
                      <Pressable
                        key={title}
                        style={[
                          styles.tripChip,
                          passengerTitle === title && styles.tripChipActive,
                        ]}
                        onPress={() => setPassengerTitle(title)}
                      >
                        <Text
                          variant="caption"
                          style={
                            passengerTitle === title
                              ? styles.tripChipTextActive
                              : styles.tripChipText
                          }
                        >
                          {title.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.providerOptionSection}>
                  <Text variant="label" style={styles.tripAttachLabel}>
                    Gender
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tripAttachRow}
                  >
                    {([
                      { value: "m", label: "Male" },
                      { value: "f", label: "Female" },
                      { value: "x", label: "Other" },
                    ] as const).map((gender) => (
                      <Pressable
                        key={gender.value}
                        style={[
                          styles.tripChip,
                          passengerGender === gender.value && styles.tripChipActive,
                        ]}
                        onPress={() => setPassengerGender(gender.value)}
                      >
                        <Text
                          variant="caption"
                          style={
                            passengerGender === gender.value
                              ? styles.tripChipTextActive
                              : styles.tripChipText
                          }
                        >
                          {gender.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputPill}>
                  <Ionicons name="call-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.pillInput}
                    placeholder="Phone Number (Optional)"
                    placeholderTextColor={colors.text.tertiary}
                    value={passengerPhoneNumber}
                    onChangeText={setPassengerPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            ) : null}

            {isDuffelHotelOffer(selectedOffer) ? (
              <>
                <View style={[styles.providerBanner, styles.providerBannerInfo]}>
                  <Ionicons
                    name="bed-outline"
                    size={18}
                    color={colors.brand.default}
                  />
                  <Text variant="bodySmall" style={styles.providerBannerText}>
                    This is a real Duffel Stays rate. Urnway will create a provider-backed stay booking from the selected rate.
                  </Text>
                </View>

                <Pressable
                  style={styles.inputPill}
                  onPress={() => openDatePicker("passengerBornOn")}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                  <Text
                    variant="body"
                    style={passengerBornOn ? styles.dateText : styles.datePlaceholder}
                  >
                    {formatFullDateFieldValue(passengerBornOn) || "Guest Date of Birth"}
                  </Text>
                </Pressable>

                <View style={styles.inputPill}>
                  <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.pillInput}
                    placeholder="Lead Guest Email"
                    placeholderTextColor={colors.text.tertiary}
                    value={passengerEmail}
                    onChangeText={setPassengerEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputPill}>
                  <Ionicons name="call-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.pillInput}
                    placeholder="Lead Guest Phone Number"
                    placeholderTextColor={colors.text.tertiary}
                    value={passengerPhoneNumber}
                    onChangeText={setPassengerPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            ) : null}

            {isLiteApiHotelOffer(selectedOffer) ? (
              <>
                <View style={[styles.providerBanner, styles.providerBannerInfo]}>
                  <Ionicons
                    name="bed-outline"
                    size={18}
                    color={colors.brand.default}
                  />
                  <Text variant="bodySmall" style={styles.providerBannerText}>
                    This is a real liteAPI stay rate. Urnway will prebook the selected room and confirm it using the configured liteAPI account payment method.
                  </Text>
                </View>

                <View style={styles.inputPill}>
                  <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.pillInput}
                    placeholder="Lead Guest Email"
                    placeholderTextColor={colors.text.tertiary}
                    value={passengerEmail}
                    onChangeText={setPassengerEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </>
            ) : null}

            <View style={styles.inputPill}>
              <Ionicons name="document-text-outline" size={20} color={colors.text.tertiary} />
              <TextInput
                style={styles.pillInput}
                placeholder="Note (Optional)"
                placeholderTextColor={colors.text.tertiary}
                value={bookingNote}
                onChangeText={setBookingNote}
                autoCapitalize="sentences"
              />
            </View>

            {availableTrips.filter((trip) => trip.lifecycle !== "completed").length > 0 ? (
              <View style={styles.tripAttachSection}>
                <Text variant="label" style={styles.tripAttachLabel}>
                  Attach to trip (optional)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tripAttachRow}
                >
                  <Pressable
                    style={[
                      styles.tripChip,
                      selectedTripId === null && styles.tripChipActive,
                    ]}
                    onPress={() => setSelectedTripId(null)}
                  >
                    <Text
                      variant="caption"
                      style={
                        selectedTripId === null
                          ? styles.tripChipTextActive
                          : styles.tripChipText
                      }
                    >
                      No trip
                    </Text>
                  </Pressable>
                  {availableTrips
                    .filter((trip) => trip.lifecycle !== "completed")
                    .map((trip) => (
                      <Pressable
                        key={trip.id}
                        style={[
                          styles.tripChip,
                          selectedTripId === trip.id && styles.tripChipActive,
                        ]}
                        onPress={() => setSelectedTripId(trip.id)}
                      >
                        <Text
                          variant="caption"
                          style={
                            selectedTripId === trip.id
                              ? styles.tripChipTextActive
                              : styles.tripChipText
                          }
                        >
                          {trip.title}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={!!bookingOfferId}
              disabled={
                isDuffelFlightOffer(selectedOffer) &&
                selectedOffer.requiresInstantPayment
              }
              onPress={() => {
                if (selectedOffer) {
                  if ("originCode" in selectedOffer) {
                    void handleBookFlight(selectedOffer as FlightBookingOffer);
                  } else {
                    void handleBookHotel(selectedOffer as HotelBookingOffer);
                  }
                }
              }}
            >
              {isDuffelFlightOffer(selectedOffer) && selectedOffer.requiresInstantPayment
                ? "Instant provider payment required"
                : "Confirm Booking"}
            </Button>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContainer, { top: insets.top + 60 }]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                void loadTravelData(tokens?.accessToken ?? "");
              }}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text.primary} />
              <Text variant="body">Refresh</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setActiveTab("bookings");
              }}
            >
              <Ionicons name="list-outline" size={20} color={colors.text.primary} />
              <Text variant="body">View All Bookings</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <DatePickerSheet
        visible={showDatePicker !== null}
        title={
          showDatePicker === "depart"
            ? "Select departure date"
            : showDatePicker === "return"
            ? "Select return date"
            : showDatePicker === "checkIn"
            ? "Select check-in date"
            : showDatePicker === "checkOut"
            ? "Select check-out date"
            : "Select date of birth"
        }
        value={
          showDatePicker === "depart"
            ? departDate
            : showDatePicker === "return"
            ? returnDate
            : showDatePicker === "checkIn"
            ? checkIn
            : showDatePicker === "checkOut"
            ? checkOut
            : passengerBornOn
        }
        minimumDate={
          showDatePicker === "return"
            ? departDate || undefined
            : showDatePicker === "checkOut"
            ? checkIn || undefined
            : undefined
        }
        maximumDate={showDatePicker === "passengerBornOn" ? todayIsoDate : undefined}
        onClose={() => setShowDatePicker(null)}
        onConfirm={(nextValue) => {
          if (showDatePicker === "depart") {
            setDepartDate(nextValue);
            if (returnDate && returnDate < nextValue) {
              setReturnDate("");
            }
          } else if (showDatePicker === "return") {
            setReturnDate(nextValue);
          } else if (showDatePicker === "checkIn") {
            setCheckIn(nextValue);
            if (checkOut && checkOut <= nextValue) {
              setCheckOut("");
            }
          } else if (showDatePicker === "checkOut") {
            setCheckOut(nextValue);
          } else if (showDatePicker === "passengerBornOn") {
            setPassengerBornOn(nextValue);
          }
        }}
      />

      <LocationPickerSheet
        visible={showLocationPicker !== null}
        title={
          showLocationPicker === "origin"
            ? "Choose origin"
            : showLocationPicker === "destination"
            ? "Choose destination"
            : "Choose stay location"
        }
        scope={showLocationPicker === "hotelCity" ? "stay" : "flight"}
        accessToken={tokens?.accessToken}
        initialValue={
          showLocationPicker === "origin"
            ? origin
            : showLocationPicker === "destination"
            ? destination
            : hotelCity
        }
        onClose={() => setShowLocationPicker(null)}
        onSelect={(suggestion) => {
          if (!showLocationPicker) {
            return;
          }

          applyLocationSelection(showLocationPicker, suggestion);
        }}
        onSubmitText={(value) => {
          if (!showLocationPicker) {
            return;
          }

          applyTypedLocation(showLocationPicker, value);
        }}
      />

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable
          style={styles.datePickerOverlay}
          onPress={() => setShowFilters(false)}
        >
          <View style={[styles.datePickerContent, { paddingBottom: insets.bottom + spacing[4] }]}>
            <View style={styles.datePickerHeader}>
              <Text variant="h4">
                {activeTab === "flights" ? "Flight Filters" : "Hotel Filters"}
              </Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowFilters(false)}
                icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
              />
            </View>

            {activeTab === "flights" ? (
              <View style={styles.filterSection}>
                <Text variant="label" style={styles.filterLabel}>
                  Cabin Class
                </Text>
                <View style={styles.filterRow}>
                  <Pressable
                    style={[
                      styles.filterChip,
                      cabinClass === "economy" && styles.filterChipActive,
                    ]}
                    onPress={() => setCabinClass("economy")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={cabinClass === "economy" ? "semiBold" : "regular"}
                      style={
                        cabinClass === "economy"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Economy
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterChip,
                      cabinClass === "premium" && styles.filterChipActive,
                    ]}
                    onPress={() => setCabinClass("premium")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={cabinClass === "premium" ? "semiBold" : "regular"}
                      style={
                        cabinClass === "premium"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Premium
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterChip,
                      cabinClass === "business" && styles.filterChipActive,
                    ]}
                    onPress={() => setCabinClass("business")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={cabinClass === "business" ? "semiBold" : "regular"}
                      style={
                        cabinClass === "business"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Business
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.filterSection}>
                <Text variant="label" style={styles.filterLabel}>
                  Room Type
                </Text>
                <View style={styles.filterRow}>
                  <Pressable
                    style={[
                      styles.filterChip,
                      roomTier === "standard" && styles.filterChipActive,
                    ]}
                    onPress={() => setRoomTier("standard")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={roomTier === "standard" ? "semiBold" : "regular"}
                      style={
                        roomTier === "standard"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Standard
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterChip,
                      roomTier === "deluxe" && styles.filterChipActive,
                    ]}
                    onPress={() => setRoomTier("deluxe")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={roomTier === "deluxe" ? "semiBold" : "regular"}
                      style={
                        roomTier === "deluxe"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Deluxe
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.filterChip,
                      roomTier === "suite" && styles.filterChipActive,
                    ]}
                    onPress={() => setRoomTier("suite")}
                  >
                    <Text
                      variant="bodySmall"
                      weight={roomTier === "suite" ? "semiBold" : "regular"}
                      style={
                        roomTier === "suite"
                          ? styles.filterChipTextActive
                          : styles.filterChipText
                      }
                    >
                      Suite
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => setShowFilters(false)}
            >
              Apply Filters
            </Button>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  header: {
    backgroundColor: "#F5F5F7",
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontFamily: typography.fontFamily.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[6],
    gap: spacing[5],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.status.errorLight,
    borderRadius: borderRadius.lg,
  },
  errorText: {
    flex: 1,
    color: colors.status.error,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.status.successLight,
    borderRadius: borderRadius.lg,
  },
  successText: {
    flex: 1,
    color: colors.status.success,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[1],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2.5],
    alignItems: "center",
    borderRadius: borderRadius.lg,
  },
  tabActive: {
    backgroundColor: colors.grays.white,
  },
  tabText: {
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
  },
  searchForm: {
    gap: spacing[3],
  },
  originDestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.grays.white,
    borderRadius: 24,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  inputHalf: {
    flex: 1,
  },
  inputThird: {
    flex: 1,
  },
  pillInput: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pillInputSmall: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grays.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  dateText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  datePlaceholder: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  dateGuestRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  filterSection: {
    gap: spacing[2],
  },
  filterLabel: {
    color: colors.text.secondary,
    textTransform: "uppercase",
    fontSize: typography.fontSize.xs,
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  filterChip: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterChipActive: {
    backgroundColor: colors.brand.default,
    borderColor: colors.brand.default,
  },
  filterChipText: {
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.grays.white,
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[2],
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.grays.white,
    borderRadius: 24,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterButtonText: {
    color: colors.text.primary,
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.default,
  },
  searchButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 24,
    paddingVertical: spacing[4],
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  searchButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  searchButtonText: {
    color: colors.grays.white,
  },
  bookingsSection: {
    gap: spacing[4],
  },
  nextFlightCard: {
    backgroundColor: colors.grays.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  nextFlightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  nextFlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.light,
    alignItems: "center",
    justifyContent: "center",
  },
  nextFlightInfo: {
    flex: 1,
    gap: spacing[0.5],
  },
  nextFlightLabel: {
    color: colors.brand.default,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    marginTop: spacing[2],
  },
  loadingState: {
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[8],
  },
  emptyState: {
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[8],
  },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.grays.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  bookingContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    marginRight: spacing[2],
  },
  bookingInfo: {
    flex: 1,
    gap: spacing[1],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    padding: spacing[6],
    gap: spacing[3],
  },
  offerCard: {
    backgroundColor: colors.grays.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offerInfo: {
    flex: 1,
    gap: spacing[1],
  },
  offerPrice: {
    color: colors.brand.default,
  },
  bookingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  bookingModalScroll: {
    maxHeight: "90%",
  },
  bookingModalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  bookingModalContent: {
    backgroundColor: colors.grays.white,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    padding: spacing[6],
    gap: spacing[4],
  },
  providerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  providerBannerInfo: {
    backgroundColor: colors.brand.light,
    borderColor: colors.brand.default,
  },
  providerBannerWarning: {
    backgroundColor: colors.status.warningLight,
    borderColor: colors.status.warning,
  },
  providerBannerText: {
    flex: 1,
    color: colors.text.secondary,
  },
  providerOptionSection: {
    gap: spacing[2],
  },
  tripAttachSection: {
    gap: spacing[2],
  },
  tripAttachLabel: {
    color: colors.text.secondary,
  },
  tripAttachRow: {
    gap: spacing[2],
  },
  tripChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tripChipActive: {
    backgroundColor: colors.brand.default,
    borderColor: colors.brand.default,
  },
  tripChipText: {
    color: colors.text.secondary,
  },
  tripChipTextActive: {
    color: colors.grays.white,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "flex-end",
  },
  menuContainer: {
    position: "absolute",
    right: spacing[6],
    backgroundColor: colors.grays.white,
    borderRadius: borderRadius.xl,
    minWidth: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  datePickerContent: {
    backgroundColor: colors.grays.white,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    padding: spacing[6],
    gap: spacing[4],
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
