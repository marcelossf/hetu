import { requestProtectedJson } from "@/lib/api/protected-client";

export type ProdutoParaProducao = {
  id_ficha: number;
  nome_receita: string;
  custo_unitario: number;
  estoque_atual: number;
  ativo: "Sim";
  itens: Array<{
    id_insumo: number;
    qtd_insumo: number;
    insumo: InsumoParaProducao | null;
  }>;
};

export type InsumoParaProducao = {
  id_insumo: number;
  nome: string;
  unidade: string;
  estoque_atual: number;
  ativo: "Sim" | "Não";
};

export type Producao = {
  id_producao: number;
  data_producao: string;
  id_produto: number;
  nome_produto: string;
  qtd_produzida: number;
  custo_unitario_momento: number;
  custo_total_lote: number;
  observacao: string | null;
  itens: Array<{
    id_insumo: number;
    nome_insumo: string;
    qtd_consumida: number;
    custo_total: number;
  }>;
};

export type ProducaoCatalogo = {
  produtos: ProdutoParaProducao[];
  insumos: InsumoParaProducao[];
  producoes: Producao[];
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

export async function getProducaoCatalogo(
  accessToken: string,
): Promise<ProducaoCatalogo> {
  const response = await requestProtectedJson("/api/producao", accessToken);
  if (
    !isRecord(response) ||
    !Array.isArray(response.produtos) ||
    !Array.isArray(response.insumos) ||
    !Array.isArray(response.producoes)
  ) {
    throw new Error("O servidor retornou dados de produção inválidos.");
  }

  const produtos = response.produtos.map((item): ProdutoParaProducao => {
    if (!isRecord(item) || item.ativo !== "Sim" || !Array.isArray(item.itens)) {
      throw new Error("O servidor retornou um produto para produção inválido.");
    }
    return {
      id_ficha: numberValue(item.id_ficha),
      nome_receita: String(item.nome_receita),
      custo_unitario: numberValue(item.custo_unitario),
      estoque_atual: numberValue(item.estoque_atual),
      ativo: "Sim",
      itens: item.itens.map((recipeItem) => {
        if (!isRecord(recipeItem) || !("insumo" in recipeItem)) {
          throw new Error("O servidor retornou uma ficha inválida.");
        }
        return {
          id_insumo: numberValue(recipeItem.id_insumo),
          qtd_insumo: numberValue(recipeItem.qtd_insumo),
          insumo:
            recipeItem.insumo === null
              ? null
              : (() => {
                  if (
                    !isRecord(recipeItem.insumo) ||
                    (recipeItem.insumo.ativo !== "Sim" &&
                      recipeItem.insumo.ativo !== "Não")
                  ) {
                    throw new Error("O servidor retornou um insumo inválido.");
                  }
                  return {
                    id_insumo: numberValue(recipeItem.insumo.id_insumo),
                    nome: String(recipeItem.insumo.nome),
                    unidade: String(recipeItem.insumo.unidade),
                    estoque_atual: numberValue(
                      recipeItem.insumo.estoque_atual,
                    ),
                    ativo: recipeItem.insumo.ativo,
                  };
                })(),
        };
      }),
    };
  });
  const insumos = response.insumos.map((item): InsumoParaProducao => {
    if (
      !isRecord(item) ||
      (item.ativo !== "Sim" && item.ativo !== "Não")
    ) {
      throw new Error("O servidor retornou um insumo para produção inválido.");
    }
    return {
      id_insumo: numberValue(item.id_insumo),
      nome: String(item.nome),
      unidade: String(item.unidade),
      estoque_atual: numberValue(item.estoque_atual),
      ativo: item.ativo,
    };
  });
  const producoes = response.producoes.map((item): Producao => {
    if (!isRecord(item) || !Array.isArray(item.itens)) {
      throw new Error("O servidor retornou um registro de produção inválido.");
    }
    return {
      id_producao: numberValue(item.id_producao),
      data_producao: String(item.data_producao),
      id_produto: numberValue(item.id_produto),
      nome_produto: String(item.nome_produto),
      qtd_produzida: numberValue(item.qtd_produzida),
      custo_unitario_momento: numberValue(item.custo_unitario_momento),
      custo_total_lote: numberValue(item.custo_total_lote),
      observacao: typeof item.observacao === "string" ? item.observacao : null,
      itens: item.itens.map((ingredient) => {
        if (!isRecord(ingredient)) {
          throw new Error("O servidor retornou um consumo inválido.");
        }
        return {
          id_insumo: numberValue(ingredient.id_insumo),
          nome_insumo: String(ingredient.nome_insumo),
          qtd_consumida: numberValue(ingredient.qtd_consumida),
          custo_total: numberValue(ingredient.custo_total),
        };
      }),
    };
  });
  return { produtos, insumos, producoes };
}

export async function registerProducao(
  accessToken: string,
  input: { id_produto: number; quantidade: number; observacao: string },
): Promise<void> {
  await requestProtectedJson("/api/producao", accessToken, {
    method: "POST",
    body: input,
  });
}
