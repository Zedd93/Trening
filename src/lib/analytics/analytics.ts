/**
 * Integracja treningu i żywienia: trendy, jakość danych, adaptacyjne TDEE,
 * ochrona masy mięśniowej, raport tygodniowy. Wnioski formułowane ostrożnie —
 * przy niewystarczających danych aplikacja mówi to wprost.
 */
import type {
  BodyMeasurement,
  DailyCheckin,
  ExerciseSet,
  FoodLogEntry,
  GoalType,
  NutritionTarget,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/domain/types";
import { addDays, diffDays, rangeDays, type ISODate } from "@/lib/utils/dates";
import { avg, fmt, round, sum } from "@/lib/utils/format";
import { estimate1RM } from "@/lib/training/progression";
import { EXERCISE_MAP } from "@/lib/training/exercises";

/* ------------------------------------------------------------------ */
/* Masa ciała: średnia ruchoma (wykładnicza) i nachylenie trendu        */
/* ------------------------------------------------------------------ */

export interface WeightPoint {
  date: ISODate;
  weight: number;
  trend: number;
}

/** Wykładnicza średnia ruchoma (α = 0,1 na dzień), odporna na wahania wody. */
export function weightTrend(measurements: BodyMeasurement[]): WeightPoint[] {
  const pts = measurements
    .filter((m) => m.weight_kg !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: WeightPoint[] = [];
  let trend: number | null = null;
  let lastDate: ISODate | null = null;
  for (const m of pts) {
    const w = m.weight_kg!;
    if (trend === null || lastDate === null) trend = w;
    else {
      const days = Math.max(1, diffDays(m.date, lastDate));
      const alpha = 1 - Math.pow(0.9, days);
      trend = trend + alpha * (w - trend);
    }
    lastDate = m.date;
    out.push({ date: m.date, weight: w, trend: round(trend, 2) });
  }
  return out;
}

/** Nachylenie regresji liniowej (kg/dzień) dla pomiarów z okna. */
export function slopePerDay(points: { date: ISODate; weight: number }[]): number | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => diffDays(p.date, x0));
  const ys = points.map((p) => p.weight);
  const mx = avg(xs)!;
  const my = avg(ys)!;
  const num = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const den = sum(xs.map((x) => (x - mx) ** 2));
  return den === 0 ? null : num / den;
}

/* ------------------------------------------------------------------ */
/* Żywienie: dzienne sumy i zgodność                                   */
/* ------------------------------------------------------------------ */

export interface DayIntake {
  date: ISODate;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  entries: number;
}

export function dailyIntake(log: FoodLogEntry[], from: ISODate, to: ISODate): DayIntake[] {
  return rangeDays(from, to).map((date) => {
    const e = log.filter((l) => l.date === date);
    return {
      date,
      kcal: Math.round(sum(e.map((x) => x.kcal))),
      protein_g: round(sum(e.map((x) => x.protein_g)), 1),
      fat_g: round(sum(e.map((x) => x.fat_g)), 1),
      carbs_g: round(sum(e.map((x) => x.carbs_g)), 1),
      entries: e.length,
    };
  });
}

/** Dzień uznany za zalogowany: ≥ 2 wpisy i ≥ 800 kcal (filtr niepełnych dni). */
export const isLoggedDay = (d: DayIntake) => d.entries >= 2 && d.kcal >= 800;

export function activeTarget(targets: NutritionTarget[], date: ISODate): NutritionTarget | undefined {
  return [...targets].filter((t) => t.valid_from <= date).sort((a, b) => b.valid_from.localeCompare(a.valid_from) || b.created_at.localeCompare(a.created_at))[0];
}

/* ------------------------------------------------------------------ */
/* Adaptacyjne TDEE i propozycja korekty kalorii                        */
/* ------------------------------------------------------------------ */

export interface AdaptiveResult {
  status: "insufficient" | "ok";
  quality: DataQuality;
  avg_intake: number | null;
  weight_change_per_week: number | null;
  estimated_tdee: number | null;
  proposal: { new_kcal: number; delta: number; reasons: string[] } | null;
  message: string;
}

export interface DataQuality {
  score: number; // 0–100
  weigh_ins: number;
  logged_days: number;
  window_days: number;
  label: "niska" | "umiarkowana" | "dobra";
  notes: string[];
}

