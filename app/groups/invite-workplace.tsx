import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, router } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { getUserById } from "@/src/storage/users";

export default function InviteWorkplaceScreen() {
  const [corpId, setCorpId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const ctx = await getAppContext();
        const me = await getUserById(ctx.currentUserId);
        if (!alive) return;
        setCorpId(me?.corporateId ?? "");
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const code = useMemo(() => (corpId ? `CORP-${corpId}` : ""), [corpId]);

  const onCopy = useCallback(async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [code]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite to Workplace</Text>

      <View style={styles.card}>
        <Text style={styles.cardSub}>
          Share this corporate code with employees to join.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeText}>
            {code || "No Corporate ID set yet (update in Profile)."}
          </Text>
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
        Local-only. Later this becomes an email invite link managed by the employer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f6f7fb" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 12 },
  card: { padding: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" },
  cardSub: { opacity: 0.7 },

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
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" },
  ghostBtnText: { fontWeight: "900", color: "rgba(0,0,0,0.75)" },

  hint: { marginTop: 10, opacity: 0.6 },
});
