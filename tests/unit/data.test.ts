import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// localStorage dla trybu lokalnego (sesja)
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

const { LocalAdapter, __resetLocalDB } = await import("@/lib/data/local-adapter");
const { auth } = await import("@/lib/data/auth");
const store = await import("@/lib/data/store");
const { adaptiveTdee, weeklyReport, weightTrend, slopePerDay } = await import("@/lib/analytics/analytics");

describe("izolacja danych (IndexedDB)", () => {
  beforeEach(() => __resetLocalDB());

  it("użytkownik odczytuje wyłącznie własne rekordy", async () => {
    const a = new LocalAdapter();
    await a.upsert("user-A", "body_measurements", [{ id: "1", user_id: "user-A", date: "2026-10-01", weight_kg: 80 } as never]);
    await a.upsert("user-B", "body_measurements", [{ id: "2", user_id: "user-B", date: "2026-10-01", weight_kg: 60 } as never]);
    const snapA = await a.loadAll("user-A");
    const snapB = await a.loadAll("user-B");
    expect(Object.keys(snapA.body_measurements)).toEqual(["1"]);
    expect(Object.keys(snapB.body_measurements)).toEqual(["2"]);
  });

  it("odmawia zapisu rekordu innego użytkownika", async () => {
    const a = new LocalAdapter();
    await expect(a.upsert("user-A", "food_products", [{ id: "x", user_id: "user-B" } as never])).rejects.toThrow(/innego użytkownika/);
  });

  it("usunięcie danych usuwa tylko dane danego użytkownika", async () => {
    const a = new LocalAdapter();
    await a.upsert("user-A", "recipes", [{ id: "r1", user_id: "user-A" } as never]);
    await a.upsert("user-B", "recipes", [{ id: "r2", user_id: "user-B" } as never]);
    await a.removeAllUserData("user-A");
    expect(Object.keys((await a.loadAll("user-A")).recipes)).toEqual([]);
    expect(Object.keys((await a.loadAll("user-B")).recipes)).toEqual(["r2"]);
  });
});

describe("konta lokalne", () => {
  it("rejestracja, logowanie, odrzucenie złego hasła", async () => {
    const u = await auth.signUp("Jan@Example.com", "Haslo1234", "Jan");
    expect(u.email).toBe("jan@example.com");
    await expect(auth.signUp("jan@example.com", "Haslo1234", "Jan")).rejects.toThrow(/już istnieje/);
    await expect(auth.signIn("jan@example.com", "zle-haslo1")).rejects.toThrow(/Nieprawidłowy/);
    const again = await auth.signIn("jan@example.com", "Haslo1234");
    expect(again.id).toBe(u.id);
  });
  it("walidacja hasła", async () => {
    await expect(auth.signUp("a@b.pl", "krotkie", "x")).rejects.toThrow(/8 znaków/);
  });
});

describe("store: zapis i odtworzenie po ponownym uruchomieniu", () => {
  it("dane przetrwają ponowne wczytanie (odzyskanie sesji treningowej)", async () => {
    const user = await auth.signUp("sesja@example.com", "Haslo1234", "S");
    await store.useApp.getState().setSession(user);
    store.createRecord("exercise_sets", {
      workout_exercise_id: "we1",
      session_id: "s1",
      exercise_id: "bench_press",
      set_number: 1,
      weight_kg: 60,
      reps: 8,
      rir: 2,
      duration_sec: null,
      completed: false,
      completed_at: null,
    });
    await store.flushWrites();
    // „zamknięcie aplikacji”: czysty stan i ponowne wczytanie z IndexedDB
    store.useApp.setState({ status: "init", data: (await import("@/lib/domain/types")).emptySnapshot() });
    await store.useApp.getState().setSession(user);
    const sets = Object.values(store.useApp.getState().data.exercise_sets);
    expect(sets).toHaveLength(1);
    expect(sets[0].weight_kg).toBe(60);
    expect(sets[0].user_id).toBe(user.id);
  });
});

describe("analityka", () => {
  const m = (date: string, w: number) => ({ id: date, user_id: "u", created_at: "", updated_at: "", date, weight_kg: w, waist_cm: null, note: "" });
  const log = (date: string, kcal: number) => [0, 1].map((i) => ({ id: date + i, user_id: "u", created_at: "", updated_at: "", date, meal_index: i, product_id: null, recipe_id: null, plan_entry_id: null, name: "x", amount: 1, unit: "g" as const, grams: 1, kcal: kcal / 2, protein_g: 80, fat_g: 0, carbs_g: 0, fiber_g: 0 }));
  const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(8 + i).padStart(2, "0")}`);

  it("trend i nachylenie masy", () => {
    const pts = days.map((d, i) => m(d, 90 - i * 0.1));
    expect(slopePerDay(pts.map((p) => ({ date: p.date, weight: p.weight_kg })))!).toBeCloseTo(-0.1, 5);
    expect(weightTrend(pts).at(-1)!.trend).toBeGreaterThan(88.7);
  });

  it("brak korekty przy zbyt małej liczbie danych", () => {
    const r = adaptiveTdee({ measurements: [m("2026-10-20", 90)], log: [], target: undefined, goal: "fat_loss", weight_kg: 90, today: "2026-10-22" });
    expect(r.status).toBe("insufficient");
    expect(r.proposal).toBeNull();
  });

  it("zastój na redukcji przy dobrej zgodności → propozycja niewielkiej korekty do zatwierdzenia", () => {
    const target = { id: "t", user_id: "u", created_at: "", updated_at: "", valid_from: "2026-09-01", active: true, kcal: 2400, protein_g: 160, fat_g: 70, carbs_g: 280, fiber_g: 30, bmr: 1900, tdee: 2900, maintenance_kcal: 2900, macro_mode: "standard" as const, calorie_mode: "constant" as const, day_targets: {} as never, source: "calculator" as const, reason: "" };
    const r = adaptiveTdee({ measurements: days.map((d) => m(d, 90)), log: days.flatMap((d) => log(d, 2400)), target, goal: "fat_loss", weight_kg: 90, today: "2026-10-22" });
    expect(r.status).toBe("ok");
    expect(r.estimated_tdee).toBe(2400);
    expect(r.proposal!.delta).toBeLessThan(0);
    expect(r.proposal!.delta).toBeGreaterThanOrEqual(-200);
  });

  it("raport tygodniowy ocenia jakość danych", () => {
    const r = weeklyReport({ week_start: "2026-10-12", measurements: [m("2026-10-13", 90)], log: [], targets: [], sessions: [], sets: [], checkins: [], goal: "fat_loss", weight_kg: 90 });
    expect(r.quality.label).toBe("niska");
    expect(r.recommendations[0]).toMatch(/Jakość danych jest niska/);
  });
});
