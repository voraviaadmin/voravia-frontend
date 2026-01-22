import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { fetchMe, MeResponse } from "../../lib/me";
import { API_BASE } from "../../lib/api";
import { getAppContext } from "@/src/storage/appContext";
import type { ContextScope } from "@/src/context/contextRules";



// Backwards-compatible helper (older screens still call this)
export function getApiBaseUrl() {
  return API_BASE;
}




type DaySummary = {
  dailyScore?: number;
  nextWin?: string[];
};

type LogItem = {
  id: string;
  day?: string; // YYYY-MM-DD
  createdAt?: string;
  userId?: string;

  dishName?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  score?: number; // per-meal score (0-100). If missing, avg ring will gracefully fallback.
};

type NutritionTotals = {
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  hasAny?: boolean;
};

type HomeRecos = {
  todaySummary?: { nutritionTotals?: NutritionTotals | null };
  nextMeal?: { focus?: string; reason?: string };
  suggestions?: Array<{ name: string; why?: string }>;
  thresholds?: any;
};

function isoDay(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function subtractDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

function clampScore(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/** Avg daily score from logs (last N days, only days with scored meals) */
function computeAvgScoreFromLogs(items: LogItem[], days = 14): number | null {
  const today = new Date();
  const start = subtractDays(today, days - 1);

  const dayToScores = new Map<string, number[]>();

  for (const it of items) {
    const createdAt = it.createdAt ? new Date(it.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    if (createdAt < start) continue;

    const s = Number(it.score);
    if (!Number.isFinite(s)) continue;

    const key = it.day ? String(it.day) : isoDay(createdAt);
    const arr = dayToScores.get(key) || [];
    arr.push(s);
    dayToScores.set(key, arr);
  }

  const perDay: number[] = [];
  for (const arr of dayToScores.values()) {
    if (!arr.length) continue;
    const sum = arr.reduce((a, b) => a + b, 0);
    perDay.push(sum / arr.length);
  }

  if (!perDay.length) return null;

  const avg = perDay.reduce((a, b) => a + b, 0) / perDay.length;
  return clampScore(avg);
}

function ScoreRing({
  score,
  label,
  size = 150,
  stroke = 12,
}: {
  score: number;
  label: string;
  size?: number;
  stroke?: number;
}) {
  const clamped = clampScore(score);

  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke="#DDEBEE" strokeWidth={stroke} fill="transparent" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#0E7C86"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation={-90}
          originX={cx}
          originY={cy}
        />
      </Svg>

      <View style={[styles.ringInner, { width: size - stroke * 2, height: size - stroke * 2, borderRadius: 999 }]}>
        <Text style={styles.scoreValue}>{clamped}</Text>
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
    </View>
  );
}

function band(label: "low" | "good" | "high") {
  if (label === "low") return { backgroundColor: "rgba(255, 193, 7, 0.18)", borderColor: "rgba(255, 193, 7, 0.45)" };
  if (label === "high") return { backgroundColor: "rgba(255, 59, 48, 0.14)", borderColor: "rgba(255, 59, 48, 0.35)" };
  return { backgroundColor: "rgba(52, 199, 89, 0.14)", borderColor: "rgba(52, 199, 89, 0.30)" };
}

function classifyTotals(t: NutritionTotals, th: any) {
  const protein = Number(t.proteinG ?? NaN);
  const fiber = Number(t.fiberG ?? NaN);
  const sugar = Number(t.sugarG ?? NaN);
  const sodium = Number(t.sodiumMg ?? NaN);

  return {
    protein: !Number.isFinite(protein) ? "good" : protein < th.proteinMin ? "low" : "good",
    fiber: !Number.isFinite(fiber) ? "good" : fiber < th.fiberMin ? "low" : "good",
    sugar: !Number.isFinite(sugar) ? "good" : sugar > th.sugarMax ? "high" : "good",
    sodium: !Number.isFinite(sodium) ? "good" : sodium > th.sodiumMax ? "high" : "good",
  } as const;
}

/** Time-aware suggestions fallback (frontend-only) */
function getMealWindow(
  now = new Date()
): { key: "breakfast" | "lunch" | "dinner" | "snack"; title: string; mode?: "late_night" } {
  const h = now.getHours();

  if (h >= 5 && h <= 10) return { key: "breakfast", title: "Breakfast ideas" };
  if (h >= 11 && h <= 14) return { key: "lunch", title: "Lunch ideas" };
  if (h >= 17 && h <= 21) return { key: "dinner", title: "Dinner ideas" };

  // Late-night: 10pm–2:59am
  if (h >= 22 || h <= 2) return { key: "dinner", title: "Late-night ideas", mode: "late_night" };

  return { key: "snack", title: "Snack ideas" };
}

function inferMealTypeFromCreatedAt(createdAt?: string): "breakfast" | "lunch" | "dinner" | "snack" | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  if (h >= 5 && h <= 10) return "breakfast";
  if (h >= 11 && h <= 14) return "lunch";
  if (h >= 17 && h <= 21) return "dinner";
  if (h >= 22 || h <= 2) return "dinner";
  return "snack";
}

function normalizeName(s?: string) {
  const x = String(s || "").trim();
  if (!x) return "";
  return x.replace(/\s+/g, " ");
}

function scoreDishForLateNight(nameRaw: string) {
  const name = nameRaw.toLowerCase();

  const proteinBoost = [
    "chicken",
    "turkey",
    "salmon",
    "tuna",
    "fish",
    "shrimp",
    "egg",
    "omelet",
    "yogurt",
    "cottage",
    "tofu",
    "edamame",
    "lentil",
    "beans",
    "protein",
    "shake",
  ];
  const sodiumPenalty = [
    "ramen",
    "pho",
    "noodle",
    "soy",
    "teriyaki",
    "pizza",
    "pepperoni",
    "burger",
    "fries",
    "taco",
    "burrito",
    "fried",
    "wings",
    "chips",
    "nachos",
    "sausage",
    "bacon",
  ];

  let score = 0;
  for (const k of proteinBoost) if (name.includes(k)) score += 3;
  for (const k of sodiumPenalty) if (name.includes(k)) score -= 3;

  if (name.includes("salad")) score += 1;
  if (name.includes("grilled")) score += 1;
  if (name.includes("bowl")) score += 1;

  return score;
}

function whyLateNight(nameRaw: string) {
  const name = nameRaw.toLowerCase();
  const proteinHints = ["chicken", "turkey", "fish", "salmon", "egg", "yogurt", "cottage", "tofu", "lentil", "beans", "protein", "shake"];
  const saltyHints = ["ramen", "pizza", "burger", "fries", "taco", "fried", "wings", "nachos", "soy", "teriyaki", "bacon", "sausage"];

  const isProtein = proteinHints.some((k) => name.includes(k));
  const isSalty = saltyHints.some((k) => name.includes(k));

  if (isProtein && !isSalty) return "Protein-forward and lighter late-night pick.";
  if (isProtein && isSalty) return "Protein-forward—keep portions moderate late-night.";
  if (!isProtein && !isSalty) return "Lighter late-night option.";
  return "Consider a lighter version (less sauce/salt) late-night.";
}

function buildTimeAwareSuggestions(
  logs: LogItem[],
  windowKey: "breakfast" | "lunch" | "dinner" | "snack",
  mode?: "late_night"
): Array<{ name: string; why?: string }> {
  const now = Date.now();
  const days30 = 30 * 24 * 60 * 60 * 1000;

  const recent = logs
    .filter((it) => {
      if (!it.createdAt) return false;
      const t = new Date(it.createdAt).getTime();
      return Number.isFinite(t) && now - t <= days30;
    })
    .map((it) => ({
      ...it,
      mealType: it.mealType || inferMealTypeFromCreatedAt(it.createdAt) || undefined,
      dishName: it.dishName ? normalizeName(it.dishName) : undefined,
    }));

  const sameWindow = recent.filter((it) => it.mealType === windowKey);

  const pickFrom = (arr: LogItem[]) => {
    const counts = new Map<string, number>();
    const bestScore = new Map<string, number>();

    for (const it of arr) {
      const name = normalizeName((it as any).dishName);
      if (!name) continue;

      counts.set(name, (counts.get(name) || 0) + 1);

      if (mode === "late_night") {
        const s = scoreDishForLateNight(name);
        const prev = bestScore.get(name);
        if (prev === undefined || s > prev) bestScore.set(name, s);
      }
    }

    const ranked = Array.from(counts.entries())
      .map(([name, c]) => ({
        name,
        c,
        score: mode === "late_night" ? (bestScore.get(name) || 0) : 0,
      }))
      .sort((a, b) => (b.score - a.score) || (b.c - a.c));

    return ranked.slice(0, 3).map((x) => ({
      name: x.name,
      why: mode === "late_night" ? whyLateNight(x.name) : x.c >= 2 ? `You’ve picked this ${x.c} times recently.` : "A recent pick for you.",
    }));
  };

  let out = pickFrom(sameWindow);
  if (!out.length) out = pickFrom(recent);

  if (!out.length) {
    if (mode === "late_night") {
      return [
        { name: "Greek yogurt + berries", why: "Protein-forward and easy late-night." },
        { name: "Eggs + veggies", why: "High protein, lower sodium if lightly seasoned." },
        { name: "Chicken or salmon bowl (light sauce)", why: "Lean protein—ask for sauce on the side." },
      ];
    }
    return [{ name: "Scan one more meal", why: "We’ll personalize this as you log more." }];
  }

  return out;
}

export default function HomeScreen() {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);

  const [scoreToday, setScoreToday] = useState<number>(0);
  const [scoreAvg14d, setScoreAvg14d] = useState<number>(0);
  const [hasAvg, setHasAvg] = useState<boolean>(false);

  // Mock B toggle: 1D / 14D (top-right)
  const [ringMode, setRingMode] = useState<"1d" | "14d">("1d");

  const [streakDays, setStreakDays] = useState<number>(0);
  const [focusText, setFocusText] = useState<string>("Scan a meal to start");

  const [nextWinItems, setNextWinItems] = useState<Array<{ name: string; why?: string }>>([]);
  const [nextWinTitle, setNextWinTitle] = useState<string>("");

  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [homeRecos, setHomeRecos] = useState<HomeRecos | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [recoFocus, setRecoFocus] = useState<boolean>(false);

  const status = useMemo(() => {
    if (scoreToday >= 85) return { text: "Excellent", hint: "Keep the streak going." };
    if (scoreToday >= 70) return { text: "Great", hint: "You’re on track today." };
    if (scoreToday >= 50) return { text: "Good", hint: "A couple smart choices will help." };
    return { text: "Needs Focus", hint: "Start with one healthy scan." };
  }, [scoreToday]);

  const ringScore = ringMode === "1d" ? scoreToday : scoreAvg14d;
  const ringLabel = ringMode === "1d" ? "Daily Score" : "Avg Score";
  const ringSub = ringMode === "1d" ? "Resets nightly" : "Last 14 days";

  
  const load = useCallback(async () => {
    setLoading(true);
  
    let gotRecoFocus = false; // local truth for this run
  
    const api = API_BASE;
  
    try {
      const ctx = await getAppContext();
      setSegment(ctx.segment);
  
      const meJson = await fetchMe();
      const memberId =
        meJson?.mode === "family"
          ? String(meJson?.family?.activeMemberId || meJson?.userId || "u_self")
          : String(meJson?.userId || "u_self");
  
      setMe(meJson);
  
      // 1) /v1/home-recommendations (optional, non-fatal)
      try {
        const reco = await fetch(
          `${api}/v1/home-recommendations?memberId=${encodeURIComponent(memberId)}`,
          { method: "GET" }
        );
        const recoJson = (await reco.json().catch(() => ({}))) as any;
  
        if (reco.ok) {
          setHomeRecos(recoJson);
          gotRecoFocus = true;           // ✅ set local flag
          setRecoFocus(true);            // keep state for UI if you need it
  
          const nextMeal = String(recoJson?.nextMeal?.focus || "");
          const nextReason = String(recoJson?.nextMeal?.reason || "");
  
          if (nextMeal) setNextWinTitle(nextMeal);
          if (nextReason) setFocusText(nextReason);
  
          const suggestions = Array.isArray(recoJson?.suggestions) ? recoJson.suggestions : [];
          const base = suggestions
            .map((s: any) => String(s?.name || "").trim())
            .filter(Boolean)
            .slice(0, 3);
          if (base.length) setNextWinItems(base);
        }
      } catch {
        // non-fatal
      }
  
      // 2) /v1/day-summary
      const resp = await fetch(
        `${api}/v1/day-summary?userId=${encodeURIComponent(memberId)}&windowDays=14`,
        { method: "GET" }
      );
      const json = (await resp.json().catch(() => ({}))) as any;
  
      if (resp.ok) {
        const daily = clampScore(Number(json.dailyScore ?? 0));
        const avg14 = clampScore(Number(json.avgScore ?? 0));
  
        setScoreToday(daily);
        setScoreAvg14d(avg14);
  
        // ✅ branch on local flag, not state
        if (!gotRecoFocus) {
          if (daily < 50) setFocusText("Try a higher-protein, higher-fiber option next.");
          else if (daily < 70) setFocusText("A small upgrade next meal will boost your score.");
          else setFocusText("Keep it up—aim for consistency.");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);
  
  




  const [segment, setSegment] = useState<ContextScope>("individual");
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const ctx = await getAppContext();
        setSegment((ctx.segment || "individual") as ContextScope);
      })();
  
      load();
    }, [load])
  );
  

  const nutritionTotals = homeRecos?.todaySummary?.nutritionTotals ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Voravia</Text>
          <Text style={styles.subtitle}>Home dashboard (MVP)</Text>
          <Text style={styles.meHint}>
              Mode: {segment === "family" ? "Family" : "Individual"}
          </Text>

        </View>

        <View style={styles.streakPill}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakText}>{streakDays || 0} day streak</Text>
        </View>
      </View>

      <View style={styles.card}>
        {/* Mock B: tiny top-right 1D / 14D toggle */}
        <View style={styles.topToggle}>
          <Pressable onPress={() => setRingMode("1d")}>
            <Text style={[styles.toggleText, ringMode === "1d" && styles.toggleActive]}>1d</Text>
          </Pressable>
          <Pressable onPress={() => setRingMode("14d")}>
            <Text style={[styles.toggleText, ringMode === "14d" && styles.toggleActive]}>14d</Text>
          </Pressable>
        </View>

        {/* Ring (keep tappable too, optional nice UX) */}
        <Pressable
          onPress={() => setRingMode((m) => (m === "1d" ? "14d" : "1d"))}
          style={{ alignItems: "center" }}
        >
          <ScoreRing score={ringScore} label={ringLabel} size={170} stroke={12} />
          <Text style={styles.ringSub}>{ringSub}</Text>
        </Pressable>

        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>{status.text}</Text>
          <Text style={styles.statusHint}>{status.hint}</Text>
          {!!errorHint && <Text style={[styles.statusHint, { marginTop: 6 }]}>{errorHint}</Text>}
        </View>

        <View style={styles.ctaRow}>
          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => router.push("/(tabs)/scan")}>
            <Text style={styles.primaryBtnText}>Scan Food</Text>
            <Text style={styles.primaryBtnSub}>Camera / Barcode</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: "/(tabs)/restaurants", params: { autostart: "1" } })}
          >
            <Text style={styles.secondaryBtnText}>Find Restaurant</Text>
            <Text style={styles.secondaryBtnSub}>Nearby + menus</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.quickRow}>
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Today’s Focus</Text>
          <Text style={styles.quickText}>{focusText}</Text>

          {nutritionTotals ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.quickText, { opacity: 0.75, marginBottom: 6 }]}>So far today</Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(() => {
                  const th =
                    (homeRecos as any)?.thresholds ?? {
                      proteinMin: 60,
                      fiberMin: 20,
                      sugarMax: 45,
                      sodiumMax: 1800,
                    };

                  const c = classifyTotals(nutritionTotals, th);

                  const Chip = ({ text, level }: { text: string; level: "low" | "good" | "high" }) => (
                    <View style={[{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 }, band(level)]}>
                      <Text style={[styles.quickText, { opacity: 0.9 }]}>{text}</Text>
                    </View>
                  );

                  return (
                    <>
                      {Number.isFinite(nutritionTotals.proteinG ?? NaN) && <Chip text={`Protein ${nutritionTotals.proteinG}g`} level={c.protein} />}
                      {Number.isFinite(nutritionTotals.fiberG ?? NaN) && <Chip text={`Fiber ${nutritionTotals.fiberG}g`} level={c.fiber} />}
                      {Number.isFinite(nutritionTotals.sugarG ?? NaN) && <Chip text={`Sugar ${nutritionTotals.sugarG}g`} level={c.sugar} />}
                      {Number.isFinite(nutritionTotals.sodiumMg ?? NaN) && <Chip text={`Sodium ${nutritionTotals.sodiumMg}mg`} level={c.sodium} />}
                    </>
                  );
                })()}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>{nextWinTitle || "Next Win"}</Text>

          {nextWinItems.length ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              {nextWinItems.map((it, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => router.push({ pathname: "/(tabs)/restaurants", params: { q: it.name } })}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={styles.quickText}>• {it.name}</Text>
                  {!!it.why && <Text style={[styles.quickText, { opacity: 0.75, marginTop: 2 }]}>{it.why}</Text>}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.quickText}>Scan one more meal to improve your day</Text>
          )}
        </View>
      </View>

      <Text style={styles.footerNote}>Tip: This score is computed from logged meals.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAFB",
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brand: { fontSize: 28, fontWeight: "800", color: "#0B2A2F", letterSpacing: 0.2 },
  subtitle: { marginTop: 4, fontSize: 13, color: "#4A6468" },
  meHint: { marginTop: 6, fontSize: 12, color: "#6B8387", fontWeight: "700" },

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
    marginTop: 50
  },
  streakIcon: { fontSize: 14 },
  streakText: { fontSize: 12, fontWeight: "700", color: "#0B2A2F" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4EFF1",
    padding: 16,
  },

  // Mock B toggle
  topToggle: {
    position: "absolute",
    top: 12,
    right: 14,
    flexDirection: "row",
    gap: 14,
    zIndex: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(0,0,0,0.45)",
    paddingBottom: 2,
  },
  toggleActive: {
    color: "#0E7C86",
    borderBottomWidth: 2,
    borderBottomColor: "#0E7C86",
  },

  ringInner: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "#F7FCFD",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4EFF1",
  },
  scoreValue: { fontSize: 42, fontWeight: "900", color: "#0B2A2F" },
  scoreLabel: { marginTop: 2, fontSize: 12, color: "#4A6468", fontWeight: "700" },
  ringSub: { marginTop: 8, fontSize: 12, color: "#6B8387", fontWeight: "700", textAlign: "center" },

  statusBlock: { alignItems: "center", marginBottom: 14, marginTop: 10 },
  statusTitle: { fontSize: 16, fontWeight: "800", color: "#0B2A2F" },
  statusHint: { marginTop: 6, fontSize: 13, color: "#4A6468", textAlign: "center" },

  ctaRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#0E7C86", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  primaryBtnSub: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#F1FBFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CFE8EA",
  },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "800", fontSize: 14 },
  secondaryBtnSub: { marginTop: 4, color: "#4A6468", fontSize: 12, fontWeight: "600" },

  pressed: { opacity: 0.88 },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  quickCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E4EFF1", padding: 12 },
  quickTitle: { fontSize: 12, fontWeight: "800", color: "#0B2A2F" },
  quickText: { marginTop: 6, fontSize: 12, color: "#4A6468", fontWeight: "600", lineHeight: 16 },

  footerNote: { marginTop: 12, fontSize: 12, color: "#6B8387", textAlign: "center" },
});
