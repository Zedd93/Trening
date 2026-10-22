/**
 * Wbudowana baza produktów GENERYCZNYCH (surowce i podstawowe produkty).
 *
 * Wartości na 100 g (lub 100 ml) — zaokrąglone wartości referencyjne z tabel:
 *  - USDA FoodData Central (SR Legacy) — węglowodany przeliczone na
 *    przyswajalne (węglowodany ogółem minus błonnik), zgodnie z etykietami UE,
 *  - Tabele składu i wartości odżywczej żywności (IŻŻ/NIZP-PZH) dla produktów
 *    typowo polskich (twaróg, serek wiejski, kefir).
 * Dla produktów markowych dane pochodzą z Open Food Facts lub z etykiety
 * wprowadzonej ręcznie. Ceny są orientacyjne (PLN/kg) i służą wyłącznie do
 * szacowania budżetu jadłospisu.
 */
import type { Allergen, FoodCategory, FoodProduct } from "@/lib/domain/types";

const USDA = "USDA FoodData Central (SR Legacy) — wartość generyczna, zaokrąglona";
const IZZ = "Tabele składu i wartości odżywczej żywności (IŻŻ) — wartość generyczna";
const TYPICAL = "Wartość typowa dla kategorii — sprawdź etykietę konkretnego produktu";

type Row = [
  id: string,
  name: string,
  category: FoodCategory,
  kcal: number,
  protein: number,
  fat: number,
  carbs: number,
  fiber: number,
  extra?: Partial<Pick<FoodProduct, "piece_g" | "piece_name" | "serving_g" | "basis" | "density" | "allergens" | "tags" | "source" | "price_per_kg" | "cooked_ratio">>,
];

