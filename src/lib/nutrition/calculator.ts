/**
 * Kalkulator zapotrzebowania energetycznego i makroskładników.
 *
 * BMR: Mifflin-St Jeor (punkt wyjścia dla dorosłych).
 * TDEE: BMR × współczynnik aktywności pozatreningowej (kroki + praca)
 *       + średni dzienny wydatek na treningi siłowe i sporty (MET netto).
 * Aktywność jest liczona RAZ — dziennik żywienia nie „dodaje” kalorii
 * spalonych na treningu, bo są już w TDEE.
 *
 * Wynik jest SZACUNKIEM. Aplikacja weryfikuje go później na podstawie
 * trendu masy ciała i faktycznego spożycia (patrz analytics/adaptive.ts).
 */
import type {
  CalorieMode,
  DayType,
  DeficitRate,
  Experience,
  GoalType,
  JobActivity,
  MacroMode,
  MacroTargets,
  Sex,
  Sport,
} from "@/lib/domain/types";
import { clamp, round } from "@/lib/utils/format";

export interface EnergyInput {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  avg_steps: number;
  job_activity: JobActivity;
  strength_sessions_per_week: number;
  session_minutes: number;
  sports: Sport[];
}

export interface EnergyResult {
  bmr: number;
  neat_factor: number;
  exercise_kcal_per_day: number;
  tdee: number;
  breakdown: string[];
}

export function mifflinStJeor(sex: Sex, weight: number, height: number, age: number): number {
  return 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
}

/** Współczynnik aktywności pozatreningowej na podstawie kroków i charakteru pracy. */
export function neatFactor(steps: number, job: JobActivity): number {
  let f = steps < 5000 ? 1.2 : steps < 7500 ? 1.3 : steps < 10000 ? 1.375 : steps < 12500 ? 1.45 : 1.525;
  if (job === "standing") f += 0.05;
  if (job === "physical") f += 0.12;
  return clamp(f, 1.2, 1.7);
}

const SPORT_NET_MET: Record<Sport["intensity"], number> = { low: 2.5, moderate: 4.5, high: 7 };
/** Trening siłowy: ok. 4,5 MET → 3,5 MET netto (bez spoczynkowego, który jest w BMR). */
const STRENGTH_NET_MET = 3.5;

export function energy(input: EnergyInput): EnergyResult {
  const bmr = mifflinStJeor(input.sex, input.weight_kg, input.height_cm, input.age);
  const neat = neatFactor(input.avg_steps, input.job_activity);
  const strengthWeekly = input.strength_sessions_per_week * (input.session_minutes / 60) * STRENGTH_NET_MET * input.weight_kg;
  const sportWeekly = input.sports.reduce((s, sp) => s + sp.hours_per_week * SPORT_NET_MET[sp.intensity] * input.weight_kg, 0);
  const exercisePerDay = (strengthWeekly + sportWeekly) / 7;
  const tdee = bmr * neat + exercisePerDay;
  const breakdown = [
    `BMR (Mifflin-St Jeor): ${Math.round(bmr)} kcal`,
    `Aktywność pozatreningowa (ok. ${input.avg_steps.toLocaleString("pl-PL")} kroków, praca: ${JOB_LABEL[input.job_activity]}): × ${neat.toFixed(3).replace(".", ",")} → ${Math.round(bmr * neat)} kcal`,
    `Treningi siłowe (${input.strength_sessions_per_week} × ${input.session_minutes} min/tydz.): +${Math.round(strengthWeekly / 7)} kcal/dzień`,
  ];
  if (input.sports.length) breakdown.push(`Inne sporty (${input.sports.map((s) => s.name).join(", ")}): +${Math.round(sportWeekly / 7)} kcal/dzień`);
  breakdown.push(`Szacowane TDEE: ${Math.round(tdee)} kcal (to oszacowanie — weryfikowane później trendem masy ciała)`);
  return { bmr: Math.round(bmr), neat_factor: neat, exercise_kcal_per_day: Math.round(exercisePerDay), tdee: Math.round(tdee), breakdown };
}

