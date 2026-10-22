import { describe, expect, it } from "vitest";
import { bmi, dayTargets, dayTypeCounts, energy, goalCalories, macros, mifflinStJeor, neatFactor, rebalance, referenceWeight, weeklyAverage } from "@/lib/nutrition/calculator";
import { GENERIC_MAP } from "@/lib/nutrition/foods";
import { labelConsistency, macrosFor, toGrams } from "@/lib/nutrition/units";
import { recipeTotals } from "@/lib/nutrition/recipes";
import { aggregateIngredients } from "@/lib/nutrition/shopping";
import { fitIngredients, generatePlan, ingredientSwaps, templateMacros, type PlannerPrefs } from "@/lib/nutrition/planner";
import { MEAL_TEMPLATES } from "@/lib/nutrition/meals";
import { buildMealPrep } from "@/lib/nutrition/mealprep";
import { mapOff } from "@/lib/nutrition/openfoodfacts";
import type { MealPlanEntry } from "@/lib/domain/types";

const P = GENERIC_MAP;

describe("Mifflin-St Jeor i TDEE", () => {
  it("BMR zgodny ze wzorem", () => {
    expect(mifflinStJeor("male", 80, 180, 30)).toBe(10 * 80 + 6.25 * 180 - 5 * 30 + 5); // 1780
    expect(mifflinStJeor("female", 60, 165, 30)).toBe(10 * 60 + 6.25 * 165 - 5 * 30 - 161); // 1320.25
  });

  it("współczynnik aktywności rośnie z liczbą kroków i nie przekracza limitu", () => {
    expect(neatFactor(3000, "sedentary")).toBe(1.2);
    expect(neatFactor(8000, "sedentary")).toBe(1.375);
    expect(neatFactor(20000, "physical")).toBeLessThanOrEqual(1.7);
  });

  it("TDEE = BMR × NEAT + średni wydatek treningowy (liczony raz)", () => {
    const e = energy({ sex: "male", age: 30, height_cm: 180, weight_kg: 80, avg_steps: 8000, job_activity: "sedentary", strength_sessions_per_week: 3, session_minutes: 60, sports: [] });
    const expected = 1780 * 1.375 + (3 * 1 * 3.5 * 80) / 7;
    expect(e.tdee).toBe(Math.round(expected));
    expect(e.exercise_kcal_per_day).toBe(120);
  });
});

describe("cel kaloryczny", () => {
  const base = { sex: "male" as const, weight_kg: 90, height_cm: 180, experience: "intermediate" as const, deficit_rate: "moderate" as const, has_contraindications: false, goals: [] };
  it("redukcja: umiarkowany deficyt ~0,5% masy/tydz.", () => {
    const g = goalCalories(2800, 1900, { ...base, primary_goal: "fat_loss" });
    const deficit = (0.005 * 90 * 7700) / 7; // 495
    expect(g.adjustment_kcal).toBeCloseTo(-deficit, -1);
  });
  it("deficyt nie przekracza 25% TDEE", () => {
    const g = goalCalories(2000, 1500, { ...base, weight_kg: 140, deficit_rate: "faster", primary_goal: "fat_loss" });
    expect(2000 - g.kcal).toBeLessThanOrEqual(500 + 10);
  });
  it("nie schodzi poniżej bezpiecznego minimum", () => {
    const g = goalCalories(1500, 1300, { ...base, sex: "female", weight_kg: 50, height_cm: 160, primary_goal: "fat_loss", deficit_rate: "faster" });
    expect(g.kcal).toBeGreaterThanOrEqual(1300 * 0.95 - 10);
  });
  it("budowa masy: umiarkowana nadwyżka", () => {
    const g = goalCalories(2600, 1800, { ...base, primary_goal: "muscle_gain" });
    expect(g.adjustment_kcal).toBeGreaterThan(0);
    expect(g.adjustment_kcal).toBeLessThanOrEqual(2600 * 0.1 + 10);
  });
});

