import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  chaveFormatada,
  crc16,
  gerarPixCopiaECola,
  lerCampos,
  normalizarChave,
  novoCodigoRecarga,
} from './pix';

describe('crc16', () => {
  it('bate com o valor de referencia do CRC16/CCITT-FALSE', () => {
    // Vetor de teste padrao do algoritmo: "123456789" -> 29B1.
    assert.equal(crc16('123456789'), '29B1');
  });
});

describe('gerarPixCopiaECola', () => {
  const santander = {
    tipoChave: 'cnpj' as const,
    chave: '62.142.941/0001-17',
    nome: 'REDE BRASIL HOJE LTDA',
    cidade: 'Feira de Santana',
    valorCentavos: 5000,
    identificador: 'R27ABCD2345',
  };

  it('monta os campos obrigatorios do BR Code', () => {
    const payload = gerarPixCopiaECola(santander);
    const c = lerCampos(payload);

    assert.equal(c['00'], '01');
    assert.equal(c['52'], '0000');
    assert.equal(c['53'], '986'); // real
    assert.equal(c['54'], '50.00');
    assert.equal(c['58'], 'BR');
    assert.equal(c['59'], 'REDE BRASIL HOJE LTDA');
    assert.equal(c['60'], 'FEIRA DE SANTAN'); // limite de 15
    assert.equal(lerCampos(c['62'])['05'], 'R27ABCD2345');

    const conta = lerCampos(c['26']);
    assert.equal(conta['00'], 'br.gov.bcb.pix');
    assert.equal(conta['01'], '62142941000117');
  });

  it('termina com um CRC que confere', () => {
    const payload = gerarPixCopiaECola(santander);
    assert.match(payload, /6304[0-9A-F]{4}$/);
    assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
  });

  it('confere com um codigo gerado por fora, byte a byte', () => {
    // Montado a mao a partir da especificacao do Banco Central.
    const esperado =
      '000201' +
      '2636' +
      '0014br.gov.bcb.pix' +
      '0114' +
      '53077671000117' +
      '52040000' +
      '5303986' +
      '540510.00' +
      '5802BR' +
      '5922BAHIA HOJE COMUNICACAO' +
      '6008SALVADOR' +
      '62070503***' +
      '6304';
    const gerado = gerarPixCopiaECola({
      tipoChave: 'cnpj',
      chave: '53077671000117',
      nome: 'Bahia Hoje Comunicação',
      cidade: 'Salvador',
      valorCentavos: 1000,
    });
    assert.equal(gerado, esperado + crc16(esperado));
  });

  it('sem valor, deixa o campo 54 de fora para quem paga digitar', () => {
    const c = lerCampos(gerarPixCopiaECola({ ...santander, valorCentavos: null }));
    assert.equal(c['54'], undefined);
  });

  it('tira acentos e simbolos do nome e da cidade', () => {
    const c = lerCampos(
      gerarPixCopiaECola({ ...santander, nome: 'Açaí & Cia. São João', cidade: 'Riachão' }),
    );
    assert.equal(c['59'], 'ACAI CIA SAO JOAO');
    assert.equal(c['60'], 'RIACHAO');
  });
});

describe('chaves', () => {
  it('normaliza cada tipo como o DICT espera', () => {
    assert.equal(normalizarChave('cnpj', '62.142.941/0001-17'), '62142941000117');
    assert.equal(normalizarChave('cpf', '529.982.247-25'), '52998224725');
    assert.equal(normalizarChave('celular', '(75) 99132-8440'), '+5575991328440');
    assert.equal(normalizarChave('celular', '+55 75 99132-8440'), '+5575991328440');
    assert.equal(normalizarChave('email', ' Pix@Empresa.com '), 'pix@empresa.com');
  });

  it('formata para leitura', () => {
    assert.equal(chaveFormatada('cnpj', '62142941000117'), '62.142.941/0001-17');
    assert.equal(chaveFormatada('cnpj', '53077671000117'), '53.077.671/0001-17');
    assert.equal(chaveFormatada('celular', '75991328440'), '(75) 99132-8440');
  });

  it('gera codigo de recarga valido como identificador', () => {
    for (let i = 0; i < 50; i++) assert.match(novoCodigoRecarga(), /^R27[A-Z2-9]{8}$/);
  });
});
