import { openDB, type IDBPDatabase } from "idb";
import { COLLECTIONS, emptySnapshot, type CollectionName, type Snapshot } from "@/lib/domain/types";
import type { DataAdapter } from "./adapter";

const DB_NAME = "seal-performance";
const DB_VERSION = 1;

interface StoredRecord {
  key: string;
  user_id: string;
  collection: CollectionName;
  data: { id: string; user_id: string };
}

export interface LocalAccount {
  id: string;
  email: string;
  display_name: string;
  salt: string;
  hash: string;
  iterations: number;
  created_at: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("records")) {
          const store = db.createObjectStore("records", { keyPath: "key" });
          store.createIndex("by_user", "user_id");
          store.createIndex("by_user_collection", ["user_id", "collection"]);
        }
        if (!db.objectStoreNames.contains("accounts")) {
          const acc = db.createObjectStore("accounts", { keyPath: "id" });
          acc.createIndex("by_email", "email", { unique: true });
        }
      },
    });
  }
  return dbPromise;
}

/** Tylko do testów — pozwala zresetować połączenie. */
export function __resetLocalDB() {
  dbPromise = null;
}

const keyOf = (userId: string, collection: CollectionName, id: string) => `${userId}::${collection}::${id}`;

export class LocalAdapter implements DataAdapter {
  readonly kind = "local" as const;

  async loadAll(userId: string): Promise<Snapshot> {
    const db = await getDB();
    const snap = emptySnapshot();
    const rows = (await db.getAllFromIndex("records", "by_user", userId)) as StoredRecord[];
    for (const row of rows) {
      // Podwójna kontrola izolacji: rekord musi należeć do użytkownika.
      if (row.user_id !== userId || row.data.user_id !== userId) continue;
      if (!COLLECTIONS.includes(row.collection)) continue;
      (snap[row.collection] as Record<string, unknown>)[row.data.id] = row.data;
    }
    return snap;
  }

  async upsert(userId: string, collection: CollectionName, records: { id: string; user_id: string }[]): Promise<void> {
    if (!records.length) return;
    const db = await getDB();
    const tx = db.transaction("records", "readwrite");
    for (const r of records) {
      if (r.user_id !== userId) throw new Error("Odmowa zapisu: rekord należy do innego użytkownika.");
      const row: StoredRecord = { key: keyOf(userId, collection, r.id), user_id: userId, collection, data: r };
      await tx.store.put(row);
    }
    await tx.done;
  }

  async remove(userId: string, collection: CollectionName, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = await getDB();
    const tx = db.transaction("records", "readwrite");
    for (const id of ids) await tx.store.delete(keyOf(userId, collection, id));
    await tx.done;
  }

  async removeAllUserData(userId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction("records", "readwrite");
    const keys = await tx.store.index("by_user").getAllKeys(userId);
    for (const k of keys) await tx.store.delete(k);
    await tx.done;
  }
}
