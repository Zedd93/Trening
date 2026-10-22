"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/data/store";
import { getActiveProgram, getGoals, getPrefs, getProfile, productIndex, programSessions } from "@/lib/selectors";
import { today } from "@/lib/utils/dates";

export const useData = () => useApp((s) => s.data);

export function useProfile() {
  const data = useData();
  return getProfile(data);
}

export function usePrefs() {
  const data = useData();
  return getPrefs(data);
}

export function useGoals() {
  const goals = useApp((s) => s.data.user_goals);
  return useMemo(() => getGoals({ user_goals: goals } as never), [goals]);
}

export function useActiveProgram() {
  const data = useData();
  return useMemo(() => {
    const program = getActiveProgram(data);
    return { program, sessions: programSessions(data, program?.id) };
  }, [data]);
}

export function useProducts() {
  const products = useApp((s) => s.data.food_products);
  const recipes = useApp((s) => s.data.recipes);
  const ings = useApp((s) => s.data.recipe_ingredients);
  return useMemo(() => productIndex({ food_products: products, recipes, recipe_ingredients: ings } as never), [products, recipes, ings]);
}

/** Aktualna data — odświeżana co minutę (zmiana dnia przy otwartej aplikacji). */
export function useToday() {
  const [d, setD] = useState(today());
  useEffect(() => {
    const id = setInterval(() => setD(today()), 60_000);
    return () => clearInterval(id);
  }, []);
  return d;
}

export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return reduced;
}
