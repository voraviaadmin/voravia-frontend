import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups</Text>
      <Text style={styles.sub}>Individual • Family • Corporate (future)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700" },
  sub: { marginTop: 8, fontSize: 14, opacity: 0.7 },
});
