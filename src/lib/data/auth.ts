import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDB, type LocalAccount } from "./local-adapter";
import { uid } from "@/lib/utils/format";

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  mode: "local" | "supabase";
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return supabase;
}

/* ------------------------------------------------------------------ */
/* Tryb lokalny: konta na urządzeniu, hasło jako PBKDF2-SHA256         */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "seal-session-v1";
const PBKDF2_ITERATIONS = 210_000;

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export async function hashPassword(password: string, saltHex: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  if (!/[0-9]/.test(password) || !/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(password)) return "Hasło musi zawierać litery i cyfry.";
  return null;
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "Podaj poprawny adres e-mail.";
}

async function localSignUp(email: string, password: string, displayName: string): Promise<SessionUser> {
  const db = await getDB();
  const normalized = email.trim().toLowerCase();
  const existing = await db.getFromIndex("accounts", "by_email", normalized);
  if (existing) throw new Error("Konto z tym adresem już istnieje na tym urządzeniu.");
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const account: LocalAccount = {
    id: uid(),
    email: normalized,
    display_name: displayName.trim(),
    salt,
    hash: await hashPassword(password, salt),
    iterations: PBKDF2_ITERATIONS,
    created_at: new Date().toISOString(),
  };
  await db.add("accounts", account);
  const user: SessionUser = { id: account.id, email: account.email, display_name: account.display_name, mode: "local" };
  saveLocalSession(user);
  return user;
}

async function localSignIn(email: string, password: string): Promise<SessionUser> {
  const db = await getDB();
  const account = (await db.getFromIndex("accounts", "by_email", email.trim().toLowerCase())) as LocalAccount | undefined;
  // Ten sam komunikat dla złego e-maila i hasła — nie ujawniamy istnienia konta.
  const fail = new Error("Nieprawidłowy e-mail lub hasło.");
  if (!account) throw fail;
  const hash = await hashPassword(password, account.salt, account.iterations);
  if (!timingSafeEqual(hash, account.hash)) throw fail;
  const user: SessionUser = { id: account.id, email: account.email, display_name: account.display_name, mode: "local" };
  saveLocalSession(user);
  return user;
}

function saveLocalSession(user: SessionUser) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    /* tryb prywatny — sesja tylko w pamięci */
  }
}

function readLocalSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

async function deleteLocalAccount(userId: string) {
  const db = await getDB();
  await db.delete("accounts", userId);
  localStorage.removeItem(SESSION_KEY);
}

/* ------------------------------------------------------------------ */
/* Publiczne API                                                       */
/* ------------------------------------------------------------------ */

export const auth = {
  mode: (isSupabaseConfigured ? "supabase" : "local") as "local" | "supabase",

  async getSession(): Promise<SessionUser | null> {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (!u) return null;
      return { id: u.id, email: u.email ?? "", display_name: (u.user_metadata?.display_name as string) ?? "", mode: "supabase" };
    }
    const s = readLocalSession();
    if (!s) return null;
    // Sesja musi wskazywać na istniejące konto.
    const db = await getDB();
    const acc = await db.get("accounts", s.id);
    return acc ? s : null;
  },

  async signUp(email: string, password: string, displayName: string): Promise<SessionUser> {
    const e = validateEmail(email) ?? validatePassword(password);
    if (e) throw new Error(e);
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
      if (error) throw new Error(error.message);
      if (!data.session || !data.user) throw new Error("Sprawdź skrzynkę e-mail i potwierdź rejestrację, a następnie zaloguj się.");
      return { id: data.user.id, email, display_name: displayName, mode: "supabase" };
    }
    return localSignUp(email, password, displayName);
  },

  async signIn(email: string, password: string): Promise<SessionUser> {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error("Nieprawidłowy e-mail lub hasło.");
      return {
        id: data.user.id,
        email: data.user.email ?? email,
        display_name: (data.user.user_metadata?.display_name as string) ?? "",
        mode: "supabase",
      };
    }
    return localSignIn(email, password);
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignoruj */
    }
  },

  async deleteAccount(userId: string): Promise<void> {
    if (getSupabase()) return; // usunięcie wykonuje SupabaseAdapter.removeAllUserData (RPC)
    await deleteLocalAccount(userId);
  },
};
