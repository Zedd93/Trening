/**
 * Gotowanie na zapas: zbiorcza instrukcja przygotowania posiłków na kilka dni
 * z zasadami bezpiecznego przechowywania.
 */
import type { FoodProduct, MealPlanEntry } from "@/lib/domain/types";
import { MEAL_MAP } from "./meals";

export type KitchenTool = "oven" | "stove" | "multicooker" | "airfryer" | "microwave";

export const KITCHEN_LABELS: Record<KitchenTool, string> = {
  oven: "Piekarnik",
  stove: "Płyta grzewcza / garnki",
  multicooker: "Multicooker / szybkowar",
  airfryer: "Air fryer",
  microwave: "Mikrofalówka",
};

export interface MealPrepInput {
  entries: MealPlanEntry[];
  days: number;
  minutes_available: number;
  containers: number;
  tools: KitchenTool[];
}

export interface PrepComponent {
  product_id: string;
  name: string;
  grams: number;
  method: string;
  minutes: number;
  equipment: KitchenTool | null;
}

export interface MealPrepPlan {
  meals: MealPlanEntry[];
  components: PrepComponent[];
  steps: string[];
  estimated_minutes: number;
  storage: string[];
  warnings: string[];
  freeze_from_day: number | null;
}

const PROTEIN_METHOD: Record<string, { oven: string; stove: string; airfryer?: string; minutes: number }> = {
  gen_chicken_breast: { oven: "piecz w 200°C ok. 20–25 min (do min. 75°C w środku)", stove: "smaż w kawałkach 8–10 min do pełnego ścięcia", airfryer: "air fryer 190°C ok. 15–18 min", minutes: 25 },
  gen_chicken_thigh: { oven: "piecz w 200°C ok. 25–30 min (do min. 75°C w środku)", stove: "smaż 10–12 min", airfryer: "air fryer 190°C ok. 18–20 min", minutes: 30 },
  gen_turkey_breast: { oven: "piecz w 200°C ok. 20–25 min (do min. 75°C w środku)", stove: "duś w kostce 12–15 min", minutes: 25 },
  gen_pork_loin: { oven: "piecz w 190°C ok. 30–35 min (do ok. 70°C w środku)", stove: "smaż plastry 4–5 min z każdej strony", minutes: 35 },
  gen_beef_mince_5: { oven: "—", stove: "obsmaż w garnku, następnie duś z sosem 15–20 min", minutes: 25 },
  gen_salmon: { oven: "piecz w 200°C 12–15 min", stove: "smaż 4 min z każdej strony", airfryer: "air fryer 180°C ok. 10–12 min", minutes: 15 },
  gen_cod: { oven: "piecz w 190°C ok. 15 min", stove: "duś pod przykryciem 8–10 min", minutes: 15 },
  gen_tofu: { oven: "piecz kostki w 200°C ok. 20–25 min", stove: "smaż kostki na złoto 8–10 min", airfryer: "air fryer 200°C ok. 12–15 min", minutes: 20 },
  gen_egg: { oven: "—", stove: "gotuj na twardo 10 min, schłodź", minutes: 12 },
  gen_lentils_red: { oven: "—", stove: "gotuj 15–18 min w sosie", minutes: 20 },
};

const CARB_METHOD: Record<string, { stove: string; multicooker?: string; minutes: number }> = {
  gen_rice_white: { stove: "gotuj 12–15 min (1 część ryżu : 2 części wody)", multicooker: "program ryż ok. 20 min", minutes: 18 },
  gen_rice_brown: { stove: "gotuj 25–30 min", multicooker: "program ryż ok. 30 min", minutes: 30 },
  gen_buckwheat: { stove: "gotuj 15 min (1 : 2), odstaw pod przykryciem", multicooker: "program kasza", minutes: 18 },
  gen_millet: { stove: "przepłucz wrzątkiem, gotuj 15 min (1 : 2,5)", multicooker: "program kasza", minutes: 18 },
  gen_bulgur: { stove: "zalej wrzątkiem 1 : 2, odstaw na 15 min", minutes: 15 },
  gen_quinoa: { stove: "przepłucz, gotuj 12–15 min (1 : 2)", multicooker: "program ryż", minutes: 15 },
  gen_pasta: { stove: "gotuj al dente 8–10 min, przelej zimną wodą", minutes: 12 },
  gen_pasta_ww: { stove: "gotuj al dente 9–11 min, przelej zimną wodą", minutes: 13 },
  gen_potato: { stove: "gotuj w osolonej wodzie 18–20 min", minutes: 22 },
  gen_sweet_potato: { stove: "gotuj 15 min", minutes: 30 },
};

