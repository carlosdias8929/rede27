/**
 * Paleta oficial REDE27.
 * Cores obrigatorias definidas pelo cliente: verde, azul, branco e um tom leve de ouro.
 * Nenhuma tela deve usar cor fora deste arquivo.
 */

export const palette = {
  // Verde — cor primaria da marca (acao, confirmacao, identidade)
  green900: '#07361F',
  green800: '#09492A',
  green700: '#0B6B3A',
  green600: '#0F7D45',
  green500: '#12904E',
  green300: '#4FBF82',
  green100: '#C7E9D5',
  green50: '#E8F6EE',

  // Azul — cor de suporte (informacao, navegacao, estados do protocolo)
  blue900: '#062B4D',
  blue800: '#093C6B',
  blue700: '#0B4F8A',
  blue500: '#1170C4',
  blue300: '#5FA8E5',
  blue100: '#CFE4F7',
  blue50: '#E8F2FB',

  // Ouro leve — usado como detalhe/acento, nunca como fundo de tela inteira
  gold700: '#A8801F',
  gold500: '#C9A227',
  gold400: '#D9B44A',
  gold300: '#E6C878',
  gold100: '#F4E4BA',
  gold50: '#FBF4E1',

  // Branco e neutros
  white: '#FFFFFF',
  gray50: '#F7F8F9',
  gray100: '#EDEFF2',
  gray200: '#DDE1E6',
  gray400: '#9AA3AD',
  gray600: '#5C666F',
  gray800: '#2B3138',
  black: '#0A0C0E',

  // Estados
  danger: '#C0392B',
  dangerSoft: '#FDECEA',
  warning: '#B8860B',
  success: '#12904E',
} as const;

export const colors = {
  // Superficies
  bg: palette.white,
  bgMuted: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.green50,
  border: palette.gray200,
  borderStrong: palette.gray400,

  // Marca
  primary: palette.green700,
  primaryDark: palette.green900,
  primaryLight: palette.green50,
  onPrimary: palette.white,

  secondary: palette.blue700,
  secondaryDark: palette.blue900,
  secondaryLight: palette.blue50,
  onSecondary: palette.white,

  accent: palette.gold500,
  accentSoft: palette.gold300,
  accentBg: palette.gold50,
  onAccent: palette.green900,

  // Texto
  text: palette.gray800,
  textMuted: palette.gray600,
  textFaint: palette.gray400,
  textOnDark: palette.white,

  // Estados
  danger: palette.danger,
  dangerBg: palette.dangerSoft,
  success: palette.success,
  warning: palette.warning,
} as const;

export type ColorToken = keyof typeof colors;
