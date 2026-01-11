import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSavedProfile, saveProfile, getCachedRating, setCachedRating } from "@/src/storage/voraviaStorage";

type Verdict = "FIT" | "MODERATE" | "AVOID";

type Profile = {
  diabetes: boolean;
  htn: boolean;
  nafld: boolean;
  goal: "Lose" | "Maintain" | "Gain";
  cuisines?: string[];
};

type RatedItem = {
  input: string;
  name?: string;
  score?: number;
  verdict?: Verdict;
  reasons?: string[];
  nutrition?: { calories?: number; confidence?: number };
};

type RateResponse = {
  ratedItems?: RatedItem[];
  cached?: boolean;
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8787";

// same keys as restaurants.tsx
const UPLOADKEY_BY_PLACEID_KEY = "voravia:uploadKeyByPlaceId";
const ITEMS_BY_UPLOADKEY_KEY = "voravia:itemsByUploadKey";

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

async function getMapValue<T>(mapKey: string, k: string, fallback: T): Promise<T> {
  const map = await getMap(mapKey);
  return (map[k] as T) ?? fallback;
}

function verdictColor(v?: Verdict) {
  if (v === "FIT") return "#11c29a";
  if (v === "MODERATE") return "#f6c026";
  if (v === "AVOID") return "#ff5a5f";
  return "#9fb3c8";
}

function coerceHealthProfile(raw: any): Profile {
  const p = raw ?? {};
  return {
    diabetes: !!p.diabetes,
    htn: !!p.htn,
    nafld: !!p.nafld,
    goal: (p.goal as any) || "Maintain",
    cuisines: Array.isArray(p.cuisines) ? p.cuisines : undefined,
  };
}

export default function MenuRatingScreen() {
  const params = useLocalSearchParams<{ placeId?: string; placeName?: string }>();
  const placeId = params?.placeId ? String(params.placeId) : "";
  const placeName = params?.placeName ? String(params.placeName) : "";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    diabetes: false,
    htn: false,
    nafld: false,
    goal: "Maintain",
  });

  const [uploadKey, setUploadKey] = useState<string>("");
  const [items, setItems] = useState<string[]>([]);
  const [rated, setRated] = useState<RatedItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | Verdict>("ALL");

  // load profile
  useEffect(() => {
    (async () => {
      try {
        const p = await getSavedProfile();
        if (p) setProfile(coerceHealthProfile(p));
      } catch {
        // ignore
      }
    })();
  }, []);

  // save profile changes
  useEffect(() => {
    (async () => {
      try {
        await saveProfile(profile);
      } catch {
        // ignore
      }
    })();
  }, [profile.diabetes, profile.htn, profile.nafld, profile.goal]);

  // load uploadKey + items for this placeId (gated)
  useEffect(() => {
    (async () => {
      setError(null);
      setRated([]);

      if (!placeId) {
        setUploadKey("");
        setItems([]);
        return;
      }

      const key = await getMapValue<string>(UPLOADKEY_BY_PLACEID_KEY, placeId, "");
      setUploadKey(key);

      if (!key) {
        setItems([]);
        return;
      }

      const savedItems = await getMapValue<string[]>(ITEMS_BY_UPLOADKEY_KEY, key, []);
      setItems(Array.isArray(savedItems) ? savedItems : []);
    })();
  }, [placeId]);

  async function runRating() {
    if (!uploadKey) {
      setError("No menu uploaded for this restaurant yet. Go back to Eat Out → Upload Menu.");
      return;
    }
    if (!items.length) {
      setError("Menu items missing for this upload. Re-upload from Eat Out with a clearer photo/PDF.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const cached = await getCachedRating(uploadKey, profile);
      if (cached?.rating?.ratedItems?.length) {
        setRated(cached.rating.ratedItems);
        return;
      }

      const { diabetes, htn, nafld, goal } = profile;

      const resp = await fetch(`${API_BASE}/api/menu/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadKey,
          items: items.slice(0, 80), // ✅ prevent 400, keep payload bounded
          profile: { diabetes, htn, nafld, goal },
        }),
      });

      const json = (await resp.json().catch(() => null)) as RateResponse | null;
      if (!resp.ok || !json) {
        const msg = (json as any)?.message || `Request failed (${resp.status})`;
        throw new Error(msg);
      }

      setRated(json.ratedItems || []);
      await setCachedRating(uploadKey, profile, json);
    } catch (e: any) {
      setError(e?.message || "Rating failed");
    } finally {
      setBusy(false);
    }
  }

  // auto-rate whenever we have uploadKey + items (and when profile changes, cache will handle fast)
  useEffect(() => {
    if (!uploadKey || !items.length) return;
    runRating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadKey, items, profile.diabetes, profile.htn, profile.nafld, profile.goal]);

  const visibleRated = useMemo(() => {
    if (filter === "ALL") return rated;
    return rated.filter((r) => r.verdict === filter);
  }, [rated, filter]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Menu Rating</Text>
      {placeName ? <Text style={styles.sub}>Restaurant: {placeName}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>

        <ToggleRow label="Diabetes" value={profile.diabetes} onPress={() => setProfile((p) => ({ ...p, diabetes: !p.diabetes }))} />
        <ToggleRow label="Hypertension" value={profile.htn} onPress={() => setProfile((p) => ({ ...p, htn: !p.htn }))} />
        <ToggleRow label="Fatty Liver" value={profile.nafld} onPress={() => setProfile((p) => ({ ...p, nafld: !p.nafld }))} />

        <View style={{ height: 10 }} />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {(["Lose", "Maintain", "Gain"] as const).map((g) => (
            <Chip key={g} label={g} active={profile.goal === g} onPress={() => setProfile((p) => ({ ...p, goal: g }))} />
          ))}
        </View>
      </View>

      <View style={styles.filtersRow}>
        {(["ALL", "FIT", "MODERATE", "AVOID"] as const).map((v) => (
          <FilterChip key={v} label={v} active={filter === v} onPress={() => setFilter(v)} />
        ))}
      </View>

      {busy ? (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: "#52606d" }}>Analyzing…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setError(null)}>
            <Text style={styles.retryBtnText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {visibleRated.length ? (
        <View style={{ marginTop: 14 }}>
          {visibleRated.map((r, idx) => (
            <View key={`${r.input}-${idx}`} style={styles.itemCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={styles.itemName}>{r.name || r.input}</Text>
                <View style={[styles.badge, { borderColor: verdictColor(r.verdict) }]}>
                  <Text style={[styles.badgeText, { color: verdictColor(r.verdict) }]}>{r.verdict || "—"}</Text>
                </View>
              </View>

              <Text style={styles.itemMeta}>
                Score: <Text style={{ fontWeight: "900" }}>{r.score ?? "—"}</Text>
                {"  "}•{"  "}
                Calories: <Text style={{ fontWeight: "900" }}>{r.nutrition?.calories ?? "—"}</Text>
                {r.nutrition?.confidence != null ? (
                  <>
                    {"  "}•{"  "}Confidence:{" "}
                    <Text style={{ fontWeight: "900" }}>{Math.round(r.nutrition.confidence * 100)}%</Text>
                  </>
                ) : null}
              </Text>

              {r.reasons?.length ? (
                <View style={{ marginTop: 8 }}>
                  {r.reasons.slice(0, 4).map((x, i) => (
                    <Text key={i} style={styles.reason}>
                      • {x}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.pill, value ? styles.pillOn : styles.pillOff]}>
        <Text style={styles.pillText}>{value ? "ON" : "OFF"}</Text>
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipOn : styles.chipOff]} onPress={onPress}>
      <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: "ALL" | Verdict;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active ? styles.filterChipOn : styles.filterChipOff]} onPress={onPress}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextOn : styles.filterChipTextOff]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 16, paddingBottom: 40 },

  h1: { fontSize: 34, fontWeight: "900", color: "#0b1220" },
  sub: { marginTop: 6, color: "#52606d", fontSize: 14 },

  card: {
    marginTop: 14,
    backgroundColor: "#0b1324",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: { color: "white", fontSize: 16, fontWeight: "800" },

  toggleRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { color: "white", fontSize: 14, fontWeight: "700" },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillOn: { backgroundColor: "rgba(64,196,160,0.25)", borderWidth: 1, borderColor: "rgba(64,196,160,0.55)" },
  pillOff: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pillText: { color: "white", fontSize: 12, fontWeight: "800" },

  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "rgba(64,196,160,0.25)", borderColor: "rgba(64,196,160,0.55)" },
  chipOff: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" },
  chipText: { fontSize: 13, fontWeight: "800" },
  chipTextOn: { color: "white" },
  chipTextOff: { color: "rgba(255,255,255,0.75)" },

  filtersRow: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  filterChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  filterChipOn: { backgroundColor: "rgba(15,23,42,0.9)", borderColor: "rgba(15,23,42,0.9)" },
  filterChipOff: { backgroundColor: "rgba(255,255,255,0.9)", borderColor: "rgba(15,23,42,0.12)" },
  filterChipText: { fontSize: 13, fontWeight: "900" },
  filterChipTextOn: { color: "white" },
  filterChipTextOff: { color: "#0b1220" },

  itemCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 12,
  },
  itemName: { fontSize: 16, fontWeight: "900", color: "#0b1220", flex: 1 },
  itemMeta: { marginTop: 8, color: "#52606d", fontSize: 13 },

  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 2, alignSelf: "flex-start" },
  badgeText: { fontWeight: "900", fontSize: 12 },

  reason: { color: "#334e68", marginTop: 4, fontSize: 13 },

  errorBox: {
    marginTop: 14,
    backgroundColor: "#fde7e9",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f5b5ba",
  },
  errorTitle: { fontSize: 16, fontWeight: "900", color: "#7f1d1d" },
  errorText: { marginTop: 6, color: "#7f1d1d" },
  retryBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 12, alignItems: "center", backgroundColor: "#ef4444" },
  retryBtnText: { color: "white", fontWeight: "900" },
});
