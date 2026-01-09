import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function RestaurantDetailsScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{
    id?: string; name?: string; cuisine?: string; lat?: string; lon?: string; score?: string; verdict?: string;
  }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{p.name ?? "Restaurant"}</Text>
      <Text style={styles.sub}>{p.cuisine || "Cuisine unknown"}</Text>

      <View style={styles.card}>
        <Text style={styles.kv}>Score: <Text style={styles.bold}>{p.score ?? "—"}</Text> ({p.verdict ?? "—"})</Text>
        <Text style={styles.kv}>Location: <Text style={styles.bold}>{p.lat ?? "—"}, {p.lon ?? "—"}</Text></Text>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/menu-scan",
              params: { restaurantId: p.id ?? "", restaurantName: p.name ?? "" },
            })
          }
        >
          <Text style={styles.primaryBtnText}>Menu scan / paste</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingTop: Platform.select({ ios: 64, android: 36, default: 36 }), paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },
  card: { marginTop: 14, backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4EFF1", padding: 16 },
  kv: { marginTop: 8, color: "#0B2A2F", fontWeight: "700" },
  bold: { fontWeight: "900" },
  primaryBtn: { marginTop: 14, backgroundColor: "#0E7C86", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "900" },
  secondaryBtn: { marginTop: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4EFF1", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },
  pressed: { opacity: 0.86 },
});
