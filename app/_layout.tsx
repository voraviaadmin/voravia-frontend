import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Single entry point */}
        <Stack.Screen name="context-gate" />

        {/* End user app */}
        <Stack.Screen name="(tabs)" />

        {/* Admin app */}
        <Stack.Screen name="admin" />

        {/* Optional existing routes */}
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
