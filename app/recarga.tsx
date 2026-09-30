import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { Campo } from '../src/components/Campo';
import { CartaoContaPix } from '../src/components/CartaoContaPix';
import { lerValorEmCentavos } from '../src/components/SeletorPagamento';
import { escolherImagem, type ImagemEscolhida } from '../src/lib/arquivo';
import { brl, paraReais } from '../src/lib/format';
import { novoCodigoRecarga } from '../src/lib/pix';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type { ContaRecebimentoRow, RecargaPixRow } from '../src/types/database';

const BUCKET = 'comprovantes';
const SUGESTOES = [2000, 5000, 10000];
const MINIMO = 100;
const MAXIMO = 100000;

type Etapa = 'pagar' | 'comprovante' | 'enviado';

/**
 * Recarga da carteira por PIX manual.
 *
 *   1. Pagar: o passageiro escolhe o valor e ve as contas da empresa, cada uma
 *      com QR Code e PIX copia e cola ja com o valor.
 *   2. Comprovante: toca em "Ja paguei nesta conta" e manda a foto do
 *      comprovante.
 *   3. Enviado: o pedido esta na fila do Admin. Aprovado, o saldo entra na
 *      carteira; o status aparece em "Minha carteira".
 */
export default function Recarga() {
  const { session, papel, carregando: carregandoSessao } = useSessao();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ valor?: string }>();

  // Codigo unico desta recarga: vai no QR e ajuda o Admin a achar o PIX.
  const [codigo] = useState(novoCodigoRecarga);

  const [contas, setContas] = useState<ContaRecebimentoRow[] | null>(null);
  const [cidade, setCidade] = useState('Feira de Santana');
  const [pendentes, setPendentes] = useState(0);

  const valorInicial = useMemo(() => {
    const v = Number(params.valor);
    return Number.isFinite(v) && v >= MINIMO ? Math.min(Math.ceil(v / 100) * 100, MAXIMO) : 5000;
  }, [params.valor]);

  const [valorTexto, setValorTexto] = useState(() =>
    (valorInicial / 100).toFixed(2).replace('.', ','),
  );
  const valorCentavos = lerValorEmCentavos(valorTexto);
  const erroValor =
    valorCentavos === null
      ? 'Informe o valor da recarga.'
      : valorCentavos < MINIMO
        ? 'O valor minimo e R$ 1,00.'
        : valorCentavos > MAXIMO
          ? 'O valor maximo por recarga e R$ 1.000,00.'
          : null;

  const [etapa, setEtapa] = useState<Etapa>('pagar');
  const [contaPaga, setContaPaga] = useState<ContaRecebimentoRow | null>(null);
  const [imagem, setImagem] = useState<ImagemEscolhida | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<RecargaPixRow | null>(null);

  const uid = session?.user.id ?? null;

  const carregar = useCallback(async () => {
    if (!uid) return;
    const [cts, conf, pend] = await Promise.all([
      supabase.from('contas_recebimento').select('*').eq('ativa', true).order('ordem'),
      supabase.from('configuracoes').select('valor').eq('chave', 'empresa_cidade').maybeSingle(),
      supabase
        .from('recargas_pix')
        .select('id', { count: 'exact', head: true })
        .eq('passageiro_id', uid)
        .eq('status', 'pendente'),
    ]);
    setContas(cts.data ?? []);
    if (conf.data?.valor) setCidade(conf.data.valor);
    setPendentes(pend.count ?? 0);
  }, [uid]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const escolher = useCallback(async (origem: 'galeria' | 'camera') => {
    setErro(null);
    try {
      // Sem recorte: o comprovante tem de chegar inteiro para a conferencia.
      const img = await escolherImagem({ origem, editar: false, qualidade: 0.6 });
      if (img) setImagem(img);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, []);

  const enviar = useCallback(async () => {
    if (!uid || !contaPaga || !imagem || valorCentavos === null || erroValor) return;
    setErro(null);

    // Confere antes de subir o arquivo, para nao deixar comprovante orfao.
    if (pendentes >= 3) {
      setErro('Voce ja tem 3 recargas aguardando conferencia. Aguarde a analise.');
      return;
    }

    setEnviando(true);
    try {
      // Nome unico: comprovante enviado nao e sobrescrito nem apagado.
      const caminho = `${uid}/${Date.now()}-${codigo}.${imagem.extensao}`;
      const envio = await supabase.storage
        .from(BUCKET)
        .upload(caminho, imagem.bytes, { contentType: imagem.tipo, upsert: false });
      if (envio.error) throw envio.error;

      const { data, error } = await supabase.rpc('solicitar_recarga_pix', {
        p_conta_id: contaPaga.id,
        p_valor_centavos: valorCentavos,
        p_comprovante_path: caminho,
        p_codigo_referencia: codigo,
      });
      if (error) throw error;

      setPedido((Array.isArray(data) ? data[0] : data) as RecargaPixRow);
      setEtapa('enviado');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }, [uid, contaPaga, imagem, valorCentavos, erroValor, pendentes, codigo]);

  if (carregandoSessao) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (papel && papel !== 'passageiro') return <Redirect href="/" />;

  const voltar = () => {
    if (etapa === 'comprovante') {
      setEtapa('pagar');
      setErro(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/inicio');
  };

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={voltar} accessibilityRole="button" hitSlop={10}>
          <Text style={estilos.voltar}>{etapa === 'enviado' ? '' : '‹ Voltar'}</Text>
        </Pressable>
        <Text style={estilos.titulo}>Adicionar saldo por PIX</Text>
        <Passos etapa={etapa} />
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {etapa === 'pagar' ? (
          <>
            <View style={[estilos.cartao, shadow(1)]}>
              <Text style={estilos.subtitulo}>1. Quanto quer adicionar?</Text>
              <View style={estilos.chips}>
                {SUGESTOES.map((v) => {
                  const ativo = valorCentavos === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setValorTexto((v / 100).toFixed(2).replace('.', ','))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: ativo }}
                      style={[estilos.chip, ativo && estilos.chipAtivo]}
                    >
                      <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>
                        {brl(paraReais(v))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Campo
                rotulo="Valor da recarga (R$)"
                value={valorTexto}
                onChangeText={setValorTexto}
                keyboardType="decimal-pad"
                placeholder="50,00"
                erro={valorTexto ? erroValor : null}
                ajuda="De R$ 1,00 a R$ 1.000,00 por recarga."
              />
            </View>

            {pendentes > 0 ? (
              <View style={estilos.info}>
                <Text style={estilos.infoTexto}>
                  Voce tem {pendentes} recarga{pendentes > 1 ? 's' : ''} aguardando conferencia.
                  {pendentes >= 3 ? ' Aguarde a analise para enviar outra.' : ''}
                </Text>
              </View>
            ) : null}

            <Text style={estilos.subtituloSolto}>2. Pague em uma das contas abaixo</Text>
            <Text style={estilos.nota}>
              Escaneie o QR Code ou use o PIX copia e cola no app do seu banco. O valor ja vai
              preenchido. Codigo desta recarga: <Text style={estilos.codigo}>{codigo}</Text>
            </Text>

            {contas === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : contas.length === 0 ? (
              <View style={estilos.info}>
                <Text style={estilos.infoTexto}>
                  Nenhuma conta PIX disponivel no momento. Fale com a central.
                </Text>
              </View>
            ) : erroValor ? (
              <View style={estilos.info}>
                <Text style={estilos.infoTexto}>
                  Informe um valor valido acima para gerar o QR Code.
                </Text>
              </View>
            ) : (
              contas.map((c) => (
                <CartaoContaPix
                  key={c.id}
                  conta={c}
                  cidade={cidade}
                  valorCentavos={valorCentavos}
                  codigo={codigo}
                >
                  <Botao
                    titulo="Ja paguei — enviar comprovante"
                    rotuloAcessivel={`Ja paguei no ${c.banco}. Enviar comprovante`}
                    variante="primario"
                    desabilitado={pendentes >= 3}
                    onPress={() => {
                      setContaPaga(c);
                      setImagem(null);
                      setErro(null);
                      setEtapa('comprovante');
                    }}
                  />
                </CartaoContaPix>
              ))
            )}

            <Text style={estilos.aviso}>
              O saldo entra na carteira depois que a central confere o PIX no extrato do banco.
              Pague so para as contas desta tela.
            </Text>
          </>
        ) : null}

        {etapa === 'comprovante' && contaPaga && valorCentavos !== null ? (
          <>
            <View style={[estilos.cartao, shadow(1)]}>
              <Text style={estilos.subtitulo}>3. Envie o comprovante</Text>
              <Resumo
                linhas={[
                  ['Valor', brl(paraReais(valorCentavos))],
                  [
                    'Conta',
                    `${contaPaga.banco}${contaPaga.titular ? ` — ${contaPaga.titular}` : ''}`,
                  ],
                  ['Codigo', codigo],
                ]}
              />
              <Text style={estilos.nota}>
                No app do banco, abra o comprovante do PIX e salve ou tire um print. Depois escolha
                a imagem aqui.
              </Text>

              {imagem ? (
                <View style={estilos.previewBloco}>
                  <Image
                    source={{ uri: imagem.uri }}
                    style={estilos.preview}
                    resizeMode="contain"
                    accessibilityLabel="Previa do comprovante"
                  />
                  <Pressable onPress={() => setImagem(null)} accessibilityRole="button" hitSlop={8}>
                    <Text style={estilos.link}>Trocar imagem</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={estilos.escolhas}>
                  <Botao
                    titulo={Platform.OS === 'web' ? 'Escolher imagem' : 'Escolher da galeria'}
                    variante="contorno"
                    onPress={() => escolher('galeria')}
                  />
                  {Platform.OS !== 'web' ? (
                    <Botao
                      titulo="Tirar foto do comprovante"
                      variante="contorno"
                      onPress={() => escolher('camera')}
                    />
                  ) : null}
                </View>
              )}

              {erro ? (
                <View style={estilos.alerta} accessibilityLiveRegion="polite">
                  <Text style={estilos.alertaTexto}>{erro}</Text>
                </View>
              ) : null}

              <Botao
                titulo="Enviar comprovante"
                onPress={enviar}
                carregando={enviando}
                desabilitado={!imagem}
              />
            </View>
            <Text style={estilos.aviso}>
              Comprovante falso ou de outro valor e recusado. A central confere cada PIX no extrato
              antes de liberar o saldo.
            </Text>
          </>
        ) : null}

        {etapa === 'enviado' && pedido ? (
          <View style={[estilos.cartao, estilos.cartaoSucesso, shadow(2)]}>
            <View style={estilos.okCirculo}>
              <Text style={estilos.okIcone}>✓</Text>
            </View>
            <Text style={estilos.okTitulo}>Comprovante enviado!</Text>
            <Text style={estilos.okTexto}>
              Sua recarga esta na fila da central. Assim que o PIX for conferido no extrato, o saldo
              entra na sua carteira.
            </Text>
            <Resumo
              linhas={[
                ['Valor', brl(paraReais(pedido.valor_centavos))],
                ['Conta', pedido.conta_banco],
                ['Codigo', pedido.codigo_referencia],
                ['Status', 'Aguardando conferencia'],
              ]}
            />
            <Botao titulo="Ver minha carteira" onPress={() => router.replace('/carteira')} />
            <Botao
              titulo="Voltar ao inicio"
              variante="contorno"
              onPress={() => router.replace('/inicio')}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Passos({ etapa }: { etapa: Etapa }) {
  const ordem: Etapa[] = ['pagar', 'comprovante', 'enviado'];
  const rotulos = ['Pagar', 'Comprovante', 'Enviado'];
  const atual = ordem.indexOf(etapa);
  return (
    <View style={estilos.passos} accessibilityLabel={`Passo ${atual + 1} de 3: ${rotulos[atual]}`}>
      {rotulos.map((r, i) => (
        <View key={r} style={estilos.passo}>
          <View style={[estilos.passoBola, i <= atual && estilos.passoBolaAtiva]}>
            <Text style={[estilos.passoNumero, i <= atual && estilos.passoNumeroAtivo]}>
              {i + 1}
            </Text>
          </View>
          <Text style={[estilos.passoRotulo, i === atual && estilos.passoRotuloAtivo]}>{r}</Text>
        </View>
      ))}
    </View>
  );
}

function Resumo({ linhas }: { linhas: Array<[string, string]> }) {
  return (
    <View style={estilos.resumo}>
      {linhas.map(([k, v]) => (
        <View key={k} style={estilos.resumoLinha}>
          <Text style={estilos.resumoChave}>{k}</Text>
          <Text style={estilos.resumoValor}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgMuted },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  cabecalho: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  voltar: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  titulo: { color: colors.textOnDark, fontSize: font.size.xl, fontWeight: font.weight.bold },
  passos: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  passo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  passoBola: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.navy300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoBolaAtiva: { backgroundColor: palette.gold500, borderColor: palette.gold500 },
  passoNumero: { fontSize: 11, fontWeight: font.weight.bold, color: palette.navy100 },
  passoNumeroAtivo: { color: palette.navy900 },
  passoRotulo: { fontSize: font.size.xs, color: palette.navy100 },
  passoRotuloAtivo: { color: colors.textOnDark, fontWeight: font.weight.semibold },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cartaoSucesso: { alignItems: 'stretch' },
  subtitulo: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.primaryDark },
  subtituloSolto: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
    marginBottom: -spacing.sm,
  },
  nota: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 20 },
  codigo: { fontWeight: font.weight.bold, color: colors.primaryDark },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipAtivo: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight },
  chipTexto: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  chipTextoAtivo: { color: colors.primaryDark },
  info: {
    backgroundColor: colors.accentBg,
    borderLeftWidth: 4,
    borderLeftColor: palette.gold500,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  infoTexto: { fontSize: font.size.sm, color: colors.text },
  aviso: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center', lineHeight: 16 },
  escolhas: { gap: spacing.sm },
  previewBloco: { gap: spacing.sm, alignItems: 'center' },
  preview: {
    width: '100%',
    height: 320,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  link: { fontSize: font.size.sm, color: colors.secondary, fontWeight: font.weight.semibold },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  resumo: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  resumoChave: { fontSize: font.size.sm, color: colors.textMuted },
  resumoValor: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  okCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  okIcone: { fontSize: 32, color: colors.success, fontWeight: font.weight.heavy },
  okTitulo: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
    textAlign: 'center',
  },
  okTexto: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
