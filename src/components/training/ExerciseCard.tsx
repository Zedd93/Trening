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
  index = 1,
  current = false,
}: {
  we: WorkoutExercise;
  session: WorkoutSession;
  sets: ExerciseSet[];
  pendingRec?: ProgressionRecommendation;
  history: { date: string; sets: ExerciseSet[] }[];
  editable: boolean;
  index?: number;
  current?: boolean;
}) {
  const def = EXERCISE_MAP[we.exercise_id];
  const profile = useProfile();
  const data = useData();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

  const complete = we.sets > 0 && doneCount >= (isCardio ? 1 : we.sets);
  const collapsed = complete && !expanded;
  const restLabel = we.rest_sec >= 60 ? `${fmt(we.rest_sec / 60, 1)} min` : `${we.rest_sec} s`;
  const loadText =
    we.suggested_load_kg !== null
      ? `${fmt(we.suggested_load_kg, 2)} kg${def.load_type === "dumbbell" ? " / hantla" : ""}`
      : session.week === 1
        ? "dobierz z zapasem RIR"
        : lastWeight
          ? `ostatnio ${fmt(lastWeight, 2)} kg`
          : "—";

  return (
    <article
      className={cx("hud rounded-2xl p-4 transition-colors", current && "hud-accent shadow-[0_0_0_1px_var(--olive),0_0_40px_-18px_var(--olive)]", complete && "opacity-90")}
      aria-labelledby={`ex-${we.id}`}
    >
      <div className="flex gap-3">
        <button type="button" onClick={() => setBigAnim(true)} className={cx("relative shrink-0 rounded-xl", collapsed && "hidden sm:block")} aria-label={`Powiększ demonstrację: ${def.name}`}>
          <ExerciseAnimation exerciseId={def.id} size="sm" autoPlay={current || !complete} />
          <span className="absolute bottom-1 right-1 rounded bg-bg/80 px-1 font-mono text-[9px] uppercase tracking-wider text-muted">⤢</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className={cx("font-data mt-0.5 text-sm font-semibold", current ? "text-olive-strong" : "text-muted")}>{String(index).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <h3 id={`ex-${we.id}`} className="font-display text-[22px] font-bold uppercase leading-[0.95] tracking-wide">
                {def.name}
              </h3>
              {origName && <p className="mt-0.5 text-xs text-muted">zamiast: {origName}</p>}
            </div>
            {complete ? (
              <Badge tone="ok">✓ gotowe</Badge>
            ) : current ? (
              <Badge tone="olive">teraz</Badge>
            ) : null}
          </div>
          {!collapsed && (
            <>
              <p className="mt-1.5 text-xs text-muted">{def.muscles_primary.join(" · ")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-olive/15 px-2 py-1 font-mono text-[12px] font-semibold text-olive-strong">{isCardio ? "kondycja" : prescription(we, def)}</span>
                {!isCardio && <span className="rounded-md bg-surface-3 px-2 py-1 font-mono text-[12px]">RIR {we.target_rir}</span>}
                {!isCardio && we.tempo && <span className="rounded-md bg-surface-3 px-2 py-1 font-mono text-[12px]">tempo {we.tempo}</span>}
                {we.rest_sec > 0 && <span className="rounded-md bg-surface-3 px-2 py-1 font-mono text-[12px]">⏱ {restLabel}</span>}
                {def.unilateral && <span className="rounded-md bg-surface-3 px-2 py-1 font-mono text-[12px]">na stronę</span>}
              </div>
              {loadable && (
                <p className="mt-2 text-sm">
                  <span className="text-muted">Ciężar: </span>
                  <strong className="font-data">{loadText}</strong>
                </p>
              )}
            </>
          )}
          {collapsed && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-data text-sm text-muted">
                {sets
                  .filter((x) => x.completed)
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((x) => `${x.weight_kg ? fmt(x.weight_kg, 2) + "×" : ""}${x.reps ?? "✓"}`)
                  .join("  ")}
              </span>
              <button className="text-sm text-olive-strong underline-offset-2 hover:underline" onClick={() => setExpanded(true)}>
                Edytuj serie
              </button>
            </div>
          )}
        </div>
      </div>
      {!collapsed && we.load_note && we.block !== "conditioning" && <p className="mt-3 border-l-2 border-line-strong pl-3 text-xs text-muted">{we.load_note}</p>}

      {!collapsed && targetPending && targetPending.target_session_id === session.id && (
        <div className="mt-3 rounded-xl border border-olive/40 bg-olive-dim/40 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="olive">{ACTION_LABELS[targetPending.action]}</Badge>
              {targetPending.suggested_load_kg !== null && <strong className="font-data">{fmt(targetPending.suggested_load_kg, 2)} kg</strong>}
              <span className="text-muted">{targetPending.rep_target}</span>
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

      {collapsed ? null : isCardio ? (
        <>
          <p className="mt-3 rounded-xl border border-line bg-bg/50 p-3 font-mono text-[13px]">{we.load_note}</p>
          {we.sets > 1 && we.duration_sec > 0 && <IntervalTimer rounds={we.sets} work={we.duration_sec} rest={we.rest_sec} />}
          {editable && (
            <button
              type="button"
              onClick={() => toggleDone(1)}
              aria-pressed={!!setRow(1)?.completed}
              className={cx("mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border font-semibold", setRow(1)?.completed ? "border-ok bg-ok/15 text-ok" : "border-line-strong text-fg hover:border-olive")}
            >
              <IconCheck width={18} height={18} /> Blok kondycyjny wykonany
            </button>
          )}
        </>
      ) : (
        <div className="mt-4">
          <div className="hidden grid-cols-[1.75rem_1fr_1fr_auto] gap-2 px-1 sm:grid">
            <span className="eyebrow">#</span>
            <span className="eyebrow">{loadable ? "Ciężar · kg" : "Obciążenie"}</span>
            <span className="eyebrow">{u.reps}</span>
            <span className="eyebrow w-[17.5rem]">RIR · zapas powtórzeń / wykonano</span>
          </div>
          <ol className="mt-1 flex flex-col gap-2">
            {Array.from({ length: rowsCount }, (_, i) => i + 1).map((n) => {
              const s = setRow(n);
              const prev = setRow(n - 1);
              const done = !!s?.completed;
              return (
                <li
                  key={n}
                  className={cx(
                    "grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2 transition-colors sm:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_auto]",
                    done ? "border-ok/40 bg-ok/[0.07]" : "border-line bg-bg/40",
                  )}
                >
                  <span className={cx("font-data text-center text-base font-semibold", done ? "text-ok" : "text-muted")}>{n}</span>
                  {loadable ? (
                    <Stepper ariaLabel={`Seria ${n}: ciężar`} value={s?.weight_kg ?? null} step={step} decimals={2} onChange={(v) => editable && upsertSet(we, n, { weight_kg: v })} />
                  ) : (
                    <span className="px-1 font-mono text-xs uppercase text-muted">masa ciała</span>
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
                  <div className="col-span-3 flex items-center gap-2 sm:col-span-1">
                    <div role="radiogroup" aria-label={`Seria ${n}: RIR`} className="flex flex-1 gap-1 sm:flex-none">
                      <span className="eyebrow self-center pr-0.5 sm:hidden">RIR</span>
                      {[0, 1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={s?.rir === r}
                          aria-label={`Seria ${n}: RIR ${r === 5 ? "5 lub więcej" : r}`}
                          disabled={!editable}
                          onClick={() => upsertSet(we, n, { rir: s?.rir === r ? null : r })}
                          className={cx(
                            "font-data h-10 min-w-0 flex-1 rounded-lg border text-sm sm:w-9 sm:flex-none",
                            s?.rir === r ? "border-olive bg-olive text-[#0e1207] font-semibold" : "border-line bg-surface-2 text-muted hover:text-fg",
                          )}
                        >
                          {r === 5 ? "5+" : r}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => toggleDone(n)}
                      aria-pressed={done}
                      aria-label={`Seria ${n}: wykonano`}
                      className={cx(
                        "grid h-11 w-14 shrink-0 place-items-center rounded-xl border-2 transition-colors",
                        done ? "pop border-ok bg-ok text-[#08160d]" : "border-line-strong bg-surface-2 text-muted hover:border-olive hover:text-olive-strong",
                      )}
                    >
                      <IconCheck width={22} height={22} />
                    </button>
                  </div>
                  {needReps === n && (
                    <p className="col-span-3 px-1 text-xs text-warn sm:col-span-4" role="alert">
                      Wpisz liczbę {def.load_type === "time" ? "sekund" : def.load_type === "distance" ? "metrów" : "powtórzeń"}, aby oznaczyć serię jako wykonaną.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          {editable && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => upsertSet(we, rowsCount + 1, { weight_kg: setRow(rowsCount)?.weight_kg ?? (loadable ? defaultWeight : null), reps: setRow(rowsCount)?.reps ?? null })}>
                + seria
              </Button>
              {rowsCount > we.sets && (
                <Button size="sm" variant="ghost" onClick={() => removeSet(we.id, rowsCount)}>
                  − usuń ostatnią
                </Button>
              )}
              <div className="ml-auto flex items-center gap-1 text-sm" role="group" aria-label="Ocena techniki">
                <span className="eyebrow mr-1">Technika</span>
                <button className={cx("h-9 rounded-lg border px-2.5", we.technique_ok === true ? "border-ok bg-ok/15 text-ok" : "border-line")} aria-pressed={we.technique_ok === true} onClick={() => setTechnique(we.id, we.technique_ok === true ? null : true)}>
                  OK
                </button>
                <button className={cx("h-9 rounded-lg border px-2.5", we.technique_ok === false ? "border-warn bg-warn/15 text-warn" : "border-line")} aria-pressed={we.technique_ok === false} onClick={() => setTechnique(we.id, we.technique_ok === false ? null : false)}>
                  do poprawy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!collapsed && (
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
      )}

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
