import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getAppContext } from "@/src/storage/appContext";
import { listUsers, upsertUser, UserProfile } from "@/src/storage/users";
import { listGroups } from "@/src/storage/groups";
import { Theme } from "@/src/ui/theme";

// ---- Safe fallbacks in case Theme is missing keys ----
const C = (Theme as any)?.colors ?? {};
const S = (Theme as any)?.spacing ?? {};
const R = (Theme as any)?.radius ?? {};
const T = (Theme as any)?.text ?? {};

const COLORS = {
  bg: C.bg ?? "#F5F7F8",
  card: C.card ?? "#FFFFFF",
  text: C.text ?? "#0F172A",
  muted: C.muted ?? "rgba(15,23,42,0.55)",
  border: C.border ?? "rgba(0,0,0,0.08)",
  teal: C.teal ?? "#0F766E",
  chipOnBg: C.chipOnBg ?? "rgba(15,118,110,0.12)",
  btnGhostBg: C.btnGhostBg ?? "rgba(0,0,0,0.06)",
};

const SPACING = {
  page: S.page ?? 16,
  cardPad: S.cardPad ?? 14,
  gap: S.gap ?? 10,
};

const RADIUS = {
  card: R.card ?? 16,
  input: R.input ?? 12,
  pill: R.pill ?? 999,
};

const TEXT = {
  title: T.title ?? 22,
};

