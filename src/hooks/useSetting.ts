import { useState } from "react";

export function useSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void];
export function useSetting(key: string, fallback: number): [number, (value: number) => void];
export function useSetting(key: string, fallback: boolean | number) {
  const [value, setValue] = useState<boolean | number>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    if (typeof fallback === "boolean") return stored === "true";
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : fallback;
  });

  function update(next: boolean | number): void {
    setValue(next);
    localStorage.setItem(key, String(next));
    window.dispatchEvent(new CustomEvent("scrambo-setting", { detail: { key, value: next } }));
  }

  return [value, update] as const;
}
