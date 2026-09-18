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

import { Botao03 } from '../src/components/Botao03';
import { BotaoChamar } from '../src/components/BotaoChamar';
import { CampoDestino } from '../src/components/CampoDestino';
import { CartaoCarteira } from '../src/components/CartaoCarteira';
import { Logo } from '../src/components/Logo';
import { estimarCentavos, SeletorCategoria } from '../src/components/SeletorCategoria';
import { CATEGORIAS, DISTANCIA, MARCA, SAUDACOES } from '../src/config/rede27.config';
import { brl, paraReais } from '../src/lib/format';
import { distanciaKm, localizacaoAtual, type Coordenada } from '../src/lib/geo';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, spacing } from '../src/theme';
import type { CategoriaRow, CidadeRow, CorridaRow } from '../src/types/database';

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

/** TELA 2 — chamar o servico. */
export default function Inicio() {
  const { session, papel, passageiro, carteira, carregando, sair, recarregarCarteira } =
    useSessao();
  const insets = useSafeAreaInsets();

  const [categorias, setCategorias] = useState<CategoriaRow[]>(CATEGORIAS_FALLBACK);
  const [cidades, setCidades] = useState<CidadeRow[]>([]);
  const [cidadeId, setCidadeId] = useState<string | null>(null);
  const [fatorRota, setFatorRota] = useState<number>(DISTANCIA.fatorRotaPadrao);
  const [distanciaMinima, setDistanciaMinima] = useState<number>(DISTANCIA.minimaPadrao);

  const [selecionada, setSelecionada] = useState<string | null>(CATEGORIAS_FALLBACK[0].chave);
  const [destino, setDestino] = useState('');
  const [destinoCoord, setDestinoCoord] = useState<Coordenada | null>(null);
  const [origemCoord, setOrigemCoord] = useState<Coordenada | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);

  const [erroDestino, setErroDestino] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [chamando, setChamando] = useState(false);
  const [acionando03, setAcionando03] = useState(false);
  const [alerta03Ativo, setAlerta03Ativo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const cidadeSelecionada = useMemo(
    () => cidades.find((c) => c.id === cidadeId) ?? null,
    [cidades, cidadeId],
  );

  /** Distancia cobrada: linha reta corrigida, nunca abaixo do minimo. */
  const km = useMemo(() => {
    if (!origemCoord || !destinoCoord) return distanciaMinima;
    const reta = distanciaKm(origemCoord, destinoCoord);
    return Math.max(Number((reta * fatorRota).toFixed(2)), distanciaMinima);
  }, [origemCoord, destinoCoord, fatorRota, distanciaMinima]);

  const categoriaAtual = useMemo(
    () => categorias.find((c) => c.chave === selecionada) ?? null,
    [categorias, selecionada],
  );

  const estimativa = categoriaAtual ? estimarCentavos(categoriaAtual, km) : 0;
  const saldo = carteira?.saldo_centavos ?? 0;
  const saldoInsuficiente = saldo < estimativa;

  const carregarBase = useCallback(async () => {
    const [cats, cids, confs] = await Promise.all([
      supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
      supabase.from('cidades').select('*').eq('ativa', true).order('nome'),
      supabase.from('configuracoes').select('*'),
    ]);

    if (cats.data?.length) {
      setCategorias(cats.data);
      setSelecionada((atual) =>
        atual && cats.data.some((c) => c.chave === atual) ? atual : cats.data[0].chave,
      );
    }

    if (cids.data?.length) {
      setCidades(cids.data);
      setCidadeId((atual) => atual ?? cids.data[0].id);
    }

    for (const c of confs.data ?? []) {
      const n = Number(c.valor);
      if (!Number.isFinite(n)) continue;
      if (c.chave === 'fator_rota') setFatorRota(n);
      if (c.chave === 'distancia_minima_km') setDistanciaMinima(n);
    }
  }, []);

  const verificarPendencias = useCallback(async () => {
    if (!session) return;

    const [corrida, alerta] = await Promise.all([
      supabase
        .from('corridas')
        .select('id')
        .eq('passageiro_id', session.user.id)
        .eq('status', 'aberta')
        .maybeSingle(),
      supabase
        .from('alertas_03')
        .select('id')
        .eq('passageiro_id', session.user.id)
        .eq('status', 'ativo')
        .maybeSingle(),
    ]);

    setAlerta03Ativo(Boolean(alerta.data));
    if (corrida.data?.id) {
      router.replace({ pathname: '/corrida', params: { id: corrida.data.id } });
    }
  }, [session]);

  useEffect(() => {
    carregarBase();
    verificarPendencias();
  }, [carregarBase, verificarPendencias]);

  const usarMinhaLocalizacao = useCallback(async () => {
    setBuscandoGps(true);
    setAviso(null);

    const r = await localizacaoAtual();
    setBuscandoGps(false);

    if (!r.ok) {
      setAviso(r.mensagem);
      return;
    }
    setOrigemCoord(r.coordenada);
  }, []);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await Promise.all([carregarBase(), recarregarCarteira(), verificarPendencias()]);
    setAtualizando(false);
  }, [carregarBase, recarregarCarteira, verificarPendencias]);

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
      // O servidor recalcula distancia, preco e saldo. O que vale e o de la.
      const { data, error } = await supabase.rpc('criar_corrida', {
        p_categoria_chave: categoriaAtual.chave,
        p_destino_texto: destino.trim(),
        p_origem_texto: origemCoord ? 'Minha localizacao' : '',
        p_origem_lat: origemCoord?.latitude ?? null,
        p_origem_lng: origemCoord?.longitude ?? null,
        p_destino_lat: destinoCoord?.latitude ?? null,
        p_destino_lng: destinoCoord?.longitude ?? null,
        p_cidade_id: cidadeId,
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
  }, [categoriaAtual, destino, destinoCoord, origemCoord, cidadeId, recarregarCarteira]);

  const acionar03 = useCallback(async () => {
    setAcionando03(true);
    setErroGeral(null);

    // Tenta o GPS, mas nao deixa a falta dele impedir o pedido de socorro.
    const local = await localizacaoAtual();

    try {
      const { error } = await supabase.rpc('acionar_03', {
        p_corrida_id: null,
        p_latitude: local.ok ? local.coordenada.latitude : null,
        p_longitude: local.ok ? local.coordenada.longitude : null,
        p_precisao_m: local.ok ? (local.coordenada.precisao ?? null) : null,
      });
      if (error) throw error;

      setAlerta03Ativo(true);
      if (!local.ok) {
        setAviso('Alerta enviado, mas sem localizacao: ' + local.mensagem);
      }
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
    } finally {
      setAcionando03(false);
    }
  }, []);

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (papel === 'motorista') return <Redirect href="/motorista" />;
  if (papel === 'admin') return <Redirect href="/admin" />;

  const primeiroNome = (passageiro?.nome || '').trim().split(' ')[0];

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <View style={estilos.cabecalhoLinha}>
          <Logo sobreEscuro />
          <Pressable
            onPress={sair}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            hitSlop={10}
          >
            <Text style={estilos.sair}>Sair</Text>
          </Pressable>
        </View>
        <Text style={estilos.bemVindo}>{SAUDACOES.bemVindo}</Text>
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
        <CartaoCarteira saldoCentavos={saldo} onVerExtrato={() => router.push('/carteira')} />

        {cidades.length > 1 ? (
          <View style={estilos.grupo}>
            <Text style={estilos.rotulo}>Cidade</Text>
            <View style={estilos.cidades}>
              {cidades.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCidadeId(c.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: c.id === cidadeId }}
                  style={[estilos.cidade, c.id === cidadeId && estilos.cidadeAtiva]}
                >
                  <Text
                    style={[estilos.cidadeTexto, c.id === cidadeId && estilos.cidadeTextoAtivo]}
                  >
                    {c.nome}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={estilos.grupo}>
          <View style={estilos.origemLinha}>
            <Text style={estilos.rotulo}>Partida</Text>
            <Pressable onPress={usarMinhaLocalizacao} accessibilityRole="button" hitSlop={8}>
              <Text style={estilos.link}>
                {buscandoGps ? 'Obtendo...' : origemCoord ? 'Atualizar' : 'Usar minha localizacao'}
              </Text>
            </Pressable>
          </View>
          <Text style={estilos.origemTexto}>
            {origemCoord
              ? `Localizacao obtida${origemCoord.precisao ? ` (precisao ~${Math.round(origemCoord.precisao)} m)` : ''}`
              : 'Sem localizacao. Sera cobrada a distancia minima.'}
          </Text>
        </View>

        <CampoDestino
          valor={destino}
          onChange={(t) => {
            setDestino(t);
            setDestinoCoord(null);
            setErroDestino(null);
          }}
          onSelecionarSugestao={(s) => {
            setDestino(s.rotulo);
            setDestinoCoord({ latitude: s.latitude, longitude: s.longitude });
          }}
          cidade={cidadeSelecionada?.nome}
          uf={cidadeSelecionada?.uf ?? MARCA.ufPadrao}
          erro={erroDestino}
        />

        <SeletorCategoria
          categorias={categorias}
          selecionada={selecionada}
          onSelecionar={setSelecionada}
          distanciaKm={km}
        />

        <View style={estilos.resumo}>
          <View style={estilos.resumoInfo}>
            <Text style={estilos.resumoRotulo}>Valor estimado</Text>
            <Text style={estilos.resumoObs}>
              {km.toFixed(2).replace('.', ',')} km — {DISTANCIA.aviso}
            </Text>
          </View>
          <Text style={estilos.resumoValor}>{brl(paraReais(estimativa))}</Text>
        </View>

        {aviso ? (
          <View style={estilos.avisoCaixa} accessibilityLiveRegion="polite">
            <Text style={estilos.avisoTexto}>{aviso}</Text>
          </View>
        ) : null}

        {erroGeral ? (
          <View style={estilos.alerta} accessibilityLiveRegion="polite">
            <Text style={estilos.alertaTexto}>{erroGeral}</Text>
          </View>
        ) : null}

        <BotaoChamar
          onChamar={chamar}
          carregando={chamando}
          desabilitado={saldoInsuficiente || !destino.trim()}
          motivoBloqueio={
            saldoInsuficiente
              ? `Saldo insuficiente. Esta chamada custa ${brl(paraReais(estimativa))}.`
              : null
          }
        />

        <View style={estilos.separador} />

        <Botao03 onAcionar={acionar03} enviando={acionando03} ativo={alerta03Ativo} />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bg },
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
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
  sair: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  bemVindo: {
    color: palette.gold300,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  saudacao: { color: colors.textOnDark, fontSize: font.size.md, fontWeight: font.weight.medium },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  grupo: { gap: spacing.xs },
  rotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  link: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.secondary },
  origemLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  origemTexto: { fontSize: font.size.xs, color: colors.textFaint },
  cidades: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cidade: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cidadeAtiva: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  cidadeTexto: { fontSize: font.size.sm, color: colors.textMuted },
  cidadeTextoAtivo: { color: colors.primaryDark, fontWeight: font.weight.semibold },
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
  resumoInfo: { flex: 1, gap: 2 },
  resumoRotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  resumoObs: { fontSize: font.size.xs, color: colors.textFaint },
  resumoValor: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.primaryDark },
  avisoCaixa: {
    backgroundColor: colors.accentBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  avisoTexto: { fontSize: font.size.sm, color: colors.text },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  separador: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
