# WattHunter

A cycling fantasy game for friend groups. Players build virtual teams by bidding on real professional riders at auction, earn XP from actual [ProCyclingStats](https://www.procyclingstats.com) race results, and compete inside their league across the World Tour season.

The twist: a bid is not a one-off purchase. It sets a **recurring monthly salary** you keep paying out of a limited treasury. Signing a superstar is easy; affording him in three phases is the game.

> **Status: alpha.** Private playtest, no public signup. The schema moves fast and migrations are not guaranteed backward-compatible.

## Stack

- **Web**: Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4, Shadcn UI
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions), business logic in SQL RPCs
- **Data pipeline**: Python 3.12 CLI scraping ProCyclingStats
- **Tooling**: Turborepo, pnpm workspaces, Vitest, Playwright

## Repository layout

| Path | What it holds |
|------|---------------|
| `apps/web` | Next.js front end and server actions |
| `services/pcs-sync` | Python pipeline: rider sync, race results, scoring |
| `supabase/migrations` | Full schema history, RLS policies, RPCs |
| `docs` | Game rules, architecture, design system |

## Local setup

Requires Node 20+, pnpm 10, Python 3.12, Docker (via Colima on macOS), and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Start the local Supabase stack and apply every migration from scratch:

```bash
supabase start
supabase db reset
```

Fill `apps/web/.env.local` with the URL and keys printed by `supabase start`, then:

```bash
pnpm dev
```

The data pipeline is optional and has its own env file:

```bash
cp services/pcs-sync/.env.example services/pcs-sync/.env
```

## Commands

| Command | Does |
|---------|------|
| `pnpm dev` | Run every app in dev mode |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint across all packages |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Vitest suite |

## Documentation

- [`docs/GAME_RULES.md`](docs/GAME_RULES.md) — complete rules and game constants
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — routes, server actions, RPCs, tables
- [`docs/watthunter-design-system-v3.md`](docs/watthunter-design-system-v3.md) — design system

## A note on data

Rider and race data comes from procyclingstats.com. The scrapers run **locally only** (Cloudflare blocks datacenter IPs) and no scraped dataset is redistributed in this repository. If you run the pipeline, respect PCS's terms and the built-in rate limits.

## License

MIT, see [LICENSE](LICENSE). The "WattHunter" name and the artwork under `apps/web/public/` and `watthunter-icons/` are not part of the trademark grant.
