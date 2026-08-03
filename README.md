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

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Product and architecture decisions live in `docs/`.
