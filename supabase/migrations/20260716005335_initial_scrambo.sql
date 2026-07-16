create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  screen_name text not null check (char_length(btrim(screen_name)) between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text unique not null,
  host_user_id uuid not null references auth.users(id),
  status text not null default 'lobby' check (status in ('lobby','active','completed','ended','abandoned')),
  active_player_id uuid references auth.users(id),
  winner_user_id uuid references auth.users(id),
  turn_number integer not null default 0,
  version bigint not null default 0,
  rematch_game_id uuid references public.games(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text
);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);

create table public.game_public_state (
  game_id uuid primary key references public.games(id) on delete cascade,
  build_piles jsonb not null default '[[],[],[],[]]'::jsonb,
  player_summaries jsonb not null default '[]'::jsonb,
  draw_count integer not null default 0,
  completed_pile_count integer not null default 0,
  last_action jsonb,
  updated_at timestamptz not null default now()
);

create table public.game_private_player_state (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hand jsonb not null default '[]'::jsonb,
  stock_pile jsonb not null default '[]'::jsonb,
  discard_piles jsonb not null default '[[],[],[],[]]'::jsonb,
  primary key (game_id, user_id)
);

create table public.game_secret_state (
  game_id uuid primary key references public.games(id) on delete cascade,
  draw_pile jsonb not null default '[]'::jsonb,
  recycle_pile jsonb not null default '[]'::jsonb,
  rng_seed text
);

create table public.game_actions (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  turn_number integer not null,
  action_type text not null,
  action_payload jsonb not null default '{}'::jsonb,
  resulting_version bigint not null,
  created_at timestamptz not null default now()
);

create index game_players_user_idx on public.game_players(user_id, game_id);
create index game_actions_game_idx on public.game_actions(game_id, id desc);
create index games_join_code_lobby_idx on public.games(join_code) where status = 'lobby';

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_public_state enable row level security;
alter table public.game_private_player_state enable row level security;
alter table public.game_secret_state enable row level security;
alter table public.game_actions enable row level security;

create or replace function private.is_game_member(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.game_players where game_id = p_game_id and user_id = auth.uid()
  )
$$;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy games_select_member on public.games for select to authenticated using (private.is_game_member(id));
create policy players_select_member on public.game_players for select to authenticated using (private.is_game_member(game_id));
create policy public_state_select_member on public.game_public_state for select to authenticated using (private.is_game_member(game_id));
create policy private_state_select_own on public.game_private_player_state for select to authenticated using (user_id = (select auth.uid()));
create policy actions_select_member on public.game_actions for select to authenticated using (private.is_game_member(game_id));

revoke all on public.profiles, public.games, public.game_players, public.game_public_state, public.game_private_player_state, public.game_secret_state, public.game_actions from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.games, public.game_players, public.game_public_state to authenticated;

create or replace function private.require_user()
returns uuid language plpgsql stable security invoker set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using errcode = '28000', message = 'Sign in is required.'; end if;
  return v_user;
end;
$$;

create or replace function private.visible_discards(p_piles jsonb)
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'count', jsonb_array_length(pile),
    'top', case when jsonb_array_length(pile) = 0 then null else pile -> (jsonb_array_length(pile) - 1) end
  ) order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_piles, '[[],[],[],[]]'::jsonb)) with ordinality as p(pile, ord)
$$;

