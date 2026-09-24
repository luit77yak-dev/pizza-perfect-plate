export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatCurrencyPlain(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",");
}
