"use client";

import { create } from "zustand";
import {
  emptySnapshot,
  type BaseRecord,
  type CollectionMap,
  type CollectionName,
  type NewRecord,
  type Snapshot,
} from "@/lib/domain/types";
import type { DataAdapter } from "./adapter";
import { LocalAdapter } from "./local-adapter";
import { SupabaseAdapter } from "./supabase-adapter";
import { SyncingAdapter } from "./syncing-adapter";
import { auth, getSupabase, type SessionUser } from "./auth";
import { uid } from "@/lib/utils/format";

type Status = "init" | "anon" | "loading" | "ready" | "error";

interface AppState {
  status: Status;
  user: SessionUser | null;
  data: Snapshot;
  error: string | null;
  init(): Promise<void>;
  setSession(user: SessionUser): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  clearError(): void;
}

let adapter: DataAdapter | null = null;
function getAdapter(): DataAdapter {
  if (!adapter) {
    const sb = getSupabase();
    adapter = sb ? new SyncingAdapter(new SupabaseAdapter(sb)) : new LocalAdapter();
  }
  return adapter;
}

/** Pozwala testom wstrzyknąć własny adapter. */
export function __setAdapter(a: DataAdapter | null) {
  adapter = a;
}

export const useApp = create<AppState>((set, get) => ({
  status: "init",
  user: null,
  data: emptySnapshot(),
  error: null,

  async init() {
    if (get().status !== "init") return;
    try {
      const user = await auth.getSession();
      if (!user) {
        set({ status: "anon" });
        return;
      }
      await get().setSession(user);
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  async setSession(user) {
    set({ status: "loading", user });
    try {
      const data = await getAdapter().loadAll(user.id);
      set({ data, status: "ready", error: null });
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  },

  async logout() {
    await flushWrites();
    await auth.signOut();
    set({ status: "anon", user: null, data: emptySnapshot() });
  },

  async deleteAccount() {
    const user = get().user;
    if (!user) return;
    await flushWrites();
    await getAdapter().removeAllUserData(user.id);
    await auth.deleteAccount(user.id);
    await auth.signOut();
    set({ status: "anon", user: null, data: emptySnapshot() });
  },

  clearError() {
    set({ error: null });
  },
}));

/* ------------------------------------------------------------------ */
/* Operacje na kolekcjach                                              */
/* ------------------------------------------------------------------ */

function requireUser(): SessionUser {
  const u = useApp.getState().user;
  if (!u) throw new Error("Brak zalogowanego użytkownika.");
  return u;
}

// Zapisy wykonywane są sekwencyjnie — zachowuje to kolejność operacji
// (np. usunięcie, a potem wstawienie rekordu z tym samym kluczem unikalnym).
let writeChain: Promise<void> = Promise.resolve();

function persist(fn: () => Promise<void>) {
  writeChain = writeChain.then(fn).catch((e: Error) => useApp.setState({ error: `Nie udało się zapisać danych: ${e.message}` }));
}

/** Oczekuje na zakończenie wszystkich zaplanowanych zapisów (testy, wylogowanie). */
export function flushWrites(): Promise<void> {
  return writeChain;
}

/** Zapisuje kompletne rekordy (insert lub update). */
export function putRecords<K extends CollectionName>(collection: K, records: CollectionMap[K][]): CollectionMap[K][] {
  const user = requireUser();
  if (!records.length) return records;
  const now = new Date().toISOString();
  const stamped = records.map((r) => ({ ...r, user_id: user.id, updated_at: now }));
  useApp.setState((s) => {
    const col = { ...(s.data[collection] as Record<string, CollectionMap[K]>) };
    for (const r of stamped) col[r.id] = r;
    return { data: { ...s.data, [collection]: col } };
  });
  persist(() => getAdapter().upsert(user.id, collection, stamped));
  return stamped;
}

export function createRecord<K extends CollectionName>(collection: K, rec: NewRecord<CollectionMap[K]>): CollectionMap[K] {
  return createRecords(collection, [rec])[0];
}

export function createRecords<K extends CollectionName>(collection: K, recs: NewRecord<CollectionMap[K]>[]): CollectionMap[K][] {
  const user = requireUser();
  const now = new Date().toISOString();
  const full = recs.map(
    (r) => ({ ...r, id: r.id ?? uid(), user_id: user.id, created_at: now, updated_at: now }) as unknown as CollectionMap[K],
  );
  return putRecords(collection, full);
}

export function updateRecord<K extends CollectionName>(
  collection: K,
  id: string,
  patch: Partial<Omit<CollectionMap[K], keyof BaseRecord>>,
): CollectionMap[K] | null {
  const current = useApp.getState().data[collection][id] as CollectionMap[K] | undefined;
  if (!current) return null;
  return putRecords(collection, [{ ...current, ...patch }])[0];
}

export function removeRecords<K extends CollectionName>(collection: K, ids: string[]) {
  const user = requireUser();
  if (!ids.length) return;
  useApp.setState((s) => {
    const col = { ...(s.data[collection] as Record<string, unknown>) };
    for (const id of ids) delete col[id];
    return { data: { ...s.data, [collection]: col } as Snapshot };
  });
  persist(() => getAdapter().remove(user.id, collection, ids));
}

/** Synchroniczny podgląd danych (poza Reactem). */
export function snapshot(): Snapshot {
  return useApp.getState().data;
}

export function list<K extends CollectionName>(data: Snapshot, collection: K): CollectionMap[K][] {
  return Object.values(data[collection]) as CollectionMap[K][];
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const a = adapter;
    const u = useApp.getState().user;
    if (a instanceof SyncingAdapter && u) void a.flush(u.id);
  });
}
