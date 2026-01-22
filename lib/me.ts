// voravia-app/lib/me.ts
import { api } from "./api";

export type ActiveProfile = "individual" | "family";

export type FamilyMemberLite = { id: string; name: string };

export type MeResponse = {
  userId?: string;
  mode?: "individual" | "family";
  activeProfile?: ActiveProfile;
  family?: {
    familyId?: string;
    name?: string;
    activeMemberId?: string;
    members?: Array<{ id: string; displayName?: string; memberType?: string }>;
  };
  profile?: Record<string, any>;
};

export async function fetchMe(forceProfile?: ActiveProfile): Promise<MeResponse> {
  // Your backend currently supports ?profile=family (from earlier contract).
  // If it actually expects ?mode=family instead, change "profile" to "mode" here.
  const qs = forceProfile ? `?profile=${encodeURIComponent(forceProfile)}` : "";
  return api<MeResponse>(`/v1/me${qs}`, { method: "GET" });
}
