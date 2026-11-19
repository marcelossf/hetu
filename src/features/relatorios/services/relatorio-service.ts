import { requestProtectedJson } from "@/lib/api/protected-client";

export type RelatorioFiltros = {
  dataInicio: string;
  dataFim: string;
  id?: number;
  idProduto?: number;
  idCanal?: number;
  idInsumo?: number;
  status?: "concluida" | "cancelada" | "todas";
};

export type VendaRelatorio = {
  id: number;
  data_venda: string;
  id_canal: number;
  nome_canal: string;
  subtotal_pedido: number;
  desconto: number;
  valor_total_pedido: number;
  status: "concluida" | "cancelada";
  itens: Array<{
    id_venda_item: number;
    id_venda: number;
    id_produto: number;
    nome_produto: string;
    quantidade: number;
    preco_venda_unitario: number;
    custo_unitario_historico: number;
    subtotal: number;
  }>;
};

export type RelatorioVendas = {
  canais: Array<{ id: number; nome: string; ativo: "Sim" | "Não" }>;
  produtos: Array<{ id_ficha: number; nome_receita: string; ativo: "Sim" | "Não" }>;
  vendas: VendaRelatorio[];
};

export type RelatorioInsumoMovimento = {
  id_compra: number;
  data_compra: string;
  id_insumo: number;
  nome_insumo: string;
  nome_fornecedor: string;
  quantidade: number;
  unidade_compra: string;
  valor_total: number;
  valor_unitario: number;
  tipo_movimento: "compra" | "cancelamento";
  status: "registrada" | "cancelada" | "compensacao";
};

export type RelatorioInsumos = {
  insumos: Array<{
    id_insumo: number;
    nome: string;
    unidade: string;
    ativo: "Sim" | "Não";
  }>;
  movimentacoes: RelatorioInsumoMovimento[];
};

export type RelatorioFichaAlteracao = {
  id_historico: number;
  data_alteracao: string;
  id_ficha: number;
  nome_ficha: string;
  id_insumo_alterado: number;
  nome_insumo: string;
  preco_insumo_anterior: number;
  preco_insumo_novo: number;
  impacto_diferenca_brl: number;
  novo_custo_total_ficha: number;
  id_compra_origem: number | null;
  tipo_movimento: "compra" | "cancelamento";
};

export type RelatorioFichas = {
  fichas: Array<{
    id_ficha: number;
    nome_receita: string;
    custo_unitario: number;
    ativo: "Sim" | "Não";
  }>;
  insumos: Array<{ id_insumo: number; nome: string }>;
  alteracoes: RelatorioFichaAlteracao[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown, field: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`O relatório retornou ${field} inválido.`);
  }
  return parsed;
}

function baseQuery(filters: RelatorioFiltros): URLSearchParams {
  const query = new URLSearchParams({
    data_inicio: filters.dataInicio,
    data_fim: filters.dataFim,
  });
  if (filters.idProduto) query.set("id_produto", String(filters.idProduto));
  if (filters.idCanal) query.set("id_canal", String(filters.idCanal));
  if (filters.idInsumo) query.set("id_insumo", String(filters.idInsumo));
  if (filters.id) query.set("id_ficha", String(filters.id));
  if (filters.status) query.set("status", filters.status);
  return query;
}

