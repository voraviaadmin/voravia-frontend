import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";

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
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  (Platform.OS === "web" ? "http://localhost:8787" : "http://localhost:8787");

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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// MVP restaurant scoring (replace later with menu-based + health profile rules)
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
  if (place.userRatingCount != null && place.userRatingCount >= 500) {
    score += 3;
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 80 ? "FIT" : score >= 60 ? "MODERATE" : "AVOID";
  return { score, verdict: verdict as Place["verdict"], tags: tags.slice(0, 2) };
}

async function getWebLocation(): Promise<{ lat: number; lng: number }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation not available in this browser.");
  }
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

export default function RestaurantsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadNearby = async () => {
    setLoading(true);
    setError(null);

    try {
      const { lat, lng } = await getWebLocation();

      // ✅ Call backend (NOT Expo)
      const url = `${BACKEND_URL}/api/places/nearby?lat=${lat}&lng=${lng}&limit=20`;

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend error: ${res.status}${text ? ` • ${text}` : ""}`);
      }

      const data = await res.json();

      const items: Place[] = (data.places ?? []).map((p: any) => {
        const distanceM = haversineMeters(lat, lng, p.location.lat, p.location.lng);
        const scored = scoreRestaurant({
          rating: p.rating,
          userRatingCount: p.userRatingCount,
        });

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
      if (items.length === 0) setError("No restaurants found.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (p: Place) => {
    router.push({
      pathname: "/(tabs)/restaurant-details",
      params: {
        id: p.id,
        name: p.name,
        address: p.address ?? "",
        lat: String(p.lat),
        lng: String(p.lng),
        rating: String(p.rating ?? ""),
        score: String(p.score),
        verdict: p.verdict,
      },
    });
  };

  const header = useMemo(() => {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.title}>Eat Out</Text>
        <Text style={styles.sub}>Nearby restaurants (Google Places) • Distance in miles</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={loadNearby}
        >
          <Text style={styles.primaryBtnText}>{loading ? "Loading…" : "Use my location"}</Text>
        </Pressable>

        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
    );
  }, [loading, error]);

  return (
    <View style={styles.container}>
      {loading && places.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Finding restaurants near you…</Text>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={header}
          data={places}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => openDetails(item)}
            >
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.distanceMiles.toFixed(1)} mi •{" "}
                    {item.rating ? `${item.rating.toFixed(1)}⭐` : "—"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.scorePill,
                    item.verdict === "FIT"
                      ? styles.fit
                      : item.verdict === "MODERATE"
                      ? styles.mod
                      : styles.avoid,
                  ]}
                >
                  <Text style={styles.scoreText}>{item.score}</Text>
                </View>
              </View>

              <View style={styles.tagsRow}>
                {item.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )}
        />
      )}
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
  title: { fontSize: 28, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  err: { marginTop: 10, color: "#8B2E2E", fontWeight: "700" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 16, fontWeight: "900", color: "#0B2A2F" },
  meta: { marginTop: 4, color: "#4A6468", fontWeight: "600" },

  scorePill: {
    width: 56,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  fit: { backgroundColor: "#E7FBF7", borderColor: "#BFEDE2" },
  mod: { backgroundColor: "#FFF7E7", borderColor: "#F1D9A6" },
  avoid: { backgroundColor: "#FFEDED", borderColor: "#F1B1B1" },
  scoreText: { fontWeight: "900", color: "#0B2A2F" },

  tagsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  tag: {
    backgroundColor: "#F7FCFD",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tagText: { fontSize: 12, fontWeight: "700", color: "#0B2A2F" },

  pressed: { opacity: 0.86 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { marginTop: 10, color: "#4A6468", fontWeight: "700" },
});
