import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, HIT_TARGET, radius, shadow, spacing } from '../theme';

type Variante = 'primario' | 'secundario' | 'contorno' | 'texto' | 'perigo';

type Props = {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  /** Texto lido por leitores de tela quando o titulo sozinho nao basta. */
  rotuloAcessivel?: string;
  style?: StyleProp<ViewStyle>;
  iconeEsquerda?: React.ReactNode;
};

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
  rotuloAcessivel,
  style,
  iconeEsquerda,
}: Props) {
  const inativo = desabilitado || carregando;
  const v = estilosPorVariante[variante];

  return (
    <Pressable
      onPress={inativo ? undefined : onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? titulo}
      accessibilityState={{ disabled: inativo, busy: carregando }}
      style={({ pressed }) => [
        estilos.base,
        v.container,
        variante !== 'texto' && shadow(1),
        pressed && !inativo && estilos.pressionado,
        inativo && estilos.inativo,
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={v.texto.color} />
      ) : (
        <View style={estilos.conteudo}>
          {iconeEsquerda}
          <Text style={[estilos.texto, v.texto]} numberOfLines={1}>
            {titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  texto: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.2,
  },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  inativo: { opacity: 0.5 },
});

const estilosPorVariante: Record<Variante, { container: ViewStyle; texto: { color: string } }> = {
  primario: {
    container: { backgroundColor: colors.primary },
    texto: { color: colors.onPrimary },
  },
  secundario: {
    container: { backgroundColor: colors.secondary },
    texto: { color: colors.onSecondary },
  },
  contorno: {
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    texto: { color: colors.primary },
  },
  texto: {
    container: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
    texto: { color: colors.secondary },
  },
  perigo: {
    container: {
      backgroundColor: colors.dangerBg,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    texto: { color: colors.danger },
  },
};
