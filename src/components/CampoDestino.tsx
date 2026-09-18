import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { buscarEndereco, resumirEndereco, type EnderecoEncontrado } from '../lib/geo';
import { colors, font, palette, radius, spacing } from '../theme';
import { Campo } from './Campo';

type Props = {
  valor: string;
  onChange: (texto: string) => void;
  onSelecionarSugestao: (sugestao: EnderecoEncontrado) => void;
  cidade?: string;
  uf?: string;
  erro?: string | null;
};

/**
 * Campo "Para onde vamos?" com entrada por voz e sugestoes de endereco.
 *
 * Voz — Android/iOS: e um campo de texto livre, sem teclado restrito, entao o
 * microfone de ditado do proprio teclado (Gboard / teclado da Apple) aparece
 * sem permissao, tela extra ou biblioteca. Na web, quando o navegador oferece
 * reconhecimento de fala nativo, o mesmo botao dita direto no campo.
 *
 * Sugestoes — vem do Nominatim (OpenStreetMap), o "mapa gratuito provisorio"
 * aprovado pelo cliente. Escolher uma sugestao e o que da coordenadas ao
 * destino; sem isso a corrida sai pela distancia minima.
 */
export function CampoDestino({ valor, onChange, onSelecionarSugestao, cidade, uf, erro }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimento = useRef<any>(null);

  const [sugestoes, setSugestoes] = useState<EnderecoEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState(false);

  const suporteWebDeVoz =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Busca com atraso: sem isso o Nominatim levaria uma consulta por tecla.
  useEffect(() => {
    if (escolhido) return;

    const termo = valor.trim();
    if (termo.length < 4) {
      setSugestoes([]);
      return;
    }

    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      const achados = await buscarEndereco(termo, { cidade, uf });
      if (!cancelado) {
        setSugestoes(achados);
        setBuscando(false);
      }
    }, 700);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [valor, cidade, uf, escolhido]);

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
      if (texto) {
        setEscolhido(false);
        onChange(String(texto));
      }
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
    // No celular quem dita e o teclado: basta abri-lo no campo certo.
    inputRef.current?.focus();
  }, [suporteWebDeVoz, ditarNaWeb]);

  return (
    <View style={estilos.bloco}>
      <Campo
        ref={inputRef}
        rotulo="Para onde vamos?"
        value={valor}
        onChangeText={(t) => {
          setEscolhido(false);
          onChange(t);
        }}
        placeholder="Digite ou fale o endereco de destino"
        erro={erro}
        ajuda={
          suporteWebDeVoz
            ? 'Toque no microfone para falar o endereco.'
            : 'Para falar o endereco, toque no microfone do seu teclado.'
        }
        keyboardType="default"
        autoCapitalize="sentences"
        autoCorrect
        returnKeyType="search"
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

      {buscando ? (
        <View style={estilos.buscando}>
          <ActivityIndicator size="small" color={colors.secondary} />
          <Text style={estilos.buscandoTexto}>Procurando endereco...</Text>
        </View>
      ) : null}

      {!escolhido && sugestoes.length > 0 ? (
        <View style={estilos.sugestoes}>
          {sugestoes.map((s, i) => (
            <Pressable
              key={`${s.latitude},${s.longitude},${i}`}
              onPress={() => {
                setEscolhido(true);
                setSugestoes([]);
                onSelecionarSugestao(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Usar endereco ${resumirEndereco(s.rotulo)}`}
              style={({ pressed }) => [estilos.sugestao, pressed && estilos.sugestaoPressionada]}
            >
              <Text style={estilos.sugestaoTitulo} numberOfLines={1}>
                {resumirEndereco(s.rotulo, 2)}
              </Text>
              <Text style={estilos.sugestaoDetalhe} numberOfLines={1}>
                {resumirEndereco(s.rotulo, 5)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {escolhido ? (
        <Text style={estilos.confirmado}>Endereco localizado. Distancia calculada.</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
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
  buscando: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buscandoTexto: { fontSize: font.size.xs, color: colors.textFaint },
  sugestoes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  sugestao: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  sugestaoPressionada: { backgroundColor: colors.primaryLight },
  sugestaoTitulo: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  sugestaoDetalhe: { fontSize: font.size.xs, color: colors.textFaint },
  confirmado: { fontSize: font.size.xs, color: colors.success, fontWeight: font.weight.medium },
});
