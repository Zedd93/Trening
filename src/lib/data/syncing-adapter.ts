import type { CollectionName, Snapshot } from "@/lib/domain/types";
import type { DataAdapter } from "./adapter";
import { LocalAdapter } from "./local-adapter";

type Op =
  | { type: "upsert"; collection: CollectionName; records: { id: string; user_id: string }[] }
  | { type: "remove"; collection: CollectionName; ids: string[] };

const OUTBOX_KEY = (userId: string) => `seal-outbox-${userId}`;

/**
 * Offline-first: każdy zapis trafia najpierw do IndexedDB (zawsze dostępne),
 * a następnie do Supabase. Nieudane zapisy zdalne trafiają do kolejki
 * (outbox) i są ponawiane po odzyskaniu połączenia lub przy kolejnym starcie.
 */
export class SyncingAdapter implements DataAdapter {
  readonly kind = "supabase" as const;
  private local = new LocalAdapter();
  constructor(private remote: DataAdapter) {}

  private readOutbox(userId: string): Op[] {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_KEY(userId)) ?? "[]") as Op[];
    } catch {
      return [];
    }
  }
  private writeOutbox(userId: string, ops: Op[]) {
    try {
      localStorage.setItem(OUTBOX_KEY(userId), JSON.stringify(ops));
    } catch {
      /* brak miejsca — dane i tak są w IndexedDB */
    }
  }

  pendingCount(userId: string): number {
    return this.readOutbox(userId).length;
  }

  async flush(userId: string): Promise<boolean> {
    const ops = this.readOutbox(userId);
    const remaining: Op[] = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      try {
        if (op.type === "upsert") await this.remote.upsert(userId, op.collection, op.records);
        else await this.remote.remove(userId, op.collection, op.ids);
      } catch {
        remaining.push(...ops.slice(i));
        break;
      }
    }
    this.writeOutbox(userId, remaining);
    return remaining.length === 0;
  }

  async loadAll(userId: string): Promise<Snapshot> {
    const flushed = await this.flush(userId);
    if (!flushed) return this.local.loadAll(userId);
    try {
      const snap = await this.remote.loadAll(userId);
      // Odśwież lokalną kopię.
      await this.local.removeAllUserData(userId);
      for (const [c, rows] of Object.entries(snap)) {
        await this.local.upsert(userId, c as CollectionName, Object.values(rows) as { id: string; user_id: string }[]);
      }
      return snap;
    } catch {
      return this.local.loadAll(userId);
    }
  }

  async upsert(userId: string, collection: CollectionName, records: { id: string; user_id: string }[]) {
    await this.local.upsert(userId, collection, records);
    try {
      if (this.readOutbox(userId).length) throw new Error("kolejka");
      await this.remote.upsert(userId, collection, records);
    } catch {
      this.writeOutbox(userId, [...this.readOutbox(userId), { type: "upsert", collection, records }]);
    }
  }

  async remove(userId: string, collection: CollectionName, ids: string[]) {
    await this.local.remove(userId, collection, ids);
    try {
      if (this.readOutbox(userId).length) throw new Error("kolejka");
      await this.remote.remove(userId, collection, ids);
    } catch {
      this.writeOutbox(userId, [...this.readOutbox(userId), { type: "remove", collection, ids }]);
    }
  }

  async removeAllUserData(userId: string) {
    await this.remote.removeAllUserData(userId);
    await this.local.removeAllUserData(userId);
    this.writeOutbox(userId, []);
  }
}
