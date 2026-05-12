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
import { useFlightSearchStore } from "@/lib/stores/flight-search-store";
import { useHotelSearchStore } from "@/lib/stores/hotel-search-store";
import { useBookingStore } from "@/lib/stores/booking-store";

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

  // Zustand stores
  const flightSearch = useFlightSearchStore();
  const hotelSearch = useHotelSearchStore();
  const bookingStore = useBookingStore();

  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "bookings">("flights");
  const [bookingsState, setBookingsState] = useState<BookingsState>({
    summary: null,
    bookings: [],
  });
  const [nextBoardingPass, setNextBoardingPass] = useState<BoardingPass | null>(null);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);

  // Destructure flight store values
  const {
    flightType,
    origin,
    originSearchValue,
    destination,
    destinationSearchValue,
    departDate,
    returnDate,
    cabinClass,
    multiCitySegments,
    setFlightType,
    setOrigin,
    setDestination,
    setDepartDate,
    setReturnDate,
    setCabinClass,
    swapLocations,
    addMultiCitySegment,
    removeMultiCitySegment,
    updateMultiCitySegment,
  } = flightSearch;

  // Destructure hotel store values
  const {
    city: hotelCity,
    citySearchValue: hotelCitySearchValue,
    checkIn,
    checkOut,
    rooms,
    roomTier,
    setCity: setHotelCity,
    setCheckIn,
    setCheckOut,
    setRooms,
    setRoomTier,
  } = hotelSearch;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<
    | "depart"
    | "return"
    | "checkIn"
    | "checkOut"
    | { type: "multicity"; index: number }
    | null
  >(null);
  const [showLocationPicker, setShowLocationPicker] = useState<
    | "origin"
    | "destination"
    | "hotelCity"
    | { type: "multicity"; index: number; field: "origin" | "destination" }
    | null
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

  function applyLocationSelection(
    field: "origin" | "destination" | "hotelCity" | { type: "multicity"; index: number; field: "origin" | "destination" },
    suggestion: LocationSuggestion
  ) {
    if (typeof field === "object" && field.type === "multicity") {
      // Multi-city segment location
      updateMultiCitySegment(field.index, {
        [field.field]: suggestion.label,
        [`${field.field}SearchValue`]: suggestion.searchValue,
      });
      return;
    }

    if (field === "origin") {
      setOrigin(suggestion.label, suggestion.searchValue);
      return;
    }

    if (field === "destination") {
      setDestination(suggestion.label, suggestion.searchValue);
      return;
    }

    setHotelCity(suggestion.label, suggestion.searchValue);
  }

  function applyTypedLocation(
    field: "origin" | "destination" | "hotelCity" | { type: "multicity"; index: number; field: "origin" | "destination" },
    value: string
  ) {
    if (typeof field === "object" && field.type === "multicity") {
      // Multi-city segment location
      updateMultiCitySegment(field.index, {
        [field.field]: value,
        [`${field.field}SearchValue`]: null,
      });
      return;
    }

    if (field === "origin") {
      setOrigin(value, null);
      return;
    }

    if (field === "destination") {
      setDestination(value, null);
      return;
    }

    setHotelCity(value, null);
  }

  function openDatePicker(
    target: "depart" | "return" | "checkIn" | "checkOut"
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
        : checkOut;

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

  function handleSearchFlights() {
    if (isSearching) return;

    // Validation
    if (flightType === "multicity") {
      const hasInvalidSegment = multiCitySegments.some(
        (seg) => !seg.origin.trim() || !seg.destination.trim() || !seg.departDate.trim()
      );
      if (hasInvalidSegment) {
        setErrorMessage("Please fill in all flight segments");
        return;
      }
    } else {
      if (!origin.trim() || !destination.trim() || !departDate.trim()) {
        setErrorMessage("Please fill in all required fields");
        return;
      }
      if (flightType === "roundtrip" && !returnDate.trim()) {
        setErrorMessage("Please select a return date");
        return;
      }
    }

    clearError();
    setErrorMessage(null);

    // Navigate to search results screen
    router.push("/trips/search-results?type=flight" as Href);
  }

  function handleSearchHotels() {
    if (isSearching) return;

    if (!hotelCity.trim() || !checkIn.trim() || !checkOut.trim()) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    clearError();
    setErrorMessage(null);

    // Navigate to search results screen
    router.push("/trips/search-results?type=hotel" as Href);
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
            {/* Flight Type Selector */}
            <View style={styles.flightTypeTabs}>
              <Pressable
                style={[styles.flightTypeTab, flightType === "roundtrip" && styles.flightTypeTabActive]}
                onPress={() => setFlightType("roundtrip")}
              >
                <Text
                  variant="bodySmall"
                  weight={flightType === "roundtrip" ? "semiBold" : "regular"}
                >
                  Round-trip
                </Text>
              </Pressable>
              <Pressable
                style={[styles.flightTypeTab, flightType === "oneway" && styles.flightTypeTabActive]}
                onPress={() => setFlightType("oneway")}
              >
                <Text
                  variant="bodySmall"
                  weight={flightType === "oneway" ? "semiBold" : "regular"}
                >
                  One-way
                </Text>
              </Pressable>
              <Pressable
                style={[styles.flightTypeTab, flightType === "multicity" && styles.flightTypeTabActive]}
                onPress={() => setFlightType("multicity")}
              >
                <Text
                  variant="bodySmall"
                  weight={flightType === "multicity" ? "semiBold" : "regular"}
                >
                  Multi-city
                </Text>
              </Pressable>
            </View>

            {/* Round-trip / One-way Form */}
            {(flightType === "roundtrip" || flightType === "oneway") && (
              <>
                {/* Vertical Origin/Destination Layout */}
                <View style={styles.originDestStack}>
                  <Pressable
                    style={styles.inputPill}
                    onPress={() => setShowLocationPicker("origin")}
                  >
                    <Ionicons name="airplane-outline" size={20} color={colors.text.tertiary} />
                    <Text
                      variant="body"
                      style={origin ? styles.dateText : styles.datePlaceholder}
                      numberOfLines={1}
                      pointerEvents="none"
                    >
                      {origin || "Origin"}
                    </Text>
                  </Pressable>

                  <Pressable style={styles.swapButtonCentered} onPress={swapLocations}>
                    <Ionicons name="swap-vertical" size={24} color={colors.text.secondary} />
                  </Pressable>

                  <Pressable
                    style={styles.inputPill}
                    onPress={() => setShowLocationPicker("destination")}
                  >
                    <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
                    <Text
                      variant="body"
                      style={destination ? styles.dateText : styles.datePlaceholder}
                      numberOfLines={1}
                      pointerEvents="none"
                    >
                      {destination || "Destination"}
                    </Text>
                  </Pressable>
                </View>

                {/* Dates */}
                <View style={styles.dateRow}>
                  <Pressable
                    style={[styles.inputPill, styles.inputHalf]}
                    onPress={() => openDatePicker("depart")}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                    <Text
                      variant="body"
                      style={departDate ? styles.dateText : styles.datePlaceholder}
                      pointerEvents="none"
                    >
                      {formatDateFieldValue(departDate) || "Depart"}
                    </Text>
                  </Pressable>
                  {flightType === "roundtrip" && (
                    <Pressable
                      style={[styles.inputPill, styles.inputHalf]}
                      onPress={() => openDatePicker("return")}
                    >
                      <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                      <Text
                        variant="body"
                        style={returnDate ? styles.dateText : styles.datePlaceholder}
                        pointerEvents="none"
                      >
                        {formatDateFieldValue(returnDate) || "Return"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {/* Multi-city Form */}
            {flightType === "multicity" && (
              <View style={styles.multiCityContainer}>
                {multiCitySegments.map((segment, index) => (
                  <View key={index} style={styles.multiCitySegment}>
                    <View style={styles.multiCityHeader}>
                      <Text variant="label">Flight {index + 1}</Text>
                      {index > 1 && (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<Ionicons name="close" size={20} color={colors.text.secondary} />}
                          onPress={() => removeMultiCitySegment(index)}
                        />
                      )}
                    </View>

                    <Pressable
                      style={styles.inputPill}
                      onPress={() =>
                        setShowLocationPicker({ type: "multicity", index, field: "origin" })
                      }
                    >
                      <Ionicons name="airplane-outline" size={20} color={colors.text.tertiary} />
                      <Text
                        variant="body"
                        style={segment.origin ? styles.dateText : styles.datePlaceholder}
                        numberOfLines={1}
                        pointerEvents="none"
                      >
                        {segment.origin || "Origin"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.inputPill}
                      onPress={() =>
                        setShowLocationPicker({ type: "multicity", index, field: "destination" })
                      }
                    >
                      <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
                      <Text
                        variant="body"
                        style={segment.destination ? styles.dateText : styles.datePlaceholder}
                        numberOfLines={1}
                        pointerEvents="none"
                      >
                        {segment.destination || "Destination"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.inputPill}
                      onPress={() => setShowDatePicker({ type: "multicity", index })}
                    >
                      <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
                      <Text
                        variant="body"
                        style={segment.departDate ? styles.dateText : styles.datePlaceholder}
                        pointerEvents="none"
                      >
                        {formatDateFieldValue(segment.departDate) || "Depart"}
                      </Text>
                    </Pressable>
                  </View>
                ))}

                {multiCitySegments.length < 5 && (
                  <Button
                    variant="ghost"
                    onPress={addMultiCitySegment}
                    style={{ marginTop: spacing[2] }}
                  >
                    + Add Flight
                  </Button>
                )}
              </View>
            )}

            {/* Search Button */}
            <Pressable
              style={styles.searchButton}
              onPress={() => void handleSearchFlights()}
            >
              <Text variant="body" weight="semiBold" style={styles.searchButtonText}>
                Search Flights
              </Text>
            </Pressable>
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
                pointerEvents="none"
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
                  pointerEvents="none"
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
                  pointerEvents="none"
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
          typeof showDatePicker === "object" && showDatePicker?.type === "multicity"
            ? `Select departure date for Flight ${showDatePicker.index + 1}`
            : showDatePicker === "depart"
            ? "Select departure date"
            : showDatePicker === "return"
            ? "Select return date"
            : showDatePicker === "checkIn"
            ? "Select check-in date"
            : "Select check-out date"
        }
        value={
          typeof showDatePicker === "object" && showDatePicker?.type === "multicity"
            ? multiCitySegments[showDatePicker.index]?.departDate || ""
            : showDatePicker === "depart"
            ? departDate
            : showDatePicker === "return"
            ? returnDate
            : showDatePicker === "checkIn"
            ? checkIn
            : checkOut
        }
        minimumDate={
          showDatePicker === "return"
            ? departDate || undefined
            : showDatePicker === "checkOut"
            ? checkIn || undefined
            : undefined
        }
        onClose={() => setShowDatePicker(null)}
        onConfirm={(nextValue) => {
          if (typeof showDatePicker === "object" && showDatePicker?.type === "multicity") {
            updateMultiCitySegment(showDatePicker.index, { departDate: nextValue });
          } else if (showDatePicker === "depart") {
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
          }
        }}
      />

      <LocationPickerSheet
        visible={showLocationPicker !== null}
        title={
          typeof showLocationPicker === "object" && showLocationPicker?.type === "multicity"
            ? `Choose ${showLocationPicker.field} for Flight ${showLocationPicker.index + 1}`
            : showLocationPicker === "origin"
            ? "Choose origin"
            : showLocationPicker === "destination"
            ? "Choose destination"
            : "Choose stay location"
        }
        scope={showLocationPicker === "hotelCity" ? "stay" : "flight"}
        accessToken={tokens?.accessToken}
        initialValue={
          typeof showLocationPicker === "object" && showLocationPicker?.type === "multicity"
            ? (multiCitySegments[showLocationPicker.index]?.[showLocationPicker.field] || "")
            : showLocationPicker === "origin"
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
  flightTypeTabs: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    padding: spacing[1],
  },
  flightTypeTab: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    alignItems: "center",
  },
  flightTypeTabActive: {
    backgroundColor: colors.grays.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  originDestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  originDestStack: {
    position: "relative",
    gap: spacing[2],
  },
  swapButtonCentered: {
    position: "absolute",
    alignSelf: "center",
    top: 56,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grays.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  multiCityContainer: {
    gap: spacing[3],
  },
  multiCitySegment: {
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
  },
  multiCityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[1],
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
