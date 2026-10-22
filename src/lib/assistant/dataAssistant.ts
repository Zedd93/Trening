/**
 * Asystent danych — odpowiedzi budowane deterministycznie z zapisanych danych
 * (bez modelu AI). Każda odpowiedź jest wprost oznaczona jako analiza regułowa.
 */
import type { Snapshot } from "@/lib/domain/types";
import { dayTypeOn, getActiveProgram, getGoals, getPrefs, getProfile, getTarget, latestWeight, productIndex, programSessions, sessionExercises } from "@/lib/selectors";
import { nextSession } from "@/lib/training/schedule";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import { adaptiveTdee, dailyIntake, isLoggedDay, strengthHistory } from "@/lib/analytics/analytics";
import { ACTION_LABELS, GOAL_LABELS } from "@/lib/labels";
import { addDays, formatDateLong, formatDateShort, type ISODate } from "@/lib/utils/dates";
import { avg, fmt, sum } from "@/lib/utils/format";
import { MEAL_TEMPLATES } from "@/lib/nutrition/meals";
import { fitIngredients, macroError, templateAllowed, templateMacros } from "@/lib/nutrition/planner";
import { slotLayout } from "@/lib/nutrition/meals";

export type Intent = "today_training" | "last_weights" | "increase_load" | "protein_left" | "dinner_40p" | "swap_lunch" | "weight_stall";

export const INTENTS: { id: Intent; label: string; keywords: RegExp }[] = [
  { id: "today_training", label: "Co mam dzisiaj trenować?", keywords: /trenowa|trening|dzisiaj.*ćwicz|plan.*dzi/i },
  { id: "last_weights", label: "Jakim ciężarem ćwiczyłem ostatnio?", keywords: /ciężar|ostatnio|ile.*kg|wynik/i },
  { id: "increase_load", label: "Czy powinienem zwiększyć ciężar?", keywords: /zwiększ|progres|podnie/i },
  { id: "protein_left", label: "Ile białka pozostało mi dzisiaj do celu?", keywords: /białk|protein/i },
  { id: "dinner_40p", label: "Zaproponuj kolację z 40 g białka.", keywords: /kolacj|zaproponuj|posiłek z/i },
  { id: "swap_lunch", label: "Zamień dzisiejszy obiad.", keywords: /zamie|obiad/i },
  { id: "weight_stall", label: "Dlaczego moja waga stoi w miejscu?", keywords: /wag|stoi|zastój|nie spada|plateau/i },
];

export interface Answer {
  title: string;
  lines: string[];
  links?: { href: string; label: string }[];
}

export function detectIntent(q: string): Intent | null {
  // kolejność ma znaczenie: bardziej specyficzne wzorce najpierw
  const order: Intent[] = ["dinner_40p", "swap_lunch", "protein_left", "weight_stall", "increase_load", "last_weights", "today_training"];
  for (const id of order) if (INTENTS.find((i) => i.id === id)!.keywords.test(q)) return id;
  return null;
}

