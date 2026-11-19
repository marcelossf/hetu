import type { ReactNode } from "react";

export function ReportSummary({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-hetu-green/10 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-hetu-text/55">
            {item.label}
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-hetu-green">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
