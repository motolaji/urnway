import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { State } from "react-native-ble-plx";

import BlurScrollScreen from "@/components/blur-scroll-screen";
import { Button, Card, Input, Text, Toggle } from "@/components/ui";
import { colors, spacing, typography } from "@/constants/design-tokens";
import {
  getBluetoothStateErrorMessage,
  getNearbyPermissionErrorMessage,
  NearbyBluetoothService,
  requestNearbyPermissions,
} from "@/lib/nearby-bluetooth-service";
import {
  formatMinorCurrencyAmount,
  parseMajorAmountToMinorUnits,
  type IncomingNearbyPayment,
  type NearbyDoneMessage,
  type NearbyUser,
} from "@/lib/nearby-payments";
import {
  completeNearbyPaymentIntent,
  createNearbyPaymentIntent,
  fetchNearbyPaymentIntent,
} from "@/lib/session";
import { useSession } from "@/providers/session-provider";

type SenderFlowState = {
  user: NearbyUser;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  status: "connecting" | "awaiting_ack" | "acked" | "completed";
};

function formatNearbyListShortPublicId(publicUserId: string) {
  const normalized = publicUserId.startsWith("pub_")
    ? publicUserId.slice(4)
    : publicUserId;

  return normalized.length <= 6 ? normalized : normalized.slice(-6);
}