const JOB_LABEL: Record<JobActivity, string> = { sedentary: "siedząca", standing: "stojąca", physical: "fizyczna" };

/* ------------------------------------------------------------------ */
/* Cel kaloryczny                                                     */
/* ------------------------------------------------------------------ */

export interface GoalInput {
  primary_goal: GoalType;
  goals: GoalType[];
  sex: Sex;
  weight_kg: number;
  height_cm: number;
  experience: Experience;
  deficit_rate: DeficitRate;
  has_contraindications: boolean;
}

export interface GoalResult {
  kcal: number;
  adjustment_kcal: number;
  description: string;
  warnings: string[];
}

export const DEFICIT_RATE_PCT: Record<DeficitRate, number> = { gentle: 0.25, moderate: 0.5, faster: 0.75 };
const KCAL_PER_KG = 7700;

export function bmi(weight: number, heightCm: number): number {
  const h = heightCm / 100;
  return weight / (h * h);
}

export function goalCalories(tdee: number, bmr: number, g: GoalInput): GoalResult {
  const warnings: string[] = [];
  const b = bmi(g.weight_kg, g.height_cm);
  const floor = g.sex === "male" ? 1500 : 1200;
  let adjustment = 0;
  let description = "";

  switch (g.primary_goal) {
    case "fat_loss": {
      let rate = DEFICIT_RATE_PCT[g.deficit_rate];
      if (b < 20 && rate > 0.25) {
        rate = 0.25;
        warnings.push("BMI poniżej 20 — zastosowano łagodny deficyt. Rozważ rekompozycję zamiast redukcji.");
      }
      if (g.has_contraindications && rate > 0.5) {
        rate = 0.5;
        warnings.push("Ze względu na zgłoszone przeciwwskazania ograniczono tempo redukcji. Skonsultuj plan z lekarzem.");
      }
      let deficit = (rate / 100) * g.weight_kg * KCAL_PER_KG / 7;
      const cap = tdee * 0.25;
      if (deficit > cap) {
        deficit = cap;
        warnings.push("Deficyt ograniczono do 25% TDEE, aby nie był zbyt agresywny.");
      }
      adjustment = -deficit;
      description = `Redukcja: ok. ${String(rate).replace(".", ",")}% masy ciała tygodniowo (≈ ${round((rate / 100) * g.weight_kg, 2).toLocaleString("pl-PL")} kg/tydz.)`;
      break;
    }
    case "muscle_gain": {
      const pct = g.experience === "beginner" ? 0.1 : g.experience === "intermediate" ? 0.07 : 0.05;
      adjustment = tdee * pct;
      description = `Budowa masy: umiarkowana nadwyżka ok. ${Math.round(pct * 100)}% (≈ +${Math.round(tdee * pct)} kcal)`;
      break;
    }
    case "recomposition":
      adjustment = b >= 25 ? -tdee * 0.1 : 0;
      description = b >= 25 ? "Rekompozycja: niewielki deficyt (ok. 10%) przy wysokim spożyciu białka" : "Rekompozycja: kalorie zbliżone do utrzymania przy wysokim spożyciu białka";
      break;
    case "strength":
      adjustment = b >= 27 ? 0 : tdee * 0.05;
      description = adjustment > 0 ? "Siła: niewielka nadwyżka (ok. 5%)" : "Siła: kalorie na poziomie utrzymania";
      break;
    default:
      adjustment = 0;
      description = "Utrzymanie masy ciała";
  }

  let kcal = tdee + adjustment;
  const minKcal = Math.max(floor, bmr * 0.95);
  if (kcal < minKcal) {
    kcal = minKcal;
    warnings.push(`Cel podniesiono do ${Math.round(minKcal)} kcal — niższe spożycie nie jest zalecane bez opieki specjalisty.`);
  }
  return { kcal: Math.round(kcal / 10) * 10, adjustment_kcal: Math.round(kcal - tdee), description, warnings };
}

