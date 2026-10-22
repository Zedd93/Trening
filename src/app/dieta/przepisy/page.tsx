"use client";

import { useMemo, useState } from "react";
import type { FoodProduct, Recipe } from "@/lib/domain/types";
import { useData, usePrefs, useProducts, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { MacroLine, ProductPicker } from "@/components/nutrition/ProductPicker";
import { MealIllustration } from "@/components/nutrition/MealIllustration";
import { Badge, Button, Card, Empty, Input, Modal, Notice, NumberInput, PageHeader, Select, Textarea } from "@/components/ui";
import { IconPlus, IconTrash } from "@/components/icons";
import { addFoodLog, deleteRecipe, saveRecipe } from "@/lib/actions/nutrition";
import { recipeTotals } from "@/lib/nutrition/recipes";
import { updateRecord } from "@/lib/data/store";
import { fmt } from "@/lib/utils/format";

interface Draft {
  id?: string;
  name: string;
  servings: number;
  final_mass_g: number | null;
  instructions: string;
  prep_minutes: number;
  favorite: boolean;
  ingredients: { product_id: string; grams: number }[];
}

const EMPTY: Draft = { name: "", servings: 2, final_mass_g: null, instructions: "", prep_minutes: 20, favorite: false, ingredients: [] };

export default function RecipesPage() {
  const data = useData();
  const products = useProducts();
  const prefs = usePrefs();
  const todayDate = useToday();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logged, setLogged] = useState<string | null>(null);
  const [meal, setMeal] = useState(0);

  const recipes = useMemo(() => Object.values(data.recipes).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "pl")), [data.recipes]);
  const ingsOf = (id: string) => Object.values(data.recipe_ingredients).filter((i) => i.recipe_id === id).sort((a, b) => a.order_index - b.order_index);
  const totals = draft ? recipeTotals(draft.ingredients, products, draft.servings, draft.final_mass_g) : null;

  function edit(r: Recipe) {
    setDraft({ id: r.id, name: r.name, servings: r.servings, final_mass_g: r.final_mass_g, instructions: r.instructions, prep_minutes: r.prep_minutes, favorite: r.favorite, ingredients: ingsOf(r.id).map((i) => ({ product_id: i.product_id, grams: i.grams })) });
    setErr(null);
  }

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setErr("Podaj nazwę przepisu.");
    if (!draft.ingredients.length) return setErr("Dodaj co najmniej jeden składnik.");
    if (draft.servings < 1) return setErr("Liczba porcji musi wynosić co najmniej 1.");
    saveRecipe({ id: draft.id, name: draft.name.trim(), servings: draft.servings, final_mass_g: draft.final_mass_g, instructions: draft.instructions, tags: [], prep_minutes: draft.prep_minutes, favorite: draft.favorite }, draft.ingredients);
    setDraft(null);
  }

  return (
    <>
      <PageHeader
        title="Przepisy"
        subtitle="Własne dania z automatycznym przeliczeniem wartości"
        action={
          <Button variant="primary" onClick={() => (setDraft({ ...EMPTY }), setErr(null))}>
            <IconPlus width={18} height={18} /> Nowy przepis
          </Button>
        }
      />
      <DietNav />
      {logged && <Notice tone="ok">{logged}</Notice>}
      {recipes.length === 0 ? (
        <Empty title="Brak przepisów">Utwórz przepis z dowolnych produktów — aplikacja policzy kalorie i makro na 100 g i na porcję.</Empty>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {recipes.map((r) => {
            const ings = ingsOf(r.id);
            const t = recipeTotals(ings, products, r.servings, r.final_mass_g);
            const recipeProduct = products[`recipe:${r.id}`];
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex gap-3">
                  <MealIllustration ingredients={ings.map((i) => ({ product_id: i.product_id, grams: i.grams, role: "fixed" }))} products={products} size={72} title={r.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{r.name}</h3>
                      <button onClick={() => updateRecord("recipes", r.id, { favorite: !r.favorite })} aria-pressed={r.favorite} aria-label={r.favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"} className={r.favorite ? "text-warn" : "text-muted"}>
                        {r.favorite ? "★" : "☆"}
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {r.servings} porcje · {fmt(t.serving_g)} g/porcję · {r.prep_minutes} min
                    </div>
                    <div className="mt-1 text-xs">
                      Porcja: <MacroLine kcal={t.perServing.kcal} p={t.perServing.protein_g} f={t.perServing.fat_g} c={t.perServing.carbs_g} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!recipeProduct}
                    onClick={() => {
                      addFoodLog(todayDate, meal, recipeProduct!, 1, "porcja");
                      setLogged(`Dodano 1 porcję „${r.name}” do dziennika (${prefs?.meal_names[meal] ?? "posiłek"}).`);
                    }}
                  >
                    + Porcja do dziennika
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => edit(r)}>
                    Edytuj
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteRecipe(r.id)} aria-label={`Usuń przepis ${r.name}`}>
                    <IconTrash width={16} height={16} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {recipes.length > 0 && prefs && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          Dodawaj do posiłku:
          <Select aria-label="Posiłek dla szybkiego dodawania" value={meal} onChange={(e) => setMeal(Number(e.target.value))} className="w-auto">
            {prefs.meal_names.map((n, i) => (
              <option key={i} value={i}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edytuj przepis" : "Nowy przepis"} wide>
        {draft && totals && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Input label="Nazwa" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="sm:col-span-2" />
              <NumberInput label="Liczba porcji" value={draft.servings} min={1} onChange={(v) => setDraft({ ...draft, servings: Math.max(1, Math.round(v ?? 1)) })} />
              <NumberInput label="Czas" suffix="min" value={draft.prep_minutes} onChange={(v) => setDraft({ ...draft, prep_minutes: v ?? 0 })} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Składniki</h3>
                <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
                  <IconPlus width={16} height={16} /> Dodaj składnik
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {draft.ingredients.map((i, idx) => {
                  const p = products[i.product_id];
                  return (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? "?"}</span>
                      <NumberInput ariaLabel={`Masa: ${p?.name}`} value={i.grams} suffix="g" className="w-28" onChange={(v) => setDraft({ ...draft, ingredients: draft.ingredients.map((x, k) => (k === idx ? { ...x, grams: v ?? 0 } : x)) })} />
                      <span className="w-20 text-right text-xs tabular-nums text-muted">{p ? `${fmt((p.kcal * i.grams) / 100 / (p.basis === "ml" ? p.density || 1 : 1))} kcal` : ""}</span>
                      <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-bad" aria-label={`Usuń składnik ${p?.name}`} onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, k) => k !== idx) })}>
                        <IconTrash width={16} height={16} />
                      </button>
                    </li>
                  );
                })}
                {!draft.ingredients.length && <li className="text-sm text-muted">Brak składników.</li>}
              </ul>
            </div>
            <NumberInput
              label="Masa gotowej potrawy (opcjonalnie)"
              suffix="g"
              value={draft.final_mass_g}
              onChange={(v) => setDraft({ ...draft, final_mass_g: v })}
              hint={`Suma surowych składników: ${fmt(totals.raw_mass_g)} g. Zważ garnek z potrawą minus garnek — wartości na 100 g uwzględnią odparowanie wody.`}
            />
            <div className="grid gap-2 rounded-xl bg-surface-2 p-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted">Całość ({fmt(totals.final_mass_g)} g)</div>
                <MacroLine kcal={totals.total.kcal} p={totals.total.protein_g} f={totals.total.fat_g} c={totals.total.carbs_g} />
              </div>
              <div>
                <div className="text-xs text-muted">Na 100 g</div>
                <MacroLine kcal={totals.per100.kcal} p={totals.per100.protein_g} f={totals.per100.fat_g} c={totals.per100.carbs_g} />
              </div>
              <div>
                <div className="text-xs text-muted">Na porcję ({fmt(totals.serving_g)} g)</div>
                <MacroLine kcal={totals.perServing.kcal} p={totals.perServing.protein_g} f={totals.perServing.fat_g} c={totals.perServing.carbs_g} />
              </div>
            </div>
            <Textarea label="Sposób przygotowania" value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--olive)]" checked={draft.favorite} onChange={(e) => setDraft({ ...draft, favorite: e.target.checked })} /> Ulubiony
            </label>
            {err && <Notice tone="bad">{err}</Notice>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={save}>
                Zapisz przepis
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Anuluj
              </Button>
            </div>
            {draft.ingredients.some((i) => products[i.product_id]?.source.includes("USDA")) && <Badge>Część wartości: generyczne dane referencyjne (USDA/IŻŻ)</Badge>}
          </div>
        )}
      </Modal>

      <Modal open={picking} onClose={() => setPicking(false)} title="Dodaj składnik">
        <ProductPicker
          onPick={(p: FoodProduct) => {
            if (p.id.startsWith("recipe:")) return;
            setDraft((d) => (d ? { ...d, ingredients: [...d.ingredients, { product_id: p.id, grams: p.piece_g && p.piece_g >= 30 ? p.piece_g : 100 }] } : d));
            setPicking(false);
          }}
        />
      </Modal>
    </>
  );
}
