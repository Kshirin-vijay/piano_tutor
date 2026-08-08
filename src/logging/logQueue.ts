const DB_NAME = "pianoFriend.telemetry";
const STORE_NAME = "events";
const DB_VERSION = 1;

export interface QueuedLog {
  eventId: string;
  endpoint: string;
  payload: Record<string, unknown>;
}

let flushPromise: Promise<void> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "eventId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function put(item: QueuedLog): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(item);
  await complete(transaction);
  db.close();
}

async function all(): Promise<QueuedLog[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).getAll();
  const result = await new Promise<QueuedLog[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as QueuedLog[]);
    request.onerror = () => reject(request.error);
  });
  await complete(transaction);
  db.close();
  return result;
}

async function remove(eventId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(eventId);
  await complete(transaction);
  db.close();
}

async function deliver(item: QueuedLog, keepalive = false): Promise<boolean> {
  try {
    const response = await fetch(item.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
      keepalive,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function flushLogQueue(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const items = await all();
    for (const item of items) {
      if (!(await deliver(item))) break;
      await remove(item.eventId);
    }
  })()
    .catch(() => {
      /* Telemetry must never interrupt practice. */
    })
    .finally(() => {
      flushPromise = null;
    });
  return flushPromise;
}

export function queueLog(item: QueuedLog, keepalive = false): void {
  void put(item)
    .then(async () => {
      if (keepalive && (await deliver(item, true))) {
        await remove(item.eventId);
        return;
      }
      await flushLogQueue();
    })
    .catch(() => {
      /* IndexedDB may be unavailable in private browsing. Try once directly. */
      void deliver(item, keepalive);
    });
}
