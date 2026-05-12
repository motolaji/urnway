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
import { useSession } from "@/providers/session-provider";
import { useBookingStore } from "@/lib/stores/booking-store";
import { useFlightSearchStore } from "@/lib/stores/flight-search-store";
import { useHotelSearchStore } from "@/lib/stores/hotel-search-store";

type SearchType = "flight" | "hotel";

type SortOption =
  | "price-asc"
  | "price-desc"
  | "duration-asc"
  | "departure-asc";

export default function SearchResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type: SearchType }>();
  const searchType = params.type || "flight";

  const { tokens } = useSession();
  const flightSearch = useFlightSearchStore();
  const hotelSearch = useHotelSearchStore();
  const { setSelectedOffer } = useBookingStore();

  const [offers, setOffers] = useState<
    (FlightBookingOffer | HotelBookingOffer)[]
  >([]);
  const [filteredOffers, setFilteredOffers] = useState<
    (FlightBookingOffer | HotelBookingOffer)[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCabinClass, setSelectedCabinClass] = useState<
    "economy" | "premium" | "business" | null
  >(null);
  const [selectedRoomTier, setSelectedRoomTier] = useState<
    "standard" | "deluxe" | "suite" | null
  >(null);

  // Sort state
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");

  // Fetch results on mount
  useEffect(() => {
    void fetchResults();
  }, []);

  // Apply filters and sorting when offers or filter/sort state changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [offers, selectedCabinClass, selectedRoomTier, sortBy]);

  const fetchResults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        setError("Authentication required. Please sign in.");
        return;
      }

      if (searchType === "flight") {
        // Log Zustand store state for debugging
        console.log("Flight search store state:", {
          flightType: flightSearch.flightType,
          origin: flightSearch.origin,
          destination: flightSearch.destination,
          departDate: flightSearch.departDate,
          returnDate: flightSearch.returnDate,
        });

        // Validate flight search params before making API call
        if (flightSearch.flightType === "multicity") {
          const hasInvalidSegment = flightSearch.multiCitySegments.some(
            (seg) => !seg.origin?.trim() || !seg.destination?.trim() || !seg.departDate?.trim()
          );
          if (hasInvalidSegment) {
            setError("Please fill in all flight segments. Missing origin, destination, or date.");
            setIsLoading(false);
            return;
          }
        } else {
          if (!flightSearch.origin?.trim() || !flightSearch.destination?.trim() || !flightSearch.departDate?.trim()) {
            setError("Please fill in all required fields. Missing origin, destination, or departure date.");
            setIsLoading(false);
            return;
          }
          if (flightSearch.flightType === "roundtrip" && !flightSearch.returnDate?.trim()) {
            setError("Please select a return date for round-trip flights.");
            setIsLoading(false);
            return;
          }
        }
      } else {
        // Validate hotel search params
        if (!hotelSearch.city.trim() || !hotelSearch.checkIn.trim() || !hotelSearch.checkOut.trim()) {
          setError("Please fill in all required fields for hotel search.");
          setIsLoading(false);
          return;
        }
      }

      if (searchType === "flight") {
        // Build flight search params based on flight type
        if (flightSearch.flightType === "multicity") {
          // Multi-city search
          const searchParams = {
            type: "multi-city" as const,
            segments: flightSearch.multiCitySegments.map((seg) => ({
              origin: seg.originSearchValue || seg.origin,
              destination: seg.destinationSearchValue || seg.destination,
              departDate: seg.departDate,
            })),
            cabinClass: flightSearch.cabinClass,
          };
          console.log("Multi-city search params:", searchParams);
          const response = await searchFlightBookingOffers(searchParams, accessToken);
          const results = (response as any)?.offers || response;
          console.log("API returned results:", Array.isArray(results), "count:", results?.length);
          setOffers(results);
        } else if (flightSearch.flightType === "oneway") {
          // One-way search
          const searchParams = {
            type: "one-way" as const,
            origin: flightSearch.originSearchValue || flightSearch.origin,
            destination: flightSearch.destinationSearchValue || flightSearch.destination,
            departDate: flightSearch.departDate,
            cabinClass: flightSearch.cabinClass,
          };
          console.log("One-way search params:", JSON.stringify(searchParams, null, 2));
          const response = await searchFlightBookingOffers(searchParams, accessToken);
          const results = (response as any)?.offers || response;
          console.log("API returned results:", Array.isArray(results), "count:", results?.length);
          setOffers(results);
        } else {
          // Round-trip search
          const searchParams = {
            type: "return" as const,
            origin: flightSearch.originSearchValue || flightSearch.origin,
            destination: flightSearch.destinationSearchValue || flightSearch.destination,
            departDate: flightSearch.departDate,
            returnDate: flightSearch.returnDate,
            cabinClass: flightSearch.cabinClass,
          };
          console.log("Round-trip search params:", JSON.stringify(searchParams, null, 2));
          const response = await searchFlightBookingOffers(searchParams, accessToken);
          const results = (response as any)?.offers || response;
          console.log("API returned results:", Array.isArray(results), "count:", results?.length);
          setOffers(results);
        }
      } else {
        // Hotel search
        const response = await searchHotelBookingOffers(
          {
            city: hotelSearch.citySearchValue || hotelSearch.city,
            checkIn: hotelSearch.checkIn,
            checkOut: hotelSearch.checkOut,
            rooms: parseInt(hotelSearch.rooms, 10),
            roomTier: hotelSearch.roomTier,
          },
          accessToken
        );
        const results = (response as any)?.offers || response;
        console.log("Hotel API returned results:", Array.isArray(results), "count:", results?.length);
        setOffers(results);
      }
    } catch (err) {
      console.error("Search error:", err);
      if (err instanceof ApiError) {
        console.error("API Error details:", err.details);
        // Extract detailed validation errors if available
        const details = err.details as any;
        if (details?.fieldErrors) {
          const fieldErrors = Object.entries(details.fieldErrors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(", ")}`)
            .join("; ");
          setError(`Validation failed: ${fieldErrors}`);
        } else if (details?.formErrors) {
          setError(`Validation failed: ${details.formErrors.join("; ")}`);
        } else {
          setError(err.message || "Search failed. Please try again.");
        }
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load search results. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const applyFiltersAndSort = () => {
    // Ensure offers is an array
    if (!Array.isArray(offers)) {
      console.error("Offers is not an array:", offers);
      setFilteredOffers([]);
      return;
    }

    let filtered = [...offers];

    // Apply filters
    if (searchType === "flight" && selectedCabinClass) {
      filtered = filtered.filter(
        (offer) =>
          "cabinClass" in offer && offer.cabinClass === selectedCabinClass
      );
    }

    if (searchType === "hotel" && selectedRoomTier) {
      filtered = filtered.filter(
        (offer) => "roomTier" in offer && offer.roomTier === selectedRoomTier
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aAmount = parseFloat(a.totalAmount);
      const bAmount = parseFloat(b.totalAmount);

      switch (sortBy) {
        case "price-asc":
          return aAmount - bAmount;
        case "price-desc":
          return bAmount - aAmount;
        case "duration-asc":
          if ("totalDuration" in a && "totalDuration" in b) {
            return (a.totalDuration || 0) - (b.totalDuration || 0);
          }
          return 0;
        case "departure-asc":
          if ("departureAt" in a && "departureAt" in b) {
            return (
              new Date(a.departureAt).getTime() -
              new Date(b.departureAt).getTime()
            );
          }
          return 0;
        default:
          return 0;
      }
    });

    setFilteredOffers(filtered);
  };

  const handleSelectOffer = (offer: FlightBookingOffer | HotelBookingOffer) => {
    setSelectedOffer(offer);
    router.push("/trips/booking-details");
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchResults();
  };

  const clearFilters = () => {
    setSelectedCabinClass(null);
    setSelectedRoomTier(null);
  };

  const renderOfferCard = ({
    item,
  }: {
    item: FlightBookingOffer | HotelBookingOffer;
  }) => {
    if ("originCode" in item) {
      // Flight offer
      // Extract airline code from flight number (e.g., "AA123" -> "AA")
      const airlineCode = item.flightNumber?.match(/^[A-Z]{2}/)?.[0] || "XX";
      const airlineLogoUrl = `https://images.kiwi.com/airlines/64/${airlineCode}.png`;

      return (
        <Pressable
          style={styles.offerCard}
          onPress={() => handleSelectOffer(item)}
        >
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
                {item.carrierName || "Airline"} · {item.flightNumber || ""}
              </Text>
            </View>
            <View style={styles.priceInfo}>
              <Text variant="h5" weight="bold">
                ${item.totalAmount}
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
            {item.duration && (
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
            )}
            <View style={styles.detailRow}>
              <Ionicons
                name="airplane-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary">
                {item.cabinClass}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    } else {
      // Hotel offer
      return (
        <Pressable
          style={styles.offerCard}
          onPress={() => handleSelectOffer(item)}
        >
          <View style={styles.offerHeader}>
            <View style={styles.routeInfo}>
              <Text variant="body" weight="semiBold">
                {item.hotelName}
              </Text>
              <Text variant="caption" color="secondary">
                {item.city}
              </Text>
            </View>
            <View style={styles.priceInfo}>
              <Text variant="h5" weight="bold">
                ${item.totalAmount}
              </Text>
              <Text variant="caption" color="secondary">
                {item.totalCurrency}
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
                {item.roomTier} · {item.rooms} room(s)
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary">
                {new Date(item.checkIn).toLocaleDateString()} -{" "}
                {new Date(item.checkOut).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }
  };

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
            icon={
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.text.primary}
              />
            }
          />
          <Text variant="h4">Search Results</Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            variant="ghost"
            size="sm"
            onPress={() => setShowFilters(true)}
            icon={
              <Ionicons name="filter" size={20} color={colors.text.primary} />
            }
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
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            Searching for {searchType === "flight" ? "flights" : "hotels"}...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.status.error}
          />
          <Text variant="body" color="secondary" align="center" style={{ marginTop: spacing[3] }}>
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
          <Text variant="body" color="secondary" align="center" style={{ marginTop: spacing[3] }}>
            No results found. Try adjusting your filters.
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
          keyExtractor={(item) => ("offerId" in item ? item.offerId : item.id)}
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

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing[4] },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text variant="h4">Filters</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowFilters(false)}
                icon={
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.text.primary}
                  />
                }
              />
            </View>

            {searchType === "flight" ? (
              <View style={styles.filterSection}>
                <Text variant="label">Cabin Class</Text>
                <View style={styles.filterOptions}>
                  {(["economy", "premium", "business"] as const).map((cabin) => (
                    <Pressable
                      key={cabin}
                      style={[
                        styles.filterOption,
                        selectedCabinClass === cabin &&
                          styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setSelectedCabinClass(
                          selectedCabinClass === cabin ? null : cabin
                        )
                      }
                    >
                      <Text
                        variant="body"
                        weight={
                          selectedCabinClass === cabin ? "semiBold" : "regular"
                        }
                      >
                        {cabin.charAt(0).toUpperCase() + cabin.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.filterSection}>
                <Text variant="label">Room Type</Text>
                <View style={styles.filterOptions}>
                  {(["standard", "deluxe", "suite"] as const).map((tier) => (
                    <Pressable
                      key={tier}
                      style={[
                        styles.filterOption,
                        selectedRoomTier === tier && styles.filterOptionActive,
                      ]}
                      onPress={() =>
                        setSelectedRoomTier(
                          selectedRoomTier === tier ? null : tier
                        )
                      }
                    >
                      <Text
                        variant="body"
                        weight={selectedRoomTier === tier ? "semiBold" : "regular"}
                      >
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.modalFooter}>
              <Button
                variant="ghost"
                onPress={clearFilters}
                style={styles.modalButton}
              >
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

      {/* Sort Modal */}
      <Modal
        visible={showSort}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSort(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSort(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + spacing[4] },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text variant="h4">Sort By</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowSort(false)}
                icon={
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.text.primary}
                  />
                }
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
                  {sortBy === option.value && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.brand.default}
                    />
                  )}
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
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
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
  listContent: {
    padding: spacing[5],
    gap: spacing[3],
  },
  offerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    gap: spacing[1],
  },
  priceInfo: {
    alignItems: "flex-end",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    padding: spacing[6],
    gap: spacing[4],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterSection: {
    gap: spacing[3],
  },
  filterOptions: {
    gap: spacing[2],
  },
  filterOption: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  filterOptionActive: {
    borderColor: colors.brand.default,
    backgroundColor: colors.brand.subtle,
  },
  modalFooter: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[2],
  },
  modalButton: {
    flex: 1,
  },
  sortOptions: {
    gap: spacing[2],
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sortOptionActive: {
    borderColor: colors.brand.default,
    backgroundColor: colors.brand.subtle,
  },
});
