/**
 * Generator jadłospisów (1 dzień / 7 dni / 28 dni).
 *
 * 1. Filtr twardy: alergie, wykluczenia, styl (wegetariański), czas przygotowania.
 * 2. Ocena: dopasowanie makro po skalowaniu, ulubione produkty, styl
 *    (śródziemnomorski, low-carb, high-protein), budżet, powtarzalność,
 *    gotowanie na zapas (ten sam obiad przez 2–3 dni).
 * 3. Skalowanie składników według ról (białko/węglowodany/tłuszcz) metodą
 *    ważonych najmniejszych kwadratów z ograniczeniami.
 * 4. Korekta dzienna: odchyłka sumy dnia jest rozkładana na odblokowane posiłki.
 */
import type {
  Allergen,
  Budget,
  DayType,
  DietStyle,
  FoodProduct,
  MacroTargets,
  MealPlanEntry,
  PlanIngredient,
} from "@/lib/domain/types";
import { addDays, type ISODate } from "@/lib/utils/dates";
import { clamp, round, roundTo } from "@/lib/utils/format";
import { macrosFor, sumMacros, type Macros } from "./units";
import { MEAL_TEMPLATES, slotLayout, type MealTemplate, type SlotType } from "./meals";

export interface PlannerPrefs {
  allergies: Allergen[];
  excluded_foods: string[];
  favorite_foods: string[];
  diet_style: DietStyle;
  max_prep_minutes: number;
  budget: Budget;
  batch_cooking: boolean;
  repetition_tolerance: 1 | 2 | 3;
  meals_per_day: number;
  meal_names: string[];
}

export type Products = Record<string, FoodProduct>;

/* ------------------------------------------------------------------ */
/* Ograniczenia                                                       */
/* ------------------------------------------------------------------ */

const NON_VEG = new Set(["meat", "fish"]);

export function productMatchesExclusion(p: FoodProduct, excluded: string[]): boolean {
  const name = p.name.toLowerCase();
  return excluded.some((e) => {
    const x = e.trim().toLowerCase();
    return x.length > 0 && (p.id === e || name.includes(x));
  });
}

export function productAllowed(p: FoodProduct | undefined, prefs: Pick<PlannerPrefs, "allergies" | "excluded_foods" | "diet_style">): boolean {
  if (!p) return false;
  if (p.allergens.some((a) => prefs.allergies.includes(a))) return false;
  if (productMatchesExclusion(p, prefs.excluded_foods)) return false;
  if (prefs.diet_style === "vegetarian" && NON_VEG.has(p.category)) return false;
  return true;
}

export function templateAllowed(t: MealTemplate, products: Products, prefs: PlannerPrefs): { ok: boolean; reason?: string } {
  for (const ing of t.ingredients) {
    const p = products[ing.product_id];
    if (!p) return { ok: false, reason: "brak produktu w bazie" };
    if (!productAllowed(p, prefs)) return { ok: false, reason: `${p.name} — alergia/wykluczenie/styl żywienia` };
  }
  if (t.prep_minutes > prefs.max_prep_minutes) return { ok: false, reason: `czas przygotowania ${t.prep_minutes} min` };
  return { ok: true };
}

export function templateMacros(ings: PlanIngredient[], products: Products): Macros {
  return sumMacros(ings.map((i) => macrosFor(products[i.product_id], i.grams)));
}

export function templateCostPLN(ings: PlanIngredient[], products: Products): number {
  return ings.reduce((s, i) => s + ((products[i.product_id]?.price_per_kg ?? 20) * i.grams) / 1000, 0);
}

/* ------------------------------------------------------------------ */
/* Skalowanie posiłku do celu                                         */
/* ------------------------------------------------------------------ */

type Group = "protein" | "carb" | "fat";
const GROUPS: Group[] = ["protein", "carb", "fat"];
const SCALE_MIN = 0.4;
const SCALE_MAX = 2.6;

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-9) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function roundGrams(p: FoodProduct, g: number): number {
  if (p.piece_g && p.piece_g >= 40) return Math.max(p.piece_g / 2, roundTo(g, p.piece_g / 2));
  if (g < 20) return Math.max(1, Math.round(g));
  return Math.max(5, roundTo(g, 5));
}

/**
 * Skaluje role składników tak, by makro posiłku było jak najbliżej celu.
 * Błędy liczone w kcal (B×4, T×9, W×4); białko ważone mocniej.
 */