export default function AssignInsuranceScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string>("");

  const [insuranceId, setInsuranceId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const ctx = await getAppContext();
        const us = await listUsers();
        const me = us.find((u) => u.id === ctx.currentUserId) ?? null;

        let famId = me?.familyId ?? "";
        if (!famId) {
          const gs = await listGroups();
          famId = gs.find((g) => g.type === "Family")?.id ?? "";
        }

        if (!alive) return;

        setUsers(us);
        setActiveFamilyId(famId);
        setInsuranceId(me?.insuranceId ?? "");

        const famMembers = famId ? us.filter((u) => u.familyId === famId) : [];
        const nextSel: Record<string, boolean> = {};
        famMembers.forEach((u) => (nextSel[u.id] = true));
        setSelectedIds(nextSel);

        setMsg(null);
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  const familyMembers = useMemo(() => {
    if (!activeFamilyId) return [];
    return users.filter((u) => u.familyId === activeFamilyId);
  }, [users, activeFamilyId]);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setAll = useCallback(
    (value: boolean) => {
      const next: Record<string, boolean> = {};
      familyMembers.forEach((u) => (next[u.id] = value));
      setSelectedIds(next);
    },
    [familyMembers]
  );

  const refreshUsers = useCallback(async () => {
    const refreshed = await listUsers();
    setUsers(refreshed);
  }, []);

  const onApply = useCallback(async () => {
    setMsg(null);

    const id = insuranceId.trim().toUpperCase();
    if (!id) return setMsg("Enter an Insurance ID (e.g., INS-A).");
    if (!activeFamilyId) return setMsg("No family found. Join or create a family first.");
    if (selectedCount === 0) return setMsg("Select at least one family member.");

    setSaving(true);
    try {
      await Promise.all(
        familyMembers
          .filter((u) => selectedIds[u.id])
          .map((u) => upsertUser({ ...u, insuranceId: id }))
      );

      await refreshUsers();
      setMsg(`Applied ${id} to ${selectedCount} member${selectedCount === 1 ? "" : "s"}.`);
      router.back();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to apply insurance.");
    } finally {
      setSaving(false);
    }
  }, [insuranceId, activeFamilyId, selectedCount, familyMembers, selectedIds, refreshUsers]);

  const onClearSelected = useCallback(async () => {
    setMsg(null);

    if (!activeFamilyId) return setMsg("No family found. Join or create a family first.");
    if (selectedCount === 0) return setMsg("Select at least one family member.");

    setSaving(true);
    try {
      await Promise.all(
        familyMembers
          .filter((u) => selectedIds[u.id])
          .map((u) => upsertUser({ ...u, insuranceId: "" }))
      );

      await refreshUsers();
      setMsg(`Cleared insurance for ${selectedCount} member${selectedCount === 1 ? "" : "s"}.`);
      router.back();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to clear insurance.");
    } finally {
      setSaving(false);
    }
  }, [activeFamilyId, selectedCount, familyMembers, selectedIds, refreshUsers]);

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.safe}
        contentContainerStyle={[
          styles.page,
          { paddingBottom: SPACING.page + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Assign Insurance</Text>

        <View style={styles.card}>
          <Text style={styles.sub}>
            Assign an Insurance ID to one or more family members. (Local-only for now.)
          </Text>

          <Text style={styles.label}>Insurance ID</Text>
          <TextInput
            value={insuranceId}
            onChangeText={setInsuranceId}
            placeholder="e.g., INS-A"
            autoCapitalize="characters"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />

          <View style={styles.row}>
            <Pressable onPress={() => setAll(true)} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Select all</Text>
            </Pressable>
            <Pressable onPress={() => setAll(false)} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Clear all</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Family members ({familyMembers.length})</Text>

          <ScrollView
            style={styles.memberList}
            contentContainerStyle={{ paddingBottom: 6 }}
            keyboardShouldPersistTaps="handled"
          >
            {familyMembers.length === 0 ? (
              <Text style={styles.emptyText}>No members found for this family.</Text>
            ) : (
              familyMembers.map((m) => {
                const checked = !!selectedIds[m.id];
                const name = m.name ?? m.id;
                const role = m.id === "head" ? "Head" : m.id === "spouse" ? "Spouse" : "Member";
                const current = m.insuranceId ? `INS: ${m.insuranceId}` : "INS: —";

                return (
                  <Pressable key={m.id} onPress={() => toggle(m.id)} style={styles.memberRow}>
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {name} ({role})
                      </Text>
                      <Text style={styles.memberMeta}>{current}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          <View style={[styles.row, { marginTop: 12 }]}>
            <Pressable onPress={onApply} style={styles.primaryBtn} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Apply"}</Text>
            </Pressable>

            <Pressable onPress={onClearSelected} style={styles.ghostBtn} disabled={saving}>
              <Text style={styles.ghostBtnText}>Clear selected</Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.ghostBtn} disabled={saving}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  page: {
    paddingHorizontal: SPACING.page,
    paddingTop: 12, // aligns with other tabs
  },

  title: {
    fontSize: TEXT.title,
    fontWeight: "900",
    marginBottom: 12,
    color: COLORS.text,
  },

  card: {
    padding: SPACING.cardPad,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sub: {
    opacity: 0.75,
    color: COLORS.muted,
  },

  label: {
    marginTop: 12,
    fontWeight: "900",
    opacity: 0.85,
    color: COLORS.text,
  },

  input: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },

  row: {
    marginTop: 10,
    flexDirection: "row",
    gap: SPACING.gap,
    alignItems: "center",
    flexWrap: "wrap",
  },

  primaryBtn: {
    backgroundColor: COLORS.teal,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.input,
  },
  primaryBtnText: { color: "white", fontWeight: "900" },

  ghostBtn: {
    backgroundColor: COLORS.btnGhostBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.input,
  },
  ghostBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },

  memberList: {
    marginTop: 6,
    maxHeight: 280,
  },

  memberRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  checkboxOn: {
    borderColor: "rgba(15,118,110,0.60)",
    backgroundColor: COLORS.chipOnBg,
  },
  checkboxTick: { fontWeight: "900", color: COLORS.teal },

  memberName: { fontWeight: "900", color: COLORS.text },
  memberMeta: { marginTop: 3, opacity: 0.75, fontSize: 12, color: COLORS.muted },

  msg: { marginTop: 10, fontWeight: "800", opacity: 0.85, color: COLORS.text },

  emptyText: { opacity: 0.65, color: COLORS.muted, marginTop: 8 },
});
