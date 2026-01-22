import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, router, Stack } from "expo-router";

import { getAppContext } from "@/src/storage/appContext";
import { getUserById } from "@/src/storage/users";

import { Screen } from "@/src/ui/Screen";
import { headerStyles } from "@/src/ui/headerStyle";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

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
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <Stack.Screen options={{ ...headerStyles.base, title: "Invite workplace" }} />

      <View style={styles.card}>
        <Text style={styles.sub}>Share this corporate code with employees to join.</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{code || "No Corporate ID set yet (update in Profile)."}</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.primaryBtn, !code && styles.disabled]} onPress={onCopy} disabled={!code}>
            <Text style={styles.primaryBtnText}>{copied ? "Copied" : "Copy code"}</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Local-only. Later this becomes an email invite link managed by the employer.
        </Text>
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
  sub: { color: Theme.colors.textMuted, fontWeight: "700" },

  codeBox: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.bg,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    alignItems: "center",
  },
  codeText: { fontWeight: "900", fontSize: 16, letterSpacing: 0.5, color: Theme.colors.textPrimary },

  row: { flexDirection: "row", gap: S.md, alignItems: "center" },

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
  disabled: { opacity: 0.5 },
});
