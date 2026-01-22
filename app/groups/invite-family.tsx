import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, router, Stack } from "expo-router";

import { listGroups } from "@/src/storage/groups";
import { api } from "@/lib/api";

import { headerStyles } from "@/src/ui/headerStyle";
import { Screen } from "@/src/ui/Screen";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

export default function InviteFamilyScreen() {
  const [familyName, setFamilyName] = useState<string>("Family");
  const [familyId, setFamilyId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        setCopied(false);

        // Prefer API
        try {
          const r = await api<any>(`/v1/family`, { method: "GET" });
          if (!alive) return;
          setFamilyName(String(r?.familyName || r?.name || "Your Family"));
          setFamilyId(String(r?.familyId || ""));
          return;
        } catch {
          // fall through to local
        }

        // Fallback: local family group (current behavior)
        const gs = await listGroups();
        if (!alive) return;
        const fam = gs.find((g) => g.type === "Family");
        setFamilyName(String(fam?.name || "Family"));
        setFamilyId(String(fam?.id || ""));
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  const code = familyId ? `FAM-${familyId}` : "";

  const onCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <Stack.Screen options={{ ...headerStyles.base, title: "Invite family" }} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{familyName}</Text>
        <Text style={styles.cardSub}>Share this code with family members to join.</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{code || "No family created yet"}</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.primaryBtn, !code && styles.disabled]} onPress={onCopy} disabled={!code}>
            <Text style={styles.primaryBtnText}>{copied ? "Copied" : "Copy code"}</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>Done</Text>
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
  cardTitle: { fontWeight: "900", fontSize: Theme.font.h2, color: Theme.colors.textPrimary },
  cardSub: { color: Theme.colors.textMuted, fontWeight: "700" },

  codeBox: {
    marginTop: S.sm,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.bg,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    alignItems: "center",
  },
  codeText: { fontSize: 18, fontWeight: "900", letterSpacing: 0.5, color: Theme.colors.textPrimary },

  row: { flexDirection: "row", gap: S.md, marginTop: S.sm },

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

  disabled: { opacity: 0.5 },
});
