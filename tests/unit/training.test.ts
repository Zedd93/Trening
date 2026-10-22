import { describe, expect, it } from "vitest";
import { generateProgram, pickTrainingDays, weeklyVolume } from "@/lib/training/generator";
import { assessFatigue, estimate1RM, recommend, type ProgressionContext } from "@/lib/training/progression";
import { checkMove, missedSessions } from "@/lib/training/schedule";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import type { Equipment, ExerciseSet, WorkoutExercise, WorkoutSession } from "@/lib/domain/types";

const FULL: Equipment[] = ["barbell", "squat_rack", "bench", "dumbbells", "kettlebell", "pullup_bar", "cable", "trap_bar", "dip_station", "air_bike", "rower", "bike", "bands", "medicine_ball", "ab_wheel", "sled"];

const gen = (over: Partial<Parameters<typeof generateProgram>[0]> = {}) =>
  generateProgram({
    experience: "intermediate",
    equipment: FULL,
    injuries: [],
    session_minutes: 75,
    goals: ["recomposition"],
    primary_goal: "recomposition",
    has_contraindications: false,
    training_days: [0, 2, 4],
    start_date: "2026-10-26",
    ...over,
  });

describe("generator programu", () => {
  it("tworzy 12 sesji (4 tygodnie × A/B/C) w wybrane dni", () => {
    const g = gen();
    expect(g.sessions).toHaveLength(12);
    expect(g.sessions.map((s) => s.template).join("")).toBe("ABC".repeat(4));
    expect(new Set(g.sessions.map((s) => s.scheduled_date)).size).toBe(12);
    expect(g.sessions[0].scheduled_date).toBe("2026-10-26");
    expect(g.sessions[1].scheduled_date).toBe("2026-10-28");
  });

  it("start w środku tygodnia zachowuje preferowane dni", () => {
    const g = gen({ start_date: "2026-10-22" }); // czwartek
    const weekdays = g.sessions.map((s) => (new Date(s.scheduled_date + "T12:00:00").getDay() + 6) % 7);
    expect(weekdays.every((d) => [0, 2, 4].includes(d))).toBe(true);
    expect(g.sessions[0].scheduled_date >= "2026-10-22").toBe(true);
  });

  it("każda sesja ma rozgrzewkę, blok siłowy, core lub element funkcjonalny i schłodzenie", () => {
    const g = gen();
    for (const s of g.sessions) {
      const ex = g.exercises.filter((e) => e.session_id === s.id);
      expect(s.warmup.length).toBeGreaterThan(2);
      expect(s.cooldown.length).toBeGreaterThan(2);
      expect(ex.some((e) => e.block === "strength" || (s.template === "C" && e.block === "hypertrophy"))).toBe(true);
      expect(ex.some((e) => e.block === "core" || e.block === "functional")).toBe(true);
    }
  });

  it("tydzień 3 ma większą objętość akcesoriów niż tydzień 1", () => {
    const g = gen();
    const vol = (w: number) => weeklyVolume(g.exercises.filter((e) => g.sessions.find((s) => s.id === e.session_id)!.week === w));
    expect(vol(3).shoulders).toBeGreaterThan(vol(1).shoulders);
  });

  it("objętość tygodniowa głównych partii w zakresie hipertroficznym", () => {
    const g = gen();
    const v = g.program.weekly_volume as Record<string, number>;
    for (const k of ["chest", "back", "quads", "glutes"]) expect(v[k]).toBeGreaterThanOrEqual(6);
  });

  it("urazy wykluczają przeciwwskazane ćwiczenia", () => {
    const g = gen({ injuries: ["knee", "lower_back", "shoulder"] });
    for (const e of g.exercises) {
      const def = EXERCISE_MAP[e.exercise_id];
      expect(def.avoid_with.some((a) => ["knee", "lower_back", "shoulder"].includes(a)), def.id).toBe(false);
    }
  });

  it("sprzęt: przy samych gumach brak ćwiczeń ze sztangą", () => {
    const g = gen({ equipment: ["bands"] });
    expect(g.exercises.every((e) => EXERCISE_MAP[e.exercise_id].equipment.every((q) => q === "bands"))).toBe(true);
  });

  it("przeciwwskazania: tylko kondycja o niskiej intensywności i ostrzeżenie", () => {
    const g = gen({ has_contraindications: true });
    expect(g.warnings.join(" ")).toMatch(/przeciwwskazania/i);
    const cond = g.exercises.filter((e) => e.block === "conditioning");
    expect(cond.every((c) => c.sets === 1 && c.load_note.includes("RPE 5"))).toBe(true);
  });

  it("dopasowanie do czasu: 45 min daje krótsze sesje", () => {
    const long = gen({ session_minutes: 90 });
    const short = gen({ session_minutes: 45 });
    expect(short.exercises.length).toBeLessThan(long.exercises.length);
  });

  it("wybór dni maksymalizuje przerwy", () => {
    expect(pickTrainingDays([0, 1, 2, 3, 4])).toEqual([0, 2, 4]);
    expect(pickTrainingDays([5])).toContain(5);
  });
});