export function fitIngredients(ings: PlanIngredient[], target: Pick<MacroTargets, "protein_g" | "fat_g" | "carbs_g">, products: Products): PlanIngredient[] {
  const groupMacro = (g: Group) => templateMacros(ings.filter((i) => i.role === g), products);
  const fixed = templateMacros(ings.filter((i) => i.role === "veg" || i.role === "fixed"), products);
  const present = GROUPS.filter((g) => ings.some((i) => i.role === g));
  const W = [4 * 1.4, 9, 4]; // wagi wierszy: białko, tłuszcz, węglowodany
  const rows = (m: Macros) => [m.protein_g, m.fat_g, m.carbs_g];
  const cols = present.map((g) => rows(groupMacro(g)));
  const t = [target.protein_g - fixed.protein_g, target.fat_g - fixed.fat_g, target.carbs_g - fixed.carbs_g];

  let scales: Record<Group, number> = { protein: 1, carb: 1, fat: 1 };
  if (present.length) {
    // Normalne równania (AᵀWA) s = AᵀW t z regularyzacją w stronę s = 1.
    const n = present.length;
    const lambda = 0.02;
    const AtA = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => cols[i].reduce((s, _v, r) => s + cols[i][r] * cols[j][r] * W[r] * W[r], 0) + (i === j ? lambda * 1e4 : 0)),
    );
    const Atb = Array.from({ length: n }, (_, i) => cols[i].reduce((s, _v, r) => s + cols[i][r] * t[r] * W[r] * W[r], 0) + lambda * 1e4);
    const sol = solve(AtA, Atb);
    if (sol) present.forEach((g, i) => (scales[g] = clamp(sol[i], SCALE_MIN, SCALE_MAX)));
  }
  return ings.map((i) => {
    const s = i.role === "veg" || i.role === "fixed" ? 1 : scales[i.role as Group];
    return { ...i, grams: roundGrams(products[i.product_id], i.grams * s) };
  });
}

export function macroError(m: Macros, t: MacroTargets): number {
  const kcalErr = Math.abs(m.kcal - t.kcal) / Math.max(1, t.kcal);
  const pErr = Math.abs(m.protein_g - t.protein_g) / Math.max(1, t.protein_g);
  const fErr = Math.abs(m.fat_g - t.fat_g) / Math.max(1, t.fat_g);
  const cErr = Math.abs(m.carbs_g - t.carbs_g) / Math.max(1, t.carbs_g);
  return kcalErr * 2 + pErr * 1.5 + fErr * 0.6 + cErr * 0.6;
}

/* ------------------------------------------------------------------ */
/* Generator                                                          */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUDGET_PER_1000_KCAL: Record<Budget, number> = { low: 9, medium: 14, high: 100 };

export interface PlanRequest {
  start_date: ISODate;
  days: number;
  prefs: PlannerPrefs;
  products: Products;
  dayTypeOf: (date: ISODate) => DayType;
  targets: Record<DayType, MacroTargets>;
  /** Zablokowane wpisy (pozostają bez zmian) */
  locked?: MealPlanEntry[];
  seed?: number;
}

export type PlannedEntry = Omit<MealPlanEntry, "id" | "user_id" | "created_at" | "updated_at" | "plan_id">;

export interface PlanResult {
  entries: PlannedEntry[];
  warnings: string[];
  excluded_templates: { name: string; reason: string }[];
}

function slotTarget(day: MacroTargets, share: number): MacroTargets {
  return {
    kcal: day.kcal * share,
    protein_g: day.protein_g * share,
    fat_g: day.fat_g * share,
    carbs_g: day.carbs_g * share,
    fiber_g: day.fiber_g * share,
  };
}

function toEntry(t: MealTemplate, ings: PlanIngredient[], products: Products, date: ISODate, slot: number, slotName: string, dayType: DayType): PlannedEntry {
  const m = templateMacros(ings, products);
  return {
    date,
    slot_index: slot,
    slot_name: slotName,
    day_type: dayType,
    template_id: t.id,
    title: t.name,
    ingredients: ings,
    instructions: t.instructions,
    prep_minutes: t.prep_minutes,
    kcal: Math.round(m.kcal),
    protein_g: round(m.protein_g, 1),
    fat_g: round(m.fat_g, 1),
    carbs_g: round(m.carbs_g, 1),
    fiber_g: round(m.fiber_g, 1),
    locked: false,
  };
}

