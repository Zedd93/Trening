"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EXERCISES, MUSCLE_GROUP_LABELS, isAvailable, type Category, type MuscleGroup } from "@/lib/training/exercises";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { Badge, Input, PageHeader, Select } from "@/components/ui";
import { useProfile } from "@/lib/hooks";

const CATEGORY_LABELS: Record<Category, string> = {
  main: "Główne",
  accessory: "Akcesoria",
  core: "Core",
  carry: "Noszenie / chwyt",
  power: "Moc",
  conditioning: "Kondycja",
  warmup: "Rozgrzewka",
  cooldown: "Schłodzenie",
};

export default function ExerciseLibrary() {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"" | Category>("");
  const [group, setGroup] = useState<"" | MuscleGroup>("");
  const list = useMemo(
    () =>
      EXERCISES.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!cat || e.category === cat) && (!group || (e.volume[group] ?? 0) > 0)),
    [q, cat, group],
  );
  return (
    <>
      <Link href="/trening" className="text-sm text-muted hover:text-fg">
        ← Trening
      </Link>
      <PageHeader title="Biblioteka ćwiczeń" subtitle={`${EXERCISES.length} ćwiczeń, każde z dedykowaną animowaną demonstracją`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input aria-label="Szukaj ćwiczenia" placeholder="Szukaj…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Kategoria" value={cat} onChange={(e) => setCat(e.target.value as Category | "")}>
          <option value="">Wszystkie kategorie</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Grupa mięśniowa" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup | "")}>
          <option value="">Wszystkie partie</option>
          {Object.entries(MUSCLE_GROUP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => {
          const avail = profile ? isAvailable(e, profile.equipment, profile.injuries.map((i) => i.area)) : true;
          return (
            <li key={e.id}>
              <Link href={`/trening/cwiczenia/${e.id}`} className="flex h-full gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-olive/60">
                <ExerciseAnimation exerciseId={e.id} size="sm" autoPlay={false} initialPhase={0.45} />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">{e.name}</div>
                  <div className="mt-1 text-xs text-muted">{e.muscles_primary.join(", ")}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge>{CATEGORY_LABELS[e.category]}</Badge>
                    {!avail && <Badge tone="warn">niedostępne dla Ciebie</Badge>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
