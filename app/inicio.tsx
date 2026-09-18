import { Redirect, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotaoChamar } from '../src/components/BotaoChamar';
import { CampoDestino } from '../src/components/CampoDestino';
import { CartaoCarteira } from '../src/components/CartaoCarteira';
import { Logo } from '../src/components/Logo';
import { estimarCentavos, SeletorCategoria } from '../src/components/SeletorCategoria';
import { CATEGORIAS } from '../src/config/rede27.config';
import { brl, paraReais } from '../src/lib/format';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, spacing } from '../src/theme';
import type { CategoriaRow, CorridaRow } from '../src/types/database';

/** Distancia usada na estimativa enquanto nao ha calculo de rota por mapa. */
const DISTANCIA_PADRAO_KM = 3;

/** Fallback offline: as categorias do config viram linhas equivalentes. */
const CATEGORIAS_FALLBACK: CategoriaRow[] = CATEGORIAS.map((c, i) => ({
  chave: c.chave,
  nome: c.nome,
  descricao: c.descricao,
  tarifa_base_centavos: Math.round(c.tarifaBase * 100),
  preco_km_centavos: Math.round(c.precoKm * 100),
  ordem: i,
  ativo: true,
  atualizado_em: new Date().toISOString(),
}));

/**
 * TELA 2 — Chamada do servico.
 * Destino (com ditado por voz), categoria com preco proprio, saldo da carteira
 * e o botao CHAMAR protegido pela trava "03".
 */
export default function Inicio() {
  const { session, passageiro, carteira, carregando, sair, recarregarCarteira } = useSessao();
  const insets = useSafeAreaInsets();

  const [categorias, setCategorias] = useState<CategoriaRow[]>(CATEGORIAS_FALLBACK);
  const [selecionada, setSelecionada] = useState<string | null>(CATEGORIAS_FALLBACK[0].chave);
  const [destino, setDestino] = useState('');
  const [origem, setOrigem] = useState('');
  const [erroDestino, setErroDestino] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [chamando, setChamando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const categoriaAtual = useMemo(
    () => categorias.find((c) => c.chave === selecionada) ?? null,
    [categorias, selecionada],
  );

  const estimativaCentavos = categoriaAtual
    ? estimarCentavos(categoriaAtual, DISTANCIA_PADRAO_KM)
    : 0;

  const saldoCentavos = carteira?.saldo_centavos ?? 0;
  const saldoInsuficiente = saldoCentavos < estimativaCentavos;

  /** Precos oficiais vem do banco, entao o cliente ajusta sem republicar o app. */
  const carregarCategorias = useCallback(async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error || !data || data.length === 0) return;

    setCategorias(data);
    setSelecionada((atual) =>
      atual && data.some((c) => c.chave === atual) ? atual : data[0].chave,
    );
  }, []);

  /** Se ja existe uma chamada aberta, a tela 3 assume. */
  const verificarCorridaAberta = useCallback(async () => {
    if (!session) return;

    const { data } = await supabase
      .from('corridas')
      .select('id')
      .eq('passageiro_id', session.user.id)
      .eq('status', 'aberta')
      .maybeSingle();

    if (data?.id) router.replace({ pathname: '/corrida', params: { id: data.id } });
  }, [session]);

  useEffect(() => {
    carregarCategorias();
    verificarCorridaAberta();
  }, [carregarCategorias, verificarCorridaAberta]);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await Promise.all([carregarCategorias(), recarregarCarteira(), verificarCorridaAberta()]);
    setAtualizando(false);
  }, [carregarCategorias, recarregarCarteira, verificarCorridaAberta]);

  const chamar = useCallback(async () => {
    setErroGeral(null);
    setErroDestino(null);

    if (!destino.trim()) {
      setErroDestino('Informe para onde vamos.');
      return;
    }
    if (!categoriaAtual) {
      setErroGeral('Escolha um servico.');
      return;
    }

    setChamando(true);
    try {
      // O preco e a checagem de saldo sao refeitos no servidor.
      const { data, error } = await supabase.rpc('criar_corrida', {
        p_categoria_chave: categoriaAtual.chave,
        p_destino_texto: destino.trim(),
        p_origem_texto: origem.trim(),
        p_distancia_km: DISTANCIA_PADRAO_KM,
      });

      if (error) throw error;

      const corrida = (Array.isArray(data) ? data[0] : data) as CorridaRow | null;
      if (!corrida?.id) throw new Error('Nao foi possivel registrar a chamada.');

      await recarregarCarteira();
      router.push({ pathname: '/corrida', params: { id: corrida.id } });
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
    } finally {
      setChamando(false);
    }
  }, [categoriaAtual, destino, origem, recarregarCarteira]);

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  const primeiroNome = (passageiro?.nome || '').trim().split(' ')[0];

  return (
    <View style={estilos.raiz}>
      {/* Cabecalho */}
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <View style={estilos.cabecalhoLinha}>
          <Logo sobreEscuro />
          <Pressable
            onPress={sair}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            hitSlop={10}
            style={estilos.sair}
          >
            <Text style={estilos.sairTexto}>Sair</Text>
          </Pressable>
        </View>
        <Text style={estilos.saudacao}>
          {primeiroNome ? `Ola, ${primeiroNome}!` : 'Ola!'} Para onde vamos hoje?
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={colors.primary} />
        }
      >
        <CartaoCarteira
          saldoCentavos={saldoCentavos}
          onVerExtrato={() => router.push('/carteira')}
        />

        <CampoDestino
          valor={destino}
          onChange={(t) => {
            setDestino(t);
            setErroDestino(null);
          }}
          erro={erroDestino}
        />

        <SeletorCategoria
          categorias={categorias}
          selecionada={selecionada}
          onSelecionar={setSelecionada}
          distanciaKm={DISTANCIA_PADRAO_KM}
        />

        {/* Resumo do valor */}
        <View style={estilos.resumo}>
          <View>
            <Text style={estilos.resumoRotulo}>Valor estimado</Text>
            <Text style={estilos.resumoObs}>
              Base {DISTANCIA_PADRAO_KM} km — debitado da carteira ao concluir.
            </Text>
          </View>
          <Text style={estilos.resumoValor}>{brl(paraReais(estimativaCentavos))}</Text>
        </View>

        {erroGeral ? (
          <View style={estilos.alerta} accessibilityLiveRegion="polite">
            <Text style={estilos.alertaTexto}>{erroGeral}</Text>
          </View>
        ) : null}

        <BotaoChamar
          onConfirmar={chamar}
          carregando={chamando}
          desabilitado={saldoInsuficiente || !destino.trim()}
          motivoBloqueio={
            saldoInsuficiente
              ? `Saldo insuficiente. Esta chamada custa ${brl(paraReais(estimativaCentavos))}.`
              : null
          }
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bg },
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  cabecalho: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: palette.gold400,
    gap: spacing.sm,
  },
  cabecalhoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sair: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  sairTexto: {
    color: palette.gold300,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  saudacao: {
    color: colors.textOnDark,
    fontSize: font.size.md,
    fontWeight: font.weight.medium,
  },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.gold300,
    padding: spacing.lg,
    gap: spacing.md,
  },
  resumoRotulo: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  resumoObs: { fontSize: font.size.xs, color: colors.textFaint, maxWidth: 220 },
  resumoValor: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.heavy,
    color: colors.primaryDark,
  },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
});
