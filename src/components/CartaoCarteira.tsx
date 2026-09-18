import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CARTEIRA, MARCA } from '../config/rede27.config';
import { brl, paraReais } from '../lib/format';
import { colors, font, palette, radius, shadow, spacing } from '../theme';

type Props = {
  saldoCentavos: number | null;
  onVerExtrato?: () => void;
  carregando?: boolean;
};

export function CartaoCarteira({ saldoCentavos, onVerExtrato, carregando }: Props) {
  const saldo = saldoCentavos ?? 0;
  const zerado = saldo <= 0;

  return (
    <View style={[estilos.cartao, shadow(2)]}>
      <View style={estilos.topo}>
        <View style={estilos.rotuloBloco}>
          <Text style={estilos.rotulo}>Carteira {MARCA.nomeApp}</Text>
          <Text style={estilos.saldo} accessibilityLabel={`Saldo de ${brl(paraReais(saldo))}`}>
            {carregando ? '—' : brl(paraReais(saldo))}
          </Text>
        </View>

        <View style={estilos.selo}>
          <Text style={estilos.seloTexto}>27</Text>
        </View>
      </View>

      {zerado && !carregando ? (
        <Text style={estilos.aviso}>
          {CARTEIRA.modo === 'saldo_simples'
            ? `Sem saldo. A recarga e feita pela central da ${MARCA.empresa} nesta fase.`
            : 'Sem saldo. Faca uma recarga para chamar.'}
        </Text>
      ) : null}

      {onVerExtrato ? (
        <Pressable
          onPress={onVerExtrato}
          accessibilityRole="button"
          accessibilityLabel="Ver extrato da carteira"
          hitSlop={8}
        >
          <Text style={estilos.link}>Ver extrato</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.gold500,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rotuloBloco: { gap: 2 },
  rotulo: {
    fontSize: font.size.xs,
    color: palette.navy100,
    fontWeight: font.weight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  saldo: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.heavy,
    color: colors.textOnDark,
  },
  selo: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.gold300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: {
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
    color: palette.navy900,
  },
  aviso: { fontSize: font.size.xs, color: palette.gold300 },
  link: {
    fontSize: font.size.sm,
    color: palette.gold300,
    fontWeight: font.weight.semibold,
  },
});
