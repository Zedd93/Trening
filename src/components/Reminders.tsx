"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/data/store";
import { getPrefs, getActiveProgram, programSessions } from "@/lib/selectors";
import { today, weekdayIndex } from "@/lib/utils/dates";

/**
 * Przypomnienia lokalne (wymagają zgody użytkownika na powiadomienia).
 * Działają, gdy aplikacja jest otwarta lub zainstalowana i aktywna w tle
 * przeglądarki. Powiadomienia push przy zamkniętej aplikacji wymagają
 * serwera Web Push — patrz README.
 */
export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export async function showNotification(title: string, body: string, url = "/") {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url }, tag: title });
      return true;
    }
    new Notification(title, { body, icon: "/icons/icon-192.png" });
    return true;
  } catch {
    return false;
  }
}

const firedKey = (id: string) => `seal-reminder-${today()}-${id}`;
function fireOnce(id: string, title: string, body: string, url: string) {
  try {
    if (localStorage.getItem(firedKey(id))) return;
    localStorage.setItem(firedKey(id), "1");
  } catch {
    /* brak localStorage */
  }
  void showNotification(title, body, url);
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function useReminders(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const data = useApp.getState().data;
      const prefs = getPrefs(data);
      const n = prefs?.notifications;
      if (!n?.enabled || !notificationsSupported() || Notification.permission !== "granted") return;
      const now = hhmm();
      const d = today();
      if (n.training && now >= n.training_time) {
        const prog = getActiveProgram(data);
        const s = programSessions(data, prog?.id).find((x) => x.scheduled_date === d && x.status === "planned");
        if (s) fireOnce("training", "Dzisiaj trening", `${s.title} — ${s.focus}`, `/trening/sesja/${s.id}`);
      }
      if (n.weigh_in && now >= n.weigh_in_time) {
        const has = Object.values(data.body_measurements).some((m) => m.date === d && m.weight_kg !== null);
        if (!has) fireOnce("weigh", "Pomiar masy ciała", "Zważ się rano, po toalecie, przed jedzeniem.", "/postepy");
      }
      if (n.weekly_report && weekdayIndex(d) === 6 && now >= "18:00") fireOnce("report", "Raport tygodniowy", "Podsumowanie tygodnia jest gotowe.", "/postepy?tab=raport");
      if (n.meals)
        n.meal_times.forEach((t, i) => {
          if (now >= t && now < addMinutes(t, 30)) fireOnce(`meal-${i}`, "Zaplanowany posiłek", `Pora na posiłek: ${prefs?.meal_names[i] ?? `posiłek ${i + 1}`}.`, "/dieta");
        });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [active]);
}

function addMinutes(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number);
  const total = h * 60 + mm + m;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
