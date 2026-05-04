import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, components, typography } from '@/constants/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      style,
      textStyle,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <Pressable
        ref={ref}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          styles[`${size}Size`],
          fullWidth && styles.fullWidth,
          pressed && !isDisabled && styles[`${variant}Pressed`],
          isDisabled && styles.disabled,
          style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.grays.white : colors.brand.default}
          />
        ) : (
          <>
            {leftIcon}
            <Text
              style={[
                styles.text,
                styles[`${variant}Text`],
                styles[`${size}Text`],
                isDisabled && styles.disabledText,
                textStyle,
              ]}
            >
              {children}
            </Text>
            {rightIcon}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: components.button.borderRadius,
  },

  // Size variants
  smSize: {
    height: components.button.height.sm,
    paddingHorizontal: components.button.paddingHorizontal.sm,
  },
  mdSize: {
    height: components.button.height.md,
    paddingHorizontal: components.button.paddingHorizontal.md,
  },
  lgSize: {
    height: components.button.height.lg,
    paddingHorizontal: components.button.paddingHorizontal.lg,
  },

  // Variant styles
  primary: {
    backgroundColor: colors.brand.default,
  },
  primaryPressed: {
    backgroundColor: colors.brand.pressed,
  },
  secondary: {
    backgroundColor: colors.brand.light,
  },
  secondaryPressed: {
    backgroundColor: colors.brand.subtle,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.brand.default,
  },
  outlinePressed: {
    backgroundColor: colors.brand.light,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: colors.brand.light,
  },

  // Text styles
  text: {
    fontFamily: typography.fontFamily.semiBold,
  },
  primaryText: {
    color: colors.grays.white,
  },
  secondaryText: {
    color: colors.brand.pressed,
  },
  outlineText: {
    color: colors.brand.default,
  },
  ghostText: {
    color: colors.brand.default,
  },

  // Text size
  smText: {
    fontSize: components.button.fontSize.sm,
  },
  mdText: {
    fontSize: components.button.fontSize.md,
  },
  lgText: {
    fontSize: components.button.fontSize.lg,
  },

  // States
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.8,
  },
});

export default Button;
