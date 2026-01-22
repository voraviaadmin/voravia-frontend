import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";

import { listUsers, UserProfile } from "@/src/storage/users";
import { getAppContext } from "@/src/storage/appContext";
import { Theme } from "@/src/ui/theme";

import { API_BASE } from "../../lib/api";

type GroupUsageResp = {
  mode: "individual" | "family" | "workplace" | null;
  billingOwnerId: string;
  days: number;
  provider: "all" | "google" | "openai";
  totalCostUsd: number;
  bySubjectUserId: Record<string, number>;
  byService: { provider: string; service: string; costUsd: number }[];
  items?: Array<{
    ts?: string;
    billingOwnerId?: string;
    provider?: string;
    costUsd?: number;
  }>;
};

function money(x: number) {
  const n = Number.isFinite(x) ? x : 0;
  return `$${n.toFixed(2)}`;
}

function moneyTight(x: number) {
  const n = Number.isFinite(x) ? x : 0;
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function localIdToBackendId(id: string) {
  if (id?.startsWith("u_")) return id;
  if (id === "head") return "u_head";
  if (id === "spouse") return "u_spouse";
  if (id === "child1") return "u_child1";
  if (id === "child2") return "u_child2";
  return "u_head";
}

export default function UsageScreen() {
  const insets = useSafeAreaInsets();

  const [days, setDays] = useState(30);
  const [provider, setProvider] = useState<"all" | "google" | "openai">("all");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<GroupUsageResp | null>(null);

  const [segment, setSegment] = useState<"individual" | "family" | "workplace">("individual");

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setLoading(true);
          setErr(null);

          // Users (local store, for display names)
          const u = await listUsers();
          if (!cancelled) setUsers(u);

          // ✅ FIX: await getAppContext
          const ctx = await getAppContext();
          const seg = String((ctx as any)?.segment || "individual") as any;
          if (!cancelled) setSegment(seg);

          const localUserId = String((ctx as any)?.currentUserId || "head");
          const backendUserId = localIdToBackendId(localUserId);

          // Me (backend)
          const meResp = await fetch(`${API_BASE}/v1/me`, {
            headers: { "x-user-id": backendUserId },
          });
          const me = await meResp.json().catch(() => ({}));

          // Member name map from backend family list if present
          const nameMap: Record<string, string> = {};
          const members = me?.family?.members || [];
          for (const m of members) {
            if (m?.id) nameMap[String(m.id)] = String(m.name || m.displayName || m.id);
          }
          if (!cancelled) setMemberNameById(nameMap);

          // Billing owner: backend uses userId (u_head etc)
          const billingOwnerId = String(me?.userId || backendUserId);

          const usageResp = await fetch(
            `${API_BASE}/v1/group-usage?days=${days}&provider=${encodeURIComponent(
              provider
            )}&billingOwnerId=${encodeURIComponent(billingOwnerId)}`,
            { headers: { "x-user-id": billingOwnerId } }
          );

          if (!usageResp.ok) {
            const txt = await usageResp.text();
            throw new Error(txt || `HTTP ${usageResp.status}`);
          }

          const usageJson = (await usageResp.json().catch(() => ({}))) as GroupUsageResp;
          if (!cancelled) setUsage(usageJson);
        } catch (e: any) {
          if (!cancelled) {
            setErr(e?.message || "Failed to load usage");
            setUsage(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [days, provider])
  );

  const total = usage?.totalCostUsd ?? 0;

  const byMemberRows = useMemo(() => {
    const map = usage?.bySubjectUserId || {};
    const entries = Object.entries(map)
      .map(([id, cost]) => ({ id, cost }))
      .sort((a, b) => (b.cost || 0) - (a.cost || 0));
    return entries;
  }, [usage]);

  const byServiceRows = useMemo(() => {
    const rows = Array.isArray(usage?.byService) ? usage!.byService : [];
    return [...rows].sort((a, b) => (b.costUsd || 0) - (a.costUsd || 0));
  }, [usage]);

  const canShowSpend = segment === "individual" || segment === "family";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.safe}
        contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}
      >
        <View style={styles.topRow}>
          <Text style={styles.title}>Usage</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          <Pressable onPress={() => setDays(7)} style={[styles.pill, days === 7 && styles.pillOn]}>
            <Text style={[styles.pillText, days === 7 && styles.pillTextOn]}>7d</Text>
          </Pressable>
          <Pressable onPress={() => setDays(30)} style={[styles.pill, days === 30 && styles.pillOn]}>
            <Text style={[styles.pillText, days === 30 && styles.pillTextOn]}>30d</Text>
          </Pressable>

          <View style={{ width: 10 }} />

          <Pressable
            onPress={() => setProvider("all")}
            style={[styles.pill, provider === "all" && styles.pillOn]}
          >
            <Text style={[styles.pillText, provider === "all" && styles.pillTextOn]}>All</Text>
          </Pressable>
          <Pressable
            onPress={() => setProvider("google")}
            style={[styles.pill, provider === "google" && styles.pillOn]}
          >
            <Text style={[styles.pillText, provider === "google" && styles.pillTextOn]}>Google</Text>
          </Pressable>
          <Pressable
            onPress={() => setProvider("openai")}
            style={[styles.pill, provider === "openai" && styles.pillOn]}
          >
            <Text style={[styles.pillText, provider === "openai" && styles.pillTextOn]}>AI</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : err ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Couldn’t load</Text>
            <Text style={styles.muted}>{err}</Text>
          </View>
        ) : !canShowSpend ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Spend</Text>
            <Text style={styles.muted}>
              Spend is available for Individual and Family only.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>This period</Text>
              <Text style={styles.money}>{money(total)}</Text>
              <Text style={styles.mutedSmall}>Includes today so far • Updates daily</Text>
            </View>

            {/* Today so far (if backend includes it in items; otherwise keep existing line) */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Today so far</Text>
                <Text style={styles.moneySmall}>
                  {moneyTight(
                    (usage?.items || [])
                      .filter((x) => String(x?.ts || "").startsWith(new Date().toISOString().slice(0, 10)))
                      .reduce((acc, x) => acc + (Number(x?.costUsd) || 0), 0)
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>By member</Text>
              <View style={{ marginTop: 10 }}>
                {byMemberRows.map((r) => {
                  
                  const pretty =
                    memberNameById[r.id] ||
                    (users.find((u) => String((u as any).id) === r.id) as any)?.displayName ||
                    r.id;

                  
                    return (
                    <View key={r.id} style={styles.rowBetween}>
                      <Text style={styles.rowLabel}>{pretty}</Text>
                      <Text style={styles.rowValue}>{moneyTight(r.cost)}</Text>
                    </View>
                  );
                })}
                {byMemberRows.length === 0 ? <Text style={styles.mutedSmall}>—</Text> : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>By service</Text>
              <View style={{ marginTop: 10 }}>
                {byServiceRows.map((r, idx) => (
                  <View key={`${r.provider}-${r.service}-${idx}`} style={styles.rowBetween}>
                    <Text style={styles.rowLabel}>
                      {r.provider} • {r.service}
                    </Text>
                    <Text style={styles.rowValue}>{moneyTight(r.costUsd)}</Text>
                  </View>
                ))}
                {byServiceRows.length === 0 ? <Text style={styles.mutedSmall}>—</Text> : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const C = (Theme as any)?.colors ?? {};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg ?? "#F3F6F7" },

  topRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "900", color: C.text ?? "#0B1B1D" },
  done: { fontWeight: "900", color: C.teal ?? "#0F766E" },

  filters: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.10)",
  },
  pillOn: { backgroundColor: C.teal ?? "#0F766E" },
  pillText: { fontWeight: "900", color: C.teal ?? "#0F766E" },
  pillTextOn: { color: "#fff" },

  center: { alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 10 },
  muted: { fontWeight: "700", color: "rgba(11,27,29,0.55)" },
  mutedSmall: { marginTop: 6, fontWeight: "700", color: "rgba(11,27,29,0.55)" },

  card: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  cardTitle: { fontWeight: "900", color: "rgba(11,27,29,0.75)" },

  money: { marginTop: 8, fontSize: 28, fontWeight: "900", color: C.text ?? "#0B1B1D" },
  moneySmall: { fontSize: 16, fontWeight: "900", color: C.text ?? "#0B1B1D" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  rowLabel: { fontWeight: "800", color: "rgba(11,27,29,0.85)", flex: 1, paddingRight: 12 },
  rowValue: { fontWeight: "900", color: "rgba(11,27,29,0.85)" },
});
