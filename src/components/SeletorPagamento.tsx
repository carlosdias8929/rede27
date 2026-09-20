import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { brl, paraReais } from '../lib/format';
import { colors, font, palette, radius, spacing } from '../theme';
import type { FormaPagamento } from '../types/database';
import { Campo } from './Campo';

type Props = {
  forma: FormaPagamento;
  onFormaChange: (forma: FormaPagamento) => void;
  /** Texto cru do campo "vai pagar com", como o passageiro digitou. */
  valorPago: string;
  onValorPagoChange: (texto: string) => void;
  /** Valor da corrida em centavos, para calcular o troco. */
  valorCorridaCentavos: number;
  saldoCentavos: number;
};

/** Converte "50", "50,00" ou "R$ 50" em centavos. Devolve null se nao der. */
export function lerValorEmCentavos(texto: string): number | null {
  const limpo = (texto ?? '').replace(/[^\d,.]/g, '').replace(',', '.');
  if (!limpo) return null;

  const n = Number(limpo);
  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.round(n * 100);
}

/**
 * Como o passageiro vai pagar.
 *
 * Carteira: desconta do saldo ao concluir, valor exato, sem troco.
 * Dinheiro: paga na mao do motorista. Aqui entra o "Vai pagar com R$" que o
 * cliente pediu, e o troco sai da conta — o motorista ja embarca sabendo se
 * precisa levar troco.
 */
export function SeletorPagamento({
  forma,
  onFormaChange,
  valorPago,
  onValorPagoChange,
  valorCorridaCentavos,
  saldoCentavos,
}: Props) {
  const pagoCentavos = lerValorEmCentavos(valorPago);
  const insuficiente = pagoCentavos !== null && pagoCentavos < valorCorridaCentavos;
  const troco = pagoCentavos !== null && !insuficiente ? pagoCentavos - valorCorridaCentavos : null;

  const opcoes: Array<{ chave: FormaPagamento; titulo: string; detalhe: string }> = [
    {
      chave: 'carteira',
      titulo: 'Carteira',
      detalhe: `Saldo ${brl(paraReais(saldoCentavos))}`,
    },
    {
      chave: 'dinheiro',
      titulo: 'Dinheiro',
      detalhe: 'Paga ao motorista',
    },
  ];

  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>Como vai pagar</Text>

      <View style={estilos.opcoes} accessibilityRole="radiogroup">
        {opcoes.map((o) => {
          const ativa = o.chave === forma;
          return (
            <Pressable
              key={o.chave}
              onPress={() => onFormaChange(o.chave)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={`${o.titulo}. ${o.detalhe}`}
              style={[estilos.opcao, ativa && estilos.opcaoAtiva]}
            >
              <Text style={[estilos.opcaoTitulo, ativa && estilos.opcaoTituloAtivo]}>
                {o.titulo}
              </Text>
              <Text style={estilos.opcaoDetalhe}>{o.detalhe}</Text>
            </Pressable>
          );
        })}
      </View>

      {forma === 'dinheiro' ? (
        <View style={estilos.dinheiro}>
          <Campo
            rotulo="Vai pagar com R$"
            value={valorPago}
            onChangeText={onValorPagoChange}
            placeholder="Ex.: 50,00"
            keyboardType="decimal-pad"
            erro={insuficiente ? 'Valor menor que o da corrida.' : null}
            ajuda={
              insuficiente
                ? undefined
                : 'Informe com quanto vai pagar para o motorista levar o troco certo.'
            }
          />

          <View style={[estilos.troco, troco === null && estilos.trocoVazio]}>
            <Text style={estilos.trocoRotulo}>Troco a receber</Text>
            <Text style={estilos.trocoValor}>
              {troco === null ? '—' : brl(paraReais(troco))}
            </Text>
          </View>

          <Text style={estilos.aviso}>
            Em dinheiro nada e descontado da carteira. Voce paga direto ao motorista.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
  rotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  opcoes: { flexDirection: 'row', gap: spacing.sm },
  opcao: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  opcaoAtiva: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
  opcaoTitulo: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  opcaoTituloAtivo: { color: colors.primaryDark },
  opcaoDetalhe: { fontSize: font.size.xs, color: colors.textMuted },
  dinheiro: { gap: spacing.sm, marginTop: spacing.xs },
  troco: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: palette.gold300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  trocoVazio: { opacity: 0.6 },
  trocoRotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  trocoValor: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.primaryDark },
  aviso: { fontSize: font.size.xs, color: colors.textFaint },
});
