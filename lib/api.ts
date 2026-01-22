// voravia-app/lib/api.ts
import { getAppContext } from "@/src/storage/appContext";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8787`
    : "http://localhost:8787");

function mapToBackendUserId(appUserId?: string | null) {
  // Your app uses "head"/"spouse" locally; backend expects "u_head"/"u_spouse"
  if (!appUserId) return "u_head";
  const v = String(appUserId).toLowerCase();
  if (v === "head") return "u_head";
  if (v === "spouse") return "u_spouse";
  if (v.startsWith("u_")) return v;
  return `u_${v}`;
}

async function getUserHeader(): Promise<string> {
  try {
    const ctx = await getAppContext();
    // Depending on your storage, currentUserId may be here:
    // - ctx.currentUserId (likely "head"/"spouse")
    // - ctx.userId (maybe already "u_head")
    const raw = (ctx as any)?.userId ?? (ctx as any)?.currentUserId ?? "head";
    return mapToBackendUserId(raw);
  } catch {
    return "u_head";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const userId = await getUserHeader();

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "omit",
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-user-id": userId,
    },
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // leave as {}
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}
