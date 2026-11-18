"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  cancelVenda,
  getVendaCatalogo,
  registerVenda,
} from "@/features/vendas/services/venda-service";
import type {
  FormaPagamento,
  ProdutoVenda,
  VendaCatalogo,
} from "@/features/vendas/services/venda-service";
import {
  calculateDiscountAmount,
  formatVendaCurrency,
  formatVendaQuantity,
  parseVendaAmount,
  roundVendaMoney,
} from "@/features/vendas/facades/venda-facade";

type ItemDraft = { id: string; quantidade: string };
type PaymentDraft = { forma_pagamento: FormaPagamento; valor: string };

const emptyCatalog: VendaCatalogo = {
  canais: [],
  produtos: [],
  vendas: [],
};
const paymentOptions: Array<{ value: FormaPagamento; label: string }> = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];
const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

function productForRow(
  products: ProdutoVenda[],
  row: ItemDraft,
): ProdutoVenda | undefined {
  return products.find((product) => product.id_ficha === Number(row.id));
}

export function VendasScreen({ accessToken }: { accessToken: string }) {
  const [catalog, setCatalog] = useState<VendaCatalogo>(emptyCatalog);
  const [channelId, setChannelId] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { id: "", quantidade: "1" },
  ]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [payments, setPayments] = useState<PaymentDraft[]>([
    { forma_pagamento: "pix", valor: "0,00" },
  ]);
  const [automaticPayment, setAutomaticPayment] = useState(true);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setCatalog(await getVendaCatalogo(accessToken));
  }

  useEffect(() => {
    let active = true;
    getVendaCatalogo(accessToken)
      .then((data) => {
        if (active) {
          setCatalog(data);
          setChannelId(
            String(data.canais.find((item) => item.ativo === "Sim")?.id ?? ""),
          );
          setItems((current) =>
            current.map((row) =>
              row.id || !data.produtos[0]
                ? row
                : { ...row, id: String(data.produtos[0].id_ficha) },
            ),
          );
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os dados de vendas.",
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

  const activeProducts = catalog.produtos.filter(
    (product) => product.estoque_atual > 0,
  );
  const lines = items.map((item) => {
    const product = productForRow(catalog.produtos, item);
    const amount = parseVendaAmount(item.quantidade);
    const subtotal =
      product && amount !== null
        ? roundVendaMoney(product.preco_venda * amount)
        : 0;
    return { ...item, product, amount, subtotal };
  });
  const subtotal = roundVendaMoney(
    lines.reduce((total, item) => total + item.subtotal, 0),
  );
  const percent = parseVendaAmount(discountPercent);
  const discount =
    percent === null || percent < 0 || percent > 100
      ? null
      : calculateDiscountAmount(subtotal, percent);
  const total =
    discount === null ? null : roundVendaMoney(subtotal - discount);
  const invalidQuantity = lines.some(
    (line) =>
      !line.product ||
      line.amount === null ||
      line.amount <= 0 ||
      line.amount > line.product.estoque_atual,
  );
  const paymentTotal = roundVendaMoney(
    payments.reduce(
      (sum, payment) => sum + (parseVendaAmount(payment.valor) ?? 0),
      0,
    ),
  );

  function updateItem(index: number, field: keyof ItemDraft, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function updatePayment(
    index: number,
    field: keyof PaymentDraft,
    value: string,
  ) {
    setAutomaticPayment(false);
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex !== index
          ? payment
          : field === "forma_pagamento"
            ? {
                ...payment,
                forma_pagamento:
                  paymentOptions.find((option) => option.value === value)
                    ?.value ?? payment.forma_pagamento,
              }
            : { ...payment, valor: value },
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (
      !channelId ||
      !lines.length ||
      invalidQuantity ||
      discount === null ||
      total === null ||
      new Set(lines.map((line) => line.id)).size !== lines.length
    ) {
      setError(
        "Confira o canal, os produtos, o estoque disponível e o percentual de desconto.",
      );
      return;
    }

    const saleItems: Array<{ id_produto: number; quantidade: number }> = [];
    for (const line of lines) {
      if (!line.product || line.amount === null) {
        setError("Confira os produtos e as quantidades da venda.");
        return;
      }
      saleItems.push({
        id_produto: line.product.id_ficha,
        quantidade: line.amount,
      });
    }

    const paymentItems: Array<{
      forma_pagamento: FormaPagamento;
      valor: number;
    }> = [];
    for (const [index, payment] of payments.entries()) {
      const paymentValue =
        automaticPayment && payments.length === 1 && index === 0 && total !== null
          ? total.toFixed(2).replace(".", ",")
          : payment.valor;
      const value = parseVendaAmount(paymentValue);
      if (value === null) {
        setError("Confira o valor de cada pagamento.");
        return;
      }
      if (value > 0) {
        paymentItems.push({
          forma_pagamento: payment.forma_pagamento,
          valor: value,
        });
      }
    }
    if (
      (total > 0 && roundVendaMoney(paymentTotal) !== total) ||
      (total > 0 && paymentItems.length === 0)
    ) {
      setError("A soma dos pagamentos deve corresponder ao total da venda.");
      return;
    }

    setSaving(true);
    try {
      await registerVenda(accessToken, {
        id_canal: Number(channelId),
        subtotal,
        desconto: discount,
        observacoes: observations,
        itens: saleItems,
        pagamentos: total === 0 ? [] : paymentItems,
      });
      await refresh();
      setItems([
        {
          id: String(activeProducts[0]?.id_ficha ?? ""),
          quantidade: "1",
        },
      ]);
      setDiscountPercent("0");
      setPayments([{ forma_pagamento: "pix", valor: "0,00" }]);
      setAutomaticPayment(true);
      setObservations("");
      setNotice("Venda registrada e estoque dos produtos atualizado.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível registrar a venda.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSale(id: number) {
    if (
      !window.confirm(
        "Cancelar esta venda e devolver os produtos ao estoque? O registro dos pagamentos será mantido.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await cancelVenda(accessToken, id);
      await refresh();
      setNotice("Venda cancelada e estoque dos produtos reposto.");
    } catch (cancelError: unknown) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Não foi possível cancelar a venda.",
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
        <h2 className="font-serif text-xl text-hetu-green">Registrar venda</h2>
        <p className="mt-1 text-sm leading-6 text-hetu-text/65">
          Não é necessário cadastrar cliente. A venda é registrada quitada e
          pode ter pagamentos divididos.
        </p>
        {loading ? (
          <p className="mt-5 text-sm text-hetu-text/65" role="status">
            Carregando produtos e canais...
          </p>
        ) : catalog.canais.filter((channel) => channel.ativo === "Sim").length ===
            0 ? (
          <p className="mt-5 rounded-xl bg-hetu-cream p-4 text-sm text-hetu-text/70">
            Cadastre um canal de venda antes de registrar uma venda.
          </p>
        ) : activeProducts.length === 0 ? (
          <p className="mt-5 rounded-xl bg-hetu-cream p-4 text-sm text-hetu-text/70">
            Não há produtos ativos com estoque disponível.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-5">
            <label className="block max-w-xl text-sm font-medium text-hetu-text">
              Canal de venda
              <select
                required
                value={channelId}
                onChange={(event) => setChannelId(event.currentTarget.value)}
                className={inputClass}
              >
                {catalog.canais
                  .filter((channel) => channel.ativo === "Sim")
                  .map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.nome}
                    </option>
                  ))}
              </select>
            </label>

            <div className="rounded-xl bg-hetu-cream p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-medium text-hetu-green">Produtos</h3>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      {
                        id: String(activeProducts[0]?.id_ficha ?? ""),
                        quantidade: "1",
                      },
                    ])
                  }
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hetu-green hover:bg-white"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Adicionar produto
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
                  >
                    <select
                      value={line.id}
                      onChange={(event) =>
                        updateItem(index, "id", event.currentTarget.value)
                      }
                      className={inputClass}
                      aria-label={`Produto ${index + 1}`}
                    >
                      <option value="">Selecione...</option>
                      {activeProducts.map((product) => (
                        <option
                          key={product.id_ficha}
                          value={product.id_ficha}
                        >
                          {product.nome_receita} ·{" "}
                          {formatVendaCurrency(product.preco_venda)} · estoque{" "}
                          {formatVendaQuantity(product.estoque_atual)}
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      value={line.quantidade}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "quantidade",
                          event.currentTarget.value,
                        )
                      }
                      aria-label={`Quantidade do produto ${index + 1}`}
                      className={inputClass}
                    />
                    <p className="flex items-center px-2 text-sm text-hetu-text/70">
                      {formatVendaCurrency(line.subtotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.length === 1
                            ? [{ id: "", quantidade: "1" }]
                            : current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                        )
                      }
                      aria-label={`Remover produto ${index + 1}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-hetu-green/15 text-hetu-text/65 hover:bg-white"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {invalidQuantity && (
                <p className="mt-3 text-sm text-red-700">
                  Revise os produtos e quantidades. A quantidade não pode
                  exceder o estoque disponível.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <p className="rounded-xl bg-hetu-cream p-4 text-sm">
                Subtotal: <strong>{formatVendaCurrency(subtotal)}</strong>
              </p>
              <label className="text-sm font-medium text-hetu-text">
                Desconto (%)
                <input
                  inputMode="decimal"
                  value={discountPercent}
                  onChange={(event) =>
                    setDiscountPercent(event.currentTarget.value)
                  }
                  className={inputClass}
                />
              </label>
              <p className="rounded-xl bg-hetu-cream p-4 text-sm">
                Total:{" "}
                <strong>
                  {total === null ? "—" : formatVendaCurrency(total)}
                </strong>
                {discount !== null && (
                  <span className="mt-1 block text-xs text-hetu-text/60">
                    Desconto calculado: {formatVendaCurrency(discount)}
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-hetu-green/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-medium text-hetu-green">Pagamentos</h3>
                <button
                  type="button"
                  onClick={() => {
                    setAutomaticPayment(false);
                    setPayments((current) =>
                      current.length === 1 && automaticPayment && total !== null
                        ? [
                            {
                              ...current[0],
                              valor: total.toFixed(2).replace(".", ","),
                            },
                            { forma_pagamento: "pix", valor: "0,00" },
                          ]
                        : [
                            ...current,
                            { forma_pagamento: "pix", valor: "0,00" },
                          ],
                    );
                  }}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hetu-green hover:bg-hetu-cream"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Dividir pagamento
                </button>
              </div>
              <div className="space-y-3">
                {payments.map((payment, index) => (
                  <div
                    key={index}
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
                  >
                    <select
                      value={payment.forma_pagamento}
                      onChange={(event) =>
                        updatePayment(
                          index,
                          "forma_pagamento",
                          event.currentTarget.value,
                        )
                      }
                      className={inputClass}
                      aria-label={`Forma de pagamento ${index + 1}`}
                    >
                      {paymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      inputMode="decimal"
                      value={
                        automaticPayment &&
                        payments.length === 1 &&
                        total !== null
                          ? total.toFixed(2).replace(".", ",")
                          : payment.valor
                      }
                      onChange={(event) =>
                        updatePayment(
                          index,
                          "valor",
                          event.currentTarget.value,
                        )
                      }
                      aria-label={`Valor do pagamento ${index + 1}`}
                      className={inputClass}
                    />
                    {payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPayments((current) =>
                            current.filter(
                              (_, paymentIndex) => paymentIndex !== index,
                            ),
                          )
                        }
                        aria-label={`Remover pagamento ${index + 1}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-hetu-green/15 text-hetu-text/65"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-hetu-text/65">
                Pagamentos informados: {formatVendaCurrency(paymentTotal)}
              </p>
            </div>

            <label className="block text-sm font-medium text-hetu-text">
              Observações (opcional)
              <textarea
                maxLength={1000}
                rows={3}
                value={observations}
                onChange={(event) => setObservations(event.currentTarget.value)}
                className={`${inputClass} py-3`}
              />
            </label>
            <button
              type="submit"
              disabled={
                saving ||
                invalidQuantity ||
                total === null ||
                (total > 0 && paymentTotal !== total)
              }
              className="min-h-11 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Registrar venda"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">Vendas recentes</h2>
        {loading ? (
          <p className="mt-4 text-sm text-hetu-text/65">Carregando vendas...</p>
        ) : catalog.vendas.length === 0 ? (
          <p className="mt-4 text-sm text-hetu-text/65">Nenhuma venda registrada.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {catalog.vendas.map((sale) => (
              <article
                key={sale.id}
                className="rounded-xl border border-hetu-green/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-hetu-text">
                      Venda #{sale.id} · {sale.nome_canal}
                    </h3>
                    <p className="mt-1 text-xs text-hetu-text/60">
                      {new Date(sale.data_venda).toLocaleString("pt-BR")} ·{" "}
                      {sale.status === "concluida" ? "Concluída" : "Cancelada"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-hetu-green">
                      {formatVendaCurrency(sale.valor_total_pedido)}
                    </p>
                    {sale.status === "concluida" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleCancelSale(sale.id)}
                        className="mt-2 text-xs font-medium text-red-700 underline underline-offset-2 disabled:opacity-50"
                      >
                        Cancelar venda
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-hetu-text/65">
                  {sale.itens
                    .map(
                      (item) =>
                        `${item.nome_produto} × ${formatVendaQuantity(item.quantidade)}`,
                    )
                    .join(", ")}
                </p>
                <p className="mt-1 text-xs text-hetu-text/60">
                  Subtotal {formatVendaCurrency(sale.subtotal_pedido)} ·
                  Desconto {formatVendaCurrency(sale.desconto)} · Pagamentos:{" "}
                  {sale.pagamentos
                    .map(
                      (payment) =>
                        `${paymentOptions.find((option) => option.value === payment.forma_pagamento)?.label ?? "Outro"} ${formatVendaCurrency(payment.valor)}`,
                    )
                    .join(", ") || "Nenhum"}
                </p>
                {sale.observacoes && (
                  <p className="mt-2 text-sm text-hetu-text/65">
                    {sale.observacoes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Notice({
  kind,
  message,
}: {
  kind: "error" | "success";
  message: string;
}) {
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
