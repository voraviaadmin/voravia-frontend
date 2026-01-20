import { useEffect, useMemo, useState } from "react";
import { adminGet } from "./api";
import type {
  ProviderFilter,
  SummaryResponse,
  TopBillingOwnersResponse,
  UsersResponse,
  CostPerUserResponse,
  CostsResponse,
} from "./types";

type LoadState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};
import type { ByDayResponse } from "./types";


function useLoad<T>(loader: () => Promise<T>, deps: any[]): LoadState<T> {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = () => setTick((x) => x + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload };
}


export function normalizeSummary(x: any) {
  if (!x) return x;
  // tolerate common casing mistakes
  if (x.todayStartTS && !x.todayStartTs) x.todayStartTs = x.todayStartTS;
  return x;
}


export function useProviderOptions() {
  return useMemo(
    () =>
      [
        { label: "All", value: "all" as const },
        { label: "Google", value: "google" as const },
        { label: "OpenAI", value: "openai" as const },
      ] as const,
    []
  );
}

export function useAdminSummary(days: number, provider: ProviderFilter) {
  return useLoad<SummaryResponse>(
    async () => normalizeSummary(await adminGet("/admin/metrics/summary", { days, provider })) as SummaryResponse,
    [days, provider]
  );
}


export function useAdminCosts(days: number, provider: ProviderFilter) {
  return useLoad<CostsResponse>(
    () => adminGet("/admin/metrics/costs", { days, provider }),
    [days, provider]
  );
}

export function useAdminCostPerUser(days: number, provider: ProviderFilter) {
  return useLoad<CostPerUserResponse>(
    () => adminGet("/admin/metrics/cost-per-user", { days, provider }),
    [days, provider]
  );
}

export function useAdminUsers(days: number) {
  return useLoad<UsersResponse>(() => adminGet("/admin/metrics/users", { days }), [
    days,
  ]);
}

export function useAdminTopBillingOwners(
  days: number,
  provider: ProviderFilter,
  limit: number
) {
  return useLoad<TopBillingOwnersResponse>(
    () => adminGet("/admin/metrics/top-billing-owners", { days, provider, limit }),
    [days, provider, limit]
  );
}


export function useAdminByDay(days: number, provider: ProviderFilter) {
  return useLoad<ByDayResponse>(
    () => adminGet("/admin/metrics/by-day", { days, provider }),
    [days, provider]
  );
}
