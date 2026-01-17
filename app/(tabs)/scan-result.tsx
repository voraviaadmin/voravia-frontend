import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMe } from "../../src/hooks/useMe";



type OldShape = {
  scanId?: string;
  candidates?: { name: string; confidence: number }[];
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    fiber_g?: number;
  };
  rating?: { score: number; label: string; reasons?: string[]; tips?: string[] };
};

type NewShape = {
  scanId?: string;
  dishName?: string;
  confidence?: number;
  score?: number;
  label?: string;
  why?: string[];
  tips?: string[];
  estimatedNutrition?: {
    caloriesKcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
  };
};

type Normalized = {
  scanId: string | null;
  dishName: string;
  confidencePct: number | null;
  score: number;
  label: "Great" | "Okay" | "Limit" | "Avoid";
  why: string[];
  tips: string[];
  nutrition: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
};

type LogForOption = {
  id: string;
  name: string;
};


function getApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:8787"
  );
}

function normalize(payload: any): Normalized {
  // New shape
  if (payload && (payload.dishName || payload.estimatedNutrition || payload.why || payload.tips)) {
    const p = payload as NewShape;

    const score = Number.isFinite(Number(p.score)) ? Math.round(Number(p.score)) : 0;
    const labelRaw = String(p.label || "").toLowerCase();
    const label: Normalized["label"] =
      labelRaw === "great"
        ? "Great"
        : labelRaw === "okay"
        ? "Okay"
        : labelRaw === "avoid"
        ? "Avoid"
        : "Limit";

    return {
      scanId: p.scanId ?? null,
      dishName: p.dishName ? String(p.dishName) : "Unknown dish",
      confidencePct: Number.isFinite(Number(p.confidence)) ? Math.round(Number(p.confidence)) : null,
      score: Math.max(0, Math.min(100, score)),
      label,
      why: Array.isArray(p.why) ? p.why.map(String).slice(0, 10) : [],
      tips: Array.isArray(p.tips) ? p.tips.map(String).slice(0, 10) : [],
      nutrition: {
        calories: Number(p.estimatedNutrition?.caloriesKcal ?? undefined),
        protein_g: Number(p.estimatedNutrition?.proteinG ?? undefined),
        carbs_g: Number(p.estimatedNutrition?.carbsG ?? undefined),
        fat_g: Number(p.estimatedNutrition?.fatG ?? undefined),
        fiber_g: Number(p.estimatedNutrition?.fiberG ?? undefined),
        sugar_g: Number(p.estimatedNutrition?.sugarG ?? undefined),
        sodium_mg: Number(p.estimatedNutrition?.sodiumMg ?? undefined),
      },
    };
  }

  // Old shape
  const o = (payload || {}) as OldShape;
  const top = o.candidates?.[0];
  const score = Number.isFinite(Number(o.rating?.score)) ? Math.round(Number(o.rating?.score)) : 0;
  const labelRaw = String(o.rating?.label || "").toLowerCase();
  const label: Normalized["label"] =
    labelRaw === "great" ? "Great" : labelRaw === "okay" ? "Okay" : "Limit";

  return {
    scanId: o.scanId ?? null,
    dishName: top?.name ? String(top.name) : "Unknown dish",
    confidencePct:
      top && Number.isFinite(Number(top.confidence))
        ? Math.round(Number(top.confidence) * 100)
        : null,
    score: Math.max(0, Math.min(100, score)),
    label,
    why: Array.isArray(o.rating?.reasons) ? o.rating.reasons.map(String).slice(0, 10) : [],
    tips: Array.isArray(o.rating?.tips) ? o.rating.tips.map(String).slice(0, 10) : [],
    nutrition: {
      calories: o.nutrition?.calories,
      protein_g: o.nutrition?.protein_g,
      carbs_g: o.nutrition?.carbs_g,
      fat_g: o.nutrition?.fat_g,
      fiber_g: o.nutrition?.fiber_g,
      sugar_g: o.nutrition?.sugar_g,
      sodium_mg: o.nutrition?.sodium_mg,
    },
  };
}

function formatMaybe(n: any, unit: string) {
  if (!Number.isFinite(Number(n))) return "—";
  const v = Math.round(Number(n));
  return `${v} ${unit}`;
}

