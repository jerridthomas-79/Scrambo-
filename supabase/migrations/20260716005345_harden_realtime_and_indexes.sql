revoke select on public.game_players from authenticated;

create index if not exists game_actions_actor_idx on public.game_actions(actor_user_id);
create index if not exists private_state_user_idx on public.game_private_player_state(user_id);
create index if not exists games_active_player_idx on public.games(active_player_id) where active_player_id is not null;
create index if not exists games_host_idx on public.games(host_user_id);
create index if not exists games_rematch_idx on public.games(rematch_game_id) where rematch_game_id is not null;
create index if not exists games_winner_idx on public.games(winner_user_id) where winner_user_id is not null;

create or replace function public.heartbeat(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user();
begin
  update public.game_players set last_seen_at=now(),is_connected=true where game_id=p_game_id and user_id=v_user;
  if not found then raise exception 'You are not a player in this game.'; end if;
  perform private.refresh_public(p_game_id);
end;
$$;

revoke all on function public.heartbeat(uuid) from public, anon;
grant execute on function public.heartbeat(uuid) to authenticated;
