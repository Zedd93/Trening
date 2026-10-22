"use client";

import { useEffect, useRef, useState } from "react";
import { useNow } from "@/lib/hooks";
import { startRest, stopRest } from "@/lib/actions/training";
import { formatDuration } from "@/lib/utils/dates";
import { IconTimer } from "../icons";

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  } catch {
    /* brak audio */
  }
}

/** Timer odpoczynku oparty na czasie zakończenia zapisanym w sesji — przetrwa zamknięcie aplikacji. */
export function RestTimer({ sessionId, endsAt }: { sessionId: string; endsAt: string | null }) {
  const now = useNow(250, !!endsAt);
  const notified = useRef<string | null>(null);
  const remaining = endsAt ? Math.ceil((new Date(endsAt).getTime() - now) / 1000) : 0;

  useEffect(() => {
    if (endsAt && remaining <= 0 && notified.current !== endsAt) {
      notified.current = endsAt;
      beep();
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
    }
  }, [remaining, endsAt]);

  if (!endsAt) return null;
  const done = remaining <= 0;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md md:bottom-6" role="timer" aria-live="polite">
      <div className={`flex items-center gap-3 rounded-2xl border p-3 shadow-xl ${done ? "border-ok bg-ok/15" : "border-olive/50 bg-surface"}`}>
        <IconTimer className={done ? "text-ok" : "text-olive-strong"} />
        <div className="flex-1">
          <div className="text-xs text-muted">{done ? "Przerwa zakończona — kolejna seria" : "Odpoczynek"}</div>
          <div className="text-2xl font-bold tabular-nums">{done ? "00:00" : formatDuration(remaining)}</div>
        </div>
        {!done && (
          <>
            <button className="h-10 rounded-lg bg-surface-3 px-3 text-sm" onClick={() => startRest(sessionId, Math.max(0, remaining - 15))} aria-label="Skróć o 15 sekund">
              −15
            </button>
            <button className="h-10 rounded-lg bg-surface-3 px-3 text-sm" onClick={() => startRest(sessionId, remaining + 15)} aria-label="Wydłuż o 15 sekund">
              +15
            </button>
          </>
        )}
        <button className="h-10 rounded-lg bg-surface-3 px-3 text-sm" onClick={() => stopRest(sessionId)}>
          {done ? "OK" : "Pomiń"}
        </button>
      </div>
    </div>
  );
}

/** Timer interwałów dla bloku kondycyjnego. */
export function IntervalTimer({ rounds, work, rest }: { rounds: number; work: number; rest: number }) {
  const [start, setStart] = useState<number | null>(null);
  const now = useNow(250, start !== null);
  const total = rounds * (work + rest);
  const elapsed = start ? Math.max(0, (now - start) / 1000) : 0;
  const running = start !== null && elapsed < total;
  const cycle = work + rest;
  const round = Math.min(rounds, Math.floor(elapsed / cycle) + 1);
  const inCycle = elapsed % cycle;
  const isWork = inCycle < work;
  const left = Math.ceil(isWork ? work - inCycle : cycle - inCycle);
  const lastPhase = useRef<string>("");
  const phaseKey = running ? `${round}-${isWork}` : "";
  useEffect(() => {
    if (running && phaseKey !== lastPhase.current) {
      if (lastPhase.current) beep();
      lastPhase.current = phaseKey;
    }
  }, [phaseKey, running]);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 p-3">
      {running ? (
        <>
          <div className={`rounded-lg px-2 py-1 text-xs font-semibold ${isWork ? "bg-warn/20 text-warn" : "bg-ok/15 text-ok"}`}>{isWork ? "PRACA" : "LUZ"}</div>
          <div className="text-2xl font-bold tabular-nums">{formatDuration(left)}</div>
          <div className="text-sm text-muted">
            runda {round}/{rounds}
          </div>
          <button className="ml-auto h-9 rounded-lg bg-surface-3 px-3 text-sm" onClick={() => setStart(null)}>
            Stop
          </button>
        </>
      ) : (
        <button className="h-10 rounded-lg bg-olive px-4 text-sm font-semibold text-[#10130b]" onClick={() => setStart(Date.now())}>
          {start !== null && elapsed >= total ? "Zakończono — uruchom ponownie" : `Uruchom timer interwałów (${rounds} × ${work}/${rest} s)`}
        </button>
      )}
    </div>
  );
}
