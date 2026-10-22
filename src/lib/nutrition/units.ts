import type { FoodProduct, FoodUnit, NutritionPer100 } from "@/lib/domain/types";
import { round } from "@/lib/utils/format";

/** Przeliczniki objętościowe: łyżeczka = 5 ml, łyżka = 15 ml (masa = objętość × gęstość). */
export const TSP_ML = 5;
export const TBSP_ML = 15;

export const UNIT_LABELS: Record<FoodUnit, string> = {
  g: "g",
  ml: "ml",
  szt: "szt.",
  porcja: "porcja",
  lyzeczka: "łyżeczka (5 ml)",
  lyzka: "łyżka (15 ml)",
};

export function availableUnits(p: FoodProduct): FoodUnit[] {
  const u: FoodUnit[] = ["g"];
  if (p.basis === "ml" || p.density !== 1) u.push("ml");
  if (p.piece_g) u.push("szt");
  if (p.serving_g) u.push("porcja");
  u.push("lyzeczka", "lyzka");
  return u;
}

/** Masa w gramach dla podanej ilości i jednostki. */
export function toGrams(p: Pick<FoodProduct, "density" | "piece_g" | "serving_g">, amount: number, unit: FoodUnit): number {
  const density = p.density || 1;
  switch (unit) {
    case "g":
      return amount;
    case "ml":
      return amount * density;
    case "szt":
      return amount * (p.piece_g ?? 0);
    case "porcja":
      return amount * (p.serving_g ?? 0);
    case "lyzeczka":
      return amount * TSP_ML * density;
    case "lyzka":
      return amount * TBSP_ML * density;
  }
}

/** Opis przeliczenia, np. "1 łyżka = 13,7 g" */
export function unitHint(p: FoodProduct, unit: FoodUnit): string {
  if (unit === "g") return "";
  const g = toGrams(p, 1, unit);
  return `1 ${UNIT_LABELS[unit]} = ${round(g, 1).toLocaleString("pl-PL")} g`;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

export const ZERO: Macros = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 };

/**
 * Wartości odżywcze dla masy w gramach. Dla produktów z wartościami na 100 ml
 * masa jest najpierw przeliczana na objętość (g / gęstość).
 */
export function macrosFor(p: NutritionPer100 & Pick<FoodProduct, "basis" | "density">, grams: number): Macros {
  const units100 = p.basis === "ml" ? grams / (p.density || 1) / 100 : grams / 100;
  return {
    kcal: p.kcal * units100,
    protein_g: p.protein * units100,
    fat_g: p.fat * units100,
    carbs_g: p.carbs * units100,
    fiber_g: p.fiber * units100,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    fat_g: a.fat_g + b.fat_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fiber_g: a.fiber_g + b.fiber_g,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(addMacros, { ...ZERO });
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein_g: round(m.protein_g, 1), fat_g: round(m.fat_g, 1), carbs_g: round(m.carbs_g, 1), fiber_g: round(m.fiber_g, 1) };
}

/** Kontrola spójności etykiety: kcal ≈ 4·B + 4·W + 9·T + 2·błonnik (±15%). */
export function labelConsistency(n: NutritionPer100): { ok: boolean; computed: number } {
  const computed = 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * n.fiber;
  if (n.kcal === 0 && computed < 5) return { ok: true, computed };
  const ok = Math.abs(computed - n.kcal) <= Math.max(15, n.kcal * 0.15);
  return { ok, computed };
}
