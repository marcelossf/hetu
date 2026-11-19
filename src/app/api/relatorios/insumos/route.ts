import { createProtectedSupabaseHandler } from "@/lib/api/protected-supabase";

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export const GET = createProtectedSupabaseHandler(
  "relatorio-insumos",
  async (request, supabase) => {
    const query = new URL(request.url).searchParams;
    const start = query.get("data_inicio");
    const end = query.get("data_fim");
    const rawId = query.get("id_insumo");
    const id = rawId ? Number(rawId) : null;
    if (
      !validDate(start) ||
      !validDate(end) ||
      start > end ||
      (id !== null && (!Number.isSafeInteger(id) || id < 1))
    ) {
      return Response.json(
        { error: "Informe filtros válidos para o relatório." },
        { status: 400 },
      );
    }

    const endAt = new Date(`${end}T00:00:00-03:00`);
    endAt.setUTCDate(endAt.getUTCDate() + 1);
    let purchasesQuery = supabase
      .from("db_compras_historico")
      .select(
        "id_compra, id_lote, data_compra, id_insumo, id_fornecedor, quantidade, unidade_compra, valor_total, valor_unitario, tipo_movimento, status",
      )
      .gte("data_compra", `${start}T00:00:00-03:00`)
      .lt("data_compra", endAt.toISOString())
      .order("data_compra", { ascending: true });
    if (id) purchasesQuery = purchasesQuery.eq("id_insumo", id);

    const [supplies, suppliers, purchases] = await Promise.all([
      supabase
        .from("db_insumos")
        .select("id_insumo, nome, unidade, ativo")
        .order("nome"),
      supabase
        .from("db_fornecedores")
        .select("id_fornecedor, nome")
        .order("nome"),
      purchasesQuery,
    ]);
    if (supplies.error) throw supplies.error;
    if (suppliers.error) throw suppliers.error;
    if (purchases.error) throw purchases.error;

    const supplierNames = new Map(
      suppliers.data.map((supplier) => [
        supplier.id_fornecedor,
        supplier.nome,
      ]),
    );
    const supplyNames = new Map(
      supplies.data.map((supply) => [supply.id_insumo, supply.nome]),
    );
    return Response.json({
      insumos: supplies.data,
      movimentacoes: purchases.data.map((purchase) => ({
        ...purchase,
        nome_insumo: supplyNames.get(purchase.id_insumo) ?? "Insumo",
        nome_fornecedor:
          supplierNames.get(purchase.id_fornecedor) ?? "Fornecedor",
      })),
    });
  },
);
