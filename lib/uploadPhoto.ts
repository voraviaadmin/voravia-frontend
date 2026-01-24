import * as FS from "expo-file-system/legacy";

export async function uploadPhotoToBackend(apiBase: string, actor: string, fileUri: string) {
  const base64 = await FS.readAsStringAsync(fileUri, { encoding: "base64" as any });

  const resp = await fetch(`${apiBase}/v1/uploads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": actor,
    },
    body: JSON.stringify({ base64, ext: "jpg" }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error || `Upload failed (${resp.status})`);

  // Return absolute URL for RN Image
  return `${apiBase}${json.url}`;
}