export async function getRelatorioVendas(
  accessToken: string,
  filters: RelatorioFiltros,
): Promise<RelatorioVendas> {
  const response = await requestProtectedJson(
    `/api/relatorios/vendas?${baseQuery(filters)}`,
    accessToken,
  );
  if (
    !isRecord(response) ||
    !Array.isArray(response.canais) ||
    !Array.isArray(response.produtos) ||
    !Array.isArray(response.vendas)
  ) {
    throw new Error("O servidor retornou o relatório de vendas inválido.");
  }

  const canais = response.canais.map(
    (channel): RelatorioVendas["canais"][number] => {
    if (
      !isRecord(channel) ||
      typeof channel.id !== "number" ||
      typeof channel.nome !== "string" ||
      (channel.ativo !== "Sim" && channel.ativo !== "Não")
    ) {
      throw new Error("O relatório retornou um canal inválido.");
    }
    return {
      id: channel.id,
      nome: channel.nome,
      ativo: channel.ativo === "Sim" ? "Sim" : "Não",
    };
    },
  );
  const produtos = response.produtos.map(
    (product): RelatorioVendas["produtos"][number] => {
    if (
      !isRecord(product) ||
      typeof product.id_ficha !== "number" ||
      typeof product.nome_receita !== "string" ||
      (product.ativo !== "Sim" && product.ativo !== "Não")
    ) {
      throw new Error("O relatório retornou um produto inválido.");
    }
    return {
      id_ficha: product.id_ficha,
      nome_receita: product.nome_receita,
      ativo: product.ativo === "Sim" ? "Sim" : "Não",
    };
    },
  );
  const vendas = response.vendas.map((sale): VendaRelatorio => {
    if (
      !isRecord(sale) ||
      typeof sale.id !== "number" ||
      typeof sale.data_venda !== "string" ||
      typeof sale.id_canal !== "number" ||
      typeof sale.nome_canal !== "string" ||
      (sale.status !== "concluida" && sale.status !== "cancelada") ||
      !Array.isArray(sale.itens)
    ) {
      throw new Error("O relatório retornou uma venda inválida.");
    }
    return {
      id: sale.id,
      data_venda: sale.data_venda,
      id_canal: sale.id_canal,
      nome_canal: sale.nome_canal,
      subtotal_pedido: parseNumber(sale.subtotal_pedido, "subtotal"),
      desconto: parseNumber(sale.desconto, "desconto"),
      valor_total_pedido: parseNumber(sale.valor_total_pedido, "total"),
      status: sale.status,
      itens: sale.itens.map((item) => {
        if (
          !isRecord(item) ||
          typeof item.id_venda_item !== "number" ||
          typeof item.id_venda !== "number" ||
          typeof item.id_produto !== "number" ||
          typeof item.nome_produto !== "string"
        ) {
          throw new Error("O relatório retornou um item de venda inválido.");
        }
        return {
          id_venda_item: item.id_venda_item,
          id_venda: item.id_venda,
          id_produto: item.id_produto,
          nome_produto: item.nome_produto,
          quantidade: parseNumber(item.quantidade, "quantidade"),
          preco_venda_unitario: parseNumber(
            item.preco_venda_unitario,
            "preço unitário",
          ),
          custo_unitario_historico: parseNumber(
            item.custo_unitario_historico,
            "custo histórico",
          ),
          subtotal: parseNumber(item.subtotal, "subtotal do item"),
        };
      }),
    };
  });
  return { canais, produtos, vendas };
}

export async function getRelatorioInsumos(
  accessToken: string,
  filters: RelatorioFiltros,
): Promise<RelatorioInsumos> {
  const response = await requestProtectedJson(
    `/api/relatorios/insumos?${baseQuery(filters)}`,
    accessToken,
  );
  if (
    !isRecord(response) ||
    !Array.isArray(response.insumos) ||
    !Array.isArray(response.movimentacoes)
  ) {
    throw new Error("O servidor retornou o relatório de insumos inválido.");
  }
  return {
    insumos: response.insumos.map((supply) => {
      if (
        !isRecord(supply) ||
        typeof supply.id_insumo !== "number" ||
        typeof supply.nome !== "string" ||
        typeof supply.unidade !== "string" ||
        (supply.ativo !== "Sim" && supply.ativo !== "Não")
      ) {
        throw new Error("O relatório retornou um insumo inválido.");
      }
      return {
        id_insumo: supply.id_insumo,
        nome: supply.nome,
        unidade: supply.unidade,
        ativo: supply.ativo,
      };
    }),
    movimentacoes: response.movimentacoes.map(
      (movement): RelatorioInsumoMovimento => {
        if (
          !isRecord(movement) ||
          typeof movement.id_compra !== "number" ||
          typeof movement.data_compra !== "string" ||
          typeof movement.id_insumo !== "number" ||
          typeof movement.nome_insumo !== "string" ||
          typeof movement.nome_fornecedor !== "string" ||
          typeof movement.unidade_compra !== "string" ||
          (movement.tipo_movimento !== "compra" &&
            movement.tipo_movimento !== "cancelamento") ||
          (movement.status !== "registrada" &&
            movement.status !== "cancelada" &&
            movement.status !== "compensacao")
        ) {
          throw new Error("O relatório retornou uma movimentação inválida.");
        }
        return {
          id_compra: movement.id_compra,
          data_compra: movement.data_compra,
          id_insumo: movement.id_insumo,
          nome_insumo: movement.nome_insumo,
          nome_fornecedor: movement.nome_fornecedor,
          quantidade: parseNumber(movement.quantidade, "quantidade"),
          unidade_compra: movement.unidade_compra,
          valor_total: parseNumber(movement.valor_total, "valor total"),
          valor_unitario: parseNumber(
            movement.valor_unitario,
            "valor unitário",
          ),
          tipo_movimento: movement.tipo_movimento,
          status: movement.status,
        };
      },
    ),
  };
}

