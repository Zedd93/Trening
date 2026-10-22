import type { FoodProduct, MealPlanEntry, ShoppingListItem } from "@/lib/domain/types";
import { CATEGORY_LABELS } from "./foods";

export interface AggregatedItem {
  product_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  pieces: string | null;
}

/** Sumuje składniki jadłospisu z zakresu dat (ten sam produkt = jedna pozycja). */
export function aggregateIngredients(entries: Pick<MealPlanEntry, "ingredients">[], products: Record<string, FoodProduct>): AggregatedItem[] {
  const totals = new Map<string, number>();
  for (const e of entries) for (const i of e.ingredients) totals.set(i.product_id, (totals.get(i.product_id) ?? 0) + i.grams);
  const items: AggregatedItem[] = [];
  for (const [id, grams] of totals) {
    const p = products[id];
    if (!p) continue;
    const isLiquid = p.basis === "ml";
    const qty = isLiquid ? grams / (p.density || 1) : grams;
    const rounded = qty >= 1000 ? Math.ceil(qty / 50) * 50 : Math.ceil(qty / 5) * 5;
    items.push({
      product_id: id,
      name: p.name,
      quantity: rounded,
      unit: isLiquid ? "ml" : "g",
      category: CATEGORY_LABELS[p.category] ?? "Inne",
      pieces: p.piece_g && p.piece_g >= 30 ? `≈ ${Math.ceil(grams / p.piece_g)} ${p.piece_name ?? "szt."}` : null,
    });
  }
  return items.sort((a, b) => a.category.localeCompare(b.category, "pl") || a.name.localeCompare(b.name, "pl"));
}

export function formatQuantity(q: number, unit: string): string {
  if (unit === "g" && q >= 1000) return `${(q / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} kg`;
  if (unit === "ml" && q >= 1000) return `${(q / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} l`;
  return `${q.toLocaleString("pl-PL")} ${unit}`;
}

/** Tekst listy do udostępnienia (tylko produkty do kupienia). */
export function shoppingListText(name: string, items: ShoppingListItem[]): string {
  const toBuy = items.filter((i) => !i.in_pantry);
  const byCat = new Map<string, ShoppingListItem[]>();
  for (const i of toBuy) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  const lines = [`🛒 ${name}`, ""];
  for (const [cat, list] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"))) {
    lines.push(`${cat}:`);
    for (const i of list) lines.push(`${i.checked ? "☑" : "☐"} ${i.name} — ${formatQuantity(i.quantity, i.unit)}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
