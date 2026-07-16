import { useState } from "react";

type SettingValue = boolean | number;

export function useSetting<T extends SettingValue>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    if (typeof fallback === "boolean") return (stored === "true") as T;
    const parsed = Number(stored);
    return (Number.isFinite(parsed) ? parsed : fallback) as T;
  });

  return [value, (next) => {
    setValue(next);
    localStorage.setItem(key, String(next));
    window.dispatchEvent(new CustomEvent("scrambo-setting", { detail: { key, value: next } }));
  }];
}
