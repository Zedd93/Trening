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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <IconLogo width={40} height={40} />
          <div>
            <h1 className="text-xl font-bold tracking-wide">SEAL PERFORMANCE</h1>
            <p className="text-sm text-muted">Siła · kondycja · żywienie</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
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
        <p className="mt-4 text-xs leading-relaxed text-muted">
          {auth.mode === "local"
            ? "Tryb lokalny: konto i dane są zapisywane wyłącznie na tym urządzeniu (IndexedDB), hasło przechowywane jako skrót PBKDF2. Synchronizację między urządzeniami włączysz konfigurując Supabase (README)."
            : "Dane są przechowywane w bazie Supabase z kontrolą dostępu (Row Level Security) — tylko Ty masz do nich dostęp."}
        </p>
        <p className="mt-2 text-xs text-muted">Aplikacja inspirowana przygotowaniem fizycznym jednostek specjalnych. Nie jest oficjalnym programem Navy SEALs ani produktem U.S. Navy.</p>
      </div>
    </div>
  );
}
