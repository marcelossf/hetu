"use client";

import { Copy, Pencil, Plus, Save, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  adjustProdutoStock,
  getProdutoCatalogo,
} from "@/features/produtos/services/produto-service";
import type {
  Produto,
  ProdutoCatalogo,
} from "@/features/produtos/services/produto-service";
import {
  formatProdutoCurrency,
  formatProdutoQuantity,
  parseProdutoAmount,
} from "@/features/produtos/facades/produto-facade";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type Props = { accessToken: string };

const emptyCatalog: ProdutoCatalogo = {
  produtos: [],
  categorias: [],
  insumos: [],
  ajustes: [],
};

export function ProdutosScreen({ accessToken }: Props) {
  const [catalog, setCatalog] = useState<ProdutoCatalogo>(emptyCatalog);
  const [adjusting, setAdjusting] = useState<Produto | null>(null);
  const [stockTarget, setStockTarget] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(
    () => new Set(),
  );
  const [listOpen, setListOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshCatalog() {
    setCatalog(await getProdutoCatalogo(accessToken));
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return catalog.produtos.filter(
      (product) =>
        (!category || String(product.id_categoria) === category) &&
        (!term ||
          product.nome_receita.toLocaleLowerCase("pt-BR").includes(term) ||
          product.itens.some((item) =>
            item.insumo?.nome.toLocaleLowerCase("pt-BR").includes(term),
          )),
    );
  }, [catalog.produtos, search, category]);

  function startAdjustment(product: Produto) {
    setAdjusting(product);
    setStockTarget(product.estoque_atual.toFixed(2));
    setStockReason("");
    setAdjustOpen(true);
    setError("");
    requestAnimationFrame(() => {
      document
        .getElementById("product-stock-adjustment")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      setAdjustOpen(false);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/cadastros/produtos/cadastro"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Novo produto
        </Link>
      </div>

      {error && <Notice kind="error" message={error} />}
      {notice && <Notice kind="success" message={notice} />}

      {adjusting && (
        <CollapsibleBlock
          id="product-stock-adjustment"
          title={`Ajustar estoque — ${adjusting.nome_receita}`}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          className="border-hetu-gold/40"
        >
          <p className="text-sm text-hetu-text/65">
            Saldo atual: {formatProdutoQuantity(adjusting.estoque_atual)}. O
            ajuste ficará registrado no histórico.
          </p>
          <form
            onSubmit={submitStockAdjustment}
            className="mt-4 grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto_auto] sm:items-end"
          >
            <Field label="Novo saldo">
              <input
                required
                inputMode="decimal"
                value={stockTarget}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setStockTarget(event.currentTarget.value.replace(",", "."))
                }
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-hetu-green px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              Registrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAdjusting(null);
                setAdjustOpen(false);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-hetu-green/20 px-4 text-sm text-hetu-green"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Fechar
            </button>
          </form>
        </CollapsibleBlock>
      )}

      <CollapsibleBlock
        title="Produtos cadastrados"
        open={listOpen}
        onOpenChange={setListOpen}
      >
        <div className="mb-4 flex flex-wrap gap-4">
          <label className="block w-full text-sm text-hetu-text/70 sm:w-64">
            Buscar
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Nome do produto ou insumo"
              className="mt-1 min-h-10 w-full rounded-lg border border-hetu-green/20 px-3 text-sm outline-none focus:border-hetu-green"
            />
          </label>
          <label className="block w-full text-sm text-hetu-text/70 sm:w-64">
            Categoria
            <select
              value={category}
              onChange={(event) => setCategory(event.currentTarget.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green"
            >
              <option value="">Todas</option>
              {catalog.categorias.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="text-sm text-hetu-text/65">Carregando produtos...</p>
        ) : catalog.produtos.length === 0 ? (
          <p className="text-sm text-hetu-text/65">Nenhum produto cadastrado.</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-hetu-text/65">
            Nenhum produto corresponde aos filtros.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredProducts.map((product) => (
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
                    <Link
                      href={`/cadastros/produtos/${product.id_ficha}`}
                      aria-label={`Editar ${product.nome_receita}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-hetu-green hover:bg-hetu-cream"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/cadastros/produtos/${product.id_ficha}/copiar`}
                      aria-label={`Copiar ${product.nome_receita}`}
                      title="Copiar produto"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-hetu-green hover:bg-hetu-cream"
                    >
                      <Copy aria-hidden="true" className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => startAdjustment(product)}
                      className="min-h-10 rounded-lg border border-hetu-green/15 px-3 text-sm text-hetu-green hover:bg-hetu-cream"
                    >
                      Estoque
                    </button>
                  </div>
                </div>
                <ul
                  id={`product-ingredients-${product.id_ficha}`}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {product.itens.slice(
                    0,
                    expandedProducts.has(product.id_ficha) ? undefined : 4,
                  ).map((item) => (
                    <li
                      key={item.id_item}
                      className="rounded-full bg-hetu-cream px-3 py-1 text-xs text-hetu-text/70"
                    >
                      {item.insumo?.nome ?? "Insumo"}:{" "}
                      {formatProdutoQuantity(item.qtd_insumo)}{" "}
                      {item.insumo?.unidade ?? ""}
                    </li>
                  ))}
                </ul>
                {product.itens.length > 4 && (
                  <button
                    type="button"
                    aria-expanded={expandedProducts.has(product.id_ficha)}
                    aria-controls={`product-ingredients-${product.id_ficha}`}
                    aria-label={`${expandedProducts.has(product.id_ficha) ? "Ver menos" : "Ver mais"} insumos de ${product.nome_receita}`}
                    onClick={() =>
                      setExpandedProducts((current) => {
                        const next = new Set(current);
                        if (next.has(product.id_ficha)) {
                          next.delete(product.id_ficha);
                        } else {
                          next.add(product.id_ficha);
                        }
                        return next;
                      })
                    }
                    className="mt-2 min-h-10 text-sm font-medium text-hetu-green hover:underline"
                  >
                    {expandedProducts.has(product.id_ficha) ? "Ver menos" : "Ver mais"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Histórico de ajustes de estoque"
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      >
        {loading ? (
          <p className="text-sm text-hetu-text/65">Carregando ajustes...</p>
        ) : catalog.ajustes.length === 0 ? (
          <p className="text-sm text-hetu-text/65">
            Nenhum ajuste manual registrado.
          </p>
        ) : (
          <ul className="divide-y divide-hetu-green/10">
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
      </CollapsibleBlock>
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
