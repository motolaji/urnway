import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design-tokens';

export type CardType = 'debit' | 'credit';
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';

export interface CreditCardProps {
  type?: CardType;
  brand?: CardBrand;
  lastFourDigits: string;
  cardholderName?: string;
  expiryDate?: string;
  gradientColors?: [string, string];
  style?: StyleProp<ViewStyle>;
}

const BRAND_LOGOS: Record<CardBrand, string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
};

const DEFAULT_GRADIENTS: Record<CardType, [string, string]> = {
  debit: ['#3B82F6', '#1D4ED8'],
  credit: ['#8B5CF6', '#6D28D9'],
};

export function CreditCard({
  type = 'debit',
  brand = 'visa',
  lastFourDigits,
  cardholderName,
  expiryDate,
  gradientColors,
  style,
}: CreditCardProps) {
  const gradient = gradientColors || DEFAULT_GRADIENTS[type];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <Text style={styles.type}>{type === 'debit' ? 'Debit card' : 'Credit card'}</Text>
          <Text style={styles.brand}>{BRAND_LOGOS[brand]}</Text>
        </View>

        <View style={styles.chipContainer}>
          <View style={styles.chip} />
        </View>

        <View style={styles.numberContainer}>
          <Text style={styles.dots}>.... </Text>
          <Text style={styles.lastFour}>{lastFourDigits}</Text>
        </View>

        <View style={styles.footer}>
          {cardholderName && (
            <Text style={styles.cardholderName} numberOfLines={1}>
              {cardholderName}
            </Text>
          )}
          {expiryDate && <Text style={styles.expiry}>{expiryDate}</Text>}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 175,
    borderRadius: borderRadius['2xl'],
    ...shadows.lg,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  brand: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.grays.white,
    letterSpacing: typography.letterSpacing.wider,
  },
  chipContainer: {
    marginTop: spacing[2],
  },
  chip: {
    width: 40,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 215, 0, 0.8)',
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    fontSize: typography.fontSize['2xl'],
    color: colors.grays.white,
    letterSpacing: 2,
  },
  lastFour: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.grays.white,
    letterSpacing: typography.letterSpacing.wider,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardholderName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.grays.white,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  expiry: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default CreditCard;
