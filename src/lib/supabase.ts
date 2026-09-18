import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { CPF } from '../config/rede27.config';
import type { Database } from '../types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Sem as chaves o app nao sobe. Falhar aqui, cedo e com mensagem clara,
 * evita erros silenciosos de rede depois.
 */
export const supabaseConfigurado = Boolean(url && anonKey);

if (!supabaseConfigurado && __DEV__) {
  console.warn(
    '[REDE27] Faltam EXPO_PUBLIC_SUPABASE_URL e/ou EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copie .env.example para .env e preencha.',
  );
}

export const supabase = createClient<Database>(url || 'http://localhost', anonKey || 'anon', {
  auth: {
    // Na web o proprio supabase-js usa localStorage; no Android usamos AsyncStorage.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Sem OAuth por link no MVP: nao ha nada para ler da URL.
    detectSessionInUrl: false,
  },
});

/**
 * O login e por CPF, mas o Supabase Auth trabalha com e-mail.
 * Cada CPF vira um endereco interno estavel — o passageiro nunca ve isso.
 * O dominio fica em CPF.dominioLogin (src/config/rede27.config.ts).
 */
export function emailDoCPF(cpfSomenteDigitos: string): string {
  return `${cpfSomenteDigitos}@${CPF.dominioLogin}`;
}

/** Traduz os erros do Supabase para o texto que o passageiro deve ler. */
export function mensagemDeErro(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro ?? '');

  const mapa: Array<[RegExp, string]> = [
    [/invalid login credentials/i, 'CPF ou senha incorretos.'],
    [/user already registered|already been registered/i, 'Este CPF ja possui cadastro. Faca login.'],
    [/duplicate key.*passageiros_cpf/i, 'Este CPF ja possui cadastro. Faca login.'],
    [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/email rate limit|over_request_rate_limit|too many requests/i,
      'Muitas tentativas seguidas. Aguarde um instante e tente de novo.'],
    // Configuracao do projeto, nao erro do passageiro: dominio de login recusado
    // pelo Supabase ou confirmacao de e-mail ainda ligada.
    [/email address .* is invalid|email_address_invalid/i,
      'Cadastro indisponivel no momento. Avise o suporte da REDE BRASIL.'],
    [/failed to fetch|network request failed/i,
      'Sem conexao com o servidor. Verifique a internet e tente de novo.'],
    [/sessao expirada/i, 'Sessao expirada. Entre novamente.'],
  ];

  for (const [padrao, texto] of mapa) {
    if (padrao.test(bruto)) return texto;
  }

  // Mensagens levantadas pelas nossas funcoes do banco ja vem em portugues.
  return bruto || 'Nao foi possivel completar a operacao. Tente novamente.';
}
