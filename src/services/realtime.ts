import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function subscribeToGame(gameId: string, userId: string, onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel(`game:${gameId}`, {
      config: {
        presence: { key: userId },
      },
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, onChange)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_public_state", filter: `game_id=eq.${gameId}` },
      onChange,
    )
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ userId, onlineAt: new Date().toISOString() });
    });
  return channel;
}
