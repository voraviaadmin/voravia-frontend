import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getAppContext } from "@/src/storage/appContext";
import { Theme } from "@/src/ui/theme";
import { API_BASE } from "../../lib/api";

// Backwards-compatible helper (older screens still call this)
export function getApiBaseUrl() {
  return API_BASE;
}

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

type ApiFamilyMember = {
  id: string;
  name?: string;
  memberType?: "individual" | "parent" | "child";
  insuranceId?: string | null;
};

function localIdToBackendId(id: string) {
  return id === "head"
    ? "u_head"
    : id === "spouse"
    ? "u_spouse"
    : id === "child1"
    ? "u_child1"
    : id === "child2"
    ? "u_child2"
    : "u_head";
}

function memberTypeLabel(t?: ApiFamilyMember["memberType"]) {
  if (t === "parent") return "Parent";
  if (t === "child") return "Child";
  return "Individual";
}

export default function AssignInsuranceScreen() {
  const [members, setMembers] = useState<ApiFamilyMember[]>([]);
  const [insuranceId, setInsuranceId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ctx = await getAppContext();
    const backendUserId = localIdToBackendId(ctx.currentUserId || "head");

    const api = getApiBaseUrl();
    const resp = await fetch(`${api}/v1/family/members`, {
      method: "GET",
      headers: { "x-user-id": backendUserId },
    });
    const json = await resp.json().catch(() => ({}));
    const items = Array.isArray(json?.items) ? json.items : [];

    const ms: ApiFamilyMember[] = items
      .filter((m: any) => m && (typeof m.id === "string" || typeof m.id === "number"))
      .map((m: any) => ({
        id: String(m.id),
        name: m.name ? String(m.name) : undefined,
        memberType: (String(m.memberType || "") as any) || "individual",
        insuranceId: m.insuranceId ?? null,
      }));

    // default select all (same UX as before)
    const nextSel: Record<string, boolean> = {};
    ms.forEach((m) => (nextSel[m.id] = true));

    setMembers(ms);
    setSelectedIds(nextSel);

    // Prefill insurance input if all selected share the same insuranceId
    const selected = ms.filter((m) => nextSel[m.id]);
    const uniq = Array.from(
      new Set(
        selected
          .map((m) => String(m.insuranceId || "").trim())
          .filter(Boolean)
      )
    );
    if (uniq.length === 1) setInsuranceId(uniq[0]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          await load();
        } catch (e: any) {
          if (!alive) return;
          setMsg(e?.message ?? "Couldn't load members.");
        }
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

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
      members.forEach((m) => (next[m.id] = value));
      setSelectedIds(next);
    },
    [members]
  );

  const patchMemberInsurance = useCallback(
    async (memberId: string, nextInsuranceId: string) => {
      const ctx = await getAppContext();
      const backendUserId = localIdToBackendId(ctx.currentUserId || "head");

      const api = getApiBaseUrl();
      const resp = await fetch(`${api}/v1/family/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-id": backendUserId,
        },
        body: JSON.stringify({ insuranceId: nextInsuranceId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || json?.message || "Failed to update insurance.");
    },
    []
  );

  const onApply = useCallback(async () => {
    setMsg(null);

    const id = insuranceId.trim().toUpperCase();
    if (!id) return setMsg("Enter an Insurance ID (e.g., INS-A).");
    if (members.length === 0) return setMsg("No family members found.");
    if (selectedCount === 0) return setMsg("Select at least one family member.");

    setSaving(true);
    try {
      for (const m of members) {
        if (!selectedIds[m.id]) continue;
        await patchMemberInsurance(m.id, id);
      }

      setMsg(`Applied ${id} to ${selectedCount} member${selectedCount === 1 ? "" : "s"}.`);

      // Reload so UI reflects backend truth
      await load();

      // Optional: go back to members list
      router.back();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to apply insurance.");
    } finally {
      setSaving(false);
    }
  }, [insuranceId, members, selectedCount, selectedIds, patchMemberInsurance, load]);

  const onClearSelected = useCallback(async () => {
    setMsg(null);

    if (members.length === 0) return setMsg("No family members found.");
    if (selectedCount === 0) return setMsg("Select at least one family member.");

    setSaving(true);
    try {
      // Use empty string to ensure it overwrites even if backend COALESCE ignores null.
      // Groups screen counts insured using trim(), so "" will be treated as not insured.
      for (const m of members) {
        if (!selectedIds[m.id]) continue;
        await patchMemberInsurance(m.id, "");
      }

      setMsg(`Cleared insurance for ${selectedCount} member${selectedCount === 1 ? "" : "s"}.`);

      await load();
      router.back();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to clear insurance.");
    } finally {
      setSaving(false);
    }
  }, [members, selectedCount, selectedIds, patchMemberInsurance, load]);

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.safe}
        contentContainerStyle={[styles.page, { paddingBottom: SPACING.page + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Assign Insurance</Text>

        <View style={styles.card}>
          <Text style={styles.sub}>Assign an Insurance ID to one or more family members.</Text>

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

          <Text style={styles.label}>Family members ({members.length})</Text>

          <ScrollView
            style={styles.memberList}
            contentContainerStyle={{ paddingBottom: 6 }}
            keyboardShouldPersistTaps="handled"
          >
            {members.length === 0 ? (
              <Text style={styles.emptyText}>No members found for this family.</Text>
            ) : (
              members.map((m) => {
                const checked = !!selectedIds[m.id];
                const name = m.name ?? m.id;
                const current = String(m.insuranceId || "").trim()
                  ? `INS: ${String(m.insuranceId).trim()}`
                  : "INS: —";

                return (
                  <Pressable key={m.id} onPress={() => toggle(m.id)} style={styles.memberRow}>
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {name} ({memberTypeLabel(m.memberType)})
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
    paddingTop: 12,
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
    fontWeight: "700",
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
    fontWeight: "800",
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
    maxHeight: 320,
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
