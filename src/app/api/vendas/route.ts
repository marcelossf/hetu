import type { NextRequest } from "next/server";
import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";
import { rpcErrorResponse } from "@/lib/api/rpc-error-response";

export const GET = createProtectedSupabaseHandler(
  "vendas-listagem",
  async (_request, supabase) => {
    const [channels, products, sales] = await Promise.all([
      supabase
        .from("db_canais_vendas")
        .select("id, nome, ativo")
        .order("nome"),
      supabase
        .from("db_fichas")
        .select(
          "id_ficha, nome_receita, preco_venda, custo_unitario, estoque_atual",
        )
        .eq("ativo", "Sim")
        .order("nome_receita"),
      supabase
        .from("db_vendas_cabecalho")
        .select(
          "id, data_venda, id_canal, subtotal_pedido, desconto, valor_total_pedido, status, observacoes, cancelada_em",
        )
        .order("data_venda", { ascending: false })
        .limit(100),
    ]);

    if (channels.error) throw channels.error;
    if (products.error) throw products.error;
    if (sales.error) throw sales.error;
    const saleIds = sales.data.map((sale) => sale.id);
    const [saleItems, payments] = saleIds.length
      ? await Promise.all([
          supabase
            .from("db_vendas_itens")
            .select(
              "id_venda_item, id_venda, id_produto, nome_produto, quantidade, preco_venda_unitario, custo_unitario_historico, subtotal",
            )
            .in("id_venda", saleIds),
          supabase
            .from("db_vendas_pagamentos")
            .select("id_pagamento, id_venda, forma_pagamento, valor")
            .in("id_venda", saleIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (saleItems.error) throw saleItems.error;
    if (payments.error) throw payments.error;

    const channelNames = new Map(
      channels.data.map((channel) => [channel.id, channel.nome]),
    );
    return Response.json({
      canais: channels.data,
      produtos: products.data,
      vendas: sales.data.map((sale) => ({
        ...sale,
        nome_canal: channelNames.get(sale.id_canal) ?? "Canal inativo",
        itens: saleItems.data.filter((item) => item.id_venda === sale.id),
        pagamentos: payments.data.filter(
          (payment) => payment.id_venda === sale.id,
        ),
      })),
    });
  },
);

export const POST = createProtectedSupabaseHandler(
  "vendas-registro",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      typeof body.id_canal !== "number" ||
      !Number.isSafeInteger(body.id_canal) ||
      body.id_canal < 1 ||
      typeof body.subtotal !== "number" ||
      !Number.isFinite(body.subtotal) ||
      body.subtotal < 0 ||
      body.subtotal > 99_999_999.99 ||
      Math.round(body.subtotal * 100) / 100 !== body.subtotal ||
      typeof body.desconto !== "number" ||
      !Number.isFinite(body.desconto) ||
      body.desconto < 0 ||
      body.desconto > 99_999_999.99 ||
      Math.round(body.desconto * 100) / 100 !== body.desconto ||
      typeof body.observacoes !== "string" ||
      body.observacoes.length > 1000 ||
      !Array.isArray(body.itens) ||
      !Array.isArray(body.pagamentos)
    ) {
      return Response.json(
        { error: "Informe os dados válidos da venda." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("register_sale", {
      p_id_canal: body.id_canal,
      p_subtotal: body.subtotal,
      p_desconto: body.desconto,
      p_observacoes: body.observacoes.trim() || null,
      p_itens: body.itens,
      p_pagamentos: body.pagamentos,
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ id_venda: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "vendas-cancelamento",
  async (request: NextRequest, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      typeof body.id_venda !== "number" ||
      !Number.isSafeInteger(body.id_venda) ||
      body.id_venda < 1
    ) {
      return Response.json(
        { error: "Informe o identificador da venda." },
        { status: 400 },
      );
    }

    const { error } = await supabase.rpc("cancel_sale", {
      p_id_venda: body.id_venda,
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ sucesso: true });
  },
);
