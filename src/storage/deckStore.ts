import {
  SOURCE_FORMAT_VERSION,
  toStoredDeckSource,
  type DeckSource,
  type StoredSource,
} from "../deck/source";

/**
 * 原稿と画像の保存（設計 15.3）。
 *
 * 画像を持つため IndexedDB を使う（`localStorage` は 5MB 前後で入らない）。
 * どこへも送信せず、このブラウザに閉じる。
 *
 * **保存の失敗で発表を止めない。** 読み書きに失敗した場合は入口画面から始められればよい。
 */

const DB_NAME = "menma";
const DB_VERSION = 1;
const STORE_NAME = "decks";
const RECORD_KEY = "current";

/** v0.2.0 まで使っていた localStorage のキー。見つけたら移して消す */
const LEGACY_STORAGE_KEY = "menma:source";

export async function loadSource(target: Window): Promise<DeckSource | undefined> {
  const migrated = migrateLegacySource(target);

  if (migrated) {
    await saveSource(target, migrated);
    return migrated;
  }

  const db = await openDatabase(target);

  if (!db) {
    return undefined;
  }

  try {
    const stored = await request<unknown>(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY),
    );
    return toStoredDeckSource(stored);
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}

export async function saveSource(target: Window, source: DeckSource): Promise<void> {
  const db = await openDatabase(target);

  if (!db) {
    return;
  }

  const stored: StoredSource = { version: SOURCE_FORMAT_VERSION, source };

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(stored, RECORD_KEY);
    await completed(transaction);
  } catch {
    // 容量超過などで保存できなくても、いま表示している原稿はそのまま使える
  } finally {
    db.close();
  }
}

export async function clearSource(target: Window): Promise<void> {
  const db = await openDatabase(target);

  if (!db) {
    return;
  }

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
    await completed(transaction);
  } catch {
    // 消せなくても実害はない
  } finally {
    db.close();
  }
}

/**
 * v0.2.0 で localStorage へ保存された原稿を拾う。
 *
 * 拾えたら localStorage 側は消す。画像は持っていない形式なので空の配列を足す。
 */
function migrateLegacySource(target: Window): DeckSource | undefined {
  let raw: string | null;

  try {
    raw = target.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (raw === null) {
    return undefined;
  }

  try {
    target.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 消せなくても移行そのものは続ける
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return toStoredDeckSource(withEmptyAssets(parsed));
  } catch {
    return undefined;
  }
}

/** 旧形式には assets が無いので、検証を通る形へ補う */
function withEmptyAssets(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const stored = value as Record<string, unknown>;
  const source = stored["source"];

  if (typeof source !== "object" || source === null) {
    return value;
  }

  return {
    ...stored,
    source: { assets: [], ...(source as Record<string, unknown>) },
  };
}

async function openDatabase(target: Window): Promise<IDBDatabase | undefined> {
  const factory: IDBFactory | undefined = target.indexedDB;

  if (!factory) {
    return undefined;
  }

  try {
    const open = factory.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    return await request(open);
  } catch {
    return undefined;
  }
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => {
      resolve(source.result);
    };
    source.onerror = () => {
      reject(source.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}
