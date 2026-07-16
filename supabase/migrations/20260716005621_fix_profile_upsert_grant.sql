-- PostgREST upserts include the conflict key in the update target list.
-- RLS still prevents a player from changing the id away from auth.uid().
grant update(id, screen_name) on table public.profiles to authenticated;