/* ------------------------------------------------------------------ */
/* Makroskładniki                                                     */
/* ------------------------------------------------------------------ */

export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  fat_loss: 2.0,
  recomposition: 2.0,
  muscle_gain: 1.8,
  strength: 1.8,
  conditioning: 1.6,
  maintenance: 1.6,
};

export interface MacroInput {
  kcal: number;
  weight_kg: number;
  height_cm: number;
  primary_goal: GoalType;
  mode: MacroMode;
  custom_protein_g_per_kg?: number;
  custom_fat_pct?: number;
}

export interface MacroResult extends MacroTargets {
  protein_g_per_kg: number;
  reference_weight_kg: number;
  fat_pct: number;
  notes: string[];
}

/** Masa referencyjna przy otyłości (BMI ≥ 30): masa odpowiadająca BMI 27. */
export function referenceWeight(weight: number, heightCm: number): { weight: number; adjusted: boolean } {
  if (bmi(weight, heightCm) < 30) return { weight, adjusted: false };
  const h = heightCm / 100;
  return { weight: round(27 * h * h, 1), adjusted: true };
}

export function macros(input: MacroInput): MacroResult {
  const notes: string[] = [];
  const ref = referenceWeight(input.weight_kg, input.height_cm);
  if (ref.adjusted) notes.push(`BMI ≥ 30: białko liczone od masy referencyjnej ${ref.weight.toLocaleString("pl-PL")} kg (odpowiada BMI 27), nie od całkowitej masy ciała.`);

  let pPerKg = PROTEIN_G_PER_KG[input.primary_goal];
  let fatPct = 0.27;
  if (input.mode === "high_protein") pPerKg = 2.2;
  if (input.mode === "custom") {
    pPerKg = clamp(input.custom_protein_g_per_kg ?? pPerKg, 1.2, 2.6);
    fatPct = clamp((input.custom_fat_pct ?? 27) / 100, 0.2, 0.5);
  }

  const protein = pPerKg * ref.weight;
  const minFat = 0.6 * ref.weight;
  let fat: number;
  let carbs: number;

  if (input.mode === "low_carb") {
    carbs = Math.max(80, (input.kcal * 0.2) / 4);
    fat = (input.kcal - protein * 4 - carbs * 4) / 9;
    notes.push("Low carb: ok. 20% energii z węglowodanów. Przy tej samej podaży energii i białka nie jest on z założenia skuteczniejszy w redukcji niż inne modele — wybierz go, jeśli lepiej Ci służy.");
  } else {
    fat = Math.max(minFat, (input.kcal * fatPct) / 9);
    carbs = (input.kcal - protein * 4 - fat * 9) / 4;
  }

  if (carbs < 50 && input.mode !== "low_carb") {
    fat = Math.max(minFat, fat - (50 - carbs) * 4 / 9);
    carbs = (input.kcal - protein * 4 - fat * 9) / 4;
    notes.push("Węglowodany wyszły bardzo nisko — obniżono tłuszcz do bezpiecznego minimum.");
  }
  if (fat < minFat) {
    fat = minFat;
    carbs = Math.max(0, (input.kcal - protein * 4 - fat * 9) / 4);
    notes.push(`Tłuszcz nie mniej niż ${round(minFat, 0)} g (≈ 0,6 g/kg) — ważne m.in. dla gospodarki hormonalnej.`);
  }
  const fiber = Math.max(25, Math.round((input.kcal / 1000) * 14));

  return {
    kcal: Math.round(input.kcal),
    protein_g: Math.round(protein),
    fat_g: Math.round(fat),
    carbs_g: Math.max(0, Math.round(carbs)),
    fiber_g: fiber,
    protein_g_per_kg: pPerKg,
    reference_weight_kg: ref.weight,
    fat_pct: round((fat * 9) / input.kcal, 3),
    notes,
  };
}

/**
 * Edycja proporcji przez użytkownika: zmiana jednej wartości przelicza resztę
 * przy stałych kaloriach (białko i tłuszcz zadane → węglowodany z bilansu).
 */
