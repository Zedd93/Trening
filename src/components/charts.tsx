"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { formatDateShort } from "@/lib/utils/dates";

const axis = { stroke: "var(--muted)", fontSize: 10.5, fontFamily: "var(--font-mono)", tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 10, color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)" },
  labelStyle: { color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontSize: 10.5 },
  cursor: { stroke: "var(--border)" },
};

const legendStyle = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const tickNumber = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: 1 });

/** Domena osi Y z marginesem — wykresy liniowe nie zaczynają się od zera, słupkowe tak. */
function yDomainFor(series: Series[]): [number | string | ((v: number) => number), number | string | ((v: number) => number)] {
  if (series.some((s) => s.type === "bar")) return [0, "auto"];
  const pad = (v: number) => Math.max(Math.abs(v) * 0.02, 0.5);
  return [(min: number) => Math.floor(min - pad(min)), (max: number) => Math.ceil(max + pad(max))];
}

/** Wykres jest pusty, gdy żadna seria główna (nie przerywana linia celu) nie ma wartości. */
function isEmpty(data: Record<string, unknown>[], series: Series[]) {
  const main = series.filter((s) => !s.dashed);
  return !data.some((d) => main.some((s) => typeof d[s.key] === "number" && Number.isFinite(d[s.key]) && d[s.key] !== 0));
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-line text-center" style={{ height: Math.min(height, 160) }}>
      <div>
        <div className="eyebrow">Brak danych</div>
        <p className="mt-1 text-xs text-muted">Wykres pojawi się po pierwszych zapisach.</p>
      </div>
    </div>
  );
}

function ChartFrame({ ariaLabel, unit, height, children }: { ariaLabel: string; unit?: string; height: number; children: React.ReactElement }) {
  return (
    <div>
      {unit && <div className="eyebrow mb-1 normal-case tracking-wider">{unit}</div>}
      <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function renderSeries(s: Series, reduced: boolean) {
  if (s.type === "bar") return <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={!reduced} />;
  if (s.type === "area") return <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} isAnimationActive={!reduced} connectNulls />;
  return (
    <Line
      key={s.key}
      dataKey={s.key}
      name={s.name}
      stroke={s.color}
      strokeWidth={2}
      strokeDasharray={s.dashed ? "4 4" : undefined}
      dot={s.dot ? { r: 3, strokeWidth: 0, fill: s.color } : false}
      activeDot={{ r: 4, strokeWidth: 0 }}
      isAnimationActive={!reduced}
      connectNulls
    />
  );
}

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
  if (!data.length || isEmpty(data, series)) return <ChartEmpty height={height} />;
  const fmtUnit = (v: unknown) => (typeof v === "number" ? `${tickNumber(v)}${unit ? " " + unit : ""}` : String(v));
  return (
    <ChartFrame ariaLabel={ariaLabel} unit={unit} height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        {grid}
        <XAxis dataKey="date" tickFormatter={(d: string) => formatDateShort(d)} {...axis} minTickGap={18} />
        <YAxis {...axis} domain={yDomain ?? yDomainFor(series)} tickFormatter={tickNumber} width={52} allowDecimals={false} />
        <Tooltip {...tooltipStyle} labelFormatter={(d) => formatDateShort(String(d))} formatter={fmtUnit} />
        {series.length > 1 && <Legend wrapperStyle={legendStyle} />}
        {reference && <ReferenceLine y={reference.y} stroke={reference.color ?? "var(--warning)"} strokeDasharray="4 4" label={{ value: reference.label, fill: "var(--muted)", fontSize: 11, position: "insideTopRight" }} />}
        {series.map((x) => renderSeries(x, reduced))}
      </ComposedChart>
    </ChartFrame>
  );
}

/** Wykres kategorii (np. tygodnie cyklu); serie słupkowe domyślnie, liniowe przez type: "line". */
export function SimpleBars({ data, xKey, bars, height = 200, ariaLabel, unit }: { data: Record<string, unknown>[]; xKey: string; bars: Series[]; height?: number; ariaLabel: string; unit?: string }) {
  const reduced = usePrefersReducedMotion();
  const series = bars.map((b) => ({ ...b, type: b.type ?? ("bar" as const) }));
  if (!data.length || isEmpty(data, series)) return <ChartEmpty height={height} />;
  return (
    <ChartFrame ariaLabel={ariaLabel} unit={unit} height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        {grid}
        <XAxis dataKey={xKey} {...axis} padding={{ left: 20, right: 20 }} />
        <YAxis {...axis} domain={yDomainFor(series)} tickFormatter={tickNumber} width={52} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => (typeof v === "number" ? `${tickNumber(v)}${unit ? " " + unit : ""}` : String(v))} />
        {series.length > 1 && <Legend wrapperStyle={legendStyle} />}
        {series.map((x) => renderSeries(x, reduced))}
      </ComposedChart>
    </ChartFrame>
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
  sand: "var(--chart-sand)",
  steel: "var(--chart-steel)",
};
