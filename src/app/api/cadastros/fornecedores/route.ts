import type { NextRequest } from "next/server";
import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  isJsonRecord,
  readJsonRecord,
} from "@/lib/api/protected-supabase";

const allowedFields = new Set(["id_fornecedor", "nome", "endereco", "ativo"]);

function hasOnlyAllowedFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((field) => allowedFields.has(field));
}

function parseSupplier(
  value: Record<string, unknown>,
  requireId: boolean,
):
  | {
      id_fornecedor: number | undefined;
      nome: string;
      endereco: string | null;
      ativo: "Sim" | "Não";
    }
  | null {
  if (!isJsonRecord(value) || !hasOnlyAllowedFields(value)) return null;
  const id = value.id_fornecedor;
  const nome = typeof value.nome === "string"
    ? value.nome.trim().replace(/\s+/g, " ")
    : "";
  const endereco =
    typeof value.endereco === "string"
      ? value.endereco.trim().replace(/\s+/g, " ") || null
      : value.endereco === null || value.endereco === undefined
        ? null
        : "";
  const ativo = value.ativo ?? "Sim";
  if (
    !nome ||
    nome.length > 120 ||
    (endereco !== null && (typeof endereco !== "string" || endereco.length > 300)) ||
    (ativo !== "Sim" && ativo !== "Não") ||
    (requireId &&
      (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1))
  ) {
    return null;
  }
  return {
    id_fornecedor:
      typeof id === "number" ? id : undefined,
    nome,
    endereco,
    ativo,
  };
}

export const GET = createProtectedSupabaseHandler(
  "cadastros/fornecedores-listagem",
  async (_request, supabase) => {
    const { data, error } = await supabase
      .from("db_fornecedores")
      .select("id_fornecedor, nome, endereco, ativo, criado_em, atualizado_em")
      .order("nome");
    if (error) throw error;
    return Response.json({ fornecedores: data });
  },
);

export const POST = createProtectedSupabaseHandler(
  "cadastros/fornecedores-criacao",
  async (request: NextRequest, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const supplier = parseSupplier(body, false);
    if (!supplier || supplier.id_fornecedor !== undefined) {
      return Response.json({ error: "Informe dados válidos do fornecedor." }, {
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("db_fornecedores")
      .insert({
        nome: supplier.nome,
        endereco: supplier.endereco,
        ativo: supplier.ativo,
      })
      .select("id_fornecedor, nome, endereco, ativo, criado_em, atualizado_em")
      .single();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe um fornecedor com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    return Response.json({ fornecedor: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "cadastros/fornecedores-atualizacao",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const supplier = parseSupplier(body, true);
    if (!supplier || supplier.id_fornecedor === undefined) {
      return Response.json({ error: "Informe dados válidos do fornecedor." }, {
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("db_fornecedores")
      .update({
        nome: supplier.nome,
        endereco: supplier.endereco,
        ativo: supplier.ativo,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id_fornecedor", supplier.id_fornecedor)
      .select("id_fornecedor, nome, endereco, ativo, criado_em, atualizado_em")
      .maybeSingle();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe um fornecedor com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Fornecedor não encontrado." }, {
        status: 404,
      });
    }
    return Response.json({ fornecedor: data });
  },
);

export const DELETE = createProtectedSupabaseHandler(
  "cadastros/fornecedores-remocao",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    if (
      Object.keys(body).length !== 1 ||
      typeof body.id_fornecedor !== "number" ||
      !Number.isSafeInteger(body.id_fornecedor) ||
      body.id_fornecedor < 1
    ) {
      return Response.json({ error: "Informe o fornecedor a desativar." }, {
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("db_fornecedores")
      .update({ ativo: "Não", atualizado_em: new Date().toISOString() })
      .eq("id_fornecedor", body.id_fornecedor)
      .select("id_fornecedor")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Fornecedor não encontrado." }, {
        status: 404,
      });
    }
    return Response.json({ sucesso: true });
  },
);
