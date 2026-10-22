/**
 * Generator 4-tygodniowego programu Full Body (3 sesje / tydzień = 12 treningów).
 *
 * A — STRENGTH: siła nóg, klatka, grzbiet, stabilizacja tułowia
 * B — TACTICAL FUNCTIONAL: tylna taśma, praca jednostronna, chwyt, noszenie
 * C — HYPERTROPHY: wyższa objętość całego ciała, barki i ramiona
 *
 * Personalizacja: doświadczenie, cele, sprzęt, urazy, przeciwwskazania,
 * dostępny czas, preferowane dni. Objętość liczona per grupa mięśniowa.
 */
import type {
  Block,
  Equipment,
  Experience,
  GoalType,
  InjuryArea,
  NewRecord,
  ProgramConfig,
  TimedItem,
  TrainingProgram,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
} from "@/lib/domain/types";
import { addDays, weekdayIndex, type ISODate } from "@/lib/utils/dates";
import { uid } from "@/lib/utils/format";
import { EXERCISE_MAP, isAvailable, type ExerciseDef, type MuscleGroup } from "./exercises";

type Role = "main" | "secondary" | "accessory" | "small" | "core" | "carry" | "power" | "conditioning";

interface SlotDef {
  block: Block;
  role: Role;
  candidates: string[];
  /** Im wyższy, tym wcześniej usuwany przy braku czasu (0 = nigdy) */
  cut: number;
}

export const TEMPLATE_INFO: Record<WorkoutTemplate, { title: string; focus: string }> = {
  A: { title: "Trening A — STRENGTH", focus: "Siła nóg, klatka piersiowa, grzbiet, stabilizacja tułowia" },
  B: { title: "Trening B — TACTICAL FUNCTIONAL", focus: "Siła funkcjonalna, tylna taśma, praca jednostronna, chwyt, noszenie" },
  C: { title: "Trening C — HYPERTROPHY", focus: "Rozwój mięśni całego ciała, barki i ramiona, stabilizacja, kondycja" },
};

