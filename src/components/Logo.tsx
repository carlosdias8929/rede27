import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, palette, radius, spacing } from '../theme';

type Props = {
  tamanho?: 'md' | 'lg';
  /** Em fundo escuro o "REDE" fica branco; em fundo claro, verde. */
  sobreEscuro?: boolean;
  mostrarSlogan?: boolean;
};

export function Logo({ tamanho = 'md', sobreEscuro = false, mostrarSlogan = false }: Props) {
  const grande = tamanho === 'lg';
  const corRede = sobreEscuro ? colors.textOnDark : colors.primaryDark;
  const corSlogan = sobreEscuro ? palette.green100 : colors.textMuted;

  return (
    <View style={estilos.container} accessibilityRole="header">
      <View style={estilos.linha}>
        <Text
          style={[estilos.rede, grande && estilos.redeGrande, { color: corRede }]}
          accessibilityLabel="REDE 27"
        >
          REDE
        </Text>
        <View style={[estilos.selo, grande && estilos.seloGrande]}>
          <Text style={[estilos.numero, grande && estilos.numeroGrande]}>27</Text>
        </View>
      </View>

      {mostrarSlogan ? (
        <Text style={[estilos.slogan, { color: corSlogan }]}>
          Transporte de passageiros, bens e encomendas
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.xs },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rede: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.heavy,
    letterSpacing: 2,
  },
  redeGrande: { fontSize: font.size.display, letterSpacing: 3 },
  selo: {
    backgroundColor: palette.gold300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: palette.gold500,
  },
  seloGrande: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  numero: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: palette.green900,
    letterSpacing: 1,
  },
  numeroGrande: { fontSize: font.size.xxl },
  slogan: {
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
});
