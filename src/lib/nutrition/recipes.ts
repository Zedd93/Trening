import type { FoodProduct, RecipeIngredient } from "@/lib/domain/types";
import { round } from "@/lib/utils/format";
import { macrosFor, sumMacros, type Macros } from "./units";

export interface RecipeTotals {
  total: Macros;
  raw_mass_g: number;
  final_mass_g: number;
  per100: Macros;
  perServing: Macros;
  serving_g: number;
}

/**
 * Wartości przepisu. Jeżeli podano końcową masę gotowej potrawy (np. po
 * odparowaniu wody), wartości na 100 g liczone są względem niej — inaczej
 * względem sumy mas surowych składników.
 */
export function recipeTotals(ings: Pick<RecipeIngredient, "product_id" | "grams">[], products: Record<string, FoodProduct>, servings: number, finalMass: number | null): RecipeTotals {
  const valid = ings.filter((i) => products[i.product_id] && i.grams > 0);
  const total = sumMacros(valid.map((i) => macrosFor(products[i.product_id], i.grams)));
  const raw = valid.reduce((s, i) => s + i.grams, 0);
  const mass = finalMass && finalMass > 0 ? finalMass : raw;
  const div = (m: Macros, d: number): Macros => ({
    kcal: d ? m.kcal / d : 0,
    protein_g: d ? m.protein_g / d : 0,
    fat_g: d ? m.fat_g / d : 0,
    carbs_g: d ? m.carbs_g / d : 0,
    fiber_g: d ? m.fiber_g / d : 0,
  });
  const s = Math.max(1, servings);
  return {
    total,
    raw_mass_g: round(raw, 0),
    final_mass_g: round(mass, 0),
    per100: div(total, mass / 100),
    perServing: div(total, s),
    serving_g: round(mass / s, 0),
  };
}

/** Przepis jako produkt (do dziennika): wartości na 100 g gotowej potrawy. */
export function recipeAsProduct(
  recipe: { id: string; name: string; servings: number; final_mass_g: number | null },
  ings: Pick<RecipeIngredient, "product_id" | "grams">[],
  products: Record<string, FoodProduct>,
): FoodProduct {
  const t = recipeTotals(ings, products, recipe.servings, recipe.final_mass_g);
  const allergens = Array.from(new Set(ings.flatMap((i) => products[i.product_id]?.allergens ?? [])));
  return {
    id: `recipe:${recipe.id}`,
    user_id: "",
    created_at: "",
    updated_at: "",
    name: recipe.name,
    brand: "Przepis własny",
    barcode: null,
    kcal: round(t.per100.kcal, 1),
    protein: round(t.per100.protein_g, 2),
    fat: round(t.per100.fat_g, 2),
    carbs: round(t.per100.carbs_g, 2),
    fiber: round(t.per100.fiber_g, 2),
    basis: "g",
    density: 1,
    piece_g: null,
    piece_name: null,
    serving_g: t.serving_g,
    category: "ready",
    allergens,
    tags: ["recipe"],
    source: "Obliczone z przepisu użytkownika (suma składników)",
    source_ref: recipe.id,
    price_per_kg: null,
    cooked_ratio: null,
  };
}
