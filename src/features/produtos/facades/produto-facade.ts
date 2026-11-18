export function parseProdutoAmount(
  value: string,
  precision = 2,
): number | null {
  const normalized = value.trim().replace(",", ".");
  const pattern = new RegExp(`^\\d{1,8}(?:\\.\\d{1,${precision}})?$`);
  if (!pattern.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function formatProdutoCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatProdutoQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 4,
  }).format(value);
}
