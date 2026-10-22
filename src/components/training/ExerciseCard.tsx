"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ExerciseSet, ProgressionRecommendation, WorkoutExercise, WorkoutSession } from "@/lib/domain/types";
import { EXERCISE_MAP, type ExerciseDef } from "@/lib/training/exercises";
import { substituteCandidates } from "@/lib/training/generator";
import { acceptRecommendation, dismissRecommendation, removeSet, setTechnique, startRest, substituteExercise, upsertSet } from "@/lib/actions/training";
import { ExerciseAnimation } from "../ExerciseAnimation";
import { Badge, Button, Modal, Notice, Stepper, cx } from "../ui";
import { IconCheck, IconSwap } from "../icons";
import { IntervalTimer } from "./RestTimer";
import { ACTION_LABELS } from "@/lib/labels";
import { formatDateShort } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";
import { useData, useProfile } from "@/lib/hooks";

export function unitFor(def: ExerciseDef | undefined) {
  if (!def) return { reps: "Powt.", short: "powt." };
  if (def.load_type === "time") return { reps: "Czas (s)", short: "s" };
  if (def.load_type === "distance") return { reps: "Dystans (m)", short: "m" };
  return { reps: "Powt.", short: "powt." };
}

export function prescription(we: WorkoutExercise, def: ExerciseDef | undefined) {
  if (we.block === "conditioning") return we.load_note;
  const u = unitFor(def).short;
  return `${we.sets} × ${we.rep_min}–${we.rep_max} ${u}`;
}

