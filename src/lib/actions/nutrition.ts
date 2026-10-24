"use client";

import type {
  FoodLogEntry,
  FoodProduct,
  FoodUnit,
  MacroTargets,
  MealPlanEntry,
  NewRecord,
  NutritionTarget,
  PlanIngredient,
  Profile,
  UserPreferences,
  GoalType,
  RecipeIngredient,
  ShoppingListItem,
} from "@/lib/domain/types";
import { createRecord, createRecords, putRecords, removeRecords, snapshot, updateRecord } from "@/lib/data/store";
import { addDays, formatDateShort, today, type ISODate } from "@/lib/utils/dates";
import { round } from "@/lib/utils/format";
import { dayTargets, dayTypeCounts, energy, goalCalories, macros } from "@/lib/nutrition/calculator";
import { macrosFor, toGrams } from "@/lib/nutrition/units";
import { buildEntry, generatePlan, type PlannerPrefs } from "@/lib/nutrition/planner";
import { MEAL_MAP } from "@/lib/nutrition/meals";
import { aggregateIngredients } from "@/lib/nutrition/shopping";
import { ageFromBirthYear, dayTypeOn, getActiveProgram, getGoals, getPrefs, getProfile, latestWeight, productIndex } from "@/lib/selectors";
import { pickTrainingDays } from "@/lib/training/generator";

/* ------------------------------------------------------------------ */
/* Cele żywieniowe                                                     */
/* ------------------------------------------------------------------ */

export interface ComputedTargets {
  target: Omit<NutritionTarget, "id" | "user_id" | "created_at" | "updated_at">;
  breakdown: string[];
  goalDescription: string;
  warnings: string[];
  notes: string[];
}

export function computeTargets(profile: Profile, prefs: UserPreferences, goals: { goals: GoalType[]; primary: GoalType }, weightOverride?: number): ComputedTargets {
  const weight = weightOverride ?? profile.weight_kg;
  const e = energy({
    sex: profile.sex,
    age: ageFromBirthYear(profile.birth_year),
    height_cm: profile.height_cm,
    weight_kg: weight,
    avg_steps: profile.avg_steps,
    job_activity: profile.job_activity,
    strength_sessions_per_week: profile.strength_sessions_per_week,
    session_minutes: profile.session_minutes,
    sports: profile.sports,
  });
  const g = goalCalories(e.tdee, e.bmr, {
    primary_goal: goals.primary,
    goals: goals.goals,
    sex: profile.sex,
    weight_kg: weight,
    height_cm: profile.height_cm,
    experience: profile.experience,
    deficit_rate: prefs.deficit_rate,
    has_contraindications: profile.has_contraindications,
  });
  const kcal = prefs.preset_kcal ?? g.kcal;
  const m = macros({
    kcal,
    weight_kg: weight,
    height_cm: profile.height_cm,
    primary_goal: goals.primary,
    mode: prefs.macro_mode,
    custom_protein_g_per_kg: prefs.custom_protein_g_per_kg,
    custom_fat_pct: prefs.custom_fat_pct,
  });
  const base: MacroTargets = { kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carbs_g: m.carbs_g, fiber_g: m.fiber_g };
  const counts = dayTypeCounts(pickTrainingDays(profile.training_days), profile.sports);
  const notes = [...m.notes];
  if (prefs.preset_kcal) notes.unshift(`Użyto Twojej ustalonej kaloryczności (${prefs.preset_kcal} kcal). Wyliczona propozycja: ${g.kcal} kcal.`);
  return {
    target: {
      valid_from: today(),
      active: true,
      bmr: e.bmr,
      tdee: e.tdee,
      maintenance_kcal: e.tdee,
      macro_mode: prefs.macro_mode,
      calorie_mode: prefs.calorie_mode,
      day_targets: dayTargets(base, prefs.calorie_mode, counts),
      source: prefs.preset_kcal ? "manual" : "calculator",
      reason: g.description,
      ...base,
    },
    breakdown: e.breakdown,
    goalDescription: g.description,
    warnings: g.warnings,
    notes,
  };
}

export function saveNutritionTarget(t: ComputedTargets["target"]) {
  const data = snapshot();
  const old = Object.values(data.nutrition_targets).filter((x) => x.active);
  if (old.length) putRecords("nutrition_targets", old.map((x) => ({ ...x, active: false })));
  return createRecord("nutrition_targets", t);
}

