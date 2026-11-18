import type { CategoriaInsumo } from "@/features/cadastros/categorias/services/categoria-insumo-service";
import { requestProtectedJson } from "@/lib/api/protected-client";

export type Unidade = {
  id: number;
  nome: string;
};

export type Insumo = {
  id_insumo: number;
  nome: string;
  unidade: string;
  categoria: string | null;
  custo_estimado_unitario: number;
  estoque_atual: number;
  ativo: "Sim" | "Não";
};

export type InsumoCatalog = {
  insumos: Insumo[];
  categorias: CategoriaInsumo[];
  unidades: Unidade[];
};

type CatalogOption = {
  id: number;
  nome: string;
};

export type CreateInsumoInput = {
  nome: string;
  unidade: string;
  categoria: string;
  custoEstimadoUnitario: number;
  estoqueAtual: number;
};

export type UpdateInsumoInput = {
  id_insumo: number;
  unidade: string;
  categoria: string;
  estoqueAtual: number;
  ativo: "Sim" | "Não";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error("O servidor retornou um identificador inválido.");
  }
  return value;
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("O servidor retornou um nome inválido.");
  }
  return value;
}

function parseNumber(value: unknown): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numberValue)) {
    throw new Error("O servidor retornou um valor numérico inválido.");
  }
  return numberValue;
}

function parseOptions(
  value: unknown,
  label: string,
): CatalogOption[] {
  if (!Array.isArray(value)) {
    throw new Error(`A lista de ${label} retornada pelo servidor é inválida.`);
  }

  return value.map((option) => {
    if (!isRecord(option)) {
      throw new Error(`O servidor retornou um item de ${label} inválido.`);
    }
    return {
      id: parseId(option.id),
      nome: parseName(option.nome),
    };
  });
}

function parseInsumos(value: unknown): Insumo[] {
  if (!Array.isArray(value)) {
    throw new Error("A lista de insumos retornada pelo servidor é inválida.");
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      (item.ativo !== "Sim" && item.ativo !== "Não") ||
      (item.categoria !== null && typeof item.categoria !== "string")
    ) {
      throw new Error("O servidor retornou um insumo inválido.");
    }

    return {
      id_insumo: parseId(item.id_insumo),
      nome: parseName(item.nome),
      unidade: parseName(item.unidade),
      categoria: item.categoria,
      custo_estimado_unitario: parseNumber(item.custo_estimado_unitario),
      estoque_atual: parseNumber(item.estoque_atual),
      ativo: item.ativo,
    };
  });
}

export async function getInsumoCatalog(
  accessToken: string,
): Promise<InsumoCatalog> {
  const result = await requestProtectedJson(
    "/api/cadastros/insumos",
    accessToken,
  );
  if (!isRecord(result)) {
    throw new Error("A resposta de insumos do servidor é inválida.");
  }
  return {
    insumos: parseInsumos(result.insumos),
    categorias: parseOptions(result.categorias, "categorias"),
    unidades: parseOptions(result.unidades, "unidades"),
  };
}

export async function createInsumos(
  accessToken: string,
  insumos: CreateInsumoInput[],
): Promise<void> {
  await requestProtectedJson("/api/cadastros/insumos", accessToken, {
    method: "POST",
    body: { insumos },
  });
}

export async function updateInsumo(
  accessToken: string,
  input: UpdateInsumoInput,
): Promise<void> {
  await requestProtectedJson("/api/cadastros/insumos", accessToken, {
    method: "PATCH",
    body: input,
  });
}
