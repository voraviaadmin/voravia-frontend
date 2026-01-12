import * as Location from "expo-location";
import { Platform } from "react-native";

export type VoraviaLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

export type LocationResult =
  | { ok: true; location: VoraviaLocation }
  | { ok: false; error: string };

export async function getMobileLocationOnce(): Promise<LocationResult> {
  // Step 1 is mobile-only. Never execute on web.
  if (Platform.OS === "web") {
    return { ok: false, error: "Location is mobile-only for Step 1." };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { ok: false, error: "Location services are disabled." };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return { ok: false, error: "Location permission not granted." };
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const base: VoraviaLocation = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };

  // Best-effort reverse geocode (safe to fail, especially on sim)
  try {
    const res = await Location.reverseGeocodeAsync({
      latitude: base.latitude,
      longitude: base.longitude,
    });
    const g = res?.[0];
    return {
      ok: true,
      location: {
        ...base,
        city: g?.city ?? g?.subregion ?? null,
        region: g?.region ?? null,
        country: g?.country ?? null,
        postalCode: g?.postalCode ?? null,
      },
    };
  } catch {
    return { ok: true, location: base };
  }
}
