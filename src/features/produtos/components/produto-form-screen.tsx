"use client";

import { ArrowLeft, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  getProdutoCatalogo,
  saveProduto,
} from "@/features/produtos/services/produto-service";
import type {
  ProdutoCatalogo,
  ProdutoInput,
} from "@/features/produtos/services/produto-service";
import {
  convertProdutoQuantity,
  formatProdutoCurrency,
  parseProdutoAmount,
} from "@/features/produtos/facades/produto-facade";

type IngredientDraft = {
  id: string;
  quantidade: string;
  quantidadeConvertida: string;
};
type ProductDraft = {
  id_ficha?: number;
  nome_receita: string;
  rendimento: string;
  id_categoria: string;
  custo_embalagem: string;
  custo_mao_obra: string;
  custo_armazenamento: string;
  preco_venda: string;
  ativo: "Sim" | "Não";
  itens: IngredientDraft[];
};

const emptyCatalog: ProdutoCatalogo = {
  produtos: [],
  categorias: [],
  insumos: [],
  ajustes: [],
};

function emptyDraft(): ProductDraft {
  return {
    nome_receita: "",
    rendimento: "1",
    id_categoria: "",
    custo_embalagem: "0",
    custo_mao_obra: "0",
    custo_armazenamento: "0",
    preco_venda: "0",
    ativo: "Sim",
    itens: [{ id: "", quantidade: "", quantidadeConvertida: "" }],
  };
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

export function ProdutoFormScreen({
  accessToken,
  productId,
  copyProductId,
}: {
  accessToken: string;
  productId?: string;
  copyProductId?: string;
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<ProdutoCatalogo>(emptyCatalog);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [sourceUnavailable, setSourceUnavailable] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const lastIngredientRef = useRef<HTMLSelectElement>(null);
  const focusNewIngredient = useRef(false);

  useEffect(() => {
    let active = true;
    getProdutoCatalogo(accessToken)
      .then((loadedCatalog) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        const sourceId = copyProductId ?? productId;
        if (!sourceId) return;

        const id = Number(sourceId);
        const product = loadedCatalog.produtos.find(
          (candidate) => candidate.id_ficha === id,
        );
        if (!Number.isSafeInteger(id) || !product) {
          setError({ message: "O produto solicitado não foi encontrado." });
          setSourceUnavailable(true);
          return;
        }
        setDraft({
          ...(copyProductId ? {} : { id_ficha: product.id_ficha }),
          nome_receita: copyProductId
            ? `Cópia de ${product.nome_receita}`.slice(0, 120)
            : product.nome_receita,
          rendimento: product.rendimento.toString(),
          id_categoria: product.id_categoria?.toString() ?? "",
          custo_embalagem: product.custo_embalagem.toFixed(2),
          custo_mao_obra: product.custo_mao_obra.toFixed(2),
          custo_armazenamento: product.custo_armazenamento.toFixed(2),
          preco_venda: product.preco_venda.toFixed(2),
          ativo: copyProductId ? "Sim" : product.ativo,
          itens: product.itens.map((item) => ({
            id: item.id_insumo.toString(),
            quantidade: item.qtd_insumo.toFixed(4),
            quantidadeConvertida: convertProdutoQuantity(
              item.qtd_insumo.toFixed(4),
              true,
            ),
          })),
        });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setSourceUnavailable(true);
          setError({
            message:
              loadError instanceof Error
                ? loadError.message
                : "Não foi possível carregar os dados do produto.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, productId, copyProductId]);

  useEffect(() => {
    if (!loading && error && errorRef.current) {
      errorRef.current.focus({ preventScroll: true });
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error, loading]);

  useEffect(() => {
    if (focusNewIngredient.current && lastIngredientRef.current) {
      focusNewIngredient.current = false;
      lastIngredientRef.current.focus({ preventScroll: true });
      lastIngredientRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [draft.itens.length]);

  const estimatedUnitCost = useMemo(() => {
    const yieldValue = parseProdutoAmount(draft.rendimento, 2);
    if (!yieldValue || yieldValue <= 0) return null;
    const extraCosts = [
      draft.custo_embalagem,
      draft.custo_mao_obra,
      draft.custo_armazenamento,
    ].map((value) => parseProdutoAmount(value));
    if (extraCosts.some((value) => value === null)) return null;
    const ingredientCost = draft.itens.reduce((total, item) => {
      const ingredient = catalog.insumos.find(
        (supply) => supply.id_insumo === Number(item.id),
      );
      const quantity = parseProdutoAmount(item.quantidade, 4);
      return (
        total +
        (ingredient && quantity
          ? ingredient.custo_estimado_unitario * quantity
          : 0)
      );
    }, 0);
    const additionalCost = extraCosts.reduce<number>(
      (total, amount) => total + (amount ?? 0),
      0,
    );
    return Math.round(((ingredientCost + additionalCost) / yieldValue) * 100) / 100;
  }, [catalog.insumos, draft]);

  function setField<K extends keyof ProductDraft>(
    field: K,
    value: ProductDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientDraft,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "quantidade") {
          return {
            ...item,
            quantidade: value,
            quantidadeConvertida: convertProdutoQuantity(value, true),
          };
        }
        if (field === "quantidadeConvertida") {
          return {
            ...item,
            quantidade: convertProdutoQuantity(value, false),
            quantidadeConvertida: value,
          };
        }
        return { ...item, id: value };
      }),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const rendimento = parseProdutoAmount(draft.rendimento);
    const custoEmbalagem = parseProdutoAmount(draft.custo_embalagem);
    const custoMaoObra = parseProdutoAmount(draft.custo_mao_obra);
    const custoArmazenamento = parseProdutoAmount(draft.custo_armazenamento);
    const precoVenda = parseProdutoAmount(draft.preco_venda);
    const items: ProdutoInput["itens"] = [];
    const usedIngredients = new Set<number>();
    function reject(message: string) {
      setError({ message });
      setSaving(false);
    }

    if (!draft.nome_receita.trim()) {
      reject("Informe o nome do produto.");
      return;
    }
    if (rendimento === null || rendimento <= 0) {
      reject(
        "Informe um rendimento maior que zero, com até duas casas decimais.",
      );
      return;
    }
    if (
      custoEmbalagem === null ||
      custoMaoObra === null ||
      custoArmazenamento === null ||
      precoVenda === null
    ) {
      reject(
        "Confira os custos e o preço de venda: use valores com até duas casas decimais.",
      );
      return;
    }

    for (const [index, item] of draft.itens.entries()) {
      if (!item.id && !item.quantidade.trim()) continue;
      const idInsumo = Number(item.id);
      const quantidade = parseProdutoAmount(item.quantidade, 4);
      if (!Number.isSafeInteger(idInsumo) || idInsumo < 1) {
        reject(`Selecione o insumo da linha ${index + 1}.`);
        return;
      }
      if (quantidade === null || quantidade <= 0) {
        reject(
          `Informe uma quantidade maior que zero, com até quatro casas decimais na unidade do insumo, na linha ${index + 1}.`,
        );
        return;
      }
      if (usedIngredients.has(idInsumo)) {
        reject(`O insumo da linha ${index + 1} já foi adicionado à ficha.`);
        return;
      }
      usedIngredients.add(idInsumo);
      items.push({ id_insumo: idInsumo, quantidade });
    }

    if (items.length === 0) {
      reject("Adicione pelo menos um insumo com quantidade.");
      return;
    }

    try {
      await saveProduto(accessToken, {
        ...(draft.id_ficha ? { id_ficha: draft.id_ficha } : {}),
        nome_receita: draft.nome_receita.trim(),
        rendimento,
        id_categoria: draft.id_categoria ? Number(draft.id_categoria) : null,
        custo_embalagem: custoEmbalagem,
        custo_mao_obra: custoMaoObra,
        custo_armazenamento: custoArmazenamento,
        preco_venda: precoVenda,
        ativo: draft.ativo,
        itens: items,
      });
      router.replace("/cadastros/produtos");
    } catch (saveError: unknown) {
      setError({
        message:
          saveError instanceof Error
            ? saveError.message
            : "Não foi possível salvar o produto.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-hetu-text/65">Carregando produto...</p>;
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.replace("/cadastros/produtos")}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-hetu-green hover:bg-white"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Voltar para produtos
      </button>

      {error && sourceUnavailable && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error.message}
        </p>
      )}

      {copyProductId && !sourceUnavailable && (
        <p className="text-sm text-hetu-text/70">
          A cópia será um novo produto, com estoque zerado e sem histórico.
          Insumos inativos precisam ser substituídos antes de salvar.
        </p>
      )}

      {!sourceUnavailable && <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome do produto">
            <input
              required
              maxLength={120}
              value={draft.nome_receita}
              onChange={(event) =>
                setField("nome_receita", event.currentTarget.value)
              }
              className={inputClass}
            />
          </Field>
          <Field label="Rendimento do lote">
            <input
              required
              inputMode="decimal"
              value={draft.rendimento}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setField("rendimento", event.currentTarget.value.replace(",", "."))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Categoria">
            <select
              value={draft.id_categoria}
              onChange={(event) =>
                setField("id_categoria", event.currentTarget.value)
              }
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {catalog.categorias.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nome}
                </option>
              ))}
            </select>
          </Field>
          {(
            [
              ["custo_embalagem", "Custo de embalagem do lote (R$)"],
              ["custo_mao_obra", "Mão de obra do lote (R$)"],
              ["custo_armazenamento", "Armazenamento do lote (R$)"],
              ["preco_venda", "Preço de venda unitário (R$)"],
            ] as const
          ).map(([field, label]) => (
            <Field key={field} label={label}>
              <input
                required={field === "preco_venda"}
                inputMode="decimal"
                value={draft[field]}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setField(field, event.currentTarget.value.replace(",", "."))
                }
                className={inputClass}
              />
            </Field>
          ))}
          {draft.id_ficha && (
            <Field label="Status">
              <select
                value={draft.ativo}
                onChange={(event) =>
                  setField(
                    "ativo",
                    event.currentTarget.value === "Não" ? "Não" : "Sim",
                  )
                }
                className={inputClass}
              >
                <option value="Sim">Ativo</option>
                <option value="Não">Inativo</option>
              </select>
            </Field>
          )}
        </div>

        <section className="rounded-xl bg-hetu-cream p-4">
          <div className="mb-3">
            <h2 className="font-medium text-hetu-green">Insumos da ficha</h2>
          </div>
          <div className="space-y-3">
            {draft.itens.map((item, index) => {
              const unit = catalog.insumos.find(
                (supply) => supply.id_insumo === Number(item.id),
              )?.unidade;
              const normalizedUnit = unit?.trim().toLocaleLowerCase("pt-BR");
              const smallerUnit =
                normalizedUnit === "kg" ? "g" : normalizedUnit === "l" ? "mL" : null;
              return (
                <div
                  key={index}
                  className={`grid gap-2 sm:items-end ${
                    smallerUnit
                      ? "sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]"
                      : "sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                  }`}
                >
                  <select
                    ref={
                      index === draft.itens.length - 1
                        ? lastIngredientRef
                        : undefined
                    }
                    value={item.id}
                    onChange={(event) =>
                      updateIngredient(index, "id", event.currentTarget.value)
                    }
                    className={inputClass}
                    aria-label={`Insumo ${index + 1}`}
                  >
                    <option value="">Selecione um insumo...</option>
                    {catalog.insumos
                      .filter(
                        (supply) =>
                          supply.ativo === "Sim" ||
                          supply.id_insumo === Number(item.id),
                      )
                      .map((supply) => {
                        const alreadyAdded = draft.itens.some(
                          (other, otherIndex) =>
                            otherIndex !== index &&
                            other.id === supply.id_insumo.toString(),
                        );
                        return (
                          <option
                            key={supply.id_insumo}
                            value={supply.id_insumo}
                            disabled={alreadyAdded}
                          >
                            {supply.nome} ({supply.unidade})
                            {supply.ativo === "Não" ? " — inativo" : ""}
                            {alreadyAdded ? " — já adicionado" : ""}
                          </option>
                        );
                      })}
                  </select>
                  <label className="text-sm font-medium text-hetu-text">
                    Quantidade{unit ? ` (${unit})` : ""}
                    <input
                      inputMode="decimal"
                      value={item.quantidade}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) =>
                        updateIngredient(
                          index,
                          "quantidade",
                          event.currentTarget.value.replace(",", "."),
                        )
                      }
                      placeholder="Quantidade"
                      aria-label={`Quantidade do insumo ${index + 1}${unit ? ` em ${unit}` : ""}`}
                      className={inputClass}
                    />
                  </label>
                  {smallerUnit && (
                    <label className="text-sm font-medium text-hetu-text">
                      Quantidade ({smallerUnit})
                      <input
                        inputMode="decimal"
                        value={item.quantidadeConvertida}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          updateIngredient(
                            index,
                            "quantidadeConvertida",
                            event.currentTarget.value.replace(",", "."),
                          )
                        }
                        placeholder="Quantidade"
                        aria-label={`Quantidade do insumo ${index + 1} em ${smallerUnit}`}
                        className={inputClass}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        itens:
                          current.itens.length === 1
                            ? [{ id: "", quantidade: "", quantidadeConvertida: "" }]
                            : current.itens.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                      }))
                    }
                    aria-label={`Remover insumo ${index + 1}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 sm:w-11"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              focusNewIngredient.current = true;
              setDraft((current) => ({
                ...current,
                itens: [
                  ...current.itens,
                  { id: "", quantidade: "", quantidadeConvertida: "" },
                ],
              }));
            }}
            disabled={draft.itens.length >= 100}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-hetu-green bg-white px-4 text-sm font-medium text-hetu-green hover:bg-hetu-green hover:text-white disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Adicionar insumo
          </button>
          <p className="mt-3 text-sm text-hetu-text/70">
            Para insumos em kg ou L, a menor quantidade é 0,1 g ou 0,1 mL.
          </p>
          <p className="mt-3 text-sm text-hetu-text/70">
            Custo estimado unitário:{" "}
            <strong className="text-hetu-green">
              {estimatedUnitCost === null
                ? "—"
                : formatProdutoCurrency(estimatedUnitCost)}
            </strong>
          </p>
        </section>

        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-wait disabled:opacity-60"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar produto"}
          </button>
          <button
            type="button"
            onClick={() => router.replace("/cadastros/produtos")}
            disabled={saving}
            className="min-h-11 rounded-xl border border-hetu-green/20 px-5 text-sm font-medium text-hetu-green hover:bg-hetu-cream disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </form>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-hetu-text">
      {label}
      {children}
    </label>
  );
}
