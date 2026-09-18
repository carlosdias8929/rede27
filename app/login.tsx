import { Redirect, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Logo } from '../src/components/Logo';
import { formatarCPF, somenteDigitos, validarCPF } from '../src/lib/cpf';
import { mensagemDeErro } from '../src/lib/supabase';
import { useSessao } from '../src/state/sessao';
import { colors, font, palette, radius, shadow, spacing } from '../src/theme';

type Modo = 'entrar' | 'cadastrar';

/**
 * TELA 1 — Acesso por CPF.
 * O CPF e validado no aparelho (formato + digitos verificadores) antes de
 * qualquer chamada de rede, entao erro de digitacao nao vira erro de servidor.
 */
export default function Login() {
  const { session, papel, entrar, cadastrar } = useSessao();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState<Modo>('entrar');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cpfCompleto = somenteDigitos(cpf).length === 11;
  const cpfOk = useMemo(() => cpfCompleto && validarCPF(cpf).ok, [cpf, cpfCompleto]);

  const aoDigitarCPF = useCallback((texto: string) => {
    setCpf(formatarCPF(texto));
    setErroCpf(null);
    setErroGeral(null);
  }, []);

  // Valida assim que os 11 digitos estao completos, sem esperar o envio.
  const aoSairDoCPF = useCallback(() => {
    if (!cpf) return;
    const check = validarCPF(cpf);
    setErroCpf(check.ok ? null : check.erro);
  }, [cpf]);

  const enviar = useCallback(async () => {
    setErroGeral(null);

    const check = validarCPF(cpf);
    if (!check.ok) {
      setErroCpf(check.erro);
      return;
    }

    setEnviando(true);
    try {
      if (modo === 'entrar') {
        await entrar(cpf, senha);
      } else {
        await cadastrar({ cpf, senha, nome, telefone });
      }
      // A navegacao acontece sozinha: o provider recebe a sessao nova.
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
    } finally {
      setEnviando(false);
    }
  }, [cadastrar, cpf, entrar, modo, nome, senha, telefone]);

  if (session) {
    if (papel === 'motorista') return <Redirect href="/motorista" />;
    if (papel === 'admin') return <Redirect href="/admin" />;
    return <Redirect href="/inicio" />;
  }

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          estilos.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.topo}>
          <Logo tamanho="lg" sobreEscuro mostrarSlogan />
        </View>

        <View style={[estilos.cartao, shadow(3)]}>
          <Text style={estilos.titulo}>
            {modo === 'entrar' ? 'Acesse a sua conta' : 'Criar cadastro'}
          </Text>
          <Text style={estilos.subtitulo}>
            {modo === 'entrar'
              ? 'Entre com o seu CPF para chamar um servico.'
              : 'Preencha os dados para abrir a sua conta na REDE27.'}
          </Text>

          <View style={estilos.formulario}>
            <Campo
              rotulo="CPF"
              value={cpf}
              onChangeText={aoDigitarCPF}
              onBlur={aoSairDoCPF}
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              maxLength={14}
              autoComplete="off"
              erro={erroCpf}
              ajuda={cpfOk ? 'CPF valido.' : 'Digite os 11 numeros do seu CPF.'}
              textContentType="none"
            />

            {modo === 'cadastrar' ? (
              <>
                <Campo
                  rotulo="Nome completo"
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Como devemos te chamar"
                  autoCapitalize="words"
                  autoComplete="name"
                />
                <Campo
                  rotulo="Telefone (WhatsApp)"
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={16}
                />
              </>
            ) : null}

            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={(t) => {
                setSenha(t);
                setErroGeral(null);
              }}
              placeholder={modo === 'cadastrar' ? 'Minimo de 6 caracteres' : 'Sua senha'}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              onSubmitEditing={enviar}
              returnKeyType="go"
              acessorio={
                <Pressable
                  onPress={() => setMostrarSenha((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  hitSlop={10}
                >
                  <Text style={estilos.mostrarSenha}>{mostrarSenha ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              }
            />

            {erroGeral ? (
              <View style={estilos.alerta} accessibilityLiveRegion="polite">
                <Text style={estilos.alertaTexto}>{erroGeral}</Text>
              </View>
            ) : null}

            <Botao
              titulo={modo === 'entrar' ? 'Entrar' : 'Criar cadastro'}
              onPress={enviar}
              carregando={enviando}
              desabilitado={!cpfCompleto || senha.length === 0}
            />

            <Pressable
              onPress={() => {
                setModo((m) => (m === 'entrar' ? 'cadastrar' : 'entrar'));
                setErroGeral(null);
              }}
              accessibilityRole="button"
              style={estilos.alternar}
              hitSlop={8}
            >
              <Text style={estilos.alternarTexto}>
                {modo === 'entrar'
                  ? 'Ainda nao tem cadastro? Criar conta'
                  : 'Ja tenho cadastro. Entrar'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={estilos.paineis}>
          <Pressable onPress={() => router.push('/motorista')} accessibilityRole="button" hitSlop={8}>
            <Text style={estilos.painelLink}>Sou motorista</Text>
          </Pressable>
          <Text style={estilos.painelSeparador}>·</Text>
          <Pressable onPress={() => router.push('/admin')} accessibilityRole="button" hitSlop={8}>
            <Text style={estilos.painelLink}>Painel Admin</Text>
          </Pressable>
        </View>

        <Text style={estilos.rodape}>
          REDE27 — transporte de passageiros, bens e encomendas.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.primaryDark },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  topo: { alignItems: 'center', gap: spacing.sm },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    borderTopWidth: 4,
    borderTopColor: palette.gold400,
  },
  titulo: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
  },
  subtitulo: { fontSize: font.size.sm, color: colors.textMuted },
  formulario: { gap: spacing.lg, marginTop: spacing.lg },
  mostrarSenha: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.secondary,
  },
  alerta: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  alertaTexto: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.weight.medium },
  alternar: { alignSelf: 'center', paddingVertical: spacing.sm },
  alternarTexto: {
    fontSize: font.size.sm,
    color: colors.secondary,
    fontWeight: font.weight.semibold,
  },
  paineis: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  painelLink: {
    color: palette.gold300,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  painelSeparador: { color: palette.navy100 },
  rodape: {
    textAlign: 'center',
    fontSize: font.size.xs,
    color: palette.navy100,
  },
});
