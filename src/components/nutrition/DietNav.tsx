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
    <nav aria-label="Moduł żywienia" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1.5">
        {TABS.map((t) => {
          const active = t.href === "/dieta" ? path === "/dieta" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cx("inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors", active ? "bg-olive text-[#10130b] font-semibold" : "bg-surface-2 text-muted hover:text-fg")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
