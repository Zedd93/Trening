"use client";

import type { GoalType, NewRecord, NotificationSettings, Profile, UserPreferences } from "@/lib/domain/types";
import { createRecord, createRecords, putRecords, removeRecords, snapshot, updateRecord } from "@/lib/data/store";
import { today } from "@/lib/utils/dates";
import { generateProgram } from "@/lib/training/generator";
import { computeTargets, saveNutritionTarget } from "./nutrition";
import { saveGeneratedProgram } from "./training";
import { getGoals, getPrefs, getProfile } from "@/lib/selectors";
import { defaultMealNames } from "@/lib/nutrition/meals";

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  training: true,
  training_time: "17:30",
  weigh_in: true,
  weigh_in_time: "07:30",
  weekly_report: true,
  meals: false,
  meal_times: ["08:00", "13:00", "19:00"],
};

export type ProfileInput = Omit<Profile, "id" | "user_id" | "created_at" | "updated_at" | "onboarding_completed">;
export type PrefsInput = Omit<UserPreferences, "id" | "user_id" | "created_at" | "updated_at">;

export function defaultPrefs(): PrefsInput {
  return {
    meals_per_day: 4,
    meal_names: defaultMealNames(4),
    preset_kcal: null,
    allergies: [],
    excluded_foods: [],
    favorite_foods: [],
    diet_style: "classic",
    max_prep_minutes: 30,
    budget: "medium",
    batch_cooking: true,
    repetition_tolerance: 2,
    calorie_mode: "constant",
    macro_mode: "standard",
    custom_protein_g_per_kg: 2,
    custom_fat_pct: 27,
    deficit_rate: "moderate",
    water_goal_ml: 2500,
    notifications: DEFAULT_NOTIFICATIONS,
    ai_assistant_consent: false,
  };
}

export interface OnboardingResult {
  warnings: string[];
}

export function completeOnboarding(profile: ProfileInput, goals: GoalType[], primary: GoalType, prefs: PrefsInput, startDate: string): OnboardingResult {
  const p = createRecord("profiles", { ...profile, onboarding_completed: true });
  createRecords(
    "user_goals",
    Array.from(new Set([primary, ...goals])).map((g) => ({ goal: g, is_primary: g === primary })),
  );
  const pr = createRecord("user_preferences", prefs);
  const computed = computeTargets(p, pr, { goals, primary });
  saveNutritionTarget(computed.target);
  createRecord("body_measurements", { date: today(), weight_kg: profile.weight_kg, waist_cm: profile.waist_cm, note: "Pomiar początkowy" });
  const gen = generateProgram({
    experience: profile.experience,
    equipment: profile.equipment,
    injuries: profile.injuries.map((i) => i.area),
    session_minutes: profile.session_minutes,
    goals,
    primary_goal: primary,
    has_contraindications: profile.has_contraindications,
    training_days: profile.training_days,
    start_date: startDate,
    cycle_number: 1,
  });
  saveGeneratedProgram(gen);
  return { warnings: [...gen.warnings, ...computed.warnings] };
}

export function updateProfile(patch: Partial<ProfileInput>) {
  const p = getProfile(snapshot());
  if (p) updateRecord("profiles", p.id, patch);
}

export function updatePrefs(patch: Partial<PrefsInput>) {
  const p = getPrefs(snapshot());
  if (p) updateRecord("user_preferences", p.id, patch);
}

export function updateGoals(goals: GoalType[], primary: GoalType) {
  const data = snapshot();
  removeRecords("user_goals", Object.keys(data.user_goals));
  createRecords(
    "user_goals",
    Array.from(new Set([primary, ...goals])).map((g): NewRecord<import("@/lib/domain/types").UserGoal> => ({ goal: g, is_primary: g === primary })),
  );
}

/** Przelicza i zapisuje nowe cele żywieniowe po zmianie profilu/preferencji. */
export function recalculateTargets(weightOverride?: number) {
  const data = snapshot();
  const p = getProfile(data);
  const pr = getPrefs(data);
  if (!p || !pr) return null;
  const c = computeTargets(p, pr, getGoals(data), weightOverride);
  saveNutritionTarget(c.target);
  return c;
}

export function addMeasurement(date: string, weight: number | null, waist: number | null, note = "") {
  const existing = Object.values(snapshot().body_measurements).find((m) => m.date === date);
  if (existing)
    return putRecords("body_measurements", [{ ...existing, weight_kg: weight ?? existing.weight_kg, waist_cm: waist ?? existing.waist_cm, note: note || existing.note }])[0];
  return createRecord("body_measurements", { date, weight_kg: weight, waist_cm: waist, note });
}

export function deleteMeasurement(id: string) {
  removeRecords("body_measurements", [id]);
}

export function saveCheckin(date: string, v: { fatigue: number; sleep_quality: number; soreness: number; steps: number | null; note: string }) {
  const existing = Object.values(snapshot().daily_checkins).find((c) => c.date === date);
  if (existing) return updateRecord("daily_checkins", existing.id, v);
  return createRecord("daily_checkins", { date, ...v });
}
