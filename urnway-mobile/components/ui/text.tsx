import { Text as RNText, StyleSheet, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '@/constants/design-tokens';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'eyebrow';

export type FontWeight = 'light' | 'regular' | 'medium' | 'semiBold' | 'bold';

export interface UrnwayTextProps extends TextProps {
  variant?: TextVariant;
  color?: keyof typeof colors.text;
  weight?: FontWeight;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
}

// Map weight to font family (for custom fonts, we use fontFamily instead of fontWeight)
const fontFamilyMap: Record<FontWeight, string> = {
  light: typography.fontFamily.light,
  regular: typography.fontFamily.regular,
  medium: typography.fontFamily.medium,
  semiBold: typography.fontFamily.semiBold,
  bold: typography.fontFamily.bold,
};

export function Text({
  variant = 'body',
  color = 'primary',
  weight,
  align,
  style,
  children,
  ...props
}: UrnwayTextProps) {
  // Get the font family based on weight override or variant default
  const getFontFamily = () => {
    if (weight) {
      return fontFamilyMap[weight];
    }
    // Return undefined to use the variant's default font family
    return undefined;
  };

  const fontFamily = getFontFamily();

  return (
    <RNText
      style={[
        styles[variant],
        { color: colors.text[color] },
        fontFamily && { fontFamily },
        align && { textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['4xl'],
    lineHeight: typography.fontSize['4xl'] * typography.lineHeight.tight,
    color: colors.text.primary,
  },
  h2: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize['3xl'],
    lineHeight: typography.fontSize['3xl'] * typography.lineHeight.tight,
    color: colors.text.primary,
  },
  h3: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    lineHeight: typography.fontSize.xl * typography.lineHeight.snug,
    color: colors.text.primary,
  },
  h4: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.fontSize.lg * typography.lineHeight.snug,
    color: colors.text.primary,
  },
  body: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    color: colors.text.primary,
  },
  bodySmall: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    color: colors.text.secondary,
  },
  caption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
    color: colors.text.tertiary,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.tight,
    color: colors.text.primary,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    color: colors.text.brand,
  },
});

export default Text;
