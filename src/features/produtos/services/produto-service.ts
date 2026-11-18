import { requestProtectedJson } from "@/lib/api/protected-client";

export type ProdutoCategoria = {
  id: number;
  nome: string;
};

export type ProdutoInsumo = {
  id_insumo: number;
  nome: string;
  unidade: string;
  custo_estimado_unitario: number;
  estoque_atual: number;
  ativo: "Sim" | "Não";
};

export type ProdutoItem = {
  id_insumo: number;
  qtd_insumo: number;
  insumo: ProdutoInsumo | null;
};

export type Produto = {
  id_ficha: number;
  nome_receita: string;
  rendimento: number;
  custo_embalagem: number;
  custo_mao_obra: number;
  custo_armazenamento: number;
  custo_total: number;
  custo_unitario: number;
  id_categoria: number | null;
  categoria_nome: string | null;
  preco_venda: number;
  estoque_atual: number;
  ativo: "Sim" | "Não";
  itens: ProdutoItem[];
};

export type ProdutoCatalogo = {
  produtos: Produto[];
  categorias: ProdutoCategoria[];
  insumos: ProdutoInsumo[];
  ajustes: Array<{
    id_ajuste: number;
    id_ficha: number;
    nome_produto: string;
    tipo: "saldo_inicial" | "ajuste";
    quantidade_delta: number;
    motivo: string;
    criado_em: string;
  }>;
};

export type ProdutoInput = {
  id_ficha?: number;
  nome_receita: string;
  rendimento: number;
  id_categoria: number | null;
  custo_embalagem: number;
  custo_mao_obra: number;
  custo_armazenamento: number;
  preco_venda: number;
  ativo: "Sim" | "Não";
  itens: Array<{ id_insumo: number; quantidade: number }>;
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

function parseNumber(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error("O servidor retornou um valor numérico inválido.");
  }
  return parsed;
}

function parseName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("O servidor retornou um nome inválido.");
  }
  return value;
}

function parseCategory(value: unknown): ProdutoCategoria {
  if (!isRecord(value)) {
    throw new Error("O servidor retornou uma categoria inválida.");
  }
  return { id: parseId(value.id), nome: parseName(value.nome) };
}

function parseSupply(value: unknown): ProdutoInsumo {
  if (
    !isRecord(value) ||
    (value.ativo !== "Sim" && value.ativo !== "Não")
  ) {
    throw new Error("O servidor retornou um insumo inválido.");
  }
  return {
    id_insumo: parseId(value.id_insumo),
    nome: parseName(value.nome),
    unidade: parseName(value.unidade),
    custo_estimado_unitario: parseNumber(value.custo_estimado_unitario),
    estoque_atual: parseNumber(value.estoque_atual),
    ativo: value.ativo,
  };
}

function parseProduct(value: unknown): Produto {
  if (
    !isRecord(value) ||
    (value.ativo !== "Sim" && value.ativo !== "Não") ||
    (value.id_categoria !== null && typeof value.id_categoria !== "number") ||
    (value.categoria_nome !== null && typeof value.categoria_nome !== "string") ||
    !Array.isArray(value.itens)
  ) {
    throw new Error("O servidor retornou um produto inválido.");
  }

  const items = value.itens.map((item): ProdutoItem => {
    if (!isRecord(item) || !("insumo" in item)) {
      throw new Error("O servidor retornou um item de ficha inválido.");
    }
    return {
      id_insumo: parseId(item.id_insumo),
      qtd_insumo: parseNumber(item.qtd_insumo),
      insumo: item.insumo === null ? null : parseSupply(item.insumo),
    };
  });

  return {
    id_ficha: parseId(value.id_ficha),
    nome_receita: parseName(value.nome_receita),
    rendimento: parseNumber(value.rendimento),
    custo_embalagem: parseNumber(value.custo_embalagem),
    custo_mao_obra: parseNumber(value.custo_mao_obra),
    custo_armazenamento: parseNumber(value.custo_armazenamento),
    custo_total: parseNumber(value.custo_total),
    custo_unitario: parseNumber(value.custo_unitario),
    id_categoria:
      value.id_categoria === null ? null : parseId(value.id_categoria),
    categoria_nome: value.categoria_nome,
    preco_venda: parseNumber(value.preco_venda),
    estoque_atual: parseNumber(value.estoque_atual),
    ativo: value.ativo,
    itens: items,
  };
}

export async function getProdutoCatalogo(
  accessToken: string,
): Promise<ProdutoCatalogo> {
  const response = await requestProtectedJson("/api/produtos", accessToken);
  if (
    !isRecord(response) ||
    !Array.isArray(response.produtos) ||
    !Array.isArray(response.categorias) ||
    !Array.isArray(response.insumos) ||
    !Array.isArray(response.ajustes)
  ) {
    throw new Error("O servidor retornou um catálogo de produtos inválido.");
  }
  return {
    produtos: response.produtos.map(parseProduct),
    categorias: response.categorias.map(parseCategory),
    insumos: response.insumos.map(parseSupply),
    ajustes: response.ajustes.map((value) => {
      if (
        !isRecord(value) ||
        (value.tipo !== "saldo_inicial" && value.tipo !== "ajuste")
      ) {
        throw new Error("O servidor retornou um ajuste de estoque inválido.");
      }
      return {
        id_ajuste: parseId(value.id_ajuste),
        id_ficha: parseId(value.id_ficha),
        nome_produto: parseName(value.nome_produto),
        tipo: value.tipo,
        quantidade_delta: parseNumber(value.quantidade_delta),
        motivo: parseName(value.motivo),
        criado_em: parseName(value.criado_em),
      };
    }),
  };
}

export async function saveProduto(
  accessToken: string,
  produto: ProdutoInput,
): Promise<void> {
  await requestProtectedJson("/api/produtos", accessToken, {
    method: produto.id_ficha ? "PATCH" : "POST",
    body: produto,
  });
}

export async function adjustProdutoStock(
  accessToken: string,
  input: { id_ficha: number; quantidade_delta: number; motivo: string },
): Promise<void> {
  await requestProtectedJson("/api/produtos/estoque", accessToken, {
    method: "POST",
    body: input,
  });
}

export async function saveProdutoCategoria(
  accessToken: string,
  input: ProdutoCategoria,
): Promise<void> {
  await requestProtectedJson("/api/produtos/categorias", accessToken, {
    method: input.id ? "PATCH" : "POST",
    body: input,
  });
}