/* ----------------------------- progresja ----------------------------- */

const we = (over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  id: "we",
  user_id: "u",
  created_at: "",
  updated_at: "",
  session_id: "s",
  exercise_id: "bench_press",
  order_index: 0,
  block: "strength",
  sets: 3,
  rep_min: 8,
  rep_max: 10,
  duration_sec: 0,
  distance_m: 0,
  target_rir: 2,
  tempo: "",
  rest_sec: 120,
  suggested_load_kg: 60,
  load_note: "",
  substituted_from: null,
  technique_ok: null,
  ...over,
});
const sets = (rows: [number, number, number | null][]): ExerciseSet[] =>
  rows.map(([w, r, rir], i) => ({ id: String(i), user_id: "u", created_at: "", updated_at: "", workout_exercise_id: "we", session_id: "s", exercise_id: "bench_press", set_number: i + 1, weight_kg: w, reps: r, rir, duration_sec: null, completed: true, completed_at: "2026-10-26T10:00:00Z" }));
const ctx = (over: Partial<ProgressionContext> = {}): ProgressionContext => ({ target_week: 3, session_rpe: 7, recovery_rating: 4, recent_fatigue: 2, missed_sessions: 0, days_since_previous: 7, ...over });
const bench = EXERCISE_MAP.bench_press;