create or replace function private.draw_to_five(p_game_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_hand jsonb;
  v_draw jsonb;
  v_recycle jsonb;
  v_card jsonb;
begin
  select hand into v_hand from public.game_private_player_state where game_id = p_game_id and user_id = p_user_id for update;
  select draw_pile, recycle_pile into v_draw, v_recycle from public.game_secret_state where game_id = p_game_id for update;
  while jsonb_array_length(v_hand) < 5 loop
    if jsonb_array_length(v_draw) = 0 and jsonb_array_length(v_recycle) > 0 then
      select coalesce(jsonb_agg(value order by gen_random_uuid()), '[]'::jsonb) into v_draw from jsonb_array_elements(v_recycle);
      v_recycle := '[]'::jsonb;
    end if;
    exit when jsonb_array_length(v_draw) = 0;
    v_card := v_draw -> 0;
    v_draw := v_draw - 0;
    v_hand := v_hand || jsonb_build_array(v_card);
  end loop;
  update public.game_private_player_state set hand = v_hand where game_id = p_game_id and user_id = p_user_id;
  update public.game_secret_state set draw_pile = v_draw, recycle_pile = v_recycle where game_id = p_game_id;
end;
$$;

create or replace function private.refresh_public(p_game_id uuid, p_last_action jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_summaries jsonb; v_draw_count integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', gp.user_id,
    'screenName', pr.screen_name,
    'seat', gp.seat,
    'isReady', gp.is_ready,
    'isConnected', gp.last_seen_at > now() - interval '70 seconds',
    'handCount', coalesce(jsonb_array_length(ps.hand), 0),
    'stockCount', coalesce(jsonb_array_length(ps.stock_pile), 0),
    'stockTop', case when ps.stock_pile is null or jsonb_array_length(ps.stock_pile) = 0 then null else ps.stock_pile -> 0 end,
    'discardPiles', private.visible_discards(ps.discard_piles)
  ) order by gp.seat), '[]'::jsonb) into v_summaries
  from public.game_players gp
  join public.profiles pr on pr.id = gp.user_id
  left join public.game_private_player_state ps on ps.game_id = gp.game_id and ps.user_id = gp.user_id
  where gp.game_id = p_game_id;
  select coalesce(jsonb_array_length(draw_pile), 0) into v_draw_count from public.game_secret_state where game_id = p_game_id;
  update public.game_public_state set
    player_summaries = v_summaries,
    draw_count = coalesce(v_draw_count, 0),
    last_action = coalesce(p_last_action, last_action),
    updated_at = now()
  where game_id = p_game_id;
end;
$$;

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

create or replace function public.create_game()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_game_id uuid; v_code text; v_attempt integer := 0;
begin
  if not exists (select 1 from public.profiles where id = v_user) then raise exception 'Create a player name first.'; end if;
  loop
    v_code := (array['EMBER','MOOSE','NIGHT','DECK','PATIO','FIRES','SHUFFL'])[1 + floor(random() * 7)::integer] || '-' || (10 + floor(random() * 90)::integer)::text;
    exit when not exists (select 1 from public.games where join_code = v_code and status in ('lobby','active'));
    v_attempt := v_attempt + 1; if v_attempt > 20 then raise exception 'Could not create a unique room code.'; end if;
  end loop;
  insert into public.games(join_code, host_user_id) values (v_code, v_user) returning id into v_game_id;
  insert into public.game_players(game_id, user_id, seat) values (v_game_id, v_user, 1);
  insert into public.game_public_state(game_id) values (v_game_id);
  perform private.refresh_public(v_game_id, jsonb_build_object('type','CREATE_GAME','actorUserId',v_user,'payload','{}'::jsonb));
  return public.get_game_view(v_game_id);
end;
$$;

