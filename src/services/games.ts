import type { CardSource, GameView } from "../game/types";
import { supabase } from "./supabase";

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("The server returned no game data.");
  return data;
}

export async function createGame(): Promise<GameView> {
  const { data, error } = await supabase.rpc("create_game");
  return unwrap(data as GameView | null, error);
}

export async function joinGame(code: string): Promise<GameView> {
  const { data, error } = await supabase.rpc("join_game", { p_join_code: code.trim().toUpperCase() });
  return unwrap(data as GameView | null, error);
}

export async function getGameView(gameId: string): Promise<GameView> {
  const { data, error } = await supabase.rpc("get_game_view", { p_game_id: gameId });
  return unwrap(data as GameView | null, error);
}

export async function setReady(gameId: string, isReady: boolean): Promise<GameView> {
  const { data, error } = await supabase.rpc("set_ready", { p_game_id: gameId, p_is_ready: isReady });
  return unwrap(data as GameView | null, error);
}

export async function leaveLobby(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_lobby", { p_game_id: gameId });
  if (error) throw new Error(error.message);
}

export async function startGame(gameId: string): Promise<GameView> {
  const { data, error } = await supabase.rpc("start_game", { p_game_id: gameId });
  return unwrap(data as GameView | null, error);
}

export async function playCard(
  gameId: string,
  source: CardSource,
  buildIndex: number,
  expectedVersion: number,
): Promise<GameView> {
  const { data, error } = await supabase.rpc("play_card", {
    p_game_id: gameId,
    p_source_type: source.type,
    p_source_index: source.type === "discard" ? source.pileIndex : null,
    p_card_id: source.cardId,
    p_destination_build_index: buildIndex,
    p_expected_version: expectedVersion,
  });
  return unwrap(data as GameView | null, error);
}

export async function discardAndEndTurn(
  gameId: string,
  cardId: string,
  discardIndex: number,
  expectedVersion: number,
): Promise<GameView> {
  const { data, error } = await supabase.rpc("discard_and_end_turn", {
    p_game_id: gameId,
    p_hand_card_id: cardId,
    p_discard_index: discardIndex,
    p_expected_version: expectedVersion,
  });
  return unwrap(data as GameView | null, error);
}

export async function endGame(gameId: string, mode: "no_winner" | "forfeit"): Promise<GameView> {
  const { data, error } = await supabase.rpc("end_game", { p_game_id: gameId, p_end_mode: mode });
  return unwrap(data as GameView | null, error);
}

export async function createRematch(gameId: string): Promise<GameView> {
  const { data, error } = await supabase.rpc("create_rematch", { p_game_id: gameId });
  return unwrap(data as GameView | null, error);
}

export async function heartbeat(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("heartbeat", { p_game_id: gameId });
  if (error) throw new Error(error.message);
}
