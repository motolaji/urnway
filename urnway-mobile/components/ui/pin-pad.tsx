import { StyleSheet, View, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, components, spacing, borderRadius } from '@/constants/design-tokens';

export interface PinPadProps {
  value: string;
  maxLength?: number;
  onValueChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  showBiometric?: boolean;
  biometricType?: 'face' | 'fingerprint';
  onBiometricPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['biometric', '0', 'delete'],
];

export function PinPad({
  value,
  maxLength = 4,
  onValueChange,
  onComplete,
  showBiometric = false,
  biometricType = 'face',
  onBiometricPress,
  style,
}: PinPadProps) {
  const handleKeyPress = async (key: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'delete') {
      const newValue = value.slice(0, -1);
      onValueChange(newValue);
      return;
    }

    if (key === 'biometric') {
      onBiometricPress?.();
      return;
    }

    if (value.length >= maxLength) return;

    const newValue = value + key;
    onValueChange(newValue);

    if (newValue.length === maxLength) {
      onComplete?.(newValue);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* PIN Dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: maxLength }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < value.length && styles.dotFilled,
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => {
              if (key === 'biometric' && !showBiometric) {
                return <View key={key} style={styles.emptyKey} />;
              }

              if (key === 'biometric') {
                return (
                  <Pressable
                    key={key}
                    onPress={() => void handleKeyPress(key)}
                    style={({ pressed }) => [
                      styles.key,
                      styles.specialKey,
                      pressed && styles.keyPressed,
                    ]}
                  >
                    <Ionicons
                      name={biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'}
                      size={28}
                      color={colors.brand.default}
                    />
                  </Pressable>
                );
              }

              if (key === 'delete') {
                return (
                  <Pressable
                    key={key}
                    onPress={() => void handleKeyPress(key)}
                    style={({ pressed }) => [
                      styles.key,
                      styles.specialKey,
                      pressed && styles.keyPressed,
                    ]}
                    disabled={value.length === 0}
                  >
                    <Ionicons
                      name="backspace-outline"
                      size={24}
                      color={value.length === 0 ? colors.text.tertiary : colors.text.primary}
                    />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={key}
                  onPress={() => void handleKeyPress(key)}
                  style={({ pressed }) => [
                    styles.key,
                    pressed && styles.keyPressed,
                  ]}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing[4],
    marginBottom: spacing[10],
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.grays.tertiary,
  },
  dotFilled: {
    backgroundColor: colors.brand.default,
  },
  keypad: {
    gap: components.pinPad.gap,
  },
  row: {
    flexDirection: 'row',
    gap: components.pinPad.gap,
  },
  key: {
    width: components.pinPad.buttonSize,
    height: components.pinPad.buttonSize,
    borderRadius: components.pinPad.buttonSize / 2,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialKey: {
    backgroundColor: 'transparent',
  },
  keyPressed: {
    backgroundColor: colors.brand.light,
  },
  keyText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  emptyKey: {
    width: components.pinPad.buttonSize,
    height: components.pinPad.buttonSize,
  },
});

export default PinPad;
