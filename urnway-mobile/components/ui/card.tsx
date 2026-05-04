import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, components, shadows, spacing } from '@/constants/design-tokens';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: keyof typeof spacing;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  variant = 'default',
  padding = 6,
  children,
  style,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        { padding: spacing[padding] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: components.card.borderRadius,
    width: '100%',
  },
  default: {
    backgroundColor: colors.background.card,
    ...shadows.sm,
  },
  elevated: {
    backgroundColor: colors.background.card,
    ...shadows.lg,
  },
  outlined: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filled: {
    backgroundColor: colors.brand.light,
  },
});

export default Card;
