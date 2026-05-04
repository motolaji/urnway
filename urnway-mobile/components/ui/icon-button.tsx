import { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, borderRadius, shadows } from '@/constants/design-tokens';

export type IconButtonVariant = 'default' | 'filled' | 'outlined' | 'ghost';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: 36,
  md: 44,
  lg: 52,
};

export const IconButton = forwardRef<React.ElementRef<typeof Pressable>, IconButtonProps>(
  ({ variant = 'default', size = 'md', icon, disabled, style, ...props }, ref) => {
    const sizeValue = sizeMap[size];

    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: borderRadius.xl,
          },
          pressed && !disabled && styles[`${variant}Pressed`],
          disabled && styles.disabled,
          style,
        ]}
        {...props}
      >
        {icon}
      </Pressable>
    );
  }
);

IconButton.displayName = 'IconButton';

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  default: {
    backgroundColor: colors.background.secondary,
  },
  defaultPressed: {
    backgroundColor: colors.grays.tertiary,
  },
  filled: {
    backgroundColor: colors.brand.default,
  },
  filledPressed: {
    backgroundColor: colors.brand.pressed,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  outlinedPressed: {
    backgroundColor: colors.background.secondary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: colors.background.secondary,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default IconButton;