const rows: Row[] = [
  // --- mięso i ryby (surowe) ---
  ["gen_chicken_breast", "Pierś z kurczaka (surowa)", "meat", 120, 22.5, 2.6, 0, 0, { price_per_kg: 28, tags: ["protein"] }],
  ["gen_chicken_thigh", "Udo z kurczaka bez skóry (surowe)", "meat", 119, 19.7, 3.9, 0, 0, { price_per_kg: 24, tags: ["protein"] }],
  ["gen_turkey_breast", "Pierś z indyka (surowa)", "meat", 114, 23.7, 1.5, 0, 0, { price_per_kg: 32, tags: ["protein"] }],
  ["gen_beef_mince_5", "Wołowina mielona chuda 5% (surowa)", "meat", 137, 21.4, 5.0, 0, 0, { price_per_kg: 42, tags: ["protein"] }],
  ["gen_pork_loin", "Schab wieprzowy chudy (surowy)", "meat", 143, 21.0, 6.0, 0, 0, { price_per_kg: 26, tags: ["protein"] }],
  ["gen_salmon", "Łosoś atlantycki (surowy)", "fish", 208, 20.4, 13.4, 0, 0, { allergens: ["fish"], price_per_kg: 75, tags: ["protein", "omega3"] }],
  ["gen_cod", "Dorsz, filet (surowy)", "fish", 82, 17.8, 0.7, 0, 0, { allergens: ["fish"], price_per_kg: 55, tags: ["protein"] }],
  ["gen_tuna_water", "Tuńczyk w sosie własnym (odsączony)", "fish", 116, 25.5, 0.8, 0, 0, { allergens: ["fish"], price_per_kg: 55, tags: ["protein"] }],
  ["gen_shrimp", "Krewetki (surowe)", "fish", 85, 20.1, 0.5, 0, 0, { allergens: ["crustaceans"], price_per_kg: 85, tags: ["protein"] }],
  // --- nabiał i jaja ---
  ["gen_egg", "Jajko kurze (całe, bez skorupki)", "eggs", 143, 12.6, 9.5, 0.7, 0, { piece_g: 50, piece_name: "jajko M", allergens: ["eggs"], price_per_kg: 20, tags: ["protein"] }],
  ["gen_egg_white", "Białko jaja kurzego", "eggs", 52, 10.9, 0.2, 0.7, 0, { allergens: ["eggs"], price_per_kg: 18, tags: ["protein"] }],
  ["gen_quark_semi", "Twaróg półtłusty", "dairy", 133, 18.7, 4.7, 3.7, 0, { source: IZZ, allergens: ["milk"], price_per_kg: 22, tags: ["protein"] }],
  ["gen_skyr", "Skyr naturalny", "dairy", 63, 11.0, 0.2, 4.0, 0, { source: TYPICAL, allergens: ["milk"], price_per_kg: 20, serving_g: 150, tags: ["protein"] }],
  ["gen_yogurt_2", "Jogurt naturalny 2%", "dairy", 60, 4.3, 2.0, 6.2, 0, { source: TYPICAL, allergens: ["milk"], price_per_kg: 10, serving_g: 150 }],
  ["gen_cottage", "Serek wiejski (ziarnisty)", "dairy", 97, 11.0, 5.0, 2.0, 0, { source: IZZ, allergens: ["milk"], price_per_kg: 20, serving_g: 200, tags: ["protein"] }],
  ["gen_milk_2", "Mleko 2%", "dairy", 50, 3.4, 2.0, 4.8, 0, { basis: "ml", density: 1.03, allergens: ["milk"], price_per_kg: 4, serving_g: 250 }],
  ["gen_kefir", "Kefir 2%", "dairy", 50, 3.4, 2.0, 4.7, 0, { source: IZZ, basis: "ml", density: 1.03, allergens: ["milk"], price_per_kg: 6, serving_g: 400 }],
  ["gen_gouda", "Ser żółty typu gouda", "dairy", 356, 24.9, 27.4, 2.2, 0, { allergens: ["milk"], price_per_kg: 38, piece_g: 15, piece_name: "plaster" }],
  ["gen_whey", "Odżywka białkowa WPC (typowa)", "dairy", 400, 75, 7, 8, 0, { source: TYPICAL, allergens: ["milk"], price_per_kg: 90, serving_g: 30, tags: ["protein", "supplement"] }],
  // --- produkty zbożowe ---
  ["gen_rice_white", "Ryż biały (suchy)", "grains", 365, 7.1, 0.7, 78.7, 1.3, { price_per_kg: 8, cooked_ratio: 2.8 }],
  ["gen_rice_brown", "Ryż brązowy (suchy)", "grains", 370, 7.9, 2.9, 73.0, 3.5, { price_per_kg: 12, cooked_ratio: 2.6 }],
  ["gen_rice_cooked", "Ryż biały ugotowany", "grains", 130, 2.7, 0.3, 27.8, 0.4, { price_per_kg: 3 }],
  ["gen_buckwheat", "Kasza gryczana prażona (sucha)", "grains", 346, 11.7, 2.7, 64.6, 10.3, { price_per_kg: 12, cooked_ratio: 2.5 }],
  ["gen_millet", "Kasza jaglana (sucha)", "grains", 378, 11.0, 4.2, 64.5, 8.5, { price_per_kg: 12, cooked_ratio: 3.0 }],
  ["gen_bulgur", "Kasza bulgur (sucha)", "grains", 342, 12.3, 1.3, 57.6, 18.3, { allergens: ["gluten"], price_per_kg: 11, cooked_ratio: 2.6 }],
  ["gen_quinoa", "Komosa ryżowa — quinoa (sucha)", "grains", 368, 14.1, 6.1, 57.2, 7.0, { price_per_kg: 32, cooked_ratio: 2.7 }],
  ["gen_oats", "Płatki owsiane", "grains", 389, 16.9, 6.9, 55.7, 10.6, { allergens: ["gluten"], price_per_kg: 7, serving_g: 50 }],
  ["gen_pasta", "Makaron pszenny (suchy)", "grains", 371, 13.0, 1.5, 71.8, 3.2, { allergens: ["gluten"], price_per_kg: 8, cooked_ratio: 2.4 }],
  ["gen_pasta_ww", "Makaron pełnoziarnisty (suchy)", "grains", 352, 14.6, 1.4, 64.0, 8.3, { allergens: ["gluten"], price_per_kg: 12, cooked_ratio: 2.4 }],
  ["gen_rye_bread", "Chleb żytni pełnoziarnisty", "bread", 250, 8.7, 3.1, 41.0, 6.5, { allergens: ["gluten"], piece_g: 35, piece_name: "kromka", price_per_kg: 13 }],
  ["gen_wheat_bread", "Pieczywo pszenne (bułka)", "bread", 265, 9.0, 3.2, 46.3, 2.7, { allergens: ["gluten"], piece_g: 60, piece_name: "bułka", price_per_kg: 10 }],
  ["gen_tortilla", "Tortilla pszenna", "bread", 312, 8.3, 7.9, 48.5, 3.5, { allergens: ["gluten"], piece_g: 60, piece_name: "placek", price_per_kg: 22 }],
  ["gen_rice_cakes", "Wafle ryżowe (naturalne)", "grains", 387, 8.2, 2.8, 77.3, 4.2, { piece_g: 10, piece_name: "wafel", price_per_kg: 25 }],
  ["gen_potato", "Ziemniaki (surowe)", "vegetables", 77, 2.0, 0.1, 15.3, 2.2, { price_per_kg: 3 }],
  ["gen_sweet_potato", "Bataty (surowe)", "vegetables", 86, 1.6, 0.1, 17.1, 3.0, { price_per_kg: 10 }],
  // --- strączki i zamienniki ---
  ["gen_chickpeas_can", "Ciecierzyca konserwowa (odsączona)", "legumes", 139, 7.0, 2.1, 15.0, 7.6, { price_per_kg: 12 }],
  ["gen_lentils_red", "Soczewica czerwona (sucha)", "legumes", 352, 24.6, 1.1, 52.7, 10.7, { price_per_kg: 12, cooked_ratio: 2.3 }],
  ["gen_kidney_beans", "Fasola czerwona gotowana / konserwowa (odsączona)", "legumes", 127, 8.7, 0.5, 16.4, 6.4, { price_per_kg: 10 }],
  ["gen_tofu", "Tofu twarde naturalne", "legumes", 144, 17.3, 8.7, 0.5, 2.3, { allergens: ["soy"], price_per_kg: 32, tags: ["protein"] }],
  ["gen_hummus", "Hummus", "legumes", 166, 7.9, 9.6, 8.3, 6.0, { allergens: ["sesame"], price_per_kg: 40 }],
  // --- warzywa ---
  ["gen_broccoli", "Brokuł", "vegetables", 34, 2.8, 0.4, 4.0, 2.6, { price_per_kg: 10 }],
  ["gen_carrot", "Marchew", "vegetables", 41, 0.9, 0.2, 6.8, 2.8, { piece_g: 80, piece_name: "sztuka", price_per_kg: 3 }],
  ["gen_red_pepper", "Papryka czerwona", "vegetables", 31, 1.0, 0.3, 3.9, 2.1, { piece_g: 160, piece_name: "sztuka", price_per_kg: 15 }],
  ["gen_tomato", "Pomidor", "vegetables", 18, 0.9, 0.2, 2.7, 1.2, { piece_g: 120, piece_name: "sztuka", price_per_kg: 10 }],
  ["gen_cucumber", "Ogórek zielony", "vegetables", 15, 0.7, 0.1, 3.1, 0.5, { piece_g: 180, piece_name: "sztuka", price_per_kg: 8 }],
  ["gen_spinach", "Szpinak (świeży)", "vegetables", 23, 2.9, 0.4, 1.4, 2.2, { price_per_kg: 25 }],
  ["gen_onion", "Cebula", "vegetables", 40, 1.1, 0.1, 7.6, 1.7, { piece_g: 100, piece_name: "sztuka", price_per_kg: 4 }],
  ["gen_zucchini", "Cukinia", "vegetables", 17, 1.2, 0.3, 2.1, 1.0, { piece_g: 250, piece_name: "sztuka", price_per_kg: 8 }],
  ["gen_lettuce", "Sałata / mix sałat", "vegetables", 15, 1.4, 0.2, 1.6, 1.3, { price_per_kg: 20 }],
  ["gen_green_beans", "Fasolka szparagowa (mrożona/świeża)", "vegetables", 31, 1.8, 0.2, 4.3, 2.7, { price_per_kg: 12 }],
  ["gen_cauliflower", "Kalafior", "vegetables", 25, 1.9, 0.3, 3.0, 2.0, { price_per_kg: 8 }],
  ["gen_mushrooms", "Pieczarki", "vegetables", 22, 3.1, 0.3, 2.3, 1.0, { price_per_kg: 14 }],
  ["gen_peas", "Groszek zielony (mrożony)", "vegetables", 77, 5.2, 0.4, 9.1, 4.5, { price_per_kg: 10 }],
  ["gen_avocado", "Awokado (miąższ)", "vegetables", 160, 2.0, 14.7, 1.8, 6.7, { piece_g: 140, piece_name: "sztuka (miąższ)", price_per_kg: 30 }],
  ["gen_beetroot", "Burak gotowany", "vegetables", 44, 1.7, 0.2, 8.0, 2.0, { price_per_kg: 5 }],
  ["gen_sauerkraut", "Kapusta kiszona", "vegetables", 19, 0.9, 0.1, 1.4, 2.9, { price_per_kg: 8 }],
  ["gen_passata", "Passata pomidorowa", "vegetables", 38, 1.7, 0.2, 7.1, 1.9, { basis: "ml", density: 1.04, price_per_kg: 8 }],
  // --- owoce ---
  ["gen_banana", "Banan (bez skórki)", "fruit", 89, 1.1, 0.3, 20.2, 2.6, { piece_g: 120, piece_name: "sztuka", price_per_kg: 6 }],
  ["gen_apple", "Jabłko", "fruit", 52, 0.3, 0.2, 11.4, 2.4, { piece_g: 180, piece_name: "sztuka", price_per_kg: 4 }],
  ["gen_blueberries", "Borówki amerykańskie", "fruit", 57, 0.7, 0.3, 12.1, 2.4, { price_per_kg: 40 }],
  ["gen_strawberries", "Truskawki", "fruit", 32, 0.7, 0.3, 5.7, 2.0, { price_per_kg: 20 }],
  ["gen_orange", "Pomarańcza", "fruit", 47, 0.9, 0.1, 9.4, 2.4, { piece_g: 160, piece_name: "sztuka", price_per_kg: 7 }],
  ["gen_raspberries", "Maliny (świeże/mrożone)", "fruit", 52, 1.2, 0.7, 5.4, 6.5, { price_per_kg: 28 }],
  // --- orzechy, nasiona, tłuszcze ---
  ["gen_almonds", "Migdały", "nuts", 579, 21.2, 49.9, 9.1, 12.5, { allergens: ["nuts"], price_per_kg: 50, piece_g: 1.2, piece_name: "migdał" }],
  ["gen_walnuts", "Orzechy włoskie", "nuts", 654, 15.2, 65.2, 7.0, 6.7, { allergens: ["nuts"], price_per_kg: 50 }],
  ["gen_peanut_butter", "Masło orzechowe 100%", "nuts", 588, 25.0, 50.0, 14.0, 6.0, { allergens: ["peanuts"], price_per_kg: 32 }],
  ["gen_pumpkin_seeds", "Pestki dyni (łuskane)", "nuts", 559, 30.2, 49.0, 4.7, 6.0, { price_per_kg: 40 }],
  ["gen_chia", "Nasiona chia", "nuts", 486, 16.5, 30.7, 7.7, 34.4, { price_per_kg: 30 }],
  ["gen_flaxseed", "Siemię lniane mielone", "nuts", 534, 18.3, 42.2, 1.6, 27.3, { price_per_kg: 15 }],
  ["gen_olive_oil", "Oliwa z oliwek", "fats", 884, 0, 100, 0, 0, { basis: "ml", density: 0.91, price_per_kg: 45 }],
  ["gen_rapeseed_oil", "Olej rzepakowy", "fats", 884, 0, 100, 0, 0, { basis: "ml", density: 0.92, price_per_kg: 10 }],
  ["gen_butter", "Masło (82% tł.)", "fats", 717, 0.9, 81.1, 0.1, 0, { allergens: ["milk"], price_per_kg: 40 }],
  // --- inne ---
  ["gen_honey", "Miód", "sweets", 304, 0.3, 0, 82.2, 0.2, { price_per_kg: 40 }],
  ["gen_dark_chocolate", "Czekolada gorzka 70–85%", "sweets", 598, 7.8, 42.6, 35.0, 10.9, { allergens: ["milk", "soy"], price_per_kg: 60, piece_g: 10, piece_name: "kostka" }],
  ["gen_soy_sauce", "Sos sojowy", "spices", 53, 8.1, 0.6, 4.1, 0.8, { basis: "ml", density: 1.1, allergens: ["soy", "gluten"], price_per_kg: 20 }],
];

