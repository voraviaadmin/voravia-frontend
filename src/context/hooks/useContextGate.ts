// src/context/hooks/useContextGate.ts

import { useMemo } from "react";
import type { ContextScope, ContextGateOpts, MeUser } from "@/src/context/contextRules";
import { getAvailableContexts, getContextEligibility } from "@/src/context/contextRules";

export function useContextGate(me?: MeUser | null, opts?: ContextGateOpts) {
  const eligibility = useMemo(() => {
    return getContextEligibility(me, opts);
  }, [me?.familyId, me?.corporateId, opts?.hasFamilyGroup]);

  const available = useMemo(() => {
    return getAvailableContexts(eligibility);
  }, [eligibility]);

  return { eligibility, available };
}

export function isEligible(eligibility: Record<ContextScope, boolean>, scope: ContextScope) {
  return !!eligibility[scope];
}
