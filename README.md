# Veilfall

Text-first, clan-centric browser MMORPG. The current milestone is Vertical Slice A.

## Requirements

- Node.js 24+
- pnpm 11+
- Docker

## Start

```bash
pnpm install
docker compose up -d
pnpm dev
```

Web runs at `http://localhost:3000`; GraphQL API runs at `http://localhost:4000/graphql`.

## Database

```bash
pnpm --filter @veilfall/database db:generate
pnpm --filter @veilfall/database db:migrate
pnpm --filter @veilfall/database db:deploy
```

Local development reads the root `.env`. The first migration creates server-owned `users` and hashed `sessions`; plaintext passwords and session tokens are never persisted.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Product and architecture decisions live in `docs/`.
