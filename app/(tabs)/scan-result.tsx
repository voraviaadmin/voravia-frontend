import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

type Verdict = "FIT" | "MODERATE" | "AVOID";

type OFFProductResponse = {
  status: number; // 1 found, 0 not found
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    image_front_url?: string;
    nutriments?: Record<string, number | string | undefined>;
    nutriscore_grade?: string; // sometimes exists
    nova_group?: number; // sometimes exists
  };
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Very simple MVP scoring (per 100g if available).
 * Tune later per health profile.
 */
function scoreFood(n: {
  sugar_100g?: number | null;
  sodium_100g?: number | null; // grams
  salt_100g?: number | null;   // grams
  saturated_fat_100g?: number | null;
  energy_kcal_100g?: number | null;
}) : { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  let risk = 0;

  // Sugar thresholds (g/100g)
  if (n.sugar_100g != null) {
    if (n.sugar_100g >= 20) { risk += 2; reasons.push("High sugar"); }
    else if (n.sugar_100g >= 10) { risk += 1; reasons.push("Moderate sugar"); }
  } else {
    reasons.push("Sugar data missing");
  }

  // Sodium: OpenFoodFacts often provides sodium_100g in grams (g/100g).
  // Convert to mg for messaging.
  const sodiumG = n.sodium_100g ?? null;
  const saltG = n.salt_100g ?? null;
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : null;
  const saltMg = saltG != null ? saltG * 1000 : null;

  if (sodiumMg != null) {
    if (sodiumMg >= 600) { risk += 2; reasons.push("High sodium"); }
    else if (sodiumMg >= 300) { risk += 1; reasons.push("Moderate sodium"); }
  } else if (saltMg != null) {
    // If sodium missing but salt exists, approximate sodium as ~40% of salt.
    const approxSodiumMg = saltMg * 0.4;
    if (approxSodiumMg >= 600) { risk += 2; reasons.push("High sodium (estimated)"); }
    else if (approxSodiumMg >= 300) { risk += 1; reasons.push("Moderate sodium (estimated)"); }
  } else {
    reasons.push("Sodium data missing");
  }

  // Saturated fat (g/100g)
  if (n.saturated_fat_100g != null) {
    if (n.saturated_fat_100g >= 5) { risk += 2; reasons.push("High saturated fat"); }
    else if (n.saturated_fat_100g >= 2) { risk += 1; reasons.push("Moderate saturated fat"); }
  } else {
    reasons.push("Sat fat data missing");
  }

  // Verdict
  let verdict: Verdict = "FIT";
  if (risk >= 4) verdict = "AVOID";
  else if (risk >= 2) verdict = "MODERATE";

  // Keep reasons concise
  const cleaned = reasons.filter((r) => !r.includes("missing")).slice(0, 3);
  if (cleaned.length === 0) cleaned.push("Limited nutrition data; review label");

  return { verdict, reasons: cleaned };
}

