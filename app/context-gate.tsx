// app/context-gate.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getAppContext, setAppContext } from "@/src/storage/appContext";
import { listUsers, UserProfile } from "@/src/storage/users";
import { listGroups } from "@/src/storage/groups";

import type { ContextScope } from "@/src/context/contextRules";
import { clampContext, getContextEligibility, getAvailableContexts } from "@/src/context/contextRules";

// Optional: keep backend /v1/me in sync when choosing context
import { patchMe } from "@/src/hooks/useMe";
import { getAdminSessionToken } from "../lib/admin/session";
import { Theme } from "@/src/ui/theme";
import { headerStyles } from "@/src/ui/headerStyle";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView } from "react-native";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeActorId(id: any): string {
  const s = String(id ?? "").trim();
  if (!s) return "u_head";
  if (s === "head") return "u_head";
  if (s === "spouse") return "u_spouse";
  if (s === "child1") return "u_child1";
  if (s === "child2") return "u_child2";
  if (s === "self") return "u_self";
  return s;
}

export default function ContextGate() {
  const params = useLocalSearchParams<{ force?: string | string[]; t?: string | string[] }>();

  const forceRaw = firstParam(params.force);
  const forceShow = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("u_head");
  const [hasFamilyGroup, setHasFamilyGroup] = useState(false);
  const tRaw = firstParam(params.t);

  const me = useMemo(() => users.find((u) => u.id === currentUserId) ?? null, [users, currentUserId]);

  const eligibility = useMemo(() => getContextEligibility(me, { hasFamilyGroup }), [me, hasFamilyGroup]);

  const available = useMemo(() => getAvailableContexts(eligibility), [eligibility]);

  const active = useMemo<ContextScope>(() => {
    const t = tRaw ? String(tRaw) : undefined;
    return clampContext((t as any) || "individual", eligibility);
  }, [tRaw, eligibility]);

  useEffect(() => {
    let alive = true;

    (async () => {
      // 🔐 ADMIN SESSION CHECK (HIGHEST PRIORITY)
      const adminToken = await getAdminSessionToken();
      if (adminToken) {
        router.replace("/admin");
        return;
      }

      const ctx = await getAppContext();
      const us = await listUsers();
      const gs = await listGroups();

      const resolvedUserId = normalizeActorId(ctx.currentUserId ?? "u_head");
      const resolvedMe = us.find((u) => u.id === resolvedUserId) ?? null;

      // Family can be determined either by groups OR by user.familyId
      const hasFamGroup = gs.some((g) => g.type === "Family");
      const hasFam = hasFamGroup || Boolean(resolvedMe?.familyId);

      if (!alive) return;

      setUsers(us);
      setCurrentUserId(resolvedUserId);
      setHasFamilyGroup(hasFam);

      // If explicitly forced, always show the gate UI
      if (forceShow) {
        setLoading(false);
        return;
      }

      // If only one context is available, skip gate
      if (available.length <= 1) {
        setLoading(false);
        router.replace("/(tabs)/home");
        return;
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
    // NOTE: available is derived from eligibility, which depends on me/hasFamilyGroup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShow]);

  const choose = useCallback(
    async (scope: ContextScope) => {
      const nextScope = scope;
      await setAppContext({ segment: nextScope, currentUserId });

      // Best-effort: keep backend truth aligned too
      patchMe({ mode: nextScope as any }).catch(() => {});

      router.replace("/(tabs)/home");
    },
    [currentUserId]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Theme.colors.bg }} edges={["top", "left", "right"]}>
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, backgroundColor: Theme.colors.bg }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >

    <View style={styles.container}>
      <Text style={styles.title}>Choose your context</Text>
      <Text style={styles.sub}>This sets where you land and what you can see.</Text>

      {available.includes("individual") && (
        <Pressable style={styles.card} onPress={() => choose("individual")}>
          <Text style={styles.cardTitle}>Individual</Text>
          <Text style={styles.cardSub}>Your personal score, streaks, and recommendations</Text>
        </Pressable>
      )}

      {available.includes("family") && (
        <Pressable style={styles.card} onPress={() => choose("family")}>
          <Text style={styles.cardTitle}>Family</Text>
          <Text style={styles.cardSub}>Log and view meals for your family members</Text>
        </Pressable>
      )}

      {available.includes("workplace") && (
        <Pressable style={styles.card} onPress={() => choose("workplace")}>
          <Text style={styles.cardTitle}>Workplace</Text>
          <Text style={styles.cardSub}>See aggregated workplace insights (if enabled)</Text>
        </Pressable>
      )}

      <View style={{ height: 12 }} />
      <Pressable style={styles.secondaryBtn} onPress={() => router.push("/admin")}>
        <Text style={styles.secondaryBtnText}>Admin Console</Text>
      </Pressable>

      <Text style={styles.footer}>
        DEV: Eligibility depends on current user’s familyId/corporateId and Family group fallback.
        {"\n"}force=1 (forceShow=true)
      </Text>
    </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  sub: { fontSize: 13, opacity: 0.7, marginBottom: 16 },
  card: { padding: 14, borderRadius: 14, backgroundColor: "#f2f2f2", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  cardSub: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  secondaryBtn: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", alignItems: "center" },
  secondaryBtnText: { fontWeight: "700" },
  footer: { marginTop: 12, fontSize: 11, opacity: 0.6 },
});
