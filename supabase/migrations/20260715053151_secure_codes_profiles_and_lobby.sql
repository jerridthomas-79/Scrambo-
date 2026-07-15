alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create or replace function private.normalize_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.screen_name := btrim(new.screen_name);
  if char_length(new.screen_name) not between 2 and 20 or new.screen_name ~ '[[:cntrl:]<>]' then
    raise exception 'Use a 2–20 character name without control or markup characters.';
  end if;
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists normalize_profile_before_write on public.profiles;
create trigger normalize_profile_before_write before insert or update on public.profiles for each row execute function private.normalize_profile();
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert(id, screen_name), update(screen_name) on public.profiles to authenticated;

create table private.join_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1
);
revoke all on private.join_attempts from public, anon, authenticated;

create or replace function private.check_join_rate(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempts integer;
begin
  insert into private.join_attempts(user_id) values(p_user_id)
  on conflict(user_id) do update set
    attempts = case when private.join_attempts.window_started_at < now()-interval '1 minute' then 1 else private.join_attempts.attempts+1 end,
    window_started_at = case when private.join_attempts.window_started_at < now()-interval '1 minute' then now() else private.join_attempts.window_started_at end
  returning attempts into v_attempts;
  if v_attempts > 20 then raise exception 'Too many room attempts. Wait a minute and try again.'; end if;
end;
$$;

create or replace function private.new_join_code()
returns text language sql volatile security definer set search_path = '' as $$
  select upper(substr(encoded,1,4)||'-'||substr(encoded,5,4))
  from (select encode(extensions.gen_random_bytes(4),'hex') encoded) generated
$$;

create or replace function public.create_game()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game_id uuid; v_code text; v_attempt integer:=0;
begin
  if not exists(select 1 from public.profiles where id=v_user) then raise exception 'Create a player name first.'; end if;
  if (select count(*) from public.game_players gp join public.games g on g.id=gp.game_id where gp.user_id=v_user and g.status in ('lobby','active')) >= 3 then
    raise exception 'Finish or leave an open game before creating another.';
  end if;
  loop
    v_code:=private.new_join_code();
    begin
      insert into public.games(join_code,host_user_id) values(v_code,v_user) returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempt:=v_attempt+1; if v_attempt>20 then raise exception 'Could not create a unique room code.'; end if;
    end;
  end loop;
  insert into public.game_players(game_id,user_id,seat) values(v_game_id,v_user,1);
  insert into public.game_public_state(game_id) values(v_game_id);
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(v_game_id,v_user,0,'CREATE_GAME','{}'::jsonb,0);
  perform private.refresh_public(v_game_id,jsonb_build_object('type','CREATE_GAME','actorUserId',v_user,'payload','{}'::jsonb));
  return public.get_game_view(v_game_id);
end;
$$;

create or replace function public.join_game(p_join_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game public.games%rowtype;
begin
  perform private.check_join_rate(v_user);
  if not exists(select 1 from public.profiles where id=v_user) then raise exception 'Create a player name first.'; end if;
  select * into v_game from public.games where join_code=upper(btrim(p_join_code)) for update;
  if not found then raise exception 'Room code not found.'; end if;
  if exists(select 1 from public.game_players where game_id=v_game.id and user_id=v_user) then return public.get_game_view(v_game.id); end if;
  if v_game.status<>'lobby' then raise exception 'That game has already started.'; end if;
  if (select count(*) from public.game_players where game_id=v_game.id)>=2 then raise exception 'That room is full.'; end if;
  insert into public.game_players(game_id,user_id,seat) values(v_game.id,v_user,2);
  update public.games set version=version+1 where id=v_game.id returning * into v_game;
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(v_game.id,v_user,0,'JOIN_GAME','{}'::jsonb,v_game.version);
  perform private.refresh_public(v_game.id,jsonb_build_object('type','JOIN_GAME','actorUserId',v_user,'payload','{}'::jsonb));
  return public.get_game_view(v_game.id);
end;
$$;

create or replace function public.set_ready(p_game_id uuid,p_is_ready boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game public.games%rowtype;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.status<>'lobby' then raise exception 'Ready status can change only in the lobby.'; end if;
  update public.game_players set is_ready=p_is_ready,last_seen_at=now() where game_id=p_game_id and user_id=v_user;
  if not found then raise exception 'You are not a player in this game.'; end if;
  update public.games set version=version+1 where id=p_game_id returning * into v_game;
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(p_game_id,v_user,0,'READY',jsonb_build_object('isReady',p_is_ready),v_game.version);
  perform private.refresh_public(p_game_id,jsonb_build_object('type','READY','actorUserId',v_user,'payload',jsonb_build_object('isReady',p_is_ready)));
  return public.get_game_view(p_game_id);
end;
$$;

alter function public.play_card(uuid,text,integer,text,integer,bigint) rename to play_card_internal;
revoke all on function public.play_card_internal(uuid,text,integer,text,integer,bigint) from public,anon,authenticated;
create or replace function public.play_card(p_game_id uuid,p_source_type text,p_source_index integer,p_card_id text,p_destination_build_index integer,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if p_expected_version is null then raise exception 'The game changed. Refresh and try again.'; end if;
  return public.play_card_internal(p_game_id,p_source_type,p_source_index,p_card_id,p_destination_build_index,p_expected_version);
end;
$$;

alter function public.discard_and_end_turn(uuid,text,integer,bigint) rename to discard_and_end_turn_internal;
revoke all on function public.discard_and_end_turn_internal(uuid,text,integer,bigint) from public,anon,authenticated;
create or replace function public.discard_and_end_turn(p_game_id uuid,p_hand_card_id text,p_discard_index integer,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.require_user();
  if p_expected_version is null then raise exception 'The game changed. Refresh and try again.'; end if;
  v_result:=public.discard_and_end_turn_internal(p_game_id,p_hand_card_id,p_discard_index,p_expected_version);
  update public.game_actions set turn_number=greatest(0,turn_number-1)
  where id=(select max(id) from public.game_actions where game_id=p_game_id and action_type='DISCARD_AND_END_TURN' and resulting_version=(v_result->>'version')::bigint);
  return v_result;
end;
$$;

create or replace function public.leave_lobby(p_game_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_user(); v_game public.games%rowtype;
begin
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.status<>'lobby' then raise exception 'You can leave only before the game starts.'; end if;
  if not exists(select 1 from public.game_players where game_id=p_game_id and user_id=v_user) then raise exception 'You are not a player in this lobby.'; end if;
  if v_game.host_user_id=v_user then
    update public.games set status='abandoned',ended_at=now(),end_reason='host_left_lobby',version=version+1 where id=p_game_id returning * into v_game;
    insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(p_game_id,v_user,0,'END_GAME',jsonb_build_object('mode','host_left_lobby'),v_game.version);
    perform private.refresh_public(p_game_id,jsonb_build_object('type','END_GAME','actorUserId',v_user,'payload',jsonb_build_object('mode','host_left_lobby')));
  else
    delete from public.game_players where game_id=p_game_id and user_id=v_user;
    update public.games set version=version+1 where id=p_game_id returning * into v_game;
    insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(p_game_id,v_user,0,'LEAVE_LOBBY','{}'::jsonb,v_game.version);
    perform private.refresh_public(p_game_id,jsonb_build_object('type','LEAVE_LOBBY','actorUserId',v_user,'payload','{}'::jsonb));
  end if;
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
    v_code:=private.new_join_code();
    begin
      insert into public.games(join_code,host_user_id) values(v_code,v_old.host_user_id) returning id into v_new;
      exit;
    exception when unique_violation then
      v_attempt:=v_attempt+1; if v_attempt>20 then raise exception 'Could not create a unique room code.'; end if;
    end;
  end loop;
  insert into public.game_players(game_id,user_id,seat) select v_new,user_id,seat from public.game_players where game_id=p_game_id;
  insert into public.game_public_state(game_id) values(v_new);
  update public.games set rematch_game_id=v_new,version=version+1 where id=p_game_id returning * into v_old;
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(v_new,v_user,0,'NEW_ROUND',jsonb_build_object('previousGameId',p_game_id),0);
  insert into public.game_actions(game_id,actor_user_id,turn_number,action_type,action_payload,resulting_version) values(p_game_id,v_user,v_old.turn_number,'NEW_ROUND',jsonb_build_object('rematchGameId',v_new),v_old.version);
  perform private.refresh_public(v_new,jsonb_build_object('type','NEW_ROUND','actorUserId',v_user,'payload',jsonb_build_object('previousGameId',p_game_id)));
  perform private.refresh_public(p_game_id,jsonb_build_object('type','NEW_ROUND','actorUserId',v_user,'payload',jsonb_build_object('rematchGameId',v_new)));
  return public.get_game_view(v_new);
end;
$$;

revoke all on function public.create_game(),public.join_game(text),public.set_ready(uuid,boolean),public.play_card(uuid,text,integer,text,integer,bigint),public.discard_and_end_turn(uuid,text,integer,bigint),public.leave_lobby(uuid),public.create_rematch(uuid) from public,anon;
grant execute on function public.create_game(),public.join_game(text),public.set_ready(uuid,boolean),public.play_card(uuid,text,integer,text,integer,bigint),public.discard_and_end_turn(uuid,text,integer,bigint),public.leave_lobby(uuid),public.create_rematch(uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_game_member(uuid) to authenticated;
