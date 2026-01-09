import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? "light"].tint;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
