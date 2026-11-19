type ChartPoint = {
  label: string;
  value: number;
};

type Props = {
  points: ChartPoint[];
  formatValue: (value: number) => string;
  ariaLabel: string;
};

export function ReportLineChart({
  points,
  formatValue,
  ariaLabel,
}: Props) {
  if (points.length === 0) {
    return (
      <p className="rounded-xl bg-hetu-cream p-5 text-center text-sm text-hetu-text/65">
        Nenhum dado no período selecionado.
      </p>
    );
  }

  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 44, left: 62 };
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    x:
      padding.left +
      (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + ((maximum - point.value) / range) * chartHeight,
  }));
  const polyline = coordinates
    .map((coordinate) => `${coordinate.x},${coordinate.y}`)
    .join(" ");
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="min-w-[640px] w-full"
      >
        <rect width={width} height={height} rx="16" fill="#F7F5F2" />
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + ratio * chartHeight;
          const value = maximum - ratio * range;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#1F3D2B"
                strokeOpacity="0.12"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fill="#2A2A2A"
                fillOpacity="0.65"
                fontSize="11"
              >
                {formatValue(value)}
              </text>
            </g>
          );
        })}
        <polyline
          points={polyline}
          fill="none"
          stroke="#1F3D2B"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coordinates.map((coordinate, index) => (
          <g key={`${points[index].label}-${index}`}>
            <circle
              cx={coordinate.x}
              cy={coordinate.y}
              r="4"
              fill="#C2A46D"
              stroke="#1F3D2B"
              strokeWidth="2"
            >
              <title>
                {points[index].label}: {formatValue(points[index].value)}
              </title>
            </circle>
            {index % labelStep === 0 && (
              <text
                x={coordinate.x}
                y={height - 16}
                textAnchor="middle"
                fill="#2A2A2A"
                fillOpacity="0.65"
                fontSize="11"
              >
                {points[index].label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ReportBarChart({
  points,
  formatValue,
  ariaLabel,
}: Props) {
  if (points.length === 0) {
    return (
      <p className="rounded-xl bg-hetu-cream p-5 text-center text-sm text-hetu-text/65">
        Nenhum dado no período selecionado.
      </p>
    );
  }

  const maximum = Math.max(...points.map((point) => point.value), 1);
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="space-y-3 rounded-xl bg-hetu-cream p-4"
    >
      {points.map((point) => (
        <div key={point.label} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_7rem] sm:items-center">
          <span className="truncate text-sm text-hetu-text/75">
            {point.label}
          </span>
          <svg
            viewBox="0 0 100 12"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="h-3 w-full rounded-full bg-hetu-green/10"
          >
            <rect
              width={Math.max((point.value / maximum) * 100, 2)}
              height="12"
              rx="6"
              fill="#C2A46D"
            />
          </svg>
          <span className="text-right text-sm font-medium tabular-nums text-hetu-green">
            {formatValue(point.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
