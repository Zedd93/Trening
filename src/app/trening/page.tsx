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

  return (
    <>
      <PageHeader
        title="Trening"
        subtitle={`${program.name} · start ${formatDateFull(program.start_date)} · ukończono ${doneCount}/${sessions.length}`}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Następny trening" className="lg:col-span-2">
          {next ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{next.title}</div>
                <div className="text-sm text-muted">
                  {formatDateFull(next.scheduled_date)} · tydzień {next.week} · {next.focus}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {sessionExercises(data, next.id)
                    .slice(0, 6)
                    .map((e) => EXERCISE_MAP[e.exercise_id]?.name)
                    .join(" · ")}
                </div>
              </div>
              <LinkButton href={`/trening/sesja/${next.id}`} variant="primary" size="lg">
                {next.status === "in_progress" ? "Kontynuuj" : next.scheduled_date === todayDate ? "Rozpocznij" : "Podgląd"}
              </LinkButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Wszystkie treningi cyklu za Tobą lub minęły. Przygotuj kolejny cykl na podstawie wyników.</p>
              <Button variant="primary" onClick={() => setCycleOpen(true)}>
                Kolejny cykl
              </Button>
            </div>
          )}
        </Card>
        <Card title={WEEK_PHASES[currentWeek]?.name ?? "Faza"}>
          <p className="text-sm text-muted">{WEEK_PHASES[currentWeek]?.note}</p>
        </Card>
      </div>

      {program.notes && (
        <div className="mt-4">
          <Notice title="Dopasowanie programu">
            {program.notes.split("\n").map((n) => (
              <p key={n}>{n}</p>
            ))}
          </Notice>
        </div>
      )}

      {missed.length > 0 && (
        <div className="mt-4">
          <Notice tone="warn" title={`Pominięte treningi: ${missed.length}`}>
            {missed.map((m) => `${m.title.split(" — ")[0]} (${formatDateShort(m.scheduled_date)})`).join(", ")}. Możesz je przenieść na najbliższy wolny dzień — aplikacja sprawdzi odstępy regeneracyjne. Silnik progresji uwzględni nieregularność.
          </Notice>
        </div>
      )}

      {pendingRecs.length > 0 && (
        <div className="mt-4">
          <Notice title={`Rekomendacje progresji do zatwierdzenia: ${pendingRecs.length}`}>Otwórz najbliższy trening — przy ćwiczeniach znajdziesz propozycję ciężaru z uzasadnieniem.</Notice>
        </div>
      )}

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Plan 4 tygodni</h2>
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
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] gap-1.5 text-center text-xs text-muted">
              <span />
              {WEEKDAYS_SHORT.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            {Array.from({ length: calWeeks }, (_, w) => w).map((w) => (
              <div key={w} className="mt-1.5 grid grid-cols-[3.5rem_repeat(7,1fr)] gap-1.5">
                <div className="flex items-center text-xs text-muted">{formatDateShort(addDays(calStart, w * 7))}</div>
                {Array.from({ length: 7 }, (_, d) => {
                  const date = addDays(calStart, w * 7 + d);
                  const ss = sessions.filter((s) => s.scheduled_date === date);
                  const isToday = date === todayDate;
                  return (
                    <div key={d} className={cx("min-h-20 rounded-xl border p-1.5 text-left", isToday ? "border-olive" : "border-line", ss.length ? "bg-surface" : "bg-surface/40")}>
                      <div className={cx("text-[11px]", isToday ? "font-semibold text-olive-strong" : "text-muted")}>{parseISODate(date).getDate()}</div>
                      {ss.map((s) => (
                        <Link
                          key={s.id}
                          href={`/trening/sesja/${s.id}`}
                          className={cx(
                            "mt-1 block rounded-lg px-1.5 py-1 text-xs font-semibold",
                            s.status === "completed" && "bg-ok/20 text-ok",
                            s.status === "planned" && "bg-olive-dim text-olive-strong",
                            s.status === "in_progress" && "bg-olive text-[#10130b]",
                            s.status === "skipped" && "bg-warn/15 text-warn line-through",
                          )}
                          aria-label={`${s.title}, ${formatDateFull(s.scheduled_date)}, ${STATUS[s.status].label}`}
                        >
                          {s.template}
                          <span className="ml-1 font-normal opacity-80">{s.template === "A" ? "Siła" : s.template === "B" ? "Tactical" : "Hiper."}</span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            <IconCalendar className="mr-1 inline" width={14} height={14} />
            Kliknij trening, aby go otworzyć. Przenoszenie terminu — w widoku listy.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((w) => (
            <div key={w}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{WEEK_PHASES[w].name}</h3>
              <ul className="flex flex-col gap-2">
                {sessions
                  .filter((s) => s.week === w)
                  .map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                      <div className="w-14 text-center">
                        <div className="text-xs text-muted">{WEEKDAYS_SHORT[(parseISODate(s.scheduled_date).getDay() + 6) % 7]}</div>
                        <div className="font-semibold">{formatDateShort(s.scheduled_date)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted">{s.focus}</div>
                      </div>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      <div className="flex gap-1.5">
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

      <Card title="Objętość tygodniowa" subtitle={`Serie robocze na grupę mięśniową — tydzień ${currentWeek} (główna partia = 1 seria, pomocnicza = 0,5)`} className="mt-6">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((g) => {
            const v = volume[g] ?? 0;
            const guide = profile ? VOLUME_GUIDE[profile.experience] : [10, 18];
            const pct = Math.min(100, (v / guide[1]) * 100);
            const tone = g === "core" || g === "grip" ? "olive" : v < guide[0] ? "warn" : "ok";
            return (
              <div key={g}>
                <div className="flex justify-between text-sm">
                  <span>{MUSCLE_GROUP_LABELS[g]}</span>
                  <span className="tabular-nums text-muted">{fmt(v, 1)} serii</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-3">
                  <div className={cx("bar-fill h-full rounded-full", tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-olive")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Orientacyjny zakres dla Twojego poziomu: {profile ? VOLUME_GUIDE[profile.experience].join("–") : "10–18"} serii/tydz. na główne partie. Tułów i chwyt trenowane są dodatkowo w blokach funkcjonalnych.</p>
      </Card>

      <Card title="Cykle i plan" className="mt-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCycleOpen(true)}>
            Generuj kolejny miesiąc
          </Button>
          <LinkButton href="/postepy?tab=cykle" variant="ghost">
            Poprzednie cykle
          </LinkButton>
        </div>
      </Card>

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
