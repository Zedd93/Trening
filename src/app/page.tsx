"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActiveProgram, useData, useGoals, useProfile, useToday } from "@/lib/hooks";
import { Badge, Card, Gauge, LinkButton, Notice, PageHeader, Progress, Segmented, Select, Stat, cx } from "@/components/ui";
import { COLORS, TimeChart, SimpleBars } from "@/components/charts";
import { QuickCheckin } from "@/components/QuickCheckin";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { addDays, diffDays, formatDateLong, formatDateShort, rangeDays, startOfWeek, WEEKDAYS_SHORT } from "@/lib/utils/dates";
import { avg, fmt, round, sum } from "@/lib/utils/format";
import { dayTypeOn, getTarget, latestWeight, sessionExercises } from "@/lib/selectors";
import { nextSession } from "@/lib/training/schedule";
import { WEEK_PHASES } from "@/lib/training/generator";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import { dailyIntake, isLoggedDay, muscleProtectionAlerts, sessionVolume, strengthChangePct, strengthHistory, weightTrend } from "@/lib/analytics/analytics";
import { GOAL_LABELS } from "@/lib/labels";

export default function Dashboard() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const profile = useProfile();
  const goals = useGoals();
  const todayDate = useToday();
  return (
    <>
      <PageHeader
        eyebrow={`// Odprawa · ${formatDateLong(todayDate)}`}
        title={profile?.display_name ? `Cześć, ${profile.display_name}` : "Pulpit"}
        subtitle={`Cel główny: ${GOAL_LABELS[goals.primary]}`}
        action={
          <Segmented
            ariaLabel="Widok pulpitu"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Dzień" },
              { value: "week", label: "Tydzień" },
              { value: "month", label: "Cykl" },
            ]}
          />
        }
      />
      {view === "day" && <DayView />}
      {view === "week" && <WeekView />}
      {view === "month" && <MonthView />}
    </>
  );
}

