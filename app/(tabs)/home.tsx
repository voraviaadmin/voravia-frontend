import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";

type ScoreRingProps = {
  score: number; // 0–100
  size?: number;
  stroke?: number;
};

/**
 * Lightweight score ring without SVG:
 * Uses a thick border ring + an "arc" illusion with overlay.
 * (Later you can swap to react-native-svg for a true arc.)
 */
function ScoreRing({ score, size = 160, stroke = 14 }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const rotation = (clamped / 100) * 360;

  const ringSize = size;
  const innerSize = ringSize - stroke * 2;

  return (
    <View style={[styles.ringWrap, { width: ringSize, height: ringSize }]}>
      {/* Base ring */}
      <View
        style={[
          styles.ringBase,
          { width: ringSize, height: ringSize, borderWidth: stroke },
        ]}
      />

      {/* "Progress" overlay: rotate a half-mask to simulate progress */}
      <View
        style={[
          styles.ringProgressWrap,
          { width: ringSize, height: ringSize },
        ]}
      >
        <View
          style={[
            styles.ringProgress,
            { width: ringSize, height: ringSize, borderWidth: stroke },
            { transform: [{ rotate: `${rotation}deg` }] },
          ]}
        />
      </View>

      {/* Inner surface */}
      <View
        style={[
          styles.ringInner,
          { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
        ]}
      >
        <Text style={styles.scoreValue}>{clamped}</Text>
        <Text style={styles.scoreLabel}>Daily Score</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  // MVP demo values (later wire to state)
  const score = 82;
  const streakDays = 5;

  const status = useMemo(() => {
    if (score >= 85) return { text: "Excellent", hint: "Keep the streak going." };
    if (score >= 70) return { text: "Great", hint: "You’re on track today." };
    if (score >= 50) return { text: "Good", hint: "A couple smart choices will help." };
    return { text: "Needs Focus", hint: "Start with one healthy scan." };
  }, [score]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Voravia</Text>
          <Text style={styles.subtitle}>Home dashboard (MVP)</Text>
        </View>

        {/* Streak pill */}
        <View style={styles.streakPill}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakText}>{streakDays} day streak</Text>
        </View>
      </View>

      {/* Main Card */}
      <View style={styles.card}>
        <ScoreRing score={score} />

        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>{status.text}</Text>
          <Text style={styles.statusHint}>{status.hint}</Text>
        </View>

        {/* Primary CTAs */}
        <View style={styles.ctaRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Text style={styles.primaryBtnText}>Scan Food</Text>
            <Text style={styles.primaryBtnSub}>Camera / Barcode</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(tabs)/restaurants")}
          >
            <Text style={styles.secondaryBtnText}>Find Restaurant</Text>
            <Text style={styles.secondaryBtnSub}>Nearby + menus</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick Insight Cards (optional but nice for the look) */}
      <View style={styles.quickRow}>
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Today’s Focus</Text>
          <Text style={styles.quickText}>Lower sodium • Add protein</Text>
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Next Win</Text>
          <Text style={styles.quickText}>1 healthy scan to keep streak</Text>
        </View>
      </View>

      <Text style={styles.footerNote}>
        Tip: This is UI-only for now. Next we’ll connect it to your profile +
        scan results.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAFB",
    paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }),
    paddingHorizontal: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B2A2F",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#4A6468",
  },

  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  streakIcon: { fontSize: 14 },
  streakText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B2A2F",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 16,
  },

  ringWrap: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  ringBase: {
    position: "absolute",
    borderRadius: 999,
    borderColor: "#DDEBEE",
  },
  ringProgressWrap: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
  },
  ringProgress: {
    position: "absolute",
    borderRadius: 999,
    borderColor: "#0E7C86", // Voravia teal
    opacity: 0.95,
  },
  ringInner: {
    backgroundColor: "#F7FCFD",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4EFF1",
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: "900",
    color: "#0B2A2F",
  },
  scoreLabel: {
    marginTop: 2,
    fontSize: 12,
    color: "#4A6468",
    fontWeight: "600",
  },

  statusBlock: {
    alignItems: "center",
    marginBottom: 14,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B2A2F",
  },
  statusHint: {
    marginTop: 6,
    fontSize: 13,
    color: "#4A6468",
    textAlign: "center",
  },

  ctaRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#0E7C86",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  primaryBtnSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#F1FBFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CFE8EA",
  },
  secondaryBtnText: {
    color: "#0B2A2F",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryBtnSub: {
    marginTop: 4,
    color: "#4A6468",
    fontSize: 12,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.88,
  },

  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 12,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0B2A2F",
  },
  quickText: {
    marginTop: 6,
    fontSize: 12,
    color: "#4A6468",
    fontWeight: "600",
    lineHeight: 16,
  },

  footerNote: {
    marginTop: 12,
    fontSize: 12,
    color: "#6B8387",
    textAlign: "center",
  },
});
