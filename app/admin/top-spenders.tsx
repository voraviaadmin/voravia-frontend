import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, Pressable } from "react-native";
import { useAdminTopBillingOwners, useProviderOptions } from "../../lib/admin/hooks";
import type { ProviderFilter } from "../../lib/admin/types";

function formatUsd(n: number | undefined | null) {
  const x = Number(n || 0);
  return `$${x.toFixed(2)}`;
}

export default function AdminTopSpendersScreen() {
  const [days, setDays] = useState<7 | 30>(30);
  const [provider, setProvider] = useState<ProviderFilter>("all");

  const top = useAdminTopBillingOwners(days, provider, 20);
  const options = useProviderOptions();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Top Spenders</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>
        Rollups by billingOwnerId (best for “who is costing money”).
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 10 }}>
        {options.map((o) => {
          const active = provider === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setProvider(o.value)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? "#111827" : "#e5e7eb",
                backgroundColor: active ? "#111827" : "transparent",
              }}
            >
              <Text style={{ color: active ? "white" : "#111827" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable
          onPress={() => setDays(7)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: days === 7 ? "#111827" : "#e5e7eb",
            backgroundColor: days === 7 ? "#111827" : "transparent",
          }}
        >
          <Text style={{ color: days === 7 ? "white" : "#111827" }}>7d</Text>
        </Pressable>
        <Pressable
          onPress={() => setDays(30)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: days === 30 ? "#111827" : "#e5e7eb",
            backgroundColor: days === 30 ? "#111827" : "transparent",
          }}
        >
          <Text style={{ color: days === 30 ? "white" : "#111827" }}>30d</Text>
        </Pressable>
      </View>

      {top.loading && <ActivityIndicator />}
      {!!top.error && (
        <View style={{ padding: 12, borderWidth: 1, borderColor: "#fecaca", borderRadius: 12 }}>
          <Text style={{ fontWeight: "600" }}>Error</Text>
          <Text style={{ marginTop: 6 }}>{top.error}</Text>
          <Pressable onPress={top.reload} style={{ marginTop: 10 }}>
            <Text style={{ textDecorationLine: "underline" }}>Retry</Text>
          </Pressable>
        </View>
      )}

      {(top.data?.items || []).map((it, idx) => (
        <View
          key={it.billingOwnerId}
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 12, opacity: 0.7 }}>#{idx + 1}</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", marginTop: 4 }}>
          {it.label || it.billingOwnerId}
          </Text>
          <Text style={{ marginTop: 6 }}>
              Total spend: <Text style={{ fontWeight: "700" }}>{formatUsd(it.totalUsd)}</Text>
          </Text>
          <Text style={{ marginTop: 4, opacity: 0.8 }}>
            {it.events} events
            {typeof it.activeUsers === "number" ? ` • ${it.activeUsers} active users` : ""}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
