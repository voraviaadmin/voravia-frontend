import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";

import { getSavedProfile, saveProfile } from "@/src/storage/voraviaStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_VERSION_KEY = "voravia:profileVersion";

type Goal = "Lose" | "Maintain" | "Gain";

export type HealthProfile = {
  diabetes: boolean;
  htn: boolean;
  nafld: boolean;
  goal: Goal;
  cuisines: string[]; // cuisines[0] is PRIMARY
};

const BASE_CUISINES = [
  "Indian",
  "Mexican",
  "Chinese",
  "Italian",
  "Thai",
  "Japanese",
  "Mediterranean",
  "American",
];

const defaultProfile: HealthProfile = {
  diabetes: false,
  htn: false,
  nafld: false,
  goal: "Maintain",
  cuisines: ["Indian"],
};

function uniqCaseInsensitive(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = (x || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function coerceProfile(raw: any): HealthProfile {
  const p = raw ?? {};
  const cuisines =
    Array.isArray(p.cuisines) && p.cuisines.every((x: any) => typeof x === "string")
      ? uniqCaseInsensitive(p.cuisines)
      : defaultProfile.cuisines;

  return {
    diabetes: !!p.diabetes,
    htn: !!p.htn,
    nafld: !!p.nafld,
    goal: (p.goal as Goal) || defaultProfile.goal,
    cuisines: cuisines.length ? cuisines : defaultProfile.cuisines,
  };
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<HealthProfile>(defaultProfile);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [customCuisine, setCustomCuisine] = useState("");

  const cuisineOptions = useMemo(() => {
    return uniqCaseInsensitive([...BASE_CUISINES, ...(profile.cuisines || [])]);
  }, [profile.cuisines]);

  const persist = async (next: HealthProfile) => {
    const cleaned: HealthProfile = {
      ...next,
      cuisines: uniqCaseInsensitive(next.cuisines || []),
    };

    // Ensure at least one cuisine exists
    if (!cleaned.cuisines.length) cleaned.cuisines = ["Indian"];

    setProfile(cleaned);
    await saveProfile(cleaned);

    // Bump version so EatOut refreshes on focus
    await AsyncStorage.setItem(PROFILE_VERSION_KEY, String(Date.now()));

    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(null), 900);
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSavedProfile();
        if (stored) setProfile(coerceProfile(stored));
      } catch {
        // ignore
      }
    })();
  }, []);

  // ✅ When turning ON a cuisine, make it PRIMARY (index 0)
  const setCuisinePrimary = (c: string) => {
    const cTrim = c.trim();
    const rest = profile.cuisines.filter((x) => x.toLowerCase() !== cTrim.toLowerCase());
    persist({ ...profile, cuisines: [cTrim, ...rest] });
  };

  const toggleCuisine = (c: string) => {
    const has = profile.cuisines.some((x) => x.toLowerCase() === c.toLowerCase());
    if (has) {
      const next = profile.cuisines.filter((x) => x.toLowerCase() !== c.toLowerCase());
      persist({ ...profile, cuisines: next.length ? next : ["Indian"] });
    } else {
      // turn ON → make primary
      setCuisinePrimary(c);
    }
  };

  const addCustomCuisine = () => {
    const c = customCuisine.trim();
    if (!c) return;
    setCustomCuisine("");
    setCuisinePrimary(c); // ✅ new custom becomes primary (matches your expectation)
  };

  const header = useMemo(() => {
    const active = [
      profile.diabetes ? "Diabetes" : null,
      profile.htn ? "HTN" : null,
      profile.nafld ? "NAFLD" : null,
      `Goal: ${profile.goal}`,
      `Primary cuisine: ${profile.cuisines[0] || "Indian"}`,
    ].filter(Boolean);
    return active.join(" • ");
  }, [profile]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Health toggles + preferences</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health</Text>
        <Text style={styles.cardSub}>{header}</Text>

        <ToggleRow
          label="Diabetes"
          value={profile.diabetes}
          onPress={() => persist({ ...profile, diabetes: !profile.diabetes })}
        />
        <ToggleRow
          label="High Blood Pressure"
          value={profile.htn}
          onPress={() => persist({ ...profile, htn: !profile.htn })}
        />
        <ToggleRow
          label="Fatty Liver"
          value={profile.nafld}
          onPress={() => persist({ ...profile, nafld: !profile.nafld })}
        />

        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Goal</Text>
        <View style={styles.chipRow}>
          {(["Lose", "Maintain", "Gain"] as Goal[]).map((g) => (
            <Chip
              key={g}
              label={g}
              active={profile.goal === g}
              onPress={() => persist({ ...profile, goal: g })}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Restaurant preferences</Text>
        <Text style={styles.cardSub}>
          Primary cuisine (first selected) drives the Eat Out default search.
        </Text>

        <Text style={styles.sectionLabel}>Cuisines</Text>
        <View style={styles.chipRow}>
          {cuisineOptions.map((c) => {
            const isSelected = profile.cuisines.some((x) => x.toLowerCase() === c.toLowerCase());
            const isPrimary = profile.cuisines[0]?.toLowerCase() === c.toLowerCase();
            return (
              <Chip
                key={c}
                label={isPrimary ? `${c} (Default)` : c}
                active={isSelected}
                onPress={() => toggleCuisine(c)}
              />
            );
          })}
        </View>

        <View style={{ height: 12 }} />
        <Text style={styles.sectionLabel}>Add custom cuisine</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={customCuisine}
            onChangeText={setCustomCuisine}
            placeholder="e.g., Korean BBQ"
            placeholderTextColor="#7b8794"
            style={styles.input}
            onSubmitEditing={addCustomCuisine}
            returnKeyType="done"
          />
          <Pressable style={styles.addBtn} onPress={addCustomCuisine}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        <View style={{ height: 10 }} />
        <Text style={styles.smallMuted}>
          Selected: {profile.cuisines.length ? profile.cuisines.join(", ") : "None"}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.smallMuted}>
          {Platform.OS === "web" ? "Web preview" : "Mobile preview"}
        </Text>
        {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
      </View>
    </ScrollView>
  );
}

function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.pill, value ? styles.pillOn : styles.pillOff]}>
        <Text style={styles.pillText}>{value ? "ON" : "OFF"}</Text>
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipOn : styles.chipOff]} onPress={onPress}>
      <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 34, fontWeight: "900", color: "#0b1220" },
  sub: { marginTop: 6, fontSize: 14, color: "#52606d" },

  card: {
    marginTop: 14,
    backgroundColor: "#0b1324",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: { color: "white", fontSize: 16, fontWeight: "800" },
  cardSub: { marginTop: 6, color: "rgba(255,255,255,0.7)", fontSize: 13 },

  toggleRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { color: "white", fontSize: 14, fontWeight: "700" },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillOn: { backgroundColor: "rgba(64,196,160,0.25)", borderWidth: 1, borderColor: "rgba(64,196,160,0.55)" },
  pillOff: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  pillText: { color: "white", fontSize: 12, fontWeight: "800" },

  sectionLabel: { marginTop: 8, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipOn: { backgroundColor: "rgba(64,196,160,0.25)", borderColor: "rgba(64,196,160,0.55)" },
  chipOff: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" },
  chipText: { fontSize: 13, fontWeight: "800" },
  chipTextOn: { color: "white" },
  chipTextOff: { color: "rgba(255,255,255,0.75)" },

  inputRow: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(64,196,160,0.25)",
    borderWidth: 1,
    borderColor: "rgba(64,196,160,0.55)",
  },
  addBtnText: { color: "white", fontWeight: "900" },

  smallMuted: { color: "rgba(255,255,255,0.65)", fontSize: 12 },

  footerRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saved: { color: "#11c29a", fontWeight: "900" },
});
