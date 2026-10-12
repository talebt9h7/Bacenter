'use client';
import { useCallback, useSyncExternalStore } from 'react';

// Same-tab writes don't fire the browser "storage" event, so writes go through
// writeLocalStorage(), which notifies subscribers itself.
const LOCAL_EVENT = 'local-storage-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the value just isn't remembered.
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/**
 * Reads a localStorage value without a hydration mismatch: the server render and the
 * first client render both see `serverValue`, then React switches to the stored value.
 */
export function useLocalStorageValue(key: string, serverValue: string | null = null) {
  const getSnapshot = useCallback(() => read(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
