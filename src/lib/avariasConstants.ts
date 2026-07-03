export const LOJAS: Record<string, string> = {
  '01': 'Area venda Vila',
  '02': 'Loja Shopping',
  '03': 'Deposito Vila',
  '04': 'Deposito Xavantina',
  '05': 'Area de venda Xavantina',
  '07': 'Loja Agua Boa',
  '08': 'Loja Querencia',
  '09': 'Loja Jussara',
  '10': 'Loja Canarana',
};

export const SESSOES: { sessao: string; comprador: string }[] = [
  { sessao: 'Limpeza', comprador: 'Adrian' },
  { sessao: 'Perfumaria', comprador: 'Simone/Katielen' },
  { sessao: 'Mercearia Salgada', comprador: 'Igor/Elita' },
  { sessao: 'Automotivos/Padaria', comprador: 'Jose Roberto' },
  { sessao: 'HortiFruti', comprador: 'Wesley' },
  { sessao: 'Bebidas', comprador: 'Lenilda' },
  { sessao: 'Lacticinios', comprador: 'Carlos' },
  { sessao: 'Açougue', comprador: 'Eulino' },
  { sessao: 'Mercearia Seca', comprador: 'Jessica' },
  { sessao: 'Mercearia Doce', comprador: 'Ramao/Edson' },
  { sessao: 'Bazar/Eletrodomestico', comprador: 'Jesuane' },
];

export const compradorFromSessao = (s: string) =>
  SESSOES.find(x => x.sessao === s)?.comprador ?? '';

export const lojaNome = (num: string) => {
  const key = String(num).padStart(2, '0');
  return LOJAS[key] ?? `Loja ${key}`;
};

export const normalizeLojaNumero = (raw: any): string => {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return s;
  return digits.padStart(2, '0');
};

export const parseNumber = (raw: any): number => {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/[R$\s]/g, '');
  // "1.234,56" -> "1234.56"
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

export const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
