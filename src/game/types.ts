export type NumberRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type CardRank = NumberRank | "WILD";

export interface Card {
  id: string;
  rank: CardRank;
}

export interface PlayedCard {
  cardId: string;
  printedRank: CardRank;
  resolvedRank: NumberRank;
}

export interface VisiblePile {
  count: number;
  top: Card | null;
}

export interface PlayerView {
  userId: string;
  screenName: string;
  avatarKey: string;
  seat: 1 | 2;
  isReady: boolean;
  isConnected: boolean;
  hand?: Card[];
  handCount: number;
  stockCount: number;
  stockTop: Card | null;
  discardPiles: VisiblePile[];
}

export type GameStatus = "lobby" | "active" | "completed" | "ended" | "abandoned";

export interface GameView {
  gameId: string;
  joinCode: string;
  status: GameStatus;
  hostUserId: string;
  version: number;
  turnNumber: number;
  activePlayerId: string | null;
  winnerUserId: string | null;
  endReason: string | null;
  rematchGameId: string | null;
  me: PlayerView;
  opponent: PlayerView | null;
  shared: {
    drawCount: number;
    completedCount: number;
    buildPiles: PlayedCard[][];
  };
  lastAction: {
    type: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  } | null;
}

export type CardSource =
  | { type: "hand"; cardId: string }
  | { type: "stock"; cardId: string }
  | { type: "discard"; pileIndex: number; cardId: string };

export interface Profile {
  id: string;
  screen_name: string;
  avatar_key: string;
  created_at: string;
  updated_at: string;
}