export function buildMealPrep(input: MealPrepInput, products: Record<string, FoodProduct>): MealPrepPlan {
  const warnings: string[] = [];
  const dates = Array.from(new Set(input.entries.map((e) => e.date))).sort().slice(0, input.days);
  const meals = input.entries.filter((e) => dates.includes(e.date) && (MEAL_MAP[e.template_id]?.batch ?? false));
  if (!meals.length) warnings.push("W wybranym okresie jadłospisu nie ma posiłków nadających się do gotowania na zapas. Wygeneruj jadłospis z włączoną opcją „gotowanie na kilka dni”.");

  const has = (t: KitchenTool) => input.tools.includes(t);
  const totals = new Map<string, number>();
  for (const m of meals) for (const i of m.ingredients) totals.set(i.product_id, (totals.get(i.product_id) ?? 0) + i.grams);

  const components: PrepComponent[] = [];
  for (const [id, grams] of totals) {
    const p = products[id];
    if (!p) continue;
    const prot = PROTEIN_METHOD[id];
    const carb = CARB_METHOD[id];
    if (prot) {
      const useOven = has("oven") && prot.oven !== "—";
      const useAir = !useOven && has("airfryer") && prot.airfryer;
      components.push({ product_id: id, name: p.name, grams, method: useOven ? prot.oven : useAir ? prot.airfryer! : prot.stove, minutes: prot.minutes, equipment: useOven ? "oven" : useAir ? "airfryer" : "stove" });
    } else if (carb) {
      const mc = has("multicooker") && carb.multicooker;
      const roast = id === "gen_sweet_potato" && has("oven");
      components.push({ product_id: id, name: p.name, grams, method: roast ? "pokrój w kliny i piecz w 200°C 25–30 min" : mc ? carb.multicooker! : carb.stove, minutes: carb.minutes, equipment: roast ? "oven" : mc ? "multicooker" : "stove" });
    } else if (p.category === "vegetables" && !["gen_tomato", "gen_cucumber", "gen_lettuce", "gen_passata", "gen_sauerkraut"].includes(id)) {
      components.push({ product_id: id, name: p.name, grams, method: has("oven") ? "pokrój i upiecz na blasze w 200°C 15–20 min lub ugotuj na parze 5–8 min" : "ugotuj na parze lub podduś 5–8 min (zachowaj lekko chrupkie)", minutes: 15, equipment: has("oven") ? "oven" : "stove" });
    }
  }
  if (!has("oven") && !has("stove") && !has("multicooker")) warnings.push("Bez piekarnika, płyty i multicookera nie da się bezpiecznie przygotować gotowanych składników.");

  // Szacowanie czasu: przygotowanie + najdłuższy proces na każdym urządzeniu (praca równoległa)
  const prepMinutes = 10 + Math.ceil(meals.length / 2) * 3;
  const byTool = new Map<string, number>();
  for (const c of components) byTool.set(c.equipment ?? "stove", Math.max(byTool.get(c.equipment ?? "stove") ?? 0, c.minutes) + (c.equipment === "stove" ? 3 : 0));
  const cooking = Math.max(0, ...byTool.values());
  const portioning = 5 + meals.length * 1.5;
  const estimated = Math.round(prepMinutes + cooking + portioning);
  if (estimated > input.minutes_available) warnings.push(`Szacowany czas (${estimated} min) przekracza dostępny (${input.minutes_available} min). Ogranicz liczbę dni lub wybierz prostsze posiłki.`);
  if (meals.length > input.containers) warnings.push(`Potrzeba ${meals.length} pojemników, a masz ${input.containers}. Część porcji przechowaj w większych pojemnikach lub zmniejsz liczbę dni.`);

  const steps: string[] = [];
  const oven = components.filter((c) => c.equipment === "oven");
  const air = components.filter((c) => c.equipment === "airfryer");
  const stove = components.filter((c) => c.equipment === "stove");
  const multi = components.filter((c) => c.equipment === "multicooker");
  steps.push("Umyj ręce, przygotuj czyste pojemniki z pokrywkami i deski (osobna do surowego mięsa).");
  if (oven.length) steps.push(`Rozgrzej piekarnik do 200°C.`);
  if (multi.length) steps.push(`Multicooker: ${multi.map((c) => `${c.name} (${Math.round(c.grams)} g) — ${c.method}`).join("; ")}.`);
  const stoveCarbs = stove.filter((c) => CARB_METHOD[c.product_id]);
  if (stoveCarbs.length) steps.push(`Garnki: ${stoveCarbs.map((c) => `${c.name} (${Math.round(c.grams)} g suchego produktu) — ${c.method}`).join("; ")}.`);
  if (oven.length) steps.push(`Piekarnik (blachy obok siebie): ${oven.map((c) => `${c.name} (${Math.round(c.grams)} g) — ${c.method}`).join("; ")}.`);
  if (air.length) steps.push(`Air fryer: ${air.map((c) => `${c.name} (${Math.round(c.grams)} g) — ${c.method}`).join("; ")}.`);
  const stoveOther = stove.filter((c) => !CARB_METHOD[c.product_id]);
  if (stoveOther.length) steps.push(`Patelnia/garnek: ${stoveOther.map((c) => `${c.name} (${Math.round(c.grams)} g) — ${c.method}`).join("; ")}.`);
  const sauces = Array.from(new Set(meals.map((m) => m.template_id))).map((id) => MEAL_MAP[id]).filter((t) => t && t.ingredients.some((i) => i.product_id === "gen_passata"));
  if (sauces.length) steps.push(`Sosy/dania jednogarnkowe: ${sauces.map((t) => t!.name).join(", ")} — przygotuj zgodnie z przepisem w jednym większym garnku.`);
  steps.push("W czasie pieczenia pokrój warzywa na surowo (sałatki dodawaj w dniu jedzenia, aby nie straciły świeżości).");
  steps.push("Ugotowane składniki rozłóż płasko do szybkiego schłodzenia — do lodówki w ciągu ok. 1 godziny (maks. 2 h) od ugotowania.");
  steps.push(`Podziel na ${meals.length} porcji według gramatur z jadłospisu, opisz pojemniki datą przygotowania i dniem spożycia.`);

  const maxFridge = Math.min(...meals.map((m) => MEAL_MAP[m.template_id]?.fridge_days ?? 3), 3);
  const freezeFrom = input.days > maxFridge ? maxFridge + 1 : null;
  const storage = [
    "Lodówka: temperatura do 4°C. Gotowane posiłki z mięsem, kaszą i warzywami spożyj w ciągu 3 dni.",
    "Ryż i makaron: schłodź szybko po ugotowaniu i przechowuj w lodówce — najlepiej zjedz w ciągu 1–2 dni lub zamroź (ryzyko namnażania Bacillus cereus).",
    "Ryby: najlepiej w ciągu 1–2 dni od przygotowania.",
    "Porcje na dalsze dni zamroź od razu po schłodzeniu (−18°C); rozmrażaj w lodówce przez noc.",
    "Odgrzewaj do momentu, aż danie będzie gorące w całej objętości (ok. 70–75°C w środku) i tylko raz.",
    "Nie zostawiaj gotowych porcji w temperaturze pokojowej dłużej niż 2 godziny.",
  ];
  if (freezeFrom) warnings.push(`Planujesz ${input.days} dni — porcje od dnia ${freezeFrom} zamroź od razu po schłodzeniu.`);

  return { meals, components, steps, estimated_minutes: estimated, storage, warnings, freeze_from_day: freezeFrom };
}
