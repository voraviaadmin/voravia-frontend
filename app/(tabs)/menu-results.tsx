import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

type ItemVerdict = "FIT" | "MODERATE" | "AVOID";
type RatedItem = { name: string; verdict: ItemVerdict; score: number; reasons: string[] };

function rateLine(line: string): RatedItem | null {
  const clean = line.trim();
  if (!clean) return null;

  const l = clean.toLowerCase();
  let score = 70;
  const reasons: string[] = [];

  // Positive signals
  if (l.includes("grilled") || l.includes("baked") || l.includes("steamed")) { score += 10; reasons.push("Grilled/baked"); }
  if (l.includes("salad") || l.includes("vegg") || l.includes("greens")) { score += 8; reasons.push("Veggies/greens"); }
  if (l.includes("chicken") || l.includes("fish") || l.includes("tofu") || l.includes("lentil")) { score += 6; reasons.push("Lean protein"); }

  // Risk signals
  if (l.includes("fried") || l.includes("crispy") || l.includes("tempura")) { score -= 18; reasons.push("Fried"); }
  if (l.includes("creamy") || l.includes("alfredo") || l.includes("cheese")) { score -= 10; reasons.push("Heavier sauce"); }
  if (l.includes("sweet") || l.includes("syrup") || l.includes("honey") || l.includes("dessert")) { score -= 12; reasons.push("High sugar"); }
  if (l.includes("bacon") || l.includes("pepperoni") || l.includes("sausage")) { score -= 10; reasons.push("Processed meat"); }

  score = Math.max(0, Math.min(100, score));
  const verdict: ItemVerdict = score >= 80 ? "FIT" : score >= 60 ? "MODERATE" : "AVOID";

  return { name: clean, verdict, score, reasons: reasons.slice(0, 3) };
}

export default function MenuResultsScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{ restaurantName?: string; menuText?: string }>();

  const items = useMemo(() => {
    const text = (p.menuText ?? "").toString();
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    return lines.map(rateLine).filter(Boolean) as RatedItem[];
  }, [p.menuText]);

  const sorted = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu Ratings</Text>
      <Text style={styles.sub}>{p.restaurantName ?? "Restaurant"}</Text>

      <FlatList
        data={sorted}
        keyExtractor={(it, idx) => `${idx}-${it.name}`}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const pillStyle =
            item.verdict === "FIT" ? styles.fit : item.verdict === "MODERATE" ? styles.mod : styles.avoid;

          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <View style={[styles.pill, pillStyle]}>
                  <Text style={styles.pillText}>{item.score}</Text>
                </View>
              </View>
              <Text style={styles.reasons}>{item.verdict} • {item.reasons.join(" • ") || "Heuristic score"}</Text>
            </View>
          );
        }}
      />

      <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => router.back()}>
        <Text style={styles.primaryBtnText}>Back to menu input</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }), paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  card: { marginTop: 10, backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4EFF1", padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flex: 1, fontWeight: "900", color: "#0B2A2F" },
  reasons: { marginTop: 8, color: "#4A6468", fontWeight: "700" },

  pill: { width: 56, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  fit: { backgroundColor: "#E7FBF7", borderColor: "#BFEDE2" },
  mod: { backgroundColor: "#FFF7E7", borderColor: "#F1D9A6" },
  avoid: { backgroundColor: "#FFEDED", borderColor: "#F1B1B1" },
  pillText: { fontWeight: "900", color: "#0B2A2F" },

  primaryBtn: { marginTop: 12, backgroundColor: "#0E7C86", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "900" },
  pressed: { opacity: 0.86 },
});
