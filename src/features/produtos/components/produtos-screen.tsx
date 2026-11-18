"use client";

import { Pencil, Plus, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  adjustProdutoStock,
  getProdutoCatalogo,
  saveProduto,
  saveProdutoCategoria,
} from "@/features/produtos/services/produto-service";
import type {
  Produto,
  ProdutoCatalogo,
  ProdutoInput,
} from "@/features/produtos/services/produto-service";
import {
  formatProdutoCurrency,
  formatProdutoQuantity,
  parseProdutoAmount,
} from "@/features/produtos/facades/produto-facade";

type Props = { accessToken: string };
type IngredientDraft = { id: string; quantidade: string };
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
const emptyDraft = (): ProductDraft => ({
  nome_receita: "",
  rendimento: "1",
  id_categoria: "",
  custo_embalagem: "0",
  custo_mao_obra: "0",
  custo_armazenamento: "0",
  preco_venda: "0",
  ativo: "Sim",
  itens: [{ id: "", quantidade: "" }],
});

export function ProdutosScreen({ accessToken }: Props) {
  const [catalog, setCatalog] = useState<ProdutoCatalogo>(emptyCatalog);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [adjusting, setAdjusting] = useState<Produto | null>(null);
  const [stockTarget, setStockTarget] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshCatalog() {
    const updated = await getProdutoCatalogo(accessToken);
    setCatalog(updated);
  }

  useEffect(() => {
    let active = true;
    getProdutoCatalogo(accessToken)
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os produtos.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

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
      const ingredientId = Number(item.id);
      const quantity = parseProdutoAmount(item.quantidade, 4);
      const ingredient = catalog.insumos.find(
        (supply) => supply.id_insumo === ingredientId,
      );
      return total + (ingredient && quantity ? ingredient.custo_estimado_unitario * quantity : 0);
    }, 0);
    const additionalCost = extraCosts.reduce<number>(
      (total, amount) => total + (amount ?? 0),
      0,
    );
    return Math.round(((ingredientCost + additionalCost) / yieldValue) * 100) /
      100;
  }, [catalog.insumos, draft]);

  function setField<K extends keyof ProductDraft>(
    field: K,
    value: ProductDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function editProduct(product: Produto) {
    setDraft({
      id_ficha: product.id_ficha,
      nome_receita: product.nome_receita,
      rendimento: "1",
      id_categoria: product.id_categoria?.toString() ?? "",
      custo_embalagem: product.custo_embalagem.toFixed(2).replace(".", ","),
      custo_mao_obra: product.custo_mao_obra.toFixed(2).replace(".", ","),
      custo_armazenamento: product.custo_armazenamento
        .toFixed(2)
        .replace(".", ","),
      preco_venda: product.preco_venda.toFixed(2).replace(".", ","),
      ativo: product.ativo,
      itens: product.itens.map((item) => ({
        id: item.id_insumo.toString(),
        quantidade: item.qtd_insumo.toFixed(4).replace(".", ","),
      })),
    });
    setError("");
    setNotice("");
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientDraft,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const rendimento = parseProdutoAmount(draft.rendimento);
    const custo_embalagem = parseProdutoAmount(draft.custo_embalagem);
    const custo_mao_obra = parseProdutoAmount(draft.custo_mao_obra);
    const custo_armazenamento = parseProdutoAmount(draft.custo_armazenamento);
    const preco_venda = parseProdutoAmount(draft.preco_venda);
    const items: ProdutoInput["itens"] = [];
    const usedIngredients = new Set<number>();
    let invalidItems = false;
    for (const item of draft.itens) {
      if (!item.id && !item.quantidade) continue;
      const id_insumo = Number(item.id);
      const quantidade = parseProdutoAmount(item.quantidade, 4);
      if (
        !Number.isSafeInteger(id_insumo) ||
        id_insumo < 1 ||
        quantidade === null ||
        quantidade <= 0 ||
        usedIngredients.has(id_insumo)
      ) {
        invalidItems = true;
        break;
      }
      usedIngredients.add(id_insumo);
      items.push({ id_insumo, quantidade });
    }

    if (
      !draft.nome_receita.trim() ||
      rendimento === null ||
      rendimento <= 0 ||
      custo_embalagem === null ||
      custo_mao_obra === null ||
      custo_armazenamento === null ||
      preco_venda === null ||
      invalidItems ||
      items.length === 0
    ) {
      setError(
        "Preencha os dados do produto, pelo menos um insumo e quantidades válidas sem repetições.",
      );
      setSaving(false);
      return;
    }

    const input: ProdutoInput = {
      ...(draft.id_ficha ? { id_ficha: draft.id_ficha } : {}),
      nome_receita: draft.nome_receita,
      rendimento,
      id_categoria: draft.id_categoria ? Number(draft.id_categoria) : null,
      custo_embalagem,
      custo_mao_obra,
      custo_armazenamento,
      preco_venda,
      ativo: draft.ativo,
      itens: items,
    };
    try {
      await saveProduto(accessToken, input);
      await refreshCatalog();
      setDraft(emptyDraft());
      setNotice("Produto e ficha técnica salvos.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitStockAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjusting) return;
    const target = parseProdutoAmount(stockTarget);
    if (target === null || !stockReason.trim()) {
      setError("Informe o estoque final e o motivo do ajuste.");
      return;
    }
    const delta = Math.round((target - adjusting.estoque_atual) * 100) / 100;
    if (delta === 0) {
      setError("O estoque informado não altera o saldo atual.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adjustProdutoStock(accessToken, {
        id_ficha: adjusting.id_ficha,
        quantidade_delta: delta,
        motivo: stockReason,
      });
      await refreshCatalog();
      setAdjusting(null);
      setStockReason("");
      setStockTarget("");
      setNotice("Estoque atualizado e ajuste registrado no histórico.");
    } catch (adjustError: unknown) {
      setError(
        adjustError instanceof Error
          ? adjustError.message
          : "Não foi possível ajustar o estoque.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveProdutoCategoria(accessToken, {
        id: editingCategoryId ?? 0,
        nome: categoryName,
      });
      await refreshCatalog();
      setCategoryName("");
      setEditingCategoryId(null);
      setNotice("Categoria de produto salva.");
    } catch (categoryError: unknown) {
      setError(
        categoryError instanceof Error
          ? categoryError.message
          : "Não foi possível salvar a categoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Notice kind="error" message={error} />}
      {notice && <Notice kind="success" message={notice} />}

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5">
          <h2 className="font-serif text-xl text-hetu-green">
            {draft.id_ficha ? "Editar produto e ficha" : "Novo produto e ficha"}
          </h2>
          <p className="mt-1 text-sm text-hetu-text/65">
            As quantidades dos insumos correspondem ao rendimento informado.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-hetu-text/65" role="status">
            Carregando catálogo...
          </p>
        ) : (
          <form onSubmit={submitProduct} className="space-y-5">
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
                  onChange={(event) =>
                    setField("rendimento", event.currentTarget.value)
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
              <Field label="Custo de embalagem do lote (R$)">
                <input
                  inputMode="decimal"
                  value={draft.custo_embalagem}
                  onChange={(event) =>
                    setField("custo_embalagem", event.currentTarget.value)
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Mão de obra do lote (R$)">
                <input
                  inputMode="decimal"
                  value={draft.custo_mao_obra}
                  onChange={(event) =>
                    setField("custo_mao_obra", event.currentTarget.value)
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Armazenamento do lote (R$)">
                <input
                  inputMode="decimal"
                  value={draft.custo_armazenamento}
                  onChange={(event) =>
                    setField("custo_armazenamento", event.currentTarget.value)
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Preço de venda unitário (R$)">
                <input
                  required
                  inputMode="decimal"
                  value={draft.preco_venda}
                  onChange={(event) =>
                    setField("preco_venda", event.currentTarget.value)
                  }
                  className={inputClass}
                />
              </Field>
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

            <div className="rounded-xl bg-hetu-cream p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-medium text-hetu-green">Insumos da ficha</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      itens: [...current.itens, { id: "", quantidade: "" }],
                    }))
                  }
                  disabled={draft.itens.length >= 100}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hetu-green hover:bg-white disabled:opacity-50"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Adicionar insumo
                </button>
              </div>
              <div className="space-y-3">
                {draft.itens.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                  >
                    <select
                      value={item.id}
                      onChange={(event) =>
                        updateIngredient(index, "id", event.currentTarget.value)
                      }
                      className={inputClass}
                      aria-label={`Insumo ${index + 1}`}
                    >
                      <option value="">Selecione um insumo...</option>
                      {catalog.insumos
                        .filter((supply) => supply.ativo === "Sim")
                        .map((supply) => (
                          <option key={supply.id_insumo} value={supply.id_insumo}>
                            {supply.nome} ({supply.unidade})
                          </option>
                        ))}
                    </select>
                    <input
                      inputMode="decimal"
                      value={item.quantidade}
                      onChange={(event) =>
                        updateIngredient(
                          index,
                          "quantidade",
                          event.currentTarget.value,
                        )
                      }
                      placeholder="Quantidade"
                      aria-label={`Quantidade do insumo ${index + 1}`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          itens:
                            current.itens.length === 1
                              ? [{ id: "", quantidade: "" }]
                              : current.itens.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                        }))
                      }
                      aria-label={`Remover insumo ${index + 1}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-hetu-green/15 text-hetu-text/65 hover:bg-white"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-hetu-text/70">
                Custo estimado unitário:{" "}
                <strong className="text-hetu-green">
                  {estimatedUnitCost === null
                    ? "—"
                    : formatProdutoCurrency(estimatedUnitCost)}
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-wait disabled:opacity-60"
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar produto"}
              </button>
              {draft.id_ficha && (
                <button
                  type="button"
                  onClick={() => setDraft(emptyDraft())}
                  className="min-h-11 rounded-xl border border-hetu-green/20 px-5 text-sm font-medium text-hetu-green hover:bg-hetu-cream"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {adjusting && (
        <section className="rounded-2xl border border-hetu-gold/40 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="font-serif text-xl text-hetu-green">
            Ajustar estoque — {adjusting.nome_receita}
          </h2>
          <p className="mt-1 text-sm text-hetu-text/65">
            Saldo atual: {formatProdutoQuantity(adjusting.estoque_atual)}. O ajuste fica
            registrado no histórico.
          </p>
          <form
            onSubmit={submitStockAdjustment}
            className="mt-4 grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto_auto]"
          >
            <Field label="Novo saldo">
              <input
                required
                inputMode="decimal"
                value={stockTarget}
                onChange={(event) => setStockTarget(event.currentTarget.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Motivo do ajuste">
              <input
                required
                maxLength={300}
                value={stockReason}
                onChange={(event) => setStockReason(event.currentTarget.value)}
                className={inputClass}
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="mt-6 min-h-11 rounded-xl bg-hetu-green px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              Registrar
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(null)}
              className="mt-6 min-h-11 rounded-xl border border-hetu-green/20 px-4 text-sm text-hetu-green"
            >
              Fechar
            </button>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="mb-4 font-serif text-xl text-hetu-green">
          Produtos cadastrados
        </h2>
        {loading ? (
          <p className="text-sm text-hetu-text/65">Carregando produtos...</p>
        ) : catalog.produtos.length === 0 ? (
          <p className="text-sm text-hetu-text/65">Nenhum produto cadastrado.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {catalog.produtos.map((product) => (
              <article
                key={product.id_ficha}
                className="rounded-xl border border-hetu-green/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-hetu-text">
                      {product.nome_receita}
                    </h3>
                    <p className="mt-1 text-sm text-hetu-text/65">
                      {product.categoria_nome ?? "Sem categoria"} · Custo{" "}
                      {formatProdutoCurrency(product.custo_unitario)} · Venda{" "}
                      {formatProdutoCurrency(product.preco_venda)}
                    </p>
                    <p className="mt-1 text-sm text-hetu-text/65">
                      Estoque: {formatProdutoQuantity(product.estoque_atual)} ·{" "}
                      {product.ativo === "Sim" ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editProduct(product)}
                      title="Editar produto"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-hetu-green hover:bg-hetu-cream"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjusting(product);
                        setStockTarget(
                          product.estoque_atual.toFixed(2).replace(".", ","),
                        );
                      }}
                      className="min-h-10 rounded-lg border border-hetu-green/15 px-3 text-sm text-hetu-green hover:bg-hetu-cream"
                    >
                      Estoque
                    </button>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {product.itens.map((item) => (
                    <li
                      key={item.id_insumo}
                      className="rounded-full bg-hetu-cream px-3 py-1 text-xs text-hetu-text/70"
                    >
                      {item.insumo?.nome ?? "Insumo"}:{" "}
                      {formatProdutoQuantity(item.qtd_insumo)}{" "}
                      {item.insumo?.unidade ?? ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">
          Histórico de ajustes de estoque
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-hetu-text/65">Carregando ajustes...</p>
        ) : catalog.ajustes.length === 0 ? (
          <p className="mt-4 text-sm text-hetu-text/65">
            Nenhum ajuste manual registrado.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hetu-green/10">
            {catalog.ajustes.map((adjustment) => (
              <li
                key={adjustment.id_ajuste}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <span>
                  <strong className="text-hetu-text">
                    {adjustment.nome_produto}
                  </strong>
                  {" · "}
                  {adjustment.tipo === "saldo_inicial"
                    ? "Saldo inicial"
                    : "Ajuste"}
                  {" · "}
                  {adjustment.quantidade_delta > 0 ? "+" : ""}
                  {formatProdutoQuantity(adjustment.quantidade_delta)}
                </span>
                <span className="text-hetu-text/60">
                  {adjustment.motivo} ·{" "}
                  {new Date(adjustment.criado_em).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProductCategories
        catalog={catalog}
        categoryName={categoryName}
        editingCategoryId={editingCategoryId}
        saving={saving}
        onNameChange={setCategoryName}
        onEdit={(id, name) => {
          setEditingCategoryId(id);
          setCategoryName(name);
        }}
        onCancel={() => {
          setEditingCategoryId(null);
          setCategoryName("");
        }}
        onSubmit={submitCategory}
      />
    </div>
  );
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

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

function Notice({ kind, message }: { kind: "error" | "success"; message: string }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      {message}
    </p>
  );
}

function ProductCategories({
  catalog,
  categoryName,
  editingCategoryId,
  saving,
  onNameChange,
  onEdit,
  onCancel,
  onSubmit,
}: {
  catalog: ProdutoCatalogo;
  categoryName: string;
  editingCategoryId: number | null;
  saving: boolean;
  onNameChange: (value: string) => void;
  onEdit: (id: number, name: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="font-serif text-xl text-hetu-green">
        Categorias de produto
      </h2>
      <form
        onSubmit={onSubmit}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-60 flex-1 text-sm font-medium text-hetu-text">
          {editingCategoryId ? "Renomear categoria" : "Nova categoria"}
          <input
            required
            maxLength={100}
            value={categoryName}
            onChange={(event) => onNameChange(event.currentTarget.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar categoria"}
        </button>
        {editingCategoryId && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-hetu-green/20 px-4 text-sm text-hetu-green"
          >
            Cancelar
          </button>
        )}
      </form>
      <ul className="mt-4 flex flex-wrap gap-2">
        {catalog.categorias.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => onEdit(category.id, category.nome)}
              className="rounded-full bg-hetu-cream px-3 py-2 text-sm text-hetu-text hover:bg-hetu-gold/20"
            >
              {category.nome}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
