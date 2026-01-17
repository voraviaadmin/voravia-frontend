import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { fetchMe, getApiBaseUrl, MeResponse } from "../lib/me";

type DaySummary = {
  dailyScore?: number;
  nextWin?: string[];
};

type LogItem = {
  id: string;
  day?: string; // YYYY-MM-DD
  createdAt?: string;
  userId?: string;
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

function ScoreRing({ score, size = 160, stroke = 14 }: { score: number; size?: number; stroke?: number }) {
  const clamped = clampScore(score);

  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#DDEBEE"
          strokeWidth={stroke}
          fill="transparent"
        />
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
        <Text style={styles.scoreLabel}>Daily Score</Text>
      </View>
    </View>
  );
}


function formatTotals(t: any) {
  if (!t) return "";
  const parts: string[] = [];
  if (Number.isFinite(t.proteinG)) parts.push(`Protein ${t.proteinG}g`);
  if (Number.isFinite(t.fiberG)) parts.push(`Fiber ${t.fiberG}g`);
  if (Number.isFinite(t.sugarG)) parts.push(`Sugar ${t.sugarG}g`);
  if (Number.isFinite(t.sodiumMg)) parts.push(`Sodium ${t.sodiumMg}mg`);
  return parts.join(" • ");
}


function band(label: "low" | "good" | "high") {
  // keep subtle (matches your UI)
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




export default function HomeScreen() {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [focusText, setFocusText] = useState<string>("Scan a meal to start");
  

  const [nextWinItems, setNextWinItems] = useState<Array<{ name: string; why?: string }>>([]);

  
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const [homeRecos, setHomeRecos] = useState<HomeRecos | null>(null);

  

  const status = useMemo(() => {
    if (score >= 85) return { text: "Excellent", hint: "Keep the streak going." };
    if (score >= 70) return { text: "Great", hint: "You’re on track today." };
    if (score >= 50) return { text: "Good", hint: "A couple smart choices will help." };
    return { text: "Needs Focus", hint: "Start with one healthy scan." };
  }, [score]);

  const load = useCallback(async () => {
    const api = getApiBaseUrl();
    setErrorHint(null);

    let recoFocus: string | null = null;
    let recoSuggestionsText: string | null = null;
    let gotHomeRecosSuggestions = false;


    // 0) Load /v1/me first (decides which userId we use for Home)
    let meJson: MeResponse;
    try {
      meJson = await fetchMe();
      setMe(meJson);
    } catch (e: any) {
      setMe(null);
      setErrorHint(e?.message ?? "Could not load /v1/me");
      return;
    }

    const userId = meJson.userId || "u_self";

// 1.5) Personalized Home recommendations (profile-aware)
try {
  const r = await fetch(
    `${api}/v1/home-recommendations?memberId=${encodeURIComponent(userId)}`,
    { method: "GET" }
  );
  const j = await r.json().catch(() => null);

  if (r.ok && j) {
    setHomeRecos(j);
  
    if (j?.nextMeal?.focus) {
      recoFocus = String(j.nextMeal.focus);
      setFocusText(recoFocus);
    }
  
    if (Array.isArray(j?.suggestions) && j.suggestions.length) {
      gotHomeRecosSuggestions = true;
      recoSuggestionsText = j.suggestions
        .slice(0, 3)
        .map((s: any) => String(s?.name || "").trim())
        .filter(Boolean)
        .join(" • ");
  
        if (Array.isArray(j?.suggestions)) {
          setNextWinItems(
            j.suggestions
              .slice(0, 3)
              .map((s: any) => ({ name: String(s?.name || "").trim(), why: s?.why ? String(s.why) : undefined }))
              .filter((s: any) => s.name)
          );
        }
        
    }
  }
} catch {
  // non-fatal: keep current fallback behavior
}



    // 1) Day summary -> score + nextWin
    try {
      const resp = await fetch(`${api}/v1/day-summary?userId=${encodeURIComponent(userId)}`, { method: "GET" });
      const json = (await resp.json().catch(() => ({}))) as DaySummary;

      if (resp.ok) {
        const dailyScore = clampScore(Number(json.dailyScore ?? 0));
        setScore(dailyScore);

        const nw =
          Array.isArray(json.nextWin) && json.nextWin.length ? String(json.nextWin[0]) : "";
        
        
          if (!gotHomeRecosSuggestions && nw) {
            setNextWinItems([{ name: nw }]);
          }
          
          
          

          // Only use score-based focus if we did NOT get personalized focus
          if (!recoFocus) {
            if (dailyScore < 50) setFocusText("Add protein • Add fiber • Lower added sugar");
            else if (dailyScore < 70) setFocusText("Add fiber • Keep sodium moderate");
            else setFocusText("Stay balanced • Keep portions consistent");
          }

      } else {
        setErrorHint("Home is showing defaults (day-summary not reachable).");
      }
    } catch {
      setErrorHint("Home is showing defaults (backend not reachable).");
    }

    // 2) Compute streak from logs days (any day with ≥1 log counts)
    try {
      const resp = await fetch(`${api}/v1/logs?userId=${encodeURIComponent(userId)}`, { method: "GET" });
      const json = await resp.json().catch(() => ({}));
      const items: LogItem[] = Array.isArray(json?.items) ? json.items : [];

      const daySet = new Set<string>();
      for (const it of items) {
        if (it.day) daySet.add(String(it.day));
        else if (it.createdAt) daySet.add(isoDay(new Date(it.createdAt)));
      }

      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 60; i++) {
        const d = subtractDays(today, i);
        const key = isoDay(d);
        if (daySet.has(key)) streak += 1;
        else break;
      }
      setStreakDays(streak);
    } catch {
      // keep streak as-is
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
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
          {!!me && (
            <Text style={styles.meHint}>
              Mode: {me.activeProfile === "family" ? "Family" : "Individual"}
            </Text>
          )}
        </View>

        <View style={styles.streakPill}>
          <Text style={styles.streakIcon}>🔥</Text>
          <Text style={styles.streakText}>{streakDays || 0} day streak</Text>
        </View>
      </View>

      <View style={styles.card}>
        <ScoreRing score={score} />

        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>{status.text}</Text>
          <Text style={styles.statusHint}>{status.hint}</Text>
          {!!errorHint && <Text style={[styles.statusHint, { marginTop: 6 }]}>{errorHint}</Text>}
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Text style={styles.primaryBtnText}>Scan Food</Text>
            <Text style={styles.primaryBtnSub}>Camera / Barcode</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/restaurants",
                params: { autostart: "1" },
              })
            }
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
          <View
            style={[
              {
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
              },
              band(level),
            ]}
          >
            <Text style={[styles.quickText, { opacity: 0.9 }]}>{text}</Text>
          </View>
        );

        return (
          <>
            {Number.isFinite(nutritionTotals.proteinG ?? NaN) && (
              <Chip text={`Protein ${nutritionTotals.proteinG}g`} level={c.protein} />
            )}
            {Number.isFinite(nutritionTotals.fiberG ?? NaN) && (
              <Chip text={`Fiber ${nutritionTotals.fiberG}g`} level={c.fiber} />
            )}
            {Number.isFinite(nutritionTotals.sugarG ?? NaN) && (
              <Chip text={`Sugar ${nutritionTotals.sugarG}g`} level={c.sugar} />
            )}
            {Number.isFinite(nutritionTotals.sodiumMg ?? NaN) && (
              <Chip text={`Sodium ${nutritionTotals.sodiumMg}mg`} level={c.sodium} />
            )}
          </>
        );
      })()}
    </View>
  </View>
) : null}



        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Next Win</Text>

          {nextWinItems.length ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              {nextWinItems.map((it, idx) => (
                <Text key={idx} style={styles.quickText}>
                  • {it.name}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.quickText}>
              Scan one more meal to improve your day
            </Text>
          )}


        </View>
      </View>

      <Text style={styles.footerNote}>Tip: This Home score is computed from today’s logged meals.</Text>
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

  ringInner: {
    position: "absolute",
    left: 14,
    top: 14,
    backgroundColor: "#F7FCFD",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4EFF1",
  },
  scoreValue: { fontSize: 44, fontWeight: "900", color: "#0B2A2F" },
  scoreLabel: { marginTop: 2, fontSize: 12, color: "#4A6468", fontWeight: "600" },

  statusBlock: { alignItems: "center", marginBottom: 14, marginTop: 10 },
  statusTitle: { fontSize: 16, fontWeight: "800", color: "#0B2A2F" },
  statusHint: { marginTop: 6, fontSize: 13, color: "#4A6468", textAlign: "center" },

  ctaRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#0E7C86", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  primaryBtnSub: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },

  secondaryBtn: { flex: 1, backgroundColor: "#F1FBFC", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: "#CFE8EA" },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "800", fontSize: 14 },
  secondaryBtnSub: { marginTop: 4, color: "#4A6468", fontSize: 12, fontWeight: "600" },

  pressed: { opacity: 0.88 },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  quickCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E4EFF1", padding: 12 },
  quickTitle: { fontSize: 12, fontWeight: "800", color: "#0B2A2F" },
  quickText: { marginTop: 6, fontSize: 12, color: "#4A6468", fontWeight: "600", lineHeight: 16 },

  footerNote: { marginTop: 12, fontSize: 12, color: "#6B8387", textAlign: "center" },
});
