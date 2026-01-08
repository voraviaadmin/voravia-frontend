import Constants from "expo-constants";

/**
 * API base URL resolution order:
 * 1. Expo extra (EAS / app.json / app.config.js)
 * 2. EXPO_PUBLIC_* env variable (recommended)
 * 3. Local fallback for development
 */
export const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";
