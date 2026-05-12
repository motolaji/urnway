import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import {
  buildAuthWebTransactionUrl,
  getMobileTransactionRedirectUri,
} from "@/lib/mobile-config";
import {
  ApiError,
  completeSendCheckout,
  createPaymentLink,
  deletePaymentLink,
  fetchBalanceTopup,
  fetchPublicPaymentQr,
  fetchPublicPaymentLink,
  fetchPaymentLinks,
  fetchPaymentsOverview,
  fetchUrnwayBalance,
  generatePaymentQr,
  prepareSendCheckout,
  type PaymentLink,
  type PaymentSource,
  preflightPaymentLink,
  preflightPaymentQr,
  type PaymentQrRequest,
  resetPaymentLink,
  type SendCheckout,
  submitPaymentLink,
  type PaymentLinkPreflight,
  type UrnwayBalanceSummary,
} from "@/lib/session";
import { isCompletedTopup, runUrnwayTopupFlow } from "@/lib/topup-flow";
import { parseTransactionCallbackUrl } from "@/lib/tx-contract";
import { useSession } from "@/providers/session-provider";

type PaymentsState = {
  summary: {
    availableFlows: string[];
    createdLinkCount: number;
    recipient: {
      username: string | null;
      displayName: string;
      walletAddress: string;
    };
    nextUp: string[];
  } | null;
  paymentLinks: PaymentLink[];
  balance: UrnwayBalanceSummary | null;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseMinorAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) {
    throw new Error("Amount must use up to 2 decimal places.");
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return Math.round(parsed * 100);
}

