import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

const PROFILE_KEY = "voravia_health_profile_v1";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (!mounted) return;
        setHasProfile(!!raw);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* This is the key fix: enforce safe-area padding at the root */}
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <Stack screenOptions={{ headerShown: false }}>
          {hasProfile ? (
            <Stack.Screen name="(tabs)" />
          ) : (
            <Stack.Screen name="onboarding" />
          )}
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
