import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSavedProfile } from "@/src/storage/voraviaStorage";

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

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  (process.env as any).EXPO_PUBLIC_BACKEND_URL?.trim() ||
  "http://localhost:8787";

const PROFILE_VERSION_KEY = "voravia:profileVersion";

const BASE_CUISINES = [
  "All",
  "Indian",
  "Mexican",
  "Chinese",
  "Italian",
  "Thai",
  "Japanese",
  "Mediterranean",
  "American",
];

// ✅ storage keys for gating + items
const UPLOADKEY_BY_PLACEID_KEY = "voravia:uploadKeyByPlaceId";
const ITEMS_BY_UPLOADKEY_KEY = "voravia:itemsByUploadKey";

function uniqCaseInsensitive(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = (x || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function metersToMiles(m: number) {
  return m * 0.000621371;
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

async function getLocationWeb(): Promise<{ lat: number; lng: number }> {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(err.message)),
        // ✅ CHANGED: added timeout to avoid hanging
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }
  throw new Error("Geolocation not available.");
}

// ✅ NEW: native location for iOS/Android using expo-location (dynamic import so Web doesn't break)
async function getLocationNative(): Promise<{ lat: number; lng: number }> {
  const Location = await import("expo-location");

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted.");
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// ✅ CHANGED: now supports native (iOS Simulator) while keeping Web behavior
async function getLocation(): Promise<{ lat: number; lng: number }> {
  if (Platform.OS === "web") return getLocationWeb();
  return getLocationNative();
}

async function tryFetchJSON(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && `${v}`.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

async function fetchPlaces({
  lat,
  lng,
  radiusMeters,
  limit,
  keyword,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
  keyword: string;
}) {
  // Search endpoint first if keyword set
  if (keyword) {
    const qs = buildQuery({ lat, lng, q: keyword, keyword, radiusMeters, limit });
    const searchGet = await tryFetchJSON(`${API_BASE}/api/places/search${qs}`, { method: "GET" });
    if (searchGet.ok && searchGet.data) return searchGet.data;

    const searchPost = await tryFetchJSON(`${API_BASE}/api/places/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, q: keyword, keyword, radiusMeters, limit }),
    });
    if (searchPost.ok && searchPost.data) return searchPost.data;
  }

  // Nearby fallback
  const qs = buildQuery({ lat, lng, q: keyword, keyword, radiusMeters, limit });
  const nearbyGet = await tryFetchJSON(`${API_BASE}/api/places/nearby${qs}`, { method: "GET" });
  if (nearbyGet.ok && nearbyGet.data) return nearbyGet.data;

  const nearbyPost = await tryFetchJSON(`${API_BASE}/api/places/nearby`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, q: keyword, keyword, radiusMeters, limit }),
  });
  if (nearbyPost.ok && nearbyPost.data) return nearbyPost.data;

  const status = nearbyPost.status || nearbyGet.status || 500;
  const msg = nearbyPost.data?.message || nearbyGet.data?.message || `Backend error (${status})`;
  throw new Error(msg);
}

// ---- storage helpers ----
async function getMap(key: string): Promise<Record<string, any>> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function setMapValue(mapKey: string, k: string, v: any) {
  const map = await getMap(mapKey);
  map[k] = v;
  await AsyncStorage.setItem(mapKey, JSON.stringify(map));
}

export default function RestaurantsScreen() {
  const params = useLocalSearchParams<{ autostart?: string }>();

  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [cuisineOptions, setCuisineOptions] = useState<string[]>(BASE_CUISINES);
  const [preferredCuisine, setPreferredCuisine] = useState<string>("Indian");
  const [cuisine, setCuisine] = useState<string>("Indian");

  const lastProfileVersionRef = useRef<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPlaceId, setUploadingPlaceId] = useState<string>("");

  // ✅ IMPORTANT: loadNearby does NOT depend on React state cuisine (avoids stale mismatch)
  const loadNearby = useCallback(async (cuisineToUse: string) => {
    setLoading(true);
    setError(null);

    try {
      const keyword = cuisineToUse === "All" ? "" : cuisineToUse;

      const { lat, lng } = await getLocation();
      const radiusMeters = 5000;
      const limit = 20;

      const data = await fetchPlaces({ lat, lng, radiusMeters, limit, keyword });

      const items: Place[] = (data.places ?? []).map((p: any) => {
        const plat = p.lat ?? p.location?.lat;
        const plng = p.lng ?? p.location?.lng;

        const distanceM = haversineMeters(lat, lng, plat, plng);
        const rating = p.rating ?? p.googleRating;
        const userRatingCount = p.userRatingCount ?? p.googleUserRatingsTotal;

        const scored = scoreRestaurant({ rating, userRatingCount });

        return {
          id: String(p.id ?? p.placeId ?? `${plat}-${plng}-${p.name}`),
          name: p.name ?? p.displayName ?? "Restaurant",
          address: p.address ?? p.formattedAddress,
          lat: plat,
          lng: plng,
          rating,
          userRatingCount,
          distanceMiles: metersToMiles(distanceM),
          score: scored.score,
          verdict: scored.verdict,
          tags: scored.tags,
        };
      });

      items.sort((a, b) => a.distanceMiles - b.distanceMiles);
      setPlaces(items);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ REQUIREMENT: whenever EatOut is called/entered, reset to Profile default + refresh results
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        try {
          const version = (await AsyncStorage.getItem(PROFILE_VERSION_KEY)) || "";
          const prof = await getSavedProfile();

          const profCuisines = Array.isArray((prof as any)?.cuisines) ? (prof as any).cuisines : [];
          const merged = uniqCaseInsensitive([...BASE_CUISINES, ...profCuisines]);

          const pref = profCuisines.length ? String(profCuisines[0]) : "Indian";
          const safePref = merged.includes(pref) ? pref : "Indian";

          if (!alive) return;

          setCuisineOptions(merged);
          setPreferredCuisine(safePref);

          // ✅ Always reset current selection to profile default when tab is focused
          setCuisine(safePref);

          // ✅ Always refresh restaurants for profile default on entry
          await loadNearby(safePref);

          lastProfileVersionRef.current = version;
        } catch {
          // ignore
        }
      })();

      return () => {
        alive = false;
      };
    }, [loadNearby])
  );

  const onSelectCuisine = async (c: string) => {
    setCuisine(c);
    await loadNearby(c);
  };

  const startUpload = (place: Place) => {
    if (Platform.OS !== "web") {
      setError("Mobile upload is next (expo-image-picker). Web file picker works now.");
      return;
    }
    setError(null);
    setUploadingPlaceId(place.id);
    (fileInputRef.current as any).__place = place;
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList) => {
    const place: Place | undefined = (fileInputRef.current as any)?.__place;
    if (!place) return;

    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);

      const resp = await fetch(`${API_BASE}/api/menu/extract-upload`, {
        method: "POST",
        body: form,
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json) throw new Error(json?.message || `Upload failed (${resp.status})`);

      const uploadKey = String(json.uploadKey || "");
      if (!uploadKey) throw new Error("Upload succeeded but no uploadKey returned.");

      const extractedItems: string[] =
        (json.sections ?? [])
          .flatMap((s: any) => (s.items ?? []).map((i: any) => i.name))
          .filter(Boolean)
          .slice(0, 80) || [];

      if (!extractedItems.length) {
        throw new Error("No menu items extracted. Try a clearer screenshot/PDF.");
      }

      await setMapValue(UPLOADKEY_BY_PLACEID_KEY, place.id, uploadKey);
      await setMapValue(ITEMS_BY_UPLOADKEY_KEY, uploadKey, extractedItems);

      router.push({
        pathname: "/menu",
        params: { placeId: place.id, placeName: place.name },
      });
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setLoading(false);
      setUploadingPlaceId("");
      (fileInputRef.current as any).__place = undefined;
    }
  };

  const header = useMemo(() => {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.title}>Eat Out</Text>
        <Text style={styles.sub}>Nearby restaurants • Distance in miles</Text>

        <View style={styles.chipsRow}>
          {cuisineOptions.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, cuisine === c && styles.chipActive]}
              onPress={() => onSelectCuisine(c)}
            >
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => loadNearby(cuisine)}>
          <Text style={styles.primaryBtnText}>{loading ? "Loading…" : "Use my location"}</Text>
        </Pressable>

        <Text style={styles.hint}>
          Default cuisine from Profile: <Text style={{ fontWeight: "900" }}>{preferredCuisine}</Text>
          {"  "}•{"  "}
          “All” = no cuisine filter
        </Text>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        {Platform.OS === "web" ? (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length) handleFiles(files);
              e.target.value = "";
            }}
          />
        ) : null}
      </View>
    );
  }, [cuisineOptions, cuisine, loading, error, preferredCuisine, loadNearby]);

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
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.metaInline}>{item.distanceMiles.toFixed(1)} mi</Text>
              </View>

              <Text style={styles.meta}>
                {item.rating ? `${item.rating}⭐` : "—"} {item.address ? `• ${item.address}` : ""}
              </Text>

              <View style={styles.actionsRow}>
                <Pressable style={styles.smallBtn} onPress={() => startUpload(item)} disabled={loading}>
                  <Text style={styles.smallBtnText}>
                    {uploadingPlaceId === item.id ? "Uploading…" : "Upload Menu"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.smallBtnGhost}
                  onPress={() =>
                    router.push({
                      pathname: "/menu",
                      params: { placeId: item.id, placeName: item.name },
                    })
                  }
                >
                  <Text style={styles.smallBtnGhostText}>Open Rating</Text>
                </Pressable>
              </View>
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
  hint: { marginTop: 10, color: "#4A6468" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
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

  card: { backgroundColor: "white", padding: 14, borderRadius: 14, marginBottom: 8 },
  name: { fontWeight: "900", flex: 1 },
  meta: { color: "#4A6468", marginTop: 4 },
  metaInline: { color: "#4A6468", fontWeight: "800" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  smallBtn: { backgroundColor: "#0EA5A4", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  smallBtnText: { color: "white", fontWeight: "900" },
  smallBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0EA5A4", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  smallBtnGhostText: { color: "#0EA5A4", fontWeight: "900" },
});