export function dataQuality(weighIns: number, loggedDays: number, windowDays: number): DataQuality {
  const notes: string[] = [];
  const wScore = Math.min(1, weighIns / (windowDays * 0.6));
  const lScore = Math.min(1, loggedDays / (windowDays * 0.8));
  const score = Math.round((wScore * 0.5 + lScore * 0.5) * 100);
  if (wScore < 1) notes.push(`Pomiary masy: ${weighIns} w ${windowDays} dni (zalecane min. ${Math.ceil(windowDays * 0.6)} — najlepiej rano, po toalecie, przed jedzeniem).`);
  if (lScore < 1) notes.push(`Pełne dni w dzienniku: ${loggedDays} z ${windowDays} (zalecane min. ${Math.ceil(windowDays * 0.8)}).`);
  return { score, weigh_ins: weighIns, logged_days: loggedDays, window_days: windowDays, label: score >= 75 ? "dobra" : score >= 45 ? "umiarkowana" : "niska", notes };
}

const KCAL_PER_KG = 7700;

/**
 * Szacowanie rzeczywistego TDEE z bilansu: TDEE ≈ średnie spożycie − Δmasa·7700/dni.
 * Propozycja zmiany kalorii tylko przy wystarczających danych z ≥ 14 dni
 * i wyłącznie do zatwierdzenia przez użytkownika.
 */
export function adaptiveTdee(input: {
  measurements: BodyMeasurement[];
  log: FoodLogEntry[];
  target: NutritionTarget | undefined;
  goal: GoalType;
  weight_kg: number;
  today: ISODate;
  window_days?: number;
  steps_change_pct?: number | null;
}): AdaptiveResult {
  const window = input.window_days ?? 14;
  const from = addDays(input.today, -window);
  const to = addDays(input.today, -1);
  const weights = input.measurements.filter((m) => m.weight_kg !== null && m.date >= from && m.date <= input.today).map((m) => ({ date: m.date, weight: m.weight_kg! }));
  const days = dailyIntake(input.log, from, to).filter(isLoggedDay);
  const quality = dataQuality(weights.length, days.length, window);
  const base: AdaptiveResult = { status: "insufficient", quality, avg_intake: null, weight_change_per_week: null, estimated_tdee: null, proposal: null, message: "" };
  if (weights.length < Math.ceil(window * 0.5) || days.length < Math.ceil(window * 0.6)) {
    return { ...base, message: `Za mało danych, aby rzetelnie ocenić bilans (pomiary masy: ${weights.length}, pełne dni dziennika: ${days.length} z ${window}). Kalorie pozostają bez zmian.` };
  }
  const slope = slopePerDay(weights);
  const intake = avg(days.map((d) => d.kcal))!;
  if (slope === null) return { ...base, message: "Nie można wyznaczyć trendu masy ciała." };
  const tdee = intake - slope * KCAL_PER_KG;
  const perWeek = slope * 7;
  const res: AdaptiveResult = { status: "ok", quality, avg_intake: Math.round(intake), weight_change_per_week: round(perWeek, 2), estimated_tdee: Math.round(tdee), proposal: null, message: "" };
  const t = input.target;
  if (!t) return { ...res, message: "Brak aktywnego celu żywieniowego." };

  const pctPerWeek = (perWeek / input.weight_kg) * 100;
  const reasons: string[] = [
    `Średnie spożycie z ${days.length} pełnych dni: ${Math.round(intake)} kcal (cel: ${t.kcal} kcal).`,
    `Trend masy ciała (regresja z ${weights.length} pomiarów): ${perWeek >= 0 ? "+" : ""}${fmt(perWeek, 2)} kg/tydz. (${fmt(pctPerWeek, 2)}% masy).`,
    `Szacowane rzeczywiste TDEE: ≈ ${Math.round(tdee)} kcal (wcześniejsze oszacowanie: ${t.tdee} kcal).`,
  ];
  const adherence = Math.abs(intake - t.kcal) / t.kcal;
  if (adherence > 0.1) {
    return {
      ...res,
      message: `Spożycie odbiega od celu o ${Math.round(adherence * 100)}%. Zanim zmienisz kalorie, spróbuj przez tydzień trzymać się obecnego celu — wtedy ocena będzie wiarygodna.`,
    };
  }
  if (input.steps_change_pct !== null && input.steps_change_pct !== undefined && input.steps_change_pct <= -20) {
    reasons.push(`Średnia liczba kroków spadła o ${Math.abs(Math.round(input.steps_change_pct))}% — część zmiany może wynikać z mniejszej aktywności. Alternatywą jest powrót do wcześniejszej liczby kroków.`);
  }

  let delta = 0;
  if (input.goal === "fat_loss") {
    // Zastój (< 0,2%/tydz.) → niewielka korekta; zbyt szybki spadek (> 1%/tydz.) → zmniejszenie deficytu.
    if (pctPerWeek > -0.2) delta = pctPerWeek > 0.1 ? -200 : -150;
    else if (pctPerWeek < -1.0) delta = 150;
  } else if (input.goal === "muscle_gain") {
    if (pctPerWeek < 0.05) delta = +150;
    else if (pctPerWeek > 0.5) delta = -150;
  } else if (input.goal === "maintenance" || input.goal === "conditioning" || input.goal === "strength" || input.goal === "recomposition") {
    if (Math.abs(pctPerWeek) > 0.3) delta = pctPerWeek > 0 ? -150 : +150;
  }

  if (delta === 0) return { ...res, message: "Trend masy ciała jest zgodny z celem — bez zmian kalorii.", proposal: null };
  if (input.goal === "fat_loss" && delta < 0) reasons.push("Brak wyraźnego spadku średniej masy ciała przy dobrej zgodności z dziennikiem.");
  if (input.goal === "fat_loss" && delta > 0) reasons.push("Masa ciała spada szybciej niż ~1% tygodniowo — rośnie ryzyko utraty masy mięśniowej i spadku wyników.");
  return {
    ...res,
    message: `Proponowana korekta: ${delta > 0 ? "+" : ""}${delta} kcal/dzień (wymaga Twojego zatwierdzenia).`,
    proposal: { new_kcal: t.kcal + delta, delta, reasons },
  };
}

