"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Allergen, Budget, DietStyle, Equipment, Experience, GoalType, Injury, InjuryArea, JobActivity, Sex } from "@/lib/domain/types";
import { useApp } from "@/lib/data/store";
import { auth } from "@/lib/data/auth";
import { useData, useGoals, usePrefs, useProfile } from "@/lib/hooks";
import { Badge, Button, Card, Chips, Field, Input, Modal, Notice, NumberInput, PageHeader, Select, Textarea, Toggle } from "@/components/ui";
import { recalculateTargets, updateGoals, updatePrefs, updateProfile } from "@/lib/actions/profile";
import { EQUIPMENT_LABELS, INJURY_LABELS } from "@/lib/training/exercises";
import { ALLERGEN_LABELS } from "@/lib/nutrition/foods";
import { defaultMealNames } from "@/lib/nutrition/meals";
import { GOAL_LABELS } from "@/lib/labels";
import { WEEKDAYS_SHORT } from "@/lib/utils/dates";
import { exportFoodLogCSV, exportJSON, exportMeasurementsCSV, exportSessionsCSV, exportTrainingCSV, importJSON } from "@/lib/export";
import { notificationsSupported, requestNotificationPermission, showNotification } from "@/components/Reminders";
import { applyTheme } from "@/components/Providers";