describe("makroskładniki", () => {
  it("białko w zakresie 1,6–2,2 g/kg i bilans energii się zgadza", () => {
    const m = macros({ kcal: 2400, weight_kg: 80, height_cm: 180, primary_goal: "fat_loss", mode: "standard" });
    expect(m.protein_g / 80).toBeGreaterThanOrEqual(1.6);
    expect(m.protein_g / 80).toBeLessThanOrEqual(2.2);
    expect(Math.abs(m.protein_g * 4 + m.fat_g * 9 + m.carbs_g * 4 - 2400)).toBeLessThan(15);
  });
  it("przy otyłości białko liczone od masy referencyjnej", () => {
    const r = referenceWeight(130, 175);
    expect(r.adjusted).toBe(true);
    const m = macros({ kcal: 2400, weight_kg: 130, height_cm: 175, primary_goal: "fat_loss", mode: "standard" });
    expect(m.protein_g).toBeLessThan(130 * 2);
    expect(bmi(130, 175)).toBeGreaterThan(30);
  });
  it("low carb: ~20% energii z węglowodanów", () => {
    const m = macros({ kcal: 2500, weight_kg: 80, height_cm: 180, primary_goal: "fat_loss", mode: "low_carb" });
    expect((m.carbs_g * 4) / 2500).toBeCloseTo(0.2, 1);
  });
  it("tryb indywidualny respektuje zakresy", () => {
    const m = macros({ kcal: 2500, weight_kg: 80, height_cm: 180, primary_goal: "maintenance", mode: "custom", custom_protein_g_per_kg: 5, custom_fat_pct: 35 });
    expect(m.protein_g).toBe(Math.round(2.6 * 80));
  });
  it("zmiana jednego makro przelicza węglowodany", () => {
    const r = rebalance(2000, 150, 60);
    expect(r.carbs_g).toBe(Math.round((2000 - 600 - 540) / 4));
  });
});

describe("kaloryczność zmienna", () => {
  it("zachowuje średnią tygodniową", () => {
    const base = { kcal: 2400, protein_g: 160, fat_g: 70, carbs_g: 285, fiber_g: 34 };
    const counts = dayTypeCounts([0, 2, 4], [{ name: "Bieganie", hours_per_week: 2, intensity: "moderate", days: [5] }]);
    expect(counts).toEqual({ gym: 3, sport: 1, rest: 3 });
    const t = dayTargets(base, "cycling", counts);
    expect(Math.abs(weeklyAverage(t, counts) - 2400)).toBeLessThan(3);
    expect(t.gym.kcal).toBeGreaterThan(t.rest.kcal);
    expect(t.gym.protein_g).toBe(t.rest.protein_g);
  });
});

describe("jednostki i przeliczenia", () => {
  it("łyżka oliwy = 15 ml × gęstość", () => {
    expect(toGrams(P.gen_olive_oil, 1, "lyzka")).toBeCloseTo(13.65, 2);
  });
  it("sztuka jajka = 50 g, porcja odżywki = 30 g", () => {
    expect(toGrams(P.gen_egg, 2, "szt")).toBe(100);
    expect(toGrams(P.gen_whey, 1, "porcja")).toBe(30);
  });
  it("produkty na 100 ml liczone z gęstością", () => {
    const m = macrosFor(P.gen_milk_2, toGrams(P.gen_milk_2, 250, "ml"));
    expect(m.kcal).toBeCloseTo(125, 5);
  });
  it("100 g płatków owsianych = wartości z bazy", () => {
    const m = macrosFor(P.gen_oats, 100);
    expect(m.kcal).toBe(389);
    expect(m.protein_g).toBeCloseTo(16.9);
  });
  it("wszystkie produkty generyczne mają spójne etykiety (kcal ≈ makro)", () => {
    const bad = Object.values(P).filter((p) => !labelConsistency(p).ok).map((p) => `${p.id}: ${p.kcal} vs ${Math.round(labelConsistency(p).computed)}`);
    expect(bad).toEqual([]);
  });
  it("każdy produkt ma źródło danych", () => {
    expect(Object.values(P).every((p) => p.source.length > 10)).toBe(true);
  });
});

