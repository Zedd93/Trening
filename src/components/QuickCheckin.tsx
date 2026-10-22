"use client";

import { useState } from "react";
import { addMeasurement, saveCheckin } from "@/lib/actions/profile";
import { useData } from "@/lib/hooks";
import { Button, Card, NumberInput, cx } from "./ui";
import type { ISODate } from "@/lib/utils/dates";

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="mb-1 text-sm">{label}</div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={value === n} onClick={() => onChange(n)} className={cx("h-10 flex-1 rounded-lg border text-sm", value === n ? "border-olive bg-olive-dim text-olive-strong" : "border-line bg-surface-2")}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Szybki pomiar masy + samopoczucie (dane do analizy regeneracji). */
export function QuickCheckin({ date }: { date: ISODate }) {
  const data = useData();
  const m = Object.values(data.body_measurements).find((x) => x.date === date);
  const c = Object.values(data.daily_checkins).find((x) => x.date === date);
  const [weight, setWeight] = useState<number | null>(m?.weight_kg ?? null);
  const [waist, setWaist] = useState<number | null>(m?.waist_cm ?? null);
  const [fatigue, setFatigue] = useState(c?.fatigue ?? 2);
  const [sleep, setSleep] = useState(c?.sleep_quality ?? 3);
  const [soreness, setSoreness] = useState(c?.soreness ?? 2);
  const [steps, setSteps] = useState<number | null>(c?.steps ?? null);
  const [saved, setSaved] = useState(false);
  return (
    <Card title="Dzisiejszy pomiar i samopoczucie" subtitle="Ważenie najlepiej rano, po toalecie, przed jedzeniem">
      <div className="grid grid-cols-3 gap-3">
        <NumberInput label="Masa ciała" suffix="kg" step={0.1} value={weight} onChange={setWeight} />
        <NumberInput label="Obwód pasa" suffix="cm" step={0.5} value={waist} onChange={setWaist} />
        <NumberInput label="Kroki" step={500} value={steps} onChange={setSteps} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Scale label="Zmęczenie" value={fatigue} onChange={setFatigue} low="brak" high="bardzo duże" />
        <Scale label="Jakość snu" value={sleep} onChange={setSleep} low="słaba" high="bardzo dobra" />
        <Scale label="Bolesność mięśni" value={soreness} onChange={setSoreness} low="brak" high="silna" />
      </div>
      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() => {
          if (weight !== null || waist !== null) addMeasurement(date, weight, waist);
          saveCheckin(date, { fatigue, sleep_quality: sleep, soreness, steps, note: "" });
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
      >
        {saved ? "Zapisano ✓" : "Zapisz"}
      </Button>
    </Card>
  );
}
