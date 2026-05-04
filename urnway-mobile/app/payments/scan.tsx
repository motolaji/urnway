import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function parseQrIdFromScan(data: string) {
  const trimmed = data.trim();

  if (!trimmed) {
    return null;
  }

  const deepLinkMatch = trimmed.match(/urnwaymobile:\/\/payments\/qr\/([^/?#]+)/i);

  if (deepLinkMatch?.[1]) {
    return decodeURIComponent(deepLinkMatch[1]);
  }

  const pathMatch = trimmed.match(/\/payments\/qr\/([^/?#]+)/i);

  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  if (/^pay-[a-z0-9]+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export default function PaymentScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  const permissionState = useMemo(() => {
    if (!permission) {
      return "loading";
    }

    if (permission.granted) {
      return "granted";
    }

    if (permission.canAskAgain) {
      return "requestable";
    }

    return "blocked";
  }, [permission]);

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (hasScanned) {
      return;
    }

    const qrId = parseQrIdFromScan(result.data);

    if (!qrId) {
      setHasScanned(true);
      setScanError("This QR code is not a supported Urnway payment request.");
      return;
    }

    setHasScanned(true);
    setScanError(null);
    router.replace(`/payments/qr/${qrId}` as Href);
  }

  if (permissionState === "loading") {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.title}>Preparing camera…</Text>
      </View>
    );
  }

  if (permissionState === "requestable") {
    return (
      <View
        style={[
          styles.centeredScreen,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>QR scan</Text>
          <Text style={styles.title}>Allow camera access</Text>
          <Text style={styles.bodyText}>
            Urnway needs the camera to scan QR payment requests.
          </Text>

          <Pressable
            onPress={() => void requestPermission()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (permissionState === "blocked") {
    return (
      <View
        style={[
          styles.centeredScreen,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>QR scan</Text>
          <Text style={styles.title}>Camera is blocked</Text>
          <Text style={styles.bodyText}>
            Enable camera access in system settings to scan payment QR codes.
          </Text>

          <Pressable
            onPress={() => void Linking.openSettings()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Open settings</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.overlayEyebrow}>Scan QR</Text>
          <Text style={styles.overlayTitle}>Point the camera at an Urnway payment QR.</Text>

          <View style={styles.frame} />

          <Text style={styles.overlayBody}>
            We support Urnway payment QR codes and direct `pay-xxxx` slugs.
          </Text>

          {scanError ? (
            <View style={styles.messageCard}>
              <Text style={styles.errorText}>{scanError}</Text>
              <Pressable
                onPress={() => {
                  setHasScanned(false);
                  setScanError(null);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centeredScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f1e8",
  },
  card: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#fffaf3",
    padding: 24,
    gap: 14,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  content: {
    alignItems: "center",
    gap: 18,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
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
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#635448",
  },
  overlayEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#d5fff6",
  },
  overlayTitle: {
    textAlign: "center",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#ffffff",
  },
  overlayBody: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.88)",
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  messageCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "#fffaf3",
    padding: 18,
    gap: 12,
  },
  errorText: {
    color: "#8a3b2d",
    lineHeight: 20,
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
});
