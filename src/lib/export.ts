"use client";

import { COLLECTIONS, type CollectionName, type Snapshot } from "@/lib/domain/types";
import { downloadText, toCSV } from "@/lib/utils/csv";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import { putRecords, useApp } from "@/lib/data/store";
import { today } from "@/lib/utils/dates";

/** Pełny eksport danych użytkownika (RODO: prawo dostępu i przenoszenia danych). */
export function exportJSON(data: Snapshot) {
  const payload = {
    app: "SEAL PERFORMANCE",
    format_version: 1,
    exported_at: new Date().toISOString(),
    collections: Object.fromEntries(COLLECTIONS.map((c) => [c, Object.values(data[c])])),
  };
  downloadText(`seal-performance-dane-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function exportTrainingCSV(data: Snapshot) {
  const rows = Object.values(data.exercise_sets)
    .map((s) => {
      const sess = data.workout_sessions[s.session_id];
      return {
        data: (sess?.completed_at ?? sess?.scheduled_date ?? "").slice(0, 10),
        trening: sess?.title ?? "",
        tydzien: sess?.week ?? "",
        cwiczenie: EXERCISE_MAP[s.exercise_id]?.name ?? s.exercise_id,
        seria: s.set_number,
        ciezar_kg: s.weight_kg ?? "",
        powtorzenia: s.reps ?? "",
        rir: s.rir ?? "",
        wykonano: s.completed ? "tak" : "nie",
      };
    })
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.cwiczenie).localeCompare(String(b.cwiczenie)) || Number(a.seria) - Number(b.seria));
  downloadText(`trening-serie-${today()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

export function exportSessionsCSV(data: Snapshot) {
  const rows = Object.values(data.workout_sessions)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .map((s) => ({
      data_planowana: s.scheduled_date,
      trening: s.title,
      tydzien: s.week,
      status: s.status,
      ukonczono: s.completed_at ?? "",
      czas_min: s.duration_sec ? Math.round(s.duration_sec / 60) : "",
      srpe: s.session_rpe ?? "",
      regeneracja: s.recovery_rating ?? "",
      notatki: s.notes,
    }));
  downloadText(`treningi-${today()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

export function exportMeasurementsCSV(data: Snapshot) {
  const rows = Object.values(data.body_measurements)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ data: m.date, masa_kg: m.weight_kg ?? "", pas_cm: m.waist_cm ?? "", notatka: m.note }));
  downloadText(`pomiary-${today()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

export function exportFoodLogCSV(data: Snapshot) {
  const rows = Object.values(data.food_log_entries)
    .sort((a, b) => a.date.localeCompare(b.date) || a.meal_index - b.meal_index)
    .map((e) => ({ data: e.date, posilek: e.meal_index + 1, produkt: e.name, ilosc: e.amount, jednostka: e.unit, gramy: e.grams, kcal: e.kcal, bialko_g: e.protein_g, tluszcz_g: e.fat_g, wegle_g: e.carbs_g, blonnik_g: e.fiber_g }));
  downloadText(`dziennik-zywienia-${today()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
}

/** Przywrócenie z kopii JSON — rekordy są przypisywane do zalogowanego użytkownika. */
export async function importJSON(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { app?: string; collections?: Record<string, { id: string }[]> };
  if (parsed.app !== "SEAL PERFORMANCE" || !parsed.collections) throw new Error("To nie jest plik kopii SEAL PERFORMANCE.");
  const user = useApp.getState().user;
  if (!user) throw new Error("Brak zalogowanego użytkownika.");
  let n = 0;
  for (const c of COLLECTIONS) {
    const rows = parsed.collections[c];
    if (!Array.isArray(rows) || !rows.length) continue;
    const valid = rows.filter((r) => r && typeof r.id === "string").map((r) => ({ ...r, user_id: user.id }));
    putRecords(c as CollectionName, valid as never);
    n += valid.length;
  }
  return n;
}
