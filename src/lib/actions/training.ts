"use client";

import type { ExerciseSet, ProgressionRecommendation, WorkoutExercise, WorkoutSession } from "@/lib/domain/types";
import { createRecord, createRecords, putRecords, removeRecords, snapshot, updateRecord } from "@/lib/data/store";
import { addDays, diffDays, nowISO, startOfWeek, today, type ISODate } from "@/lib/utils/dates";
import { avg } from "@/lib/utils/format";
import { EXERCISE_MAP } from "@/lib/training/exercises";
import { generateProgram } from "@/lib/training/generator";
import { recommend } from "@/lib/training/progression";
import { missedSessions } from "@/lib/training/schedule";
import { getActiveProgram, getGoals, getProfile, programSessions, sessionExercises } from "@/lib/selectors";

/* ------------------------------ sesja ------------------------------ */

export function startSession(sessionId: string, recovery: number | null) {
  const s = snapshot().workout_sessions[sessionId];
  if (!s) return;
  updateRecord("workout_sessions", sessionId, {
    status: "in_progress",
    started_at: s.started_at ?? nowISO(),
    recovery_rating: recovery ?? s.recovery_rating,
    paused_at: null,
  });
}

export function pauseSession(sessionId: string) {
  const s = snapshot().workout_sessions[sessionId];
  if (!s || s.paused_at) return;
  updateRecord("workout_sessions", sessionId, { paused_at: nowISO() });
}

export function resumeSession(sessionId: string) {
  const s = snapshot().workout_sessions[sessionId];
  if (!s || !s.paused_at) return;
  const pausedFor = Date.now() - new Date(s.paused_at).getTime();
  updateRecord("workout_sessions", sessionId, { paused_at: null, paused_ms: (s.paused_ms ?? 0) + pausedFor });
}

export function startRest(sessionId: string, seconds: number) {
  updateRecord("workout_sessions", sessionId, { rest_ends_at: new Date(Date.now() + seconds * 1000).toISOString() });
}

export function stopRest(sessionId: string) {
  updateRecord("workout_sessions", sessionId, { rest_ends_at: null });
}

export function findSet(workoutExerciseId: string, setNumber: number): ExerciseSet | undefined {
  return Object.values(snapshot().exercise_sets).find((s) => s.workout_exercise_id === workoutExerciseId && s.set_number === setNumber);
}

/** Zapis pojedynczego pola serii — wywoływany przy każdej zmianie (odzyskiwanie sesji). */
export function upsertSet(we: WorkoutExercise, setNumber: number, patch: Partial<Pick<ExerciseSet, "weight_kg" | "reps" | "rir" | "completed" | "duration_sec">>): ExerciseSet {
  const existing = findSet(we.id, setNumber);
  const completedPatch =
    patch.completed === undefined ? {} : { completed: patch.completed, completed_at: patch.completed ? nowISO() : null };
  if (existing) return updateRecord("exercise_sets", existing.id, { ...patch, ...completedPatch })!;
  return createRecord("exercise_sets", {
    workout_exercise_id: we.id,
    session_id: we.session_id,
    exercise_id: we.exercise_id,
    set_number: setNumber,
    weight_kg: patch.weight_kg ?? null,
    reps: patch.reps ?? null,
    rir: patch.rir ?? null,
    duration_sec: patch.duration_sec ?? null,
    completed: patch.completed ?? false,
    completed_at: patch.completed ? nowISO() : null,
  });
}

export function removeSet(workoutExerciseId: string, setNumber: number) {
  const s = findSet(workoutExerciseId, setNumber);
  if (s) removeRecords("exercise_sets", [s.id]);
}

export function setTechnique(workoutExerciseId: string, ok: boolean | null) {
  updateRecord("workout_exercises", workoutExerciseId, { technique_ok: ok });
}

export function updateSessionNotes(sessionId: string, notes: string) {
  updateRecord("workout_sessions", sessionId, { notes });
}

export function finishSession(sessionId: string, sessionRpe: number | null, notes: string): ProgressionRecommendation[] {
  const s = snapshot().workout_sessions[sessionId];
  if (!s) return [];
  const completedAt = nowISO();
  const startedAt = s.started_at ?? completedAt;
  const pausedExtra = s.paused_at ? Date.now() - new Date(s.paused_at).getTime() : 0;
  const duration = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime() - (s.paused_ms ?? 0) - pausedExtra) / 1000));
  updateRecord("workout_sessions", sessionId, {
    status: "completed",
    completed_at: completedAt,
    started_at: startedAt,
    duration_sec: duration,
    session_rpe: sessionRpe,
    notes,
    paused_at: null,
    rest_ends_at: null,
  });
  return generateRecommendations(sessionId);
}

