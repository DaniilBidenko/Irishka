/** Аварийные черновики в IndexedDB — вспомогательная защита, не основная БД. */

const DB_NAME = "workbook-drafts";
const STORE = "drafts";

export type DraftRecord = {
  entityId: string;
  baseRevision: number;
  updatedAt: string;
  fields: Record<string, unknown>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "entityId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: DraftRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    console.warn("Черновик недоступен (IndexedDB)");
    window.dispatchEvent(
      new CustomEvent("workbook:save-status", {
        detail: "Предупреждение: локальные черновики недоступны",
      }),
    );
  }
}

export async function loadDraft(
  entityId: string,
): Promise<DraftRecord | null> {
  try {
    const db = await openDb();
    const row = await new Promise<DraftRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(entityId);
      req.onsuccess = () => resolve((req.result as DraftRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row;
  } catch {
    return null;
  }
}

export async function clearDraft(entityId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(entityId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
