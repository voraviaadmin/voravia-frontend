import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

type Props = {
  onPress: () => void | Promise<void>;
};

export default function LogoutButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && { opacity: 0.85 },
      ]}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Logout"
    >
      <Text style={styles.text} numberOfLines={1}>
        Logout
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 78,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  text: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827", // ✅ FORCE visible text
  },
});
