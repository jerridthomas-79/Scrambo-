import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AppShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className="app-shell">
      <header className="topbar"><Logo compact={compact} /></header>
      <main className="main-content">{children}</main>
      <footer>Scram-Bo is an independent fan-made game and is not affiliated with or endorsed by Mattel.</footer>
    </div>
  );
}
