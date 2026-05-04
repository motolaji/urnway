/**
 * Urnway Design System - Design Tokens
 * Based on a modern banking app UI kit with a light blue color scheme
 * Typography: Space Grotesk (or system font fallback)
 */

export const colors = {
  // Brand Colors - Light Blue Theme
  brand: {
    default: '#5CB8E6',      // Primary light blue
    pressed: '#3A9FD6',      // Darker blue for pressed state
    light: '#E8F6FC',        // Very light blue for backgrounds
    subtle: '#B8E0F5',       // Subtle blue for borders/accents
  },

  // Grays - For text, backgrounds, and borders
  grays: {
    primary: '#1A1A1A',      // Almost black - primary text
    secondary: '#6B7280',    // Medium gray - secondary text
    tertiary: '#D1D5DB',     // Light gray - borders, dividers
    quaternary: '#F5F7FA',   // Very light gray - backgrounds
    white: '#FFFFFF',
  },

  // Status Colors
  status: {
    error: '#EF4444',        // Red
    errorLight: '#FEF2F2',
    success: '#22C55E',      // Green
    successLight: '#F0FDF4',
    warning: '#F59E0B',      // Orange/Yellow
    warningLight: '#FFFBEB',
    info: '#3B82F6',         // Blue
    infoLight: '#EFF6FF',
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F7FA',
    tertiary: '#E8F6FC',
    card: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Text Colors
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    brand: '#5CB8E6',
    link: '#3A9FD6',
  },

  // Border Colors
  border: {
    default: '#E5E7EB',
    focus: '#5CB8E6',
    error: '#EF4444',
    success: '#22C55E',
  },
} as const;

export const typography = {
  // Font Families - Space Grotesk from Google Fonts
  fontFamily: {
    light: 'SpaceGrotesk_300Light',
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semiBold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
    // System font fallback
    system: 'System',
  },

  // Font Sizes
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Line Heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.4,
    relaxed: 1.5,
    loose: 1.75,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
  },
} as const;

export const spacing = {
  // Base spacing unit: 4px
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  '2xl': 12,
  '3xl': 14,
  '4xl': 16,
  full: 9999,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    easeInOut: 'ease-in-out',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
  },
} as const;

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

// Component-specific tokens
export const components = {
  button: {
    height: {
      sm: 36,
      md: 44,
      lg: 52,
    },
    paddingHorizontal: {
      sm: spacing[3],
      md: spacing[5],
      lg: spacing[6],
    },
    fontSize: {
      sm: typography.fontSize.sm,
      md: typography.fontSize.base,
      lg: typography.fontSize.md,
    },
    borderRadius: borderRadius.lg, // 8px - more minimal
  },
  input: {
    height: 52,
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg, // 8px
    fontSize: typography.fontSize.base,
    borderWidth: 1.5,
  },
  card: {
    padding: spacing[6],
    borderRadius: borderRadius['2xl'], // 12px - more minimal
  },
  avatar: {
    size: {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80,
      '2xl': 96,
    },
  },
  badge: {
    size: {
      sm: 18,
      md: 22,
      lg: 26,
    },
  },
  toggle: {
    width: 52,
    height: 32,
    thumbSize: 26,
  },
  pinPad: {
    buttonSize: 72,
    gap: spacing[4],
  },
} as const;

// Export a theme object that combines all tokens
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  iconSizes,
  components,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
