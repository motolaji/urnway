import { Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Avatar, Button, Card, Text, BalanceCard } from "@/components/ui";
import { colors, spacing, borderRadius, shadows } from "@/constants/design-tokens";
import { getMezoBorrowUrl } from "@/lib/mobile-config";
import {
  ApiError,
  fetchWalletBalance,
  fetchWalletPosition,
  type WalletBalanceResponse,
  type WalletPositionResponse,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

type DashboardState = {
  balance: WalletBalanceResponse["summary"] | null;
  position: WalletPositionResponse["position"] | null;
};

function formatTokenAmount(value: string, maximumFractionDigits = 6) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value));
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  {
    icon: "arrow-up-outline" as const,
    label: "Pay",
    route: "/pay" as Href,
    color: colors.brand.default,
  },
  {
    icon: "wallet-outline" as const,
    label: "Save",
    route: "/save" as Href,
    color: colors.status.success,
  },
  {
    icon: "airplane-outline" as const,
    label: "Trips",
    route: "/trips" as Href,
    color: colors.status.warning,
  },
  {
    icon: "person-outline" as const,
    label: "Profile",
    route: "/profile" as Href,
    color: colors.status.info,
  },
];

export default function HomeScreen() {
  const { clearError, profile, tokens } = useSession();
  const [dashboard, setDashboard] = useState<DashboardState>({
    balance: null,
    position: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadDashboard(accessToken: string, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const [balance, position] = await Promise.all([
        fetchWalletBalance(accessToken),
        fetchWalletPosition(accessToken),
      ]);

      setDashboard({
        balance,
        position,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load your wallet balances."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!tokens?.accessToken) {
      setIsLoading(false);
      return;
    }

    void loadDashboard(tokens.accessToken);
  }, [tokens?.accessToken]);

  async function handleRefresh() {
    if (!tokens?.accessToken) {
      return;
    }

    setIsRefreshing(true);
    await loadDashboard(tokens.accessToken, true);
  }

  async function handleBorrow() {
    clearError();
    const borrowUrl = dashboard.position?.borrowUrl || getMezoBorrowUrl();
    await WebBrowser.openBrowserAsync(borrowUrl);
    await handleRefresh();
  }

  const musdBalance = dashboard.balance
    ? parseFloat(dashboard.balance.musdBalance)
    : 0;

  return (
    <BlurScrollScreen title="Home" contentStyle={styles.container}>
      {/* Header / Greeting */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
        <View style={styles.greetingSection}>
          <Avatar name={profile?.username || "User"} size="lg" />
          <View style={styles.greetingText}>
            <Text variant="bodySmall" color="secondary">
              {getGreeting()}
            </Text>
            <Text variant="h3">
              {profile?.username || "Welcome"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => void handleRefresh()}
          style={styles.refreshButton}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator color={colors.brand.default} size="small" />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={22}
              color={colors.text.secondary}
            />
          )}
        </Pressable>
      </Animated.View>

      {/* Balance Card */}
      <Animated.View entering={FadeInDown.duration(600).delay(100)}>
        {isLoading ? (
          <Card variant="elevated" style={styles.balanceCardLoading}>
            <ActivityIndicator color={colors.brand.default} />
            <Text variant="body" color="secondary">
              Loading your balance...
            </Text>
          </Card>
        ) : errorMessage ? (
          <Card variant="outlined" style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons
                name="alert-circle"
                size={24}
                color={colors.status.error}
              />
              <Text variant="h4">Unable to load balance</Text>
            </View>
            <Text variant="bodySmall" color="secondary">
              {errorMessage}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => void handleRefresh()}
            >
              Try again
            </Button>
          </Card>
        ) : (
          <BalanceCard
            balance={musdBalance}
            label="Spendable MUSD"
            onAddMoney={() => void handleBorrow()}
            addMoneyLabel="Borrow more MUSD"
          />
        )}
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View entering={FadeInDown.duration(600).delay(200)}>
        <View style={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [
                styles.quickActionItem,
                pressed && styles.quickActionPressed,
              ]}
              onPress={() => {
                clearError();
                router.push(action.route);
              }}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: `${action.color}15` },
                ]}
              >
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text variant="caption" weight="medium">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* BTC Holdings */}
      {dashboard.balance && (
        <Animated.View entering={FadeInDown.duration(600).delay(300)}>
          <Card variant="default" style={styles.holdingsCard}>
            <View style={styles.sectionHeader}>
              <Text variant="h4">Your Holdings</Text>
              {dashboard.balance && (
                <Text variant="caption" color="tertiary">
                  Updated {formatTimestamp(dashboard.balance.updatedAt)}
                </Text>
              )}
            </View>

            <View style={styles.holdingItem}>
              <View style={styles.holdingIconContainer}>
                <View style={styles.btcIcon}>
                  <Text style={styles.btcIconText}>₿</Text>
                </View>
              </View>
              <View style={styles.holdingInfo}>
                <Text variant="body" weight="semiBold">
                  Bitcoin
                </Text>
                <Text variant="caption" color="secondary">
                  {dashboard.balance.nativeTokenSymbol} - Native
                </Text>
              </View>
              <View style={styles.holdingValue}>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(dashboard.balance.nativeTokenBalance, 8)}
                </Text>
                <Text variant="caption" color="secondary">
                  {dashboard.balance.nativeTokenSymbol}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.holdingItem}>
              <View style={styles.holdingIconContainer}>
                <View style={styles.musdIcon}>
                  <Text style={styles.musdIconText}>M</Text>
                </View>
              </View>
              <View style={styles.holdingInfo}>
                <Text variant="body" weight="semiBold">
                  MUSD
                </Text>
                <Text variant="caption" color="secondary">
                  Mezo Stablecoin
                </Text>
              </View>
              <View style={styles.holdingValue}>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(dashboard.balance.musdBalance, 2)}
                </Text>
                <Text variant="caption" color="secondary">
                  {dashboard.balance.musdTokenSymbol}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Borrow Info */}
      {dashboard.position && (
        <Animated.View entering={FadeInDown.duration(600).delay(400)}>
          <Card variant="filled" style={styles.infoCard}>
            <View style={styles.infoIconContainer}>
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.brand.default}
              />
            </View>
            <View style={styles.infoContent}>
              <Text variant="label" weight="semiBold">
                About Borrowing
              </Text>
              <Text variant="bodySmall" color="secondary">
                Borrow MUSD through {dashboard.position.borrowProvider} using your
                BTC as collateral. Minimum collateralization ratio is{" "}
                {dashboard.position.minimumCollateralizationRatio}%.
              </Text>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Recent Activity Placeholder */}
      <Animated.View entering={FadeInDown.duration(600).delay(500)}>
        <Card variant="default" style={styles.activityCard}>
          <View style={styles.sectionHeader}>
            <Text variant="h4">Recent Activity</Text>
            <Pressable>
              <Text variant="bodySmall" color="brand">
                See all
              </Text>
            </Pressable>
          </View>

          <View style={styles.emptyActivity}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="time-outline"
                size={32}
                color={colors.text.tertiary}
              />
            </View>
            <Text variant="body" color="secondary" align="center">
              No recent activity
            </Text>
            <Text variant="caption" color="tertiary" align="center">
              Your transactions will appear here
            </Text>
          </View>
        </Card>
      </Animated.View>
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[5],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greetingSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  greetingText: {
    gap: spacing[0.5],
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  balanceCardLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[10],
    gap: spacing[3],
  },
  errorCard: {
    gap: spacing[3],
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  quickActionPressed: {
    opacity: 0.7,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  holdingsCard: {
    gap: spacing[4],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  holdingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  holdingIconContainer: {
    width: 44,
    height: 44,
  },
  btcIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: "#F7931A",
    alignItems: "center",
    justifyContent: "center",
  },
  btcIconText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.grays.white,
  },
  musdIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
  },
  musdIconText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.grays.white,
  },
  holdingInfo: {
    flex: 1,
    gap: spacing[0.5],
  },
  holdingValue: {
    alignItems: "flex-end",
    gap: spacing[0.5],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
    marginVertical: spacing[1],
  },
  infoCard: {
    flexDirection: "row",
    gap: spacing[3],
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.light,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: spacing[1],
  },
  activityCard: {
    gap: spacing[4],
  },
  emptyActivity: {
    alignItems: "center",
    paddingVertical: spacing[6],
    gap: spacing[2],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
});
