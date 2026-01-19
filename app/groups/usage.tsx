import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { listUsers, UserProfile } from "@/src/storage/users";
import { getAppContext } from "@/src/storage/appContext";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8787";

type GroupUsageResp = {
  mode: "individual" | "family" | "workplace" | null;
  billingOwnerId: string;
  days: number;
  provider: "all" | "google" | "openai";
  totalCostUsd: number;
  bySubjectUserId: Record<string, number>;
  byService: { provider: string; service: string; costUsd: number; events: number }[];
};

type UsageEventsResp = {
  count?: number;
  lastN?: Array<{
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

function isoDayUtc(d: Date) {
  // YYYY-MM-DD in UTC
  return d.toISOString().slice(0, 10);
}

export default function UsageScreen() {
  const [days, setDays] = useState<7 | 30>(30);
  const [provider, setProvider] = useState<"all" | "google" | "openai">("all");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<GroupUsageResp | null>(null);

  const [todayCostUsd, setTodayCostUsd] = useState<number>(0);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setLoading(true);
          setErr(null);

          // Load local users (fallback labels)
          const u = await listUsers();
          if (!cancelled) setUsers(u);

          // Pick the active simulated user
          const ctx = getAppContext();
          const userId = (ctx as any)?.simulateUserId || (ctx as any)?.userId || "u_head";

          // 1) Load /v1/me so we can map member ids -> names
          const meResp = await fetch(`${API_BASE}/v1/me`, {
            headers: { "x-user-id": String(userId) },
          });

          const me = await meResp.json();

          const nameMap: Record<string, string> = {};
          const members = me?.family?.members || [];
          for (const m of members) {
            if (m?.id) nameMap[String(m.id)] = String(m.displayName || m.id);
          }
          if (!cancelled) setMemberNameById(nameMap);

          // 2) Call group usage (billing owner is the family head / account owner)
          const billingOwnerId = String(me?.userId || userId);

          const usageResp = await fetch(
            `${API_BASE}/v1/group-usage?days=${days}&provider=${encodeURIComponent(
              provider
            )}&billingOwnerId=${encodeURIComponent(billingOwnerId)}`,
            { headers: { "x-user-id": billingOwnerId } }
          );

          if (!usageResp.ok) {
            const txt = await usageResp.text();
            throw new Error(txt || `HTTP_${usageResp.status}`);
          }

          const usageJson = (await usageResp.json()) as GroupUsageResp;
          if (!cancelled) setData(usageJson);

          // 3) Compute "Today so far" from raw usage events (today UTC)
          // Keep this lightweight: last 500 events max.
          const qs = new URLSearchParams();
          qs.set("limit", "500");
          if (provider !== "all") qs.set("provider", provider);

          const evResp = await fetch(`${API_BASE}/v1/usage?${qs.toString()}`, {
            headers: { "x-user-id": billingOwnerId },
          });

          let todaySum = 0;
          if (evResp.ok) {
            const evJson = (await evResp.json()) as UsageEventsResp;
            const today = isoDayUtc(new Date());
            const events = Array.isArray(evJson?.lastN) ? evJson.lastN : [];

            for (const e of events) {
              const ts = String(e?.ts || "");
              if (!ts) continue;
              const day = ts.slice(0, 10); // ISO starts with YYYY-MM-DD
              if (day !== today) continue;

              // Only count events billed to this billing owner
              if (String(e?.billingOwnerId || "") !== String(billingOwnerId)) continue;

              todaySum += Number(e?.costUsd) || 0;
            }
          }

          if (!cancelled) setTodayCostUsd(todaySum);
        } catch (e: any) {
          if (!cancelled) setErr(String(e?.message || e));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [days, provider])
  );

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};

    // Local users
    for (const u of users) m[u.id] = u.name || u.id;

    // Friendly fallbacks
    m["u_head"] = m["u_head"] || "Head";
    m["u_spouse"] = m["u_spouse"] || "Spouse";
    m["u_child1"] = m["u_child1"] || "Child 1";
    m["u_child2"] = m["u_child2"] || "Child 2";
    m["u_self"] = m["u_self"] || "You";

    // Prefer server-provided family member display names
    for (const [id, label] of Object.entries(memberNameById)) {
      m[id] = label;
    }

    return m;
  }, [users, memberNameById]);

  const byMemberRows = useMemo(() => {
    const map = data?.bySubjectUserId || {};
    return Object.entries(map)
      .map(([id, cost]) => {
        const raw = nameById[id];
        // Clean: never show raw IDs
        const name =
          raw && raw !== id
            ? raw
            : id === "u_self"
              ? "You"
              : id.startsWith("u_")
                ? "Member"
                : "Member";
        return { id, name, cost: Number(cost) || 0 };
      })
      .filter((r) => r.cost > 0 || r.name !== "Member") // keep meaningful rows
      .sort((a, b) => b.cost - a.cost);
  }, [data, nameById]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Usage</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.pillsRow}>
        <Pill label="7d" active={days === 7} onPress={() => setDays(7)} />
        <Pill label="30d" active={days === 30} onPress={() => setDays(30)} />
        <View style={{ width: 10 }} />
        <Pill label="All" active={provider === "all"} onPress={() => setProvider("all")} />
        <Pill label="Google" active={provider === "google"} onPress={() => setProvider("google")} />
        <Pill label="AI" active={provider === "openai"} onPress={() => setProvider("openai")} />
      </View>

      <Card>
        <Text style={styles.muted}>This period</Text>
        <Text style={styles.big}>{money(data?.totalCostUsd ?? 0)}</Text>

        {/* NEW: Today clearly labeled + "Today so far" line item */}
        <Text style={styles.mutedSmall}>Includes today so far · Updates daily</Text>

        <View style={{ marginTop: 10 }}>
          <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 }} />
          <Row left="Today so far" right={moneyTight(todayCostUsd ?? 0)} />
        </View>
      </Card>

      {loading ? (
        <Card>
          <View style={{ paddingVertical: 10, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={styles.mutedSmall}>Loading usage…</Text>
          </View>
        </Card>
      ) : err ? (
        <Card>
          <Text style={styles.errTitle}>Couldn’t load usage</Text>
          <Text style={styles.mutedSmall}>{err}</Text>
        </Card>
      ) : (
        <>
          {Object.keys(data?.bySubjectUserId || {}).length > 1 && (
            <Card>
              <Text style={styles.sectionTitle}>By member</Text>
              <View style={{ marginTop: 10, gap: 10 }}>
                {byMemberRows.length === 0 ? (
                  <Text style={styles.mutedSmall}>No usage yet.</Text>
                ) : (
                  byMemberRows.map((r) => (
                    <Row key={r.id} left={r.name} right={moneyTight(r.cost)} />
                  ))
                )}
              </View>
            </Card>
          )}

          <Card>
            <Text style={styles.sectionTitle}>By service</Text>
            <View style={{ marginTop: 10, gap: 10 }}>
              {(data?.byService || []).length === 0 ? (
                <Text style={styles.mutedSmall}>No usage yet.</Text>
              ) : (
                data!.byService.map((s) => (
                  <Row
                    key={`${s.provider}:${s.service}`}
                    left={`${s.provider} · ${s.service}`}
                    right={moneyTight(s.costUsd)}
                  />
                ))
              )}
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft} numberOfLines={1}>
        {left}
      </Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F3F4F6" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 26, fontWeight: "800", color: "#111827" },
  done: { fontSize: 16, fontWeight: "700", color: "#0F766E" },

  pillsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  pillActive: { backgroundColor: "#0F766E" },
  pillInactive: { backgroundColor: "transparent" },
  pillText: { fontWeight: "700" },
  pillTextActive: { color: "white" },
  pillTextInactive: { color: "#0F766E" },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  muted: { fontSize: 13, color: "#6B7280", fontWeight: "700" },
  mutedSmall: { marginTop: 6, fontSize: 13, color: "#6B7280" },
  big: { marginTop: 6, fontSize: 40, fontWeight: "900", color: "#0F766E" },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  errTitle: { fontSize: 16, fontWeight: "800", color: "#991B1B" },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flex: 1, paddingRight: 10, fontSize: 15, fontWeight: "700", color: "#111827" },
  rowRight: { fontSize: 15, fontWeight: "800", color: "#0F766E" },
});
