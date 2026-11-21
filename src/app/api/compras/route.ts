import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  isJsonRecord,
  readJsonRecord,
} from "@/lib/api/protected-supabase";
import { rpcErrorResponse } from "@/lib/api/rpc-error-response";
import { isDateOnly } from "@/lib/date-only";

const maximumMoneyValue = 99_999_999.99;
const maximumQuantity = 99_999_999.9999;
const purchaseFields = new Set(["id_fornecedor", "data_compra", "itens"]);
const purchaseItemFields = new Set(["id_insumo", "quantidade", "valor_total"]);
const batchIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= maximumQuantity &&
    Math.abs(value * 10_000 - Math.round(value * 10_000)) < 0.000001
  );
}

function isMoney(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= maximumMoneyValue &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

export const GET = createProtectedSupabaseHandler(
  "compras-listagem",
  async (_request, supabase) => {
    const [suppliers, supplies, purchases] = await Promise.all([
      supabase
        .from("db_fornecedores")
        .select("id_fornecedor, nome, endereco, ativo")
        .order("nome"),
      supabase
        .from("db_insumos")
        .select(
          "id_insumo, nome, unidade, categoria, custo_estimado_unitario, estoque_atual, ativo",
        )
        .order("nome"),
      supabase
        .from("db_compras_historico")
        .select(
          "id_compra, id_lote, data_compra, id_insumo, id_fornecedor, quantidade, unidade_compra, valor_total, valor_unitario, tipo_movimento, status, id_compra_compensada, motivo_cancelamento, registrado_em, cancelado_em, cancelado_por",
        )
        .order("registrado_em", { ascending: false })
        .limit(500),
    ]);
    if (suppliers.error) throw suppliers.error;
    if (supplies.error) throw supplies.error;
    if (purchases.error) throw purchases.error;

    return Response.json({
      fornecedores: suppliers.data,
      insumos: supplies.data,
      compras: purchases.data,
    });
  },
);

export const POST = createProtectedSupabaseHandler(
  "compras-registro",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      Object.keys(body).some((field) => !purchaseFields.has(field)) ||
      typeof body.id_fornecedor !== "number" ||
      !Number.isSafeInteger(body.id_fornecedor) ||
      body.id_fornecedor < 1 ||
      !isDateOnly(body.data_compra) ||
      !Array.isArray(body.itens) ||
      body.itens.length < 1 ||
      body.itens.length > 100
    ) {
      return Response.json({ error: "Informe dados válidos da compra." }, {
        status: 400,
      });
    }

    const itens: Array<{
      id_insumo: number;
      quantidade: number;
      valor_total: number;
    }> = [];
    const supplyIds = new Set<number>();
    for (const value of body.itens) {
      if (
        !isJsonRecord(value) ||
        Object.keys(value).some((field) => !purchaseItemFields.has(field)) ||
        typeof value.id_insumo !== "number" ||
        !Number.isSafeInteger(value.id_insumo) ||
        value.id_insumo < 1 ||
        !isQuantity(value.quantidade) ||
        !isMoney(value.valor_total) ||
        supplyIds.has(value.id_insumo)
      ) {
        return Response.json({ error: "Confira os itens da compra." }, {
          status: 400,
        });
      }
      supplyIds.add(value.id_insumo);
      itens.push({
        id_insumo: value.id_insumo,
        quantidade: value.quantidade,
        valor_total: value.valor_total,
      });
    }

    const { data, error } = await supabase.rpc("register_purchase_batch", {
      p_id_fornecedor: body.id_fornecedor,
      p_data_compra: body.data_compra,
      p_itens: itens,
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ id_lote: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "compras-cancelamento",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      Object.keys(body).length !== 2 ||
      typeof body.id_lote !== "string" ||
      !batchIdPattern.test(body.id_lote) ||
      typeof body.motivo !== "string" ||
      !body.motivo.trim() ||
      body.motivo.trim().length > 300
    ) {
      return Response.json(
        { error: "Informe o lote e o motivo do cancelamento." },
        { status: 400 },
      );
    }

    const { error } = await supabase.rpc("cancel_purchase_batch", {
      p_id_lote: body.id_lote,
      p_motivo: body.motivo.trim(),
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ sucesso: true });
  },
);
