/**
 * Integracja z Open Food Facts (otwarta baza produktów, licencja ODbL).
 * Wyszukiwanie po nazwie i kodzie kreskowym. Brakujące wartości NIE są
 * uzupełniane szacunkami — użytkownik musi je wpisać z etykiety.
 */
import type { Allergen, FoodProduct } from "@/lib/domain/types";

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_pl,brands,nutriments,serving_quantity,allergens_tags,quantity";

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  serving_g: number | null;
  allergens: Allergen[];
  complete: boolean;
  url: string;
}

const ALLERGEN_MAP: Record<string, Allergen> = {
  "en:gluten": "gluten",
  "en:milk": "milk",
  "en:eggs": "eggs",
  "en:nuts": "nuts",
  "en:peanuts": "peanuts",
  "en:soybeans": "soy",
  "en:fish": "fish",
  "en:crustaceans": "crustaceans",
  "en:sesame-seeds": "sesame",
  "en:celery": "celery",
  "en:mustard": "mustard",
};

type Raw = {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  brands?: string;
  serving_quantity?: number | string;
  allergens_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function mapOff(raw: Raw): OffProduct | null {
  if (!raw.code) return null;
  const n = raw.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
    if (kj !== null) kcal = Math.round(kj / 4.184);
  }
  const p: OffProduct = {
    barcode: raw.code,
    name: (raw.product_name_pl || raw.product_name || "").trim() || `Produkt ${raw.code}`,
    brand: (raw.brands ?? "").split(",")[0]?.trim() ?? "",
    kcal,
    protein: num(n["proteins_100g"]),
    fat: num(n["fat_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fiber: num(n["fiber_100g"]),
    serving_g: num(raw.serving_quantity),
    allergens: Array.from(new Set((raw.allergens_tags ?? []).map((t) => ALLERGEN_MAP[t]).filter((a): a is Allergen => !!a))),
    complete: false,
    url: `${BASE}/product/${raw.code}`,
  };
  p.complete = [p.kcal, p.protein, p.fat, p.carbs].every((v) => v !== null);
  return p;
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open Food Facts: błąd ${res.status}`);
  return res.json();
}

export async function offByBarcode(code: string, signal?: AbortSignal): Promise<OffProduct | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 8) throw new Error("Kod kreskowy powinien mieć co najmniej 8 cyfr.");
  const data = await fetchJson(`${BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, signal);
  if (data.status !== 1 || !data.product) return null;
  return mapOff({ ...data.product, code: clean });
}

export async function offSearch(query: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const q = encodeURIComponent(query.trim());
  const data = await fetchJson(
    `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}&tagtype_0=countries&tag_contains_0=contains&tag_0=poland`,
    signal,
  );
  return ((data.products ?? []) as Raw[]).map(mapOff).filter((p): p is OffProduct => !!p);
}

/** Konwersja do rekordu produktu użytkownika (wymaga kompletnych wartości). */
export function offToProduct(p: OffProduct): Omit<FoodProduct, "id" | "user_id" | "created_at" | "updated_at"> {
  if (!p.complete) throw new Error("Brak kompletnych wartości odżywczych — uzupełnij je z etykiety.");
  return {
    name: p.name,
    brand: p.brand,
    barcode: p.barcode,
    kcal: p.kcal!,
    protein: p.protein!,
    fat: p.fat!,
    carbs: p.carbs!,
    fiber: p.fiber ?? 0,
    basis: "g",
    density: 1,
    piece_g: null,
    piece_name: null,
    serving_g: p.serving_g,
    category: "other",
    allergens: p.allergens,
    tags: ["packaged"],
    source: "Open Food Facts (ODbL) — dane społecznościowe, zweryfikuj z etykietą",
    source_ref: p.url,
    price_per_kg: null,
    cooked_ratio: null,
  };
}
