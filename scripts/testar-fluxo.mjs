/**
 * Teste de fluxo do REDE27 contra o Supabase real, usando a MESMA chave anon
 * que os aplicativos usam. Nada de atalho por service_role: se passar aqui,
 * passa no app.
 *
 *   node scripts/testar-fluxo.mjs
 *
 * Cobre:
 *   - cadastro por CPF criando passageiro OU motorista, conforme o papel;
 *   - motorista sem as duas fotos NAO consegue aceitar corrida;
 *   - carteira: o app nao escreve saldo e nao chama a funcao de credito;
 *   - corrida com preco por km calculado no servidor;
 *   - isolamento: passageiro nao ve nem mexe na corrida alheia;
 *   - ciclo de 5 passos ate o debito, com rateio empresa/motorista;
 *   - protocolo 03: passageiro aciona, so o Admin avanca e encerra, e o
 *     motorista nao enxerga o alerta.
 *
 * O script avisa o que falta preparar e imprime o SQL pronto.
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

const CONTAS = {
  passageiro: { cpf: '52998224725', nome: 'Passageiro Teste', papel: 'passageiro' },
  outro: { cpf: '11144477735', nome: 'Outro Passageiro', papel: 'passageiro' },
  admin: { cpf: '12345678909', nome: 'Admin Teste', papel: 'passageiro' },
  motorista: { cpf: '15350946056', nome: 'Motorista Teste', papel: 'motorista' },
  motorista2: { cpf: '39053344705', nome: 'Motorista Dois', papel: 'motorista' },
};

const novoCliente = () => createClient(URL, ANON, { auth: { persistSession: false } });
const emailDe = (cpf) => `${cpf}@${DOMINIO}`;
const brl = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

let falhas = 0;
function ok(nome, condicao, detalhe = '') {
  console.log(
    `  ${condicao ? '\x1b[32mOK   \x1b[0m' : '\x1b[31mFALHA\x1b[0m'} ${nome}${detalhe ? ' — ' + detalhe : ''}`,
  );
  if (!condicao) falhas++;
}
const secao = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function conta({ cpf, nome, papel }) {
  const c = novoCliente();
  const email = emailDe(cpf);

  let { data, error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (!error) return { c, uid: data.session.user.id };

  ({ data, error } = await c.auth.signUp({
    email,
    password: SENHA,
    options: { data: { cpf, nome, telefone: '27999990000', papel } },
  }));

  if (error) {
    if (/is invalid/i.test(error.message)) {
      console.error(`\nO Supabase recusou o dominio "${DOMINIO}". Troque CPF.dominioLogin.`);
    } else if (/rate limit/i.test(error.message)) {
      console.error('\nDesligue "Confirm email" em Authentication -> Sign In / Providers -> Email.');
    }
    throw new Error(`cadastro ${cpf}: ${error.message}`);
  }

  if (!data.session) {
    console.error('\nSem sessao apos o cadastro: a confirmacao de e-mail ainda esta ligada.');
    process.exit(1);
  }

  return { c, uid: data.session.user.id };
}

// ---------------------------------------------------------------------------

secao('1. Cadastro por papel');

const A = await conta(CONTAS.passageiro);
const B = await conta(CONTAS.outro);
const ADM = await conta(CONTAS.admin);
const MOT = await conta(CONTAS.motorista);
const MOT2 = await conta(CONTAS.motorista2);
ok('cinco contas com sessao', Boolean(A.uid && B.uid && ADM.uid && MOT.uid && MOT2.uid));

const perfilA = await A.c.from('passageiros').select('*').eq('id', A.uid).maybeSingle();
ok('passageiro criado com CPF', perfilA.data?.cpf === CONTAS.passageiro.cpf, `cpf=${perfilA.data?.cpf}`);

const perfilM = await MOT.c.from('motoristas').select('*').eq('id', MOT.uid).maybeSingle();
ok('motorista criado na tabela certa', Boolean(perfilM.data), perfilM.error?.message ?? '');

const motoristaSemCarteira = await MOT.c
  .from('passageiros')
  .select('id')
  .eq('id', MOT.uid)
  .maybeSingle();
ok('motorista NAO virou passageiro', !motoristaSemCarteira.data, 'papeis separados');

const carteiraR = await A.c.from('carteiras').select('*').eq('passageiro_id', A.uid).maybeSingle();
ok('carteira criada para o passageiro', Boolean(carteiraR.data));
const carteira = carteiraR.data;

secao('2. Carteira nao e escrita pelo aplicativo');

const escrita = await A.c
  .from('carteiras')
  .update({ saldo_centavos: 999999 })
  .eq('id', carteira.id)
  .select();
ok(
  'app nao altera o proprio saldo',
  (escrita.data?.length ?? 0) === 0,
  escrita.error ? escrita.error.message : `${escrita.data?.length} linha(s)`,
);

const credito = await A.c.rpc('creditar_carteira', {
  p_passageiro_id: A.uid,
  p_valor_centavos: 100000,
});
ok('app nao executa creditar_carteira', Boolean(credito.error), credito.error?.message ?? 'passou!');

secao('3. Fotos obrigatorias do motorista');

const semFoto = await MOT.c
  .from('motoristas')
  .update({ foto_perfil_url: null, foto_veiculo_url: null })
  .eq('id', MOT.uid)
  .select()
  .maybeSingle();
ok('motorista pode limpar as proprias fotos', !semFoto.error, semFoto.error?.message ?? '');
ok('banco marca cadastro incompleto', semFoto.data?.cadastro_completo === false);

secao('4. Pre-requisitos');

const catsR = await A.c.from('categorias').select('*').order('ordem');
ok('categorias publicadas', (catsR.data?.length ?? 0) >= 3, catsR.data?.map((c) => c.nome).join(', '));

const comAr = catsR.data.find((c) => c.chave === 'com_ar');
const ehAdmin = await ADM.c.from('administradores').select('id').eq('id', ADM.uid).maybeSingle();
const saldo = carteira.saldo_centavos;

if (!ehAdmin.data || saldo < 5000) {
  console.log('\n\x1b[33mFalta preparo. Rode no SQL Editor do Supabase:\x1b[0m\n');
  if (!ehAdmin.data) {
    console.log(
      `insert into public.administradores (id, nome)\nvalues ('${ADM.uid}', 'Admin Teste')\non conflict (id) do update set ativo = true;\n`,
    );
  }
  if (saldo < 5000) {
    console.log(`select public.creditar_carteira('${A.uid}'::uuid, 50000, 'Credito de teste');\n`);
  }
  console.log('Depois rode este script de novo.');
  process.exit(1);
}

ok('conta de administrador autorizada', true);
ok('passageiro com saldo', saldo >= 5000, brl(saldo));

secao('5. Corrida com preco por km');

const pendente = await A.c
  .from('corridas')
  .select('id')
  .eq('passageiro_id', A.uid)
  .eq('status', 'aberta')
  .maybeSingle();
if (pendente.data) await A.c.rpc('cancelar_corrida', { p_corrida_id: pendente.data.id });

// Dois pontos em Feira de Santana, ~2,5 km em linha reta.
const ORIGEM = { lat: -12.2664, lng: -38.9663 };
const DESTINO = { lat: -12.25, lng: -38.95 };

const criada = await A.c.rpc('criar_corrida', {
  p_categoria_chave: 'com_ar',
  p_destino_texto: 'Av. Getulio Vargas, 27 - Centro',
  p_origem_texto: 'Minha localizacao',
  p_origem_lat: ORIGEM.lat,
  p_origem_lng: ORIGEM.lng,
  p_destino_lat: DESTINO.lat,
  p_destino_lng: DESTINO.lng,
  p_cidade_id: null,
});
ok('chamada criada', !criada.error, criada.error?.message ?? '');
if (criada.error) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}

const corrida = Array.isArray(criada.data) ? criada.data[0] : criada.data;
ok('comeca no passo 1 e sem motorista', corrida.passo_atual === 1 && !corrida.motorista_id);
ok(
  'distancia calculada a partir das coordenadas',
  Number(corrida.distancia_km) > 2 && Number(corrida.distancia_km) < 6,
  `${corrida.distancia_km} km`,
);

const esperado =
  comAr.tarifa_base_centavos + Math.round(comAr.preco_km_centavos * Number(corrida.distancia_km));
ok(
  'preco = base + km, calculado no servidor',
  corrida.valor_estimado_centavos === esperado,
  `${brl(corrida.valor_estimado_centavos)} (esperado ${brl(esperado)})`,
);
ok('taxa da empresa gravada na corrida', Number(corrida.taxa_empresa_percentual) > 0, `${corrida.taxa_empresa_percentual}%`);

secao('6. Motorista sem fotos nao aceita');

const aceiteSemFoto = await MOT.c.rpc('aceitar_corrida', { p_corrida_id: corrida.id });
ok(
  'aceite bloqueado por cadastro incompleto',
  /Complete o cadastro/i.test(aceiteSemFoto.error?.message ?? ''),
  aceiteSemFoto.error?.message ?? 'ACEITOU!',
);

// Preenche as fotos com URLs sinteticas: o teste valida a regra, nao o upload.
await MOT.c
  .from('motoristas')
  .update({
    foto_perfil_url: 'https://exemplo.invalido/perfil.jpg',
    foto_veiculo_url: 'https://exemplo.invalido/veiculo.jpg',
    veiculo_descricao: 'Fiat Uno branco',
    veiculo_placa: 'ABC1D23',
  })
  .eq('id', MOT.uid);

const completo = await MOT.c.from('motoristas').select('*').eq('id', MOT.uid).maybeSingle();
ok('cadastro fica completo com as duas fotos', completo.data?.cadastro_completo === true);

secao('7. Isolamento');

const espiada = await B.c.from('corridas').select('*').eq('id', corrida.id);
ok(
  'outro passageiro nao ve a corrida',
  !espiada.error && (espiada.data?.length ?? 0) === 0,
  espiada.error ? 'consulta falhou: ' + espiada.error.message : `${espiada.data?.length} linha(s)`,
);

const invasao = await B.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('outro passageiro nao avanca corrida alheia', Boolean(invasao.error), invasao.error?.message ?? 'AVANCOU!');

const donoAvanca = await A.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('nem o dono avanca a propria corrida', Boolean(donoAvanca.error), donoAvanca.error?.message ?? 'AVANCOU!');

secao('8. Ciclo de 5 passos pelo motorista');

const aceite = await MOT.c.rpc('aceitar_corrida', { p_corrida_id: corrida.id });
const aceita = Array.isArray(aceite.data) ? aceite.data[0] : aceite.data;
ok('motorista aceita e vai ao passo 2', !aceite.error && aceita?.passo_atual === 2, aceite.error?.message ?? '');

// O segundo motorista precisa estar apto: se ele fosse barrado por cadastro
// incompleto ou por nao ser motorista, o teste passaria pelo motivo errado e
// nao provaria nada sobre corrida ja aceita.
await MOT2.c
  .from('motoristas')
  .update({
    foto_perfil_url: 'https://exemplo.invalido/perfil2.jpg',
    foto_veiculo_url: 'https://exemplo.invalido/veiculo2.jpg',
  })
  .eq('id', MOT2.uid);

const apto2 = await MOT2.c.from('motoristas').select('cadastro_completo').eq('id', MOT2.uid).maybeSingle();
ok('segundo motorista esta apto a aceitar', apto2.data?.cadastro_completo === true);

const roubo = await MOT2.c.rpc('aceitar_corrida', { p_corrida_id: corrida.id });
ok(
  'outro motorista nao rouba corrida ja aceita',
  /ja aceitou|nao esta mais aguardando/i.test(roubo.error?.message ?? ''),
  roubo.error?.message ?? 'ROUBOU!',
);

const avancoAlheio = await MOT2.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok(
  'outro motorista nao avanca corrida alheia',
  /Sem permissao/i.test(avancoAlheio.error?.message ?? ''),
  avancoAlheio.error?.message ?? 'AVANCOU!',
);

for (const [i, chave] of ['embarque_confirmado', 'em_deslocamento', 'servico_concluido'].entries()) {
  const r = await MOT.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id, p_chave: chave });
  const linha = Array.isArray(r.data) ? r.data[0] : r.data;
  ok(`passo ${i + 3} — ${chave}`, !r.error && linha?.passo_atual === i + 3, r.error?.message ?? '');
}

secao('9. Debito e repasse');

const finalR = await A.c.from('corridas').select('*').eq('id', corrida.id).maybeSingle();
const fim = finalR.data;
ok('passageiro le a propria corrida', !finalR.error, finalR.error?.message ?? '');
ok('corrida concluida', fim?.status === 'concluida', `status=${fim?.status}`);

const carteiraFim = await A.c.from('carteiras').select('*').eq('passageiro_id', A.uid).maybeSingle();
ok(
  'saldo debitado uma unica vez',
  carteiraFim.data.saldo_centavos === saldo - corrida.valor_estimado_centavos,
  `${brl(saldo)} - ${brl(corrida.valor_estimado_centavos)} = ${brl(carteiraFim.data.saldo_centavos)}`,
);

const empresa = fim?.valor_empresa_centavos ?? 0;
const domotorista = fim?.valor_motorista_centavos ?? 0;
ok(
  'rateio fecha com o valor da corrida',
  empresa + domotorista === fim?.valor_final_centavos,
  `REDE27 ${brl(empresa)} + motorista ${brl(domotorista)} = ${brl(fim?.valor_final_centavos ?? 0)}`,
);
ok(
  'percentual da empresa respeitado',
  Math.abs(empresa - Math.round((fim.valor_final_centavos * Number(fim.taxa_empresa_percentual)) / 100)) <= 1,
  `${fim?.taxa_empresa_percentual}%`,
);

const reavanco = await MOT.c.rpc('avancar_protocolo', { p_corrida_id: corrida.id });
ok('corrida encerrada nao avanca de novo', Boolean(reavanco.error), reavanco.error?.message ?? 'AVANCOU!');

secao('10. Protocolo 03');

const acionamento = await A.c.rpc('acionar_03', {
  p_corrida_id: corrida.id,
  p_latitude: ORIGEM.lat,
  p_longitude: ORIGEM.lng,
  p_precisao_m: 12.5,
});
const alerta = Array.isArray(acionamento.data) ? acionamento.data[0] : acionamento.data;
ok('passageiro aciona o 03', !acionamento.error && Boolean(alerta?.id), acionamento.error?.message ?? '');
ok('com GPS o alerta nasce no passo 2', alerta?.passo_atual === 2, `passo ${alerta?.passo_atual}`);

const repetido = await A.c.rpc('acionar_03', {
  p_corrida_id: corrida.id,
  p_latitude: ORIGEM.lat,
  p_longitude: ORIGEM.lng,
});
const mesmo = Array.isArray(repetido.data) ? repetido.data[0] : repetido.data;
ok('segurar de novo nao duplica o alerta', mesmo?.id === alerta?.id);

const motoristaEspia = await MOT.c.from('alertas_03').select('*').eq('id', alerta.id);
ok(
  'motorista NAO enxerga o alerta (silencioso)',
  !motoristaEspia.error && (motoristaEspia.data?.length ?? 0) === 0,
  motoristaEspia.error ? motoristaEspia.error.message : `${motoristaEspia.data?.length} linha(s)`,
);

const passageiroEncerra = await A.c.rpc('encerrar_03', { p_alerta_id: alerta.id });
ok('passageiro nao encerra o proprio alerta', Boolean(passageiroEncerra.error), passageiroEncerra.error?.message ?? 'ENCERROU!');

const adminVe = await ADM.c.from('alertas_03').select('*').eq('status', 'ativo');
ok('admin ve o alerta ativo', !adminVe.error && (adminVe.data?.length ?? 0) >= 1, adminVe.error?.message ?? '');

// O passo 4 e ligar para quem pediu socorro. Sem nome e telefone na tela, o
// alerta nao serve — e essa leitura depende de policy propria para o Admin.
const contatoP = await ADM.c.from('passageiros').select('nome, telefone').eq('id', A.uid).maybeSingle();
ok(
  'admin le nome e telefone do passageiro',
  !contatoP.error && Boolean(contatoP.data?.telefone),
  contatoP.error ? contatoP.error.message : `${contatoP.data?.nome} / ${contatoP.data?.telefone}`,
);

const contatoM = await ADM.c.from('motoristas').select('nome, telefone').eq('id', MOT.uid).maybeSingle();
ok(
  'admin le nome e telefone do motorista',
  !contatoM.error && Boolean(contatoM.data?.telefone),
  contatoM.error ? contatoM.error.message : `${contatoM.data?.nome} / ${contatoM.data?.telefone}`,
);

const passageiroEspiaOutro = await A.c.from('passageiros').select('*').eq('id', B.uid);
ok(
  'passageiro comum NAO le dados de outro passageiro',
  !passageiroEspiaOutro.error && (passageiroEspiaOutro.data?.length ?? 0) === 0,
  passageiroEspiaOutro.error ? passageiroEspiaOutro.error.message : `${passageiroEspiaOutro.data?.length} linha(s)`,
);

const p3 = await ADM.c.rpc('registrar_passo_03', {
  p_alerta_id: alerta.id,
  p_passo: 3,
  p_chave: 'alerta_exibido',
});
ok('admin registra o passo 3', !p3.error, p3.error?.message ?? '');

const p4 = await ADM.c.rpc('registrar_passo_03', {
  p_alerta_id: alerta.id,
  p_passo: 4,
  p_chave: 'contato_realizado',
  p_detalhe: 'Ligacao para o passageiro',
});
const apos4 = Array.isArray(p4.data) ? p4.data[0] : p4.data;
ok('admin registra o contato (passo 4)', !p4.error && apos4?.passo_atual === 4, p4.error?.message ?? '');

const voltar = await ADM.c.rpc('registrar_passo_03', {
  p_alerta_id: alerta.id,
  p_passo: 3,
  p_chave: 'alerta_exibido',
});
const aposVoltar = Array.isArray(voltar.data) ? voltar.data[0] : voltar.data;
ok('o passo nunca anda para tras', aposVoltar?.passo_atual === 4, `passo ${aposVoltar?.passo_atual}`);

const encerra = await ADM.c.rpc('encerrar_03', {
  p_alerta_id: alerta.id,
  p_observacao: 'Teste automatizado',
});
const encerrado = Array.isArray(encerra.data) ? encerra.data[0] : encerra.data;
ok('admin encerra no passo 5', !encerra.error && encerrado?.status === 'encerrado' && encerrado?.passo_atual === 5, encerra.error?.message ?? '');

const eventos = await ADM.c.from('alerta_03_eventos').select('*').eq('alerta_id', alerta.id);
ok('historico do 03 registrado', (eventos.data?.length ?? 0) >= 4, `${eventos.data?.length} eventos`);

secao('11. Admin edita precos e cidades');

const precoAntes = comAr.tarifa_base_centavos;
const mudaPreco = await ADM.c
  .from('categorias')
  .update({ tarifa_base_centavos: precoAntes + 100 })
  .eq('chave', 'com_ar')
  .select()
  .maybeSingle();
ok('admin edita preco', !mudaPreco.error && mudaPreco.data?.tarifa_base_centavos === precoAntes + 100, mudaPreco.error?.message ?? '');

await ADM.c.from('categorias').update({ tarifa_base_centavos: precoAntes }).eq('chave', 'com_ar');

const passageiroEdita = await A.c
  .from('categorias')
  .update({ tarifa_base_centavos: 1 })
  .eq('chave', 'com_ar')
  .select();
ok(
  'passageiro NAO edita preco',
  (passageiroEdita.data?.length ?? 0) === 0,
  passageiroEdita.error ? passageiroEdita.error.message : `${passageiroEdita.data?.length} linha(s)`,
);

const nomeCidade = `Cidade Teste ${Date.now().toString().slice(-5)}`;
const novaCidade = await ADM.c.from('cidades').insert({ nome: nomeCidade, uf: 'BA' }).select().maybeSingle();
ok('admin cadastra cidade (sem limite)', !novaCidade.error, novaCidade.error?.message ?? '');
if (novaCidade.data) await ADM.c.from('cidades').delete().eq('id', novaCidade.data.id);

const passageiroCidade = await A.c.from('cidades').insert({ nome: 'Invasao', uf: 'BA' }).select();
ok('passageiro NAO cadastra cidade', Boolean(passageiroCidade.error) || (passageiroCidade.data?.length ?? 0) === 0);

secao('12. Piso de 25% na taxa da empresa');

const taxaOriginal = (await ADM.c.from('configuracoes').select('valor').eq('chave','taxa_empresa_percentual').maybeSingle()).data?.valor;

for (const abaixo of ['10', '24.9', '0']) {
  const r = await ADM.c.from('configuracoes').update({ valor: abaixo }).eq('chave','taxa_empresa_percentual').select();
  ok(
    `admin NAO grava taxa de ${abaixo}%`,
    Boolean(r.error) || (r.data?.length ?? 0) === 0,
    r.error?.message ?? 'GRAVOU!',
  );
}

const acima = await ADM.c.from('configuracoes').update({ valor: '30' }).eq('chave','taxa_empresa_percentual').select();
ok('admin grava taxa acima do piso', !acima.error && (acima.data?.length ?? 0) === 1, acima.error?.message ?? '');

// A corrida criada agora tem de carregar a taxa vigente, nunca abaixo do piso.
const pend2 = await A.c.from('corridas').select('id').eq('passageiro_id', A.uid).eq('status','aberta').maybeSingle();
if (pend2.data) await A.c.rpc('cancelar_corrida', { p_corrida_id: pend2.data.id });

const comTaxa = await A.c.rpc('criar_corrida', { p_categoria_chave: 'sem_ar', p_destino_texto: 'Teste de taxa' });
const linhaTaxa = Array.isArray(comTaxa.data) ? comTaxa.data[0] : comTaxa.data;
ok(
  'corrida grava a taxa vigente e nunca abaixo de 25%',
  Number(linhaTaxa?.taxa_empresa_percentual) >= 25,
  `${linhaTaxa?.taxa_empresa_percentual}%`,
);
if (linhaTaxa) await A.c.rpc('cancelar_corrida', { p_corrida_id: linhaTaxa.id });

await ADM.c.from('configuracoes').update({ valor: taxaOriginal ?? '25' }).eq('chave','taxa_empresa_percentual');

const passageiroMexeTaxa = await A.c.from('configuracoes').update({ valor: '5' }).eq('chave','taxa_empresa_percentual').select();
ok(
  'passageiro NAO mexe na taxa',
  (passageiroMexeTaxa.data?.length ?? 0) === 0,
  passageiroMexeTaxa.error ? passageiroMexeTaxa.error.message : `${passageiroMexeTaxa.data?.length} linha(s)`,
);

secao('13. Admin lanca credito na carteira');

const antesCredito = await A.c.from('carteiras').select('saldo_centavos').eq('passageiro_id', A.uid).maybeSingle();
const lancamento = await ADM.c.rpc('admin_creditar_carteira', {
  p_passageiro_id: A.uid,
  p_valor_centavos: 1500,
  p_descricao: 'Teste automatizado',
});
ok('admin credita pelo painel', !lancamento.error, lancamento.error?.message ?? '');

const depoisCredito = await A.c.from('carteiras').select('saldo_centavos').eq('passageiro_id', A.uid).maybeSingle();
ok(
  'saldo sobe exatamente o valor lancado',
  depoisCredito.data?.saldo_centavos === (antesCredito.data?.saldo_centavos ?? 0) + 1500,
  `${brl(antesCredito.data?.saldo_centavos ?? 0)} -> ${brl(depoisCredito.data?.saldo_centavos ?? 0)}`,
);

const acimaDoTeto = await ADM.c.rpc('admin_creditar_carteira', {
  p_passageiro_id: A.uid,
  p_valor_centavos: 100001,
});
ok('teto por lancamento respeitado', /limite/i.test(acimaDoTeto.error?.message ?? ''), acimaDoTeto.error?.message ?? 'PASSOU!');

const passageiroCredita = await A.c.rpc('admin_creditar_carteira', {
  p_passageiro_id: A.uid,
  p_valor_centavos: 5000,
});
ok('passageiro NAO credita a si mesmo', Boolean(passageiroCredita.error), passageiroCredita.error?.message ?? 'CREDITOU!');

const motoristaCredita = await MOT.c.rpc('admin_creditar_carteira', {
  p_passageiro_id: A.uid,
  p_valor_centavos: 5000,
});
ok('motorista NAO credita passageiro', Boolean(motoristaCredita.error), motoristaCredita.error?.message ?? 'CREDITOU!');

secao('14. Nova corrida apos encerrar');

const nova = await A.c.rpc('criar_corrida', {
  p_categoria_chave: 'sem_ar',
  p_destino_texto: 'Teste pos-corrida',
});
ok('passageiro pode chamar de novo', !nova.error, nova.error?.message ?? '');
if (!nova.error) {
  const n = Array.isArray(nova.data) ? nova.data[0] : nova.data;
  ok('sem coordenadas usa a distancia minima', Number(n.distancia_km) >= 1, `${n.distancia_km} km`);
  await A.c.rpc('cancelar_corrida', { p_corrida_id: n.id });
}

console.log(
  falhas === 0
    ? '\n\x1b[32mTUDO OK\x1b[0m — fluxo completo validado.\n'
    : `\n\x1b[31m${falhas} FALHA(S)\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
