"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FoodLogEntry, FoodProduct, FoodUnit } from "@/lib/domain/types";
import { useData, usePrefs, useProducts, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { AmountEditor, MacroLine, ProductPicker } from "@/components/nutrition/ProductPicker";
import { Hydration } from "@/components/nutrition/Hydration";
import { Badge, Button, Card, Empty, Input, Modal, Notice, PageHeader, Progress, Select } from "@/components/ui";
import { IconChevron, IconChevronLeft, IconPlus, IconSwap, IconTrash } from "@/components/icons";
import { addDays, formatDateLong, type ISODate } from "@/lib/utils/dates";
import { fmt, sum } from "@/lib/utils/format";
import { addFoodLog, copyDayLog, deleteFoodLog, logPlanEntry, plannerPrefs, updateFoodLog } from "@/lib/actions/nutrition";
import { dayTypeOn, getTarget } from "@/lib/selectors";
import { ingredientSwaps } from "@/lib/nutrition/planner";
import { toGrams } from "@/lib/nutrition/units";

const DAY_TYPE_LABEL = { gym: "dzień siłowni", sport: "dzień sportu", rest: "dzień odpoczynku" } as const;

function DiaryInner() {
  const params = useSearchParams();
  const todayDate = useToday();
  const [date, setDate] = useState<ISODate>(params.get("data") ?? todayDate);
  const data = useData();
  const prefs = usePrefs();
  const products = useProducts();
  const [adding, setAdding] = useState<number | null>(params.get("dodaj") ? 0 : null);
  const [picked, setPicked] = useState<FoodProduct | null>(null);
  const [amount, setAmount] = useState<number | null>(100);
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [swapFor, setSwapFor] = useState<FoodLogEntry | null>(null);

  const entries = useMemo(() => Object.values(data.food_log_entries).filter((e) => e.date === date).sort((a, b) => a.created_at.localeCompare(b.created_at)), [data.food_log_entries, date]);
  const target = getTarget(data, date);
  const dayType = dayTypeOn(data, date);
  const dayTarget = target ? (target.calorie_mode === "cycling" ? target.day_targets[dayType] : target) : null;
  const totals = {
    kcal: sum(entries.map((e) => e.kcal)),
    p: sum(entries.map((e) => e.protein_g)),
    f: sum(entries.map((e) => e.fat_g)),
    c: sum(entries.map((e) => e.carbs_g)),
    fib: sum(entries.map((e) => e.fiber_g)),
  };
  const mealNames = prefs?.meal_names ?? ["Śniadanie", "Obiad", "Kolacja"];
  const extraIdx = mealNames.length; // „Dodatkowe przekąski”
  const planEntries = Object.values(data.meal_plan_entries).filter((e) => e.date === date);

  function openAdd(meal: number) {
    setAdding(meal);
    setPicked(null);
    setAmount(100);
    setUnit("g");
  }
  function pick(p: FoodProduct) {
    setPicked(p);
    if (p.serving_g) {
      setAmount(1);
      setUnit("porcja");
    } else if (p.piece_g && p.piece_g >= 30) {
      setAmount(1);
      setUnit("szt");
    } else {
      setAmount(100);
      setUnit(p.basis === "ml" ? "ml" : "g");
    }
  }

  return (
    <>
      <PageHeader title="Dieta" subtitle="SEAL Nutrition — dziennik, cele, jadłospis" />
      <DietNav />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setDate(addDays(date, -1))} aria-label="Poprzedni dzień">
          <IconChevronLeft width={18} height={18} />
        </Button>
        <div className="w-40">
          <Input type="date" aria-label="Data" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setDate(addDays(date, 1))} aria-label="Następny dzień">
          <IconChevron width={18} height={18} />
        </Button>
        {date !== todayDate && (
          <Button size="sm" variant="ghost" onClick={() => setDate(todayDate)}>
            Dziś
          </Button>
        )}
        <span className="ml-1 text-sm text-muted">{formatDateLong(date)}</span>
        {target?.calorie_mode === "cycling" && <Badge tone="olive">{DAY_TYPE_LABEL[dayType]}</Badge>}
      </div>

      {dayTarget ? (
        <Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Spożyte</div>
              <div className="text-2xl font-bold tabular-nums">{fmt(totals.kcal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Cel</div>
              <div className="text-2xl font-bold tabular-nums">{fmt(dayTarget.kcal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Pozostało</div>
              <div className={`text-2xl font-bold tabular-nums ${dayTarget.kcal - totals.kcal < 0 ? "text-warn" : "text-ok"}`}>{fmt(dayTarget.kcal - totals.kcal)}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Progress label="Białko" value={totals.p} max={dayTarget.protein_g} showValues={`${fmt(totals.p)} / ${dayTarget.protein_g} g`} />
            <Progress label="Tłuszcz" value={totals.f} max={dayTarget.fat_g} showValues={`${fmt(totals.f)} / ${dayTarget.fat_g} g`} />
            <Progress label="Węglowodany" value={totals.c} max={dayTarget.carbs_g} showValues={`${fmt(totals.c)} / ${dayTarget.carbs_g} g`} />
            <Progress label="Błonnik" value={totals.fib} max={dayTarget.fiber_g} showValues={`${fmt(totals.fib)} / ${dayTarget.fiber_g} g`} />
          </div>
          <p className="mt-3 text-xs text-muted">Kalorie z treningu nie są doliczane — aktywność jest już uwzględniona w celu (TDEE).</p>
        </Card>
      ) : (
        <Notice tone="warn">Brak celu żywieniowego — ustaw go w zakładce „Cele i kalkulator”.</Notice>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {[...mealNames, "Dodatkowe przekąski"].map((name, i) => {
          const list = entries.filter((e) => (i === extraIdx ? e.meal_index >= extraIdx : e.meal_index === i));
          const mt = { kcal: sum(list.map((e) => e.kcal)), p: sum(list.map((e) => e.protein_g)), f: sum(list.map((e) => e.fat_g)), c: sum(list.map((e) => e.carbs_g)), g: sum(list.map((e) => e.grams)) };
          const planned = planEntries.filter((e) => e.slot_index === i);
          return (
            <Card
              key={i}
              title={name}
              subtitle={list.length ? <MacroLine kcal={mt.kcal} p={mt.p} f={mt.f} c={mt.c} className="text-xs" /> : undefined}
              action={
                <Button size="sm" variant="outline" onClick={() => openAdd(i)} aria-label={`Dodaj do: ${name}`}>
                  <IconPlus width={16} height={16} /> Dodaj
                </Button>
              }
            >
              {list.length === 0 && planned.length === 0 && <p className="text-sm text-muted">Brak wpisów.</p>}
              <ul className="flex flex-col divide-y divide-line">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(e)}>
                      <div className="truncate text-[15px]">{e.name}</div>
                      <div className="text-xs text-muted">
                        {fmt(e.amount, 2)} {e.unit === "lyzka" ? "łyżka" : e.unit === "lyzeczka" ? "łyżeczka" : e.unit} ({fmt(e.grams)} g) · <MacroLine kcal={e.kcal} p={e.protein_g} f={e.fat_g} c={e.carbs_g} />
                      </div>
                    </button>
                    {e.product_id && (
                      <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2" onClick={() => setSwapFor(e)} aria-label={`Zamień: ${e.name}`}>
                        <IconSwap width={18} height={18} />
                      </button>
                    )}
                    <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad" onClick={() => deleteFoodLog(e.id)} aria-label={`Usuń: ${e.name}`}>
                      <IconTrash width={18} height={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {planned.filter((p) => !list.some((l) => l.plan_entry_id === p.id)).map((p) => (
                <div key={p.id} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-dashed border-line p-2 text-sm">
                  <span className="min-w-0 truncate text-muted">
                    Z jadłospisu: <span className="text-fg">{p.title}</span> · {p.kcal} kcal
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => logPlanEntry(p, i, date)}>
                    Zjedzone
                  </Button>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => copyDayLog(addDays(date, -1), date)}>
          Skopiuj wpisy z poprzedniego dnia
        </Button>
      </div>

      <div className="mt-4">
        <Hydration date={date} />
      </div>

      <Modal open={adding !== null} onClose={() => setAdding(null)} title={`Dodaj: ${adding !== null ? ([...mealNames, "Dodatkowe przekąski"][adding] ?? "") : ""}`}>
        {adding !== null && !picked && <ProductPicker onPick={pick} />}
        {adding !== null && picked && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{picked.name}</div>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                Zmień
              </Button>
            </div>
            <AmountEditor
              product={picked}
              amount={amount}
              unit={unit}
              onChange={(a, u) => {
                setAmount(a);
                setUnit(u);
              }}
            />
            <Select aria-label="Posiłek" value={adding} onChange={(e) => setAdding(Number(e.target.value))}>
              {[...mealNames, "Dodatkowe przekąski"].map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              size="lg"
              disabled={!amount || amount <= 0 || toGrams(picked, amount, unit) <= 0}
              onClick={() => {
                addFoodLog(date, adding, picked, amount!, unit);
                setAdding(null);
              }}
            >
              Dodaj do dziennika
            </Button>
          </div>
        )}
      </Modal>

      {editing && <EditEntry entry={editing} products={products} mealNames={[...mealNames, "Dodatkowe przekąski"]} onClose={() => setEditing(null)} />}
      {swapFor && prefs && (
        <Modal open onClose={() => setSwapFor(null)} title={`Zamień: ${swapFor.name}`}>
          <p className="mb-3 text-sm text-muted">Zamienniki o zbliżonej wartości, z przeliczoną gramaturą — bez produktów z Twojej listy alergii i wykluczeń.</p>
          <ul className="flex flex-col gap-2">
            {ingredientSwaps(swapFor.product_id!, swapFor.grams, products, plannerPrefs(prefs)).map((s) => (
              <li key={s.product.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <div className="text-[15px]">
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
                    deleteFoodLog(swapFor.id);
                    addFoodLog(swapFor.date, swapFor.meal_index, s.product, s.grams, "g");
                    setSwapFor(null);
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

function EditEntry({ entry, products, mealNames, onClose }: { entry: FoodLogEntry; products: Record<string, FoodProduct>; mealNames: string[]; onClose: () => void }) {
  const pid = entry.recipe_id ? `recipe:${entry.recipe_id}` : entry.product_id;
  const product = pid ? products[pid] : undefined;
  const [amount, setAmount] = useState<number | null>(entry.amount);
  const [unit, setUnit] = useState<FoodUnit>(entry.unit);
  const [meal, setMeal] = useState(entry.meal_index);
  return (
    <Modal open onClose={onClose} title={`Edytuj: ${entry.name}`}>
      <div className="flex flex-col gap-4">
        {product ? (
          <AmountEditor
            product={product}
            amount={amount}
            unit={unit}
            onChange={(a, u) => {
              setAmount(a);
              setUnit(u);
            }}
          />
        ) : (
          <Input label="Liczba porcji" type="number" step={0.25} value={amount ?? ""} onChange={(e) => setAmount(Number(e.target.value) || null)} />
        )}
        <Select label="Posiłek" value={meal} onChange={(e) => setMeal(Number(e.target.value))}>
          {mealNames.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </Select>
        {!product && <Empty title="Produkt źródłowy niedostępny">Wartości zostaną przeskalowane proporcjonalnie do liczby porcji.</Empty>}
        <Button
          variant="primary"
          disabled={!amount || amount <= 0}
          onClick={() => {
            updateFoodLog(entry, amount!, unit, meal);
            onClose();
          }}
        >
          Zapisz zmiany
        </Button>
      </div>
    </Modal>
  );
}

export default function DiaryPage() {
  return (
    <Suspense>
      <DiaryInner />
    </Suspense>
  );
}
