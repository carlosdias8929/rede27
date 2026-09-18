/**
 * Validacao e formatacao de CPF.
 * Implementa o algoritmo oficial dos digitos verificadores (Receita Federal).
 * A consulta a base externa fica para a proxima fase (ver CPF.validacao no config).
 */
import { CPF as CPF_CONFIG } from '../config/rede27.config';

/** Remove tudo que nao for digito. */
export function somenteDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Aplica a mascara 000.000.000-00 progressivamente, enquanto o usuario digita. */
export function formatarCPF(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);

  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Calcula um digito verificador do CPF a partir dos digitos anteriores. */
function digitoVerificador(digitos: number[]): number {
  const pesoInicial = digitos.length + 1;
  const soma = digitos.reduce((acc, d, i) => acc + d * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Valida o CPF: 11 digitos e os dois digitos verificadores corretos. */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);

  if (d.length !== 11) return false;

  // CPFs com todos os digitos iguais passam no calculo mas nao existem.
  if (CPF_CONFIG.bloquearRepetidos && /^(\d)\1{10}$/.test(d)) return false;

  const nums = d.split('').map(Number);
  const dv1 = digitoVerificador(nums.slice(0, 9));
  if (dv1 !== nums[9]) return false;

  const dv2 = digitoVerificador(nums.slice(0, 10));
  return dv2 === nums[10];
}

export type ResultadoCPF = { ok: true; cpf: string } | { ok: false; erro: string };

/**
 * Valida e normaliza o CPF para gravacao (somente digitos).
 * Retorna a mensagem exata que deve aparecer para o passageiro.
 */
export function validarCPF(valor: string): ResultadoCPF {
  const d = somenteDigitos(valor);

  if (d.length === 0) return { ok: false, erro: 'Informe o seu CPF.' };
  if (d.length < 11) return { ok: false, erro: 'CPF incompleto. Digite os 11 numeros.' };
  if (!cpfValido(d)) return { ok: false, erro: 'CPF invalido. Confira os numeros digitados.' };

  return { ok: true, cpf: d };
}

/** Mascara para exibicao parcial: 123.***.**9-00 -> usada em telas de perfil. */
export function cpfMascarado(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return formatarCPF(valor);
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}
