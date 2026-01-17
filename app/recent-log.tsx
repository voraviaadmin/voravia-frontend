import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

function getApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:8787"
  );
}

type LogItem = {
  id: string;
  createdAt?: string;
  dishName?: string;
  confidence?: number | null;
  score?: number;
  label?: string;
  why?: string[];
  tips?: string[];
  nutrition?: any;
  photoUri?: string;
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatMaybe(n: any, unit: string) {
  if (!Number.isFinite(Number(n))) return "—";
  return `${Math.round(Number(n))} ${unit}`;
}

export default function RecentLogDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const api = useMemo(() => getApiBaseUrl(), []);
  const [item, setItem] = useState<LogItem | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setBusy(true);

      const resp = await fetch(`${api}/v1/logs`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || json?.error || `Failed (${resp.status})`);

      const list = Array.isArray(json?.items) ? (json.items as LogItem[]) : [];
      const found = list.find((x) => String(x.id) === String(id));
      if (!found) throw new Error("Log item not found.");
      setItem(found);
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
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent</Text>
        <View style={styles.card}>
          <Text style={styles.error}>Couldn’t load</Text>
          <Text style={styles.muted}>{error || "Unknown error"}</Text>
          <Pressable style={styles.secondaryBtn} onPress={load}>
            <Text style={styles.secondaryBtnText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const score = Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : 0;
  const label = String(item.label || "Okay");

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
          Confidence: {item.confidence == null ? "—" : `${item.confidence}%`} • {fmtTime(item.createdAt)}
        </Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {label} • {score}/100
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Why</Text>
        {item.why?.length ? item.why.map((w, i) => <Text key={i} style={styles.bullet}>• {w}</Text>) : <Text style={styles.muted}>—</Text>}

        <Text style={styles.section}>Tips</Text>
        {item.tips?.length ? item.tips.map((t, i) => <Text key={i} style={styles.bullet}>• {t}</Text>) : <Text style={styles.muted}>—</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Estimated nutrition</Text>

        <View style={styles.nRow}><Text style={styles.nKey}>Calories</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.calories, "kcal")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Protein</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.protein_g, "g")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Carbs</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.carbs_g, "g")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Fat</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.fat_g, "g")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Fiber</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.fiber_g, "g")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Sugar</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.sugar_g, "g")}</Text></View>
        <View style={styles.nRow}><Text style={styles.nKey}>Sodium</Text><Text style={styles.nVal}>{formatMaybe(item.nutrition?.sodium_mg, "mg")}</Text></View>

        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 32, fontWeight: "900", color: "#0B2A2F", marginBottom: 10 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    marginBottom: 12,
  },

  cardLabel: { fontWeight: "900", color: "#0B2A2F", marginBottom: 8 },
  photo: { width: "100%", height: 200, borderRadius: 14, backgroundColor: "#000" },
  photoPlaceholder: { backgroundColor: "#EAF4F5", alignItems: "center", justifyContent: "center" },

  dishName: { fontSize: 24, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  pillRow: { marginTop: 10, flexDirection: "row" },
  pill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E4EFF1", backgroundColor: "#FFF4DF" },
  pillText: { fontWeight: "900", color: "#0B2A2F" },

  section: { marginTop: 10, fontWeight: "900", color: "#0B2A2F", fontSize: 16 },
  bullet: { marginTop: 6, color: "#0B2A2F", fontWeight: "700" },
  muted: { marginTop: 8, color: "#4A6468", fontWeight: "700" },

  nRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  nKey: { color: "#4A6468", fontWeight: "800" },
  nVal: { color: "#0B2A2F", fontWeight: "900" },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  ghostBtn: {
    marginTop: 12,
    backgroundColor: "#F1FBFC",
    borderWidth: 1,
    borderColor: "#CFE8EA",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  ghostBtnText: { color: "#0B2A2F", fontWeight: "900" },

  error: { fontWeight: "900", color: "#B00020" },
});
