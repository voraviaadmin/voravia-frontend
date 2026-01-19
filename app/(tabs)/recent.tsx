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

type MeResponse = {
  userId?: string;
  activeProfile?: string;
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

export default function RecentScreen() {
  const router = useRouter();

  const [items, setItems] = useState<LogItem[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meId, setMeId] = useState<string>("u_self");

  const [busy, setBusy] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => getApiBaseUrl(), []);

  const userDisplayName = useCallback(
    (userId?: string) => {
      if (!userId) return "Me";

      // Prefer /v1/me family member display names (source of truth for order + label)
      const fromMe =
        me?.family?.members?.find((m) => String(m.id) === String(userId))?.displayName ||
        me?.family?.members?.find((m) => String(m.id) === String(userId))?.name;

      if (fromMe) return fromMe;

      // Fallback to local family list (existing behavior)
      return family.find((m) => m.id === userId)?.name ?? userId;
    },
    [family, me]
  );

  const fetchMe = useCallback(async (): Promise<MeResponse> => {
    const r = await fetch(`${api}/v1/me`, { method: "GET" });
    const j = (await r.json().catch(() => null)) as MeResponse | null;
    if (!r.ok || !j) throw new Error(`Failed to load /v1/me (${r.status})`);
    return j;
  }, [api]);

  const load = useCallback(async () => {
    try {
      setError(null);

      const [logsResp, fam, meJson] = await Promise.all([
        fetch(`${api}/v1/logs`, { method: "GET" }),
        fetchFamilyMembers(),
        fetchMe().catch(() => ({} as MeResponse)), // non-fatal fallback
      ]);

      const logsJson = await logsResp.json().catch(() => ({}));
      if (!logsResp.ok) {
        throw new Error(logsJson?.message || logsJson?.error || `Failed (${logsResp.status})`);
      }

      const list = Array.isArray(logsJson?.items) ? (logsJson.items as LogItem[]) : [];

      // Keep original global sort (createdAt desc)
      const sorted = list
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

      setFamily(fam);
      setItems(sorted);

      setMe(meJson || null);
      const nextMeId = String(meJson?.userId || "").trim();
      setMeId(nextMeId || "u_self");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs");
      setItems([]);
      setMe(null);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [api, fetchMe]);

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

    const byTimeDesc = (a: LogItem, b: LogItem) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""));

    // For each day bucket:
    // Member order EXACTLY matches /v1/me.family.members
    // And within each member: newest -> oldest
    const orderBucket = (arr: LogItem[]) => {
      const memberOrder = (me?.family?.members ?? [])
        .map((m) => String(m.id))
        .filter(Boolean);

      // If we don't have a family list (individual mode), just sort newest->oldest overall
      if (!memberOrder.length) return arr.slice().sort(byTimeDesc);

      // Bucket logs by userId
      const buckets = new Map<string, LogItem[]>();
      for (const it of arr) {
        const uid = String(it.userId || "");
        if (!buckets.has(uid)) buckets.set(uid, []);
        buckets.get(uid)!.push(it);
      }

      // Sort each member bucket newest->oldest
      for (const list of buckets.values()) list.sort(byTimeDesc);

      // Emit in /v1/me family member order
      const out: LogItem[] = [];
      for (const uid of memberOrder) {
        const list = buckets.get(uid);
        if (list?.length) out.push(...list);
        buckets.delete(uid);
      }

      // Append any remaining userIds (not in /v1/me.family.members)
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
  }, [items, me, meId]);

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
