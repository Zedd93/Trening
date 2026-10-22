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
        <div className="flex flex-col items-center gap-3 text-muted">
          <IconLogo width={44} height={44} />
          <span>Wczytywanie danych…</span>
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <IconLogo />
          <span className="text-[15px] font-bold tracking-wide">SEAL PERFORMANCE</span>
        </Link>
        <nav aria-label="Menu główne" className="flex flex-col gap-1">
          {[...NAV, { href: "/asystent", label: "Asystent", icon: IconChat }].map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors", active ? "bg-olive-dim text-olive-strong font-semibold" : "text-muted hover:bg-surface-2 hover:text-fg")}
              >
                <n.icon />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-snug text-muted">
          Aplikacja inspirowana przygotowaniem fizycznym jednostek specjalnych. Nie jest oficjalnym programem Navy SEALs ani U.S. Navy.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>

      {/* Dolna nawigacja (telefon) */}
      <nav aria-label="Menu główne" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-olive-strong" : "text-muted")}>
                  <n.icon width={22} height={22} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error && (
        <div role="alert" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-bad/40 bg-surface p-3 text-sm shadow-lg md:bottom-6">
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
