"use client";

import { useState } from "react";
import { auth } from "@/lib/data/auth";
import { useApp } from "@/lib/data/store";
import { Button, Input, Notice, Segmented } from "@/components/ui";
import { IconLogo } from "@/components/icons";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setSession = useApp((s) => s.setSession);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && !consent) {
      setError("Aby utworzyć konto, zaakceptuj zasady przetwarzania danych.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login" ? await auth.signIn(email, password) : await auth.signUp(email, password, name || email.split("@")[0]);
      await setSession(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.15fr_1fr] md:gap-14 md:px-10">
      <section className="stagger flex flex-col">
        <div className="flex items-center gap-3">
          <IconLogo width={40} height={40} />
          <span className="eyebrow text-olive-strong">// Odprawa · dostęp operatora</span>
        </div>
        <h1 className="font-display mt-6 text-[64px] font-extrabold uppercase leading-[0.82] tracking-wide sm:text-[96px] md:text-[68px] lg:text-[96px] xl:text-[112px]">
          Seal
          <span className="block text-olive-strong">Performance</span>
        </h1>
        <p className="mt-5 max-w-md text-base text-muted sm:text-lg">Siła, kondycja i żywienie w jednym planie — <span className="whitespace-nowrap">4-tygodniowy</span> program Full Body z progresją i dietą dopasowaną do celu.</p>
        <ul className="mt-6 hidden gap-3 sm:grid sm:grid-cols-3">
          {[
            ["01", "Trening A/B/C", "12 sesji z animacją każdego ćwiczenia"],
            ["02", "Progresja", "ciężary z Twoich serii i RIR"],
            ["03", "Paliwo", "kalorie, makro, jadłospis, zakupy"],
          ].map(([n, t, d]) => (
            <li key={n} className="border-l border-line pl-3">
              <div className="font-data text-xs text-olive-strong">{n}</div>
              <div className="font-display mt-1 text-lg font-bold uppercase tracking-wide">{t}</div>
              <div className="text-xs text-muted">{d}</div>
            </li>
          ))}
        </ul>
      </section>

      <div className="fade-in w-full">
        <div className="hud hud-accent rounded-2xl p-5 sm:p-6">
          <Segmented
            ariaLabel="Tryb"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: "login", label: "Logowanie" },
              { value: "register", label: "Rejestracja" },
            ]}
          />
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            {mode === "register" && <Input label="Imię lub pseudonim" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />}
            <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input
              label="Hasło"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              hint={mode === "register" ? "Min. 8 znaków, litery i cyfry." : undefined}
            />
            {mode === "register" && (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--olive)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span className="text-muted">
                  Wyrażam zgodę na przetwarzanie podanych przeze mnie danych o zdrowiu i aktywności (masa ciała, urazy, przeciwwskazania) wyłącznie w celu personalizacji planu. Mogę w każdej chwili wyeksportować lub usunąć swoje dane w zakładce Profil.{" "}
                  <a href="/o-aplikacji" className="text-olive-strong underline">
                    Zasady prywatności
                  </a>
                </span>
              </label>
            )}
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {busy ? "Proszę czekać…" : mode === "login" ? "Zaloguj się" : "Utwórz konto"}
            </Button>
          </form>
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-olive" aria-hidden />
          {auth.mode === "local"
            ? "Tryb lokalny: konto i dane są zapisywane wyłącznie na tym urządzeniu (IndexedDB), hasło jako skrót PBKDF2. Synchronizację między urządzeniami włączysz konfigurując Supabase (README)."
            : "Dane są przechowywane w bazie Supabase z kontrolą dostępu (Row Level Security) — tylko Ty masz do nich dostęp."}
        </p>
        <p className="mt-2 text-[11px] text-muted/80">Aplikacja inspirowana przygotowaniem fizycznym jednostek specjalnych. Nie jest oficjalnym programem Navy SEALs ani produktem U.S. Navy.</p>
      </div>
    </div>
  );
}
