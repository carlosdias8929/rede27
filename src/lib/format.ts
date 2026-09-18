import { MARCA } from '../config/rede27.config';

/** Formata um valor em reais: 12.5 -> "R$ 12,50". */
export function brl(valor: number): string {
  const n = Number.isFinite(valor) ? valor : 0;
  try {
    return new Intl.NumberFormat(MARCA.locale, {
      style: 'currency',
      currency: MARCA.moeda,
    }).format(n);
  } catch {
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  }
}

/** Converte reais para centavos inteiros (o banco guarda centavos). */
export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos inteiros do banco para reais. */
export function paraReais(centavos: number): number {
  return (centavos ?? 0) / 100;
}

/** Data/hora curta para o extrato: "18/09 14:32". */
export function dataHoraCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${min}`;
}
