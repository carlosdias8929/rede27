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
import type { CarteiraRow, PassageiroRow } from '../types/database';

type Estado = {
  carregando: boolean;
  session: Session | null;
  passageiro: PassageiroRow | null;
  carteira: CarteiraRow | null;
};

type Acoes = {
  entrar: (cpf: string, senha: string) => Promise<void>;
  cadastrar: (dados: {
    cpf: string;
    senha: string;
    nome: string;
    telefone: string;
  }) => Promise<void>;
  sair: () => Promise<void>;
  recarregarCarteira: () => Promise<void>;
};

const SessaoContext = createContext<(Estado & Acoes) | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({
    carregando: true,
    session: null,
    passageiro: null,
    carteira: null,
  });

  // Evita setState depois que o provider sai da arvore.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carregarPerfil = useCallback(async (session: Session | null) => {
    if (!session) {
      if (montado.current) {
        setEstado({ carregando: false, session: null, passageiro: null, carteira: null });
      }
      return;
    }

    const [perfil, carteira] = await Promise.all([
      supabase.from('passageiros').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('carteiras').select('*').eq('passageiro_id', session.user.id).maybeSingle(),
    ]);

    if (!montado.current) return;

    setEstado({
      carregando: false,
      session,
      passageiro: perfil.data ?? null,
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
    async ({
      cpf,
      senha,
      nome,
      telefone,
    }: {
      cpf: string;
      senha: string;
      nome: string;
      telefone: string;
    }) => {
      const check = validarCPF(cpf);
      if (!check.ok) throw new Error(check.erro);
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (!nome.trim()) throw new Error('Informe o seu nome.');

      const { error } = await supabase.auth.signUp({
        email: emailDoCPF(check.cpf),
        password: senha,
        options: {
          // O gatilho handle_new_user le estes campos para criar perfil e carteira.
          data: {
            cpf: check.cpf,
            nome: nome.trim(),
            telefone: somenteDigitos(telefone),
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
    () => ({ ...estado, entrar, cadastrar, sair, recarregarCarteira }),
    [estado, entrar, cadastrar, sair, recarregarCarteira],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return ctx;
}