export default function NearbyPaymentsScreen() {
  const { profile, status, tokens } = useSession();
  const serviceRef = useRef<NearbyBluetoothService | null>(null);
  const incomingPaymentRef = useRef<IncomingNearbyPayment | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [discoverableEnabled, setDiscoverableEnabled] = useState(false);
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("GBP");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [busyPublicUserId, setBusyPublicUserId] = useState<string | null>(null);
  const [senderFlow, setSenderFlow] = useState<SenderFlowState | null>(null);
  const [incomingPayment, setIncomingPayment] = useState<IncomingNearbyPayment | null>(
    null
  );
  const [incomingPaymentState, setIncomingPaymentState] = useState<
    "pending" | "verifying" | "completed"
  >("pending");
  const [isCompletingSenderFlow, setIsCompletingSenderFlow] = useState(false);
  const profileUsername = profile?.username ?? null;
  const publicUserId = profile?.publicUserId ?? null;

  function getUiErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "reason" in error &&
      typeof (error as { reason?: unknown }).reason === "string"
    ) {
      return (error as { reason: string }).reason;
    }

    return fallback;
  }

  function getService() {
    if (!serviceRef.current) {
      serviceRef.current = new NearbyBluetoothService();
    }

    return serviceRef.current;
  }

  const canUseNearby = Boolean(
    status === "signed_in" &&
      tokens?.accessToken &&
      profileUsername &&
      publicUserId
  );

  useEffect(() => {
    incomingPaymentRef.current = incomingPayment;
  }, [incomingPayment]);

  useEffect(() => {
    return () => {
      void serviceRef.current?.stopAll();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canUseNearby) {
      return;
    }

    getService().primeCentralManager();
  }, [canUseNearby]);

  useEffect(() => {
    if (status !== "signed_in") {
      return;
    }

    if (!profileUsername) {
      router.replace("/onboarding" as Href);
    }
  }, [profileUsername, status]);

  const discoveredUsers = useMemo(
    () =>
      nearbyUsers.filter(
        (user) => user.publicUserId !== publicUserId
      ),
    [nearbyUsers, publicUserId]
  );

  async function handleStartScanning() {
    if (!canUseNearby) {
      return;
    }

    try {
      const granted = await requestNearbyPermissions("scan");

      if (!granted) {
        setErrorMessage(getNearbyPermissionErrorMessage("scan"));
        return;
      }

      const bluetoothState = await getService().waitForUsableState();
      const bluetoothError = getBluetoothStateErrorMessage(bluetoothState, "scan");

      if (bluetoothError) {
        setErrorMessage(
          bluetoothState === State.Unknown
            ? "Bluetooth is still initializing. Try again in a moment."
            : bluetoothError
        );
        return;
      }

      getService().startScanning({
        onUsersUpdated: (users) => {
          setNearbyUsers(users);
        },
        onError: (message) => {
          setErrorMessage(message);
          setIsScanning(false);
        },
      });

      setErrorMessage(null);
      setIsScanning(true);
    } catch (error) {
      setErrorMessage(getUiErrorMessage(error, "Could not start nearby scan."));
      setIsScanning(false);
    }
  }

  function handleStopScanning() {
    serviceRef.current?.stopScanning();
    setIsScanning(false);
  }

  async function handleSetDiscoverable(nextValue: boolean) {
    setDiscoverableEnabled(nextValue);

    if (!nextValue) {
      serviceRef.current?.stopDiscoverable();
      setIsDiscoverable(false);
      setStatusMessage("Nearby discoverable mode stopped.");
      return;
    }

    if (!canUseNearby) {
      return;
    }

    if (Platform.OS === "ios") {
      setDiscoverableEnabled(false);
      setIsDiscoverable(false);
      setErrorMessage(
        "Nearby discoverable mode is temporarily disabled on iOS while the peripheral bridge is being stabilized. Scan still works."
      );
      return;
    }

    if (!getService().supportsDiscoverableMode()) {
      setDiscoverableEnabled(false);
      setIsDiscoverable(false);
      setErrorMessage(
        "This build does not expose the Bluetooth peripheral bridge yet. Rebuild the dev client after installing the native patch."
      );
      return;
    }

    try {
      const granted = await requestNearbyPermissions("advertise");

      if (!granted) {
        setErrorMessage(getNearbyPermissionErrorMessage("advertise"));
        setDiscoverableEnabled(false);
        return;
      }

      const bluetoothState = await getService().waitForUsableState();
      const bluetoothError = getBluetoothStateErrorMessage(
        bluetoothState,
        "advertise"
      );

      if (bluetoothError) {
        setErrorMessage(
          bluetoothState === State.Unknown
            ? "Bluetooth is still initializing. Try again in a moment."
            : bluetoothError
        );
        setDiscoverableEnabled(false);
        return;
      }

      getService().startDiscoverable({
        username: profileUsername!,
        publicUserId: publicUserId!,
        onAdvertisingStateChanged: (nextState, errorCode) => {
          if (nextState === "starting") {
            setStatusMessage("Starting nearby discoverable mode…");
            setIsDiscoverable(false);
            return;
          }

          if (nextState === "started") {
            setStatusMessage(
              "This device is now discoverable to nearby Android devices."
            );
            setErrorMessage(null);
            setIsDiscoverable(true);
            return;
          }

          if (nextState === "stopped") {
            setStatusMessage("Nearby discoverable mode stopped.");
            setIsDiscoverable(false);
            return;
          }

          setIsDiscoverable(false);
          setDiscoverableEnabled(false);
          setStatusMessage(null);
          setErrorMessage(
            errorCode != null
              ? `Nearby advertising failed on this device (code ${errorCode}).`
              : "Nearby advertising failed on this device."
          );
        },
        onIncomingPayment: (payment) => {
          setIncomingPayment(payment);
          setIncomingPaymentState("pending");
          setStatusMessage(
            `@${payment.senderUsername} is sending ${formatMinorCurrencyAmount(
              payment.amountMinor,
              payment.currency
            )}.`
          );
        },
        onDoneReceived: (message: NearbyDoneMessage) => {
          if (!tokens?.accessToken) {
            return;
          }

          if (
            incomingPaymentRef.current?.paymentIntentId !== message.paymentIntentId
          ) {
            return;
          }

          setIncomingPaymentState("verifying");
          void fetchNearbyPaymentIntent(message.paymentIntentId, tokens.accessToken)
            .then((paymentIntent) => {
              if (paymentIntent.status === "completed") {
                setIncomingPaymentState("completed");
                setStatusMessage("Nearby payment verified successfully.");
              } else {
                setErrorMessage(
                  "Nearby completion was received, but the backend has not confirmed success yet."
                );
              }
            })
            .catch((error) => {
              setErrorMessage(
                getUiErrorMessage(
                  error,
                  "Could not verify the nearby payment status."
                )
              );
            });
        },
        onError: (message) => {
          setErrorMessage(message);
          setIsDiscoverable(false);
          setDiscoverableEnabled(false);
        },
      });

      setErrorMessage(null);
    } catch (error) {
      setDiscoverableEnabled(false);
      setIsDiscoverable(false);
      setErrorMessage(
        getUiErrorMessage(error, "Could not enable nearby discoverable mode.")
      );
    }
  }

  function updateNearbyUserStatus(
    publicUserId: string,
    nextStatus: NearbyUser["status"]
  ) {
    setNearbyUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.publicUserId === publicUserId
          ? {
              ...user,
              status: nextStatus,
            }
          : user
      )
    );
  }

  async function handleSendToNearbyUser(user: NearbyUser) {
    if (!tokens?.accessToken || !profile?.username) {
      setErrorMessage("Sign in again before using nearby payments.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setBusyPublicUserId(user.publicUserId);

    try {
      const amountMinor = parseMajorAmountToMinorUnits(amount);
      const normalizedCurrency = currency.trim().toUpperCase();
      const paymentIntent = await createNearbyPaymentIntent(
        {
          receiverPublicUserId: user.publicUserId,
          amountMinor,
          currency: normalizedCurrency,
        },
        tokens.accessToken
      );

      setSenderFlow({
        user,
        paymentIntentId: paymentIntent.paymentIntentId,
        amountMinor,
        currency: normalizedCurrency,
        status: "connecting",
      });
      updateNearbyUserStatus(user.publicUserId, "connecting");

      await getService().connectAndSendPay({
        deviceId: user.deviceId,
        paymentIntentId: paymentIntent.paymentIntentId,
        senderUsername: profile.username,
        amountMinor,
        currency: normalizedCurrency,
        onDeviceStatus: (nextStatus) => {
          updateNearbyUserStatus(user.publicUserId, nextStatus);
          setSenderFlow((currentFlow) =>
            currentFlow && currentFlow.paymentIntentId === paymentIntent.paymentIntentId
              ? {
                  ...currentFlow,
                  status:
                    nextStatus === "connected" ? "awaiting_ack" : "connecting",
                }
              : currentFlow
          );
        },
        onAck: (paymentIntentId) => {
          setSenderFlow((currentFlow) =>
            currentFlow && currentFlow.paymentIntentId === paymentIntentId
              ? {
                  ...currentFlow,
                  status: "acked",
                }
              : currentFlow
          );
          setStatusMessage("Nearby payment acknowledged by the receiving device.");
        },
      });
    } catch (error) {
      setSenderFlow(null);
      setErrorMessage(
        getUiErrorMessage(error, "Could not send the nearby payment payload.")
      );
      updateNearbyUserStatus(user.publicUserId, "discovered");
    } finally {
      setBusyPublicUserId(null);
    }
  }

  async function handleMarkSenderFlowSuccessful() {
    if (!senderFlow || !tokens?.accessToken) {
      return;
    }

    setIsCompletingSenderFlow(true);
    setErrorMessage(null);

    try {
      await completeNearbyPaymentIntent(senderFlow.paymentIntentId, tokens.accessToken);
      await getService().sendDone(senderFlow.paymentIntentId);
      setSenderFlow((currentFlow) =>
        currentFlow
          ? {
              ...currentFlow,
              status: "completed",
            }
          : null
      );
      setStatusMessage("Nearby payment marked successful and sent to the receiver.");
    } catch (error) {
      setErrorMessage(
        getUiErrorMessage(error, "Could not complete the nearby payment.")
      );
    } finally {
      setIsCompletingSenderFlow(false);
    }
  }

  const isNearbyReady = canUseNearby && Boolean(profileUsername && publicUserId);

  return (
    <BlurScrollScreen title="Nearby" contentStyle={styles.container}>
      <View style={styles.headerRow}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="close" size={18} color={colors.brand.default} />}
        >
          Close
        </Button>
      </View>

      <Card style={styles.card}>
        <Text variant="eyebrow">Nearby pay</Text>
        <Text variant="h3">Send money to a nearby Urnway user.</Text>
        <Text variant="bodySmall" color="secondary">
          Nearby discovery stays on-device over Bluetooth. The backend only creates
          and verifies the payment intent.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="label">Your nearby identity</Text>
        <Text variant="body" weight="medium">
          @{profile?.username ?? "username required"}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {profile?.publicUserId ?? "public id unavailable"}
        </Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text variant="label">Discoverable</Text>
            <Text variant="bodySmall" color="secondary">
              Let nearby users find you and send a nearby pay request.
            </Text>
          </View>
          <Toggle
            value={discoverableEnabled}
            onValueChange={(nextValue) => void handleSetDiscoverable(nextValue)}
          />
        </View>

        <Text variant="caption" color="secondary">
          Scan: {isScanning ? "active" : "stopped"} • Discoverable:{" "}
          {isDiscoverable ? "on" : "off"}
        </Text>

        <View style={styles.actionRow}>
          <Button
            size="sm"
            variant={isScanning ? "ghost" : "primary"}
            disabled={!isNearbyReady}
            onPress={() =>
              isScanning ? handleStopScanning() : void handleStartScanning()
            }
          >
            {isScanning ? "Stop scan" : "Start scan"}
          </Button>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="h4">Send amount</Text>
        <Input
          label="Amount"
          keyboardType="decimal-pad"
          onChangeText={(value) => setAmount(value)}
          placeholder="10.00"
          value={amount}
        />
        <Input
          autoCapitalize="characters"
          label="Currency"
          maxLength={8}
          onChangeText={(value) => setCurrency(value.toUpperCase())}
          placeholder="GBP"
          value={currency}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="h4">Nearby users</Text>
        <Text variant="bodySmall" color="secondary">
          Nearby users appear directly from BLE advertising payloads.
        </Text>

        {discoveredUsers.length === 0 ? (
          <Text variant="bodySmall" color="secondary">
            No nearby users yet. Ask the other device to open Nearby and turn on
            discoverable mode.
          </Text>
        ) : (
          discoveredUsers.map((user) => (
            <View key={user.publicUserId} style={styles.userRow}>
              <View style={styles.userCopy}>
                <Text variant="body" weight="medium">
                  @{user.username} · {formatNearbyListShortPublicId(user.publicUserId)}
                </Text>
                <Text variant="caption" color="secondary">
                  {user.publicUserId}
                </Text>
                <Text variant="caption" color="secondary">
                  RSSI {user.rssi ?? "—"} • {user.status}
                </Text>
              </View>
              <Button
                size="sm"
                loading={busyPublicUserId === user.publicUserId}
                onPress={() => void handleSendToNearbyUser(user)}
              >
                Send
              </Button>
            </View>
          ))
        )}
      </Card>

      {senderFlow ? (
        <Card style={styles.card}>
          <Text variant="h4">Sender flow</Text>
          <Text variant="body" weight="medium">
            @{senderFlow.user.username}
          </Text>
          <Text variant="bodySmall" color="secondary">
            Intent {senderFlow.paymentIntentId}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {formatMinorCurrencyAmount(senderFlow.amountMinor, senderFlow.currency)} •{" "}
            {senderFlow.status}
          </Text>

          {senderFlow.status === "acked" ? (
            <Button
              loading={isCompletingSenderFlow}
              onPress={() => void handleMarkSenderFlowSuccessful()}
            >
              Mark successful
            </Button>
          ) : null}
        </Card>
      ) : null}

      {incomingPayment ? (
        <Card style={styles.card}>
          <Text variant="h4">Incoming nearby payment</Text>
          <Text variant="body" weight="medium">
            @{incomingPayment.senderUsername} is sending{" "}
            {formatMinorCurrencyAmount(
              incomingPayment.amountMinor,
              incomingPayment.currency
            )}
          </Text>
          <Text variant="bodySmall" color="secondary">
            Intent {incomingPayment.paymentIntentId}
          </Text>
          <Text variant="bodySmall" color="secondary">
            Receiver status: {incomingPaymentState}
          </Text>
        </Card>
      ) : null}

      {statusMessage ? (
        <Card style={styles.infoCard}>
          <Text variant="bodySmall">{statusMessage}</Text>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <Text variant="bodySmall" style={styles.errorText}>
            {errorMessage}
          </Text>
        </Card>
      ) : null}
    </BlurScrollScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  card: {
    gap: spacing[3],
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  toggleCopy: {
    flex: 1,
    gap: spacing[1],
  },
  actionRow: {
    flexDirection: "row",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  userCopy: {
    flex: 1,
    gap: spacing[0.5],
  },
  infoCard: {
    gap: spacing[2],
    backgroundColor: colors.brand.light,
  },
  errorCard: {
    gap: spacing[2],
    backgroundColor: "#fff2f0",
  },
  errorText: {
    color: colors.status.error,
    fontSize: typography.fontSize.sm,
  },
});
