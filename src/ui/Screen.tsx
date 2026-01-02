import React from "react";
import { View, ScrollView, ViewProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { S } from "./spacing";

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
};

export function Screen({ scroll = false, padded = true, style, children, ...rest }: Props) {
  const insets = useSafeAreaInsets();

  const basePad = padded ? S.xl : 0;

  const content = (
    <View
      style={[
        {
          paddingHorizontal: basePad,
          paddingTop: padded ? S.lg : 0,
          paddingBottom: Math.max(insets.bottom, S.lg),
          gap: S.lg,
          flex: 1,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