export default function ScanResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const photoUri =
    typeof params.photoUri === "string"
      ? params.photoUri
      : Array.isArray(params.photoUri)
      ? params.photoUri[0]
      : "";

  const { me, activeMember, loading: meLoading, error: meError, refresh: refreshMe } = useMe();

  const [busy, setBusy] = useState(true);
  const [raw, setRaw] = useState<unknown>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">(() => {
    const h = new Date().getHours();
    if (h < 11) return "breakfast";
    if (h < 15) return "lunch";
    if (h < 21) return "dinner";
    return "snack";
  });

  // Build “Log for” list from /v1/me (single source of truth)
  const logForOptions = useMemo<LogForOption[]>(() => {
    if (!me) return [{ id: "u_self", name: "Me" }];
  
    if (me.mode === "family") {
      const members: LogForOption[] = (me.family?.members || []).map(
        (m: { id: string; displayName?: string }) => ({
          id: String(m.id),
          name: String(m.displayName || m.id),
        })
      );
  
      return members.length
        ? members
        : [{ id: me.userId || "u_self", name: "Me" }];
    }
  
    return [{ id: me.userId || "u_self", name: "Me" }];
  }, [me]);
  

  const [logForUserId, setLogForUserId] = useState<string>("u_self");

  // Keep selection valid + default to active family member if present
  useEffect(() => {
    if (!me) return;

    // Prefer active member if family mode
    if (me.mode === "family" && activeMember?.id) {
      setLogForUserId(String(activeMember.id));
      return;
    }

    // Otherwise ensure current selection still exists
    const exists = logForOptions.some(
      (x: LogForOption) => x.id === logForUserId
    );    

    if (!exists) setLogForUserId(logForOptions[0]?.id || "u_self");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeMember?.id, logForOptions]);

  const normalized = useMemo(() => normalize(raw), [raw]);

  const analyze = useCallback(async () => {
    if (!photoUri) return;

    try {
      setBusy(true);
      setErrorText(null);

      const api = getApiBaseUrl();
      const form = new FormData();
      form.append(
        "image",
        {
          uri: String(photoUri),
          name: "scan.jpg",
          type: "image/jpeg",
        } as any
      );

      const resp = await fetch(
        `${api}/v1/scans?memberId=${encodeURIComponent(logForUserId ?? "u_self")}`,
        { method: "POST", body: form }
      );
      

      const text = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Scan API returned non-JSON: ${text.slice(0, 120)}`);
      }

      if (!resp.ok) throw new Error(json?.message || json?.error || `Scan failed (${resp.status})`);
      setRaw(json);
    } catch (e: any) {
      setErrorText(e?.message ?? "Scan failed");
      setRaw(null);
    } finally {
      setBusy(false);
    }
  }, [photoUri]);

  // Analyze once
  useEffect(() => {
    analyze();
  }, [analyze]);

  const logMeal = useCallback(async () => {
    try {
      const api = getApiBaseUrl();
      const payload = {
        source: "scan",
        userId: logForUserId,
        mealType,

        scanId: normalized.scanId,
        dishName: normalized.dishName,
        confidence: normalized.confidencePct,
        score: normalized.score,
        label: normalized.label,
        why: normalized.why,
        tips: normalized.tips,
        nutrition: normalized.nutrition,
        photoUri: String(photoUri || ""),
      };

      const resp = await fetch(`${api}/v1/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || json?.error || "Log failed");

      Alert.alert("Logged", "Saved to your recent scans.");
      router.push("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Log failed", e?.message ?? "Could not save.");
    }
  }, [mealType, logForUserId, photoUri, router, normalized]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Scan Result</Text>

      {!!photoUri && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Photo</Text>
          <Image source={{ uri: String(photoUri) }} style={styles.photo} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.dishName}>{normalized.dishName}</Text>
        <Text style={styles.sub}>
          Confidence: {normalized.confidencePct == null ? "—" : `${normalized.confidencePct}%`}
        </Text>

        <View style={styles.pillRow}>
          <View
            style={[
              styles.pill,
              normalized.score >= 80
                ? styles.pillGood
                : normalized.score >= 60
                ? styles.pillOk
                : styles.pillBad,
            ]}
          >
            <Text style={styles.pillText}>
              {normalized.label} • {normalized.score}/100
            </Text>
          </View>
        </View>

        {busy && <Text style={styles.muted}>Analyzing…</Text>}
        {errorText && <Text style={styles.error}>Backend scan failed: {errorText}</Text>}

        <Text style={styles.section}>Why</Text>
        {normalized.why.length ? (
          normalized.why.map((w, i) => (
            <Text key={`w-${i}`} style={styles.bullet}>
              • {w}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>—</Text>
        )}

        <Text style={styles.section}>Tips</Text>
        {normalized.tips.length ? (
          normalized.tips.map((t, i) => (
            <Text key={`t-${i}`} style={styles.bullet}>
              • {t}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>—</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Estimated nutrition</Text>

        <View style={styles.nRow}>
          <Text style={styles.nKey}>Calories</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.calories, "kcal")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Protein</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.protein_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Carbs</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.carbs_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Fat</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.fat_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Fiber</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.fiber_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Sugar</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.sugar_g, "g")}</Text>
        </View>
        <View style={styles.nRow}>
          <Text style={styles.nKey}>Sodium</Text>
          <Text style={styles.nVal}>{formatMaybe(normalized.nutrition.sodium_mg, "mg")}</Text>
        </View>

        <Text style={styles.mutedSmall}>
          Nutrition is an estimate from photo analysis. We’ll improve accuracy with portion sizing + user
          corrections.
        </Text>
      </View>

      <Text style={styles.section}>Log as</Text>
      <View style={styles.segmentRow}>
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMealType(m)}
            style={[styles.segmentBtn, mealType === m && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, mealType === m && styles.segmentTextActive]}>
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Log for</Text>
      <View style={styles.segmentRow}>
        {logForOptions.map((u: LogForOption) => (
          <Pressable
            key={u.id}
            onPress={() => setLogForUserId(u.id)}
            style={[styles.segmentBtn, logForUserId === u.id && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, logForUserId === u.id && styles.segmentTextActive]}>
              {u.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Helpful debug while wiring /v1/me (remove later) */}
      <Text style={styles.mutedSmall}>
        /v1/me:{" "}
        {meLoading ? "loading…" : meError ? "error" : me?.mode ? `mode=${me.mode}` : "unknown"}{" "}
        {meError ? (
          <>
            {" "}
            • <Text onPress={refreshMe} style={{ textDecorationLine: "underline" }}>
              retry
            </Text>
          </>
        ) : null}
      </Text>

      <View style={styles.btnRow}>
        <Pressable style={styles.primaryBtn} onPress={logMeal} disabled={busy}>
          <Text style={styles.primaryBtnText}>Log this meal</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.replace("/(tabs)/scan")}
          disabled={busy}
        >
          <Text style={styles.secondaryBtnText}>Scan another</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn} onPress={analyze} disabled={busy}>
          <Text style={styles.ghostBtnText}>Re-analyze</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 32, fontWeight: "900", color: "#0B2A2F", marginBottom: 10 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    marginBottom: 12,
  },

  cardLabel: { fontWeight: "900", color: "#0B2A2F", marginBottom: 8 },
  photo: { width: "100%", height: 200, borderRadius: 14, backgroundColor: "#000" },

  dishName: { fontSize: 24, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },

  pillRow: { flexDirection: "row", marginTop: 10, marginBottom: 8 },
  pill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  pillGood: { backgroundColor: "#E7FAF3", borderColor: "#BFECDD" },
  pillOk: { backgroundColor: "#FFF4DF", borderColor: "#F0D3A1" },
  pillBad: { backgroundColor: "#FFE8E8", borderColor: "#F1B9B9" },
  pillText: { fontWeight: "900", color: "#0B2A2F" },

  section: { marginTop: 10, fontWeight: "900", color: "#0B2A2F", fontSize: 16 },
  bullet: { marginTop: 6, color: "#0B2A2F", fontWeight: "700" },

  muted: { marginTop: 10, color: "#4A6468", fontWeight: "700" },
  mutedSmall: { marginTop: 10, color: "#4A6468", fontWeight: "600", fontSize: 12, lineHeight: 18 },

  error: { marginTop: 10, color: "#B00020", fontWeight: "800" },

  nRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  nKey: { color: "#4A6468", fontWeight: "800" },
  nVal: { color: "#0B2A2F", fontWeight: "900" },

  btnRow: { gap: 10, marginTop: 6 },
  primaryBtn: { backgroundColor: "#0E7C86", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EFF1",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },

  ghostBtn: {
    backgroundColor: "#F1FBFC",
    borderWidth: 1,
    borderColor: "#CFE8EA",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  ghostBtnText: { color: "#0B2A2F", fontWeight: "900" },

  segmentRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  segmentBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    backgroundColor: "#FFFFFF",
  },
  segmentBtnActive: { backgroundColor: "#E7FAF3", borderColor: "#BFECDD" },
  segmentText: { fontWeight: "900", color: "#0B2A2F" },
  segmentTextActive: { color: "#0B2A2F" },
});
