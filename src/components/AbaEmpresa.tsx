import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mensagemDeErro, supabase } from '../lib/supabase';
import { colors, font, radius, shadow, spacing } from '../theme';
import type { ContaRecebimentoRow, TipoChavePix } from '../types/database';
import { chaveFormatada, ROTULO_TIPO_CHAVE } from '../lib/pix';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { CartaoContaPix } from './CartaoContaPix';

const TIPOS: TipoChavePix[] = ['cnpj', 'cpf', 'celular', 'email', 'aleatoria'];

/**
 * Aba "Empresa e PIX" do painel Admin.
 *
 * Razao social, CNPJ e chaves PIX ficam no banco, nao no codigo. O cliente ja
 * trocou o CNPJ uma vez no meio do projeto; deixar isso como cadastro faz a
 * proxima troca ser um campo de formulario em vez de uma nova versao do
 * aplicativo.
 *
 * As contas daqui sao as que o passageiro ve na recarga por PIX, cada uma com
 * QR Code e copia e cola. O sistema nao fala com banco nenhum: a conferencia do
 * PIX e feita pelo Admin na aba "Recargas PIX".
 */
export function AbaEmpresa() {
  const [razao, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cidade, setCidade] = useState('');
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
      if (c.chave === 'empresa_cidade') setCidade(c.valor);
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
        ['empresa_cidade', cidade.trim()],
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
  }, [razao, cnpj, cidade, carregar]);

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

  const executar = useCallback(
    async (acao: () => PromiseLike<{ error: unknown }>, sucesso: string) => {
      setErro(null);
      setOk(null);
      const { error } = await acao();
      if (error) {
        setErro(mensagemDeErro(error));
        return false;
      }
      setOk(sucesso);
      await carregar();
      return true;
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
        <Campo
          rotulo="Cidade (vai dentro do QR Code PIX)"
          value={cidade}
          onChangeText={setCidade}
          placeholder="Feira de Santana"
        />
        <Botao titulo="Salvar dados da empresa" onPress={salvarEmpresa} carregando={salvando} />
      </View>

      <Text style={estilos.titulo}>Chaves PIX para recebimento</Text>
      <Text style={estilos.nota}>
        Estas contas aparecem para o passageiro na recarga por PIX, cada uma com QR Code e PIX
        copia e cola. Desativar esconde a conta sem apagar; remover apaga de vez.
      </Text>

      {contas.length === 0 ? (
        <Text style={estilos.nota}>
          Nenhuma conta cadastrada. O passageiro nao consegue recarregar por PIX.
        </Text>
      ) : null}

      {contas.map((c) => (
        <LinhaConta key={c.id} conta={c} cidade={cidade} executar={executar} />
      ))}

      <View style={[estilos.cartao, shadow(1)]}>
        <Text style={estilos.subtitulo}>Adicionar chave</Text>

        <View style={estilos.doisCampos}>
          <Campo
            rotulo="Banco"
            value={novoBanco}
            onChangeText={setNovoBanco}
            placeholder="Ex.: Santander"
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

function LinhaConta({
  conta: c,
  cidade,
  executar,
}: {
  conta: ContaRecebimentoRow;
  cidade: string;
  executar: (acao: () => PromiseLike<{ error: unknown }>, sucesso: string) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'remover'>('ver');
  const [verQr, setVerQr] = useState(false);
  const [banco, setBanco] = useState(c.banco);
  const [tipo, setTipo] = useState<TipoChavePix>(c.tipo_chave);
  const [chave, setChave] = useState(c.chave);
  const [titular, setTitular] = useState(c.titular);
  const [ocupado, setOcupado] = useState(false);

  const rodar = async (acao: () => PromiseLike<{ error: unknown }>, sucesso: string) => {
    setOcupado(true);
    const deu = await executar(acao, sucesso);
    setOcupado(false);
    if (deu) setModo('ver');
  };

  return (
    <View style={[estilos.cartao, shadow(1), !c.ativa && estilos.cartaoInativo]}>
      <View style={estilos.linha}>
        <Text style={estilos.banco}>{c.banco}</Text>
        <Pressable
          onPress={() =>
            rodar(
              () => supabase.from('contas_recebimento').update({ ativa: !c.ativa }).eq('id', c.id),
              c.ativa ? `${c.banco} desativada: some da tela de recarga.` : `${c.banco} ativada.`,
            )
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: c.ativa }}
          accessibilityLabel={`${c.banco} ${c.ativa ? 'ativa' : 'inativa'}`}
          hitSlop={8}
        >
          <Text style={[estilos.link, !c.ativa && estilos.linkInativo]}>
            {c.ativa ? 'Ativa' : 'Inativa'}
          </Text>
        </Pressable>
      </View>
      <Text style={estilos.meta}>
        {ROTULO_TIPO_CHAVE[c.tipo_chave]} · {chaveFormatada(c.tipo_chave, c.chave)}
      </Text>
      {c.titular ? <Text style={estilos.meta}>Titular: {c.titular}</Text> : null}

      {modo === 'ver' ? (
        <View style={estilos.acoesConta}>
          <Pressable onPress={() => setVerQr((v) => !v)} accessibilityRole="button" hitSlop={8}>
            <Text style={estilos.link}>{verQr ? 'Esconder QR Code' : 'Ver QR Code'}</Text>
          </Pressable>
          <Pressable onPress={() => setModo('editar')} accessibilityRole="button" hitSlop={8}>
            <Text style={estilos.link}>Editar</Text>
          </Pressable>
          <Pressable onPress={() => setModo('remover')} accessibilityRole="button" hitSlop={8}>
            <Text style={[estilos.link, estilos.linkPerigo]}>Remover</Text>
          </Pressable>
        </View>
      ) : null}

      {modo === 'ver' && verQr ? <CartaoContaPix conta={c} cidade={cidade} tamanhoQr={180} /> : null}

      {modo === 'editar' ? (
        <View style={estilos.edicao}>
          <Campo rotulo="Banco" value={banco} onChangeText={setBanco} />
          <Campo rotulo="Chave" value={chave} onChangeText={setChave} autoCapitalize="none" />
          <Campo
            rotulo="Titular (nome que o banco mostra para quem paga)"
            value={titular}
            onChangeText={setTitular}
            autoCapitalize="characters"
          />
          <View style={estilos.tipos} accessibilityRole="radiogroup">
            {TIPOS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTipo(t)}
                accessibilityRole="radio"
                accessibilityState={{ selected: tipo === t }}
                style={[estilos.tipo, tipo === t && estilos.tipoAtivo]}
              >
                <Text style={[estilos.tipoTexto, tipo === t && estilos.tipoTextoAtivo]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={estilos.doisCampos}>
            <Botao
              titulo="Salvar"
              carregando={ocupado}
              desabilitado={!banco.trim() || !chave.trim()}
              style={estilos.metade}
              onPress={() =>
                rodar(
                  () =>
                    supabase
                      .from('contas_recebimento')
                      .update({
                        banco: banco.trim(),
                        tipo_chave: tipo,
                        chave: chave.trim(),
                        titular: titular.trim(),
                        atualizado_em: new Date().toISOString(),
                      })
                      .eq('id', c.id),
                  `${banco.trim()} atualizada.`,
                )
              }
            />
            <Botao
              titulo="Cancelar"
              variante="contorno"
              style={estilos.metade}
              onPress={() => {
                setBanco(c.banco);
                setTipo(c.tipo_chave);
                setChave(c.chave);
                setTitular(c.titular);
                setModo('ver');
              }}
            />
          </View>
        </View>
      ) : null}

      {modo === 'remover' ? (
        <View style={estilos.confirmaRemocao}>
          <Text style={estilos.confirmaTexto}>
            Remover {c.banco} de vez? Ela some da tela de recarga. As recargas antigas continuam no
            historico.
          </Text>
          <View style={estilos.doisCampos}>
            <Botao
              titulo="Sim, remover"
              variante="perigo"
              carregando={ocupado}
              style={estilos.metade}
              onPress={() =>
                rodar(
                  () => supabase.from('contas_recebimento').delete().eq('id', c.id),
                  `${c.banco} removida.`,
                )
              }
            />
            <Botao
              titulo="Cancelar"
              variante="contorno"
              style={estilos.metade}
              onPress={() => setModo('ver')}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartaoInativo: { opacity: 0.6 },
  acoesConta: { flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' },
  linkPerigo: { color: colors.danger },
  edicao: { gap: spacing.md },
  confirmaRemocao: {
    gap: spacing.md,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  confirmaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
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
