"use client";

import { useMemo, useState } from "react";
import { addWater, removeWater } from "@/lib/actions/nutrition";
import { updatePrefs } from "@/lib/actions/profile";
import { hydrationSuggestion } from "@/lib/nutrition/calculator";
import { useData, usePrefs, useProfile } from "@/lib/hooks";
import { Button, Card, NumberInput, Progress } from "../ui";
import { IconWater } from "../icons";
import { formatTime, type ISODate } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";

export function Hydration({ date }: { date: ISODate }) {
  const data = useData();
  const prefs = usePrefs();
  const profile = useProfile();
  const [custom, setCustom] = useState<number | null>(null);
  const [editGoal, setEditGoal] = useState(false);
  const entries = useMemo(() => Object.values(data.water_entries).filter((w) => w.date === date).sort((a, b) => a.created_at.localeCompare(b.created_at)), [data.water_entries, date]);
  const total = entries.reduce((s, e) => s + e.ml, 0);
  const goal = prefs?.water_goal_ml ?? 2500;
  const sug = profile ? hydrationSuggestion(profile.weight_kg, profile.session_minutes) : null;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconWater width={18} height={18} className="text-[#5aa9e6]" /> Nawodnienie
        </span>
      }
      action={
        <Button size="sm" variant="ghost" onClick={() => setEditGoal((e) => !e)}>
          Cel
        </Button>
      }
    >
      <Progress value={total} max={goal} label="Wypito" showValues={`${fmt(total)} / ${fmt(goal)} ml`} />
      <div className="mt-3 flex flex-wrap gap-2">
        {[150, 250, 500].map((ml) => (
          <Button key={ml} size="sm" variant="outline" onClick={() => addWater(date, ml)}>
            +{ml} ml
          </Button>
        ))}
        <div className="flex items-center gap-2">
          <NumberInput ariaLabel="Własna ilość wody (ml)" value={custom} onChange={setCustom} suffix="ml" className="w-28" />
          <Button size="sm" variant="secondary" disabled={!custom} onClick={() => custom && (addWater(date, custom), setCustom(null))}>
            Dodaj
          </Button>
        </div>
      </div>
      {entries.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {entries.map((e) => (
            <li key={e.id}>
              <button className="rounded-full bg-surface-2 px-2.5 py-1 text-muted hover:text-fg" onClick={() => removeWater(e.id)} aria-label={`Usuń wpis ${e.ml} ml z ${formatTime(e.created_at)}`}>
                {formatTime(e.created_at)} · {e.ml} ml ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {editGoal && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <NumberInput label="Dzienny cel" suffix="ml" step={100} value={goal} onChange={(v) => v && updatePrefs({ water_goal_ml: v })} />
          {sug && (
            <p className="mt-2 text-xs text-muted">
              Orientacyjny punkt wyjścia: {fmt(sug.min)}–{fmt(sug.max)} ml/dzień (30–35 ml/kg + dodatek na trening). Zapotrzebowanie zależy od temperatury, potliwości, diety i stanu zdrowia — nie istnieje jedna norma dla wszystkich. Obserwuj pragnienie i kolor moczu; przy chorobach nerek lub serca ustal cel z lekarzem.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
