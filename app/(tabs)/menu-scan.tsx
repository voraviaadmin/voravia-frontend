import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function MenuScanScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{ restaurantId?: string; restaurantName?: string }>();

  const [menuText, setMenuText] = useState("");
  const [busy, setBusy] = useState(false);

  const rateText = (txt: string) => {
    const t = txt.trim();
    if (!t) return Alert.alert("No text", "Add or extract menu text first.");
    router.push({
      pathname: "/(tabs)/menu-results",
      params: { restaurantName: p.restaurantName ?? "", menuText: t },
    });
  };

  const onPickImageWeb = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/menu/ocr", { method: "POST", body: form as any });
      if (!res.ok) throw new Error(`OCR error: ${res.status}`);
      const data = await res.json();

      const extracted = (data.text ?? "").toString();
      if (!extracted.trim()) throw new Error("No text extracted.");
      setMenuText(extracted);
    } catch (e: any) {
      Alert.alert("OCR failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu Scan</Text>
      <Text style={styles.sub}>{p.restaurantName ?? "Restaurant"}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>1) Upload menu photo (Web)</Text>

        {Platform.OS === "web" ? (
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImageWeb(f);
            }}
            style={{ marginTop: 10 }}
          />
        ) : (
          <Text style={styles.note}>
            For mobile camera menu scan, we’ll add Expo ImagePicker next.
          </Text>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>2) Or paste menu text</Text>
        <TextInput
          value={menuText}
          onChangeText={setMenuText}
          placeholder="Paste menu items here…"
          placeholderTextColor="#7A9296"
          multiline
          style={styles.input}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => rateText(menuText)}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>{busy ? "Extracting…" : "Rate & filter items"}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFB", paddingTop: 64, paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#0B2A2F" },
  sub: { marginTop: 6, color: "#4A6468", fontWeight: "700" },
  card: { marginTop: 14, backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4EFF1", padding: 16 },
  label: { fontWeight: "900", color: "#0B2A2F" },
  input: {
    marginTop: 10,
    minHeight: 220,
    borderWidth: 1,
    borderColor: "#DCECEF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F7FCFD",
    color: "#0B2A2F",
    fontWeight: "700",
    textAlignVertical: "top",
  },
  primaryBtn: { marginTop: 12, backgroundColor: "#0E7C86", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "900" },
  secondaryBtn: { marginTop: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4EFF1", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  secondaryBtnText: { color: "#0B2A2F", fontWeight: "900" },
  note: { marginTop: 10, fontSize: 12, color: "#6B8387", fontWeight: "600", lineHeight: 16 },
  pressed: { opacity: 0.86 },
});
