import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Badge, Button, Card, Text } from "@/components/ui";
import { colors, spacing } from "@/constants/design-tokens";
import {
  ApiError,
  fetchBoardingPassesWithCache,
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

function formatCacheDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortBoardingPasses(boardingPasses: BoardingPass[]) {
  return [...boardingPasses].sort((left, right) =>
    left.travel.departDate.localeCompare(right.travel.departDate)
  );
}

export default function BoardingPassListScreen() {
  const router = useRouter();
  const { tokens } = useSession();
  const [boardingPasses, setBoardingPasses] = useState<BoardingPass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<CachedResourceSource>("network");
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens?.accessToken) {
      setBoardingPasses([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await fetchBoardingPassesWithCache(tokens.accessToken);

        if (!isActive) {
          return;
        }

        setBoardingPasses(result.boardingPasses);
        setSource(result.source);
        setCachedAt(result.cachedAt);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load your boarding passes."
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
  }, [tokens?.accessToken]);

  const sortedBoardingPasses = useMemo(
    () => sortBoardingPasses(boardingPasses),
    [boardingPasses]
  );
  const activeCount = sortedBoardingPasses.filter(
    (boardingPass) => boardingPass.status !== "voided"
  ).length;
  const voidedCount = sortedBoardingPasses.length - activeCount;

  return (
    <BlurScrollScreen title="Boarding passes" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text variant="eyebrow">Boarding passes</Text>
        <Text variant="h3">Travel artifacts</Text>
        <Text variant="bodySmall" color="secondary">
          Your issued flight passes live here. Cached copies stay readable if you lose connection.
        </Text>
      </View>

      {source === "cache" ? (
        <Card variant="outlined" style={styles.messageCard}>
          <Badge variant="warning">Offline cache</Badge>
          <Text variant="bodySmall" color="secondary">
            Showing the last saved passes{formatCacheDate(cachedAt) ? ` from ${formatCacheDate(cachedAt)}.` : "."}
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

      <Card variant="elevated" style={styles.summaryCard}>
        <View style={styles.summaryMetric}>
          <Text variant="caption" color="tertiary">
            Total passes
          </Text>
          <Text variant="h3">{sortedBoardingPasses.length}</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text variant="caption" color="tertiary">
            Active
          </Text>
          <Text variant="h3">{activeCount}</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text variant="caption" color="tertiary">
            Voided
          </Text>
          <Text variant="h3">{voidedCount}</Text>
        </View>
      </Card>

      {isLoading ? (
        <Card variant="outlined" style={styles.loadingCard}>
          <ActivityIndicator color={colors.brand.default} />
          <Text variant="bodySmall" color="secondary">
            Loading boarding passes...
          </Text>
        </Card>
      ) : sortedBoardingPasses.length > 0 ? (
        sortedBoardingPasses.map((boardingPass) => (
          <Pressable
            key={boardingPass.id}
            onPress={() => router.push(`/boarding-passes/${boardingPass.id}`)}
          >
            <Card variant="default" style={styles.passCard}>
              <View style={styles.passTopRow}>
                <View style={styles.passRouteBlock}>
                  <Text variant="h4">
                    {boardingPass.travel.originCode} to {boardingPass.travel.destinationCode}
                  </Text>
                  <Text variant="bodySmall" color="secondary">
                    {boardingPass.travel.carrierName} · {boardingPass.travel.flightNumber} · {formatDate(boardingPass.travel.departDate)}
                  </Text>
                </View>
                <Badge
                  variant={boardingPass.status === "voided" ? "error" : "success"}
                >
                  {boardingPass.status}
                </Badge>
              </View>

              <View style={styles.passMetaRow}>
                <View style={styles.passMetaItem}>
                  <Text variant="caption" color="tertiary">
                    Passenger
                  </Text>
                  <Text variant="bodySmall">{boardingPass.passengerName}</Text>
                </View>
                <View style={styles.passMetaItem}>
                  <Text variant="caption" color="tertiary">
                    Seat
                  </Text>
                  <Text variant="bodySmall">{boardingPass.travel.seat}</Text>
                </View>
                <View style={styles.passMetaItem}>
                  <Text variant="caption" color="tertiary">
                    Gate
                  </Text>
                  <Text variant="bodySmall">{boardingPass.travel.gate}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text variant="h4">No boarding passes yet</Text>
          <Text variant="bodySmall" color="secondary">
            Issue a ticket from a flight booking and it will show up here.
          </Text>
          <Button
            variant="secondary"
            onPress={() => router.replace("/(tabs)/trips")}
          >
            Back to trips
          </Button>
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
  summaryCard: {
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
  },
  summaryMetric: {
    flex: 1,
    gap: spacing[1],
  },
  loadingCard: {
    gap: spacing[3],
    alignItems: "center",
  },
  passCard: {
    gap: spacing[3],
  },
  passTopRow: {
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  passRouteBlock: {
    flex: 1,
    gap: spacing[1],
  },
  passMetaRow: {
    flexDirection: "row",
    gap: spacing[3],
    flexWrap: "wrap",
  },
  passMetaItem: {
    minWidth: "28%",
    gap: spacing[1],
  },
  emptyCard: {
    gap: spacing[3],
    alignItems: "flex-start",
  },
});
