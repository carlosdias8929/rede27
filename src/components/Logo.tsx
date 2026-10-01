import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, font, palette, spacing } from '../theme';

// Logomarca oficial enviada pelo cliente (Rede Vinte e Sete). O arquivo
// original veio com fundo branco; este e o mesmo desenho com o fundo recortado
// ao redor do circulo, para nao aparecer um quadrado branco nos cabecalhos
// escuros.
const LOGO = require('../../assets/logo-rede27.png');

type Props = {
  tamanho?: 'md' | 'lg';
  /** Em fundo escuro ganha um aro dourado, porque o azul da logo some no azul do cabecalho. */
  sobreEscuro?: boolean;
  mostrarSlogan?: boolean;
};

export function Logo({ tamanho = 'md', sobreEscuro = false, mostrarSlogan = false }: Props) {
  const lado = tamanho === 'lg' ? 112 : 52;
  const corSlogan = sobreEscuro ? palette.navy100 : colors.textMuted;

  return (
    <View style={estilos.container} accessibilityRole="header">
      <View
        style={[
          { width: lado, height: lado, borderRadius: lado / 2 },
          sobreEscuro && estilos.aro,
        ]}
      >
        <Image
          source={LOGO}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          accessibilityLabel="REDE 27"
          accessibilityIgnoresInvertColors
        />
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
  container: { alignItems: 'center', gap: spacing.sm },
  aro: { borderWidth: 2, borderColor: palette.gold500, padding: 1 },
  slogan: {
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
});
