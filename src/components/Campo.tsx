import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, font, HIT_TARGET, radius, spacing } from '../theme';

type Props = TextInputProps & {
  rotulo: string;
  erro?: string | null;
  ajuda?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Conteudo ancorado a direita do campo (ex.: botao de mostrar senha). */
  acessorio?: React.ReactNode;
};

/**
 * Campo de texto padrao do app.
 *
 * Acessibilidade: nao definimos keyboardType restritivo nem desativamos o
 * teclado do sistema, entao o microfone de ditado do teclado nativo (Gboard no
 * Android, ditado no iPhone) continua disponivel em todo campo de texto livre.
 */
export const Campo = forwardRef<TextInput, Props>(function Campo(
  { rotulo, erro, ajuda, containerStyle, acessorio, style, ...props },
  ref,
) {
  const temErro = Boolean(erro);

  return (
    <View style={[estilos.container, containerStyle]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>

      <View style={[estilos.caixa, temErro && estilos.caixaErro]}>
        <TextInput
          ref={ref}
          style={[estilos.input, style]}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={rotulo}
          accessibilityHint={ajuda}
          {...props}
        />
        {acessorio ? <View style={estilos.acessorio}>{acessorio}</View> : null}
      </View>

      {temErro ? (
        <Text style={estilos.erro} accessibilityLiveRegion="polite">
          {erro}
        </Text>
      ) : ajuda ? (
        <Text style={estilos.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
});

const estilos = StyleSheet.create({
  container: { gap: spacing.xs },
  rotulo: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HIT_TARGET,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  caixaErro: { borderColor: colors.danger },
  input: {
    flex: 1,
    fontSize: font.size.md,
    color: colors.text,
    paddingVertical: spacing.md,
    // Remove o contorno azul padrao do navegador na versao web.
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  acessorio: { paddingLeft: spacing.sm },
  erro: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
  ajuda: { fontSize: font.size.xs, color: colors.textFaint },
});
