# VeilFall

VeilFall is a long-running, text-first browser MMORPG about exploration, equipment, crafting, clans, factions, and a world whose history is shaped by players. It is not designed as a game that can be completed in a day.

## Start here

The repository is the source of truth for humans and AI models. Before making changes, read:

1. [`AGENTS.md`](AGENTS.md) — engineering and collaboration rules.
2. [`implementation-status.md`](implementation-status.md) — what is actually implemented now.
3. [`docs/product-roadmap.md`](docs/product-roadmap.md) — approved direction, deferred systems, and open decisions.
4. [`docs/game-design-v0.2.md`](docs/game-design-v0.2.md) — original design baseline.
5. Relevant ADRs in [`docs/adr`](docs/adr).

Do not treat chat history, a mockup, or an old planning document as more authoritative than the current code and these documents. Every meaningful feature change must update `implementation-status.md` and, when it changes product direction, `docs/product-roadmap.md` in the same commit.

## Requirements

- Node.js 24+
- pnpm 11+
- Docker

## Start locally

```bash
pnpm install
docker compose up -d
pnpm --filter @veilfall/database db:deploy
pnpm dev
```

- Web: `http://localhost:3000`
- GraphQL API: `http://localhost:4000/graphql`

Local development reads the root `.env`; use `.env.example` as the template. Never commit `.env` or secrets.

## Database

```bash
pnpm --filter @veilfall/database db:generate
pnpm --filter @veilfall/database db:migrate
pnpm --filter @veilfall/database db:deploy
pnpm --filter @veilfall/database db:studio
```

## Quality gate

Run the complete gate before handing work to another model or pushing a feature:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
