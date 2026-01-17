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

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default function ContextGate() {
  const params = useLocalSearchParams<{ force?: string | string[]; t?: string | string[] }>();

  const forceRaw = firstParam(params.force);
  const forceShow = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("head");
  const [hasFamilyGroup, setHasFamilyGroup] = useState(false);

  const me = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId]
  );

  const eligibility = useMemo(() => {
    return getContextEligibility(me, { hasFamilyGroup });
  }, [me, hasFamilyGroup]);

  const available = useMemo(() => {
    return getAvailableContexts(eligibility);
  }, [eligibility]);

  const options = useMemo(() => {
    const meta: Record<ContextScope, { title: string; sub: string }> = {
      individual: { title: "Individual", sub: "Your personal score, streaks, and recommendations" },
      family: { title: "Family", sub: "Shared score + household members" },
      workplace: { title: "Workplace", sub: "Company aggregate insights (N-1)" },
    };

    return available.map((scope) => ({
      scope,
      title: meta[scope].title,
      sub: meta[scope].sub,
    }));
  }, [available]);

  // Load persisted context + seed state
  useEffect(() => {
    let alive = true;

    (async () => {
      const ctx = await getAppContext();
      const us = await listUsers();
      const gs = await listGroups();
      const hasFam = gs.some((g) => g.type === "Family");

      if (!alive) return;

      const resolvedUserId = ctx.currentUserId ?? "head";
      const resolvedMe = us.find((u) => u.id === resolvedUserId) ?? null;

      setUsers(us);
      setCurrentUserId(resolvedUserId);
      setHasFamilyGroup(hasFam);

      // If explicitly forced, always show the gate UI
      if (forceShow) {
        setLoading(false);
        return;
      }

      // If saved segment is eligible, go straight to Groups tab
      const elig = getContextEligibility(resolvedMe, { hasFamilyGroup: hasFam });
      const saved = (ctx.segment ?? "individual") as ContextScope;

      if (elig[saved]) {
        router.replace("/(tabs)/groups");
        return;
      }

      // Otherwise clamp to first eligible and save
      const nextScope = clampContext(saved, resolvedMe, { hasFamilyGroup: hasFam });
      await setAppContext({ segment: nextScope, currentUserId: resolvedUserId });

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [forceShow, firstParam(params.t)]); // t helps force a remount-like re-run

  const choose = useCallback(
    async (scope: ContextScope) => {
      await setAppContext({ segment: scope, currentUserId });

      // Best-effort: keep backend truth aligned too
      patchMe({ mode: scope as any }).catch(() => {});

      router.replace("/(tabs)/groups");
    },
    [currentUserId]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Voravia</Text>
        <Text style={styles.sub}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your context</Text>
      <Text style={styles.sub}>This sets where you land and what you can see.</Text>

      <View style={{ height: 12 }} />

      {options.map((o) => (
        <Pressable key={o.scope} onPress={() => choose(o.scope)} style={styles.card}>
          <Text style={styles.cardTitle}>{o.title}</Text>
          <Text style={styles.cardSub}>{o.sub}</Text>
        </Pressable>
      ))}

      <View style={{ height: 14 }} />

      <Pressable onPress={() => router.replace("/(tabs)/profile")} style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnText}>Edit membership IDs</Text>
      </Pressable>

      {__DEV__ ? (
        <Text style={styles.devNote}>
          DEV: Eligibility depends on current user’s familyId/corporateId (and Family group fallback).
          {"\n"}force={String(forceRaw)} (forceShow={String(forceShow)})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 6, opacity: 0.7 },

  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardSub: { marginTop: 6, opacity: 0.75, lineHeight: 18 },

  secondaryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  secondaryBtnText: { fontWeight: "900", color: "#0f766e" },

  devNote: { marginTop: 12, fontSize: 12, opacity: 0.65 },
});
