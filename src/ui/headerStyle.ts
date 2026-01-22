// src/ui/headerStyle.ts
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
      fontSize: 16,
      fontWeight: "800" as const,
      color: Theme.colors.textPrimary,
    },
  },

  rightButton: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.18)",
  },

  rightButtonText: {
    fontSize: 13,
    fontWeight: "900" as const,
    color: "#0F172A",
    includeFontPadding: false,
  },
};
