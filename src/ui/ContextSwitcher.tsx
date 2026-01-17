import React, { useMemo, useState } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { ActiveContext } from "@/src/storage/context";
import { isContextAvailable } from "@/src/context/contextRules";
import type { ContextScope } from "@/src/context/contextRules";


type Option = ActiveContext;


function toScope(ctx: ActiveContext): ContextScope {
  switch (ctx.type) {
    case "individual":
      return "individual";
    case "family":
      return "family";
    case "corporate":
      return "workplace";
  }
}

function hasId(x: ActiveContext): x is Extract<ActiveContext, { id: string }> {
    return x.type !== "individual";
  }
  

  function sameContext(a: ActiveContext, b: ActiveContext) {
    if (a.type !== b.type) return false;
    if (!hasId(a)) return true; // individual case
    return hasId(b) && a.id === b.id;
  }
  
  

export function ContextSwitcher({
  value,
  options,
  onChange,
}: {
  value: ActiveContext;
  options: Option[];
  onChange: (v: ActiveContext) => void;
}) {
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (value.type === "individual") return "Individual";
    if (value.type === "family") return `Family: ${value.name}`;
    return `Corporate: ${value.name}`;
  }, [value]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
        <Text style={styles.chev}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Switch context</Text>

            {options
                .filter((opt) => isContextAvailable(toScope(opt), {
                    id: "me",               // id not used for availability
                    familyId: opt.type === "family" ? opt.id : undefined,
                    corporateId: opt.type === "corporate" ? opt.id : undefined,
                }))
                .map((opt) => {
              const optLabel =
                opt.type === "individual"
                  ? "Individual"
                  : opt.type === "family"
                  ? `Family: ${opt.name}`
                  : `Corporate: ${opt.name}`;

                  const selected = sameContext(opt, value);
                

              return (
                <Pressable
                  key={optLabel}
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={[styles.row, selected && styles.rowSelected]}
                >
                  <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{optLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  pillText: { fontWeight: "700" },
  chev: { opacity: 0.6, fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "white", borderRadius: 16, padding: 14 },
  sheetTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  row: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
  rowSelected: { backgroundColor: "rgba(15,118,110,0.12)" },
  rowText: { fontWeight: "700" },
  rowTextSelected: { color: "#0f766e" },
});
