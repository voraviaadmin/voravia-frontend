import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserProfile = {
  id: string;
  name: string;

  familyId?: string;
  insuranceId?: string;
  corporateId?: string;
};

const USERS_KEY = "voravia.users.v1";

// Migrate legacy demo IDs -> canonical IDs used by backend
function normalizeUserId(id: any): string {
  const s = String(id ?? "").trim();
  if (!s) return "u_head";
  if (s === "head") return "u_head";
  if (s === "spouse") return "u_spouse";
  if (s === "child1") return "u_child1";
  if (s === "child2") return "u_child2";
  if (s === "self") return "u_self";
  return s;
}

function safeParse(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveUsers(users: UserProfile[]) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function listUsers(): Promise<UserProfile[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const parsed = safeParse(raw);

  // If empty, seed canonical demo users (u_* ids)
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    const familyId = "fam_demo";
    const demo: UserProfile[] = [
      { id: "u_head", name: "Head", familyId, insuranceId: "INS-A", corporateId: "CORP-X" },
      { id: "u_spouse", name: "Spouse", familyId, insuranceId: "INS-B", corporateId: "CORP-Y" },
      { id: "u_child1", name: "Child 1", familyId, insuranceId: "INS-A" },
      { id: "u_child2", name: "Child 2", familyId, insuranceId: "INS-A" },
      { id: "u_self", name: "Me" }, // individual actor
    ];
    await saveUsers(demo);
    return demo;
  }

  // Normalize/migrate any legacy IDs
  const users: UserProfile[] = parsed
    .filter((x: any) => x && typeof x === "object")
    .map((u: any) => ({
      id: normalizeUserId(u.id),
      name: String(u.name ?? u.id ?? ""),
      familyId: u.familyId ? String(u.familyId) : undefined,
      insuranceId: u.insuranceId ? String(u.insuranceId) : undefined,
      corporateId: u.corporateId ? String(u.corporateId) : undefined,
    }))
    .filter((u) => !!u.id);

  // Persist migration if anything changed
  const changed =
    users.length !== parsed.length ||
    users.some((u, i) => String(parsed[i]?.id ?? "") !== u.id);

  if (changed) {
    await saveUsers(users);
  }

  return users;
}

export async function getUserById(id: string): Promise<UserProfile | null> {
  const users = await listUsers();
  const want = normalizeUserId(id);
  return users.find((u) => u.id === want) ?? null;
}

export async function upsertUser(user: UserProfile) {
  const users = await listUsers();
  const normalized: UserProfile = {
    ...user,
    id: normalizeUserId(user.id),
  };
  const idx = users.findIndex((u) => u.id === normalized.id);
  if (idx >= 0) users[idx] = normalized;
  else users.push(normalized);
  await saveUsers(users);
}
