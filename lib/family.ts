export type FamilyMember = { id: string; name: string };

function getApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:8787"
  );
}

export async function fetchFamilyMembers(): Promise<FamilyMember[]> {
  const api = getApiBaseUrl();

  // determine mode
  const meResp = await fetch(`${api}/v1/me`, { method: "GET" });
  const me = await meResp.json().catch(() => ({}));
  const profileType = String(me?.profileType || "individual"); // "individual" | "family"

  // Individual → only self
  if (profileType === "individual") {
    return [{ id: "u_self", name: "Me" }];
  }

  // Family → ONLY family members list (no forced "Me")
  const resp = await fetch(`${api}/v1/family/members`, { method: "GET" });
  const json = await resp.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];

  const members: FamilyMember[] = items
    .filter((x: any) => x && typeof x.id === "string")
    .map((x: any) => ({ id: String(x.id), name: String(x.name ?? x.id) }));

  return members;
}
