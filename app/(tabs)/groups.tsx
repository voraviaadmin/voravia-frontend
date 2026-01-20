import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { listGroups, Group } from "@/src/storage/groups";
import { getAppContext, setAppContext } from "@/src/storage/appContext";
import { listUsers, seedDemoHousehold, UserProfile } from "@/src/storage/users";
import { patchMe } from "@/src/hooks/useMe";
import { Theme } from "@/src/ui/theme";

import type { ContextScope } from "@/src/context/contextRules";
import { clampContext, getContextEligibility, getAvailableContexts } from "@/src/context/contextRules";

import { getApiBaseUrl } from "../../lib/me";

type ScoreMode = "avg14d" | "today";

type DaySummary = { dailyScore?: number };
type LogsResp = { items?: Array<{ createdAt?: string; day?: string; score?: number }> };

function clampScore(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

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

/**
 * Avg daily score from logs:
 * - group scored meals by day
 * - avg meals per day
 * - avg across last N days that have any scored meals
 */
function computeAvgScoreFromLogs(items: Array<{ createdAt?: string; day?: string; score?: number }>, days = 14): number | null {
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

function mean(nums: Array<number | null | undefined>) {
  const vals = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!vals.length) return 0;
  const s = vals.reduce((a, b) => a + b, 0);
  return clampScore(s / vals.length);
}

function scopeLabel(s: ContextScope) {
  if (s === "individual") return "Individual";
  if (s === "family") return "Family";
  return "Workplace";
}

function countBy(users: UserProfile[], key: "familyId" | "insuranceId" | "corporateId", value?: string) {
  if (!value) return 0;
  return users.filter((u) => u[key] === value).length;
}

function localIdToBackendId(id: string) {
  return id === "head"
    ? "u_head"
    : id === "spouse"
    ? "u_spouse"
    : id === "child1"
    ? "u_child1"
    : id === "child2"
    ? "u_child2"
    : "u_head";
}

function SectionRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={sectionRowStyles.card}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={sectionRowStyles.title}>{title}</Text>
        <Text style={sectionRowStyles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={sectionRowStyles.chev}>›</Text>
    </Pressable>
  );
}

const sectionRowStyles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 13, color: "#6B7280" },
  chev: { fontSize: 22, color: "#9CA3AF" },
});

/**
 * Same-size card as your existing rollups,
 * keeps score on right + label under it,
 * tap score area toggles Today <-> Avg (14d)
 */
