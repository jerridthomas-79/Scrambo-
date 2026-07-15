import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProviders, useAuth } from "./providers";
import { ProfilePage } from "../pages/ProfilePage";
import { HomePage } from "../pages/HomePage";
import { LobbyPage } from "../pages/LobbyPage";
import { GamePage } from "../pages/GamePage";
import { ResultsPage } from "../pages/ResultsPage";
import { RulesPage } from "../pages/RulesPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AppShell } from "../components/AppShell";

function Router() {
  const { loading, error, profile } = useAuth();
  if (loading) return <AppShell><div className="loading"><span className="shuffle-loader" />Warming up the deck…</div></AppShell>;
  if (error) return <AppShell><div className="notice notice--error"><h1>Almost ready</h1><p>{error}</p><p>Check <code>SUPABASE_SETUP.md</code> for the one-time setup.</p></div></AppShell>;

  return (
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/lobby/:gameId" element={profile ? <LobbyPage /> : <Navigate to="/profile" replace />} />
      <Route path="/game/:gameId" element={profile ? <GamePage /> : <Navigate to="/profile" replace />} />
      <Route path="/results/:gameId" element={profile ? <ResultsPage /> : <Navigate to="/profile" replace />} />
      <Route path="/" element={profile ? <HomePage /> : <Navigate to="/profile" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return <AppProviders><HashRouter><Router /></HashRouter></AppProviders>;
}
