import { BlurView } from "expo-blur";
import { type PropsWithChildren, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/constants/design-tokens";

const HEADER_HEIGHT = 58;

type BlurScrollScreenProps = PropsWithChildren<{
  title: string;
  backgroundColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export default function BlurScrollScreen({
  title,
  backgroundColor = colors.background.secondary,
  contentStyle,
  children,
}: BlurScrollScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, 28, 120],
    outputRange: [0, 0.35, 1],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [20, 110],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + spacing[5],
              paddingBottom: insets.bottom + spacing[7],
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlay,
          {
            height: insets.top + HEADER_HEIGHT,
            opacity: overlayOpacity,
          },
        ]}
      >
        <BlurView
          experimentalBlurMethod={
            Platform.OS === "android" ? "dimezisBlurView" : undefined
          }
          intensity={85}
          style={StyleSheet.absoluteFill}
          tint="light"
        />
        <View
          style={[
            styles.overlayInner,
            {
              paddingTop: insets.top,
            },
          ]}
        >
          <Animated.Text style={[styles.overlayTitle, { opacity: titleOpacity }]}>
            {title}
          </Animated.Text>
        </View>
        <View style={styles.overlayBorder} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    gap: spacing[5],
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  overlayInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[5],
  },
  overlayTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  overlayBorder: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
});
