import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * ESLint config for Expo + React Native + TypeScript
 * Safe, minimal, and production-friendly
 */
export default [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      // React
      "react/react-in-jsx-scope": "off", // Not needed with Expo
      "react/prop-types": "off",

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",

      // General quality-of-life
      "no-console": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  {
    ignores: [
      "node_modules",
      ".expo",
      "dist",
      "build",
      "web-build",
    ],
  },
];
