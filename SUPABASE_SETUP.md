# Supabase setup

The linked Supabase project is `Scrambo` (`acmtawptpngrxhxvxevp`) in `ca-central-1`.

## One-time dashboard setting

Open **Authentication → Providers → Anonymous Sign-Ins** and enable anonymous sign-ins. Scram-Bo creates a durable anonymous user per browser, then protects all game rows with that user's ID.

## Database

The committed migrations under `supabase/migrations` create:

- profiles, games, game players, public state, private player state, backend-only secret state, and action log
- RLS and explicit PostgREST grants for the 2026 Data API exposure defaults
- transactional RPCs for every game mutation
- Realtime publication entries for public game changes

The migrations have been applied to the linked project. For a separate project, use the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Frontend values

Only these public values belong in the Vite build:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Publishable keys identify a public client and are safe to include in a web build. Never use `sb_secret_...` or the legacy `service_role` key in this project.

## Realtime

The app subscribes to RLS-filtered Postgres changes on `games` and `game_public_state`, then calls `get_game_view` to replace local state with the authoritative view. Presence is cosmetic; the heartbeat RPC updates connection timestamps.

## Verification

After changes, run Supabase Security and Performance Advisors and verify:

- browser roles have no direct update privileges on state tables
- a player can select only their own private-state row
- `game_secret_state` is not accessible to browser roles
- all RPCs reject unauthenticated callers
- stale `expected_version` calls fail
