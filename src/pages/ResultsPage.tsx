import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../app/providers";
import { useGame } from "../hooks/useGame";
import { createRematch } from "../services/games";

export function ResultsPage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { game, loading, setError, error } = useGame(gameId, user?.id);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (game?.rematchGameId) {
      localStorage.setItem("scrambo.lastGameId", game.rematchGameId);
      navigate(`/lobby/${game.rematchGameId}`, { replace: true });
    }
  }, [game?.rematchGameId, navigate]);
  useEffect(() => {
    if (game?.status === "active") navigate(`/game/${game.gameId}`, { replace: true });
    if (game?.status === "lobby") navigate(`/lobby/${game.gameId}`, { replace: true });
  }, [game, navigate]);
  if (loading) return <AppShell><div className="loading">Gathering the cards…</div></AppShell>;
  if (!game) return <AppShell><div className="notice notice--error"><p>{error ?? "Game not found."}</p><Link className="button button--ghost" to="/">Back home</Link></div></AppShell>;
  const currentGameId = game.gameId;
  const won = game.winnerUserId === user?.id;
  const title = game.winnerUserId ? (won ? "You scrammed first!" : `${game.opponent?.screenName ?? "Your opponent"} wins`) : "Game ended";

  async function rematch() {
    setBusy(true);
    try { const next = await createRematch(currentGameId); localStorage.setItem("scrambo.lastGameId", next.gameId); navigate(`/lobby/${next.gameId}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create a rematch."); }
    finally { setBusy(false); }
  }

  return <AppShell><section className="results"><div className={`result-burst ${won ? "result-burst--win" : ""}`}>{won ? "★" : "S"}</div><p className="eyebrow">GAME OVER</p><h1>{title}</h1><p>{game.endReason?.replaceAll("_", " ") ?? `${game.turnNumber} turns played`}</p>{game.hostUserId === user?.id && <button className="button button--primary button--large" disabled={busy} onClick={() => void rematch()}>New game · same players</button>}<Link className="button button--ghost" to="/">Back home</Link>{error && <p className="form-error">{error}</p>}</section></AppShell>;
}
