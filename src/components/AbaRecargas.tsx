import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAoVivo } from '../lib/aoVivo';
import { formatarCPF } from '../lib/cpf';
import { brl, dataHoraCurta, paraReais } from '../lib/format';
import { chaveFormatada } from '../lib/pix';
import { mensagemDeErro, supabase } from '../lib/supabase';
import { colors, font, palette, radius, shadow, spacing } from '../theme';
import type { PassageiroRow, RecargaPixRow } from '../types/database';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { lerValorEmCentavos } from './SeletorPagamento';

const BUCKET = 'comprovantes';

const MOTIVOS_RAPIDOS = [
  'PIX nao encontrado no extrato',
  'Valor diferente do comprovante',
  'Comprovante ilegivel',
  'Comprovante ja usado',
];

type Filtro = 'pendentes' | 'historico';

type Pessoa = Pick<PassageiroRow, 'id' | 'nome' | 'cpf' | 'telefone'>;

/**
 * Aba "Recargas PIX" do painel Admin: a fila de comprovantes.
 *
 * Cada pedido mostra quem pediu, quanto, em qual conta e a foto do
 * comprovante. O Admin confere no extrato do banco e:
 *   - aprova: o valor (pode corrigir para o que caiu de fato) entra na
 *     carteira na hora, uma unica vez;
 *   - recusa: com motivo, que o passageiro ve no app.
 *
 * O servidor e quem garante as regras (so Admin, so pendente, credito unico);
 * esta tela so organiza a conferencia.
 */
