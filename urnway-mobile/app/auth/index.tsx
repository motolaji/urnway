import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
} from "react-native-webview/lib/WebViewTypes";

import { Button, Card, Text, IconButton } from "@/components/ui";
import { colors, spacing, borderRadius, shadows } from "@/constants/design-tokens";
import {
  parseAuthBridgeMessage,
  parseAuthCallbackUrl,
} from "@/lib/auth-contract";
import { buildAuthWebUrl, getMobileRedirectUri } from "@/lib/mobile-config";
import { useSession } from "@/providers/session-provider";

type BrowserStatus = "idle" | "opening" | "webview";

const STEPS = [
  {
    icon: "wallet-outline" as const,
    title: "Connect Wallet",
    description: "Link your crypto wallet securely",
  },
  {
    icon: "finger-print-outline" as const,
    title: "Sign Message",
    description: "Verify ownership with a signature",
  },
  {
    icon: "checkmark-circle-outline" as const,
    title: "You're In",
    description: "Start using Urnway instantly",
  },
];

export default function AuthBrowserModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    return_to?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { clearError, completeAuth, lastError, status } = useSession();
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>("idle");
  const [browserError, setBrowserError] = useState<string | null>(null);
  const authHandledRef = useRef(false);
  const returnTo = Array.isArray(params.return_to)
    ? params.return_to[0]
    : params.return_to;

  const authWebUrl = buildAuthWebUrl();
  const redirectUri = getMobileRedirectUri();
  const authWebOrigin = useMemo(() => {
    try {
      return new URL(authWebUrl).origin;
    } catch {
      return null;
    }
  }, [authWebUrl]);
  const isAndroidInAppBrowser = Platform.OS === "android";
  const showWebView = isAndroidInAppBrowser && browserStatus === "webview";
  const isBusy =
    browserStatus === "opening" ||
    browserStatus === "webview" ||
    status === "authenticating";

  const errorMessage = browserError || lastError;

  async function finishAuth(payload: ReturnType<typeof parseAuthBridgeMessage>) {
    if (authHandledRef.current) {
      return;
    }

    authHandledRef.current = true;
    await completeAuth(payload);
    router.replace((returnTo || "/") as Href);
  }

  function resetFlowState() {
    authHandledRef.current = false;
    setBrowserStatus("idle");
  }

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    try {
      clearError();
      setBrowserError(null);
      const payload = parseAuthBridgeMessage(event.nativeEvent.data);
      await finishAuth(payload);
    } catch (error) {
      authHandledRef.current = false;
      setBrowserError(
        error instanceof Error ? error.message : "Could not finish Android sign-in."
      );
      setBrowserStatus("idle");
    }
  }

  function shouldOpenExternally(url: string) {
    if (!url) {
      return false;
    }

    if (url.startsWith(redirectUri)) {
      return true;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!authWebOrigin) {
        return false;
      }

      try {
        return new URL(url).origin !== authWebOrigin;
      } catch {
        return false;
      }
    }

    return true;
  }

  function handleShouldStartLoad(request: ShouldStartLoadRequest) {
    const nextUrl = request.url;

    if (!showWebView) {
      return true;
    }

    if (!shouldOpenExternally(nextUrl)) {
      return true;
    }

    if (nextUrl.startsWith(redirectUri)) {
      try {
        const payload = parseAuthCallbackUrl(nextUrl);
        void finishAuth(payload);
      } catch (error) {
        authHandledRef.current = false;
        setBrowserError(
          error instanceof Error
            ? error.message
            : "Could not complete the returned auth callback."
        );
        setBrowserStatus("idle");
      }

      return false;
    }

    void Linking.openURL(nextUrl).catch(() => {
      setBrowserError(`Can't open URL: ${nextUrl}`);
    });

    return false;
  }

  async function handleContinue() {
    clearError();
    setBrowserError(null);
    authHandledRef.current = false;

    if (isAndroidInAppBrowser) {
      setBrowserStatus("webview");
      return;
    }

    setBrowserStatus("opening");

    try {
      const result = await WebBrowser.openAuthSessionAsync(authWebUrl, redirectUri);

      if (result.type === "success" && "url" in result && result.url) {
        const payload = parseAuthCallbackUrl(result.url);
        await finishAuth(payload);
        return;
      }

      if (result.type === "cancel" || result.type === "dismiss") {
        setBrowserError("Sign-in was cancelled. Tap continue to try again.");
        return;
      }

      setBrowserError("Something went wrong. Please try again.");
    } catch (error) {
      setBrowserError(
        error instanceof Error ? error.message : "Could not start sign-in. Please try again."
      );
    } finally {
      if (!isAndroidInAppBrowser) {
        setBrowserStatus("idle");
      }
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[6],
        },
      ]}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <IconButton
          variant="ghost"
          size="md"
          icon={<Ionicons name="close" size={24} color={colors.text.primary} />}
          onPress={() => {
            if (showWebView) {
              resetFlowState();
              return;
            }

            router.back();
          }}
        />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {showWebView ? (
          <View style={styles.webViewShell}>
            <View style={styles.webViewHeader}>
              <Text variant="label" weight="semiBold">
                Mezo Passport
              </Text>
              <Text variant="caption" color="secondary">
                Android uses an in-app browser here to keep the auth flow stable.
              </Text>
            </View>

            <View style={styles.webViewCard}>
              <WebView
                source={{ uri: authWebUrl }}
                originWhitelist={["*"]}
                onMessage={(event) => {
                  void handleWebViewMessage(event);
                }}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                setSupportMultipleWindows={false}
                startInLoadingState
                onError={(event) => {
                  setBrowserError(event.nativeEvent.description);
                  setBrowserStatus("idle");
                  authHandledRef.current = false;
                }}
              />
            </View>
          </View>
        ) : (
          <>
        {/* Hero Section */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.heroSection}
        >
          <View style={styles.iconContainer}>
            <View style={styles.iconInner}>
              <Ionicons
                name="key-outline"
                size={32}
                color={colors.brand.default}
              />
            </View>
          </View>

          <View style={styles.textSection}>
            <Text variant="h2" align="center">
              Sign in with{"\n"}Mezo Passport
            </Text>
            <Text variant="body" color="secondary" align="center">
              Your wallet is your identity. No passwords, no emails - just
              secure blockchain authentication.
            </Text>
          </View>
        </Animated.View>

        {/* Steps */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(300)}
          style={styles.stepsSection}
        >
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.stepItem}>
              <View style={styles.stepIconWrapper}>
                <View style={styles.stepIcon}>
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={colors.brand.default}
                  />
                </View>
                {index < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={styles.stepContent}>
                <Text variant="label" weight="semiBold">
                  {step.title}
                </Text>
                <Text variant="caption" color="secondary">
                  {step.description}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Error Message */}
        {errorMessage && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card variant="outlined" style={styles.errorCard}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={colors.status.error}
              />
              <Text variant="bodySmall" style={styles.errorText}>
                {errorMessage}
              </Text>
            </Card>
          </Animated.View>
        )}
          </>
        )}
      </View>

      {/* Footer Actions */}
      <Animated.View
        entering={FadeInDown.duration(600).delay(500)}
        style={styles.footer}
      >
        {!showWebView ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isBusy}
            onPress={() => void handleContinue()}
            leftIcon={
              !isBusy && (
                <Ionicons
                  name="open-outline"
                  size={20}
                  color={colors.grays.white}
                />
              )
            }
          >
            {isAndroidInAppBrowser
              ? "Continue in app"
              : isBusy
                ? "Opening Passport..."
                : "Continue to Passport"}
          </Button>
        ) : null}

        <View style={styles.securityNote}>
          <Ionicons
            name="shield-checkmark"
            size={14}
            color={colors.text.tertiary}
          />
          <Text variant="caption" color="tertiary" align="center">
            Secured by Mezo Protocol
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing[4],
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing[8],
  },
  heroSection: {
    alignItems: "center",
    gap: spacing[6],
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.light,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  textSection: {
    gap: spacing[3],
    maxWidth: 300,
  },
  stepsSection: {
    gap: spacing[1],
    paddingHorizontal: spacing[2],
  },
  stepItem: {
    flexDirection: "row",
    gap: spacing[4],
  },
  stepIconWrapper: {
    alignItems: "center",
    width: 36,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.light,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.brand.subtle,
    marginVertical: spacing[1],
    borderRadius: 1,
  },
  stepContent: {
    flex: 1,
    gap: spacing[0.5],
    paddingBottom: spacing[4],
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    borderColor: colors.status.error,
    backgroundColor: colors.status.errorLight,
  },
  errorText: {
    flex: 1,
    color: colors.status.error,
  },
  footer: {
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  webViewShell: {
    flex: 1,
    gap: spacing[4],
  },
  webViewHeader: {
    gap: spacing[1],
  },
  webViewCard: {
    flex: 1,
    overflow: "hidden",
    borderRadius: borderRadius["2xl"],
    backgroundColor: colors.background.card,
    ...shadows.md,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1.5],
  },
});