export function scoreTemplate(
  t: MealTemplate,
  target: MacroTargets,
  ctx: { prefs: PlannerPrefs; products: Products; recentUse: Map<string, number>; dayIndex: number; usedToday: Set<string> },
): { score: number; ings: PlanIngredient[] } {
  const ings = fitIngredients(t.ingredients, target, ctx.products);
  const m = templateMacros(ings, ctx.products);
  let score = -macroError(m, target) * 10;

  // ulubione produkty
  const fav = t.ingredients.filter((i) => {
    const p = ctx.products[i.product_id];
    return p && ctx.prefs.favorite_foods.some((f) => f === p.id || p.name.toLowerCase().includes(f.toLowerCase()));
  }).length;
  score += fav * 1.2;

  // styl
  const kcal = Math.max(1, m.kcal);
  if (ctx.prefs.diet_style === "mediterranean" && t.mediterranean) score += 1.5;
  if (ctx.prefs.diet_style === "high_protein" && (m.protein_g * 4) / kcal >= 0.3) score += 1;
  if (ctx.prefs.diet_style === "low_carb") score += (m.carbs_g * 4) / kcal < 0.3 ? 1.2 : -1.5;

  // budżet
  const cost = templateCostPLN(ings, ctx.products);
  const per1000 = (cost / kcal) * 1000;
  const limit = BUDGET_PER_1000_KCAL[ctx.prefs.budget];
  if (per1000 > limit) score -= Math.min(4, (per1000 - limit) / 2);

  // powtarzalność
  if (ctx.usedToday.has(t.id)) score -= 20;
  const last = ctx.recentUse.get(t.id);
  if (last !== undefined) {
    const gap = ctx.dayIndex - last;
    const minGap = ctx.prefs.repetition_tolerance === 1 ? 4 : ctx.prefs.repetition_tolerance === 2 ? 2 : 1;
    if (gap < minGap) score -= (minGap - gap) * 3;
  }
  return { score, ings };
}