export const GENERIC_FOODS: FoodProduct[] = rows.map(([id, name, category, kcal, protein, fat, carbs, fiber, extra = {}]) => ({
  id,
  user_id: "system",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  name,
  brand: "",
  barcode: null,
  kcal,
  protein,
  fat,
  carbs,
  fiber,
  basis: extra.basis ?? "g",
  density: extra.density ?? 1,
  piece_g: extra.piece_g ?? null,
  piece_name: extra.piece_name ?? null,
  serving_g: extra.serving_g ?? null,
  category,
  allergens: (extra.allergens ?? []) as Allergen[],
  tags: extra.tags ?? [],
  source: extra.source ?? USDA,
  source_ref: null,
  price_per_kg: extra.price_per_kg ?? null,
  cooked_ratio: extra.cooked_ratio ?? null,
}));

export const GENERIC_MAP: Record<string, FoodProduct> = Object.fromEntries(GENERIC_FOODS.map((f) => [f.id, f]));

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  meat: "Mięso",
  fish: "Ryby i owoce morza",
  dairy: "Nabiał",
  eggs: "Jaja",
  grains: "Produkty zbożowe i kasze",
  bread: "Pieczywo",
  legumes: "Strączkowe i tofu",
  vegetables: "Warzywa",
  fruit: "Owoce",
  nuts: "Orzechy i nasiona",
  fats: "Tłuszcze",
  sweets: "Słodkie",
  drinks: "Napoje",
  spices: "Przyprawy i sosy",
  ready: "Dania gotowe",
  other: "Inne",
};

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  milk: "Mleko (laktoza/białka mleka)",
  eggs: "Jaja",
  nuts: "Orzechy",
  peanuts: "Orzeszki ziemne",
  soy: "Soja",
  fish: "Ryby",
  crustaceans: "Skorupiaki",
  sesame: "Sezam",
  celery: "Seler",
  mustard: "Gorczyca",
};

/** Wszystkie produkty: generyczne + własne użytkownika (własne mają pierwszeństwo). */
export function allProducts(userProducts: Record<string, FoodProduct>): Record<string, FoodProduct> {
  return { ...GENERIC_MAP, ...userProducts };
}

export function searchProducts(products: FoodProduct[], query: string, limit = 30): FoodProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products.slice(0, limit);
  const words = q.split(/\s+/);
  return products
    .map((p) => {
      const hay = `${p.name} ${p.brand} ${p.barcode ?? ""}`.toLowerCase();
      const score = words.every((w) => hay.includes(w)) ? (hay.startsWith(q) ? 3 : hay.includes(q) ? 2 : 1) : 0;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, "pl"))
    .slice(0, limit)
    .map((x) => x.p);
}
