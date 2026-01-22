// app/groups/create-family.tsx
import React, { useLayoutEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useNavigation } from "expo-router";

import { Screen } from "@/src/ui/Screen";
import { headerStyles } from "@/src/ui/headerStyle";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

import { api } from "@/lib/api";
import { fetchMe } from "@/lib/me";
import { getAppContext, setAppContext } from "@/src/storage/appContext";

export default function CreateFamilyScreen() {
  const nav = useNavigation();
  useLayoutEffect(() => {
    nav.setOptions({
      ...headerStyles.base,
      title: "Create family",
    });
  }, [nav]);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Family name required", "Please enter a family name.");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      await api(`/v1/family`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      // refresh backend state
      await fetchMe("family");

      // set app context segment (your appContext expects full object)
      const ctx = await getAppContext();
      await setAppContext({ ...ctx, segment: "family" });

      router.back();
    } catch (e: any) {
      Alert.alert("Could not create family", e?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <View style={styles.card}>
        <Text style={styles.sub}>This creates your family group.</Text>

        <Text style={styles.label}>Family name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., My Family"
          style={styles.input}
          autoCapitalize="words"
          editable={!saving}
          returnKeyType="done"
          onSubmitEditing={onSave}
          placeholderTextColor={Theme.colors.textMuted}
        />

        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnGhost, saving && styles.disabled]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnPrimary, saving && styles.disabled]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.btnPrimaryText}>{saving ? "Creating…" : "Create"}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    borderRadius: Theme.radius.lg,
    padding: S.lg,
    gap: S.md,
  },
  sub: { color: Theme.colors.textMuted, fontWeight: "700" },

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

  row: { flexDirection: "row", gap: S.md, marginTop: S.md },

  btn: { flex: 1, paddingVertical: 14, borderRadius: Theme.radius.lg, alignItems: "center" },

  btnGhost: { backgroundColor: Theme.colors.card, borderWidth: 1, borderColor: Theme.colors.divider },
  btnGhostText: { fontWeight: "900", color: Theme.colors.textPrimary },

  btnPrimary: { backgroundColor: Theme.colors.teal },
  btnPrimaryText: { color: "white", fontWeight: "900" },

  disabled: { opacity: 0.6 },
});
