# Scram-Bo

Scram-Bo is a mobile-first, two-player browser card game with an original patio-night identity. The React frontend is hosted by GitHub Pages; Supabase owns identity, hidden cards, rules, transactions, and realtime state.

The linked Supabase schema and authoritative game RPCs are applied and verified. The only dashboard step remaining is enabling anonymous sign-ins.

## Play

Production URL: `https://jerridthomas-79.github.io/Scrambo-/`

1. Open the site on two browsers and create a different screen name in each.
2. Player one creates a game and shares the room link or code.
3. Player two joins. Both players tap **I'm ready**.
4. The host taps **Shuffle & start**.

Anonymous sign-in must be enabled once in the Supabase dashboard. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Fill `.env.local` with the project URL and a publishable key. Never add a secret or service-role key to the browser.

## Commands

- `npm test` — unit/component tests
- `npm run typecheck` — strict TypeScript
- `npm run build` — production build
- `npm run test:e2e` — Playwright mobile/iPad smoke tests

## Implementation checklist

- [x] React 19, TypeScript strict mode, Vite, HashRouter
- [x] Original card/logo SVG assets and responsive patio-night UI
- [x] Anonymous identity, profiles, edit-name flow, persistent session
- [x] Two-player room codes, ready flow, resume, and presence heartbeat
- [x] Server-generated 162-card deck and randomized first player
- [x] Server-authoritative build, discard, refill, recycle, win, end, and rematch actions
- [x] Private/public/secret state separation with RLS
- [x] Expected-version concurrency protection and append-only action audit
- [x] Mobile tap interaction, legal-target hints, active-player glow, and reconnect
- [x] GitHub Pages workflow and lightweight PWA shell cache
- [x] Unit tests and live RPC verification queries
- [ ] Enable Anonymous Sign-Ins in Supabase Auth dashboard (dashboard-only switch)
- [ ] In GitHub repository Settings → Pages, select **GitHub Actions** if it is not already selected

## Security model

Clients can directly read only their own profile and game membership/public rows. Private state is restricted to its owner; secret state has no browser grants. All mutations are transactional RPCs that validate the caller, membership, turn, card source, destination, and expected game version.

Scram-Bo is an independent fan-made game and is not affiliated with or endorsed by Mattel.
