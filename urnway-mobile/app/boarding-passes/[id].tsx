import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Badge, Card, Text } from "@/components/ui";
import { colors, spacing } from "@/constants/design-tokens";
import {
  ApiError,
  fetchBoardingPassWithCache,
  type BoardingPass,
  type CachedResourceSource,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function BoardingPassDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const boardingPassId = typeof params.id === "string" ? params.id : null;
  const { tokens } = useSession();
  const [boardingPass, setBoardingPass] = useState<BoardingPass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<CachedResourceSource>("network");
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens?.accessToken || !boardingPassId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await fetchBoardingPassWithCache(
          boardingPassId,
          tokens.accessToken
        );

        if (!isActive) {
          return;
        }

        setBoardingPass(result.boardingPass);
        setSource(result.source);
        setCachedAt(result.cachedAt);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load this boarding pass."
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
  }, [boardingPassId, tokens?.accessToken]);

  return (
    <BlurScrollScreen title="Boarding pass" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text variant="eyebrow">Boarding pass</Text>
        <Text variant="h3">Issued ticket</Text>
        <Text variant="bodySmall" color="secondary">
          Ticket issuance and boarding-pass viewing now exist for flights. Other transport can follow later.
        </Text>
      </View>

      {source === "cache" ? (
        <Card variant="outlined" style={styles.messageCard}>
          <Badge variant="warning">Offline cache</Badge>
          <Text variant="bodySmall" color="secondary">
            Showing the last saved copy{cachedAt ? ` from ${new Date(cachedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}.` : "."}
          </Text>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card variant="outlined" style={styles.messageCard}>
          <Text variant="bodySmall" style={styles.errorText}>
            {errorMessage}
          </Text>
        </Card>
      ) : null}

      {isLoading ? (
        <Card variant="outlined" style={styles.loadingCard}>
          <ActivityIndicator color={colors.brand.default} />
          <Text variant="bodySmall" color="secondary">
            Loading boarding pass...
          </Text>
        </Card>
      ) : boardingPass ? (
        <>
          <Card variant="elevated" style={styles.passCard}>
            <View style={styles.badgeRow}>
              <Badge variant={boardingPass.status === "voided" ? "error" : "success"}>
                {boardingPass.status}
              </Badge>
              <Badge variant="info">{boardingPass.travel.carrierCode}</Badge>
            </View>
            <Text variant="h3">
              {boardingPass.travel.originCode} to {boardingPass.travel.destinationCode}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {boardingPass.travel.carrierName} · {boardingPass.travel.flightNumber} · {formatDate(boardingPass.travel.departDate)}
            </Text>

            <View style={styles.metricGrid}>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Passenger
                </Text>
                <Text variant="bodySmall">{boardingPass.passengerName}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Seat
                </Text>
                <Text variant="bodySmall">{boardingPass.travel.seat}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Gate
                </Text>
                <Text variant="bodySmall">{boardingPass.travel.gate}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="caption" color="tertiary">
                  Group
                </Text>
                <Text variant="bodySmall">{boardingPass.travel.boardingGroup}</Text>
              </View>
            </View>
          </Card>

          <Card variant="default" style={styles.sectionCard}>
            <Text variant="h4">Ticket details</Text>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                Booking ref
              </Text>
              <Text variant="bodySmall">{boardingPass.bookingReference}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                Ticket number
              </Text>
              <Text variant="bodySmall">{boardingPass.ticketNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">
                QR payload
              </Text>
              <Text variant="bodySmall">{boardingPass.qrPayload}</Text>
            </View>
          </Card>
        </>
      ) : (
        <Card variant="outlined" style={styles.loadingCard}>
          <Text variant="bodySmall" color="secondary">
            This boarding pass could not be found.
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
  passCard: {
    gap: spacing[3],
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  metricItem: {
    minWidth: "44%",
    gap: spacing[1],
  },
  sectionCard: {
    gap: spacing[3],
  },
  detailRow: {
    gap: spacing[1],
  },
});
