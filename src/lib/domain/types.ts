/**
 * Model domenowy SEAL PERFORMANCE.
 *
 * Nazwy pól są w snake_case i odpowiadają 1:1 kolumnom tabel w Supabase
 * (supabase/migrations/0001_init.sql). Dzięki temu ten sam rekord może być
 * zapisany lokalnie (IndexedDB) lub w PostgreSQL bez warstwy mapowania.
 *
 * Zasada: wartości PLANOWANE (workout_exercises, meal_plan_entries,
 * nutrition_targets) są rozdzielone od WYKONANYCH (exercise_sets,
 * food_log_entries, body_measurements).
 */
import type { ISODate } from "@/lib/utils/dates";

export interface BaseRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

export type Sex = "male" | "female";
export type Experience = "beginner" | "intermediate" | "advanced";
export type JobActivity = "sedentary" | "standing" | "physical";
export type Intensity = "low" | "moderate" | "high";

export type Equipment =
  | "barbell"
  | "squat_rack"
  | "bench"
  | "dumbbells"
  | "kettlebell"
  | "pullup_bar"
  | "cable"
  | "machines"
  | "trap_bar"
  | "dip_station"
  | "air_bike"
  | "rower"
  | "bike"
  | "sled"
  | "bands"
  | "medicine_ball"
  | "ab_wheel";

export type InjuryArea = "knee" | "lower_back" | "shoulder" | "elbow" | "wrist" | "hip" | "ankle" | "neck";

export interface Sport {
  name: string;
  hours_per_week: number;
  intensity: Intensity;
  /** Dni tygodnia (0 = pon), w które uprawiany jest sport */
  days: number[];
}

export interface Injury {
  area: InjuryArea;
  note: string;
}

export interface Profile extends BaseRecord {
  display_name: string;
  birth_year: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  waist_cm: number | null;
  target_weight_kg: number | null;
  experience: Experience;
  job_activity: JobActivity;
  avg_steps: number;
  sports: Sport[];
  strength_sessions_per_week: number;
  session_minutes: number;
  training_days: number[];
  equipment: Equipment[];
  injuries: Injury[];
  /** Przeciwwskazania do intensywnego wysiłku (np. zgłoszone przez lekarza) */
  has_contraindications: boolean;
  contraindications_note: string;
  onboarding_completed: boolean;
}

export type GoalType = "fat_loss" | "muscle_gain" | "recomposition" | "strength" | "conditioning" | "maintenance";

export interface UserGoal extends BaseRecord {
  goal: GoalType;
  is_primary: boolean;
}

export type DietStyle = "classic" | "high_protein" | "low_carb" | "mediterranean" | "vegetarian";
export type Budget = "low" | "medium" | "high";
export type MacroMode = "standard" | "high_protein" | "low_carb" | "custom";
export type CalorieMode = "constant" | "cycling";
export type DeficitRate = "gentle" | "moderate" | "faster";
export type Allergen =
  | "gluten"
  | "milk"
  | "eggs"
  | "nuts"
  | "peanuts"
  | "soy"
  | "fish"
  | "crustaceans"
  | "sesame"
  | "celery"
  | "mustard";

export interface NotificationSettings {
  enabled: boolean;
  training: boolean;
  training_time: string; // "HH:MM"
  weigh_in: boolean;
  weigh_in_time: string;
  weekly_report: boolean;
  meals: boolean;
  meal_times: string[];
}

export interface UserPreferences extends BaseRecord {
  meals_per_day: number;
  meal_names: string[];
  preset_kcal: number | null;
  allergies: Allergen[];
  excluded_foods: string[];
  favorite_foods: string[];
  diet_style: DietStyle;
  max_prep_minutes: number;
  budget: Budget;
  batch_cooking: boolean;
  /** 1 = jak najwięcej różnorodności, 3 = mogą się powtarzać codziennie */
  repetition_tolerance: 1 | 2 | 3;
  calorie_mode: CalorieMode;
  macro_mode: MacroMode;
  custom_protein_g_per_kg: number;
  custom_fat_pct: number;
  deficit_rate: DeficitRate;
  water_goal_ml: number;
  notifications: NotificationSettings;
  ai_assistant_consent: boolean;
}

/* ------------------------------------------------------------------ */
/* Trening                                                             */
/* ------------------------------------------------------------------ */

export type WorkoutTemplate = "A" | "B" | "C";
export type Block = "warmup" | "strength" | "hypertrophy" | "core" | "functional" | "conditioning" | "cooldown";