/** Zatwierdzona przez użytkownika korekta kalorii (adaptacyjne TDEE). */
export function applyCalorieAdjustment(newKcal: number, reason: string, estimatedTdee: number | null) {
  const data = snapshot();
  const profile = getProfile(data);
  const prefs = getPrefs(data);
  if (!profile || !prefs) return;
  const goals = getGoals(data);
  const weight = latestWeight(data) ?? profile.weight_kg;
  const m = macros({ kcal: newKcal, weight_kg: weight, height_cm: profile.height_cm, primary_goal: goals.primary, mode: prefs.macro_mode, custom_protein_g_per_kg: prefs.custom_protein_g_per_kg, custom_fat_pct: prefs.custom_fat_pct });
  const base: MacroTargets = { kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carbs_g: m.carbs_g, fiber_g: m.fiber_g };
  const prev = Object.values(data.nutrition_targets).find((t) => t.active);
  const counts = dayTypeCounts(pickTrainingDays(profile.training_days), profile.sports);
  return saveNutritionTarget({
    valid_from: today(),
    active: true,
    bmr: prev?.bmr ?? 0,
    tdee: estimatedTdee ?? prev?.tdee ?? 0,
    maintenance_kcal: estimatedTdee ?? prev?.maintenance_kcal ?? 0,
    macro_mode: prefs.macro_mode,
    calorie_mode: prefs.calorie_mode,
    day_targets: dayTargets(base, prefs.calorie_mode, counts),
    source: "adjustment",
    reason,
    ...base,
  });
}

/** Ręczna edycja makro (zmiana jednego składnika przelicza resztę). */
export function saveManualTargets(t: MacroTargets, reason = "Ręczna zmiana proporcji makroskładników") {
  const data = snapshot();
  const prefs = getPrefs(data);
  const profile = getProfile(data);
  const prev = Object.values(data.nutrition_targets).find((x) => x.active);
  const counts = profile ? dayTypeCounts(pickTrainingDays(profile.training_days), profile.sports) : { gym: 3, sport: 0, rest: 4 };
  return saveNutritionTarget({
    valid_from: today(),
    active: true,
    bmr: prev?.bmr ?? 0,
    tdee: prev?.tdee ?? 0,
    maintenance_kcal: prev?.maintenance_kcal ?? 0,
    macro_mode: "custom",
    calorie_mode: prefs?.calorie_mode ?? "constant",
    day_targets: dayTargets(t, prefs?.calorie_mode ?? "constant", counts),
    source: "manual",
    reason,
    ...t,
  });
}

/* ------------------------------------------------------------------ */
/* Dziennik                                                            */
/* ------------------------------------------------------------------ */

function snapshotMacros(p: FoodProduct, grams: number) {
  const m = macrosFor(p, grams);
  return { kcal: round(m.kcal, 1), protein_g: round(m.protein_g, 1), fat_g: round(m.fat_g, 1), carbs_g: round(m.carbs_g, 1), fiber_g: round(m.fiber_g, 1) };
}

export function addFoodLog(date: ISODate, mealIndex: number, product: FoodProduct, amount: number, unit: FoodUnit): FoodLogEntry {
  const grams = round(toGrams(product, amount, unit), 1);
  const isRecipe = product.id.startsWith("recipe:");
  return createRecord("food_log_entries", {
    date,
    meal_index: mealIndex,
    product_id: isRecipe ? null : product.id,
    recipe_id: isRecipe ? product.id.slice(7) : null,
    plan_entry_id: null,
    name: product.brand && !isRecipe ? `${product.name} (${product.brand})` : product.name,
    amount,
    unit,
    grams,
    ...snapshotMacros(product, grams),
  });
}

export function updateFoodLog(entry: FoodLogEntry, amount: number, unit: FoodUnit, mealIndex?: number) {
  const products = productIndex(snapshot());
  const pid = entry.recipe_id ? `recipe:${entry.recipe_id}` : entry.product_id;
  const p = pid ? products[pid] : undefined;
  if (p) {
    const grams = round(toGrams(p, amount, unit), 1);
    return updateRecord("food_log_entries", entry.id, { amount, unit, grams, meal_index: mealIndex ?? entry.meal_index, ...snapshotMacros(p, grams) });
  }
  // wpis z jadłospisu lub produkt usunięty — skalowanie proporcjonalne
  const ratio = entry.amount > 0 ? amount / entry.amount : 1;
  return updateRecord("food_log_entries", entry.id, {
    amount,
    meal_index: mealIndex ?? entry.meal_index,
    grams: round(entry.grams * ratio, 1),
    kcal: round(entry.kcal * ratio, 1),
    protein_g: round(entry.protein_g * ratio, 1),
    fat_g: round(entry.fat_g * ratio, 1),
    carbs_g: round(entry.carbs_g * ratio, 1),
    fiber_g: round(entry.fiber_g * ratio, 1),
  });
}

