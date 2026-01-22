import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";

import { Screen } from "@/src/ui/Screen";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";
import { headerStyles } from "@/src/ui/headerStyle";

import { getAppContext } from "@/src/storage/appContext";
import { fetchMe } from "@/lib/me";
import { fetchFamilyMembers } from "@/lib/family";
import { API_BASE } from "@/lib/api";

type OldShape = {
  scanId?: string;
  candidates?: { name: string; confidence: number }[];
  nutrition?: any;
  rating?: { score: number; label?: string; reasons?: string[]; tips?: string[] };
};

type NewShape = {
  scanId?: string;
  dishName?: string;
  score?: number;
  label?: string;
  why?: string;
  tips?: string[];
  estimatedNutrition?: any;
  nutrition?: any;
};

type Normalized = {
  scanId: string;
  dishName: string;
  score: number;
  label?: string;
  why: string;
  tips: string[];
  nutrition: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    sodium_mg?: number;
    fiber_g?: number;
    sugar_g?: number;
  } | null;
  confidencePct: number;
  candidates: { name: string; confidence: number }[];
};

type LogForOption = { id: string; name: string };

function localIdToBackendActorId(id: string) {
  if (!id) return "u_head";
  if (id.startsWith("u_")) return id;
  if (id === "head") return "u_head";
  if (id === "spouse") return "u_spouse";
  if (id === "child1") return "u_child1";
  if (id === "child2") return "u_child2";
  return "u_head";
}

function clampScore(x: any) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveLabelFromScore(score: number, explicit?: string) {
  const raw = String(explicit || "").trim();
  if (raw) return raw;
  if (score >= 80) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Okay";
  return "Poor";
}

function looksLikeNutritionObject(x: any) {
  if (!x || typeof x !== "object") return false;
  const keys = Object.keys(x).map((k) => k.toLowerCase());
  return (
    keys.includes("calories") ||
    keys.includes("kcal") ||
    keys.includes("calories_kcal") ||
    keys.includes("calorieskcal") ||
    keys.includes("protein_g") ||
    keys.includes("protein") ||
    keys.includes("carbs_g") ||
    keys.includes("carbs") ||
    keys.includes("fat_g") ||
    keys.includes("fat") ||
    keys.includes("sodium_mg") ||
    keys.includes("sodium") ||
    keys.includes("fiber_g") ||
    keys.includes("fiber") ||
    keys.includes("sugar_g") ||
    keys.includes("sugar")
  );
}

