import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DatePickerSheet from "@/components/date-picker-sheet";
import { Button, IconButton, Input, Screen, Text } from "@/components/ui";
import {
  borderRadius,
  colors,
  spacing,
} from "@/constants/design-tokens";
import {
  createFlightBooking,
  createHotelBooking,
  type Trip,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";
import { useBookingStore } from "@/lib/stores/booking-store";

export default function BookingDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { tokens } = useSession();

  const {
    selectedOffer,
    passengerName,
    passengerBornOn,
    passengerEmail,
    passengerPhoneNumber,
    passengerTitle,
    passengerGender,
    bookingNote,
    selectedTripId,
    setPassengerName,
    setPassengerBornOn,
    setPassengerEmail,
    setPassengerPhoneNumber,
    setPassengerTitle,
    setPassengerGender,
    setBookingNote,
    setSelectedTripId,
    reset,
  } = useBookingStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);

  if (!selectedOffer) {
    return (
      <Screen preset="fixed">
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.status.error}
          />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            No offer selected. Please go back and select an offer.
          </Text>
          <Button
            variant="primary"
            onPress={() => router.back()}
            style={{ marginTop: spacing[4] }}
          >
            Go Back
          </Button>
        </View>
      </Screen>
    );
  }

  const isFlightOffer = "originCode" in selectedOffer;

  const handleSubmit = async () => {
    // Validation
    if (!passengerName.trim()) {
      Alert.alert("Validation Error", "Please enter passenger name");
      return;
    }

    if (!passengerBornOn) {
      Alert.alert("Validation Error", "Please select date of birth");
      return;
    }

    if (!passengerEmail.trim()) {
      Alert.alert("Validation Error", "Please enter email address");
      return;
    }

    if (!passengerPhoneNumber.trim()) {
      Alert.alert("Validation Error", "Please enter phone number");
      return;
    }

    try {
      setIsSubmitting(true);

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        Alert.alert("Error", "Authentication required. Please sign in.");
        return;
      }

      let bookingId: string;

      if (isFlightOffer) {
        // Create flight booking
        const booking = await createFlightBooking(
          {
            offerId: "offerId" in selectedOffer ? selectedOffer.offerId : selectedOffer.id,
            passengerName,
            passengerBornOn,
            passengerEmail,
            passengerPhoneNumber,
            passengerTitle,
            passengerGender,
            bookingNote: bookingNote || undefined,
            tripId: selectedTripId || undefined,
          },
          accessToken
        );
        bookingId = booking.id;
      } else {
        // Create hotel booking
        const booking = await createHotelBooking(
          {
            offerId: selectedOffer.id,
            guestName: passengerName,
            guestBornOn: passengerBornOn,
            guestEmail: passengerEmail,
            guestPhoneNumber: passengerPhoneNumber,
            bookingNote: bookingNote || undefined,
            tripId: selectedTripId || undefined,
          },
          accessToken
        );
        bookingId = booking.id;
      }

      // Reset booking store
      reset();

      // Navigate to booking details
      router.replace(`/bookings/${bookingId}`);
    } catch (err) {
      Alert.alert(
        "Booking Failed",
        err instanceof Error
          ? err.message
          : "Failed to create booking. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOfferSummary = () => {
    if (isFlightOffer) {
      const offer = selectedOffer as typeof selectedOffer & {
        originCode: string;
        destinationCode: string;
        carrierName?: string;
        flightNumber?: string;
        departDate: string;
        duration?: string;
        cabinClass: string;
        totalAmount: string;
        currency: string;
      };

      return (
        <View style={styles.offerSummary}>
          <View style={styles.summaryHeader}>
            <Ionicons
              name="airplane"
              size={24}
              color={colors.brand.default}
            />
            <Text variant="h5" weight="bold">
              Flight Summary
            </Text>
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Route
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.originCode} → {offer.destinationCode}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Airline
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.carrierName || "Unknown"} {offer.flightNumber ? `· ${offer.flightNumber}` : ""}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Departure
              </Text>
              <Text variant="body" weight="semiBold">
                {new Date(offer.departDate).toLocaleString()}
              </Text>
            </View>

            {offer.duration && (
              <View style={styles.summaryRow}>
                <Text variant="body" color="secondary">
                  Duration
                </Text>
                <Text variant="body" weight="semiBold">
                  {offer.duration}
                </Text>
              </View>
            )}

            {offer.cabinClass && (
              <View style={styles.summaryRow}>
                <Text variant="body" color="secondary">
                  Cabin Class
                </Text>
                <Text variant="body" weight="semiBold">
                  {offer.cabinClass.charAt(0).toUpperCase() +
                    offer.cabinClass.slice(1)}
                </Text>
              </View>
            )}

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text variant="h6" weight="bold">
                Total Price
              </Text>
              <Text variant="h5" weight="bold" style={{ color: colors.brand.default }}>
                ${offer.totalAmount} {offer.currency}
              </Text>
            </View>
          </View>
        </View>
      );
    } else {
      const offer = selectedOffer as typeof selectedOffer & {
        hotelName: string;
        city: string;
        checkIn: string;
        checkOut: string;
        rooms: number;
        roomTier: string;
      };

      return (
        <View style={styles.offerSummary}>
          <View style={styles.summaryHeader}>
            <Ionicons name="bed" size={24} color={colors.brand.default} />
            <Text variant="h5" weight="bold">
              Hotel Summary
            </Text>
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Hotel
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.hotelName}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Location
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.city}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Check-in
              </Text>
              <Text variant="body" weight="semiBold">
                {new Date(offer.checkIn).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Check-out
              </Text>
              <Text variant="body" weight="semiBold">
                {new Date(offer.checkOut).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text variant="body" color="secondary">
                Room Type
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.roomTier.charAt(0).toUpperCase() +
                  offer.roomTier.slice(1)}{" "}
                · {offer.rooms} room(s)
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text variant="h6" weight="bold">
                Total Price
              </Text>
              <Text variant="h5" weight="bold" style={{ color: colors.brand.default }}>
                ${offer.totalAmount} {offer.totalCurrency}
              </Text>
            </View>
          </View>
        </View>
      );
    }
  };

  const titleOptions = [
    { label: "Mr.", value: "mr" },
    { label: "Mrs.", value: "mrs" },
    { label: "Ms.", value: "ms" },
    { label: "Miss", value: "miss" },
    { label: "Mx.", value: "mx" },
    { label: "Dr.", value: "dr" },
  ];

  const genderOptions = [
    { label: "Male", value: "m" },
    { label: "Female", value: "f" },
    { label: "Other", value: "x" },
  ];

  const selectedTitle =
    titleOptions.find((t) => t.value === passengerTitle)?.label || "Select";
  const selectedGender =
    genderOptions.find((g) => g.value === passengerGender)?.label || "Select";
  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <Screen preset="fixed">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
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
            <Text variant="h4">Booking Details</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing[20] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {renderOfferSummary()}

          <View style={styles.formSection}>
            <Text variant="h6" weight="bold">
              {isFlightOffer ? "Passenger Information" : "Guest Information"}
            </Text>

            <View style={styles.formRow}>
              <View style={styles.formFieldSmall}>
                <Text variant="label">Title</Text>
                <Pressable
                  style={styles.selectInput}
                  onPress={() => setShowTitlePicker(true)}
                >
                  <Text variant="body">{selectedTitle}</Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>

              <View style={styles.formFieldLarge}>
                <Text variant="label">Full Name</Text>
                <Input
                  value={passengerName}
                  onChangeText={setPassengerName}
                  placeholder="John Doe"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text variant="label">Date of Birth</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowDobPicker(true)}
              >
                <Text variant="body">
                  {passengerBornOn
                    ? new Date(passengerBornOn).toLocaleDateString()
                    : "Select date"}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>

            {isFlightOffer && (
              <View style={styles.formField}>
                <Text variant="label">Gender</Text>
                <Pressable
                  style={styles.selectInput}
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Text variant="body">{selectedGender}</Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={colors.text.secondary}
                  />
                </Pressable>
              </View>
            )}

            <View style={styles.formField}>
              <Text variant="label">Email Address</Text>
              <Input
                value={passengerEmail}
                onChangeText={setPassengerEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formField}>
              <Text variant="label">Phone Number</Text>
              <Input
                value={passengerPhoneNumber}
                onChangeText={setPassengerPhoneNumber}
                placeholder="+1 234 567 8900"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formField}>
              <Text variant="label">Booking Note (Optional)</Text>
              <Input
                value={bookingNote}
                onChangeText={setBookingNote}
                placeholder="Add any special requests..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formField}>
              <Text variant="label">Attach to Trip (Optional)</Text>
              <Pressable
                style={styles.selectInput}
                onPress={() => setShowTripPicker(true)}
              >
                <Text variant="body">
                  {selectedTrip?.name || "Select trip"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing[4] },
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.grays.white} />
            ) : (
              "Confirm Booking"
            )}
          </Button>
        </View>
      </KeyboardAvoidingView>

      {/* Date of Birth Picker */}
      <DatePickerSheet
        visible={showDobPicker}
        title="Date of Birth"
        date={passengerBornOn ? new Date(passengerBornOn) : new Date()}
        onClose={() => setShowDobPicker(false)}
        onConfirm={(date) => {
          setPassengerBornOn(date.toISOString().split("T")[0]);
          setShowDobPicker(false);
        }}
        maximumDate={new Date()}
      />

      {/* Title Picker Modal */}
      <DatePickerSheet
        visible={showTitlePicker}
        title="Select Title"
        date={new Date()}
        onClose={() => setShowTitlePicker(false)}
        onConfirm={() => {}}
        renderCustomContent={() => (
          <View style={styles.pickerOptions}>
            {titleOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerOption,
                  passengerTitle === option.value &&
                    styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setPassengerTitle(
                    option.value as
                      | "mr"
                      | "mrs"
                      | "ms"
                      | "miss"
                      | "mx"
                      | "dr"
                  );
                  setShowTitlePicker(false);
                }}
              >
                <Text
                  variant="body"
                  weight={
                    passengerTitle === option.value ? "semiBold" : "regular"
                  }
                >
                  {option.label}
                </Text>
                {passengerTitle === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.brand.default}
                  />
                )}
              </Pressable>
            ))}
          </View>
        )}
      />

      {/* Gender Picker Modal */}
      <DatePickerSheet
        visible={showGenderPicker}
        title="Select Gender"
        date={new Date()}
        onClose={() => setShowGenderPicker(false)}
        onConfirm={() => {}}
        renderCustomContent={() => (
          <View style={styles.pickerOptions}>
            {genderOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerOption,
                  passengerGender === option.value &&
                    styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setPassengerGender(option.value as "m" | "f" | "x");
                  setShowGenderPicker(false);
                }}
              >
                <Text
                  variant="body"
                  weight={
                    passengerGender === option.value ? "semiBold" : "regular"
                  }
                >
                  {option.label}
                </Text>
                {passengerGender === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.brand.default}
                  />
                )}
              </Pressable>
            ))}
          </View>
        )}
      />

      {/* Trip Picker Modal */}
      <DatePickerSheet
        visible={showTripPicker}
        title="Select Trip"
        date={new Date()}
        onClose={() => setShowTripPicker(false)}
        onConfirm={() => {}}
        renderCustomContent={() => (
          <View style={styles.pickerOptions}>
            <Pressable
              style={[
                styles.pickerOption,
                !selectedTripId && styles.pickerOptionActive,
              ]}
              onPress={() => {
                setSelectedTripId(null);
                setShowTripPicker(false);
              }}
            >
              <Text
                variant="body"
                weight={!selectedTripId ? "semiBold" : "regular"}
              >
                No trip
              </Text>
              {!selectedTripId && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.brand.default}
                />
              )}
            </Pressable>
            {trips.map((trip) => (
              <Pressable
                key={trip.id}
                style={[
                  styles.pickerOption,
                  selectedTripId === trip.id && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setSelectedTripId(trip.id);
                  setShowTripPicker(false);
                }}
              >
                <Text
                  variant="body"
                  weight={selectedTripId === trip.id ? "semiBold" : "regular"}
                >
                  {trip.name}
                </Text>
                {selectedTripId === trip.id && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.brand.default}
                  />
                )}
              </Pressable>
            ))}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[5],
    gap: spacing[5],
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
  },
  offerSummary: {
    backgroundColor: colors.brand.subtle,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.brand.light,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  summaryDetails: {
    gap: spacing[3],
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing[2],
  },
  formSection: {
    gap: spacing[4],
  },
  formField: {
    gap: spacing[2],
  },
  formRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  formFieldSmall: {
    flex: 1,
    gap: spacing[2],
  },
  formFieldLarge: {
    flex: 2,
    gap: spacing[2],
  },
  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
    minHeight: 48,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  pickerOptions: {
    gap: spacing[2],
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pickerOptionActive: {
    borderColor: colors.brand.default,
    backgroundColor: colors.brand.subtle,
  },
});
