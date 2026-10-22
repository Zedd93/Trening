/**
 * Silnik progresji (podwójna progresja + RIR + regeneracja).
 *
 * Tydzień 1 → 2: kalibracja ciężaru na podstawie e1RM z uwzględnieniem RIR.
 * Tydzień 2 → 3: progresja powtórzeń; wzrost ciężaru tylko przy wyraźnym zapasie.
 * Tydzień 3 → 4: wzrost ciężaru po osiągnięciu górnej granicy zakresu.
 * Tydzień 4:     konsolidacja albo odciążenie (deload) przy wysokim zmęczeniu.
 * Nowy cykl:     kontynuacja od ostatnich rzeczywistych wyników.
 *
 * Każda rekomendacja zawiera uzasadnienie (lista zdań do wyświetlenia).
 */
import type { ExerciseSet, ProgressionAction, WorkoutExercise } from "@/lib/domain/types";
import { avg, clamp, fmt, roundTo } from "@/lib/utils/format";
import type { ExerciseDef } from "./exercises";

export interface ProgressionContext {
  /** Tydzień programu, w którym ćwiczenie wystąpi następnym razem (null = kolejny cykl) */
  target_week: number | null;
  session_rpe: number | null;
  recovery_rating: number | null;
  /** Średnie zmęczenie z ostatnich dni (1–5) */
  recent_fatigue: number | null;
  missed_sessions: number;
  /** Dni od poprzedniego wykonania tego ćwiczenia */
  days_since_previous: number | null;
}

export interface Recommendation {
  action: ProgressionAction;
  current_load_kg: number | null;
  suggested_load_kg: number | null;
  rep_target: string;
  set_target: number | null;
  explanation: string[];
}

/** Szacowany 1RM (Epley) z uwzględnieniem powtórzeń w zapasie. */
export function estimate1RM(weight: number, reps: number, rir = 0): number {
  return weight * (1 + (reps + rir) / 30);
}

/** Ciężar dla zadanej liczby powtórzeń i RIR przy danym e1RM. */
export function loadFor(e1rm: number, reps: number, rir: number): number {
  return e1rm / (1 + (reps + rir) / 30);
}

const kg = (n: number | null) => (n === null ? "—" : `${fmt(n, 2)} kg`);

function unitLabel(def: ExerciseDef): string {
  return def.load_type === "time" ? "s" : def.load_type === "distance" ? "m" : "powt.";
}

