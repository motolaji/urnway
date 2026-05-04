import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { useSession } from "@/providers/session-provider";

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { clearError, logout, profile, status } = useSession();

  return (
    <BlurScrollScreen title="Profile" contentStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Identity</Text>
        <Text style={styles.title}>
          {profile?.displayName ?? "No active Urnway session"}
        </Text>
        <Text style={styles.subtitle}>
          This screen is now wired to the real auth state instead of Expo starter content.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current session</Text>
        <ProfileRow label="Status" value={status} />
        <ProfileRow
          label="Wallet"
          value={profile?.walletAddress ?? "Sign in required"}
        />
        <ProfileRow label="Username" value={profile?.username ?? "Not set"} />
        <ProfileRow label="Mezo ID" value={profile?.mezoId ?? "Not set"} />
        <ProfileRow label="Email" value={profile?.email ?? "Not set"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session actions</Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => {
              clearError();
              router.push("/auth" as Href);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Reopen auth flow</Text>
          </Pressable>
          <Pressable
            disabled={!profile}
            onPress={() => void logout()}
            style={[styles.primaryButton, !profile && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Log out</Text>
          </Pressable>
        </View>
      </View>
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    gap: 18,
    backgroundColor: "#f7f1e8",
  },
  hero: {
    borderRadius: 28,
    backgroundColor: "#fffaf3",
    padding: 22,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#0e7a63",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    color: "#1b150f",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#635448",
  },
  card: {
    borderRadius: 26,
    backgroundColor: "#fffaf3",
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1b150f",
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d7ccbe",
    paddingTop: 14,
    gap: 6,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#7a695e",
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1b150f",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: "#0e7a63",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: "#efe2cf",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#1b150f",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.4,
  },
});
