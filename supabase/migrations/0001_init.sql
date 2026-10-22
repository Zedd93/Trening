-- =====================================================================
-- SEAL PERFORMANCE — schemat bazy danych (Supabase / PostgreSQL 15+)
--
-- Zasady:
--  * Każda tabela użytkownika ma kolumnę user_id → auth.users (ON DELETE
--    CASCADE). Usunięcie konta usuwa wszystkie dane (RODO, art. 17).
--  * Row Level Security: użytkownik widzi i modyfikuje wyłącznie wiersze,
--    w których user_id = auth.uid(). Klient używa klucza anon + JWT.
--  * Wartości PLANOWANE (workout_exercises, meal_plan_entries,
--    nutrition_targets) są oddzielone od WYKONANYCH (exercise_sets,
--    food_log_entries, body_measurements).
--  * Nazwy kolumn = pola typów TypeScript (src/lib/domain/types.ts).
-- =====================================================================

create extension if not exists "pgcrypto";

-- Wspólny wyzwalacz aktualizujący updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Katalog ćwiczeń (dane referencyjne, tylko do odczytu dla użytkowników)
-- ---------------------------------------------------------------------
create table public.exercises (
  id text primary key,
  name text not null,
  category text not null,
  muscles_primary text[] not null default '{}',
  muscles_secondary text[] not null default '{}',
  equipment text[] not null default '{}',
  load_type text not null,
  increment_kg numeric(5,2) not null default 2.5,
  avoid_with text[] not null default '{}',
  tempo text not null default '',
  cues text[] not null default '{}',
  alternatives text[] not null default '{}'
);

create table public.exercise_media (
  exercise_id text primary key references public.exercises(id) on delete cascade,
  kind text not null check (kind in ('svg_rig', 'lottie', 'video', 'none')),
  view text check (view in ('side', 'front')),
  -- Klatki kluczowe animacji są wersjonowane w kodzie (src/lib/training/animations.ts);
  -- tu można przechowywać alternatywne media (np. URL Lottie) z informacją o źródle.
  url text,
  source text
);

-- ---------------------------------------------------------------------
-- Profil i preferencje
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_year smallint not null check (birth_year between 1900 and 2100),
  sex text not null check (sex in ('male', 'female')),
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 300),
  target_weight_kg numeric(5,1),
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  job_activity text not null check (job_activity in ('sedentary', 'standing', 'physical')),
  avg_steps integer not null default 0 check (avg_steps >= 0),
  sports jsonb not null default '[]',
  strength_sessions_per_week smallint not null default 3,
  session_minutes smallint not null default 60,
  training_days smallint[] not null default '{0,2,4}',
  equipment text[] not null default '{}',
  injuries jsonb not null default '[]',
  has_contraindications boolean not null default false,
  contraindications_note text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('fat_loss', 'muscle_gain', 'recomposition', 'strength', 'conditioning', 'maintenance')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, goal)
);
create unique index user_goals_one_primary on public.user_goals (user_id) where is_primary;

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  meals_per_day smallint not null default 4 check (meals_per_day between 1 and 8),
  meal_names text[] not null default '{}',
  preset_kcal integer check (preset_kcal between 800 and 8000),
  allergies text[] not null default '{}',
  excluded_foods text[] not null default '{}',
  favorite_foods text[] not null default '{}',
  diet_style text not null default 'classic',
  max_prep_minutes smallint not null default 30,
  budget text not null default 'medium' check (budget in ('low', 'medium', 'high')),
  batch_cooking boolean not null default true,
  repetition_tolerance smallint not null default 2 check (repetition_tolerance between 1 and 3),
  calorie_mode text not null default 'constant' check (calorie_mode in ('constant', 'cycling')),
  macro_mode text not null default 'standard' check (macro_mode in ('standard', 'high_protein', 'low_carb', 'custom')),
  custom_protein_g_per_kg numeric(3,1) not null default 2.0,
  custom_fat_pct numeric(4,1) not null default 27,
  deficit_rate text not null default 'moderate' check (deficit_rate in ('gentle', 'moderate', 'faster')),
  water_goal_ml integer not null default 2500,
  notifications jsonb not null default '{}',
  ai_assistant_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trening: plan
