import { useEffect, useState } from 'react';

/** State remembered in this browser; falls back to `initial` when storage is unavailable or invalid. */
export function useStored<T>(key: string, initial: T, revive: (raw: unknown) => T = (raw) => raw as T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : revive(JSON.parse(raw));
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable (private mode); the value just won't persist.
    }
  }, [key, value]);
  return [value, setValue] as const;
}
