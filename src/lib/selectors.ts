/**
 * Funkcje odczytu (czyste) operujące na migawce danych użytkownika.
 */
import type {
  DayType,
  FoodProduct,
  GoalType,
  NutritionTarget,
  Profile,
  Snapshot,
  TrainingProgram,
  UserPreferences,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/domain/types";
import { allProducts } from "@/lib/nutrition/foods";
import { recipeAsProduct } from "@/lib/nutrition/recipes";
import { activeTarget } from "@/lib/analytics/analytics";
import { dayTypeFor } from "@/lib/nutrition/calculator";
import { weekdayIndex, type ISODate } from "@/lib/utils/dates";

export const getProfile = (d: Snapshot): Profile | undefined => Object.values(d.profiles)[0];
export const getPrefs = (d: Snapshot): UserPreferences | undefined => Object.values(d.user_preferences)[0];

export function getGoals(d: Snapshot): { goals: GoalType[]; primary: GoalType } {
  const g = Object.values(d.user_goals);
  const primary = g.find((x) => x.is_primary)?.goal ?? g[0]?.goal ?? "maintenance";
  return { goals: g.map((x) => x.goal), primary };
}

export function getActiveProgram(d: Snapshot): TrainingProgram | undefined {
  const progs = Object.values(d.training_programs);
  return progs.filter((p) => p.status === "active").sort((a, b) => b.cycle_number - a.cycle_number)[0] ?? progs.sort((a, b) => b.cycle_number - a.cycle_number)[0];
}

export function programSessions(d: Snapshot, programId: string | undefined): WorkoutSession[] {
  if (!programId) return [];
  return Object.values(d.workout_sessions)
    .filter((s) => s.program_id === programId)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.day_index - b.day_index);
}

export function sessionExercises(d: Snapshot, sessionId: string): WorkoutExercise[] {
  return Object.values(d.workout_exercises)
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function getTarget(d: Snapshot, date: ISODate): NutritionTarget | undefined {
  return activeTarget(Object.values(d.nutrition_targets).filter((t) => t.active || t.valid_from <= date), date);
}

export function currentTarget(d: Snapshot): NutritionTarget | undefined {
  const ts = Object.values(d.nutrition_targets);
  return ts.filter((t) => t.active).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? ts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** Typ dnia: dzień zaplanowanego treningu siłowego > dzień sportu > odpoczynek. */
export function dayTypeOn(d: Snapshot, date: ISODate): DayType {
  const prog = getActiveProgram(d);
  const hasSession = Object.values(d.workout_sessions).some((s) => s.scheduled_date === date && s.program_id === prog?.id && s.status !== "skipped");
  if (hasSession) return "gym";
  const profile = getProfile(d);
  return dayTypeFor(weekdayIndex(date), [], profile?.sports ?? []);
}

export function productIndex(d: Snapshot): Record<string, FoodProduct> {
  const base = allProducts(d.food_products);
  const ingByRecipe = new Map<string, { product_id: string; grams: number }[]>();
  for (const ri of Object.values(d.recipe_ingredients)) ingByRecipe.set(ri.recipe_id, [...(ingByRecipe.get(ri.recipe_id) ?? []), ri]);
  for (const r of Object.values(d.recipes)) {
    const p = recipeAsProduct(r, ingByRecipe.get(r.id) ?? [], base);
    base[p.id] = p;
  }
  return base;
}

export function latestWeight(d: Snapshot): number | null {
  const m = Object.values(d.body_measurements)
    .filter((x) => x.weight_kg !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return m?.weight_kg ?? getProfile(d)?.weight_kg ?? null;
}

export function ageFromBirthYear(year: number, ref = new Date()): number {
  return ref.getFullYear() - year;
}