const TEMPLATES: Record<WorkoutTemplate, SlotDef[]> = {
  A: [
    { block: "strength", role: "main", candidates: ["back_squat", "front_squat", "goblet_squat", "bulgarian_split_squat", "step_up", "glute_bridge"], cut: 0 },
    { block: "strength", role: "main", candidates: ["bench_press", "db_bench_press", "push_up"], cut: 0 },
    { block: "strength", role: "secondary", candidates: ["barbell_row", "one_arm_db_row", "seated_cable_row", "inverted_row", "band_row"], cut: 0 },
    { block: "hypertrophy", role: "accessory", candidates: ["db_rdl", "romanian_deadlift", "hip_thrust", "glute_bridge"], cut: 3 },
    { block: "hypertrophy", role: "accessory", candidates: ["incline_db_press", "push_up", "db_bench_press"], cut: 5 },
    { block: "core", role: "core", candidates: ["plank", "ab_wheel_rollout", "dead_bug"], cut: 1 },
    { block: "functional", role: "carry", candidates: ["farmers_walk", "suitcase_carry", "dead_hang"], cut: 1 },
    { block: "conditioning", role: "conditioning", candidates: ["air_bike", "rower", "stationary_bike", "mountain_climber"], cut: 4 },
  ],
  B: [
    { block: "strength", role: "main", candidates: ["trap_bar_deadlift", "romanian_deadlift", "db_rdl", "hip_thrust", "glute_bridge"], cut: 0 },
    { block: "strength", role: "main", candidates: ["pull_up", "chin_up", "lat_pulldown", "inverted_row", "band_row", "one_arm_db_row"], cut: 0 },
    { block: "strength", role: "secondary", candidates: ["bulgarian_split_squat", "reverse_lunge", "step_up", "goblet_squat"], cut: 0 },
    { block: "hypertrophy", role: "accessory", candidates: ["overhead_press", "db_shoulder_press", "push_up"], cut: 3 },
    { block: "functional", role: "power", candidates: ["kettlebell_swing", "med_ball_slam", "sled_push"], cut: 4 },
    { block: "functional", role: "carry", candidates: ["farmers_walk", "suitcase_carry", "dead_hang"], cut: 1 },
    { block: "core", role: "core", candidates: ["side_plank", "bird_dog", "hanging_knee_raise", "dead_bug"], cut: 1 },
    { block: "conditioning", role: "conditioning", candidates: ["rower", "air_bike", "stationary_bike", "sled_push", "mountain_climber"], cut: 5 },
  ],
  C: [
    { block: "hypertrophy", role: "main", candidates: ["goblet_squat", "front_squat", "back_squat", "reverse_lunge", "step_up"], cut: 0 },
    { block: "hypertrophy", role: "main", candidates: ["hip_thrust", "db_rdl", "glute_bridge", "romanian_deadlift"], cut: 0 },
    { block: "hypertrophy", role: "accessory", candidates: ["incline_db_press", "db_bench_press", "push_up", "bench_press"], cut: 0 },
    { block: "hypertrophy", role: "accessory", candidates: ["lat_pulldown", "chin_up", "pull_up", "one_arm_db_row", "band_row", "inverted_row"], cut: 0 },
    { block: "hypertrophy", role: "accessory", candidates: ["seated_cable_row", "one_arm_db_row", "band_row", "inverted_row"], cut: 6 },
    { block: "hypertrophy", role: "small", candidates: ["lateral_raise"], cut: 3 },
    { block: "hypertrophy", role: "small", candidates: ["face_pull", "band_pull_apart"], cut: 5 },
    { block: "hypertrophy", role: "small", candidates: ["db_curl", "chin_up"], cut: 4 },
    { block: "hypertrophy", role: "small", candidates: ["triceps_pushdown", "overhead_triceps_extension", "dips", "push_up"], cut: 4 },
    { block: "core", role: "core", candidates: ["dead_bug", "hanging_knee_raise", "ab_wheel_rollout", "plank"], cut: 1 },
    { block: "conditioning", role: "conditioning", candidates: ["stationary_bike", "rower", "air_bike", "mountain_climber"], cut: 5 },
  ],
};

const WARMUP: Record<WorkoutTemplate, TimedItem[]> = {
  A: [
    { exercise_id: "jumping_jack", prescription: "2 × 30 s" },
    { exercise_id: "cat_cow", prescription: "8 powtórzeń" },
    { exercise_id: "leg_swings", prescription: "10 / nogę" },
    { exercise_id: "bodyweight_squat", prescription: "10 powtórzeń" },
    { exercise_id: "band_pull_apart", prescription: "15 powtórzeń" },
  ],
  B: [
    { exercise_id: "jumping_jack", prescription: "2 × 30 s" },
    { exercise_id: "cat_cow", prescription: "8 powtórzeń" },
    { exercise_id: "glute_bridge", prescription: "10 powtórzeń" },
    { exercise_id: "lunge_reach", prescription: "5 / stronę" },
    { exercise_id: "bird_dog", prescription: "5 / stronę" },
  ],
  C: [
    { exercise_id: "jumping_jack", prescription: "2 × 30 s" },
    { exercise_id: "leg_swings", prescription: "10 / nogę" },
    { exercise_id: "bodyweight_squat", prescription: "10 powtórzeń" },
    { exercise_id: "band_pull_apart", prescription: "15 powtórzeń" },
    { exercise_id: "lunge_reach", prescription: "5 / stronę" },
  ],
};

const WARMUP_FALLBACK: TimedItem = { exercise_id: "bird_dog", prescription: "5 / stronę" };

const COOLDOWN: TimedItem[] = [
  { exercise_id: "hip_flexor_stretch", prescription: "40 s / stronę" },
  { exercise_id: "hamstring_stretch", prescription: "45 s" },
  { exercise_id: "childs_pose", prescription: "45 s" },
  { exercise_id: "diaphragmatic_breathing", prescription: "2 min" },
];

