import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/design-tokens';
import Button from './button';

export interface BalanceCardProps {
  balance: string | number;
  currency?: string;
  label?: string;
  showHideToggle?: boolean;
  onAddMoney?: () => void;
  addMoneyLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function BalanceCard({
  balance,
  currency = '$',
  label = 'Your balance',
  showHideToggle = true,
  onAddMoney,
  addMoneyLabel = 'Add money',
  style,
}: BalanceCardProps) {
  const [isHidden, setIsHidden] = useState(false);

  const formattedBalance =
    typeof balance === 'number'
      ? balance.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : balance;

  const displayBalance = isHidden ? '****' : `${currency}${formattedBalance}`;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {showHideToggle && (
          <Pressable
            onPress={() => setIsHidden(!isHidden)}
            hitSlop={8}
            accessibilityLabel={isHidden ? 'Show balance' : 'Hide balance'}
          >
            <Ionicons
              name={isHidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        )}
      </View>

      <Text style={styles.balance}>{displayBalance}</Text>

      {onAddMoney && (
        <Button
          variant="primary"
          size="md"
          onPress={onAddMoney}
          fullWidth
          style={styles.addButton}
        >
          {addMoneyLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius['3xl'],
    padding: spacing[6],
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  balance: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  addButton: {
    marginTop: spacing[2],
  },
});

export default BalanceCard;