-- ---------------------------------------------------------------------
create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cycle_number integer not null,
  start_date date not null,
  status text not null check (status in ('active', 'completed', 'archived')),
  config jsonb not null,
  weekly_volume jsonb not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.training_programs (user_id, status);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.training_programs(id) on delete cascade,
  week smallint not null check (week between 1 and 8),
  day_index smallint not null,
  template text not null check (template in ('A', 'B', 'C')),
  title text not null,
  focus text not null default '',
  scheduled_date date not null,
  status text not null check (status in ('planned', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_sec integer,
  paused_ms bigint not null default 0,
  paused_at timestamptz,
  notes text not null default '',
  session_rpe smallint check (session_rpe between 1 and 10),
  recovery_rating smallint check (recovery_rating between 1 and 5),
  warmup jsonb not null default '[]',
  cooldown jsonb not null default '[]',
  phase_note text not null default '',
  rest_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.workout_sessions (user_id, scheduled_date);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text not null,
  order_index smallint not null,
  block text not null,
  sets smallint not null check (sets between 0 and 20),
  rep_min smallint not null default 0,
  rep_max smallint not null default 0,
  duration_sec integer not null default 0,
  distance_m integer not null default 0,
  target_rir smallint not null default 2,
  tempo text not null default '',
  rest_sec integer not null default 90,
  suggested_load_kg numeric(6,2),
  load_note text not null default '',
  substituted_from text,
  technique_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.workout_exercises (user_id, session_id);

-- ---------------------------------------------------------------------
-- Trening: wykonanie
-- ---------------------------------------------------------------------
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text not null,
  set_number smallint not null check (set_number between 1 and 30),
  weight_kg numeric(6,2) check (weight_kg >= 0 and weight_kg <= 1000),
  reps integer check (reps >= 0 and reps <= 10000),
  rir smallint check (rir between 0 and 10),
  duration_sec integer,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number)
);
create index on public.exercise_sets (user_id, exercise_id);

create table public.progression_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  based_on_session_id uuid references public.workout_sessions(id) on delete cascade,
  target_session_id uuid references public.workout_sessions(id) on delete set null,
  action text not null check (action in ('increase_load', 'increase_reps', 'hold', 'decrease_load', 'deload', 'calibrate')),
  current_load_kg numeric(6,2),
  suggested_load_kg numeric(6,2),
  rep_target text not null default '',
  set_target smallint,
  explanation text[] not null default '{}',
  status text not null check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pomiary i samopoczucie
