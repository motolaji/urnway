import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DatePickerSheet from "@/components/date-picker-sheet";
import { Button, IconButton, Input, Screen, Text } from "@/components/ui";
import { borderRadius, colors, spacing } from "@/constants/design-tokens";
import {
  ApiError,
  completeBookingCheckout,
  fetchTrips,
  fetchUrnwayBalance,
  prepareBookingCheckout,
  type PaymentSource,
  type Trip,
  type UrnwayBalanceSummary,
} from "@/lib/session";
import { useBookingStore } from "@/lib/stores/booking-store";
import { isCompletedTopup, runUrnwayTopupFlow } from "@/lib/topup-flow";
import { useSession } from "@/providers/session-provider";

type Option<Value extends string> = {
  label: string;
  value: Value;
  description?: string;
};

function formatOfferTotal(amount: string, currency: string) {
  return `${amount} ${currency}`;
}

function formatBalanceAmount(balance: UrnwayBalanceSummary | null) {
  if (!balance) {
    return "—";
  }

  return `${balance.account.availableAmount} ${balance.account.currency}`;
}

function OptionSheet<Value extends string>({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<Value>[];
  selectedValue: Value;
  onSelect: (value: Value) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text variant="h4">{title}</Text>
            <IconButton
              variant="ghost"
              size="sm"
              onPress={onClose}
              icon={<Ionicons name="close" size={22} color={colors.text.primary} />}
            />
          </View>

          <View style={styles.optionList}>
            {options.map((option) => {
              const isSelected = option.value === selectedValue;

              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionRow,
                    isSelected ? styles.optionRowSelected : null,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <View style={styles.optionCopy}>
                    <Text variant="body" weight={isSelected ? "semiBold" : "regular"}>
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text variant="caption" color="secondary">
                        {option.description}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.brand.default}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function BookingDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { tokens } = useSession();
  const accessToken = tokens?.accessToken ?? null;
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

  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [balance, setBalance] = useState<UrnwayBalanceSummary | null>(null);
  const [paymentSource, setPaymentSource] =
    useState<PaymentSource>("urnway_balance");
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const treasuryReady = Boolean(balance?.treasuryWalletAddress);

  useEffect(() => {
    if (!accessToken) {
      setIsLoadingMeta(false);
      return;
    }

    let cancelled = false;

    async function loadMeta() {
      if (!accessToken) {
        return;
      }

      try {
        setIsLoadingMeta(true);
        const [tripsResponse, nextBalance] = await Promise.all([
          fetchTrips(accessToken),
          fetchUrnwayBalance(accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setAvailableTrips(tripsResponse.trips);
        setBalance(nextBalance);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "Could not load booking checkout details."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      }
    }

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const isFlightOffer = useMemo(
    () => Boolean(selectedOffer && "originCode" in selectedOffer),
    [selectedOffer]
  );

  const sourceOptions: Option<PaymentSource>[] = [
    {
      label: "Urnway balance",
      value: "urnway_balance",
      description: "Use only the balance already held inside Urnway.",
    },
    {
      label: "Split",
      value: "split",
      description:
        "Use Urnway balance first, then top up only the shortfall from your external wallet.",
    },
    {
      label: "External wallet",
      value: "external_wallet",
      description:
        "Fund the full booking from your wallet into Urnway before checkout completes.",
    },
  ];

  const titleOptions: Option<"mr" | "mrs" | "ms" | "miss" | "mx" | "dr">[] = [
    { label: "Mr.", value: "mr" },
    { label: "Mrs.", value: "mrs" },
    { label: "Ms.", value: "ms" },
    { label: "Miss", value: "miss" },
    { label: "Mx.", value: "mx" },
    { label: "Dr.", value: "dr" },
  ];

  const genderOptions: Option<"m" | "f" | "x">[] = [
    { label: "Male", value: "m" },
    { label: "Female", value: "f" },
    { label: "Other", value: "x" },
  ];

  const tripOptions: Option<string>[] = availableTrips.map((trip) => ({
    label: trip.title,
    value: trip.id,
    description: `${trip.destination} · ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(
      trip.endDate
    ).toLocaleDateString()}`,
  }));

  const selectedTrip = availableTrips.find((trip) => trip.id === selectedTripId) ?? null;
  const selectedSourceLabel =
    sourceOptions.find((option) => option.value === paymentSource)?.label ??
    "Urnway balance";

  if (!selectedOffer) {
    return (
      <Screen backgroundColor={colors.background.primary}>
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.status.error}
          />
          <Text variant="body" color="secondary" style={styles.messageText}>
            No offer selected. Go back and choose a flight or stay first.
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

  const offer = selectedOffer;

  async function handleSubmit() {
    if (!accessToken) {
      Alert.alert("Authentication required", "Please sign in again.");
      return;
    }

    if (!treasuryReady && paymentSource !== "urnway_balance") {
      Alert.alert(
        "Treasury not configured",
        "Urnway treasury is not configured yet, so Split and External wallet booking checkout are not available."
      );
      return;
    }

    if (!passengerName.trim()) {
      Alert.alert("Missing passenger name", "Enter the traveller name first.");
      return;
    }

    if (isFlightOffer && !passengerBornOn) {
      Alert.alert("Missing date of birth", "Select the traveller date of birth.");
      return;
    }

    if (!passengerEmail.trim()) {
      Alert.alert("Missing email", "Enter the contact email for this booking.");
      return;
    }

    if (isFlightOffer && !passengerPhoneNumber.trim()) {
      Alert.alert("Missing phone number", "Enter the traveller phone number.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setStatusMessage("Preparing booking checkout…");

      const prepared =
        offer.mode === "flight"
          ? await prepareBookingCheckout(
              {
                mode: "flight",
                source: paymentSource,
                booking: {
                  offer,
                  passengerName: passengerName.trim(),
                  bornOn: passengerBornOn || undefined,
                  email: passengerEmail.trim(),
                  phoneNumber: passengerPhoneNumber.trim() || undefined,
                  title: passengerTitle,
                  gender: passengerGender,
                  tripId: selectedTripId || undefined,
                  note: bookingNote.trim() || undefined,
                },
              },
              accessToken
            )
          : await prepareBookingCheckout(
              {
                mode: "hotel",
                source: paymentSource,
                booking: {
                  offer,
                  guestName: passengerName.trim(),
                  bornOn: passengerBornOn || undefined,
                  email: passengerEmail.trim(),
                  phoneNumber: passengerPhoneNumber.trim() || undefined,
                  tripId: selectedTripId || undefined,
                  note: bookingNote.trim() || undefined,
                },
              },
              accessToken
            );

      setBalance((currentBalance) =>
        prepared.balance
          ? {
              ...(currentBalance ?? {
                externalWallet: {
                  walletAddress: "",
                  nativeTokenBalance: "0",
                  nativeTokenSymbol: "BTC",
                  musdBalance: "0",
                  musdTokenSymbol: "MUSD",
                  source: "mezo" as const,
                  updatedAt: new Date().toISOString(),
                },
                treasuryWalletAddress: null,
                tokenAddress: "",
                updatedAt: new Date().toISOString(),
              }),
              account: prepared.balance,
            }
          : currentBalance
      );

      const { checkout } = prepared;

      if (
        paymentSource === "urnway_balance" &&
        !checkout.fundingPlan.canCompleteNow
      ) {
        const shortfall = `${checkout.fundingPlan.shortfallAmount} ${checkout.fundingCurrency}`;
        throw new Error(
          `Urnway balance is short by ${shortfall}. Switch to Split or External wallet.`
        );
      }

      let topupId: string | undefined;

      if (checkout.fundingPlan.requiresTopUp) {
        setStatusMessage(
          `Top up ${checkout.fundingPlan.shortfallAmount} ${checkout.fundingCurrency} from your external wallet…`
        );

        const topup = await runUrnwayTopupFlow({
          amountMinor: checkout.fundingPlan.shortfallAmountMinor,
          currency: checkout.fundingCurrency,
          accessToken,
          onStatus: (message) => setStatusMessage(message),
        });

        if (!isCompletedTopup(topup)) {
          throw new Error("Top-up did not complete. Booking checkout was not finished.");
        }

        topupId = topup.topupId;
      }

      setStatusMessage("Finalising booking…");
      const completed = await completeBookingCheckout(
        checkout.checkoutId,
        {
          topupId,
        },
        accessToken
      );

      if (!completed.booking) {
        throw new Error("Booking checkout completed without a booking record.");
      }

      reset();
      router.replace(`/bookings/${completed.booking.id}` as Href);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not complete this booking.";

      setErrorMessage(message);
      Alert.alert("Booking failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderOfferSummary() {
    if (offer.mode === "flight") {
      return (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="airplane" size={22} color={colors.brand.default} />
            <Text variant="h4">Flight Summary</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color="secondary">
                Route
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.originCode} → {offer.destinationCode}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color="secondary">
                Airline
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.carrierName} · {offer.flightNumber}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color="secondary">
                Departure
              </Text>
              <Text variant="body" weight="semiBold">
                {new Date(offer.departDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color="secondary">
                Cabin
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.cabinClass} · {offer.travelerCount} traveller
                {offer.travelerCount === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodySmall" color="secondary">
                Duration
              </Text>
              <Text variant="body" weight="semiBold">
                {offer.duration}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text variant="h4">Total</Text>
              <Text variant="h4" weight="bold" style={styles.totalValue}>
                {formatOfferTotal(offer.totalAmount, offer.currency)}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="bed" size={22} color={colors.brand.default} />
          <Text variant="h4">Stay Summary</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" color="secondary">
              Hotel
            </Text>
            <Text variant="body" weight="semiBold">
              {offer.hotelName}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" color="secondary">
              City
            </Text>
            <Text variant="body" weight="semiBold">
              {offer.cityLabel}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" color="secondary">
              Dates
            </Text>
            <Text variant="body" weight="semiBold">
              {new Date(offer.checkInDate).toLocaleDateString()} -{" "}
              {new Date(offer.checkOutDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" color="secondary">
              Room
            </Text>
            <Text variant="body" weight="semiBold">
              {offer.roomTier} · {offer.roomCount} room
              {offer.roomCount === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" color="secondary">
              Provider
            </Text>
            <Text variant="body" weight="semiBold">
              {offer.providerName}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text variant="h4">Total</Text>
            <Text variant="h4" weight="bold" style={styles.totalValue}>
              {formatOfferTotal(offer.totalAmount, offer.currency)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Screen backgroundColor={colors.background.primary} padded={false} safeArea={false}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[4] }]}>
        <View style={styles.headerLeft}>
          <IconButton
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            icon={<Ionicons name="arrow-back" size={24} color={colors.text.primary} />}
          />
          <Text variant="h4">Complete Booking</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {renderOfferSummary()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h4">Funding</Text>
            {isLoadingMeta ? (
              <ActivityIndicator size="small" color={colors.brand.default} />
            ) : (
              <Text variant="caption" color="secondary">
                Balance {formatBalanceAmount(balance)}
              </Text>
            )}
          </View>

          <Pressable
            style={styles.selectInput}
            onPress={() => setShowSourcePicker(true)}
          >
            <View style={styles.selectInputCopy}>
              <Text variant="label">Payment source</Text>
              <Text variant="body">{selectedSourceLabel}</Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>

          {balance ? (
            <View style={styles.balanceCallout}>
              <Text variant="bodySmall" color="secondary">
                Urnway balance: {balance.account.availableAmount}{" "}
                {balance.account.currency}
              </Text>
              <Text variant="bodySmall" color="secondary">
                External wallet: {balance.externalWallet.musdBalance}{" "}
                {balance.externalWallet.musdTokenSymbol}
              </Text>
              {!treasuryReady ? (
                <Text variant="caption" color="secondary">
                  Treasury not configured yet. Split and External wallet checkout
                  need `URNWAY_TREASURY_WALLET_ADDRESS` on the API.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="h4">
            {isFlightOffer ? "Passenger Information" : "Guest Information"}
          </Text>

          <View style={styles.formRow}>
            {offer.mode === "flight" ? (
              <Pressable
                style={[styles.selectInput, styles.smallField]}
                onPress={() => setShowTitlePicker(true)}
              >
                <View style={styles.selectInputCopy}>
                  <Text variant="label">Title</Text>
                  <Text variant="body">
                    {titleOptions.find((option) => option.value === passengerTitle)?.label ??
                      "Select"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
            ) : null}

            <View style={offer.mode === "flight" ? styles.largeField : styles.fullField}>
              <Input
                label="Full Name"
                value={passengerName}
                onChangeText={setPassengerName}
                placeholder="John Doe"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Pressable
            style={styles.selectInput}
            onPress={() => setShowDobPicker(true)}
          >
            <View style={styles.selectInputCopy}>
              <Text variant="label">Date of Birth</Text>
              <Text variant="body">
                {passengerBornOn
                  ? new Date(passengerBornOn).toLocaleDateString()
                  : "Select date"}
              </Text>
            </View>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>

          {offer.mode === "flight" ? (
            <Pressable
              style={styles.selectInput}
              onPress={() => setShowGenderPicker(true)}
            >
              <View style={styles.selectInputCopy}>
                <Text variant="label">Gender</Text>
                <Text variant="body">
                  {genderOptions.find((option) => option.value === passengerGender)?.label ??
                    "Select"}
                </Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.text.secondary}
              />
            </Pressable>
          ) : null}

          <Input
            label="Email Address"
            value={passengerEmail}
            onChangeText={setPassengerEmail}
            placeholder="john@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Phone Number"
            value={passengerPhoneNumber}
            onChangeText={setPassengerPhoneNumber}
            placeholder="+44 7123 456789"
            keyboardType="phone-pad"
          />

          <Input
            label="Booking Note"
            value={bookingNote}
            onChangeText={setBookingNote}
            placeholder="Any special requests?"
            multiline
            numberOfLines={3}
          />

          <Pressable
            style={styles.selectInput}
            onPress={() => setShowTripPicker(true)}
          >
            <View style={styles.selectInputCopy}>
              <Text variant="label">Attach to Trip</Text>
              <Text variant="body">
                {selectedTrip ? selectedTrip.title : "No linked trip"}
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        {statusMessage ? (
          <View style={styles.infoCard}>
            <Text variant="bodySmall">{statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text variant="bodySmall" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          onPress={() => void handleSubmit()}
        >
          Confirm Booking
        </Button>
      </View>

      <DatePickerSheet
        visible={showDobPicker}
        title="Date of Birth"
        value={passengerBornOn}
        maximumDate={new Date().toISOString().slice(0, 10)}
        onClose={() => setShowDobPicker(false)}
        onConfirm={(nextValue) => setPassengerBornOn(nextValue)}
      />

      <OptionSheet
        visible={showTitlePicker}
        title="Select Title"
        options={titleOptions}
        selectedValue={passengerTitle}
        onSelect={setPassengerTitle}
        onClose={() => setShowTitlePicker(false)}
      />

      <OptionSheet
        visible={showGenderPicker}
        title="Select Gender"
        options={genderOptions}
        selectedValue={passengerGender}
        onSelect={setPassengerGender}
        onClose={() => setShowGenderPicker(false)}
      />

      <OptionSheet
        visible={showSourcePicker}
        title="Choose Payment Source"
        options={sourceOptions}
        selectedValue={paymentSource}
        onSelect={setPaymentSource}
        onClose={() => setShowSourcePicker(false)}
      />

      <Modal
        visible={showTripPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTripPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTripPicker(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text variant="h4">Attach to Trip</Text>
              <IconButton
                variant="ghost"
                size="sm"
                onPress={() => setShowTripPicker(false)}
                icon={<Ionicons name="close" size={22} color={colors.text.primary} />}
              />
            </View>

            <View style={styles.optionList}>
              <Pressable
                style={[
                  styles.optionRow,
                  !selectedTripId ? styles.optionRowSelected : null,
                ]}
                onPress={() => {
                  setSelectedTripId(null);
                  setShowTripPicker(false);
                }}
              >
                <View style={styles.optionCopy}>
                  <Text variant="body" weight={!selectedTripId ? "semiBold" : "regular"}>
                    No linked trip
                  </Text>
                </View>
                {!selectedTripId ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.brand.default}
                  />
                ) : null}
              </Pressable>

              {tripOptions.map((trip) => {
                const isSelected = selectedTripId === trip.value;

                return (
                  <Pressable
                    key={trip.value}
                    style={[styles.optionRow, isSelected ? styles.optionRowSelected : null]}
                    onPress={() => {
                      setSelectedTripId(trip.value);
                      setShowTripPicker(false);
                    }}
                  >
                    <View style={styles.optionCopy}>
                      <Text variant="body" weight={isSelected ? "semiBold" : "regular"}>
                        {trip.label}
                      </Text>
                      {trip.description ? (
                        <Text variant="caption" color="secondary">
                          {trip.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.brand.default}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
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
  messageText: {
    marginTop: spacing[3],
  },
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.brand.subtle,
    borderWidth: 1,
    borderColor: colors.brand.light,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  summaryGrid: {
    gap: spacing[2],
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  totalRow: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.light,
  },
  totalValue: {
    color: colors.brand.default,
  },
  section: {
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  smallField: {
    width: 132,
  },
  largeField: {
    flex: 1,
  },
  fullField: {
    width: "100%",
  },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  selectInputCopy: {
    flex: 1,
    gap: spacing[1],
  },
  balanceCallout: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.primary,
  },
  infoCard: {
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.light,
  },
  errorCard: {
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: "#fff2f0",
  },
  errorText: {
    color: colors.status.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background.overlay,
    justifyContent: "center",
    paddingHorizontal: spacing[5],
  },
  modalCard: {
    borderRadius: borderRadius["2xl"],
    backgroundColor: colors.background.primary,
    padding: spacing[5],
    gap: spacing[4],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionList: {
    gap: spacing[2],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.secondary,
  },
  optionRowSelected: {
    backgroundColor: colors.brand.light,
  },
  optionCopy: {
    flex: 1,
    gap: spacing[0.5],
  },
});
