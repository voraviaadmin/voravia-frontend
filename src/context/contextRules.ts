// src/context/contextRules.ts

export type ContextScope = "individual" | "family" | "workplace";

export type MeUser = {
  id: string;
  familyId?: string | null;
  corporateId?: string | null;
};

export type ContextGateOpts = {
  /**
   * Some parts of the MVP seed data allow a Family group to exist even if the active user
   * doesn't have familyId set yet. Keep this for compatibility with your current behavior.
   */
  hasFamilyGroup?: boolean;
};

export type ContextEligibility = Record<ContextScope, boolean>;

export const CONTEXT_ORDER: ContextScope[] = ["individual", "family", "workplace"];

export function isContextAvailable(
  scope: ContextScope,
  me?: MeUser | null,
  opts?: ContextGateOpts
): boolean {
  switch (scope) {
    case "individual":
      // Individual is always a valid landing context
      return true;

    case "family":
      // Keep your existing fallback behavior: allow Family if user has familyId OR a Family group exists
      return !!me?.familyId || !!opts?.hasFamilyGroup;

    case "workplace":
      return !!me?.corporateId;
  }
}

export function clampContext(scope: ContextScope, eligibility: ContextEligibility): ContextScope {
  const available = getAvailableContexts(eligibility);
  if (available.includes(scope)) return scope;
  return available[0] ?? "individual";
}


/**
 * Centralized eligibility map for UI rendering (Step A).
 */
export function getContextEligibility(
  me?: MeUser | null,
  opts?: ContextGateOpts
): ContextEligibility {
  return {
    individual: isContextAvailable("individual", me, opts),
    family: isContextAvailable("family", me, opts),
    workplace: isContextAvailable("workplace", me, opts),
  };
}

/**
 * Context list in the same order everywhere (Step A).
 */
export function getAvailableContexts(eligibility: ContextEligibility): ContextScope[] {
  return CONTEXT_ORDER.filter((ctx) => eligibility[ctx]);
}
