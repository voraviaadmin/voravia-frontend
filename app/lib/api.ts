export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8787`
    : "http://localhost:8787");

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "omit",
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}
