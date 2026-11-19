import { createProtectedSupabaseHandler } from "@/lib/api/protected-supabase";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export const GET = createProtectedSupabaseHandler(
  "relatorio-fichas",
  async (request, supabase) => {
    const query = new URL(request.url).searchParams;
    const start = query.get("data_inicio");
    const end = query.get("data_fim");
    const rawProductId = query.get("id_ficha");
    const rawSupplyId = query.get("id_insumo");
    const productId = rawProductId ? Number(rawProductId) : null;
    const supplyId = rawSupplyId ? Number(rawSupplyId) : null;
    if (
      !validDate(start) ||
      !validDate(end) ||
      start > end ||
      (productId !== null &&
        (!Number.isSafeInteger(productId) || productId < 1)) ||
      (supplyId !== null &&
        (!Number.isSafeInteger(supplyId) || supplyId < 1))
    ) {
      return Response.json(
        { error: "Informe filtros válidos para o relatório." },
        { status: 400 },
      );
    }

    const endAt = new Date(`${end}T00:00:00-03:00`);
    endAt.setUTCDate(endAt.getUTCDate() + 1);
    let historyQuery = supabase
      .from("db_fichas_historico_custos")
      .select(
        "id_historico, data_alteracao, id_ficha, id_insumo_alterado, preco_insumo_anterior, preco_insumo_novo, impacto_diferenca_brl, novo_custo_total_ficha, id_compra_origem, id_lote_compra, tipo_movimento",
      )
      .gte("data_alteracao", `${start}T00:00:00-03:00`)
      .lt("data_alteracao", endAt.toISOString())
      .order("data_alteracao", { ascending: true });
    if (productId) historyQuery = historyQuery.eq("id_ficha", productId);
    if (supplyId) {
      historyQuery = historyQuery.eq("id_insumo_alterado", supplyId);
    }

    const [products, supplies, history] = await Promise.all([
      supabase
        .from("db_fichas")
        .select("id_ficha, nome_receita, custo_unitario, ativo")
        .order("nome_receita"),
      supabase
        .from("db_insumos")
        .select("id_insumo, nome")
        .order("nome"),
      historyQuery,
    ]);
    if (products.error) throw products.error;
    if (supplies.error) throw supplies.error;
    if (history.error) throw history.error;

    const productNames = new Map(
      products.data.map((product) => [product.id_ficha, product.nome_receita]),
    );
    const supplyNames = new Map(
      supplies.data.map((supply) => [supply.id_insumo, supply.nome]),
    );
    return Response.json({
      fichas: products.data,
      insumos: supplies.data,
      alteracoes: history.data.map((entry) => ({
        ...entry,
        nome_ficha: productNames.get(entry.id_ficha) ?? "Produto",
        nome_insumo:
          supplyNames.get(entry.id_insumo_alterado) ?? "Insumo removido",
      })),
    });
  },
);
