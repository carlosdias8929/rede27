import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mensagemDeErro, supabase } from '../lib/supabase';
import { colors, font, radius, shadow, spacing } from '../theme';
import type { ContaRecebimentoRow, TipoChavePix } from '../types/database';
import { Botao } from './Botao';
import { Campo } from './Campo';

const TIPOS: TipoChavePix[] = ['cnpj', 'cpf', 'celular', 'email', 'aleatoria'];

/**
 * Aba "Empresa e PIX" do painel Admin.
 *
 * Razao social, CNPJ e chaves PIX ficam no banco, nao no codigo. O cliente ja
 * trocou o CNPJ uma vez no meio do projeto; deixar isso como cadastro faz a
 * proxima troca ser um campo de formulario em vez de uma nova versao do
 * aplicativo.
 *
 * Importante: isto guarda e exibe dados para pagamento manual. Nao movimenta
 * dinheiro, nao confere comprovante e nao fala com banco nenhum.
 */
export function AbaEmpresa() {
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contas, setContas] = useState<ContaRecebimentoRow[]>([]);

  const [novoBanco, setNovoBanco] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoChavePix>('cnpj');
  const [novaChave, setNovaChave] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [confs, cts] = await Promise.all([
      supabase.from('configuracoes').select('*'),
      supabase.from('contas_recebimento').select('*').order('ordem'),
    ]);

    for (const c of confs.data ?? []) {
      if (c.chave === 'empresa_razao_social') setRazao(c.valor);
      if (c.chave === 'empresa_cnpj') setCnpj(c.valor);
    }
    setContas(cts.data ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvarEmpresa = useCallback(async () => {
    setErro(null);
    setOk(null);
    setSalvando(true);

    try {
      const campos: Array<[string, string]> = [
        ['empresa_razao_social', razao.trim()],
        ['empresa_cnpj', cnpj.trim()],
      ];

      for (const [chave, valor] of campos) {
        const { error } = await supabase.from('configuracoes').update({ valor }).eq('chave', chave);
        if (error) throw error;
      }

      setOk('Dados da empresa salvos.');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }, [razao, cnpj, carregar]);

  const adicionarConta = useCallback(async () => {
    setErro(null);
    setOk(null);

    if (!novoBanco.trim() || !novaChave.trim()) {
      setErro('Informe o banco e a chave.');
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from('contas_recebimento').insert({
        banco: novoBanco.trim(),
        tipo_chave: novoTipo,
        chave: novaChave.trim(),
        titular: razao.trim(),
        ordem: contas.length + 1,
      });
      if (error) throw error;

      setNovoBanco('');
      setNovaChave('');
      setOk('Chave PIX adicionada.');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }, [novoBanco, novoTipo, novaChave, razao, contas.length, carregar]);

  const alternarConta = useCallback(
    async (c: ContaRecebimentoRow) => {
      await supabase.from('contas_recebimento').update({ ativa: !c.ativa }).eq('id', c.id);
      await carregar();
    },
    [carregar],
  );

  return (
    <View style={estilos.secao}>
      <Text style={estilos.titulo}>Dados da empresa</Text>
      <Text style={estilos.nota}>
        Editaveis aqui de proposito: trocar razao social, CNPJ ou chave PIX nao exige nova versao
        do aplicativo.
      </Text>

      <View style={[estilos.cartao, shadow(1)]}>
        <Campo
          rotulo="Razao social"
          value={razao}
          onChangeText={setRazao}
          autoCapitalize="characters"
        />
        <Campo
          rotulo="CNPJ"
          value={cnpj}
          onChangeText={setCnpj}
          placeholder="00.000.000/0001-00"
        />
        <Botao titulo="Salvar dados da empresa" onPress={salvarEmpresa} carregando={salvando} />
      </View>

      <Text style={estilos.titulo}>Chaves PIX para recebimento</Text>
      <Text style={estilos.nota}>
        As chaves aparecem para quem for pagar por PIX. O sistema nao movimenta dinheiro e nao
        confere comprovante: a conferencia e feita no extrato do banco de voces.
      </Text>

      {contas.map((c) => (
        <View key={c.id} style={[estilos.cartao, shadow(1)]}>
          <View style={estilos.linha}>
            <Text style={estilos.banco}>{c.banco}</Text>
            <Pressable onPress={() => alternarConta(c)} accessibilityRole="button" hitSlop={8}>
              <Text style={[estilos.link, !c.ativa && estilos.linkInativo]}>
                {c.ativa ? 'Ativa' : 'Inativa'}
              </Text>
            </Pressable>
          </View>
          <Text style={estilos.meta}>
            {c.tipo_chave.toUpperCase()} · {c.chave}
          </Text>
          {c.titular ? <Text style={estilos.meta}>Titular: {c.titular}</Text> : null}
        </View>
      ))}

      <View style={[estilos.cartao, shadow(1)]}>
        <Text style={estilos.subtitulo}>Adicionar chave</Text>

        <View style={estilos.doisCampos}>
          <Campo
            rotulo="Banco"
            value={novoBanco}
            onChangeText={setNovoBanco}
            placeholder="Ex.: BTG Pactual"
            containerStyle={estilos.metade}
          />
          <Campo
            rotulo="Chave"
            value={novaChave}
            onChangeText={setNovaChave}
            placeholder="CNPJ, celular, e-mail..."
            containerStyle={estilos.metade}
          />
        </View>

        <Text style={estilos.rotuloTipo}>Tipo da chave</Text>
        <View style={estilos.tipos} accessibilityRole="radiogroup">
          {TIPOS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setNovoTipo(t)}
              accessibilityRole="radio"
              accessibilityState={{ selected: novoTipo === t }}
              style={[estilos.tipo, novoTipo === t && estilos.tipoAtivo]}
            >
              <Text style={[estilos.tipoTexto, novoTipo === t && estilos.tipoTextoAtivo]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Botao titulo="Adicionar chave PIX" onPress={adicionarConta} carregando={salvando} />
      </View>

      {erro ? (
        <View style={estilos.alerta} accessibilityLiveRegion="polite">
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}

      {ok ? (
        <View style={estilos.sucesso} accessibilityLiveRegion="polite">
          <Text style={estilos.sucessoTexto}>{ok}</Text>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: spacing.md },
  titulo: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  subtitulo: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  nota: { fontSize: font.size.xs, color: colors.textFaint, lineHeight: 16 },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banco: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textFaint },
  link: { fontSize: font.size.sm, color: colors.secondary, fontWeight: font.weight.semibold },
  linkInativo: { color: colors.textFaint },
  doisCampos: { flexDirection: 'row', gap: spacing.md },
  metade: { flex: 1 },
  rotuloTipo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tipo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tipoAtivo: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tipoTexto: { fontSize: font.size.xs, color: colors.textMuted },
  tipoTextoAtivo: { color: colors.primaryDark, fontWeight: font.weight.semibold },
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
});
