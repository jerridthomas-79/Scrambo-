import { useState } from "react";

export function useSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  });
  return [value, (next) => {
    setValue(next);
    localStorage.setItem(key, String(next));
    window.dispatchEvent(new CustomEvent("scrambo-setting", { detail: { key, value: next } }));
  }];
}
