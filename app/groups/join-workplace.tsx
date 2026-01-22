import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router, Stack } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { getUserById, upsertUser } from "@/src/storage/users";

import { Screen } from "@/src/ui/Screen";
import { headerStyles } from "@/src/ui/headerStyle";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

function normalize(input: string) {
  return input.trim().toUpperCase();
}
function parseCorpId(code: string) {
  const c = normalize(code);
  // Accept "CORP-XYZ" or "XYZ"
  if (c.startsWith("CORP-")) return c.slice(5);
  return c;
}

export default function JoinWorkplaceScreen() {
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
        setCurrentUserId(ctx.currentUserId);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const onJoin = useCallback(async () => {
    setErr(null);

    const corpId = parseCorpId(code);
    if (!corpId || corpId.length < 2) {
      setErr("Enter a valid corporate code.");
      return;
    }

    setSaving(true);
    const me = await getUserById(currentUserId);
    if (!me) {
      setSaving(false);
      setErr("No local user found. Seed demo or create a user first.");
      return;
    }

    await upsertUser({ ...me, corporateId: corpId });
    setSaving(false);

    // ensures Workplace reload on return
    router.replace("/(tabs)/groups");
  }, [code, currentUserId]);

  return (
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <Stack.Screen options={{ ...headerStyles.base, title: "Join workplace" }} />

      <View style={styles.card}>
        <Text style={styles.title}>Join workplace</Text>
        <Text style={styles.sub}>Paste the corporate code you received.</Text>

        <Text style={styles.label}>Corporate code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g., CORP-ACME"
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

        <Text style={styles.hint}>This updates your local profile (corporateId). Later validated server-side.</Text>
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
  sub: { color: Theme.colors.textMuted, fontWeight: "700" },

  label: { marginTop: S.sm, fontWeight: "900", color: Theme.colors.textPrimary },

  input: {
    marginTop: S.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.chipBorder,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },

  error: { marginTop: S.sm, color: "#b42318", fontWeight: "800" },

  row: { flexDirection: "row", gap: S.md, alignItems: "center", marginTop: S.sm },

  primaryBtn: {
    flex: 1,
    backgroundColor: Theme.colors.teal,
    paddingVertical: 14,
    borderRadius: Theme.radius.lg,
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

  hint: { color: Theme.colors.textMuted, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
