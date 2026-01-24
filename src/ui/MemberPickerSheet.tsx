import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Theme } from "@/src/ui/theme";
import { S } from "@/src/ui/spacing";

export type PickerOption = { id: string; name: string };

export function MemberPickerSheet({
  visible,
  title = "Log for",
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: PickerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Choose who this scan is for.</Text>

        <View style={styles.grid}>
          {options.map((o) => {
            const active = o.id === selectedId;
            return (
              <Pressable
                key={o.id}
                onPress={() => onSelect(o.id)}
                style={[styles.tile, active && styles.tileActive]}
              >
                <Text style={[styles.tileText, active && styles.tileTextActive]} numberOfLines={1}>
                  {o.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: S.lg,
    paddingTop: 10,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
  },
  sub: {
    marginTop: 4,
    color: Theme.colors.textMuted,
    fontWeight: "700",
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.chipBorder,
    minWidth: "30%",
  },
  tileActive: {
    backgroundColor: Theme.colors.tealSoft,
    borderColor: Theme.colors.tealBorder,
  },
  tileText: {
    fontSize: 13,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
  },
  tileTextActive: {
    color: Theme.colors.textPrimary,
  },
  closeBtn: {
    marginTop: 14,
    alignSelf: "stretch",
    paddingVertical: 12,
    borderRadius: Theme.radius.lg,
    alignItems: "center",
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
  },
  closeText: {
    fontWeight: "900",
    color: Theme.colors.textPrimary,
  },
});
