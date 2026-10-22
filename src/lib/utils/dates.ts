/**
 * Operacje na datach w formacie lokalnym "YYYY-MM-DD".
 * Tydzień zaczyna się w poniedziałek (indeks 0 = poniedziałek).
 */

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

/** 0 = poniedziałek ... 6 = niedziela */
export function weekdayIndex(date: ISODate): number {
  return (parseISODate(date).getDay() + 6) % 7;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date));
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const WEEKDAYS_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
export const WEEKDAYS_LONG = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const MONTHS_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

export function formatDateLong(date: ISODate): string {
  const d = parseISODate(date);
  return `${WEEKDAYS_LONG[weekdayIndex(date)]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function formatDateShort(date: ISODate): string {
  const d = parseISODate(date);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

export function formatDateFull(date: ISODate): string {
  const d = parseISODate(date);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Format 24-godzinny HH:MM */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
