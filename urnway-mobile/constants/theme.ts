/**
 * Urnway Theme Configuration
 * Light blue color scheme based on modern banking app UI
 *
 * For the full design system, see @/constants/design-tokens.ts
 */

import { Platform } from 'react-native';
import { colors } from './design-tokens';

// Brand colors - light blue theme
const tintColorLight = colors.brand.default; // #5CB8E6
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: colors.text.primary,
    background: colors.background.primary,
    tint: tintColorLight,
    icon: colors.text.secondary,
    tabIconDefault: colors.text.tertiary,
    tabIconSelected: tintColorLight,
    // Extended colors from design system
    brand: colors.brand.default,
    brandPressed: colors.brand.pressed,
    brandLight: colors.brand.light,
    card: colors.background.card,
    border: colors.border.default,
    error: colors.status.error,
    success: colors.status.success,
    warning: colors.status.warning,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // Extended colors for dark mode
    brand: colors.brand.default,
    brandPressed: colors.brand.pressed,
    brandLight: '#1E3A47',
    card: '#1E2022',
    border: '#2E3236',
    error: colors.status.error,
    success: colors.status.success,
    warning: colors.status.warning,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
