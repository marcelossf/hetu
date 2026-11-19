"use client";

import { Ban, Plus, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  cancelCompra,
  getCompraCatalogo,
  registerCompra,
} from "@/features/compras/services/compra-service";
import type { CompraCatalogo, CompraMovimento } from "@/features/compras/services/compra-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type PurchaseItemDraft = {
  id: string;
  quantidade: string;
  valorTotal: string;
};

const emptyCatalog: CompraCatalogo = {
  fornecedores: [],
  insumos: [],
  compras: [],
};
const emptyItem = (): PurchaseItemDraft => ({
  id: "",
  quantidade: "",
  valorTotal: "",
});

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
const quantity = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function ComprasScreen({ accessToken }: { accessToken: string }) {
  const [catalog, setCatalog] = useState<CompraCatalogo>(emptyCatalog);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [items, setItems] = useState<PurchaseItemDraft[]>([emptyItem()]);
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setCatalog(await getCompraCatalogo(accessToken));
  }

  useEffect(() => {
    let active = true;
    getCompraCatalogo(accessToken)
      .then((loadedCatalog) => {
        if (!active) return;
        setCatalog(loadedCatalog);
        setSupplierId(
          loadedCatalog.fornecedores.find((supplier) => supplier.ativo === "Sim")
            ? String(
                loadedCatalog.fornecedores.find(
                  (supplier) => supplier.ativo === "Sim",
                )?.id_fornecedor,
              )
            : "",
        );
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as compras.",
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

  const movementsByBatch = useMemo(() => {
    const groups = new Map<
      string,
      { original: CompraMovimento[]; compensation: CompraMovimento[] }
    >();
    for (const purchase of catalog.compras) {
      const group = groups.get(purchase.id_lote) ?? {
        original: [],
        compensation: [],
      };
      if (purchase.tipo_movimento === "compra") {
        group.original.push(purchase);
      } else {
        group.compensation.push(purchase);
      }
      groups.set(purchase.id_lote, group);
    }
    return [...groups.entries()];
  }, [catalog.compras]);

  function updateItem(
    index: number,
    field: keyof PurchaseItemDraft,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        index === itemIndex ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const parsedItems = items.map((item) => ({
      id_insumo: Number(item.id),
      quantidade: Number(item.quantidade.replace(",", ".")),
      valor_total: Number(item.valorTotal.replace(",", ".")),
    }));
    if (
      !supplierId ||
      !purchaseDate ||
      parsedItems.some(
        (item) =>
          !Number.isSafeInteger(item.id_insumo) ||
          item.id_insumo < 1 ||
          !Number.isFinite(item.quantidade) ||
          item.quantidade <= 0 ||
          !Number.isFinite(item.valor_total) ||
          item.valor_total <= 0,
      )
    ) {
      setError("Confira o fornecedor, a data e os itens da compra.");
      setSaving(false);
      return;
    }

    try {
      await registerCompra(accessToken, {
        id_fornecedor: Number(supplierId),
        data_compra: purchaseDate,
        itens: parsedItems,
      });
      await refresh();
      setItems([emptyItem()]);
      setNotice("Compra registrada. Estoques e custos foram atualizados.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível registrar a compra.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelBatch(batchId: string) {
    const reason = window.prompt(
      "Informe o motivo do cancelamento. A compra será estornada e o estoque será recomposto.",
    );
    if (!reason?.trim()) return;
    setSaving(true);
    setError("");
    try {
      await cancelCompra(accessToken, batchId, reason);
      await refresh();
      setNotice("Compra cancelada com movimento compensatório.");
    } catch (cancelError: unknown) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Não foi possível cancelar a compra.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-hetu-green">
          {notice}
        </p>
      )}

      <CollapsibleBlock
        title="Registrar compra"
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-hetu-text">
              Fornecedor
              <select
                required
                value={supplierId}
                onChange={(event) => setSupplierId(event.currentTarget.value)}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {catalog.fornecedores
                  .filter((supplier) => supplier.ativo === "Sim")
                  .map((supplier) => (
                    <option
                      key={supplier.id_fornecedor}
                      value={supplier.id_fornecedor}
                    >
                      {supplier.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-medium text-hetu-text">
              Data da compra
              <input
                type="date"
                required
                value={purchaseDate}
                max={today()}
                onChange={(event) => setPurchaseDate(event.currentTarget.value)}
                className={inputClass}
              />
            </label>
          </div>

          <section className="rounded-xl bg-hetu-cream p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium text-hetu-green">Itens comprados</h2>
              <button
                type="button"
                onClick={() => setItems((current) => [...current, emptyItem()])}
                disabled={items.length >= 100}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hetu-green hover:bg-white disabled:opacity-50"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Adicionar insumo
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => {
                const selected = catalog.insumos.find(
                  (supply) => supply.id_insumo === Number(item.id),
                );
                return (
                  <div
                    key={index}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto] sm:items-center"
                  >
                    <select
                      required
                      value={item.id}
                      onChange={(event) =>
                        updateItem(index, "id", event.currentTarget.value)
                      }
                      className={inputClass}
                      aria-label={`Insumo ${index + 1}`}
                    >
                      <option value="">Selecione o insumo...</option>
                      {catalog.insumos
                        .filter((supply) => supply.ativo === "Sim")
                        .map((supply) => (
                          <option key={supply.id_insumo} value={supply.id_insumo}>
                            {supply.nome} ({supply.unidade})
                          </option>
                        ))}
                    </select>
                    <label className="text-xs text-hetu-text/65">
                      Quantidade {selected ? `(${selected.unidade})` : ""}
                      <input
                        required
                        inputMode="decimal"
                        value={item.quantidade}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantidade",
                            event.currentTarget.value.replace(",", "."),
                          )
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="text-xs text-hetu-text/65">
                      Valor total (R$)
                      <input
                        required
                        inputMode="decimal"
                        value={item.valorTotal}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "valorTotal",
                            event.currentTarget.value.replace(",", "."),
                          )
                        }
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.length === 1
                            ? [emptyItem()]
                            : current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                        )
                      }
                      aria-label={`Remover item ${index + 1}`}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 sm:w-11"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving ? "Salvando..." : "Registrar compra"}
          </button>
        </form>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Histórico de compras"
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      >
        {loading ? (
          <p className="text-sm text-hetu-text/65">Carregando compras...</p>
        ) : movementsByBatch.length === 0 ? (
          <p className="text-sm text-hetu-text/65">Nenhuma compra registrada.</p>
        ) : (
          <div className="space-y-3">
            {movementsByBatch.map(([batchId, group]) => {
              const first = group.original[0];
              if (!first) return null;
              const supplier = catalog.fornecedores.find(
                (candidate) => candidate.id_fornecedor === first.id_fornecedor,
              );
              const total = group.original.reduce(
                (sum, purchase) => sum + purchase.valor_total,
                0,
              );
              const cancelled = group.original.every(
                (purchase) => purchase.status === "cancelada",
              );
              return (
                <article
                  key={batchId}
                  className="rounded-xl border border-hetu-green/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-hetu-text">
                        {supplier?.nome ?? "Fornecedor"} ·{" "}
                        {new Date(first.data_compra).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="mt-1 text-sm text-hetu-text/60">
                        {group.original.length} item(ns) · {currency(total)}
                        {cancelled ? " · Cancelada" : ""}
                      </p>
                    </div>
                    {!cancelled && (
                      <button
                        type="button"
                        onClick={() => void cancelBatch(batchId)}
                        disabled={saving}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Ban aria-hidden="true" className="h-4 w-4" />
                        Cancelar
                      </button>
                    )}
                  </div>
                  <ul className="mt-3 divide-y divide-hetu-green/10">
                    {group.original.map((purchase) => {
                      const supply = catalog.insumos.find(
                        (candidate) =>
                          candidate.id_insumo === purchase.id_insumo,
                      );
                      return (
                        <li
                          key={purchase.id_compra}
                          className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                        >
                          <span>
                            {supply?.nome ?? "Insumo"} ·{" "}
                            {quantity(purchase.quantidade)}{" "}
                            {purchase.unidade_compra}
                          </span>
                          <span className="text-hetu-text/65">
                            {currency(purchase.valor_total)} · unitário{" "}
                            {currency(purchase.valor_unitario)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </CollapsibleBlock>
    </div>
  );
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";
