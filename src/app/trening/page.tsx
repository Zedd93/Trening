"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WorkoutSession } from "@/lib/domain/types";
import { useActiveProgram, useData, useProfile, useToday } from "@/lib/hooks";
import { Badge, Button, Card, Empty, Input, LinkButton, Modal, Notice, PageHeader, Segmented, cx } from "@/components/ui";
import { addDays, diffDays, formatDateFull, formatDateShort, parseISODate, startOfWeek, WEEKDAYS_SHORT } from "@/lib/utils/dates";
import { checkMove, missedSessions, nextSession } from "@/lib/training/schedule";
import { moveSession, skipSession, generateNextCycle, copyProgram, reopenSession } from "@/lib/actions/training";
import { VOLUME_GUIDE, WEEK_PHASES, weeklyVolume } from "@/lib/training/generator";
import { EXERCISE_MAP, MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/lib/training/exercises";
import { IconCalendar, IconList } from "@/components/icons";
import { sessionExercises } from "@/lib/selectors";
import { fmt } from "@/lib/utils/format";

const STATUS: Record<WorkoutSession["status"], { label: string; tone: "neutral" | "olive" | "ok" | "warn" }> = {
  planned: { label: "Zaplanowany", tone: "neutral" },
  in_progress: { label: "W trakcie", tone: "olive" },
  completed: { label: "Ukończony", tone: "ok" },
  skipped: { label: "Pominięty", tone: "warn" },
};

export default function TrainingPage() {
  const data = useData();
  const profile = useProfile();
  const todayDate = useToday();
  const { program, sessions } = useActiveProgram();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [moving, setMoving] = useState<WorkoutSession | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);

  const next = nextSession(sessions, todayDate);
  const missed = missedSessions(sessions, todayDate);
  const doneCount = sessions.filter((s) => s.status === "completed").length;
  const currentWeek = next?.week ?? 4;

  const volume = useMemo(() => {
    const w1 = sessions.filter((s) => s.week === currentWeek).flatMap((s) => sessionExercises(data, s.id));
    return weeklyVolume(w1);
  }, [sessions, data, currentWeek]);

  if (!program) {
    return (
      <>
        <PageHeader title="Trening" />
        <Empty title="Brak aktywnego programu">
          <Button variant="primary" className="mt-3" onClick={() => generateNextCycle()}>
            Wygeneruj program
          </Button>
        </Empty>
      </>
    );
  }

  const calStart = startOfWeek(program.start_date);
  const lastDate = sessions.at(-1)?.scheduled_date ?? program.start_date;
  const calWeeks = Math.max(4, Math.ceil((diffDays(lastDate, calStart) + 1) / 7));
  const pendingRecs = Object.values(data.progression_recommendations).filter((r) => r.status === "pending" && r.target_session_id);

  const notes = program.notes ? program.notes.split("\n").filter(Boolean) : [];
  const nextEx = next ? sessionExercises(data, next.id).filter((e) => e.block !== "conditioning") : [];
  const guide = profile ? VOLUME_GUIDE[profile.experience] : ([10, 18] as const);
  const scaleMax = guide[1] * 1.25;

  return (
    <>
      <PageHeader
        eyebrow={`// Program · ukończono ${doneCount}/${sessions.length}`}
        title="Trening"
        subtitle={`${program.name} · start ${formatDateFull(program.start_date)}`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/trening/cwiczenia" variant="outline" size="sm">
              Ćwiczenia
            </LinkButton>
            <LinkButton href="/trening/historia" variant="outline" size="sm">
              Historia
            </LinkButton>
          </div>
        }
      />

      <div className="stagger flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <section className="hud hud-accent relative overflow-hidden rounded-2xl p-5 sm:p-6">
            <div aria-hidden className="stripes absolute right-0 top-0 h-1.5 w-32 opacity-60" />
            <span className="eyebrow text-olive-strong">Następny trening</span>
            {next ? (
              <>
                <h2 className="font-display mt-2 text-3xl font-extrabold uppercase leading-[0.92] tracking-wide sm:text-4xl">
                  {next.title.split(" — ")[0]} <span className="text-olive-strong">{next.title.split(" — ")[1]}</span>
                </h2>
                <p className="mt-2 text-sm text-muted">
                  <span className="text-fg">{formatDateFull(next.scheduled_date)}</span> · tydzień {next.week} · {next.focus}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {nextEx.slice(0, 7).map((e, i) => (
                    <li key={e.id} className="rounded-md border border-line bg-bg/40 px-2 py-1 text-xs">
                      <span className="font-data mr-1.5 text-olive-strong">{String(i + 1).padStart(2, "0")}</span>
                      {EXERCISE_MAP[e.exercise_id]?.name}
                    </li>
                  ))}
                </ul>
                <LinkButton href={`/trening/sesja/${next.id}`} variant="primary" size="lg" className="mt-5 w-full sm:w-auto sm:min-w-56">
                  {next.status === "in_progress" ? "Kontynuuj" : next.scheduled_date === todayDate ? "Rozpocznij" : "Podgląd"}
                </LinkButton>
              </>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">Wszystkie treningi cyklu za Tobą lub minęły. Przygotuj kolejny cykl na podstawie wyników.</p>
                <Button variant="primary" onClick={() => setCycleOpen(true)}>
                  Kolejny cykl
                </Button>
              </div>
            )}
          </section>

          <Card eyebrow={`Faza · tydzień ${currentWeek}/4`} title={WEEK_PHASES[currentWeek]?.name.split(" — ")[1] ?? "Faza"}>
            <div className="mb-3 grid grid-cols-4 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((w) => (
                <div key={w}>
                  <div className={cx("h-1.5 rounded-full", w < currentWeek ? "bg-olive/60" : w === currentWeek ? "bg-olive-strong" : "bg-surface-3")} />
                  <div className={cx("font-data mt-1 text-[10px]", w === currentWeek ? "text-olive-strong" : "text-muted")}>T{w}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">{WEEK_PHASES[currentWeek]?.note}</p>
          </Card>
        </div>

        {missed.length > 0 && (
          <Notice tone="warn" title={`Pominięte treningi: ${missed.length}`}>
            {missed.map((m) => `${m.title.split(" — ")[0]} (${formatDateShort(m.scheduled_date)})`).join(", ")}. Możesz je przenieść na najbliższy wolny dzień — aplikacja sprawdzi odstępy regeneracyjne. Silnik progresji uwzględni nieregularność.
          </Notice>
        )}

        {pendingRecs.length > 0 && <Notice title={`Rekomendacje progresji do zatwierdzenia: ${pendingRecs.length}`}>Otwórz najbliższy trening — przy ćwiczeniach znajdziesz propozycję ciężaru z uzasadnieniem.</Notice>}

        {notes.length > 0 && (
          <details className="group rounded-xl border border-line bg-surface/60 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
              <span>
                <span className="eyebrow mr-2 text-olive-strong">Dopasowanie</span>
                Program skrócono do Twojego czasu treningu ({notes.length})
              </span>
              <span aria-hidden className="font-mono text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2 text-sm text-muted">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        )}

        <section>
          <div className="mb-3 mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="eyebrow">4 tygodnie · {sessions.length} treningów</div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Plan cyklu</h2>
            </div>
            <Segmented
              ariaLabel="Widok"
              value={view}
              onChange={setView}
              options={[
                { value: "calendar", label: "Kalendarz" },
                { value: "list", label: "Lista" },
              ]}
            />
          </div>

          {view === "calendar" ? (
            <div className="hud rounded-2xl p-2 sm:p-4">
              <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 text-center sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] sm:gap-1.5">
                <span />
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d} className="eyebrow py-1">
                    {d}
                  </span>
                ))}
              </div>
              {Array.from({ length: calWeeks }, (_, w) => w).map((w) => (
                <div key={w} className="mt-1 grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 sm:mt-1.5 sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] sm:gap-1.5">
                  <div className="font-data flex items-center text-[10px] text-muted sm:text-xs">
                    <span className="sm:hidden">T{w + 1}</span>
                    <span className="hidden sm:inline">{formatDateShort(addDays(calStart, w * 7))}</span>
                  </div>
                  {Array.from({ length: 7 }, (_, d) => {
                    const date = addDays(calStart, w * 7 + d);
                    const ss = sessions.filter((s) => s.scheduled_date === date);
                    const isToday = date === todayDate;
                    const past = date < todayDate;
                    return (
                      <div
                        key={d}
                        className={cx(
                          "flex min-h-16 flex-col rounded-lg border p-1 text-left sm:min-h-20 sm:p-1.5",
                          isToday ? "border-olive bg-olive-dim/30" : "border-line",
                          !isToday && (ss.length ? "bg-surface-2/70" : "bg-bg/30"),
                          past && !ss.length && "opacity-50",
                        )}
                      >
                        <div className={cx("font-data text-[10px] sm:text-[11px]", isToday ? "font-semibold text-olive-strong" : "text-muted")}>{parseISODate(date).getDate()}</div>
                        {ss.map((s) => (
                          <Link
                            key={s.id}
                            href={`/trening/sesja/${s.id}`}
                            className={cx(
                              "mt-auto flex items-center justify-center gap-1 rounded-md px-1 py-1 text-xs font-semibold transition-transform hover:scale-[1.04] sm:justify-start sm:px-1.5",
                              s.status === "completed" && "bg-ok/20 text-ok",
                              s.status === "planned" && "bg-olive-dim text-olive-strong",
                              s.status === "in_progress" && "bg-olive text-[#10130b]",
                              s.status === "skipped" && "bg-warn/15 text-warn line-through",
                            )}
                            aria-label={`${s.title}, ${formatDateFull(s.scheduled_date)}, ${STATUS[s.status].label}`}
                          >
                            <span className="font-display text-base leading-none">{s.template}</span>
                            <span className="hidden font-normal opacity-80 md:inline">{s.template === "A" ? "Siła" : s.template === "B" ? "Tactical" : "Hiper."}</span>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-sm bg-olive-dim ring-1 ring-olive/50" /> zaplanowany
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-sm bg-ok/40" /> ukończony
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-sm bg-warn/40" /> pominięty
                </span>
                <span className="flex items-center gap-1">
                  <IconCalendar width={13} height={13} /> Przenoszenie terminu — w widoku listy
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {[1, 2, 3, 4].map((w) => (
                <div key={w}>
                  <h3 className="eyebrow mb-2 flex items-center gap-2">
                    <span className="text-olive-strong">T{w}</span> {WEEK_PHASES[w].name.split(" — ")[1]}
                    <span className="h-px flex-1 bg-line" />
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {sessions
                      .filter((s) => s.week === w)
                      .map((s) => (
                        <li key={s.id} className={cx("hud flex flex-wrap items-center gap-3 rounded-xl p-3", s.status === "skipped" && "opacity-70")}>
                          <div className="w-12 text-center">
                            <div className="eyebrow">{WEEKDAYS_SHORT[(parseISODate(s.scheduled_date).getDay() + 6) % 7]}</div>
                            <div className="font-data text-sm font-semibold">{formatDateShort(s.scheduled_date)}</div>
                          </div>
                          <div
                            className={cx(
                              "font-display grid h-10 w-10 place-items-center rounded-lg text-2xl font-extrabold",
                              s.status === "completed" ? "bg-ok/15 text-ok" : s.status === "skipped" ? "bg-warn/10 text-warn" : "bg-olive-dim text-olive-strong",
                            )}
                            aria-hidden
                          >
                            {s.template}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{s.title}</div>
                            <div className="truncate text-xs text-muted">{s.focus}</div>
                          </div>
                          <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                          <div className="flex w-full gap-1.5 sm:w-auto">
                            <LinkButton href={`/trening/sesja/${s.id}`} size="sm" variant={s.status === "planned" || s.status === "in_progress" ? "primary" : "outline"}>
                              {s.status === "planned" ? "Start" : s.status === "in_progress" ? "Kontynuuj" : "Otwórz"}
                            </LinkButton>
                            {s.status === "planned" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setMoving(s)}>
                                  Przenieś
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => skipSession(s.id)}>
                                  Pomiń
                                </Button>
                              </>
                            )}
                            {s.status === "skipped" && (
                              <Button size="sm" variant="ghost" onClick={() => reopenSession(s.id)}>
                                Przywróć
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-muted">
                <IconList className="mr-1 inline" width={14} height={14} />
                Lista pokazuje wszystkie 12 treningów cyklu.
              </p>
            </div>
          )}
        </section>

        <Card eyebrow={`Objętość · tydzień ${currentWeek}`} title="Serie na partię" subtitle="Główna partia = 1 seria, pomocnicza = 0,5. Pole w tle to zalecany zakres.">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {(Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((g) => {
              const v = volume[g] ?? 0;
              const pct = Math.min(100, (v / scaleMax) * 100);
              const extra = g === "core" || g === "grip";
              const tone = extra ? "olive" : v < guide[0] ? "warn" : v > guide[1] ? "warn" : "ok";
              return (
                <div key={g}>
                  <div className="flex justify-between text-sm">
                    <span>{MUSCLE_GROUP_LABELS[g]}</span>
                    <span className={cx("font-data", tone === "warn" ? "text-warn" : "text-muted")}>{fmt(v, 1)}</span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-surface-3">
                    {!extra && (
                      <div
                        aria-hidden
                        className="absolute inset-y-[-3px] rounded-sm border-x border-olive/50 bg-olive/10"
                        style={{ left: `${(guide[0] / scaleMax) * 100}%`, width: `${((guide[1] - guide[0]) / scaleMax) * 100}%` }}
                      />
                    )}
                    <div className={cx("bar-fill relative h-full rounded-full", tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-olive")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted">Zakres dla Twojego poziomu: {guide.join("–")} serii/tydz. na główne partie. Tułów i chwyt trenowane są dodatkowo w blokach funkcjonalnych.</p>
        </Card>

        <Card eyebrow="Archiwum" title="Cykle i plan">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCycleOpen(true)}>
              Generuj kolejny miesiąc
            </Button>
            <LinkButton href="/postepy?tab=cykle" variant="ghost">
              Poprzednie cykle
            </LinkButton>
          </div>
        </Card>
      </div>

      {moving && <MoveModal session={moving} sessions={sessions} onClose={() => setMoving(null)} sports={profile?.sports ?? []} />}
      <CycleModal open={cycleOpen} onClose={() => setCycleOpen(false)} programId={program.id} />
    </>
  );
}

function MoveModal({ session, sessions, onClose, sports }: { session: WorkoutSession; sessions: WorkoutSession[]; onClose: () => void; sports: import("@/lib/domain/types").Sport[] }) {
  const [date, setDate] = useState(session.scheduled_date);
  const check = checkMove(session, date, sessions, sports);
  return (
    <Modal open onClose={onClose} title={`Przenieś: ${session.title}`}>
      <Input label="Nowa data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="mt-3 flex flex-col gap-2">
        {check.level === "ok" && date !== session.scheduled_date && <Notice tone="ok">Termin zapewnia odpowiednią przerwę regeneracyjną.</Notice>}
        {check.messages.map((m) => (
          <Notice key={m} tone={check.level === "blocked" ? "bad" : "warn"}>
            {m}
          </Notice>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          disabled={!check.allowed || date === session.scheduled_date}
          onClick={() => {
            moveSession(session.id, date);
            onClose();
          }}
        >
          {check.level === "warning" ? "Przenieś mimo to" : "Przenieś"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Anuluj
        </Button>
      </div>
    </Modal>
  );
}

function CycleModal({ open, onClose, programId }: { open: boolean; onClose: () => void; programId: string }) {
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Kolejny cykl">
      <p className="text-sm text-muted">
        <strong className="text-fg">Generuj kolejny miesiąc</strong> — nowy 4-tygodniowy program z ciężarami startowymi z Twoich ostatnich wyników i rekomendacji. Obecny cykl zostanie zarchiwizowany (historia pozostaje).
      </p>
      <p className="mt-2 text-sm text-muted">
        <strong className="text-fg">Kopiuj plan</strong> — te same ćwiczenia i schemat od wybranej daty.
      </p>
      <Input className="mt-3" label="Data startu (opcjonalnie)" type="date" value={date} onChange={(e) => setDate(e.target.value)} hint="Domyślnie: poniedziałek po zakończeniu obecnego cyklu." />
      {msg && <Notice tone="ok">{msg}</Notice>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            const g = generateNextCycle(date || undefined);
            setMsg(`Utworzono ${g.program.name}.${g.warnings.length ? " " + g.warnings.join(" ") : ""}`);
          }}
        >
          Generuj kolejny miesiąc
        </Button>
        <Button
          variant="outline"
          disabled={!date}
          onClick={() => {
            copyProgram(programId, date);
            setMsg("Skopiowano plan.");
          }}
        >
          Kopiuj plan
        </Button>
      </div>
    </Modal>
  );
}
