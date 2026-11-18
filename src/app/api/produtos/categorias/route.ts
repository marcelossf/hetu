import type { NextRequest } from "next/server";
import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  readJsonRecord,
} from "@/lib/api/protected-supabase";

function parseCategoryName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export const GET = createProtectedSupabaseHandler(
  "produtos/categorias-listagem",
  async (_request, supabase) => {
    const { data, error } = await supabase
      .from("db_categoria_produto")
      .select("id, nome")
      .order("nome");
    if (error) throw error;
    return Response.json({ categorias: data });
  },
);

export const POST = createProtectedSupabaseHandler(
  "produtos/categorias-criacao",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const nome = parseCategoryName(body.nome);
    if (!nome || nome.length > 100) {
      return Response.json(
        { error: "Informe um nome de categoria com até 100 caracteres." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("db_categoria_produto")
      .insert({ nome })
      .select("id, nome")
      .single();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe uma categoria de produto com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    return Response.json({ categoria: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "produtos/categorias-atualizacao",
  async (request: NextRequest, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;
    const id = body.id;
    const nome = parseCategoryName(body.nome);
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !nome ||
      nome.length > 100
    ) {
      return Response.json(
        { error: "Informe o identificador e um nome de categoria válido." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("db_categoria_produto")
      .update({ nome })
      .eq("id", id)
      .select("id, nome")
      .maybeSingle();
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe uma categoria de produto com esse nome." },
        { status: 409 },
      );
    }
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Categoria de produto não encontrada." }, {
        status: 404,
      });
    }
    return Response.json({ categoria: data });
  },
);
