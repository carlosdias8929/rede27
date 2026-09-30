import type { TipoChavePix } from '../types/database';

/**
 * PIX "copia e cola" e QR Code, no padrao BR Code do Banco Central.
 *
 * E o mesmo texto que qualquer banco gera ao "cobrar via PIX": o app do banco
 * de quem paga le o QR (ou o texto colado) e ja abre com chave e valor
 * preenchidos. Tudo e gerado aqui, no aparelho — nao ha servidor de pagamento
 * nem integracao com banco. Por isso o QR e "estatico": a confirmacao de que o
 * dinheiro caiu continua sendo o Admin conferindo o extrato.
 *
 * Formato (EMV QRCPS-MPM): sequencia de campos ID(2) + TAMANHO(2) + VALOR,
 * terminada por um CRC16. Se um caractere estiver errado, o banco recusa o
 * codigo inteiro — dai os testes em pix.test.ts.
 */

/** Um campo ID + tamanho + valor. */
function campo(id: string, valor: string): string {
  const tamanho = valor.length;
  if (tamanho > 99) throw new Error(`Campo PIX ${id} maior que 99 caracteres.`);
  return id + String(tamanho).padStart(2, '0') + valor;
}

/** CRC16/CCITT-FALSE (polinomio 0x1021, inicio 0xFFFF), exigido pelo BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Tira acento e o que nao for letra, numero ou espaco: o padrao so aceita ASCII. */
function limparTexto(texto: string, maximo: number): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo)
    .trim();
}

/**
 * Deixa a chave no formato que o DICT (diretorio do PIX) reconhece:
 * CNPJ/CPF so digitos, celular com +55, e-mail em minusculas.
 */
export function normalizarChave(tipo: TipoChavePix, chave: string): string {
  const bruta = (chave ?? '').trim();
  switch (tipo) {
    case 'cnpj':
    case 'cpf':
      return bruta.replace(/\D/g, '');
    case 'celular': {
      const digitos = bruta.replace(/\D/g, '');
      // 11 digitos = DDD + numero; com 13, o 55 ja veio junto.
      return digitos.length > 11 && digitos.startsWith('55') ? `+${digitos}` : `+55${digitos}`;
    }
    case 'email':
      return bruta.toLowerCase();
    case 'aleatoria':
      return bruta.toLowerCase();
  }
}

/** Mostra a chave como as pessoas estao acostumadas a ler. */
export function chaveFormatada(tipo: TipoChavePix, chave: string): string {
  const d = (chave ?? '').replace(/\D/g, '');
  if (tipo === 'cnpj' && d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (tipo === 'cpf' && d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (tipo === 'celular') {
    const local = d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
    if (local.length === 11) return local.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return chave;
}

export const ROTULO_TIPO_CHAVE: Record<TipoChavePix, string> = {
  cnpj: 'CNPJ',
  cpf: 'CPF',
  celular: 'Celular',
  email: 'E-mail',
  aleatoria: 'Chave aleatoria',
};

/** Codigo curto que identifica a recarga: vai no QR e aparece para o Admin. */
export function novoCodigoRecarga(): string {
  // Sem 0/O e 1/I, para ninguem confundir ao ler em voz alta.
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = 'R27';
  for (let i = 0; i < 8; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return codigo;
}

export type DadosPix = {
  tipoChave: TipoChavePix;
  chave: string;
  /** Nome de quem recebe. Maximo 25 caracteres no padrao; o excesso e cortado. */
  nome: string;
  /** Cidade de quem recebe. Maximo 15 caracteres no padrao. */
  cidade: string;
  /** Valor em centavos. Sem valor, quem paga digita no banco. */
  valorCentavos?: number | null;
  /** Identificador (txid), ate 25 letras/numeros. Sem ele vai "***". */
  identificador?: string | null;
  /** Texto curto que alguns bancos mostram para quem paga. */
  descricao?: string | null;
};

/** Gera o PIX copia e cola. O mesmo texto vira o QR Code. */
export function gerarPixCopiaECola(d: DadosPix): string {
  const chave = normalizarChave(d.tipoChave, d.chave);
  if (!chave) throw new Error('Chave PIX vazia.');

  const descricao = limparTexto(d.descricao ?? '', 40);
  const contaInfo =
    campo('00', 'br.gov.bcb.pix') + campo('01', chave) + (descricao ? campo('02', descricao) : '');

  const identificador = (d.identificador ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let payload =
    campo('00', '01') + campo('26', contaInfo) + campo('52', '0000') + campo('53', '986');

  if (d.valorCentavos && d.valorCentavos > 0) {
    payload += campo('54', (d.valorCentavos / 100).toFixed(2));
  }

  payload +=
    campo('58', 'BR') +
    campo('59', limparTexto(d.nome, 25) || 'RECEBEDOR') +
    campo('60', limparTexto(d.cidade, 15) || 'BRASIL') +
    campo('62', campo('05', identificador));

  // O CRC cobre o proprio cabecalho "6304".
  payload += '6304';
  return payload + crc16(payload);
}

/** Le um BR Code de volta em campos. Usado nos testes para conferir o gerado. */
export function lerCampos(payload: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const tamanho = Number(payload.slice(i + 2, i + 4));
    if (!Number.isFinite(tamanho)) throw new Error(`Tamanho invalido em ${i}.`);
    campos[id] = payload.slice(i + 4, i + 4 + tamanho);
    i += 4 + tamanho;
  }
  return campos;
}
