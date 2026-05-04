import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { parseTransactionCallbackParams } from "@/lib/tx-contract";

export default function TransactionCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    status?: string | string[];
    txHash?: string | string[];
    slug?: string | string[];
    source?: string | string[];
    message?: string | string[];
  }>();

  const result = useMemo(() => {
    try {
      return parseTransactionCallbackParams(params);
    } catch {
      return null;
    }
  }, [params]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Transaction callback</Text>
        <Text style={styles.title}>
          {result?.status === "submitted"
            ? "Transfer submitted"
            : "Transaction handoff finished"}
        </Text>
        <Text style={styles.subtitle}>
          {result?.status === "submitted"
            ? `Urnway received the transaction hash${result.txHash ? ` ${result.txHash.slice(0, 12)}...` : ""}.`
            : result?.message || "You can return to the Pay tab and continue from there."}
        </Text>

        <Pressable
          onPress={() => router.replace("/pay" as Href)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Return to Pay</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f1e8",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#fffaf3",
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#0e7a63",
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: "#1b150f",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#635448",
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#0e7a63",
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
