import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AbaEmpresa } from '../src/components/AbaEmpresa';
import { Botao } from '../src/components/Botao';
import { Campo } from '../src/components/Campo';
import { Logo } from '../src/components/Logo';
import { Protocolo } from '../src/components/Protocolo';
import { MARCA, PROTOCOLO_03, TAXA } from '../src/config/rede27.config';
import { useAoVivo } from '../src/lib/aoVivo';
import { iniciarAlarme, liberarAudio, pararAlarme, precisaDeGesto } from '../src/lib/alarme';
import { formatarCPF } from '../src/lib/cpf';
import { brl, dataHoraCurta, paraCentavos, paraReais } from '../src/lib/format';
import { mensagemDeErro, supabase } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';
import type {
  Alerta03Row,
  CategoriaRow,
  CidadeRow,
  ConfiguracaoRow,
  CorridaRow,
  MotoristaRow,
  PassageiroRow,
} from '../src/types/database';

type Aba = 'alertas' | 'corridas' | 'carteiras' | 'precos' | 'empresa' | 'cidades' | 'motoristas';

/** PAINEL ADMIN (web). */
export default function PainelAdmin() {
  const { session, papel, carregando, sair } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Acesso />;

  if (papel !== 'admin') {
    return (
      <View style={estilos.centro}>
        <Logo />
        <Text style={estilos.negadoTitulo}>Acesso restrito</Text>
        <Text style={estilos.negadoTexto}>
          Esta conta nao esta autorizada no painel Admin. O cadastro e feito pela administracao da
          {MARCA.empresa}, na tabela `administradores`.
        </Text>
        <Botao titulo="Sair" variante="contorno" onPress={sair} />
      </View>
    );
  }

  return <Painel />;
}

/* -------------------------------------------------------------------------- */

function Acesso() {
  const { entrar } = useSessao();
  const insets = useSafeAreaInsets();

  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(async () => {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(cpf, senha);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }, [entrar, cpf, senha]);

  return (
    <ScrollView
      contentContainerStyle={[estilos.acessoScroll, { paddingTop: insets.top + spacing.xxl }]}
    >
      <Logo tamanho="lg" sobreEscuro />
      <Text style={estilos.acessoSubtitulo}>Painel administrativo</Text>

      <View style={[estilos.acessoCartao, shadow(3)]}>
        <View style={estilos.form}>
          <Campo
            rotulo="CPF"
            value={cpf}
            onChangeText={(t) => setCpf(formatarCPF(t))}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            maxLength={14}
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={enviar}
          />
          {erro ? (
            <View style={estilos.alerta}>
              <Text style={estilos.alertaTexto}>{erro}</Text>
            </View>
          ) : null}
          <Botao titulo="Entrar" onPress={enviar} carregando={enviando} />
        </View>
      </View>

      <Pressable onPress={() => router.replace('/login')} accessibilityRole="button">
        <Text style={estilos.acessoLink}>Voltar ao aplicativo</Text>
      </Pressable>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */

function Painel() {
  const { sair } = useSessao();
  const insets = useSafeAreaInsets();
  const [aba, setAba] = useState<Aba>('alertas');
  const [alertasAtivos, setAlertasAtivos] = useState(0);

  const abas: Array<{ chave: Aba; rotulo: string }> = [
    { chave: 'alertas', rotulo: `Protocolo 03${alertasAtivos ? ` (${alertasAtivos})` : ''}` },
    { chave: 'corridas', rotulo: 'Corridas' },
    { chave: 'carteiras', rotulo: 'Carteiras' },
    { chave: 'precos', rotulo: 'Precos e taxa' },
    { chave: 'empresa', rotulo: 'Empresa e PIX' },
    { chave: 'cidades', rotulo: 'Cidades' },
    { chave: 'motoristas', rotulo: 'Motoristas' },
  ];

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecalho, { paddingTop: insets.top + spacing.md }]}>
        <View style={estilos.cabecalhoLinha}>
          <Logo sobreEscuro />
          <Pressable onPress={sair} accessibilityRole="button" hitSlop={10}>
            <Text style={estilos.sair}>Sair</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.abasScroll}>
          <View style={estilos.abas}>
            {abas.map((a) => (
              <Pressable
                key={a.chave}
                onPress={() => setAba(a.chave)}
                accessibilityRole="tab"
                accessibilityState={{ selected: aba === a.chave }}
                style={[estilos.aba, aba === a.chave && estilos.abaAtiva]}
              >
                <Text style={[estilos.abaTexto, aba === a.chave && estilos.abaTextoAtivo]}>
                  {a.rotulo}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + spacing.xxl }]}
      >
        {aba === 'alertas' ? <AbaAlertas onContar={setAlertasAtivos} /> : null}
        {aba === 'corridas' ? <AbaCorridas /> : null}
        {aba === 'carteiras' ? <AbaCarteiras /> : null}
        {aba === 'precos' ? <AbaPrecos /> : null}
        {aba === 'empresa' ? <AbaEmpresa /> : null}
        {aba === 'cidades' ? <AbaCidades /> : null}
        {aba === 'motoristas' ? <AbaMotoristas /> : null}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Protocolo 03                                                               */
