import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../src/components/Logo';
import { useSessao } from '../src/state/sessao';
import { colors, font, spacing } from '../src/theme';

/** Porta de entrada: decide entre a tela de login e a tela de chamada. */
export default function Entrada() {
  const { carregando, session } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.container}>
        <Logo tamanho="lg" sobreEscuro mostrarSlogan />
        <ActivityIndicator color={colors.accentSoft} style={estilos.spinner} />
        <Text style={estilos.texto}>Carregando...</Text>
      </View>
    );
  }

  return <Redirect href={session ? '/inicio' : '/login'} />;
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  spinner: { marginTop: spacing.lg },
  texto: { color: colors.textOnDark, fontSize: font.size.sm },
});
