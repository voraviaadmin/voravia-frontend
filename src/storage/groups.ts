import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "voravia.groups.v1";

export type GroupType = "Family" | "Workplace";

export type Group = {
  id: string;
  type: GroupType;
  name: string;
  members?: number;
  score?: number;
  streakDays?: number;
};

type Payload = {
  groups: Group[];
};

async function readPayload(): Promise<Payload> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { groups: [] };
  try {
    return JSON.parse(raw) as Payload;
  } catch {
    return { groups: [] };
  }
}

async function writePayload(payload: Payload) {
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function listGroups(): Promise<Group[]> {
  const p = await readPayload();
  return p.groups ?? [];
}

export async function addGroup(group: Group): Promise<void> {
  const p = await readPayload();
  p.groups = [group, ...(p.groups ?? [])];
  await writePayload(p);
}
