// components/LogoutButton.tsx
import React from "react";
import { Pressable, Text } from "react-native";
import { headerStyles } from "@/src/ui/headerStyle";

type Props = {
  onPress: () => void | Promise<void>;
};

export default function LogoutButton({ onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={headerStyles.rightButton}>
      <Text style={headerStyles.rightButtonText}>Logout</Text>
    </Pressable>
  );
}
