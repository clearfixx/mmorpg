# ADR 0001: Monorepo boundaries

**Status:** Accepted

Use pnpm workspaces and Turborepo. Runtime applications live in `apps/web`, `apps/api`, and later `apps/worker`. Reusable game rules, contracts, persistence, UI, configuration, and testing helpers live in `packages/`.

The initial deployment is modular, while domain boundaries remain suitable for later microservice extraction. Applications may depend on packages; core packages must not depend on applications.
