import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { listGroups, Group } from "@/src/storage/groups";
import { getAppContext, setAppContext } from "@/src/storage/appContext";
import { patchMe } from "@/src/hooks/useMe";
import { Theme } from "@/src/ui/theme";
import { headerStyles } from "@/src/ui/headerStyle";
import type { ContextScope } from "@/src/context/contextRules";
import { Screen } from "@/src/ui/Screen";
import { S } from "@/src/ui/spacing";

import { API_BASE } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";


// Backwards-compatible helper (older screens still call this)
export function getApiBaseUrl() {
  return API_BASE;
}

// =======================
// DEV FLAG: Simulate chips
// =======================
const ENABLE_SIMULATE_CHIPS = false; // <-- set true if you want them in dev

type ScoreMode = "avg14d" | "today";

// Backend family member shape (MVP)
type ApiFamilyMember = {
  id: string;
  familyId?: string;
  name?: string;
  memberType?: "individual" | "parent" | "child";
  insuranceId?: string | null;
  corporateId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function clampScore(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function mean(nums: Array<number | null | undefined>) {
  const vals = nums.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );
  if (!vals.length) return 0;
  const s = vals.reduce((a, b) => a + b, 0);
  return clampScore(s / vals.length);
}

function scopeLabel(s: ContextScope) {
  if (s === "individual") return "Individual";
  if (s === "family") return "Family";
  return "Workplace";
}

// Existing MVP identity mapping (keep, no behavior changes)
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
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: S.md,
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
            <Text style={scoreCardStyles.scoreLabel}>
              {mode === "avg14d" ? "Avg (14d)" : "Today"}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const scoreCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: S.md,
  },
  title: { fontSize: Theme.font.h2, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 13, color: Theme.colors.textMuted },
  meta: { marginTop: 8, fontSize: 14, fontWeight: "900", color: "#0f766e" },

  scoreBox: { minWidth: 84, alignItems: "flex-end", justifyContent: "center" },
  score: { fontSize: 32, fontWeight: "900", color: "#0f766e", lineHeight: 48 },
  scoreLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(0,0,0,0.55)",
  },
});

function memberTypeLabel(t?: ApiFamilyMember["memberType"]) {
  if (t === "parent") return "Parent";
  if (t === "child") return "Child";
  return "Individual";
}
function nextMemberType(t?: ApiFamilyMember["memberType"]): ApiFamilyMember["memberType"] {
  if (t === "parent") return "child";
  if (t === "child") return "individual";
  return "parent";
}