/* ------------------------------------------------------------------ */
/* Siła: e1RM per ćwiczenie w czasie                                     */
/* ------------------------------------------------------------------ */

export interface StrengthPoint {
  date: ISODate;
  e1rm: number;
  top_weight: number;
  volume: number;
}

export function strengthHistory(exerciseId: string, sets: ExerciseSet[], sessions: Record<string, WorkoutSession>): StrengthPoint[] {
  const bySession = new Map<string, ExerciseSet[]>();
  for (const s of sets) if (s.exercise_id === exerciseId && s.completed && s.reps && s.weight_kg) bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s]);
  const pts: StrengthPoint[] = [];
  for (const [sid, list] of bySession) {
    const sess = sessions[sid];
    if (!sess) continue;
    const date = (sess.completed_at ?? sess.started_at ?? sess.scheduled_date).slice(0, 10);
    pts.push({
      date,
      e1rm: round(Math.max(...list.map((s) => estimate1RM(s.weight_kg!, s.reps!, s.rir ?? 0))), 1),
      top_weight: Math.max(...list.map((s) => s.weight_kg!)),
      volume: Math.round(sum(list.map((s) => s.weight_kg! * s.reps!))),
    });
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

/** Zmiana siły (%) — średnia z ćwiczeń głównych między pierwszym i ostatnim pomiarem w oknie. */
export function strengthChangePct(sets: ExerciseSet[], sessions: Record<string, WorkoutSession>, from: ISODate, to: ISODate): number | null {
  const mains = Object.values(EXERCISE_MAP).filter((e) => e.category === "main").map((e) => e.id);
  const changes: number[] = [];
  for (const id of mains) {
    const h = strengthHistory(id, sets, sessions);
    const inWin = h.filter((p) => p.date <= to);
    const before = inWin.filter((p) => p.date < from);
    const within = inWin.filter((p) => p.date >= from);
    const a = before.at(-1) ?? within[0];
    const b = within.at(-1);
    if (a && b && a !== b && a.e1rm > 0) changes.push(((b.e1rm - a.e1rm) / a.e1rm) * 100);
  }
  return changes.length ? round(avg(changes)!, 1) : null;
}

export function sessionVolume(sessionId: string, sets: ExerciseSet[]): number {
  return Math.round(sum(sets.filter((s) => s.session_id === sessionId && s.completed && s.weight_kg && s.reps).map((s) => s.weight_kg! * s.reps!)));
}

/* ------------------------------------------------------------------ */
/* Ochrona masy mięśniowej                                              */
/* ------------------------------------------------------------------ */

export interface Alert {
  level: "info" | "warning";
  title: string;
  causes: string[];
  actions: string[];
}

export function muscleProtectionAlerts(input: {
  weight_change_pct_per_week: number | null;
  strength_change_pct: number | null;
  avg_fatigue: number | null;
  avg_protein: number | null;
  protein_target: number | null;
  goal: GoalType;
}): Alert[] {
  const signals: string[] = [];
  if (input.weight_change_pct_per_week !== null && input.weight_change_pct_per_week < -1) signals.push(`szybki spadek masy (${fmt(input.weight_change_pct_per_week, 2)}%/tydz.)`);
  if (input.strength_change_pct !== null && input.strength_change_pct <= -3) signals.push(`spadek wyników siłowych (${fmt(input.strength_change_pct, 1)}%)`);
  if (input.avg_fatigue !== null && input.avg_fatigue >= 3.8) signals.push(`wysokie zgłaszane zmęczenie (${fmt(input.avg_fatigue, 1)}/5)`);
  if (input.avg_protein !== null && input.protein_target && input.avg_protein < input.protein_target * 0.8) signals.push(`białko poniżej celu (${Math.round(input.avg_protein)} z ${input.protein_target} g)`);
  if (!signals.length) return [];
  return [
    {
      level: signals.length >= 2 ? "warning" : "info",
      title: "Ochrona masy mięśniowej — sygnały do sprawdzenia",
      causes: [`Wykryto: ${signals.join("; ")}.`, "Możliwe przyczyny: zbyt duży deficyt, za mało białka, niewystarczający sen lub regeneracja, zbyt duża łączna objętość treningowa lub dodatkowa aktywność."],
      actions: [
        "Sprawdź, czy białko osiąga cel (rozłóż je na 3–5 posiłków).",
        input.goal === "fat_loss" ? "Rozważ zmniejszenie deficytu o 100–200 kcal." : "Sprawdź, czy spożycie energii odpowiada celowi.",
        "Oceń sen i regenerację; w razie potrzeby zastosuj tydzień odciążenia.",
        "Ta ocena nie jest diagnozą — przy niepokojących objawach skonsultuj się z lekarzem.",
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Raport tygodniowy                                                   */
/* ------------------------------------------------------------------ */

export interface WeeklyReportData {
  week_start: ISODate;
  week_end: ISODate;
  weight_avg: number | null;
  weight_avg_prev: number | null;
  weight_change: number | null;
  waist_change: number | null;
  sessions_planned: number;
  sessions_done: number;
  strength_change_pct: number | null;
  kcal_avg: number | null;
  protein_avg: number | null;
  kcal_target: number | null;
  protein_target: number | null;
  adherence_kcal_pct: number | null;
  adherence_protein_pct: number | null;
  recovery_avg: number | null;
  fatigue_avg: number | null;
  sleep_avg: number | null;
  quality: DataQuality;
  recommendations: string[];
  alerts: Alert[];
}

export function weeklyReport(input: {
  week_start: ISODate;
  measurements: BodyMeasurement[];
  log: FoodLogEntry[];
  targets: NutritionTarget[];
  sessions: WorkoutSession[];
  sets: ExerciseSet[];
  checkins: DailyCheckin[];
  goal: GoalType;
  weight_kg: number;
}): WeeklyReportData {
  const ws = input.week_start;
  const we = addDays(ws, 6);
  const prevStart = addDays(ws, -7);
  const inRange = (d: ISODate, a: ISODate, b: ISODate) => d >= a && d <= b;
  const wThis = input.measurements.filter((m) => m.weight_kg !== null && inRange(m.date, ws, we)).map((m) => m.weight_kg!);
  const wPrev = input.measurements.filter((m) => m.weight_kg !== null && inRange(m.date, prevStart, addDays(ws, -1))).map((m) => m.weight_kg!);
  const waistThis = input.measurements.filter((m) => m.waist_cm !== null && inRange(m.date, ws, we)).map((m) => m.waist_cm!);
  const waistPrev = input.measurements.filter((m) => m.waist_cm !== null && m.date < ws).sort((a, b) => b.date.localeCompare(a.date)).map((m) => m.waist_cm!);
  const weightAvg = wThis.length ? round(avg(wThis)!, 2) : null;
  const weightPrev = wPrev.length ? round(avg(wPrev)!, 2) : null;

  const days = dailyIntake(input.log, ws, we).filter(isLoggedDay);
  const target = activeTarget(input.targets, we);
  const kcalAvg = days.length ? Math.round(avg(days.map((d) => d.kcal))!) : null;
  const protAvg = days.length ? Math.round(avg(days.map((d) => d.protein_g))!) : null;

  const sess = input.sessions.filter((s) => inRange(s.scheduled_date, ws, we) || (s.completed_at && inRange(s.completed_at.slice(0, 10), ws, we)));
  const done = sess.filter((s) => s.status === "completed");
  const sessionMap = Object.fromEntries(input.sessions.map((s) => [s.id, s]));
  const strength = strengthChangePct(input.sets, sessionMap, ws, we);
  const chk = input.checkins.filter((c) => inRange(c.date, ws, we));
  const recovery = done.map((s) => s.recovery_rating).filter((r): r is number => r !== null);
  const quality = dataQuality(wThis.length, days.length, 7);

  const rec: string[] = [];
  const weightChange = weightAvg !== null && weightPrev !== null ? round(weightAvg - weightPrev, 2) : null;
  if (quality.label === "niska") rec.push("Jakość danych jest niska — wnioski są orientacyjne. Ważenie 4–7 razy w tygodniu i pełny dziennik poprawią trafność rekomendacji.");
  const planned = sess.filter((s) => s.status !== "skipped").length || sess.length;
  if (done.length < planned) rec.push(`Wykonano ${done.length} z ${planned} treningów. W kolejnym tygodniu zaplanuj treningi w dniach o mniejszym obciążeniu, by utrzymać regularność.`);
  if (protAvg !== null && target && protAvg < target.protein_g * 0.9) rec.push(`Średnie białko ${protAvg} g przy celu ${target.protein_g} g — dodaj źródło białka do 1–2 posiłków (np. skyr, twaróg, chude mięso, tofu).`);
  if (kcalAvg !== null && target && Math.abs(kcalAvg - target.kcal) / target.kcal > 0.1) rec.push(`Średnie spożycie ${kcalAvg} kcal odbiega od celu ${target.kcal} kcal o ponad 10%.`);
  if (weightChange !== null && quality.label !== "niska") {
    const pct = (weightChange / input.weight_kg) * 100;
    if (input.goal === "fat_loss" && pct > -0.1) rec.push("Średnia masa nie spadła w porównaniu z poprzednim tygodniem. Jeden tydzień to za mało na zmianę kalorii — obserwuj trend przez kolejny tydzień.");
    if (input.goal === "fat_loss" && pct < -1) rec.push("Masa spada szybciej niż 1%/tydz. — rozważ zmniejszenie deficytu, aby chronić masę mięśniową.");
    if (input.goal === "muscle_gain" && pct < 0) rec.push("Masa ciała nie rośnie — jeśli utrzyma się to w kolejnym tygodniu, aplikacja zaproponuje niewielkie zwiększenie kalorii.");
  }
  const fatigue = avg(chk.map((c) => c.fatigue));
  if (fatigue !== null && fatigue >= 3.8) rec.push("Wysokie zmęczenie — zadbaj o sen (7–9 h) i rozważ lżejszy tydzień.");
  if (strength !== null && strength > 0) rec.push(`Siła rośnie (≈ +${fmt(strength, 1)}% e1RM w ćwiczeniach głównych) — kontynuuj progresję.`);
  if (!rec.length) rec.push("Tydzień zgodny z planem — kontynuuj.");

  const alerts = muscleProtectionAlerts({
    weight_change_pct_per_week: weightChange !== null ? (weightChange / input.weight_kg) * 100 : null,
    strength_change_pct: strength,
    avg_fatigue: fatigue,
    avg_protein: protAvg,
    protein_target: target?.protein_g ?? null,
    goal: input.goal,
  });

  return {
    week_start: ws,
    week_end: we,
    weight_avg: weightAvg,
    weight_avg_prev: weightPrev,
    weight_change: weightChange,
    waist_change: waistThis.length && waistPrev.length ? round(waistThis.at(-1)! - waistPrev[0], 1) : null,
    sessions_planned: planned,
    sessions_done: done.length,
    strength_change_pct: strength,
    kcal_avg: kcalAvg,
    protein_avg: protAvg,
    kcal_target: target?.kcal ?? null,
    protein_target: target?.protein_g ?? null,
    adherence_kcal_pct: kcalAvg !== null && target ? Math.round((1 - Math.abs(kcalAvg - target.kcal) / target.kcal) * 100) : null,
    adherence_protein_pct: protAvg !== null && target ? Math.min(100, Math.round((protAvg / target.protein_g) * 100)) : null,
    recovery_avg: recovery.length ? round(avg(recovery)!, 1) : null,
    fatigue_avg: fatigue !== null ? round(fatigue, 1) : null,
    sleep_avg: chk.length ? round(avg(chk.map((c) => c.sleep_quality))!, 1) : null,
    quality,
    recommendations: rec,
    alerts,
  };
}

/** Pomocnicze: sety danej sesji pogrupowane po ćwiczeniu planu. */
export function setsByWorkoutExercise(sets: ExerciseSet[]): Map<string, ExerciseSet[]> {
  const m = new Map<string, ExerciseSet[]>();
  for (const s of sets) m.set(s.workout_exercise_id, [...(m.get(s.workout_exercise_id) ?? []), s]);
  return m;
}

export type { WorkoutExercise };
