"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useData } from "@/lib/hooks";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { sessionVolume } from "@/lib/analytics/analytics";
import { formatDateFull, formatDuration, formatTime } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";

export default function HistoryPage() {
  const data = useData();
  const sessions = useMemo(
    () => Object.values(data.workout_sessions).filter((s) => s.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [data.workout_sessions],
  );
  const sets = Object.values(data.exercise_sets);
  return (
    <>
      <Link href="/trening" className="text-sm text-muted hover:text-fg">
        ← Trening
      </Link>
      <PageHeader title="Historia sesji" subtitle={`Ukończone treningi: ${sessions.length}`} />
      {sessions.length === 0 ? (
        <Empty title="Brak ukończonych treningów">Po zakończeniu pierwszego treningu pojawi się tutaj z czasem, objętością i notatkami.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const prog = data.training_programs[s.program_id];
            return (
              <li key={s.id}>
                <Link href={`/trening/sesja/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-olive/60">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted">
                      {formatDateFull(s.completed_at!.slice(0, 10))}, {formatTime(s.completed_at!)} · {prog?.name ?? ""} · tydzień {s.week}
                    </div>
                    {s.notes && <div className="mt-1 line-clamp-2 text-xs text-muted">„{s.notes}”</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge>{formatDuration(s.duration_sec ?? 0)}</Badge>
                    <Badge>{fmt(sessionVolume(s.id, sets))} kg objętości</Badge>
                    {s.session_rpe !== null && <Badge tone="olive">sRPE {s.session_rpe}</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