export const WEEK_PHASES: Record<number, { name: string; note: string }> = {
  1: {
    name: "Tydzień 1 — Poziom wyjściowy",
    note: "Ustal ciężary robocze z zapasem 2–3 powtórzeń (RIR). Skup się na technice. Zapisuj każdą serię — na tej podstawie aplikacja dobierze obciążenia.",
  },
  2: {
    name: "Tydzień 2 — Progresja powtórzeń",
    note: "Ciężary skorygowane po tygodniu 1. Celem jest dołożenie powtórzeń w zakresie przy tym samym ciężarze.",
  },
  3: {
    name: "Tydzień 3 — Progresja obciążenia",
    note: "Podnoś ciężar tam, gdzie osiągnięto górną granicę powtórzeń z zapasem RIR. Akcesoria: +1 seria. Intensywność nieco wyższa (RIR 1–2).",
  },
  4: {
    name: "Tydzień 4 — Ocena i konsolidacja",
    note: "Utrwal wyniki. Jeżeli zmęczenie jest wysokie, aplikacja zaproponuje odciążenie (mniej serii, lżej). Po tym tygodniu przygotujesz kolejny cykl.",
  },
};

interface Scheme {
  sets: number;
  rep_min: number;
  rep_max: number;
  duration_sec: number;
  distance_m: number;
  target_rir: number;
  rest_sec: number;
  load_note: string;
}

const conditioningScheme = (template: WorkoutTemplate, week: number, cfg: ProgramConfig, exId: string, compact = false): Scheme => {
  const easyOnly = !cfg.conditioning_allowed;
  const condGoal = cfg.goals.includes("conditioning") || cfg.goals.includes("fat_loss");
  const base: Scheme = { sets: 1, rep_min: 0, rep_max: 0, duration_sec: 0, distance_m: 0, target_rir: 0, rest_sec: 0, load_note: "" };
  const weekAdd = ([0, 0, 1, 2, 0][week] ?? 0) - (compact ? 1 : 0);
  if (exId === "sled_push") {
    const sets = 4 + weekAdd;
    return { ...base, sets, distance_m: 15, rep_min: 15, rep_max: 20, target_rir: 3, rest_sec: 90, load_note: `${sets} × 15–20 m, umiarkowane obciążenie, przerwa 90 s` };
  }
  if (easyOnly || template === "C") {
    const minutes = (condGoal ? 12 : 10) + weekAdd * 2;
    return {
      ...base,
      sets: 1,
      duration_sec: minutes * 60,
      load_note: `${minutes} min stałym tempem, RPE 5–6 (swobodna rozmowa możliwa)${easyOnly ? " — tylko niska intensywność ze względu na zgłoszone przeciwwskazania" : ""}`,
    };
  }
  if (template === "A") {
    const rounds = (condGoal ? 6 : 5) + weekAdd;
    return { ...base, sets: rounds, duration_sec: 20, rest_sec: 40, load_note: `${rounds} × 20 s mocno (RPE 8) / 40 s spokojnie` };
  }
  const rounds = (condGoal ? 5 : 4) + weekAdd;
  return { ...base, sets: rounds, duration_sec: 60, rest_sec: 60, load_note: `${rounds} × (1 min umiarkowanie RPE 6–7 / 1 min spokojnie)` };
};

