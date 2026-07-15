create or replace function private.is_game_member(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.game_players where game_id = p_game_id and user_id = auth.uid()
  )
$$;

drop policy if exists games_select_member on public.games;
drop policy if exists players_select_member on public.game_players;
drop policy if exists public_state_select_member on public.game_public_state;
drop policy if exists actions_select_member on public.game_actions;
create policy games_select_member on public.games for select to authenticated using (private.is_game_member(id));
create policy players_select_member on public.game_players for select to authenticated using (private.is_game_member(game_id));
create policy public_state_select_member on public.game_public_state for select to authenticated using (private.is_game_member(game_id));
create policy actions_select_member on public.game_actions for select to authenticated using (private.is_game_member(game_id));

create or replace function public.get_game_view(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_game public.games%rowtype;
  v_public public.game_public_state%rowtype;
  v_me jsonb;
  v_opponent jsonb;
  v_my_hand jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_user) then
    raise exception using errcode = '42501', message = 'You are not a player in this game.';
  end if;
  select * into strict v_game from public.games where id = p_game_id;
  select * into strict v_public from public.game_public_state where game_id = p_game_id;
  select coalesce((select hand from public.game_private_player_state where game_id = p_game_id and user_id = v_user), '[]'::jsonb) into v_my_hand;
  select value || jsonb_build_object('hand', v_my_hand) into v_me from jsonb_array_elements(v_public.player_summaries) where value->>'userId' = v_user::text;
  select value - 'hand' into v_opponent from jsonb_array_elements(v_public.player_summaries) where value->>'userId' <> v_user::text limit 1;
  return jsonb_build_object(
    'gameId', v_game.id, 'joinCode', v_game.join_code, 'status', v_game.status,
    'hostUserId', v_game.host_user_id, 'version', v_game.version, 'turnNumber', v_game.turn_number,
    'activePlayerId', v_game.active_player_id, 'winnerUserId', v_game.winner_user_id,
    'endReason', v_game.end_reason, 'rematchGameId', v_game.rematch_game_id,
    'me', v_me, 'opponent', v_opponent,
    'shared', jsonb_build_object('drawCount', v_public.draw_count, 'completedCount', v_public.completed_pile_count, 'buildPiles', v_public.build_piles),
    'lastAction', v_public.last_action
  );
end;
$$;

create or replace function public.start_game(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user(); v_game public.games%rowtype; v_players uuid[];
  v_deck jsonb; v_stock1 jsonb; v_stock2 jsonb; v_draw jsonb; v_starter uuid;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.host_user_id <> v_user then raise exception 'Only the host can start the game.'; end if;
  if v_game.status <> 'lobby' then raise exception 'This game is not in the lobby.'; end if;
  select array_agg(user_id order by seat) into v_players from public.game_players where game_id = p_game_id;
  if array_length(v_players,1) <> 2 or exists (select 1 from public.game_players where game_id=p_game_id and not is_ready) then raise exception 'Both players must be ready.'; end if;
  with cards as (
    select jsonb_build_object('id',gen_random_uuid()::text,'rank',rank) card from generate_series(1,12) as r(rank), generate_series(1,12) as c(copy)
    union all select jsonb_build_object('id',gen_random_uuid()::text,'rank','WILD') from generate_series(1,18)
  ) select jsonb_agg(card order by gen_random_uuid()) into v_deck from cards;
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_stock1 from jsonb_array_elements(v_deck) with ordinality where ordinality between 1 and 30;
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_stock2 from jsonb_array_elements(v_deck) with ordinality where ordinality between 31 and 60;
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_draw from jsonb_array_elements(v_deck) with ordinality where ordinality > 60;
  insert into public.game_private_player_state(game_id,user_id,stock_pile) values
    (p_game_id,v_players[1],v_stock1),(p_game_id,v_players[2],v_stock2)
    on conflict (game_id,user_id) do update set hand='[]'::jsonb,stock_pile=excluded.stock_pile,discard_piles='[[],[],[],[]]'::jsonb;
  insert into public.game_secret_state(game_id,draw_pile,recycle_pile,rng_seed) values (p_game_id,v_draw,'[]'::jsonb,gen_random_uuid()::text)
    on conflict (game_id) do update set draw_pile=excluded.draw_pile,recycle_pile='[]'::jsonb,rng_seed=excluded.rng_seed;
  v_starter := v_players[1 + floor(random()*2)::integer];
  update public.games set status='active',active_player_id=v_starter,turn_number=1,version=version+1,started_at=now(),ended_at=null,end_reason=null,winner_user_id=null where id=p_game_id returning * into v_game;
  update public.game_public_state set build_piles='[[],[],[],[]]'::jsonb,completed_pile_count=0 where game_id=p_game_id;
  perform private.draw_to_five(p_game_id,v_starter);
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values (p_game_id,v_user,1,'START_GAME',jsonb_build_object('starterUserId',v_starter),v_game.version);
  perform private.refresh_public(p_game_id,jsonb_build_object('type','START_GAME','actorUserId',v_user,'payload',jsonb_build_object('starterUserId',v_starter)));
  return public.get_game_view(p_game_id);
end;
$$;

revoke all on function private.is_game_member(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_game_member(uuid) to authenticated;
