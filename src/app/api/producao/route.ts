import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";
import { rpcErrorResponse } from "@/lib/api/rpc-error-response";

export const GET = createProtectedSupabaseHandler(
  "producao-listagem",
  async (_request, supabase) => {
    const [products, ingredients, recipeItems, production] =
      await Promise.all([
        supabase
          .from("db_fichas")
          .select("id_ficha, nome_receita, custo_unitario, estoque_atual, ativo")
          .order("nome_receita"),
        supabase
          .from("db_insumos")
          .select("id_insumo, nome, unidade, estoque_atual, ativo")
          .order("nome"),
        supabase
          .from("db_fichas_itens")
          .select("id_ficha, id_insumo, qtd_insumo"),
        supabase
          .from("db_producao")
          .select(
            "id_producao, data_producao, id_produto, qtd_produzida, custo_unitario_momento, custo_total_lote, observacao",
          )
          .order("data_producao", { ascending: false })
          .limit(100),
      ]);

    if (products.error) throw products.error;
    if (ingredients.error) throw ingredients.error;
    if (recipeItems.error) throw recipeItems.error;
    if (production.error) throw production.error;

    const productionIds = production.data.map((record) => record.id_producao);
    const productionItems =
      productionIds.length > 0
        ? await supabase
            .from("db_producao_itens")
            .select("id_producao, id_insumo, qtd_consumida, custo_total")
            .in("id_producao", productionIds)
        : { data: [], error: null };
    if (productionItems.error) throw productionItems.error;

    const productNames = new Map(
      products.data.map((product) => [product.id_ficha, product.nome_receita]),
    );
    const ingredientNames = new Map(
      ingredients.data.map((ingredient) => [
        ingredient.id_insumo,
        ingredient.nome,
      ]),
    );

    return Response.json({
      produtos: products.data
        .filter((product) => product.ativo === "Sim")
        .map((product) => ({
          ...product,
          itens: recipeItems.data
            .filter((item) => item.id_ficha === product.id_ficha)
            .map((item) => ({
              ...item,
              insumo:
                ingredients.data.find(
                  (ingredient) => ingredient.id_insumo === item.id_insumo,
                ) ?? null,
            })),
        })),
      insumos: ingredients.data,
      producoes: production.data.map((record) => ({
        ...record,
        nome_produto: productNames.get(record.id_produto) ?? "Produto",
        itens: productionItems.data
          .filter((item) => item.id_producao === record.id_producao)
          .map((item) => ({
            ...item,
            nome_insumo: ingredientNames.get(item.id_insumo) ?? "Insumo",
          })),
      })),
    });
  },
);

export const POST = createProtectedSupabaseHandler(
  "producao-registro",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const observacao =
      body.observacao === undefined || body.observacao === null
        ? null
        : typeof body.observacao === "string"
          ? body.observacao.trim() || null
          : undefined;
    if (
      typeof body.id_produto !== "number" ||
      !Number.isSafeInteger(body.id_produto) ||
      body.id_produto < 1 ||
      typeof body.quantidade !== "number" ||
      !Number.isFinite(body.quantidade) ||
      body.quantidade <= 0 ||
      body.quantidade > 99_999_999.99 ||
      Math.round(body.quantidade * 100) / 100 !== body.quantidade ||
      observacao === undefined ||
      (observacao !== null && observacao.length > 1000)
    ) {
      return Response.json(
        { error: "Informe um produto, quantidade e observação válidos." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("register_production", {
      p_id_produto: body.id_produto,
      p_quantidade: body.quantidade,
      p_observacao: observacao,
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ id_producao: data }, { status: 201 });
  },
);
