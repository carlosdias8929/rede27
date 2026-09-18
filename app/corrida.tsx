import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { Logo } from '../src/components/Logo';
import { Protocolo } from '../src/components/Protocolo';
import { brl, paraReais } from '../src/lib/format';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type { CorridaRow } from '../src/types/database';

/**
 * TELA 3 — Acompanhamento do servico pelo protocolo de 5 passos.
 * O passo corrente vem do banco e e atualizado em tempo real, entao a tela
 * reflete o que o motorista faz sem que o passageiro precise recarregar.
 */
export default function Corrida() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, carregando: carregandoSessao, recarregarCarteira } = useSessao();
  const insets = useSafeAreaInsets();

  const [corrida, setCorrida] = useState<CorridaRow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // Ao concluir (passo 5) o saldo muda: recarrega a carteira uma unica vez.
  const carteiraAtualizada = useRef(false);

  const buscar = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase.from('corridas').select('*').eq('id', id).maybeSingle();

    if (error) setErro(mensagemDeErro(error));
    else setCorrida(data ?? null);

    setCarregando(false);
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Assinatura em tempo real do registro desta corrida.
  useEffect(() => {
    if (!id) return;

    const canal = supabase
      .channel(`corrida:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${id}` },
        (payload) => setCorrida(payload.new as CorridaRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [id]);

  useEffect(() => {
    if (corrida?.status === 'concluida' && !carteiraAtualizada.current) {
      carteiraAtualizada.current = true;
      recarregarCarteira();
    }
  }, [corrida?.status, recarregarCarteira]);

  const cancelar = useCallback(async () => {
    if (!corrida) return;

    setCancelando(true);
    setErro(null);
    try {
      const { error } = await supabase.rpc('cancelar_corrida', { p_corrida_id: corrida.id });
      if (error) throw error;
      router.replace('/inicio');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCancelando(false);
    }
  }, [corrida]);

  // A sessao e lida do armazenamento de forma assincrona. Sem esperar por ela,
  // abrir esta tela direto pelo link (ou recarregar a pagina) jogaria o
  // passageiro para fora antes da sessao chegar.
  if (carregandoSessao || carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  if (!corrida) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.vazio}>Chamada nao encontrada.</Text>
        <Botao titulo="Voltar ao inicio" onPress={() => router.replace('/inicio')} />
      </View>
    );
  }

  const concluida = corrida.status === 'concluida';
  const cancelada = corrida.status === 'cancelada';
  // Cancelar so faz sentido antes do embarque (passos 1 e 2).
  const podeCancelar = corrida.status === 'aberta' && corrida.passo_atual <= 2;

  const valor = paraReais(corrida.valor_final_centavos ?? corrida.valor_estimado_centavos);

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <Logo sobreEscuro />
        <Text style={estilos.destino} numberOfLines={2}>
          {corrida.destino_texto}
        </Text>
        <View style={estilos.etiquetas}>
          <Etiqueta texto={brl(valor)} destaque />
          {corrida.motorista_nome ? <Etiqueta texto={corrida.motorista_nome} /> : null}
          {cancelada ? <Etiqueta texto="CANCELADA" perigo /> : null}
          {concluida ? <Etiqueta texto="CONCLUIDA" destaque /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <View style={[estilos.cartao, shadow(2)]}>
          <Protocolo
            passoAtual={corrida.passo_atual}
            cancelada={cancelada}
            concluida={concluida}
          />
        </View>

        {concluida ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Servico concluido</Text>
            <Text style={estilos.avisoTexto}>
              {brl(valor)} foi debitado da sua carteira REDE27.
            </Text>
          </View>
        ) : null}

        {erro ? (
          <View style={estilos.alerta} accessibilityLiveRegion="polite">
            <Text style={estilos.alertaTexto}>{erro}</Text>
          </View>
        ) : null}

        {podeCancelar ? (
          <Botao
            titulo="Cancelar chamada"
            variante="perigo"
            onPress={cancelar}
            carregando={cancelando}
          />
        ) : null}

        {concluida || cancelada ? (
          <Botao titulo="Voltar ao inicio" onPress={() => router.replace('/inicio')} />
        ) : (
          <Text style={estilos.rodape}>
            Acompanhe aqui. A tela atualiza sozinha a cada passo do protocolo.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function Etiqueta({
  texto,
  destaque,
  perigo,
}: {
  texto: string;
  destaque?: boolean;
  perigo?: boolean;
}) {
  return (
    <View
      style={[estilos.etiqueta, destaque && estilos.etiquetaDestaque, perigo && estilos.etiquetaPerigo]}
    >
      <Text
        style={[
          estilos.etiquetaTexto,
          destaque && estilos.etiquetaTextoDestaque,
          perigo && estilos.etiquetaTextoPerigo,
        ]}
      >
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bg },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  vazio: { fontSize: font.size.md, color: colors.textMuted },
  cabecalho: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: palette.gold400,
    gap: spacing.sm,
  },
  destino: {
    color: colors.textOnDark,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  etiqueta: {
    backgroundColor: palette.navy700,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: palette.navy700,
  },
  etiquetaDestaque: { backgroundColor: palette.gold300, borderColor: palette.gold500 },
  etiquetaPerigo: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  etiquetaTexto: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: palette.navy100,
  },
  etiquetaTextoDestaque: { color: palette.navy900, fontWeight: font.weight.bold },
  etiquetaTextoPerigo: { color: colors.danger, fontWeight: font.weight.bold },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aviso: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  avisoTitulo: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
  },
  avisoTexto: { fontSize: font.size.sm, color: colors.textMuted },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  rodape: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
});
