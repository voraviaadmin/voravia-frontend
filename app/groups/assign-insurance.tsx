import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { useFocusEffect, router } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { listUsers, upsertUser, UserProfile } from "@/src/storage/users";
import { listGroups } from "@/src/storage/groups";

export default function AssignInsuranceScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string>("");

  const [insuranceId, setInsuranceId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load: ctx + users + active familyId
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const ctx = await getAppContext();
        const us = await listUsers();
        const me = us.find((u) => u.id === ctx.currentUserId) ?? null;

        // Prefer real membership
        let famId = me?.familyId ?? "";
        if (!famId) {
          // fallback to stored family group id if exists (demo convenience)
          const gs = await listGroups();
          famId = gs.find((g) => g.type === "Family")?.id ?? "";
        }

        if (!alive) return;

        setUsers(us);
        setActiveFamilyId(famId);

        // Default insuranceId to current user's insuranceId if present
        setInsuranceId(me?.insuranceId ?? "");

        // Default selection = all family members
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
    if (!id) {
      setMsg("Enter an Insurance ID (e.g., INS-A).");
      return;
    }
    if (!activeFamilyId) {
      setMsg("No family found. Join or create a family first.");
      return;
    }
    if (selectedCount === 0) {
      setMsg("Select at least one family member.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        familyMembers
          .filter((u) => selectedIds[u.id])
          .map((u) => upsertUser({ ...u, insuranceId: id }))
      );

      await refreshUsers();

      setMsg(
        `Applied ${id} to ${selectedCount} member${
          selectedCount === 1 ? "" : "s"
        }.`
      );

      // Prefer going back; Groups screen re-loads on focus.
      router.back();

      // If you prefer a hard jump:
      // router.replace("/(tabs)/groups");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to apply insurance.");
    } finally {
      setSaving(false);
    }
  }, [
    insuranceId,
    activeFamilyId,
    selectedCount,
    familyMembers,
    selectedIds,
    refreshUsers,
  ]);

  const onClearSelected = useCallback(async () => {
    setMsg(null);

    if (!activeFamilyId) {
      setMsg("No family found. Join or create a family first.");
      return;
    }
    if (selectedCount === 0) {
      setMsg("Select at least one family member.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        familyMembers
          .filter((u) => selectedIds[u.id])
          .map((u) => upsertUser({ ...u, insuranceId: "" }))
      );

      await refreshUsers();

      setMsg(
        `Cleared insurance for ${selectedCount} member${
          selectedCount === 1 ? "" : "s"
        }.`
      );

      router.back();
      // or: router.replace("/(tabs)/groups");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to clear insurance.");
    } finally {
      setSaving(false);
    }
  }, [activeFamilyId, selectedCount, familyMembers, selectedIds, refreshUsers]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assign Insurance</Text>

      <View style={styles.card}>
        <Text style={styles.sub}>
          Assign an Insurance ID to one or more family members. (Local-only for
          now.)
        </Text>

        <Text style={styles.label}>Insurance ID</Text>
        <TextInput
          value={insuranceId}
          onChangeText={setInsuranceId}
          placeholder="e.g., INS-A"
          autoCapitalize="characters"
          style={styles.input}
        />

        <View style={styles.row}>
          <Pressable onPress={() => setAll(true)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Select all</Text>
          </Pressable>
          <Pressable onPress={() => setAll(false)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Clear all</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Family members ({familyMembers.length})</Text>

        <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingBottom: 6 }}>
          {familyMembers.length === 0 ? (
            <Text style={{ opacity: 0.65 }}>No members found for this family.</Text>
          ) : (
            familyMembers.map((m) => {
              const checked = !!selectedIds[m.id];
              const name = m.name ?? m.id;
              const role =
                m.id === "head" ? "Head" : m.id === "spouse" ? "Spouse" : "Member";
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f6f7fb" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
  card: { padding: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" },
  sub: { opacity: 0.7 },

  label: { marginTop: 12, fontWeight: "900", opacity: 0.8 },
  input: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },

  row: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },

  primaryBtn: {
    backgroundColor: "#0f766e",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: "white", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  secondaryBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },

  ghostBtn: {
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  ghostBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },

  memberRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "white",
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
    backgroundColor: "white",
  },
  checkboxOn: {
    borderColor: "rgba(15,118,110,0.60)",
    backgroundColor: "rgba(15,118,110,0.12)",
  },
  checkboxTick: { fontWeight: "900", color: "#0f766e" },

  memberName: { fontWeight: "900" },
  memberMeta: { marginTop: 3, opacity: 0.7, fontSize: 12 },

  msg: { marginTop: 10, fontWeight: "800", opacity: 0.8 },
});
