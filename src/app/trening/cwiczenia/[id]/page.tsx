"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EXERCISE_MAP, EQUIPMENT_LABELS, INJURY_LABELS } from "@/lib/training/exercises";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { TimeChart, COLORS } from "@/components/charts";
import { useData } from "@/lib/hooks";
import { strengthHistory } from "@/lib/analytics/analytics";
import { formatDateFull } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const def = EXERCISE_MAP[id];
  const data = useData();
  const history = useMemo(() => strengthHistory(id, Object.values(data.exercise_sets), data.workout_sessions), [id, data.exercise_sets, data.workout_sessions]);
  const logs = useMemo(() => {
    const sets = Object.values(data.exercise_sets).filter((s) => s.exercise_id === id && s.completed);
    const by = new Map<string, typeof sets>();
    for (const s of sets) by.set(s.session_id, [...(by.get(s.session_id) ?? []), s]);
    return [...by.entries()]
      .map(([sid, ss]) => ({ session: data.workout_sessions[sid], sets: ss.sort((a, b) => a.set_number - b.set_number) }))
      .filter((x) => x.session)
      .sort((a, b) => (b.session.completed_at ?? b.session.scheduled_date).localeCompare(a.session.completed_at ?? a.session.scheduled_date));
  }, [id, data.exercise_sets, data.workout_sessions]);

  if (!def) return <Empty title="Nie znaleziono ćwiczenia" />;
  const unit = def.load_type === "time" ? "s" : def.load_type === "distance" ? "m" : "powt.";

  return (
    <>
      <Link href="/trening/cwiczenia" className="text-sm text-muted hover:text-fg">
        ← Biblioteka ćwiczeń
      </Link>
      <PageHeader title={def.name} subtitle={def.view_note} />
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <ExerciseAnimation exerciseId={def.id} size="lg" />
        <Card title="Opis">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Mięśnie główne</dt>
              <dd>{def.muscles_primary.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Mięśnie pomocnicze</dt>
              <dd>{def.muscles_secondary.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Sprzęt</dt>
              <dd>{def.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ") || "Masa ciała"}</dd>
            </div>
            <div>
              <dt className="text-muted">Tempo</dt>
              <dd>{def.tempo}</dd>
            </div>
            {def.avoid_with.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-muted">Pomijane przy dolegliwościach</dt>
                <dd className="flex flex-wrap gap-1">
                  {def.avoid_with.map((a) => (
                    <Badge key={a} tone="warn">
                      {INJURY_LABELS[a]}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted">Tempo zapisane jako: opuszczanie – pauza na dole – podnoszenie – pauza na górze (sekundy).</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Wskazówki techniczne">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {def.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        </Card>
        <Card title="Częste błędy i alternatywy">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
            {def.mistakes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {def.alternatives.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {def.alternatives.map((a) => (
                <Link key={a} href={`/trening/cwiczenia/${a}`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-olive">
                  {EXERCISE_MAP[a]?.name}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Historia ciężarów" className="mt-4">
        {history.length > 0 && (
          <TimeChart
            ariaLabel={`Progresja: ${def.name}`}
            data={history.map((h) => ({ date: h.date, e1rm: h.e1rm, top: h.top_weight }))}
            unit="kg"
            series={[
              { key: "top", name: "Najwyższy ciężar", color: COLORS.olive, dot: true },
              { key: "e1rm", name: "Szacowane 1RM", color: COLORS.blue, dashed: true },
            ]}
          />
        )}
        {logs.length === 0 ? (
          <p className="text-sm text-muted">Brak zapisanych serii tego ćwiczenia.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-normal">Data</th>
                  <th className="py-1 pr-3 font-normal">Serie (kg × {unit} @RIR)</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.session.id} className="border-t border-line">
                    <td className="py-2 pr-3 align-top">
                      <Link href={`/trening/sesja/${l.session.id}`} className="text-olive-strong">
                        {formatDateFull((l.session.completed_at ?? l.session.scheduled_date).slice(0, 10))}
                      </Link>
                    </td>
                    <td className="py-2">{l.sets.map((s) => `${s.weight_kg ? fmt(s.weight_kg, 2) + " × " : ""}${s.reps ?? "—"}${s.rir !== null ? ` @${s.rir}` : ""}`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