export function rebalance(kcal: number, protein_g: number, fat_g: number): MacroTargets {
  const carbs = Math.max(0, (kcal - protein_g * 4 - fat_g * 9) / 4);
  return { kcal, protein_g: Math.round(protein_g), fat_g: Math.round(fat_g), carbs_g: Math.round(carbs), fiber_g: Math.max(25, Math.round((kcal / 1000) * 14)) };
}

/* ------------------------------------------------------------------ */
/* Kaloryczność zmienna (dni siłowni / sportu / odpoczynku)            */
/* ------------------------------------------------------------------ */

export const CYCLE_MULTIPLIER = { gym: 1.1, sport: 1.05 } as const;

export function dayTypeCounts(trainingDays: number[], sports: Sport[]): Record<DayType, number> {
  const gym = new Set(trainingDays);
  const sport = new Set(sports.filter((s) => s.intensity !== "low").flatMap((s) => s.days).filter((d) => !gym.has(d)));
  return { gym: gym.size, sport: sport.size, rest: 7 - gym.size - sport.size };
}

export function dayTypeFor(weekday: number, trainingDays: number[], sports: Sport[]): DayType {
  if (trainingDays.includes(weekday)) return "gym";
  if (sports.some((s) => s.intensity !== "low" && s.days.includes(weekday))) return "sport";
  return "rest";
}

/**
 * Rozkład kalorii na typy dni przy zachowaniu tej samej średniej tygodniowej.
 * Białko stałe, tłuszcz stały; różnica trafia do węglowodanów (więcej w dni
 * treningowe — także w okolicach treningu).
 */
export function dayTargets(base: MacroTargets, mode: CalorieMode, counts: Record<DayType, number>): Record<DayType, MacroTargets> {
  if (mode === "constant") return { gym: { ...base }, sport: { ...base }, rest: { ...base } };
  const { gym: g, sport: s, rest: r } = counts;
  let mGym: number = CYCLE_MULTIPLIER.gym;
  let mSport: number = CYCLE_MULTIPLIER.sport;
  let mRest = r > 0 ? (7 - mGym * g - mSport * s) / r : 1;
  if (r === 0) {
    // brak dni odpoczynku: normalizacja do średniej 1,0
    const total = mGym * g + mSport * s;
    mGym = (mGym * 7) / total;
    mSport = (mSport * 7) / total;
    mRest = 1;
  }
  const make = (m: number): MacroTargets => {
    const kcal = Math.round(base.kcal * m);
    let fat = base.fat_g;
    let carbs = (kcal - base.protein_g * 4 - fat * 9) / 4;
    if (carbs < 40) {
      fat = Math.max(Math.round(base.fat_g * 0.85), fat - Math.ceil(((40 - carbs) * 4) / 9));
      carbs = (kcal - base.protein_g * 4 - fat * 9) / 4;
    }
    return { kcal, protein_g: base.protein_g, fat_g: Math.round(fat), carbs_g: Math.max(0, Math.round(carbs)), fiber_g: base.fiber_g };
  };
  return { gym: make(mGym), sport: make(mSport), rest: make(mRest) };
}

export function weeklyAverage(targets: Record<DayType, MacroTargets>, counts: Record<DayType, number>): number {
  return (targets.gym.kcal * counts.gym + targets.sport.kcal * counts.sport + targets.rest.kcal * counts.rest) / 7;
}

/* ------------------------------------------------------------------ */
/* Nawodnienie                                                        */
/* ------------------------------------------------------------------ */

/** Orientacyjny punkt startowy (nie norma): 30–35 ml/kg + dodatek za trening. */
export function hydrationSuggestion(weight_kg: number, trainingMinutes: number): { min: number; max: number } {
  const extra = (trainingMinutes / 60) * 500;
  return { min: Math.round((weight_kg * 30 + extra) / 50) * 50, max: Math.round((weight_kg * 35 + extra * 2) / 50) * 50 };
}
