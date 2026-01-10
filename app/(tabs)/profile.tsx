import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Platform, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Profile = {
  name: string;
  goal: "Lose" | "Maintain" | "Gain";
  diet: "None" | "Vegetarian" | "Vegan" | "Keto" | "Halal";
  allergies: string;
  diabetes: boolean;
  htn: boolean;
  nafld: boolean;
  cuisines: string[];
};

export const PROFILE_STORAGE_KEY = "voravia_profile_v1";
export const CUISINES = ["Indian", "Mexican", "Chinese", "Italian", "Thai", "Japanese", "Mediterranean"];

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    name: "",
    goal: "Maintain",
    diet: "None",
    allergies: "",
    diabetes: false,
    htn: false,
    nafld: false,
    cuisines: ["Indian"],
  });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (raw) setProfile(JSON.parse(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSavedMsg(null);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    setSavedMsg("Saved ✅");
    setTimeout(() => setSavedMsg(null), 1200);
  };

  const toggleCuisine = (c: string) => {
    setProfile((p) => {
      const has = p.cuisines.includes(c);
      const cuisines = has ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c];
      return { ...p, cuisines };
    });
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable key={label} style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  const goalOptions: Profile["goal"][] = ["Lose", "Maintain", "Gain"];
  const dietOptions: Profile["diet"][] = ["None", "Vegetarian", "Vegan", "Keto", "Halal"];

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.sub}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Used to personalize restaurant search + food scoring</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={profile.name}
          onChangeText={(name) => setProfile((p) => ({ ...p, name }))}
          placeholder="Your name"
          placeholderTextColor="#7A8E91"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Goal</Text>
        <View style={styles.rowWrap}>
          {goalOptions.map((g) => chip(g, profile.goal === g, () => setProfile((p) => ({ ...p, goal: g }))))}
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>Diet preference</Text>
        <View style={styles.rowWrap}>
          {dietOptions.map((d) => chip(d, profile.diet === d, () => setProfile((p) => ({ ...p, diet: d }))))}
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>Allergies (comma separated)</Text>
        <TextInput
          value={profile.allergies}
          onChangeText={(allergies) => setProfile((p) => ({ ...p, allergies }))}
          placeholder="e.g., peanuts, dairy, gluten"
          placeholderTextColor="#7A8E91"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Health conditions</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Diabetes</Text>
          <Switch value={profile.diabetes} onValueChange={(v) => setProfile((p) => ({ ...p, diabetes: v }))} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Hypertension</Text>
          <Switch value={profile.htn} onValueChange={(v) => setProfile((p) => ({ ...p, htn: v }))} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Fatty liver (NAFLD)</Text>
          <Switch value={profile.nafld} onValueChange={(v) => setProfile((p) => ({ ...p, nafld: v }))} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferred cuisines</Text>
        <Text style={styles.helper}>Restaurants will default to your first selected cuisine.</Text>

        <View style={styles.rowWrap}>
          {CUISINES.map((c) => chip(c, profile.cuisines.includes(c), () => toggleCuisine(c)))}
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={save}>
        <Text style={styles.primaryBtnText}>Save profile</Text>
      </Pressable>

      {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAFB",
    paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }),
    paddingHorizontal: 16,
  },
  title: { fontSize: 28, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 14,
    marginTop: 12,
  },

  label: { color: "#0B2A2F", fontWeight: "800" },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0B2A2F",
    fontWeight: "700",
    backgroundColor: "#F7FCFD",
  },

  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#0B2A2F" },
  helper: { marginTop: 4, color: "#4A6468", fontWeight: "600" },

  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    backgroundColor: "#F7FCFD",
  },
  chipActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  chipText: { fontWeight: "800", color: "#0B2A2F" },
  chipTextActive: { color: "#FFFFFF" },

  switchRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: { color: "#0B2A2F", fontWeight: "800" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },
  pressed: { opacity: 0.88 },
  saved: { marginTop: 10, color: "#0E7C86", fontWeight: "900" },
});
