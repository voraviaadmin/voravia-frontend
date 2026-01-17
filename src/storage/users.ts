import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserProfile = {
  id: string;
  name: string;

  familyId?: string;
  insuranceId?: string;
  corporateId?: string;
};

const USERS_KEY = "voravia.users.v1";

export async function listUsers(): Promise<UserProfile[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as UserProfile[];
  } catch {
    return [];
  }
}

export async function saveUsers(users: UserProfile[]) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function getUserById(id: string): Promise<UserProfile | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function upsertUser(user: UserProfile) {
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  await saveUsers(users);
}


export function normalizeFamilyCode(input: string) {
  return input.trim().toUpperCase();
}

export async function seedDemoHousehold(familyId = "FAM-1") {
  const demo: UserProfile[] = [
    {
      id: "head",
      name: "Head",
      familyId,
      insuranceId: "INS-A",
      corporateId: "CORP-X",
    },
    {
      id: "spouse",
      name: "Spouse",
      familyId,
      insuranceId: "INS-B",
      corporateId: "CORP-Y",
    },
    { id: "child1", name: "Child 1", familyId, insuranceId: "INS-A" },
    { id: "child2", name: "Child 2", familyId, insuranceId: "INS-A" },
  ];

  await saveUsers(demo);
}
