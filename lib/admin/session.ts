import * as SecureStore from "expo-secure-store";

const KEY_TOKEN = "adminSessionToken";
const KEY_EMAIL = "adminEmail";

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function setAdminSession(token: string, email: string) {
  const useSS = await canUseSecureStore();
  if (useSS) {
    await SecureStore.setItemAsync(KEY_TOKEN, token);
    await SecureStore.setItemAsync(KEY_EMAIL, email);
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_EMAIL, email);
  }
}

export async function getAdminSessionToken(): Promise<string> {
  const useSS = await canUseSecureStore();
  if (useSS) return (await SecureStore.getItemAsync(KEY_TOKEN)) || "";
  if (typeof localStorage !== "undefined") return localStorage.getItem(KEY_TOKEN) || "";
  return "";
}

export async function clearAdminSessionToken() {
  const useSS = await canUseSecureStore();
  if (useSS) {
    await SecureStore.deleteItemAsync(KEY_TOKEN);
    await SecureStore.deleteItemAsync(KEY_EMAIL);
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_EMAIL);
  }
}
