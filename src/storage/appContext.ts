import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContextScope } from "@/src/context/contextRules";

export type AppContextState = {
  segment: ContextScope; // ✅ lowercase
  currentUserId: string;
};

const KEY = "voravia.appContext.v1";

const DEFAULTS: AppContextState = {
  segment: "individual",
  currentUserId: "head",
};

// ✅ Migrates legacy values from storage into the new lowercase MVP segment set
function normalizeSegment(seg: any): ContextScope {
  switch (seg) {
    // new valid values
    case "individual":
    case "family":
    case "workplace":
      return seg;

    // legacy capitalized values (your current type)
    case "Individual":
      return "individual";
    case "Family":
      return "family";
    case "Workplace":
      return "workplace";

    // older legacy values from earlier iterations
    case "you":
    case "self":
      return "individual";
    case "corporate":
      return "workplace";

    // removed from MVP
    case "insurance":
      return "individual";

    default:
      return "individual";
  }
}

export async function getAppContext(): Promise<AppContextState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AppContextState> & { segment?: any };
      return {
        segment: normalizeSegment(parsed.segment ?? DEFAULTS.segment),
        currentUserId: parsed.currentUserId ?? DEFAULTS.currentUserId,
      };
    } catch {}
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(DEFAULTS));
  return DEFAULTS;
}

export async function setAppContext(next: AppContextState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
