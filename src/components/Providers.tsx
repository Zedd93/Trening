"use client";

import { useEffect, type ReactNode } from "react";
import { AppShell } from "./AppShell";

export function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("seal-theme", theme);
  } catch {
    /* ignoruj */
  }
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* PWA niedostępne — aplikacja działa dalej */
      });
    }
  }, []);
  return <AppShell>{children}</AppShell>;
}
