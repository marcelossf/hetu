import { requestProtectedJson } from "@/lib/api/protected-client";

export type Fornecedor = {
  id_fornecedor: number;
  nome: string;
  endereco: string | null;
  ativo: "Sim" | "Não";
  criado_em: string;
  atualizado_em: string;
};

export type SaveFornecedorInput = {
  id_fornecedor?: number;
  nome: string;
  endereco: string | null;
  ativo: "Sim" | "Não";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error("O servidor retornou um identificador inválido.");
  }
  return value;
}

function parseFornecedor(value: unknown): Fornecedor {
  if (
    !isRecord(value) ||
    typeof value.nome !== "string" ||
    (value.endereco !== null && typeof value.endereco !== "string") ||
    (value.ativo !== "Sim" && value.ativo !== "Não") ||
    typeof value.criado_em !== "string" ||
    typeof value.atualizado_em !== "string"
  ) {
    throw new Error("O servidor retornou um fornecedor inválido.");
  }
  return {
    id_fornecedor: parseId(value.id_fornecedor),
    nome: value.nome,
    endereco: value.endereco,
    ativo: value.ativo,
    criado_em: value.criado_em,
    atualizado_em: value.atualizado_em,
  };
}

export async function getFornecedores(
  accessToken: string,
): Promise<Fornecedor[]> {
  const response = await requestProtectedJson(
    "/api/cadastros/fornecedores",
    accessToken,
  );
  if (!isRecord(response) || !Array.isArray(response.fornecedores)) {
    throw new Error("O servidor retornou a lista de fornecedores inválida.");
  }
  return response.fornecedores.map(parseFornecedor);
}

export async function saveFornecedor(
  accessToken: string,
  input: SaveFornecedorInput,
): Promise<Fornecedor> {
  const response = await requestProtectedJson(
    "/api/cadastros/fornecedores",
    accessToken,
    {
      method: input.id_fornecedor === undefined ? "POST" : "PATCH",
      body: input,
    },
  );
  if (!isRecord(response)) {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  return parseFornecedor(response.fornecedor);
}

export async function deleteFornecedor(
  accessToken: string,
  id_fornecedor: number,
): Promise<void> {
  await requestProtectedJson("/api/cadastros/fornecedores", accessToken, {
    method: "DELETE",
    body: { id_fornecedor },
  });
}
