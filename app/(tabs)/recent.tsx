import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchFamilyMembers, FamilyMember } from "../lib/family";

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
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  userId?: string;
  dishName?: string;
  confidence?: number | null;
  score?: number;
  label?: string;
  photoUri?: string;
};

const capitalize = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDayBucket(createdAt?: string): "Today" | "Yesterday" | "Earlier" {
  if (!createdAt) return "Earlier";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Earlier";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return "Earlier";
}

export default function RecentScreen() {
  const router = useRouter();

  const [items, setItems] = useState<LogItem[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [busy, setBusy] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => getApiBaseUrl(), []);

  const userDisplayName = useCallback(
    (userId?: string) => {
      if (!userId) return "Me";
      return family.find((m) => m.id === userId)?.name ?? userId;
    },
    [family]
  );

  const load = useCallback(async () => {
    try {
      setError(null);

      const [logsResp, fam] = await Promise.all([
        fetch(`${api}/v1/logs`, { method: "GET" }),
        fetchFamilyMembers(),
      ]);

      const logsJson = await logsResp.json().catch(() => ({}));
      if (!logsResp.ok) {
        throw new Error(logsJson?.message || logsJson?.error || `Failed (${logsResp.status})`);
      }

      const list = Array.isArray(logsJson?.items) ? (logsJson.items as LogItem[]) : [];
      const sorted = list
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

      setFamily(fam);
      setItems(sorted);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs");
      setItems([]);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      setBusy(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups: Record<"Today" | "Yesterday" | "Earlier", LogItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const it of items) {
      groups[getDayBucket(it.createdAt)].push(it);
    }
    return groups;
  }, [items]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Recent</Text>
      <Text style={styles.sub}>Your logged meals</Text>

      {busy && (
        <View style={{ marginTop: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {!busy && error && (
        <View style={styles.card}>
          <Text style={styles.error}>Couldn’t load recent logs</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.secondaryBtn} onPress={load}>
            <Text style={styles.secondaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!busy && !error && items.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No scans logged yet</Text>
          <Text style={styles.muted}>
            Go to Scan → analyze a photo → tap “Log this meal”. It will appear here.
          </Text>

          <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/scan")}>
            <Text style={styles.primaryBtnText}>Scan now</Text>
          </Pressable>
        </View>
      )}

      {!busy &&
        !error &&
        (["Today", "Yesterday", "Earlier"] as const).map((section) => {
          const list = grouped[section];
          if (!list.length) return null;

          return (
            <View key={section} style={{ marginTop: 14 }}>
              <Text style={styles.sectionHeader}>{section}</Text>

              {list.map((it) => {
                const label = String(it.label || "Okay");
                const score = Number.isFinite(Number(it.score)) ? Math.round(Number(it.score)) : 0;
                const pillStyle =
                  score >= 80 ? styles.pillGood : score >= 60 ? styles.pillOk : styles.pillBad;

                return (
                  <Pressable
                    key={it.id}
                    style={styles.rowCard}
                    onPress={() => router.push({ pathname: "/recent-log", params: { id: it.id } })}
                  >
                    <View style={styles.thumbWrap}>
                      {it.photoUri ? (
                        <Image source={{ uri: it.photoUri }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {it.dishName || "Unknown dish"}
                      </Text>

                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {userDisplayName(it.userId)} · {capitalize(it.mealType)} · {fmtTime(it.createdAt)}
                      </Text>

                      <View style={styles.pillRow}>
                        <View style={[styles.pill, pillStyle]}>
                          <Text style={styles.pillText}>
                            {label} • {score}/100
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 32, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700", marginBottom: 10 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    marginTop: 12,
  },

  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  thumbWrap: { width: 76, height: 76, borderRadius: 14, overflow: "hidden" },
  thumb: { width: "100%", height: "100%", backgroundColor: "#000" },
  thumbPlaceholder: { backgroundColor: "#EAF4F5" },

  rowTitle: { fontSize: 16, fontWeight: "900", color: "#0B2A2F" },
  rowMeta: { marginTop: 4, color: "#4A6468", fontWeight: "700" },

  pillRow: { marginTop: 8, flexDirection: "row" },
  pill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1 },
  pillGood: { backgroundColor: "#E7FAF3", borderColor: "#BFECDD" },
  pillOk: { backgroundColor: "#FFF4DF", borderColor: "#F0D3A1" },
  pillBad: { backgroundColor: "#FFE8E8", borderColor: "#F1B9B9" },
  pillText: { fontWeight: "900", color: "#0B2A2F" },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

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

  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0B2A2F" },
  muted: { marginTop: 8, color: "#4A6468", fontWeight: "700", lineHeight: 18 },

  error: { fontWeight: "900", color: "#B00020" },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: "#4A6468",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
});
