import * as React from 'react';

/**
 * Dependency-free SVG charts. A charting library would add ~90KB to a page
 * whose job is to show eight numbers, and every chart here is a simple series.
 */
export function LineChart({
  values,
  labels,
  format = (n: number) => String(n),
  height = 160,
  color = '#059669',
}: {
  values: number[];
  labels: string[];
  format?: (n: number) => string;
  height?: number;
  color?: string;
}) {
  if (values.length === 0) return null;

  const width = 640;
  const pad = { top: 12, right: 8, bottom: 20, left: 8 };
  const max = Math.max(...values, 1);
  const innerH = height - pad.top - pad.bottom;
  const step = (width - pad.left - pad.right) / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => [pad.left + i * step, pad.top + innerH - (v / max) * innerH]);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)![0].toFixed(1)},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Series peaking at ${format(max)}`}>
        <path d={area} fill={color} opacity="0.09" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r="3.5" fill={color} />
        <text x={pad.left} y={height - 4} fontSize="11" fill="#94A3B8">
          {labels[0]?.slice(5)}
        </text>
        <text x={width - pad.right} y={height - 4} fontSize="11" fill="#94A3B8" textAnchor="end">
          {labels.at(-1)?.slice(5)}
        </text>
      </svg>
      <figcaption className="sr-only">
        Peak {format(max)}, latest {format(values.at(-1)!)}
      </figcaption>
    </figure>
  );
}

export function BarList({
  items,
  format = (n: number) => String(n),
}: {
  items: { name: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{item.name}</span>
            <span className="money shrink-0 font-medium text-ink">{format(item.value)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-pill bg-navy-100">
            <div
              className="h-1.5 rounded-pill bg-care"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
