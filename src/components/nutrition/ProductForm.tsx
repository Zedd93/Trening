"use client";

import { useState } from "react";
import type { Allergen, FoodCategory, FoodProduct } from "@/lib/domain/types";
import { saveProduct } from "@/lib/actions/nutrition";
import { ALLERGEN_LABELS, CATEGORY_LABELS } from "@/lib/nutrition/foods";
import { labelConsistency } from "@/lib/nutrition/units";
import { Button, Chips, Field, Input, Notice, NumberInput, Select } from "../ui";
import { fmt } from "@/lib/utils/format";

type Init = Partial<Pick<FoodProduct, "name" | "brand" | "barcode" | "kcal" | "protein" | "fat" | "carbs" | "fiber" | "serving_g" | "allergens" | "source" | "source_ref" | "piece_g" | "category" | "basis" | "density">> & { id?: string };

/** Ręczne dodanie / edycja produktu z etykiety (wartości na 100 g lub 100 ml). */
export function ProductForm({ initial = {}, onSaved }: { initial?: Init; onSaved: (p: FoodProduct) => void }) {
  const [f, setF] = useState({
    name: initial.name ?? "",
    brand: initial.brand ?? "",
    barcode: initial.barcode ?? "",
    kcal: initial.kcal ?? null,
    protein: initial.protein ?? null,
    fat: initial.fat ?? null,
    carbs: initial.carbs ?? null,
    fiber: (initial.fiber ?? 0) as number | null,
    serving_g: initial.serving_g ?? null,
    piece_g: initial.piece_g ?? null,
    category: initial.category ?? ("other" as FoodCategory),
    basis: initial.basis ?? ("g" as "g" | "ml"),
    density: initial.density ?? 1,
    allergens: initial.allergens ?? ([] as Allergen[]),
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const complete = f.name.trim() && f.kcal !== null && f.protein !== null && f.fat !== null && f.carbs !== null;
  const check = complete ? labelConsistency({ kcal: f.kcal!, protein: f.protein!, fat: f.fat!, carbs: f.carbs!, fiber: f.fiber ?? 0 }) : null;

  function submit() {
    if (!complete) {
      setErr("Podaj nazwę oraz kalorie, białko, tłuszcz i węglowodany z etykiety (na 100 g/ml).");
      return;
    }
    if ([f.kcal!, f.protein!, f.fat!, f.carbs!].some((v) => v < 0) || f.protein! + f.fat! + f.carbs! > 101) {
      setErr("Wartości są niepoprawne — suma makroskładników nie może przekraczać 100 g na 100 g.");
      return;
    }
    const saved = saveProduct({
      id: initial.id,
      name: f.name.trim(),
      brand: f.brand.trim(),
      barcode: f.barcode || null,
      kcal: f.kcal!,
      protein: f.protein!,
      fat: f.fat!,
      carbs: f.carbs!,
      fiber: f.fiber ?? 0,
      basis: f.basis,
      density: f.density || 1,
      piece_g: f.piece_g,
      piece_name: f.piece_g ? "sztuka" : null,
      serving_g: f.serving_g,
      category: f.category,
      allergens: f.allergens,
      tags: ["custom"],
      source: initial.source ?? "Etykieta produktu — wprowadzone przez użytkownika",
      source_ref: initial.source_ref ?? null,
      price_per_kg: null,
      cooked_ratio: null,
    });
    onSaved(saved);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nazwa" value={f.name} onChange={(e) => set({ name: e.target.value })} />
        <Input label="Marka (opcjonalnie)" value={f.brand} onChange={(e) => set({ brand: e.target.value })} />
        <Select label="Wartości podane na" value={f.basis} onChange={(e) => set({ basis: e.target.value as "g" | "ml" })}>
          <option value="g">100 g</option>
          <option value="ml">100 ml</option>
        </Select>
        <Select label="Kategoria" value={f.category} onChange={(e) => set({ category: e.target.value as FoodCategory })}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <NumberInput label="Energia" suffix="kcal" value={f.kcal} onChange={(v) => set({ kcal: v })} />
        <NumberInput label="Białko" suffix="g" step={0.1} value={f.protein} onChange={(v) => set({ protein: v })} />
        <NumberInput label="Tłuszcz" suffix="g" step={0.1} value={f.fat} onChange={(v) => set({ fat: v })} />
        <NumberInput label="Węglowodany" suffix="g" step={0.1} value={f.carbs} onChange={(v) => set({ carbs: v })} />
        <NumberInput label="Błonnik" suffix="g" step={0.1} value={f.fiber} onChange={(v) => set({ fiber: v })} />
        <NumberInput label="Porcja (opcjonalnie)" suffix="g" value={f.serving_g} onChange={(v) => set({ serving_g: v })} />
        <NumberInput label="Masa 1 sztuki (opcjonalnie)" suffix="g" value={f.piece_g} onChange={(v) => set({ piece_g: v })} />
        {f.basis === "ml" && <NumberInput label="Gęstość" suffix="g/ml" step={0.01} value={f.density} onChange={(v) => set({ density: v ?? 1 })} />}
        <Input label="Kod kreskowy (opcjonalnie)" inputMode="numeric" value={f.barcode} onChange={(e) => set({ barcode: e.target.value.replace(/\D/g, "") })} />
      </div>
      <Field label="Alergeny">
        <Chips<Allergen> multiple value={f.allergens} onChange={(v) => set({ allergens: v })} options={(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((k) => ({ value: k, label: ALLERGEN_LABELS[k] }))} />
      </Field>
      {check && !check.ok && (
        <Notice tone="warn">
          Kontrola etykiety: z makroskładników wynika ok. {fmt(check.computed)} kcal, a podano {fmt(f.kcal ?? 0)} kcal. Sprawdź, czy wartości są przepisane poprawnie (możesz zapisać mimo to).
        </Notice>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
      <Button variant="primary" onClick={submit}>
        Zapisz produkt
      </Button>
    </div>
  );
}
