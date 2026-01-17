import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { listGroups, Group } from "@/src/storage/groups";
import { RollupCard, RollupCardModel } from "@/src/ui/RollupCard";

import { getAppContext, setAppContext } from "@/src/storage/appContext";
import { listUsers, seedDemoHousehold, UserProfile } from "@/src/storage/users";

import type { ContextScope } from "@/src/context/contextRules";
import {
  clampContext,
  getContextEligibility,
  getAvailableContexts,
} from "@/src/context/contextRules";

function countBy(
  users: UserProfile[],
  key: "familyId" | "insuranceId" | "corporateId",
  value?: string
) {
  if (!value) return 0;
  return users.filter((u) => u[key] === value).length;
}

function scopeLabel(s: ContextScope) {
  if (s === "individual") return "Individual";
  if (s === "family") return "Family";
  return "Workplace";
}

/**
 * Step B helper (kept): Rollups determined only by activeContext.
 */
function buildRollups(params: {
  activeContext: ContextScope;
  me: UserProfile;
  users: UserProfile[];
  familyGroup?: Group | null;
  activeFamilyId?: string;
}): RollupCardModel[] {
  const { activeContext, me, users, familyGroup, activeFamilyId } = params;

  // Placeholder scores (until backend)
  const YOU_SCORE = 82;
  const FAMILY_SCORE = 82;

  if (activeContext === "individual") {
    return [
      {
        title: "You",
        subtitle: "Personal health score · current streak",
        score: YOU_SCORE,
        meta: "Improving",
      },
    ];
  }

  if (activeContext === "family") {
    const cards: RollupCardModel[] = [];

    if (activeFamilyId) {
      const familyMembersCount = countBy(users, "familyId", activeFamilyId);
      cards.push({
        title: familyGroup?.name ?? "Family",
        subtitle: `${familyMembersCount || 1} members · 5-day streak`,
        score: FAMILY_SCORE,
        meta: "Improving",
      });
    }

    if (me.insuranceId) {
      const myInsuranceId = me.insuranceId;
      const insuredMembers = users.filter((u) => u.insuranceId === myInsuranceId).length;
      const INS_SCORE = myInsuranceId === "INS-B" ? 76 : 79;

      cards.push({
        title: "Insurance",
        subtitle: `${myInsuranceId} · ${insuredMembers || 1} insured member${
          (insuredMembers || 1) === 1 ? "" : "s"
        }`,
        score: INS_SCORE,
        meta: "Improving",
      });
    }

    return cards;
  }

  // Workplace
  const corporateId = me.corporateId;
  if (!corporateId) return [];

  const employees = countBy(users, "corporateId", corporateId);
  const CORP_SCORE = corporateId === "CORP-Y" ? 73 : 75;

  return [
    {
      title: corporateId === "CORP-Y" ? "Other Health Group" : "Voravia Health Group",
      subtitle: `${employees || 1} employees`,
      score: CORP_SCORE,
      meta: "Aggregate only",
      footnote: "Data: N-1 aggregate",
    },
  ];
}