export function deleteFoodLog(id: string) {
  removeRecords("food_log_entries", [id]);
}

export function logPlanEntry(entry: MealPlanEntry, mealIndex: number, date: ISODate) {
  const grams = entry.ingredients.reduce((s, i) => s + i.grams, 0);
  return createRecord("food_log_entries", {
    date,
    meal_index: mealIndex,
    product_id: null,
    recipe_id: null,
    plan_entry_id: entry.id,
    name: entry.title,
    amount: 1,
    unit: "porcja",
    grams,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    fat_g: entry.fat_g,
    carbs_g: entry.carbs_g,
    fiber_g: entry.fiber_g,
  });
}

export function copyDayLog(from: ISODate, to: ISODate) {
  const entries = Object.values(snapshot().food_log_entries).filter((e) => e.date === from);
  createRecords(
    "food_log_entries",
    entries.map(({ id: _i, user_id: _u, created_at: _c, updated_at: _p, ...rest }) => ({ ...rest, date: to })),
  );
}

export function addWater(date: ISODate, ml: number) {
  if (!Number.isFinite(ml) || ml === 0) return;
  createRecord("water_entries", { date, ml: Math.round(ml) });
}

export function removeWater(id: string) {
  removeRecords("water_entries", [id]);
}

/* ------------------------------------------------------------------ */
/* Produkty i przepisy                                                 */
/* ------------------------------------------------------------------ */

export function saveProduct(p: NewRecord<FoodProduct>) {
  if (p.id && snapshot().food_products[p.id]) return updateRecord("food_products", p.id, p)!;
  return createRecord("food_products", p);
}

export function deleteProduct(id: string) {
  removeRecords("food_products", [id]);
}

export function saveRecipe(
  recipe: { id?: string; name: string; servings: number; final_mass_g: number | null; instructions: string; tags: string[]; prep_minutes: number; favorite: boolean },
  ingredients: { product_id: string; grams: number }[],
) {
  const data = snapshot();
  let r;
  if (recipe.id && data.recipes[recipe.id]) {
    r = updateRecord("recipes", recipe.id, recipe)!;
    const old = Object.values(data.recipe_ingredients).filter((i) => i.recipe_id === recipe.id).map((i) => i.id);
    removeRecords("recipe_ingredients", old);
  } else {
    r = createRecord("recipes", recipe);
  }
  createRecords(
    "recipe_ingredients",
    ingredients.filter((i) => i.grams > 0).map((i, idx): NewRecord<RecipeIngredient> => ({ recipe_id: r.id, product_id: i.product_id, grams: i.grams, order_index: idx })),
  );
  return r;
}

export function deleteRecipe(id: string) {
  const ings = Object.values(snapshot().recipe_ingredients).filter((i) => i.recipe_id === id).map((i) => i.id);
  removeRecords("recipe_ingredients", ings);
  removeRecords("recipes", [id]);
}

/* ------------------------------------------------------------------ */
/* Jadłospis                                                           */
/* ------------------------------------------------------------------ */

export function plannerPrefs(prefs: UserPreferences): PlannerPrefs {
  return {
    allergies: prefs.allergies,
    excluded_foods: prefs.excluded_foods,
    favorite_foods: prefs.favorite_foods,
    diet_style: prefs.diet_style,
    max_prep_minutes: prefs.max_prep_minutes,
    budget: prefs.budget,
    batch_cooking: prefs.batch_cooking,
    repetition_tolerance: prefs.repetition_tolerance,
    meals_per_day: prefs.meals_per_day,
    meal_names: prefs.meal_names,
  };
}

