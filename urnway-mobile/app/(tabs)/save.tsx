import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Badge, Button, Card, IconButton, Input, Text } from "@/components/ui";
import {
  borderRadius,
  colors,
  shadows,
  spacing,
} from "@/constants/design-tokens";
import { getMezoSaveEarnUrl } from "@/lib/mobile-config";
import {
  ApiError,
  createVaultGoal,
  fetchVaultGoals,
  fetchWalletBalance,
  type VaultGoal,
  type WalletBalanceResponse,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

type SaveState = {
  summary: {
    totalTargetAmount: string;
    totalAllocatedAmount: string;
    activeVaultCount: number;
    currency: string;
  } | null;
  goals: VaultGoal[];
  walletBalance: WalletBalanceResponse["summary"] | null;
};

function formatTokenAmount(value: string, maximumFractionDigits = 2) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(parsed);
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function SaveScreen() {
  const { clearError, tokens } = useSession();
  const [saveState, setSaveState] = useState<SaveState>({
    summary: null,
    goals: [],
    walletBalance: null,
  });
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [goalNote, setGoalNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLaunchingMezo, setIsLaunchingMezo] = useState(false);

  async function loadSaveData(accessToken: string, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const [vaults, walletBalance] = await Promise.all([
        fetchVaultGoals(accessToken),
        fetchWalletBalance(accessToken),
      ]);

      setSaveState({
        summary: vaults.summary,
        goals: vaults.vaults,
        walletBalance,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load your travel goals right now."
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

    void loadSaveData(tokens.accessToken);
  }, [tokens?.accessToken]);

  async function handleRefresh() {
    if (!tokens?.accessToken) {
      return;
    }

    setIsRefreshing(true);
    await loadSaveData(tokens.accessToken, true);
  }

  async function handleCreateGoal() {
    if (!tokens?.accessToken || isCreating) {
      return;
    }

    if (!goalName.trim()) {
      setErrorMessage("Add a goal name before creating a savings goal.");
      return;
    }

    if (!targetAmount.trim()) {
      setErrorMessage("Add a target amount before creating a savings goal.");
      return;
    }

    clearError();
    setIsCreating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const createdGoal = await createVaultGoal(
        {
          name: goalName.trim(),
          targetAmount: targetAmount.trim(),
          note: goalNote.trim() || undefined,
        },
        tokens.accessToken
      );

      setSaveState((current) => {
        const nextGoals = [createdGoal, ...current.goals];
        const totalTarget = nextGoals.reduce(
          (sum, goal) => sum + Number.parseFloat(goal.targetAmount || "0"),
          0
        );
        const totalAllocated = nextGoals.reduce(
          (sum, goal) => sum + Number.parseFloat(goal.allocatedAmount || "0"),
          0
        );

        return {
          summary: {
            totalTargetAmount: totalTarget.toFixed(2).replace(/\.00$/, ""),
            totalAllocatedAmount: totalAllocated.toFixed(2).replace(/\.00$/, ""),
            activeVaultCount: nextGoals.filter((goal) => goal.status === "active").length,
            currency: current.summary?.currency ?? "MUSD",
          },
          goals: nextGoals,
          walletBalance: current.walletBalance,
        };
      });

      setGoalName("");
      setTargetAmount("");
      setGoalNote("");
      setStatusMessage("Travel goal created. Fund it through Mezo when you're ready.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not create the travel goal."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleOpenMezo(goal?: VaultGoal) {
    clearError();
    setErrorMessage(null);
    setStatusMessage(
      goal
        ? `Opening Mezo Save/Earn for ${goal.name}. Choose the MUSD Savings Vault to fund this goal.`
        : "Opening Mezo Save/Earn. Choose the MUSD Savings Vault to keep this flow simple."
    );
    setIsLaunchingMezo(true);

    try {
      await WebBrowser.openBrowserAsync(getMezoSaveEarnUrl());
      setStatusMessage(
        goal
          ? `Returned from Mezo. ${goal.name} stays tracked here while native vault accounting is added later.`
          : "Returned from Mezo. Your travel goals stay in Urnway while native vault accounting is added later."
      );

      if (tokens?.accessToken) {
        await loadSaveData(tokens.accessToken, true);
      }
    } finally {
      setIsLaunchingMezo(false);
    }
  }

  const totalTarget = saveState.summary?.totalTargetAmount ?? "0";
  const totalAllocated = saveState.summary?.totalAllocatedAmount ?? "0";
  const availableMusd = saveState.walletBalance?.musdBalance ?? "0";

  return (
    <BlurScrollScreen title="Save" contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text variant="eyebrow">Save</Text>
          <Text variant="h3">Travel goals plus Mezo yield</Text>
          <Text variant="bodySmall" color="secondary">
            Track the goals in Urnway. Deposit into Mezo&apos;s MUSD Savings Vault when you want the real yield leg.
          </Text>
        </View>
        <IconButton
          variant="outlined"
          size="md"
          onPress={() => void handleRefresh()}
          disabled={isRefreshing}
          icon={
            isRefreshing ? (
              <ActivityIndicator color={colors.brand.default} size="small" />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.text.secondary}
              />
            )
          }
        />
      </View>

      <Card variant="elevated" style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.badgeRow}>
            <Badge>Launchpad</Badge>
            <Badge variant="success">MUSD vault</Badge>
          </View>
          <Text variant="caption" color="tertiary">
            {saveState.summary?.activeVaultCount ?? 0} active goals
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text variant="caption" color="tertiary">
              Total target
            </Text>
            <Text variant="h3">{formatTokenAmount(totalTarget)} MUSD</Text>
          </View>
          <View style={styles.metricItem}>
            <Text variant="caption" color="tertiary">
              Allocated in app
            </Text>
            <Text variant="h3">{formatTokenAmount(totalAllocated)} MUSD</Text>
          </View>
          <View style={styles.metricItem}>
            <Text variant="caption" color="tertiary">
              Available now
            </Text>
            <Text variant="h3">{formatTokenAmount(availableMusd)} MUSD</Text>
          </View>
        </View>

        <Button
          variant="primary"
          fullWidth
          loading={isLaunchingMezo}
          onPress={() => void handleOpenMezo()}
        >
          Save with Mezo
        </Button>
      </Card>

      {errorMessage ? (
        <Card variant="outlined" style={styles.feedbackCard}>
          <Text variant="h4">Could not load Save</Text>
          <Text variant="bodySmall" color="secondary">
            {errorMessage}
          </Text>
        </Card>
      ) : null}

      {statusMessage ? (
        <Card variant="filled" style={styles.feedbackCard}>
          <Text variant="h4">How this works</Text>
          <Text variant="bodySmall" color="secondary">
            {statusMessage}
          </Text>
        </Card>
      ) : null}

      <Card variant="default" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text variant="h4">Create a travel goal</Text>
          <Text variant="bodySmall" color="secondary">
            Use Urnway for planning, then Mezo for the actual savings vault.
          </Text>
        </View>

        <Input
          label="Goal name"
          placeholder="Tokyo spring trip"
          value={goalName}
          onChangeText={setGoalName}
        />
        <Input
          label="Target amount (MUSD)"
          placeholder="1200"
          keyboardType="decimal-pad"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />
        <Input
          label="Note (optional)"
          placeholder="Flights + hotel"
          value={goalNote}
          onChangeText={setGoalNote}
        />

        <Button
          variant="secondary"
          fullWidth
          loading={isCreating}
          onPress={() => void handleCreateGoal()}
        >
          Create goal
        </Button>
      </Card>

      <View style={styles.sectionHeader}>
        <View>
          <Text variant="h4">Travel goals</Text>
          <Text variant="bodySmall" color="secondary">
            One Mezo savings position can support many goals inside Urnway.
          </Text>
        </View>
      </View>

      {isLoading ? (
        <Card variant="default" style={styles.loadingCard}>
          <ActivityIndicator color={colors.brand.default} />
          <Text variant="bodySmall" color="secondary">
            Loading your savings goals...
          </Text>
        </Card>
      ) : saveState.goals.length === 0 ? (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text variant="h4">No travel goals yet</Text>
          <Text variant="bodySmall" color="secondary">
            Create your first goal, then use Mezo&apos;s MUSD Savings Vault when you&apos;re ready to start earning.
          </Text>
        </Card>
      ) : (
        saveState.goals.map((goal) => (
          <Card key={goal.id} variant="default" style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalHeaderCopy}>
                <Text variant="h4">{goal.name}</Text>
                <Text variant="bodySmall" color="secondary">
                  Created {formatTimestamp(goal.createdAt)}
                </Text>
              </View>
              <Badge variant={goal.status === "active" ? "info" : "warning"}>
                {goal.status}
              </Badge>
            </View>

            {goal.note ? (
              <Text variant="bodySmall" color="secondary">
                {goal.note}
              </Text>
            ) : null}

            <View style={styles.goalMetricRow}>
              <View style={styles.goalMetricItem}>
                <Text variant="caption" color="tertiary">
                  Target
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(goal.targetAmount)} {goal.currency}
                </Text>
              </View>
              <View style={styles.goalMetricItem}>
                <Text variant="caption" color="tertiary">
                  Allocated
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(goal.allocatedAmount)} {goal.currency}
                </Text>
              </View>
              <View style={styles.goalMetricItem}>
                <Text variant="caption" color="tertiary">
                  Remaining
                </Text>
                <Text variant="body" weight="semiBold">
                  {formatTokenAmount(goal.remainingAmount)} {goal.currency}
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      goal.progressPercent <= 0
                        ? "0%"
                        : `${Math.max(6, goal.progressPercent)}%`,
                  },
                ]}
              />
            </View>
            <Text variant="caption" color="tertiary">
              {goal.progressPercent.toFixed(1)}% tracked in Urnway
            </Text>

            <Button
              variant="outline"
              fullWidth
              onPress={() => void handleOpenMezo(goal)}
            >
              Fund goal
            </Button>
          </Card>
        ))
      )}

      <Card variant="filled" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text variant="h4">Why this opens Mezo</Text>
          <Text variant="bodySmall" color="secondary">
            The actual savings product is Mezo&apos;s MUSD Savings Vault. Urnway keeps the travel-goal framing and will add deeper native vault reads once Mezo exposes the direct integration surface more clearly.
          </Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text variant="h4">Advanced earn</Text>
            <Text variant="bodySmall" color="secondary">
              LP pools and gauge strategies stay out of the main Save UX for now.
            </Text>
          </View>
          <Badge variant="warning">Later</Badge>
        </View>

        <View style={styles.advancedList}>
          <View style={styles.advancedItem}>
            <Ionicons name="layers-outline" size={18} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary">
              MUSD/BTC LP
            </Text>
          </View>
          <View style={styles.advancedItem}>
            <Ionicons name="layers-outline" size={18} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary">
              MUSD/mUSDC LP
            </Text>
          </View>
          <View style={styles.advancedItem}>
            <Ionicons name="layers-outline" size={18} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary">
              Gauges and emissions
            </Text>
          </View>
        </View>
      </Card>
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing[4],
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing[2],
  },
  summaryCard: {
    gap: spacing[5],
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "center",
    flexWrap: "wrap",
  },
  metricGrid: {
    gap: spacing[4],
  },
  metricItem: {
    gap: spacing[1],
  },
  feedbackCard: {
    gap: spacing[2],
  },
  sectionCard: {
    gap: spacing[4],
  },
  sectionHeader: {
    gap: spacing[1.5],
  },
  loadingCard: {
    gap: spacing[3],
    alignItems: "center",
  },
  emptyCard: {
    gap: spacing[2],
  },
  goalCard: {
    gap: spacing[4],
  },
  goalHeader: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  goalHeaderCopy: {
    flex: 1,
    gap: spacing[1],
  },
  goalMetricRow: {
    flexDirection: "row",
    gap: spacing[3],
    flexWrap: "wrap",
  },
  goalMetricItem: {
    minWidth: 96,
    gap: spacing[1],
  },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand.default,
    borderRadius: borderRadius.full,
    minWidth: 0,
  },
  advancedList: {
    gap: spacing[3],
  },
  advancedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.secondary,
    ...shadows.none,
  },
});