describe("silnik progresji", () => {
  it("przykład z założeń: 3×10 @ 60 kg, RIR 2, zakres 8–10 → 62,5 kg", () => {
    const r = recommend(bench, we(), sets([[60, 10, 2], [60, 10, 2], [60, 10, 2]]), ctx())!;
    expect(r.action).toBe("increase_load");
    expect(r.suggested_load_kg).toBe(62.5);
    expect(r.explanation.join(" ")).toMatch(/górnej granicy/);
  });

  it("poniżej dolnej granicy w większości serii → zmniejszenie ciężaru", () => {
    const r = recommend(bench, we(), sets([[60, 7, 0], [60, 6, 0], [60, 6, 0]]), ctx())!;
    expect(r.action).toBe("decrease_load");
    expect(r.suggested_load_kg!).toBeLessThan(60);
  });

  it("jedna seria poniżej zakresu → bez zmian", () => {
    const r = recommend(bench, we(), sets([[60, 9, 1], [60, 8, 1], [60, 7, 1]]), ctx())!;
    expect(r.action).toBe("hold");
    expect(r.suggested_load_kg).toBe(60);
  });

  it("słaba technika blokuje progres", () => {
    const r = recommend(bench, we({ technique_ok: false }), sets([[60, 10, 3], [60, 10, 3], [60, 10, 3]]), ctx())!;
    expect(r.action).toBe("hold");
  });

  it("zła regeneracja blokuje progres, w tygodniu 4 proponuje odciążenie", () => {
    const a = recommend(bench, we(), sets([[60, 10, 2], [60, 10, 2], [60, 10, 2]]), ctx({ recovery_rating: 1 }))!;
    expect(a.action).toBe("hold");
    const b = recommend(bench, we(), sets([[60, 10, 2], [60, 10, 2], [60, 10, 2]]), ctx({ target_week: 4, session_rpe: 10 }))!;
    expect(b.action).toBe("deload");
    expect(b.set_target).toBeLessThan(3);
  });

  it("długa przerwa → ostrożny powrót", () => {
    const r = recommend(bench, we(), sets([[60, 10, 2], [60, 10, 2], [60, 10, 2]]), ctx({ days_since_previous: 20 }))!;
    expect(r.action).toBe("decrease_load");
  });

  it("w zakresie → dołóż powtórzenie", () => {
    const r = recommend(bench, we(), sets([[60, 9, 2], [60, 8, 2], [60, 8, 2]]), ctx())!;
    expect(r.action).toBe("increase_reps");
    expect(r.rep_target).toMatch(/^9–10/);
  });

  it("kalibracja po tygodniu 1 na podstawie e1RM i RIR (zmiana ≤ 10%)", () => {
    const r = recommend(bench, we({ rep_min: 6, rep_max: 8 }), sets([[50, 8, 5], [50, 8, 5], [50, 8, 5]]), ctx({ target_week: 2 }))!;
    expect(r.action).toBe("calibrate");
    expect(r.suggested_load_kg!).toBeGreaterThan(50);
    expect(r.suggested_load_kg!).toBeLessThanOrEqual(55);
  });

  it("brak danych → brak zmian z wyjaśnieniem", () => {
    const r = recommend(bench, we(), [], ctx())!;
    expect(r.action).toBe("hold");
    expect(r.explanation[0]).toMatch(/Brak zapisanych serii/);
  });

  it("e1RM (Epley z RIR)", () => {
    expect(estimate1RM(100, 5, 0)).toBeCloseTo(116.67, 1);
    expect(estimate1RM(100, 5, 2)).toBeCloseTo(123.33, 1);
  });

  it("ocena zmęczenia wymaga co najmniej dwóch sygnałów", () => {
    expect(assessFatigue({ week3_session_rpe: [9, 9], week3_recovery: [2], checkin_fatigue: [], checkin_sleep: [], strength_trend_pct: null }).deload).toBe(true);
    expect(assessFatigue({ week3_session_rpe: [9], week3_recovery: [4], checkin_fatigue: [2], checkin_sleep: [4], strength_trend_pct: 2 }).deload).toBe(false);
  });
});

/* ------------------------------ harmonogram ----------------------------- */

const sess = (id: string, date: string, status: WorkoutSession["status"] = "planned"): WorkoutSession => ({
  id,
  user_id: "u",
  created_at: "",
  updated_at: "",
  program_id: "p",
  week: 1,
  day_index: 1,
  template: "A",
  title: "T",
  focus: "",
  scheduled_date: date,
  status,
  started_at: null,
  completed_at: null,
  duration_sec: null,
  paused_ms: 0,
  paused_at: null,
  notes: "",
  session_rpe: null,
  recovery_rating: null,
  warmup: [],
  cooldown: [],
  phase_note: "",
  rest_ends_at: null,
});

describe("przenoszenie treningu", () => {
  const all = [sess("a", "2026-10-26"), sess("b", "2026-10-28"), sess("c", "2026-10-30")];
  it("blokuje dwa treningi jednego dnia", () => {
    expect(checkMove(all[0], "2026-10-28", all, []).allowed).toBe(false);
  });
  it("ostrzega przy treningach dzień po dniu", () => {
    const r = checkMove(all[0], "2026-10-27", all, []);
    expect(r.allowed).toBe(true);
    expect(r.level).toBe("warning");
  });
  it("uwzględnia intensywny sport", () => {
    const r = checkMove(all[2], "2026-11-01", all, [{ name: "BJJ", hours_per_week: 3, intensity: "high", days: [6] }]);
    expect(r.messages.join(" ")).toMatch(/BJJ/);
  });
  it("wykrywa pominięte treningi", () => {
    expect(missedSessions(all, "2026-10-29").map((s) => s.id)).toEqual(["a"]);
  });
});