function ScoreCard({
  title,
  subtitle,
  meta,
  score,
  mode,
  onToggle,
  loading,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  score: number;
  mode: ScoreMode;
  onToggle: () => void;
  loading?: boolean;
}) {
  return (
    <View style={scoreCardStyles.card}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={scoreCardStyles.title}>{title}</Text>
        <Text style={scoreCardStyles.subtitle}>{subtitle}</Text>
        {!!meta && <Text style={scoreCardStyles.meta}>{meta}</Text>}
      </View>

      <Pressable onPress={onToggle} style={scoreCardStyles.scoreBox}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={scoreCardStyles.score}>{score}</Text>
            <Text style={scoreCardStyles.scoreLabel}>{mode === "avg14d" ? "Avg (14d)" : "Today"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const scoreCardStyles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  title: { fontSize: 18, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#6B7280" },
  meta: { marginTop: 8, fontSize: 14, fontWeight: "900", color: "#0f766e" },

  scoreBox: { minWidth: 84, alignItems: "flex-end", justifyContent: "center" },
  score: { fontSize: 44, fontWeight: "900", color: "#0f766e", lineHeight: 48 },
  scoreLabel: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "rgba(0,0,0,0.55)" },
});

export default function GroupsScreen() {
  const [segment, setSegment] = useState<ContextScope>("individual");
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("head");
  const [membersExpanded, setMembersExpanded] = useState(true);

  // Toggle per card (keeps card size unchanged; only value/label switches)
  const [modeByCard, setModeByCard] = useState<Record<string, ScoreMode>>({
    you: "avg14d",
    family: "avg14d",
    insurance: "avg14d",
    workplace: "avg14d",
  });

  // Score caches keyed by backend member id
  const [todayByBackendId, setTodayByBackendId] = useState<Record<string, number>>({});
  const [avg14dByBackendId, setAvg14dByBackendId] = useState<Record<string, number>>({});
  const [loadingScores, setLoadingScores] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        const ctx = await getAppContext();
        const gs = await listGroups();
        const us = await listUsers();

        if (!alive) return;

        const hasFamilyGroup = gs.some((g) => g.type === "Family");
        const resolvedUserId = ctx.currentUserId ?? "head";
        const resolvedMe = us.find((u) => u.id === resolvedUserId) ?? null;

        const desired = (ctx.segment ?? "individual") as ContextScope;
        const clamped = clampContext(desired, resolvedMe, { hasFamilyGroup });

        if (clamped !== desired) {
          await setAppContext({ segment: clamped, currentUserId: resolvedUserId });
        }

        setSavedGroups(gs);
        setUsers(us);
        setCurrentUserId(resolvedUserId);
        setSegment(clamped);
      })();

      return () => {
        alive = false;
      };
    }, [])
  );

  const me = useMemo(() => users.find((u) => u.id === currentUserId) ?? null, [users, currentUserId]);

  const familyGroups = useMemo(() => savedGroups.filter((g) => g.type === "Family"), [savedGroups]);
  const familyGroup = useMemo(() => familyGroups[0] ?? null, [familyGroups]);
  const hasFamilyGroup = useMemo(() => savedGroups.some((g) => g.type === "Family"), [savedGroups]);

  const activeFamilyId = useMemo(() => {
    if (me?.familyId) return me.familyId;
    return familyGroup?.id ?? "";
  }, [me?.familyId, familyGroup?.id]);

  const familyMembers = useMemo(() => {
    if (!activeFamilyId) return [];
    return users
      .filter((u) => u.familyId === activeFamilyId)
      .sort((a, b) => (a.id === "head" ? -1 : b.id === "head" ? 1 : 0));
  }, [users, activeFamilyId]);

  const eligibility = useMemo(() => getContextEligibility(me, { hasFamilyGroup }), [me, hasFamilyGroup]);
  const SEGMENTS = useMemo<ContextScope[]>(() => getAvailableContexts(eligibility), [eligibility]);

  useMemo(() => {
    if (!me) return;
    const clamped = clampContext(segment, me, { hasFamilyGroup });
    if (clamped !== segment) {
      setSegment(clamped);
      setAppContext({ segment: clamped, currentUserId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, me?.familyId, me?.corporateId, hasFamilyGroup]);

  const onChangeSegment = useCallback(
    async (next: ContextScope) => {
      setSegment(next);
      await setAppContext({ segment: next, currentUserId });
      patchMe({ mode: next as any }).catch(() => {});
    },
    [currentUserId]
  );

  const onChangeUser = useCallback(
    async (nextUserId: string) => {
      const nextMe = users.find((u) => u.id === nextUserId) ?? null;
      const clamped = clampContext(segment, nextMe, { hasFamilyGroup });

      setCurrentUserId(nextUserId);
      setSegment(clamped);

      await setAppContext({ segment: clamped, currentUserId: nextUserId });

      const backendMemberId = localIdToBackendId(nextUserId);
      patchMe({ mode: "family", family: { activeMemberId: backendMemberId } }).catch(() => {});
    },
    [users, segment, hasFamilyGroup]
  );

  const showCreateFamilyCTA = segment === "family" && familyGroups.length === 0;

  const devSeed = useCallback(async () => {
    const famId = familyGroup?.id ?? "FAM-1";
    await seedDemoHousehold(famId);
    const us = await listUsers();
    setUsers(us);
    await onChangeUser("head");
  }, [familyGroup, onChangeUser]);

  // ---- Score loading (Today + Avg14d) ----
  const loadScores = useCallback(async () => {
    if (!me) return;

    const api = getApiBaseUrl();
    const backendMe = localIdToBackendId(me.id);

    // Individual needs selected member
    const individualIds = [backendMe];

    // Family needs all family members
    const familyIds = familyMembers.map((m) => localIdToBackendId(m.id));

    // Insurance needs members matching selected/logged-in user's insurance
    const myInsuranceId = me.insuranceId;
    const insuranceIds = familyMembers
      .filter((m) => !!myInsuranceId && m.insuranceId === myInsuranceId)
      .map((m) => localIdToBackendId(m.id));

    // Only fetch for ids we don't already have cached (keep it low risk)
    const want = Array.from(new Set([...individualIds, ...familyIds, ...insuranceIds])).filter(Boolean);

    if (!want.length) return;

    setLoadingScores(true);

    try {
      // Fetch Today + Logs in parallel per member
      const results = await Promise.all(
        want.map(async (uid) => {
          const [dayR, logsR] = await Promise.all([
            fetch(`${api}/v1/day-summary?userId=${encodeURIComponent(uid)}`).catch(() => null),
            fetch(`${api}/v1/logs?userId=${encodeURIComponent(uid)}`).catch(() => null),
          ]);

          let today: number | null = null;
          let avg14: number | null = null;

          try {
            if (dayR && (dayR as any).ok) {
              const j = (await (dayR as any).json().catch(() => ({}))) as DaySummary;
              today = clampScore(Number(j?.dailyScore ?? 0));
            }
          } catch {}

          try {
            if (logsR && (logsR as any).ok) {
              const j = (await (logsR as any).json().catch(() => ({}))) as LogsResp;
              const items = Array.isArray(j?.items) ? j.items : [];
              const avg = computeAvgScoreFromLogs(items, 14);
              avg14 = avg === null ? null : avg;
            }
          } catch {}

          return { uid, today, avg14 };
        })
      );

      setTodayByBackendId((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (typeof r.today === "number") next[r.uid] = r.today;
        }
        return next;
      });

      setAvg14dByBackendId((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (typeof r.avg14 === "number") next[r.uid] = r.avg14;
        }
        return next;
      });
    } finally {
      setLoadingScores(false);
    }
  }, [me, familyMembers]);

  useFocusEffect(
    useCallback(() => {
      loadScores();
    }, [loadScores])
  );

  // ---- Derived card scores ----
  const backendMeId = useMemo(() => (me ? localIdToBackendId(me.id) : "u_head"), [me]);

  const familyBackendIds = useMemo(() => familyMembers.map((m) => localIdToBackendId(m.id)), [familyMembers]);
  const insuranceBackendIds = useMemo(() => {
    const myInsuranceId = me?.insuranceId;
    if (!myInsuranceId) return [];
    return familyMembers.filter((m) => m.insuranceId === myInsuranceId).map((m) => localIdToBackendId(m.id));
  }, [me?.insuranceId, familyMembers]);

  const youScore = useMemo(() => {
    const mode = modeByCard.you ?? "avg14d";
    return mode === "today"
      ? todayByBackendId[backendMeId] ?? 0
      : avg14dByBackendId[backendMeId] ?? todayByBackendId[backendMeId] ?? 0;
  }, [modeByCard.you, backendMeId, todayByBackendId, avg14dByBackendId]);

  const familyScore = useMemo(() => {
    const mode = modeByCard.family ?? "avg14d";
    const vals = (mode === "today" ? familyBackendIds.map((id) => todayByBackendId[id]) : familyBackendIds.map((id) => avg14dByBackendId[id] ?? todayByBackendId[id]));
    return mean(vals);
  }, [modeByCard.family, familyBackendIds, todayByBackendId, avg14dByBackendId]);

  const insuranceScore = useMemo(() => {
    const mode = modeByCard.insurance ?? "avg14d";
    const vals = (mode === "today"
      ? insuranceBackendIds.map((id) => todayByBackendId[id])
      : insuranceBackendIds.map((id) => avg14dByBackendId[id] ?? todayByBackendId[id]));
    return mean(vals);
  }, [modeByCard.insurance, insuranceBackendIds, todayByBackendId, avg14dByBackendId]);

  const toggle = useCallback((key: "you" | "family" | "insurance" | "workplace") => {
    setModeByCard((prev) => {
      const cur = prev[key] ?? "avg14d";
      const next: ScoreMode = cur === "avg14d" ? "today" : "avg14d";
      return { ...prev, [key]: next };
    });
  }, []);

  // ---- Render cards (same size) ----
  const cards = useMemo(() => {
    if (!me) return [];

    if (segment === "individual") {
      return [
        {
          key: "you" as const,
          title: "You",
          subtitle: "Personal health score · current streak",
          meta: "Improving",
          score: youScore,
          mode: modeByCard.you ?? "avg14d",
        },
      ];
    }

    if (segment === "family") {
      const out: Array<any> = [];

      if (activeFamilyId) {
        const count = countBy(users, "familyId", activeFamilyId);
        out.push({
          key: "family" as const,
          title: familyGroup?.name ?? "Family",
          subtitle: `${count || 1} members · 5-day streak`,
          meta: "Improving",
          score: familyScore,
          mode: modeByCard.family ?? "avg14d",
        });
      }

      if (me.insuranceId) {
        const insuredCount = familyMembers.filter((u) => u.insuranceId === me.insuranceId).length;
        out.push({
          key: "insurance" as const,
          title: "Insurance",
          subtitle: `${me.insuranceId} · ${insuredCount || 0} insured member${(insuredCount || 0) === 1 ? "" : "s"}`,
          meta: "Improving",
          score: insuranceScore,
          mode: modeByCard.insurance ?? "avg14d",
        });
      }

      return out;
    }

    // Workplace (keep as-is / placeholder, but still toggle-able if you want)
    const corporateId = me.corporateId;
    if (!corporateId) return [];

    const employees = countBy(users, "corporateId", corporateId);
    const CORP_SCORE = corporateId === "CORP-Y" ? 73 : 75;

    return [
      {
        key: "workplace" as const,
        title: corporateId === "CORP-Y" ? "Other Health Group" : "Voravia Health Group",
        subtitle: `${employees || 1} employees`,
        meta: "Aggregate only",
        score: CORP_SCORE,
        mode: modeByCard.workplace ?? "avg14d",
      },
    ];
  }, [
    me,
    segment,
    activeFamilyId,
    users,
    familyGroup?.name,
    familyMembers,
    familyScore,
    insuranceScore,
    youScore,
    modeByCard,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: Theme.colors.bg }]}>
      <Text style={styles.title}>Health Groups</Text>

      <View style={styles.segmentRow}>
        {SEGMENTS.map((s) => (
          <Pressable key={s} onPress={() => onChangeSegment(s)} style={[styles.segment, segment === s && styles.segmentActive]}>
            <Text style={[styles.segmentText, segment === s && styles.segmentTextActive]}>{scopeLabel(s)}</Text>
          </Pressable>
        ))}
      </View>

      {__DEV__ && segment !== "workplace" ? (
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Simulate:</Text>

          <Pressable onPress={() => onChangeUser("head")} style={[styles.devChip, currentUserId === "head" && styles.devChipActive]}>
            <Text style={[styles.devChipText, currentUserId === "head" && styles.devChipTextActive]}>Head</Text>
          </Pressable>

          <Pressable onPress={() => onChangeUser("spouse")} style={[styles.devChip, currentUserId === "spouse" && styles.devChipActive]}>
            <Text style={[styles.devChipText, currentUserId === "spouse" && styles.devChipTextActive]}>Spouse</Text>
          </Pressable>

          {users.length === 0 ? (
            <Pressable onPress={devSeed} style={styles.devSeedBtn}>
              <Text style={styles.devSeedText}>Seed demo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showCreateFamilyCTA ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No family group yet</Text>
          <Text style={styles.emptySub}>Create one to track a shared health score and streaks.</Text>

          <Pressable onPress={() => router.push("/groups/create-family")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Create Family</Text>
          </Pressable>
        </View>
      ) : null}

      {segment === "family" && familyGroups.length > 0 ? (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => router.push("/groups/invite-family")} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Invite</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/groups/join-family")} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Join</Text>
          </Pressable>
        </View>
      ) : null}

      {segment === "family" && activeFamilyId ? (
        <View style={styles.membersBox}>
          <Pressable onPress={() => setMembersExpanded((v) => !v)} style={styles.membersHeaderPressable}>
            <View style={styles.membersTitleRow}>
              <Text style={styles.membersTitle}>Members</Text>
              <Text style={styles.chev}>{membersExpanded ? "▾" : "▸"}</Text>
            </View>

            <View style={styles.membersSubRow}>
              <Text style={styles.membersSub}>{familyMembers.length} members</Text>

              <Pressable
                onPress={(e) => {
                  // @ts-ignore web-safe
                  e.stopPropagation?.();
                  router.push("/groups/assign-insurance");
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Assign Insurance</Text>
              </Pressable>
            </View>
          </Pressable>

          {membersExpanded && (
            <View>
              <View style={{ height: 1, backgroundColor: "#E5E7EB", marginTop: 8, marginBottom: 8 }} />

              {familyMembers.length === 0 ? (
                <Text style={styles.membersEmpty}>No members joined yet.</Text>
              ) : (
                familyMembers.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {m.name ?? m.id}
                        {m.id === "head" ? " (Head)" : m.id === "spouse" ? " (Spouse)" : ""}
                      </Text>

                      <Text style={styles.memberMeta}>
                        {m.insuranceId ? `INS: ${m.insuranceId}` : "INS: —"}
                        {"  •  "}
                        {m.corporateId ? `CORP: ${m.corporateId}` : "CORP: —"}
                      </Text>
                    </View>

                    <View style={styles.memberBadges}>
                      {m.insuranceId && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>INS</Text>
                        </View>
                      )}
                      {m.corporateId && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>CORP</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      ) : null}

      <SectionRow title="Usage" subtitle="Monthly family usage" onPress={() => router.push("/groups/usage")} />

      <FlatList
        data={cards}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <ScoreCard
            title={item.title}
            subtitle={item.subtitle}
            meta={item.meta}
            score={item.score}
            mode={item.mode}
            loading={loadingScores && (item.key === "you" || item.key === "family" || item.key === "insurance")}
            onToggle={() => toggle(item.key)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },

  segmentRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: "#0f766e" },
  segmentText: { fontWeight: "700", color: "rgba(0,0,0,0.65)" },
  segmentTextActive: { color: "white" },

  emptyBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  emptyTitle: { fontWeight: "800" },
  emptySub: { marginTop: 6, opacity: 0.7 },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
  },
  primaryBtnText: { color: "white", fontWeight: "800" },

  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderColor: "rgba(15,118,110,0.45)",
  },
  secondaryBtnText: { fontWeight: "900", fontSize: 13, color: "#0f766e" },

  devRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  devLabel: { fontWeight: "800", opacity: 0.7 },
  devChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  devChipActive: { backgroundColor: "#0f766e" },
  devChipText: { fontWeight: "800", color: "rgba(0,0,0,0.65)" },
  devChipTextActive: { color: "white" },
  devSeedBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  devSeedText: { fontWeight: "800", color: "rgba(0,0,0,0.7)" },

  membersTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chev: { fontSize: 16, fontWeight: "900", opacity: 0.55 },

  membersBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  membersTitle: { fontSize: 14, fontWeight: "900" },
  membersSubRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  membersSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  membersEmpty: { opacity: 0.65 },

  membersHeaderPressable: { paddingBottom: 10 },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  memberName: { fontWeight: "900" },
  memberMeta: { marginTop: 3, opacity: 0.7, fontSize: 12 },

  memberBadges: { flexDirection: "row", gap: 8, marginLeft: 12 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.30)",
  },
  badgeText: { fontWeight: "900", fontSize: 12 },
});