export default function GroupsScreen() {
  const [segment, setSegment] = useState<ContextScope>("individual");
  const [savedGroups, setSavedGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("head");
  const [membersExpanded, setMembersExpanded] = useState(true);

  /**
   * ✅ Step C: downgrade safety on screen focus
   * - reload ctx/users/groups
   * - recompute eligibility
   * - clamp invalid segment -> persist + update state
   */
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

        // Persist clamp if needed
        if (clamped !== desired) {
          await setAppContext({ segment: clamped, currentUserId: resolvedUserId });
        }

        // Update UI state
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

  const me = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId]
  );

  const familyGroups = useMemo(
    () => savedGroups.filter((g) => g.type === "Family"),
    [savedGroups]
  );

  const familyGroup = useMemo(() => familyGroups[0] ?? null, [familyGroups]);

  const hasFamilyGroup = useMemo(
    () => savedGroups.some((g) => g.type === "Family"),
    [savedGroups]
  );

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

  /**
   * Step A: eligible segments list (kept)
   */
  const eligibility = useMemo(() => {
    return getContextEligibility(me, { hasFamilyGroup });
  }, [me, hasFamilyGroup]);

  const SEGMENTS = useMemo<ContextScope[]>(() => {
    return getAvailableContexts(eligibility);
  }, [eligibility]);

  /**
   * ✅ Step C: if eligibility changes while you're on this screen (simulate user / ids changed)
   * clamp the current segment immediately.
   */
  useMemo(() => {
    if (!me) return;
    const clamped = clampContext(segment, me, { hasFamilyGroup });
    if (clamped !== segment) {
      // Fire and forget: state sync + persistence
      setSegment(clamped);
      setAppContext({ segment: clamped, currentUserId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, me?.familyId, me?.corporateId, hasFamilyGroup]);

  const onChangeSegment = useCallback(
    async (next: ContextScope) => {
      setSegment(next);
      await setAppContext({ segment: next, currentUserId });
    },
    [currentUserId]
  );

  /**
   * ✅ Step C: when simulating a new user, clamp segment based on THAT user
   */
  const onChangeUser = useCallback(
    async (nextUserId: string) => {
      const nextMe = users.find((u) => u.id === nextUserId) ?? null;
      const clamped = clampContext(segment, nextMe, { hasFamilyGroup });

      setCurrentUserId(nextUserId);
      setSegment(clamped);

      await setAppContext({ segment: clamped, currentUserId: nextUserId });
    },
    [users, segment, hasFamilyGroup]
  );

  const showCreateFamilyCTA = segment === "family" && familyGroups.length === 0;

  /**
   * Step B: rollups consume activeContext only (kept)
   */
  const rollups = useMemo<RollupCardModel[]>(() => {
    if (!me) return [];
    return buildRollups({
      activeContext: segment,
      me,
      users,
      familyGroup,
      activeFamilyId,
    });
  }, [segment, me, users, familyGroup, activeFamilyId]);

  const devSeed = useCallback(async () => {
    const famId = familyGroup?.id ?? "FAM-1";
    await seedDemoHousehold(famId);
    const us = await listUsers();
    setUsers(us);
    await onChangeUser("head");
  }, [familyGroup, onChangeUser]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Groups</Text>

      {/* Segmented Control (eligible contexts only) */}
      <View style={styles.segmentRow}>
        {SEGMENTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onChangeSegment(s)}
            style={[styles.segment, segment === s && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, segment === s && styles.segmentTextActive]}>
              {scopeLabel(s)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Dev simulate (hidden in workplace) */}
      {__DEV__ && segment !== "workplace" ? (
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Simulate:</Text>

          <Pressable
            onPress={() => onChangeUser("head")}
            style={[styles.devChip, currentUserId === "head" && styles.devChipActive]}
          >
            <Text style={[styles.devChipText, currentUserId === "head" && styles.devChipTextActive]}>
              Head
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onChangeUser("spouse")}
            style={[styles.devChip, currentUserId === "spouse" && styles.devChipActive]}
          >
            <Text
              style={[
                styles.devChipText,
                currentUserId === "spouse" && styles.devChipTextActive,
              ]}
            >
              Spouse
            </Text>
          </Pressable>

          {users.length === 0 ? (
            <Pressable onPress={devSeed} style={styles.devSeedBtn}>
              <Text style={styles.devSeedText}>Seed demo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Family empty state */}
      {showCreateFamilyCTA ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No family group yet</Text>
          <Text style={styles.emptySub}>Create one to track a shared health score and streaks.</Text>

          <Pressable onPress={() => router.push("/groups/create-family")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Create Family</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Family actions (family only) */}
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

      {/* Members (family only) */}
      {segment === "family" && activeFamilyId ? (
        <View style={styles.membersBox}>
          <Pressable
            onPress={() => setMembersExpanded((v) => !v)}
            style={styles.membersHeaderPressable}
          >
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

      {/* Rollups */}
      <FlatList
        data={rollups}
        keyExtractor={(item, i) => `${item.title}-${i}`}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
        renderItem={({ item }) => <RollupCard item={item} />}
        ListFooterComponent={
          <View style={{ marginTop: 14, paddingBottom: 8 }}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/context-gate",
                  params: { force: "1" },
                })
              }
              style={styles.changeContextBtn}
            >
              <Text style={styles.changeContextBtnText}>Change context</Text>
            </Pressable>
          </View>
        }
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
  secondaryBtnText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#0f766e",
  },

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

  changeContextBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#0f766e",
  },
  changeContextBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
});
