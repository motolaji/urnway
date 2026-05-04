import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  BleManager,
  ScanMode,
  State,
  type Device,
} from "react-native-ble-plx";
import {
  startAdvertising,
  stopAdvertising,
  setServices,
} from "munim-bluetooth-peripheral";
import { useEffect, useRef, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildNearbyAdvertisedName,
  NEARBY_PAYMENT_CHARACTERISTIC_UUID,
  NEARBY_PAYMENT_SERVICE_UUID,
  parseNearbyAdvertisedSlug,
} from "@/lib/nearby-payments";
import { ApiError, fetchPublicPaymentLink, type PaymentLink } from "@/lib/session";

type NearbyRequest = {
  deviceId: string;
  slug: string;
  name: string;
  rssi: number | null;
  lastSeenAt: number;
};

type NearbyPermissionMode = "scan" | "advertise";

function getNearbyPermissionErrorMessage(mode: NearbyPermissionMode) {
  return mode === "advertise"
    ? "Nearby sharing needs Bluetooth permissions to advertise."
    : "Nearby discovery needs Bluetooth permissions to scan.";
}

function getBluetoothStateErrorMessage(state: State, mode: NearbyPermissionMode) {
  if (state === State.Unauthorized) {
    return getNearbyPermissionErrorMessage(mode);
  }

  if (state === State.Unsupported) {
    return "This device does not support Bluetooth LE nearby payments.";
  }

  if (state === State.PoweredOff) {
    return mode === "advertise"
      ? "Turn Bluetooth on to share a nearby payment request."
      : "Turn Bluetooth on to discover nearby payment requests.";
  }

  return null;
}

async function requestNearbyPermissions(mode: NearbyPermissionMode) {
  if (Platform.OS !== "android") {
    return true;
  }

  const version =
    typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);

  if (version >= 31) {
    const permissions =
      mode === "advertise"
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ];
    const result = await PermissionsAndroid.requestMultiple(permissions);

    return Object.values(result).every(
      (value) => value === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return Object.values(result).every(
    (value) => value === PermissionsAndroid.RESULTS.GRANTED
  );
}

function upsertNearbyRequest(
  current: NearbyRequest[],
  device: Device,
  slug: string
) {
  const nextItem: NearbyRequest = {
    deviceId: device.id,
    slug,
    name: device.localName ?? device.name ?? slug,
    rssi: device.rssi ?? null,
    lastSeenAt: Date.now(),
  };

  const existingIndex = current.findIndex((item) => item.slug === slug);

  if (existingIndex === -1) {
    return [...current, nextItem].sort((a, b) => (b.rssi ?? -200) - (a.rssi ?? -200));
  }

  const next = [...current];
  next[existingIndex] = nextItem;
  return next.sort((a, b) => (b.rssi ?? -200) - (a.rssi ?? -200));
}

