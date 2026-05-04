import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, components, typography, spacing } from '@/constants/design-tokens';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      showPasswordToggle,
      secureTextEntry,
      editable = true,
      style,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const hasError = !!error;
    const isSecure = secureTextEntry && !isPasswordVisible;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}

        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
            hasError && styles.inputContainerError,
            !editable && styles.inputContainerDisabled,
          ]}
        >
          {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon ? styles.inputWithLeftIcon : undefined,
              rightIcon || showPasswordToggle
                ? styles.inputWithRightIcon
                : undefined,
              !editable && styles.inputDisabled,
              style,
            ]}
            placeholderTextColor={colors.text.tertiary}
            editable={editable}
            secureTextEntry={isSecure}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {showPasswordToggle && secureTextEntry && (
            <Pressable
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.iconContainer}
              hitSlop={8}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.secondary}
              />
            </Pressable>
          )}

          {rightIcon && !showPasswordToggle && (
            <View style={styles.iconContainer}>{rightIcon}</View>
          )}
        </View>

        {(error || hint) && (
          <Text style={[styles.hint, hasError && styles.errorText]}>
            {error || hint}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: components.input.height,
    borderWidth: components.input.borderWidth,
    borderColor: colors.border.default,
    borderRadius: components.input.borderRadius,
    backgroundColor: colors.background.primary,
  },
  inputContainerFocused: {
    borderColor: colors.border.focus,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: colors.border.error,
  },
  inputContainerDisabled: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: components.input.paddingHorizontal,
    fontSize: components.input.fontSize,
    color: colors.text.primary,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing[2],
  },
  inputWithRightIcon: {
    paddingRight: spacing[2],
  },
  inputDisabled: {
    color: colors.text.tertiary,
  },
  iconContainer: {
    paddingHorizontal: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing[1.5],
  },
  errorText: {
    color: colors.status.error,
  },
});

export default Input;
