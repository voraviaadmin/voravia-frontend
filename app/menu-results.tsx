import { useEffect, useState } from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { api } from "./lib/api";

export default function MenuResults() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const uploadKey = params.get("key")!;

  const [rated, setRated] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const profile = {
    diabetes: true,
    htn: true,
    nafld: false,
    goal: "Lose",
  };

  async function rateMenu() {
    setLoading(true);
    const res = await api<any>("/api/menu/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadKey,
        items: [],
        profile,
      }),
    });

    setRated(res.ratedItems || []);
    setLoading(false);
  }

  useEffect(() => {
    rateMenu();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>
        Menu Rating
      </Text>

      {loading && <Text>Rating menu…</Text>}

      {rated.map((r, i) => (
        <View
          key={i}
          style={{
            padding: 12,
            marginVertical: 6,
            borderRadius: 10,
            backgroundColor:
              r.verdict === "FIT"
                ? "#d1fae5"
                : r.verdict === "MODERATE"
                ? "#fef3c7"
                : "#fee2e2",
          }}
        >
          <Text style={{ fontWeight: "bold" }}>{r.name}</Text>
          <Text>Score: {r.score}</Text>
          <Text>Verdict: {r.verdict}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