export default function GroupsScreen() {
  const [segment, setSegment] = useState<ContextScope>("individual");
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("head");

  const [membersExpanded, setMembersExpanded] = useState(true);

  // Scores
  const [modeByCard, setModeByCard] = useState<Record<string, ScoreMode>>({
    you: "avg14d",
    family: "avg14d",
    insurance: "avg14d",
    workplace: "avg14d",
  });
  const modeRef = useRef(modeByCard);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoresByKey, setScoresByKey] = useState<Record<string, number>>({
    you: 0,
    family: 0,
    insurance: 0,
    workplace: 0,
  });

  // Family members (API)
  const [apiFamilyMembers, setApiFamilyMembers] = useState<ApiFamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // /v1/me (active member + mode)
  const [me, setMe] = useState<any>(null);

  const activeMemberId: string | null = useMemo(() => {
    try {
      const m = me;
      if (m?.mode === "family") return String(m?.family?.activeMemberId || "") || null;
      return String(m?.userId || m?.id || "") || null;
    } catch {
      return null;
    }
  }, [me]);

  const [familyCountMeta, setFamilyCountMeta] = useState(0);
  const [employeesCountMeta, setEmployeesCountMeta] = useState(0);

  const inFlightRef = useRef(false);
  const didInitialLoadRef = useRef(false);


  // ---------- API helpers ----------
  const fetchMeApi = useCallback(async (backendMe: string) => {
    const api = getApiBaseUrl();
    const meResp = await fetch(`${api}/v1/me`, {
      method: "GET",
      headers: { "x-user-id": backendMe },
    });
    const meJson = await meResp.json().catch(() => ({}));
    if (meResp.ok) {
      setMe(meJson);
      return meJson;
    }
    setMe(null);
    return null;
  }, []);

  async function fetchFamilyMembersFromApi(userBackendId: string) {
    const api = getApiBaseUrl();
    const resp = await fetch(`${api}/v1/family/members`, {
      method: "GET",
      headers: { "x-user-id": userBackendId },
    });
    const json = await resp.json().catch(() => ({}));
    const items = Array.isArray(json?.items) ? json.items : [];
    const mapped: ApiFamilyMember[] = items
      .filter((m: any) => m && (typeof m.id === "string" || typeof m.id === "number"))
      .map((m: any) => ({
        id: String(m.id),
        familyId: m.familyId ? String(m.familyId) : undefined,
        name: m.name ? String(m.name) : undefined,
        memberType: (String(m.memberType || "") as any) || "individual",
        insuranceId: m.insuranceId ?? null,
        corporateId: m.corporateId ?? null,
        createdAt: m.createdAt ? String(m.createdAt) : undefined,
        updatedAt: m.updatedAt ? String(m.updatedAt) : undefined,
      }));
    return mapped;
  }

  const scoreForUserId = useCallback(
    async (backendMe: string, uid: string, mode: ScoreMode) => {
      const api = getApiBaseUrl();
      const windowDays = mode === "today" ? 1 : 14;

      const r = await fetch(
        `${api}/v1/day-summary?userId=${encodeURIComponent(uid)}&windowDays=${windowDays}`,
        { method: "GET", headers: { "x-user-id": backendMe } }
      );
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) return 0;
      if (mode === "today") return clampScore(Number(j?.dailyScore ?? 0));
      return clampScore(Number(j?.avgScore ?? 0));
    },
    []
  );

  const computeAndSetScores = useCallback(
    async (args: {
      backendMe: string;
      seg: ContextScope;
      meJson: any;
      members: ApiFamilyMember[];
    }) => {
      const { backendMe, seg, meJson, members } = args;

      setLoadingScores(true);
      try {
        const isFamilyMode = meJson?.mode === "family";
        const activeId = isFamilyMode
          ? String(meJson?.family?.activeMemberId || "") || null
          : null;

        const youSubjectId = isFamilyMode ? String(activeId || backendMe) : String(backendMe);

        const youScore = await scoreForUserId(backendMe, youSubjectId, modeRef.current.you);

        // If not family segment, keep family/insurance as 0 (UI hides them anyway)
        let familyScore = 0;
        let insuranceScore = 0;

        const fm = Array.isArray(members) ? members : [];

        if (seg === "family") {
          const familyIds = fm.map((m) => String(m.id)).filter(Boolean);
          familyScore =
            familyIds.length > 0
              ? mean(
                  await Promise.all(
                    familyIds.map((id) => scoreForUserId(backendMe, id, modeRef.current.family))
                  )
                )
              : 0;

          const activeIns =
            fm.find((m) => String(m.id) === String(activeId || ""))?.insuranceId ?? null;

          const insuredIds =
            activeIns
              ? fm
                  .filter((m) => String(m.insuranceId || "") === String(activeIns))
                  .map((m) => String(m.id))
              : [];

          insuranceScore =
            insuredIds.length > 0
              ? mean(
                  await Promise.all(
                    insuredIds.map((id) => scoreForUserId(backendMe, id, modeRef.current.insurance))
                  )
                )
              : 0;

          setFamilyCountMeta(fm.length || 0);
        } else {
          setFamilyCountMeta(0);
        }

        // Workplace (shown only in workplace segment)
        let workplaceScore = 0;
        let employees = 0;
        if (seg === "workplace") {
          const activeCorp =
            fm.find((m) => String(m.id) === String(activeId || ""))?.corporateId ?? null;

          const corpIds =
            activeCorp
              ? fm
                  .filter((m) => String(m.corporateId || "") === String(activeCorp))
                  .map((m) => String(m.id))
              : [];

          employees = corpIds.length || 0;

          workplaceScore =
            corpIds.length > 0
              ? mean(
                  await Promise.all(
                    corpIds.map((id) => scoreForUserId(backendMe, id, modeRef.current.workplace))
                  )
                )
              : 0;
        }
        setEmployeesCountMeta(employees);

        setScoresByKey({
          you: youScore,
          family: familyScore,
          insurance: insuranceScore,
          workplace: workplaceScore,
        });
      } finally {
        setLoadingScores(false);
      }
    },
    [scoreForUserId]
  );

  // ---------- Single refresh pipeline (fixes stale segment + loops) ----------
  const refreshAll = useCallback(async () => {
    const ctx = await getAppContext();
    const nextSeg = (ctx.segment || "individual") as ContextScope;
    const nextUser = ctx.currentUserId || "head";

    setSegment(nextSeg);
    setCurrentUserId(nextUser);

    const gs = await listGroups();
    setSavedGroups(gs);

    const backendMe = localIdToBackendId(nextUser);
    const meJson = await fetchMeApi(backendMe);

    // Only fetch family members if we're in family segment (business behavior unchanged)
    let members: ApiFamilyMember[] = [];
    if (nextSeg === "family") {
      setLoadingMembers(true);
      try {
        members = await fetchFamilyMembersFromApi(backendMe);
        setApiFamilyMembers(members);
      } finally {
        setLoadingMembers(false);
      }
    } else {
      setApiFamilyMembers([]);
    }

    await computeAndSetScores({
      backendMe,
      seg: nextSeg,
      meJson,
      members,
    });
  }, [computeAndSetScores, fetchMeApi]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
  
      (async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
  
        try {
          await refreshAll();
        } finally {
          // ✅ ALWAYS reset, even if screen unfocused mid-flight
          inFlightRef.current = false;
        }
      })();
  
      return () => {
        cancelled = true;
      };
    }, [refreshAll])
  );
  

  useEffect(() => {
    // Run once on mount to avoid "0 until tap" on cold start
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
  
    (async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await refreshAll();
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [refreshAll]);
  


  // Toggle mode + recompute scores (no demo list involved)
  const toggleMode = useCallback(async (key: string) => {
    setModeByCard((prev) => {
      const next = {
        ...prev,
        [key]: prev[key] === "avg14d" ? "today" : "avg14d",
      } as typeof prev;
  
      modeRef.current = next;
      return next;
    });
  
    // If you recompute scores here, keep it after setModeByCard:
    const backendMe = localIdToBackendId(currentUserId || "head");
    const ctx = await getAppContext();
    const seg = (ctx.segment || segment) as ContextScope;
    const meJson = me;
  
    await computeAndSetScores({
      backendMe,
      seg,
      meJson,
      members: apiFamilyMembers,
    });
  }, [apiFamilyMembers, computeAndSetScores, currentUserId, me, segment]);


  const hasFamilyGroup = useMemo(() => {
    const localHas = savedGroups.some((g) => g.type === "Family");
    const apiHas = apiFamilyMembers.length > 0;
    return localHas || apiHas;
  }, [savedGroups, apiFamilyMembers]);

  const insuredCount = useMemo(() => {
    return apiFamilyMembers.filter((m) => String(m.insuranceId || "").trim()).length;
  }, [apiFamilyMembers]);

  const availableSegments: ContextScope[] = useMemo(() => {
    const list: ContextScope[] = ["individual"];
    if (hasFamilyGroup) list.push("family");
    list.push("workplace");
    return list;
  }, [hasFamilyGroup]);

  const onChangeSegment = useCallback(async (next: ContextScope) => {
    setSegment(next);

    const ctx = await getAppContext();
    await setAppContext({ ...ctx, segment: next });

    await patchMe({
      mode: next === "workplace" ? "individual" : next,
    }).catch(() => {});
  }, []);

  const youMeta = useMemo(() => {
    if (me?.mode === "family") {
      const active = apiFamilyMembers.find(
        (m) => String(m.id) === String(activeMemberId || "")
      );
      const nm = active?.name || "Member";
      return `User: ${nm}`;
    }
    const nm = String(me?.name || "You");
    return `User: ${nm}`;
  }, [me, apiFamilyMembers, activeMemberId]);

  const familySubtitle = "Average across your family";
  const insuranceSubtitle = "Average across your insurance group";
  const workplaceSubtitle = "Average across your workplace";

  // ==========================
  // API Family CRUD (MVP)
  // ==========================
  const backendMe = localIdToBackendId(currentUserId || "head");

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ApiFamilyMember["memberType"]>("parent");
  const [memberMsg, setMemberMsg] = useState<string | null>(null);

  const refreshMembersOnly = useCallback(async () => {
    setMemberMsg(null);
    setLoadingMembers(true);
    try {
      const ms = await fetchFamilyMembersFromApi(backendMe);
      setApiFamilyMembers(ms);
      return ms;
    } catch (e: any) {
      setApiFamilyMembers([]);
      setMemberMsg(e?.message ?? "Failed to load family members.");
      return [];
    } finally {
      setLoadingMembers(false);
    }
  }, [backendMe]);

  const createMember = useCallback(async () => {
    setMemberMsg(null);
    const nm = newName.trim();
    if (!nm) return setMemberMsg("Name is required.");

    setLoadingMembers(true);
    try {
      const api = getApiBaseUrl();
      const resp = await fetch(`${api}/v1/family/members`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": backendMe,
        },
        body: JSON.stringify({ name: nm, memberType: newType || "individual" }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || json?.message || "Failed to add member.");

      setNewName("");
      setNewType("parent");
      setAdding(false);

      const ms = await refreshMembersOnly();
      const meJson = await fetchMeApi(backendMe);
      await computeAndSetScores({ backendMe, seg: "family", meJson, members: ms });
    } catch (e: any) {
      setMemberMsg(e?.message ?? "Failed to add member.");
    } finally {
      setLoadingMembers(false);
    }
  }, [backendMe, computeAndSetScores, fetchMeApi, newName, newType, refreshMembersOnly]);

  const updateMember = useCallback(
    async (id: string, patch: Partial<Pick<ApiFamilyMember, "name" | "memberType">>) => {
      setMemberMsg(null);
      setLoadingMembers(true);
      try {
        const api = getApiBaseUrl();
        const resp = await fetch(`${api}/v1/family/members/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-user-id": backendMe,
          },
          body: JSON.stringify(patch),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || json?.message || "Failed to update member.");

        const ms = await refreshMembersOnly();
        const meJson = await fetchMeApi(backendMe);
        await computeAndSetScores({ backendMe, seg: "family", meJson, members: ms });
      } catch (e: any) {
        setMemberMsg(e?.message ?? "Failed to update member.");
      } finally {
        setLoadingMembers(false);
      }
    },
    [backendMe, computeAndSetScores, fetchMeApi, refreshMembersOnly]
  );

  const deleteMember = useCallback(
    async (id: string) => {
      setMemberMsg(null);
      setLoadingMembers(true);
      try {
        const api = getApiBaseUrl();
        const resp = await fetch(`${api}/v1/family/members/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "x-user-id": backendMe },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || json?.message || "Failed to delete member.");

        const remaining = apiFamilyMembers.filter((m) => m.id !== id);

        // If last member deleted => treat as family deletion => fall back to individual mode
        if (remaining.length === 0) {
          const ctx = await getAppContext();
          await setAppContext({ ...ctx, segment: "individual" });

          setSegment("individual");
          await patchMe({ mode: "individual" }).catch(() => {});
          setApiFamilyMembers([]);
          setScoresByKey((prev) => ({ ...prev, family: 0, insurance: 0 }));
          return;
        }

        const ms = await refreshMembersOnly();
        const meJson = await fetchMeApi(backendMe);
        await computeAndSetScores({ backendMe, seg: "family", meJson, members: ms });
      } catch (e: any) {
        setMemberMsg(e?.message ?? "Failed to delete member.");
      } finally {
        setLoadingMembers(false);
      }
    },
    [apiFamilyMembers, backendMe, computeAndSetScores, fetchMeApi, refreshMembersOnly]
  );

  const renderHeader = () => {
    return (

      
      <View style={headerStyles.content}>
        <Text style={headerStyles.title}>Groups</Text>

        <View style={headerStyles.segRow}>
          {availableSegments.map((s) => {
            const active = segment === s;
            return (
              <Pressable
                key={s}
                onPress={() => onChangeSegment(s)}
                style={[headerStyles.segPill, active && headerStyles.segPillOn]}
              >
                <Text style={[headerStyles.segText, active && headerStyles.segTextOn]}>{scopeLabel(s)}</Text>
              </Pressable>
            );
          })}
        </View>

      </View>

    );
  };

  const renderBody = () => {
    return (
      <View style={headerStyles.gcontent}>

        {segment !== "family" && segment !== "workplace" ? (
        <ScoreCard
          title="You"
          subtitle="Your score"
          meta={youMeta}
          score={scoresByKey.you}
          mode={modeByCard.you}
          onToggle={() => toggleMode("you")}
          loading={loadingScores}
        />
      ) : null}

        {segment === "family" ? (
          <ScoreCard
            title="Family"
            subtitle={familySubtitle}
            meta={`${familyCountMeta} members`}
            score={scoresByKey.family}
            mode={modeByCard.family}
            onToggle={() => toggleMode("family")}
            loading={loadingScores}
          />
        ) : null}

        {segment === "family" ? (
          <ScoreCard
            title="Insurance"
            subtitle={insuranceSubtitle}
            meta={`${insuredCount} insured`}
            score={scoresByKey.insurance}
            mode={modeByCard.insurance}
            onToggle={() => toggleMode("insurance")}
            loading={loadingScores}
          />
        ) : null}

        {segment === "workplace" ? (
          <ScoreCard
            title="Workplace"
            subtitle={workplaceSubtitle}
            meta={`${employeesCountMeta} employees`}
            score={scoresByKey.workplace}
            mode={modeByCard.workplace}
            onToggle={() => toggleMode("workplace")}
            loading={loadingScores}
          />
        ) : null}

        <SectionRow
          title="Usage"
          subtitle={segment === "family" ? "Monthly family usage" : "View usage metrics"}
          onPress={() => router.push("/groups/usage")}
        />

        {segment === "family" ? (
          <>
            {/* Create/Join entry points remain intact */}
            {!hasFamilyGroup ? (
              <View style={headerStyles.noFamilyCard}>
                <Text style={headerStyles.noFamilyTitle}>No family yet</Text>
                <Text style={headerStyles.noFamilySub}>
                  Create one to manage members and log for your family.
                </Text>

                <Pressable
                  onPress={() => router.push("/groups/create-family")}
                  style={headerStyles.primaryBtn}
                >
                  <Text style={headerStyles.primaryBtnText}>Create Family</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/groups/join-family")}
                  style={headerStyles.ghostBtn}
                >
                  <Text style={headerStyles.ghostBtnText}>Join</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Members */}
            {hasFamilyGroup ? (
              <View style={headerStyles.card}>
                <Pressable
                  onPress={() => setMembersExpanded((v) => !v)}
                  style={headerStyles.membersHeader}
                >
                  <View>
                    <Text style={headerStyles.membersTitle}>Members</Text>
                    <Text style={headerStyles.membersCount}>
                      {apiFamilyMembers.length} member{apiFamilyMembers.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Text style={headerStyles.chevSmall}>{membersExpanded ? "▾" : "▸"}</Text>
                </Pressable>

                {membersExpanded ? (
                  <>
                    <View style={headerStyles.membersTopRow}>
                 
                    <Pressable
                      onPress={() => {
                        setAdding((v) => !v);
                        setMemberMsg(null);
                      }}
                      style={[headerStyles.smallBtn, adding && { opacity: 0.9 }]}
                    >
                      <Text style={headerStyles.addMemberBtnText}>{adding ? "Cancel" : "Add Member"}</Text>
                    </Pressable>

                      <Pressable
                        onPress={() => router.push("/groups/invite-family")}
                        style={headerStyles.smallBtn}
                      >
                        <Text style={headerStyles.smallBtnText}>Invite</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push("/groups/join-family")}
                        style={headerStyles.smallBtn}
                      >
                        <Text style={headerStyles.smallBtnText}>Join</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push("/groups/assign-insurance")}
                        style={headerStyles.smallBtn}
                      >
                        <Text style={headerStyles.smallBtnText}>Assign Insurance</Text>
                      </Pressable>

                    </View>

                    {adding ? (
                      <View style={headerStyles.addBox}>
                        <Text style={headerStyles.label}>Name</Text>
                        <TextInput
                          value={newName}
                          onChangeText={setNewName}
                          placeholder="e.g., Spouse"
                          placeholderTextColor="rgba(0,0,0,0.45)"
                          style={headerStyles.input}
                        />

                        <Text style={headerStyles.label}>Member type</Text>
                        <Pressable
                          onPress={() => setNewType(nextMemberType(newType))}
                          style={headerStyles.typePill}
                        >
                          <Text style={headerStyles.typePillText}>{memberTypeLabel(newType)} ▾</Text>
                        </Pressable>

                        <View style={{ flexDirection: "row", gap: 10, marginTop: S.sm }}>
                          <Pressable onPress={createMember} style={headerStyles.smallBtn}>
                            <Text style={headerStyles.smallBtnText}>Create</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setAdding(false);
                              setNewName("");
                              setNewType("parent");
                            }}
                            style={headerStyles.smallBtn}
                          >
                            <Text style={headerStyles.smallBtnText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {memberMsg ? <Text style={headerStyles.memberMsg}>{memberMsg}</Text> : null}

                    {loadingMembers ? (
                      <View style={{ paddingVertical: S.md }}>
                        <ActivityIndicator />
                      </View>
                    ) : (


                      <View style={headerStyles.memberGrid}>
  {apiFamilyMembers.map((m) => (
    <View key={m.id} style={headerStyles.memberTile}>
      <View style={headerStyles.memberTileTop}>
        <Text style={headerStyles.memberTileName} numberOfLines={1}>
          {m.name || m.id}
        </Text>

        <Pressable
          onPress={() => deleteMember(m.id)}
          hitSlop={10}
          style={headerStyles.trashBtn}
        >
          <Ionicons name="trash-outline" size={18} color="rgba(0,0,0,0.55)" />
        </Pressable>
      </View>

      <Pressable
        onPress={() =>
          updateMember(m.id, {
            memberType: nextMemberType(m.memberType || "individual"),
          })
        }
        style={headerStyles.typePillTiny}
      >
        <Text style={headerStyles.typePillTinyText}>
          {memberTypeLabel(m.memberType)} ▾
        </Text>
      </Pressable>

      <Text style={headerStyles.memberTileMeta} numberOfLines={1}>
        INS: {m.insuranceId || "—"} • CORP: {m.corporateId || "—"}
      </Text>
    </View>
  ))}
</View>

                      



                    )}
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View style={headerStyles.page}>
      <FlatList
        data={[{ id: "body" }]}
        keyExtractor={(x) => x.id}
        renderItem={() => renderBody()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  
  page: { flex: 1, backgroundColor: Theme.colors.bg },


  simRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: S.md, flexWrap: "wrap" },
  simLabel: { fontWeight: "900", color: "rgba(0,0,0,0.55)" },
  simChip: {
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  simChipOn: { backgroundColor: "rgba(15,118,110,0.18)" },
  simChipText: { fontWeight: "900", color: "rgba(0,0,0,0.55)" },
  simChipTextOn: { color: "#0F766E" },

  noFamilyCard: {
    marginTop: S.md,
    backgroundColor: Theme.colors.bg,
    borderRadius: Theme.radius.lg,
    padding: 16,
  },
  noFamilyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  noFamilySub: { marginTop: 6, color: "rgba(0,0,0,0.55)", fontWeight: "700" },

  primaryBtn: {
    marginTop: S.md,
    backgroundColor: "#0F766E",
    borderRadius: Theme.radius.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900", fontSize: 16 },

  ghostBtn: {
    marginTop: S.md,
    backgroundColor: "rgba(15,118,110,0.10)",
    borderRadius: Theme.radius.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    alignItems: "center",
  },
  ghostBtnText: { color: "#0F766E", fontWeight: "900", fontSize: 16 },

  membersCard: {
    marginTop: S.md,
    backgroundColor: "rgba(15,118,110,0.08)",
    borderRadius: Theme.radius.lg,
    padding: 14,
  },
  membersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  membersTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  membersCount: { marginTop: 2, fontWeight: "800", color: "rgba(0,0,0,0.55)" },
  chevSmall: { fontSize: 20, fontWeight: "900", color: "rgba(0,0,0,0.45)" },

  membersTopRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: S.md },
  smallBtn: {
    backgroundColor: "rgba(15,118,110,0.12)",
    borderRadius: 999,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
  },
  smallBtnText: { fontWeight: "900", color: "#0F766E" },

  addMemberBtn: {
    marginTop: S.md,
    backgroundColor: "rgba(15,118,110,0.10)",
    borderRadius: Theme.radius.lg,
    paddingVertical: S.sm,
    alignItems: "center",
  },
  addMemberBtnText: { fontWeight: "900", color: "#0F766E", fontSize: 14 },

  addBox: {
    marginTop: S.md,
    backgroundColor: Theme.colors.bg,
    borderRadius: Theme.radius.lg,
    padding: 14,
  },
  label: { fontWeight: "900", color: "#0F172A", marginTop: S.md },
  input: {
    marginTop: S.md,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    borderRadius: Theme.radius.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    backgroundColor: Theme.colors.bg,
    fontWeight: "800",
  },
  typePill: {
    marginTop: S.md,
    alignSelf: "flex-start",
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.10)",
  },
  typePillText: { fontWeight: "900", color: "#0F766E" },

  memberMsg: { marginTop: 10, fontWeight: "900", color: "rgba(0,0,0,0.65)" },

  memberRow: {
    marginTop: S.md,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: Theme.radius.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  memberName: { fontWeight: "900", fontSize: 18, color: "#0F172A" },
  memberMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: S.md, flexWrap: "wrap" },

  typePillSmall: {
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.12)",
  },
  typePillSmallText: { fontWeight: "900", color: "#0F766E" },

  memberMetaText: { fontWeight: "900", color: "rgba(0,0,0,0.55)" },

  deleteBtn: {
    backgroundColor: "rgba(220,38,38,0.10)",
    borderRadius: 999,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
  },
  deleteBtnText: { fontWeight: "900", color: "rgba(220,38,38,0.90)" },

  memberRowCompact: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  
  memberTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  
  memberTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  
  memberNameCompact: {
    flex: 1,
    fontWeight: "900",
    fontSize: 16,
    color: "#0F172A",
  },
  
  memberMetaTextCompact: {
    marginTop: 6,
    fontWeight: "800",
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
  },
  
  
  deleteBtnTiny: {
    backgroundColor: "rgba(220,38,38,0.10)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  
  deleteBtnTinyText: {
    fontWeight: "900",
    fontSize: 12,
    color: "rgba(220,38,38,0.90)",
  },
  
  memberGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  
  memberTile: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.10)",
  },
  
  memberTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  
  memberTileName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  
  trashBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  
  typePillTiny: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.12)",
  },
  
  typePillTinyText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F766E",
  },
  
  memberTileMeta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(0,0,0,0.50)",
  },
  


});
