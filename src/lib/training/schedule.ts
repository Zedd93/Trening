import type { Sport, WorkoutSession } from "@/lib/domain/types";
import { diffDays, weekdayIndex, type ISODate } from "@/lib/utils/dates";

export interface MoveCheck {
  allowed: boolean;
  level: "ok" | "warning" | "blocked";
  messages: string[];
}

/**
 * Ocena przeniesienia treningu z uwzględnieniem regeneracji:
 *  - dwa treningi siłowe tego samego dnia — blokada,
 *  - treningi Full Body w kolejne dni — ostrzeżenie (zalecane ≥ 48 h),
 *  - intensywny sport tego dnia lub dzień wcześniej — informacja.
 */
export function checkMove(session: WorkoutSession, newDate: ISODate, all: WorkoutSession[], sports: Sport[]): MoveCheck {
  const messages: string[] = [];
  const others = all.filter((s) => s.id !== session.id && s.program_id === session.program_id && s.status !== "skipped");
  if (others.some((s) => s.scheduled_date === newDate)) {
    return { allowed: false, level: "blocked", messages: ["Tego dnia jest już zaplanowany trening siłowy. Dwa treningi Full Body jednego dnia nie dają wystarczającej regeneracji."] };
  }
  const neighbours = others.filter((s) => Math.abs(diffDays(s.scheduled_date, newDate)) === 1);
  for (const n of neighbours) {
    messages.push(`Trening ${n.template} jest ${diffDays(n.scheduled_date, newDate) > 0 ? "dzień później" : "dzień wcześniej"} (${n.scheduled_date}). Między sesjami Full Body zalecane jest ok. 48 h przerwy — rozważ inny termin lub obniż intensywność.`);
  }
  const wd = weekdayIndex(newDate);
  const hardSports = sports.filter((sp) => sp.intensity !== "low" && (sp.days.includes(wd) || sp.days.includes((wd + 6) % 7)));
  for (const sp of hardSports) {
    messages.push(`${sp.name} (${sp.intensity === "high" ? "wysoka" : "umiarkowana"} intensywność) w tym dniu lub dzień wcześniej — może obniżyć jakość treningu nóg.`);
  }
  const weekStartGap = diffDays(newDate, session.scheduled_date);
  if (Math.abs(weekStartGap) > 6) messages.push("Przeniesienie o ponad tydzień zmienia kolejność faz programu (progresji). Rozważ oznaczenie treningu jako pominiętego.");
  return { allowed: true, level: messages.length ? "warning" : "ok", messages };
}

/** Pominięte = zaplanowane w przeszłości (z 1 dniem tolerancji) i niewykonane. */
export function missedSessions(sessions: WorkoutSession[], todayDate: ISODate): WorkoutSession[] {
  return sessions.filter((s) => (s.status === "planned" || s.status === "skipped") && diffDays(todayDate, s.scheduled_date) > 1);
}

export function nextSession(sessions: WorkoutSession[], todayDate: ISODate): WorkoutSession | undefined {
  const inProgress = sessions.find((s) => s.status === "in_progress");
  if (inProgress) return inProgress;
  return [...sessions]
    .filter((s) => s.status === "planned" && s.scheduled_date >= todayDate)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.day_index - b.day_index)[0];
}

export function sessionElapsedSec(s: WorkoutSession, now = Date.now()): number {
  if (!s.started_at) return 0;
  const end = s.completed_at ? new Date(s.completed_at).getTime() : s.paused_at ? new Date(s.paused_at).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(s.started_at).getTime() - (s.paused_ms ?? 0)) / 1000));
}
