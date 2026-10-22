"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useData, usePrefs, useToday } from "@/lib/hooks";
import { Badge, Button, Input, Notice, PageHeader, Segmented, cx } from "@/components/ui";
import { answer, contextSummary, detectIntent, INTENTS, type Answer } from "@/lib/assistant/dataAssistant";
import { getSupabase } from "@/lib/data/auth";

interface Msg {
  role: "user" | "assistant";
  text?: string;
  answer?: Answer;
  source?: "dane" | "ai";
}

export default function AssistantPage() {
  const data = useData();
  const prefs = usePrefs();
  const todayDate = useToday();
  const [mode, setMode] = useState<"data" | "ai">("data");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [ai, setAi] = useState<{ enabled: boolean; model: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/assistant")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ enabled: false, model: null }));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs]);

  function askData(text: string) {
    const intent = detectIntent(text);
    setMsgs((m) => [
      ...m,
      { role: "user", text },
      intent
        ? { role: "assistant", answer: answer(intent, data, todayDate), source: "dane" }
        : { role: "assistant", text: "Nie rozpoznałem pytania. Wybierz jedno z pytań poniżej" + (ai?.enabled ? " albo przełącz na tryb AI." : "."), source: "dane" },
    ]);
  }

  async function askAI(text: string) {
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const sb = getSupabase();
      if (sb) {
        const { data: s } = await sb.auth.getSession();
        if (s.session) headers.Authorization = `Bearer ${s.session.access_token}`;
      }
      const res = await fetch("/api/assistant", { method: "POST", headers, body: JSON.stringify({ question: text, context: contextSummary(data, todayDate) }) });
      const json = await res.json();
      setMsgs((m) => [...m, { role: "assistant", text: json.answer ?? json.error ?? "Błąd odpowiedzi.", source: "ai" }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Nie udało się połączyć z modułem AI.", source: "ai" }]);
    } finally {
      setBusy(false);
    }
  }

  const aiReady = ai?.enabled && prefs?.ai_assistant_consent;

  return (
    <>
      <PageHeader
        title="Asystent"
        subtitle="Praktyczne wskazówki na podstawie Twoich zapisanych danych"
        action={
          <Segmented
            ariaLabel="Tryb asystenta"
            value={mode}
            onChange={setMode}
            options={[
              { value: "data", label: "Asystent danych" },
              { value: "ai", label: "AI" },
            ]}
          />
        }
      />
      {mode === "data" ? (
        <Notice>Tryb danych: odpowiedzi są wyliczane regułami bezpośrednio z Twoich zapisów (treningi, dziennik, pomiary). To nie jest model językowy — działa offline i nic nie wysyła.</Notice>
      ) : !ai?.enabled ? (
        <Notice tone="warn" title="Moduł AI nie jest skonfigurowany">
          Aby go włączyć, administrator wdrożenia ustawia po stronie serwera zmienną <code>ANTHROPIC_API_KEY</code> (oraz Supabase lub <code>ASSISTANT_ALLOW_LOCAL=true</code>) — instrukcja w README. Do tego czasu korzystaj z asystenta danych.
        </Notice>
      ) : !prefs?.ai_assistant_consent ? (
        <Notice tone="warn" title="Wymagana zgoda">
          Tryb AI wysyła pytanie i zwięzłe podsumowanie Twoich danych (bez e-maila i imienia) do modelu {ai.model} (Anthropic). Włącz zgodę w{" "}
          <Link href="/profil" className="text-olive-strong underline">
            Profilu
          </Link>
          .
        </Notice>
      ) : (
        <Notice>
          Tryb AI ({ai.model}): odpowiedź generuje model językowy na podstawie podsumowania Twoich danych. Traktuj ją jako wskazówkę — nie jest poradą medyczną.
        </Notice>
      )}

      <div className="mt-4 flex min-h-[40vh] flex-col gap-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={cx("max-w-[92%] rounded-2xl p-3 text-sm", m.role === "user" ? "self-end bg-olive-dim text-fg" : "self-start border border-line bg-surface")}>
            {m.source && m.role === "assistant" && (
              <div className="mb-1">
                <Badge tone={m.source === "ai" ? "olive" : "neutral"}>{m.source === "ai" ? "odpowiedź AI" : "analiza danych"}</Badge>
              </div>
            )}
            {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
            {m.answer && (
              <>
                <p className="font-semibold">{m.answer.title}</p>
                <div className="mt-1 space-y-0.5 whitespace-pre-wrap text-fg/90">
                  {m.answer.lines.map((l, k) => (
                    <p key={k}>{l}</p>
                  ))}
                </div>
                {m.answer.links && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.answer.links.map((l) => (
                      <Link key={l.href} href={l.href} className="text-olive-strong underline">
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Analizuję…</p>}
        <div ref={end} />
      </div>

      <div className="sticky bottom-20 mt-4 rounded-2xl border border-line bg-bg/95 p-3 backdrop-blur md:bottom-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {INTENTS.map((i) => (
            <button key={i.id} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs hover:border-olive" onClick={() => (mode === "ai" && aiReady ? askAI(i.label) : askData(i.label))}>
              {i.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = q.trim();
            if (!text) return;
            setQ("");
            if (mode === "ai" && aiReady) void askAI(text);
            else askData(text);
          }}
        >
          <Input aria-label="Pytanie do asystenta" placeholder="Zadaj pytanie…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} />
          <Button type="submit" variant="primary" disabled={busy}>
            Wyślij
          </Button>
        </form>
      </div>
    </>
  );
}
