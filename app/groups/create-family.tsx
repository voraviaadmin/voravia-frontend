import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { addGroup } from "@/src/storage/groups";

function makeId() {
  return `family-${Date.now().toString(36)}`;
}

export default function CreateFamilyScreen() {
  const [name, setName] = useState("");

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Family name required", "Please enter a family name.");
      return;
    }

    await addGroup({
      id: makeId(),
      type: "Family",
      name: trimmed,
      members: 1,
      score: 80,
      streakDays: 0,
    });

    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Family</Text>
      <Text style={styles.sub}>Name your family group. You can add members later.</Text>

      <Text style={styles.label}>Family name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g., Patel Family"
        style={styles.input}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onSave}
      />

      <View style={styles.row}>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnGhost]}>
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>

        <Pressable onPress={onSave} style={[styles.btn, styles.btnPrimary]}>
          <Text style={styles.btnPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { marginTop: 6, opacity: 0.7 },
  label: { marginTop: 18, marginBottom: 8, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnGhost: { backgroundColor: "rgba(0,0,0,0.06)" },
  btnGhostText: { fontWeight: "700" },
  btnPrimary: { backgroundColor: "#0f766e" },
  btnPrimaryText: { color: "white", fontWeight: "700" },
});
