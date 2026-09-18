import { Redirect, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { Logo } from '../src/components/Logo';
import { PROTOCOLO_5_PASSOS } from '../src/config/rede27.config';
import { brl, dataHoraCurta, paraReais } from '../src/lib/format';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type { CorridaRow } from '../src/types/database';

/**
 * PAINEL DO MOTORISTA (simulacao desta fase).
 *
 * Nao entra nas 3 telas do aplicativo do passageiro: e a ferramenta que recebe
 * a chamada e avanca o protocolo enquanto nao existe app proprio de motorista.
 * Exige uma conta autorizada na tabela `operadores` (ver 0002_operadores.sql).
 */
export default function PainelMotorista() {
  const { session, carregando: carregandoSessao } = useSessao();
  const insets = useSafeAreaInsets();

  const [ehOperador, setEhOperador] = useState<boolean | null>(null);
  const [corridas, setCorridas] = useState<CorridaRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const verificarPapel = useCallback(async () => {
    if (!session) return;

    const { data } = await supabase
      .from('operadores')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    setEhOperador(Boolean(data));
  }, [session]);

  const carregarFila = useCallback(async () => {
    const { data, error } = await supabase
      .from('corridas')
      .select('*')
      .eq('status', 'aberta')
      .order('criada_em', { ascending: true });

    if (error) setErro(mensagemDeErro(error));
    else setCorridas(data ?? []);

    setCarregando(false);
  }, []);

  useEffect(() => {
    verificarPapel();
  }, [verificarPapel]);

  useEffect(() => {
    if (ehOperador !== true) return;

    carregarFila();

    // A fila acompanha o banco em tempo real, sem recarregar a pagina.
    const canal = supabase
      .channel('painel-motorista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corridas' }, () =>
        carregarFila(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [ehOperador, carregarFila]);

  const avancar = useCallback(
    async (corrida: CorridaRow) => {
      setProcessando(corrida.id);
      setErro(null);

      const proximo = PROTOCOLO_5_PASSOS.find((p) => p.numero === corrida.passo_atual + 1);

      try {
        const { error } = await supabase.rpc('avancar_protocolo', {
          p_corrida_id: corrida.id,
          p_chave: proximo?.chave ?? '',
          p_motorista_nome: corrida.motorista_nome ?? 'Motorista REDE27',
        });
        if (error) throw error;
        await carregarFila();
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setProcessando(null);
      }
    },
    [carregarFila],
  );

  if (carregandoSessao) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  if (ehOperador === null) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!ehOperador) {
    return (
      <View style={estilos.centro}>
        <Logo />
        <Text style={estilos.negadoTitulo}>Acesso restrito</Text>
        <Text style={estilos.negadoTexto}>
          Esta conta nao esta autorizada a operar o painel. A administracao da REDE27 precisa
          libera-la na tabela de operadores.
        </Text>
        <Botao titulo="Voltar" onPress={() => router.replace('/inicio')} />
      </View>
    );
  }

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <Logo sobreEscuro />
        <Text style={estilos.subtitulo}>Painel do motorista — chamadas em aberto</Text>
      </View>

      {erro ? (
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}

      {carregando ? (
        <ActivityIndicator color={colors.primary} style={estilos.spinner} />
      ) : (
        <FlatList
          data={corridas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            estilos.lista,
            { paddingBottom: insets.bottom + spacing.xxl },
            corridas.length === 0 && estilos.listaVazia,
          ]}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Nenhuma chamada em aberto no momento.</Text>
          }
          renderItem={({ item }) => {
            const passoAtual = PROTOCOLO_5_PASSOS.find((p) => p.numero === item.passo_atual);
            const proximo = PROTOCOLO_5_PASSOS.find((p) => p.numero === item.passo_atual + 1);

            return (
              <View style={[estilos.cartao, shadow(1)]}>
                <View style={estilos.cartaoTopo}>
                  <Text style={estilos.destino} numberOfLines={2}>
                    {item.destino_texto}
                  </Text>
                  <Text style={estilos.valor}>
                    {brl(paraReais(item.valor_estimado_centavos))}
                  </Text>
                </View>

                <Text style={estilos.meta}>
                  {item.categoria_chave.replace(/_/g, ' ')} · {dataHoraCurta(item.criada_em)}
                </Text>

                <View style={estilos.passoBloco}>
                  <Text style={estilos.passoRotulo}>
                    Passo {item.passo_atual} de 5 — {passoAtual?.titulo ?? ''}
                  </Text>
                </View>

                {proximo ? (
                  <Botao
                    titulo={`Avancar para: ${proximo.titulo}`}
                    onPress={() => avancar(item)}
                    carregando={processando === item.id}
                  />
                ) : null}
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
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  cabecalho: {
    backgroundColor: colors.secondaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: palette.gold400,
    gap: spacing.xs,
  },
  subtitulo: { color: colors.textOnDark, fontSize: font.size.sm },
  spinner: { marginTop: spacing.xl },
  lista: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  listaVazia: { flexGrow: 1, justifyContent: 'center' },
  vazio: { textAlign: 'center', color: colors.textMuted, fontSize: font.size.md },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  destino: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  valor: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.primaryDark },
  meta: { fontSize: font.size.xs, color: colors.textFaint, textTransform: 'capitalize' },
  passoBloco: {
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  passoRotulo: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.secondaryDark,
  },
  negadoTitulo: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  negadoTexto: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
  alerta: {
    margin: spacing.lg,
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger },
});
