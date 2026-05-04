import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Badge, Button, Card, Text } from "@/components/ui";
import { colors, spacing } from "@/constants/design-tokens";
import {
  ApiError,
  cancelBooking,
  fetchBooking,
  issueBoardingPass,
  type BoardingPass,
  type Booking,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatAmount(value: string) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === "string" ? params.id : null;
  const { tokens } = useSession();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [boardingPass, setBoardingPass] = useState<BoardingPass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens?.accessToken || !bookingId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const loadedBooking = await fetchBooking(bookingId, tokens.accessToken);

        if (!isActive) {
          return;
        }

        setBooking(loadedBooking);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError ? error.message : "We could not load this booking."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [bookingId, tokens?.accessToken]);

  async function handleIssueBoardingPass() {
    if (!tokens?.accessToken || !booking || isIssuing) {
      return;
    }

    setIsIssuing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await issueBoardingPass(booking.id, tokens.accessToken);
      setBooking(result.booking);
      setBoardingPass(result.boardingPass);
      setStatusMessage("Boarding pass issued. It is ready to open.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "We could not issue a boarding pass."
      );
    } finally {
      setIsIssuing(false);
    }
  }

  async function handleCancelBooking() {
    if (!tokens?.accessToken || !booking || isCancelling) {
      return;
    }

    setIsCancelling(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const updatedBooking = await cancelBooking(booking.id, tokens.accessToken);
      setBooking(updatedBooking);
      setStatusMessage(
        updatedBooking.mode === "flight"
          ? "Booking cancelled. Any issued boarding pass is now void, and the refund flow has started."
          : "Stay cancelled. Refund status is now tracked on this booking."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "We could not cancel this booking."
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const resolvedBoardingPassId = boardingPass?.id ?? booking?.ticket.boardingPassId ?? null;

  return (
    <BlurScrollScreen title="Booking" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text variant="eyebrow">Booking</Text>
          <Text variant="h3">
            {booking?.mode === "hotel" ? "Hotel booking" : "Flight booking"}
          </Text>
          <Text variant="bodySmall" color="secondary">
            Confirmed booking first. Flights continue into ticket issuing; hotels stay as booking records for now.
          </Text>
        </View>
      </View>

      {errorMessage ? (
        <Card variant="outlined" style={styles.messageCard}>
          <Text variant="bodySmall" style={styles.errorText}>
            {errorMessage}
          </Text>
        </Card>
      ) : null}

      {statusMessage ? (
        <Card variant="filled" style={styles.messageCard}>
          <Text variant="bodySmall">{statusMessage}</Text>
        </Card>
      ) : null}

      {isLoading ? (
        <Card variant="outlined" style={styles.loadingCard}>
          <ActivityIndicator color={colors.brand.default} />
          <Text variant="bodySmall" color="secondary">
            Loading booking...
          </Text>
        </Card>
      ) : booking ? (
        <>
          <Card variant="elevated" style={styles.heroCard}>
            <View style={styles.badgeRow}>
              <Badge variant="info">
                {booking.mode === "hotel" ? "Hotel" : "Flight"}
              </Badge>
              <Badge
                variant={
                  booking.status === "cancelled"
                    ? "error"
                    : booking.mode === "hotel"
                    ? "info"
                    : booking.ticket.issued
                    ? "success"
                    : "warning"
                }
              >
                {booking.mode === "hotel"
                  ? booking.status === "cancelled"
                    ? "Cancelled"
                    : "Stay confirmed"
                  : booking.ticket.issued
                  ? "Ticket issued"
                  : booking.status === "cancelled"
                  ? "Cancelled"
                  : "Ticket pending"}
              </Badge>
            </View>
            {booking.mode === "hotel" && booking.stay ? (
              <>
                <Text variant="h3">{booking.stay.hotel.label}</Text>
                <Text variant="bodySmall" color="secondary">
                  {booking.stay.city.label} ·{" "}
                  {formatDate(booking.stay.checkInDate)} to{" "}
                  {formatDate(booking.stay.checkOutDate ?? booking.stay.checkInDate)}
                </Text>
              </>
            ) : booking.travel ? (
              <>
                <Text variant="h3">
                  {booking.travel.origin.code} to {booking.travel.destination.code}
                </Text>
                <Text variant="bodySmall" color="secondary">
                  {booking.travel.carrierName} · {booking.travel.flightNumber} ·{" "}
                  {formatDate(booking.travel.departDate)}
                </Text>
              </>
            ) : null}
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text variant="caption" color="tertiary">
                  {booking.mode === "hotel" ? "Guest" : "Passenger"}
                </Text>
                <Text variant="bodySmall">{booking.passengerName}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text variant="caption" color="tertiary">
                  Amount
                </Text>
                <Text variant="bodySmall">
                  {formatAmount(booking.payment.totalAmount)} {booking.payment.currency}
                </Text>
              </View>
            </View>
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <Text variant="h4">Booking details</Text>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                Reference
              </Text>
              <Text variant="bodySmall">{booking.bookingReference}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                {booking.mode === "hotel" ? "Room tier" : "Cabin"}
              </Text>
              <Text variant="bodySmall">
                {booking.mode === "hotel" ? booking.stay?.roomTier : booking.travel?.cabinClass}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                {booking.mode === "hotel" ? "Rooms" : "Travelers"}
              </Text>
              <Text variant="bodySmall">
                {booking.mode === "hotel" ? booking.stay?.roomCount : booking.travel?.travelerCount}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                {booking.mode === "hotel" ? "Nightly rate" : "Duration"}
              </Text>
              <Text variant="bodySmall">
                {booking.mode === "hotel" && booking.stay
                  ? `${formatAmount(booking.stay.nightlyAmount)} ${booking.payment.currency}`
                  : booking.travel?.duration}
              </Text>
            </View>
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <Text variant="h4">Cancellation and refund</Text>
            <Text variant="bodySmall" color="secondary">
              {booking.refund.policy}
            </Text>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                Refund status
              </Text>
              <Text variant="bodySmall">{booking.refund.status}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                Refund amount
              </Text>
              <Text variant="bodySmall">
                {formatAmount(booking.refund.amount)} {booking.payment.currency}
              </Text>
            </View>
            {booking.refund.estimatedArrival ? (
              <View style={styles.detailRow}>
                <Text variant="caption" color="tertiary">
                  Estimated arrival
                </Text>
                <Text variant="bodySmall">
                  {new Date(booking.refund.estimatedArrival).toLocaleString("en-US")}
                </Text>
              </View>
            ) : null}
            {booking.cancellation.canCancel ? (
              <Button
                fullWidth
                variant="outline"
                loading={isCancelling}
                onPress={() => void handleCancelBooking()}
                style={styles.cta}
                leftIcon={<Ionicons name="close-circle-outline" size={18} color={colors.brand.default} />}
              >
                Cancel booking
              </Button>
            ) : null}
          </Card>

          {booking.mode === "flight" ? (
            <Card variant="default" style={styles.sectionCard}>
              <Text variant="h4">Ticket issuing</Text>
              <Text variant="bodySmall" color="secondary">
                Issue the boarding pass after the booking is confirmed, then open it from here or from the Trips tab.
              </Text>

              {booking.ticket.issued ? (
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={() =>
                    resolvedBoardingPassId
                      ? router.push(`/boarding-passes/${resolvedBoardingPassId}`)
                      : undefined
                  }
                  style={styles.cta}
                  leftIcon={<Ionicons name="card-outline" size={18} color={colors.brand.pressed} />}
                >
                  Open boarding pass
                </Button>
              ) : (
                <Button
                  fullWidth
                  loading={isIssuing}
                  disabled={!booking.ticket.canIssueBoardingPass}
                  onPress={() => void handleIssueBoardingPass()}
                  style={styles.cta}
                  leftIcon={<Ionicons name="ticket-outline" size={18} color={colors.grays.white} />}
                >
                  Issue boarding pass
                </Button>
              )}
            </Card>
          ) : (
            <Card variant="default" style={styles.sectionCard}>
              <Text variant="h4">Stay confirmation</Text>
              <Text variant="bodySmall" color="secondary">
                Hotel bookings do not issue boarding passes. They stay available here as confirmed travel records until later refund and cancellation flows land.
              </Text>
            </Card>
          )}
        </>
      ) : (
        <Card variant="outlined" style={styles.loadingCard}>
          <Text variant="bodySmall" color="secondary">
            This booking could not be found.
          </Text>
        </Card>
      )}
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  headerRow: {
    gap: spacing[2],
  },
  headerCopy: {
    gap: spacing[1],
  },
  messageCard: {
    gap: spacing[2],
  },
  errorText: {
    color: colors.status.error,
  },
  loadingCard: {
    gap: spacing[3],
    alignItems: "center",
  },
  heroCard: {
    gap: spacing[3],
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  metricCard: {
    flex: 1,
    gap: spacing[1],
  },
  sectionCard: {
    gap: spacing[3],
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  cta: {
    marginTop: spacing[1],
  },
});
