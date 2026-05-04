import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/design-tokens';

export interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  safeArea?: boolean | { top?: boolean; bottom?: boolean };
  backgroundColor?: string;
  keyboardAvoiding?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scrollable = false,
  padded = true,
  safeArea = true,
  backgroundColor = colors.background.secondary,
  keyboardAvoiding = true,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const safeAreaTop = safeArea === true || (typeof safeArea === 'object' && safeArea.top);
  const safeAreaBottom = safeArea === true || (typeof safeArea === 'object' && safeArea.bottom);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: safeAreaTop ? insets.top : 0,
    paddingBottom: safeAreaBottom ? insets.bottom : 0,
  };

  const contentStyle: ViewStyle = {
    flex: scrollable ? undefined : 1,
    paddingHorizontal: padded ? spacing[4] : 0,
  };

  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[contentStyle, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[contentStyle, contentContainerStyle]}>{children}</View>
  );

  if (keyboardAvoiding && Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[containerStyle, style]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[containerStyle, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

export default Screen;
