import type { Insumo } from "@/features/cadastros/insumos/services/insumo-service";
import { requestProtectedJson } from "@/lib/api/protected-client";

export type FornecedorCompra = {
  id_fornecedor: number;
  nome: string;
  endereco: string | null;
  ativo: "Sim" | "Não";
};

export type CompraMovimento = {
  id_compra: number;
  id_lote: string;
  data_compra: string;
  id_insumo: number;
  id_fornecedor: number;
  quantidade: number;
  unidade_compra: string;
  valor_total: number;
  valor_unitario: number;
  tipo_movimento: "compra" | "cancelamento";
  status: "registrada" | "cancelada" | "compensacao";
  id_compra_compensada: number | null;
  motivo_cancelamento: string | null;
  registrado_em: string;
  cancelado_em: string | null;
  cancelado_por: string | null;
};

export type CompraCatalogo = {
  fornecedores: FornecedorCompra[];
  insumos: Insumo[];
  compras: CompraMovimento[];
};

export type RegisterCompraInput = {
  id_fornecedor: number;
  data_compra: string;
  itens: Array<{
    id_insumo: number;
    quantidade: number;
    valor_total: number;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error("O servidor retornou um identificador inválido.");
  }
  return value;
}

function parseNumber(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error("O servidor retornou um valor numérico inválido.");
  }
  return parsed;
}

function parseOptionalString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new Error("O servidor retornou um texto inválido.");
}

function parseSupplier(value: unknown): FornecedorCompra {
  if (
    !isRecord(value) ||
    typeof value.nome !== "string" ||
    (value.endereco !== null && typeof value.endereco !== "string") ||
    (value.ativo !== "Sim" && value.ativo !== "Não")
  ) {
    throw new Error("O servidor retornou um fornecedor inválido.");
  }
  return {
    id_fornecedor: parseId(value.id_fornecedor),
    nome: value.nome,
    endereco: value.endereco,
    ativo: value.ativo,
  };
}

function parseSupply(value: unknown): Insumo {
  if (
    !isRecord(value) ||
    typeof value.nome !== "string" ||
    typeof value.unidade !== "string" ||
    (value.categoria !== null && typeof value.categoria !== "string") ||
    (value.ativo !== "Sim" && value.ativo !== "Não")
  ) {
    throw new Error("O servidor retornou um insumo inválido.");
  }
  return {
    id_insumo: parseId(value.id_insumo),
    nome: value.nome,
    unidade: value.unidade,
    categoria: value.categoria,
    custo_estimado_unitario: parseNumber(value.custo_estimado_unitario),
    estoque_atual: parseNumber(value.estoque_atual),
    ativo: value.ativo,
  };
}

function parsePurchase(value: unknown): CompraMovimento {
  if (
    !isRecord(value) ||
    typeof value.id_lote !== "string" ||
    typeof value.data_compra !== "string" ||
    typeof value.unidade_compra !== "string" ||
    (value.tipo_movimento !== "compra" &&
      value.tipo_movimento !== "cancelamento") ||
    (value.status !== "registrada" &&
      value.status !== "cancelada" &&
      value.status !== "compensacao") ||
    typeof value.registrado_em !== "string"
  ) {
    throw new Error("O servidor retornou uma compra inválida.");
  }
  return {
    id_compra: parseId(value.id_compra),
    id_lote: value.id_lote,
    data_compra: value.data_compra,
    id_insumo: parseId(value.id_insumo),
    id_fornecedor: parseId(value.id_fornecedor),
    quantidade: parseNumber(value.quantidade),
    unidade_compra: value.unidade_compra,
    valor_total: parseNumber(value.valor_total),
    valor_unitario: parseNumber(value.valor_unitario),
    tipo_movimento: value.tipo_movimento,
    status: value.status,
    id_compra_compensada:
      value.id_compra_compensada === null
        ? null
        : parseId(value.id_compra_compensada),
    motivo_cancelamento: parseOptionalString(value.motivo_cancelamento),
    registrado_em: value.registrado_em,
    cancelado_em: parseOptionalString(value.cancelado_em),
    cancelado_por: parseOptionalString(value.cancelado_por),
  };
}

export async function getCompraCatalogo(
  accessToken: string,
): Promise<CompraCatalogo> {
  const response = await requestProtectedJson("/api/compras", accessToken);
  if (
    !isRecord(response) ||
    !Array.isArray(response.fornecedores) ||
    !Array.isArray(response.insumos) ||
    !Array.isArray(response.compras)
  ) {
    throw new Error("O servidor retornou os dados de compras inválidos.");
  }
  return {
    fornecedores: response.fornecedores.map(parseSupplier),
    insumos: response.insumos.map(parseSupply),
    compras: response.compras.map(parsePurchase),
  };
}

export async function registerCompra(
  accessToken: string,
  input: RegisterCompraInput,
): Promise<string> {
  const response = await requestProtectedJson("/api/compras", accessToken, {
    method: "POST",
    body: input,
  });
  if (!isRecord(response) || typeof response.id_lote !== "string") {
    throw new Error("O servidor não confirmou o registro da compra.");
  }
  return response.id_lote;
}

export async function cancelCompra(
  accessToken: string,
  id_lote: string,
  motivo: string,
): Promise<void> {
  await requestProtectedJson("/api/compras", accessToken, {
    method: "PATCH",
    body: { id_lote, motivo },
  });
}
