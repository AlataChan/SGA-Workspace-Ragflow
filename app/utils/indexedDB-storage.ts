import { StateStorage } from "zustand/middleware";
import { get, set, del, clear } from "idb-keyval";

function safeLocalStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
} {
  let storage: Storage | null = null;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      storage = window.localStorage;
    }
  } catch {
    storage = null;
  }

  return {
    getItem(key: string) {
      return storage ? storage.getItem(key) : null;
    },
    setItem(key: string, value: string) {
      if (storage) storage.setItem(key, value);
    },
    removeItem(key: string) {
      if (storage) storage.removeItem(key);
    },
    clear() {
      if (storage) storage.clear();
    },
  };
}

const localStorage = safeLocalStorage();

class IndexedDBStorage implements StateStorage {
  public async getItem(name: string): Promise<string | null> {
    try {
      const value = (await get(name)) || localStorage.getItem(name);
      return value;
    } catch (error) {
      return localStorage.getItem(name);
    }
  }

  public async setItem(name: string, value: string): Promise<void> {
    try {
      const _value = JSON.parse(value);
      if (!_value?.state?._hasHydrated) {
        console.warn("skip setItem", name);
        return;
      }
      await set(name, value);
    } catch (error) {
      localStorage.setItem(name, value);
    }
  }

  public async removeItem(name: string): Promise<void> {
    try {
      await del(name);
    } catch (error) {
      localStorage.removeItem(name);
    }
  }

  public async clear(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      localStorage.clear();
    }
  }
}

export const indexedDBStorage = new IndexedDBStorage();
