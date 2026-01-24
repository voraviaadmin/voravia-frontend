import { api } from "./api";
import { fetchMe } from "./me";

export type FamilyMember = { id: string; name: string };

// MVP: one shared member list function for the app.
// - Individual: single derived member
// - Family: /v1/family/members
export async function fetchFamilyMembers(): Promise<FamilyMember[]> {
  const me = await fetchMe().catch(() => null);

  // If /v1/me fails, safest fallback is single-member list
  if (!me) return [{ id: "u_self", name: "Me" }];

  if (me.activeProfile === "individual") {
    // Individual mode => only self
    return [{ id: me.userId || "u_self", name: "Me" }];
  }

  // Family mode => only family members list

  
  const json = (await api<any>(`/v1/family/members`, { method: "GET" }).catch(
    () => ({})
  )) as any;

  const items = Array.isArray(json?.items) ? json.items : [];

  

  return items
    .filter((x: any) => x && typeof x.id === "string")
    .map((x: any) => ({
      id: String(x.id),
      name: String(x.name ?? x.id),
    }));
}
