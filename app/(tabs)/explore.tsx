import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---- Standardized header spacing (shared feel across tabs)
const SCREEN_PAD_H = 16;
const HEADER_TOP_EXTRA = 10;
const HEADER_GAP = 6;
const HEADER_BOTTOM = 14;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + HEADER_TOP_EXTRA,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {/* Header block (standardized spacing) */}
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>
          Coming soon: tips, patterns, and meal improvements based on your health profile.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next up</Text>
        <Text style={styles.cardBody}>
          • Track meals over time{"\n"}
          • Personalized “better swap” suggestions{"\n"}
          • Goals & constraints based feedback{"\n"}
          • Restaurant suggestions
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#fff",
    paddingHorizontal: SCREEN_PAD_H,
    gap: 12,
  },

  header: {
    gap: HEADER_GAP,
    marginBottom: HEADER_BOTTOM,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    opacity: 0.7,
    lineHeight: 20,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    backgroundColor: "white",
  },
  cardTitle: { fontWeight: "900", marginBottom: 6 },
  cardBody: { opacity: 0.88, lineHeight: 20 },
});
