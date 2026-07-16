import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../app/providers";
import { BuildPile } from "../components/BuildPile";
import { Card } from "../components/Card";
import { PlayerPlacard } from "../components/PlayerPlacard";
import { useGame } from "../hooks/useGame";
import { legalBuildTargets } from "../game/rules";
import type { Card as CardType, CardSource, PlayerView } from "../game/types";
import { discardAndEndTurn, endGame, playCard } from "../services/games";

export function GamePage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { game, setGame, loading, error, setError, refresh } = useGame(gameId, user?.id);
  const [selected, setSelected] = useState<CardSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const previousActivePlayer = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (game && ["completed", "ended", "abandoned"].includes(game.status)) navigate(`/results/${game.gameId}`, { replace: true });
    if (game?.status === "lobby") navigate(`/lobby/${game.gameId}`, { replace: true });
  }, [game, navigate]);

  useEffect(() => setSelected(null), [game?.version]);

  useEffect(() => {
    const active = game?.activePlayerId ?? null;
    const previous = previousActivePlayer.current;
    const isSoundEnabled = localStorage.getItem("scrambo.soundEnabled") !== "false";

    if (previous === user?.id && active !== user?.id && game?.me.hand) {
      localStorage.setItem(drawCountKey(game.gameId, user.id), String(game.me.hand.length));
    }

    if (active === user?.id && previous !== active) {
      if (isSoundEnabled) playTurnChime();
      if (localStorage.getItem("scrambo.motionEnabled") !== "false") navigator.vibrate?.(45);

      if (game && user) {
        const storedHandCount = Number(localStorage.getItem(drawCountKey(game.gameId, user.id)));
        if (Number.isFinite(storedHandCount) && storedHandCount >= 0 && storedHandCount <= 5) {
          const cardsDrawn = 5 - storedHandCount;
          const streakKey = oneCardStreakKey(game.gameId, user.id);
          const previousStreak = Number(localStorage.getItem(streakKey) ?? 0);
          const nextStreak = cardsDrawn === 1 ? previousStreak + 1 : 0;
          localStorage.setItem(streakKey, String(nextStreak));
          if (nextStreak >= 4 && isSoundEnabled) {
            playComeOnNow();
            localStorage.setItem(streakKey, "0");
          }
        }
      }
    }

    previousActivePlayer.current = active;
  }, [game?.activePlayerId, game?.gameId, game?.me.hand, user]);

  const selectedCard = useMemo(() => findSelectedCard(game?.me, selected), [game?.me, selected]);
  const legalTargets = game && selectedCard ? legalBuildTargets(selectedCard, game.shared.buildPiles) : [];
  const myTurn = game?.activePlayerId === user?.id;

  async function moveToBuild(index: number) {
    if (!game || !selected || !selectedCard || !myTurn) return;
    const top = game.shared.buildPiles[index]?.at(-1);
    const completesPile = (top?.resolvedRank ?? 0) + 1 === 12;
    setBusy(true); setError(null);
    try {
      setGame(await playCard(game.gameId, selected, index, game.version));
      setSelected(null);
      if (soundEnabled()) {
        playCardSound();
        if (completesPile) window.setTimeout(playCompletedPileSound, 90);
      }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That move did not work."); await refresh(); }
    finally { setBusy(false); }
  }

  async function discard(index: number) {
    if (!game || selected?.type !== "hand" || !myTurn) return;
    setBusy(true); setError(null);
    try { setGame(await discardAndEndTurn(game.gameId, selected.cardId, index, game.version)); setSelected(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not discard that card."); await refresh(); }
    finally { setBusy(false); }
  }

  async function finish(mode: "no_winner" | "forfeit") {
    if (!game) return;
    if (!confirm(mode === "forfeit" ? "Forfeit this game? Your opponent wins." : "End this game without a winner?")) return;
    setBusy(true);
    try { const next = await endGame(game.gameId, mode); setGame(next); navigate(`/results/${game.gameId}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not end the game."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="game-loading">Dealing the cards…</div>;
  if (!game || !game.opponent) return <div className="game-loading">{error ?? "Game not found."}</div>;

  return <main className="game-screen"><header className="game-header"><Link to="/" className="game-mark">S–B!</Link><span>Round {game.turnNumber}</span><button aria-label="Game menu" onClick={() => setMenu(!menu)}>•••</button>{menu && <div className="game-menu"><Link to="/rules">Rules</Link><button onClick={() => void refresh()}>Reconnect</button>{game.hostUserId === user?.id ? <><button onClick={() => void finish("no_winner")}>End · no winner</button><button onClick={() => void finish("forfeit")}>Forfeit game</button></> : <button onClick={() => void finish("forfeit")}>Leave & forfeit</button>}</div>}</header><PlayerPlacard player={game.opponent} active={game.activePlayerId === game.opponent.userId} isMe={false} /><PlayerArea player={game.opponent} opponent /><section className="build-zone" aria-label="Shared building piles">{game.shared.buildPiles.map((pile, index) => <BuildPile key={index} pile={pile} index={index} legal={myTurn && !busy && legalTargets.includes(index)} onClick={() => void moveToBuild(index)} />)}</section><section className="draw-zone"><div className="mini-deck" aria-label={`${game.shared.drawCount} cards in draw pile`}>S</div><span>{game.shared.drawCount} draw · {game.shared.completedCount} recycled</span></section><PlayerArea player={game.me} selected={selected} setSelected={setSelected} canAct={Boolean(myTurn && !busy)} onDiscard={discard} /><PlayerPlacard player={game.me} active={myTurn} isMe /><section className="hand" aria-label="Your hand">{game.me.hand?.map((card) => <Card key={card.id} card={card} selected={selected?.cardId === card.id} disabled={busy || !myTurn} onClick={() => setSelected({ type: "hand", cardId: card.id })} label={`Hand card ${card.rank}. Select to play.`} />)}{Array.from({ length: Math.max(0, 5 - (game.me.hand?.length ?? 0)) }, (_, index) => <span key={index} className="hand__empty" />)}</section>{selected && <div className="action-hint">{selected.type === "hand" ? "Tap a glowing build pile, or a discard pile to end your turn." : "Tap a glowing build pile."}</div>}{error && <button className="toast" onClick={() => setError(null)}>{error}</button>}<span className="sr-only" aria-live="assertive">{myTurn ? "It is your turn." : `It is ${game.opponent.screenName}'s turn.`}</span></main>;
}

function PlayerArea({ player, opponent = false, selected, setSelected, canAct = false, onDiscard }: { player: PlayerView; opponent?: boolean; selected?: CardSource | null; setSelected?: (source: CardSource) => void; canAct?: boolean; onDiscard?: (index: number) => Promise<void> }) {
  return <section className={`player-area ${opponent ? "player-area--opponent" : ""}`}><div className="pile-wrap"><Card card={player.stockTop} hidden={!player.stockTop && player.stockCount > 0} selected={selected?.type === "stock"} disabled={opponent || !canAct} priority onClick={() => player.stockTop && setSelected?.({ type: "stock", cardId: player.stockTop.id })} label={`Stockpile top ${player.stockTop?.rank ?? "hidden"}. ${player.stockCount} cards remain.`} /><span className="pile-count">{player.stockCount}</span></div><div className="discard-row">{player.discardPiles.map((pile, index) => <div className={`pile-wrap discard-stack discard-stack--${Math.min(pile.count, 4)}`} key={index}><Card card={pile.top} selected={selected?.type === "discard" && selected.pileIndex === index} disabled={opponent || !canAct} allowEmpty={selected?.type === "hand" && canAct} small onClick={() => { if (selected?.type === "hand" && onDiscard) void onDiscard(index); else if (pile.top && setSelected) setSelected({ type: "discard", pileIndex: index, cardId: pile.top.id }); }} label={`Discard pile ${index + 1}. ${pile.top ? `Top card ${pile.top.rank}.` : "Empty."}`} /><span className="pile-count">{pile.count}</span></div>)}</div>{opponent && <span className="hand-count">{player.handCount} cards in hand</span>}</section>;
}

function findSelectedCard(player: PlayerView | undefined, selected: CardSource | null): CardType | null {
  if (!player || !selected) return null;
  if (selected.type === "hand") return player.hand?.find((card) => card.id === selected.cardId) ?? null;
  if (selected.type === "stock") return player.stockTop?.id === selected.cardId ? player.stockTop : null;
  return player.discardPiles[selected.pileIndex]?.top?.id === selected.cardId ? player.discardPiles[selected.pileIndex]?.top ?? null : null;
}

function soundEnabled(): boolean {
  return localStorage.getItem("scrambo.soundEnabled") !== "false";
}

function drawCountKey(gameId: string, userId: string): string {
  return `scrambo.lastHandCount.${gameId}.${userId}`;
}

function oneCardStreakKey(gameId: string, userId: string): string {
  return `scrambo.oneCardDrawStreak.${gameId}.${userId}`;
}

function playTurnChime(): void {
  playTones([[620, 0, .12], [790, .11, .12], [980, .22, .18]], "sine", .045);
}

function playCardSound(): void {
  playTones([[330, 0, .05], [510, .045, .09]], "triangle", .04);
}

function playCompletedPileSound(): void {
  playTones([[760, 0, .12], [610, .08, .14], [430, .17, .2]], "sine", .055);
}

function playComeOnNow(): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance("Come on now.");
  utterance.rate = .92;
  utterance.pitch = .82;
  utterance.volume = .8;
  window.speechSynthesis.speak(utterance);
}

function playTones(tones: Array<[number, number, number]>, type: OscillatorType, volume: number): void {
  try {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.setValueAtTime(volume, context.currentTime);
    master.connect(context.destination);
    let finalTime = context.currentTime;
    tones.forEach(([frequency, delay, duration]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + delay;
      const end = start + duration;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(1, start);
      gain.gain.exponentialRampToValueAtTime(.001, end);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(end);
      finalTime = Math.max(finalTime, end);
    });
    window.setTimeout(() => void context.close(), Math.max(250, (finalTime - context.currentTime) * 1000 + 80));
  } catch {
    // Browsers may block audio until the first gesture; gameplay continues silently.
  }
}
