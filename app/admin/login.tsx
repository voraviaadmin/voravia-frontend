import React, { useEffect, useState } from "react";
import { useRouter, useNavigation } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { adminPost } from "../../lib/admin/api";
import { setAdminSession } from "../../lib/admin/session";

type LoginResp = {
  adminSessionToken: string;
  expiresAt: string;
  email: string;
};

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);


  const navigation = useNavigation();

useEffect(() => {
  navigation.setOptions({
    headerLeft: () => (
      <Pressable
        onPress={() => router.replace("/context-gate?force=1")}
        style={{ paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Text style={{ fontWeight: "700" }}>Back</Text>
      </Pressable>
    ),
  });
}, [navigation, router]);


  async function onLogin() {
    setErr(null);
    setBusy(true);
    try {
      const resp = await adminPost<LoginResp>("/admin/auth/login", { email, password });
      await setAdminSession(resp.adminSessionToken, resp.email);
      router.replace("/admin");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Admin Login</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>
        Sign in with an allowlisted email + admin password.
      </Text>

      <View style={{ marginTop: 16 }}>
        <Text style={{ opacity: 0.8 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="owner@company.com"
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        />

        <Text style={{ opacity: 0.8, marginTop: 14 }}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          style={{
            marginTop: 6,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        />

        {!!err && (
          <View style={{ marginTop: 12, padding: 12, borderWidth: 1, borderColor: "#fecaca", borderRadius: 12 }}>
            <Text style={{ fontWeight: "600" }}>Login error</Text>
            <Text style={{ marginTop: 6 }}>{err}</Text>
          </View>
        )}

        <Pressable
          onPress={onLogin}
          disabled={busy}
          style={{
            marginTop: 16,
            backgroundColor: "#111827",
            padding: 12,
            borderRadius: 12,
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
              Sign in
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