export async function getRelatorioFichas(
  accessToken: string,
  filters: RelatorioFiltros,
): Promise<RelatorioFichas> {
  const response = await requestProtectedJson(
    `/api/relatorios/fichas?${baseQuery(filters)}`,
    accessToken,
  );
  if (
    !isRecord(response) ||
    !Array.isArray(response.fichas) ||
    !Array.isArray(response.insumos) ||
    !Array.isArray(response.alteracoes)
  ) {
    throw new Error("O servidor retornou o relatório de fichas inválido.");
  }
  return {
    fichas: response.fichas.map((product) => {
      if (
        !isRecord(product) ||
        typeof product.id_ficha !== "number" ||
        typeof product.nome_receita !== "string" ||
        (product.ativo !== "Sim" && product.ativo !== "Não")
      ) {
        throw new Error("O relatório retornou uma ficha inválida.");
      }
      return {
        id_ficha: product.id_ficha,
        nome_receita: product.nome_receita,
        custo_unitario: parseNumber(product.custo_unitario, "custo unitário"),
        ativo: product.ativo,
      };
    }),
    insumos: response.insumos.map((supply) => {
      if (
        !isRecord(supply) ||
        typeof supply.id_insumo !== "number" ||
        typeof supply.nome !== "string"
      ) {
        throw new Error("O relatório retornou um insumo inválido.");
      }
      return { id_insumo: supply.id_insumo, nome: supply.nome };
    }),
    alteracoes: response.alteracoes.map(
      (entry): RelatorioFichaAlteracao => {
        if (
          !isRecord(entry) ||
          typeof entry.id_historico !== "number" ||
          typeof entry.data_alteracao !== "string" ||
          typeof entry.id_ficha !== "number" ||
          typeof entry.nome_ficha !== "string" ||
          typeof entry.id_insumo_alterado !== "number" ||
          typeof entry.nome_insumo !== "string" ||
          (entry.tipo_movimento !== "compra" &&
            entry.tipo_movimento !== "cancelamento")
        ) {
          throw new Error("O relatório retornou uma alteração inválida.");
        }
        return {
          id_historico: entry.id_historico,
          data_alteracao: entry.data_alteracao,
          id_ficha: entry.id_ficha,
          nome_ficha: entry.nome_ficha,
          id_insumo_alterado: entry.id_insumo_alterado,
          nome_insumo: entry.nome_insumo,
          preco_insumo_anterior: parseNumber(
            entry.preco_insumo_anterior,
            "preço anterior",
          ),
          preco_insumo_novo: parseNumber(
            entry.preco_insumo_novo,
            "preço novo",
          ),
          impacto_diferenca_brl: parseNumber(
            entry.impacto_diferenca_brl,
            "impacto",
          ),
          novo_custo_total_ficha: parseNumber(
            entry.novo_custo_total_ficha,
            "novo custo",
          ),
          id_compra_origem:
            entry.id_compra_origem === null
              ? null
              : parseNumber(entry.id_compra_origem, "compra de origem"),
          tipo_movimento: entry.tipo_movimento,
        };
      },
    ),
  };
}