-- ---------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) check (weight_kg between 30 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 300),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  fatigue smallint not null check (fatigue between 1 and 5),
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  steps integer check (steps >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------
-- Żywienie: cele (historia zmian — nowy wiersz przy każdej zmianie)
-- ---------------------------------------------------------------------
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  valid_from date not null,
  active boolean not null default true,
  kcal integer not null check (kcal between 800 and 10000),
  protein_g integer not null check (protein_g >= 0),
  fat_g integer not null check (fat_g >= 0),
  carbs_g integer not null check (carbs_g >= 0),
  fiber_g integer not null default 25,
  bmr integer not null default 0,
  tdee integer not null default 0,
  maintenance_kcal integer not null default 0,
  macro_mode text not null,
  calorie_mode text not null,
  day_targets jsonb not null,
  source text not null check (source in ('calculator', 'adjustment', 'manual')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.nutrition_targets (user_id, valid_from desc);

-- Produkty użytkownika (własne, z etykiety lub zaimportowane z Open Food Facts).
-- Produkty generyczne są w kodzie (src/lib/nutrition/foods.ts) wraz ze źródłem.
create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text not null default '',
  barcode text,
  kcal numeric(7,2) not null check (kcal >= 0),
  protein numeric(6,2) not null check (protein >= 0),
  fat numeric(6,2) not null check (fat >= 0),
  carbs numeric(6,2) not null check (carbs >= 0),
  fiber numeric(6,2) not null default 0,
  basis text not null default 'g' check (basis in ('g', 'ml')),
  density numeric(5,3) not null default 1,
  piece_g numeric(7,2),
  piece_name text,
  serving_g numeric(7,2),
  category text not null default 'other',
  allergens text[] not null default '{}',
  tags text[] not null default '{}',
  source text not null,
  source_ref text,
  price_per_kg numeric(8,2),
  cooked_ratio numeric(4,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.food_products (user_id, barcode);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  servings smallint not null check (servings >= 1),
  final_mass_g numeric(8,1),
  instructions text not null default '',
  favorite boolean not null default false,
  tags text[] not null default '{}',
  prep_minutes smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id text not null, -- 'gen_*' (generyczny) lub uuid produktu użytkownika
  grams numeric(8,1) not null check (grams > 0),
  order_index smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jadłospis (plan)
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  days smallint not null check (days between 1 and 366),
  status text not null check (status in ('active', 'archived')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.meal_plans(id) on delete cascade,
  date date not null,
  slot_index smallint not null,
  slot_name text not null,
  day_type text not null check (day_type in ('gym', 'sport', 'rest')),
  template_id text not null,
  title text not null,
  ingredients jsonb not null,
  instructions text[] not null default '{}',
  prep_minutes smallint not null default 0,
  kcal integer not null,
  protein_g numeric(6,1) not null,
  fat_g numeric(6,1) not null,
  carbs_g numeric(6,1) not null,
  fiber_g numeric(6,1) not null default 0,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.meal_plan_entries (user_id, date);

-- Dziennik (faktycznie zjedzone) — wartości zapisane jako migawka
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_index smallint not null,
  product_id text,
  recipe_id uuid references public.recipes(id) on delete set null,
  plan_entry_id uuid references public.meal_plan_entries(id) on delete set null,
  name text not null,
  amount numeric(8,2) not null check (amount > 0),
  unit text not null check (unit in ('g', 'ml', 'szt', 'porcja', 'lyzeczka', 'lyzka')),
  grams numeric(8,1) not null check (grams >= 0),
  kcal numeric(8,1) not null,
  protein_g numeric(7,1) not null,
  fat_g numeric(7,1) not null,
  carbs_g numeric(7,1) not null,
  fiber_g numeric(7,1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.food_log_entries (user_id, date);

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  ml integer not null check (ml between -5000 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.water_entries (user_id, date);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan_id uuid references public.meal_plans(id) on delete set null,
  date_from date not null,
  date_to date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id text,
  name text not null,
  quantity numeric(10,2) not null,
  unit text not null,
  category text not null,
  checked boolean not null default false,
  in_pantry boolean not null default false,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security + wyzwalacze updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_goals', 'user_preferences', 'training_programs', 'workout_sessions',
    'workout_exercises', 'exercise_sets', 'progression_recommendations', 'body_measurements',
    'daily_checkins', 'nutrition_targets', 'food_products', 'recipes', 'recipe_ingredients',
    'meal_plans', 'meal_plan_entries', 'food_log_entries', 'water_entries', 'shopping_lists',
    'shopping_list_items', 'weekly_reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Wiersz potomny musi należeć do tego samego użytkownika co rodzic
-- (zapobiega podpięciu własnych danych pod cudzy program/sesję).
create or replace function public.assert_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent_owner uuid;
begin
  execute format('select user_id from public.%I where id = $1', tg_argv[0]) into parent_owner using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if parent_owner is distinct from new.user_id then
    raise exception 'Niezgodny właściciel rekordu nadrzędnego (%).', tg_argv[0];
  end if;
  return new;
end $$;

create trigger workout_sessions_owner before insert or update on public.workout_sessions for each row execute function public.assert_same_owner('training_programs', 'program_id');
create trigger workout_exercises_owner before insert or update on public.workout_exercises for each row execute function public.assert_same_owner('workout_sessions', 'session_id');
create trigger exercise_sets_owner before insert or update on public.exercise_sets for each row execute function public.assert_same_owner('workout_exercises', 'workout_exercise_id');
create trigger recipe_ingredients_owner before insert or update on public.recipe_ingredients for each row execute function public.assert_same_owner('recipes', 'recipe_id');
create trigger meal_plan_entries_owner before insert or update on public.meal_plan_entries for each row execute function public.assert_same_owner('meal_plans', 'plan_id');
create trigger shopping_list_items_owner before insert or update on public.shopping_list_items for each row execute function public.assert_same_owner('shopping_lists', 'list_id');

-- Katalog ćwiczeń: odczyt dla zalogowanych, zapis wyłącznie przez migracje.
alter table public.exercises enable row level security;
alter table public.exercise_media enable row level security;
create policy "exercises_read" on public.exercises for select to authenticated using (true);
create policy "exercise_media_read" on public.exercise_media for select to authenticated using (true);
grant select on public.exercises, public.exercise_media to authenticated;

-- ---------------------------------------------------------------------
-- Usunięcie konta przez samego użytkownika (RODO). SECURITY DEFINER
-- usuwa wyłącznie konto wywołującego (auth.uid()); dane znikają kaskadowo.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Brak uwierzytelnienia';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
