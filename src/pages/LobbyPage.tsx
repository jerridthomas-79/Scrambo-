import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../app/providers";
import { useGame } from "../hooks/useGame";
import { leaveLobby, setReady, startGame } from "../services/games";

export function LobbyPage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { game, setGame, loading, error, setError } = useGame(gameId, user?.id);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (game?.status === "active") navigate(`/game/${game.gameId}`, { replace: true });
    if (game && ["completed", "ended", "abandoned"].includes(game.status)) navigate(`/results/${game.gameId}`, { replace: true });
  }, [game, navigate]);

  async function toggleReady() {
    if (!game) return; setBusy(true);
    try { setGame(await setReady(game.gameId, !game.me.isReady)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update ready status."); }
    finally { setBusy(false); }
  }

  async function begin() {
    if (!game) return; setBusy(true);
    try { const next = await startGame(game.gameId); setGame(next); navigate(`/game/${game.gameId}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not start the game."); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!game) return;
    const url = `${location.origin}${location.pathname}#/?join=${game.joinCode}`;
    if (navigator.share) await navigator.share({ title: "Join my Scram-Bo game", text: `Room ${game.joinCode}`, url });
    else await navigator.clipboard.writeText(url);
  }

  async function leave() {
    if (!game || !confirm(game.hostUserId === user?.id ? "Close this lobby for both players?" : "Leave this lobby?")) return;
    setBusy(true);
    try {
      await leaveLobby(game.gameId);
      localStorage.removeItem("scrambo.lastGameId");
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not leave the lobby.");
      setBusy(false);
    }
  }

  if (loading) return <AppShell compact><div className="loading">Finding your table…</div></AppShell>;
  if (!game) return <AppShell compact><div className="notice notice--error">{error ?? "Game not found."}</div></AppShell>;
  const canStart = game.hostUserId === user?.id && game.me.isReady && Boolean(game.opponent?.isReady);

  return <AppShell compact><section className="lobby"><p className="eyebrow">PRIVATE TABLE</p><h1>Room <span>{game.joinCode}</span></h1><button className="button button--ghost" onClick={() => void share()}>Share invite</button><div className="player-slots"><PlayerSlot name={game.me.screenName} ready={game.me.isReady} host={game.hostUserId === game.me.userId} /><div className="versus">VS</div>{game.opponent ? <PlayerSlot name={game.opponent.screenName} ready={game.opponent.isReady} host={game.hostUserId === game.opponent.userId} /> : <div className="player-slot player-slot--empty"><span className="shuffle-loader" /><b>Waiting for player…</b></div>}</div><div className="lobby-actions"><button className={`button ${game.me.isReady ? "button--ready" : "button--primary"}`} disabled={busy} onClick={() => void toggleReady()}>{game.me.isReady ? "Ready ✓" : "I'm ready"}</button>{game.hostUserId === user?.id && <button className="button button--primary" disabled={!canStart || busy} onClick={() => void begin()}>Shuffle & start</button>}</div><button className="button button--ghost lobby-leave" disabled={busy} onClick={() => void leave()}>Leave lobby</button>{error && <p className="form-error">{error}</p>}<p className="fine-print">Starting always creates a fresh 162-card shuffle and randomly picks the first player.</p></section></AppShell>;
}

function PlayerSlot({ name, ready, host }: { name: string; ready: boolean; host: boolean }) {
  return <div className={`player-slot ${ready ? "player-slot--ready" : ""}`}><span className="player-avatar">{name.slice(0, 1).toUpperCase()}</span><b>{name}</b><small>{host ? "HOST · " : ""}{ready ? "READY" : "NOT READY"}</small></div>;
}
