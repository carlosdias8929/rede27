import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { Botao03 } from '../src/components/Botao03';
import { Logo } from '../src/components/Logo';
import { Protocolo } from '../src/components/Protocolo';
import { CICLO_CORRIDA } from '../src/config/rede27.config';
import { brl, paraReais } from '../src/lib/format';
import { useAoVivo } from '../src/lib/aoVivo';
import { localizacaoAtual } from '../src/lib/geo';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type { CorridaRow, MotoristaRow } from '../src/types/database';

/** TELA 3 — acompanhamento da corrida, com o 03 sempre a mao. */
export default function Corrida() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, carregando: carregandoSessao, recarregarCarteira } = useSessao();
  const insets = useSafeAreaInsets();

  const [corrida, setCorrida] = useState<CorridaRow | null>(null);
  const [motorista, setMotorista] = useState<MotoristaRow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [acionando03, setAcionando03] = useState(false);
  const [alerta03Ativo, setAlerta03Ativo] = useState(false);

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

  // Alerta 03 ativo deste passageiro: o botao ja nasce mostrando o estado.
  useEffect(() => {
    if (!session) return;
    supabase
      .from('alertas_03')
      .select('id')
      .eq('passageiro_id', session.user.id)
      .eq('status', 'ativo')
      .maybeSingle()
      .then(({ data }) => setAlerta03Ativo(Boolean(data)));
  }, [session]);

  // Assim que houver motorista, buscamos foto e dados para mostrar ao passageiro.
  useEffect(() => {
    const motoristaId = corrida?.motorista_id;
    if (!motoristaId) {
      setMotorista(null);
      return;
    }

    supabase
      .from('motoristas')
      .select('*')
      .eq('id', motoristaId)
      .maybeSingle()
      .then(({ data }) => setMotorista(data ?? null));
  }, [corrida?.motorista_id]);

  // A tela acompanha o banco sozinha. Relemos do banco a cada sinal em vez de
  // usar o conteudo do evento: assim um evento perdido ou fora de ordem nao
  // deixa a tela mostrando um passo que ja passou.
  useAoVivo({
    canal: `corrida:${id}`,
    tabela: 'corridas',
    filtro: id ? `id=eq.${id}` : undefined,
    aoMudar: buscar,
    ativo: Boolean(id),
  });

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

  const acionar03 = useCallback(async () => {
    setAcionando03(true);
    setErro(null);

    const local = await localizacaoAtual();

    try {
      const { error } = await supabase.rpc('acionar_03', {
        p_corrida_id: corrida?.id ?? null,
        p_latitude: local.ok ? local.coordenada.latitude : null,
        p_longitude: local.ok ? local.coordenada.longitude : null,
        p_precisao_m: local.ok ? (local.coordenada.precisao ?? null) : null,
      });
      if (error) throw error;

      setAlerta03Ativo(true);
      if (!local.ok) setAviso('Alerta enviado, mas sem localizacao: ' + local.mensagem);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setAcionando03(false);
    }
  }, [corrida?.id]);

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
  const podeCancelar = corrida.status === 'aberta' && corrida.passo_atual <= 2;
  const emAndamento = corrida.status === 'aberta';

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
          <Etiqueta texto={`${Number(corrida.distancia_km).toFixed(1).replace('.', ',')} km`} />
          {cancelada ? <Etiqueta texto="CANCELADA" perigo /> : null}
          {concluida ? <Etiqueta texto="CONCLUIDA" destaque /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {/* Quem esta te levando — a exigencia de confianca do cliente. */}
        {motorista ? (
          <View style={[estilos.motorista, shadow(2)]}>
            <View style={estilos.motoristaTopo}>
              {motorista.foto_perfil_url ? (
                <Image
                  source={{ uri: motorista.foto_perfil_url }}
                  style={estilos.fotoPerfil}
                  accessibilityLabel={`Foto de ${motorista.nome}`}
                />
              ) : (
                <View style={[estilos.fotoPerfil, estilos.fotoVazia]}>
                  <Text style={estilos.fotoVaziaTexto}>
                    {(motorista.nome || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={estilos.motoristaInfo}>
                <Text style={estilos.motoristaRotulo}>Seu motorista</Text>
                <Text style={estilos.motoristaNome}>{motorista.nome}</Text>
                {motorista.veiculo_descricao || motorista.veiculo_placa ? (
                  <Text style={estilos.motoristaVeiculo}>
                    {[motorista.veiculo_descricao, motorista.veiculo_placa]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>

            {motorista.foto_veiculo_url ? (
              <Image
                source={{ uri: motorista.foto_veiculo_url }}
                style={estilos.fotoVeiculo}
                resizeMode="cover"
                accessibilityLabel="Foto do veiculo"
              />
            ) : null}
          </View>
        ) : emAndamento ? (
          <View style={estilos.procurando}>
            <ActivityIndicator color={colors.secondary} />
            <Text style={estilos.procurandoTexto}>Procurando um motorista...</Text>
          </View>
        ) : null}

        <View style={[estilos.cartao, shadow(2)]}>
          <Protocolo
            titulo="Andamento do servico"
            passos={CICLO_CORRIDA}
            passoAtual={corrida.passo_atual}
            concluido={concluida}
            interrompido={cancelada}
          />
        </View>

        {concluida ? (
          <View style={estilos.sucesso}>
            <Text style={estilos.sucessoTitulo}>Servico concluido</Text>
            <Text style={estilos.sucessoTexto}>
              {brl(valor)} foi debitado da sua carteira REDE27.
            </Text>
          </View>
        ) : null}

        {aviso ? (
          <View style={estilos.avisoCaixa} accessibilityLiveRegion="polite">
            <Text style={estilos.avisoTexto}>{aviso}</Text>
          </View>
        ) : null}

        {erro ? (
          <View style={estilos.alerta} accessibilityLiveRegion="polite">
            <Text style={estilos.alertaTexto}>{erro}</Text>
          </View>
        ) : null}

        {/* O 03 fica disponivel durante toda a corrida. */}
        {emAndamento ? (
          <Botao03 onAcionar={acionar03} enviando={acionando03} ativo={alerta03Ativo} />
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
          <Text style={estilos.rodape}>A tela atualiza sozinha a cada passo do servico.</Text>
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
  destino: { color: colors.textOnDark, fontSize: font.size.lg, fontWeight: font.weight.semibold },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  etiqueta: {
    backgroundColor: palette.navy700,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: palette.navy600,
  },
  etiquetaDestaque: { backgroundColor: palette.gold300, borderColor: palette.gold500 },
  etiquetaPerigo: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  etiquetaTexto: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: palette.navy100 },
  etiquetaTextoDestaque: { color: palette.navy900, fontWeight: font.weight.bold },
  etiquetaTextoPerigo: { color: colors.danger, fontWeight: font.weight.bold },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  motorista: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  motoristaTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fotoPerfil: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.bgMuted },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  fotoVaziaTexto: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.textFaint },
  motoristaInfo: { flex: 1, gap: 2 },
  motoristaRotulo: {
    fontSize: font.size.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  motoristaNome: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  motoristaVeiculo: { fontSize: font.size.sm, color: colors.textMuted },
  fotoVeiculo: { width: '100%', height: 150, borderRadius: radius.md, backgroundColor: colors.bgMuted },
  procurando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  procurandoTexto: { fontSize: font.size.sm, color: colors.secondaryDark, fontWeight: font.weight.medium },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sucesso: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sucessoTitulo: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.success },
  sucessoTexto: { fontSize: font.size.sm, color: colors.textMuted },
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
  rodape: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
});