create or replace function public.join_game(p_join_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_game public.games%rowtype;
begin
  if not exists (select 1 from public.profiles where id = v_user) then raise exception 'Create a player name first.'; end if;
  select * into v_game from public.games where join_code = upper(btrim(p_join_code)) for update;
  if not found then raise exception 'Room code not found.'; end if;
  if exists (select 1 from public.game_players where game_id = v_game.id and user_id = v_user) then return public.get_game_view(v_game.id); end if;
  if v_game.status <> 'lobby' then raise exception 'That game has already started.'; end if;
  if (select count(*) from public.game_players where game_id = v_game.id) >= 2 then raise exception 'That room is full.'; end if;
  insert into public.game_players(game_id, user_id, seat) values (v_game.id, v_user, 2);
  perform private.refresh_public(v_game.id, jsonb_build_object('type','JOIN_GAME','actorUserId',v_user,'payload','{}'::jsonb));
  return public.get_game_view(v_game.id);
end;
$$;

create or replace function public.set_ready(p_game_id uuid, p_is_ready boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_game public.games%rowtype;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.status <> 'lobby' then raise exception 'Ready status can change only in the lobby.'; end if;
  update public.game_players set is_ready = p_is_ready, last_seen_at = now() where game_id = p_game_id and user_id = v_user;
  if not found then raise exception 'You are not a player in this game.'; end if;
  perform private.refresh_public(p_game_id, jsonb_build_object('type','READY','actorUserId',v_user,'payload',jsonb_build_object('isReady',p_is_ready)));
  return public.get_game_view(p_game_id);
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

create or replace function public.play_card(p_game_id uuid, p_source_type text, p_source_index integer, p_card_id text, p_destination_build_index integer, p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user(); v_game public.games%rowtype; v_state public.game_private_player_state%rowtype; v_public public.game_public_state%rowtype;
  v_card jsonb; v_card_index integer; v_source_pile jsonb; v_build jsonb; v_needed integer; v_rank text; v_completed boolean := false; v_recycled jsonb;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.status <> 'active' then raise exception 'The game is not active.'; end if;
  if v_game.active_player_id <> v_user then raise exception 'It is not your turn.'; end if;
  if v_game.version <> p_expected_version then raise exception 'The game changed. Refresh and try again.'; end if;
  if p_destination_build_index not between 0 and 3 then raise exception 'Choose a valid building pile.'; end if;
  select * into v_state from public.game_private_player_state where game_id=p_game_id and user_id=v_user for update;
  select * into v_public from public.game_public_state where game_id=p_game_id for update;
  if p_source_type = 'hand' then
    select value, (ordinality-1)::integer into v_card,v_card_index from jsonb_array_elements(v_state.hand) with ordinality where value->>'id'=p_card_id limit 1;
    if v_card is null then raise exception 'That card is no longer in your hand.'; end if;
    v_state.hand := v_state.hand - v_card_index;
  elsif p_source_type = 'stock' then
    v_card := v_state.stock_pile->0;
    if v_card is null or v_card->>'id' <> p_card_id then raise exception 'Only the top stockpile card can be played.'; end if;
    v_state.stock_pile := v_state.stock_pile - 0;
  elsif p_source_type = 'discard' then
    if p_source_index not between 0 and 3 then raise exception 'Choose a valid discard pile.'; end if;
    v_source_pile := v_state.discard_piles->p_source_index;
    if jsonb_array_length(v_source_pile)=0 then raise exception 'That discard pile is empty.'; end if;
    v_card_index := jsonb_array_length(v_source_pile)-1; v_card := v_source_pile->v_card_index;
    if v_card->>'id' <> p_card_id then raise exception 'Only the top discard card can be played.'; end if;
    v_state.discard_piles := jsonb_set(v_state.discard_piles,array[p_source_index::text],v_source_pile-v_card_index);
  else raise exception 'Unknown card source.';
  end if;
  v_build := v_public.build_piles->p_destination_build_index;
  v_needed := jsonb_array_length(v_build)+1; v_rank := v_card->>'rank';
  if v_needed > 12 or (v_rank <> 'WILD' and v_rank::integer <> v_needed) then raise exception 'That pile needs a %.',v_needed; end if;
  v_build := v_build || jsonb_build_array(jsonb_build_object('cardId',v_card->>'id','printedRank',v_card->'rank','resolvedRank',v_needed));
  if v_needed=12 then
    select coalesce(jsonb_agg(jsonb_build_object('id',value->>'cardId','rank',value->'printedRank')),'[]'::jsonb) into v_recycled from jsonb_array_elements(v_build);
    update public.game_secret_state set recycle_pile=recycle_pile||v_recycled where game_id=p_game_id;
    v_build:='[]'::jsonb; v_completed:=true;
  end if;
  update public.game_private_player_state set hand=v_state.hand,stock_pile=v_state.stock_pile,discard_piles=v_state.discard_piles where game_id=p_game_id and user_id=v_user;
  update public.game_public_state set build_piles=jsonb_set(build_piles,array[p_destination_build_index::text],v_build),completed_pile_count=completed_pile_count+case when v_completed then 1 else 0 end where game_id=p_game_id;
  if p_source_type='stock' and jsonb_array_length(v_state.stock_pile)=0 then
    update public.games set status='completed',winner_user_id=v_user,active_player_id=null,ended_at=now(),end_reason='stockpile_empty',version=version+1 where id=p_game_id returning * into v_game;
  else
    if p_source_type='hand' and jsonb_array_length(v_state.hand)=0 then perform private.draw_to_five(p_game_id,v_user); end if;
    update public.games set version=version+1 where id=p_game_id returning * into v_game;
  end if;
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values (p_game_id,v_user,v_game.turn_number,'PLAY_CARD',jsonb_build_object('sourceType',p_source_type,'sourceIndex',p_source_index,'destinationBuildIndex',p_destination_build_index,'card',jsonb_build_object('cardId',v_card->>'id','printedRank',v_card->'rank','resolvedRank',v_needed),'completedPile',v_completed),v_game.version);
  perform private.refresh_public(p_game_id,jsonb_build_object('type','PLAY_CARD','actorUserId',v_user,'payload',jsonb_build_object('sourceType',p_source_type,'destinationBuildIndex',p_destination_build_index,'card',jsonb_build_object('cardId',v_card->>'id','printedRank',v_card->'rank','resolvedRank',v_needed),'completedPile',v_completed)));
  return public.get_game_view(p_game_id);
end;
$$;

create or replace function public.discard_and_end_turn(p_game_id uuid,p_hand_card_id text,p_discard_index integer,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game public.games%rowtype; v_state public.game_private_player_state%rowtype; v_card jsonb; v_idx integer; v_pile jsonb; v_next uuid;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.status<>'active' then raise exception 'The game is not active.'; end if;
  if v_game.active_player_id<>v_user then raise exception 'It is not your turn.'; end if;
  if v_game.version<>p_expected_version then raise exception 'The game changed. Refresh and try again.'; end if;
  if p_discard_index not between 0 and 3 then raise exception 'Choose a valid discard pile.'; end if;
  select * into v_state from public.game_private_player_state where game_id=p_game_id and user_id=v_user for update;
  select value,(ordinality-1)::integer into v_card,v_idx from jsonb_array_elements(v_state.hand) with ordinality where value->>'id'=p_hand_card_id limit 1;
  if v_card is null then raise exception 'That card is no longer in your hand.'; end if;
  v_state.hand:=v_state.hand-v_idx; v_pile:=v_state.discard_piles->p_discard_index; v_pile:=v_pile||jsonb_build_array(v_card);
  v_state.discard_piles:=jsonb_set(v_state.discard_piles,array[p_discard_index::text],v_pile);
  update public.game_private_player_state set hand=v_state.hand,discard_piles=v_state.discard_piles where game_id=p_game_id and user_id=v_user;
  select user_id into v_next from public.game_players where game_id=p_game_id and user_id<>v_user;
  update public.games set active_player_id=v_next,turn_number=turn_number+1,version=version+1 where id=p_game_id returning * into v_game;
  perform private.draw_to_five(p_game_id,v_next);
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values (p_game_id,v_user,v_game.turn_number,'DISCARD_AND_END_TURN',jsonb_build_object('discardIndex',p_discard_index,'cardId',p_hand_card_id,'nextPlayerId',v_next),v_game.version);
  perform private.refresh_public(p_game_id,jsonb_build_object('type','DISCARD_AND_END_TURN','actorUserId',v_user,'payload',jsonb_build_object('discardIndex',p_discard_index,'nextPlayerId',v_next)));
  return public.get_game_view(p_game_id);
end;
$$;

create or replace function public.end_game(p_game_id uuid,p_end_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game public.games%rowtype; v_winner uuid;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if not exists(select 1 from public.game_players where game_id=p_game_id and user_id=v_user) then raise exception 'You are not a player in this game.'; end if;
  if v_game.status<>'active' then raise exception 'The game is not active.'; end if;
  if p_end_mode='no_winner' then
    if v_game.host_user_id<>v_user then raise exception 'Only the host can end without a winner.'; end if;
  elsif p_end_mode='forfeit' then select user_id into v_winner from public.game_players where game_id=p_game_id and user_id<>v_user;
  else raise exception 'Choose a valid end-game option.'; end if;
  update public.games set status='ended',active_player_id=null,winner_user_id=v_winner,ended_at=now(),end_reason=case when p_end_mode='forfeit' then 'forfeit' else 'ended_without_winner' end,version=version+1 where id=p_game_id returning * into v_game;
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values (p_game_id,v_user,v_game.turn_number,case when p_end_mode='forfeit' then 'FORFEIT' else 'END_GAME' end,jsonb_build_object('mode',p_end_mode),v_game.version);
  perform private.refresh_public(p_game_id,jsonb_build_object('type','END_GAME','actorUserId',v_user,'payload',jsonb_build_object('mode',p_end_mode)));
  return public.get_game_view(p_game_id);
end;
$$;

create or replace function public.create_rematch(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_old public.games%rowtype; v_new uuid; v_code text; v_attempt integer:=0;
begin
  select * into v_old from public.games where id=p_game_id for update;
  if v_old.host_user_id<>v_user then raise exception 'Only the host can create a rematch.'; end if;
  if v_old.status not in ('completed','ended') then raise exception 'Finish the current game first.'; end if;
  if v_old.rematch_game_id is not null then return public.get_game_view(v_old.rematch_game_id); end if;
  loop
    v_code := (array['EMBER','MOOSE','NIGHT','DECK','PATIO','FIRES','SHUFFL'])[1+floor(random()*7)::integer]||'-'||(10+floor(random()*90)::integer)::text;
    exit when not exists(select 1 from public.games where join_code=v_code and status in ('lobby','active'));
    v_attempt:=v_attempt+1; if v_attempt>20 then raise exception 'Could not create a unique room code.'; end if;
  end loop;
  insert into public.games(join_code,host_user_id) values(v_code,v_old.host_user_id) returning id into v_new;
  insert into public.game_players(game_id,user_id,seat) select v_new,user_id,seat from public.game_players where game_id=p_game_id;
  insert into public.game_public_state(game_id) values(v_new);
  update public.games set rematch_game_id=v_new,version=version+1 where id=p_game_id;
  perform private.refresh_public(v_new,jsonb_build_object('type','NEW_ROUND','actorUserId',v_user,'payload',jsonb_build_object('previousGameId',p_game_id)));
  perform private.refresh_public(p_game_id,jsonb_build_object('type','NEW_ROUND','actorUserId',v_user,'payload',jsonb_build_object('rematchGameId',v_new)));
  return public.get_game_view(v_new);
end;
$$;

create or replace function public.heartbeat(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user();
begin
  update public.game_players set last_seen_at=now(),is_connected=true where game_id=p_game_id and user_id=v_user;
  if not found then raise exception 'You are not a player in this game.'; end if;
end;
$$;

revoke all on function public.get_game_view(uuid),public.create_game(),public.join_game(text),public.set_ready(uuid,boolean),public.start_game(uuid),public.play_card(uuid,text,integer,text,integer,bigint),public.discard_and_end_turn(uuid,text,integer,bigint),public.end_game(uuid,text),public.create_rematch(uuid),public.heartbeat(uuid) from public,anon;
grant execute on function public.get_game_view(uuid),public.create_game(),public.join_game(text),public.set_ready(uuid,boolean),public.start_game(uuid),public.play_card(uuid,text,integer,text,integer,bigint),public.discard_and_end_turn(uuid,text,integer,bigint),public.end_game(uuid,text),public.create_rematch(uuid),public.heartbeat(uuid) to authenticated;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_game_member(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.game_public_state;
exception when duplicate_object then null; end $$;
