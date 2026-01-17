import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MeMode = "individual" | "family" | "workplace";

export type FamilyMember = {
  id: string;
  displayName: string;
  relationship?: string;
  avatarUrl?: string | null;
};

export type MeResponse = {
  userId: string;
  mode: MeMode;
  family: {
    activeMemberId: string | null;
    members: FamilyMember[];
  };
};

function getApiBaseUrl() {
  const envUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  return envUrl.length > 0 ? envUrl : "http://localhost:8787";
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "u_head",   // <--- ADD THIS (or dev-user, but pick ONE)
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  return (await res.json()) as T;
}


export async function patchMe(body: {
  mode?: "individual" | "family" | "workplace";
  family?: { activeMemberId?: string | null };
}) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/v1/me?userId=u_head`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH /v1/me failed: ${text}`);
  }

  return res.json();
}


/**
 * Normalize multiple possible /v1/me shapes into:
 * {
 *   userId,
 *   mode,
 *   family: { activeMemberId, members }
 * }
 */
function normalizeMe(raw: any): MeResponse {
  const userId = String(raw?.userId || "u_self");

  // Shape A (what we WANT long-term)
  // { mode, family: { activeMemberId, members:[{id,displayName}]} }
  if (raw?.mode && raw?.family?.members) {
    const mode = raw.mode as MeMode;
    const members: FamilyMember[] = (raw.family.members || []).map((m: any) => ({
      id: String(m.id),
      displayName: String(m.displayName ?? m.name ?? m.id),
      relationship: m.relationship ? String(m.relationship) : undefined,
      avatarUrl: m.avatarUrl ?? null,
    }));

    return {
      userId,
      mode,
      family: {
        activeMemberId: raw.family.activeMemberId ? String(raw.family.activeMemberId) : null,
        members,
      },
    };
  }

  // Shape B (your CURRENT backend)
  // {
  //   userId,
  //   activeProfile: "family",
  //   context: { mode: "family" },
  //   family: [{id, name}, ...]
  // }
  const modeRaw = raw?.context?.mode || raw?.mode || "individual";
  const mode: MeMode =
    modeRaw === "family" || modeRaw === "workplace" || modeRaw === "individual"
      ? modeRaw
      : "individual";

  const familyArr = Array.isArray(raw?.family) ? raw.family : [];
  const members: FamilyMember[] = familyArr.map((m: any) => ({
    id: String(m.id),
    displayName: String(m.displayName ?? m.name ?? m.id),
    relationship: m.relationship ? String(m.relationship) : undefined,
    avatarUrl: m.avatarUrl ?? null,
  }));

  // Best-effort active member:
  // if userId matches a member, use that, else null
  const activeMemberId = members.some((m) => m.id === userId) ? userId : null;

  return {
    userId,
    mode,
    family: {
      activeMemberId,
      members,
    },
  };
}

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const raw = await fetchJSON<any>("/v1/me?userId=u_head");

      if (requestId !== requestIdRef.current) return;

      const normalized = normalizeMe(raw);
      setMe(normalized);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(e as Error);
      setMe(null);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeMember = useMemo<FamilyMember | null>(() => {
    if (!me?.family?.activeMemberId) return null;
    return me.family.members.find((m) => m.id === me.family.activeMemberId) ?? null;
  }, [me]);

  return { me, activeMember, loading, error, refresh };
}