export interface ProgramConfig {
  experience: Experience;
  equipment: Equipment[];
  injuries: InjuryArea[];
  session_minutes: number;
  primary_goal: GoalType;
  goals: GoalType[];
  conditioning_allowed: boolean;
}

export interface TrainingProgram extends BaseRecord {
  name: string;
  cycle_number: number;
  start_date: ISODate;
  status: "active" | "completed" | "archived";
  config: ProgramConfig;
  /** Serie tygodniowo na grupę mięśniową (tydzień 1) */
  weekly_volume: Record<string, number>;
  notes: string;
}

export interface TimedItem {
  exercise_id: string;
  /** Czas w sekundach lub liczba powtórzeń — opis w prescription */
  prescription: string;
}

export interface WorkoutSession extends BaseRecord {
  program_id: string;
  week: number;
  day_index: number;
  template: WorkoutTemplate;
  title: string;
  focus: string;
  scheduled_date: ISODate;
  status: "planned" | "in_progress" | "completed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  duration_sec: number | null;
  /** Suma czasu w pauzie (do licznika czasu treningu) */
  paused_ms: number;
  paused_at: string | null;
  notes: string;
  /** Subiektywna trudność całej sesji 1–10 (sRPE) */
  session_rpe: number | null;
  /** Jakość regeneracji przed treningiem 1–5 */
  recovery_rating: number | null;
  warmup: TimedItem[];
  cooldown: TimedItem[];
  phase_note: string;
  /** Koniec bieżącej przerwy (ISO) — pozwala odtworzyć timer po zamknięciu aplikacji */
  rest_ends_at: string | null;
}

export interface WorkoutExercise extends BaseRecord {
  session_id: string;
  exercise_id: string;
  order_index: number;
  block: Block;
  sets: number;
  rep_min: number;
  rep_max: number;
  /** Jeżeli > 0 — ćwiczenie na czas (np. plank, farmer's walk) */
  duration_sec: number;
  distance_m: number;
  target_rir: number;
  tempo: string;
  rest_sec: number;
  suggested_load_kg: number | null;
  load_note: string;
  /** Ćwiczenie podmienione przez użytkownika (alternatywa) */
  substituted_from: string | null;
  /** Ocena techniki po wykonaniu (null = brak oceny) */
  technique_ok: boolean | null;
}

export interface ExerciseSet extends BaseRecord {
  workout_exercise_id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  duration_sec: number | null;
  completed: boolean;
  completed_at: string | null;
}

export type ProgressionAction = "increase_load" | "increase_reps" | "hold" | "decrease_load" | "deload" | "calibrate";

export interface ProgressionRecommendation extends BaseRecord {
  exercise_id: string;
  based_on_session_id: string;
  target_session_id: string | null;
  action: ProgressionAction;
  current_load_kg: number | null;
  suggested_load_kg: number | null;
  rep_target: string;
  set_target: number | null;
  explanation: string[];
  status: "pending" | "accepted" | "dismissed";
}

/* ------------------------------------------------------------------ */
/* Pomiary i samopoczucie                                              */
/* ------------------------------------------------------------------ */

export interface BodyMeasurement extends BaseRecord {
  date: ISODate;
  weight_kg: number | null;
  waist_cm: number | null;
  note: string;
}

