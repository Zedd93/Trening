export function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Zaokrąglenie do najbliższej wielokrotności kroku (np. 2.5 kg, 5 g). */
export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const nf = (digits: number) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf(digits).format(n);
}

export function fmtKg(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${fmt(n, 2)} kg`;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function avg(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const d10 = abs % 10;
  const d100 = abs % 100;
  if (d10 >= 2 && d10 <= 4 && !(d100 >= 12 && d100 <= 14)) return few;
  return many;
}