function schemeFor(role: Role, template: WorkoutTemplate, ex: ExerciseDef, week: number, cfg: ProgramConfig, compact = false): Scheme {
  const exp = cfg.experience;
  const strengthGoal = cfg.primary_goal === "strength";
  const muscleGoal = cfg.primary_goal === "muscle_gain" || cfg.goals.includes("muscle_gain");
  const base: Scheme = { sets: 3, rep_min: 8, rep_max: 12, duration_sec: 0, distance_m: 0, target_rir: 2, rest_sec: 90, load_note: "" };

  if (role === "conditioning") return conditioningScheme(template, week, cfg, ex.id, compact);

  // RIR: tydzień 1 z większym zapasem, tydzień 3 najbliżej upadku.
  const rirAdj = week === 1 ? 1 : week === 3 ? -1 : 0;
  const rir = (r: number) => Math.max(1, r + rirAdj + (cfg.conditioning_allowed ? 0 : 1));

  if (ex.load_type === "time") {
    const s = ex.id === "dead_hang" ? { min: 20, max: 40 } : ex.id === "side_plank" ? { min: 25, max: 40 } : { min: 30, max: 45 };
    return { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: s.min, rep_max: s.max, duration_sec: s.max, target_rir: 2, rest_sec: 60, load_note: ex.unilateral ? "czas na każdą stronę" : "" };
  }
  if (ex.load_type === "distance") {
    const d = ex.unilateral ? { min: 20, max: 30 } : { min: 30, max: 40 };
    return { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: d.min, rep_max: d.max, distance_m: d.max, target_rir: 2, rest_sec: 75, load_note: ex.unilateral ? "dystans na każdą rękę" : "ciężki chwyt, postawa wysoka" };
  }

  let s: Scheme;
  switch (role) {
    case "main": {
      if (template === "C") s = { ...base, sets: exp === "beginner" ? 3 : 4, rep_min: 8, rep_max: 12, target_rir: rir(2), rest_sec: 120 };
      else if (ex.load_type === "bodyweight" && ex.id !== "glute_bridge")
        s = { ...base, sets: exp === "beginner" ? 3 : 4, rep_min: exp === "beginner" ? 3 : 5, rep_max: exp === "beginner" ? 6 : 8, target_rir: rir(2), rest_sec: 150 };
      else if (strengthGoal) s = { ...base, sets: exp === "beginner" ? 3 : 4, rep_min: 4, rep_max: 6, target_rir: rir(2), rest_sec: 180 };
      else s = { ...base, sets: exp === "beginner" ? 3 : 4, rep_min: exp === "beginner" ? 6 : 5, rep_max: exp === "beginner" ? 8 : 7, target_rir: rir(2), rest_sec: 150 };
      s.load_note = "Przed seriami roboczymi wykonaj 2–3 serie rozgrzewkowe z rosnącym ciężarem.";
      break;
    }
    case "secondary":
      s = ex.unilateral
        ? { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: 8, rep_max: 10, target_rir: rir(2), rest_sec: 90, load_note: "powtórzenia na każdą stronę" }
        : { ...base, sets: exp === "beginner" ? 3 : 4, rep_min: 6, rep_max: 10, target_rir: rir(2), rest_sec: 120 };
      break;
    case "accessory":
      s = { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: 8, rep_max: 12, target_rir: rir(2), rest_sec: 90, load_note: ex.unilateral ? "powtórzenia na każdą stronę" : "" };
      if (template === "B" && ex.id !== "push_up") s = { ...s, rep_min: 6, rep_max: 10 };
      break;
    case "small":
      s = { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: 10, rep_max: 15, target_rir: rir(2), rest_sec: 60 };
      break;
    case "power":
      s =
        ex.id === "sled_push"
          ? { ...base, sets: 4, rep_min: 15, rep_max: 20, distance_m: 20, target_rir: 3, rest_sec: 90, load_note: "dystans w metrach" }
          : ex.id === "med_ball_slam"
            ? { ...base, sets: 3, rep_min: 6, rep_max: 8, target_rir: 3, rest_sec: 75, load_note: "każde powtórzenie maksymalnie dynamicznie" }
            : { ...base, sets: 3, rep_min: 10, rep_max: 15, target_rir: 3, rest_sec: 75, load_note: "dynamiczny wyprost bioder, technika ponad liczbę" };
      break;
    case "core":
      s = { ...base, sets: exp === "beginner" ? 2 : 3, rep_min: ex.unilateral || ex.id === "dead_bug" || ex.id === "bird_dog" ? 6 : 8, rep_max: ex.id === "dead_bug" || ex.id === "bird_dog" ? 8 : 12, target_rir: 2, rest_sec: 60, load_note: ex.id === "dead_bug" || ex.id === "bird_dog" ? "powtórzenia na stronę" : "" };
      break;
    default:
      s = { ...base };
  }

  // Tydzień 3: +1 seria akcesoriów (progresja objętości). Hipertrofia jako cel: +1 seria w C.
  if (week === 3 && (role === "accessory" || role === "small")) s.sets = Math.min(4, s.sets + 1);
  if (muscleGoal && template === "C" && (role === "accessory" || role === "small") && week !== 1) s.sets = Math.min(4, s.sets + (week === 3 ? 0 : 1));
  // Wersja skrócona przy ograniczonym czasie: mniej serii i krótsze przerwy w ćwiczeniach głównych.
  if (compact) {
    if (role === "main" || role === "secondary") {
      s.sets = Math.min(s.sets, 3);
      s.rest_sec = Math.min(s.rest_sec, 120);
    } else if (role === "accessory" || role === "small") s.sets = Math.min(s.sets, week === 3 ? 3 : 2);
  }
  return s;
}

