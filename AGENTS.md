# Nexa Arcade — Agent Instructions

## Overview
- **Domain:** getnexa.space
- **Stack:** Hono + TypeScript on Cloudflare Workers + D1 database + Durable Objects
- **Deploy:** Cloudflare Workers (wrangler deploy)
- **Package Manager:** npm
- **Description:** Gaming arcade platform — HTML5 games, multiplayer rooms, shop, tournaments, blog, leaderboards

## Key Commands
```bash
npm install
npm run dev             # Sync music assets + wrangler dev
npm run deploy          # Sync music assets + wrangler deploy
npm run db:init         # Initialize D1 schema (remote)
npm run db:init-local   # Initialize D1 schema (local)
npm run db:migrate      # Run migration-001 (remote)
npm run tail            # Stream live Worker logs
```

## Structure
- `src/` — Worker source (index.ts entry, game-room.ts Durable Object, payments.ts)
- `public/` — Static frontend assets (SPA mode via wrangler assets)
- `scripts/` — Build helpers (music sync)
- `migrations/` — D1 database migration files
- `schema.sql` — D1 database schema
- `wrangler.jsonc` — Worker configuration (bindings, routes, crons, assets)

## Cloudflare Bindings (from wrangler.jsonc)
- **D1 Database:** `DB` binding — `getnexa-db`
- **Durable Objects:** `GAME_ROOM` — `GameRoom` class (SQLite-backed)
- **Workers AI:** `AI` binding
- **Assets:** `ASSETS` binding — serves `./public` as SPA
- **Cron Triggers:** `0 * * * *` (hourly), `0 */8 * * *` (every 8 hours)
- **Custom Domains:** getnexa.space, www.getnexa.space
- **Smart Placement:** enabled

## Routing
- `/api/*` and `/*.html` and `/` — handled by Worker (run_worker_first)
- All other paths — served from static assets (SPA fallback)

## Constraints
- Deploy through Cloudflare Workers only (not Pages)
- Secrets from global.env, never hardcode — set via `wrangler secret put`
- No build step for the Worker itself — TypeScript compiled by wrangler
- D1 schema changes require migration files — never modify schema.sql for live DB
- Durable Objects require migration tags in wrangler.jsonc for new classes
- `nodejs_compat` flag enabled — Node.js APIs available
- Static assets auto-deploy from `public/` directory
- Music assets synced via `scripts/sync-music.js` before dev/deploy
