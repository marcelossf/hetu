import { requestProtectedJson } from "@/lib/api/protected-client";

export type CategoriaInsumo = {
  id: number;
  nome: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCategories(value: unknown): CategoriaInsumo[] {
  if (!Array.isArray(value)) {
    throw new Error("A lista de categorias retornada pelo servidor é inválida.");
  }

  return value.map((category) => {
    if (
      !isRecord(category) ||
      typeof category.id !== "number" ||
      !Number.isSafeInteger(category.id) ||
      category.id < 1 ||
      typeof category.nome !== "string"
    ) {
      throw new Error("O servidor retornou uma categoria inválida.");
    }

    return { id: category.id, nome: category.nome };
  });
}

export async function getIngredientCategories(
  accessToken: string,
): Promise<CategoriaInsumo[]> {
  const result = await requestProtectedJson(
    "/api/cadastros/categorias",
    accessToken,
  );
  if (!isRecord(result)) {
    throw new Error("A resposta de categorias do servidor é inválida.");
  }
  return parseCategories(result.categorias);
}

export async function createIngredientCategory(
  accessToken: string,
  nome: string,
): Promise<void> {
  await requestProtectedJson("/api/cadastros/categorias", accessToken, {
    method: "POST",
    body: { nome },
  });
}

export async function updateIngredientCategory(
  accessToken: string,
  id: number,
  nome: string,
): Promise<void> {
  await requestProtectedJson("/api/cadastros/categorias", accessToken, {
    method: "PATCH",
    body: { id, nome },
  });
}
