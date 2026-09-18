import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cpfMascarado, cpfValido, formatarCPF, validarCPF } from './cpf';

describe('cpfValido', () => {
  it('aceita CPFs com digitos verificadores corretos', () => {
    // CPFs sinteticos, validos pelo algoritmo da Receita.
    for (const cpf of ['529.982.247-25', '111.444.777-35', '12345678909']) {
      assert.equal(cpfValido(cpf), true, `esperava ${cpf} valido`);
    }
  });

  it('recusa digito verificador errado', () => {
    assert.equal(cpfValido('529.982.247-26'), false);
    assert.equal(cpfValido('111.444.777-36'), false);
  });

  it('recusa sequencias de digitos repetidos', () => {
    for (const cpf of ['00000000000', '11111111111', '99999999999']) {
      assert.equal(cpfValido(cpf), false, `esperava ${cpf} invalido`);
    }
  });

  it('recusa quantidade de digitos diferente de 11', () => {
    assert.equal(cpfValido('5299822472'), false);
    assert.equal(cpfValido('529982247255'), false);
    assert.equal(cpfValido(''), false);
  });

  it('ignora mascara e caracteres estranhos', () => {
    assert.equal(cpfValido('529 982 247 25'), true);
    assert.equal(cpfValido('529-982-247.25'), true);
  });
});

describe('validarCPF', () => {
  it('devolve o CPF so com digitos quando valido', () => {
    const r = validarCPF('529.982.247-25');
    assert.deepEqual(r, { ok: true, cpf: '52998224725' });
  });

  it('distingue campo vazio, incompleto e invalido', () => {
    assert.match((validarCPF('') as { erro: string }).erro, /Informe o seu CPF/);
    assert.match((validarCPF('529.982') as { erro: string }).erro, /incompleto/i);
    assert.match((validarCPF('529.982.247-26') as { erro: string }).erro, /invalido/i);
  });
});

describe('formatarCPF', () => {
  it('aplica a mascara progressivamente', () => {
    assert.equal(formatarCPF('529'), '529');
    assert.equal(formatarCPF('529982'), '529.982');
    assert.equal(formatarCPF('529982247'), '529.982.247');
    assert.equal(formatarCPF('52998224725'), '529.982.247-25');
  });

  it('descarta digitos alem dos 11', () => {
    assert.equal(formatarCPF('5299822472599'), '529.982.247-25');
  });
});

describe('cpfMascarado', () => {
  it('esconde o miolo do CPF', () => {
    assert.equal(cpfMascarado('52998224725'), '529.***.***-25');
  });
});