export function skipSession(sessionId: string) {
  updateRecord("workout_sessions", sessionId, { status: "skipped" });
}

export function reopenSession(sessionId: string) {
  updateRecord("workout_sessions", sessionId, { status: "planned", completed_at: null, started_at: null, duration_sec: null, paused_at: null, paused_ms: 0 });
}

export function moveSession(sessionId: string, date: ISODate) {
  updateRecord("workout_sessions", sessionId, { scheduled_date: date });
}

/* --------------------------- progresja ---------------------------- */

export function generateRecommendations(sessionId: string): ProgressionRecommendation[] {
  const data = snapshot();
  const session = data.workout_sessions[sessionId];
  if (!session) return [];
  const all = programSessions(data, session.program_id);
  const exercises = sessionExercises(data, sessionId);
  const sets = Object.values(data.exercise_sets);
  const checkins = Object.values(data.daily_checkins).filter((c) => diffDays(today(), c.date) <= 3 && diffDays(today(), c.date) >= 0);
  const sessionDate = (session.completed_at ?? nowISO()).slice(0, 10);
  const missed = missedSessions(all, today()).length;

  const created: ProgressionRecommendation[] = [];
  const toDismiss: string[] = [];
  for (const we of exercises) {
    const def = EXERCISE_MAP[we.exercise_id];
    if (!def) continue;
    const target = all
      .filter((s) => s.id !== sessionId && s.status === "planned" && s.scheduled_date >= session.scheduled_date)
      .find((s) => Object.values(data.workout_exercises).some((x) => x.session_id === s.id && x.exercise_id === we.exercise_id));
    const prev = all
      .filter((s) => s.id !== sessionId && s.status === "completed" && s.completed_at && s.completed_at < (session.completed_at ?? nowISO()))
      .filter((s) => Object.values(data.workout_exercises).some((x) => x.session_id === s.id && x.exercise_id === we.exercise_id))
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
    const rec = recommend(def, we, sets.filter((x) => x.workout_exercise_id === we.id), {
      target_week: target ? target.week : null,
      session_rpe: session.session_rpe,
      recovery_rating: session.recovery_rating,
      recent_fatigue: avg(checkins.map((c) => c.fatigue)),
      missed_sessions: missed,
      days_since_previous: prev?.completed_at ? diffDays(sessionDate, prev.completed_at.slice(0, 10)) : null,
    });
    if (!rec) continue;
    // Starsze oczekujące rekomendacje dla tego ćwiczenia tracą ważność.
    for (const old of Object.values(data.progression_recommendations)) if (old.exercise_id === we.exercise_id && old.status === "pending") toDismiss.push(old.id);
    created.push({
      ...rec,
      exercise_id: we.exercise_id,
      based_on_session_id: sessionId,
      target_session_id: target?.id ?? null,
      status: "pending",
    } as unknown as ProgressionRecommendation);
  }
  const now = new Date().toISOString();
  if (toDismiss.length)
    putRecords(
      "progression_recommendations",
      toDismiss.map((id) => ({ ...snapshot().progression_recommendations[id], status: "dismissed" as const, updated_at: now })),
    );
  return createRecords("progression_recommendations", created.map(({ id: _i, user_id: _u, created_at: _c, updated_at: _p, ...r }) => r));
}

export function acceptRecommendation(recId: string) {
  const data = snapshot();
  const rec = data.progression_recommendations[recId];
  if (!rec) return;
  if (rec.target_session_id) {
    const targetEx = Object.values(data.workout_exercises).find((x) => x.session_id === rec.target_session_id && x.exercise_id === rec.exercise_id);
    if (targetEx) {
      updateRecord("workout_exercises", targetEx.id, {
        suggested_load_kg: rec.suggested_load_kg,
        sets: rec.set_target ?? targetEx.sets,
        target_rir: rec.action === "deload" ? Math.max(3, targetEx.target_rir) : targetEx.target_rir,
        load_note: `${rec.rep_target}${rec.action === "deload" ? " — odciążenie" : ""}`,
      });
    }
  }
  updateRecord("progression_recommendations", recId, { status: "accepted" });
}

export function dismissRecommendation(recId: string) {
  updateRecord("progression_recommendations", recId, { status: "dismissed" });
}

/* --------------------------- zamiana ćwiczenia --------------------- */

