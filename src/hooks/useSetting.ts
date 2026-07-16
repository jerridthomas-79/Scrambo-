import { useState } from "react";

type SettingValue = boolean | number;
type WidenSetting<T extends SettingValue> = T extends boolean ? boolean : number;

export function useSetting<T extends SettingValue>(
  key: string,
  fallback: T,
): [WidenSetting<T>, (value: WidenSetting<T>) => void] {
  type Value = WidenSetting<T>;

  const [value, setValue] = useState<Value>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback as Value;
    if (typeof fallback === "boolean") return (stored === "true") as Value;
    const parsed = Number(stored);
    return (Number.isFinite(parsed) ? parsed : fallback) as Value;
  });

  function update(next: Value): void {
    setValue(next);
    localStorage.setItem(key, String(next));
    window.dispatchEvent(new CustomEvent("scrambo-setting", { detail: { key, value: next } }));
  }

  return [value, update];
}
