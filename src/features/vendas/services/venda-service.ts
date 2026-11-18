import { requestProtectedJson } from "@/lib/api/protected-client";
import type { CanalVenda } from "@/features/cadastros/canais/services/canal-service";
export type ProdutoVenda = {
  id_ficha: number;
  nome_receita: string;
  preco_venda: number;
  custo_unitario: number;
  estoque_atual: number;
};
export type FormaPagamento =
  | "pix"
  | "dinheiro"
  | "cartao_debito"
  | "cartao_credito"
  | "transferencia"
  | "outro";
const formasPagamento: readonly FormaPagamento[] = [
  "pix",
  "dinheiro",
  "cartao_debito",
  "cartao_credito",
  "transferencia",
  "outro",
];
export type Venda = {
  id: number;
  data_venda: string;
  id_canal: number;
  nome_canal: string;
  subtotal_pedido: number;
  desconto: number;
  valor_total_pedido: number;
  status: "concluida" | "cancelada";
  observacoes: string | null;
  cancelada_em: string | null;
  itens: Array<{
    id_venda_item: number;
    nome_produto: string;
    quantidade: number;
    preco_venda_unitario: number;
    subtotal: number;
  }>;
  pagamentos: Array<{
    id_pagamento: number;
    forma_pagamento: FormaPagamento;
    valor: number;
  }>;
};
export type VendaCatalogo = {
  canais: CanalVenda[];
  produtos: ProdutoVenda[];
  vendas: Venda[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
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

function isFormaPagamento(value: unknown): value is FormaPagamento {
  return (
    typeof value === "string" &&
    formasPagamento.some((option) => option === value)
  );
}

export async function getVendaCatalogo(
  accessToken: string,
): Promise<VendaCatalogo> {
  const response = await requestProtectedJson("/api/vendas", accessToken);
  if (
    !isRecord(response) ||
    !Array.isArray(response.canais) ||
    !Array.isArray(response.produtos) ||
    !Array.isArray(response.vendas)
  ) {
    throw new Error("O servidor retornou dados de vendas inválidos.");
  }

  const canais = response.canais.map((item): CanalVenda => {
    if (!isRecord(item) || (item.ativo !== "Sim" && item.ativo !== "Não")) {
      throw new Error("O servidor retornou um canal inválido.");
    }
    return {
      id: numberValue(item.id),
      nome: String(item.nome),
      ativo: item.ativo,
      endereco:
        typeof item.endereco === "string" ? item.endereco : null,
    };
  });
  const produtos = response.produtos.map((item): ProdutoVenda => {
    if (!isRecord(item)) throw new Error("O servidor retornou um produto inválido.");
    return {
      id_ficha: numberValue(item.id_ficha),
      nome_receita: String(item.nome_receita),
      preco_venda: numberValue(item.preco_venda),
      custo_unitario: numberValue(item.custo_unitario),
      estoque_atual: numberValue(item.estoque_atual),
    };
  });
  const vendas = response.vendas.map((item): Venda => {
    if (
      !isRecord(item) ||
      (item.status !== "concluida" && item.status !== "cancelada") ||
      !Array.isArray(item.itens) ||
      !Array.isArray(item.pagamentos)
    ) {
      throw new Error("O servidor retornou uma venda inválida.");
    }
    return {
      id: numberValue(item.id),
      data_venda: String(item.data_venda),
      id_canal: numberValue(item.id_canal),
      nome_canal: String(item.nome_canal),
      subtotal_pedido: numberValue(item.subtotal_pedido),
      desconto: numberValue(item.desconto),
      valor_total_pedido: numberValue(item.valor_total_pedido),
      status: item.status,
      observacoes: typeof item.observacoes === "string" ? item.observacoes : null,
      cancelada_em:
        typeof item.cancelada_em === "string" ? item.cancelada_em : null,
      itens: item.itens.map((saleItem) => {
        if (!isRecord(saleItem)) throw new Error("O servidor retornou um item inválido.");
        return {
          id_venda_item: numberValue(saleItem.id_venda_item),
          nome_produto: String(saleItem.nome_produto),
          quantidade: numberValue(saleItem.quantidade),
          preco_venda_unitario: numberValue(saleItem.preco_venda_unitario),
          subtotal: numberValue(saleItem.subtotal),
        };
      }),
      pagamentos: item.pagamentos.map((payment) => {
        if (
          !isRecord(payment) ||
          !isFormaPagamento(payment.forma_pagamento)
        ) {
          throw new Error("O servidor retornou um pagamento inválido.");
        }
        return {
          id_pagamento: numberValue(payment.id_pagamento),
          forma_pagamento: payment.forma_pagamento,
          valor: numberValue(payment.valor),
        };
      }),
    };
  });

  return { canais, produtos, vendas };
}

export async function registerVenda(
  accessToken: string,
  input: {
    id_canal: number;
    subtotal: number;
    desconto: number;
    observacoes: string;
    itens: Array<{ id_produto: number; quantidade: number }>;
    pagamentos: Array<{ forma_pagamento: FormaPagamento; valor: number }>;
  },
): Promise<void> {
  await requestProtectedJson("/api/vendas", accessToken, {
    method: "POST",
    body: input,
  });
}

export async function cancelVenda(
  accessToken: string,
  id_venda: number,
): Promise<void> {
  await requestProtectedJson("/api/vendas", accessToken, {
    method: "PATCH",
    body: { id_venda },
  });
}