export function answer(intent: Intent, data: Snapshot, today: ISODate): Answer {
  const prog = getActiveProgram(data);
  const sessions = programSessions(data, prog?.id);
  switch (intent) {
    case "today_training": {
      const s = sessions.find((x) => x.scheduled_date === today && x.status !== "skipped") ?? nextSession(sessions, today);
      if (!s) return { title: "Brak zaplanowanych treningów", lines: ["W aktywnym cyklu nie ma kolejnych treningów. Wygeneruj kolejny cykl w zakładce Trening."], links: [{ href: "/trening", label: "Trening" }] };
      const ex = sessionExercises(data, s.id);
      return {
        title: s.scheduled_date === today ? `Dziś: ${s.title}` : `Dziś odpoczynek. Następny: ${s.title} (${formatDateLong(s.scheduled_date)})`,
        lines: [
          `Priorytety: ${s.focus}.`,
          ...ex.map((e) => {
            const d = EXERCISE_MAP[e.exercise_id];
            const load = e.suggested_load_kg !== null ? ` · ${fmt(e.suggested_load_kg, 2)} kg` : "";
            return e.block === "conditioning" ? `• ${d?.name}: ${e.load_note}` : `• ${d?.name}: ${e.sets} × ${e.rep_min}–${e.rep_max}, RIR ${e.target_rir}${load}`;
          }),
        ],
        links: [{ href: `/trening/sesja/${s.id}`, label: "Otwórz trening" }],
      };
    }
    case "last_weights": {
      const ids = Array.from(new Set(Object.values(data.exercise_sets).filter((s) => s.completed && s.weight_kg).map((s) => s.exercise_id)));
      if (!ids.length) return { title: "Brak zapisanych ciężarów", lines: ["Nie ma jeszcze ukończonych serii z ciężarem."] };
      const rows = ids
        .map((id) => ({ id, h: strengthHistory(id, Object.values(data.exercise_sets), data.workout_sessions).at(-1) }))
        .filter((r) => r.h)
        .sort((a, b) => b.h!.date.localeCompare(a.h!.date));
      return { title: "Ostatnie ciężary robocze", lines: rows.map((r) => `• ${EXERCISE_MAP[r.id]?.name}: ${fmt(r.h!.top_weight, 2)} kg (${formatDateShort(r.h!.date)}, szac. 1RM ${fmt(r.h!.e1rm, 1)} kg)`) };
    }
    case "increase_load": {
      const recs = Object.values(data.progression_recommendations).filter((r) => r.status === "pending");
      if (!recs.length) return { title: "Brak nowych rekomendacji", lines: ["Rekomendacje powstają po zakończeniu treningu na podstawie zapisanych serii (ciężar, powtórzenia, RIR), oceny techniki, trudności sesji i regeneracji."] };
      return {
        title: "Rekomendacje progresji",
        lines: recs.flatMap((r) => [`• ${EXERCISE_MAP[r.exercise_id]?.name}: ${ACTION_LABELS[r.action]}${r.suggested_load_kg !== null ? ` → ${fmt(r.suggested_load_kg, 2)} kg` : ""} (${r.rep_target})`, `   ${r.explanation.at(-1) ?? ""}`]),
        links: [{ href: "/trening", label: "Plan treningowy" }],
      };
    }
    case "protein_left": {
      const t = getTarget(data, today);
      if (!t) return { title: "Brak celu", lines: ["Ustaw cele żywieniowe."] };
      const dt = t.calorie_mode === "cycling" ? t.day_targets[dayTypeOn(data, today)] : t;
      const eaten = sum(Object.values(data.food_log_entries).filter((e) => e.date === today).map((e) => e.protein_g));
      const left = dt.protein_g - eaten;
      return {
        title: left > 0 ? `Pozostało ${Math.round(left)} g białka` : "Cel białka osiągnięty",
        lines: [`Spożyte: ${Math.round(eaten)} g z ${dt.protein_g} g (${Math.round((eaten / dt.protein_g) * 100)}%).`, left > 25 ? "Rozłóż resztę na 1–2 posiłki (ok. 25–40 g na posiłek), np. skyr, twaróg, chude mięso, ryba, tofu." : ""].filter(Boolean),
        links: [{ href: "/dieta", label: "Dziennik" }],
      };
    }
    case "dinner_40p": {
      const prefs = getPrefs(data);
      if (!prefs) return { title: "Brak preferencji", lines: [] };
      const products = productIndex(data);
      const target = { kcal: 550, protein_g: 40, fat_g: 18, carbs_g: 55, fiber_g: 8 };
      const opts = MEAL_TEMPLATES.filter((m) => m.slots.includes("dinner") && templateAllowed(m, products, { ...prefs, meals_per_day: prefs.meals_per_day } as never).ok)
        .map((m) => {
          const ings = fitIngredients(m.ingredients, target, products);
          const mm = templateMacros(ings, products);
          return { m, ings, mm, err: macroError(mm, target) + Math.abs(mm.protein_g - 40) / 10 };
        })
        .sort((a, b) => a.err - b.err)
        .slice(0, 3);
      if (!opts.length) return { title: "Brak propozycji", lines: ["Twoje ograniczenia wykluczają wszystkie kolacje z bazy. Dodaj własny przepis."] };
      return {
        title: "Kolacje z ok. 40 g białka (zgodne z Twoimi alergiami i wykluczeniami)",
        lines: opts.flatMap((o) => [`• ${o.m.name}: ${Math.round(o.mm.kcal)} kcal, B ${Math.round(o.mm.protein_g)} g, T ${Math.round(o.mm.fat_g)} g, W ${Math.round(o.mm.carbs_g)} g`, `   ${o.ings.map((i) => `${products[i.product_id]?.name.split(" (")[0]} ${i.grams} g`).join(", ")}`]),
      };
    }
    case "swap_lunch": {
      const prefs = getPrefs(data);
      const lunchIdx = prefs ? slotLayout(prefs.meals_per_day).findIndex((s) => s.type === "lunch") : -1;
      const entry = Object.values(data.meal_plan_entries).find((e) => e.date === today && e.slot_index === lunchIdx);
      if (!entry) return { title: "Brak obiadu w jadłospisie", lines: ["Na dziś nie ma wygenerowanego obiadu. Wygeneruj jadłospis — przy każdym posiłku jest przycisk „Zamień”."], links: [{ href: "/dieta/jadlospis", label: "Jadłospis" }] };
      return { title: `Dzisiejszy obiad: ${entry.title}`, lines: [`${entry.kcal} kcal, B ${entry.protein_g} g. Otwórz jadłospis i użyj „Zamień” — propozycje mają przeliczone gramatury do tych samych makro.`], links: [{ href: "/dieta/jadlospis", label: "Zamień w jadłospisie" }] };
    }
    case "weight_stall": {
      const profile = getProfile(data);
      const goals = getGoals(data);
      const w = latestWeight(data) ?? profile?.weight_kg ?? 0;
      const r = adaptiveTdee({ measurements: Object.values(data.body_measurements), log: Object.values(data.food_log_entries), target: getTarget(data, today), goal: goals.primary, weight_kg: w, today });
      const intake = dailyIntake(Object.values(data.food_log_entries), addDays(today, -14), addDays(today, -1));
      const logged = intake.filter(isLoggedDay);
      const lines = [
        `Cel: ${GOAL_LABELS[goals.primary]}. Jakość danych: ${r.quality.label} (${r.quality.score}/100).`,
        r.message,
        ...(r.proposal?.reasons ?? []),
        ...r.quality.notes,
        logged.length ? `Średnia z ${logged.length} pełnych dni: ${Math.round(avg(logged.map((d) => d.kcal))!)} kcal.` : "Brak pełnych dni w dzienniku z ostatnich 2 tygodni.",
        "Możliwe przyczyny zastoju: niedoszacowane porcje (oleje, sosy, przekąski), weekendy poza planem, spadek liczby kroków, zatrzymanie wody (nowy trening, sól, stres, cykl), zbyt krótki okres obserwacji.",
      ];
      return { title: "Analiza trendu masy ciała", lines, links: [{ href: "/dieta/cele", label: "Cele i weryfikacja TDEE" }] };
    }
  }
}

