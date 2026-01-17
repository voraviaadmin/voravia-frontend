import AsyncStorage from "@react-native-async-storage/async-storage";

export type ContextType = "individual" | "family" | "corporate";

export type ActiveContext =
  | { type: "individual" }
  | { type: "family"; id: string; name: string }
  | { type: "corporate"; id: string; name: string };

const KEY = "voravia.activeContext.v1";

export async function getActiveContext(): Promise<ActiveContext> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { type: "individual" };
  try {
    return JSON.parse(raw) as ActiveContext;
  } catch {
    return { type: "individual" };
  }
}

export async function setActiveContext(ctx: ActiveContext): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ctx));
}