/* -------------------------- szacowanie czasu -------------------------- */

export function estimateMinutes(items: { sets: number; rest_sec: number; duration_sec: number; block: Block }[]): number {
  let sec = 8 * 60 + 5 * 60; // rozgrzewka + schłodzenie
  for (const it of items) {
    if (it.block === "conditioning") sec += it.sets * (it.duration_sec + it.rest_sec) + 60;
    else if (it.block === "strength") sec += it.sets * (Math.max(40, it.duration_sec) + it.rest_sec) + 90;
    // Akcesoria, core i noszenie zwykle w superseriach/obwodzie — część przerwy wypełnia inne ćwiczenie.
    else sec += it.sets * (Math.max(40, it.duration_sec) + it.rest_sec * 0.7) + 60;
  }
  return Math.round(sec / 60);
}

/* ------------------------------ wybór dni ----------------------------- */

/** Wybiera 3 dni tygodnia (0 = pon) maksymalizując przerwy regeneracyjne. */
export function pickTrainingDays(preferred: number[], count = 3): number[] {
  const pref = Array.from(new Set(preferred.filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  const score = (days: number[]) => {
    const s = [...days].sort((a, b) => a - b);
    let minGap = 7;
    for (let i = 0; i < s.length; i++) {
      const gap = i === s.length - 1 ? s[0] + 7 - s[i] : s[i + 1] - s[i];
      minGap = Math.min(minGap, gap);
    }
    const prefCount = s.filter((d) => pref.includes(d)).length;
    return prefCount * 10 + minGap;
  };
  let best: number[] = [0, 2, 4];
  let bestScore = -1;
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++) {
        const combo = [a, b, c];
        const sc = score(combo);
        if (sc > bestScore) {
          bestScore = sc;
          best = combo;
        }
      }
  return best.slice(0, count);
}

/* -------------------------------- generator --------------------------- */

export interface GeneratorInput {
  experience: Experience;
  equipment: Equipment[];
  injuries: InjuryArea[];
  session_minutes: number;
  goals: GoalType[];
  primary_goal: GoalType;
  has_contraindications: boolean;
  training_days: number[];
  start_date: ISODate;
  cycle_number?: number;
  /** Ostatnie ciężary robocze (np. z poprzedniego cyklu) */
  last_loads?: Record<string, number>;
}

export interface GeneratedProgram {
  program: NewRecord<TrainingProgram> & { id: string };
  sessions: (NewRecord<WorkoutSession> & { id: string })[];
  exercises: (NewRecord<WorkoutExercise> & { id: string })[];
  warnings: string[];
}

interface ChosenSlot {
  slot: SlotDef;
  ex: ExerciseDef;
}

function chooseExercises(template: WorkoutTemplate, cfg: ProgramConfig): { chosen: ChosenSlot[]; warnings: string[] } {
  const used = new Set<string>();
  const chosen: ChosenSlot[] = [];
  const warnings: string[] = [];
  for (const slot of TEMPLATES[template]) {
    const pick = slot.candidates
      .map((id) => EXERCISE_MAP[id])
      .find((ex) => ex && !used.has(ex.id) && isAvailable(ex, cfg.equipment, cfg.injuries) && !(slot.role === "conditioning" && !cfg.conditioning_allowed && ex.id === "mountain_climber"));
    if (!pick) {
      if (slot.cut === 0) warnings.push(`${TEMPLATE_INFO[template].title}: brak dostępnego ćwiczenia dla pozycji „${slot.candidates.map((c) => EXERCISE_MAP[c]?.name).join(" / ")}” przy wybranym sprzęcie i ograniczeniach.`);
      continue;
    }
    used.add(pick.id);
    chosen.push({ slot, ex: pick });
  }
  return { chosen, warnings };
}

export function generateProgram(input: GeneratorInput): GeneratedProgram {
  const cfg: ProgramConfig = {
    experience: input.experience,
    equipment: input.equipment,
    injuries: input.injuries,
    session_minutes: input.session_minutes,
    primary_goal: input.primary_goal,
    goals: input.goals,
    conditioning_allowed: !input.has_contraindications,
  };
  const days = pickTrainingDays(input.training_days);
  const programId = uid();
  const warnings: string[] = [];
  if (input.has_contraindications)
    warnings.push("Zgłoszono przeciwwskazania do intensywnego wysiłku: program ma obniżoną intensywność (wyższy RIR, kondycja wyłącznie o niskiej intensywności). Skonsultuj plan z lekarzem przed rozpoczęciem.");

  const sessions: GeneratedProgram["sessions"] = [];
  const exercises: GeneratedProgram["exercises"] = [];
  const templates: WorkoutTemplate[] = ["A", "B", "C"];
  const selection = Object.fromEntries(
    templates.map((t) => {
      const r = chooseExercises(t, cfg);
      warnings.push(...r.warnings);
      return [t, r.chosen];
    }),
  ) as Record<WorkoutTemplate, ChosenSlot[]>;

  // Dopasowanie do dostępnego czasu: usuwamy pozycje o najwyższym priorytecie cięcia.
  const keepConditioning = cfg.goals.includes("conditioning");
  const compact: Record<WorkoutTemplate, boolean> = { A: false, B: false, C: false };
  for (const t of templates) {
    const list = selection[t];
    const timeOf = (l: ChosenSlot[]) =>
      estimateMinutes(l.map(({ slot, ex }) => ({ ...schemeFor(slot.role, t, ex, 3, cfg, compact[t]), block: slot.block })));
    if (timeOf(list) > input.session_minutes) compact[t] = true;
    const removed: string[] = [];
    let guard = 0;
    while (timeOf(list) > input.session_minutes + 2 && guard++ < 20) {
      const removable = list
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.slot.cut > 0 && !(keepConditioning && c.slot.role === "conditioning"))
        .sort((a, b) => b.c.slot.cut - a.c.slot.cut);
      if (!removable.length) break;
      removed.push(removable[0].c.ex.name);
      list.splice(removable[0].i, 1);
    }
    if (removed.length)
      warnings.push(`${TEMPLATE_INFO[t].title}: przy ${input.session_minutes} min na trening pominięto: ${removed.join(", ")}. Przy dłuższym czasie program obejmie również te elementy.`);
    else if (compact[t]) warnings.push(`${TEMPLATE_INFO[t].title}: wersja skrócona (mniej serii, krótsze przerwy) dopasowana do ${input.session_minutes} min.`);
    if (timeOf(list) > input.session_minutes + 5) warnings.push(`${TEMPLATE_INFO[t].title}: szacowany czas (${timeOf(list)} min) przekracza dostępny czas. Rozważ skrócenie przerw.`);
  }

  // Kolejne terminy treningów od daty startu (dowolny dzień tygodnia) w wybrane dni.
  const dates: ISODate[] = [];
  for (let d = input.start_date; dates.length < 12; d = addDays(d, 1)) if (days.includes(weekdayIndex(d))) dates.push(d);

  for (let week = 1; week <= 4; week++) {
    templates.forEach((t, idx) => {
      const sessionId = uid();
      const date = dates[(week - 1) * 3 + idx];
      const warm = WARMUP[t].map((w) => {
        const ex = EXERCISE_MAP[w.exercise_id];
        return ex && isAvailable(ex, cfg.equipment, cfg.injuries) ? w : WARMUP_FALLBACK;
      });
      const warmup = warm.filter((w, i) => warm.findIndex((x) => x.exercise_id === w.exercise_id) === i);
      const cooldown = COOLDOWN.filter((c) => isAvailable(EXERCISE_MAP[c.exercise_id], cfg.equipment, cfg.injuries));
      sessions.push({
        id: sessionId,
        program_id: programId,
        week,
        day_index: idx + 1,
        template: t,
        title: TEMPLATE_INFO[t].title,
        focus: TEMPLATE_INFO[t].focus,
        scheduled_date: date,
        status: "planned",
        started_at: null,
        completed_at: null,
        duration_sec: null,
        paused_ms: 0,
        paused_at: null,
        notes: "",
        session_rpe: null,
        recovery_rating: null,
        warmup,
        cooldown,
        phase_note: WEEK_PHASES[week].note,
        rest_ends_at: null,
      });
      selection[t].forEach(({ slot, ex }, order) => {
        const s = schemeFor(slot.role, t, ex, week, cfg, compact[t]);
        const last = input.last_loads?.[ex.id];
        exercises.push({
          id: uid(),
          session_id: sessionId,
          exercise_id: ex.id,
          order_index: order,
          block: slot.block,
          sets: s.sets,
          rep_min: s.rep_min,
          rep_max: s.rep_max,
          duration_sec: s.duration_sec,
          distance_m: s.distance_m,
          target_rir: s.target_rir,
          tempo: ex.tempo,
          rest_sec: s.rest_sec,
          suggested_load_kg: week === 1 && last ? last : null,
          load_note: s.load_note,
          substituted_from: null,
          technique_ok: null,
        });
      });
    });
  }

  const program: GeneratedProgram["program"] = {
    id: programId,
    name: `Cykl ${input.cycle_number ?? 1} — SEAL Full Body`,
    cycle_number: input.cycle_number ?? 1,
    start_date: input.start_date,
    status: "active",
    config: cfg,
    weekly_volume: weeklyVolume(exercises.filter((e) => sessions.find((s) => s.id === e.session_id)?.week === 1)),
    notes: warnings.join("\n"),
  };

  return { program, sessions, exercises, warnings };
}

/** Serie tygodniowo na grupę mięśniową (seria główna = 1, pomocnicza = 0,5). */
export function weeklyVolume(items: { exercise_id: string; sets: number; block: Block }[]): Record<MuscleGroup, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    if (it.block === "conditioning" || it.block === "warmup" || it.block === "cooldown") continue;
    const ex = EXERCISE_MAP[it.exercise_id];
    if (!ex) continue;
    for (const [g, w] of Object.entries(ex.volume)) out[g] = (out[g] ?? 0) + it.sets * (w ?? 0);
  }
  return out as Record<MuscleGroup, number>;
}

/** Orientacyjny zakres serii / tydzień dla hipertrofii (dorośli trenujący). */
export const VOLUME_GUIDE: Record<Experience, [number, number]> = {
  beginner: [6, 12],
  intermediate: [10, 18],
  advanced: [12, 22],
};

export function substituteCandidates(exerciseId: string, equipment: Equipment[], injuries: InjuryArea[]): ExerciseDef[] {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return [];
  return ex.alternatives.map((id) => EXERCISE_MAP[id]).filter((e): e is ExerciseDef => !!e && isAvailable(e, equipment, injuries));
}
