"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/data/store";
import { getProfile } from "@/lib/selectors";
import { cx } from "./ui";
import { IconChart, IconChat, IconDumbbell, IconFood, IconHome, IconLogo, IconUser } from "./icons";
import { useReminders } from "./Reminders";

const NAV = [
  { href: "/", label: "Pulpit", icon: IconHome },
  { href: "/trening", label: "Trening", icon: IconDumbbell },
  { href: "/dieta", label: "Dieta", icon: IconFood },
  { href: "/postepy", label: "Postępy", icon: IconChart },
  { href: "/profil", label: "Profil", icon: IconUser },
];

const PUBLIC = ["/logowanie", "/o-aplikacji"];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const status = useApp((s) => s.status);
  const init = useApp((s) => s.init);
  const data = useApp((s) => s.data);
  const error = useApp((s) => s.error);
  const clearError = useApp((s) => s.clearError);
  const user = useApp((s) => s.user);
  const profile = getProfile(data);
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const onboarding = path.startsWith("/konfigurator");
  useReminders(status === "ready" && !!profile);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (status === "anon" && !isPublic) router.replace("/logowanie");
    if (status === "ready" && path.startsWith("/logowanie")) router.replace(profile?.onboarding_completed ? "/" : "/konfigurator");
    if (status === "ready" && !profile?.onboarding_completed && !onboarding && !isPublic) router.replace("/konfigurator");
  }, [status, isPublic, onboarding, profile, path, router]);

  if (isPublic) return <>{children}</>;

  if (status === "init" || status === "loading" || (status === "anon" && !isPublic)) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex flex-col items-center gap-4 text-muted">
          <IconLogo width={44} height={44} className="animate-pulse" />
          <div className="h-0.5 w-32 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-1/3 animate-[scan_1.1s_ease-in-out_infinite] rounded-full bg-olive" />
          </div>
          <span className="eyebrow">Wczytywanie danych…</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-bad/40 bg-bad/10 p-5" role="alert">
          <p className="font-semibold">Nie udało się wczytać danych</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button className="mt-4 rounded-xl bg-surface-3 px-4 py-2" onClick={() => location.reload()}>
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (onboarding) return <>{children}</>;

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">
        Przejdź do treści
      </a>
      {/* Boczne menu (komputer) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg/80 px-4 py-6 backdrop-blur md:flex">
        <Link href="/" className="mb-10 flex items-center gap-3 px-1">
          <IconLogo width={34} height={34} />
          <span className="font-display text-[22px] font-extrabold uppercase leading-[0.85] tracking-wide">
            Seal
            <br />
            <span className="text-olive-strong">Performance</span>
          </span>
        </Link>
        <div className="eyebrow mb-2 px-3">Nawigacja</div>
        <nav aria-label="Menu główne" className="flex flex-col gap-0.5">
          {[...NAV, { href: "/asystent", label: "Asystent", icon: IconChat }].map((n, i) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                  active ? "bg-olive-dim/70 font-semibold text-olive-strong" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {active && <span aria-hidden className="absolute -left-4 top-2 bottom-2 w-1 rounded-r bg-olive" />}
                <n.icon width={20} height={20} />
                <span className="flex-1">{n.label}</span>
                <span className="font-mono text-[10px] text-muted/60">0{i + 1}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hud mt-auto rounded-xl p-3">
          <div className="eyebrow">Operator</div>
          <div className="mt-1 truncate text-sm font-semibold">{profile?.display_name || user?.email}</div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span className={cx("h-1.5 w-1.5 rounded-full", user?.mode === "supabase" ? "bg-ok" : "bg-olive")} />
            {user?.mode === "supabase" ? "Synchronizacja w chmurze" : "Dane na urządzeniu"}
          </div>
        </div>
        <p className="mt-3 px-1 text-[10px] leading-snug text-muted/70">Inspirowane przygotowaniem jednostek specjalnych. Nie jest oficjalnym programem Navy SEALs ani U.S. Navy.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Górny pasek (telefon) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-bg/80 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <IconLogo width={26} height={26} />
            <span className="font-display text-lg font-extrabold uppercase tracking-wide">
              Seal <span className="text-olive-strong">Perf</span>
            </span>
          </Link>
          <Link href="/asystent" aria-label="Asystent" className={cx("grid h-10 w-10 place-items-center rounded-lg border", isActive(path, "/asystent") ? "border-olive text-olive-strong" : "border-line text-muted")}>
            <IconChat width={20} height={20} />
          </Link>
        </header>
        <main id="main" className="stagger mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 sm:px-6 md:px-10 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      {/* Dolna nawigacja (telefon) */}
      <nav aria-label="Menu główne" className="safe-bottom fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-line-strong bg-surface/90 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("relative flex h-16 flex-col items-center justify-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide", active ? "text-olive-strong" : "text-muted")}
                >
                  {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b bg-olive shadow-[0_0_12px_var(--olive)]" />}
                  <n.icon width={22} height={22} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error && (
        <div role="alert" className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-bad/40 bg-surface p-3 text-sm shadow-lg md:bottom-6">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={clearError} className="text-muted" aria-label="Zamknij komunikat">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
