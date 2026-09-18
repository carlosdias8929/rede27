import React, { useCallback, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PROTOCOLO_03 } from '../config/rede27.config';
import { colors, font, palette, radius, shadow, spacing } from '../theme';
import { useSegurar } from './segurar';

type Props = {
  /** Dispara o acionamento. Quem chama e que busca o GPS e fala com o banco. */
  onAcionar: () => void;
  enviando?: boolean;
  /** Ja existe um alerta ativo deste passageiro. */
  ativo?: boolean;
};

/**
 * PROTOCOLO 03 — botao de emergencia.
 *
 * Nao e o botao de chamar corrida e nao e uma trava dele: e um pedido de
 * socorro. O passageiro segura por 3 segundos e o painel Admin recebe o alerta
 * com a localizacao.
 *
 * Por que segurar em vez de tocar: um toque solto no bolso viraria alarme
 * falso, e alarme falso demais faz a central parar de olhar — que e justamente
 * quando o alerta de verdade chega.
 *
 * O aviso sonoro toca APENAS no painel Admin. Se o passageiro acionou por causa
 * do motorista, um som no carro avisaria exatamente quem representa o risco.
 */
export function Botao03({ onAcionar, enviando = false, ativo = false }: Props) {
  const [leitorDeTela, setLeitorDeTela] = useState(false);
  const [armado, setArmado] = useState(false);

  // Na web o react-native-web responde sempre "tem leitor de tela", entao so
  // perguntamos no celular (mesmo motivo documentado em BotaoChamar).
  React.useEffect(() => {
    if (Platform.OS === 'web') return;

    let vivo = true;
    AccessibilityInfo.isScreenReaderEnabled().then((ligado) => {
      if (vivo) setLeitorDeTela(ligado);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setLeitorDeTela);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);

  const acionar = useCallback(() => {
    if (enviando || ativo) return;
    onAcionar();
  }, [enviando, ativo, onAcionar]);

  const { segurar, soltar, segurando, larguraPreenchimento } = useSegurar({
    duracaoMs: PROTOCOLO_03.duracaoMs,
    onCompletar: acionar,
    desabilitado: enviando || ativo,
  });

  if (ativo) {
    return (
      <View style={[estilos.ativo, shadow(2)]} accessibilityLiveRegion="assertive">
        <Text style={estilos.ativoTitulo}>PROTOCOLO 03 ACIONADO</Text>
        <Text style={estilos.ativoTexto}>
          A central da REDE27 foi avisada e recebeu a sua localizacao. Se houver risco
          imediato, ligue tambem para 190.
        </Text>
      </View>
    );
  }

  // Com leitor de tela, "segurar" nao e confiavel: dois toques no lugar.
  if (leitorDeTela) {
    return (
      <View style={estilos.bloco}>
        <Pressable
          onPress={() => {
            if (armado) {
              setArmado(false);
              acionar();
            } else {
              setArmado(true);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={
            armado ? 'Toque novamente para acionar a emergencia 03' : 'Emergencia 03'
          }
          accessibilityState={{ busy: enviando }}
          style={[estilos.botao, shadow(2)]}
        >
          <Conteudo enviando={enviando} />
          <Text style={estilos.instrucao}>
            {armado ? 'Toque novamente para acionar' : 'Toque duas vezes para acionar'}
          </Text>
        </Pressable>
        <Rodape />
      </View>
    );
  }

  return (
    <View style={estilos.bloco}>
      <Pressable
        onPressIn={segurar}
        onPressOut={soltar}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel="Emergencia, protocolo 03"
        accessibilityHint={`Mantenha pressionado por ${PROTOCOLO_03.duracaoMs / 1000} segundos para avisar a central`}
        accessibilityState={{ busy: enviando }}
        style={[estilos.botao, shadow(2), enviando && estilos.enviando]}
      >
        <Animated.View
          pointerEvents="none"
          style={[estilos.preenchimento, { width: larguraPreenchimento }]}
        />
        <Conteudo enviando={enviando} />
        <Text style={estilos.instrucao}>
          {segurando ? 'Segurando... nao solte' : 'Segure 3 segundos em caso de emergencia'}
        </Text>
      </Pressable>
      <Rodape />
    </View>
  );
}

function Conteudo({ enviando }: { enviando: boolean }) {
  return (
    <View style={estilos.conteudo}>
      <View style={estilos.selo}>
        <Text style={estilos.seloTexto}>03</Text>
      </View>
      <Text style={estilos.titulo}>{enviando ? 'AVISANDO...' : 'EMERGENCIA'}</Text>
    </View>
  );
}

function Rodape() {
  return <Text style={estilos.rodape}>O 03 avisa a central da REDE27. Nao substitui o 190.</Text>;
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.xs },
  botao: {
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8E2A1F',
  },
  enviando: { opacity: 0.8 },
  preenchimento: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#8E2A1F',
  },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selo: {
    backgroundColor: palette.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  seloTexto: {
    fontSize: font.size.lg,
    fontWeight: font.weight.heavy,
    color: colors.danger,
    letterSpacing: 1,
  },
  titulo: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: palette.white,
    letterSpacing: 2,
  },
  instrucao: {
    fontSize: font.size.sm,
    color: '#FFD9D4',
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
  rodape: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
  ativo: {
    backgroundColor: colors.dangerBg,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  ativoTitulo: {
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
    color: colors.danger,
    letterSpacing: 1,
  },
  ativoTexto: { fontSize: font.size.sm, color: colors.text, lineHeight: 19 },
});
