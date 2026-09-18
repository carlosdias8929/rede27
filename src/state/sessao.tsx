import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { emailDoCPF, mensagemDeErro, supabase } from '../lib/supabase';
import { somenteDigitos, validarCPF } from '../lib/cpf';
import type { CarteiraRow, MotoristaRow, PassageiroRow } from '../types/database';

/**
 * Um usuario e uma coisa so: passageiro, motorista ou administrador.
 * O papel nao vem do aplicativo — e descoberto pelas tabelas, que sao a fonte
 * da verdade e as mesmas que as policies consultam.
 */
export type Papel = 'passageiro' | 'motorista' | 'admin';

type Estado = {
  carregando: boolean;
  session: Session | null;
  papel: Papel | null;
  passageiro: PassageiroRow | null;
  motorista: MotoristaRow | null;
  carteira: CarteiraRow | null;
};

type DadosCadastro = {
  cpf: string;
  senha: string;
  nome: string;
  telefone: string;
  papel?: Extract<Papel, 'passageiro' | 'motorista'>;
};

type Acoes = {
  entrar: (cpf: string, senha: string) => Promise<void>;
  cadastrar: (dados: DadosCadastro) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  /** Mantido para as telas do passageiro que so precisam do saldo. */
  recarregarCarteira: () => Promise<void>;
};

const SessaoContext = createContext<(Estado & Acoes) | null>(null);

const ESTADO_VAZIO: Estado = {
  carregando: false,
  session: null,
  papel: null,
  passageiro: null,
  motorista: null,
  carteira: null,
};

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ ...ESTADO_VAZIO, carregando: true });

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carregarPerfil = useCallback(async (session: Session | null) => {
    if (!session) {
      if (montado.current) setEstado({ ...ESTADO_VAZIO });
      return;
    }

    const uid = session.user.id;

    const [passageiro, motorista, admin, carteira] = await Promise.all([
      supabase.from('passageiros').select('*').eq('id', uid).maybeSingle(),
      supabase.from('motoristas').select('*').eq('id', uid).maybeSingle(),
      supabase.from('administradores').select('id').eq('id', uid).maybeSingle(),
      supabase.from('carteiras').select('*').eq('passageiro_id', uid).maybeSingle(),
    ]);

    if (!montado.current) return;

    // Admin tem precedencia: uma conta de administracao que tambem seja
    // passageiro deve cair no painel, nao na tela de chamar corrida.
    const papel: Papel | null = admin.data
      ? 'admin'
      : motorista.data
        ? 'motorista'
        : passageiro.data
          ? 'passageiro'
          : null;

    setEstado({
      carregando: false,
      session,
      papel,
      passageiro: passageiro.data ?? null,
      motorista: motorista.data ?? null,
      carteira: carteira.data ?? null,
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => carregarPerfil(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      carregarPerfil(session);
    });

    return () => sub.subscription.unsubscribe();
  }, [carregarPerfil]);

  const entrar = useCallback(async (cpf: string, senha: string) => {
    const check = validarCPF(cpf);
    if (!check.ok) throw new Error(check.erro);
    if (!senha) throw new Error('Informe a sua senha.');

    const { error } = await supabase.auth.signInWithPassword({
      email: emailDoCPF(check.cpf),
      password: senha,
    });

    if (error) throw new Error(mensagemDeErro(error));
  }, []);

  const cadastrar = useCallback(
    async ({ cpf, senha, nome, telefone, papel = 'passageiro' }: DadosCadastro) => {
      const check = validarCPF(cpf);
      if (!check.ok) throw new Error(check.erro);
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (!nome.trim()) throw new Error('Informe o seu nome.');

      const { error } = await supabase.auth.signUp({
        email: emailDoCPF(check.cpf),
        password: senha,
        options: {
          // O gatilho handle_new_user le `papel` para saber em qual tabela criar.
          data: {
            cpf: check.cpf,
            nome: nome.trim(),
            telefone: somenteDigitos(telefone),
            papel,
          },
        },
      });

      if (error) throw new Error(mensagemDeErro(error));
    },
    [],
  );

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await carregarPerfil(data.session);
  }, [carregarPerfil]);

  const recarregarCarteira = useCallback(async () => {
    const uid = estado.session?.user.id;
    if (!uid) return;

    const { data } = await supabase
      .from('carteiras')
      .select('*')
      .eq('passageiro_id', uid)
      .maybeSingle();

    if (montado.current && data) {
      setEstado((anterior) => ({ ...anterior, carteira: data }));
    }
  }, [estado.session?.user.id]);

  const valor = useMemo(
    () => ({ ...estado, entrar, cadastrar, sair, recarregar, recarregarCarteira }),
    [estado, entrar, cadastrar, sair, recarregar, recarregarCarteira],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return ctx;
}
