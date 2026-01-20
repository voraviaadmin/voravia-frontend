import React, { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";

import LogoutButton from "@/components/LogoutButton";
import { clearAdminSessionToken, getAdminSessionToken } from "@/lib/admin/session";
import { headerStyles } from "@/src/ui/headerStyle";

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

      const onLoginRoute = pathname === "/admin/login";
      if (!ok && !onLoginRoute) router.replace("/admin/login");
    })();

    return () => {
      alive = false;
    };
  }, [router, pathname]);

  // While checking storage, render a minimal stack
  if (!checked) return <Stack screenOptions={{ ...headerStyles.base, headerTitle: "Admin" }} />;

  return (
    <Stack
      screenOptions={{
        ...headerStyles.base,
        headerRight: () => (
          <LogoutButton
            onPress={async () => {
              await clearAdminSessionToken();
              router.replace("/context-gate");
            }}
          />
        ),
      }}
    >
      <Stack.Screen name="login" options={{ title: "Login", headerRight: () => null }} />
      <Stack.Screen name="index" options={{ title: "Overview" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="top-spenders" options={{ title: "Top Spenders" }} />
      <Stack.Screen name="api-usage" options={{ title: "API Usage" }} />
    </Stack>
  );
}
