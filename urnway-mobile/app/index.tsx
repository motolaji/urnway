import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "@/constants/design-tokens";
import { useSession } from "@/providers/session-provider";

const FEATURES = [
  {
    word: "Spend",
    icon: "card-outline" as const,
    description: "Use your crypto anywhere",
  },
  {
    word: "Invest",
    icon: "trending-up-outline" as const,
    description: "Grow your portfolio",
  },
  {
    word: "Pay",
    icon: "send-outline" as const,
    description: "Send money instantly",
  },
  {
    word: "Save",
    icon: "wallet-outline" as const,
    description: "Secure your future",
  },
  {
    word: "Earn",
    icon: "sparkles-outline" as const,
    description: "Get rewards on holdings",
  },
  {
    word: "Borrow",
    icon: "cash-outline" as const,
    description: "Access liquidity fast",
  },
];

// Animated feature carousel
function FeatureCarousel({
  item,
  isActive,
}: {
  item: (typeof FEATURES)[0];
  isActive: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (isActive) {
      opacity.value = withTiming(1, { duration: 500 });
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 100,
      });
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 100,
      });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(30, { duration: 300 });
      scale.value = withTiming(0.9, { duration: 300 });
    }
  }, [isActive, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!isActive) return null;

  return (
    <Animated.View style={[styles.featureItem, animatedStyle]}>
      {/* Icon */}
      <View style={styles.featureIconWrapper}>
        <Ionicons name={item.icon} size={40} color={colors.brand.default} />
      </View>

      {/* Word */}
      <Text variant="h1" align="center" style={styles.featureWord}>
        {item.word}
      </Text>

      {/* Description */}
      <Text variant="body" align="center" style={styles.featureDescription}>
        {item.description}
      </Text>
    </Animated.View>
  );
}

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { clearError, lastError, profile, status } = useSession();
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // Auto-rotate features
  useEffect(() => {
    if (status !== "signed_out") return;

    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % FEATURES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  if (status === "signed_in") {
    if (profile?.username) {
      return <Redirect href={"/(tabs)" as Href} />;
    }
    return <Redirect href={"/onboarding" as Href} />;
  }

  const isLoading = status === "bootstrapping" || status === "authenticating";

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={["#FFFFFF", "#E3F4FC", "#5CB8E6", "#3A9FD6"]}
        locations={[0, 0.4, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing[12],
            paddingBottom: insets.bottom + spacing[8],
          },
        ]}
      >
        {/* Logo Mark */}
        <Animated.View
          entering={FadeIn.duration(600)}
          style={styles.logoSection}
        >
          <View style={styles.logoCircle}>
            {isLoading ? (
              <ActivityIndicator color={colors.grays.white} size="small" />
            ) : (
              <Text style={styles.logoLetter}>U</Text>
            )}
          </View>
          <Text variant="label" style={styles.brandName}>
            URNWAY
          </Text>
        </Animated.View>

        {/* Feature Carousel */}
        <View style={styles.carouselSection}>
          <View style={styles.carouselWrapper}>
            {FEATURES.map((feature, index) => (
              <FeatureCarousel
                key={feature.word}
                item={feature}
                isActive={index === activeFeatureIndex}
              />
            ))}
          </View>
        </View>

        {/* Value Proposition */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(200)}
          style={styles.valueSection}
        >
          <Text variant="h2" align="center" style={styles.headline}>
            Your Bitcoin,{"\n"}Your Journey
          </Text>
          <Text variant="body" align="center" style={styles.subheadline}>
            Unlock liquidity from your BTC without selling.{"\n"}
            Borrow, spend, and travel with MUSD.
          </Text>
        </Animated.View>

        {/* CTA Section */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          style={styles.ctaSection}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.brand.default} size="small" />
              <Text variant="body" weight="medium" style={styles.loadingText}>
                {status === "bootstrapping"
                  ? "Restoring your session..."
                  : "Signing in..."}
              </Text>
            </View>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => {
                  clearError();
                  router.push("/auth" as Href);
                }}
                leftIcon={
                  <Ionicons
                    name="wallet-outline"
                    size={22}
                    color={colors.grays.white}
                  />
                }
              >
                Get Started
              </Button>

              <Text variant="caption" align="center" style={styles.ctaHint}>
                Connect with Mezo Passport
              </Text>

              {lastError && (
                <View style={styles.errorBanner}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={colors.status.error}
                  />
                  <Text variant="bodySmall" style={styles.errorText}>
                    {lastError}
                  </Text>
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Trust Badges */}
        <Animated.View
          entering={FadeIn.duration(600).delay(600)}
          style={styles.trustBadges}
        >
          <View style={styles.badge}>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              Non-custodial
            </Text>
          </View>
          <View style={styles.badgeDivider} />
          <View style={styles.badge}>
            <Ionicons
              name="flash"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              Instant Access
            </Text>
          </View>
          <View style={styles.badgeDivider} />
          <View style={styles.badge}>
            <Ionicons
              name="globe-outline"
              size={16}
              color={colors.text.secondary}
            />
            <Text variant="caption" color="secondary">
              Global
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: "space-between",
  },

  // Logo Section
  logoSection: {
    alignItems: "center",
    gap: spacing[2],
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brand.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoLetter: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 28,
    color: colors.grays.white,
    letterSpacing: 0.5,
  },
  brandName: {
    letterSpacing: 3,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.semiBold,
  },

  // Carousel Section
  carouselSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  carouselWrapper: {
    width: "100%",
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  featureItem: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    gap: spacing[5],
    paddingHorizontal: spacing[4],
  },
  featureIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.grays.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  featureWord: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 56,
    lineHeight: 64,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  featureDescription: {
    fontSize: typography.fontSize.lg,
    color: "#64748B", // Greyish color as requested
    lineHeight: 26,
  },

  // Value Proposition
  valueSection: {
    gap: spacing[3],
    paddingHorizontal: spacing[2],
  },
  headline: {
    lineHeight: 36,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  subheadline: {
    lineHeight: 24,
    color: colors.text.secondary,
  },

  // CTA Section
  ctaSection: {
    gap: spacing[3],
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  loadingText: {
    color: colors.text.primary,
  },
  ctaHint: {
    color: colors.text.tertiary,
    marginTop: -spacing[1],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2.5],
    padding: spacing[4],
    backgroundColor: colors.status.errorLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  errorText: {
    flex: 1,
    color: colors.status.error,
    lineHeight: 20,
  },

  // Trust Badges
  trustBadges: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
  },
  badgeDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border.default,
  },
});
