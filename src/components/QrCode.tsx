import { create } from 'qrcode';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, font, radius, spacing } from '../theme';

type Props = {
  valor: string;
  /** Lado em pixels. */
  tamanho?: number;
  rotuloAcessivel?: string;
};

/**
 * QR Code desenhado em SVG, igual no Android e na web.
 *
 * Os modulos sao gerados no aparelho e viram um unico <Path>: um QR de PIX tem
 * mais de mil quadradinhos, e um elemento por quadradinho deixaria a tela
 * lenta em celular simples.
 *
 * Preto no branco, com a margem de 4 modulos que o padrao pede: e o que os
 * leitores de banco leem sem erro. Nada de cor da marca por cima do codigo.
 */
export function QrCode({ valor, tamanho = 220, rotuloAcessivel }: Props) {
  const desenho = useMemo(() => {
    try {
      const qr = create(valor, { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      let caminho = '';
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (qr.modules.data[y * n + x]) caminho += `M${x + 4} ${y + 4}h1v1h-1z`;
        }
      }
      return { caminho, lado: n + 8 };
    } catch {
      return null;
    }
  }, [valor]);

  if (!desenho) {
    return (
      <View style={[estilos.erro, { width: tamanho, height: tamanho }]}>
        <Text style={estilos.erroTexto}>Nao foi possivel gerar o QR Code. Use o copia e cola.</Text>
      </View>
    );
  }

  return (
    <View
      style={estilos.moldura}
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotuloAcessivel ?? 'QR Code PIX'}
    >
      <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${desenho.lado} ${desenho.lado}`}>
        <Rect x={0} y={0} width={desenho.lado} height={desenho.lado} fill="#FFFFFF" />
        <Path d={desenho.caminho} fill="#000000" />
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  moldura: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    alignSelf: 'center',
  },
  erro: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignSelf: 'center',
  },
  erroTexto: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
});
