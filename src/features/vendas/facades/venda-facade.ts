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

export function vendaDateFromTimestamp(value: string): string {
  return new Date(new Date(value).getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function formatVendaDate(value: string): string {
  return vendaDateFromTimestamp(value).split("-").reverse().join("/");
}
