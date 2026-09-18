import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Vibration } from 'react-native';

/**
 * "Segurar por N segundos para confirmar".
 *
 * Usado em dois lugares com significados bem diferentes — o botao CHAMAR e o
 * botao de emergencia 03 — entao a mecanica mora aqui, uma vez so. Soltar antes
 * do tempo cancela e o progresso volta a zero.
 *
 * O progresso e um Animated.Value entre 0 e 1: quem usa decide se vira largura,
 * anel ou opacidade.
 */
export function useSegurar({
  duracaoMs,
  onCompletar,
  desabilitado = false,
}: {
  duracaoMs: number;
  onCompletar: () => void;
  desabilitado?: boolean;
}) {
  const progresso = useRef(new Animated.Value(0)).current;
  const animacao = useRef<Animated.CompositeAnimation | null>(null);
  const [segurando, setSegurando] = useState(false);

  // onCompletar costuma ser uma funcao nova a cada render; guardamos a versao
  // atual para nao reiniciar a animacao a cada atualizacao da tela.
  const completar = useRef(onCompletar);
  useEffect(() => {
    completar.current = onCompletar;
  }, [onCompletar]);

  const soltar = useCallback(() => {
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

  const segurar = useCallback(() => {
    if (desabilitado) return;

    setSegurando(true);
    progresso.setValue(0);

    const anim = Animated.timing(progresso, {
      toValue: 1,
      duration: duracaoMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    animacao.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;

      animacao.current = null;
      setSegurando(false);
      progresso.setValue(0);

      // Confirmacao tatil: o usuario sabe que soltou no momento certo sem
      // precisar olhar a tela.
      if (Platform.OS !== 'web') Vibration.vibrate(40);

      completar.current();
    });
  }, [desabilitado, duracaoMs, progresso]);

  useEffect(() => () => animacao.current?.stop(), []);

  const larguraPreenchimento = progresso.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return { segurar, soltar, segurando, progresso, larguraPreenchimento };
}
