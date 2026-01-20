import { getAdminSessionToken } from "./session";

const DEFAULT_BASE =
  (process.env.EXPO_PUBLIC_API_URL as string) || "http://localhost:8787";

export async function adminGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(path, DEFAULT_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const token = await getAdminSessionToken();
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Admin request failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function adminPost<T>(
  path: string,
  body: any
): Promise<T> {
  const url = new URL(path, DEFAULT_BASE);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Admin request failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