function deepFindNutrition(payload: any, maxDepth = 7) {
  const seen = new Set<any>();

  const walk = (node: any, depth: number): any | null => {
    if (!node || depth > maxDepth) return null;
    if (typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);

    if (looksLikeNutritionObject(node)) return node;

    if (Array.isArray(node)) {
      for (const it of node) {
        const found = walk(it, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const fastKeys = ["estimatedNutrition", "nutrition", "estimated_nutrition", "nutritionFacts"];
    for (const k of fastKeys) {
      if ((node as any)[k]) {
        const found = walk((node as any)[k], depth + 1);
        if (found) return found;
      }
    }

    for (const v of Object.values(node)) {
      const found = walk(v, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(payload, 0);
}

function normalizeNutrition(n: any): Normalized["nutrition"] {
  if (!n || typeof n !== "object") return null;

  const calories =
    n.calories ?? n.kcal ?? n.calories_kcal ?? n.caloriesKcal ?? n.energy_kcal ?? n.energyKcal;

  const protein_g = n.protein_g ?? n.proteinG ?? n.protein;
  const carbs_g = n.carbs_g ?? n.carbsG ?? n.carbs;
  const fat_g = n.fat_g ?? n.fatG ?? n.fat;
  const fiber_g = n.fiber_g ?? n.fiberG ?? n.fiber;
  const sugar_g = n.sugar_g ?? n.sugarG ?? n.sugar;
  const sodium_mg = n.sodium_mg ?? n.sodiumMg ?? n.sodium;

  const out = {
    calories: Number.isFinite(Number(calories)) ? Number(calories) : undefined,
    protein_g: Number.isFinite(Number(protein_g)) ? Number(protein_g) : undefined,
    carbs_g: Number.isFinite(Number(carbs_g)) ? Number(carbs_g) : undefined,
    fat_g: Number.isFinite(Number(fat_g)) ? Number(fat_g) : undefined,
    fiber_g: Number.isFinite(Number(fiber_g)) ? Number(fiber_g) : undefined,
    sugar_g: Number.isFinite(Number(sugar_g)) ? Number(sugar_g) : undefined,
    sodium_mg: Number.isFinite(Number(sodium_mg)) ? Number(sodium_mg) : undefined,
  };

  const hasAny = Object.values(out).some((v) => Number.isFinite(Number(v)));
  return hasAny ? out : null;
}

function clampPct(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function toPct(maybe: any) {
  if (maybe == null) return 0;
  if (typeof maybe === "string" && maybe.includes("%")) {
    const n = Number(maybe.replace("%", "").trim());
    return clampPct(n);
  }
  const n = Number(maybe);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return clampPct(n * 100);
  return clampPct(n);
}

function deepFindConfidence(payload: any) {
  return (
    payload?.confidence ??
    payload?.result?.confidence ??
    payload?.analysis?.confidence ??
    payload?.dish?.confidence ??
    payload?.classification?.confidence ??
    payload?.candidates?.[0]?.confidence ??
    payload?.result?.candidates?.[0]?.confidence ??
    payload?.analysis?.candidates?.[0]?.confidence ??
    null
  );
}

function normalize(payload: any): Normalized {
  // candidates (old shape)
  const candidates: Normalized["candidates"] = Array.isArray(payload?.candidates)
    ? payload.candidates.map((c: any) => ({
        name: String(c?.name ?? ""),
        confidence: Number(c?.confidence ?? 0),
      }))
    : [];

  const confidenceRaw = candidates.length ? candidates[0].confidence : deepFindConfidence(payload);
  const confidencePct = toPct(confidenceRaw);

  // new shape
  if (payload && (payload.dishName || payload.estimatedNutrition || payload.why || payload.tips)) {
    const p = payload as NewShape;
    const score = clampScore(p.score);
    const nRaw = deepFindNutrition(payload);
    const nutrition = normalizeNutrition(nRaw);

    return {
      scanId: String(p.scanId || ""),
      dishName: String(p.dishName || "Meal"),
      score,
      label: String(p.label || "").trim() || undefined,
      why: String(p.why || ""),
      tips: Array.isArray(p.tips) ? p.tips.map((x) => String(x)) : [],
      nutrition,
      confidencePct,
      candidates,
    };
  }

  // old shape
  const o = (payload || {}) as OldShape;
  const rating = o.rating || ({} as any);
  const score = clampScore(rating.score);
  const nRaw = deepFindNutrition(payload);
  const nutrition = normalizeNutrition(nRaw) ?? normalizeNutrition(o.nutrition);

  return {
    scanId: String(o.scanId || ""),
    dishName: o.candidates?.[0]?.name ? String(o.candidates[0].name) : "Meal",
    score,
    label: String(rating.label || "").trim() || undefined,
    why: Array.isArray(rating.reasons) ? rating.reasons.map(String).join("\n") : "",
    tips: Array.isArray(rating.tips) ? rating.tips.map(String) : [],
    nutrition,
    confidencePct,
    candidates,
  };
}

function formatMaybe(n: any, unit: string) {
  if (!Number.isFinite(Number(n))) return "—";
  return `${Math.round(Number(n))} ${unit}`;
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

  const api = useMemo(() => API_BASE, []);
  const [me, setMe] = useState<any>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<"individual" | "family">("individual");

  const refreshMe = useCallback(async () => {
    try {
      setMeLoading(true);
      setMeError(null);
      const ctx = await getAppContext();
      const seg = ctx.segment === "family" ? "family" : "individual";
      setActiveSegment(seg);

      const resp = await fetchMe(seg).catch(() => null);
      setMe(resp ? { ...(resp as any), mode: seg } : { mode: seg });
    } catch (e: any) {
      setMeError(e?.message ?? "Failed to load /v1/me");
    } finally {
      setMeLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshMe();
    }, [refreshMe])
  );

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

  const [familyMembers, setFamilyMembers] = useState<LogForOption[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await fetchFamilyMembers().catch(() => []);
      if (!alive) return;
      const mapped = ms.map((m: any) => ({ id: String(m.id), name: String(m.name ?? m.id) }));
      setFamilyMembers(mapped);
    })();
    return () => {
      alive = false;
    };
  }, [me?.mode]);

  const logForOptions = useMemo<LogForOption[]>(() => {
    if (!me) return [{ id: "u_self", name: "Me" }];
    if (String(me.mode) === "family" || activeSegment === "family") {
      return familyMembers.length ? familyMembers : [{ id: "u_self", name: "Me" }];
    }
    return [{ id: "u_self", name: "Me" }];
  }, [me, activeSegment, familyMembers]);

  const [logForUserId, setLogForUserId] = useState<string>("u_self");

  useEffect(() => {
    const exists = logForOptions.some((x) => x.id === logForUserId);
    if (!exists) setLogForUserId(logForOptions[0]?.id || "u_self");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logForOptions]);

  const normalized = useMemo(() => normalize(raw), [raw]);
  const labelForUi = useMemo(
    () => deriveLabelFromScore(normalized.score, normalized.label),
    [normalized.score, normalized.label]
  );

  const analyze = useCallback(async () => {
    if (!photoUri) return;

    try {
      setBusy(true);
      setErrorText(null);

      const ctx = await getAppContext();
      const actor = localIdToBackendActorId(String((ctx as any)?.currentUserId || "head"));

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
        { method: "POST", body: form, headers: { "x-user-id": actor } }
      );

      const text = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }

      if (!resp.ok) {
        setErrorText(typeof json === "string" ? json : json?.message || "Scan failed");
        return;
      }

      setRaw(json);
    } catch (e: any) {
      setErrorText(e?.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  }, [api, photoUri, logForUserId]);

  useEffect(() => {
    analyze();
  }, [analyze]);

  const logMeal = useCallback(async () => {
    try {
      if (!normalized?.scanId) {
        Alert.alert("Missing scan", "Try scanning again.");
        return;
      }

      const ctx = await getAppContext();
      const actor = localIdToBackendActorId(String((ctx as any)?.currentUserId || "head"));

      const whyArr =
        normalized.why && String(normalized.why).trim()
          ? String(normalized.why)
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const resp = await fetch(`${api}/v1/logs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-id": actor },
        body: JSON.stringify({
          scanId: normalized.scanId,
          mealType,
          userId: logForUserId,
          source: "scan",
          dishName: normalized.dishName,
          score: normalized.score,
          label: labelForUi,
          confidence: normalized.confidencePct,
          why: whyArr,
          tips: normalized.tips || [],
          nutrition: normalized.nutrition || null,
          estimatedNutrition: normalized.nutrition || null,
          photoUri: photoUri || "",
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        Alert.alert("Log failed", json?.message || json?.error || "Couldn’t log this meal.");
        return;
      }

      router.replace("/(tabs)/recent");
    } catch (e: any) {
      Alert.alert("Log failed", e?.message ?? "Couldn’t log this meal.");
    }
  }, [api, normalized, mealType, logForUserId, router, photoUri, labelForUi]);

  const modeDebug = meLoading ? "loading…" : meError ? "error" : String(me?.mode || activeSegment);

  return (
    <Screen scroll style={{ backgroundColor: Theme.colors.bg }}>
      <Stack.Screen options={{ ...headerStyles.base, title: "Scan Result" }} />

      <Text style={styles.title}>Log as</Text>
      <View style={styles.row}>
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setMealType(t)}
            style={[styles.pill, mealType === t && styles.pillActive]}
          >
            <Text style={[styles.pillText, mealType === t && styles.pillTextActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.title, { marginTop: S.lg }]}>Log for</Text>
      <View style={styles.row}>
        {logForOptions.map((u) => (
          <Pressable
            key={u.id}
            onPress={() => setLogForUserId(u.id)}
            style={[styles.pill, logForUserId === u.id && styles.pillActive]}
          >
            <Text style={[styles.pillText, logForUserId === u.id && styles.pillTextActive]}>
              {u.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.debug}>
        /v1/me: mode={modeDebug}
        {meError ? (
          <>
            {" "}
            •{" "}
            <Text onPress={refreshMe} style={{ textDecorationLine: "underline" }}>
              retry
            </Text>
          </>
        ) : null}
      </Text>

      {photoUri ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: String(photoUri) }} style={styles.photo} />
        </View>
      ) : null}

      {busy ? (
        <View style={styles.centerRow}>
          <ActivityIndicator />
          <Text style={styles.muted}>Analyzing…</Text>
        </View>
      ) : errorText ? (
        <Text style={styles.err}>{String(errorText)}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h2}>{normalized.dishName}</Text>

          <Text style={styles.metaLine}>
            Confidence: {normalized.confidencePct}% • {labelForUi} • {normalized.score}/100
          </Text>

          {!!String(normalized.why || "").trim() ? (
            <Text style={styles.body}>{normalized.why}</Text>
          ) : (
            <Text style={styles.muted}>—</Text>
          )}

          {normalized.tips?.length ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.h3}>Tips</Text>
              {normalized.tips.map((t, i) => (
                <Text key={`${i}-${t}`} style={styles.bullet}>
                  • {t}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={styles.h3}>Estimated nutrition</Text>
            {normalized.nutrition ? (
              <View style={{ gap: 6 }}>
                <Row k="Calories" v={formatMaybe(normalized.nutrition.calories, "kcal")} />
                <Row k="Protein" v={formatMaybe(normalized.nutrition.protein_g, "g")} />
                <Row k="Carbs" v={formatMaybe(normalized.nutrition.carbs_g, "g")} />
                <Row k="Fat" v={formatMaybe(normalized.nutrition.fat_g, "g")} />
                <Row k="Fiber" v={formatMaybe(normalized.nutrition.fiber_g, "g")} />
                <Row k="Sugar" v={formatMaybe(normalized.nutrition.sugar_g, "g")} />
                <Row k="Sodium" v={formatMaybe(normalized.nutrition.sodium_mg, "mg")} />
              </View>
            ) : (
              <Text style={styles.muted}>—</Text>
            )}
          </View>
        </View>
      )}

      <Pressable style={styles.primaryBtn} onPress={logMeal} disabled={busy || !!errorText}>
        <Text style={styles.primaryBtnText}>Log this meal</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, busy && { opacity: 0.6 }]}
        onPress={() => router.replace("/(tabs)/scan")}
        disabled={busy}
      >
        <Text style={styles.secondaryBtnText}>Scan another</Text>
      </Pressable>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Theme.font.h1, fontWeight: "900", color: Theme.colors.textPrimary },

  row: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },

  pill: {
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.chipBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.pill,
  },
  pillActive: { backgroundColor: Theme.colors.tealSoft, borderColor: Theme.colors.tealBorder },
  pillText: { fontWeight: "900", color: Theme.colors.textPrimary },
  pillTextActive: { color: Theme.colors.textPrimary },

  debug: { marginTop: 4, color: Theme.colors.textMuted, fontWeight: "700" },

  photoWrap: {
    borderRadius: Theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    backgroundColor: "#000",
  },
  photo: { width: "100%", aspectRatio: 4 / 3, resizeMode: "cover" },

  centerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  muted: { color: Theme.colors.textMuted, fontWeight: "700" },
  err: { color: "#B42318", fontWeight: "900" },

  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    gap: S.md,
  },

  h2: { fontSize: Theme.font.h2, fontWeight: "900", color: Theme.colors.textPrimary },
  h3: { fontSize: Theme.font.h2, fontWeight: "900", color: Theme.colors.textPrimary },
  body: { color: Theme.colors.textPrimary, fontWeight: "700", lineHeight: 19 },
  bullet: { color: Theme.colors.textPrimary, fontWeight: "700", lineHeight: 19 },

  metaLine: { color: Theme.colors.textMuted, fontWeight: "800" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowKey: { color: Theme.colors.textMuted, fontWeight: "800" },
  rowVal: { color: Theme.colors.textPrimary, fontWeight: "900" },

  primaryBtn: {
    backgroundColor: Theme.colors.teal,
    paddingVertical: 16,
    borderRadius: Theme.radius.lg,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  secondaryBtn: {
    backgroundColor: Theme.colors.card,
    paddingVertical: 16,
    borderRadius: Theme.radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.divider,
  },
  secondaryBtnText: { color: Theme.colors.textPrimary, fontWeight: "900", fontSize: 16 },
});