export function recommend(def: ExerciseDef, plan: WorkoutExercise, sets: ExerciseSet[], ctx: ProgressionContext): Recommendation | null {
  if (def.load_type === "cardio" || def.load_type === "mobility") return null;

  const done = sets.filter((s) => s.completed && s.reps !== null).sort((a, b) => a.set_number - b.set_number);
  const unit = unitLabel(def);
  const range = `${plan.rep_min}–${plan.rep_max} ${unit}`;
  const explanation: string[] = [];

  if (!done.length) {
    return {
      action: "hold",
      current_load_kg: plan.suggested_load_kg,
      suggested_load_kg: plan.suggested_load_kg,
      rep_target: range,
      set_target: null,
      explanation: ["Brak zapisanych serii — rekomendacja bez zmian. Zapisuj ciężar, powtórzenia i RIR, aby silnik progresji mógł działać."],
    };
  }

  const weights = done.map((s) => s.weight_kg ?? 0);
  const load = Math.max(...weights);
  const hasLoad = load > 0;
  const reps = done.map((s) => s.reps ?? 0);
  const rirs = done.map((s) => s.rir).filter((r): r is number => r !== null);
  const avgRir = avg(rirs);
  const minReps = Math.min(...reps);
  const completedAll = done.length >= plan.sets;
  const hitTop = completedAll && reps.every((r) => r >= plan.rep_max);
  const belowMinCount = reps.filter((r) => r < plan.rep_min).length;
  const tooHard = avgRir !== null && avgRir < plan.target_rir - 1;
  const veryEasy = avgRir !== null && avgRir >= plan.target_rir + 1;
  const inc = def.increment_kg || 2.5;

  explanation.push(
    `Wynik: ${done.map((s) => `${s.weight_kg ? fmt(s.weight_kg, 2) + " kg × " : ""}${s.reps}${s.rir !== null ? ` (RIR ${s.rir})` : ""}`).join(", ")}. Zakres docelowy ${range}, RIR ${plan.target_rir}.`,
  );
  if (!completedAll) explanation.push(`Wykonano ${done.length} z ${plan.sets} zaplanowanych serii.`);

  // ---- czynniki ograniczające ----
  const fatigueReasons: string[] = [];
  if (ctx.session_rpe !== null && ctx.session_rpe >= 9) fatigueReasons.push(`bardzo wysoka trudność sesji (RPE ${ctx.session_rpe}/10)`);
  if (ctx.recovery_rating !== null && ctx.recovery_rating <= 2) fatigueReasons.push(`słaba regeneracja przed treningiem (${ctx.recovery_rating}/5)`);
  if (ctx.recent_fatigue !== null && ctx.recent_fatigue >= 4) fatigueReasons.push(`wysokie zmęczenie w ostatnich dniach (${fmt(ctx.recent_fatigue, 1)}/5)`);
  const fatigued = fatigueReasons.length > 0;
  const longBreak = ctx.days_since_previous !== null && ctx.days_since_previous > 10;
  const missedMany = ctx.missed_sessions >= 2;
  const badTechnique = plan.technique_ok === false;

  const round = (n: number) => (def.load_type === "dumbbell" || def.load_type === "kettlebell" ? roundTo(n, Math.max(1, inc)) : roundTo(n, inc));
  const result = (action: ProgressionAction, suggested: number | null, repTarget: string, setTarget: number | null = null): Recommendation => ({
    action,
    current_load_kg: hasLoad ? load : null,
    suggested_load_kg: suggested,
    rep_target: repTarget,
    set_target: setTarget,
    explanation,
  });

  // ---- 1. Wyraźne niepowodzenie / zła technika ----
  if (badTechnique) {
    explanation.push("Technika została oznaczona jako do poprawy — ciężar pozostaje bez zmian, priorytetem jest jakość ruchu.");
    return result("hold", hasLoad ? load : null, range);
  }
  if (belowMinCount > 0) {
    const majority = belowMinCount >= Math.ceil(done.length / 2);
    if (hasLoad && (majority || (avgRir !== null && avgRir <= 0))) {
      const reduced = round(load * (majority && minReps < plan.rep_min - 2 ? 0.9 : 0.95));
      explanation.push(
        `Nie osiągnięto dolnej granicy zakresu (${plan.rep_min} ${unit}) w ${belowMinCount} ${belowMinCount === 1 ? "serii" : "seriach"}. Proponowane zmniejszenie ciężaru do ${kg(reduced)}, aby wrócić do zakresu z właściwą techniką.`,
      );
      return result("decrease_load", reduced, range);
    }
    explanation.push(`Jedna lub kilka serii poniżej ${plan.rep_min} ${unit} — ciężar bez zmian. Celem jest wykonanie wszystkich serii w zakresie.`);
    return result("hold", hasLoad ? load : null, range);
  }

  // ---- 2. Przerwa / pominięte treningi ----
  if (longBreak || missedMany) {
    const why = longBreak ? `${ctx.days_since_previous} dni od poprzedniego wykonania` : `${ctx.missed_sessions} pominięte treningi`;
    if (hasLoad && ctx.days_since_previous !== null && ctx.days_since_previous > 14) {
      const reduced = round(load * 0.95);
      explanation.push(`Dłuższa przerwa (${why}) — bezpieczny powrót: ${kg(reduced)} i stopniowy powrót do progresji.`);
      return result("decrease_load", reduced, range);
    }
    explanation.push(`Nieregularność treningów (${why}) — utrzymaj ciężar, zanim zaczniesz go podnosić.`);
    return result("hold", hasLoad ? load : null, range);
  }

  // ---- 3. Zmęczenie / regeneracja ----
  if (fatigued) {
    explanation.push(`Zgłoszone sygnały zmęczenia: ${fatigueReasons.join("; ")}.`);
    if (ctx.target_week === 4) {
      const reduced = hasLoad ? round(load * 0.9) : null;
      const setsTarget = Math.max(2, Math.round(plan.sets * 0.6));
      explanation.push(`Tydzień 4 jako odciążenie: ${setsTarget} serie, ${reduced ? kg(reduced) : "lżejsza wersja"}, RIR 3–4. Pozwoli to odbudować gotowość przed kolejnym cyklem.`);
      return result("deload", reduced, range, setsTarget);
    }
    explanation.push("Nawet jeśli wyniki pozwalają na progres, ciężar pozostaje bez zmian do czasu poprawy regeneracji (sen, odżywianie, obciążenia poza siłownią).");
    return result("hold", hasLoad ? load : null, range);
  }

  // ---- 4. Fazy cyklu ----
  const tw = ctx.target_week;

  // Kalibracja po tygodniu 1 (tylko ćwiczenia z obciążeniem i zapisanym RIR)
  if (tw === 2 && hasLoad && (def.load_type === "barbell" || def.load_type === "dumbbell" || def.load_type === "cable" || def.load_type === "kettlebell") && avgRir !== null) {
    const best = done.reduce((b, s) => {
      const e = estimate1RM(s.weight_kg ?? 0, s.reps ?? 0, s.rir ?? 0);
      return e > b ? e : b;
    }, 0);
    const targetReps = Math.min(plan.rep_max, plan.rep_min + 1);
    const ideal = loadFor(best, targetReps, plan.target_rir);
    const suggested = round(clamp(ideal, load * 0.9, load * 1.1));
    explanation.push(
      `Kalibracja po tygodniu 1: szacowane 1RM ≈ ${fmt(best, 1)} kg (wzór Epleya z uwzględnieniem RIR). Dla ${targetReps} ${unit} przy RIR ${plan.target_rir} odpowiada to ≈ ${fmt(ideal, 1)} kg. Zmiana ograniczona do ±10%.`,
    );
    if (suggested > load) {
      explanation.push(`Ciężar był za lekki względem docelowego wysiłku — proponowane ${kg(suggested)}.`);
      return result("calibrate", suggested, `${targetReps}–${plan.rep_max} ${unit}`);
    }
    if (suggested < load) {
      explanation.push(`Wysiłek był wyższy niż zakładany — proponowane ${kg(suggested)}.`);
      return result("calibrate", suggested, `${targetReps}–${plan.rep_max} ${unit}`);
    }
    explanation.push("Ciężar dobrany trafnie. W tygodniu 2 dołóż powtórzenia w zakresie.");
    return result("increase_reps", load, `${Math.min(plan.rep_max, minReps + 1)}–${plan.rep_max} ${unit}`);
  }

  if (tw === 4) {
    if (hitTop && veryEasy && hasLoad) {
      const up = round(load + inc);
      explanation.push(`Górna granica zakresu z dużym zapasem (średni RIR ${fmt(avgRir, 1)}). W tygodniu konsolidacji dopuszczalny niewielki wzrost do ${kg(up)}.`);
      return result("increase_load", up, `${plan.rep_min}–${plan.rep_max} ${unit}`);
    }
    explanation.push("Tydzień 4 — konsolidacja: utrzymaj ciężar i wykonaj te same powtórzenia technicznie lepiej lub z większym zapasem RIR. Wyniki posłużą do ułożenia kolejnego cyklu.");
    return result("hold", hasLoad ? load : null, range);
  }

  if (hitTop && !tooHard) {
    if (!hasLoad) {
      if (def.load_type === "time" || def.load_type === "distance") {
        const add = def.load_type === "time" ? 5 : 5;
        explanation.push(`Górna granica osiągnięta — wydłuż o ${add} ${unit} lub zwiększ trudność wariantu.`);
        return result("increase_reps", null, `${plan.rep_min + add}–${plan.rep_max + add} ${unit}`);
      }
      explanation.push(`Wszystkie serie w górnej granicy (${plan.rep_max}). Dodaj obciążenie (np. ${fmt(inc, 1)} kg na pasie/kamizelce) lub trudniejszy wariant.`);
      return result("increase_load", inc, `${plan.rep_min}–${plan.rep_max} ${unit}`);
    }
    if (tw === 2 && !veryEasy) {
      explanation.push("Górna granica osiągnięta. Tydzień 2 służy utrwaleniu powtórzeń — ciężar bez zmian, wzrost zaplanowany na tydzień 3.");
      return result("hold", load, `${plan.rep_max} ${unit} we wszystkich seriach`);
    }
    const up = round(load + inc);
    explanation.push(
      `Wszystkie serie w górnej granicy zakresu (${plan.rep_max} ${unit})${avgRir !== null ? ` przy średnim RIR ${fmt(avgRir, 1)}` : ""}. Warunek progresji spełniony: ${kg(load)} → ${kg(up)}. Na nowym ciężarze zacznij od dolnej części zakresu.`,
    );
    return result("increase_load", up, `${plan.rep_min}–${plan.rep_max} ${unit}`);
  }

  if (tooHard) {
    explanation.push(`Średni RIR ${fmt(avgRir, 1)} jest niższy niż docelowy (${plan.target_rir}) — serie były bliżej upadku niż planowano. Utrzymaj ciężar i celuj w ten sam wynik z większym zapasem.`);
    return result("hold", hasLoad ? load : null, range);
  }

  const next = Math.min(plan.rep_max, minReps + 1);
  explanation.push(`Wszystkie serie w zakresie. Kolejny krok: dołóż powtórzenie — cel min. ${next} ${unit} w każdej serii przy ${hasLoad ? kg(load) : "tym samym wariancie"}.`);
  return result("increase_reps", hasLoad ? load : null, `${next}–${plan.rep_max} ${unit}`);
}

