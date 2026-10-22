import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, emptySnapshot, type CollectionName, type Snapshot } from "@/lib/domain/types";
import type { DataAdapter } from "./adapter";

/**
 * Adapter PostgreSQL (Supabase). Nazwy kolekcji = nazwy tabel, pola rekordów
 * = kolumny. Bezpieczeństwo zapewnia RLS — zapytania wykonują się z tokenem
 * zalogowanego użytkownika (klucz anon + JWT), a polityki dopuszczają wyłącznie
 * wiersze z user_id = auth.uid().
 */
export class SupabaseAdapter implements DataAdapter {
  readonly kind = "supabase" as const;
  constructor(private client: SupabaseClient) {}

  async loadAll(userId: string): Promise<Snapshot> {
    const snap = emptySnapshot();
    await Promise.all(
      COLLECTIONS.map(async (c) => {
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await this.client
            .from(c)
            .select("*")
            .eq("user_id", userId)
            .range(from, from + pageSize - 1);
          if (error) throw new Error(`Błąd odczytu ${c}: ${error.message}`);
          for (const row of data ?? []) (snap[c] as Record<string, unknown>)[row.id] = row;
          if (!data || data.length < pageSize) break;
        }
      }),
    );
    return snap;
  }

  async upsert(userId: string, collection: CollectionName, records: { id: string; user_id: string }[]): Promise<void> {
    if (!records.length) return;
    if (records.some((r) => r.user_id !== userId)) throw new Error("Odmowa zapisu: niezgodny user_id.");
    for (let i = 0; i < records.length; i += 500) {
      const { error } = await this.client.from(collection).upsert(records.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error(`Błąd zapisu ${collection}: ${error.message}`);
    }
  }

  async remove(userId: string, collection: CollectionName, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.client.from(collection).delete().eq("user_id", userId).in("id", ids);
    if (error) throw new Error(`Błąd usuwania ${collection}: ${error.message}`);
  }

  async removeAllUserData(_userId: string): Promise<void> {
    // Funkcja SQL (security definer) usuwa konto auth.users; dane znikają
    // kaskadowo (ON DELETE CASCADE) — patrz migracja.
    const { error } = await this.client.rpc("delete_my_account");
    if (error) throw new Error(`Nie udało się usunąć konta: ${error.message}`);
  }
}
