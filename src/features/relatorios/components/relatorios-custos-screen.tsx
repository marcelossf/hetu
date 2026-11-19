"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  getRelatorioFichas,
  getRelatorioInsumos,
  type RelatorioFichas,
  type RelatorioInsumos,
} from "@/features/relatorios/services/relatorio-service";
import { ReportLineChart } from "@/features/relatorios/components/report-chart";
import { ReportSummary } from "@/features/relatorios/components/report-summary";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
const quantity = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);

function dateInput(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-CA");
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

export function RelatorioInsumoScreen({
  accessToken,
}: {
  accessToken: string;
}) {
  const [report, setReport] = useState<RelatorioInsumos>({
    insumos: [],
    movimentacoes: [],
  });
  const [startDate, setStartDate] = useState(() => dateInput(-90));
  const [endDate, setEndDate] = useState(() => dateInput());
  const [supplyId, setSupplyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getRelatorioInsumos(accessToken, {
      dataInicio: dateInput(-90),
      dataFim: dateInput(),
    })
      .then((loadedReport) => {
        if (active) setReport(loadedReport);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o relatório.",
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setReport(
        await getRelatorioInsumos(accessToken, {
          dataInicio: startDate,
          dataFim: endDate,
          idInsumo: supplyId ? Number(supplyId) : undefined,
        }),
      );
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o relatório.",
      );
    } finally {
      setLoading(false);
    }
  }

  const purchases = report.movimentacoes.filter(
    (movement) => movement.tipo_movimento === "compra",
  );
  const totalSpent = purchases.reduce(
    (total, movement) => total + movement.valor_total,
    0,
  );
  const firstPrice = purchases[0]?.valor_unitario ?? 0;
  const lastPrice = purchases[purchases.length - 1]?.valor_unitario ?? 0;

  return (
    <ReportLayout
      error={error}
      filters={
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <Field label="Data inicial">
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Data final">
            <input
              type="date"
              required
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.currentTarget.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Insumo">
            <select
              required
              value={supplyId}
              onChange={(event) => setSupplyId(event.currentTarget.value)}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {report.insumos.map((supply) => (
                <option key={supply.id_insumo} value={supply.id_insumo}>
                  {supply.nome}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton loading={loading} />
        </form>
      }
      summary={[
        { label: "Compras no período", value: purchases.length },
        { label: "Valor comprado", value: currency(totalSpent) },
        { label: "Primeiro preço unitário", value: currency(firstPrice) },
        {
          label: "Variação do preço",
          value:
            firstPrice > 0
              ? `${(((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1)}%`
              : "—",
        },
      ]}
      chartTitle="Evolução do preço unitário"
      chart={
        <ReportLineChart
          points={purchases.map((movement) => ({
            label: new Date(movement.data_compra).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            value: movement.valor_unitario,
          }))}
          formatValue={currency}
          ariaLabel="Evolução do preço do insumo"
        />
      }
      detailsTitle="Histórico de compras"
      details={
        report.movimentacoes.length === 0 ? (
          <EmptyMessage />
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-hetu-cream/70 text-xs uppercase tracking-wide text-hetu-text/60">
              <tr>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Fornecedor</th>
                <th className="px-3 py-3">Insumo</th>
                <th className="px-3 py-3 text-right">Quantidade</th>
                <th className="px-3 py-3 text-right">Valor</th>
                <th className="px-3 py-3 text-right">Unitário</th>
                <th className="px-3 py-3">Movimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hetu-green/10">
              {report.movimentacoes.map((movement) => (
                <tr key={movement.id_compra}>
                  <td className="px-3 py-3">
                    {new Date(movement.data_compra).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-3">{movement.nome_fornecedor}</td>
                  <td className="px-3 py-3">{movement.nome_insumo}</td>
                  <td className="px-3 py-3 text-right">
                    {quantity(movement.quantidade)} {movement.unidade_compra}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {currency(movement.valor_total)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {currency(movement.valor_unitario)}
                  </td>
                  <td className="px-3 py-3">
                    {movement.tipo_movimento === "compra"
                      ? "Compra"
                      : "Cancelamento"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    />
  );
}

export function RelatorioFichaScreen({
  accessToken,
}: {
  accessToken: string;
}) {
  const [report, setReport] = useState<RelatorioFichas>({
    fichas: [],
    insumos: [],
    alteracoes: [],
  });
  const [startDate, setStartDate] = useState(() => dateInput(-90));
  const [endDate, setEndDate] = useState(() => dateInput());
  const [productId, setProductId] = useState("");
  const [supplyId, setSupplyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getRelatorioFichas(accessToken, {
      dataInicio: dateInput(-90),
      dataFim: dateInput(),
    })
      .then((loadedReport) => {
        if (active) setReport(loadedReport);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o relatório.",
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setReport(
        await getRelatorioFichas(accessToken, {
          dataInicio: startDate,
          dataFim: endDate,
          id: productId ? Number(productId) : undefined,
          idInsumo: supplyId ? Number(supplyId) : undefined,
        }),
      );
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o relatório.",
      );
    } finally {
      setLoading(false);
    }
  }

  const entries = report.alteracoes;
  const selectedProduct = report.fichas.find(
    (product) => product.id_ficha === Number(productId),
  );
  const impact = entries.reduce(
    (total, entry) => total + entry.impacto_diferenca_brl,
    0,
  );
  const firstCost = entries[0]?.novo_custo_total_ficha ?? 0;
  const currentCost = selectedProduct?.custo_unitario ?? entries.at(-1)?.novo_custo_total_ficha ?? 0;

  return (
    <ReportLayout
      error={error}
      filters={
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-5 sm:items-end">
          <Field label="Data inicial">
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Data final">
            <input
              type="date"
              required
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.currentTarget.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Produto / ficha">
            <select
              required
              value={productId}
              onChange={(event) => setProductId(event.currentTarget.value)}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {report.fichas.map((product) => (
                <option key={product.id_ficha} value={product.id_ficha}>
                  {product.nome_receita}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Insumo">
            <select
              value={supplyId}
              onChange={(event) => setSupplyId(event.currentTarget.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {report.insumos.map((supply) => (
                <option key={supply.id_insumo} value={supply.id_insumo}>
                  {supply.nome}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton loading={loading} />
        </form>
      }
      summary={[
        { label: "Alterações", value: entries.length },
        { label: "Impacto acumulado", value: currency(impact) },
        { label: "Custo inicial", value: currency(firstCost) },
        { label: "Custo atual", value: currency(currentCost) },
      ]}
      chartTitle="Variação do custo da ficha"
      chart={
        <ReportLineChart
          points={entries.map((entry) => ({
            label: new Date(entry.data_alteracao).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            value: entry.novo_custo_total_ficha,
          }))}
          formatValue={currency}
          ariaLabel="Evolução do custo total da ficha"
        />
      }
      detailsTitle="Histórico de variações"
      details={
        entries.length === 0 ? (
          <EmptyMessage />
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-hetu-cream/70 text-xs uppercase tracking-wide text-hetu-text/60">
              <tr>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Insumo</th>
                <th className="px-3 py-3 text-right">Anterior</th>
                <th className="px-3 py-3 text-right">Novo</th>
                <th className="px-3 py-3 text-right">Impacto</th>
                <th className="px-3 py-3 text-right">Custo da ficha</th>
                <th className="px-3 py-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hetu-green/10">
              {entries.map((entry) => (
                <tr key={entry.id_historico}>
                  <td className="px-3 py-3">
                    {new Date(entry.data_alteracao).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-3">{entry.nome_insumo}</td>
                  <td className="px-3 py-3 text-right">
                    {currency(entry.preco_insumo_anterior)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {currency(entry.preco_insumo_novo)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {currency(entry.impacto_diferenca_brl)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {currency(entry.novo_custo_total_ficha)}
                  </td>
                  <td className="px-3 py-3">
                    {entry.id_compra_origem
                      ? `Compra #${entry.id_compra_origem}`
                      : entry.tipo_movimento}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    />
  );
}

function ReportLayout({
  filters,
  error,
  summary,
  chartTitle,
  chart,
  detailsTitle,
  details,
}: {
  filters: ReactNode;
  error: string;
  summary: Array<{ label: string; value: ReactNode }>;
  chartTitle: string;
  chart: ReactNode;
  detailsTitle: string;
  details: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <CollapsibleBlock title="Filtros do relatório">{filters}</CollapsibleBlock>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <ReportSummary items={summary} />
      <CollapsibleBlock title={chartTitle}>{chart}</CollapsibleBlock>
      <CollapsibleBlock title={detailsTitle}>
        <div className="overflow-x-auto">{details}</div>
      </CollapsibleBlock>
    </div>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-hetu-green px-4 text-sm font-medium text-white disabled:opacity-60"
    >
      <Search aria-hidden="true" className="h-4 w-4" />
      {loading ? "Atualizando..." : "Aplicar filtros"}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="text-sm font-medium text-hetu-text">
      {label}
      {children}
    </label>
  );
}

function EmptyMessage() {
  return (
    <p className="text-sm text-hetu-text/65">
      Nenhum registro encontrado no período.
    </p>
  );
}