export function generatePlan(req: PlanRequest): PlanResult {
  const { prefs, products } = req;
  const layout = slotLayout(prefs.meals_per_day);
  const warnings: string[] = [];
  const excluded: { name: string; reason: string }[] = [];
  const allowed = MEAL_TEMPLATES.filter((t) => {
    const r = templateAllowed(t, products, prefs);
    if (!r.ok) excluded.push({ name: t.name, reason: r.reason ?? "" });
    return r.ok;
  });
  const random = rng(req.seed ?? 12345);
  const recentUse = new Map<string, number>();
  const entries: PlannedEntry[] = [];
  const lockedMap = new Map((req.locked ?? []).map((e) => [`${e.date}#${e.slot_index}`, e]));
  let batchLunch: { id: string; until: number } | null = null;

  for (let d = 0; d < req.days; d++) {
    const date = addDays(req.start_date, d);
    const dayType = req.dayTypeOf(date);
    const dayTarget = req.targets[dayType];
    const usedToday = new Set<string>();
    const dayEntries: PlannedEntry[] = [];

    // Zablokowane wpisy pomniejszają cel pozostałych slotów
    const lockedToday = layout.map((_, i) => lockedMap.get(`${date}#${i}`));
    const lockedSum = sumMacros(lockedToday.filter(Boolean).map((e) => ({ kcal: e!.kcal, protein_g: e!.protein_g, fat_g: e!.fat_g, carbs_g: e!.carbs_g, fiber_g: e!.fiber_g })));
    const freeShare = layout.reduce((s, l, i) => s + (lockedToday[i] ? 0 : l.share), 0) || 1;
    const remaining: MacroTargets = {
      kcal: Math.max(0, dayTarget.kcal - lockedSum.kcal),
      protein_g: Math.max(0, dayTarget.protein_g - lockedSum.protein_g),
      fat_g: Math.max(0, dayTarget.fat_g - lockedSum.fat_g),
      carbs_g: Math.max(0, dayTarget.carbs_g - lockedSum.carbs_g),
      fiber_g: dayTarget.fiber_g,
    };

    layout.forEach((slot, i) => {
      const slotName = prefs.meal_names[i] ?? slot.type;
      const locked = lockedToday[i];
      if (locked) {
        const { id: _id, user_id: _u, created_at: _c, updated_at: _up, plan_id: _p, ...rest } = locked;
        dayEntries.push({ ...rest, locked: true });
        usedToday.add(locked.template_id);
        recentUse.set(locked.template_id, d);
        return;
      }
      const target = slotTarget(remaining, slot.share / freeShare);
      let candidates = allowed.filter((t) => t.slots.includes(slot.type as SlotType));
      if (!candidates.length) candidates = allowed.filter((t) => t.slots.includes(slot.type === "snack" ? "breakfast" : "dinner"));
      if (!candidates.length) {
        warnings.push(`${date}: brak posiłków spełniających ograniczenia dla „${slotName}”.`);
        return;
      }

      // gotowanie na zapas: ten sam obiad przez 2–3 dni
      if (slot.type === "lunch" && prefs.batch_cooking && batchLunch && d <= batchLunch.until) {
        const t = candidates.find((c) => c.id === batchLunch!.id);
        if (t) {
          const ings = fitIngredients(t.ingredients, target, products);
          dayEntries.push(toEntry(t, ings, products, date, i, slotName, dayType));
          usedToday.add(t.id);
          return;
        }
      }

      const scored = candidates
        .map((t) => ({ t, ...scoreTemplate(t, target, { prefs, products, recentUse, dayIndex: d, usedToday }) }))
        .map((s) => ({ ...s, score: s.score + (prefs.batch_cooking && slot.type === "lunch" && s.t.batch ? 1.5 : 0) + random() * 0.8 }))
        .sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 3);
      const pick = top[Math.floor(random() * Math.min(top.length, prefs.repetition_tolerance === 3 ? 1 : 2))] ?? top[0];
      dayEntries.push(toEntry(pick.t, pick.ings, products, date, i, slotName, dayType));
      usedToday.add(pick.t.id);
      recentUse.set(pick.t.id, d);
      if (slot.type === "lunch" && prefs.batch_cooking && pick.t.batch) {
        const span = prefs.repetition_tolerance === 1 ? 1 : 2;
        batchLunch = { id: pick.t.id, until: d + span };
      }
    });

    // Korekta dzienna: rozłóż odchyłkę na odblokowane posiłki (jedna iteracja)
    const free = dayEntries.filter((e) => !e.locked);
    const total = sumMacros(dayEntries.map((e) => ({ kcal: e.kcal, protein_g: e.protein_g, fat_g: e.fat_g, carbs_g: e.carbs_g, fiber_g: e.fiber_g })));
    const diff = { p: dayTarget.protein_g - total.protein_g, f: dayTarget.fat_g - total.fat_g, c: dayTarget.carbs_g - total.carbs_g };
    if (free.length && (Math.abs(dayTarget.kcal - total.kcal) / dayTarget.kcal > 0.03 || Math.abs(diff.p) > 8)) {
      const freeKcal = free.reduce((s, e) => s + e.kcal, 0) || 1;
      for (const e of free) {
        const share = e.kcal / freeKcal;
        const t = { protein_g: e.protein_g + diff.p * share, fat_g: e.fat_g + diff.f * share, carbs_g: e.carbs_g + diff.c * share };
        const ings = fitIngredients(e.ingredients.map((i) => ({ ...i })), t, products);
        const tpl = MEAL_TEMPLATES.find((x) => x.id === e.template_id);
        if (tpl) Object.assign(e, toEntry(tpl, ings, products, e.date, e.slot_index, e.slot_name, e.day_type));
      }
    }
    const finalTotal = dayEntries.reduce((s, e) => s + e.kcal, 0);
    if (dayEntries.length && Math.abs(finalTotal - dayTarget.kcal) / dayTarget.kcal > 0.1)
      warnings.push(`${date}: suma ${finalTotal} kcal odbiega o ponad 10% od celu ${dayTarget.kcal} kcal — ograniczenia zawęziły wybór posiłków.`);
    entries.push(...dayEntries);
  }
  if (allowed.length < 8) warnings.push(`Przy obecnych ograniczeniach dostępnych jest tylko ${allowed.length} szablonów posiłków — jadłospis będzie mało zróżnicowany. Dodaj własne przepisy lub złagodź wykluczenia.`);
  return { entries, warnings, excluded_templates: excluded };
}

/* ------------------------------------------------------------------ */
/* Zamienniki                                                         */
/* ------------------------------------------------------------------ */

export const SWAP_GROUPS: Record<string, string[]> = {
  carb: [
    "gen_rice_white",
    "gen_rice_brown",
    "gen_buckwheat",
    "gen_millet",
    "gen_bulgur",
    "gen_quinoa",
    "gen_pasta",
    "gen_pasta_ww",
    "gen_potato",
    "gen_sweet_potato",
    "gen_rye_bread",
    "gen_wheat_bread",
    "gen_tortilla",
    "gen_oats",
    "gen_rice_cakes",
    "gen_rice_cooked",
  ],
  protein: [
    "gen_chicken_breast",
    "gen_chicken_thigh",
    "gen_turkey_breast",
    "gen_beef_mince_5",
    "gen_pork_loin",
    "gen_salmon",
    "gen_cod",
    "gen_tuna_water",
    "gen_shrimp",
    "gen_tofu",
    "gen_egg",
    "gen_quark_semi",
    "gen_skyr",
    "gen_cottage",
    "gen_chickpeas_can",
    "gen_lentils_red",
  ],
  fat: ["gen_olive_oil", "gen_rapeseed_oil", "gen_butter", "gen_avocado", "gen_almonds", "gen_walnuts", "gen_peanut_butter", "gen_pumpkin_seeds", "gen_chia", "gen_flaxseed", "gen_hummus"],
  veg: ["gen_broccoli", "gen_carrot", "gen_red_pepper", "gen_tomato", "gen_cucumber", "gen_spinach", "gen_zucchini", "gen_lettuce", "gen_green_beans", "gen_cauliflower", "gen_mushrooms", "gen_peas", "gen_beetroot", "gen_sauerkraut"],
  fruit: ["gen_banana", "gen_apple", "gen_blueberries", "gen_strawberries", "gen_orange", "gen_raspberries"],
};