export function activeMealPlan() {
  return Object.values(snapshot().meal_plans).filter((p) => p.status === "active").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/**
 * Generuje (lub regeneruje) jadłospis od startDate na N dni. Zablokowane wpisy
 * w tym zakresie zostają, pozostałe są zastępowane.
 */
export function generateMealPlan(startDate: ISODate, days: number, seed = Date.now() % 100000) {
  const data = snapshot();
  const prefs = getPrefs(data);
  const target = Object.values(data.nutrition_targets).find((t) => t.active);
  if (!prefs || !target) throw new Error("Najpierw ustaw cele żywieniowe.");
  const products = productIndex(data);
  let plan = activeMealPlan();
  const end = addDays(startDate, days - 1);
  if (!plan) {
    plan = createRecord("meal_plans", { name: "Jadłospis", start_date: startDate, days, status: "active", settings: {} });
  } else {
    const newEnd = [addDays(plan.start_date, plan.days - 1), end].sort().at(-1)!;
    const newStart = [plan.start_date, startDate].sort()[0];
    plan = updateRecord("meal_plans", plan.id, { start_date: newStart, days: Math.round((new Date(newEnd).getTime() - new Date(newStart).getTime()) / 86400000) + 1 })!;
  }
  const existing = Object.values(data.meal_plan_entries).filter((e) => e.plan_id === plan!.id && e.date >= startDate && e.date <= end);
  const locked = existing.filter((e) => e.locked);
  const result = generatePlan({
    start_date: startDate,
    days,
    prefs: plannerPrefs(prefs),
    products,
    dayTypeOf: (d) => (target.calorie_mode === "cycling" ? dayTypeOn(data, d) : "gym"),
    targets: target.calorie_mode === "cycling" ? target.day_targets : { gym: target, sport: target, rest: target },
    locked,
    seed,
  });
  removeRecords("meal_plan_entries", existing.filter((e) => !e.locked).map((e) => e.id));
  createRecords(
    "meal_plan_entries",
    result.entries.filter((e) => !e.locked).map((e) => ({ ...e, plan_id: plan!.id })),
  );
  return { plan, ...result };
}

export function toggleLock(entryId: string) {
  const e = snapshot().meal_plan_entries[entryId];
  if (e) updateRecord("meal_plan_entries", entryId, { locked: !e.locked });
}

export function replaceMeal(entryId: string, templateId: string, ingredients: PlanIngredient[]) {
  const data = snapshot();
  const e = data.meal_plan_entries[entryId];
  const t = MEAL_MAP[templateId];
  if (!e || !t) return;
  const built = buildEntry(t, ingredients, productIndex(data), e.date, e.slot_index, e.slot_name, e.day_type);
  updateRecord("meal_plan_entries", entryId, { ...built, locked: e.locked });
}

export function replaceIngredient(entryId: string, index: number, productId: string, grams: number) {
  const data = snapshot();
  const e = data.meal_plan_entries[entryId];
  if (!e) return;
  const ings = e.ingredients.map((i, k) => (k === index ? { ...i, product_id: productId, grams } : i));
  const products = productIndex(data);
  const t = MEAL_MAP[e.template_id];
  const built = buildEntry(t ?? { id: e.template_id, name: e.title, slots: [], ingredients: ings, prep_minutes: e.prep_minutes, batch: false, fridge_days: 2, instructions: e.instructions }, ings, products, e.date, e.slot_index, e.slot_name, e.day_type);
  updateRecord("meal_plan_entries", entryId, { ...built, title: e.title, locked: e.locked });
}

export function updateIngredientGrams(entryId: string, index: number, grams: number) {
  const e = snapshot().meal_plan_entries[entryId];
  if (!e) return;
  replaceIngredient(entryId, index, e.ingredients[index].product_id, grams);
}

/* ------------------------------------------------------------------ */
/* Lista zakupów                                                       */
/* ------------------------------------------------------------------ */

export function createShoppingList(from: ISODate, to: ISODate) {
  const data = snapshot();
  const plan = activeMealPlan();
  const entries = Object.values(data.meal_plan_entries).filter((e) => (!plan || e.plan_id === plan.id) && e.date >= from && e.date <= to);
  const items = aggregateIngredients(entries, productIndex(data));
  const list = createRecord("shopping_lists", { name: `Zakupy ${formatDateShort(from)}–${formatDateShort(to)}`, plan_id: plan?.id ?? null, date_from: from, date_to: to });
  createRecords(
    "shopping_list_items",
    items.map((i): NewRecord<ShoppingListItem> => ({
      list_id: list.id,
      product_id: i.product_id,
      name: i.pieces ? `${i.name} (${i.pieces})` : i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
      checked: false,
      in_pantry: false,
      manual: false,
    })),
  );
  return list;
}

export function addShoppingItem(listId: string, name: string, quantity: number, unit: string, category = "Dodane ręcznie") {
  return createRecord("shopping_list_items", { list_id: listId, product_id: null, name, quantity, unit, category, checked: false, in_pantry: false, manual: true });
}

export function updateShoppingItem(id: string, patch: Partial<Pick<ShoppingListItem, "checked" | "in_pantry" | "quantity" | "name">>) {
  updateRecord("shopping_list_items", id, patch);
}

export function deleteShoppingItem(id: string) {
  removeRecords("shopping_list_items", [id]);
}

export function deleteShoppingList(id: string) {
  const items = Object.values(snapshot().shopping_list_items).filter((i) => i.list_id === id).map((i) => i.id);
  removeRecords("shopping_list_items", items);
  removeRecords("shopping_lists", [id]);
}

export { getActiveProgram };
