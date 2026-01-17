import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, router } from "expo-router";

import { listGroups } from "@/src/storage/groups";
import { getAppContext } from "@/src/storage/appContext";

export default function InviteFamilyScreen() {
  const [familyName, setFamilyName] = useState<string>("Family");
  const [familyId, setFamilyId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const gs = await listGroups();
        const fam = gs.find((g) => g.type === "Family");
        if (!alive) return;

        setFamilyName(fam?.name ?? "Family");
        setFamilyId(fam?.id ?? "");
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const code = useMemo(() => (familyId ? `FAM-${familyId}` : ""), [familyId]);

  const onCopy = useCallback(async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [code]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite to Family</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{familyName}</Text>
        <Text style={styles.cardSub}>Share this code with family members to join.</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{code || "No family created yet"}</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.primaryBtn} onPress={onCopy} disabled={!code}>
            <Text style={styles.primaryBtnText}>{copied ? "Copied" : "Copy code"}</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.hint}>
        Local-only for now. Later this becomes a real invite link over email/SMS.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f6f7fb" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
  card: { padding: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardSub: { marginTop: 6, opacity: 0.7 },

  codeBox: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  codeText: { fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },

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
