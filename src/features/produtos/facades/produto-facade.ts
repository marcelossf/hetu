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

export function convertProdutoQuantity(value: string, toSmallerUnit: boolean): string {
  const normalized = value.trim();
  if (!normalized || !/^\d*(?:\.\d*)?$/.test(normalized) || !/\d/.test(normalized)) {
    return normalized;
  }

  const [whole, fraction = ""] = normalized.split(".");
  const digits = whole + fraction;
  const decimalPosition = whole.length + (toSmallerUnit ? 3 : -3);
  let converted: string;

  if (decimalPosition <= 0) {
    converted = `0.${"0".repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    converted = digits.padEnd(decimalPosition, "0");
  } else {
    converted = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }

  const [integer, decimals = ""] = converted.split(".");
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  const normalizedDecimals = decimals.replace(/0+$/, "");
  return normalizedDecimals
    ? `${normalizedInteger}.${normalizedDecimals}`
    : normalizedInteger;
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
