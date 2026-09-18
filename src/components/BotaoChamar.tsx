import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import { TRAVA_03 } from '../config/rede27.config';
import { colors, font, palette, radius, shadow, spacing } from '../theme';
import { Botao } from './Botao';

type Props = {
  onConfirmar: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
  /** Motivo do bloqueio, exibido abaixo do botao (ex.: saldo insuficiente). */
  motivoBloqueio?: string | null;
};

/**
 * Botao CHAMAR com a trava de seguranca "03".
 *
 * Os dois modos possiveis estao implementados; qual deles vale e decidido em
 * TRAVA_03.modo (src/config/rede27.config.ts):
 *
 *   SEGURAR_3S — o passageiro mantem o botao pressionado por 3 segundos e um
 *                anel de progresso preenche ate liberar a chamada;
 *   CODIGO_03  — o passageiro digita o codigo "03" para destravar e confirmar.
 *
 * Em ambos o objetivo e o mesmo: impedir chamada acidental com um toque solto.
 */
export function BotaoChamar({
  onConfirmar,
  desabilitado = false,
  carregando = false,
  motivoBloqueio,
}: Props) {
  if (TRAVA_03.modo === 'CODIGO_03') {
    return (
      <TravaPorCodigo
        onConfirmar={onConfirmar}
        desabilitado={desabilitado}
        carregando={carregando}
        motivoBloqueio={motivoBloqueio}
      />
    );
  }

  return (
    <TravaPorPressao
      onConfirmar={onConfirmar}
      desabilitado={desabilitado}
      carregando={carregando}
      motivoBloqueio={motivoBloqueio}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Modo 1 — segurar por 3 segundos                                            */
/* -------------------------------------------------------------------------- */

function TravaPorPressao({ onConfirmar, desabilitado, carregando, motivoBloqueio }: Props) {
  const progresso = useRef(new Animated.Value(0)).current;
  const animacao = useRef<Animated.CompositeAnimation | null>(null);
  const [segurando, setSegurando] = useState(false);
  const [leitorDeTela, setLeitorDeTela] = useState(false);

  // Com leitor de tela ativo nao da para "segurar" o botao de forma confiavel,
  // entao oferecemos uma confirmacao em dois toques no lugar.
  //
  // So consultamos no celular: na web o react-native-web nao consegue detectar
  // leitor de tela e responde `true` sempre, o que tirava a trava de 3 segundos
  // de todo mundo que abrisse pelo navegador.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let ativo = true;
    AccessibilityInfo.isScreenReaderEnabled().then((ligado) => {
      if (ativo) setLeitorDeTela(ligado);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setLeitorDeTela);
    return () => {
      ativo = false;
      sub.remove();
    };
  }, []);

  const parar = useCallback(() => {
    animacao.current?.stop();
    animacao.current = null;
    setSegurando(false);
    Animated.timing(progresso, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progresso]);

  const comecar = useCallback(() => {
    if (desabilitado || carregando) return;

    setSegurando(true);
    progresso.setValue(0);

    const anim = Animated.timing(progresso, {
      toValue: 1,
      duration: TRAVA_03.duracaoMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    animacao.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;
      animacao.current = null;
      setSegurando(false);
      if (Platform.OS !== 'web') Vibration.vibrate(40);
      progresso.setValue(0);
      onConfirmar();
    });
  }, [carregando, desabilitado, onConfirmar, progresso]);

  useEffect(() => () => animacao.current?.stop(), []);

  const larguraPreenchimento = progresso.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const inativo = desabilitado || carregando;

  if (leitorDeTela) {
    return (
      <View style={estilos.bloco}>
        <ConfirmacaoDoisToques
          onConfirmar={onConfirmar}
          desabilitado={desabilitado}
          carregando={carregando}
        />
        <Rodape motivoBloqueio={motivoBloqueio} texto={TRAVA_03.rotulo.SEGURAR_3S} />
      </View>
    );
  }

  return (
    <View style={estilos.bloco}>
      <Pressable
        onPressIn={comecar}
        onPressOut={parar}
        disabled={inativo}
        accessibilityRole="button"
        accessibilityLabel="Chamar"
        accessibilityHint={`Mantenha pressionado por ${TRAVA_03.duracaoMs / 1000} segundos para confirmar a chamada`}
        accessibilityState={{ disabled: inativo, busy: carregando }}
        style={[estilos.botaoGrande, shadow(3), inativo && estilos.inativo]}
      >
        {/* Preenchimento que avanca durante os 3 segundos de pressao. */}
        <Animated.View
          pointerEvents="none"
          style={[estilos.preenchimento, { width: larguraPreenchimento }]}
        />

        <View style={estilos.conteudoBotao}>
          <Text style={estilos.textoChamar}>CHAMAR</Text>
          <View style={estilos.selo03}>
            <Text style={estilos.selo03Texto}>03</Text>
          </View>
        </View>

        <Text style={estilos.instrucao}>
          {segurando ? 'Segurando... nao solte' : TRAVA_03.rotulo.SEGURAR_3S}
        </Text>
      </Pressable>

      <Rodape motivoBloqueio={motivoBloqueio} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Modo 2 — digitar o codigo 03                                               */
/* -------------------------------------------------------------------------- */

function TravaPorCodigo({ onConfirmar, desabilitado, carregando, motivoBloqueio }: Props) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const inativo = desabilitado || carregando;
  const liberado = codigo.trim() === TRAVA_03.codigo;

  const confirmar = useCallback(() => {
    if (!liberado) {
      setErro(`Codigo incorreto. Digite ${TRAVA_03.codigo} para liberar.`);
      return;
    }
    setErro(null);
    setAberto(false);
    setCodigo('');
    onConfirmar();
  }, [liberado, onConfirmar]);

  return (
    <View style={estilos.bloco}>
      <Pressable
        onPress={() => !inativo && setAberto((v) => !v)}
        disabled={inativo}
        accessibilityRole="button"
        accessibilityLabel="Chamar"
        accessibilityHint={TRAVA_03.rotulo.CODIGO_03}
        accessibilityState={{ disabled: inativo, expanded: aberto }}
        style={[estilos.botaoGrande, shadow(3), inativo && estilos.inativo]}
      >
        <View style={estilos.conteudoBotao}>
          <Text style={estilos.textoChamar}>CHAMAR</Text>
          <View style={estilos.selo03}>
            <Text style={estilos.selo03Texto}>03</Text>
          </View>
        </View>
        <Text style={estilos.instrucao}>{TRAVA_03.rotulo.CODIGO_03}</Text>
      </Pressable>

      {aberto ? (
        <View style={estilos.caixaCodigo}>
          <Text style={estilos.rotuloCodigo}>Codigo de liberacao</Text>
          <View style={estilos.linhaCodigo}>
            <TextInput
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t.replace(/\D/g, '').slice(0, 2));
                setErro(null);
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Codigo de liberacao da chamada"
              style={estilos.inputCodigo}
              autoFocus
            />
            <Botao
              titulo="Confirmar chamada"
              onPress={confirmar}
              carregando={carregando}
              desabilitado={!liberado}
              style={estilos.botaoConfirmar}
            />
          </View>
          {erro ? (
            <Text style={estilos.erroCodigo} accessibilityLiveRegion="polite">
              {erro}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Rodape motivoBloqueio={motivoBloqueio} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/** Alternativa acessivel: dois toques em vez de pressao continua. */
function ConfirmacaoDoisToques({
  onConfirmar,
  desabilitado,
  carregando,
}: Pick<Props, 'onConfirmar' | 'desabilitado' | 'carregando'>) {
  const [armado, setArmado] = useState(false);

  return (
    <Pressable
      onPress={() => {
        if (desabilitado || carregando) return;
        if (armado) {
          setArmado(false);
          onConfirmar();
        } else {
          setArmado(true);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={armado ? 'Toque novamente para confirmar a chamada' : 'Chamar'}
      accessibilityState={{ disabled: desabilitado, busy: carregando }}
      style={[estilos.botaoGrande, shadow(3), (desabilitado || carregando) && estilos.inativo]}
    >
      <View style={estilos.conteudoBotao}>
        <Text style={estilos.textoChamar}>CHAMAR</Text>
        <View style={estilos.selo03}>
          <Text style={estilos.selo03Texto}>03</Text>
        </View>
      </View>
      <Text style={estilos.instrucao}>
        {armado ? 'Toque novamente para confirmar' : 'Toque duas vezes para chamar'}
      </Text>
    </Pressable>
  );
}

function Rodape({ motivoBloqueio, texto }: { motivoBloqueio?: string | null; texto?: string }) {
  if (motivoBloqueio) {
    return (
      <Text style={estilos.bloqueio} accessibilityLiveRegion="polite">
        {motivoBloqueio}
      </Text>
    );
  }
  if (texto) return <Text style={estilos.rodapeAjuda}>{texto}</Text>;
  return null;
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
  botaoGrande: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.gold400,
  },
  inativo: { opacity: 0.5 },
  preenchimento: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.green500,
  },
  conteudoBotao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textoChamar: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.heavy,
    color: colors.onPrimary,
    letterSpacing: 3,
  },
  selo03: {
    backgroundColor: palette.gold300,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: palette.gold500,
  },
  selo03Texto: {
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
    color: palette.green900,
    letterSpacing: 1,
  },
  instrucao: {
    fontSize: font.size.sm,
    color: palette.green100,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
  caixaCodigo: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.gold300,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rotuloCodigo: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  linhaCodigo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  inputCodigo: {
    width: 76,
    textAlign: 'center',
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: palette.gold500,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  botaoConfirmar: { flex: 1 },
  erroCodigo: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
  bloqueio: {
    fontSize: font.size.sm,
    color: colors.danger,
    fontWeight: font.weight.medium,
    textAlign: 'center',
  },
  rodapeAjuda: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
});
