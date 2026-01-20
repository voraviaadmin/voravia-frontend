import React from "react";
import { ScrollView, Text, View } from "react-native";

export default function AdminApiUsageScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>API Usage</Text>
      <View style={{ marginTop: 10 }}>
        <Text style={{ opacity: 0.7 }}>
          Placeholder screen. For v1 you can keep everything in Overview + Top Spenders.
          Later: add tables for provider/service + alerts (spikes, error rates).
        </Text>
      </View>
    </ScrollView>
  );
}
