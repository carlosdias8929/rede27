import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Mantem uma tela sincronizada com o banco.
 *
 * O Realtime do Supabase e a via rapida, mas nao e garantia: o socket cai
 * quando a aba vai para segundo plano, quando o celular troca de rede, quando o
 * aparelho dorme. E a queda e SILENCIOSA — a tela simplesmente para de mudar,
 * sem erro nenhum, e quem esta olhando acha que o sistema travou.
 *
 * Por isso aqui existem tres gatilhos para a mesma funcao de recarga:
 *
 *   1. evento do Realtime  — atualiza na hora;
 *   2. relogio             — recarrega de tempos em tempos, de qualquer forma;
 *   3. volta do foco       — recarrega ao reabrir a aba ou o aplicativo.
 *
 * Com os tres, um evento perdido custa alguns segundos de atraso em vez de
 * deixar a tela errada para sempre. Numa tela que mostra o andamento de uma
 * corrida e o debito da carteira, "errado para sempre" nao e aceitavel.
 */
export function useAoVivo({
  canal,
  tabela,
  filtro,
  aoMudar,
  intervaloMs = 8000,
  ativo = true,
}: {
  /** Nome unico do canal. Dois canais com o mesmo nome se atrapalham. */
  canal: string;
  tabela: 'corridas' | 'alertas_03';
  /** Filtro do postgres_changes, ex.: `id=eq.<uuid>`. Sem filtro, ouve a tabela toda. */
  filtro?: string;
  /** Recarrega o estado a partir do banco. Deve ser idempotente. */
  aoMudar: () => void | Promise<void>;
  intervaloMs?: number;
  ativo?: boolean;
}) {
  // A funcao muda a cada render; guardamos a versao atual para nao refazer a
  // assinatura toda vez que a tela redesenha.
  const recarregar = useRef(aoMudar);
  useEffect(() => {
    recarregar.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    if (!ativo) return;

    let vivo = true;
    const chamar = () => {
      if (vivo) void recarregar.current();
    };

    // 1. Realtime
    const assinatura = supabase
      .channel(canal)
      .on(
        'postgres_changes',
        filtro
          ? { event: '*', schema: 'public', table: tabela, filter: filtro }
          : { event: '*', schema: 'public', table: tabela },
        chamar,
      )
      .subscribe();

    // 2. Relogio
    const relogio = setInterval(chamar, intervaloMs);

    // 3. Volta do foco
    let limparFoco = () => {};

    if (Platform.OS === 'web') {
      const aoVoltar = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') chamar();
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', aoVoltar);
        window.addEventListener('online', chamar);
        limparFoco = () => {
          document.removeEventListener('visibilitychange', aoVoltar);
          window.removeEventListener('online', chamar);
        };
      }
    } else {
      const sub = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') chamar();
      });
      limparFoco = () => sub.remove();
    }

    return () => {
      vivo = false;
      clearInterval(relogio);
      limparFoco();
      supabase.removeChannel(assinatura);
    };
  }, [canal, tabela, filtro, intervaloMs, ativo]);
}
