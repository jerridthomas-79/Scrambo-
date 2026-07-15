import { useCallback, useEffect, useState } from "react";
import type { GameView } from "../game/types";
import { getGameView, heartbeat } from "../services/games";
import { subscribeToGame } from "../services/realtime";
import { supabase } from "../services/supabase";

export function useGame(gameId: string | undefined, userId: string | undefined) {
  const [game, setGame] = useState<GameView | null>(null);
  const [loading, setLoading] = useState(Boolean(gameId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await getGameView(gameId);
      setGame(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the game.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !userId) return;
    void refresh();
    const channel = subscribeToGame(gameId, userId, () => void refresh());
    const pulse = window.setInterval(() => void heartbeat(gameId).catch(() => undefined), 30_000);
    const resync = () => void refresh();
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    return () => {
      window.clearInterval(pulse);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
      void supabase.removeChannel(channel);
    };
  }, [gameId, refresh, userId]);

  return { game, setGame, loading, error, setError, refresh };
}
