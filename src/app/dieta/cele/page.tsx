"use client";

import { useMemo, useState } from "react";
import type { CalorieMode, DeficitRate, MacroMode, MacroTargets } from "@/lib/domain/types";
import { useData, useGoals, usePrefs, useProfile, useToday } from "@/lib/hooks";
import { DietNav } from "@/components/nutrition/DietNav";
import { Badge, Button, Card, Notice, NumberInput, PageHeader, Select, Stat } from "@/components/ui";
import { applyCalorieAdjustment, computeTargets, saveManualTargets } from "@/lib/actions/nutrition";
import { recalculateTargets, updatePrefs } from "@/lib/actions/profile";
import { currentTarget, latestWeight } from "@/lib/selectors";
import { dayTypeCounts, rebalance, weeklyAverage } from "@/lib/nutrition/calculator";
import { pickTrainingDays } from "@/lib/training/generator";
import { adaptiveTdee } from "@/lib/analytics/analytics";
import { formatDateFull } from "@/lib/utils/dates";
import { fmt } from "@/lib/utils/format";
import { GOAL_LABELS } from "@/lib/labels";

export default function TargetsPage() {
  const data = useData();
  const profile = useProfile();
  const prefs = usePrefs();
  const goals = useGoals();
  const todayDate = useToday();
  const target = currentTarget(data);
  const weight = latestWeight(data) ?? profile?.weight_kg ?? 0;
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState<MacroTargets | null>(null);

  const computed = useMemo(() => (profile && prefs ? computeTargets(profile, prefs, goals, weight) : null), [profile, prefs, goals, weight]);
  const adaptive = useMemo(
    () =>
      profile
        ? adaptiveTdee({
            measurements: Object.values(data.body_measurements),
            log: Object.values(data.food_log_entries),
            target,
            goal: goals.primary,
            weight_kg: weight,
            today: todayDate,
          })
        : null,
    [data.body_measurements, data.food_log_entries, target, goals.primary, weight, todayDate, profile],
  );
  const history = Object.values(data.nutrition_targets).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const counts = profile ? dayTypeCounts(pickTrainingDays(profile.training_days), profile.sports) : null;

  if (!profile || !prefs || !computed) return null;
  const m = manual ?? (target ? { kcal: target.kcal, protein_g: target.protein_g, fat_g: target.fat_g, carbs_g: target.carbs_g, fiber_g: target.fiber_g } : computed.target);

  return (
    <>
      <PageHeader title="Cele i kalkulator" subtitle={`Główny cel: ${GOAL_LABELS[goals.primary]} · masa do obliczeń: ${fmt(weight, 1)} kg`} />
      <DietNav />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Zapotrzebowanie energetyczne" subtitle="Szacunek startowy — weryfikowany trendem masy ciała">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="BMR" value={`${computed.target.bmr}`} sub="kcal" />
            <Stat label="TDEE" value={`${computed.target.tdee}`} sub="kcal (utrzymanie)" />
            <Stat label="Cel" value={`${computed.target.kcal}`} sub="kcal" />
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {computed.breakdown.map((b) => (
              <li key={b}>{b}</li>
            ))}
            <li>{computed.goalDescription}</li>
          </ul>
          {[...computed.warnings, ...computed.notes].map((w) => (
            <div key={w} className="mt-2">
              <Notice tone="warn">{w}</Notice>
            </div>
          ))}
        </Card>

        <Card title="Ustawienia obliczeń">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tryb makro" value={prefs.macro_mode} onChange={(e) => updatePrefs({ macro_mode: e.target.value as MacroMode })}>
              <option value="standard">Standardowy</option>
              <option value="high_protein">High protein (2,2 g/kg)</option>
              <option value="low_carb">Low carb</option>
              <option value="custom">Indywidualny</option>
            </Select>
            <Select label="Kaloryczność w tygodniu" value={prefs.calorie_mode} onChange={(e) => updatePrefs({ calorie_mode: e.target.value as CalorieMode })}>
              <option value="constant">Stała</option>
              <option value="cycling">Zmienna (siłownia/sport/odpoczynek)</option>
            </Select>
            {goals.primary === "fat_loss" && (
              <Select label="Tempo redukcji" value={prefs.deficit_rate} onChange={(e) => updatePrefs({ deficit_rate: e.target.value as DeficitRate })}>
                <option value="gentle">Łagodne (0,25%/tydz.)</option>
                <option value="moderate">Umiarkowane (0,5%/tydz.)</option>
                <option value="faster">Szybsze (0,75%/tydz.)</option>
              </Select>
            )}
            <NumberInput label="Ustalona kaloryczność" suffix="kcal" step={50} value={prefs.preset_kcal} onChange={(v) => updatePrefs({ preset_kcal: v })} hint="Puste = wyliczona" />
            {prefs.macro_mode === "custom" && (
              <>
                <NumberInput label="Białko" suffix="g/kg" step={0.1} value={prefs.custom_protein_g_per_kg} onChange={(v) => v && updatePrefs({ custom_protein_g_per_kg: v })} hint="Zakres 1,2–2,6" />
                <NumberInput label="Tłuszcz" suffix="% kcal" step={1} value={prefs.custom_fat_pct} onChange={(v) => v && updatePrefs({ custom_fat_pct: v })} hint="Zakres 20–50%" />
              </>
            )}
          </div>
          <Button
            variant="primary"
            className="mt-4 w-full"
            onClick={() => {
              recalculateTargets(weight);
              setManual(null);
              setMsg("Zapisano nowe cele. Poprzednie zachowano w historii.");
            }}
          >
            Przelicz i zapisz cele
          </Button>
          {msg && (
            <div className="mt-3">
              <Notice tone="ok">{msg}</Notice>
            </div>
          )}
        </Card>
      </div>

      <Card title="Aktualny cel dzienny" subtitle={target ? `od ${formatDateFull(target.valid_from)} · ${target.reason}` : undefined} className="mt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <NumberInput
            label="Kalorie"
            suffix="kcal"
            step={50}
            value={m.kcal}
            onChange={(v) => v && setManual(rebalance(v, m.protein_g, m.fat_g))}
          />
          <NumberInput label="Białko" suffix="g" value={m.protein_g} onChange={(v) => v !== null && setManual(rebalance(m.kcal, v, m.fat_g))} hint={`${fmt(m.protein_g / weight, 2)} g/kg`} />
          <NumberInput label="Tłuszcz" suffix="g" value={m.fat_g} onChange={(v) => v !== null && setManual(rebalance(m.kcal, m.protein_g, v))} hint={`${Math.round(((m.fat_g * 9) / m.kcal) * 100)}% kcal`} />
          <NumberInput label="Węglowodany" suffix="g" value={m.carbs_g} onChange={(v) => v !== null && setManual(rebalance(m.kcal, m.protein_g, Math.max(0, (m.kcal - m.protein_g * 4 - v * 4) / 9)))} hint="przelicza tłuszcz" />
          <Stat label="Błonnik" value={`${m.fiber_g} g`} sub="14 g / 1000 kcal" />
        </div>
        {manual && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => (saveManualTargets(manual), setManual(null), setMsg("Zapisano ręczną zmianę proporcji."))}>
              Zapisz zmianę proporcji
            </Button>
            <Button variant="ghost" onClick={() => setManual(null)}>
              Anuluj
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Zmiana jednej wartości automatycznie przelicza pozostałe przy zachowaniu bilansu energii (B×4 + T×9 + W×4 kcal).</p>

        {target && target.calorie_mode === "cycling" && counts && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-normal">Typ dnia</th>
                  <th className="py-1 font-normal">Dni/tydz.</th>
                  <th className="py-1 font-normal">kcal</th>
                  <th className="py-1 font-normal">B</th>
                  <th className="py-1 font-normal">T</th>
                  <th className="py-1 font-normal">W</th>
                </tr>
              </thead>
              <tbody>
                {(["gym", "sport", "rest"] as const).map((k) => (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1.5">{k === "gym" ? "Siłownia" : k === "sport" ? "Inny sport" : "Odpoczynek"}</td>
                    <td>{counts[k]}</td>
                    <td>{target.day_targets[k].kcal}</td>
                    <td>{target.day_targets[k].protein_g} g</td>
                    <td>{target.day_targets[k].fat_g} g</td>
                    <td>{target.day_targets[k].carbs_g} g</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Średnia tygodniowa: {Math.round(weeklyAverage(target.day_targets, counts))} kcal (cel {target.kcal} kcal). W dni siłowe więcej węglowodanów — najlepiej w posiłkach przed i po treningu.
            </p>
          </div>
        )}
      </Card>

      {adaptive && (
        <Card title="Weryfikacja TDEE na podstawie danych" subtitle="Trend masy ciała + faktyczne spożycie z dziennika (ostatnie 14 dni)" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone={adaptive.quality.label === "dobra" ? "ok" : adaptive.quality.label === "umiarkowana" ? "olive" : "warn"}>Jakość danych: {adaptive.quality.label} ({adaptive.quality.score}/100)</Badge>
            {adaptive.estimated_tdee && <Badge>Szacowane TDEE: {adaptive.estimated_tdee} kcal</Badge>}
            {adaptive.weight_change_per_week !== null && <Badge>Trend: {fmt(adaptive.weight_change_per_week, 2)} kg/tydz.</Badge>}
          </div>
          <p className="text-sm">{adaptive.message}</p>
          {adaptive.quality.notes.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted">
              {adaptive.quality.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {adaptive.proposal && (
            <div className="mt-3 rounded-xl border border-olive/40 bg-olive-dim/30 p-3">
              <div className="font-semibold">
                Propozycja: {target?.kcal} → {adaptive.proposal.new_kcal} kcal ({adaptive.proposal.delta > 0 ? "+" : ""}
                {adaptive.proposal.delta})
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                {adaptive.proposal.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    applyCalorieAdjustment(adaptive.proposal!.new_kcal, `Korekta po analizie trendu (${adaptive.proposal!.delta > 0 ? "+" : ""}${adaptive.proposal!.delta} kcal)`, adaptive.estimated_tdee);
                    setMsg("Zatwierdzono korektę kalorii.");
                  }}
                >
                  Zatwierdź zmianę
                </Button>
                <Button variant="ghost" onClick={() => setMsg("Pozostawiono obecny cel. Ocena zostanie powtórzona przy kolejnych danych.")}>
                  Odrzuć
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Kalorie nigdy nie zmieniają się automatycznie — po pojedynczym pomiarze nie formułujemy wniosków. Każda zmiana wymaga Twojego zatwierdzenia.</p>
        </Card>
      )}

      <Card title="Historia celów" className="mt-4">
        <ul className="flex flex-col divide-y divide-line text-sm">
          {history.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {formatDateFull(t.valid_from)} · <strong>{t.kcal} kcal</strong> · B {t.protein_g} / T {t.fat_g} / W {t.carbs_g} g
              </span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {t.reason}
                {t.active && <Badge tone="ok">aktywny</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
