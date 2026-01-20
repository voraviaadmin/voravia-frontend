// app/lib/me.ts
export type ActiveProfile = "individual" | "family";

export type FamilyMember = {
  id: string;
  name: string;
};

export type MeResponse = {
  userId: string; // current "acting" userId (family head or self)
  activeProfile: ActiveProfile;
  family: FamilyMember[];
  profile?: Record<string, any>;
};

export function getApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:8787"
  );
}

/**
 * Fetches /v1/me (profile-aware members).
 *
 * Optional: pass activeProfile if you want to force the mode:
 *   fetchMe("family") or fetchMe("individual")
 */
export async function fetchMe(forceProfile?: ActiveProfile): Promise<MeResponse> {
  const api = getApiBaseUrl();
  const qs = forceProfile ? `?profile=${encodeURIComponent(forceProfile)}` : "";
  const resp = await fetch(`${api}/v1/me${qs}`, { method: "GET" });

  const json = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    throw new Error(json?.message || json?.error || `Failed to load /v1/me (${resp.status})`);
  }

  const family = Array.isArray(json?.family) ? json.family : [];
  return {
    userId: String(json?.userId || "u_self"),
    activeProfile: (String(json?.activeProfile) as any) === "individual" ? "individual" : "family",
    family: family
      .filter((x: any) => x && typeof x.id === "string")
      .map((x: any) => ({ id: String(x.id), name: String(x.name ?? x.id) })),
    profile: json?.profile ?? {},
  };
}

export function displayNameFor(userId: string, family: FamilyMember[]) {
  const hit = family.find((m) => m.id === userId);
  return hit?.name || userId;
}
