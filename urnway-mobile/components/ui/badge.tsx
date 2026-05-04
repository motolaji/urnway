import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, typography, components } from '@/constants/design-tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  style,
}: BadgeProps) {
  if (dot) {
    return <View style={[styles.dot, styles[`${variant}Background`], style]} />;
  }

  const sizeValue = components.badge.size[size];
  const fontSize = sizeValue * 0.55;
  const minWidth = typeof children === 'string' && children.length > 1 ? sizeValue * 1.5 : sizeValue;

  return (
    <View
      style={[
        styles.badge,
        styles[`${variant}Background`],
        {
          minWidth,
          height: sizeValue,
          borderRadius: sizeValue / 2,
          paddingHorizontal: sizeValue * 0.35,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    color: colors.grays.white,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  defaultBackground: {
    backgroundColor: colors.brand.default,
  },
  successBackground: {
    backgroundColor: colors.status.success,
  },
  warningBackground: {
    backgroundColor: colors.status.warning,
  },
  errorBackground: {
    backgroundColor: colors.status.error,
  },
  infoBackground: {
    backgroundColor: colors.status.info,
  },
});

export default Badge;
