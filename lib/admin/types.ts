export type ProviderFilter = "all" | "google" | "openai";

export type ServiceCostRow = {
  provider: string;
  service: string;
  costUsd: number;
  events: number;
};

export type SummaryResponse = {
  windowDays: number;
  provider: string;
  today: string;
  todayStartTs: number;
  totalRollupUsd?: number;
  todaySoFarUsd: number;
  totalUsd: number;
  byService: ServiceCostRow[];
};

export type ByDayPoint = {
  day: string;
  costUsd: number;
  events: number;
  activeUsers?: number;
};

export type ByDayResponse = {
  windowDays: number;
  provider: string;
  series: ByDayPoint[];
};

export type TopBillingOwnerRow = {
  billingOwnerId: string;
  label?: string;
  totalUsd: number;
  events: number;
  activeUsers?: number;
};

export type TopBillingOwnersResponse = {
  windowDays: number;
  provider: string;
  items: TopBillingOwnerRow[];
};

export type UsersResponse = {
  totalUsers: number;
  totalFamilies: number;
  dau: number;
  wau: number;
  mau: number;
  activeByDay?: Array<{ day: string; activeUsers: number }>;
};

export type CostPerUserResponse = {
  windowDays: number;
  provider: string;
  totalUsd: number;
  activeUsers: number;
  costPerActiveUserUsd: number;
};

export type CostsResponse = {
  windowDays: number;
  provider: string;
  totalUsd: number;
  byService: ServiceCostRow[];
};
