/**
 * ============================================================================
 * PONTO UNICO DE AJUSTE — REDE27
 * ============================================================================
 * O que da para mudar sem mexer em tela nenhuma mora aqui.
 *
 * O que NAO mora aqui, de proposito: precos, taxa da empresa, cidades e fator
 * de rota. Esses o cliente edita pelo painel Admin, e o valor que vale e o do
 * banco. O que existir neste arquivo sobre eles e so fallback offline.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// PROTOCOLO 03 — botao de emergencia
//
// Definicao do cliente em 18/09: o passageiro segura o "03" por 3 segundos e
// dispara um alerta silencioso no painel Admin, com localizacao.
//
// Nao confundir com o botao CHAMAR: o 03 nao trava, nem confirma, nem cancela
// corrida. E um pedido de socorro.
// ---------------------------------------------------------------------------
export type PassoProtocolo = {
  numero: 1 | 2 | 3 | 4 | 5;
  /** Chave estavel gravada no banco (nao traduzir). */
  chave: string;
  titulo: string;
  descricao: string;
  onde: 'app' | 'admin';
};

export const PROTOCOLO_03 = {
  /** Tempo de pressao para acionar, em milissegundos. */
  duracaoMs: 3000,

  /**
   * Combinado por escrito com o cliente: o alerta e SILENCIOSO para o motorista
   * e so toca no painel Admin. Se o passageiro acionou por causa do motorista,
   * um som no celular dele avisaria exatamente quem representa o risco.
   */
  silenciosoParaMotorista: true,

  /** Alarme sonoro no painel Admin enquanto houver alerta ativo. */
  alarmeNoAdmin: true,

  passos: [
    {
      numero: 1,
      chave: 'acionado',
      titulo: 'Passageiro aciona o 03',
      descricao: 'O passageiro segura o botao 03 por 3 segundos dentro do aplicativo.',
      onde: 'app',
    },
    {
      numero: 2,
      chave: 'localizacao_enviada',
      titulo: 'App envia localizacao',
      descricao: 'Localizacao e dados da corrida seguem para o painel Admin.',
      onde: 'app',
    },
    {
      numero: 3,
      chave: 'alerta_exibido',
      titulo: 'Alerta no painel Admin',
      descricao: 'O painel mostra "PROTOCOLO 03 ATIVADO" em vermelho, com aviso sonoro.',
      onde: 'admin',
    },
    {
      numero: 4,
      chave: 'contato_realizado',
      titulo: 'Central entra em contato',
      descricao: 'A central liga para o passageiro e para o motorista pelo painel.',
      onde: 'admin',
    },
    {
      numero: 5,
      chave: 'encerrado',
      titulo: 'Alerta encerrado',
      descricao: 'A central encerra o alerta e ele sai da lista de ativos.',
      onde: 'admin',
    },
  ] as PassoProtocolo[],

  /**
   * Gravacao de audio e ligacao automatica para a policia: fase 2, conforme
   * combinado. Este MVP avisa a central; nao substitui o 190.
   */
  avisoLegal: 'O 03 avisa a central da empresa. Nao substitui o 190.',
} as const;

// ---------------------------------------------------------------------------
// CICLO DA CORRIDA
//
// Os cinco passos do servico em si. Antes isto se chamava "protocolo de 5
// passos"; o nome mudou quando o cliente esclareceu que aquele nome pertence ao
// 03. A estrutura continua a mesma e o painel do motorista depende dela.
// ---------------------------------------------------------------------------
export type PassoCorrida = {
  numero: 1 | 2 | 3 | 4 | 5;
  chave: string;
  titulo: string;
  descricao: string;
  /** Rotulo do botao que leva a corrida para este passo, no painel do motorista. */
  acaoMotorista?: string;
};

export const CICLO_CORRIDA: PassoCorrida[] = [
  {
    numero: 1,
    chave: 'chamada_enviada',
    titulo: 'Chamada enviada',
    descricao: 'A chamada foi registrada e esta aguardando um motorista.',
  },
  {
    numero: 2,
    chave: 'motorista_aceitou',
    titulo: 'Motorista aceitou',
    descricao: 'Um motorista aceitou a chamada e esta a caminho.',
    acaoMotorista: 'Aceitar corrida',
  },
  {
    numero: 3,
    chave: 'embarque_confirmado',
    titulo: 'Embarque confirmado',
    descricao: 'O motorista chegou ao ponto de partida e o embarque foi confirmado.',
    acaoMotorista: 'Confirmar embarque',
  },
  {
    numero: 4,
    chave: 'em_deslocamento',
    titulo: 'Em deslocamento',
    descricao: 'Trajeto em andamento ate o destino.',
    acaoMotorista: 'Iniciar deslocamento',
  },
  {
    numero: 5,
    chave: 'servico_concluido',
    titulo: 'Servico concluido',
    descricao: 'Chegada ao destino, pagamento debitado da carteira e servico encerrado.',
    acaoMotorista: 'Concluir e receber',
  },
];

// ---------------------------------------------------------------------------
// CATEGORIAS — fallback offline. O que vale esta na tabela `categorias`.
// ---------------------------------------------------------------------------
export type CategoriaChave = 'com_ar' | 'sem_ar' | 'transporte_bens';

