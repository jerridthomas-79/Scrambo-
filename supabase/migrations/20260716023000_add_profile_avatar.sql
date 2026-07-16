alter table public.profiles
  add column if not exists avatar text not null default '🦥';

update public.profiles
set avatar = '🦥'
where avatar is null or btrim(avatar) = '';

comment on column public.profiles.avatar is
  'Generic emoji/icon avatar selected by the player.';
