"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Allergen, Budget, DietStyle, Equipment, Experience, GoalType, Injury, InjuryArea, JobActivity, MacroMode, Sex, Sport } from "@/lib/domain/types";
import { Button, Chips, Field, Input, Notice, NumberInput, Select, Textarea, Toggle, cx } from "@/components/ui";
import { IconLogo } from "@/components/icons";
import { EQUIPMENT_LABELS, INJURY_LABELS } from "@/lib/training/exercises";
import { ALLERGEN_LABELS } from "@/lib/nutrition/foods";
import { completeOnboarding, defaultPrefs, type PrefsInput, type ProfileInput } from "@/lib/actions/profile";
import { computeTargets } from "@/lib/actions/nutrition";
import { generateProgram, pickTrainingDays } from "@/lib/training/generator";
import { defaultMealNames } from "@/lib/nutrition/meals";
import { addDays, formatDateFull, startOfWeek, today, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "@/lib/utils/dates";
import { bmi } from "@/lib/nutrition/calculator";
import { useApp } from "@/lib/data/store";
import { GOAL_LABELS } from "@/lib/labels";

const EQUIPMENT_PRESETS: { label: string; items: Equipment[] }[] = [
  { label: "Pełna siłownia", items: ["barbell", "squat_rack", "bench", "dumbbells", "kettlebell", "pullup_bar", "cable", "machines", "trap_bar", "dip_station", "air_bike", "rower", "bike", "sled", "bands", "medicine_ball", "ab_wheel"] },
  { label: "Siłownia podstawowa", items: ["barbell", "squat_rack", "bench", "dumbbells", "pullup_bar", "cable", "bike", "bands"] },
  { label: "Dom: hantle + drążek", items: ["dumbbells", "bench", "pullup_bar", "bands", "kettlebell"] },
  { label: "Minimum (masa ciała + gumy)", items: ["bands"] },
];

const STEPS = ["Dane podstawowe", "Aktywność", "Sprzęt", "Zdrowie", "Cele", "Żywienie", "Podsumowanie"];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useApp((s) => s.user);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [p, setP] = useState<ProfileInput>({
    display_name: user?.display_name ?? "",
    birth_year: 1995,
    sex: "male",
    height_cm: 180,
    weight_kg: 80,
    waist_cm: null,
    target_weight_kg: null,
    experience: "intermediate",
    job_activity: "sedentary",
    avg_steps: 7000,
    sports: [],
    strength_sessions_per_week: 3,
    session_minutes: 60,
    training_days: [0, 2, 4],
    equipment: EQUIPMENT_PRESETS[0].items,
    injuries: [],
    has_contraindications: false,
    contraindications_note: "",
  });
  const [maintain, setMaintain] = useState(false);
  const [goals, setGoals] = useState<GoalType[]>(["recomposition"]);
  const [primary, setPrimary] = useState<GoalType>("recomposition");
  const [prefs, setPrefs] = useState<PrefsInput>(defaultPrefs());
  const [excludedText, setExcludedText] = useState("");
  const [favText, setFavText] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const t = today();
    return startOfWeek(t) === t ? t : addDays(startOfWeek(t), 7);
  });

  const up = (patch: Partial<ProfileInput>) => setP((x) => ({ ...x, ...patch }));
  const upPrefs = (patch: Partial<PrefsInput>) => setPrefs((x) => ({ ...x, ...patch }));
  const finalPrefs: PrefsInput = useMemo(
    () => ({
      ...prefs,
      excluded_foods: excludedText.split(",").map((s) => s.trim()).filter(Boolean),
      favorite_foods: favText.split(",").map((s) => s.trim()).filter(Boolean),
    }),
    [prefs, excludedText, favText],
  );

  function validate(s: number): string[] {
    const e: string[] = [];
    const age = new Date().getFullYear() - p.birth_year;
    if (s === 0) {
      if (age < 18) e.push("Aplikacja jest przeznaczona dla osób dorosłych (18+). Wzory i zalecenia nie są dostosowane do młodzieży.");
      if (age > 100) e.push("Sprawdź rok urodzenia.");
      if (p.height_cm < 120 || p.height_cm > 230) e.push("Wzrost poza zakresem 120–230 cm.");
      if (p.weight_kg < 35 || p.weight_kg > 300) e.push("Masa ciała poza zakresem 35–300 kg.");
      if (p.waist_cm !== null && (p.waist_cm < 40 || p.waist_cm > 250)) e.push("Obwód pasa poza zakresem.");
    }
    if (s === 1) {
      if (p.training_days.length < 1) e.push("Wybierz co najmniej jeden preferowany dzień treningowy.");
      if (p.sports.some((x) => !x.name.trim())) e.push("Uzupełnij nazwy sportów lub usuń puste pozycje.");
    }
    if (s === 4 && !goals.length) e.push("Wybierz co najmniej jeden cel.");
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (!e.length) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const preview = useMemo(() => {
    if (step !== STEPS.length - 1) return null;
    const fakeProfile = { ...p, id: "", user_id: "", created_at: "", updated_at: "", onboarding_completed: true, target_weight_kg: maintain ? p.weight_kg : p.target_weight_kg };
    const fakePrefs = { ...finalPrefs, id: "", user_id: "", created_at: "", updated_at: "" };
    const t = computeTargets(fakeProfile, fakePrefs, { goals, primary });
    const prog = generateProgram({
      experience: p.experience,
      equipment: p.equipment,
      injuries: p.injuries.map((i) => i.area),
      session_minutes: p.session_minutes,
      goals,
      primary_goal: primary,
      has_contraindications: p.has_contraindications,
      training_days: p.training_days,
      start_date: startDate,
    });
    return { t, prog };
  }, [step, p, finalPrefs, goals, primary, startDate, maintain]);

  function finish() {
    setBusy(true);
    try {
      completeOnboarding({ ...p, target_weight_kg: maintain ? p.weight_kg : p.target_weight_kg }, goals, primary, finalPrefs, startDate);
      router.replace("/");
    } catch (e) {
      setErrors([(e as Error).message]);
      setBusy(false);
    }
  }

  const days = pickTrainingDays(p.training_days);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <IconLogo />
        <div>
          <h1 className="text-xl font-bold">Konfigurator</h1>
          <p className="text-sm text-muted">
            Krok {step + 1} z {STEPS.length}: {STEPS[step]}
          </p>
        </div>
      </div>
      <div className="mb-6 flex gap-1" aria-hidden>
        {STEPS.map((_, i) => (
          <div key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-olive" : "bg-surface-3")} />
        ))}
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        {step === 0 && (
          <>
            <Input label="Imię lub pseudonim" value={p.display_name} onChange={(e) => up({ display_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Rok urodzenia" value={p.birth_year} onChange={(v) => up({ birth_year: v ?? 1990 })} hint={`Wiek: ${new Date().getFullYear() - p.birth_year} lat`} />
              <Select label="Płeć (do wzoru metabolicznego)" value={p.sex} onChange={(e) => up({ sex: e.target.value as Sex })} hint="Wykorzystywana wyłącznie do oszacowania zapotrzebowania energetycznego (wzór Mifflina-St Jeora).">
                <option value="male">Mężczyzna</option>
                <option value="female">Kobieta</option>
              </Select>
              <NumberInput label="Wzrost" suffix="cm" value={p.height_cm} onChange={(v) => up({ height_cm: v ?? 0 })} />
              <NumberInput label="Masa ciała" suffix="kg" step={0.1} value={p.weight_kg} onChange={(v) => up({ weight_kg: v ?? 0 })} hint={p.height_cm > 0 ? `BMI ≈ ${bmi(p.weight_kg, p.height_cm).toFixed(1).replace(".", ",")}` : undefined} />
              <NumberInput label="Obwód pasa (opcjonalnie)" suffix="cm" step={0.5} value={p.waist_cm} onChange={(v) => up({ waist_cm: v })} hint="Mierz na wysokości pępka, na wydechu." />
              <NumberInput label="Docelowa masa ciała" suffix="kg" step={0.5} value={maintain ? p.weight_kg : p.target_weight_kg} onChange={(v) => up({ target_weight_kg: v })} />
            </div>
            <Toggle checked={maintain} onChange={setMaintain} label="Chcę utrzymać obecną masę ciała" />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Doświadczenie treningowe">
              <Chips<Experience>
                value={[p.experience]}
                onChange={(v) => up({ experience: v[0] })}
                options={[
                  { value: "beginner", label: "Początkujący (< 1 roku)" },
                  { value: "intermediate", label: "Średniozaawansowany (1–3 lata)" },
                  { value: "advanced", label: "Zaawansowany (3+ lata)" },
                ]}
              />
            </Field>
            <Select label="Aktywność w pracy / na co dzień" value={p.job_activity} onChange={(e) => up({ job_activity: e.target.value as JobActivity })}>
              <option value="sedentary">Siedząca (biuro, kierowca)</option>
              <option value="standing">Stojąca / dużo chodzenia</option>
              <option value="physical">Fizyczna</option>
            </Select>
            <NumberInput label="Średnia liczba kroków dziennie" step={500} value={p.avg_steps} onChange={(v) => up({ avg_steps: v ?? 0 })} hint="Z telefonu lub zegarka — średnia z ostatnich 2 tygodni." />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Treningi siłowe / tydzień" value={p.strength_sessions_per_week} onChange={(e) => up({ strength_sessions_per_week: Number(e.target.value) })} hint="Program SEAL zakłada 3 sesje Full Body.">
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <Select label="Czas na trening" value={p.session_minutes} onChange={(e) => up({ session_minutes: Number(e.target.value) })}>
                {[45, 60, 75, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </Select>
            </div>
            <Field label="Preferowane dni treningowe" hint={`Plan: ${days.map((d) => WEEKDAYS_LONG[d]).join(", ")} — dobrane tak, by zapewnić przerwy regeneracyjne.`}>
              <Chips<string> multiple value={p.training_days.map(String)} onChange={(v) => up({ training_days: v.map(Number).sort() })} options={WEEKDAYS_SHORT.map((d, i) => ({ value: String(i), label: d }))} ariaLabel="Dni treningowe" />
            </Field>
            <Field label="Inne sporty i aktywności">
              <div className="flex flex-col gap-3">
                {p.sports.map((s, i) => (
                  <SportRow key={i} sport={s} onChange={(ns) => up({ sports: p.sports.map((x, k) => (k === i ? ns : x)) })} onRemove={() => up({ sports: p.sports.filter((_, k) => k !== i) })} />
                ))}
                <Button variant="outline" onClick={() => up({ sports: [...p.sports, { name: "", hours_per_week: 2, intensity: "moderate", days: [] }] })}>
                  + Dodaj sport
                </Button>
              </div>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Szybki wybór">
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_PRESETS.map((pr) => (
                  <Button key={pr.label} size="sm" variant="outline" onClick={() => up({ equipment: pr.items })}>
                    {pr.label}
                  </Button>
                ))}
              </div>
            </Field>
            <Field label="Dostępne wyposażenie" hint="Program dobierze ćwiczenia i warianty do zaznaczonego sprzętu.">
              <Chips<Equipment> multiple value={p.equipment} onChange={(v) => up({ equipment: v })} options={(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Notice>Te informacje służą wyłącznie do doboru ćwiczeń i intensywności. Aplikacja nie diagnozuje i nie zastępuje konsultacji z lekarzem ani fizjoterapeutą. Zapisujemy tylko to, co tu podasz.</Notice>
            <Field label="Urazy, dolegliwości, ograniczenia ruchowe">
              <Chips<InjuryArea>
                multiple
                value={p.injuries.map((i) => i.area)}
                onChange={(v) => up({ injuries: v.map((a): Injury => p.injuries.find((i) => i.area === a) ?? { area: a, note: "" }) })}
                options={(Object.keys(INJURY_LABELS) as InjuryArea[]).map((k) => ({ value: k, label: INJURY_LABELS[k] }))}
              />
            </Field>
            {p.injuries.map((inj) => (
              <Input key={inj.area} label={`Opis: ${INJURY_LABELS[inj.area]} (opcjonalnie)`} value={inj.note} onChange={(e) => up({ injuries: p.injuries.map((i) => (i.area === inj.area ? { ...i, note: e.target.value } : i)) })} />
            ))}
            <Toggle
              checked={p.has_contraindications}
              onChange={(v) => up({ has_contraindications: v })}
              label="Mam przeciwwskazania do intensywnego wysiłku"
              description="Np. zalecenie lekarza, choroby układu krążenia, nadciśnienie w trakcie leczenia, ciąża."
            />
            {p.has_contraindications && (
              <>
                <Textarea label="Krótki opis (opcjonalnie)" value={p.contraindications_note} onChange={(e) => up({ contraindications_note: e.target.value })} />
                <Notice tone="warn">Program zostanie złagodzony (wyższy zapas powtórzeń, kondycja tylko o niskiej intensywności). Przed rozpoczęciem skonsultuj aktywność fizyczną z lekarzem.</Notice>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Field label="Twoje cele (możesz wybrać kilka)">
              <Chips<GoalType>
                multiple
                value={goals}
                onChange={(v) => {
                  setGoals(v);
                  if (!v.includes(primary) && v.length) setPrimary(v[0]);
                }}
                options={(Object.keys(GOAL_LABELS) as GoalType[]).map((k) => ({ value: k, label: GOAL_LABELS[k] }))}
              />
            </Field>
            {goals.length > 0 && (
              <Field label="Główny priorytet" hint="Od niego zależy bilans kaloryczny i akcenty programu.">
                <Chips<GoalType> value={[primary]} onChange={(v) => setPrimary(v[0])} options={goals.map((g) => ({ value: g, label: GOAL_LABELS[g] }))} />
              </Field>
            )}
            {primary === "fat_loss" && (
              <Select label="Tempo redukcji" value={prefs.deficit_rate} onChange={(e) => upPrefs({ deficit_rate: e.target.value as PrefsInput["deficit_rate"] })}>
                <option value="gentle">Łagodne (~0,25% masy/tydz.)</option>
                <option value="moderate">Umiarkowane (~0,5% masy/tydz.) — zalecane</option>
                <option value="faster">Szybsze (~0,75% masy/tydz.)</option>
              </Select>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Liczba posiłków dziennie" value={prefs.meals_per_day} onChange={(e) => upPrefs({ meals_per_day: Number(e.target.value), meal_names: defaultMealNames(Number(e.target.value)) })}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <NumberInput label="Ustalona kaloryczność (opcjonalnie)" suffix="kcal" step={50} value={prefs.preset_kcal} onChange={(v) => upPrefs({ preset_kcal: v })} hint="Zostaw puste — wyliczymy." />
            </div>
            <Field label="Alergie i nietolerancje">
              <Chips<Allergen> multiple value={prefs.allergies} onChange={(v) => upPrefs({ allergies: v })} options={(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((k) => ({ value: k, label: ALLERGEN_LABELS[k] }))} />
            </Field>
            <Input label="Produkty wykluczone (po przecinku)" placeholder="np. wątróbka, brokuł" value={excludedText} onChange={(e) => setExcludedText(e.target.value)} />
            <Input label="Ulubione produkty (po przecinku)" placeholder="np. łosoś, kasza gryczana, skyr" value={favText} onChange={(e) => setFavText(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Styl żywienia" value={prefs.diet_style} onChange={(e) => upPrefs({ diet_style: e.target.value as DietStyle })}>
                <option value="classic">Klasyczny</option>
                <option value="high_protein">Wysokobiałkowy</option>
                <option value="low_carb">Niskowęglowodanowy</option>
                <option value="mediterranean">Śródziemnomorski</option>
                <option value="vegetarian">Wegetariański</option>
              </Select>
              <Select label="Tryb makroskładników" value={prefs.macro_mode} onChange={(e) => upPrefs({ macro_mode: e.target.value as MacroMode })}>
                <option value="standard">Standardowy</option>
                <option value="high_protein">High protein</option>
                <option value="low_carb">Low carb</option>
                <option value="custom">Indywidualny</option>
              </Select>
              <Select label="Maks. czas przygotowania posiłku" value={prefs.max_prep_minutes} onChange={(e) => upPrefs({ max_prep_minutes: Number(e.target.value) })}>
                {[10, 15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </Select>
              <Select label="Budżet na jedzenie" value={prefs.budget} onChange={(e) => upPrefs({ budget: e.target.value as Budget })}>
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
              </Select>
              <Select label="Powtarzanie posiłków" value={prefs.repetition_tolerance} onChange={(e) => upPrefs({ repetition_tolerance: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>Jak największa różnorodność</option>
                <option value={2}>Mogą się powtarzać co 2–3 dni</option>
                <option value={3}>Mogę jeść to samo codziennie</option>
              </Select>
              <Select label="Kaloryczność w tygodniu" value={prefs.calorie_mode} onChange={(e) => upPrefs({ calorie_mode: e.target.value as PrefsInput["calorie_mode"] })}>
                <option value="constant">Stała każdego dnia</option>
                <option value="cycling">Zmienna (trening / sport / odpoczynek)</option>
              </Select>
            </div>
            <Toggle checked={prefs.batch_cooking} onChange={(v) => upPrefs({ batch_cooking: v })} label="Mogę gotować na kilka dni" />
          </>
        )}

        {step === 6 && preview && (
          <>
            <Input label="Początek programu" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} hint={`Pierwszy tydzień: ${formatDateFull(startDate)} – ${formatDateFull(addDays(startDate, 6))}`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile label="Cel kcal" value={`${preview.t.target.kcal}`} />
              <SummaryTile label="Białko" value={`${preview.t.target.protein_g} g`} />
              <SummaryTile label="Tłuszcz" value={`${preview.t.target.fat_g} g`} />
              <SummaryTile label="Węglowodany" value={`${preview.t.target.carbs_g} g`} />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {preview.t.breakdown.map((b) => (
                <li key={b}>{b}</li>
              ))}
              <li>{preview.t.goalDescription}</li>
            </ul>
            {[...preview.t.warnings, ...preview.t.notes].map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
            <div>
              <h3 className="mb-2 font-semibold">Program: 4 tygodnie × 3 treningi = {preview.prog.sessions.length} sesji</h3>
              <ul className="space-y-1 text-sm">
                {(["A", "B", "C"] as const).map((t) => {
                  const s = preview.prog.sessions.find((x) => x.template === t && x.week === 1)!;
                  const ex = preview.prog.exercises.filter((e) => e.session_id === s.id).length;
                  return (
                    <li key={t} className="flex justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                      <span>
                        {s.title} <span className="text-muted">· {WEEKDAYS_LONG[days[s.day_index - 1]]}</span>
                      </span>
                      <span className="text-muted">{ex} ćwiczeń</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {preview.prog.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
          </>
        )}

        {errors.length > 0 && (
          <Notice tone="bad">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </Notice>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            ← Wstecz
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Dalej →
            </Button>
          ) : (
            <Button variant="primary" onClick={finish} disabled={busy}>
              Utwórz mój plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function SportRow({ sport, onChange, onRemove }: { sport: Sport; onChange: (s: Sport) => void; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Input aria-label="Nazwa sportu" placeholder="np. bieganie, BJJ" value={sport.name} onChange={(e) => onChange({ ...sport, name: e.target.value })} />
        <NumberInput ariaLabel="Godziny tygodniowo" suffix="h/tydz." step={0.5} value={sport.hours_per_week} onChange={(v) => onChange({ ...sport, hours_per_week: v ?? 0 })} />
        <Select aria-label="Intensywność" value={sport.intensity} onChange={(e) => onChange({ ...sport, intensity: e.target.value as Sport["intensity"] })}>
          <option value="low">Niska</option>
          <option value="moderate">Umiarkowana</option>
          <option value="high">Wysoka</option>
        </Select>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Chips<string> multiple value={sport.days.map(String)} onChange={(v) => onChange({ ...sport, days: v.map(Number) })} options={WEEKDAYS_SHORT.map((d, i) => ({ value: String(i), label: d }))} ariaLabel="Dni sportu" />
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Usuń sport">
          Usuń
        </Button>
      </div>
    </div>
  );
}
