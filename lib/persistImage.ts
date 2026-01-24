// persistImage.ts
// Use legacy FS for reliable paths + copy/write APIs across SDK versions.


//----------------------------------------------------------//
// This file is no longer used, but is kept here for reference.
// We now use the backend to persist the photo.
// The backend returns a URL that can be used to display the photo.
// The URL is stored in the database and can be used to display the photo.
// Use uploadPhotoToBackend to upload the photo to the backend.
// File Name: uploadPhoto.ts is used to upload the photo to the backend.

//----------------------------------------------------------//


import * as LegacyFS from "expo-file-system/legacy";

function ensureSlash(p: string) {
  return p.endsWith("/") ? p : `${p}/`;
}

function extFromUri(uri: string) {
  const clean = uri.split("?")[0];
  const m = clean.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1]}` : ".jpg";
}

export async function persistImageUri(inputUri: string): Promise<string> {
  try {
    console.log("[persistImageUri] input:", inputUri);

    if (!inputUri) return inputUri;
    if (!String(inputUri).startsWith("file://")) return inputUri;

    const base = LegacyFS.documentDirectory;
    if (!base) {
      console.log("[persistImageUri] legacy documentDirectory missing, returning input");
      return inputUri;
    }

    const baseDir = ensureSlash(String(base));
    const photosDir = `${baseDir}photos/`;

    await LegacyFS.makeDirectoryAsync(photosDir, { intermediates: true }).catch(() => {});

    // already persisted
    if (inputUri.startsWith(photosDir)) return inputUri;

    const dest = `${photosDir}${Date.now()}${extFromUri(inputUri)}`;
    console.log("[persistImageUri] dest:", dest);

    // Attempt 1: copyAsync
    try {
      await LegacyFS.copyAsync({ from: inputUri, to: dest });
      const info = await LegacyFS.getInfoAsync(dest);
      console.log("[persistImageUri] copy done exists:", info.exists);
      if (info.exists) return dest;
    } catch (e: any) {
      console.log("[persistImageUri] copyAsync failed:", String(e?.message || e));
    }

    // Attempt 2: base64 read/write
    try {
      const b64 = await LegacyFS.readAsStringAsync(inputUri, { encoding: "base64" as any });
      await LegacyFS.writeAsStringAsync(dest, b64, { encoding: "base64" as any });
      const info2 = await LegacyFS.getInfoAsync(dest);
      console.log("[persistImageUri] base64 write exists:", info2.exists);
      if (info2.exists) return dest;
    } catch (e: any) {
      console.log("[persistImageUri] base64 fallback failed:", String(e?.message || e));
    }

    console.log("[persistImageUri] all attempts failed, returning input");
    return inputUri;
  } catch (e) {
    console.warn("[persistImageUri] fatal", e);
    return inputUri;
  }
}

export async function deletePersistedPhotoIfManaged(photoUri?: string | null) {
  try {
    if (!photoUri || !String(photoUri).startsWith("file://")) return;

    const base = LegacyFS.documentDirectory;
    if (!base) return;

    const photosDir = `${ensureSlash(String(base))}photos/`;
    if (!String(photoUri).startsWith(photosDir)) return;

    await LegacyFS.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
  } catch (e) {
    console.warn("[deletePersistedPhotoIfManaged] failed", e);
  }
}
