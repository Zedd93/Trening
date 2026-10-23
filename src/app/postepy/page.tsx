"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useData, useGoals, useProfile, useToday } from "@/lib/hooks";
import { Badge, Button, Card, Empty, Input, Notice, NumberInput, PageHeader, Segmented, Stat } from "@/components/ui";
import { COLORS, TimeChart } from "@/components/charts";
import { IconTrash } from "@/components/icons";
import { addMeasurement, deleteMeasurement } from "@/lib/actions/profile";
import { weeklyReport, weightTrend, type WeeklyReportData } from "@/lib/analytics/analytics";
import { createRecord } from "@/lib/data/store";
import { latestWeight, programSessions } from "@/lib/selectors";
import { addDays, formatDateFull, startOfWeek, weekdayIndex } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";

function ProgressInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"pomiary" | "raport" | "cykle">((params.get("tab") as "pomiary" | "raport" | "cykle") ?? "pomiary");
  return (
    <>
      <PageHeader
        title="Postępy"
        action={
          <Segmented
            ariaLabel="Sekcja"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pomiary", label: "Pomiary" },
              { value: "raport", label: "Raport tygodniowy" },
              { value: "cykle", label: "Cykle" },
            ]}
          />
        }
      />
      {tab === "pomiary" && <Measurements />}
      {tab === "raport" && <Report />}
      {tab === "cykle" && <Cycles />}
    </>
  );
}

