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

export default function HomeScreen() {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [score, setScore] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [focusText, setFocusText] = useState<string>("Scan a meal to start");
  const [nextWinText, setNextWinText] = useState<string>("1 healthy scan to keep streak");
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const status = useMemo(() => {
    if (score >= 85) return { text: "Excellent", hint: "Keep the streak going." };
    if (score >= 70) return { text: "Great", hint: "You’re on track today." };
    if (score >= 50) return { text: "Good", hint: "A couple smart choices will help." };
    return { text: "Needs Focus", hint: "Start with one healthy scan." };
  }, [score]);

  const load = useCallback(async () => {
    const api = getApiBaseUrl();
    setErrorHint(null);

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

    // 1) Day summary -> score + nextWin
    try {
      const resp = await fetch(`${api}/v1/day-summary?userId=${encodeURIComponent(userId)}`, { method: "GET" });
      const json = (await resp.json().catch(() => ({}))) as DaySummary;

      if (resp.ok) {
        const dailyScore = clampScore(Number(json.dailyScore ?? 0));
        setScore(dailyScore);

        const nw =
          Array.isArray(json.nextWin) && json.nextWin.length ? String(json.nextWin[0]) : "";
        setNextWinText(nw || "Scan one more meal to improve your day");

        // Simple focus text based on score (Phase 1)
        if (dailyScore < 50) setFocusText("Add protein • Add fiber • Lower added sugar");
        else if (dailyScore < 70) setFocusText("Add fiber • Keep sodium moderate");
        else setFocusText("Stay balanced • Keep portions consistent");
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
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Next Win</Text>
          <Text style={styles.quickText}>{nextWinText}</Text>
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
