import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '../src/components/Botao';
import { Campo } from '../src/components/Campo';
import { FotoUpload } from '../src/components/FotoUpload';
import { Logo } from '../src/components/Logo';
import { CICLO_CORRIDA, ICONE_CATEGORIA } from '../src/config/rede27.config';
import { useAoVivo } from '../src/lib/aoVivo';
import { formatarCPF } from '../src/lib/cpf';
import { brl, dataHoraCurta, paraReais } from '../src/lib/format';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type { CorridaRow } from '../src/types/database';

/**
 * PAINEL DO MOTORISTA (web).
 *
 * Uma pagina so, com tres estados: entrar, completar cadastro e operar. O
 * cadastro exige foto de perfil e foto do veiculo — exigencia do cliente para
 * a Fase 1, e o banco recusa aceitar corrida sem elas.
 */
export default function PainelMotorista() {
  const { session, papel, motorista, carregando, sair, recarregar } = useSessao();

  // O motorista precisa poder voltar ao cadastro depois de salvo: troca de
  // carro, muda de telefone, a foto ficou ruim. Antes, salvar era caminho so de
  // ida — o painel entrava em operacao e nao havia porta de volta.
  const [vendo, setVendo] = useState<'operacao' | 'perfil'>('operacao');

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Acesso />;

  if (papel !== 'motorista') {
    return (
      <View style={estilos.centro}>
        <Logo />
        <Text style={estilos.negadoTitulo}>Esta conta nao e de motorista</Text>
        <Text style={estilos.negadoTexto}>
          Entre com uma conta de motorista ou peca a administracao da REDE27 para cadastrar a sua.
        </Text>
        <Botao titulo="Sair" variante="contorno" onPress={sair} />
      </View>
    );
  }

  if (!motorista) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Cadastro incompleto e obrigatorio; com cadastro completo, e opcional.
  if (!motorista.cadastro_completo || vendo === 'perfil') {
    return (
      <Cadastro
        editando={motorista.cadastro_completo}
        onPronto={async () => {
          await recarregar();
          setVendo('operacao');
        }}
        onVoltar={motorista.cadastro_completo ? () => setVendo('operacao') : undefined}
      />
    );
  }

  return <Operacao onAbrirPerfil={() => setVendo('perfil')} />;
}

/* -------------------------------------------------------------------------- */
/* Entrar / criar conta de motorista                                          */
/* -------------------------------------------------------------------------- */

