import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

/**
 * Expo Camera typing differs across versions. This shim avoids TS errors
 * while still calling the real method at runtime.
 */
type CameraRef = {
  takePictureAsync: (opts?: any) => Promise<{ uri?: string }>;
};

export default function ScanScreen() {
  const router = useRouter();

  const cameraRef = useRef<CameraRef | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = useMemo(() => permission?.granted === true, [permission]);

  const [torch, setTorch] = useState<"off" | "on">("off");
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Ask for camera permission once on load (only if it can ask again)
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const goToResult = useCallback(
    (photoUri: string) => {
      router.push({
        pathname: "/(tabs)/scan-result",
        params: { photoUri },
      });
    },
    [router]
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow Photos access.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      // Go straight to result (skip preview) OR show preview—your choice.
      // We'll show preview for consistency.
      setPreviewUri(uri);
    } catch (e: any) {
      Alert.alert("Picker error", e?.message ?? "Failed to pick an image.");
    }
  }, []);

  const openSettingsHelp = useCallback(() => {
    Alert.alert(
      "Enable Camera",
      "If camera permission is blocked, open Settings and enable Camera permission for this app. (On iOS Simulator, camera is not available — use Photos.)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      if (busy) return;
      if (!cameraRef.current) return;

      setBusy(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error("No photo uri returned");
      setPreviewUri(photo.uri);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Permission loading state
  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Scan</Text>
        <Text style={styles.sub}>Requesting permissions…</Text>

        <View style={{ height: 14 }} />

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={pickFromLibrary}
        >
          <Text style={styles.secondaryBtnText}>Use Photos Instead</Text>
        </Pressable>
      </View>
    );
  }

  // Preview screen after capture/pick
  if (previewUri) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Preview</Text>
            <Text style={styles.headerSub}>Looks good? Analyze it.</Text>
          </View>
        </View>

        <View style={styles.previewCard}>
          <Image source={{ uri: previewUri }} style={styles.previewImg} />
        </View>

        <View style={styles.footerRow}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => setPreviewUri(null)}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Choose Another</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
              { flex: 1 },
            ]}
            onPress={() => goToResult(previewUri)}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>Analyze</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Tip: On iOS Simulator, use Photos (camera isn’t available).
        </Text>
      </View>
    );
  }

  /**
   * IMPORTANT:
   * Even if camera permission is denied (or simulator), we still show a working “Photos” path.
   * This prevents getting stuck on simulator.
   */
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.sub}>Enable camera permission to scan food.</Text>

        <View style={{ height: 12 }} />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => requestPermission()}
        >
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={pickFromLibrary}
        >
          <Text style={styles.secondaryBtnText}>Use Photos Instead</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          onPress={openSettingsHelp}
        >
          <Text style={styles.ghostBtnText}>Help</Text>
        </Pressable>

        <Text style={styles.hint}>
          iOS Simulator doesn’t have a real camera. Use Photos to test Scan → Result → Log.
        </Text>
      </View>
    );
  }

  // Camera screen (real device, or simulator if it ever supported it)
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan Food</Text>
          <Text style={styles.headerSub}>Take a photo of your plate</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => setTorch((t) => (t === "on" ? "off" : "on"))}
        >
          <Text style={styles.iconBtnText}>{torch === "on" ? "🔦 On" : "🔦 Off"}</Text>
        </Pressable>
      </View>

      {/* Camera */}
      <View style={styles.cameraCard}>
        <CameraView
          ref={(r) => (cameraRef.current = r as any)}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch === "on"}
        />

        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.overlayText}>Center the plate • Good light helps</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.footerRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={pickFromLibrary}
          disabled={busy}
        >
          <Text style={styles.secondaryBtnText}>Photos</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
            { flex: 1 },
          ]}
          onPress={takePhoto}
          disabled={busy}
        >
          {busy ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator />
              <Text style={styles.primaryBtnText}>Capturing…</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Take Photo</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.hint}>
        If camera permission is blocked (or simulator), use Photos.
      </Text>
    </View>
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
    height: 420,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCECEF",
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 18,
  },
  scanFrame: {
    width: 290,
    height: 210,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  overlayText: {
    marginTop: 14,
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "800",
  },

  previewCard: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCECEF",
    backgroundColor: "#000",
  },
  previewImg: { width: "100%", height: "100%", resizeMode: "cover" },

  footerRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },

  primaryBtn: {
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  ghostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CFE8EA",
    backgroundColor: "#F1FBFC",
  },
  ghostBtnText: { color: "#0B2A2F", fontWeight: "900" },

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

  hint: {
    marginTop: 10,
    color: "#4A6468",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 18,
  },
});
