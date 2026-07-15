import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../app/providers";
import { createGame, joinGame } from "../services/games";

export function HomePage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("join")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const lastGame = localStorage.getItem("scrambo.lastGameId");

  useEffect(() => {
    const incoming = params.get("join");
    if (incoming) setCode(incoming.toUpperCase());
  }, [params]);

  async function makeGame() {
    setBusy(true); setError(null);
    try {
      const game = await createGame();
      localStorage.setItem("scrambo.lastGameId", game.gameId);
      navigate(`/lobby/${game.gameId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create a game."); }
    finally { setBusy(false); }
  }

  async function join(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const game = await joinGame(code);
      localStorage.setItem("scrambo.lastGameId", game.gameId);
      navigate(`/lobby/${game.gameId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not join that game."); }
    finally { setBusy(false); }
  }

  return <AppShell><section className="hero"><p className="eyebrow">PATIO NIGHT CARD BATTLE</p><h1>Hey, {profile?.screen_name}.</h1><p className="hero__lead">Race through your stockpile. Build 1 to 12. Blame the shuffle.</p></section><section className="home-actions"><button className="button button--primary button--large" onClick={() => void makeGame()} disabled={busy}>Create game</button><form className="join-form" onSubmit={(event) => void join(event)}><label htmlFor="join-code">Have a room code?</label><div><input id="join-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EMBER-42" maxLength={9} /><button className="button" disabled={busy || code.length < 6}>Join</button></div></form>{lastGame && <Link className="button button--ghost" to={`/lobby/${lastGame}`}>Resume last game</Link>}{error && <p className="form-error" role="alert">{error}</p>}</section><nav className="home-links"><Link to="/rules">How to play</Link><Link to="/settings">Settings</Link><Link to="/profile">Edit name</Link></nav></AppShell>;
}
