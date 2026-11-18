import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";
import { rpcErrorResponse } from "@/lib/api/rpc-error-response";

type RecipeItemInput = {
  id_insumo: number;
  quantidade: number;
};

type ProductInput = {
  id_ficha: number | null;
  nome_receita: string;
  rendimento: number;
  id_categoria: number | null;
  custo_embalagem: number;
  custo_mao_obra: number;
  custo_armazenamento: number;
  preco_venda: number;
  ativo: "Sim" | "Não";
  itens: RecipeItemInput[];
};

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isAmount(
  value: unknown,
  allowZero = true,
  precision = 2,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value <= 99_999_999.99 &&
    Math.round(value * 10 ** precision) / 10 ** precision === value &&
    (allowZero ? value >= 0 : value > 0)
  );
}

function parseProductInput(
  body: Record<string, unknown>,
  requireId: boolean,
): ProductInput | null {
  const rawId = body.id_ficha;
  const id_ficha =
    rawId === undefined || rawId === null
      ? null
      : isPositiveId(rawId)
        ? rawId
        : Number.NaN;
  const nome_receita =
    typeof body.nome_receita === "string"
      ? body.nome_receita.trim().replace(/\s+/g, " ")
      : "";
  const rawCategory = body.id_categoria;
  const id_categoria =
    rawCategory === undefined || rawCategory === null || rawCategory === ""
      ? null
      : isPositiveId(rawCategory)
        ? rawCategory
        : Number.NaN;

  if (
    (requireId && id_ficha === null) ||
    (id_ficha !== null && !Number.isSafeInteger(id_ficha)) ||
    (id_categoria !== null && !Number.isSafeInteger(id_categoria)) ||
    !nome_receita ||
    nome_receita.length > 120 ||
    !isAmount(body.rendimento, false) ||
    !isAmount(body.custo_embalagem) ||
    !isAmount(body.custo_mao_obra) ||
    !isAmount(body.custo_armazenamento) ||
    !isAmount(body.preco_venda) ||
    (body.ativo !== "Sim" && body.ativo !== "Não") ||
    !Array.isArray(body.itens) ||
    body.itens.length > 100
  ) {
    return null;
  }

  const itens: RecipeItemInput[] = [];
  const ingredientIds = new Set<number>();
  for (const item of body.itens) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      !("id_insumo" in item) ||
      !("quantidade" in item) ||
      !isPositiveId(item.id_insumo) ||
      !isAmount(item.quantidade, false, 4) ||
      item.quantidade > 999_999.9999 ||
      ingredientIds.has(item.id_insumo)
    ) {
      return null;
    }
    ingredientIds.add(item.id_insumo);
    itens.push({
      id_insumo: item.id_insumo,
      quantidade: item.quantidade,
    });
  }

  return {
    id_ficha,
    nome_receita,
    rendimento: body.rendimento,
    id_categoria,
    custo_embalagem: body.custo_embalagem,
    custo_mao_obra: body.custo_mao_obra,
    custo_armazenamento: body.custo_armazenamento,
    preco_venda: body.preco_venda,
    ativo: body.ativo,
    itens,
  };
}

export const GET = createProtectedSupabaseHandler(
  "produtos-listagem",
  async (_request, supabase) => {
    const [products, categories, supplies, recipeItems, adjustments] =
      await Promise.all([
      supabase
        .from("db_fichas")
        .select(
          "id_ficha, nome_receita, rendimento, custo_embalagem, custo_mao_obra, custo_armazenamento, custo_total, custo_unitario, id_categoria, preco_venda, estoque_atual, ativo",
        )
        .order("nome_receita"),
      supabase.from("db_categoria_produto").select("id, nome").order("nome"),
      supabase
        .from("db_insumos")
        .select(
          "id_insumo, nome, unidade, custo_estimado_unitario, estoque_atual, ativo",
        )
        .order("nome"),
      supabase
        .from("db_fichas_itens")
        .select("id_ficha, id_insumo, qtd_insumo"),
      supabase
        .from("db_ajustes_estoque_produto")
        .select("id_ajuste, id_ficha, tipo, quantidade_delta, motivo, criado_em")
        .order("criado_em", { ascending: false })
        .limit(100),
    ]);

    if (products.error) throw products.error;
    if (categories.error) throw categories.error;
    if (supplies.error) throw supplies.error;
    if (recipeItems.error) throw recipeItems.error;
    if (adjustments.error) throw adjustments.error;

    const supplyById = new Map(
      supplies.data.map((supply) => [supply.id_insumo, supply]),
    );
    const categoryById = new Map(
      categories.data.map((category) => [category.id, category.nome]),
    );
    const itemsByProduct = new Map<number, typeof recipeItems.data>();
    for (const item of recipeItems.data) {
      const currentItems = itemsByProduct.get(item.id_ficha) ?? [];
      currentItems.push(item);
      itemsByProduct.set(item.id_ficha, currentItems);
    }

    return Response.json({
      produtos: products.data.map((product) => ({
        ...product,
        categoria_nome:
          product.id_categoria === null
            ? null
            : categoryById.get(product.id_categoria) ?? null,
        itens: (itemsByProduct.get(product.id_ficha) ?? [])
          .map((item) => ({
            ...item,
            insumo: supplyById.get(item.id_insumo) ?? null,
          })),
      })),
      categorias: categories.data,
      insumos: supplies.data,
      ajustes: adjustments.data.map((adjustment) => ({
        ...adjustment,
        nome_produto:
          products.data.find(
            (product) => product.id_ficha === adjustment.id_ficha,
          )?.nome_receita ?? "Produto",
      })),
    });
  },
);

function createSaveHandler(method: "POST" | "PATCH") {
  return createProtectedSupabaseHandler(
    `produtos-${method.toLowerCase()}`,
    async (request, supabase) => {
      const body = await readJsonRecord(request);
      if (isErrorResponse(body)) return body;
      const product = parseProductInput(body, method === "PATCH");
      if (!product) {
        return Response.json(
          { error: "Informe os dados válidos do produto e de sua ficha." },
          { status: 400 },
        );
      }

      const { data, error } = await supabase.rpc("save_ficha", {
        p_id_ficha: product.id_ficha,
        p_nome_receita: product.nome_receita,
        p_rendimento: product.rendimento,
        p_id_categoria: product.id_categoria,
        p_custo_embalagem: product.custo_embalagem,
        p_custo_mao_obra: product.custo_mao_obra,
        p_custo_armazenamento: product.custo_armazenamento,
        p_preco_venda: product.preco_venda,
        p_ativo: product.ativo,
        p_itens: product.itens,
      });

      if (error) {
        const response = rpcErrorResponse(error);
        if (response) return response;
        throw error;
      }
      return Response.json(
        { id_ficha: data },
        { status: method === "POST" ? 201 : 200 },
      );
    },
  );
}

export const POST = createSaveHandler("POST");
export const PATCH = createSaveHandler("PATCH");
