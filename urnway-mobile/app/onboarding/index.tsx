import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Text } from "@/components/ui";
import { colors, spacing, borderRadius, typography } from "@/constants/design-tokens";
import { useSession } from "@/providers/session-provider";

function buildSuggestedUsername(walletAddress: string) {
  const normalized = walletAddress.toLowerCase().replace(/^0x/, "");
  return `urnway_${normalized.slice(0, 6)}`.slice(0, 30);
}

function normalizeHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    clearError,
    completeOnboarding,
    lastError,
    profile,
    status,
  } = useSession();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;

    setUsername((currentValue) => {
      if (currentValue.trim().length > 0) return currentValue;
      return (
        profile.username ??
        profile.mezoId ??
        buildSuggestedUsername(profile.walletAddress)
      );
    });

    setEmail((currentValue) => {
      if (currentValue.trim().length > 0) return currentValue;
      return profile.email ?? "";
    });
  }, [profile]);

  if (status === "bootstrapping") {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="body" weight="medium">Loading your profile...</Text>
      </View>
    );
  }

  if (status === "signed_out" || !profile) {
    return <Redirect href={"/" as Href} />;
  }

  if (profile.username) {
    return <Redirect href={"/(tabs)" as Href} />;
  }

  async function handleContinue() {
    const normalizedUsername = normalizeHandle(username);
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setLocalError(
        "Choose a username with 3-30 lowercase letters, numbers, or underscores."
      );
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      await completeOnboarding({
        username: normalizedUsername,
        mezoId: normalizedUsername,
        email: normalizedEmail.length > 0 ? normalizedEmail : undefined,
      });
      router.replace("/(tabs)" as Href);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "We could not finish onboarding."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorMessage = localError ?? lastError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#FFFFFF", "#E8F6FC", colors.brand.light]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        entering={FadeInDown.duration(500)}
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing[8],
            paddingBottom: insets.bottom + spacing[6],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.text.primary}
              />
            }
          >
            Back
          </Button>
        </View>

        {/* Form Card */}
        <Card variant="default" style={styles.formCard}>
          <Text variant="eyebrow">Almost there</Text>
          <Text variant="h3">Create your profile</Text>
          <Text variant="bodySmall" color="secondary">
            Choose a username for your Urnway account. This will be visible to others.
          </Text>

          {/* Wallet Display */}
          <View style={styles.walletDisplay}>
            <Ionicons
              name="wallet-outline"
              size={18}
              color={colors.text.tertiary}
            />
            <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.walletText}>
              {profile.walletAddress}
            </Text>
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text variant="label">Username</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                clearError();
                setLocalError(null);
                setUsername(value);
              }}
              placeholder="urnway_traveler"
              placeholderTextColor={colors.text.tertiary}
              style={styles.input}
              value={username}
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text variant="label">Email (optional)</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(value) => {
                clearError();
                setLocalError(null);
                setEmail(value);
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.text.tertiary}
              style={styles.input}
              value={email}
            />
          </View>

          {/* Error */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle"
                size={16}
                color={colors.status.error}
              />
              <Text variant="bodySmall" style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isSubmitting || status === "authenticating"}
            onPress={() => void handleContinue()}
          >
            Save and Continue
          </Button>
        </Card>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: "row",
    marginBottom: spacing[4],
  },
  formCard: {
    gap: spacing[4],
  },
  walletDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
  },
  walletText: {
    flex: 1,
  },
  inputGroup: {
    gap: spacing[2],
  },
  input: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  errorContainer: {
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
});