function Acesso() {
  const { entrar, cadastrar } = useSessao();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(async () => {
    setErro(null);
    setEnviando(true);
    try {
      if (modo === 'entrar') await entrar(cpf, senha);
      else await cadastrar({ cpf, senha, nome, telefone, papel: 'motorista' });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }, [modo, entrar, cadastrar, cpf, senha, nome, telefone]);

  return (
    <ScrollView
      contentContainerStyle={[estilos.acessoScroll, { paddingTop: insets.top + spacing.xxl }]}
    >
      <Logo tamanho="lg" sobreEscuro />
      <Text style={estilos.acessoSubtitulo}>Painel do motorista</Text>

      <View style={[estilos.acessoCartao, shadow(3)]}>
        <Text style={estilos.acessoTitulo}>
          {modo === 'entrar' ? 'Entrar' : 'Criar conta de motorista'}
        </Text>

        <View style={estilos.form}>
          <Campo
            rotulo="CPF"
            value={cpf}
            onChangeText={(t) => setCpf(formatarCPF(t))}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
          />

          {modo === 'cadastrar' ? (
            <>
              <Campo
                rotulo="Nome completo"
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
              <Campo
                rotulo="Telefone (WhatsApp)"
                value={telefone}
                onChangeText={setTelefone}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                ajuda="A central liga para este numero em caso de protocolo 03."
              />
            </>
          ) : null}

          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={enviar}
          />

          {erro ? (
            <View style={estilos.alerta} accessibilityLiveRegion="polite">
              <Text style={estilos.alertaTexto}>{erro}</Text>
            </View>
          ) : null}

          <Botao
            titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            onPress={enviar}
            carregando={enviando}
          />

          <Pressable
            onPress={() => setModo((m) => (m === 'entrar' ? 'cadastrar' : 'entrar'))}
            accessibilityRole="button"
            style={estilos.alternar}
          >
            <Text style={estilos.alternarTexto}>
              {modo === 'entrar' ? 'Sou motorista novo. Criar conta' : 'Ja tenho conta. Entrar'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={() => router.replace('/login')} accessibilityRole="button">
        <Text style={estilos.acessoLink}>Sou passageiro</Text>
      </Pressable>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Completar cadastro (fotos obrigatorias)                                     */
/* -------------------------------------------------------------------------- */

function Cadastro({
  onPronto,
  editando = false,
  onVoltar,
}: {
  onPronto: () => Promise<void>;
  editando?: boolean;
  onVoltar?: () => void;
}) {
  const { motorista, sair } = useSessao();
  const insets = useSafeAreaInsets();

  const [nome, setNome] = useState(motorista?.nome ?? '');
  const [telefone, setTelefone] = useState(motorista?.telefone ?? '');
  const [veiculo, setVeiculo] = useState(motorista?.veiculo_descricao ?? '');
  const [placa, setPlaca] = useState(motorista?.veiculo_placa ?? '');
  const [fotoPerfil, setFotoPerfil] = useState(motorista?.foto_perfil_url ?? null);
  const [fotoVeiculo, setFotoVeiculo] = useState(motorista?.foto_veiculo_url ?? null);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const faltando = [
    !nome.trim() && 'nome',
    !telefone.trim() && 'telefone',
    !fotoPerfil && 'foto de perfil',
    !fotoVeiculo && 'foto do veiculo',
  ].filter(Boolean) as string[];

  const salvar = useCallback(async () => {
    if (!motorista) return;

    setErro(null);
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('motoristas')
        .update({
          nome: nome.trim(),
          telefone: telefone.trim(),
          veiculo_descricao: veiculo.trim(),
          veiculo_placa: placa.trim().toUpperCase(),
          foto_perfil_url: fotoPerfil,
          foto_veiculo_url: fotoVeiculo,
        })
        .eq('id', motorista.id);

      if (error) throw error;
      await onPronto();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }, [motorista, nome, telefone, veiculo, placa, fotoPerfil, fotoVeiculo, onPronto]);

  if (!motorista) return null;

  return (
    <ScrollView
      contentContainerStyle={[
        estilos.conteudo,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <Logo />
      <Text style={estilos.titulo}>
        {editando ? 'Meu perfil' : 'Complete o seu cadastro'}
      </Text>
      <Text style={estilos.subtitulo}>
        As duas fotos sao obrigatorias e aparecem para o passageiro durante a corrida. E o que
        deixa claro quem esta chegando.
      </Text>

      <View style={[estilos.cartao, shadow(1)]}>
        <View style={estilos.form}>
          <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
          <Campo
            rotulo="Telefone (WhatsApp)"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            ajuda="A central liga para este numero em caso de protocolo 03."
          />
          <Campo
            rotulo="Veiculo"
            value={veiculo}
            onChangeText={setVeiculo}
            placeholder="Ex.: Fiat Uno branco"
          />
          <Campo
            rotulo="Placa"
            value={placa}
            onChangeText={setPlaca}
            placeholder="ABC1D23"
            autoCapitalize="characters"
            maxLength={8}
          />

          <FotoUpload
            rotulo="Minha foto"
            ajuda="Rosto visivel, sem oculos escuros."
            nomeArquivo="perfil"
            motoristaId={motorista.id}
            urlAtual={fotoPerfil}
            onEnviado={setFotoPerfil}
            formato="retrato"
          />

          <FotoUpload
            rotulo="Foto do veiculo"
            ajuda="Carro ou moto inteiro, com a placa legivel."
            nomeArquivo="veiculo"
            motoristaId={motorista.id}
            urlAtual={fotoVeiculo}
            onEnviado={setFotoVeiculo}
            formato="paisagem"
          />

          {faltando.length > 0 ? (
            <Text style={estilos.faltando}>Ainda falta: {faltando.join(', ')}.</Text>
          ) : null}

          {erro ? (
            <View style={estilos.alerta} accessibilityLiveRegion="polite">
              <Text style={estilos.alertaTexto}>{erro}</Text>
            </View>
          ) : null}

          <Botao
            titulo={editando ? 'Salvar alteracoes' : 'Salvar e comecar a receber corridas'}
            onPress={salvar}
            carregando={salvando}
            desabilitado={faltando.length > 0}
          />
          {onVoltar ? (
            <Botao titulo="Voltar ao painel" variante="contorno" onPress={onVoltar} />
          ) : null}
          <Botao titulo="Sair" variante="texto" onPress={sair} />
        </View>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Operacao: fila e corrida ativa                                             */
/* -------------------------------------------------------------------------- */

function Operacao({ onAbrirPerfil }: { onAbrirPerfil: () => void }) {
  const { motorista, sair, recarregar } = useSessao();
  const insets = useSafeAreaInsets();

  const [fila, setFila] = useState<CorridaRow[]>([]);
  const [minha, setMinha] = useState<CorridaRow | null>(null);
  const [ultimaConcluida, setUltimaConcluida] = useState<CorridaRow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!motorista) return;

    const [abertas, ativa, concluida] = await Promise.all([
      supabase
        .from('corridas')
        .select('*')
        .eq('status', 'aberta')
        .is('motorista_id', null)
        .order('criada_em'),
      supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', motorista.id)
        .eq('status', 'aberta')
        .maybeSingle(),
      supabase
        .from('corridas')
        .select('*')
        .eq('motorista_id', motorista.id)
        .eq('status', 'concluida')
        .order('atualizada_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (abertas.error) setErro(mensagemDeErro(abertas.error));
    else setFila(abertas.data ?? []);

    setMinha(ativa.data ?? null);
    setUltimaConcluida(concluida.data ?? null);
    setCarregando(false);
  }, [motorista]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime mais relogio mais volta do foco: se o socket cair, a fila e o
  // passo da corrida se corrigem sozinhos em vez de congelar.
  useAoVivo({ canal: 'painel-motorista', tabela: 'corridas', aoMudar: carregar });

  const aceitar = useCallback(
    async (corrida: CorridaRow) => {
      setProcessando(corrida.id);
      setErro(null);
      try {
        const { error } = await supabase.rpc('aceitar_corrida', { p_corrida_id: corrida.id });
        if (error) throw error;
        await carregar();
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setProcessando(null);
      }
    },
    [carregar],
  );

  const avancar = useCallback(
    async (corrida: CorridaRow) => {
      const proximo = CICLO_CORRIDA.find((p) => p.numero === corrida.passo_atual + 1);

      setProcessando(corrida.id);
      setErro(null);
      try {
        const { error } = await supabase.rpc('avancar_protocolo', {
          p_corrida_id: corrida.id,
          p_chave: proximo?.chave ?? '',
        });
        if (error) throw error;
        await Promise.all([carregar(), recarregar()]);
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setProcessando(null);
      }
    },
    [carregar, recarregar],
  );

  const proximoPasso = minha ? CICLO_CORRIDA.find((p) => p.numero === minha.passo_atual + 1) : null;

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <View style={estilos.cabecalhoLinha}>
          <Logo sobreEscuro />
          <View style={estilos.cabecalhoAcoes}>
            <Pressable onPress={onAbrirPerfil} accessibilityRole="button" hitSlop={10}>
              <Text style={estilos.linkCabecalho}>Meu perfil</Text>
            </Pressable>
            <Pressable onPress={sair} accessibilityRole="button" hitSlop={10}>
              <Text style={estilos.sair}>Sair</Text>
            </Pressable>
          </View>
        </View>
        <Text style={estilos.cabecalhoTexto}>
          {motorista?.nome} · {motorista?.veiculo_descricao || 'veiculo nao informado'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {erro ? (
          <View style={estilos.alerta} accessibilityLiveRegion="polite">
            <Text style={estilos.alertaTexto}>{erro}</Text>
          </View>
        ) : null}

        {minha ? (
          <View style={[estilos.cartaoAtivo, shadow(2)]}>
            <Text style={estilos.secaoTitulo}>Corrida em andamento</Text>
            <Text style={estilos.destino}>{minha.destino_texto}</Text>
            <Text style={estilos.meta}>
              {brl(paraReais(minha.valor_estimado_centavos))} ·{' '}
              {Number(minha.distancia_km).toFixed(1).replace('.', ',')} km
            </Text>
            <Text style={estilos.passo}>
              Passo {minha.passo_atual} de 5 —{' '}
              {CICLO_CORRIDA.find((p) => p.numero === minha.passo_atual)?.titulo}
            </Text>

            {proximoPasso ? (
              <Botao
                titulo={proximoPasso.acaoMotorista ?? `Avancar para ${proximoPasso.titulo}`}
                onPress={() => avancar(minha)}
                carregando={processando === minha.id}
              />
            ) : null}
          </View>
        ) : null}

        {!minha && ultimaConcluida ? (
          <View style={[estilos.cartaoConcluido, shadow(1)]}>
            <Text style={estilos.concluidoTitulo}>Corrida concluida</Text>
            <Text style={estilos.destino} numberOfLines={1}>
              {ultimaConcluida.destino_texto}
            </Text>
            <Text style={estilos.concluidoValor}>
              Voce recebe {brl(paraReais(ultimaConcluida.valor_motorista_centavos ?? 0))}
            </Text>
            <Text style={estilos.meta}>
              Corrida de {brl(paraReais(ultimaConcluida.valor_final_centavos ?? 0))} ·{' '}
              taxa REDE27 {ultimaConcluida.taxa_empresa_percentual}% ·{' '}
              {dataHoraCurta(ultimaConcluida.atualizada_em)}
            </Text>
          </View>
        ) : null}

        <Text style={estilos.secaoTitulo}>
          Chamadas disponiveis {fila.length > 0 ? `(${fila.length})` : ''}
        </Text>

        {carregando ? (
          <ActivityIndicator color={colors.primary} style={estilos.spinner} />
        ) : fila.length === 0 ? (
          <Text style={estilos.vazio}>Nenhuma chamada aguardando no momento.</Text>
        ) : (
          fila.map((corrida) => (
            <View key={corrida.id} style={[estilos.cartao, shadow(1)]}>
              <View style={estilos.linhaTopo}>
                <Text style={estilos.destino} numberOfLines={2}>
                  {ICONE_CATEGORIA[corrida.categoria_chave] ?? '🚗'} {corrida.destino_texto}
                </Text>
                <Text style={estilos.valor}>{brl(paraReais(corrida.valor_estimado_centavos))}</Text>
              </View>
              <Text style={estilos.meta}>
                {Number(corrida.distancia_km).toFixed(1).replace('.', ',')} km ·{' '}
                {dataHoraCurta(corrida.criada_em)}
              </Text>
              <Botao
                titulo="Aceitar corrida"
                onPress={() => aceitar(corrida)}
                carregando={processando === corrida.id}
                desabilitado={Boolean(minha)}
              />
            </View>
          ))
        )}

        {minha ? (
          <Text style={estilos.rodape}>
            Conclua a corrida atual para poder aceitar outra.
          </Text>
        ) : null}
      </ScrollView>
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
  acessoScroll: {
    flexGrow: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  acessoSubtitulo: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  acessoCartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 460,
    borderTopWidth: 4,
    borderTopColor: palette.gold400,
  },
  acessoTitulo: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primaryDark },
  acessoLink: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  cabecalho: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: palette.gold400,
    gap: spacing.xs,
  },
  cabecalhoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cabecalhoTexto: { color: palette.navy100, fontSize: font.size.sm },
  cabecalhoAcoes: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  linkCabecalho: { color: palette.white, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  cartaoConcluido: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  concluidoTitulo: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.success },
  concluidoValor: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.primaryDark },
  sair: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  conteudo: {
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  titulo: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.primaryDark },
  subtitulo: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 19 },
  form: { gap: spacing.lg, marginTop: spacing.sm },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cartaoAtivo: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  secaoTitulo: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  destino: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  valor: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.primaryDark },
  meta: { fontSize: font.size.xs, color: colors.textFaint },
  passo: { fontSize: font.size.sm, color: colors.secondaryDark, fontWeight: font.weight.semibold },
  spinner: { marginTop: spacing.lg },
  vazio: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  faltando: { fontSize: font.size.sm, color: colors.warning, fontWeight: font.weight.medium },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  negadoTitulo: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  negadoTexto: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
  alternar: { alignSelf: 'center', paddingVertical: spacing.sm },
  alternarTexto: { fontSize: font.size.sm, color: colors.secondary, fontWeight: font.weight.semibold },
  rodape: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
});
