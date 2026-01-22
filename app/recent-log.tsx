import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { API_BASE } from "../lib/api";

type LogItem = {
  id: string;
  createdAt?: string;
  dishName?: string;
  photoUri?: string;
  confidence?: number;
  // score can exist in multiple shapes depending on your pipeline
  score?: number;
  label?: string;

  rating?: { score?: number; label?: string } | null;
  result?: { score?: number; label?: string } | null;

  why?: string[];
  tips?: string[];
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  estimatedNutrition?: any;
};

function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatMaybe(n: any, unit: string) {
  if (!Number.isFinite(Number(n))) return "—";
  return `${Math.round(Number(n))} ${unit}`;
}

function localIdToBackendId(id: string) {
  // if already backend id, keep it
  if (id?.startsWith("u_")) return id;
  if (id === "head") return "u_head";
  if (id === "spouse") return "u_spouse";
  if (id === "child1") return "u_child1";
  if (id === "child2") return "u_child2";
  return "u_head";
}

function deriveScore(item: LogItem) {
  const raw =
    item.score ??
    item.rating?.score ??
    item.result?.score ??
    (item as any)?.ratingScore ??
    (item as any)?.resultScore;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // scores in your UI are 0..100
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveLabel(item: LogItem, score: number) {
  const raw = item.label || item.rating?.label || item.result?.label;
  if (raw && String(raw).trim()) return String(raw);

  // fallback buckets
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Okay";
  return "Poor";
}

export default function RecentLogDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const api = useMemo(() => API_BASE, []);
  const [item, setItem] = useState<LogItem | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  

  const load = useCallback(async () => {
    try {
      setError(null);
      setBusy(true);

      const ctx = await getAppContext();
      const backendUserId = localIdToBackendId(String((ctx as any)?.currentUserId || "head"));

      const resp = await fetch(`${api}/v1/logs`, {
        headers: { "x-user-id": backendUserId },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || json?.error || `Failed (${resp.status})`);

      const list = Array.isArray(json?.items) ? (json.items as LogItem[]) : [];
      
      
      const found = list.find((x) => String(x.id) === String(id));
      
      
      
      if (!found) throw new Error("Log item not found.");
      const normalized = {
        ...found,
        nutrition: found?.nutrition ?? found?.estimatedNutrition ?? null,
      };
      setItem(normalized);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");

      setItem(null);
      
    } finally {
      setBusy(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (busy) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorTitle}>Couldn’t load</Text>
        <Text style={styles.muted}>{error}</Text>
        <Pressable style={styles.primaryBtn} onPress={load}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!item) return null;

  const score = deriveScore(item);
  const label = deriveLabel(item, score);
  const confPct =
  item?.confidence != null
    ? (Number(item.confidence) <= 1 ? Math.round(Number(item.confidence) * 100) : Math.round(Number(item.confidence)))
    : 0;


  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Scan Result</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Photo</Text>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={{ color: "#4A6468", fontWeight: "800" }}>No photo</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.dishName}>{item.dishName || "Unknown dish"}</Text>
        <Text style={styles.sub}>
          Confidence: {item.confidence == null ? "—" : `${confPct}%`} • {fmtTime(item.createdAt)}
        </Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{label}</Text>
          </View>
          <View style={[styles.pill, styles.pillScore]}>
            <Text style={[styles.pillText, styles.pillScoreText]}>{score}/100</Text>
          </View>
        </View>

        <Text style={styles.section}>Why</Text>
        {item.why?.length ? (
          item.why.map((w, i) => (
            <Text key={i} style={styles.bullet}>
              • {w}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>—</Text>
        )}

        <Text style={styles.section}>Tips</Text>
        {item.tips?.length ? (
          item.tips.map((t, i) => (
            <Text key={i} style={styles.bullet}>
              • {t}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>—</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Estimated nutrition</Text>

        <View style={styles.nRow}>
          <Text style={styles.nKey}>Calories</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.calories, "kcal")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Protein</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.protein_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Carbs</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.carbs_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Fat</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.fat_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Fiber</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.fiber_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Sugar</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.sugar_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Sodium</Text>
          <Text style={styles.nVal}>{formatMaybe(item.nutrition?.sodium_mg, "mg")}</Text>
        </View>
      </View>

      <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
        <Text style={styles.ghostBtnText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6F7", padding: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 10 },

  title: { fontSize: 24, fontWeight: "900", marginBottom: 12, color: "#0B1B1D" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  cardLabel: { fontWeight: "900", color: "rgba(11,27,29,0.65)", marginBottom: 10 },

  photo: { width: "100%", height: 220, borderRadius: 14, backgroundColor: "#E8EEF0" },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },

  dishName: { fontSize: 18, fontWeight: "900", color: "#0B1B1D" },
  sub: { marginTop: 6, color: "rgba(11,27,29,0.65)", fontWeight: "700" },

  pillRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 10 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.10)",
  },
  pillText: { fontWeight: "900", color: "#0F766E" },
  pillScore: { backgroundColor: "rgba(0,0,0,0.06)" },
  pillScoreText: { color: "rgba(11,27,29,0.80)" },

  section: { marginTop: 12, fontWeight: "900", color: "#0B1B1D" },
  bullet: { marginTop: 6, color: "rgba(11,27,29,0.80)", fontWeight: "700" },
  muted: { color: "rgba(11,27,29,0.55)", fontWeight: "700" },

  nRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  nKey: { color: "rgba(11,27,29,0.70)", fontWeight: "800" },
  nVal: { color: "rgba(11,27,29,0.85)", fontWeight: "900" },

  errorTitle: { fontSize: 18, fontWeight: "900", color: "#8B1E1E" },

  primaryBtn: { marginTop: 10, backgroundColor: "#0F766E", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  ghostBtn: { marginTop: 10, backgroundColor: "rgba(0,0,0,0.06)", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: "center" },
  ghostBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },
});
