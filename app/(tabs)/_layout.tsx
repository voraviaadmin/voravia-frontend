import React from "react";
import { Tabs, useRouter } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

import LogoutButton from "@/components/LogoutButton";
import { clearAppContext } from "@/src/storage/appContext";
import { clearAdminSessionToken } from "@/lib/admin/session";
import { HEADER_STYLE } from "@/src/ui/headerStyle";
import { View } from "react-native";



function HeaderLogout() {
  const router = useRouter();

  return (
    <LogoutButton
      variant="header"
      label="Logout"
      onPress={async () => {
        // clear both “admin mode” and “user mode”
        await clearAdminSessionToken();
        await clearAppContext();

        // Force ContextGate UI to show (prevents auto-routing back to tabs)
        router.replace(`/context-gate?force=1&t=${Date.now()}`);
      }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? "light"].tint;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        ...HEADER_STYLE,
        headerShown: true,
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <HeaderLogout />
          </View>
        ),
        // keep your existing tabBar props below:
        tabBarButton: HapticTab,
        tabBarActiveTintColor: tintColor,
      }}
      
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="camera.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="recent"
        options={{
          title: "Recent",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="clock.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="restaurants"
        options={{
          title: "Eat Out",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="fork.knife" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.2.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />

      {/* Hidden routes */}
      <Tabs.Screen name="scan-result" options={{ href: null }} />
      <Tabs.Screen name="restaurant-details" options={{ href: null }} />
      <Tabs.Screen name="menu-scan" options={{ href: null }} />
      <Tabs.Screen name="menu-results" options={{ href: null }} />
    </Tabs>
  );
}
