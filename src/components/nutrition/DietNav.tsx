"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

const TABS = [
  { href: "/dieta", label: "Dziennik" },
  { href: "/dieta/cele", label: "Cele i kalkulator" },
  { href: "/dieta/jadlospis", label: "Jadłospis" },
  { href: "/dieta/zakupy", label: "Lista zakupów" },
  { href: "/dieta/meal-prep", label: "Gotowanie na zapas" },
  { href: "/dieta/przepisy", label: "Przepisy" },
  { href: "/dieta/produkty", label: "Produkty" },
];

export function DietNav() {
  const path = usePathname();
  return (
    <nav aria-label="Moduł żywienia" className="scrollbar-none -mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const active = t.href === "/dieta" ? path === "/dieta" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cx(
                  "relative inline-flex h-11 items-center px-3 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                  "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
                  active ? "text-olive-strong after:bg-olive-strong" : "text-muted after:bg-transparent hover:text-fg",
                )}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