export type Categoria = {
  chave: CategoriaChave;
  nome: string;
  descricao: string;
  tarifaBase: number;
  precoKm: number;
};

export const CATEGORIAS: Categoria[] = [
  {
    chave: 'sem_ar',
    nome: 'Sem ar',
    descricao: 'Carro de passeio sem ar-condicionado. Tarifa reduzida.',
    tarifaBase: 7.0,
    precoKm: 2.5,
  },
  {
    chave: 'com_ar',
    nome: 'Com ar',
    descricao: 'Carro de passeio com ar-condicionado.',
    tarifaBase: 10.0,
    precoKm: 3.0,
  },
  {
    chave: 'transporte_bens',
    nome: 'Transporte de Bens',
    descricao: 'Envelope ou caixa pequena em carro de passeio.',
    tarifaBase: 12.0,
    precoKm: 3.5,
  },
];

export const ICONE_CATEGORIA: Record<string, string> = {
  sem_ar: '🚗',
  com_ar: '❄️',
  transporte_bens: '📦',
};

// ---------------------------------------------------------------------------
// DISTANCIA E PRECO
// ---------------------------------------------------------------------------
export const DISTANCIA = {
  /**
   * Fallback do multiplicador aplicado a distancia em linha reta para aproximar
   * o trajeto por rua. O valor que vale esta em `configuracoes.fator_rota`,
   * editavel no Admin.
   */
  fatorRotaPadrao: 1.3,

  /** Fallback da distancia minima cobrada, em km. */
  minimaPadrao: 1,

  /**
   * Enquanto nao houver API de rotas, a distancia e estimada. O app diz isso ao
   * passageiro em vez de fingir precisao que nao tem.
   */
  aviso: 'Distancia estimada. O valor final pode variar conforme o trajeto.',
} as const;

// ---------------------------------------------------------------------------
// CPF E CARTEIRA
// ---------------------------------------------------------------------------
export const CPF = {
  /** 'algoritmica' = formato + digitos verificadores. Base externa: fase 2. */
  validacao: 'algoritmica' as 'algoritmica' | 'base_externa',

  /** Bloqueia CPFs de teste com todos os digitos iguais. */
  bloquearRepetidos: true,

  /**
   * O login e por CPF, mas o Supabase Auth trabalha com e-mail: cada CPF vira
   * `<cpf>@<dominio>`. O usuario nunca ve esse endereco e nada e enviado.
   *
   * ATENCAO: o Supabase recusa dominio que nao resolve no DNS —
   * `passageiro.rede27.app` foi rejeitado por isso.
   *
   * <<< TROCAR pelo dominio oficial da REDE27 quando o cliente confirmar.
   */
  dominioLogin: 'rede27.app',
} as const;

export const CARTEIRA = {
  /** 'saldo_simples' = credito lancado pela administracao. Recarga: fase 2. */
  modo: 'saldo_simples' as 'saldo_simples' | 'recarga_pagamento',
  exigirSaldoParaChamar: true,
} as const;

// ---------------------------------------------------------------------------
// MARCA
//
// O cliente separa as duas coisas na propria mensagem: "App REDE 27 - REDE
// BRASIL", "painel da REDE BRASIL", "25% fixo pra REDE BRASIL". Entao:
//
//   nomeApp -> o aplicativo, que o passageiro ve na logo
//   empresa -> a empresa, que aparece nas saudacoes, no painel e na taxa
//
// Se ele confirmar que e um nome so, basta igualar os dois aqui. Nenhum texto
// de tela repete essas palavras: todos leem daqui.
// ---------------------------------------------------------------------------
export const MARCA = {
  nomeApp: 'REDE 27',
  empresa: 'REDE BRASIL HOJE',
  slogan: 'Transporte de passageiros, bens e encomendas',
  moeda: 'BRL',
  locale: 'pt-BR',
  ufPadrao: 'BA',
} as const;

// ---------------------------------------------------------------------------
// SAUDACOES
//
// Frases pedidas pelo cliente, ao pe da letra. Ficam aqui para ele poder mudar
// o texto sem mexer em tela nenhuma.
// ---------------------------------------------------------------------------
export const SAUDACOES = {
  /** Tela inicial do passageiro. */
  bemVindo: `Bem-vindo a ${MARCA.empresa}`,

  /** Passo 3: o motorista chegou ao ponto de partida. */
  chegouNoLocal: 'Voce chegou no local',

  /** Passo 5: chegada ao destino. */
  chegouNoEndereco: 'Voce chegou no endereco',

  /** Fim da corrida. */
  obrigado: `Obrigado por usar a ${MARCA.empresa}`,
} as const;

// ---------------------------------------------------------------------------
// TAXA DA EMPRESA
// ---------------------------------------------------------------------------
export const TAXA = {
  /**
   * Piso exigido pelo cliente: "Nao pode ser menos que 25% de jeito nenhum".
   * O valor corrente continua editavel no painel Admin, mas o banco recusa
   * qualquer numero abaixo deste piso — a trava nao depende da tela.
   */
  minimaPercentual: 25,
} as const;
