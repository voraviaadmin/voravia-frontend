import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../src/config";

const PROFILE_KEY = "voravia_health_profile_v1";

// ---- Standardized header spacing (shared feel across tabs)
const SCREEN_PAD_H = 16;
const HEADER_TOP_EXTRA = 10; // extra space below the notch/safe area
const HEADER_GAP = 6; // spacing between title + subtitle
const HEADER_BOTTOM = 14; // spacing after header block

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    setResult(null);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo access to pick an image.");
      return;
    }

    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!picker.canceled) setImageUri(picker.assets[0].uri);
  };

  const analyzeImage = async () => {
    if (!imageUri) {
      Alert.alert("No image", "Pick an image first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
      const profile = profileRaw ? JSON.parse(profileRaw) : null;

      const form = new FormData();
      form.append("image", {
        uri: imageUri,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      form.append("profile", JSON.stringify(profile));

      const res = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: "POST",

        body: form,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setResult(String(data.result || ""));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + HEADER_TOP_EXTRA,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {/* Header block (standardized spacing) */}
      <View style={styles.header}>
        <Text style={styles.title}>Scan your meal</Text>
        <Text style={styles.subtitle}>
          Voravia analyzes your food based on your health profile
        </Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={pickImage}>
        <Text style={styles.secondaryText}>{imageUri ? "Change image" : "Pick an image"}</Text>
      </Pressable>

      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={{ opacity: 0.6 }}>No image selected</Text>
        </View>
      )}

      <Pressable
        style={[styles.primaryButton, (!imageUri || loading) && styles.disabled]}
        disabled={!imageUri || loading}
        onPress={analyzeImage}
      >
        <Text style={styles.primaryText}>{loading ? "Analyzing..." : "Analyze"}</Text>
      </Pressable>

      {loading && <ActivityIndicator size="large" />}

      {!!result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Result</Text>
          <Text style={styles.cardBody}>{result}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#fff",
    paddingHorizontal: SCREEN_PAD_H,
    gap: 12,
  },

  header: {
    gap: HEADER_GAP,
    marginBottom: HEADER_BOTTOM,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    opacity: 0.7,
    lineHeight: 20,
  },

  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  secondaryText: {
    fontWeight: "800",
    opacity: 0.9,
  },

  image: {
    width: "100%",
    height: 280,
    borderRadius: 16,
  },
  placeholder: {
    width: "100%",
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },

  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },
  disabled: { opacity: 0.45 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    backgroundColor: "white",
  },
  cardTitle: { fontWeight: "900", marginBottom: 6 },
  cardBody: { opacity: 0.88, lineHeight: 20 },
});
