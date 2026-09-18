/**
 * Teste de fluxo do REDE27 contra o Supabase real, usando a MESMA chave anon
 * que o aplicativo usa. Nada de atalho por service_role: se passar aqui, passa
 * no app.
 *
 * Uso:
 *   node scripts/testar-fluxo.mjs
 *
 * Preparo (uma vez, no SQL Editor do Supabase) — o script avisa se faltar:
 *   1. autorizar a conta de operador na tabela `operadores`;
 *   2. creditar saldo na carteira do passageiro de teste.
 *
 * O script cobre:
 *   - cadastro por CPF criando perfil e carteira automaticamente;
 *   - recusa de chamada sem saldo;
 *   - impossibilidade de o app escrever o proprio saldo;
 *   - isolamento entre passageiros (um nao ve nem mexe na corrida do outro);
 *   - protocolo de 5 passos ponta a ponta;
 *   - debito exato na carteira no passo 5 e registro no extrato.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');

function lerEnv() {
  const arquivo = path.join(raiz, '.env');
  if (!fs.existsSync(arquivo)) {
    console.error('Falta o arquivo .env. Copie .env.example e preencha.');
    process.exit(1);
  }
  return Object.fromEntries(
    fs
      .readFileSync(arquivo, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = lerEnv();
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DOMINIO = 'rede27.app'; // espelha CPF.dominioLogin
const SENHA = 'rede27-teste-2026';

// CPFs sinteticos, validos pelo algoritmo da Receita.
const CONTAS = {
  passageiro: { cpf: '52998224725', nome: 'Passageiro Teste' },
  outro: { cpf: '11144477735', nome: 'Outro Passageiro' },
  operador: { cpf: '12345678909', nome: 'Operador Teste' },
};

const novoCliente = () => createClient(URL, ANON, { auth: { persistSession: false } });
const emailDe = (cpf) => `${cpf}@${DOMINIO}`;
const brl = (centavos) => `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;

let falhas = 0;
function ok(nome, condicao, detalhe = '') {
  console.log(`  ${condicao ? '\x1b[32mOK   \x1b[0m' : '\x1b[31mFALHA\x1b[0m'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!condicao) falhas++;
}
function secao(titulo) {
  console.log(`\n\x1b[1m${titulo}\x1b[0m`);
}

async function conta({ cpf, nome }) {
  const c = novoCliente();
  const email = emailDe(cpf);

  let { data, error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (!error) return { c, uid: data.session.user.id, novo: false };

  ({ data, error } = await c.auth.signUp({
    email,
    password: SENHA,
    options: { data: { cpf, nome, telefone: '27999990000' } },
  }));

  if (error) {
    if (/is invalid/i.test(error.message)) {
      console.error(`\nO Supabase recusou o dominio "${DOMINIO}".`);
      console.error('Troque CPF.dominioLogin em src/config/rede27.config.ts por um dominio que resolva no DNS.');
    } else if (/rate limit/i.test(error.message)) {
      console.error('\nLimite de envio de e-mail atingido.');
      console.error('Desligue "Confirm email" em Authentication -> Sign In / Providers -> Email.');
    }
    throw new Error(`cadastro ${cpf}: ${error.message}`);
  }

  if (!data.session) {
    console.error('\nCadastro criado mas sem sessao: a confirmacao de e-mail ainda esta ligada.');
    console.error('Desligue "Confirm email" em Authentication -> Sign In / Providers -> Email.');
    process.exit(1);
  }

  return { c, uid: data.session.user.id, novo: true };
}

// ---------------------------------------------------------------------------

secao('1. Cadastro por CPF');

const A = await conta(CONTAS.passageiro);
const B = await conta(CONTAS.outro);
const OP = await conta(CONTAS.operador);
ok('tres contas com sessao ativa', Boolean(A.uid && B.uid && OP.uid));

const { data: perfil } = await A.c.from('passageiros').select('*').eq('id', A.uid).maybeSingle();
ok('gatilho criou o perfil com o CPF gravado', perfil?.cpf === CONTAS.passageiro.cpf, `cpf=${perfil?.cpf}`);

const { data: carteira } = await A.c.from('carteiras').select('*').eq('passageiro_id', A.uid).maybeSingle();
ok('gatilho criou a carteira', Boolean(carteira), carteira ? `saldo ${brl(carteira.saldo_centavos)}` : 'sem carteira');

secao('2. Carteira nao e escrita pelo aplicativo');

const escrita = await A.c.from('carteiras').update({ saldo_centavos: 999999 }).eq('id', carteira.id).select();
ok('app nao altera o proprio saldo', (escrita.data?.length ?? 0) === 0,
  escrita.error ? escrita.error.message : `${escrita.data?.length} linha(s) afetada(s)`);

const credito = await A.c.rpc('creditar_carteira', { p_passageiro_id: A.uid, p_valor_centavos: 100000 });
ok('app nao executa creditar_carteira', Boolean(credito.error), credito.error?.message ?? 'passou!');

secao('3. Pre-requisitos do teste');

const saldo = carteira.saldo_centavos;
const { data: cats } = await A.c.from('categorias').select('*').order('ordem');
ok('as 3 categorias estao publicadas', cats?.length === 3, cats?.map((c) => c.nome).join(', '));

const comAr = cats.find((c) => c.chave === 'com_ar');
const custo = comAr.tarifa_base_centavos + Math.round(comAr.preco_km_centavos * 3);

const { data: souOperador } = await OP.c.from('operadores').select('id').eq('id', OP.uid).maybeSingle();

if (!souOperador || saldo < custo) {
  console.log('\n\x1b[33mFalta preparo. Rode no SQL Editor do Supabase:\x1b[0m\n');
  if (!souOperador) {
    console.log(`insert into public.operadores (id, nome)\nvalues ('${OP.uid}', 'Operador Teste')\non conflict (id) do update set ativo = true;\n`);
  }
  if (saldo < custo) {
    console.log(`select public.creditar_carteira('${A.uid}'::uuid, 50000, 'Credito de teste');\n`);
  }
  console.log('Depois rode este script de novo.');
  process.exit(1);
}

ok('conta de operador autorizada', true);
ok('passageiro com saldo suficiente', saldo >= custo, `${brl(saldo)} para uma corrida de ${brl(custo)}`);

secao('4. Abertura da chamada');

// Limpa corrida aberta de uma execucao anterior.
const { data: pendente } = await A.c.from('corridas').select('id').eq('passageiro_id', A.uid).eq('status', 'aberta').maybeSingle();
if (pendente) await A.c.rpc('cancelar_corrida', { p_corrida_id: pendente.id });

const criada = await A.c.rpc('criar_corrida', {
  p_categoria_chave: 'com_ar',
  p_destino_texto: 'Rua das Flores, 120 - Centro',
  p_origem_texto: 'Av. Principal, 50',
  p_distancia_km: 3,
});
ok('chamada criada', !criada.error, criada.error?.message ?? '');
if (criada.error) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }

const corrida = Array.isArray(criada.data) ? criada.data[0] : criada.data;
ok('comeca no passo 1', corrida.passo_atual === 1, `passo ${corrida.passo_atual}`);
ok('preco calculado no servidor', corrida.valor_estimado_centavos === custo,
  `${brl(corrida.valor_estimado_centavos)} (esperado ${brl(custo)})`);

const duplicada = await A.c.rpc('criar_corrida', { p_categoria_chave: 'sem_ar', p_destino_texto: 'Outro lugar' });
ok('nao permite duas chamadas abertas', /em andamento/i.test(duplicada.error?.message ?? ''),
  duplicada.error?.message ?? 'permitiu!');

secao('5. Isolamento entre passageiros');

// Atencao: "0 linhas" tambem acontece quando a consulta falha. Exigimos que a
// leitura funcione E devolva vazio, senao um erro de permissao passa por
// isolamento — foi assim que um bug de RLS quase escapou.
const espiada = await B.c.from('corridas').select('*').eq('id', corrida.id);
ok('outro passageiro nao ve a corrida', !espiada.error && (espiada.data?.length ?? 0) === 0,
  espiada.error ? 'consulta falhou: ' + espiada.error.message : `${espiada.data?.length} linha(s)`);

const invasao = await B.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('outro passageiro nao avanca a corrida alheia', Boolean(invasao.error), invasao.error?.message ?? 'AVANCOU!');

const cancelaAlheia = await B.c.rpc('cancelar_corrida', { p_corrida_id: corrida.id });
ok('outro passageiro nao cancela a corrida alheia', Boolean(cancelaAlheia.error), cancelaAlheia.error?.message ?? 'CANCELOU!');

const proprioAvanco = await A.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('nem o dono avanca o proprio protocolo', Boolean(proprioAvanco.error), proprioAvanco.error?.message ?? 'AVANCOU!');

secao('6. Protocolo de 5 passos pelo painel do operador');

const fila = await OP.c.from('corridas').select('*').eq('status', 'aberta');
ok('operador ve a chamada na fila', !fila.error && (fila.data?.length ?? 0) >= 1,
  fila.error ? 'consulta falhou: ' + fila.error.message : `${fila.data?.length} na fila`);

const passos = ['motorista_aceitou', 'embarque_confirmado', 'em_deslocamento', 'servico_concluido'];
for (let i = 0; i < passos.length; i++) {
  const r = await OP.c.rpc('avancar_protocolo', {
    p_corrida_id: corrida.id,
    p_chave: passos[i],
    p_motorista_nome: 'Motorista Teste',
  });
  const linha = Array.isArray(r.data) ? r.data[0] : r.data;
  ok(`passo ${i + 2} — ${passos[i]}`, !r.error && linha?.passo_atual === i + 2,
    r.error?.message ?? `passo ${linha?.passo_atual}`);
}

secao('7. Encerramento e debito');

const finalR = await A.c.from('corridas').select('*').eq('id', corrida.id).maybeSingle();
const final = finalR.data;
ok('passageiro le a propria corrida', !finalR.error, finalR.error?.message ?? '');
ok('corrida marcada como concluida', final?.status === 'concluida', `status=${final?.status}`);
ok('valor final gravado', final?.valor_final_centavos === custo, brl(final?.valor_final_centavos ?? 0));

const { data: carteiraFinal } = await A.c.from('carteiras').select('*').eq('passageiro_id', A.uid).maybeSingle();
ok('saldo debitado exatamente uma vez', carteiraFinal.saldo_centavos === saldo - custo,
  `${brl(saldo)} - ${brl(custo)} = ${brl(carteiraFinal.saldo_centavos)}`);

const { data: extrato } = await A.c.from('transacoes').select('*').eq('corrida_id', corrida.id);
ok('debito registrado no extrato', extrato?.length === 1 && extrato[0].tipo === 'debito',
  extrato?.map((t) => `${t.tipo} ${brl(t.valor_centavos)}`).join(', ') ?? 'nenhum');

const reavanco = await OP.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('corrida encerrada nao avanca de novo (sem debito duplo)', Boolean(reavanco.error),
  reavanco.error?.message ?? 'AVANCOU!');

const eventosR = await A.c.from('corrida_eventos').select('*').eq('corrida_id', corrida.id).order('passo');
ok('os 5 passos ficaram registrados', !eventosR.error && eventosR.data?.length === 5,
  eventosR.error ? 'consulta falhou: ' + eventosR.error.message : `${eventosR.data?.length} eventos`);

secao('8. Nova chamada apos encerrar');

const novaChamada = await A.c.rpc('criar_corrida', { p_categoria_chave: 'sem_ar', p_destino_texto: 'Teste pos-corrida' });
ok('passageiro pode chamar de novo', !novaChamada.error, novaChamada.error?.message ?? '');
if (!novaChamada.error) {
  const nova = Array.isArray(novaChamada.data) ? novaChamada.data[0] : novaChamada.data;
  await A.c.rpc('cancelar_corrida', { p_corrida_id: nova.id });
}

console.log(
  falhas === 0
    ? '\n\x1b[32mTUDO OK\x1b[0m — fluxo completo validado.\n'
    : `\n\x1b[31m${falhas} FALHA(S)\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
