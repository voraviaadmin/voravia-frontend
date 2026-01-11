import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Versioned storage keys
 */
const KEYS = {
  PROFILE_V1: "PROFILE_V1",
  UPLOAD_KEY_LATEST: "UPLOAD_KEY_LATEST",
  RATING_CACHE_V1: "RATING_CACHE_V1",
} as const;

export type Profile = Record<string, any>;
export type MenuRatingResponse = Record<string, any>;

type RatingCacheEntry = {
  ratedAt: number;
  rating: MenuRatingResponse;
};

type RatingCacheMap = Record<string, RatingCacheEntry>;

/**
 * ---------- JSON helpers ----------
 */
async function safeGetJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

async function safeSetJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/**
 * Stable stringify so hashing is deterministic
 */
function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const keys = Object.keys(value).sort();
  const props = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${props.join(",")}}`;
}

/**
 * Small deterministic hash (not crypto, fine for cache keys)
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function profileHash(profile: Profile): string {
  const s = `PROFILE_HASH_V1:${stableStringify(profile ?? {})}`;
  return djb2Hash(s);
}

export function makeRatingCacheKey(uploadKey: string, profile: Profile): string {
  return `${uploadKey}__${profileHash(profile)}`;
}

/**
 * ---------- Profile ----------
 */
export async function getSavedProfile(): Promise<Profile | null> {
  return await safeGetJSON<Profile>(KEYS.PROFILE_V1);
}

export async function saveProfile(profile: Profile): Promise<void> {
  await safeSetJSON(KEYS.PROFILE_V1, profile ?? {});
}

/**
 * ---------- UploadKey ----------
 */
export async function getLatestUploadKey(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEYS.UPLOAD_KEY_LATEST);
  return raw || null;
}

export async function setLatestUploadKey(uploadKey: string | null): Promise<void> {
  if (!uploadKey) {
    await AsyncStorage.removeItem(KEYS.UPLOAD_KEY_LATEST);
    return;
  }
  await AsyncStorage.setItem(KEYS.UPLOAD_KEY_LATEST, uploadKey);
}

/**
 * ---------- Rating Cache ----------
 */
async function getRatingCacheMap(): Promise<RatingCacheMap> {
  return (await safeGetJSON<RatingCacheMap>(KEYS.RATING_CACHE_V1)) ?? {};
}

async function setRatingCacheMap(map: RatingCacheMap): Promise<void> {
  await safeSetJSON(KEYS.RATING_CACHE_V1, map);
}

export async function getCachedRating(
  uploadKey: string,
  profile: Profile
): Promise<RatingCacheEntry | null> {
  if (!uploadKey) return null;
  const map = await getRatingCacheMap();
  const cacheKey = makeRatingCacheKey(uploadKey, profile);
  return map[cacheKey] ?? null;
}

export async function setCachedRating(
  uploadKey: string,
  profile: Profile,
  rating: MenuRatingResponse
): Promise<void> {
  if (!uploadKey) return;
  const map = await getRatingCacheMap();
  const cacheKey = makeRatingCacheKey(uploadKey, profile);
  map[cacheKey] = { ratedAt: Date.now(), rating };
  await setRatingCacheMap(map);
}

export async function clearCachedRating(uploadKey: string, profile: Profile): Promise<void> {
  const map = await getRatingCacheMap();
  const cacheKey = makeRatingCacheKey(uploadKey, profile);
  if (map[cacheKey]) {
    delete map[cacheKey];
    await setRatingCacheMap(map);
  }
}

export async function clearAllVoraviaStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.PROFILE_V1,
    KEYS.UPLOAD_KEY_LATEST,
    KEYS.RATING_CACHE_V1,
  ]);
}
