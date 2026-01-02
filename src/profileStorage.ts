import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Stored health profile used by onboarding + analysis prompts.
 * Keep this file dependency-free and stable.
 */

export const PROFILE_KEY = "voravia_health_profile_v1" as const;

export type HealthGoal =
  | "lose_weight"
  | "maintain"
  | "gain_muscle"
  | "improve_energy"
  | "manage_condition";

export type DietaryStyle =
  | "none"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto"
  | "low_carb"
  | "mediterranean";

export type FocusArea =
  | "blood_sugar"
  | "blood_pressure"
  | "cholesterol"
  | "gut"
  | "liver"
  | "heart";

export type Constraint =
  | "low_sodium"
  | "low_added_sugar"
  | "high_fiber"
  | "high_protein";

export type ActivityLevel = "low" | "moderate" | "high";

export type HealthProfile = {
  goal: HealthGoal;
  dietaryStyle: DietaryStyle;
  focusAreas: FocusArea[];
  constraints: Constraint[];
  activityLevel: ActivityLevel;
  allergies: string[]; // free-text chips
};

export async function saveProfile(profile: HealthProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<HealthProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as HealthProfile;
    // Light validation (prevents weird crashes if storage gets corrupted)
    if (!parsed || typeof parsed !== "object") return null;
    if (!("goal" in parsed) || !("dietaryStyle" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function hasProfile(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return !!raw;
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