export function AbaRecargas() {
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [pendentes, setPendentes] = useState<RecargaPixRow[]>([]);
  const [historico, setHistorico] = useState<RecargaPixRow[]>([]);
  const [pessoas, setPessoas] = useState<Record<string, Pessoa>>({});
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [pend, hist] = await Promise.all([
      supabase
        .from('recargas_pix')
        .select('*')
        .eq('status', 'pendente')
        .order('criada_em', { ascending: true }),
      supabase
        .from('recargas_pix')
        .select('*')
        .neq('status', 'pendente')
        .order('analisada_em', { ascending: false })
        .limit(40),
    ]);

    const todas = [...(pend.data ?? []), ...(hist.data ?? [])];
    const ids = [...new Set(todas.map((r) => r.passageiro_id))];
    if (ids.length) {
      const { data } = await supabase
        .from('passageiros')
        .select('id, nome, cpf, telefone')
        .in('id', ids);
      setPessoas(Object.fromEntries((data ?? []).map((p) => [p.id, p])));
    }

    setPendentes(pend.data ?? []);
    setHistorico(hist.data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useAoVivo({ canal: 'admin-recargas-fila', tabela: 'recargas_pix', aoMudar: carregar });

  const aoConcluir = useCallback(
    async (texto: string, tipo: 'ok' | 'erro' = 'ok') => {
      setAviso({ tipo, texto });
      await carregar();
    },
    [carregar],
  );

  const lista = filtro === 'pendentes' ? pendentes : historico;
  const totalPendente = useMemo(
    () => pendentes.reduce((s, r) => s + r.valor_centavos, 0),
    [pendentes],
  );

  if (carregando) return <ActivityIndicator color={colors.primary} style={estilos.spinner} />;

  return (
    <View style={estilos.secao}>
      <Text style={estilos.titulo}>Recargas por PIX</Text>
      <Text style={estilos.nota}>
        Confira cada PIX no extrato do banco antes de aprovar. Comprovante e so um indicio: o que
        vale e o dinheiro na conta. Aprovado, o valor entra na carteira do passageiro na hora.
      </Text>

      <View style={estilos.filtros} accessibilityRole="tablist">
        {(
          [
            ['pendentes', `Aguardando (${pendentes.length})`],
            ['historico', 'Historico'],
          ] as Array<[Filtro, string]>
        ).map(([chave, rotulo]) => (
          <Pressable
            key={chave}
            onPress={() => setFiltro(chave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filtro === chave }}
            style={[estilos.filtro, filtro === chave && estilos.filtroAtivo]}
          >
            <Text style={[estilos.filtroTexto, filtro === chave && estilos.filtroTextoAtivo]}>
              {rotulo}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtro === 'pendentes' && pendentes.length > 0 ? (
        <Text style={estilos.meta}>
          {pendentes.length} pedido{pendentes.length > 1 ? 's' : ''} aguardando · total informado{' '}
          {brl(paraReais(totalPendente))} · mais antigo primeiro
        </Text>
      ) : null}

      {aviso ? (
        <View
          style={aviso.tipo === 'ok' ? estilos.sucesso : estilos.alerta}
          accessibilityLiveRegion="polite"
        >
          <Text style={aviso.tipo === 'ok' ? estilos.sucessoTexto : estilos.alertaTexto}>
            {aviso.texto}
          </Text>
        </View>
      ) : null}

      {lista.length === 0 ? (
        <View style={estilos.vazio}>
          <Text style={estilos.vazioTitulo}>
            {filtro === 'pendentes' ? 'Nenhum comprovante aguardando' : 'Nada analisado ainda'}
          </Text>
          <Text style={estilos.vazioTexto}>
            {filtro === 'pendentes'
              ? 'Quando um passageiro enviar um comprovante, ele aparece aqui sozinho.'
              : 'Recargas aprovadas e recusadas aparecem aqui.'}
          </Text>
        </View>
      ) : (
        lista.map((r) => (
          <CartaoRecarga
            key={r.id}
            recarga={r}
            pessoa={pessoas[r.passageiro_id]}
            onAmpliar={setAmpliada}
            onConcluir={aoConcluir}
          />
        ))
      )}

      <Modal
        visible={Boolean(ampliada)}
        transparent
        animationType="fade"
        onRequestClose={() => setAmpliada(null)}
      >
        <View style={estilos.modalFundo}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAmpliada(null)} />
          {ampliada ? (
            <Image
              source={{ uri: ampliada }}
              style={estilos.modalImagem}
              resizeMode="contain"
              accessibilityLabel="Comprovante ampliado"
            />
          ) : null}
          <View style={estilos.modalAcoes}>
            {ampliada ? (
              <Botao
                titulo="Abrir em nova aba"
                variante="contorno"
                onPress={() => Linking.openURL(ampliada)}
              />
            ) : null}
            <Botao titulo="Fechar" onPress={() => setAmpliada(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function CartaoRecarga({
  recarga: r,
  pessoa,
  onAmpliar,
  onConcluir,
}: {
  recarga: RecargaPixRow;
  pessoa?: Pessoa;
  onAmpliar: (url: string) => void;
  onConcluir: (texto: string, tipo?: 'ok' | 'erro') => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhaImagem, setFalhaImagem] = useState(false);
  const [valorTexto, setValorTexto] = useState(
    (r.valor_centavos / 100).toFixed(2).replace('.', ','),
  );
  const [modo, setModo] = useState<'normal' | 'confirmar' | 'recusar'>('normal');
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pendente = r.status === 'pendente';
  const nome = pessoa?.nome || 'Passageiro';

  // Bucket privado: link assinado, valido por 1 hora.
  useEffect(() => {
    let vivo = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.comprovante_path, 3600)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error || !data?.signedUrl) setFalhaImagem(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      vivo = false;
    };
  }, [r.comprovante_path]);

  const valorCentavos = lerValorEmCentavos(valorTexto);
  const valorInvalido = valorCentavos === null || valorCentavos > 100000;
  const valorAlterado = valorCentavos !== null && valorCentavos !== r.valor_centavos;

  const aprovar = useCallback(async () => {
    if (valorInvalido || valorCentavos === null) return;
    setErro(null);
    setProcessando(true);
    try {
      const { error } = await supabase.rpc('aprovar_recarga_pix', {
        p_recarga_id: r.id,
        p_valor_centavos: valorCentavos,
      });
      if (error) throw error;
      await onConcluir(`${brl(paraReais(valorCentavos))} creditado na carteira de ${nome}.`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setModo('normal');
    } finally {
      setProcessando(false);
    }
  }, [valorInvalido, valorCentavos, r.id, nome, onConcluir]);

  const recusar = useCallback(async () => {
    setErro(null);
    if (!motivo.trim()) {
      setErro('Informe o motivo. O passageiro vai ver.');
      return;
    }
    setProcessando(true);
    try {
      const { error } = await supabase.rpc('recusar_recarga_pix', {
        p_recarga_id: r.id,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
      await onConcluir(`Recarga de ${nome} recusada. O passageiro ve o motivo no app.`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setProcessando(false);
    }
  }, [motivo, r.id, nome, onConcluir]);

  return (
    <View style={[estilos.cartao, pendente && estilos.cartaoPendente, shadow(1)]}>
      <View style={estilos.cartaoCorpo}>
        <Pressable
          onPress={() => url && onAmpliar(url)}
          disabled={!url}
          accessibilityRole="button"
          accessibilityLabel={`Ver comprovante de ${nome}`}
          style={estilos.miniatura}
        >
          {url ? (
            <Image source={{ uri: url }} style={estilos.miniaturaImagem} resizeMode="cover" />
          ) : falhaImagem ? (
            <Text style={estilos.miniaturaTexto}>Sem imagem</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          {url ? (
            <View style={estilos.lupa}>
              <Text style={estilos.lupaTexto}>Ampliar</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={estilos.info}>
          <View style={estilos.linhaTopo}>
            <Text style={estilos.valor}>{brl(paraReais(r.valor_centavos))}</Text>
            <SeloStatus recarga={r} />
          </View>
          <Text style={estilos.nome}>{nome}</Text>
          <Text style={estilos.meta}>
            {pessoa ? formatarCPF(pessoa.cpf) : '—'} · {pessoa?.telefone || 'sem telefone'}
          </Text>
          <Text style={estilos.meta}>
            Pagou em: <Text style={estilos.destaque}>{r.conta_banco}</Text> ·{' '}
            {chaveFormatada('cnpj', r.conta_chave)}
          </Text>
          <Text style={estilos.meta}>
            Codigo <Text style={estilos.destaque}>{r.codigo_referencia}</Text> · enviado{' '}
            {dataHoraCurta(r.criada_em)}
          </Text>
          {r.status === 'aprovada' ? (
            <Text style={estilos.metaOk}>
              Creditado {brl(paraReais(r.valor_aprovado_centavos ?? r.valor_centavos))} em{' '}
              {r.analisada_em ? dataHoraCurta(r.analisada_em) : '—'}
            </Text>
          ) : null}
          {r.status === 'recusada' ? (
            <Text style={estilos.metaErro}>
              Recusada em {r.analisada_em ? dataHoraCurta(r.analisada_em) : '—'}: {r.motivo_recusa}
            </Text>
          ) : null}
        </View>
      </View>

      {pendente && modo === 'normal' ? (
        <View style={estilos.acoes}>
          <Campo
            rotulo="Valor a creditar (R$)"
            value={valorTexto}
            onChangeText={setValorTexto}
            keyboardType="decimal-pad"
            erro={valorInvalido ? 'Valor invalido (maximo R$ 1.000,00).' : null}
            ajuda={
              valorAlterado
                ? `Diferente do informado (${brl(paraReais(r.valor_centavos))}). Use o valor que caiu no extrato.`
                : 'Corrija se o valor no extrato for diferente.'
            }
          />
          <View style={estilos.botoes}>
            <Botao
              titulo="Aprovar"
              onPress={() => setModo('confirmar')}
              desabilitado={valorInvalido}
              style={estilos.botao}
              rotuloAcessivel={`Aprovar recarga de ${nome}`}
            />
            <Botao
              titulo="Recusar"
              variante="perigo"
              onPress={() => {
                setModo('recusar');
                setErro(null);
              }}
              style={estilos.botao}
              rotuloAcessivel={`Recusar recarga de ${nome}`}
            />
          </View>
        </View>
      ) : null}

      {pendente && modo === 'confirmar' && valorCentavos !== null ? (
        <View style={estilos.confirmar}>
          <Text style={estilos.confirmarTexto}>
            Confirmar credito de {brl(paraReais(valorCentavos))} na carteira de {nome}? O PIX foi
            conferido no extrato do {r.conta_banco}?
          </Text>
          <View style={estilos.botoes}>
            <Botao
              titulo="Sim, creditar"
              onPress={aprovar}
              carregando={processando}
              style={estilos.botao}
            />
            <Botao
              titulo="Voltar"
              variante="contorno"
              onPress={() => setModo('normal')}
              style={estilos.botao}
            />
          </View>
        </View>
      ) : null}

      {pendente && modo === 'recusar' ? (
        <View style={estilos.acoes}>
          <Text style={estilos.rotulo}>Motivo da recusa</Text>
          <View style={estilos.motivos}>
            {MOTIVOS_RAPIDOS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMotivo(m)}
                accessibilityRole="button"
                style={[estilos.motivo, motivo === m && estilos.motivoAtivo]}
              >
                <Text style={[estilos.motivoTexto, motivo === m && estilos.motivoTextoAtivo]}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Campo
            rotulo="Motivo (o passageiro ve)"
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: PIX nao encontrado no extrato"
          />
          <View style={estilos.botoes}>
            <Botao
              titulo="Confirmar recusa"
              variante="perigo"
              onPress={recusar}
              carregando={processando}
              style={estilos.botao}
            />
            <Botao
              titulo="Voltar"
              variante="contorno"
              onPress={() => {
                setModo('normal');
                setErro(null);
              }}
              style={estilos.botao}
            />
          </View>
        </View>
      ) : null}

      {erro ? (
        <View style={estilos.alerta} accessibilityLiveRegion="polite">
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SeloStatus({ recarga }: { recarga: RecargaPixRow }) {
  const cfg = {
    pendente: { texto: 'Aguardando', fundo: palette.gold100, cor: palette.navy900 },
    aprovada: { texto: 'Aprovada', fundo: colors.successBg, cor: colors.success },
    recusada: { texto: 'Recusada', fundo: colors.dangerBg, cor: colors.danger },
  }[recarga.status];
  return (
    <View style={[estilos.selo, { backgroundColor: cfg.fundo }]}>
      <Text style={[estilos.seloTexto, { color: cfg.cor }]}>{cfg.texto}</Text>
    </View>
  );
}

/**
 * Quantos comprovantes aguardam, para o numero na aba do painel. Fica ligado
 * mesmo com outra aba aberta, para o Admin ver que chegou pedido novo.
 */
export function usePendentesRecarga(): number {
  const [n, setN] = useState(0);
  const contar = useCallback(async () => {
    const { count, error } = await supabase
      .from('recargas_pix')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente');
    if (!error) setN(count ?? 0);
  }, []);
  useEffect(() => {
    contar();
  }, [contar]);
  useAoVivo({ canal: 'admin-recargas-contador', tabela: 'recargas_pix', aoMudar: contar });
  return n;
}

const estilos = StyleSheet.create({
  secao: { gap: spacing.md },
  spinner: { marginTop: spacing.xl },
  titulo: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  nota: { fontSize: font.size.xs, color: colors.textFaint, lineHeight: 16 },
  filtros: { flexDirection: 'row', gap: spacing.sm },
  filtro: {
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filtroAtivo: { borderColor: colors.primary, backgroundColor: colors.primary },
  filtroTexto: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  filtroTextoAtivo: { color: colors.onPrimary },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cartaoPendente: { borderLeftWidth: 4, borderLeftColor: palette.gold500 },
  cartaoCorpo: { flexDirection: 'row', gap: spacing.md },
  miniatura: {
    width: 96,
    height: 128,
    borderRadius: radius.sm,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniaturaImagem: { width: '100%', height: '100%' },
  miniaturaTexto: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
  lupa: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,25,49,0.75)',
    paddingVertical: 3,
  },
  lupaTexto: {
    color: colors.textOnDark,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: font.weight.semibold,
  },
  info: { flex: 1, gap: 3 },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  valor: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.primaryDark },
  nome: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textMuted },
  metaOk: { fontSize: font.size.xs, color: colors.success, fontWeight: font.weight.semibold },
  metaErro: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
  destaque: { fontWeight: font.weight.bold, color: colors.text },
  selo: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  seloTexto: { fontSize: font.size.xs, fontWeight: font.weight.bold },
  acoes: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  botoes: { flexDirection: 'row', gap: spacing.sm },
  botao: { flex: 1 },
  confirmar: {
    gap: spacing.md,
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.gold300,
  },
  confirmarTexto: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  rotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  motivo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  motivoAtivo: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  motivoTexto: { fontSize: font.size.xs, color: colors.textMuted },
  motivoTextoAtivo: { color: colors.danger, fontWeight: font.weight.semibold },
  vazio: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  vazioTitulo: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  vazioTexto: { fontSize: font.size.sm, color: colors.textFaint, textAlign: 'center' },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  sucesso: {
    backgroundColor: colors.successBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  sucessoTexto: { fontSize: font.size.sm, color: colors.success, fontWeight: font.weight.medium },
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(6,15,30,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalImagem: {
    width: '100%',
    maxWidth: 720,
    height: Platform.OS === 'web' ? '80%' : '75%',
  },
  modalAcoes: { flexDirection: 'row', gap: spacing.sm },
});
