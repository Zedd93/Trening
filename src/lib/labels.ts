import type { GoalType, ProgressionAction } from "@/lib/domain/types";

export const GOAL_LABELS: Record<GoalType, string> = {
  fat_loss: "Redukcja tkanki tłuszczowej",
  muscle_gain: "Rozbudowa mięśni",
  recomposition: "Rekompozycja sylwetki",
  strength: "Poprawa siły",
  conditioning: "Poprawa kondycji",
  maintenance: "Utrzymanie rezultatów",
};

export const ACTION_LABELS: Record<ProgressionAction, string> = {
  increase_load: "Zwiększ ciężar",
  increase_reps: "Dołóż powtórzenia",
  hold: "Utrzymaj",
  decrease_load: "Zmniejsz ciężar",
  deload: "Odciążenie",
  calibrate: "Kalibracja ciężaru",
};

export const BLOCK_LABELS: Record<string, string> = {
  warmup: "Rozgrzewka",
  strength: "Blok siłowy",
  hypertrophy: "Hipertrofia",
  core: "Tułów (core)",
  functional: "Funkcjonalny",
  conditioning: "Kondycja",
  cooldown: "Schłodzenie",
};
