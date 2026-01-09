import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  saveProfile,
  loadProfile,
  clearProfile,
  type ActivityLevel,
  type Constraint,
  type DietaryStyle,
  type FocusArea,
  type HealthGoal,
  type HealthProfile,
} from "../src/profileStorage";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function Onboarding() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEdit = params.mode === "edit";
  const isReset = params.mode === "reset";
  const showCancelInWizard = isEdit || isReset;

  const [step, setStep] = useState<Step>(0);

  const [goal, setGoal] = useState<HealthGoal | null>(null);
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle | null>(null);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");

  // For reset flow: show confirmation screen first (do NOT delete immediately)
  const [resetConfirmed, setResetConfirmed] = useState(!isReset);

  // Prefill when editing
  useEffect(() => {
    (async () => {
      if (!isEdit) return;
      const existing = await loadProfile();
      if (!existing) return;

      setGoal(existing.goal);
      setDietaryStyle(existing.dietaryStyle);
      setFocusAreas(existing.focusAreas || []);
      setConstraints(existing.constraints || []);
      setActivityLevel(existing.activityLevel);
      setAllergies(existing.allergies || []);
    })();
  }, [isEdit]);

  const progressText = useMemo(() => `Step ${step + 1} of 6`, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) return !!goal;
    if (step === 1) return !!dietaryStyle;
    if (step === 4) return !!activityLevel;
    return true;
  }, [step, goal, dietaryStyle, activityLevel]);

  const next = () => {
    if (!canContinue) return;
    setStep((s) => (s === 5 ? 5 : ((s + 1) as Step)));
  };

  const back = () => setStep((s) => (s === 0 ? 0 : ((s - 1) as Step)));

  const addAllergy = () => {
    const cleaned = allergyInput.trim();
    if (!cleaned) return;
    if (allergies.some((a) => a.toLowerCase() === cleaned.toLowerCase())) {
      setAllergyInput("");
      return;
    }
    setAllergies([...allergies, cleaned]);
    setAllergyInput("");
  };

  const finish = async () => {
    if (!goal || !dietaryStyle || !activityLevel) {
      Alert.alert("Missing info", "Please complete required steps.");
      return;
    }

    const profile: HealthProfile = {
      goal,
      dietaryStyle,
      focusAreas,
      constraints,
      activityLevel,
      allergies,
    };

    await saveProfile(profile);
    router.replace("/(tabs)");
  };

  const cancelWizard = () => {
    // If user entered from Profile tab, router.back() returns there
    // If something odd happens, fall back to tabs
    if (router.canGoBack?.()) router.back();
    else router.replace("/(tabs)");
  };

  /* ---------------- RESET CONFIRMATION SCREEN ---------------- */
  if (isReset && !resetConfirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { flex: 1, justifyContent: "center" }]}>
          <Text style={styles.brand}>Voravia</Text>
          <Text style={styles.h2}>Reset profile?</Text>
          <Text style={styles.subBrand}>
            This will erase your saved answers. You can cancel if this was a mistake.
          </Text>

          <View style={{ height: 24 }} />

          <View style={{ gap: 12 }}>
            <Pressable
              style={styles.resetPrimary}
              onPress={async () => {
                await clearProfile();
                setResetConfirmed(true);
                setStep(0);
              }}
            >
              <Text style={styles.resetPrimaryText}>Reset & Continue</Text>
            </Pressable>

            <Pressable style={styles.resetGhost} onPress={() => router.back()}>
              <Text style={styles.resetGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ---------------- MAIN WIZARD ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>Voravia</Text>
        <Text style={styles.subBrand}>Personalize your health insights</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Health Profile</Text>
            <Text style={styles.progress}>{progressText}</Text>
          </View>

          {step === 0 &&
            stepBlock(
              "What’s your main goal?",
              [
                ["Lose weight", "lose_weight"],
                ["Maintain", "maintain"],
                ["Gain muscle", "gain_muscle"],
                ["Improve energy", "improve_energy"],
                ["Manage a focus", "manage_condition"],
              ],
              goal,
              setGoal
            )}

          {step === 1 &&
            stepBlock(
              "Dietary style",
              [
                ["None", "none"],
                ["Mediterranean", "mediterranean"],
                ["Vegetarian", "vegetarian"],
                ["Vegan", "vegan"],
                ["Pescatarian", "pescatarian"],
                ["Low carb", "low_carb"],
                ["Keto", "keto"],
              ],
              dietaryStyle,
              setDietaryStyle
            )}

          {step === 2 &&
            multiBlock(
              "Focus areas (optional)",
              ["blood_sugar", "blood_pressure", "cholesterol", "gut", "liver", "heart"],
              focusAreas,
              setFocusAreas
            )}

          {step === 3 &&
            multiBlock(
              "Constraints (optional)",
              ["low_added_sugar", "low_sodium", "high_fiber", "high_protein"],
              constraints,
              setConstraints
            )}

          {step === 4 &&
            stepBlock(
              "Activity level",
              [
                ["Low", "low"],
                ["Moderate", "moderate"],
                ["High", "high"],
              ],
              activityLevel,
              setActivityLevel
            )}

          {step === 5 && (
            <View>
              <Text style={styles.h2}>Allergies (optional)</Text>
              <View style={styles.row}>
                <TextInput
                  value={allergyInput}
                  onChangeText={setAllergyInput}
                  placeholder="e.g. peanuts"
                  style={styles.input}
                />
                <Pressable onPress={addAllergy} style={styles.addBtn}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Add</Text>
                </Pressable>
              </View>

              <View style={styles.wrap}>
                {allergies.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected
                    onPress={() => setAllergies(allergies.filter((x) => x !== a))}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Footer buttons */}
          <View style={styles.footer}>
            <Pressable onPress={back} disabled={step === 0} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Back</Text>
            </Pressable>

            {showCancelInWizard && (
              <Pressable onPress={cancelWizard} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
            )}

            <Pressable
              onPress={step < 5 ? next : finish}
              style={[styles.btnPrimary, !canContinue && step < 5 ? styles.btnDisabled : null]}
              disabled={step < 5 ? !canContinue : false}
            >
              <Text style={styles.btnPrimaryText}>{step < 5 ? "Continue" : "Finish"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- HELPERS ---------------- */

function stepBlock(title: string, options: [string, any][], value: any, set: any) {
  return (
    <View>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.wrap}>
        {options.map(([label, v]) => (
          <Chip key={v} label={label} selected={value === v} onPress={() => set(v)} />
        ))}
      </View>
    </View>
  );
}

function multiBlock(title: string, options: any[], list: any[], setList: any) {
  return (
    <View>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.wrap}>
        {options.map((o) => (
          <Chip
            key={o}
            label={o.replaceAll("_", " ")}
            selected={list.includes(o)}
            onPress={() =>
              setList(list.includes(o) ? list.filter((x) => x !== o) : [...list, o])
            }
          />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 18, gap: 14 },
  brand: { fontSize: 30, fontWeight: "900" },
  subBrand: { opacity: 0.6 },

  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 14, gap: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardHeaderTitle: { fontWeight: "800" },
  progress: { opacity: 0.6 },

  h2: { fontSize: 18, fontWeight: "800" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  chip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  chipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontWeight: "800" },

  footer: { flexDirection: "row", gap: 8 },

  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnGhostText: { fontWeight: "800" },

  btnPrimary: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },

  btnDisabled: { opacity: 0.5 },

  /* reset-specific (NO flex!) */
  resetPrimary: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  resetPrimaryText: { color: "#fff", fontWeight: "900" },
  resetGhost: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  resetGhostText: { fontWeight: "900" },

  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
});
