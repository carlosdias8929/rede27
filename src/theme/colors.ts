/**
 * Paleta oficial REDE27.
 *
 * Cores definidas pelo cliente (Alberto, 18/09):
 *   azul escuro #0A1931  — cor principal da marca
 *   dourado     #FFC700  — cor de destaque
 *
 * Regra de contraste que vale para o dourado #FFC700:
 *   sobre branco  -> 1,6:1  ILEGIVEL, nunca usar como texto
 *   sobre o azul  -> 11,5:1 otimo
 * Por isso o dourado entra como FUNDO (com texto azul escuro por cima) ou como
 * texto sobre fundo escuro. Para texto dourado em fundo claro existe o
 * `gold700`, escurecido ate 5:1. O cliente pediu acessibilidade para baixa
 * visao, entao isso nao e detalhe.
 *
 * Verde e branco continuam no arquivo: branco como superficie e verde apenas
 * como cor semantica de sucesso/credito (o oposto do vermelho de erro). Se o
 * Alberto confirmar que quer verde como cor de marca tambem, e aqui que muda.
 *
 * Nenhuma tela deve usar cor fora deste arquivo.
 */

export const palette = {
  // Azul escuro — cor principal
  navy900: '#060F1E',
  navy800: '#0A1931', // <- cor da marca
  navy700: '#122544',
  navy600: '#1A3358',
  navy500: '#24446F',
  navy300: '#5C7BA5',
  navy100: '#C5D2E4',
  navy50: '#EEF2F8',

  // Dourado — cor de destaque
  gold700: '#8A6A08', // unico tom legivel como texto sobre branco (5:1)
  gold600: '#D1A400',
  gold500: '#FFC700', // <- cor da marca
  gold400: '#FFD43D',
  gold300: '#FFE07A',
  gold100: '#FFF0BD',
  gold50: '#FFF9E6',

  // Branco e neutros
  white: '#FFFFFF',
  gray50: '#F6F7F9',
  gray100: '#ECEEF2',
  gray200: '#DCE0E7',
  gray400: '#96A0AF',
  gray600: '#586477',
  gray800: '#26303F',
  black: '#060A0F',

  // Estados
  danger: '#C0392B',
  dangerSoft: '#FDECEA',
  warning: '#8A6A08',
  success: '#12804A',
  successSoft: '#E6F4EC',
} as const;

export const colors = {
  // Superficies
  bg: palette.white,
  bgMuted: palette.gray50,
  surface: palette.white,
  surfaceAlt: palette.navy50,
  border: palette.gray200,
  borderStrong: palette.gray400,

  // Marca
  primary: palette.navy800,
  primaryDark: palette.navy900,
  primaryLight: palette.navy50,
  onPrimary: palette.white,

  // Tom de apoio dentro do proprio azul, para hierarquia sem inventar cor nova
  secondary: palette.navy600,
  secondaryDark: palette.navy800,
  secondaryLight: palette.navy50,
  onSecondary: palette.white,

  // Destaque
  accent: palette.gold500,
  accentSoft: palette.gold300,
  accentBg: palette.gold50,
  /** Texto por cima do dourado. Sempre escuro. */
  onAccent: palette.navy900,
  /** Dourado em fundo claro, ja escurecido para ser legivel. */
  accentText: palette.gold700,

  // Texto
  text: palette.gray800,
  textMuted: palette.gray600,
  textFaint: palette.gray400,
  textOnDark: palette.white,

  // Estados
  danger: palette.danger,
  dangerBg: palette.dangerSoft,
  success: palette.success,
  successBg: palette.successSoft,
  warning: palette.warning,
} as const;

export type ColorToken = keyof typeof colors;