describe("przepisy", () => {
  it("wartości na 100 g uwzględniają końcową masę potrawy", () => {
    const ings = [
      { product_id: "gen_rice_white", grams: 200 },
      { product_id: "gen_chicken_breast", grams: 300 },
    ];
    const raw = recipeTotals(ings, P, 4, null);
    expect(raw.total.kcal).toBeCloseTo(365 * 2 + 120 * 3, 5);
    expect(raw.raw_mass_g).toBe(500);
    expect(raw.perServing.kcal).toBeCloseTo(raw.total.kcal / 4, 5);
    const cooked = recipeTotals(ings, P, 4, 1000);
    expect(cooked.per100.kcal).toBeCloseTo(raw.total.kcal / 10, 5);
    expect(cooked.serving_g).toBe(250);
  });
});

const prefs = (over: Partial<PlannerPrefs> = {}): PlannerPrefs => ({
  allergies: [],
  excluded_foods: [],
  favorite_foods: [],
  diet_style: "classic",
  max_prep_minutes: 60,
  budget: "high",
  batch_cooking: false,
  repetition_tolerance: 2,
  meals_per_day: 4,
  meal_names: ["Śniadanie", "Obiad", "Podwieczorek", "Kolacja"],
  ...over,
});
const target = { kcal: 2400, protein_g: 160, fat_g: 75, carbs_g: 270, fiber_g: 34 };

describe("generator jadłospisu", () => {
  it("dopasowanie składników trafia w makro posiłku", () => {
    const t = MEAL_TEMPLATES.find((m) => m.id === "m_chicken_rice_broccoli")!;
    const ings = fitIngredients(t.ingredients, { protein_g: 50, fat_g: 20, carbs_g: 80 }, P);
    const m = templateMacros(ings, P);
    expect(m.protein_g).toBeGreaterThan(42);
    expect(m.protein_g).toBeLessThan(58);
    expect(m.carbs_g).toBeGreaterThan(65);
  });

  it("dzień jadłospisu mieści się w ±7% celu kalorii i ±12% białka", () => {
    const r = generatePlan({ start_date: "2026-11-02", days: 7, prefs: prefs(), products: P, dayTypeOf: () => "gym", targets: { gym: target, sport: target, rest: target }, seed: 7 });
    expect(r.entries).toHaveLength(28);
    const byDay = new Map<string, number[]>();
    for (const e of r.entries) byDay.set(e.date, [...(byDay.get(e.date) ?? [0, 0]).map((v, i) => v + (i === 0 ? e.kcal : e.protein_g))]);
    for (const [, [k, p]] of byDay) {
      expect(Math.abs(k - 2400) / 2400).toBeLessThan(0.07);
      expect(Math.abs(p - 160) / 160).toBeLessThan(0.12);
    }
  });

  it("respektuje alergie, wykluczenia i styl wegetariański", () => {
    const r = generatePlan({
      start_date: "2026-11-02",
      days: 7,
      prefs: prefs({ allergies: ["milk", "gluten"], excluded_foods: ["brokuł"], diet_style: "vegetarian" }),
      products: P,
      dayTypeOf: () => "rest",
      targets: { gym: target, sport: target, rest: target },
    });
    for (const e of r.entries)
      for (const i of e.ingredients) {
        const p = P[i.product_id];
        expect(p.allergens.includes("milk") || p.allergens.includes("gluten")).toBe(false);
        expect(p.name.toLowerCase()).not.toContain("brokuł");
        expect(["meat", "fish"]).not.toContain(p.category);
      }
  });

  it("zablokowane posiłki pozostają bez zmian", () => {
    const first = generatePlan({ start_date: "2026-11-02", days: 1, prefs: prefs(), products: P, dayTypeOf: () => "gym", targets: { gym: target, sport: target, rest: target }, seed: 1 });
    const locked = { ...first.entries[1], id: "x", user_id: "u", created_at: "", updated_at: "", plan_id: "p", locked: true } as MealPlanEntry;
    const second = generatePlan({ start_date: "2026-11-02", days: 1, prefs: prefs(), products: P, dayTypeOf: () => "gym", targets: { gym: target, sport: target, rest: target }, locked: [locked], seed: 99 });
    const kept = second.entries.find((e) => e.slot_index === 1)!;
    expect(kept.template_id).toBe(locked.template_id);
    expect(kept.ingredients).toEqual(locked.ingredients);
  });

  it("zamiana ryżu na ziemniaki przelicza gramaturę po węglowodanach", () => {
    const swaps = ingredientSwaps("gen_rice_white", 70, P, prefs());
    const potato = swaps.find((s) => s.product.id === "gen_potato");
    const expected = (70 * 78.7) / 15.3; // ≈ 360 g
    expect(potato).toBeDefined();
    expect(Math.abs(potato!.grams - expected)).toBeLessThanOrEqual(5);
  });

  it("zamienniki nie naruszają alergii", () => {
    const swaps = ingredientSwaps("gen_chicken_breast", 150, P, prefs({ allergies: ["fish", "milk"] }));
    expect(swaps.every((s) => !s.product.allergens.includes("fish") && !s.product.allergens.includes("milk"))).toBe(true);
  });
});