export default function ScanResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; type?: string }>();

  const code = params.code?.toString() ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OFFProductResponse | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);
      setData(null);

      if (!code) {
        setError("No barcode provided.");
        setLoading(false);
        return;
      }

      try {
        // Open Food Facts: Get product by barcode endpoint
        // https://world.openfoodfacts.org/api/v0/product/{barcode}.json
        const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        const json = (await res.json()) as OFFProductResponse;

        if (!alive) return;
        setData(json);

        if (json.status !== 1) {
          setError("Product not found in Open Food Facts.");
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Unknown error");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => { alive = false; };
  }, [code]);

  const product = data?.product;

  const title = product?.product_name_en || product?.product_name || "Unknown product";
  const brand = product?.brands || "—";
  const nutr = product?.nutriments ?? {};

  const nutrition = useMemo(() => {
    const energyKcal = toNumber(nutr["energy-kcal_100g"]) ?? toNumber(nutr["energy-kcal_serving"]);
    const fat = toNumber(nutr["fat_100g"]);
    const carbs = toNumber(nutr["carbohydrates_100g"]);
    const protein = toNumber(nutr["proteins_100g"]);
    const sugar = toNumber(nutr["sugars_100g"]);
    const sodium = toNumber(nutr["sodium_100g"]); // g/100g
    const salt = toNumber(nutr["salt_100g"]);     // g/100g
    const satFat = toNumber(nutr["saturated-fat_100g"]);

    return { energyKcal, fat, carbs, protein, sugar, sodium, salt, satFat };
  }, [nutr]);

  const { verdict, reasons } = useMemo(() => scoreFood({
    sugar_100g: nutrition.sugar,
    sodium_100g: nutrition.sodium,
    salt_100g: nutrition.salt,
    saturated_fat_100g: nutrition.satFat,
    energy_kcal_100g: nutrition.energyKcal,
  }), [nutrition]);

  const verdictStyle = verdict === "FIT" ? styles.verdictFit : verdict === "MODERATE" ? styles.verdictModerate : styles.verdictAvoid;
  const verdictText = verdict === "FIT" ? "Fits" : verdict === "MODERATE" ? "Moderate" : "Avoid";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Result</Text>
      <Text style={styles.sub}>Barcode: {code}</Text>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator />
          <Text style={styles.muted}>Looking up product…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errTitle}>Couldn’t load product</Text>
          <Text style={styles.errText}>{error}</Text>

          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Scan another</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.card}>
            <Text style={styles.prodTitle}>{title}</Text>
            <Text style={styles.muted}>Brand: {brand}</Text>

            <View style={[styles.verdictPill, verdictStyle]}>
              <Text style={styles.verdictText}>{verdictText}</Text>
            </View>

            <Text style={styles.sectionTitle}>Why</Text>
            {reasons.map((r, i) => (
              <Text key={i} style={styles.bullet}>• {r}</Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nutrition (per 100g when available)</Text>

            <Row label="Calories" value={nutrition.energyKcal != null ? `${Math.round(nutrition.energyKcal)} kcal` : "—"} />
            <Row label="Protein" value={nutrition.protein != null ? `${nutrition.protein.toFixed(1)} g` : "—"} />
            <Row label="Carbs" value={nutrition.carbs != null ? `${nutrition.carbs.toFixed(1)} g` : "—"} />
            <Row label="Fat" value={nutrition.fat != null ? `${nutrition.fat.toFixed(1)} g` : "—"} />
            <Row label="Sugar" value={nutrition.sugar != null ? `${nutrition.sugar.toFixed(1)} g` : "—"} />

            {/* sodium/salt shown in mg */}
            <Row
              label="Sodium"
              value={
                nutrition.sodium != null
                  ? `${Math.round(nutrition.sodium * 1000)} mg`
                  : nutrition.salt != null
                    ? `${Math.round(nutrition.salt * 1000 * 0.4)} mg (est.)`
                    : "—"
              }
            />
            <Row label="Sat Fat" value={nutrition.satFat != null ? `${nutrition.satFat.toFixed(1)} g` : "—"} />

            <Text style={styles.miniNote}>
              Note: Open Food Facts data varies by product. If nutrients are missing, we’ll fall back to label/photo parsing later.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>Scan another</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={() => router.push("/(tabs)/home")}>
              <Text style={styles.secondaryBtnText}>Back to Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
  title: { fontSize: 28, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  centerBlock: { marginTop: 18, alignItems: "center", gap: 10 },

  card: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 16,
  },

  prodTitle: { fontSize: 18, fontWeight: "900", color: "#0B2A2F" },
  muted: { marginTop: 6, color: "#4A6468", fontWeight: "600" },

  verdictPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  verdictText: { fontWeight: "900", color: "#0B2A2F" },
  verdictFit: { backgroundColor: "#E7FBF7", borderWidth: 1, borderColor: "#BFEDE2" },
  verdictModerate: { backgroundColor: "#FFF7E7", borderWidth: 1, borderColor: "#F1D9A6" },
  verdictAvoid: { backgroundColor: "#FFEDED", borderWidth: 1, borderColor: "#F1B1B1" },

  sectionTitle: { marginTop: 14, fontSize: 13, fontWeight: "900", color: "#0B2A2F" },
  bullet: { marginTop: 8, color: "#0B2A2F", fontWeight: "700" },

  row: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: "#4A6468", fontWeight: "800" },
  rowValue: { color: "#0B2A2F", fontWeight: "900" },

  miniNote: { marginTop: 12, color: "#6B8387", fontSize: 12, fontWeight: "600", lineHeight: 16 },

  actions: { paddingBottom: 22 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#0E7C86",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  errTitle: { fontSize: 16, fontWeight: "900", color: "#0B2A2F" },
  errText: { marginTop: 8, color: "#4A6468", fontWeight: "600", lineHeight: 18 },

  pressed: { opacity: 0.86 },
});
