import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { parseAuthCallbackParams } from "@/lib/auth-contract";
import { useSession } from "@/providers/session-provider";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    walletAddress?: string | string[];
    message?: string | string[];
    signature?: string | string[];
  }>();
  const router = useRouter();
  const { clearError, completeAuth } = useSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasSubmittedRef = useRef(false);
  const walletAddressParam = Array.isArray(params.walletAddress)
    ? params.walletAddress[0]
    : params.walletAddress;
  const messageParam = Array.isArray(params.message)
    ? params.message[0]
    : params.message;
  const signatureParam = Array.isArray(params.signature)
    ? params.signature[0]
    : params.signature;
  const payload = useMemo(() => {
    try {
      return parseAuthCallbackParams({
        walletAddress: walletAddressParam,
        message: messageParam,
        signature: signatureParam,
      });
    } catch {
      return null;
    }
  }, [messageParam, signatureParam, walletAddressParam]);

  useEffect(() => {
    let active = true;

    async function finishAuth() {
      try {
        if (hasSubmittedRef.current) {
          return;
        }

        if (!payload) {
          throw new Error("The callback payload could not be read.");
        }

        hasSubmittedRef.current = true;
        clearError();
        await completeAuth(payload);

        if (active) {
          router.replace("/" as Href);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The callback payload could not be completed."
        );
        hasSubmittedRef.current = false;
      }
    }

    void finishAuth();

    return () => {
      active = false;
    };
  }, [clearError, completeAuth, payload, router]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Completing sign-in</Text>
        <Text style={styles.title}>Verifying your Passport signature</Text>
        <Text style={styles.subtitle}>Finishing the handoff and returning to the app.</Text>

        {errorMessage ? (
          <>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => router.replace("/auth" as Href)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Retry sign-in</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.progressRow}>
            <ActivityIndicator color="#0e7a63" />
            <Text style={styles.progressText}>Verifying the returned signature...</Text>
          </View>
        )}
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
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  progressText: {
    color: "#1b150f",
    fontWeight: "600",
  },
  errorText: {
    color: "#8a3b2d",
    lineHeight: 20,
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
