import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";
import { type Href, useRouter } from "expo-router";
import {
  Badge,
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/constants/design-tokens";
import { useSession } from "@/providers/session-provider";

export default function TabLayout() {
  const router = useRouter();
  const { profile, status } = useSession();
  const pendingRedirect = useRef<Href | null>(null);

  const redirectTarget =
    status === "signed_out"
      ? ("/" as Href)
      : !profile?.username
        ? ("/onboarding" as Href)
        : null;

  useEffect(() => {
    if (!redirectTarget) {
      pendingRedirect.current = null;
      return;
    }

    if (pendingRedirect.current === redirectTarget) {
      return;
    }

    pendingRedirect.current = redirectTarget;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (status === "bootstrapping" || status === "authenticating") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.brand.default} size="large" />
        <Text style={styles.loadingTitle}>Preparing your workspace...</Text>
      </View>
    );
  }

  if (redirectTarget) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.brand.default} size="large" />
        <Text style={styles.loadingTitle}>Leaving tabs...</Text>
      </View>
    );
  }

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon src={<VectorIcon family={Octicons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pay">
        <Icon src={<VectorIcon family={Octicons} name="arrow-switch" />} />
        <Label>Pay</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips">
        <Icon
          src={<VectorIcon family={MaterialIcons} name="airplane-ticket" />}
        />
        <Badge>9+</Badge>
        <Label>Trips</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="save">
        <Icon
          src={
            <VectorIcon
              family={MaterialCommunityIcons}
              name="piggy-bank-outline"
            />
          }
        />
        <Label>Save</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon src={<VectorIcon family={Octicons} name="person" />} />
        <Badge />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    padding: spacing[6],
    backgroundColor: colors.background.secondary,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