export function substituteExercise(workoutExerciseId: string, newExerciseId: string, scope: "this" | "future") {
  const data = snapshot();
  const we = data.workout_exercises[workoutExerciseId];
  if (!we) return;
  const session = data.workout_sessions[we.session_id];
  const targets =
    scope === "this"
      ? [we]
      : Object.values(data.workout_exercises).filter((x) => {
          const s = data.workout_sessions[x.session_id];
          return s && s.program_id === session.program_id && x.exercise_id === we.exercise_id && (s.id === session.id || (s.status === "planned" && s.scheduled_date >= session.scheduled_date));
        });
  const def = EXERCISE_MAP[newExerciseId];
  putRecords(
    "workout_exercises",
    targets.map((x) => ({ ...x, exercise_id: newExerciseId, substituted_from: x.substituted_from ?? x.exercise_id, suggested_load_kg: null, tempo: def?.tempo ?? x.tempo })),
  );
}

/* ------------------------------ cykle ------------------------------ */

export function saveGeneratedProgram(gen: ReturnType<typeof generateProgram>) {
  createRecords("training_programs", [gen.program]);
  createRecords("workout_sessions", gen.sessions);
  createRecords("workout_exercises", gen.exercises);
}

/** Ostatnie ciężary robocze: zaakceptowana/oczekująca rekomendacja lub najcięższa ukończona seria. */
export function lastWorkingLoads(): Record<string, number> {
  const data = snapshot();
  const out: Record<string, { w: number; at: string }> = {};
  for (const s of Object.values(data.exercise_sets)) {
    if (!s.completed || !s.weight_kg) continue;
    const at = s.completed_at ?? s.updated_at;
    const cur = out[s.exercise_id];
    if (!cur || at > cur.at || (at === cur.at && s.weight_kg > cur.w)) out[s.exercise_id] = { w: s.weight_kg, at };
  }
  for (const r of Object.values(data.progression_recommendations)) {
    if (r.status === "dismissed" || r.suggested_load_kg === null) continue;
    const cur = out[r.exercise_id];
    if (!cur || r.created_at >= cur.at) out[r.exercise_id] = { w: r.suggested_load_kg, at: r.created_at };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.w]));
}

export function generateNextCycle(startDate?: ISODate) {
  const data = snapshot();
  const profile = getProfile(data);
  const current = getActiveProgram(data);
  if (!profile) throw new Error("Brak profilu.");
  const { goals, primary } = getGoals(data);
  const lastDate = current ? programSessions(data, current.id).at(-1)?.scheduled_date ?? today() : today();
  const start = startDate ?? startOfWeek(addDays(lastDate, 7));
  const gen = generateProgram({
    experience: profile.experience,
    equipment: profile.equipment,
    injuries: profile.injuries.map((i) => i.area),
    session_minutes: profile.session_minutes,
    goals,
    primary_goal: primary,
    has_contraindications: profile.has_contraindications,
    training_days: profile.training_days,
    start_date: start,
    cycle_number: (current?.cycle_number ?? 0) + 1,
    last_loads: lastWorkingLoads(),
  });
  if (current) updateRecord("training_programs", current.id, { status: "completed" });
  saveGeneratedProgram(gen);
  return gen;
}

/** Kopia planu: te same ćwiczenia i schemat, nowe daty, bez wykonanych serii. */
export function copyProgram(programId: string, startDate: ISODate) {
  const data = snapshot();
  const prog = data.training_programs[programId];
  if (!prog) return;
  const sessions = programSessions(data, programId);
  const offset = diffDays(startDate, prog.start_date);
  const maxCycle = Math.max(0, ...Object.values(data.training_programs).map((p) => p.cycle_number));
  for (const p of Object.values(data.training_programs)) if (p.status === "active") updateRecord("training_programs", p.id, { status: "completed" });
  const newProg = createRecord("training_programs", { ...stripBase(prog), name: `${prog.name} (kopia)`, cycle_number: maxCycle + 1, start_date: startDate, status: "active" });
  for (const s of sessions) {
    const ns = createRecord("workout_sessions", {
      ...stripBase(s),
      program_id: newProg.id,
      scheduled_date: addDays(s.scheduled_date, offset),
      status: "planned",
      started_at: null,
      completed_at: null,
      duration_sec: null,
      paused_ms: 0,
      paused_at: null,
      notes: "",
      session_rpe: null,
      recovery_rating: null,
      rest_ends_at: null,
    } as Omit<WorkoutSession, "id" | "user_id" | "created_at" | "updated_at">);
    createRecords(
      "workout_exercises",
      sessionExercises(data, s.id).map((e) => ({ ...stripBase(e), session_id: ns.id, technique_ok: null })),
    );
  }
}

function stripBase<T extends { id: string; user_id: string; created_at: string; updated_at: string }>(r: T): Omit<T, "id" | "user_id" | "created_at" | "updated_at"> {
  const { id: _i, user_id: _u, created_at: _c, updated_at: _p, ...rest } = r;
  return rest;
}
