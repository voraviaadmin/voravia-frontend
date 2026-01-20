import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";

type Props = {
  label?: string;
  onPress: () => void | Promise<void>;
  variant?: "header" | "block";
};

export default function LogoutButton({
  label = "Logout",
  onPress,
  variant = "header",
}: Props) {
  const isHeader = variant === "header";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isHeader ? styles.header : styles.block,
        pressed && { opacity: 0.6 },
      ]}
      hitSlop={isHeader ? 10 : undefined}
    >
      <Text style={[styles.text, isHeader ? styles.textHeader : styles.textBlock]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "transparent",
  } as ViewStyle,

  header: {
    height: 32,
    minWidth: 64,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  block: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: "stretch",
  },

  text: {
    fontWeight: "700",
  },
  textHeader: {
    fontSize: 14,
    lineHeight: 16,
  },
  textBlock: {
    fontSize: 16,
    textAlign: "center",
  },
});
