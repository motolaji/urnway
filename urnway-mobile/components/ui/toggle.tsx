import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, components, animation } from '@/constants/design-tokens';

export interface ToggleProps extends Omit<PressableProps, 'onPress' | 'style'> {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  activeColor = colors.brand.default,
  inactiveColor = colors.grays.tertiary,
  style,
  ...props
}: ToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: animation.duration.fast,
    });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: progress.value * (components.toggle.width - components.toggle.thumbSize - 6),
      },
    ],
  }));

  return (
    <AnimatedPressable
      onPress={() => !disabled && onValueChange(!value)}
      style={[styles.track, trackStyle, disabled && styles.disabled, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      {...props}
    >
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: components.toggle.width,
    height: components.toggle.height,
    borderRadius: components.toggle.height / 2,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: components.toggle.thumbSize,
    height: components.toggle.thumbSize,
    borderRadius: components.toggle.thumbSize / 2,
    backgroundColor: colors.grays.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Toggle;
