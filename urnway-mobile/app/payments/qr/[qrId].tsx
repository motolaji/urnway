import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
} from "react-native-webview/lib/WebViewTypes";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import {
  buildAuthWebTransactionUrl,
  getMobileTransactionRedirectUri,
} from "@/lib/mobile-config";
import {
  ApiError,
  fetchPublicPaymentQr,
  preflightPaymentQr,
  submitPaymentLink,
  type PaymentLinkPreflight,
  type PaymentQrRequest,
} from "@/lib/session";
import {
  parseTransactionCallbackUrl,
  parseTransactionBridgeMessage,
} from "@/lib/tx-contract";
import { useSession } from "@/providers/session-provider";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PaymentQrRouteScreen() {
  const params = useLocalSearchParams<{
    qrId?: string | string[];
  }>();
  const router = useRouter();
  const { clearError, status, tokens } = useSession();

  const qrId = Array.isArray(params.qrId) ? params.qrId[0] : params.qrId;

  const [qrRequest, setQrRequest] = useState<PaymentQrRequest | null>(null);
  const [preflight, setPreflight] = useState<PaymentLinkPreflight["preflight"] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [isLaunchingWallet, setIsLaunchingWallet] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionMessage, setTransactionMessage] = useState<string | null>(null);

  // WebView state for Android in-app transaction flow
  const [showTxWebView, setShowTxWebView] = useState(false);
  const [transactionWebUrl, setTransactionWebUrl] = useState<string | null>(null);
  const txHandledRef = useRef(false);
  const isAndroid = Platform.OS === "android";
  const redirectUri = getMobileTransactionRedirectUri();
  const transactionWebOrigin = transactionWebUrl
    ? (() => {
        try {
          return new URL(transactionWebUrl).origin;
        } catch {
          return null;
        }
      })()
    : null;

  useEffect(() => {
    let active = true;

    async function loadQrRequest() {
      if (!qrId) {
        setIsLoading(false);
        setErrorMessage("This QR request is missing an id.");
        return;
      }

      try {
        setIsLoading(true);
        const nextQrRequest = await fetchPublicPaymentQr(qrId);

        if (!active) {
          return;
        }

        setQrRequest(nextQrRequest);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load this QR payment request."
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadQrRequest();

    return () => {
      active = false;
    };
  }, [qrId]);

  useEffect(() => {
    if (!qrRequest || qrRequest.paymentLink.status !== "submitted") {
      return;
    }

    let active = true;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const nextQrRequest = await fetchPublicPaymentQr(qrRequest.qrId);

          if (!active) {
            return;
          }

          setQrRequest(nextQrRequest);

          if (nextQrRequest.paymentLink.status === "submitted") {
            return;
          }

          clearInterval(interval);

          if (nextQrRequest.paymentLink.status === "confirmed") {
            setTransactionMessage("Payment confirmed onchain.");
          } else if (nextQrRequest.paymentLink.status === "stale") {
            setTransactionMessage(
              "This QR request is stale. The owner must reset it before retry."
            );
          }
        } catch (error) {
          if (!active) {
            return;
          }

          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not refresh this QR payment request."
          );
        }
      })();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [qrRequest]);

  async function handleRunPreflight() {
    if (!qrId) {
      return;
    }

    if (!tokens?.accessToken) {
      setErrorMessage("Sign in before paying this QR request.");
      return;
    }

    clearError();
    setIsRunningPreflight(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const result = await preflightPaymentQr(qrId, tokens.accessToken);
      setQrRequest(result.qrRequest);
      setPreflight(result.preflight);
    } catch (error) {
      setPreflight(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not run QR payment preflight."
      );
    } finally {
      setIsRunningPreflight(false);
    }
  }

  async function handleLaunchWallet() {
    if (!tokens?.accessToken || !qrRequest || !preflight) {
      return;
    }

    const hasBlockingIssue = preflight.issues.some(
      (issue) => issue.severity === "error"
    );

    if (hasBlockingIssue) {
      setErrorMessage("Resolve the blocking preflight issues before launching the wallet.");
      return;
    }

    clearError();
    setErrorMessage(null);
    setTransactionMessage(null);
    txHandledRef.current = false;

    const transactionUrl = buildAuthWebTransactionUrl({
      to: preflight.transactionRequest.to,
      data: preflight.transactionRequest.data,
      value: preflight.transactionRequest.value,
      chainId: preflight.transactionRequest.chainId,
      gasLimit: preflight.transactionRequest.gasLimit,
      gasPrice: preflight.transactionRequest.gasPrice,
      slug: qrRequest.paymentLink.slug,
      amount: qrRequest.paymentLink.amount,
      recipientName: qrRequest.paymentLink.recipient.displayName,
      expectedSender: preflight.senderWalletAddress,
    });

    // Android: use in-app WebView for reliable postMessage communication
    if (isAndroid) {
      setTransactionWebUrl(transactionUrl);
      setShowTxWebView(true);
      return;
    }

    // iOS: use external browser with deep link callback
    setIsLaunchingWallet(true);

    try {
      const result = await WebBrowser.openAuthSessionAsync(
        transactionUrl,
        getMobileTransactionRedirectUri()
      );

      if (result.type === "success" && "url" in result && result.url) {
        await handleTransactionCallback(result.url);
        return;
      }

      if (result.type === "cancel" || result.type === "dismiss") {
        setTransactionMessage("The wallet flow was closed before the transfer was submitted.");
        return;
      }

      setErrorMessage("The wallet flow did not return a usable transaction callback.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not launch the wallet transaction flow."
      );
    } finally {
      setIsLaunchingWallet(false);
    }
  }

  async function handleTransactionCallback(callbackUrl: string) {
    if (txHandledRef.current) {
      return;
    }

    if (!tokens?.accessToken || !qrRequest || !preflight) {
      setErrorMessage("Session expired. Please run preflight again.");
      return;
    }

    try {
      const callback = parseTransactionCallbackUrl(callbackUrl);

      if (callback.status === "submitted") {
        txHandledRef.current = true;

        const submittedLink = await submitPaymentLink(
          callback.slug || qrRequest.paymentLink.slug,
          {
            txHash: callback.txHash,
            senderWalletAddress: preflight.senderWalletAddress,
          },
          tokens.accessToken
        );

        setQrRequest({
          ...qrRequest,
          paymentLink: submittedLink,
        });
        setPreflight(null);
        setShowTxWebView(false);
        setTransactionWebUrl(null);
        setTransactionMessage(
          `Transaction submitted: ${callback.txHash.slice(0, 10)}... Waiting for confirmation.`
        );
        return;
      }

      setTransactionMessage(callback.message || "Transaction flow ended without submission.");
    } catch (error) {
      txHandledRef.current = false;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not process the transaction callback."
      );
    }
  }

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    if (txHandledRef.current) {
      return;
    }

    if (!tokens?.accessToken || !qrRequest || !preflight) {
      setErrorMessage("Session expired. Please run preflight again.");
      setShowTxWebView(false);
      return;
    }

    try {
      const payload = parseTransactionBridgeMessage(event.nativeEvent.data);

      if (payload.status === "submitted" && payload.txHash) {
        txHandledRef.current = true;

        const submittedLink = await submitPaymentLink(
          payload.slug || qrRequest.paymentLink.slug,
          {
            txHash: payload.txHash,
            senderWalletAddress: preflight.senderWalletAddress,
          },
          tokens.accessToken
        );

        setQrRequest({
          ...qrRequest,
          paymentLink: submittedLink,
        });
        setPreflight(null);
        setShowTxWebView(false);
        setTransactionWebUrl(null);
        setTransactionMessage(
          `Transaction submitted: ${payload.txHash.slice(0, 10)}... Waiting for confirmation.`
        );
        return;
      }

      if (payload.status === "error" || payload.status === "cancelled") {
        setTransactionMessage(payload.message || "Transaction was cancelled or failed.");
        setShowTxWebView(false);
        setTransactionWebUrl(null);
      }
    } catch (error) {
      txHandledRef.current = false;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not process the WebView message."
      );
      setShowTxWebView(false);
    }
  }

  function shouldOpenExternally(url: string) {
    if (!url) {
      return false;
    }

    // Redirect URI should be intercepted
    if (url.startsWith(redirectUri)) {
      return true;
    }

    // Allow same-origin navigation
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!transactionWebOrigin) {
        return false;
      }

      try {
        return new URL(url).origin !== transactionWebOrigin;
      } catch {
        return false;
      }
    }

    // Non-http URLs (wallet deep links etc.) should open externally
    return true;
  }

  function handleShouldStartLoad(request: ShouldStartLoadRequest) {
    const nextUrl = request.url;

    if (!showTxWebView) {
      return true;
    }

    if (!shouldOpenExternally(nextUrl)) {
      return true;
    }

    // Handle redirect URI callback
    if (nextUrl.startsWith(redirectUri)) {
      void handleTransactionCallback(nextUrl);
      return false;
    }

    // Open wallet deep links externally
    void Linking.openURL(nextUrl).catch(() => {
      setErrorMessage(`Cannot open URL: ${nextUrl}`);
    });

    return false;
  }

  function resetTxWebView() {
    txHandledRef.current = false;
    setShowTxWebView(false);
    setTransactionWebUrl(null);
    setIsLaunchingWallet(false);
  }

  return (
    <BlurScrollScreen title="Pay QR" contentStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>QR payment</Text>
        <Text style={styles.title}>Scan, review, and pay.</Text>
        <Text style={styles.subtitle}>
          This QR opens a direct MUSD payment request inside Urnway.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.card}>
          <ActivityIndicator color="#0e7a63" />
          <Text style={styles.bodyText}>Loading the QR payment request...</Text>
        </View>
      ) : null}

      {qrRequest ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Request details</Text>
          <Text style={styles.linkAmount}>
            {qrRequest.paymentLink.amount} {qrRequest.paymentLink.currency}
          </Text>
          <Text style={styles.caption}>{qrRequest.qrId}</Text>
          <Text style={styles.bodyText}>
            Recipient: {qrRequest.paymentLink.recipient.displayName}
          </Text>
          <Text style={styles.bodyText}>
            Status: {qrRequest.paymentLink.status}
          </Text>
          {qrRequest.paymentLink.title ? (
            <Text style={styles.bodyText}>{qrRequest.paymentLink.title}</Text>
          ) : null}
          {qrRequest.paymentLink.note ? (
            <Text style={styles.bodyText}>{qrRequest.paymentLink.note}</Text>
          ) : null}
          {qrRequest.paymentLink.submittedAt ? (
            <Text style={styles.caption}>
              Submitted {formatTimestamp(qrRequest.paymentLink.submittedAt)}
            </Text>
          ) : null}
          {qrRequest.paymentLink.confirmedAt ? (
            <Text style={styles.caption}>
              Confirmed {formatTimestamp(qrRequest.paymentLink.confirmedAt)}
            </Text>
          ) : null}
          {qrRequest.paymentLink.status === "confirmed" ? (
            <Text style={styles.successText}>This QR request has already been paid.</Text>
          ) : null}
          {qrRequest.paymentLink.status === "stale" ? (
            <Text style={styles.warningText}>
              This QR request is stale. The owner must reset it before retry.
            </Text>
          ) : null}
        </View>
      ) : null}

      {!tokens?.accessToken && status !== "bootstrapping" && qrId ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sign in to continue</Text>
          <Text style={styles.bodyText}>
            You need an active Urnway session before paying this QR request.
          </Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/auth",
                params: { return_to: `/payments/qr/${qrId}` },
              })
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Sign in with Mezo Passport</Text>
          </Pressable>
        </View>
      ) : null}

      {tokens?.accessToken &&
      qrRequest &&
      qrRequest.paymentLink.status === "active" &&
      !preflight ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ready to pay</Text>
          <Text style={styles.bodyText}>
            Run preflight to confirm your network, MUSD balance, and gas wallet.
          </Text>

          <Pressable
            disabled={isRunningPreflight}
            onPress={() => void handleRunPreflight()}
            style={[styles.primaryButton, isRunningPreflight && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isRunningPreflight ? "Running..." : "Run preflight"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {preflight ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preflight checks</Text>

          <Text style={styles.bodyText}>
            MUSD: {preflight.checks.musdBalance.availableAmount} available /{" "}
            {preflight.checks.musdBalance.requiredAmount} required
          </Text>
          <Text style={styles.bodyText}>
            Gas:{" "}
            {preflight.checks.gasBalance.requiredAmount
              ? `${preflight.checks.gasBalance.availableAmount} available / ${preflight.checks.gasBalance.requiredAmount} required`
              : "Estimate unavailable"}
          </Text>

          {preflight.issues.map((issue) => (
            <Text
              key={issue.code}
              style={issue.severity === "error" ? styles.errorText : styles.warningText}
            >
              {issue.message}
            </Text>
          ))}

          {!preflight.issues.some((issue) => issue.severity === "error") ? (
            <Pressable
              disabled={isLaunchingWallet || showTxWebView}
              onPress={() => void handleLaunchWallet()}
              style={[styles.primaryButton, (isLaunchingWallet || showTxWebView) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isLaunchingWallet ? "Opening wallet..." : showTxWebView ? "WebView open..." : "Continue in wallet"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showTxWebView && transactionWebUrl ? (
        <View style={styles.webViewShell}>
          <View style={styles.webViewHeader}>
            <Text style={styles.sectionTitle}>Transaction</Text>
            <Pressable onPress={resetTxWebView} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.caption}>
            Connect your wallet and approve the transfer in the view below.
          </Text>
          <View style={styles.webViewCard}>
            <WebView
              source={{ uri: transactionWebUrl }}
              originWhitelist={["*"]}
              onMessage={(event) => {
                void handleWebViewMessage(event);
              }}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              setSupportMultipleWindows={false}
              startInLoadingState
              onError={(event) => {
                setErrorMessage(event.nativeEvent.description);
                resetTxWebView();
              }}
            />
          </View>
        </View>
      ) : null}

      {transactionMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Wallet handoff</Text>
          <Text style={styles.bodyText}>{transactionMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>QR payment error</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#fffaf3",
    padding: 24,
    gap: 14,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1b150f",
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#635448",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: "#7a695e",
  },
  linkAmount: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#1b150f",
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#0e7a63",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    color: "#8a3b2d",
    lineHeight: 20,
  },
  successText: {
    color: "#0e7a63",
    lineHeight: 20,
  },
  warningText: {
    color: "#8a5f12",
    lineHeight: 20,
  },
  webViewShell: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#fffaf3",
    padding: 24,
    gap: 14,
    minHeight: 450,
  },
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webViewCard: {
    flex: 1,
    minHeight: 380,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e8e0d8",
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#635448",
  },
});
