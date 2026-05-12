import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, Text } from "@/components/ui";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "@/constants/design-tokens";
import {
  ApiError,
  searchFlightBookingOffers,
  searchHotelBookingOffers,
  type FlightBookingOffer,
  type HotelBookingOffer,
} from "@/lib/session";
import { useBookingStore } from "@/lib/stores/booking-store";
import { useFlightSearchStore } from "@/lib/stores/flight-search-store";
import { useHotelSearchStore } from "@/lib/stores/hotel-search-store";
import { useSession } from "@/providers/session-provider";

type SearchType = "flight" | "hotel";
type SortOption =
  | "price-asc"
  | "price-desc"
  | "duration-asc"
  | "departure-asc";

function parseDurationToMinutes(duration: string) {
  const hours = Number(duration.match(/(\d+)\s*h/i)?.[1] ?? "0");
  const minutes = Number(duration.match(/(\d+)\s*m/i)?.[1] ?? "0");
  return hours * 60 + minutes;
}

function formatMoney(amount: string, currency: string) {
  return `${amount} ${currency}`;
}

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: SearchType }>();
  const searchType: SearchType = params.type === "hotel" ? "hotel" : "flight";

  const { tokens } = useSession();
  const flightSearch = useFlightSearchStore();
  const hotelSearch = useHotelSearchStore();
  const { setSelectedOffer } = useBookingStore();

  const [offers, setOffers] = useState<Array<FlightBookingOffer | HotelBookingOffer>>(
    []
  );
  const [filteredOffers, setFilteredOffers] = useState<
    Array<FlightBookingOffer | HotelBookingOffer>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [selectedCabinClass, setSelectedCabinClass] = useState<
    "economy" | "premium" | "business" | null
  >(null);
  const [selectedRoomTier, setSelectedRoomTier] = useState<
    "standard" | "deluxe" | "suite" | null
  >(null);
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");

  useEffect(() => {
    void fetchResults();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [offers, selectedCabinClass, selectedRoomTier, sortBy, searchType]);

  async function fetchResults() {
    const accessToken = tokens?.accessToken;

    if (!accessToken) {
      setIsLoading(false);
      setRefreshing(false);
      setError("Authentication required. Please sign in.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (searchType === "flight") {
        if (flightSearch.flightType === "multicity") {
          setOffers([]);
          setError(
            "Multi-city provider-backed search is not available yet. Use one-way or round-trip."
          );
          return;
        }

        const origin = flightSearch.originSearchValue || flightSearch.origin;
        const destination =
          flightSearch.destinationSearchValue || flightSearch.destination;

        if (!origin.trim() || !destination.trim() || !flightSearch.departDate.trim()) {
          setOffers([]);
          setError("Missing origin, destination, or departure date.");
          return;
        }

        if (
          flightSearch.flightType === "roundtrip" &&
          !flightSearch.returnDate.trim()
        ) {
          setOffers([]);
          setError("Round-trip search needs a return date.");
          return;
        }

        const response = await searchFlightBookingOffers(
          {
            origin,
            destination,
            departDate: flightSearch.departDate,
            returnDate:
              flightSearch.flightType === "roundtrip"
                ? flightSearch.returnDate
                : undefined,
            cabinClass: flightSearch.cabinClass,
          },
          accessToken
        );

        setOffers(response.offers);
        return;
      }

      const city = hotelSearch.citySearchValue || hotelSearch.city;

      if (!city.trim() || !hotelSearch.checkIn.trim() || !hotelSearch.checkOut.trim()) {
        setOffers([]);
        setError("Missing city, check-in, or check-out date.");
        return;
      }

      const response = await searchHotelBookingOffers(
        {
          city,
          checkInDate: hotelSearch.checkIn,
          checkOutDate: hotelSearch.checkOut,
          roomCount: Number.parseInt(hotelSearch.rooms, 10) || 1,
          roomTier: hotelSearch.roomTier,
        },
        accessToken
      );

      setOffers(response.offers);
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load search results."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  function applyFiltersAndSort() {
    const nextOffers = [...offers];

    const filtered = nextOffers.filter((offer) => {
      if (searchType === "flight" && selectedCabinClass) {
        return "cabinClass" in offer && offer.cabinClass === selectedCabinClass;
      }

      if (searchType === "hotel" && selectedRoomTier) {
        return "roomTier" in offer && offer.roomTier === selectedRoomTier;
      }

      return true;
    });

    filtered.sort((left, right) => {
      if (sortBy === "price-asc") {
        return Number(left.totalAmount) - Number(right.totalAmount);
      }

      if (sortBy === "price-desc") {
        return Number(right.totalAmount) - Number(left.totalAmount);
      }

      if (sortBy === "duration-asc") {
        if ("duration" in left && "duration" in right) {
          return parseDurationToMinutes(left.duration) - parseDurationToMinutes(right.duration);
        }

        return 0;
      }

      if ("departDate" in left && "departDate" in right) {
        return (
          new Date(left.departDate).getTime() - new Date(right.departDate).getTime()
        );
      }

      return 0;
    });

    setFilteredOffers(filtered);
  }

  function clearFilters() {
    setSelectedCabinClass(null);
    setSelectedRoomTier(null);
  }

  function handleRefresh() {
    setRefreshing(true);
    void fetchResults();
  }

  function handleSelectOffer(offer: FlightBookingOffer | HotelBookingOffer) {
    setSelectedOffer(offer);
    router.push("/trips/booking-details");
  }

  function renderOfferCard({
    item,
  }: {
    item: FlightBookingOffer | HotelBookingOffer;
  }) {
    if ("originCode" in item) {
      const airlineCode = item.flightNumber.match(/^[A-Z]{2}/)?.[0] || "XX";
      const airlineLogoUrl = `https://images.kiwi.com/airlines/64/${airlineCode}.png`;

      return (
        <Pressable style={styles.offerCard} onPress={() => handleSelectOffer(item)}>
          <View style={styles.offerHeader}>
            <Image
              source={{ uri: airlineLogoUrl }}
              style={styles.airlineLogo}
              resizeMode="contain"
            />
            <View style={styles.routeInfo}>
              <Text variant="body" weight="semiBold">
                {item.originCode} → {item.destinationCode}
              </Text>
              <Text variant="caption" color="secondary">
                {item.carrierName} · {item.flightNumber}
              </Text>
            </View>
            <View style={styles.priceInfo}>
              <Text variant="h4" weight="bold">
                {item.totalAmount}
              </Text>
              <Text variant="caption" color="secondary">
                {item.currency}
              </Text>
            </View>
          </View>

          <View style={styles.offerDetails}>
            <View style={styles.detailRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary">
                {new Date(item.departDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons
                name="time-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary">
                {item.duration}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons
                name="airplane-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary">
                {item.cabinClass} · {item.travelerCount} traveller
                {item.travelerCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable style={styles.offerCard} onPress={() => handleSelectOffer(item)}>
        <View style={styles.offerHeader}>
          <View style={styles.routeInfo}>
            <Text variant="body" weight="semiBold">
              {item.hotelName}
            </Text>
            <Text variant="caption" color="secondary">
              {item.cityLabel}
            </Text>
          </View>
          <View style={styles.priceInfo}>
            <Text variant="h4" weight="bold">
              {item.totalAmount}
            </Text>
            <Text variant="caption" color="secondary">
              {item.currency}
            </Text>
          </View>
        </View>

        <View style={styles.offerDetails}>
          <View style={styles.detailRow}>
            <Ionicons
              name="bed-outline"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              {item.roomTier} · {item.roomCount} room{item.roomCount === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              {new Date(item.checkInDate).toLocaleDateString()} -{" "}
              {new Date(item.checkOutDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons
              name="business-outline"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              {item.providerName}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing[4], paddingBottom: spacing[4] },
        ]}
      >
        <View style={styles.headerLeft}>
          <IconButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            icon={<Ionicons name="arrow-back" size={24} color={colors.text.primary} />}
          />
          <Text variant="h4">Search Results</Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            variant="ghost"
            size="sm"
            onPress={() => setShowFilters(true)}
            icon={<Ionicons name="filter" size={20} color={colors.text.primary} />}
          />
          <IconButton
            variant="ghost"
            size="sm"
            onPress={() => setShowSort(true)}
            icon={
              <Ionicons
                name="swap-vertical"
                size={20}
                color={colors.text.primary}
              />
            }
          />
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.brand.default} />
          <Text variant="body" color="secondary" style={styles.messageText}>
            Searching for {searchType === "flight" ? "flights" : "stays"}...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.status.error}
          />
          <Text
            variant="body"
            color="secondary"
            align="center"
            style={styles.messageText}
          >
            {error}
          </Text>
          <Button
            variant="primary"
            onPress={() => void fetchResults()}
            style={{ marginTop: spacing[4] }}
          >
            Try Again
          </Button>
        </View>
      ) : filteredOffers.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons
            name="search-outline"
            size={48}
            color={colors.text.tertiary}
          />
          <Text
            variant="body"
            color="secondary"
            align="center"
            style={styles.messageText}
          >
            No results found. Try adjusting the filters or search again.
          </Text>
          {(selectedCabinClass || selectedRoomTier) && (
            <Button
              variant="ghost"
              onPress={clearFilters}
              style={{ marginTop: spacing[3] }}
            >
              Clear Filters
            </Button>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredOffers}
          renderItem={renderOfferCard}
          keyExtractor={(item) => item.offerId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.default}
            />
          }
        />
      )}

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing[4] },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text variant="h4">Filters</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowFilters(false)}
                icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
              />
            </View>

            {searchType === "flight" ? (
              <View style={styles.filterSection}>
                <Text variant="label">Cabin Class</Text>
                <View style={styles.filterOptions}>
                  {(["economy", "premium", "business"] as const).map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.filterOption,
                        selectedCabinClass === option && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setSelectedCabinClass(
                          selectedCabinClass === option ? null : option
                        )
                      }
                    >
                      <Text
                        variant="body"
                        weight={selectedCabinClass === option ? "semiBold" : "regular"}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.filterSection}>
                <Text variant="label">Room Type</Text>
                <View style={styles.filterOptions}>
                  {(["standard", "deluxe", "suite"] as const).map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.filterOption,
                        selectedRoomTier === option && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setSelectedRoomTier(selectedRoomTier === option ? null : option)
                      }
                    >
                      <Text
                        variant="body"
                        weight={selectedRoomTier === option ? "semiBold" : "regular"}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.modalFooter}>
              <Button variant="ghost" onPress={clearFilters} style={styles.modalButton}>
                Clear
              </Button>
              <Button
                variant="primary"
                onPress={() => setShowFilters(false)}
                style={styles.modalButton}
              >
                Apply
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showSort}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSort(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSort(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing[4] },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text variant="h4">Sort By</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowSort(false)}
                icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
              />
            </View>

            <View style={styles.sortOptions}>
              {[
                { value: "price-asc", label: "Price (Low to High)" },
                { value: "price-desc", label: "Price (High to Low)" },
                ...(searchType === "flight"
                  ? [
                      { value: "duration-asc", label: "Duration (Shortest)" },
                      { value: "departure-asc", label: "Departure (Earliest)" },
                    ]
                  : []),
              ].map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.sortOption,
                    sortBy === option.value && styles.sortOptionActive,
                  ]}
                  onPress={() => {
                    setSortBy(option.value as SortOption);
                    setShowSort(false);
                  }}
                >
                  <Text
                    variant="body"
                    weight={sortBy === option.value ? "semiBold" : "regular"}
                  >
                    {option.label}
                  </Text>
                  {sortBy === option.value ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.brand.default}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
  },
  messageText: {
    marginTop: spacing[3],
  },
  listContent: {
    padding: spacing[5],
    gap: spacing[3],
  },
  offerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[3],
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  airlineLogo: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  routeInfo: {
    flex: 1,
    gap: spacing[0.5],
  },
  priceInfo: {
    alignItems: "flex-end",
    gap: spacing[0.5],
  },
  offerDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.background.overlay,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[4],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSection: {
    gap: spacing[3],
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  filterOption: {
    minWidth: 112,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  filterOptionActive: {
    borderColor: colors.brand.default,
    backgroundColor: colors.brand.light,
  },
  modalFooter: {
    flexDirection: "row",
    gap: spacing[3],
  },
  modalButton: {
    flex: 1,
  },
  sortOptions: {
    gap: spacing[2],
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.secondary,
  },
  sortOptionActive: {
    backgroundColor: colors.brand.light,
  },
});
