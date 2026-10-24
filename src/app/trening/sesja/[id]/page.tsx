"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ExerciseSet, ProgressionRecommendation } from "@/lib/domain/types";
import { useData, useNow } from "@/lib/hooks";
import { sessionExercises } from "@/lib/selectors";
import { finishSession, pauseSession, reopenSession, resumeSession, startSession, updateSessionNotes, acceptRecommendation } from "@/lib/actions/training";
import { sessionElapsedSec } from "@/lib/training/schedule";
import { WEEK_PHASES } from "@/lib/training/generator";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import { ExerciseCard } from "@/components/training/ExerciseCard";
import { RestTimer } from "@/components/training/RestTimer";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { Badge, Button, Card, Empty, Modal, Notice, Textarea, cx } from "@/components/ui";
import { BLOCK_LABELS, ACTION_LABELS } from "@/lib/labels";
import { formatDateLong, formatDuration } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";
import { IconPause, IconPlay } from "@/components/icons";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useData();
  const session = data.workout_sessions[id];
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [summary, setSummary] = useState<ProgressionRecommendation[] | null>(null);
  const now = useNow(1000, session?.status === "in_progress");

  const exercises = useMemo(() => (session ? sessionExercises(data, session.id) : []), [data, session]);
  const allSets = useMemo(() => Object.values(data.exercise_sets), [data.exercise_sets]);
  const historyFor = useMemo(() => {
    const map = new Map<string, { date: string; sets: ExerciseSet[] }[]>();
    for (const we of exercises) {
      const bySession = new Map<string, ExerciseSet[]>();
      for (const s of allSets) if (s.exercise_id === we.exercise_id && s.session_id !== id) bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s]);
      const rows = [...bySession.entries()]
        .map(([sid, sets]) => ({ date: (data.workout_sessions[sid]?.completed_at ?? data.workout_sessions[sid]?.scheduled_date ?? "").slice(0, 10), sets: sets.sort((a, b) => a.set_number - b.set_number) }))
        .filter((r) => r.date)
        .sort((a, b) => b.date.localeCompare(a.date));
      map.set(we.id, rows);
    }
    return map;
  }, [exercises, allSets, id, data.workout_sessions]);

  if (!session) return <Empty title="Nie znaleziono treningu">Mógł zostać usunięty wraz z cyklem.</Empty>;

  const editable = session.status !== "skipped";
  const elapsed = sessionElapsedSec(session, now);
  const blocks = Array.from(new Set(exercises.map((e) => e.block)));
  const totalSets = exercises.filter((e) => e.block !== "conditioning").reduce((s, e) => s + e.sets, 0);
  const doneSets = allSets.filter((s) => s.session_id === id && s.completed && exercises.find((e) => e.id === s.workout_exercise_id)?.block !== "conditioning").length;

  function doFinish() {
    updateSessionNotes(session.id, notes);
    const recs = finishSession(session.id, rpe, notes);
    setFinishOpen(false);
    setSummary(recs);
  }

  const progressOf = (weId: string, setsPlanned: number, cardio: boolean) => {
    const done = allSets.filter((x) => x.workout_exercise_id === weId && x.completed).length;
    return Math.min(1, done / Math.max(1, cardio ? 1 : setsPlanned));
  };
  const currentId = session.status === "completed" ? null : exercises.find((e) => progressOf(e.id, e.sets, e.block === "conditioning") < 1)?.id ?? null;
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  let idx = 0;

  const drill = (list: typeof session.warmup, title: string, eyebrow: string) => (
    <details className="hud group rounded-2xl" open={session.status !== "completed"}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="font-display text-xl font-bold uppercase leading-none tracking-wide">{title}</h2>
        </div>
        <span className="font-mono text-xs text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="scrollbar-none -mt-1 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
        {list.map((w) => (
          <li key={w.exercise_id} className="w-36 shrink-0 snap-start rounded-xl border border-line bg-bg/50 p-2">
            <ExerciseAnimation exerciseId={w.exercise_id} size="sm" className="mx-auto" />
            <div className="mt-2 text-[13px] font-semibold leading-tight">{EXERCISE_MAP[w.exercise_id]?.name}</div>
            <div className="mt-0.5 font-mono text-[11px] text-olive-strong">{w.prescription}</div>
          </li>
        ))}
      </ul>
    </details>
  );

  return (
    <div className="pb-24">
      <Link href="/trening" className="font-mono text-xs uppercase tracking-wider text-muted hover:text-fg">
        ← Kalendarz treningów
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow text-olive-strong">
            Tydzień {session.week} · {formatDateLong(session.scheduled_date)}
          </div>
          <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-wide sm:text-5xl">{session.title}</h1>
          <p className="mt-2 text-sm text-muted">{session.focus}</p>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "completed" && <Badge tone="ok">Ukończony</Badge>}
          {session.status === "skipped" && <Badge tone="warn">Pominięty</Badge>}
          {session.status === "in_progress" && <Badge tone="olive">W trakcie</Badge>}
        </div>
      </div>

      {/* Pasek stanu sesji */}
      <div className="sticky top-14 z-20 -mx-4 mt-5 border-y border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border md:top-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="eyebrow">Czas</div>
            <div className={cx("font-data text-[28px] font-semibold leading-none", session.status === "in_progress" && !session.paused_at && "text-olive-strong")} role="timer" aria-live="off">
              {formatDuration(session.status === "completed" ? (session.duration_sec ?? 0) : elapsed)}
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 sm:block">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Postęp</span>
              <span className="font-data text-xs">
                {doneSets}/{totalSets} serii · {pct}%
              </span>
            </div>
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {exercises.map((e) => (
                <div key={e.id} className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface-3">
                  <div className={cx("bar-fill h-full", e.id === currentId ? "bg-olive-strong" : "bg-ok")} style={{ width: `${progressOf(e.id, e.sets, e.block === "conditioning") * 100}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="font-data text-sm text-muted sm:hidden">
            Serie: <span className="text-fg">{doneSets}</span>/{totalSets}
          </div>
          <div className="ml-auto flex gap-2">
            {session.status === "planned" && (
              <Button variant="primary" size="lg" onClick={() => setRecoveryOpen(true)}>
                <IconPlay width={18} height={18} /> Rozpocznij
              </Button>
            )}
            {session.status === "in_progress" &&
              (session.paused_at ? (
                <Button onClick={() => resumeSession(session.id)} aria-label="Wznów">
                  <IconPlay width={16} height={16} /> <span className="hidden sm:inline">Wznów</span>
                </Button>
              ) : (
                <Button onClick={() => pauseSession(session.id)} aria-label="Pauza">
                  <IconPause width={16} height={16} /> <span className="hidden sm:inline">Pauza</span>
                </Button>
              ))}
            {session.status === "in_progress" && (
              <Button variant="primary" onClick={() => setFinishOpen(true)}>
                Zakończ
              </Button>
            )}
            {(session.status === "completed" || session.status === "skipped") && (
              <Button variant="outline" onClick={() => reopenSession(session.id)}>
                Przywróć
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1 sm:hidden" aria-hidden>
          {exercises.map((e) => (
            <div key={e.id} className="h-1 flex-1 overflow-hidden rounded-sm bg-surface-3">
              <div className={cx("bar-fill h-full", e.id === currentId ? "bg-olive-strong" : "bg-ok")} style={{ width: `${progressOf(e.id, e.sets, e.block === "conditioning") * 100}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <Notice title={WEEK_PHASES[session.week]?.name}>{session.phase_note}</Notice>

        {drill(session.warmup, "Rozgrzewka dynamiczna", "00 · ok. 8 min")}

        {blocks.map((b) => (
          <section key={b} aria-label={BLOCK_LABELS[b]}>
            <div className="mb-2 mt-3 flex items-center gap-3">
              <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-olive-strong">{BLOCK_LABELS[b]}</h2>
              <div aria-hidden className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
            </div>
            <div className="flex flex-col gap-3">
              {exercises
                .filter((e) => e.block === b)
                .map((we) => (
                  <ExerciseCard
                    key={we.id}
                    we={we}
                    session={session}
                    sets={allSets.filter((s) => s.workout_exercise_id === we.id)}
                    history={historyFor.get(we.id) ?? []}
                    editable={editable}
                    index={++idx}
                    current={we.id === currentId && session.status !== "skipped"}
                  />
                ))}
            </div>
          </section>
        ))}

        {drill(session.cooldown, "Schłodzenie", "99 · ok. 5 min")}

        <Card title="Notatki z treningu">
          <Textarea aria-label="Notatki" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => updateSessionNotes(session.id, notes)} placeholder="Samopoczucie, ból, sprzęt, uwagi do techniki…" />
          {session.session_rpe !== null && <p className="mt-2 text-sm text-muted">Trudność sesji (sRPE): {session.session_rpe}/10</p>}
          {session.recovery_rating !== null && <p className="text-sm text-muted">Regeneracja przed treningiem: {session.recovery_rating}/5</p>}
        </Card>
      </div>

      {session.status === "in_progress" && <RestTimer sessionId={session.id} endsAt={session.rest_ends_at} />}

      <Modal open={recoveryOpen} onClose={() => setRecoveryOpen(false)} title="Jak się regenerujesz?">
        <p className="mb-3 text-sm text-muted">Ocena wpływa na rekomendacje progresji (przy słabej regeneracji aplikacja nie będzie podnosić ciężarów).</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              className="flex h-16 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 hover:border-olive"
              onClick={() => {
                startSession(session.id, r);
                setRecoveryOpen(false);
              }}
            >
              <span className="text-lg font-semibold">{r}</span>
              <span className="text-[10px] text-muted">{["bardzo słaba", "słaba", "średnia", "dobra", "bardzo dobra"][r - 1]}</span>
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => {
            startSession(session.id, null);
            setRecoveryOpen(false);
          }}
        >
          Pomiń ocenę i zacznij
        </Button>
      </Modal>

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Zakończ trening">
        <p className="mb-2 text-sm">Jak trudna była cała sesja? (sRPE, 1 = bardzo lekko, 10 = maksymalny wysiłek)</p>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
            <button key={r} aria-pressed={rpe === r} onClick={() => setRpe(r)} className={cx("h-12 rounded-xl border text-lg font-semibold", rpe === r ? "border-olive bg-olive-dim text-olive-strong" : "border-line bg-surface-2")}>
              {r}
            </button>
          ))}
        </div>
        <Textarea className="mt-4" label="Notatki" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {doneSets < totalSets && <Notice tone="warn">Wykonano {doneSets} z {totalSets} serii. Niewykonane serie zostaną uwzględnione w rekomendacjach.</Notice>}
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={doFinish}>
          Zapisz i oblicz progresję
        </Button>
      </Modal>

      <Modal open={summary !== null} onClose={() => router.push("/trening")} title="Podsumowanie i progresja" wide>
        <p className="mb-3 text-sm text-muted">Rekomendacje na kolejny trening z danym ćwiczeniem — oparte na zapisanych seriach, RIR, ocenie techniki, trudności sesji i regeneracji.</p>
        <div className="flex flex-col gap-3">
          {(summary ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{EXERCISE_MAP[r.exercise_id]?.name}</div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone={r.action === "increase_load" || r.action === "increase_reps" ? "ok" : r.action === "decrease_load" || r.action === "deload" ? "warn" : "olive"}>{ACTION_LABELS[r.action]}</Badge>
                  {r.suggested_load_kg !== null && <strong>{fmt(r.suggested_load_kg, 2)} kg</strong>}
                  <span className="text-muted">{r.rep_target}</span>
                </div>
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {r.explanation.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {!r.target_session_id && <p className="mt-1 text-xs text-muted">Ćwiczenie nie występuje już w tym cyklu — rekomendacja zostanie użyta przy generowaniu kolejnego.</p>}
            </div>
          ))}
          {summary && summary.length === 0 && <Empty title="Brak rekomendacji">Zapisz serie, aby otrzymać propozycje progresji.</Empty>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              (summary ?? []).filter((r) => r.target_session_id).forEach((r) => acceptRecommendation(r.id));
              router.push("/trening");
            }}
          >
            Akceptuj wszystkie
          </Button>
          <Button variant="ghost" onClick={() => router.push("/trening")}>
            Zdecyduję później
          </Button>
        </div>
      </Modal>
    </div>
  );
}
