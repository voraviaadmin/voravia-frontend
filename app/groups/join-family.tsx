import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router, Stack } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { getUserById, upsertUser, normalizeFamilyCode } from "@/src/storage/users";
import { api } from "@/lib/api";

import { headerStyles } from "@/src/ui/headerStyle";
import { Screen } from "@/src/ui/Screen";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

function parseFamilyId(code: string) {
  const c = normalizeFamilyCode(code);
  if (c.startsWith("FAM-")) return c.slice(4);
  return c;
}

export default function JoinFamilyScreen() {
  const [currentUserId, setCurrentUserId] = useState("head");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const ctx = await getAppContext();
        if (!alive) return;
        setCurrentUserId(ctx.currentUserId ?? "head");
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const onJoin = async () => {
    setErr(null);
    const raw = code.trim();
    if (!raw) {
      setErr("Please enter a family code.");
      return;
    }

    const familyId = parseFamilyId(raw);
    if (!familyId) {
      setErr("Invalid code.");
      return;
    }

    setSaving(true);
    try {
      // Prefer API
      try {
        await api(`/v1/family/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: raw }),
        });
        router.back();
        return;
      } catch {
        // fall through to local
      }

      // Fallback: existing local join logic
      const me = await getUserById(currentUserId);
      if (!me) {
        setErr("Could not find current user.");
        return;
      }

      await upsertUser({ ...me, familyId });
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Failed to join family.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <Stack.Screen options={{ ...headerStyles.base, title: "Join family" }} />

      <View style={styles.card}>
        <Text style={styles.title}>Join family</Text>
        <Text style={styles.sub}>Enter a family code you received.</Text>

        <Text style={styles.label}>Family code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g., FAM-ABC123"
          autoCapitalize="characters"
          style={styles.input}
          editable={!saving}
          placeholderTextColor={Theme.colors.textMuted}
        />

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <View style={styles.row}>
          <Pressable style={[styles.primaryBtn, saving && styles.disabled]} onPress={onJoin} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? "Joining…" : "Join"}</Text>
          </Pressable>

          <Pressable style={[styles.ghostBtn, saving && styles.disabled]} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: S.lg,
    gap: S.md,
  },

  title: { fontSize: Theme.font.h2, fontWeight: "900", color: Theme.colors.textPrimary },
  sub: { marginTop: 2, color: Theme.colors.textMuted, fontWeight: "700" },

  label: { marginTop: S.sm, fontWeight: "900", color: Theme.colors.textPrimary },
  input: {
    marginTop: S.sm,
    borderWidth: 1,
    borderColor: Theme.colors.chipBorder,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Theme.colors.card,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },

  error: { marginTop: S.sm, color: "#b91c1c", fontWeight: "800" },

  row: { flexDirection: "row", gap: S.md, marginTop: S.md },

  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.teal,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900" },

  ghostBtn: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    alignItems: "center",
  },
  ghostBtnText: { fontWeight: "900", color: Theme.colors.textPrimary },

  disabled: { opacity: 0.6 },
});
