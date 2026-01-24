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
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { getAppContext } from "@/src/storage/appContext";
import { fetchMe } from "@/lib/me";

import { persistImageUri } from "../../lib/persistImage";

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

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const ctx = await getAppContext();
        if (!alive) return;

        // Force backend profile to match selected context
        const force = ctx.segment === "family" ? "family" : "individual";
        await fetchMe(force).catch(() => {});
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

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

      // ✅ persist to app-private storage so it survives iOS restarts
      const stable = await persistImageUri(uri);
      setPreviewUri(stable);
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

      // ✅ persist to app-private storage so it survives iOS restarts
      const stable = await persistImageUri(photo.uri);
      setPreviewUri(stable);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message ?? "Failed to take photo.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Permission loading state
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Scan</Text>
        <Text style={styles.pageSub}>Requesting permissions…</Text>

        <Pressable style={styles.secondaryBtn} onPress={pickFromLibrary}>
          <Text style={styles.secondaryBtnText}>Use Photos Instead</Text>
        </Pressable>
      </View>
    );
  }

  // Preview screen after capture/pick
  if (previewUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Preview</Text>
        <Text style={styles.pageSub}>Looks good? Analyze it.</Text>

        <View style={styles.previewCard}>
          <Image source={{ uri: previewUri }} style={styles.previewImg} />
        </View>

        <View style={styles.footerRow}>
          <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setPreviewUri(null)}>
            <Text style={styles.secondaryBtnText}>Choose Another</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, { flex: 1 }]}
            onPress={() => goToResult(previewUri)}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>Analyze</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Tip: On iOS Simulator, use Photos (camera isn’t available).</Text>
      </View>
    );
  }

  // No camera permission: still show photos path
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Scan</Text>
        <Text style={styles.pageSub}>Enable camera permission to scan food.</Text>

        <Pressable style={styles.primaryBtn} onPress={() => requestPermission()}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={pickFromLibrary}>
          <Text style={styles.secondaryBtnText}>Use Photos Instead</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn} onPress={openSettingsHelp}>
          <Text style={styles.ghostBtnText}>Help</Text>
        </Pressable>

        <Text style={styles.hint}>
          iOS Simulator doesn’t have a real camera. Use Photos to test Scan → Result → Log.
        </Text>
      </View>
    );
  }

  // Camera screen
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Scan</Text>
          <Text style={styles.pageSub}>Take a photo of your plate</Text>
        </View>

        <Pressable style={styles.iconBtn} onPress={() => setTorch((t) => (t === "on" ? "off" : "on"))}>
          <Text style={styles.iconBtnText}>{torch === "on" ? "🔦 On" : "🔦 Off"}</Text>
        </Pressable>
      </View>

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

      <View style={styles.footerRow}>
        <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={pickFromLibrary} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Photos</Text>
        </Pressable>

        <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={takePhoto} disabled={busy}>
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

      <Text style={styles.hint}>If camera permission is blocked (or simulator), use Photos.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingHorizontal: 16, paddingTop: 16 },

  pageTitle: { fontSize: 32, fontWeight: "900", color: "#0B2A2F" },
  pageSub: { marginTop: 4, color: "#4A6468", fontWeight: "700" },

  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },

  iconBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2EEF0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  iconBtnText: { fontWeight: "900", color: "#0B2A2F" },

  cameraCard: {
    height: 420,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2EEF0",
    backgroundColor: "#000",
  },

  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingBottom: 18 },
  scanFrame: {
    width: 290,
    height: 210,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  overlayText: { marginTop: 14, color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "800" },

  previewCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2EEF0",
    backgroundColor: "#000",
    marginTop: 10,
  },
  previewImg: { width: "100%", height: "100%", resizeMode: "cover" },

  footerRow: { flexDirection: "row", gap: 10, paddingTop: 10 },

  primaryBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2EEF0",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 10,
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  ghostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7E9EB",
    backgroundColor: "rgba(15,118,110,0.06)",
  },
  ghostBtnText: { color: "#0B2A2F", fontWeight: "900" },

  hint: { marginTop: 10, color: "#4A6468", textAlign: "center", fontWeight: "700", lineHeight: 18 },
});
