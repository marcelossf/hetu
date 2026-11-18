export function parseVendaAmount(
  value: string,
  precision = 2,
): number | null {
  const normalized = value.trim().replace(",", ".");
  const pattern = new RegExp(`^\\d{1,8}(?:\\.\\d{1,${precision}})?$`);
  if (!pattern.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function roundVendaMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiscountAmount(
  subtotal: number,
  percentage: number,
): number {
  return roundVendaMoney((subtotal * percentage) / 100);
}

export function formatVendaCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatVendaQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}