function Measurements() {
  const data = useData();
  const todayDate = useToday();
  const [date, setDate] = useState(todayDate);
  const [w, setW] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const list = useMemo(() => Object.values(data.body_measurements).sort((a, b) => b.date.localeCompare(a.date)), [data.body_measurements]);
  const trend = weightTrend(list);
  const checkins = Object.values(data.daily_checkins).sort((a, b) => a.date.localeCompare(b.date)).slice(-28);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Nowy pomiar">
        <form
          className="grid gap-3 sm:grid-cols-5 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (w === null && waist === null) return setErr("Podaj masę ciała lub obwód pasa.");
            if (w !== null && (w < 30 || w > 300)) return setErr("Masa poza zakresem 30–300 kg.");
            if (waist !== null && (waist < 40 || waist > 250)) return setErr("Obwód poza zakresem 40–250 cm.");
            setErr(null);
            addMeasurement(date, w, waist, note);
            setW(null);
            setWaist(null);
            setNote("");
          }}
        >
          <Input label="Data" type="date" value={date} max={todayDate} onChange={(e) => setDate(e.target.value)} />
          <NumberInput label="Masa ciała" suffix="kg" step={0.1} value={w} onChange={setW} />
          <NumberInput label="Obwód pasa" suffix="cm" step={0.5} value={waist} onChange={setWaist} />
          <Input label="Notatka" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" variant="primary">
            Zapisz pomiar
          </Button>
        </form>
        {err && <Notice tone="bad">{err}</Notice>}
        <p className="mt-2 text-xs text-muted">Pojedynczy pomiar może różnić się o 1–2 kg z powodu wody i treści przewodu pokarmowego — oceniaj trend, nie pojedyncze wyniki.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Masa ciała">
          <TimeChart
            ariaLabel="Masa ciała w czasie"
            unit="kg"
            data={trend.map((p) => ({ date: p.date, waga: p.weight, trend: p.trend }))}
            series={[
              { key: "waga", name: "Pomiar", color: COLORS.muted, dot: true },
              { key: "trend", name: "Trend", color: COLORS.olive },
            ]}
          />
        </Card>
        <Card title="Obwód pasa">
          <TimeChart
            ariaLabel="Obwód pasa w czasie"
            unit="cm"
            data={[...list].reverse().filter((m) => m.waist_cm !== null).map((m) => ({ date: m.date, pas: m.waist_cm }))}
            series={[{ key: "pas", name: "Pas", color: COLORS.sand, dot: true }]}
          />
        </Card>
        <Card title="Samopoczucie (ostatnie 4 tygodnie)" className="lg:col-span-2">
          <TimeChart
            ariaLabel="Zmęczenie i sen"
            data={checkins.map((c) => ({ date: c.date, zmeczenie: c.fatigue, sen: c.sleep_quality, bolesnosc: c.soreness }))}
            yDomain={[1, 5]}
            series={[
              { key: "zmeczenie", name: "Zmęczenie", color: COLORS.warn, dot: true },
              { key: "sen", name: "Sen", color: COLORS.ok, dot: true },
              { key: "bolesnosc", name: "Bolesność", color: COLORS.steel, dashed: true },
            ]}
          />
        </Card>
      </div>
      <Card title="Historia pomiarów">
        {list.length === 0 ? (
          <Empty title="Brak pomiarów" />
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {list.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-24 text-muted">{formatDateFull(m.date)}</span>
                <span className="w-24">{m.weight_kg !== null ? `${fmt(m.weight_kg, 1)} kg` : "—"}</span>
                <span className="w-24">{m.waist_cm !== null ? `${fmt(m.waist_cm, 1)} cm` : "—"}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{m.note}</span>
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-bad" onClick={() => deleteMeasurement(m.id)} aria-label={`Usuń pomiar z ${m.date}`}>
                  <IconTrash width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Report() {
  const data = useData();
  const profile = useProfile();
  const goals = useGoals();
  const todayDate = useToday();
  // Raport za ostatni zakończony tydzień; w niedzielę — za bieżący.
  const defaultStart = weekdayIndex(todayDate) === 6 ? startOfWeek(todayDate) : addDays(startOfWeek(todayDate), -7);
  const [ws, setWs] = useState(defaultStart);
  const [saved, setSaved] = useState(false);
  const r: WeeklyReportData = useMemo(
    () =>
      weeklyReport({
        week_start: ws,
        measurements: Object.values(data.body_measurements),
        log: Object.values(data.food_log_entries),
        targets: Object.values(data.nutrition_targets),
        sessions: Object.values(data.workout_sessions),
        sets: Object.values(data.exercise_sets),
        checkins: Object.values(data.daily_checkins),
        goal: goals.primary,
        weight_kg: latestWeight(data) ?? profile?.weight_kg ?? 80,
      }),
    [ws, data, goals.primary, profile],
  );
  const archived = Object.values(data.weekly_reports).sort((a, b) => b.week_start.localeCompare(a.week_start));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setWs(addDays(ws, -7))}>
          ← Poprzedni
        </Button>
        <span className="text-sm font-medium">
          {formatDateFull(r.week_start)} – {formatDateFull(r.week_end)}
        </span>
        <Button size="sm" variant="outline" onClick={() => setWs(addDays(ws, 7))} disabled={addDays(ws, 7) > todayDate}>
          Następny →
        </Button>
        <Badge tone={r.quality.label === "dobra" ? "ok" : r.quality.label === "umiarkowana" ? "olive" : "warn"}>Jakość danych: {r.quality.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Średnia masa" value={r.weight_avg !== null ? `${fmt(r.weight_avg, 1)} kg` : "—"} sub={r.weight_change !== null ? `${r.weight_change >= 0 ? "+" : ""}${fmt(r.weight_change, 2)} kg vs poprz. tydzień` : "brak porównania"} />
        <Stat label="Obwód pasa" value={r.waist_change !== null ? `${r.waist_change >= 0 ? "+" : ""}${fmt(r.waist_change, 1)} cm` : "—"} sub="zmiana" />
        <Stat label="Treningi" value={`${r.sessions_done}/${r.sessions_planned}`} tone={r.sessions_done >= r.sessions_planned && r.sessions_planned > 0 ? "ok" : undefined} />
        <Stat label="Zmiana siły" value={r.strength_change_pct !== null ? `${r.strength_change_pct >= 0 ? "+" : ""}${fmt(r.strength_change_pct, 1)}%` : "—"} sub="e1RM ćw. głównych" />
        <Stat label="Średnie kcal" value={r.kcal_avg ?? "—"} sub={r.kcal_target ? `cel ${r.kcal_target}` : undefined} />
        <Stat label="Średnie białko" value={r.protein_avg !== null ? `${r.protein_avg} g` : "—"} sub={r.protein_target ? `cel ${r.protein_target} g` : undefined} />
        <Stat label="Zgodność kcal / białko" value={`${r.adherence_kcal_pct ?? "—"}% / ${r.adherence_protein_pct ?? "—"}%`} />
        <Stat label="Regeneracja" value={r.recovery_avg ?? "—"} sub={`zmęczenie ${r.fatigue_avg ?? "—"}/5 · sen ${r.sleep_avg ?? "—"}/5`} />
      </div>
      <Card title="Rekomendacje na kolejny tydzień">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {r.recommendations.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {r.quality.notes.length > 0 && (
          <div className="mt-3">
            <Notice>
              <strong>Ocena jakości danych:</strong> {r.quality.notes.join(" ")} Wnioski z pojedynczych zapisów są orientacyjne.
            </Notice>
          </div>
        )}
        {r.alerts.map((a) => (
          <div key={a.title} className="mt-3">
            <Notice tone="warn" title={a.title}>
              {a.causes.join(" ")}
              <ul className="mt-1 list-disc pl-5">
                {a.actions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Notice>
          </div>
        ))}
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            createRecord("weekly_reports", { week_start: r.week_start, data: r as unknown as Record<string, unknown> });
            setSaved(true);
          }}
          disabled={saved}
        >
          {saved ? "Zapisano w archiwum ✓" : "Zapisz raport w archiwum"}
        </Button>
      </Card>
      {archived.length > 0 && (
        <Card title="Archiwum raportów">
          <ul className="flex flex-col divide-y divide-line text-sm">
            {archived.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <button className="text-olive-strong" onClick={() => setWs(a.week_start)}>
                  Tydzień od {formatDateFull(a.week_start)}
                </button>
                <span className="text-muted">
                  {(a.data as { sessions_done?: number }).sessions_done ?? "—"} treningów · {(a.data as { kcal_avg?: number }).kcal_avg ?? "—"} kcal
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Cycles() {
  const data = useData();
  const programs = Object.values(data.training_programs).sort((a, b) => b.cycle_number - a.cycle_number);
  if (!programs.length) return <Empty title="Brak cykli" />;
  return (
    <ul className="flex flex-col gap-3">
      {programs.map((p) => {
        const ss = programSessions(data, p.id);
        const done = ss.filter((s) => s.status === "completed").length;
        return (
          <li key={p.id}>
            <Card title={p.name} subtitle={`Start ${formatDateFull(p.start_date)} · ${done}/${ss.length} treningów`} action={<Badge tone={p.status === "active" ? "ok" : "neutral"}>{p.status === "active" ? "aktywny" : "zakończony"}</Badge>}>
              <div className="flex flex-wrap gap-2">
                {ss
                  .filter((s) => s.status === "completed")
                  .slice(-6)
                  .map((s) => (
                    <Link key={s.id} href={`/trening/sesja/${s.id}`} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs hover:text-olive-strong">
                      {s.template} · tydz. {s.week}
                    </Link>
                  ))}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default function ProgressPage() {
  return (
    <Suspense>
      <ProgressInner />
    </Suspense>
  );
}
