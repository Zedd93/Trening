"use client";

import { useMemo, useState } from "react";
import type { MealPlanEntry } from "@/lib/domain/types";
import { useData, usePrefs, useProducts, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { MealIllustration } from "@/components/nutrition/MealIllustration";
import { MacroLine } from "@/components/nutrition/ProductPicker";
import { Badge, Button, Card, Empty, Input, Modal, Notice, NumberInput, PageHeader, Segmented, cx } from "@/components/ui";
import { IconLock, IconSwap, IconUnlock } from "@/components/icons";
import { activeMealPlan, generateMealPlan, logPlanEntry, plannerPrefs, replaceIngredient, replaceMeal, toggleLock, updateIngredientGrams } from "@/lib/actions/nutrition";
import { ingredientSwaps, mealSwaps } from "@/lib/nutrition/planner";
import { slotLayout } from "@/lib/nutrition/meals";
import { getTarget } from "@/lib/selectors";
import { formatDateShort, WEEKDAYS_SHORT, weekdayIndex } from "@/lib/utils/dates";
import { fmt, sum } from "@/lib/utils/format";
import { toCSV, downloadText } from "@/lib/utils/csv";

export default function MealPlanPage() {
  const data = useData();
  const prefs = usePrefs();
  const products = useProducts();
  const todayDate = useToday();
  const [range, setRange] = useState<"1" | "7" | "28">("7");
  const [start, setStart] = useState(todayDate);
  const [day, setDay] = useState(todayDate);
  const [result, setResult] = useState<{ warnings: string[]; excluded: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [swapMeal, setSwapMeal] = useState<MealPlanEntry | null>(null);
  const [swapIng, setSwapIng] = useState<{ entry: MealPlanEntry; index: number } | null>(null);

  const plan = activeMealPlan();
  const entries = useMemo(() => Object.values(data.meal_plan_entries).filter((e) => !plan || e.plan_id === plan.id), [data.meal_plan_entries, plan]);
  const dates = useMemo(() => Array.from(new Set(entries.map((e) => e.date))).sort(), [entries]);
  const dayEntries = entries.filter((e) => e.date === day).sort((a, b) => a.slot_index - b.slot_index);
  const target = getTarget(data, day);
  const dayTarget = target ? (target.calorie_mode === "cycling" && dayEntries[0] ? target.day_targets[dayEntries[0].day_type] : target) : null;

  function generate() {
    setErr(null);
    try {
      const r = generateMealPlan(start, Number(range));
      setResult({ warnings: r.warnings, excluded: r.excluded_templates.length });
      setDay(start);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function exportCsv() {
    const rows = entries
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot_index - b.slot_index)
      .flatMap((e) =>
        e.ingredients.map((i) => ({
          data: e.date,
          posilek: e.slot_name,
          danie: e.title,
          skladnik: products[i.product_id]?.name ?? i.product_id,
          gramy: i.grams,
          kcal_posilku: e.kcal,
          bialko_g: e.protein_g,
          tluszcz_g: e.fat_g,
          wegle_g: e.carbs_g,
        })),
      );
    downloadText(`jadlospis-${dates[0] ?? todayDate}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }

  const totals = { kcal: sum(dayEntries.map((e) => e.kcal)), p: sum(dayEntries.map((e) => e.protein_g)), f: sum(dayEntries.map((e) => e.fat_g)), c: sum(dayEntries.map((e) => e.carbs_g)) };

  return (
    <>
      <PageHeader title="Jadłospis" subtitle="Automatycznie dopasowany do kalorii, makro, typu dnia i Twoich ograniczeń" />
      <DietNav />

      <Card title="Generator">
        <div className="flex flex-wrap items-end gap-3">
          <Segmented
            ariaLabel="Zakres"
            value={range}
            onChange={setRange}
            options={[
              { value: "1", label: "1 dzień" },
              { value: "7", label: "7 dni" },
              { value: "28", label: "4 tygodnie" },
            ]}
          />
          <Input label="Od dnia" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-auto" />
          <Button variant="primary" onClick={generate}>
            {entries.length ? "Generuj ponownie" : "Generuj jadłospis"}
          </Button>
          {entries.length > 0 && (
            <>
              <Button variant="outline" onClick={exportCsv}>
                Eksport CSV
              </Button>
              <Button variant="ghost" onClick={() => window.print()}>
                Drukuj
              </Button>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Ponowne generowanie zachowuje posiłki oznaczone kłódką. Uwzględniane są: alergie i wykluczenia, styl żywienia ({prefs?.diet_style}), maks. czas przygotowania ({prefs?.max_prep_minutes} min), budżet, ulubione produkty, powtarzalność i gotowanie na zapas.
        </p>
        {err && <Notice tone="bad">{err}</Notice>}
        {result && (
          <div className="mt-3 flex flex-col gap-2">
            <Notice tone="ok">Jadłospis gotowy.{result.excluded ? ` Pominięto ${result.excluded} szablonów niezgodnych z Twoimi ograniczeniami.` : ""}</Notice>
            {result.warnings.slice(0, 5).map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
          </div>
        )}
      </Card>

      {dates.length === 0 ? (
        <div className="mt-4">
          <Empty title="Brak jadłospisu">Wybierz zakres i kliknij „Generuj jadłospis”.</Empty>
        </div>
      ) : (
        <>
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1.5" role="tablist" aria-label="Dni jadłospisu">
              {dates.map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={d === day}
                  onClick={() => setDay(d)}
                  className={cx("flex h-14 w-14 flex-col items-center justify-center rounded-xl border text-xs", d === day ? "border-olive bg-olive-dim text-olive-strong" : "border-line bg-surface", d === todayDate && d !== day && "border-olive/50")}
                >
                  <span>{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
                  <span className="font-semibold">{formatDateShort(d)}</span>
                </button>
              ))}
            </div>
          </div>

          {dayTarget && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={Math.abs(totals.kcal - dayTarget.kcal) / dayTarget.kcal < 0.05 ? "ok" : "warn"}>
                {fmt(totals.kcal)} / {dayTarget.kcal} kcal
              </Badge>
              <Badge>
                B {fmt(totals.p)} / {dayTarget.protein_g} g
              </Badge>
              <Badge>
                T {fmt(totals.f)} / {dayTarget.fat_g} g
              </Badge>
              <Badge>
                W {fmt(totals.c)} / {dayTarget.carbs_g} g
              </Badge>
              {dayEntries[0] && <Badge tone="olive">{dayEntries[0].day_type === "gym" ? "dzień treningowy" : dayEntries[0].day_type === "sport" ? "dzień sportu" : "dzień odpoczynku"}</Badge>}
            </div>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {dayEntries.map((e) => (
              <MealCard key={e.id} entry={e} onSwapMeal={() => setSwapMeal(e)} onSwapIng={(index) => setSwapIng({ entry: e, index })} />
            ))}
          </div>
        </>
      )}

      {swapMeal && prefs && (
        <Modal open onClose={() => setSwapMeal(null)} title={`Zamień: ${swapMeal.title}`} wide>
          <p className="mb-3 text-sm text-muted">Propozycje o zbliżonych kaloriach i makro (gramatury przeliczone), zgodne z alergiami i wykluczeniami.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {mealSwaps(swapMeal, slotLayout(prefs.meals_per_day)[swapMeal.slot_index]?.type ?? "lunch", products, plannerPrefs(prefs)).map((s) => (
              <li key={s.template.id} className="flex gap-3 rounded-xl border border-line p-3">
                <MealIllustration ingredients={s.ingredients} products={products} size={64} title={s.template.name} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight">{s.template.name}</div>
                  <div className="text-xs text-muted">
                    <MacroLine kcal={s.macros.kcal} p={s.macros.protein_g} f={s.macros.fat_g} c={s.macros.carbs_g} />
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-2"
                    onClick={() => {
                      replaceMeal(swapMeal.id, s.template.id, s.ingredients);
                      setSwapMeal(null);
                    }}
                  >
                    Wybierz
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {swapIng && prefs && (
        <Modal open onClose={() => setSwapIng(null)} title={`Zamień składnik: ${products[swapIng.entry.ingredients[swapIng.index].product_id]?.name}`}>
          <ul className="flex flex-col gap-2">
            {ingredientSwaps(swapIng.entry.ingredients[swapIng.index].product_id, swapIng.entry.ingredients[swapIng.index].grams, products, plannerPrefs(prefs)).map((s) => (
              <li key={s.product.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div>
                  <div>
                    {s.product.name} — <strong>{s.grams} g</strong>
                  </div>
                  <div className="text-xs text-muted">
                    {s.basis} · <MacroLine kcal={s.macros.kcal} p={s.macros.protein_g} f={s.macros.fat_g} c={s.macros.carbs_g} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    replaceIngredient(swapIng.entry.id, swapIng.index, s.product.id, s.grams);
                    setSwapIng(null);
                  }}
                >
                  Zamień
                </Button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}

function MealCard({ entry, onSwapMeal, onSwapIng }: { entry: MealPlanEntry; onSwapMeal: () => void; onSwapIng: (i: number) => void }) {
  const products = useProducts();
  const [open, setOpen] = useState(false);
  const [logged, setLogged] = useState(false);
  return (
    <article className={cx("rounded-2xl border bg-surface p-4", entry.locked ? "border-olive/60" : "border-line")}>
      <div className="flex gap-3">
        <MealIllustration ingredients={entry.ingredients} products={products} title={entry.title} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-olive-strong">{entry.slot_name}</div>
          <h3 className="font-semibold leading-tight">{entry.title}</h3>
          <div className="mt-1 text-xs text-muted">
            <MacroLine kcal={entry.kcal} p={entry.protein_g} f={entry.fat_g} c={entry.carbs_g} /> · {entry.prep_minutes} min
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={() => toggleLock(entry.id)} className={cx("inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs", entry.locked ? "bg-olive-dim text-olive-strong" : "bg-surface-2 text-muted")} aria-pressed={entry.locked}>
              {entry.locked ? <IconLock width={14} height={14} /> : <IconUnlock width={14} height={14} />}
              {entry.locked ? "Zablokowany" : "Zablokuj"}
            </button>
            <button onClick={onSwapMeal} className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-2 px-2 text-xs text-muted hover:text-fg">
              <IconSwap width={14} height={14} /> Zamień
            </button>
            <button
              onClick={() => {
                logPlanEntry(entry, entry.slot_index, entry.date);
                setLogged(true);
              }}
              disabled={logged}
              className="inline-flex h-8 items-center rounded-lg bg-surface-2 px-2 text-xs text-muted hover:text-fg disabled:opacity-50"
            >
              {logged ? "Dodano ✓" : "Do dziennika"}
            </button>
          </div>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {entry.ingredients.map((i, idx) => {
          const p = products[i.product_id];
          return (
            <li key={idx} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{p?.name ?? i.product_id}</span>
              <NumberInput ariaLabel={`Gramatura: ${p?.name}`} value={i.grams} onChange={(v) => v && v > 0 && updateIngredientGrams(entry.id, idx, v)} suffix="g" className="w-24" />
              <button onClick={() => onSwapIng(idx)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label={`Zamień składnik: ${p?.name}`}>
                <IconSwap width={16} height={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <button className="mt-2 text-sm text-olive-strong" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Ukryj przygotowanie" : "Przygotowanie"}
      </button>
      {open && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          {entry.instructions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
    </article>
  );
}

