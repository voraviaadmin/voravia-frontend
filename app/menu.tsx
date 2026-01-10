import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Goal = "Lose" | "Maintain" | "Gain";

type Profile = {
  diabetes: boolean;
  htn: boolean;
  nafld: boolean;
  goal: Goal;
};

type MenuItem = { name: string; description?: string | null; price?: string | null };
type MenuSection = { name: string; items: MenuItem[] };

type ExtractUploadResponse = {
  source: "upload";
  uploadKey: string;
  sections: MenuSection[];
};

type Verdict = "FIT" | "MODERATE" | "AVOID";

type RatedItem = {
  input: string;
  name: string;
  verdict: Verdict;
  score: number; // 0-100
  reasons: string[];
  nutrition?: {
    calories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    satFatG?: number;
    confidence?: number;
    assumptions?: string;
  };
};

type RateResponse = {
  uploadKey?: string;
  count: number;
  ratedItems: RatedItem[];
  cached?: boolean;
};

const STORAGE_PROFILE_KEY = "voravia.profile.v1";
const STORAGE_CACHE_PREFIX = "voravia.menu.cache.v1:"; // + uploadKey + ":" + profileHash

function getApiBase() {
  const env = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  if (env) return env.replace(/\/$/, "");

  // Web fallback: same host, but backend port 8787 (keep protocol)
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8787`;
  }

  return "http://localhost:8787";
}

function stableProfile(p: Profile) {
  return {
    diabetes: !!p.diabetes,
    htn: !!p.htn,
    nafld: !!p.nafld,
    goal: p.goal,
  };
}

function hashProfile(p: Profile) {
  return `${p.diabetes ? 1 : 0}${p.htn ? 1 : 0}${p.nafld ? 1 : 0}:${p.goal}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function verdictPillStyle(v: Verdict) {
  if (v === "FIT") return styles.pillFit;
  if (v === "MODERATE") return styles.pillModerate;
  return styles.pillAvoid;
}

function scoreBarColor(score: number) {
  if (score >= 75) return styles.barGood;
  if (score >= 45) return styles.barMid;
  return styles.barBad;
}

export default function MenuScreen() {
  const API = useMemo(() => getApiBase(), []);
  const [profile, setProfile] = useState<Profile>({
    diabetes: true,
    htn: true,
    nafld: false,
    goal: "Lose",
  });

  const [uploadKey, setUploadKey] = useState<string>("");
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [rating, setRating] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rated, setRated] = useState<RateResponse | null>(null);

  const [filter, setFilter] = useState<"ALL" | Verdict>("ALL");
  const rerateTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_PROFILE_KEY);
        if (saved) setProfile((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(stableProfile(profile))).catch(() => {});
  }, [profile]);

  const profileHash = useMemo(() => hashProfile(profile), [profile]);
  const cacheKey = useMemo(() => {
    if (!uploadKey) return "";
    return `${STORAGE_CACHE_PREFIX}${uploadKey}:${profileHash}`;
  }, [uploadKey, profileHash]);

  async function loadCacheIfAny() {
    if (!cacheKey) return false;
    try {
      const hit = await AsyncStorage.getItem(cacheKey);
      if (!hit) return false;
      const parsed = JSON.parse(hit) as RateResponse;
      setRated({ ...parsed, cached: true });
      return true;
    } catch {
      return false;
    }
  }

  async function saveCache(resp: RateResponse) {
    if (!cacheKey) return;
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(resp));
    } catch {}
  }

  async function uploadFilesWeb(files: FileList | null) {
    if (!files || files.length === 0) return;

    setExtractError(null);
    setExtracting(true);
    setRated(null);
    setRateError(null);

    try {
      const form = new FormData();
      for (const f of Array.from(files).slice(0, 6)) {
        form.append("files", f);
      }

      const url = `${API}/api/menu/extract-upload`;

      const resp = await fetch(url, { method: "POST", body: form });

      // If this is HTML (typical when you accidentally hit Expo server), show a clearer error
      const ct = resp.headers.get("content-type") || "";
      const textIfNotJson = ct.includes("application/json") ? null : await resp.text();

      if (!resp.ok) {
        const t = textIfNotJson ?? (await resp.text());
        throw new Error(
          `Upload failed (${resp.status}). Make sure API base is backend (8787). Response: ${String(t).slice(0, 220)}`
        );
      }

      const data = (await resp.json()) as ExtractUploadResponse;

      setUploadKey(data.uploadKey);
      setSections(data.sections || []);

      const names = (data.sections || [])
        .flatMap((s) => s.items || [])
        .map((i) => i.name)
        .filter(Boolean);

      setSelectedNames(names.slice(0, 12));
    } catch (e: any) {
      setExtractError(e?.message || "Upload failed");
    } finally {
      setExtracting(false);
    }
  }

  async function rateNow(force = false) {
    if (!uploadKey) {
      setRateError("Missing uploadKey. Upload a menu first.");
      return;
    }
    if (selectedNames.length === 0) {
      setRateError("Select at least 1 item to rate.");
      return;
    }

    setRateError(null);
    setRating(true);

    try {
      if (!force) {
        const usedCache = await loadCacheIfAny();
        if (usedCache) return;
      }

      const resp = await fetch(`${API}/api/menu/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadKey,
          items: selectedNames.slice(0, 30),
          profile: stableProfile(profile),
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Rate failed (${resp.status}): ${t}`);
      }

      const data = (await resp.json()) as any;

      const normalized: RateResponse = {
        uploadKey: data.uploadKey || uploadKey,
        count: data.count || (data.ratedItems?.length ?? 0),
        ratedItems: data.ratedItems || [],
        cached: !!data.cached,
      };

      setRated(normalized);
      await saveCache(normalized);
    } catch (e: any) {
      setRateError(e?.message || "Rate failed");
    } finally {
      setRating(false);
    }
  }

  useEffect(() => {
    if (!uploadKey || selectedNames.length === 0) return;
    if (rerateTimer.current) clearTimeout(rerateTimer.current);
    rerateTimer.current = setTimeout(() => {
      rateNow(false);
    }, 350);
    return () => rerateTimer.current && clearTimeout(rerateTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileHash]);

  const allMenuNames = useMemo(() => {
    const names = sections.flatMap((s) => s.items.map((i) => i.name)).filter(Boolean);
    return Array.from(new Set(names));
  }, [sections]);

  const filteredMenuNames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allMenuNames;
    return allMenuNames.filter((n) => n.toLowerCase().includes(q));
  }, [allMenuNames, search]);

  const shownRatedItems = useMemo(() => {
    const items = rated?.ratedItems || [];
    if (filter === "ALL") return items;
    return items.filter((x) => x.verdict === filter);
  }, [rated, filter]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Menu Rating</Text>
      <Text style={styles.sub}>Upload menu screenshot/PDF → select items → get FIT/MODERATE/AVOID</Text>

      <Text style={styles.apiNote}>API: {API}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1) Upload menu (PDF / screenshot)</Text>

        {Platform.OS === "web" ? (
          <View style={styles.webUploadRow}>
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={(e) => uploadFilesWeb(e.target.files)}
              style={{ color: "white" }}
            />
            {extracting ? (
              <View style={styles.inline}>
                <ActivityIndicator />
                <Text style={styles.muted}>Extracting…</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>
            On mobile we’ll add DocumentPicker next. For now, use Web upload to test end-to-end.
          </Text>
        )}

        {extractError ? <Text style={styles.err}>{extractError}</Text> : null}

        {uploadKey ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>uploadKey</Text>
            <Text style={styles.kvVal} numberOfLines={1}>
              {uploadKey}
            </Text>
          </View>
        ) : null}

        {sections.length > 0 ? (
          <Text style={styles.muted}>
            Extracted {sections.length} sections • {allMenuNames.length} unique items
          </Text>
        ) : null}
      </View>

      <View style={styles.cardDark}>
        <Text style={styles.cardTitle}>2) Profile Toggles</Text>

        <View style={styles.toggleRow}>
          <Toggle label="Diabetes" value={profile.diabetes} onChange={(v) => setProfile((p) => ({ ...p, diabetes: v }))} />
          <Toggle
            label="Hypertension (HTN)"
            value={profile.htn}
            onChange={(v) => setProfile((p) => ({ ...p, htn: v }))}
          />
          <Toggle
            label="Fatty Liver (NAFLD)"
            value={profile.nafld}
            onChange={(v) => setProfile((p) => ({ ...p, nafld: v }))}
          />
        </View>

        <View style={styles.goalRow}>
          {(["Lose", "Maintain", "Gain"] as Goal[]).map((g) => (
            <Pill key={g} text={g} active={profile.goal === g} onPress={() => setProfile((p) => ({ ...p, goal: g }))} />
          ))}
        </View>

        <Text style={styles.muted}>Changes auto re-run rating (cached per profile).</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>3) Select menu items to rate</Text>

        <View style={styles.row}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search menu items…"
            placeholderTextColor="#90A4AE"
            style={styles.input}
          />
          <Pressable onPress={() => setSelectedNames(allMenuNames.slice(0, 20))} style={styles.btnGhost}>
            <Text style={styles.btnGhostTxt}>Auto pick</Text>
          </Pressable>
        </View>

        <Text style={styles.muted}>Selected: {selectedNames.length} (we’ll rate up to 30 per call)</Text>

        <View style={styles.chipsWrap}>
          {filteredMenuNames.slice(0, 60).map((name) => {
            const active = selectedNames.includes(name);
            return (
              <Chip
                key={name}
                text={name}
                active={active}
                onPress={() => {
                  setSelectedNames((prev) => {
                    if (prev.includes(name)) return prev.filter((x) => x !== name);
                    return [...prev, name].slice(0, 30);
                  });
                }}
              />
            );
          })}
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={() => rateNow(true)}
            style={[styles.btn, (!uploadKey || selectedNames.length === 0 || rating) && styles.btnDisabled]}
            disabled={!uploadKey || selectedNames.length === 0 || rating}
          >
            {rating ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Rate Selected</Text>}
          </Pressable>

          <Pressable
            onPress={() => {
              setSelectedNames([]);
              setRated(null);
              setRateError(null);
            }}
            style={styles.btnDangerGhost}
          >
            <Text style={styles.btnDangerGhostTxt}>Clear</Text>
          </Pressable>
        </View>

        {rateError ? <Text style={styles.err}>{rateError}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>4) Rated results</Text>
          {rated?.cached ? <Text style={styles.cacheBadge}>Cached</Text> : null}
        </View>

        <View style={styles.filterRow}>
          <Pill text="ALL" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <Pill text="FIT" active={filter === "FIT"} onPress={() => setFilter("FIT")} />
          <Pill text="MODERATE" active={filter === "MODERATE"} onPress={() => setFilter("MODERATE")} />
          <Pill text="AVOID" active={filter === "AVOID"} onPress={() => setFilter("AVOID")} />
        </View>

        {!rated ? (
          <Text style={styles.muted}>No results yet. Upload + select items + rate.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {shownRatedItems.map((it) => (
              <View key={it.input} style={styles.resultCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.resultName}>{it.name || it.input}</Text>
                  <View style={[styles.pill, verdictPillStyle(it.verdict)]}>
                    <Text style={styles.pillTxt}>{it.verdict}</Text>
                  </View>
                </View>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreVal}>{clamp(it.score ?? 0, 0, 100)}/100</Text>
                </View>

                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      scoreBarColor(clamp(it.score ?? 0, 0, 100)),
                      { width: `${clamp(it.score ?? 0, 0, 100)}%` },
                    ]}
                  />
                </View>

                {it.nutrition ? (
                  <View style={styles.nutRow}>
                    <Nut text={`Cal ${it.nutrition.calories ?? "—"}`} />
                    <Nut text={`Carbs ${it.nutrition.carbsG ?? "—"}g`} />
                    <Nut text={`Prot ${it.nutrition.proteinG ?? "—"}g`} />
                    <Nut text={`Fat ${it.nutrition.fatG ?? "—"}g`} />
                    <Nut text={`Na ${it.nutrition.sodiumMg ?? "—"}mg`} />
                  </View>
                ) : null}

                {it.reasons && it.reasons.length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    {it.reasons.slice(0, 5).map((r, idx) => (
                      <Text key={`${it.input}-r-${idx}`} style={styles.reason}>
                        • {r}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mutedSmall}>No specific warnings for this profile.</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.toggle, value && styles.toggleOn]}>
      <Text style={[styles.toggleTxt, value && styles.toggleTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pillBtn, active && styles.pillBtnOn]}>
      <Text style={[styles.pillBtnTxt, active && styles.pillBtnTxtOn]}>{text}</Text>
    </Pressable>
  );
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtOn]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

function Nut({ text }: { text: string }) {
  return (
    <View style={styles.nutPill}>
      <Text style={styles.nutTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6FAFB" },
  container: { padding: 18, gap: 14 },

  h1: { fontSize: 36, fontWeight: "800", color: "#0B1B2B", marginTop: 4 },
  sub: { fontSize: 14, color: "#5C6B7A", marginTop: -6 },
  apiNote: { fontSize: 12, color: "#7A8A9A", marginTop: -6 },

  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6EEF2",
    gap: 10,
  },
  cardDark: {
    backgroundColor: "#0D1B2A",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#10283E",
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0B1B2B" },

  webUploadRow: { gap: 10 },
  inline: { flexDirection: "row", gap: 10, alignItems: "center" },

  muted: { color: "#7A8A9A", fontSize: 13 },
  mutedSmall: { color: "#7A8A9A", fontSize: 12, marginTop: 6 },
  err: { color: "#B00020", fontWeight: "700" },

  kvRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  kvKey: { fontSize: 12, color: "#7A8A9A" },
  kvVal: { flex: 1, fontSize: 12, color: "#0B1B2B" },

  toggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2A3B4F",
    backgroundColor: "transparent",
  },
  toggleOn: { backgroundColor: "#2F7D85", borderColor: "#2F7D85" },
  toggleTxt: { color: "#DDE6EE", fontWeight: "700" },
  toggleTxtOn: { color: "white" },

  goalRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E5EC",
    paddingHorizontal: 12,
    color: "#0B1B2B",
    backgroundColor: "#F7FBFD",
  },

  btn: {
    backgroundColor: "#2F7D85",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 160,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.55 },
  btnTxt: { color: "white", fontWeight: "800" },

  btnGhost: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E5EC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "white",
  },
  btnGhostTxt: { fontWeight: "800", color: "#0B1B2B" },

  btnDangerGhost: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1C6C6",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FFF6F6",
  },
  btnDangerGhostTxt: { fontWeight: "800", color: "#B00020" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: {
    maxWidth: 240,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8E5EC",
    backgroundColor: "#FFFFFF",
  },
  chipOn: { backgroundColor: "#0D1B2A", borderColor: "#0D1B2A" },
  chipTxt: { color: "#0B1B2B", fontWeight: "700", fontSize: 13 },
  chipTxtOn: { color: "white" },

  filterRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pillBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D8E5EC",
    backgroundColor: "white",
  },
  pillBtnOn: { backgroundColor: "#2F7D85", borderColor: "#2F7D85" },
  pillBtnTxt: { fontWeight: "800", color: "#0B1B2B" },
  pillBtnTxtOn: { color: "white" },

  cacheBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#E8F4F5",
    color: "#1D6D75",
    fontWeight: "800",
  },

  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF2",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 8,
  },
  resultName: { fontSize: 16, fontWeight: "900", color: "#0B1B2B", flex: 1, paddingRight: 8 },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillTxt: { color: "white", fontWeight: "900", fontSize: 12 },
  pillFit: { backgroundColor: "#2E7D32" },
  pillModerate: { backgroundColor: "#C27C0E" },
  pillAvoid: { backgroundColor: "#B00020" },

  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { color: "#5C6B7A", fontWeight: "800" },
  scoreVal: { color: "#0B1B2B", fontWeight: "900" },

  barTrack: { height: 10, borderRadius: 999, backgroundColor: "#EDF3F7", overflow: "hidden" },
  barFill: { height: 10, borderRadius: 999 },
  barGood: { backgroundColor: "#2E7D32" },
  barMid: { backgroundColor: "#C27C0E" },
  barBad: { backgroundColor: "#B00020" },

  nutRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  nutPill: {
    backgroundColor: "#F4F8FB",
    borderWidth: 1,
    borderColor: "#E6EEF2",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  nutTxt: { fontWeight: "800", color: "#0B1B2B", fontSize: 12 },

  reason: { color: "#0B1B2B", fontSize: 13, marginTop: 2 },
});
