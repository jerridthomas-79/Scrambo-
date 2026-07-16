import type { PlayerView } from "../game/types";

const AVATARS = ["🦥", "✈️", "🔥", "🥤", "🍧", "🍫", "🦖", "🚀", "🎸", "⛳"];

export function PlayerPlacard({ player, active, isMe }: { player: PlayerView; active: boolean; isMe: boolean }) {
  const savedAvatar = isMe ? localStorage.getItem("scrambo.profileAvatar") : null;
  const avatar = savedAvatar ?? avatarForPlayer(player.userId);
  return (
    <section className={`placard ${active ? "placard--active" : ""}`} aria-live="polite">
      <div>
        <span className="player-avatar" aria-hidden="true">{avatar}</span>
        <span className={`presence ${player.isConnected ? "presence--online" : ""}`} aria-hidden="true" />
        <strong>{player.screenName}</strong>
        {isMe && <span className="placard__you">YOU</span>}
      </div>
      <span className={active && isMe ? "placard__turn-badge" : ""}>{active ? (isMe ? "YOUR TURN" : `${player.screenName.toUpperCase()}'S TURN`) : `${player.stockCount} in stock`}</span>
    </section>
  );
}

function avatarForPlayer(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}