export default function NearbyPaymentsScreen() {
  const params = useLocalSearchParams<{
    slug?: string | string[];
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const managerRef = useRef<BleManager | null>(null);
  const hostSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const mode = hostSlug ? "host" : "scan";

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [bluetoothState, setBluetoothState] = useState<State | null>(null);
  const [nearbyRequests, setNearbyRequests] = useState<NearbyRequest[]>([]);
  const [hostLink, setHostLink] = useState<PaymentLink | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const manager = new BleManager();
    managerRef.current = manager;

    return () => {
      try {
        manager.stopDeviceScan();
      } catch {
        // Ignore cleanup errors.
      }

      try {
        stopAdvertising();
      } catch {
        // Ignore cleanup errors.
      }

      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hostSlug) {
      return;
    }

    let active = true;
    const slug = hostSlug;

    async function loadHostLink() {
      try {
        const paymentLink = await fetchPublicPaymentLink(slug);

        if (!active) {
          return;
        }

        setHostLink(paymentLink);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load this payment request for nearby sharing."
        );
      }
    }

    void loadHostLink();

    return () => {
      active = false;
    };
  }, [hostSlug]);

  useEffect(() => {
    if (mode !== "scan" || !managerRef.current) {
      return;
    }

    let active = true;
    let stateSubscription: { remove(): void } | null = null;

    async function setupScan() {
      const granted = await requestNearbyPermissions("scan");

      if (!active) {
        return;
      }

      setPermissionGranted(granted);

      if (!granted) {
        setErrorMessage(getNearbyPermissionErrorMessage("scan"));
        return;
      }

      stateSubscription = managerRef.current!.onStateChange((nextState) => {
        if (!active) {
          return;
        }

        setBluetoothState(nextState);

        if (nextState !== State.PoweredOn) {
          setIsScanning(false);
          setErrorMessage(getBluetoothStateErrorMessage(nextState, "scan"));
          return;
        }

        setErrorMessage(null);
        setIsScanning(true);
        managerRef.current?.stopDeviceScan();
        void managerRef.current?.startDeviceScan(
          [NEARBY_PAYMENT_SERVICE_UUID],
          { scanMode: ScanMode.LowLatency, allowDuplicates: false },
          (error, device) => {
            if (!active) {
              return;
            }

            if (error) {
              setIsScanning(false);
              setErrorMessage(error.message);
              return;
            }

            if (!device) {
              return;
            }

            const slug = parseNearbyAdvertisedSlug(device.localName ?? device.name);

            if (!slug) {
              return;
            }

            setNearbyRequests((current) => upsertNearbyRequest(current, device, slug));
          }
        );
      }, true);
    }

    void setupScan();

    return () => {
      active = false;
      stateSubscription?.remove();
      managerRef.current?.stopDeviceScan();
      setIsScanning(false);
    };
  }, [mode]);

  async function handleStartAdvertising() {
    if (!hostLink) {
      return;
    }

    const granted = await requestNearbyPermissions("advertise");
    setPermissionGranted(granted);

    if (!granted) {
      setErrorMessage(getNearbyPermissionErrorMessage("advertise"));
      return;
    }

    const currentState = await managerRef.current?.state();

    if (currentState && currentState !== State.PoweredOn) {
      setBluetoothState(currentState);
      setErrorMessage(getBluetoothStateErrorMessage(currentState, "advertise"));
      return;
    }

    if (hostLink.status !== "active") {
      setErrorMessage("Only active payment links can be shared nearby.");
      return;
    }

    try {
      setErrorMessage(null);
      const localName = buildNearbyAdvertisedName(hostLink.slug);

      setServices([
        {
          uuid: NEARBY_PAYMENT_SERVICE_UUID,
          characteristics: [
            {
              uuid: NEARBY_PAYMENT_CHARACTERISTIC_UUID,
              properties: ["read"],
              value: hostLink.slug,
            },
          ],
        },
      ]);

      startAdvertising({
        serviceUUIDs: [NEARBY_PAYMENT_SERVICE_UUID],
        localName,
        advertisingData: {
          completeLocalName: localName,
          completeServiceUUIDs128: [NEARBY_PAYMENT_SERVICE_UUID],
        },
      });

      setIsAdvertising(true);
    } catch (error) {
      setIsAdvertising(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start nearby advertising."
      );
    }
  }

  function handleStopAdvertising() {
    try {
      stopAdvertising();
      setIsAdvertising(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not stop nearby advertising."
      );
    }
  }

  function handleOpenNearbyRequest(slug: string) {
    managerRef.current?.stopDeviceScan();
    router.replace(`/payments/qr/${slug}` as Href);
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="#1b150f" />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Nearby</Text>
        <Text style={styles.title}>
          {mode === "host" ? "Share nearby payment request" : "Find nearby payment requests"}
        </Text>
        <Text style={styles.bodyText}>
          {mode === "host"
            ? "Broadcast this request over Bluetooth so another nearby device can discover it."
            : "Scan for nearby Urnway payment requests and open one directly."}
        </Text>
      </View>

      {permissionGranted === false ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {mode === "host"
              ? "Bluetooth permissions are required to share this request nearby."
              : "Bluetooth permissions are required to scan for nearby requests."}
          </Text>
        </View>
      ) : null}

      {bluetoothState &&
      bluetoothState !== State.PoweredOn &&
      (mode === "scan" || mode === "host") ? (
        <View style={styles.card}>
          <Text style={styles.warningText}>
            Bluetooth state: {bluetoothState}.
            {" "}
            {getBluetoothStateErrorMessage(
              bluetoothState,
              mode === "host" ? "advertise" : "scan"
            ) ?? "Turn Bluetooth on to continue."}
          </Text>
        </View>
      ) : null}

      {mode === "host" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Broadcast request</Text>

          {hostLink ? (
            <>
              <Text style={styles.linkAmount}>
                {hostLink.amount} {hostLink.currency}
              </Text>
              <Text style={styles.caption}>{hostLink.slug}</Text>
              <Text style={styles.bodyText}>
                Recipient: {hostLink.recipient.displayName}
              </Text>
              <Text style={styles.bodyText}>Status: {hostLink.status}</Text>
              <Text style={styles.caption}>
                Nearby name: {buildNearbyAdvertisedName(hostLink.slug)}
              </Text>
            </>
          ) : (
            <Text style={styles.bodyText}>Loading request…</Text>
          )}

          <View style={styles.buttonRow}>
            {isAdvertising ? (
              <Pressable
                onPress={handleStopAdvertising}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Stop broadcast</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void handleStartAdvertising()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Start nearby broadcast</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.caption}>
            Keep this screen open while the other device scans.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Discovered requests</Text>
          <Text style={styles.caption}>
            {isScanning ? "Scanning…" : "Waiting for Bluetooth…"}
          </Text>

          {nearbyRequests.length === 0 ? (
            <Text style={styles.bodyText}>
              No nearby requests yet. Ask the other device to start broadcasting.
            </Text>
          ) : (
            nearbyRequests.map((item) => (
              <Pressable
                key={`${item.slug}-${item.deviceId}`}
                onPress={() => handleOpenNearbyRequest(item.slug)}
                style={styles.requestCard}
              >
                <Text style={styles.requestTitle}>{item.slug}</Text>
                <Text style={styles.bodyText}>{item.name}</Text>
                <Text style={styles.caption}>
                  Signal {item.rssi ?? "unknown"} dBm
                </Text>
              </Pressable>
            ))
          )}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => {
                setNearbyRequests([]);
                setErrorMessage(null);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Clear list</Text>
            </Pressable>
          </View>
        </View>
      )}

      {errorMessage ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nearby error</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    paddingHorizontal: 20,
    backgroundColor: "#f7f1e8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fffaf3",
  },
  card: {
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
  requestCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7dccf",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 6,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1b150f",
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
  errorText: {
    color: "#8a3b2d",
    lineHeight: 20,
  },
  warningText: {
    color: "#8a5f12",
    lineHeight: 20,
  },
});