export function ExerciseCard({
  we,
  session,
  sets,
  pendingRec,
  history,
  editable,
}: {
  we: WorkoutExercise;
  session: WorkoutSession;
  sets: ExerciseSet[];
  pendingRec?: ProgressionRecommendation;
  history: { date: string; sets: ExerciseSet[] }[];
  editable: boolean;
}) {
  const def = EXERCISE_MAP[we.exercise_id];
  const profile = useProfile();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [bigAnim, setBigAnim] = useState(false);
  const [needReps, setNeedReps] = useState<number | null>(null);
  const u = unitFor(def);
  const isCardio = we.block === "conditioning" && def?.load_type === "cardio";
  const loadable = def && !["time", "cardio", "mobility"].includes(def.load_type) && !(def.load_type === "bodyweight" && def.increment_kg === 0);
  const rowsCount = Math.max(we.sets, ...sets.map((s) => s.set_number), 0);
  const lastWeight = history[0]?.sets.filter((s) => s.completed && s.weight_kg).at(-1)?.weight_kg ?? null;
  const defaultWeight = we.suggested_load_kg ?? lastWeight;
  const doneCount = sets.filter((s) => s.completed).length;
  const step = def?.load_type === "dumbbell" ? Math.max(1, def.increment_kg) : def?.increment_kg || 2.5;
  const alternatives = useMemo(() => (profile ? substituteCandidates(we.exercise_id, profile.equipment, profile.injuries.map((i) => i.area)) : []), [profile, we.exercise_id]);
  const origName = we.substituted_from ? EXERCISE_MAP[we.substituted_from]?.name : null;
  const targetPending = Object.values(data.progression_recommendations).find((r) => r.target_session_id === session.id && r.exercise_id === we.exercise_id && r.status === "pending") ?? pendingRec;

  if (!def) return null;

  const setRow = (n: number) => sets.find((s) => s.set_number === n);

  function toggleDone(n: number) {
    const s = setRow(n);
    const reps = s?.reps ?? null;
    if (!s?.completed && reps === null && !isCardio) {
      setNeedReps(n);
      return;
    }
    setNeedReps(null);
    const nowDone = !s?.completed;
    upsertSet(we, n, { completed: nowDone, weight_kg: s?.weight_kg ?? (loadable ? defaultWeight : null) });
    if (nowDone && we.rest_sec > 0 && session.status === "in_progress") startRest(session.id, we.rest_sec);
  }

  return (
    <article className={cx("rounded-2xl border bg-surface p-4", doneCount >= we.sets && we.sets > 0 ? "border-ok/40" : "border-line")} aria-labelledby={`ex-${we.id}`}>
      <div className="flex gap-3">
        <button type="button" onClick={() => setBigAnim(true)} className="shrink-0 rounded-xl" aria-label={`Powiększ demonstrację: ${def.name}`}>
          <ExerciseAnimation exerciseId={def.id} size="sm" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`ex-${we.id}`} className="text-[15px] font-semibold leading-tight">
              {def.name}
            </h3>
            {def.unilateral && <Badge>na stronę</Badge>}
          </div>
          {origName && <p className="text-xs text-muted">zamiast: {origName}</p>}
          <p className="mt-1 text-xs text-muted">{def.muscles_primary.join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{prescription(we, def)}</span>
            {!isCardio && <span className="text-muted">RIR {we.target_rir}</span>}
            {!isCardio && we.tempo && <span className="text-muted">tempo {we.tempo}</span>}
            {we.rest_sec > 0 && <span className="text-muted">przerwa {we.rest_sec >= 60 ? `${fmt(we.rest_sec / 60, 1)} min` : `${we.rest_sec} s`}</span>}
          </div>
          {loadable && (
            <p className="mt-1 text-sm">
              Zalecany ciężar:{" "}
              <strong>{we.suggested_load_kg !== null ? `${fmt(we.suggested_load_kg, 2)} kg${def.load_type === "dumbbell" ? " / hantla" : ""}` : session.week === 1 ? "dobierz z zapasem RIR (tydzień 1)" : lastWeight ? `ostatnio ${fmt(lastWeight, 2)} kg` : "—"}</strong>
            </p>
          )}
          {we.load_note && we.block !== "conditioning" && <p className="mt-1 text-xs text-muted">{we.load_note}</p>}
        </div>
      </div>

      {targetPending && targetPending.target_session_id === session.id && (
        <div className="mt-3 rounded-xl border border-olive/40 bg-olive-dim/40 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Badge tone="olive">{ACTION_LABELS[targetPending.action]}</Badge>{" "}
              {targetPending.suggested_load_kg !== null && <strong>{fmt(targetPending.suggested_load_kg, 2)} kg</strong>} <span className="text-muted">· {targetPending.rep_target}</span>
            </div>
            {editable && (
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => acceptRecommendation(targetPending.id)}>
                  Akceptuj
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dismissRecommendation(targetPending.id)}>
                  Odrzuć
                </Button>
              </div>
            )}
          </div>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
            {targetPending.explanation.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {isCardio ? (
        <>
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{we.load_note}</p>
          {we.sets > 1 && we.duration_sec > 0 && <IntervalTimer rounds={we.sets} work={we.duration_sec} rest={we.rest_sec} />}
          {editable && (
            <label className="mt-3 flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={!!setRow(1)?.completed} onChange={() => toggleDone(1)} />
              Blok kondycyjny wykonany
            </label>
          )}
        </>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-[2rem_1fr_1fr_4.5rem_3rem] items-center gap-2 px-1 text-[11px] uppercase tracking-wide text-muted">
            <span>Seria</span>
            <span>{loadable ? "Ciężar (kg)" : "Obciążenie"}</span>
            <span>{u.reps}</span>
            <span>RIR</span>
            <span className="text-center">Wyk.</span>
          </div>
          <div className="mt-1 flex flex-col gap-2">
            {Array.from({ length: rowsCount }, (_, i) => i + 1).map((n) => {
              const s = setRow(n);
              const prev = setRow(n - 1);
              return (
                <div key={n} className={cx("grid grid-cols-[2rem_1fr_1fr_4.5rem_3rem] items-center gap-2 rounded-xl p-1", s?.completed && "bg-ok/10")}>
                  <span className="text-center text-sm font-semibold text-muted">{n}</span>
                  {loadable ? (
                    <Stepper
                      ariaLabel={`Seria ${n}: ciężar`}
                      value={s?.weight_kg ?? null}
                      step={step}
                      decimals={2}
                      onChange={(v) => editable && upsertSet(we, n, { weight_kg: v })}
                    />
                  ) : (
                    <span className="px-2 text-sm text-muted">masa ciała</span>
                  )}
                  <Stepper
                    ariaLabel={`Seria ${n}: ${u.reps.toLowerCase()}`}
                    value={s?.reps ?? null}
                    step={def.load_type === "time" || def.load_type === "distance" ? 5 : 1}
                    onChange={(v) => {
                      if (!editable) return;
                      setNeedReps(null);
                      upsertSet(we, n, { reps: v, weight_kg: s?.weight_kg ?? (loadable ? (prev?.weight_kg ?? defaultWeight) : null) });
                    }}
                  />
                  <select
                    aria-label={`Seria ${n}: RIR`}
                    value={s?.rir ?? ""}
                    disabled={!editable}
                    onChange={(e) => upsertSet(we, n, { rir: e.target.value === "" ? null : Number(e.target.value) })}
                    className="h-11 rounded-xl border border-line bg-surface-2 px-2 text-center"
                  >
                    <option value="">—</option>
                    {[0, 1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r === 5 ? "5+" : r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => toggleDone(n)}
                    aria-pressed={!!s?.completed}
                    aria-label={`Seria ${n}: wykonano`}
                    className={cx("grid h-11 w-11 place-items-center justify-self-center rounded-xl border", s?.completed ? "border-ok bg-ok text-[#08160d]" : "border-line bg-surface-2 text-muted")}
                  >
                    <IconCheck width={20} height={20} />
                  </button>
                  {needReps === n && (
                    <p className="col-span-5 px-1 text-xs text-warn" role="alert">
                      Wpisz liczbę {def.load_type === "time" ? "sekund" : def.load_type === "distance" ? "metrów" : "powtórzeń"}, aby oznaczyć serię jako wykonaną.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {editable && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => upsertSet(we, rowsCount + 1, { weight_kg: setRow(rowsCount)?.weight_kg ?? (loadable ? defaultWeight : null), reps: setRow(rowsCount)?.reps ?? null })}>
                + seria
              </Button>
              {rowsCount > we.sets && (
                <Button size="sm" variant="ghost" onClick={() => removeSet(we.id, rowsCount)}>
                  − usuń ostatnią
                </Button>
              )}
              <div className="ml-auto flex items-center gap-1 text-sm" role="group" aria-label="Ocena techniki">
                <span className="text-muted">Technika:</span>
                <button className={cx("h-9 rounded-lg px-2.5", we.technique_ok === true ? "bg-ok/20 text-ok" : "bg-surface-2")} aria-pressed={we.technique_ok === true} onClick={() => setTechnique(we.id, we.technique_ok === true ? null : true)}>
                  OK
                </button>
                <button className={cx("h-9 rounded-lg px-2.5", we.technique_ok === false ? "bg-warn/20 text-warn" : "bg-surface-2")} aria-pressed={we.technique_ok === false} onClick={() => setTechnique(we.id, we.technique_ok === false ? null : false)}>
                  do poprawy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Ukryj szczegóły" : "Technika i historia"}
        </Button>
        {editable && alternatives.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSwapOpen(true)}>
            <IconSwap width={16} height={16} /> Zamień
          </Button>
        )}
        <Link href={`/trening/cwiczenia/${def.id}`} className="ml-auto self-center text-sm text-olive-strong">
          Karta ćwiczenia →
        </Link>
      </div>

      {open && (
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h4 className="mb-1 font-semibold">Wskazówki techniczne</h4>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {def.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {def.mistakes.length > 0 && (
              <>
                <h4 className="mb-1 mt-3 font-semibold">Częste błędy</h4>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  {def.mistakes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </>
            )}
            {def.muscles_secondary.length > 0 && <p className="mt-3 text-xs text-muted">Pomocniczo: {def.muscles_secondary.join(", ")}</p>}
          </div>
          <div>
            <h4 className="mb-1 font-semibold">Historia ciężarów</h4>
            {history.length === 0 ? (
              <p className="text-muted">Brak wcześniejszych zapisów.</p>
            ) : (
              <ul className="space-y-1">
                {history.slice(0, 6).map((h) => (
                  <li key={h.date} className="flex gap-2">
                    <span className="w-12 shrink-0 text-muted">{formatDateShort(h.date)}</span>
                    <span>
                      {h.sets
                        .filter((s) => s.completed)
                        .map((s) => `${s.weight_kg ? fmt(s.weight_kg, 2) + "×" : ""}${s.reps ?? "—"}${s.rir !== null ? `@${s.rir}` : ""}`)
                        .join(", ") || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {def.alternatives.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Warianty alternatywne: {def.alternatives.map((a) => EXERCISE_MAP[a]?.name).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      <Modal open={bigAnim} onClose={() => setBigAnim(false)} title={def.name}>
        <div className="flex flex-col items-center gap-3">
          <ExerciseAnimation exerciseId={def.id} size="lg" />
          <p className="text-sm text-muted">{def.cues[0]}</p>
        </div>
      </Modal>

      <Modal open={swapOpen} onClose={() => setSwapOpen(false)} title="Zamień ćwiczenie">
        <p className="mb-3 text-sm text-muted">Alternatywy dostępne przy Twoim sprzęcie i ograniczeniach. Zakres powtórzeń i serii zostaje zachowany.</p>
        <div className="flex flex-col gap-3">
          {alternatives.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <ExerciseAnimation exerciseId={a.id} size="sm" autoPlay={false} initialPhase={0.4} />
              <div className="flex-1">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted">{a.muscles_primary.join(", ")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      substituteExercise(we.id, a.id, "this");
                      setSwapOpen(false);
                    }}
                  >
                    Tylko dziś
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      substituteExercise(we.id, a.id, "future");
                      setSwapOpen(false);
                    }}
                  >
                    Do końca cyklu
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!alternatives.length && <Notice>Brak dostępnych alternatyw.</Notice>}
        </div>
      </Modal>
    </article>
  );
}