/* ------------------------------------------------------------------ */
/* Ocena zmęczenia dla decyzji o odciążeniu w tygodniu 4                */
/* ------------------------------------------------------------------ */

export interface FatigueAssessment {
  deload: boolean;
  reasons: string[];
}

export function assessFatigue(input: {
  week3_session_rpe: number[];
  week3_recovery: number[];
  checkin_fatigue: number[];
  checkin_sleep: number[];
  strength_trend_pct: number | null;
}): FatigueAssessment {
  const reasons: string[] = [];
  const rpe = avg(input.week3_session_rpe);
  const rec = avg(input.week3_recovery);
  const fat = avg(input.checkin_fatigue);
  const sleep = avg(input.checkin_sleep);
  if (rpe !== null && rpe >= 8.5) reasons.push(`średnia trudność sesji w tygodniu 3: ${fmt(rpe, 1)}/10`);
  if (rec !== null && rec <= 2.5) reasons.push(`niska ocena regeneracji: ${fmt(rec, 1)}/5`);
  if (fat !== null && fat >= 3.8) reasons.push(`wysokie zmęczenie dzienne: ${fmt(fat, 1)}/5`);
  if (sleep !== null && sleep <= 2.2) reasons.push(`słaba jakość snu: ${fmt(sleep, 1)}/5`);
  if (input.strength_trend_pct !== null && input.strength_trend_pct <= -3) reasons.push(`spadek siły o ${fmt(Math.abs(input.strength_trend_pct), 1)}%`);
  return { deload: reasons.length >= 2, reasons };
}
