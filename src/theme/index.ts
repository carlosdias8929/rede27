import { Platform } from 'react-native';

export { colors, palette } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
} as const;

/** Sombra consistente entre Android, iOS e web. */
export function shadow(level: 1 | 2 | 3 = 1) {
  const cfg = {
    1: { e: 2, o: 0.08, r: 6, y: 2 },
    2: { e: 6, o: 0.12, r: 14, y: 6 },
    3: { e: 12, o: 0.18, r: 24, y: 10 },
  }[level];

  return Platform.select({
    android: { elevation: cfg.e },
    default: {
      shadowColor: '#0A0C0E',
      shadowOpacity: cfg.o,
      shadowRadius: cfg.r,
      shadowOffset: { width: 0, height: cfg.y },
    },
  })!;
}

/** Alvo minimo de toque recomendado (acessibilidade). */
export const HIT_TARGET = 48;
