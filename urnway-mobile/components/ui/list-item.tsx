import {
  StyleSheet,
  View,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/constants/design-tokens';
import Text from './text';
import Toggle from './toggle';

export interface ListItemProps extends Omit<PressableProps, 'style'> {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  toggle?: {
    value: boolean;
    onValueChange: (value: boolean) => void;
  };
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  rightElement,
  showChevron = false,
  toggle,
  destructive = false,
  disabled,
  style,
  ...props
}: ListItemProps) {
  const content = (
    <>
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

      <View style={styles.content}>
        <Text
          variant="body"
          weight="medium"
          color={destructive ? 'primary' : 'primary'}
          style={destructive && styles.destructiveText}
        >
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" color="secondary">
            {subtitle}
          </Text>
        )}
      </View>

      {toggle && (
        <Toggle
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          disabled={disabled ?? undefined}
        />
      )}

      {rightElement && !toggle && (
        <View style={styles.rightElement}>{rightElement}</View>
      )}

      {showChevron && !toggle && !rightElement && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.text.tertiary}
        />
      )}
    </>
  );

  if (props.onPress || props.onLongPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.container,
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

  return <View style={[styles.container, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    minHeight: 56,
  },
  pressed: {
    backgroundColor: colors.background.secondary,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: spacing[3],
  },
  content: {
    flex: 1,
    gap: spacing[0.5],
  },
  rightElement: {
    marginLeft: spacing[3],
  },
  destructiveText: {
    color: colors.status.error,
  },
});

export default ListItem;