/* -------------------------------------------------------------------------- */

type AlertaCompleto = Alerta03Row & {
  passageiro?: PassageiroRow | null;
  motorista?: MotoristaRow | null;
};

function AbaAlertas({ onContar }: { onContar: (n: number) => void }) {
  const [alertas, setAlertas] = useState<AlertaCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [audioBloqueado, setAudioBloqueado] = useState(false);

  const piscar = React.useRef(new Animated.Value(0)).current;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('alertas_03')
      .select('*')
      .eq('status', 'ativo')
      .order('acionado_em', { ascending: false });

    if (error) {
      setErro(mensagemDeErro(error));
      setCarregando(false);
      return;
    }

    const lista = data ?? [];

    // Nome e telefone de quem acionou e de quem esta dirigindo: e com isso que
    // a central liga no passo 4.
    const completos = await Promise.all(
      lista.map(async (a) => {
        const [p, m] = await Promise.all([
          supabase.from('passageiros').select('*').eq('id', a.passageiro_id).maybeSingle(),
          a.motorista_id
            ? supabase.from('motoristas').select('*').eq('id', a.motorista_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        return { ...a, passageiro: p.data, motorista: (m as any).data };
      }),
    );

    setAlertas(completos);
    onContar(completos.length);
    setCarregando(false);
  }, [onContar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Um alerta de emergencia que nao chega e o pior caso do sistema inteiro.
  // Alem do Realtime, conferimos de tempos em tempos e ao voltar o foco, com
  // intervalo curto: alguns segundos de atraso sao aceitaveis; perder o alerta
  // nao e.
  useAoVivo({
    canal: 'admin-alertas-03',
    tabela: 'alertas_03',
    aoMudar: carregar,
    intervaloMs: 5000,
  });

  // Alarme e pisca-pisca enquanto houver alerta ativo.
  useEffect(() => {
    if (alertas.length === 0) {
      pararAlarme();
      piscar.stopAnimation();
      piscar.setValue(0);
      setAudioBloqueado(false);
      return;
    }

    if (PROTOCOLO_03.alarmeNoAdmin) {
      if (precisaDeGesto()) setAudioBloqueado(true);
      else {
        setAudioBloqueado(false);
        iniciarAlarme();
      }
    }

    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(piscar, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(piscar, { toValue: 0, duration: 600, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    animacao.start();

    return () => {
      animacao.stop();
      pararAlarme();
    };
  }, [alertas.length, piscar]);

  useEffect(() => () => pararAlarme(), []);

  const registrarVisualizacao = useCallback(async (alerta: Alerta03Row) => {
    if (alerta.passo_atual >= 3) return;
    await supabase.rpc('registrar_passo_03', {
      p_alerta_id: alerta.id,
      p_passo: 3,
      p_chave: 'alerta_exibido',
      p_detalhe: 'Alerta exibido no painel Admin',
    });
  }, []);

  // Passo 3 acontece por ver o alerta na tela — registramos ao aparecer.
  useEffect(() => {
    alertas.filter((a) => a.passo_atual < 3).forEach(registrarVisualizacao);
  }, [alertas, registrarVisualizacao]);

  const ligar = useCallback(
    async (alerta: AlertaCompleto, quem: 'passageiro' | 'motorista', telefone: string) => {
      const numero = (telefone || '').replace(/\D/g, '');
      if (!numero) return;

      setProcessando(alerta.id);
      try {
        await supabase.rpc('registrar_passo_03', {
          p_alerta_id: alerta.id,
          p_passo: 4,
          p_chave: 'contato_realizado',
          p_detalhe: `Ligacao para o ${quem}: ${numero}`,
        });
        await Linking.openURL(`tel:${numero}`);
        await carregar();
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setProcessando(null);
      }
    },
    [carregar],
  );

  const encerrar = useCallback(
    async (alerta: AlertaCompleto) => {
      setProcessando(alerta.id);
      setErro(null);
      try {
        const { error } = await supabase.rpc('encerrar_03', {
          p_alerta_id: alerta.id,
          p_observacao: 'Encerrado pelo painel Admin',
        });
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

  const fundoPiscante = piscar.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.danger, '#7E1D12'],
  });

  if (carregando) return <ActivityIndicator color={colors.primary} style={estilos.spinner} />;

  return (
    <View style={estilos.secao}>
      {erro ? (
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}

      {audioBloqueado ? (
        <Pressable
          onPress={async () => {
            if (await liberarAudio()) {
              setAudioBloqueado(false);
              iniciarAlarme();
            }
          }}
          accessibilityRole="button"
          style={estilos.audioBloqueado}
        >
          <Text style={estilos.audioBloqueadoTexto}>
            O navegador bloqueou o som. Toque aqui para ativar o alarme sonoro.
          </Text>
        </Pressable>
      ) : null}

      {alertas.length === 0 ? (
        <View style={estilos.tranquilo}>
          <Text style={estilos.tranquiloTitulo}>Nenhum alerta ativo</Text>
          <Text style={estilos.tranquiloTexto}>
            Quando um passageiro segurar o 03 por 3 segundos, o alerta aparece aqui com som e
            localizacao.
          </Text>
        </View>
      ) : null}

      {alertas.map((alerta) => {
        const telPassageiro = alerta.passageiro?.telefone ?? '';
        const telMotorista = alerta.motorista?.telefone ?? '';
        const temLocal = alerta.latitude != null && alerta.longitude != null;
        const mapa = temLocal
          ? `https://www.google.com/maps/search/?api=1&query=${alerta.latitude},${alerta.longitude}`
          : null;

        return (
          <View key={alerta.id} style={[estilos.alertaCartao, shadow(3)]}>
            <Animated.View style={[estilos.alertaFaixa, { backgroundColor: fundoPiscante }]}>
              <Text style={estilos.alertaFaixaTexto}>PROTOCOLO 03 ATIVADO</Text>
            </Animated.View>

            <View style={estilos.alertaCorpo}>
              <Text style={estilos.alertaHora}>
                Acionado em {dataHoraCurta(alerta.acionado_em)}
              </Text>

              <View style={estilos.pessoas}>
                <View style={estilos.pessoa}>
                  <Text style={estilos.pessoaRotulo}>Passageiro</Text>
                  <Text style={estilos.pessoaNome}>{alerta.passageiro?.nome || '—'}</Text>
                  <Text style={estilos.pessoaTel}>{telPassageiro || 'sem telefone'}</Text>
                </View>
                <View style={estilos.pessoa}>
                  <Text style={estilos.pessoaRotulo}>Motorista</Text>
                  <Text style={estilos.pessoaNome}>{alerta.motorista?.nome || '—'}</Text>
                  <Text style={estilos.pessoaTel}>{telMotorista || 'sem telefone'}</Text>
                </View>
              </View>

              <View style={estilos.localizacao}>
                <Text style={estilos.localizacaoRotulo}>Localizacao</Text>
                {temLocal ? (
                  <>
                    <Text style={estilos.localizacaoTexto}>
                      {Number(alerta.latitude).toFixed(5)}, {Number(alerta.longitude).toFixed(5)}
                      {alerta.precisao_m ? ` (~${Math.round(Number(alerta.precisao_m))} m)` : ''}
                    </Text>
                    <Pressable
                      onPress={() => mapa && Linking.openURL(mapa)}
                      accessibilityRole="link"
                      hitSlop={8}
                    >
                      <Text style={estilos.link}>Abrir no mapa</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={estilos.semLocal}>
                    Sem localizacao: GPS negado ou desligado no aparelho.
                  </Text>
                )}
              </View>

              <Protocolo
                titulo="Protocolo 03"
                passos={PROTOCOLO_03.passos}
                passoAtual={alerta.passo_atual}
                emergencia
              />

              <View style={estilos.acoes}>
                <Botao
                  titulo="Ligar para o passageiro"
                  variante="secundario"
                  onPress={() => ligar(alerta, 'passageiro', telPassageiro)}
                  desabilitado={!telPassageiro}
                  carregando={processando === alerta.id}
                />
                <Botao
                  titulo="Ligar para o motorista"
                  variante="secundario"
                  onPress={() => ligar(alerta, 'motorista', telMotorista)}
                  desabilitado={!telMotorista}
                />
                <Botao
                  titulo="Encerrar alerta"
                  variante="perigo"
                  onPress={() => encerrar(alerta)}
                  carregando={processando === alerta.id}
                />
              </View>

              {Platform.OS === 'web' ? (
                <Text style={estilos.dica}>
                  Os botoes de ligar abrem o discador do computador. Em celular, ligam direto.
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Corridas e repasse                                                         */
/* -------------------------------------------------------------------------- */

function AbaCorridas() {
  const [corridas, setCorridas] = useState<CorridaRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from('corridas')
      .select('*')
      .order('criada_em', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setCorridas(data ?? []);
        setCarregando(false);
      });
  }, []);

  const totais = useMemo(() => {
    const concluidas = corridas.filter((c) => c.status === 'concluida');
    return {
      quantidade: concluidas.length,
      bruto: concluidas.reduce((s, c) => s + (c.valor_final_centavos ?? 0), 0),
      empresa: concluidas.reduce((s, c) => s + (c.valor_empresa_centavos ?? 0), 0),
      motorista: concluidas.reduce((s, c) => s + (c.valor_motorista_centavos ?? 0), 0),
    };
  }, [corridas]);

  if (carregando) return <ActivityIndicator color={colors.primary} style={estilos.spinner} />;

  return (
    <View style={estilos.secao}>
      <View style={estilos.totais}>
        <Total rotulo="Concluidas" valor={String(totais.quantidade)} />
        <Total rotulo="Faturamento" valor={brl(paraReais(totais.bruto))} />
        <Total rotulo={MARCA.empresa} valor={brl(paraReais(totais.empresa))} destaque />
        <Total rotulo="Motoristas" valor={brl(paraReais(totais.motorista))} />
      </View>

      <Text style={estilos.nota}>
        O repasse ao motorista e calculado e registrado em cada corrida. O pagamento automatico
        entra quando houver pagamento integrado.
      </Text>

      {corridas.length === 0 ? (
        <Text style={estilos.vazio}>Nenhuma corrida registrada.</Text>
      ) : (
        corridas.map((c) => (
          <View key={c.id} style={[estilos.linhaCartao, shadow(1)]}>
            <View style={estilos.linhaTopo}>
              <Text style={estilos.destino} numberOfLines={1}>
                {c.destino_texto}
              </Text>
              <Text style={estilos.valor}>
                {brl(paraReais(c.valor_final_centavos ?? c.valor_estimado_centavos))}
              </Text>
            </View>
            <Text style={estilos.meta}>
              {dataHoraCurta(c.criada_em)} · {c.status} · passo {c.passo_atual}/5
              {c.motorista_nome ? ` · ${c.motorista_nome}` : ''}
            </Text>
            {c.status === 'concluida' ? (
              <Text style={estilos.repasse}>
                {MARCA.empresa} {brl(paraReais(c.valor_empresa_centavos ?? 0))} ({c.taxa_empresa_percentual}%)
                · Motorista {brl(paraReais(c.valor_motorista_centavos ?? 0))}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={[estilos.total, destaque && estilos.totalDestaque]}>
      <Text style={estilos.totalRotulo}>{rotulo}</Text>
      <Text style={[estilos.totalValor, destaque && estilos.totalValorDestaque]}>{valor}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Carteiras                                                                  */
/* -------------------------------------------------------------------------- */

type PassageiroComSaldo = PassageiroRow & { saldo_centavos: number };

function AbaCarteiras() {
  const [passageiros, setPassageiros] = useState<PassageiroComSaldo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [pess, cart] = await Promise.all([
      supabase.from('passageiros').select('*').order('criado_em', { ascending: false }),
      supabase.from('carteiras').select('passageiro_id, saldo_centavos'),
    ]);

    const saldos = new Map((cart.data ?? []).map((c) => [c.passageiro_id, c.saldo_centavos]));
    setPassageiros(
      (pess.data ?? []).map((p) => ({ ...p, saldo_centavos: saldos.get(p.id) ?? 0 })),
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const creditar = useCallback(
    async (passageiro: PassageiroComSaldo) => {
      const bruto = (valores[passageiro.id] ?? '').replace(',', '.');
      const reais = Number(bruto);

      setErro(null);
      setOk(null);

      if (!Number.isFinite(reais) || reais <= 0) {
        setErro('Informe um valor maior que zero.');
        return;
      }

      setProcessando(passageiro.id);
      try {
        const { error } = await supabase.rpc('admin_creditar_carteira', {
          p_passageiro_id: passageiro.id,
          p_valor_centavos: paraCentavos(reais),
          p_descricao: 'Credito lancado pela central',
        });
        if (error) throw error;

        setValores((v) => ({ ...v, [passageiro.id]: '' }));
        setOk(`${brl(reais)} creditado para ${passageiro.nome || 'passageiro'}.`);
        await carregar();
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setProcessando(null);
      }
    },
    [valores, carregar],
  );

  if (carregando) return <ActivityIndicator color={colors.primary} style={estilos.spinner} />;

  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>Carteiras dos passageiros</Text>
      <Text style={estilos.nota}>
        Nesta fase o saldo e lancado pela central. A recarga pelo proprio passageiro entra quando
        houver pagamento integrado. Limite de R$ 1.000,00 por lancamento.
      </Text>

      {erro ? (
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}
      {ok ? (
        <View style={estilos.sucesso}>
          <Text style={estilos.sucessoTexto}>{ok}</Text>
        </View>
      ) : null}

      {passageiros.length === 0 ? (
        <Text style={estilos.vazio}>Nenhum passageiro cadastrado ainda.</Text>
      ) : (
        passageiros.map((p) => (
          <View key={p.id} style={[estilos.linhaCartao, shadow(1)]}>
            <View style={estilos.linhaTopo}>
              <Text style={estilos.destino}>{p.nome || 'Sem nome'}</Text>
              <Text style={estilos.valor}>{brl(paraReais(p.saldo_centavos))}</Text>
            </View>
            <Text style={estilos.meta}>
              {formatarCPF(p.cpf)} · {p.telefone || 'sem telefone'}
            </Text>
            <View style={estilos.doisCampos}>
              <Campo
                rotulo="Creditar (R$)"
                value={valores[p.id] ?? ''}
                onChangeText={(t) => setValores((v) => ({ ...v, [p.id]: t }))}
                keyboardType="decimal-pad"
                placeholder="50,00"
                containerStyle={estilos.campoMetade}
              />
              <View style={estilos.campoMetade}>
                <Botao
                  titulo="Lancar credito"
                  onPress={() => creditar(p)}
                  carregando={processando === p.id}
                  style={estilos.botaoCredito}
                />
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Precos e taxa                                                              */
/* -------------------------------------------------------------------------- */

function AbaPrecos() {
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [configs, setConfigs] = useState<ConfiguracaoRow[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, { base: string; km: string }>>({});
  const [taxa, setTaxa] = useState('');
  const [fator, setFator] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [cats, confs] = await Promise.all([
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('configuracoes').select('*'),
    ]);

    setCategorias(cats.data ?? []);
    setConfigs(confs.data ?? []);

    const draft: Record<string, { base: string; km: string }> = {};
    for (const c of cats.data ?? []) {
      draft[c.chave] = {
        base: (c.tarifa_base_centavos / 100).toFixed(2),
        km: (c.preco_km_centavos / 100).toFixed(2),
      };
    }
    setRascunho(draft);

    for (const c of confs.data ?? []) {
      if (c.chave === 'taxa_empresa_percentual') setTaxa(c.valor);
      if (c.chave === 'fator_rota') setFator(c.valor);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(async () => {
    setErro(null);
    setOk(null);
    setSalvando(true);

    try {
      for (const c of categorias) {
        const d = rascunho[c.chave];
        if (!d) continue;

        const base = paraCentavos(Number(d.base.replace(',', '.')));
        const km = paraCentavos(Number(d.km.replace(',', '.')));

        if (!Number.isFinite(base) || !Number.isFinite(km) || base < 0 || km < 0) {
          throw new Error(`Valor invalido em ${c.nome}.`);
        }

        const { error } = await supabase
          .from('categorias')
          .update({
            tarifa_base_centavos: base,
            preco_km_centavos: km,
            atualizado_em: new Date().toISOString(),
          })
          .eq('chave', c.chave);
        if (error) throw error;
      }

      const taxaNum = Number(taxa.replace(',', '.'));

      // O banco tambem recusa, mas avisar aqui evita uma ida ao servidor so
      // para receber "nao pode ficar abaixo de 25%".
      if (!Number.isFinite(taxaNum) || taxaNum > 100) {
        throw new Error('A taxa da empresa precisa ser um numero ate 100.');
      }
      if (taxaNum < TAXA.minimaPercentual) {
        throw new Error(
          `A taxa da ${MARCA.empresa} nao pode ficar abaixo de ${TAXA.minimaPercentual}%.`,
        );
      }

      for (const [chave, valor] of [
        ['taxa_empresa_percentual', String(taxaNum)],
        ['fator_rota', String(Number(fator.replace(',', '.')) || 1.3)],
      ]) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ valor, atualizado_em: new Date().toISOString() })
          .eq('chave', chave);
        if (error) throw error;
      }

      setOk('Salvo. As mudancas valem para as proximas corridas.');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }, [categorias, rascunho, taxa, fator, carregar]);

  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>Precos por categoria</Text>

      {categorias.map((c) => (
        <View key={c.chave} style={[estilos.linhaCartao, shadow(1)]}>
          <Text style={estilos.destino}>{c.nome}</Text>
          <View style={estilos.doisCampos}>
            <Campo
              rotulo="Tarifa base (R$)"
              value={rascunho[c.chave]?.base ?? ''}
              onChangeText={(t) =>
                setRascunho((r) => ({ ...r, [c.chave]: { ...r[c.chave], base: t } }))
              }
              keyboardType="decimal-pad"
              containerStyle={estilos.campoMetade}
            />
            <Campo
              rotulo="Por km (R$)"
              value={rascunho[c.chave]?.km ?? ''}
              onChangeText={(t) =>
                setRascunho((r) => ({ ...r, [c.chave]: { ...r[c.chave], km: t } }))
              }
              keyboardType="decimal-pad"
              containerStyle={estilos.campoMetade}
            />
          </View>
        </View>
      ))}

      <Text style={estilos.secaoTitulo}>Divisao e distancia</Text>

      <View style={[estilos.linhaCartao, shadow(1)]}>
        <Campo
          rotulo={`Taxa da ${MARCA.empresa} (%)`}
          value={taxa}
          onChangeText={setTaxa}
          keyboardType="decimal-pad"
          erro={
            Number(taxa.replace(',', '.')) < TAXA.minimaPercentual
              ? `Minimo de ${TAXA.minimaPercentual}%. Abaixo disso o sistema nao grava.`
              : null
          }
          ajuda={`Com ${taxa || '0'}%, o motorista fica com ${100 - (Number(taxa.replace(',', '.')) || 0)}%. Minimo fixo: ${TAXA.minimaPercentual}%.`}
        />
        <Campo
          rotulo="Fator de rota"
          value={fator}
          onChangeText={setFator}
          keyboardType="decimal-pad"
          ajuda="Multiplica a distancia em linha reta para aproximar o trajeto por rua. 1,3 = 30% a mais."
        />
      </View>

      {erro ? (
        <View style={estilos.alerta}>
          <Text style={estilos.alertaTexto}>{erro}</Text>
        </View>
      ) : null}
      {ok ? (
        <View style={estilos.sucesso}>
          <Text style={estilos.sucessoTexto}>{ok}</Text>
        </View>
      ) : null}

      <Botao titulo="Salvar alteracoes" onPress={salvar} carregando={salvando} />
      <Text style={estilos.nota}>
        A taxa da {MARCA.empresa} tem piso fixo de {TAXA.minimaPercentual}%, travado no banco de
        dados: nenhuma tela e nenhum atalho conseguem gravar abaixo disso. Corridas ja concluidas
        guardam a taxa que valia na hora — mudar o percentual aqui nao reescreve o passado.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Cidades                                                                    */
/* -------------------------------------------------------------------------- */

function AbaCidades() {
  const [cidades, setCidades] = useState<CidadeRow[]>([]);
  const [nome, setNome] = useState('');
  const [uf, setUf] = useState('BA');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('cidades').select('*').order('nome');
    setCidades(data ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = useCallback(async () => {
    setErro(null);
    if (!nome.trim()) return;

    setSalvando(true);
    try {
      const { error } = await supabase
        .from('cidades')
        .insert({ nome: nome.trim(), uf: uf.trim().toUpperCase().slice(0, 2) });
      if (error) throw error;
      setNome('');
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }, [nome, uf, carregar]);

  const alternar = useCallback(
    async (cidade: CidadeRow) => {
      await supabase.from('cidades').update({ ativa: !cidade.ativa }).eq('id', cidade.id);
      await carregar();
    },
    [carregar],
  );

  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>Cidades atendidas</Text>
      <Text style={estilos.nota}>
        Sem limite de quantidade: cadastrar cidade e cadastro, nao configuracao paga.
      </Text>

      <View style={[estilos.linhaCartao, shadow(1)]}>
        <View style={estilos.doisCampos}>
          <Campo
            rotulo="Nome da cidade"
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Serrinha"
            autoCapitalize="words"
            containerStyle={estilos.campoLargo}
          />
          <Campo
            rotulo="UF"
            value={uf}
            onChangeText={setUf}
            maxLength={2}
            autoCapitalize="characters"
            containerStyle={estilos.campoCurto}
          />
        </View>
        {erro ? (
          <View style={estilos.alerta}>
            <Text style={estilos.alertaTexto}>{erro}</Text>
          </View>
        ) : null}
        <Botao titulo="Adicionar cidade" onPress={adicionar} carregando={salvando} />
      </View>

      {cidades.map((c) => (
        <View key={c.id} style={[estilos.linhaCartao, shadow(1)]}>
          <View style={estilos.linhaTopo}>
            <Text style={estilos.destino}>
              {c.nome} / {c.uf}
            </Text>
            <Pressable onPress={() => alternar(c)} accessibilityRole="button" hitSlop={8}>
              <Text style={[estilos.link, !c.ativa && estilos.linkInativo]}>
                {c.ativa ? 'Ativa' : 'Inativa'}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Motoristas                                                                 */
/* -------------------------------------------------------------------------- */

function AbaMotoristas() {
  const [motoristas, setMotoristas] = useState<MotoristaRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('motoristas').select('*').order('criado_em');
    setMotoristas(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alternar = useCallback(
    async (m: MotoristaRow) => {
      await supabase.from('motoristas').update({ ativo: !m.ativo }).eq('id', m.id);
      await carregar();
    },
    [carregar],
  );

  if (carregando) return <ActivityIndicator color={colors.primary} style={estilos.spinner} />;

  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>Motoristas cadastrados</Text>

      {motoristas.length === 0 ? (
        <Text style={estilos.vazio}>Nenhum motorista cadastrado ainda.</Text>
      ) : (
        motoristas.map((m) => (
          <View key={m.id} style={[estilos.linhaCartao, shadow(1)]}>
            <View style={estilos.linhaTopo}>
              <Text style={estilos.destino}>{m.nome || 'Sem nome'}</Text>
              <Pressable onPress={() => alternar(m)} accessibilityRole="button" hitSlop={8}>
                <Text style={[estilos.link, !m.ativo && estilos.linkInativo]}>
                  {m.ativo ? 'Ativo' : 'Inativo'}
                </Text>
              </Pressable>
            </View>
            <Text style={estilos.meta}>
              {formatarCPF(m.cpf)} · {m.telefone || 'sem telefone'}
            </Text>
            <Text style={estilos.meta}>
              {m.veiculo_descricao || 'veiculo nao informado'}{' '}
              {m.veiculo_placa ? `· ${m.veiculo_placa}` : ''}
            </Text>
            <Text style={m.cadastro_completo ? estilos.completo : estilos.incompleto}>
              {m.cadastro_completo
                ? 'Cadastro completo — pode aceitar corridas'
                : 'Cadastro incompleto — faltam fotos ou dados'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

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
  acessoSubtitulo: {
    color: palette.gold300,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  acessoCartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderTopWidth: 4,
    borderTopColor: palette.gold400,
  },
  acessoLink: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  cabecalho: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 3,
    borderBottomColor: palette.gold400,
    gap: spacing.sm,
  },
  cabecalhoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sair: { color: palette.gold300, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  abasScroll: { marginHorizontal: -spacing.lg },
  abas: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  aba: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.navy700,
  },
  abaAtiva: { backgroundColor: palette.gold500 },
  abaTexto: { fontSize: font.size.sm, color: palette.navy100, fontWeight: font.weight.medium },
  abaTextoAtivo: { color: palette.navy900, fontWeight: font.weight.bold },
  conteudo: { padding: spacing.lg, maxWidth: 820, width: '100%', alignSelf: 'center' },
  secao: { gap: spacing.md },
  secaoTitulo: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  spinner: { marginTop: spacing.xl },
  vazio: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  nota: { fontSize: font.size.xs, color: colors.textFaint, lineHeight: 16 },
  form: { gap: spacing.lg },
  linhaCartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  destino: { flex: 1, fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  valor: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.primaryDark },
  meta: { fontSize: font.size.xs, color: colors.textFaint },
  repasse: { fontSize: font.size.xs, color: colors.accentText, fontWeight: font.weight.medium },
  link: { fontSize: font.size.sm, color: colors.secondary, fontWeight: font.weight.semibold },
  linkInativo: { color: colors.textFaint },
  doisCampos: { flexDirection: 'row', gap: spacing.md },
  campoMetade: { flex: 1 },
  botaoCredito: { marginTop: 22 },
  campoLargo: { flex: 3 },
  campoCurto: { flex: 1 },
  totais: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  total: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  totalDestaque: { backgroundColor: colors.accentBg, borderColor: palette.gold300 },
  totalRotulo: { fontSize: font.size.xs, color: colors.textFaint, textTransform: 'uppercase' },
  totalValor: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  totalValorDestaque: { color: colors.primaryDark },
  alertaCartao: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  alertaFaixa: { paddingVertical: spacing.md, alignItems: 'center' },
  alertaFaixaTexto: {
    color: palette.white,
    fontSize: font.size.lg,
    fontWeight: font.weight.heavy,
    letterSpacing: 2,
  },
  alertaCorpo: { padding: spacing.lg, gap: spacing.md },
  alertaHora: { fontSize: font.size.xs, color: colors.textFaint },
  pessoas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pessoa: { flexGrow: 1, minWidth: 150, gap: 2 },
  pessoaRotulo: { fontSize: font.size.xs, color: colors.textFaint, textTransform: 'uppercase' },
  pessoaNome: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  pessoaTel: { fontSize: font.size.sm, color: colors.textMuted },
  localizacao: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 2,
  },
  localizacaoRotulo: { fontSize: font.size.xs, color: colors.textFaint, textTransform: 'uppercase' },
  localizacaoTexto: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  semLocal: { fontSize: font.size.sm, color: colors.warning },
  acoes: { gap: spacing.sm },
  dica: { fontSize: font.size.xs, color: colors.textFaint, textAlign: 'center' },
  audioBloqueado: {
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: palette.gold400,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  audioBloqueadoTexto: { fontSize: font.size.sm, color: colors.text, textAlign: 'center' },
  tranquilo: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tranquiloTitulo: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.success },
  tranquiloTexto: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 19 },
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
  completo: { fontSize: font.size.xs, color: colors.success, fontWeight: font.weight.medium },
  incompleto: { fontSize: font.size.xs, color: colors.warning, fontWeight: font.weight.medium },
  negadoTitulo: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  negadoTexto: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
});
