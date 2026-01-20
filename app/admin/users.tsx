import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View, Pressable } from "react-native";
import { useAdminUsers } from "../../lib/admin/hooks";

export default function AdminUsersScreen() {
  const [days, setDays] = useState<7 | 30>(30);
  const users = useAdminUsers(days);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Users</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>
        DAU/WAU/MAU should be computed from usage events (or rollups if you store userId).
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 12 }}>
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

      {users.loading && <ActivityIndicator />}
      {!!users.error && (
        <View style={{ padding: 12, borderWidth: 1, borderColor: "#fecaca", borderRadius: 12 }}>
          <Text style={{ fontWeight: "600" }}>Error</Text>
          <Text style={{ marginTop: 6 }}>{users.error}</Text>
          <Pressable onPress={users.reload} style={{ marginTop: 10 }}>
            <Text style={{ textDecorationLine: "underline" }}>Retry</Text>
          </Pressable>
        </View>
      )}

      {users.data && (
        <View style={{ marginTop: 6 }}>
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <Text style={{ fontSize: 12, opacity: 0.7 }}>Totals</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 6 }}>
              {users.data.totalUsers} users
            </Text>
            <Text style={{ marginTop: 4, opacity: 0.85 }}>
              {users.data.totalFamilies} families
            </Text>
          </View>

          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 12 }}>
            <Text style={{ fontSize: 12, opacity: 0.7 }}>Activity</Text>
            <Text style={{ marginTop: 6 }}>
              DAU: <Text style={{ fontWeight: "700" }}>{users.data.dau}</Text>
            </Text>
            <Text style={{ marginTop: 4 }}>
              WAU: <Text style={{ fontWeight: "700" }}>{users.data.wau}</Text>
            </Text>
            <Text style={{ marginTop: 4 }}>
              MAU: <Text style={{ fontWeight: "700" }}>{users.data.mau}</Text>
            </Text>
          </View>

          {!!users.data.activeByDay?.length && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
                Active users by day
              </Text>
              {users.data.activeByDay.slice(-14).map((d) => (
                <View key={d.day} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ opacity: 0.8 }}>{d.day}</Text>
                  <Text style={{ fontWeight: "600" }}>{d.activeUsers}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
