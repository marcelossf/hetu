import type { Insumo } from "@/features/cadastros/insumos/services/insumo-service";

export type InsumoListItem = Insumo & {
  custoFormatado: string;
  estoqueFormatado: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toInsumoListItem(insumo: Insumo): InsumoListItem {
  return {
    ...insumo,
    custoFormatado: currencyFormatter.format(insumo.custo_estimado_unitario),
    estoqueFormatado: quantityFormatter.format(insumo.estoque_atual),
  };
}
