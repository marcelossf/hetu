import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";
import { rpcErrorResponse } from "@/lib/api/rpc-error-response";

export const POST = createProtectedSupabaseHandler(
  "produtos-ajuste-estoque",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      typeof body.id_ficha !== "number" ||
      !Number.isSafeInteger(body.id_ficha) ||
      body.id_ficha < 1 ||
      typeof body.quantidade_delta !== "number" ||
      !Number.isFinite(body.quantidade_delta) ||
      body.quantidade_delta === 0 ||
      Math.round(body.quantidade_delta * 100) / 100 !== body.quantidade_delta ||
      typeof body.motivo !== "string" ||
      !body.motivo.trim() ||
      body.motivo.trim().length > 300
    ) {
      return Response.json(
        { error: "Informe o produto, a variação do estoque e o motivo." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("adjust_product_stock", {
      p_id_ficha: body.id_ficha,
      p_quantidade_delta: body.quantidade_delta,
      p_motivo: body.motivo.trim(),
    });
    if (error) {
      const response = rpcErrorResponse(error);
      if (response) return response;
      throw error;
    }
    return Response.json({ estoque_atual: data });
  },
);
