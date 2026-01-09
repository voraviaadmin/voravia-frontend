import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadProfile } from "../../src/profileStorage";
import { router } from "expo-router";

// ---- Standardized header spacing (shared feel across tabs)
const SCREEN_PAD_H = 16;
const HEADER_TOP_EXTRA = 10;
const HEADER_GAP = 6;
const HEADER_BOTTOM = 14;

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);

  const refresh = async () => {
    const p = await loadProfile();
    setProfile(p);
  };

  useEffect(() => {
    refresh();
  }, []);

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
        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.sub}>Used to personalize your meal feedback.</Text>
      </View>

      <View style={styles.card}>
        {!profile ? (
          <Text style={{ opacity: 0.7 }}>No profile saved yet.</Text>
        ) : (
          <>
            <Row label="Goal" value={String(profile.goal)} />
            <Row label="Dietary style" value={String(profile.dietaryStyle)} />
            <Row label="Activity" value={String(profile.activityLevel)} />
            <Row label="Focus areas" value={(profile.focusAreas || []).join(", ") || "—"} />
            <Row label="Constraints" value={(profile.constraints || []).join(", ") || "—"} />
            <Row label="Allergies" value={(profile.allergies || []).join(", ") || "—"} />
          </>
        )}
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => router.push({ pathname: "/onboarding", params: { mode: "edit" } })}
      >
        <Text style={styles.primaryText}>Edit profile</Text>
      </Pressable>

      <Pressable
        style={styles.secondary}
        onPress={() => router.push({ pathname: "/onboarding", params: { mode: "reset" } })}
      >
        <Text style={styles.secondaryText}>Reset profile</Text>
      </Pressable>

      <Pressable style={styles.ghost} onPress={refresh}>
        <Text style={styles.ghostText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
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
  sub: {
    opacity: 0.7,
    lineHeight: 20,
  },

  card: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  row: { gap: 2 },
  k: { opacity: 0.6, fontWeight: "700" },
  v: { fontWeight: "700" },

  primary: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: "#fff", fontWeight: "900" },

  ghost: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "white",
  },
  ghostText: { fontWeight: "900" },
});
