"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { formatDateShort } from "@/lib/utils/dates";

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  cursor: { stroke: "var(--border)" },
};

export interface Series {
  key: string;
  name: string;
  color: string;
  type?: "line" | "bar" | "area";
  dashed?: boolean;
  dot?: boolean;
}

/** Uniwersalny wykres czasowy (oś X = data ISO). */
export function TimeChart({
  data,
  series,
  height = 220,
  unit,
  reference,
  yDomain,
  ariaLabel,
}: {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  unit?: string;
  reference?: { y: number; label: string; color?: string };
  yDomain?: [number | string, number | string];
  ariaLabel: string;
}) {
  const reduced = usePrefersReducedMotion();
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">Brak danych do wykresu.</p>;
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {grid}
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDateShort(d)} {...axis} minTickGap={18} />
          <YAxis {...axis} domain={yDomain ?? ["auto", "auto"]} unit={unit ? ` ${unit}` : undefined} width={58} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => formatDateShort(String(d))} formatter={(v) => (typeof v === "number" ? `${v.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}${unit ? " " + unit : ""}` : String(v))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {reference && <ReferenceLine y={reference.y} stroke={reference.color ?? "var(--warning)"} strokeDasharray="4 4" label={{ value: reference.label, fill: "var(--muted)", fontSize: 11, position: "insideTopRight" }} />}
          {series.map((s) =>
            s.type === "bar" ? (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
            ) : s.type === "area" ? (
              <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} isAnimationActive={!reduced} connectNulls />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                dot={s.dot ?? false}
                isAnimationActive={!reduced}
                connectNulls
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({ data, xKey, bars, height = 200, ariaLabel, unit }: { data: Record<string, unknown>[]; xKey: string; bars: Series[]; height?: number; ariaLabel: string; unit?: string }) {
  const reduced = usePrefersReducedMotion();
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">Brak danych do wykresu.</p>;
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {grid}
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={52} unit={unit ? ` ${unit}` : undefined} />
          <Tooltip {...tooltipStyle} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, dataKey, color = "var(--olive)", height = 40 }: { data: Record<string, unknown>[]; dataKey: string; color?: string; height?: number }) {
  const reduced = usePrefersReducedMotion();
  if (data.length < 2) return null;
  return (
    <div style={{ width: "100%", height }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data}>
          <Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={!reduced} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const COLORS = {
  olive: "var(--olive)",
  ok: "var(--success)",
  warn: "var(--warning)",
  muted: "var(--muted)",
  text: "var(--text)",
  blue: "#5aa9e6",
  violet: "#a78bfa",
};
