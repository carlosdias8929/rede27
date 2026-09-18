/**
 * ============================================================================
 * PONTO UNICO DE AJUSTE — REDE27 MVP
 * ============================================================================
 * Tudo que ainda depende de resposta do cliente (Alberto) esta neste arquivo.
 * Quando a resposta chegar, muda-se AQUI e nada mais precisa ser tocado.
 *
 * Status das perguntas em aberto (ver docs/PENDENCIAS.md):
 *   1. Trava de seguranca "03"  -> TRAVA_03 (os dois modos ja estao implementados)
 *   2. Os 5 passos do protocolo -> PROTOCOLO_5_PASSOS (textos provisorios)
 *   3. Quem recebe a chamada    -> MOTORISTA.modo
 *   4. Precos por categoria     -> CATEGORIAS (fallback; valor real vem do banco)
 *   5. Validacao de CPF         -> CPF.validacao
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// 1. TRAVA DE SEGURANCA "03"
// ---------------------------------------------------------------------------
export type Trava03Modo =
  /** Passageiro mantem o botao CHAMAR pressionado por 3 segundos. */
  | 'SEGURAR_3S'
  /** Passageiro digita o codigo "03" para liberar a chamada. */
  | 'CODIGO_03';

export const TRAVA_03 = {
  /** <<< TROCAR AQUI quando o cliente responder. Os dois modos funcionam. */
  modo: 'SEGURAR_3S' as Trava03Modo,

  /** Modo SEGURAR_3S: tempo de pressao necessario, em milissegundos. */
  duracaoMs: 3000,

  /** Modo CODIGO_03: codigo esperado no campo de liberacao. */
  codigo: '03',

  /** Texto exibido ao passageiro antes de liberar. */
  rotulo: {
    SEGURAR_3S: 'Segure por 3 segundos para chamar',
    CODIGO_03: 'Digite o codigo 03 para liberar a chamada',
  } as Record<Trava03Modo, string>,
} as const;

// ---------------------------------------------------------------------------
// 2. PROTOCOLO DE 5 PASSOS
// ---------------------------------------------------------------------------
export type PassoProtocolo = {
  /** Numero do passo, 1 a 5. */
  numero: 1 | 2 | 3 | 4 | 5;
  /** Chave estavel gravada no banco (nao traduzir). */
  chave: string;
  titulo: string;
  descricao: string;
  /** Quem dispara a transicao para este passo. */
  acionadoPor: 'passageiro' | 'motorista' | 'sistema';
};

/**
 * TEXTOS PROVISORIOS — aguardando a lista oficial do cliente.
 * A estrutura (5 passos, avanco sequencial, gravacao em banco) ja esta pronta;
 * trocar titulo/descricao aqui nao exige nenhuma outra alteracao.
 */
export const PROTOCOLO_5_PASSOS: PassoProtocolo[] = [
  {
    numero: 1,
    chave: 'chamada_enviada',
    titulo: 'Chamada enviada',
    descricao: 'Sua chamada foi registrada e esta sendo distribuida aos motoristas da REDE27.',
    acionadoPor: 'passageiro',
  },
  {
    numero: 2,
    chave: 'motorista_aceitou',
    titulo: 'Motorista aceitou',
    descricao: 'Um motorista da rede aceitou a sua chamada e esta a caminho.',
    acionadoPor: 'motorista',
  },
  {
    numero: 3,
    chave: 'embarque_confirmado',
    titulo: 'Embarque confirmado',
    descricao: 'Motorista chegou ao ponto de partida e o embarque foi confirmado.',
    acionadoPor: 'motorista',
  },
  {
    numero: 4,
    chave: 'em_deslocamento',
    titulo: 'Em deslocamento',
    descricao: 'Trajeto em andamento ate o destino informado.',
    acionadoPor: 'sistema',
  },
  {
    numero: 5,
    chave: 'servico_concluido',
    titulo: 'Servico concluido',
    descricao: 'Chegada ao destino, pagamento debitado da carteira e servico encerrado.',
    acionadoPor: 'motorista',
  },
];

