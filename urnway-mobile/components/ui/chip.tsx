import {
  StyleSheet,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/constants/design-tokens';

export type ChipVariant = 'default' | 'selected' | 'outlined';

export interface ChipProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ChipVariant;
  leftIcon?: React.ReactNode;
  onRemove?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  variant = 'default',
  leftIcon,
  onRemove,
  selected = false,
  disabled,
  style,
  ...props
}: ChipProps) {
  const activeVariant = selected ? 'selected' : variant;

  const content = (
    <>
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      <Text
        style={[
          styles.label,
          activeVariant === 'selected' && styles.selectedLabel,
        ]}
      >
        {label}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeButton}>
          <Ionicons
            name="close"
            size={14}
            color={activeVariant === 'selected' ? colors.brand.default : colors.text.secondary}
          />
        </Pressable>
      )}
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.base,
          styles[activeVariant],
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
        disabled={disabled}
        {...props}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.base, styles[activeVariant], style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  default: {
    backgroundColor: colors.background.secondary,
  },
  selected: {
    backgroundColor: colors.brand.light,
    borderWidth: 1,
    borderColor: colors.brand.default,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: spacing[0.5],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  selectedLabel: {
    color: colors.brand.pressed,
  },
  removeButton: {
    marginLeft: spacing[0.5],
  },
});

export default Chip;
