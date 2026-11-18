import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  createProtectedSupabaseHandler,
  isErrorResponse,
  isJsonRecord,
  readJsonRecord,
} from "@/lib/api/protected-supabase";

const maximumMoneyValue = 99_999_999.99;

function isValidAmount(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximumMoneyValue
  ) {
    return false;
  }
  return Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

async function validateUnitsAndCategories(
  supabase: SupabaseClient<Database>,
  units: string[],
  categories: string[],
): Promise<Response | null> {
  const [unitResult, categoryResult] = await Promise.all([
    supabase.from("db_unidades").select("nome").in("nome", units),
    supabase
      .from("db_categoria_insumo")
      .select("nome")
      .in("nome", categories),
  ]);
  if (unitResult.error) throw unitResult.error;
  if (categoryResult.error) throw categoryResult.error;
  const foundUnits = new Set(unitResult.data.map((unit) => unit.nome));
  const foundCategories = new Set(
    categoryResult.data.map((category) => category.nome),
  );
  if (units.some((unit) => !foundUnits.has(unit))) {
    return Response.json({ error: "Selecione uma unidade válida." }, { status: 400 });
  }
  if (categories.some((category) => !foundCategories.has(category))) {
    return Response.json(
      { error: "Selecione uma categoria de insumo válida." },
      { status: 400 },
    );
  }
  return null;
}

export const GET = createProtectedSupabaseHandler(
  "cadastros/insumos-listagem",
  async (_request, supabase) => {
    const [insumosResult, categoriesResult, unitsResult] = await Promise.all([
      supabase
        .from("db_insumos")
        .select(
          "id_insumo, nome, unidade, categoria, custo_estimado_unitario, estoque_atual, ativo",
        )
        .order("nome"),
      supabase.from("db_categoria_insumo").select("id, nome").order("nome"),
      supabase.from("db_unidades").select("id, nome").order("nome"),
    ]);

    if (insumosResult.error) throw insumosResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (unitsResult.error) throw unitsResult.error;

    return Response.json({
      insumos: insumosResult.data,
      categorias: categoriesResult.data,
      unidades: unitsResult.data,
    });
  },
);

export const POST = createProtectedSupabaseHandler(
  "cadastros/insumos-criacao",
  async (request: NextRequest, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;

    if (!Array.isArray(body.insumos) || body.insumos.length === 0) {
      return Response.json(
        { error: "Informe ao menos um insumo para cadastrar." },
        { status: 400 },
      );
    }
    if (body.insumos.length > 100) {
      return Response.json(
        { error: "Cadastre no máximo 100 insumos por vez." },
        { status: 400 },
      );
    }

    const insumos: Array<{
      nome: string;
      unidade: string;
      categoria: string;
      custo_estimado_unitario: number;
      estoque_atual: number;
      ativo: string;
    }> = [];
    for (const [index, value] of body.insumos.entries()) {
      if (!isJsonRecord(value)) {
        return Response.json(
          { error: `Os dados do insumo ${index + 1} são inválidos.` },
          { status: 400 },
        );
      }

      const nome =
        typeof value.nome === "string"
          ? value.nome.trim().replace(/\s+/g, " ")
          : "";
      const unidade = typeof value.unidade === "string" ? value.unidade : "";
      const categoria =
        typeof value.categoria === "string" ? value.categoria : "";
      const custo = value.custoEstimadoUnitario;
      const estoque = value.estoqueAtual;
      if (
        !nome ||
        nome.length > 120 ||
        !unidade ||
        !categoria ||
        !isValidAmount(custo) ||
        !isValidAmount(estoque)
      ) {
        return Response.json(
          {
            error: `Preencha os campos do insumo ${index + 1} com valores válidos.`,
          },
          { status: 400 },
        );
      }

      insumos.push({
        nome,
        unidade,
        categoria,
        custo_estimado_unitario: custo,
        estoque_atual: estoque,
        ativo: "Sim",
      });
    }

    const names = new Set<string>();
    for (const insumo of insumos) {
      const normalizedName = insumo.nome.toLocaleLowerCase("pt-BR");
      if (names.has(normalizedName)) {
        return Response.json(
          { error: "A lista contém insumos com nomes repetidos." },
          { status: 409 },
        );
      }
      names.add(normalizedName);
    }

    const referenceError = await validateUnitsAndCategories(
      supabase,
      [...new Set(insumos.map((insumo) => insumo.unidade))],
      [...new Set(insumos.map((insumo) => insumo.categoria))],
    );
    if (referenceError) return referenceError;

    const { data, error } = await supabase
      .from("db_insumos")
      .insert(insumos)
      .select(
        "id_insumo, nome, unidade, categoria, custo_estimado_unitario, estoque_atual, ativo",
      );
    if (error?.code === "23505") {
      return Response.json(
        { error: "Já existe um insumo com um dos nomes informados." },
        { status: 409 },
      );
    }
    if (error) throw error;

    return Response.json({ insumos: data }, { status: 201 });
  },
);

export const PATCH = createProtectedSupabaseHandler(
  "cadastros/insumos-atualizacao",
  async (request, supabase) => {
    const body = await readJsonRecord(request);
    if (isErrorResponse(body)) return body;

    const id = body.id_insumo;
    const unidade = typeof body.unidade === "string" ? body.unidade : "";
    const categoria = typeof body.categoria === "string" ? body.categoria : "";
    const estoque = body.estoqueAtual;
    const ativo = body.ativo;

    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !unidade ||
      !categoria ||
      !isValidAmount(estoque) ||
      (ativo !== "Sim" && ativo !== "Não")
    ) {
      return Response.json(
        { error: "Preencha os campos do insumo com valores válidos." },
        { status: 400 },
      );
    }

    const referenceError = await validateUnitsAndCategories(
      supabase,
      [unidade],
      [categoria],
    );
    if (referenceError) return referenceError;

    const { data, error } = await supabase
      .from("db_insumos")
      .update({
        unidade,
        categoria,
        estoque_atual: estoque,
        ativo,
      })
      .eq("id_insumo", id)
      .select(
        "id_insumo, nome, unidade, categoria, custo_estimado_unitario, estoque_atual, ativo",
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Insumo não encontrado." }, { status: 404 });
    }

    return Response.json({ insumo: data });
  },
);
