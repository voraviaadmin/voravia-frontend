import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  TextInput,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Place = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  distanceMiles: number;
  score: number;
  verdict: "FIT" | "MODERATE" | "AVOID";
  tags: string[];
};

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:8787";

const PROFILE_STORAGE_KEY = "voravia_profile_v1";

const CUISINES = [
  "All",
  "Indian",
  "Mexican",
  "Chinese",
  "Italian",
  "Thai",
  "Japanese",
  "Mediterranean",
];

function metersToMiles(m: number) {
  return m / 1609.344;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function scoreRestaurant(place: { rating?: number; userRatingCount?: number }) {
  let score = 70;
  const tags: string[] = ["Menu scan needed for accuracy"];

  if (place.rating != null) {
    if (place.rating >= 4.5) {
      score += 8;
      tags.unshift("Highly rated");
    } else if (place.rating <= 3.8) {
      score -= 6;
    }
  }
  if (place.userRatingCount && place.userRatingCount >= 500) score += 3;

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 80 ? "FIT" : score >= 60 ? "MODERATE" : "AVOID";
  return { score, verdict, tags: tags.slice(0, 2) };
}

function isValidHttpUrl(v: string) {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function getWebLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true }
    );
  });
}

async function loadPreferredCuisine(): Promise<string> {
  const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return "All";
  try {
    const profile = JSON.parse(raw);
    return profile?.cuisines?.[0] ?? "All";
  } catch {
    return "All";
  }
}

export default function RestaurantsScreen() {
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState("All");
  const [menuUrl, setMenuUrl] = useState(
    "https://rockngrillusa.com/order"
  );

  const loadNearby = async (overrideCuisine?: string) => {
    setLoading(true);
    setError(null);

    try {
      const preferred = await loadPreferredCuisine();
      const activeCuisine = overrideCuisine ?? cuisine;
      const effectiveCuisine =
        activeCuisine === "All" ? preferred : activeCuisine;

      const { lat, lng } = await getWebLocation();

      const url =
        effectiveCuisine && effectiveCuisine !== "All"
          ? `${BACKEND_URL}/api/places/search?lat=${lat}&lng=${lng}&q=${encodeURIComponent(
              effectiveCuisine
            )}&limit=20`
          : `${BACKEND_URL}/api/places/nearby?lat=${lat}&lng=${lng}&limit=20`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Backend error");

      const data = await res.json();

      const items: Place[] = (data.places ?? []).map((p: any) => {
        const distanceM = haversineMeters(
          lat,
          lng,
          p.location.lat,
          p.location.lng
        );
        const scored = scoreRestaurant(p);
        return {
          id: p.id,
          name: p.displayName,
          address: p.formattedAddress,
          lat: p.location.lat,
          lng: p.location.lng,
          rating: p.rating,
          userRatingCount: p.userRatingCount,
          distanceMiles: metersToMiles(distanceM),
          score: scored.score,
          verdict: scored.verdict,
          tags: scored.tags,
        };
      });

      items.sort((a, b) => a.distanceMiles - b.distanceMiles);
      setPlaces(items);
    } catch (e: any) {
      setError(e.message ?? "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  };

  const goRateMenu = () => {
    const u = menuUrl.trim();
    if (!isValidHttpUrl(u)) {
      setError("Please paste a valid menu URL (http/https).");
      return;
    }
    setError(null);
    Linking.openURL(`/menu?url=${encodeURIComponent(u)}`);
  };

  const header = useMemo(() => {
    const urlOk = isValidHttpUrl(menuUrl);

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.title}>Eat Out</Text>
        <Text style={styles.sub}>Nearby restaurants • Distance in miles</Text>

        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Rate a menu from QR URL</Text>
          <TextInput
            value={menuUrl}
            onChangeText={setMenuUrl}
            style={styles.input}
            placeholder="Paste menu URL"
            placeholderTextColor="#94a3b8"
          />
          <Pressable
            style={[
              styles.rateBtn,
              !urlOk && { backgroundColor: "#94a3b8" },
            ]}
            disabled={!urlOk}
            onPress={goRateMenu}
          >
            <Text style={styles.rateBtnText}>Extract & Rate Menu</Text>
          </Pressable>
        </View>

        <View style={styles.chipsRow}>
          {CUISINES.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.chip,
                cuisine === c && styles.chipActive,
              ]}
              onPress={() => {
                setCuisine(c);
                loadNearby(c);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  cuisine === c && styles.chipTextActive,
                ]}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => loadNearby()}>
          <Text style={styles.primaryBtnText}>
            {loading ? "Loading…" : "Use my location"}
          </Text>
        </Pressable>

        {error && <Text style={styles.err}>{error}</Text>}
      </View>
    );
  }, [menuUrl, cuisine, loading, error]);

  return (
    <View style={styles.container}>
      {loading && !places.length ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          ListHeaderComponent={header}
          data={places}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.distanceMiles.toFixed(1)} mi •{" "}
                {item.rating ? `${item.rating}⭐` : "—"}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F5FAFB" },
  title: { fontSize: 28, fontWeight: "900" },
  sub: { color: "#4A6468", marginBottom: 8 },
  menuCard: {
    backgroundColor: "#0F172A",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuTitle: { color: "white", fontWeight: "900", marginBottom: 8 },
  input: {
    backgroundColor: "#111827",
    color: "white",
    borderRadius: 10,
    padding: 10,
  },
  rateBtn: {
    marginTop: 10,
    backgroundColor: "#0EA5A4",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  rateBtnText: { color: "white", fontWeight: "900" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: "#0E7C86" },
  chipText: { fontWeight: "700" },
  chipTextActive: { color: "white" },
  primaryBtn: {
    backgroundColor: "#0E7C86",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  primaryBtnText: { color: "white", fontWeight: "900" },
  err: { color: "#8B2E2E", marginTop: 8 },
  card: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  name: { fontWeight: "900" },
  meta: { color: "#4A6468" },
});
