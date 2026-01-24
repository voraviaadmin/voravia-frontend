import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContextScope } from "@/src/context/contextRules";

export type AppContextState = {
  segment: ContextScope; // "individual" | "family" | "workplace" (lowercase)
  currentUserId: string; // should be "u_head" (actor id), NOT member ids like "mem_..."
};

const KEY = "voravia.appContext.v1";

// ✅ Canonical actor IDs for MVP
const CANONICAL_HEAD = "u_head";

// If you ever used "head" historically, normalize it.
function normalizeUserId(id: any): string {
  const s = String(id ?? "").trim();
  if (!s) return CANONICAL_HEAD;
  if (s === "head") return CANONICAL_HEAD; // ✅ critical fix
  return s;
}

function normalizeSegment(seg: any): ContextScope {
  const s = String(seg ?? "").toLowerCase().trim();
  if (s === "family" || s === "workplace" || s === "individual") return s as ContextScope;
  return "individual";
}

const DEFAULTS: AppContextState = {
  segment: "individual",
  currentUserId: CANONICAL_HEAD,
};

function safeParse(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getAppContext(): Promise<AppContextState> {
  // 1) Load saved context
  const raw = await AsyncStorage.getItem(KEY);
  const parsed = safeParse(raw);

  // 2) If none exists, seed defaults
  if (!parsed || typeof parsed !== "object") {
    await AsyncStorage.setItem(KEY, JSON.stringify(DEFAULTS));
    return DEFAULTS;
  }

  // 3) Normalize + migrate legacy shapes/values
  const next: AppContextState = {
    segment: normalizeSegment((parsed as any).segment ?? (parsed as any).activeProfile),
    currentUserId: normalizeUserId((parsed as any).currentUserId ?? (parsed as any).userId),
  };

  // 4) Persist if changed (migration)
  const prevSeg = String((parsed as any).segment ?? "");
  const prevUid = String((parsed as any).currentUserId ?? "");
  if (prevSeg !== next.segment || prevUid !== next.currentUserId) {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  return next;
}

export async function setAppContext(next: AppContextState) {
  const normalized: AppContextState = {
    segment: normalizeSegment(next?.segment),
    currentUserId: normalizeUserId(next?.currentUserId),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
}

export async function clearAppContext() {
  await setAppContext(DEFAULTS);
}
