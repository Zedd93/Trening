"use client";

import { useMemo, useState } from "react";
import { useData, useProducts, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { Button, Card, Chips, Empty, Field, Input, Notice, NumberInput, PageHeader, Select } from "@/components/ui";
import { buildMealPrep, KITCHEN_LABELS, type KitchenTool } from "@/lib/nutrition/mealprep";
import { addDays, formatDateShort } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";
import { activeMealPlan } from "@/lib/actions/nutrition";

export default function MealPrepPage() {
  const data = useData();
  const products = useProducts();
  const todayDate = useToday();
  const [start, setStart] = useState(todayDate);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState<number | null>(90);
  const [containers, setContainers] = useState<number | null>(8);
  const [tools, setTools] = useState<KitchenTool[]>(["oven", "stove"]);
  const [show, setShow] = useState(false);
  const plan = activeMealPlan();
  const entries = useMemo(
    () => Object.values(data.meal_plan_entries).filter((e) => (!plan || e.plan_id === plan.id) && e.date >= start && e.date <= addDays(start, days - 1)),
    [data.meal_plan_entries, plan, start, days],
  );
  const result = useMemo(() => (show ? buildMealPrep({ entries, days, minutes_available: minutes ?? 60, containers: containers ?? 0, tools }, products) : null), [show, entries, days, minutes, containers, tools, products]);

  return (
    <>
      <PageHeader title="Gotowanie na zapas" subtitle="Zbiorcza instrukcja przygotowania posiłków z jadłospisu na kilka dni" />
      <DietNav />
      <Card title="Parametry">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Od dnia" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Select label="Na ile dni" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d} dni
              </option>
            ))}
          </Select>
          <NumberInput label="Dostępny czas" suffix="min" step={15} value={minutes} onChange={setMinutes} />
          <NumberInput label="Pojemniki" suffix="szt." value={containers} onChange={setContainers} />
        </div>
        <Field label="Wyposażenie kuchni">
          <Chips<KitchenTool> multiple value={tools} onChange={setTools} options={(Object.keys(KITCHEN_LABELS) as KitchenTool[]).map((k) => ({ value: k, label: KITCHEN_LABELS[k] }))} />
        </Field>
        <Button variant="primary" className="mt-4" onClick={() => setShow(true)}>
          Przygotuj plan gotowania
        </Button>
      </Card>

      {result && (
        <div className="mt-4 flex flex-col gap-4">
          {result.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          {result.meals.length === 0 ? (
            <Empty title="Brak posiłków do przygotowania" />
          ) : (
            <>
              <Card title={`Porcje do przygotowania: ${result.meals.length}`} subtitle={`Szacowany czas: ok. ${result.estimated_minutes} min (praca równoległa na kilku urządzeniach)`}>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {result.meals.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                      <span className="truncate">
                        {formatDateShort(m.date)} · {m.title}
                      </span>
                      <span className="text-muted">{m.kcal} kcal</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Składniki bazowe do ugotowania">
                <ul className="flex flex-col divide-y divide-line text-sm">
                  {result.components.map((c) => (
                    <li key={c.product_id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        <strong>{c.name}</strong> — {fmt(c.grams)} g
                      </span>
                      <span className="text-muted">{c.method}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Kolejność pracy">
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {result.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </Card>
              <Card title="Przechowywanie i bezpieczeństwo żywności">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                  {result.storage.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
