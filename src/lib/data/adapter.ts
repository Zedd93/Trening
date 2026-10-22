import type { CollectionName, Snapshot } from "@/lib/domain/types";

/**
 * Warstwa trwałego zapisu. Implementacje:
 *  - LocalAdapter    — IndexedDB w przeglądarce (tryb lokalny / offline)
 *  - SupabaseAdapter — PostgreSQL + Row Level Security
 *
 * Każda operacja jest zawężona do jednego użytkownika (userId). Adapter
 * lokalny filtruje po user_id, a w Supabase izolację wymusza RLS
 * (auth.uid() = user_id) — klient nie może odczytać cudzych danych nawet
 * przy błędzie w kodzie aplikacji.
 */
export interface DataAdapter {
  readonly kind: "local" | "supabase";
  loadAll(userId: string): Promise<Snapshot>;
  upsert(userId: string, collection: CollectionName, records: { id: string; user_id: string }[]): Promise<void>;
  remove(userId: string, collection: CollectionName, ids: string[]): Promise<void>;
  removeAllUserData(userId: string): Promise<void>;
}
