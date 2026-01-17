import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { getUserById, upsertUser, normalizeFamilyCode } from "@/src/storage/users";

function parseFamilyId(code: string) {
  const c = normalizeFamilyCode(code);
  // Accept formats: "FAM-<id>" or "<id>"
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
        setCurrentUserId(ctx.currentUserId);
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const onJoin = useCallback(async () => {
    setErr(null);

    const familyId = parseFamilyId(code);
    if (!familyId || familyId.length < 3) {
      setErr("Enter a valid family code.");
      return;
    }

    setSaving(true);
    const me = await getUserById(currentUserId);
    if (!me) {
      setSaving(false);
      setErr("No local user found. Seed demo or create a user first.");
      return;
    }

    await upsertUser({ ...me, familyId });
    setSaving(false);
    router.back(); // go back to Groups
  }, [code, currentUserId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Family</Text>

      <View style={styles.card}>
        <Text style={styles.cardSub}>Paste the family code you received.</Text>

        <Text style={styles.label}>Family code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g., FAM-ABC123"
          autoCapitalize="characters"
          style={styles.input}
        />

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <View style={styles.row}>
          <Pressable style={styles.primaryBtn} onPress={onJoin} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? "Joining..." : "Join"}</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          This updates your local profile (familyId). Later this will be validated server-side.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f6f7fb" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
  card: { padding: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" },
  cardSub: { opacity: 0.7 },

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

  error: { marginTop: 10, color: "#b42318", fontWeight: "800" },

  row: { marginTop: 12, flexDirection: "row", gap: 12, alignItems: "center" },

  primaryBtn: { backgroundColor: "#0f766e", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  primaryBtnText: { color: "white", fontWeight: "900" },

  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  ghostBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },

  hint: { marginTop: 10, opacity: 0.6 },
});
