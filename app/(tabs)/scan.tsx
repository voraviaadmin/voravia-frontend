import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [paused, setPaused] = useState(false);
  const [torch, setTorch] = useState<"off" | "on">("off");
  const [cooldown, setCooldown] = useState(false);

  const [manualCode, setManualCode] = useState("");

  const hasPermission = useMemo(() => permission?.granted === true, [permission]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const goToResult = useCallback(
    (code: string, type: string) => {
      router.push({
        pathname: "/(tabs)/scan-result",
        params: { code, type },
      });
    },
    [router]
  );

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (paused || cooldown) return;

      const value = result.data?.trim();
      if (!value) return;

      setCooldown(true);
      goToResult(value, result.type ?? "unknown");
      setTimeout(() => setCooldown(false), 1200);
    },
    [paused, cooldown, goToResult]
  );

  // Permission loading
  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Scan</Text>
        <Text style={styles.sub}>Requesting camera permission…</Text>
      </View>
    );
  }

  // No permission
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.sub}>Enable camera permission to scan barcodes.</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => requestPermission()}
        >
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() =>
            Alert.alert(
              "Tip",
              "If permission is blocked, open device Settings and enable Camera for this app."
            )
          }
        >
          <Text style={styles.secondaryBtnText}>Help</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan Food</Text>
          <Text style={styles.headerSub}>Hold steady • Good light helps</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => setTorch((t) => (t === "on" ? "off" : "on"))}
        >
          <Text style={styles.iconBtnText}>{torch === "on" ? "🔦 On" : "🔦 Off"}</Text>
        </Pressable>
      </View>

      {/* Camera area */}
      <View style={styles.cameraCard}>
        {/* TRUE PAUSE: unmount camera when paused */}
        {!paused ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch === "on"}
            onBarcodeScanned={onBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
            }}
          />
        ) : (
          <View style={styles.pausedBackdrop} />
        )}

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.overlayText}>
            {paused ? "Paused" : "Align barcode inside the frame"}
          </Text>
          <Text style={styles.overlayHint}>{paused ? "Tap Resume to continue" : "Scanning…"}</Text>

          {paused && (
            <Pressable
              style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}
              onPress={() => setPaused(false)}
            >
              <Text style={styles.resumeBtnText}>Resume Scanning</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Footer controls */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => setPaused((v) => !v)}
        >
          <Text style={styles.secondaryBtnText}>{paused ? "Resume" : "Pause"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          onPress={() =>
            Alert.alert(
              "Tips",
              "Move closer, steady your hand, and increase light. Barcodes need sharp focus."
            )
          }
        >
          <Text style={styles.ghostBtnText}>Tips</Text>
        </Pressable>
      </View>

      {/* Manual entry fallback */}
      <View style={styles.manualCard}>
        <Text style={styles.manualTitle}>Manual barcode</Text>
        <TextInput
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Enter barcode digits (e.g., 0123456789012)"
          keyboardType="number-pad"
          style={styles.input}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => {
            const code = manualCode.trim();
            if (!code) return Alert.alert("Enter a barcode", "Type the digits and try again.");
            goToResult(code, "manual");
          }}
        >
          <Text style={styles.primaryBtnText}>Lookup</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAFB",
    paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }),
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#0B2A2F" },
  headerSub: { marginTop: 6, color: "#4A6468", fontWeight: "600" },

  iconBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  iconBtnText: { fontWeight: "900", color: "#0B2A2F" },

  cameraCard: {
    height: 360,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCECEF",
    backgroundColor: "#000",
  },
  pausedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B2A2F",
    opacity: 0.92,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 18,
  },
  scanFrame: {
    width: 280,
    height: 170,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  overlayText: {
    marginTop: 14,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "800",
  },
  overlayHint: {
    marginTop: 6,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  resumeBtn: {
    marginTop: 14,
    backgroundColor: "#0E7C86",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  resumeBtnText: { color: "#FFFFFF", fontWeight: "900" },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },

  primaryBtn: {
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CFE8EA",
    backgroundColor: "#F1FBFC",
  },
  ghostBtnText: { color: "#0B2A2F", fontWeight: "900" },

  manualCard: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 14,
  },
  manualTitle: { fontSize: 13, fontWeight: "900", color: "#0B2A2F" },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DCECEF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10, default: 10 }),
    backgroundColor: "#F7FCFD",
    fontWeight: "700",
    color: "#0B2A2F",
  },

  pressed: { opacity: 0.86 },

  center: {
    flex: 1,
    backgroundColor: "#F5FAFB",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 8, color: "#4A6468", textAlign: "center" },
});
