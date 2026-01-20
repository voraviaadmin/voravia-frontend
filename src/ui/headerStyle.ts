// src/ui/headerStyles.ts
import { Theme } from "./theme";

export const headerStyles = {
  base: {
    headerTitleAlign: "center" as const,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: Theme.colors.bg,
      height: 52,
    },
    headerTitleStyle: {
      fontWeight: "800" as const,
      color: Theme.colors.textPrimary,
      fontSize: 16,
    },
    headerBackTitleVisible: false,
    headerTintColor: Theme.colors.textPrimary,
  },

  rightButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Theme.colors.chipBorder,
    backgroundColor: Theme.colors.card,
  },

  rightButtonText: {
    fontWeight: "800" as const,
    fontSize: 13,
    color: Theme.colors.textPrimary,
  },
};
