import React from "react";
import { Tabs, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import LogoutButton from "@/components/LogoutButton";
import { clearAppContext } from "@/src/storage/appContext";
import { clearAdminSessionToken } from "@/lib/admin/session";
import { headerStyles } from "@/src/ui/headerStyle";





function HeaderLogout() {
  const router = useRouter();

  return (
    <LogoutButton
      onPress={async () => {
        await clearAdminSessionToken();
        await clearAppContext();
        router.replace(`/context-gate?force=1&t=${Date.now()}`);
      }}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        ...headerStyles.base,
        headerShown: true,

        // ✅ Let navigation control the right-side container sizing
        headerRight: () => <HeaderLogout />,
        headerRightContainerStyle: {
          paddingRight: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="camera.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="recent"
        options={{
          title: "Recent",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="clock.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="restaurants"
        options={{
          title: "Eat Out",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="fork.knife" color={color} />,
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.crop.circle.fill" color={color} />,
        }}
      />

      {/* Hidden routes */}
    {/*  <Tabs.Screen
  //name="scan-result"
  //options={{
    //href: null,
    //headerShown: true,
    //headerStyle: { backgroundColor: "lime" },
   // headerTitle: () => null,
  //}}
/>*/}

      <Tabs.Screen name="restaurant-details" options={{ href: null }} />
      <Tabs.Screen name="menu-scan" options={{ href: null }} />
      <Tabs.Screen name="menu-results" options={{ href: null }} />
      <Tabs.Screen name="scan-result" options={{ href: null }} />
    </Tabs>
  );
}