export default function ProfilePage() {
  const profile = useProfile();
  const prefs = usePrefs();
  const goals = useGoals();
  const data = useData();
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const deleteAccount = useApp((s) => s.deleteAccount);
  const [msg, setMsg] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [perm, setPerm] = useState<string>("default");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    if (notificationsSupported()) setPerm(Notification.permission);
  }, []);

  if (!profile || !prefs) return null;
  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <>
      <PageHeader title="Profil" subtitle={user ? `${user.email} · ${user.mode === "local" ? "tryb lokalny (to urządzenie)" : "konto Supabase"}` : undefined} />
      {msg && (
        <div className="mb-4">
          <Notice tone="ok">{msg}</Notice>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <Card title="Dane podstawowe">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label="Imię" value={profile.display_name} onChange={(e) => updateProfile({ display_name: e.target.value })} />
            <NumberInput label="Rok urodzenia" value={profile.birth_year} onChange={(v) => v && updateProfile({ birth_year: v })} />
            <Select label="Płeć (do wzoru)" value={profile.sex} onChange={(e) => updateProfile({ sex: e.target.value as Sex })}>
              <option value="male">Mężczyzna</option>
              <option value="female">Kobieta</option>
            </Select>
            <NumberInput label="Wzrost" suffix="cm" value={profile.height_cm} onChange={(v) => v && updateProfile({ height_cm: v })} />
            <NumberInput label="Masa (startowa)" suffix="kg" step={0.1} value={profile.weight_kg} onChange={(v) => v && updateProfile({ weight_kg: v })} hint="Aktualną masę zapisuj w Postępach" />
            <NumberInput label="Docelowa masa" suffix="kg" step={0.5} value={profile.target_weight_kg} onChange={(v) => updateProfile({ target_weight_kg: v })} />
            <Select label="Doświadczenie" value={profile.experience} onChange={(e) => updateProfile({ experience: e.target.value as Experience })}>
              <option value="beginner">Początkujący</option>
              <option value="intermediate">Średniozaawansowany</option>
              <option value="advanced">Zaawansowany</option>
            </Select>
            <Select label="Aktywność w pracy" value={profile.job_activity} onChange={(e) => updateProfile({ job_activity: e.target.value as JobActivity })}>
              <option value="sedentary">Siedząca</option>
              <option value="standing">Stojąca</option>
              <option value="physical">Fizyczna</option>
            </Select>
            <NumberInput label="Średnio kroków" step={500} value={profile.avg_steps} onChange={(v) => v !== null && updateProfile({ avg_steps: v })} />
            <Select label="Czas na trening" value={profile.session_minutes} onChange={(e) => updateProfile({ session_minutes: Number(e.target.value) })}>
              {[45, 60, 75, 90].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </Select>
          </div>
          <Field label="Preferowane dni treningowe">
            <Chips<string> multiple value={profile.training_days.map(String)} onChange={(v) => v.length && updateProfile({ training_days: v.map(Number).sort() })} options={WEEKDAYS_SHORT.map((d, i) => ({ value: String(i), label: d }))} />
          </Field>
          <Field label="Wyposażenie">
            <Chips<Equipment> multiple value={profile.equipment} onChange={(v) => updateProfile({ equipment: v })} options={(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))} />
          </Field>
          <Field label="Urazy i ograniczenia">
            <Chips<InjuryArea>
              multiple
              value={profile.injuries.map((i) => i.area)}
              onChange={(v) => updateProfile({ injuries: v.map((a): Injury => profile.injuries.find((i) => i.area === a) ?? { area: a, note: "" }) })}
              options={(Object.keys(INJURY_LABELS) as InjuryArea[]).map((k) => ({ value: k, label: INJURY_LABELS[k] }))}
            />
          </Field>
          <Toggle checked={profile.has_contraindications} onChange={(v) => updateProfile({ has_contraindications: v })} label="Przeciwwskazania do intensywnego wysiłku" />
          {profile.has_contraindications && <Textarea aria-label="Opis przeciwwskazań" value={profile.contraindications_note} onChange={(e) => updateProfile({ contraindications_note: e.target.value })} />}
          <p className="mt-2 text-xs text-muted">Zmiany sprzętu, urazów, dni i czasu treningu zostaną uwzględnione przy generowaniu kolejnego cyklu (Trening → Generuj kolejny miesiąc). Ćwiczenia w bieżącym cyklu możesz zamienić ręcznie.</p>
        </Card>

        <Card title="Cele">
          <Chips<GoalType>
            multiple
            value={goals.goals}
            onChange={(v) => v.length && updateGoals(v, v.includes(goals.primary) ? goals.primary : v[0])}
            options={(Object.keys(GOAL_LABELS) as GoalType[]).map((k) => ({ value: k, label: GOAL_LABELS[k] }))}
          />
          <div className="mt-3">
            <Select label="Główny priorytet" value={goals.primary} onChange={(e) => updateGoals(goals.goals, e.target.value as GoalType)} className="w-auto">
              {goals.goals.map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => {
              recalculateTargets();
              notify("Przeliczono cele żywieniowe na podstawie aktualnych danych.");
            }}
          >
            Przelicz cele żywieniowe
          </Button>
        </Card>

        <Card title="Preferencje żywieniowe">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Select label="Posiłki dziennie" value={prefs.meals_per_day} onChange={(e) => updatePrefs({ meals_per_day: Number(e.target.value), meal_names: defaultMealNames(Number(e.target.value)) })}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Select label="Styl żywienia" value={prefs.diet_style} onChange={(e) => updatePrefs({ diet_style: e.target.value as DietStyle })}>
              <option value="classic">Klasyczny</option>
              <option value="high_protein">Wysokobiałkowy</option>
              <option value="low_carb">Niskowęglowodanowy</option>
              <option value="mediterranean">Śródziemnomorski</option>
              <option value="vegetarian">Wegetariański</option>
            </Select>
            <Select label="Maks. czas przygotowania" value={prefs.max_prep_minutes} onChange={(e) => updatePrefs({ max_prep_minutes: Number(e.target.value) })}>
              {[10, 15, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </Select>
            <Select label="Budżet" value={prefs.budget} onChange={(e) => updatePrefs({ budget: e.target.value as Budget })}>
              <option value="low">Niski</option>
              <option value="medium">Średni</option>
              <option value="high">Wysoki</option>
            </Select>
            <Select label="Powtarzalność" value={prefs.repetition_tolerance} onChange={(e) => updatePrefs({ repetition_tolerance: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>Duża różnorodność</option>
              <option value={2}>Co 2–3 dni</option>
              <option value={3}>Codziennie to samo OK</option>
            </Select>
          </div>
          <Field label="Nazwy posiłków">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {prefs.meal_names.map((n, i) => (
                <Input key={i} aria-label={`Nazwa posiłku ${i + 1}`} value={n} onChange={(e) => updatePrefs({ meal_names: prefs.meal_names.map((x, k) => (k === i ? e.target.value : x)) })} />
              ))}
            </div>
          </Field>
          <Field label="Alergie i nietolerancje">
            <Chips<Allergen> multiple value={prefs.allergies} onChange={(v) => updatePrefs({ allergies: v })} options={(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((k) => ({ value: k, label: ALLERGEN_LABELS[k] }))} />
          </Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Produkty wykluczone (po przecinku)" defaultValue={prefs.excluded_foods.join(", ")} onBlur={(e) => updatePrefs({ excluded_foods: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            <Input label="Ulubione produkty (po przecinku)" defaultValue={prefs.favorite_foods.join(", ")} onBlur={(e) => updatePrefs({ favorite_foods: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <Toggle checked={prefs.batch_cooking} onChange={(v) => updatePrefs({ batch_cooking: v })} label="Gotowanie na kilka dni" />
        </Card>

        <Card title="Wygląd">
          <Toggle
            checked={theme === "light"}
            onChange={(v) => {
              const t = v ? "light" : "dark";
              setTheme(t);
              applyTheme(t);
            }}
            label="Jasny motyw"
            description="Domyślnie aplikacja używa trybu ciemnego. Animacje respektują systemowe ustawienie ograniczenia ruchu."
          />
        </Card>

        <Card title="Powiadomienia" subtitle="Opcjonalne — wymagają Twojej zgody w przeglądarce">
          {!notificationsSupported() ? (
            <Notice>Ta przeglądarka nie obsługuje powiadomień. Na iPhonie dodaj aplikację do ekranu początkowego (iOS 16.4+).</Notice>
          ) : (
            <>
              <Toggle
                checked={prefs.notifications.enabled && perm === "granted"}
                onChange={async (v) => {
                  if (v) {
                    const p = await requestNotificationPermission();
                    setPerm(p);
                    if (p !== "granted") return notify("Nie udzielono zgody na powiadomienia.");
                  }
                  updatePrefs({ notifications: { ...prefs.notifications, enabled: v } });
                }}
                label="Włącz przypomnienia"
                description={perm === "denied" ? "Zgoda została zablokowana w ustawieniach przeglądarki." : undefined}
              />
              {prefs.notifications.enabled && perm === "granted" && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Toggle checked={prefs.notifications.training} onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, training: v } })} label="Trening" />
                    <Input type="time" aria-label="Godzina przypomnienia o treningu" value={prefs.notifications.training_time} onChange={(e) => updatePrefs({ notifications: { ...prefs.notifications, training_time: e.target.value } })} className="w-28" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={prefs.notifications.weigh_in} onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, weigh_in: v } })} label="Pomiar masy" />
                    <Input type="time" aria-label="Godzina przypomnienia o pomiarze" value={prefs.notifications.weigh_in_time} onChange={(e) => updatePrefs({ notifications: { ...prefs.notifications, weigh_in_time: e.target.value } })} className="w-28" />
                  </div>
                  <Toggle checked={prefs.notifications.weekly_report} onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, weekly_report: v } })} label="Raport tygodniowy (niedziela 18:00)" />
                  <Toggle checked={prefs.notifications.meals} onChange={(v) => updatePrefs({ notifications: { ...prefs.notifications, meals: v } })} label="Zaplanowane posiłki" />
                  {prefs.notifications.meals && (
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      {prefs.notifications.meal_times.map((t, i) => (
                        <Input key={i} type="time" aria-label={`Godzina posiłku ${i + 1}`} value={t} onChange={(e) => updatePrefs({ notifications: { ...prefs.notifications, meal_times: prefs.notifications.meal_times.map((x, k) => (k === i ? e.target.value : x)) } })} className="w-28" />
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={async () => notify((await showNotification("SEAL PERFORMANCE", "Powiadomienia działają.")) ? "Wysłano powiadomienie testowe." : "Nie udało się wyświetlić powiadomienia.")}>
                    Wyślij testowe
                  </Button>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">Przypomnienia działają, gdy aplikacja jest uruchomiona (również w tle jako zainstalowana PWA). Nie wysyłamy danych do zewnętrznych serwisów powiadomień.</p>
            </>
          )}
        </Card>

        <Card title="Asystent">
          <Toggle
            checked={prefs.ai_assistant_consent}
            onChange={(v) => updatePrefs({ ai_assistant_consent: v })}
            label="Zgoda na wysyłanie podsumowania danych do modułu AI"
            description="Dotyczy wyłącznie trybu AI (jeśli administrator skonfigurował klucz API). Asystent danych działa lokalnie bez zgody."
          />
          <Link href="/asystent" className="mt-2 inline-block text-sm text-olive-strong">
            Otwórz asystenta →
          </Link>
        </Card>

        <Card title="Eksport i kopia danych" subtitle="Prawo dostępu i przenoszenia danych (RODO)">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportJSON(data)}>
              Pełna kopia (JSON)
            </Button>
            <Button variant="outline" onClick={() => exportTrainingCSV(data)}>
              Serie treningowe (CSV)
            </Button>
            <Button variant="outline" onClick={() => exportSessionsCSV(data)}>
              Treningi (CSV)
            </Button>
            <Button variant="outline" onClick={() => exportMeasurementsCSV(data)}>
              Pomiary (CSV)
            </Button>
            <Button variant="outline" onClick={() => exportFoodLogCSV(data)}>
              Dziennik żywienia (CSV)
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Przywróć z kopii JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  notify(`Przywrócono ${await importJSON(f)} rekordów.`);
                } catch (err) {
                  notify((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Jadłospis i listę zakupów wyeksportujesz w zakładkach Dieta → Jadłospis / Lista zakupów.</p>
        </Card>

        <Card title="Prywatność i bezpieczeństwo">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{auth.mode === "local" ? "Dane przechowywane są wyłącznie w tej przeglądarce (IndexedDB). Hasło zapisane jako skrót PBKDF2-SHA256 (210 000 iteracji)." : "Dane przechowywane są w Supabase (PostgreSQL) z Row Level Security — dostęp wyłącznie do własnych rekordów."}</li>
            <li>Aplikacja nie używa zewnętrznych narzędzi analitycznych ani reklamowych.</li>
            <li>Zbieramy tylko dane potrzebne do planu: rok urodzenia zamiast daty, opcjonalny obwód pasa i opisy urazów.</li>
            <li>
              <Link href="/o-aplikacji" className="text-olive-strong underline">
                Pełne zasady przetwarzania danych
              </Link>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void logout()}>
              Wyloguj
            </Button>
            <Button variant="danger" onClick={() => setDel(true)}>
              Usuń konto i wszystkie dane
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={del} onClose={() => setDel(false)} title="Usunięcie konta">
        <p className="text-sm">Ta operacja trwale usunie konto oraz wszystkie dane: profil, treningi, serie, pomiary, dziennik żywienia, przepisy i jadłospisy. Nie można jej cofnąć. Rozważ wcześniejszy eksport danych.</p>
        <Input className="mt-3" label='Wpisz "USUŃ", aby potwierdzić' value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <div className="mt-4 flex gap-2">
          <Button variant="danger" disabled={confirm !== "USUŃ"} onClick={() => void deleteAccount()}>
            Usuń trwale
          </Button>
          <Button variant="ghost" onClick={() => setDel(false)}>
            Anuluj
          </Button>
        </div>
      </Modal>
      <div className="mt-6 text-center text-xs text-muted">
        <Badge>SEAL PERFORMANCE 1.0</Badge>
      </div>
    </>
  );
}
