import React, { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { clearAdminSessionToken, getAdminSessionToken } from "../../lib/admin/session";
import LogoutButton from "../../components/LogoutButton";
import { HEADER_STYLE } from "../../src/ui/headerStyle";
import { getAppContext, setAppContext, clearAppContext } from "@/src/storage/appContext";
import { View } from "react-native";



export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const token = await getAdminSessionToken();
      if (!alive) return;

      const ok = !!token;
      setAuthed(ok);
      setChecked(true);

      // Allow login route even when not authed
      const onLoginRoute = pathname === "/admin/login";
      if (!ok && !onLoginRoute) {
        router.replace("/admin/login");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, pathname]);

  // While checking storage, render a minimal stack (prevents flicker/crashes)
  if (!checked) {
    return <Stack screenOptions={{ headerTitle: "Admin" }} />;
  }

  return (
    <Stack
    screenOptions={{
      ...HEADER_STYLE,
      headerTitle: "Admin",
      headerRight: () =>
        authed ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <LogoutButton
              variant="header"
              label="Logout"
              onPress={async () => {
                await clearAdminSessionToken();
                await clearAppContext();
                router.replace(`/context-gate?force=1&t=${Date.now()}`);
              }}
            />
          </View>
        ) : null,
    }}
    >
      <Stack.Screen
        name="login"
        options={{ title: "Login", headerRight: () => null }}
      />
      <Stack.Screen name="index" options={{ title: "Overview" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="top-spenders" options={{ title: "Top Spenders" }} />
      <Stack.Screen name="api-usage" options={{ title: "API Usage" }} />
    </Stack>
  );
}
