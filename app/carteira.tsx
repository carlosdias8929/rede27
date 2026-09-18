import { Redirect, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { CartaoCarteira } from '../src/components/CartaoCarteira';
import { CARTEIRA, MARCA } from '../src/config/rede27.config';
import { brl, dataHoraCurta, paraReais } from '../src/lib/format';
import { supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, radius, spacing } from '../src/theme';
import type { TransacaoRow } from '../src/types/database';

/** Extrato da carteira do passageiro. */
export default function Carteira() {
  const { session, carteira, carregando: carregandoSessao, recarregarCarteira } = useSessao();
  const insets = useSafeAreaInsets();

  const [transacoes, setTransacoes] = useState<TransacaoRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!carteira?.id) {
      setCarregando(false);
      return;
    }

    const { data } = await supabase
      .from('transacoes')
      .select('*')
      .eq('carteira_id', carteira.id)
      .order('criado_em', { ascending: false })
      .limit(50);

    setTransacoes(data ?? []);
    setCarregando(false);
  }, [carteira?.id]);

  useEffect(() => {
    recarregarCarteira();
    carregar();
  }, [carregar, recarregarCarteira]);

  // Mesma espera da tela de corrida: a sessao chega de forma assincrona.
  if (carregandoSessao) {
    return (
      <View style={estilos.carregandoSessao}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <View style={[estilos.raiz, { paddingTop: insets.top + spacing.lg }]}>
      <View style={estilos.topo}>
        <Text style={estilos.titulo}>Minha carteira</Text>
        <Botao titulo="Fechar" variante="texto" onPress={() => router.back()} />
      </View>

      <View style={estilos.bloco}>
        <CartaoCarteira saldoCentavos={carteira?.saldo_centavos ?? 0} />
      </View>

      <Text style={estilos.secao}>Extrato</Text>

      {carregando ? (
        <ActivityIndicator color={colors.primary} style={estilos.spinner} />
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            estilos.lista,
            { paddingBottom: insets.bottom + spacing.xxl },
            transacoes.length === 0 && estilos.listaVazia,
          ]}
          ListEmptyComponent={
            <View style={estilos.vazio}>
              <Text style={estilos.vazioTitulo}>Nenhuma movimentacao ainda</Text>
              <Text style={estilos.vazioTexto}>
                {CARTEIRA.modo === 'saldo_simples'
                  ? `Os creditos sao lancados pela central da ${MARCA.empresa} nesta fase.`
                  : 'Faca uma recarga para comecar a usar.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const credito = item.tipo === 'credito';
            return (
              <View style={estilos.item}>
                <View style={estilos.itemInfo}>
                  <Text style={estilos.itemDescricao} numberOfLines={1}>
                    {item.descricao || (credito ? 'Credito' : 'Debito')}
                  </Text>
                  <Text style={estilos.itemData}>{dataHoraCurta(item.criado_em)}</Text>
                </View>
                <Text style={[estilos.itemValor, credito ? estilos.credito : estilos.debito]}>
                  {credito ? '+' : '-'} {brl(paraReais(item.valor_centavos))}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bg },
  carregandoSessao: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  titulo: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primaryDark },
  bloco: { padding: spacing.lg },
  secao: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  spinner: { marginTop: spacing.xl },
  lista: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  listaVazia: { flexGrow: 1, justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemDescricao: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  itemData: { fontSize: font.size.xs, color: colors.textFaint },
  itemValor: { fontSize: font.size.md, fontWeight: font.weight.bold },
  credito: { color: colors.success },
  debito: { color: colors.danger },
  vazio: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  vazioTitulo: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.textMuted },
  vazioTexto: { fontSize: font.size.sm, color: colors.textFaint, textAlign: 'center' },
});
