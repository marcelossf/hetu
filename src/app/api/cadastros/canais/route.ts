import type { NextRequest } from "next/server";
import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";

function parseChannel(
  body: Record<string, unknown>,
): { nome: string; endereco: string | null; ativo: "Sim" | "Não" } | null {
  const nome =
    typeof body.nome === "string" ? body.nome.trim().replace(/\s+/g, " ") : "";
  const rawAddress = body.endereco;
  const endereco =
    rawAddress === undefined || rawAddress === null
      ? ""
      : typeof rawAddress === "string"
        ? rawAddress.trim()
        : null;
  const ativo: "Sim" | "Não" | null =
    body.ativo === undefined || body.ativo === "Sim"
      ? "Sim"
      : body.ativo === "Não"
        ? "Não"
        : null;

  if (
    !nome ||
    nome.length > 100 ||
    endereco === null ||
    endereco.length > 300 ||
    ativo === null
  ) {
    return null;
  }
  return { nome, endereco: endereco || null, ativo };
}

export const GET = createProtectedSupabaseHandler(
  "cadastros/canais-listagem",
  async (_request, supabase) => {
    const { data, error } = await supabase
      .from("db_canais_vendas")
      .select("id, nome, endereco, ativo")
      .order("nome");
    if (error) throw error;

    return Response.json({ canais: data });
  },
);

export const POST = createProtectedSupabaseHandler(
  "cadastros/canais-criacao",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const channel = parseChannel(body);
    if (!channel) {
      return Response.json(
        { error: "Informe um nome e dados válidos para o canal de venda." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("db_canais_vendas")
      .insert(channel)
      .select("id, nome, endereco, ativo")
      .single();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe um canal de venda com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    return Response.json({ canal: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "cadastros/canais-atualizacao",
  async (request: NextRequest, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const id = body.id;
    const channel = parseChannel(body);
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !channel
    ) {
      return Response.json(
        { error: "Informe o identificador e os dados válidos do canal." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("db_canais_vendas")
      .update(channel)
      .eq("id", id)
      .select("id, nome, endereco, ativo")
      .maybeSingle();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe um canal de venda com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Canal de venda não encontrado." }, {
        status: 404,
      });
    }
    return Response.json({ canal: data });
  },
);
