import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, palette, radius, shadow, spacing } from '../theme';

type Props = {
  onChamar: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
  /** Motivo do bloqueio, exibido abaixo do botao (ex.: saldo insuficiente). */
  motivoBloqueio?: string | null;
};

/**
 * Botao principal do aplicativo: chamar a corrida.
 *
 * Ate 18/09 este botao tinha uma "trava 03" de segurar tres segundos. O cliente
 * esclareceu que o 03 e outra coisa — um botao de panico, que agora vive em
 * Botao03.tsx. Deixar os dois exigindo pressao longa na mesma tela so
 * confundiria, e num pedido de socorro confusao custa caro. Entao chamar
 * voltou a ser um toque.
 */
export function BotaoChamar({
  onChamar,
  desabilitado = false,
  carregando = false,
  motivoBloqueio,
}: Props) {
  const inativo = desabilitado || carregando;

  return (
    <View style={estilos.bloco}>
      <Pressable
        onPress={inativo ? undefined : onChamar}
        disabled={inativo}
        accessibilityRole="button"
        accessibilityLabel="Chamar corrida"
        accessibilityState={{ disabled: inativo, busy: carregando }}
        style={({ pressed }) => [
          estilos.botao,
          shadow(3),
          pressed && !inativo && estilos.pressionado,
          inativo && estilos.inativo,
        ]}
      >
        {carregando ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={estilos.texto}>CHAMAR</Text>
        )}
      </Pressable>

      {motivoBloqueio ? (
        <Text style={estilos.bloqueio} accessibilityLiveRegion="polite">
          {motivoBloqueio}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
  botao: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.navy800,
  },
  pressionado: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  inativo: { opacity: 0.5 },
  texto: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.heavy,
    color: colors.onAccent,
    letterSpacing: 3,
  },
  bloqueio: {
    fontSize: font.size.sm,
    color: colors.danger,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
});