/** Zwięzłe podsumowanie danych dla modułu AI (wysyłane tylko za zgodą). */
export function contextSummary(data: Snapshot, today: ISODate): string {
  const p = getProfile(data);
  const g = getGoals(data);
  const t = getTarget(data, today);
  const prog = getActiveProgram(data);
  const sessions = programSessions(data, prog?.id);
  const intake = dailyIntake(Object.values(data.food_log_entries), addDays(today, -7), today);
  const weights = Object.values(data.body_measurements).filter((m) => m.weight_kg !== null).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const lines = [
    `Data: ${today}`,
    p ? `Profil: wiek ${new Date().getFullYear() - p.birth_year}, wzrost ${p.height_cm} cm, doświadczenie ${p.experience}, kroki ~${p.avg_steps}, urazy: ${p.injuries.map((i) => i.area).join(", ") || "brak"}, przeciwwskazania: ${p.has_contraindications ? "tak" : "nie"}` : "",
    `Cele: ${g.goals.join(", ")} (główny: ${g.primary})`,
    t ? `Cel żywieniowy: ${t.kcal} kcal, B ${t.protein_g} g, T ${t.fat_g} g, W ${t.carbs_g} g (TDEE szac. ${t.tdee})` : "",
    `Masa (ostatnie pomiary): ${weights.map((w) => `${w.date}: ${w.weight_kg}`).join("; ") || "brak"}`,
    `Spożycie 7 dni: ${intake.map((d) => `${d.date}: ${d.kcal} kcal/${d.protein_g} g B`).join("; ")}`,
    `Treningi: ${sessions.map((s) => `${s.scheduled_date} ${s.template} ${s.status}${s.session_rpe ? ` sRPE ${s.session_rpe}` : ""}`).join("; ")}`,
    `Ostatnie serie: ${Object.values(data.exercise_sets)
      .filter((s) => s.completed)
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
      .slice(0, 30)
      .map((s) => `${s.exercise_id} ${s.weight_kg ?? 0}x${s.reps}@${s.rir ?? "?"}`)
      .join(", ")}`,
  ];
  return lines.filter(Boolean).join("\n").slice(0, 18_000);
}
