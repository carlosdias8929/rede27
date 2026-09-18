import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, palette, radius, spacing } from '../theme';
import { Campo } from './Campo';

type Props = {
  valor: string;
  onChange: (texto: string) => void;
  erro?: string | null;
};

/**
 * Campo "Para onde vamos?" com entrada por voz.
 *
 * Android/iOS: e um campo de texto comum de proposito geral, entao o microfone
 * de ditado do proprio teclado (Gboard / teclado da Apple) aparece sem que o
 * app precise de permissao, tela extra ou biblioteca. O botao ao lado apenas
 * poe o foco no campo e abre o teclado, e o texto de ajuda explica onde tocar.
 *
 * Web: quando o navegador oferece reconhecimento de fala nativo, o mesmo botao
 * dita direto no campo. Onde nao houver, ele some e o campo segue normal.
 */
export function CampoDestino({ valor, onChange, erro }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimento = useRef<any>(null);

  const suporteWebDeVoz =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const ditarNaWeb = useCallback(() => {
    const Reconhecedor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Reconhecedor) return;

    if (ouvindo) {
      reconhecimento.current?.stop();
      setOuvindo(false);
      return;
    }

    const r = new Reconhecedor();
    r.lang = 'pt-BR';
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (evento: any) => {
      const texto = evento?.results?.[0]?.[0]?.transcript;
      if (texto) onChange(String(texto));
    };
    r.onerror = () => setOuvindo(false);
    r.onend = () => setOuvindo(false);

    reconhecimento.current = r;
    setOuvindo(true);
    r.start();
  }, [ouvindo, onChange]);

  const aoTocarMicrofone = useCallback(() => {
    if (suporteWebDeVoz) {
      ditarNaWeb();
      return;
    }
    // No celular, quem dita e o teclado: basta abri-lo no campo certo.
    inputRef.current?.focus();
  }, [suporteWebDeVoz, ditarNaWeb]);

  return (
    <Campo
      ref={inputRef}
      rotulo="Para onde vamos?"
      value={valor}
      onChangeText={onChange}
      placeholder="Digite ou fale o endereco de destino"
      erro={erro}
      ajuda={
        suporteWebDeVoz
          ? 'Toque no microfone para falar o endereco.'
          : 'Para falar o endereco, toque no microfone do seu teclado.'
      }
      // Campo de texto livre: mantem o teclado completo, com o microfone.
      keyboardType="default"
      autoCapitalize="sentences"
      autoCorrect
      returnKeyType="done"
      acessorio={
        <Pressable
          onPress={aoTocarMicrofone}
          accessibilityRole="button"
          accessibilityLabel={
            suporteWebDeVoz
              ? ouvindo
                ? 'Parar de ouvir'
                : 'Falar o endereco de destino'
              : 'Abrir o teclado para ditar o endereco'
          }
          accessibilityState={{ busy: ouvindo }}
          hitSlop={12}
          style={[estilos.microfone, ouvindo && estilos.microfoneAtivo]}
        >
          <Text style={[estilos.microfoneIcone, ouvindo && estilos.microfoneIconeAtivo]}>
            {ouvindo ? '■' : '🎤'}
          </Text>
        </Pressable>
      }
    />
  );
}

const estilos = StyleSheet.create({
  microfone: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: palette.gold300,
  },
  microfoneAtivo: { backgroundColor: colors.danger, borderColor: colors.danger },
  microfoneIcone: { fontSize: font.size.md, color: colors.text },
  microfoneIconeAtivo: { color: colors.textOnDark, fontWeight: font.weight.bold },
});