export interface DailyCheckin extends BaseRecord {
  date: ISODate;
  /** 1 = brak zmęczenia, 5 = bardzo duże */
  fatigue: number;
  /** 1 = bardzo słaby sen, 5 = bardzo dobry */
  sleep_quality: number;
  /** 1 = brak bolesności, 5 = silna */
  soreness: number;
  steps: number | null;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Żywienie                                                            */
/* ------------------------------------------------------------------ */

export type DayType = "gym" | "sport" | "rest";

export interface MacroTargets {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

export interface NutritionTarget extends BaseRecord, MacroTargets {
  valid_from: ISODate;
  active: boolean;
  bmr: number;
  tdee: number;
  maintenance_kcal: number;
  macro_mode: MacroMode;
  calorie_mode: CalorieMode;
  day_targets: Record<DayType, MacroTargets>;
  source: "calculator" | "adjustment" | "manual";
  reason: string;
}

export type FoodCategory =
  | "meat"
  | "fish"
  | "dairy"
  | "eggs"
  | "grains"
  | "bread"
  | "legumes"
  | "vegetables"
  | "fruit"
  | "nuts"
  | "fats"
  | "sweets"
  | "drinks"
  | "spices"
  | "ready"
  | "other";

export interface NutritionPer100 {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export interface FoodProduct extends BaseRecord, NutritionPer100 {
  name: string;
  brand: string;
  barcode: string | null;
  /** Wartości podane na 100 g lub na 100 ml */
  basis: "g" | "ml";
  /** g na 1 ml (dla płynów) */
  density: number;
  piece_g: number | null;
  piece_name: string | null;
  serving_g: number | null;
  category: FoodCategory;
  allergens: Allergen[];
  tags: string[];
  /** Źródło danych odżywczych — przechowywane zawsze */
  source: string;
  source_ref: string | null;
  /** Szacunkowa cena PLN/kg (do budżetu) */
  price_per_kg: number | null;
  /** Masa po ugotowaniu / masa surowa (np. ryż ≈ 2.6) */
  cooked_ratio: number | null;
}

export interface Recipe extends BaseRecord {
  name: string;
  servings: number;
  final_mass_g: number | null;
  instructions: string;
  favorite: boolean;
  tags: string[];
  prep_minutes: number;
}

export interface RecipeIngredient extends BaseRecord {
  recipe_id: string;
  product_id: string;
  grams: number;
  order_index: number;
}

export interface PlanIngredient {
  product_id: string;
  grams: number;
  role: "protein" | "carb" | "fat" | "veg" | "fixed";
}

export interface MealPlan extends BaseRecord {
  name: string;
  start_date: ISODate;
  days: number;
  status: "active" | "archived";
  settings: Record<string, unknown>;
}

export interface MealPlanEntry extends BaseRecord {
  plan_id: string;
  date: ISODate;
  slot_index: number;
  slot_name: string;
  day_type: DayType;
  template_id: string;
  title: string;
  ingredients: PlanIngredient[];
  instructions: string[];
  prep_minutes: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  locked: boolean;
}

export type FoodUnit = "g" | "ml" | "szt" | "porcja" | "lyzeczka" | "lyzka";

export interface FoodLogEntry extends BaseRecord {
  date: ISODate;
  meal_index: number;
  product_id: string | null;
  recipe_id: string | null;
  plan_entry_id: string | null;
  name: string;
  amount: number;
  unit: FoodUnit;
  grams: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}

export interface WaterEntry extends BaseRecord {
  date: ISODate;
  ml: number;
}

export interface ShoppingList extends BaseRecord {
  name: string;
  plan_id: string | null;
  date_from: ISODate;
  date_to: ISODate;
}

export interface ShoppingListItem extends BaseRecord {
  list_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  in_pantry: boolean;
  manual: boolean;
}

export interface WeeklyReport extends BaseRecord {
  week_start: ISODate;
  data: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Kolekcje                                                            */
/* ------------------------------------------------------------------ */

export interface CollectionMap {
  profiles: Profile;
  user_goals: UserGoal;
  user_preferences: UserPreferences;
  training_programs: TrainingProgram;
  workout_sessions: WorkoutSession;
  workout_exercises: WorkoutExercise;
  exercise_sets: ExerciseSet;
  progression_recommendations: ProgressionRecommendation;
  body_measurements: BodyMeasurement;
  daily_checkins: DailyCheckin;
  nutrition_targets: NutritionTarget;
  food_products: FoodProduct;
  recipes: Recipe;
  recipe_ingredients: RecipeIngredient;
  meal_plans: MealPlan;
  meal_plan_entries: MealPlanEntry;
  food_log_entries: FoodLogEntry;
  water_entries: WaterEntry;
  shopping_lists: ShoppingList;
  shopping_list_items: ShoppingListItem;
  weekly_reports: WeeklyReport;
}

export type CollectionName = keyof CollectionMap;

export const COLLECTIONS: CollectionName[] = [
  "profiles",
  "user_goals",
  "user_preferences",
  "training_programs",
  "workout_sessions",
  "workout_exercises",
  "exercise_sets",
  "progression_recommendations",
  "body_measurements",
  "daily_checkins",
  "nutrition_targets",
  "food_products",
  "recipes",
  "recipe_ingredients",
  "meal_plans",
  "meal_plan_entries",
  "food_log_entries",
  "water_entries",
  "shopping_lists",
  "shopping_list_items",
  "weekly_reports",
];

export type Snapshot = { [K in CollectionName]: Record<string, CollectionMap[K]> };

export function emptySnapshot(): Snapshot {
  const s = {} as Snapshot;
  for (const c of COLLECTIONS) (s as Record<string, unknown>)[c] = {};
  return s;
}

/** Pola zarządzane przez warstwę danych */
export type NewRecord<T extends BaseRecord> = Omit<T, "id" | "user_id" | "created_at" | "updated_at"> & { id?: string };
