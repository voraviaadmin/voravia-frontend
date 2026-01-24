import React from "react";
import { View, ScrollView, ViewProps, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Theme } from "./theme";
import { S } from "./spacing";

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
};

function extractBg(style?: StyleProp<ViewStyle>) {
  // Try to respect caller backgroundColor if provided, else use Theme bg.
  // Style can be array/object; simplest safe approach is default to Theme bg.
  // (If you want, we can enhance this later.)
  return Theme.colors.bg;
}

export function Screen({ scroll = false, padded = true, style, children, ...rest }: Props) {
  const basePad = padded ? S.xl : 0;
  const bg = extractBg(style);

  const content = (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          paddingHorizontal: basePad,
          paddingTop: basePad,
          paddingBottom: basePad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      // ✅ IMPORTANT: header already owns the top safe area, so exclude top
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: bg }}
    >
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