function DayView() {
  const data = useData();
  const todayDate = useToday();
  const { program, sessions } = useActiveProgram();
  const goals = useGoals();
  const profile = useProfile();
  const todaySession = sessions.find((s) => s.scheduled_date === todayDate && s.status !== "skipped");
  const next = nextSession(sessions, todayDate);
  const target = getTarget(data, todayDate);
  const dt = target ? (target.calorie_mode === "cycling" ? target.day_targets[dayTypeOn(data, todayDate)] : target) : null;
  const log = Object.values(data.food_log_entries).filter((e) => e.date === todayDate);
  const kcal = sum(log.map((e) => e.kcal));
  const protein = sum(log.map((e) => e.protein_g));
  const weight = latestWeight(data);
  const trend = weightTrend(Object.values(data.body_measurements));
  const dayOfProgram = program ? diffDays(todayDate, program.start_date) + 1 : null;
  const week = todaySession?.week ?? next?.week ?? (program && dayOfProgram ? Math.min(4, Math.max(1, Math.ceil(dayOfProgram / 7))) : null);
  const wk = startOfWeek(todayDate);
  const weekSessions = sessions.filter((s) => s.scheduled_date >= wk && s.scheduled_date <= addDays(wk, 6));
  const weekDone = weekSessions.filter((s) => s.status === "completed").length;
  const loggedDays = dailyIntake(Object.values(data.food_log_entries), wk, todayDate).filter(isLoggedDay).length;

  const alerts = useMemo(() => {
    const from = addDays(todayDate, -14);
    const w = trend.filter((p) => p.date >= from);
    const ch = w.length >= 2 ? ((w.at(-1)!.trend - w[0].trend) / Math.max(1, diffDays(w.at(-1)!.date, w[0].date))) * 7 : null;
    const intake = dailyIntake(Object.values(data.food_log_entries), addDays(todayDate, -7), addDays(todayDate, -1)).filter(isLoggedDay);
    return muscleProtectionAlerts({
      weight_change_pct_per_week: ch !== null && weight ? (ch / weight) * 100 : null,
      strength_change_pct: strengthChangePct(Object.values(data.exercise_sets), data.workout_sessions, addDays(todayDate, -21), todayDate),
      avg_fatigue: avg(Object.values(data.daily_checkins).filter((c) => c.date >= addDays(todayDate, -7)).map((c) => c.fatigue)),
      avg_protein: intake.length >= 4 ? avg(intake.map((d) => d.protein_g)) : null,
      protein_target: target?.protein_g ?? null,
      goal: goals.primary,
    });
  }, [trend, data, todayDate, weight, target, goals.primary]);

  const sessionForCta = todaySession ?? next;
  const firstEx = sessionForCta ? sessionExercises(data, sessionForCta.id)[0] : undefined;
  const pendingRecs = Object.values(data.progression_recommendations).filter((r) => r.status === "pending" && r.target_session_id);

  const exList = sessionForCta ? sessionExercises(data, sessionForCta.id).filter((e) => e.block !== "conditioning") : [];
  const trendLast = trend.at(-1);
  const trendPrev = trend.filter((p) => p.date <= addDays(todayDate, -7)).at(-1);

  return (
    <div className="stagger flex flex-col gap-4">
      {/* Misja dnia */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="hud hud-accent relative overflow-hidden rounded-2xl p-5 sm:p-6">
          <div aria-hidden className="stripes absolute right-0 top-0 h-1.5 w-40 opacity-60" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow text-olive-strong">{todaySession ? "Misja dnia" : "Następna misja"}</span>
            {program && dayOfProgram !== null && dayOfProgram >= 1 && dayOfProgram <= 28 && week && <Badge tone="olive">Dzień {dayOfProgram} · {WEEK_PHASES[week].name.split(" — ")[1]}</Badge>}
            {program && dayOfProgram !== null && dayOfProgram < 1 && <Badge>Start {formatDateShort(program.start_date)}</Badge>}
          </div>
          {sessionForCta ? (
            <div className="mt-3 flex gap-5">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[34px] font-extrabold uppercase leading-[0.9] tracking-wide sm:text-5xl">
                  {sessionForCta.title.split(" — ")[0]}
                  <span className="block text-olive-strong">{sessionForCta.title.split(" — ")[1]}</span>
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {!todaySession && <span className="text-fg">{formatDateLong(sessionForCta.scheduled_date)} · </span>}
                  {sessionForCta.focus}
                </p>
                <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  {exList.slice(0, 6).map((e, i) => (
                    <li key={e.id} className="flex items-baseline gap-2 text-sm">
                      <span className="font-data text-xs text-olive-strong">{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate">{EXERCISE_MAP[e.exercise_id]?.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {firstEx && (
                <div className="hidden shrink-0 sm:block">
                  <ExerciseAnimation exerciseId={firstEx.exercise_id} size="md" />
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Brak zaplanowanych treningów. Wygeneruj kolejny cykl w zakładce Trening.</p>
          )}
          <div className="mt-5 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
            {sessionForCta && (
              <LinkButton href={`/trening/sesja/${sessionForCta.id}`} variant="primary" size="lg" className="w-full">
                {sessionForCta.status === "in_progress" ? "Kontynuuj trening" : todaySession ? "Rozpocznij dzisiejszy trening" : "Zobacz następny trening"}
              </LinkButton>
            )}
            <LinkButton href="/dieta?dodaj=1" variant="outline" size="lg" className="w-full">
              Dodaj posiłek
            </LinkButton>
          </div>
        </section>

        <Card eyebrow="Paliwo · dziś" title="Bilans" action={<Link href="/dieta" className="font-mono text-xs uppercase tracking-wider text-olive-strong">Dziennik →</Link>}>
          {dt ? (
            <>
              <div className="flex justify-around gap-2">
                <Gauge value={kcal} max={dt.kcal} label="Kalorie" unit="kcal" size={128} />
                <Gauge value={protein} max={dt.protein_g} label="Białko" unit="g" size={128} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center">
                <div>
                  <div className="eyebrow">Pozostało</div>
                  <div className={cx("font-data mt-1 text-lg font-semibold", dt.kcal - kcal < 0 ? "text-warn" : "text-ok")}>{fmt(dt.kcal - kcal)} kcal</div>
                </div>
                <div>
                  <div className="eyebrow">Do celu białka</div>
                  <div className="font-data mt-1 text-lg font-semibold">{fmt(Math.max(0, dt.protein_g - protein))} g</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Ustaw cele żywieniowe.</p>
          )}
        </Card>
      </div>

      {/* Tydzień + wskaźniki */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card eyebrow={`Tydzień · ${weekDone}/${weekSessions.length || 0} treningów`} title="Plan tygodnia">
          <div className="grid grid-cols-7 gap-1.5">
            {rangeDays(wk, addDays(wk, 6)).map((d, i) => {
              const s = sessions.find((x) => x.scheduled_date === d);
              const isToday = d === todayDate;
              return (
                <Link
                  key={d}
                  href={s ? `/trening/sesja/${s.id}` : "/trening"}
                  className={cx(
                    "flex aspect-[3/4] flex-col items-center justify-between rounded-lg border py-2 transition-colors",
                    isToday ? "border-olive bg-olive-dim/40" : "border-line bg-bg/40 hover:border-line-strong",
                  )}
                  aria-label={`${WEEKDAYS_SHORT[i]} ${formatDateShort(d)}${s ? `: trening ${s.template}` : ": odpoczynek"}`}
                >
                  <span className={cx("font-mono text-[10px] uppercase", isToday ? "text-olive-strong" : "text-muted")}>{WEEKDAYS_SHORT[i]}</span>
                  <span
                    className={cx(
                      "font-display text-2xl font-extrabold leading-none",
                      s?.status === "completed" ? "text-ok" : s?.status === "skipped" ? "text-warn line-through" : s ? "text-fg" : "text-muted/40",
                    )}
                  >
                    {s ? s.template : "·"}
                  </span>
                  <span className="font-data text-[10px] text-muted">{formatDateShort(d).slice(0, 2)}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4">
            <Progress label="Dni z pełnym dziennikiem" value={loggedDays} max={diffDays(todayDate, wk) + 1} showValues={`${loggedDays}/${diffDays(todayDate, wk) + 1}`} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Masa ciała" value={weight ? `${fmt(weight, 1)}` : "—"} sub={trendLast ? `trend ${fmt(trendLast.trend, 1)} kg` : "zważ się rano"} />
          <Stat
            label="Zmiana 7 dni"
            value={trendLast && trendPrev ? `${trendLast.trend - trendPrev.trend >= 0 ? "+" : ""}${fmt(trendLast.trend - trendPrev.trend, 1)}` : "—"}
            sub="kg (trend)"
          />
          <Stat label="Treningi w cyklu" value={`${sessions.filter((s) => s.status === "completed").length}/${sessions.length}`} sub="ukończone" />
          <Link href="/asystent" className="hud group flex flex-col justify-between rounded-xl p-3 hover:border-olive">
            <span className="eyebrow">Asystent</span>
            <span className="text-sm leading-snug">Zapytaj, co trenować i ile białka zostało →</span>
          </Link>
        </div>
      </div>

      {alerts.map((a) => (
        <Notice key={a.title} tone={a.level === "warning" ? "warn" : "info"} title={a.title}>
          {a.causes.map((c) => (
            <p key={c}>{c}</p>
          ))}
          <ul className="mt-1 list-disc pl-5">
            {a.actions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Notice>
      ))}
      {pendingRecs.length > 0 && (
        <Notice title="Progresja do zatwierdzenia">
          {pendingRecs.length} {pendingRecs.length === 1 ? "rekomendacja czeka" : "rekomendacji czeka"} na decyzję przy kolejnych treningach.{" "}
          <Link href="/trening" className="text-olive-strong underline">
            Zobacz plan
          </Link>
        </Notice>
      )}
      {profile?.has_contraindications && <Notice tone="warn">Zgłoszono przeciwwskazania do intensywnego wysiłku — trenuj w obniżonej intensywności i zgodnie z zaleceniami lekarza.</Notice>}

      <QuickCheckin date={todayDate} />
    </div>
  );
}

function WeekView() {
  const data = useData();
  const todayDate = useToday();
  const { sessions } = useActiveProgram();
  const from = addDays(todayDate, -13);
  const days = dailyIntake(Object.values(data.food_log_entries), from, todayDate);
  const trend = weightTrend(Object.values(data.body_measurements)).filter((p) => p.date >= addDays(todayDate, -27));
  const mains = useMemo(() => Array.from(new Set(Object.values(data.exercise_sets).filter((s) => s.completed && s.weight_kg).map((s) => s.exercise_id))), [data.exercise_sets]);
  const [ex, setEx] = useState<string>("");
  const exId = ex || mains[0] || "";
  const strength = exId ? strengthHistory(exId, Object.values(data.exercise_sets), data.workout_sessions) : [];
  const wk = startOfWeek(todayDate);
  const activeDays = rangeDays(wk, todayDate).filter(
    (d) => sessions.some((s) => s.status === "completed" && s.completed_at?.slice(0, 10) === d) || Object.values(data.daily_checkins).some((c) => c.date === d && (c.steps ?? 0) >= 7000),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Kalendarz treningów — bieżący tydzień">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {rangeDays(wk, addDays(wk, 6)).map((d, i) => {
            const s = sessions.filter((x) => x.scheduled_date === d);
            return (
              <div key={d} className={cx("rounded-xl border p-2", d === todayDate ? "border-olive" : "border-line")}>
                <div className="text-muted">{WEEKDAYS_SHORT[i]}</div>
                <div className="text-[11px] text-muted">{formatDateShort(d)}</div>
                {s.map((x) => (
                  <Link key={x.id} href={`/trening/sesja/${x.id}`} className={cx("mt-1 block rounded-md py-1 font-semibold", x.status === "completed" ? "bg-ok/20 text-ok" : x.status === "skipped" ? "bg-warn/15 text-warn" : "bg-olive-dim text-olive-strong")}>
                    {x.template}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">Dni aktywne w tym tygodniu (trening lub ≥ 7000 kroków): {activeDays}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Masa ciała" subtitle="Pomiary i trend (średnia wykładnicza) — 4 tygodnie">
          <TimeChart
            ariaLabel="Wykres masy ciała"
            unit="kg"
            data={trend.map((p) => ({ date: p.date, waga: p.weight, trend: p.trend }))}
            series={[
              { key: "waga", name: "Pomiar", color: COLORS.muted, dot: true },
              { key: "trend", name: "Trend", color: COLORS.olive },
            ]}
          />
        </Card>
        <Card title="Bilans kalorii" subtitle="Spożycie vs cel — 14 dni">
          <TimeChart
            ariaLabel="Wykres bilansu kalorii"
            unit="kcal"
            data={days.map((d) => {
              const t = getTarget(data, d.date);
              const dt = t ? (t.calorie_mode === "cycling" ? t.day_targets[dayTypeOn(data, d.date)] : t) : null;
              return { date: d.date, spozycie: d.entries ? d.kcal : null, cel: dt?.kcal ?? null };
            })}
            series={[
              { key: "spozycie", name: "Spożycie", color: COLORS.olive, type: "bar" },
              { key: "cel", name: "Cel", color: COLORS.warn, dashed: true },
            ]}
          />
        </Card>
        <Card title="Białko" subtitle="Spożycie dzienne — 14 dni">
          <TimeChart
            ariaLabel="Wykres spożycia białka"
            unit="g"
            data={days.map((d) => ({ date: d.date, bialko: d.entries ? d.protein_g : null }))}
            series={[{ key: "bialko", name: "Białko", color: COLORS.blue, type: "bar" }]}
            reference={getTarget(data, todayDate) ? { y: getTarget(data, todayDate)!.protein_g, label: "cel" } : undefined}
          />
        </Card>
        <Card
          title="Progresja ćwiczenia"
          action={
            mains.length > 0 ? (
              <Select aria-label="Ćwiczenie" value={exId} onChange={(e) => setEx(e.target.value)} className="h-9 w-48 text-sm">
                {mains.map((m) => (
                  <option key={m} value={m}>
                    {EXERCISE_MAP[m]?.name ?? m}
                  </option>
                ))}
              </Select>
            ) : undefined
          }
        >
          <TimeChart
            ariaLabel="Wykres progresji ćwiczenia"
            unit="kg"
            data={strength.map((p) => ({ date: p.date, ciezar: p.top_weight, e1rm: p.e1rm }))}
            series={[
              { key: "ciezar", name: "Ciężar roboczy", color: COLORS.olive, dot: true },
              { key: "e1rm", name: "Szac. 1RM", color: COLORS.blue, dashed: true },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function MonthView() {
  const data = useData();
  const { program, sessions } = useActiveProgram();
  const todayDate = useToday();
  const cmp = useMemo(() => {
    if (!program) return null;
    const start = program.start_date;
    const weeks = [0, 1, 2, 3].map((w) => {
      const a = addDays(start, w * 7);
      const b = addDays(a, 6);
      const ss = sessions.filter((s) => s.week === w + 1);
      const done = ss.filter((s) => s.status === "completed");
      const intake = dailyIntake(Object.values(data.food_log_entries), a, b < todayDate ? b : todayDate).filter(isLoggedDay);
      const t = getTarget(data, b);
      const adherence = intake.length && t ? round(avg(intake.map((d) => 100 - Math.min(100, (Math.abs(d.kcal - t.kcal) / t.kcal) * 100)))!, 0) : null;
      const ms = Object.values(data.body_measurements).filter((m) => m.date >= a && m.date <= b);
      const wts = ms.filter((m) => m.weight_kg !== null).map((m) => m.weight_kg!);
      const waists = ms.filter((m) => m.waist_cm !== null).map((m) => m.waist_cm!);
      return {
        label: `T${w + 1}`,
        realizacja: ss.length ? Math.round((done.length / ss.length) * 100) : 0,
        objetosc: sum(done.map((s) => sessionVolume(s.id, Object.values(data.exercise_sets)))),
        zgodnosc: adherence,
        waga: wts.length ? round(avg(wts)!, 1) : null,
        pas: waists.length ? round(avg(waists)!, 1) : null,
      };
    });
    const mainIds = Array.from(new Set(sessions.flatMap((s) => sessionExercises(data, s.id)).filter((e) => e.block === "strength").map((e) => e.exercise_id)));
    const loads = mainIds
      .map((id) => {
        const h = strengthHistory(id, Object.values(data.exercise_sets), data.workout_sessions).filter((p) => p.date >= start);
        return { id, first: h[0]?.top_weight ?? null, last: h.at(-1)?.top_weight ?? null };
      })
      .filter((l) => l.first !== null);
    return { weeks, loads };
  }, [program, sessions, data, todayDate]);

  if (!program || !cmp) return <Notice>Brak aktywnego cyklu.</Notice>;
  const firstW = cmp.weeks.find((w) => w.waga !== null)?.waga ?? null;
  const lastW = [...cmp.weeks].reverse().find((w) => w.waga !== null)?.waga ?? null;
  const firstWaist = cmp.weeks.find((w) => w.pas !== null)?.pas ?? null;
  const lastWaist = [...cmp.weeks].reverse().find((w) => w.pas !== null)?.pas ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card title={`${program.name}: początek vs koniec`} subtitle={`Start ${formatDateShort(program.start_date)} · średnie tygodniowe`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Masa ciała" value={firstW !== null && lastW !== null ? `${lastW - firstW >= 0 ? "+" : ""}${fmt(lastW - firstW, 1)} kg` : "—"} sub={firstW !== null ? `${fmt(firstW, 1)} → ${fmt(lastW, 1)} kg` : "brak pomiarów"} />
          <Stat label="Obwód pasa" value={firstWaist !== null && lastWaist !== null ? `${lastWaist - firstWaist >= 0 ? "+" : ""}${fmt(lastWaist - firstWaist, 1)} cm` : "—"} sub={firstWaist !== null ? `${fmt(firstWaist, 1)} → ${fmt(lastWaist, 1)} cm` : "brak pomiarów"} />
          <Stat label="Treningi" value={`${sessions.filter((s) => s.status === "completed").length}/${sessions.length}`} sub="ukończone" />
          <Stat label="Zmiana siły" value={(() => { const v = strengthChangePct(Object.values(data.exercise_sets), data.workout_sessions, program.start_date, todayDate); return v === null ? "—" : `${v >= 0 ? "+" : ""}${fmt(v, 1)}%`; })()} sub="e1RM ćw. głównych" />
        </div>
        <p className="mt-3 text-xs text-muted">Zmiana masy ciała nie mówi, ile ubyło tkanki tłuszczowej — dlatego aplikacja nie przelicza jej na procent tłuszczu. Obwód pasa i wyniki siłowe pomagają ocenić rekompozycję.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Masa ciała i obwód pasa (średnie tygodniowe)">
          <SimpleBars ariaLabel="Masa i pas tygodniowo" xKey="label" data={cmp.weeks} bars={[{ key: "waga", name: "Masa (kg)", color: COLORS.olive }, { key: "pas", name: "Pas (cm)", color: COLORS.blue }]} />
        </Card>
        <Card title="Objętość treningowa (kg × powt.)">
          <SimpleBars ariaLabel="Objętość treningowa tygodniowo" xKey="label" data={cmp.weeks} bars={[{ key: "objetosc", name: "Objętość", color: COLORS.olive }]} />
        </Card>
        <Card title="Realizacja treningów i zgodność z planem żywienia (%)">
          <SimpleBars
            ariaLabel="Realizacja i zgodność"
            xKey="label"
            unit="%"
            data={cmp.weeks}
            bars={[
              { key: "realizacja", name: "Treningi", color: COLORS.ok },
              { key: "zgodnosc", name: "Kalorie vs cel", color: COLORS.warn },
            ]}
          />
        </Card>
        <Card title="Ciężary robocze: pierwszy vs ostatni trening">
          {cmp.loads.length === 0 ? (
            <p className="text-sm text-muted">Brak zapisanych ciężarów w tym cyklu.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {cmp.loads.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 py-2">
                  <span>{EXERCISE_MAP[l.id]?.name}</span>
                  <span className="tabular-nums">
                    {fmt(l.first, 2)} → <strong className={l.last! > l.first! ? "text-ok" : ""}>{fmt(l.last, 2)} kg</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
