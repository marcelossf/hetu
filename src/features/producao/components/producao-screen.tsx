"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  getProducaoCatalogo,
  registerProducao,
} from "@/features/producao/services/producao-service";
import type { ProducaoCatalogo } from "@/features/producao/services/producao-service";
import {
  formatProducaoCurrency,
  formatProducaoQuantity,
  parseProducaoAmount,
} from "@/features/producao/facades/producao-facade";

const emptyCatalog: ProducaoCatalogo = {
  produtos: [],
  insumos: [],
  producoes: [],
};
const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

export function ProducaoScreen({ accessToken }: { accessToken: string }) {
  const [catalog, setCatalog] = useState<ProducaoCatalogo>(emptyCatalog);
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("1");
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setCatalog(await getProducaoCatalogo(accessToken));
  }

  useEffect(() => {
    let active = true;
    getProducaoCatalogo(accessToken)
      .then((data) => {
        if (active) {
          setCatalog(data);
          setProductId((current) =>
            current || String(data.produtos[0]?.id_ficha ?? ""),
          );
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os dados de produção.",
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

  const selectedProduct = catalog.produtos.find(
    (product) => product.id_ficha === Number(productId),
  );
  const requestedAmount = parseProducaoAmount(amount);
  const requiredIngredients = useMemo(() => {
    if (!selectedProduct || requestedAmount === null) return [];
    return selectedProduct.itens.map((item) => {
      const required = Math.round(item.qtd_insumo * requestedAmount * 10000) /
        10000;
      const stock = item.insumo?.estoque_atual ?? 0;
      return {
        id: item.id_insumo,
        name: item.insumo?.nome ?? "Insumo indisponível",
        unit: item.insumo?.unidade ?? "",
        required,
        stock,
        sufficient: stock >= required,
      };
    });
  }, [requestedAmount, selectedProduct]);
  const canRegister =
    !!selectedProduct &&
    requestedAmount !== null &&
    requestedAmount > 0 &&
    requiredIngredients.length > 0 &&
    requiredIngredients.every((item) => item.sufficient);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRegister || !selectedProduct || requestedAmount === null) {
      setError(
        "Confira a quantidade e os saldos dos insumos antes de registrar a produção.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await registerProducao(accessToken, {
        id_produto: selectedProduct.id_ficha,
        quantidade: requestedAmount,
        observacao: observation,
      });
      await refresh();
      setObservation("");
      setNotice("Produção registrada e estoques atualizados.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível registrar a produção.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">
          Registrar produção
        </h2>
        <p className="mt-1 text-sm leading-6 text-hetu-text/65">
          A gravação é transacional: se faltar qualquer insumo, nenhuma baixa
          nem entrada de estoque será feita.
        </p>
        {loading ? (
          <p className="mt-5 text-sm text-hetu-text/65" role="status">
            Carregando fichas e estoques...
          </p>
        ) : catalog.produtos.length === 0 ? (
          <p className="mt-5 rounded-xl bg-hetu-cream p-4 text-sm text-hetu-text/70">
            Cadastre um produto ativo com ficha técnica antes de produzir.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-hetu-text">
                Produto
                <select
                  required
                  value={productId}
                  onChange={(event) => setProductId(event.currentTarget.value)}
                  className={inputClass}
                >
                  {catalog.produtos.map((product) => (
                    <option key={product.id_ficha} value={product.id_ficha}>
                      {product.nome_receita} · custo unitário{" "}
                      {formatProducaoCurrency(product.custo_unitario)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-hetu-text">
                Quantidade a produzir
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.currentTarget.value)}
                  className={inputClass}
                />
              </label>
            </div>

            {selectedProduct && (
              <div className="rounded-xl bg-hetu-cream p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    Estoque atual do produto:{" "}
                    <strong>
                      {formatProducaoQuantity(selectedProduct.estoque_atual)}
                    </strong>
                  </span>
                  {requestedAmount !== null && requestedAmount > 0 && (
                    <span>
                      Custo estimado do lote:{" "}
                      <strong>
                        {formatProducaoCurrency(
                          selectedProduct.custo_unitario * requestedAmount,
                        )}
                      </strong>
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-sm font-medium text-hetu-green">
                  Consumo previsto
                </h3>
                <ul className="mt-2 space-y-2">
                  {requiredIngredients.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <span>
                        {item.name}: {formatProducaoQuantity(item.required)}{" "}
                        {item.unit}
                      </span>
                      <span
                        className={
                          item.sufficient ? "text-hetu-text/65" : "text-red-700"
                        }
                      >
                        Estoque {formatProducaoQuantity(item.stock)} {item.unit}
                        {!item.sufficient && " · insuficiente"}
                      </span>
                    </li>
                  ))}
                  {requiredIngredients.length === 0 && (
                    <li className="text-sm text-red-700">
                      A ficha técnica não possui insumos.
                    </li>
                  )}
                </ul>
              </div>
            )}

            <label className="block text-sm font-medium text-hetu-text">
              Observação (opcional)
              <textarea
                maxLength={1000}
                rows={3}
                value={observation}
                onChange={(event) => setObservation(event.currentTarget.value)}
                className={`${inputClass} py-3`}
              />
            </label>
            <button
              type="submit"
              disabled={saving || !canRegister}
              className="min-h-11 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Registrando..." : "Registrar e atualizar estoques"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">
          Histórico de produção
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-hetu-text/65">Carregando...</p>
        ) : catalog.producoes.length === 0 ? (
          <p className="mt-4 text-sm text-hetu-text/65">
            Nenhuma produção registrada.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {catalog.producoes.map((production) => (
              <article
                key={production.id_producao}
                className="rounded-xl border border-hetu-green/10 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-hetu-text">
                      {production.nome_produto} ·{" "}
                      {formatProducaoQuantity(production.qtd_produzida)} un
                    </h3>
                    <p className="mt-1 text-xs text-hetu-text/60">
                      {new Date(production.data_producao).toLocaleString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-hetu-text/70">
                    Custo do lote:{" "}
                    {formatProducaoCurrency(production.custo_total_lote)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-hetu-text/65">
                  Consumos:{" "}
                  {production.itens.length
                    ? production.itens
                        .map(
                          (item) =>
                            `${item.nome_insumo} (${formatProducaoQuantity(item.qtd_consumida)})`,
                        )
                        .join(", ")
                    : "Nenhum"}
                </p>
                {production.observacao && (
                  <p className="mt-2 text-sm text-hetu-text/65">
                    {production.observacao}
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
  children,
}: {
  kind: "error" | "success";
  children: string;
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
      {children}
    </p>
  );
}
