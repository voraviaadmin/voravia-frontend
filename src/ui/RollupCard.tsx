import React from "react";
import { View, Text, StyleSheet } from "react-native";

const isInsuranceTitle = (title: string) => title.startsWith("Insurance:");
const getInsuranceIdFromTitle = (title: string) =>
  title.replace("Insurance:", "").trim();

export type RollupCardModel = {
  title: string; // e.g., "Patel Family" or "Insurance: INS-A"
  subtitle: string; // e.g., "4 members · 5-day streak"
  score: number; // e.g., 82
  meta?: string; // e.g., "Improving"
  footnote?: string; // e.g., "Data: N-1 aggregate"
};

export function RollupCard({ item }: { item: RollupCardModel }) {
  const insurance = isInsuranceTitle(item.title);
  const rollupInsuranceId = insurance ? getInsuranceIdFromTitle(item.title) : "";

  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          {insurance ? (
            <View style={styles.insuranceTitleRow}>
              <Text style={styles.insuranceIcon}>🛡</Text>
              <Text style={styles.insuranceTitle}>Insurance</Text>
              <View style={styles.insurancePill}>
                <Text style={styles.insurancePillText}>{rollupInsuranceId}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          )}

          <Text style={styles.subtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>

        <Text style={styles.score}>{item.score}</Text>
      </View>

      {item.meta || item.footnote ? (
        <View style={styles.rowBottom}>
          {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : <View />}
          {item.footnote ? (
            <Text style={styles.footnote}>{item.footnote}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Default (non-insurance) title
  title: {
    fontSize: 16,
    fontWeight: "800",
  },

  // Insurance title row
  insuranceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insuranceIcon: {
    fontSize: 14,
    opacity: 0.9,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  insurancePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15,118,110,0.12)",
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.30)",
  },
  insurancePillText: {
    fontWeight: "900",
    fontSize: 12,
    color: "#0f766e",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(0,0,0,0.65)",
  },
  score: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0f766e",
  },
  rowBottom: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
  },
  footnote: {
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
  },
});
