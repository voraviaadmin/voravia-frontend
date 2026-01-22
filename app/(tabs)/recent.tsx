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
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchFamilyMembers, FamilyMember } from "../../lib/family";
import { getAppContext } from "@/src/storage/appContext";
import { API_BASE } from "../../lib/api";

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

  rating?: { score?: number; label?: string } | null;
  result?: { score?: number; label?: string } | null;
  ratingScore?: number;
  resultScore?: number;
};

type MeResponse = {
  userId?: string;
  mode?: "individual" | "family" | "workplace";
  family?: { members?: Array<{ id: string; name?: string; displayName?: string }> };
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

function localIdToBackendActorId(id: string) {
  if (!id) return "u_head";
  if (id.startsWith("u_")) return id;
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
    (item as any).ratingScore ??
    (item as any).resultScore;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveLabel(item: LogItem, score: number) {
  const raw = item.label || item.rating?.label || item.result?.label;
  if (raw && String(raw).trim()) return String(raw);

  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Okay";
  return "Poor";
}

export default function RecentScreen() {
  const router = useRouter();

  const api = useMemo(() => API_BASE, []);
  const [items, setItems] = useState<LogItem[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [busy, setBusy] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const userDisplayName = useCallback(
    (userId?: string) => {
      if (!userId) return "Me";
      const fromMe =
        me?.family?.members?.find((m) => String(m.id) === String(userId))?.displayName ||
        me?.family?.members?.find((m) => String(m.id) === String(userId))?.name;
      if (fromMe) return fromMe;
      return family.find((m) => m.id === userId)?.name ?? userId;
    },
    [family, me]
  );

  const load = useCallback(async () => {
    try {
      setError(null);

      const ctx = await getAppContext();
      const actor = localIdToBackendActorId(String((ctx as any)?.currentUserId || "head"));

      const [logsResp, famResp, meResp] = await Promise.all([
        fetch(`${api}/v1/logs`, { method: "GET", headers: { "x-user-id": actor } }),
        fetchFamilyMembers().catch(() => [] as any),
        fetch(`${api}/v1/me`, { method: "GET", headers: { "x-user-id": actor } }).catch(() => null),
      ]);

      const logsJson = await logsResp.json().catch(() => ({}));
      if (!logsResp.ok) throw new Error(logsJson?.message || logsJson?.error || `Failed (${logsResp.status})`);

      const meJson = meResp ? await meResp.json().catch(() => null) : null;

      const list = Array.isArray(logsJson?.items) ? (logsJson.items as LogItem[]) : [];
      const sorted = list
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

      setFamily(famResp);
      setMe(meJson || null);
      setItems(sorted);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs");
      setItems([]);
      setMe(null);
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

  const deleteLog = useCallback(
    async (logId: string) => {
      const ctx = await getAppContext();
      const actor = localIdToBackendActorId(String((ctx as any)?.currentUserId || "head"));

      const resp = await fetch(`${api}/v1/logs/${encodeURIComponent(logId)}`, {
        method: "DELETE",
        headers: { "x-user-id": actor },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || json?.message || "Delete failed");

      // Optimistic remove
      setItems((prev) => prev.filter((x) => String(x.id) !== String(logId)));
    },
    [api]
  );

  const grouped = useMemo(() => {
    const groups: Record<"Today" | "Yesterday" | "Earlier", LogItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const it of items) groups[getDayBucket(it.createdAt)].push(it);

    const byTimeDesc = (a: LogItem, b: LogItem) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""));

    const orderBucket = (arr: LogItem[]) => {
      const memberOrder = (me?.family?.members ?? []).map((m) => String(m.id)).filter(Boolean);
      if (!memberOrder.length) return arr.slice().sort(byTimeDesc);

      const buckets = new Map<string, LogItem[]>();
      for (const it of arr) {
        const uid = String(it.userId || "");
        if (!buckets.has(uid)) buckets.set(uid, []);
        buckets.get(uid)!.push(it);
      }
      for (const list of buckets.values()) list.sort(byTimeDesc);

      const out: LogItem[] = [];
      for (const uid of memberOrder) {
        const list = buckets.get(uid);
        if (list?.length) out.push(...list);
        buckets.delete(uid);
      }

      const remainingIds = Array.from(buckets.keys()).sort();
      for (const uid of remainingIds) {
        const list = buckets.get(uid);
        if (list?.length) out.push(...list);
      }
      return out;
    };

    return {
      Today: orderBucket(groups.Today),
      Yesterday: orderBucket(groups.Yesterday),
      Earlier: orderBucket(groups.Earlier),
    };
  }, [items, me]);

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
                const score = deriveScore(it);
                const label = deriveLabel(it, score);
                const pillStyle =
                  score >= 80 ? styles.pillGood : score >= 60 ? styles.pillOk : styles.pillBad;

                return (
                  <Pressable
                    key={it.id}
                    style={styles.rowCard}
                    onPress={() => router.push({ pathname: "/recent-log", params: { id: it.id } })}
                    onLongPress={() => {
                      Alert.alert(
                        "Delete log?",
                        `${it.dishName || "Unknown dish"}\n${userDisplayName(it.userId)} · ${capitalize(it.mealType)} · ${fmtTime(it.createdAt)}`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deleteLog(it.id);
                              } catch (e: any) {
                                Alert.alert("Delete failed", e?.message || "Couldn’t delete.");
                              }
                            },
                          },
                        ]
                      );
                    }}
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
  title: { fontSize: 28, fontWeight: "800", color: "#0B2A2F", letterSpacing: 0.2 },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700", marginBottom: 10 },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2EEF0",
  },

  sectionHeader: {
    fontWeight: "900",
    color: "#0B2A2F",
    marginBottom: 10,
    letterSpacing: 0.6,
  },

  rowCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2EEF0",
    marginBottom: 10,
    gap: 12,
  },

  thumbWrap: { width: 64, height: 64, borderRadius: 14, overflow: "hidden" },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  thumbPlaceholder: { backgroundColor: "#EAF4F5" },

  rowTitle: { fontSize: 16, fontWeight: "900", color: "#0B2A2F" },
  rowMeta: { marginTop: 4, color: "#4A6468", fontWeight: "700" },

  pillRow: { marginTop: 8, flexDirection: "row" },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontWeight: "900", color: "#0B2A2F" },

  pillGood: { backgroundColor: "#E8FBF3", borderWidth: 1, borderColor: "#BFEFDC" },
  pillOk: { backgroundColor: "#FFF4E0", borderWidth: 1, borderColor: "#F1D9A5" },
  pillBad: { backgroundColor: "#FFE8E8", borderWidth: 1, borderColor: "#F2BABA" },

  error: { fontWeight: "900", color: "#B00020", marginBottom: 6 },
  muted: { color: "#4A6468", fontWeight: "700" },

  emptyTitle: { fontWeight: "900", color: "#0B2A2F", fontSize: 16, marginBottom: 6 },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#0F766E",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900" },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "#EAF4F5",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7E9EB",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },
});
