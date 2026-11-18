import type { CategoriaInsumo } from "@/features/cadastros/categorias/services/categoria-insumo-service";

export type CategoriaInsumoListItem = {
  id: number;
  label: string;
};

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function toCategoryListItem(
  category: CategoriaInsumo,
): CategoriaInsumoListItem {
  return { id: category.id, label: category.nome };
}
