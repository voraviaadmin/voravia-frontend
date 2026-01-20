import React, { useMemo, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  useAdminByDay,
  useAdminCostPerUser,
  useAdminSummary,
  useProviderOptions,
} from "../../lib/admin/hooks";
import type { ProviderFilter } from "../../lib/admin/types";

function formatUsd(n: number | undefined | null) {
  const x = Number(n || 0);
  return `$${x.toFixed(2)}`;
}

function Card(props: {
  title?: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: "white",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          padding: 12,
          marginTop: 10,
        },
        props.style,
      ]}
    >
      {!!props.title && (
        <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 10 }}>
          {props.title}
        </Text>
      )}
      {props.children}
    </View>
  );
}

function Tile(props: { label: string; value: string; sub?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "white",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 12,
      }}
    >
      <Text style={{ fontSize: 12, opacity: 0.7 }}>{props.label}</Text>
      <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 6 }}>
        {props.value}
      </Text>
      {!!props.sub && (
        <Text style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          {props.sub}
        </Text>
      )}
    </View>
  );
}

function ProviderPills(props: {
  provider: ProviderFilter;
  setProvider: (p: ProviderFilter) => void;
}) {
  const options = useProviderOptions();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
      {options.map((o) => {
        const active = props.provider === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => props.setProvider(o.value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? "#111827" : "#e5e7eb",
              backgroundColor: active ? "#111827" : "transparent",
            }}
          >
            <Text style={{ color: active ? "white" : "#111827" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DaysPills(props: { days: 7 | 30; setDays: (d: 7 | 30) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
      <Pressable
        onPress={() => props.setDays(7)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: props.days === 7 ? "#111827" : "#e5e7eb",
          backgroundColor: props.days === 7 ? "#111827" : "transparent",
        }}
      >
        <Text style={{ color: props.days === 7 ? "white" : "#111827" }}>7d</Text>
      </Pressable>
      <Pressable
        onPress={() => props.setDays(30)}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: props.days === 30 ? "#111827" : "#e5e7eb",
          backgroundColor: props.days === 30 ? "#111827" : "transparent",
        }}
      >
        <Text style={{ color: props.days === 30 ? "white" : "#111827" }}>
          30d
        </Text>
      </Pressable>
    </View>
  );
}

export default function AdminOverviewScreen() {
  const [days, setDays] = useState<7 | 30>(30);
  const [provider, setProvider] = useState<ProviderFilter>("all");

  const summary = useAdminSummary(days, provider);
  const costPerUser = useAdminCostPerUser(days, provider);
  const byDay = useAdminByDay(days, provider);

  const series = byDay.data?.series || [];

  const maxCost = useMemo(() => {
    let m = 0;
    for (const p of series) m = Math.max(m, Number(p.costUsd || 0));
    return m || 1;
  }, [series]);

  const totalEvents = useMemo(() => {
    const rows = summary.data?.byService || [];
    let sum = 0;
    for (const r of rows) sum += Number(r.events || 0);
    return sum;
  }, [summary.data]);

  const topServices = useMemo(() => {
    const rows = summary.data?.byService || [];
    // sort by cost desc
    const sorted = [...rows].sort((a: any, b: any) => Number(b.costUsd || 0) - Number(a.costUsd || 0));
    return sorted.slice(0, 8);
  }, [summary.data]);

  const dailyRows = useMemo(() => {
    // show up to 10 most recent days (works well for 10+ days too; card can be made scrollable later)
    return series.slice(-10);
  }, [series]);

  const loading = summary.loading || costPerUser.loading || byDay.loading;
  const error = summary.error || costPerUser.error || byDay.error;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 28,
        backgroundColor: "#f3f4f6", // light gray like the mock
      }}
    >
      {/* Header row: Overview + links */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Overview</Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Link href="/admin/users" asChild>
            <Pressable>
              <Text style={{ textDecorationLine: "underline" }}>Users</Text>
            </Pressable>
          </Link>
          <Link href="/admin/top-spenders" asChild>
            <Pressable>
              <Text style={{ textDecorationLine: "underline" }}>Top Spenders</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={{ marginTop: 6, opacity: 0.7 }}>
        “Today so far” is UTC-based (backend uses UTC start-of-day).
      </Text>

      {/* Filters */}
      <View style={{ marginTop: 14 }}>
        <ProviderPills provider={provider} setProvider={setProvider} />
        <DaysPills days={days} setDays={setDays} />
      </View>

      {/* Loading / Error */}
      {loading && (
        <View style={{ paddingVertical: 10 }}>
          <ActivityIndicator />
        </View>
      )}

      {!!error && (
        <View
          style={{
            marginTop: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: "#fecaca",
            borderRadius: 12,
            backgroundColor: "white",
          }}
        >
          <Text style={{ fontWeight: "700" }}>Admin fetch error</Text>
          <Text style={{ marginTop: 6 }}>{error}</Text>
          <Pressable
            onPress={() => {
              summary.reload();
              costPerUser.reload();
              byDay.reload();
            }}
            style={{ marginTop: 10 }}
          >
            <Text style={{ textDecorationLine: "underline" }}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* KPI tiles 2x2 */}
      <View style={{ marginTop: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile
            label={`Total cost (last ${days}d)`}
            value={formatUsd(summary.data?.totalUsd)}
            sub={`Provider: ${provider}`}
          />
          <Tile
            label="Today so far (UTC)"
            value={formatUsd(summary.data?.todaySoFarUsd)}
            sub={summary.data?.today ? `Today: ${summary.data.today}` : undefined}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile
            label="Cost per active user"
            value={formatUsd(costPerUser.data?.costPerActiveUserUsd)}
            sub={`Active users: ${costPerUser.data?.activeUsers ?? 0}`}
          />
          <Tile
            label="Events"
            value={String(totalEvents || 0)}
            sub="(rollups + today so far)"
          />
        </View>
      </View>

      {/* Daily costs card */}
      <Card title="Daily costs">
        {dailyRows.length === 0 ? (
          <Text style={{ opacity: 0.7 }}>No daily data yet.</Text>
        ) : (
          dailyRows.map((p: any) => {
            const ratio = Math.max(0, Number(p.costUsd || 0)) / maxCost;
            return (
              <View key={p.day} style={{ marginBottom: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ opacity: 0.8 }}>{p.day}</Text>
                  <Text style={{ fontWeight: "700" }}>
                    {formatUsd(p.costUsd)}
                  </Text>
                </View>

                {/* thin bar like mock */}
                <View
                  style={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: "#e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: "#111827",
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* Top services card */}
      <Card title="Top services">
        {topServices.length === 0 ? (
          <Text style={{ opacity: 0.7 }}>No service breakdown yet.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {topServices.map((r: any) => (
              <View
                key={`${r.provider}:${r.service}`}
                style={{
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 12,
                  padding: 10,
                  backgroundColor: "white",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <Text style={{ fontWeight: "700", flex: 1 }}>
                    {r.provider} / {r.service}
                  </Text>
                  <Text style={{ fontWeight: "700" }}>
                    {formatUsd(r.costUsd)}
                  </Text>
                </View>

                <Text style={{ marginTop: 4, opacity: 0.75, fontSize: 12 }}>
                  {formatUsd(r.costUsd)} • {Number(r.events || 0)} events
                </Text>
              </View>
            ))}
          </View>
        )}
        <Text
          style={{
            fontSize: 12,
            color: "#6B7280", // muted gray
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          Totals are computed from unrounded usage data and may differ slightly from the
          sum of individual line items.
        </Text>

      </Card>
    </ScrollView>
  );
}
