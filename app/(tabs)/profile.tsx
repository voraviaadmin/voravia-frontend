import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect } from "expo-router";
import { getAppContext, setAppContext } from "@/src/storage/appContext";
import { listUsers, upsertUser, UserProfile } from "@/src/storage/users";
import { clampContext } from "@/src/context/contextRules";

import type { ContextScope } from "@/src/context/contextRules";

function normalizeSegment(seg: any): ContextScope {
  // supports old stored values + new values
  switch (seg) {
    case "individual":
    case "family":
    case "workplace":
      return seg;

    // common legacy values:
    case "you":
    case "self":
      return "individual";
    case "corporate":
      return "workplace";

    // removed from MVP:
    case "insurance":
      return "individual";

    default:
      return "individual";
  }
}



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

const [currentUserId, setCurrentUserId] = useState<string>("head");
const [users, setUsers] = useState<UserProfile[]>([]);
const [insuranceId, setInsuranceId] = useState("");
const [corporateId, setCorporateId] = useState("");
const [saving, setSaving] = useState(false);
const [saveMsg, setSaveMsg] = useState<string | null>(null);


const currentUser = useMemo(
  () => users.find((u) => u.id === currentUserId) ?? null,
  [users, currentUserId]
);

// Load on focus so it stays in sync with Groups tab switcher
useFocusEffect(
  useCallback(() => {
    let alive = true;
    (async () => {
      const ctx = await getAppContext();
      const us = await listUsers();
      if (!alive) return;

      setCurrentUserId(ctx.currentUserId);
      setUsers(us);

      const u = us.find((x) => x.id === ctx.currentUserId);
      setInsuranceId(u?.insuranceId ?? "");
      setCorporateId(u?.corporateId ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [])
);

const onSave = useCallback(async () => {
  if (!currentUser) return;
  setSaving(true);
  setSaveMsg(null);

  const next: UserProfile = {
    ...currentUser,
    insuranceId: insuranceId.trim(),
    corporateId: corporateId.trim(),
  };

  await upsertUser(next);

  // refresh local state
  const us = await listUsers();
  setUsers(us);

  const ctx = await getAppContext();

  const safeSegment = normalizeSegment((ctx as any).segment);
  
  const nextSegment = clampContext(safeSegment, {
    id: next.id,
    familyId: next.familyId,
    corporateId: next.corporateId,
  });
  
  if (nextSegment !== safeSegment) {
    await setAppContext({
      ...(ctx as any),
      segment: nextSegment,
    });
  }
  

  setSaveMsg("Saved");
  setSaving(false);

  setTimeout(() => setSaveMsg(null), 1200);
}, [currentUser, insuranceId, corporateId]);


// Optional: dev-only quick switch currentUserId (kept in sync with appContext)
const setActiveUser = useCallback(
  async (id: string) => {
    setCurrentUserId(id);
    const ctx = await getAppContext();
    await setAppContext({ segment: ctx.segment, currentUserId: id });

    const us = await listUsers();
    setUsers(us);
    const u = us.find((x) => x.id === id);
    setInsuranceId(u?.insuranceId ?? "");
    setCorporateId(u?.corporateId ?? "");
  },
  []
);

  
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

      <View style={styles.card}>
  <Text style={styles.cardTitle}>Membership IDs</Text>

  <Text style={styles.cardSub}>
    Active user: <Text style={{ fontWeight: "800" }}>{currentUserId}</Text>
  </Text>

  {__DEV__ ? (
    <View style={styles.devRow}>
      <Pressable
        onPress={() => setActiveUser("head")}
        style={[styles.devChip, currentUserId === "head" && styles.devChipActive]}
      >
        <Text style={[styles.devChipText, currentUserId === "head" && styles.devChipTextActive]}>
          Head
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setActiveUser("spouse")}
        style={[styles.devChip, currentUserId === "spouse" && styles.devChipActive]}
      >
        <Text style={[styles.devChipText, currentUserId === "spouse" && styles.devChipTextActive]}>
          Spouse
        </Text>
      </Pressable>
    </View>
  ) : null}

  <View style={{ marginTop: 12 }}>
    <Text style={styles.label}>Insurance ID</Text>
    <TextInput
      value={insuranceId}
      onChangeText={setInsuranceId}
      placeholder="e.g., INS-A"
      autoCapitalize="characters"
      style={styles.input}
    />
  </View>

  <View style={{ marginTop: 12 }}>
    <Text style={styles.label}>Corporate ID</Text>
    <TextInput
      value={corporateId}
      onChangeText={setCorporateId}
      placeholder="e.g., CORP-X"
      autoCapitalize="characters"
      style={styles.input}
    />
  </View>

  <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Pressable onPress={onSave} style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving}>
      <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save"}</Text>
    </Pressable>

    {saveMsg ? <Text style={styles.saved}>{saveMsg}</Text> : null}
  </View>

  <Text style={styles.hint}>
    These IDs drive rollups in Health Groups. (No backend yet; stored locally.)
  </Text>
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

  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#0f766e",
    alignSelf: "flex-start",
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "900",
  },
  

  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  cardSub: { marginTop: 6, opacity: 0.7 },
  label: { fontWeight: "800", opacity: 0.8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "white",
  },
  saveBtn: {
    backgroundColor: "#0f766e",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  saveBtnText: { color: "white", fontWeight: "900" },
  saved: { fontWeight: "900", color: "#0f766e" },
  hint: { marginTop: 10, opacity: 0.6 },

  devRow: { marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  devChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  devChipActive: { backgroundColor: "#0f766e" },
  devChipText: { fontWeight: "900", color: "rgba(0,0,0,0.65)" },
  devChipTextActive: { color: "white" },

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
  toggleLabel: { color: "#0b1220", fontSize: 14, fontWeight: "700" },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillOn: {
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  pillOff: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  pillText: { color: "#0b1220", fontSize: 12, fontWeight: "800" },

  sectionLabel: { marginTop: 8, color: "#52606d", fontSize: 12, fontWeight: "800" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipOn: {
    backgroundColor: "rgba(15,118,110,0.12)",
    borderColor: "rgba(15,118,110,0.35)",
  },
  chipOff: { backgroundColor: "white", borderColor: "rgba(0,0,0,0.12)" },
  chipText: { fontSize: 13, fontWeight: "800" },
  chipTextOn: { color: "#0b1220" },
  chipTextOff: { color: "#52606d" },

  inputRow: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.35)",
  },
  addBtnText: { color: "#0b1220", fontWeight: "900" },
  
  smallMuted: { color: "#52606d", fontSize: 12 },

  footerRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
});