// ---------------------------------------------------------------------------
// 3. CATEGORIAS DE SERVICO
// ---------------------------------------------------------------------------
export type CategoriaChave = 'com_ar' | 'sem_ar' | 'transporte_bens';

export type Categoria = {
  chave: CategoriaChave;
  nome: string;
  descricao: string;
  /** Tarifa base em reais (fallback — o valor oficial vem da tabela `categorias`). */
  tarifaBase: number;
  /** Preco por quilometro em reais (fallback). */
  precoKm: number;
  icone: string;
};

/**
 * PRECOS DE EXEMPLO — editaveis pelo cliente sem rebuild (tabela `categorias`
 * no Supabase). Os valores abaixo sao apenas o fallback offline.
 */
export const CATEGORIAS: Categoria[] = [
  {
    chave: 'com_ar',
    nome: 'Com ar',
    descricao: 'Carro de passeio com ar-condicionado.',
    tarifaBase: 8.0,
    precoKm: 2.4,
    icone: 'snow',
  },
  {
    chave: 'sem_ar',
    nome: 'Sem ar',
    descricao: 'Carro de passeio sem ar-condicionado. Tarifa reduzida.',
    tarifaBase: 6.0,
    precoKm: 1.9,
    icone: 'car',
  },
  {
    chave: 'transporte_bens',
    nome: 'Transporte de Bens',
    descricao: 'Envelopes e caixas pequenas. Preparado para veiculo de carga proprio.',
    tarifaBase: 7.0,
    precoKm: 2.1,
    icone: 'cube',
  },
];

// ---------------------------------------------------------------------------
// 4. MOTORISTA
// ---------------------------------------------------------------------------
export const MOTORISTA = {
  /**
   * 'painel_simulado' — a chamada cai num painel web simples (rota /motorista),
   * usado para demonstrar e testar o fluxo sem app de motorista.
   * 'app_proprio'     — proxima fase.
   */
  modo: 'painel_simulado' as 'painel_simulado' | 'app_proprio',
} as const;

// ---------------------------------------------------------------------------
// 5. CPF E CARTEIRA
// ---------------------------------------------------------------------------
export const CPF = {
  /**
   * 'algoritmica' — formato + digitos verificadores (padrao Receita Federal).
   * 'base_externa' — consulta a base externa (Serpro/parceiro): proxima fase,
   *                  exige contrato e chave de API do cliente.
   */
  validacao: 'algoritmica' as 'algoritmica' | 'base_externa',

  /** Bloqueia CPFs de teste com todos os digitos iguais (111.111.111-11 etc). */
  bloquearRepetidos: true,

  /**
   * O login e por CPF, mas o Supabase Auth trabalha com e-mail: cada CPF vira
   * `<cpf>@<dominio>`. O passageiro nunca ve esse endereco e nada e enviado
   * para ele (a confirmacao de e-mail fica desligada no painel do Supabase).
   *
   * ATENCAO: o Supabase valida o dominio e recusa o cadastro se ele nao
   * resolver no DNS — `passageiro.rede27.app` foi recusado por isso. Use um
   * dominio real, de preferencia o do proprio cliente.
   *
   * <<< TROCAR pelo dominio oficial da REDE27 quando o cliente confirmar.
   */
  dominioLogin: 'rede27.app',
} as const;

export const CARTEIRA = {
  /**
   * 'saldo_simples' — saldo creditado manualmente/administrativamente (MVP).
   * 'recarga_pagamento' — recarga via PIX/cartao: proxima fase.
   */
  modo: 'saldo_simples' as 'saldo_simples' | 'recarga_pagamento',

  /** Saldo de cortesia creditado no primeiro acesso, em reais. Zero desativa. */
  saldoInicial: 0,

  /** Impede chamar corrida sem saldo suficiente para a tarifa base. */
  exigirSaldoParaChamar: true,
} as const;

// ---------------------------------------------------------------------------
// MARCA
// ---------------------------------------------------------------------------
export const MARCA = {
  nome: 'REDE27',
  slogan: 'Transporte de passageiros, bens e encomendas',
  moeda: 'BRL',
  locale: 'pt-BR',
} as const;
