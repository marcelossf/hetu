"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  getRelatorioVendas,
  type RelatorioVendas,
} from "@/features/relatorios/services/relatorio-service";
import {
  ReportBarChart,
  ReportLineChart,
} from "@/features/relatorios/components/report-chart";
import { ReportSummary } from "@/features/relatorios/components/report-summary";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

function dateInput(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-CA");
}

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
const quantity = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);

const emptyReport: RelatorioVendas = {
  canais: [],
  produtos: [],
  vendas: [],
};

export function RelatorioVendasScreen({
  accessToken,
}: {
  accessToken: string;
}) {
  const [report, setReport] = useState<RelatorioVendas>(emptyReport);
  const [startDate, setStartDate] = useState(() => dateInput(-30));
  const [endDate, setEndDate] = useState(() => dateInput());
  const [productId, setProductId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [status, setStatus] = useState<"concluida" | "cancelada" | "todas">(
    "concluida",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      setReport(
        await getRelatorioVendas(accessToken, {
          dataInicio: startDate,
          dataFim: endDate,
          idProduto: productId ? Number(productId) : undefined,
          idCanal: channelId ? Number(channelId) : undefined,
          status,
        }),
      );
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar o relatório de vendas.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getRelatorioVendas(accessToken, {
      dataInicio: dateInput(-30),
      dataFim: dateInput(),
      status: "concluida",
    })
      .then((loadedReport) => {
        if (active) setReport(loadedReport);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o relatório de vendas.",
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

  const completedSales = report.vendas.filter(
    (sale) => sale.status === "concluida",
  );
  const revenue = completedSales.reduce(
    (total, sale) => total + sale.valor_total_pedido,
    0,
  );
  const grossCost = completedSales.reduce(
    (saleTotal, sale) =>
      saleTotal +
      sale.itens.reduce(
        (itemTotal, item) =>
          itemTotal + item.quantidade * item.custo_unitario_historico,
        0,
      ),
    0,
  );
  const grossProfit = revenue - grossCost;

  const dailyTotals = new Map<string, number>();
  for (const sale of completedSales) {
    const day = sale.data_venda.slice(0, 10);
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + sale.valor_total_pedido);
  }
  const dailyRevenue = [...dailyTotals.entries()].map(([label, value]) => ({
    label: new Date(`${label}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    value,
  }));

  const rankingTotals = new Map<
    string,
    { name: string; revenue: number; quantity: number }
  >();
  for (const sale of completedSales) {
    for (const item of sale.itens) {
      const current = rankingTotals.get(String(item.id_produto)) ?? {
        name: item.nome_produto,
        revenue: 0,
        quantity: 0,
      };
      current.revenue += item.subtotal;
      current.quantity += item.quantidade;
      rankingTotals.set(String(item.id_produto), current);
    }
  }
  const ranking = [...rankingTotals.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  return (
    <div className="space-y-6">
      <CollapsibleBlock title="Filtros do relatório" defaultOpen>
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-5 lg:items-end">
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
          <Field label="Produto">
            <select
              value={productId}
              onChange={(event) => setProductId(event.currentTarget.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {report.produtos.map((product) => (
                <option key={product.id_ficha} value={product.id_ficha}>
                  {product.nome_receita}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Canal">
            <select
              value={channelId}
              onChange={(event) => setChannelId(event.currentTarget.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {report.canais.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.currentTarget.value === "cancelada"
                    ? "cancelada"
                    : event.currentTarget.value === "todas"
                      ? "todas"
                      : "concluida",
                )
              }
              className={inputClass}
            >
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
              <option value="todas">Todas</option>
            </select>
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-hetu-green px-4 text-sm font-medium text-white disabled:opacity-60 lg:col-span-5 lg:justify-self-end"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            {loading ? "Atualizando..." : "Aplicar filtros"}
          </button>
        </form>
      </CollapsibleBlock>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <ReportSummary
        items={[
          { label: "Faturamento", value: currency(revenue) },
          { label: "Vendas concluídas", value: completedSales.length },
          {
            label: "Ticket médio",
            value: currency(
              completedSales.length ? revenue / completedSales.length : 0,
            ),
          },
          { label: "Lucro bruto", value: currency(grossProfit) },
        ]}
      />

      <CollapsibleBlock title="Evolução das vendas" defaultOpen>
        <ReportLineChart
          points={dailyRevenue}
          formatValue={currency}
          ariaLabel="Evolução diária do faturamento"
        />
      </CollapsibleBlock>

      <CollapsibleBlock title="Ranking de produtos" defaultOpen>
        <ReportBarChart
          points={ranking.slice(0, 10).map((item) => ({
            label: `${item.name} (${quantity(item.quantity)} un.)`,
            value: item.revenue,
          }))}
          formatValue={currency}
          ariaLabel="Produtos com maior faturamento"
        />
      </CollapsibleBlock>

      <CollapsibleBlock title="Vendas do período" defaultOpen>
        {report.vendas.length === 0 ? (
          <p className="text-sm text-hetu-text/65">
            Nenhuma venda encontrada com os filtros informados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-hetu-cream/70 text-xs uppercase tracking-wide text-hetu-text/60">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Venda</th>
                  <th className="px-3 py-3">Canal</th>
                  <th className="px-3 py-3">Produtos</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hetu-green/10">
                {report.vendas.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-3 py-3">
                      {new Date(sale.data_venda).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-3 font-medium">#{sale.id}</td>
                    <td className="px-3 py-3">{sale.nome_canal}</td>
                    <td className="px-3 py-3">
                      {sale.itens
                        .map(
                          (item) =>
                            `${item.nome_produto} × ${quantity(item.quantidade)}`,
                        )
                        .join(", ")}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {currency(sale.valor_total_pedido)}
                    </td>
                    <td className="px-3 py-3">
                      {sale.status === "concluida" ? "Concluída" : "Cancelada"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <label className="text-sm font-medium text-hetu-text">
      {label}
      {children}
    </label>
  );
}
