import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAoVivo } from '../lib/aoVivo';
import { brl, dataHoraCurta, paraReais } from '../lib/format';
import { supabase } from '../lib/supabase';
import { colors, font, palette, radius, spacing } from '../theme';
import type { RecargaPixRow, StatusRecargaPix } from '../types/database';

const STATUS: Record<StatusRecargaPix, { texto: string; fundo: string; cor: string }> = {
  pendente: { texto: 'Aguardando conferencia', fundo: palette.gold100, cor: palette.navy900 },
  aprovada: { texto: 'Aprovada', fundo: colors.successBg, cor: colors.success },
  recusada: { texto: 'Recusada', fundo: colors.dangerBg, cor: colors.danger },
};

/**
 * Pedidos de recarga PIX do passageiro, com o status de cada um.
 *
 * Atualiza sozinho: quando o Admin aprova, o status muda aqui e o saldo sobe
 * (via `aoMudar`), sem o passageiro precisar sair e entrar de novo.
 */
export function MinhasRecargas({
  passageiroId,
  aoMudar,
  limite = 10,
}: {
  passageiroId: string;
  /** Chamado quando algum pedido muda — use para recarregar o saldo. */
  aoMudar?: () => void;
  limite?: number;
}) {
  const [recargas, setRecargas] = useState<RecargaPixRow[] | null>(null);
  const ultimaAssinatura = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('recargas_pix')
      .select('*')
      .eq('passageiro_id', passageiroId)
      .order('criada_em', { ascending: false })
      .limit(limite);

    if (error) return;
    const novas = data ?? [];
    // So avisa quem esta acima se algo mudou de fato (status ou quantidade).
    const assinatura = novas.map((r) => `${r.id}:${r.status}`).join('|');
    if (ultimaAssinatura.current !== null && ultimaAssinatura.current !== assinatura) aoMudar?.();
    ultimaAssinatura.current = assinatura;
    setRecargas(novas);
  }, [passageiroId, limite, aoMudar]);

  useAoVivo({
    canal: `minhas-recargas-${passageiroId}`,
    tabela: 'recargas_pix',
    filtro: `passageiro_id=eq.${passageiroId}`,
    aoMudar: carregar,
  });

  // Primeira leitura sem esperar o relogio do useAoVivo.
  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!recargas || recargas.length === 0) return null;

  return (
    <View style={estilos.bloco}>
      <Text style={estilos.titulo}>Minhas recargas por PIX</Text>
      {recargas.map((r) => {
        const s = STATUS[r.status];
        const valor =
          r.status === 'aprovada'
            ? (r.valor_aprovado_centavos ?? r.valor_centavos)
            : r.valor_centavos;
        return (
          <View key={r.id} style={estilos.item}>
            <View style={estilos.linha}>
              <Text style={estilos.valor}>
                {r.status === 'aprovada' ? '+ ' : ''}
                {brl(paraReais(valor))}
              </Text>
              <View style={[estilos.selo, { backgroundColor: s.fundo }]}>
                <Text style={[estilos.seloTexto, { color: s.cor }]}>{s.texto}</Text>
              </View>
            </View>
            <Text style={estilos.meta}>
              {r.conta_banco} · codigo {r.codigo_referencia} · {dataHoraCurta(r.criada_em)}
            </Text>
            {r.status === 'aprovada' && r.valor_aprovado_centavos !== r.valor_centavos ? (
              <Text style={estilos.meta}>
                Informado {brl(paraReais(r.valor_centavos))}; creditado o valor conferido no
                extrato.
              </Text>
            ) : null}
            {r.status === 'pendente' ? (
              <Text style={estilos.meta}>A central confere o PIX no extrato e libera o saldo.</Text>
            ) : null}
            {r.status === 'recusada' && r.motivo_recusa ? (
              <Text style={estilos.motivo}>Motivo: {r.motivo_recusa}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
  titulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  valor: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  selo: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  seloTexto: { fontSize: font.size.xs, fontWeight: font.weight.bold },
  meta: { fontSize: font.size.xs, color: colors.textFaint },
  motivo: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
});