function groupOf(productId: string, products: Products): string | null {
  for (const [g, ids] of Object.entries(SWAP_GROUPS)) if (ids.includes(productId)) return g;
  const p = products[productId];
  if (!p) return null;
  if (p.category === "meat" || p.category === "fish" || p.tags.includes("protein")) return "protein";
  if (p.category === "grains" || p.category === "bread") return "carb";
  if (p.category === "fats" || p.category === "nuts") return "fat";
  if (p.category === "vegetables") return "veg";
  if (p.category === "fruit") return "fruit";
  return null;
}

export interface IngredientSwap {
  product: FoodProduct;
  grams: number;
  basis: string;
  macros: Macros;
}

/**
 * Zamienniki składnika z przeliczeniem gramatury:
 * węglowodany → ta sama ilość węglowodanów, białko → ta sama ilość białka,
 * tłuszcze/owoce → te same kcal, warzywa → podobna masa.
 */
export function ingredientSwaps(productId: string, grams: number, products: Products, prefs: Pick<PlannerPrefs, "allergies" | "excluded_foods" | "diet_style">, limit = 8): IngredientSwap[] {
  const src = products[productId];
  if (!src) return [];
  const group = groupOf(productId, products);
  const srcM = macrosFor(src, grams);
  const pool = group ? (SWAP_GROUPS[group] ?? []).concat(Object.values(products).filter((p) => !p.id.startsWith("gen_") && groupOf(p.id, products) === group).map((p) => p.id)) : Object.keys(products);
  const out: IngredientSwap[] = [];
  for (const id of new Set(pool)) {
    if (id === productId) continue;
    const p = products[id];
    if (!productAllowed(p, prefs)) continue;
    const per1 = macrosFor(p, 1);
    let g: number;
    let basis: string;
    if (group === "carb" && per1.carbs_g > 0) {
      g = srcM.carbs_g / per1.carbs_g;
      basis = "ta sama ilość węglowodanów";
    } else if (group === "protein" && per1.protein_g > 0) {
      g = srcM.protein_g / per1.protein_g;
      basis = "ta sama ilość białka";
    } else if (group === "veg") {
      g = grams;
      basis = "podobna masa warzyw";
    } else {
      g = per1.kcal > 0 ? srcM.kcal / per1.kcal : grams;
      basis = "te same kalorie";
    }
    g = roundGrams(p, g);
    if (g > grams * 6 && group !== "veg") continue;
    out.push({ product: p, grams: g, basis, macros: macrosFor(p, g) });
  }
  return out
    .map((s) => ({ s, d: Math.abs(s.macros.kcal - srcM.kcal) / Math.max(1, srcM.kcal) + Math.abs(s.macros.protein_g - srcM.protein_g) / Math.max(5, srcM.protein_g) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.s);
}

/** Zamiana całego posiłku: inne szablony dla tego typu posiłku dopasowane do tych samych makro. */
export function mealSwaps(entry: Pick<MealPlanEntry, "template_id" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fiber_g" | "slot_index">, slotType: SlotType, products: Products, prefs: PlannerPrefs, limit = 6) {
  const target: MacroTargets = { kcal: entry.kcal, protein_g: entry.protein_g, fat_g: entry.fat_g, carbs_g: entry.carbs_g, fiber_g: entry.fiber_g };
  return MEAL_TEMPLATES.filter((t) => t.id !== entry.template_id && t.slots.includes(slotType) && templateAllowed(t, products, prefs).ok)
    .map((t) => {
      const ings = fitIngredients(t.ingredients, target, products);
      const m = templateMacros(ings, products);
      return { template: t, ingredients: ings, macros: m, error: macroError(m, target) };
    })
    .sort((a, b) => a.error - b.error)
    .slice(0, limit);
}

export { toEntry as buildEntry };
