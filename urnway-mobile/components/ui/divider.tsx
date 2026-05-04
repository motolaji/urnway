import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/constants/design-tokens';
import Text from './text';

export interface DividerProps {
  label?: string;
  spacing?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ label, spacing: spacingProp = 4, style }: DividerProps) {
  if (label) {
    return (
      <View style={[styles.container, { marginVertical: spacing[spacingProp] }, style]}>
        <View style={styles.line} />
        <Text variant="caption" style={styles.label}>
          {label}
        </Text>
        <View style={styles.line} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.simpleLine,
        { marginVertical: spacing[spacingProp] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  simpleLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
    width: '100%',
  },
  label: {
    paddingHorizontal: spacing[2],
  },
});

export default Divider;
