import {
  StyleSheet,
  View,
  Text,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, typography, components } from '@/constants/design-tokens';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle | ImageStyle>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getBackgroundColor(name: string): string {
  const colorPalette = [
    colors.brand.default,
    colors.brand.pressed,
    colors.status.success,
    colors.status.warning,
    colors.status.info,
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export function Avatar({ source, name = '', size = 'md', style }: AvatarProps) {
  const sizeValue = components.avatar.size[size];
  const fontSize = sizeValue * 0.4;
  const initials = getInitials(name);
  const backgroundColor = getBackgroundColor(name);

  const containerStyle = {
    width: sizeValue,
    height: sizeValue,
    borderRadius: sizeValue / 2,
  };

  if (source) {
    return (
      <Image
        source={{ uri: source }}
        style={[containerStyle, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View style={[styles.fallback, containerStyle, { backgroundColor }, style]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.grays.white,
    fontWeight: typography.fontWeight.semiBold,
  },
});

export default Avatar;