describe("lista zakupów i meal prep", () => {
  it("sumuje te same składniki i grupuje po kategoriach", () => {
    const entries = [{ ingredients: [{ product_id: "gen_rice_white", grams: 70, role: "carb" as const }] }, { ingredients: [{ product_id: "gen_rice_white", grams: 80, role: "carb" as const }, { product_id: "gen_milk_2", grams: 309, role: "fixed" as const }] }];
    const items = aggregateIngredients(entries, P);
    expect(items.find((i) => i.product_id === "gen_rice_white")!.quantity).toBe(150);
    const milk = items.find((i) => i.product_id === "gen_milk_2")!;
    expect(milk.unit).toBe("ml");
    expect(milk.quantity).toBe(300);
    expect(items.map((i) => i.category)).toEqual([...items.map((i) => i.category)].sort((a, b) => a.localeCompare(b, "pl")));
  });

  it("meal prep: agreguje składniki, ostrzega o pojemnikach i zasadach przechowywania", () => {
    const r = generatePlan({ start_date: "2026-11-02", days: 4, prefs: prefs({ batch_cooking: true }), products: P, dayTypeOf: () => "gym", targets: { gym: target, sport: target, rest: target }, seed: 3 });
    const entries = r.entries.map((e, i) => ({ ...e, id: String(i), user_id: "u", created_at: "", updated_at: "", plan_id: "p" }));
    const plan = buildMealPrep({ entries, days: 4, minutes_available: 30, containers: 1, tools: ["oven", "stove"] }, P);
    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.components.length).toBeGreaterThan(0);
    expect(plan.storage.some((s) => s.includes("4°C"))).toBe(true);
    expect(plan.warnings.some((w) => w.includes("pojemników"))).toBe(true);
  });
});

describe("Open Food Facts", () => {
  it("mapuje produkt i nie uzupełnia brakujących wartości", () => {
    const p = mapOff({ code: "5900000000000", product_name: "Jogurt", nutriments: { "energy-kcal_100g": 60, proteins_100g: 4, fat_100g: 2 } });
    expect(p!.complete).toBe(false);
    expect(p!.carbs).toBeNull();
    const q = mapOff({ code: "1", nutriments: { energy_100g: 418.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 20 } });
    expect(q!.kcal).toBe(100);
    expect(q!.complete).toBe(true);
  });
});
