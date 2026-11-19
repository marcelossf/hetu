import {
  createProtectedSupabaseHandler,
} from "@/lib/api/protected-supabase";

function parseDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function parseId(value: string | null): number | null | undefined {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const GET = createProtectedSupabaseHandler(
  "relatorio-vendas",
  async (request, supabase) => {
    const query = new URL(request.url).searchParams;
    const start = parseDate(query.get("data_inicio"));
    const end = parseDate(query.get("data_fim"));
    const productId = parseId(query.get("id_produto"));
    const channelId = parseId(query.get("id_canal"));
    const status = query.get("status") ?? "concluida";

    if (
      !start ||
      !end ||
      start > end ||
      productId === undefined ||
      channelId === undefined ||
      !["concluida", "cancelada", "todas"].includes(status)
    ) {
      return Response.json(
        { error: "Informe filtros válidos para o relatório de vendas." },
        { status: 400 },
      );
    }

    const startAt = new Date(`${start}T00:00:00-03:00`);
    const endAt = new Date(`${end}T00:00:00-03:00`);
    endAt.setUTCDate(endAt.getUTCDate() + 1);

    let salesQuery = supabase
      .from("db_vendas_cabecalho")
      .select(
        "id, data_venda, id_canal, subtotal_pedido, desconto, valor_total_pedido, status, observacoes",
      )
      .gte("data_venda", startAt.toISOString())
      .lt("data_venda", endAt.toISOString())
      .order("data_venda", { ascending: true });
    if (channelId) salesQuery = salesQuery.eq("id_canal", channelId);
    if (status === "concluida" || status === "cancelada") {
      salesQuery = salesQuery.eq("status", status);
    }

    const [channels, products, sales] = await Promise.all([
      supabase
        .from("db_canais_vendas")
        .select("id, nome, ativo")
        .order("nome"),
      supabase
        .from("db_fichas")
        .select("id_ficha, nome_receita, ativo")
        .order("nome_receita"),
      salesQuery,
    ]);
    if (channels.error) throw channels.error;
    if (products.error) throw products.error;
    if (sales.error) throw sales.error;

    const saleIds = sales.data.map((sale) => sale.id);
    const items = saleIds.length
      ? await supabase
          .from("db_vendas_itens")
          .select(
            "id_venda_item, id_venda, id_produto, nome_produto, quantidade, preco_venda_unitario, custo_unitario_historico, subtotal",
          )
          .in("id_venda", saleIds)
      : { data: [], error: null };
    if (items.error) throw items.error;

    const allowedSaleIds = productId
      ? new Set(
          items.data
            .filter((item) => item.id_produto === productId)
            .map((item) => item.id_venda),
        )
      : null;
    const channelNames = new Map(
      channels.data.map((channel) => [channel.id, channel.nome]),
    );

    return Response.json({
      canais: channels.data,
      produtos: products.data,
      vendas: sales.data
        .filter((sale) => !allowedSaleIds || allowedSaleIds.has(sale.id))
        .map((sale) => ({
          ...sale,
          nome_canal:
            channelNames.get(sale.id_canal ?? 0) ?? "Canal não informado",
          itens: items.data.filter(
            (item) =>
              item.id_venda === sale.id &&
              (productId === null || item.id_produto === productId),
          ),
        })),
    });
  },
);