export default function PayScreen() {
  const router = useRouter();
  const { clearError, tokens } = useSession();
  const [payments, setPayments] = useState<PaymentsState>({
    summary: null,
    paymentLinks: [],
    balance: null,
  });
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [sendUsername, setSendUsername] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [previewLink, setPreviewLink] = useState<PaymentLink | null>(null);
  const [previewQrId, setPreviewQrId] = useState<string | null>(null);
  const [activeQrRequest, setActiveQrRequest] = useState<PaymentQrRequest | null>(
    null
  );
  const [topupAmount, setTopupAmount] = useState("");
  const [sendSource, setSendSource] = useState<PaymentSource>("urnway_balance");
  const [sendCheckout, setSendCheckout] = useState<
    (SendCheckout & {
      recipient?: {
        userId: string;
        publicUserId: string | null;
        username: string | null;
        displayName: string;
        walletAddress: string;
      };
    }) | null
  >(null);
  const [preflight, setPreflight] = useState<PaymentLinkPreflight["preflight"] | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isLoadingLink, setIsLoadingLink] = useState(false);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [isPreparingSendCheckout, setIsPreparingSendCheckout] = useState(false);
  const [isCompletingSendCheckout, setIsCompletingSendCheckout] = useState(false);
  const [isToppingUpBalance, setIsToppingUpBalance] = useState(false);
  const [busyLinkAction, setBusyLinkAction] = useState<{
    slug: string;
    action: "delete" | "reset";
  } | null>(null);
  const [isLaunchingWallet, setIsLaunchingWallet] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState<string | null>(null);
  const treasuryReady = Boolean(payments.balance?.treasuryWalletAddress);

  function appendOwnedPaymentRequest(paymentLink: PaymentLink) {
    setPayments((current) => ({
      summary: current.summary
        ? {
            ...current.summary,
            createdLinkCount: current.summary.createdLinkCount + 1,
          }
        : current.summary,
      paymentLinks: [paymentLink, ...current.paymentLinks],
      balance: current.balance,
    }));
  }

  async function loadPayments(accessToken: string, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const [summary, paymentLinks, balance] = await Promise.all([
        fetchPaymentsOverview(accessToken),
        fetchPaymentLinks(accessToken),
        fetchUrnwayBalance(accessToken),
      ]);

      setPayments({
        summary,
        paymentLinks,
        balance,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load payment links right now."
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

    void loadPayments(tokens.accessToken);
  }, [tokens?.accessToken]);

  useEffect(() => {
    if (!previewLink || previewLink.status !== "submitted") {
      return;
    }

    let active = true;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const nextLink = await fetchPublicPaymentLink(previewLink.slug);

          if (!active) {
            return;
          }

          setPreviewLink(nextLink);
          if (activeQrRequest?.paymentLink.slug === nextLink.slug) {
            setActiveQrRequest({
              ...activeQrRequest,
              paymentLink: nextLink,
            });
          }

          if (nextLink.status === "submitted") {
            return;
          }

          clearInterval(interval);

          if (nextLink.status === "confirmed") {
            setTransactionMessage("Payment confirmed onchain.");
          } else if (nextLink.status === "stale") {
            setTransactionMessage(
              "This payment is still awaiting confirmation. The link owner must reset it before retry."
            );
          }

          if (tokens?.accessToken) {
            await loadPayments(tokens.accessToken, true);
          }
        } catch (error) {
          if (!active) {
            return;
          }

          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Could not refresh payment-link settlement status."
          );
        }
      })();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeQrRequest, previewLink, tokens?.accessToken]);

  async function handleRefresh() {
    if (!tokens?.accessToken) {
      return;
    }

    setIsRefreshing(true);
    await loadPayments(tokens.accessToken, true);
  }

  async function handleCreateLink() {
    if (!tokens?.accessToken || isCreating) {
      return;
    }

    if (!amount.trim()) {
      setErrorMessage("Enter an amount before creating a payment link.");
      return;
    }

    clearError();
    setIsCreating(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const createdLink = await createPaymentLink(
        {
          amount: amount.trim(),
          title: title.trim() || undefined,
          note: note.trim() || undefined,
        },
        tokens.accessToken
      );

      appendOwnedPaymentRequest(createdLink);
      setAmount("");
      setTitle("");
      setNote("");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not create the payment link."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePrepareSendCheckout() {
    if (!tokens?.accessToken || isPreparingSendCheckout) {
      return;
    }

    if (!treasuryReady && sendSource !== "urnway_balance") {
      setErrorMessage(
        "Urnway treasury is not configured yet, so Split and External wallet funding are disabled."
      );
      return;
    }

    if (!sendUsername.trim() || !sendAmount.trim()) {
      setErrorMessage("Enter a username and amount before reviewing the send.");
      return;
    }

    clearError();
    setIsPreparingSendCheckout(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const result = await prepareSendCheckout(
        {
          username: sendUsername.trim(),
          amountMinor: parseMinorAmount(sendAmount),
          currency: "MUSD",
          source: sendSource,
          note: sendNote.trim() || undefined,
        },
        tokens.accessToken
      );

      setSendCheckout(result.checkout);
    } catch (error) {
      setSendCheckout(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "We could not prepare that username payment."
      );
    } finally {
      setIsPreparingSendCheckout(false);
    }
  }

  async function handleTopUpBalance() {
    if (!tokens?.accessToken || isToppingUpBalance) {
      return;
    }

    if (!treasuryReady) {
      setErrorMessage(
        "Urnway treasury is not configured yet, so balance top-up is disabled for now."
      );
      return;
    }

    if (!topupAmount.trim()) {
      setErrorMessage("Enter a top-up amount first.");
      return;
    }

    clearError();
    setIsToppingUpBalance(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const topup = await runUrnwayTopupFlow({
        amountMinor: parseMinorAmount(topupAmount),
        accessToken: tokens.accessToken,
        onStatus: setTransactionMessage,
      });

      if (!isCompletedTopup(topup)) {
        const refreshedTopup = await fetchBalanceTopup(topup.topupId, tokens.accessToken);

        if (!isCompletedTopup(refreshedTopup)) {
          throw new Error("Top-up is still verifying. Please refresh and try again.");
        }
      }

      setTopupAmount("");
      setTransactionMessage(
        `Urnway balance topped up with ${topup.amount} ${topup.currency}.`
      );
      await loadPayments(tokens.accessToken, true);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "We could not top up your Urnway balance."
      );
    } finally {
      setIsToppingUpBalance(false);
    }
  }

  async function handleCompleteSendCheckout() {
    if (!tokens?.accessToken || !sendCheckout || isCompletingSendCheckout) {
      return;
    }

    clearError();
    setIsCompletingSendCheckout(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      let topupId: string | undefined;

      if (sendCheckout.fundingPlan.externalWalletAmountMinor > 0) {
        const topup = await runUrnwayTopupFlow({
          amountMinor: sendCheckout.fundingPlan.externalWalletAmountMinor,
          accessToken: tokens.accessToken,
          onStatus: setTransactionMessage,
        });

        topupId = topup.topupId;
      }

      const completed = await completeSendCheckout(
        sendCheckout.checkoutId,
        {
          topupId,
        },
        tokens.accessToken
      );

      setSendCheckout(completed.checkout);
      setSendUsername("");
      setSendAmount("");
      setSendNote("");
      setTransactionMessage(
        `Sent ${completed.checkout.amount} ${completed.checkout.currency} to ${
          sendCheckout.recipient?.displayName ??
          sendCheckout.receiver.username ??
          "another Urnway user"
        }.`
      );
      await loadPayments(tokens.accessToken, true);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "We could not complete that username payment."
      );
    } finally {
      setIsCompletingSendCheckout(false);
    }
  }

  async function handleGenerateQr() {
    if (!tokens?.accessToken || isGeneratingQr) {
      return;
    }

    if (!amount.trim()) {
      setErrorMessage("Enter an amount before generating a QR request.");
      return;
    }

    clearError();
    setIsGeneratingQr(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const qrRequest = await generatePaymentQr(
        {
          amount: amount.trim(),
          title: title.trim() || undefined,
          note: note.trim() || undefined,
        },
        tokens.accessToken
      );

      appendOwnedPaymentRequest(qrRequest.paymentLink);
      setActiveQrRequest(qrRequest);
      setAmount("");
      setTitle("");
      setNote("");
      setTransactionMessage("QR request ready. Another device can scan it to open Urnway.");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not generate the QR request."
      );
    } finally {
      setIsGeneratingQr(false);
    }
  }

  async function handleLoadLinkPreview() {
    const slug = linkCode.trim();

    if (!slug) {
      setErrorMessage("Enter a payment link code first.");
      return;
    }

    clearError();
    setIsLoadingLink(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const paymentLink = await fetchPublicPaymentLink(slug);
      setPreviewLink(paymentLink);
      setPreviewQrId(null);
      setPreflight(null);
    } catch (error) {
      setPreviewLink(null);
      setPreviewQrId(null);
      setPreflight(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load that payment link."
      );
    } finally {
      setIsLoadingLink(false);
    }
  }

  async function handleShowQr(link: PaymentLink) {
    clearError();
    setIsLoadingQr(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const qrRequest = await fetchPublicPaymentQr(link.slug);
      setActiveQrRequest(qrRequest);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load the QR request."
      );
    } finally {
      setIsLoadingQr(false);
    }
  }

  async function handleRunPreflight() {
    if (!previewLink) {
      return;
    }

    if (!tokens?.accessToken) {
      setErrorMessage("Sign in before paying a QR or link request.");
      return;
    }

    clearError();
    setIsRunningPreflight(true);
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      if (previewQrId) {
        const result = await preflightPaymentQr(previewQrId, tokens.accessToken);
        setPreviewLink(result.paymentLink);
        setPreflight(result.preflight);
        return;
      }

      const result = await preflightPaymentLink(previewLink.slug, tokens.accessToken);
      setPreviewLink(result.paymentLink);
      setPreflight(result.preflight);
    } catch (error) {
      setPreflight(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not run payment preflight."
      );
    } finally {
      setIsRunningPreflight(false);
    }
  }

  async function handleShareLink(link: PaymentLink) {
    clearError();
    setTransactionMessage(null);
    await Share.share({
      message: link.shareText,
    });
  }

  async function handleShareQrRequest(qrRequest: PaymentQrRequest) {
    clearError();
    setTransactionMessage(null);
    await Share.share({
      message: qrRequest.payload,
    });
  }

  async function handleDeleteLink(link: PaymentLink) {
    if (!tokens?.accessToken || busyLinkAction) {
      return;
    }

    clearError();
    setBusyLinkAction({
      slug: link.slug,
      action: "delete",
    });
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      await deletePaymentLink(link.slug, tokens.accessToken);

      setPayments((current) => ({
        summary: current.summary
          ? {
              ...current.summary,
              createdLinkCount: Math.max(current.summary.createdLinkCount - 1, 0),
            }
          : current.summary,
        paymentLinks: current.paymentLinks.filter(
          (paymentLink) => paymentLink.slug !== link.slug
        ),
        balance: current.balance,
      }));

      if (previewLink?.slug === link.slug) {
        setPreviewLink(null);
        setPreviewQrId(null);
        setPreflight(null);
      }

      if (activeQrRequest?.paymentLink.slug === link.slug) {
        setActiveQrRequest(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not remove the payment link."
      );
    } finally {
      setBusyLinkAction(null);
    }
  }

  async function handleResetLink(link: PaymentLink) {
    if (!tokens?.accessToken || busyLinkAction) {
      return;
    }

    clearError();
    setBusyLinkAction({
      slug: link.slug,
      action: "reset",
    });
    setErrorMessage(null);
    setTransactionMessage(null);

    try {
      const resetLink = await resetPaymentLink(link.slug, tokens.accessToken);

      setPayments((current) => ({
        ...current,
        paymentLinks: current.paymentLinks.map((paymentLink) =>
          paymentLink.slug === resetLink.slug ? resetLink : paymentLink
        ),
      }));

      if (previewLink?.slug === resetLink.slug) {
        setPreviewLink(resetLink);
        setPreflight(null);
        setTransactionMessage("Link reset. It can be paid again.");
      }

      if (activeQrRequest?.paymentLink.slug === resetLink.slug) {
        setActiveQrRequest({
          ...activeQrRequest,
          paymentLink: resetLink,
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not reset the payment link."
      );
    } finally {
      setBusyLinkAction(null);
    }
  }

  async function handleLaunchWallet() {
    if (!tokens?.accessToken || !previewLink || !preflight) {
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
    setIsLaunchingWallet(true);

    try {
      const transactionUrl = buildAuthWebTransactionUrl({
        to: preflight.transactionRequest.to,
        data: preflight.transactionRequest.data,
        value: preflight.transactionRequest.value,
        chainId: preflight.transactionRequest.chainId,
        gasLimit: preflight.transactionRequest.gasLimit,
        gasPrice: preflight.transactionRequest.gasPrice,
        slug: previewLink.slug,
        amount: previewLink.amount,
        recipientName: previewLink.recipient.displayName,
        expectedSender: preflight.senderWalletAddress,
      });

      const result = await WebBrowser.openAuthSessionAsync(
        transactionUrl,
        getMobileTransactionRedirectUri()
      );

      if (result.type === "success" && "url" in result && result.url) {
        const callback = parseTransactionCallbackUrl(result.url);

        if (callback.status === "submitted") {
          const submittedSlug = callback.slug || previewLink.slug;
          const submittedLink = await submitPaymentLink(
            submittedSlug,
            {
              txHash: callback.txHash,
              senderWalletAddress: preflight.senderWalletAddress,
            },
            tokens.accessToken
          );

          setPreviewLink(submittedLink);
          if (activeQrRequest?.paymentLink.slug === submittedSlug) {
            setActiveQrRequest({
              ...activeQrRequest,
              paymentLink: submittedLink,
            });
          }
          setPreflight(null);
          setTransactionMessage(
            `Transaction submitted: ${callback.txHash.slice(0, 10)}... Waiting for confirmation.`
          );
          await loadPayments(tokens.accessToken, true);
          return;
        }

        setTransactionMessage(callback.message || "Transaction flow ended without submission.");
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

  return (
    <BlurScrollScreen title="Pay" contentStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Payments</Text>
        <Text style={styles.title}>Create MUSD payment requests.</Text>
        <Text style={styles.subtitle}>
          This is the first live payment surface in Urnway. Create a link, show a
          QR, and manage your direct payment requests here.
        </Text>

        <View style={styles.buttonRow}>
          <Pressable
            disabled={isRefreshing}
            onPress={() => void handleRefresh()}
            style={[styles.secondaryButton, isRefreshing && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonText}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/payments/scan")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Scan QR</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/payments/nearby")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Nearby</Text>
          </Pressable>
        </View>
      </View>

      {payments.summary ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your payment profile</Text>
          <Text style={styles.bodyText}>
            Collecting as {payments.summary.recipient.displayName}
          </Text>
          <Text style={styles.caption}>
            Active flow: {payments.summary.availableFlows.join(", ")}
          </Text>
          <Text style={styles.caption}>
            Created links: {payments.summary.createdLinkCount}
          </Text>
        </View>
      ) : null}

      {payments.balance ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Available now</Text>
          <Text style={styles.balanceText}>
            {payments.balance.account.availableAmount} {payments.balance.account.currency}
          </Text>
          <Text style={styles.caption}>
            External wallet: {payments.balance.externalWallet.musdBalance}{" "}
            {payments.balance.externalWallet.musdTokenSymbol} • Gas wallet:{" "}
            {payments.balance.externalWallet.nativeTokenBalance}{" "}
            {payments.balance.externalWallet.nativeTokenSymbol}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Top up Urnway balance</Text>
        <Text style={styles.bodyText}>
          Move MUSD from your external wallet into Urnway balance so future sends
          and bookings can settle without leaving the app.
        </Text>
        {!treasuryReady ? (
          <Text style={styles.caption}>
            Treasury not configured yet. Set `URNWAY_TREASURY_WALLET_ADDRESS`
            in the API env before balance top-ups can work.
          </Text>
        ) : null}

        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setTopupAmount}
          placeholder="Amount in MUSD"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={topupAmount}
        />

        <Pressable
          disabled={isToppingUpBalance || !treasuryReady}
          onPress={() => void handleTopUpBalance()}
          style={[
            styles.primaryButton,
            (isToppingUpBalance || !treasuryReady) && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isToppingUpBalance ? "Topping up..." : "Top up balance"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Send by username</Text>
        <Text style={styles.bodyText}>
          Send MUSD directly to another Urnway user with Urnway balance first and
          your external wallet as the fallback source.
        </Text>

        <View style={styles.buttonRow}>
          {(["urnway_balance", "split", "external_wallet"] as PaymentSource[]).map(
            (source) => (
              <Pressable
                key={source}
                onPress={() => {
                  if (!treasuryReady && source !== "urnway_balance") {
                    setErrorMessage(
                      "Urnway treasury is not configured yet, so only Urnway balance sends are available."
                    );
                    return;
                  }
                  setSendSource(source);
                  setSendCheckout(null);
                }}
                style={[
                  styles.secondaryButton,
                  sendSource === source && styles.selectedSourceButton,
                  !treasuryReady &&
                    source !== "urnway_balance" &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    sendSource === source && styles.selectedSourceButtonText,
                  ]}
                >
                  {source === "urnway_balance"
                    ? "Urnway balance"
                    : source === "split"
                      ? "Split"
                      : "External wallet"}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => {
            setSendUsername(value);
            setSendCheckout(null);
          }}
          placeholder="Recipient username"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={sendUsername}
        />

        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(value) => {
            setSendAmount(value);
            setSendCheckout(null);
          }}
          placeholder="Amount in MUSD"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={sendAmount}
        />

        <TextInput
          multiline
          onChangeText={(value) => {
            setSendNote(value);
            setSendCheckout(null);
          }}
          placeholder="Add a note (optional)"
          placeholderTextColor="#8e7d71"
          style={[styles.input, styles.noteInput]}
          value={sendNote}
        />

        <View style={styles.buttonRow}>
          <Pressable
            disabled={isPreparingSendCheckout}
            onPress={() => void handlePrepareSendCheckout()}
            style={[
              styles.secondaryButton,
              isPreparingSendCheckout && styles.disabledButton,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isPreparingSendCheckout ? "Reviewing..." : "Review send"}
            </Text>
          </Pressable>

          {sendCheckout ? (
            <Pressable
              disabled={isCompletingSendCheckout}
              onPress={() => void handleCompleteSendCheckout()}
              style={[
                styles.primaryButton,
                isCompletingSendCheckout && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isCompletingSendCheckout ? "Sending..." : "Complete send"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {sendCheckout ? (
          <View style={styles.linkCard}>
            <View style={styles.linkHeader}>
              <View style={styles.linkHeaderText}>
                <Text style={styles.linkAmount}>
                  {sendCheckout.amount} {sendCheckout.currency}
                </Text>
                <Text style={styles.linkSlug}>
                  @{sendCheckout.recipient?.username ?? sendCheckout.receiver.username ?? "unknown"}
                </Text>
              </View>
              <Text style={styles.linkStatus}>{sendCheckout.source}</Text>
            </View>

            <Text style={styles.linkTitle}>
              {sendCheckout.recipient?.displayName ?? "Urnway user"}
            </Text>
            <Text style={styles.bodyText}>
              Funding plan: {sendCheckout.fundingPlan.urnwayBalanceAmount} MUSD
              from Urnway
              {sendCheckout.fundingPlan.externalWalletAmountMinor > 0
                ? ` + ${sendCheckout.fundingPlan.externalWalletAmount} MUSD top-up`
                : ""}
            </Text>
            <Text style={styles.bodyText}>
              Recipient wallet: {sendCheckout.recipient?.walletAddress ?? "Unavailable"}
            </Text>
            {sendCheckout.note ? (
              <Text style={styles.bodyText}>{sendCheckout.note}</Text>
            ) : null}

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>Urnway balance</Text>
              <Text
                style={[
                  styles.checkValue,
                  sendCheckout.fundingPlan.canCompleteNow
                    ? styles.successText
                    : styles.warningText,
                ]}
              >
                {sendCheckout.fundingPlan.availableBalanceAmount} available
              </Text>
            </View>

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>External wallet</Text>
              <Text
                style={[
                  styles.checkValue,
                  sendCheckout.fundingPlan.externalWalletAmountMinor > 0
                    ? styles.warningText
                    : styles.successText,
                ]}
              >
                {sendCheckout.fundingPlan.externalWalletAmountMinor > 0
                  ? `${sendCheckout.fundingPlan.externalWalletAmount} MUSD top-up needed`
                  : "No top-up needed"}
              </Text>
            </View>

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>Source</Text>
              <Text
                style={[
                  styles.checkValue,
                  styles.successText,
                ]}
              >
                {sendCheckout.source === "urnway_balance"
                  ? "Spend directly from Urnway balance"
                  : sendCheckout.source === "split"
                    ? "Top up only the shortfall, then send"
                    : "Top up the full amount, then send"}
              </Text>
            </View>

            <Text
              style={
                sendCheckout.fundingPlan.canCompleteNow
                  ? styles.successText
                  : styles.warningText
              }
            >
              {sendCheckout.fundingPlan.canCompleteNow
                ? "Ready to settle from Urnway balance."
                : "A wallet-funded top-up will run first, then the send will complete from Urnway balance."}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create request</Text>

        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          placeholder="Amount in MUSD"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={amount}
        />

        <TextInput
          onChangeText={setTitle}
          placeholder="What is this for? (optional)"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={title}
        />

        <TextInput
          multiline
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor="#8e7d71"
          style={[styles.input, styles.noteInput]}
          value={note}
        />

        <Pressable
          disabled={isCreating}
          onPress={() => void handleCreateLink()}
          style={[styles.primaryButton, isCreating && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {isCreating ? "Creating..." : "Create payment link"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isGeneratingQr}
          onPress={() => void handleGenerateQr()}
          style={[styles.secondaryButton, isGeneratingQr && styles.disabledButton]}
        >
          <Text style={styles.secondaryButtonText}>
            {isGeneratingQr ? "Generating..." : "Generate QR request"}
          </Text>
        </Pressable>
      </View>

      {activeQrRequest ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active QR request</Text>
          <Text style={styles.bodyText}>
            Scan this from another device to open the Urnway pay flow.
          </Text>

          <View style={styles.qrCard}>
            <Image source={activeQrRequest.imageDataUrl} style={styles.qrImage} />
            <Text style={styles.linkAmount}>
              {activeQrRequest.paymentLink.amount} {activeQrRequest.paymentLink.currency}
            </Text>
            <Text style={styles.caption}>{activeQrRequest.qrId}</Text>
            <Text style={styles.caption} numberOfLines={2}>
              {activeQrRequest.payload}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => void handleShareQrRequest(activeQrRequest)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Share QR link</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveQrRequest(null)}
              style={styles.ghostButton}
            >
              <Text style={styles.ghostButtonText}>Hide QR</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pay a link code</Text>
        <Text style={styles.bodyText}>
          Load a shared code, inspect the request, and run preflight against your
          current wallet before the send handoff.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setLinkCode}
          placeholder="pay-xxxxxxxx"
          placeholderTextColor="#8e7d71"
          style={styles.input}
          value={linkCode}
        />

        <View style={styles.buttonRow}>
          <Pressable
            disabled={isLoadingLink}
            onPress={() => void handleLoadLinkPreview()}
            style={[styles.secondaryButton, isLoadingLink && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingLink ? "Loading..." : "Load link"}
            </Text>
          </Pressable>

          {previewLink?.status === "active" ? (
            <Pressable
              disabled={isRunningPreflight}
              onPress={() => void handleRunPreflight()}
              style={[styles.primaryButton, isRunningPreflight && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isRunningPreflight ? "Running..." : "Run preflight"}
              </Text>
            </Pressable>
          ) : null}

          {preflight &&
          previewLink?.status === "active" &&
          !preflight.issues.some((issue) => issue.severity === "error") ? (
            <Pressable
              disabled={isLaunchingWallet}
              onPress={() => void handleLaunchWallet()}
              style={[styles.primaryButton, isLaunchingWallet && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isLaunchingWallet ? "Opening wallet..." : "Continue in wallet"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {previewLink ? (
          <View style={styles.linkCard}>
            <View style={styles.linkHeader}>
              <View style={styles.linkHeaderText}>
                <Text style={styles.linkAmount}>
                  {previewLink.amount} {previewLink.currency}
                </Text>
                <Text style={styles.linkSlug}>{previewLink.slug}</Text>
              </View>
              <Text style={styles.linkStatus}>{previewLink.status}</Text>
            </View>

            <Text style={styles.linkTitle}>
              {previewLink.title || "Untitled payment request"}
            </Text>
            <Text style={styles.bodyText}>
              Recipient: {previewLink.recipient.displayName}
            </Text>
            {previewLink.submittedAt ? (
              <Text style={styles.caption}>
                Submitted {formatTimestamp(previewLink.submittedAt)}
              </Text>
            ) : null}
            {previewLink.confirmedAt ? (
              <Text style={styles.caption}>
                Confirmed {formatTimestamp(previewLink.confirmedAt)}
              </Text>
            ) : null}
            {previewLink.note ? (
              <Text style={styles.bodyText}>{previewLink.note}</Text>
            ) : null}
            {previewLink.status === "submitted" ? (
              <Text style={styles.warningText}>
                Waiting for Goldsky confirmation.
              </Text>
            ) : null}
            {previewLink.status === "confirmed" ? (
              <Text style={styles.successText}>This link has been paid.</Text>
            ) : null}
            {previewLink.status === "stale" ? (
              <Text style={styles.warningText}>
                This link is stale. The owner must reset it before it can be retried.
              </Text>
            ) : null}
          </View>
        ) : null}

        {preflight ? (
          <View style={styles.linkCard}>
            <Text style={styles.sectionTitle}>Preflight checks</Text>

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>Network</Text>
              <Text
                style={[
                  styles.checkValue,
                  preflight.checks.network.ok
                    ? styles.successText
                    : styles.errorText,
                ]}
              >
                {preflight.checks.network.ok
                  ? `Ready on chain ${preflight.checks.network.expectedChainId}`
                  : `Wrong network`}
              </Text>
            </View>

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>MUSD</Text>
              <Text
                style={[
                  styles.checkValue,
                  preflight.checks.musdBalance.ok
                    ? styles.successText
                    : styles.errorText,
                ]}
              >
                {preflight.checks.musdBalance.availableAmount} available /{" "}
                {preflight.checks.musdBalance.requiredAmount} required
              </Text>
            </View>

            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>Gas</Text>
              <Text
                style={[
                  styles.checkValue,
                  preflight.checks.gasBalance.ok
                    ? styles.successText
                    : preflight.checks.gasBalance.status === "unavailable"
                      ? styles.warningText
                      : styles.errorText,
                ]}
              >
                {preflight.checks.gasBalance.requiredAmount
                  ? `${preflight.checks.gasBalance.availableAmount} available / ${preflight.checks.gasBalance.requiredAmount} required`
                  : "Estimate unavailable"}
              </Text>
            </View>

            {preflight.issues.length > 0 ? (
              <View style={styles.issueList}>
                {preflight.issues.map((issue) => (
                  <Text
                    key={issue.code}
                    style={[
                      styles.issueText,
                      issue.severity === "error"
                        ? styles.errorText
                        : styles.warningText,
                    ]}
                  >
                    {issue.message}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.successText}>
                Preflight passed. The unsigned MUSD transfer request is ready for
                wallet handoff.
              </Text>
            )}

            <Text style={styles.caption}>
              Sender: {preflight.senderWalletAddress}
            </Text>
            <Text style={styles.caption}>
              Recipient: {preflight.recipientWalletAddress}
            </Text>
            <Text style={styles.caption}>
              Token: {preflight.musdTokenAddress}
            </Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.card}>
          <ActivityIndicator color="#0e7a63" />
          <Text style={styles.loadingText}>Loading payment links...</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment error</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {transactionMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Balance activity</Text>
          <Text style={styles.bodyText}>{transactionMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your links</Text>

        {payments.paymentLinks.length === 0 ? (
          <Text style={styles.bodyText}>
            No payment links yet. Create one above to start collecting MUSD.
          </Text>
        ) : (
          payments.paymentLinks.map((link) => (
            <View key={link.id} style={styles.linkCard}>
              <View style={styles.linkHeader}>
                <View style={styles.linkHeaderText}>
                  <Text style={styles.linkAmount}>
                    {link.amount} {link.currency}
                  </Text>
                  <Text style={styles.linkSlug}>{link.slug}</Text>
                </View>
                <Text style={styles.linkStatus}>{link.status}</Text>
              </View>

              {link.title ? <Text style={styles.linkTitle}>{link.title}</Text> : null}
              {link.note ? <Text style={styles.bodyText}>{link.note}</Text> : null}

              <Text style={styles.caption}>
                Created {formatTimestamp(link.createdAt)}
              </Text>
              {link.submittedAt ? (
                <Text style={styles.caption}>
                  Submitted {formatTimestamp(link.submittedAt)}
                </Text>
              ) : null}
              {link.confirmedAt ? (
                <Text style={styles.caption}>
                  Confirmed {formatTimestamp(link.confirmedAt)}
                </Text>
              ) : null}
              {link.ownerSettlement?.latestAttempt ? (
                <>
                  <Text style={styles.caption}>
                    Latest attempt: {link.ownerSettlement.latestAttempt.status}
                  </Text>
                  <Text style={styles.caption}>
                    Tx {link.ownerSettlement.latestAttempt.txHash.slice(0, 12)}...
                  </Text>
                </>
              ) : null}

              <View style={styles.buttonRow}>
                {link.status === "active" ? (
                  <>
                    <Pressable
                      onPress={() => void handleShareLink(link)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>Share code</Text>
                    </Pressable>

                    <Pressable
                      disabled={isLoadingQr}
                      onPress={() => void handleShowQr(link)}
                      style={[styles.secondaryButton, isLoadingQr && styles.disabledButton]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isLoadingQr ? "Loading QR..." : "Show QR"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push("/payments/nearby")}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>Nearby</Text>
                    </Pressable>

                    <Pressable
                      disabled={busyLinkAction?.slug === link.slug}
                      onPress={() => void handleDeleteLink(link)}
                      style={[
                        styles.ghostButton,
                        busyLinkAction?.slug === link.slug && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.ghostButtonText}>
                        {busyLinkAction?.slug === link.slug &&
                        busyLinkAction.action === "delete"
                          ? "Removing..."
                          : "Remove"}
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {link.status === "stale" && link.ownerSettlement?.canReset ? (
                  <Pressable
                    disabled={busyLinkAction?.slug === link.slug}
                    onPress={() => void handleResetLink(link)}
                    style={[
                      styles.secondaryButton,
                      busyLinkAction?.slug === link.slug && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {busyLinkAction?.slug === link.slug &&
                      busyLinkAction.action === "reset"
                        ? "Resetting..."
                        : "Reset link"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Coming next</Text>
        <Text style={styles.bodyText}>
          Nearby payments now use Bluetooth discovery between signed-in Urnway
          users on the same screen-scoped flow.
        </Text>
      </View>
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
  balanceText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
    color: "#1b150f",
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d7ccbe",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1b150f",
  },
  noteInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
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
  secondaryButton: {
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#efe2cf",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#1b150f",
    fontWeight: "700",
  },
  selectedSourceButton: {
    backgroundColor: "#0e7a63",
  },
  selectedSourceButtonText: {
    color: "#ffffff",
  },
  ghostButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7ccbe",
    backgroundColor: "#fffaf3",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: "#7a695e",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingText: {
    color: "#1b150f",
    fontWeight: "600",
  },
  errorText: {
    color: "#8a3b2d",
    lineHeight: 20,
  },
  linkCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7dccf",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 10,
  },
  qrCard: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7dccf",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 10,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 18,
    backgroundColor: "#ffffff",
  },
  linkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  linkHeaderText: {
    flex: 1,
    gap: 4,
  },
  linkAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1b150f",
  },
  linkSlug: {
    fontSize: 13,
    color: "#7a695e",
  },
  linkStatus: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#0e7a63",
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1b150f",
  },
  checkRow: {
    gap: 6,
  },
  checkLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#7a695e",
  },
  checkValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  issueList: {
    gap: 8,
  },
  issueText: {
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
});
