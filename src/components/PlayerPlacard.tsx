import type { PlayerView } from "../game/types";

export function PlayerPlacard({ player, active, isMe }: { player: PlayerView; active: boolean; isMe: boolean }) {
  return (
    <section className={`placard ${active ? "placard--active" : ""}`} aria-live="polite">
      <div>
        <span className={`presence ${player.isConnected ? "presence--online" : ""}`} aria-hidden="true" />
        <strong>{player.screenName}</strong>
        {isMe && <span className="placard__you">YOU</span>}
      </div>
      <span>{active ? (isMe ? "YOUR TURN" : `${player.screenName.toUpperCase()}'S TURN`) : `${player.stockCount} in stock`}</span>
    </section>
  );
}
