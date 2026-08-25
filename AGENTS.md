# VeilFall agent guide

This file is the mandatory entry point for every human or AI model working in this repository. Repository state is authoritative; private chat memory is not.

## Required reading order

1. `README.md`
2. `AGENTS.md`
3. `implementation-status.md`
4. `docs/product-roadmap.md`
5. `docs/game-design-v0.2.md`
6. The relevant ADRs and source files for the requested system

If documentation and code disagree, inspect migrations and tests, identify which is current, and update the stale document in the same change. Never silently choose one.

## Status vocabulary

Use these terms consistently:

- **Implemented** — present in code/database, reachable, and covered by proportionate verification.
- **Foundation** — some domain/UI exists, but the approved loop is incomplete.
- **Approved / planned** — product direction is accepted but not implemented.
- **Deferred** — deliberately postponed; do not build it as an incidental extension.
- **Open decision** — examples or options exist, but no final mechanic or balance was approved.

A mockup is visual direction, not automatic approval of every control, number, label, item, or mechanic shown in it.

## Non-negotiable product principles

- VeilFall is a persistent, long-term game. Progression must create reasons to return without pretending that waiting alone is gameplay.
- Equipment is the main source of raw hero power. Hero Awakening expands knowledge, choices, and skills; it must not make equipment irrelevant.
- Expensive, months-long achievements must produce a visibly equivalent reward. Do not ship a nominal bonus for an extraordinary investment.
- Ordinary bosses guarantee progression resources/XP where specified, not an equipment item after every kill. Equipment uses explicit drop chances.
- Crafting is a core economic sink and discovery system, not a decorative conversion screen.
- UX must remain understandable and dense like a game dashboard. Factions share the same UX structure; palette, iconography, and wording may differ.
- Ukrainian is the current product language. Keep new player-facing copy in Ukrainian unless localization is part of the task.

## Architecture and invariants

- `apps/web`: Next.js App Router UI. Do not place authoritative game rules in the browser.
- `apps/api`: authenticated GraphQL boundary and orchestration.
- `packages/game-engine`: deterministic combat/domain calculations.
- `packages/database`: Prisma schema, migrations, and shared database client.
- Server owns combat, rewards, inventory mutations, crafting, progression, and permissions.
- Mutations that spend or grant value must be atomic and safe against duplicate requests.
- Preserve item-instance lineage and resource/economy ledger history.
- Prefer additive, reviewable migrations. Never rewrite applied migration history or destroy local/user data to make a migration pass.
- Test-only boosts must be explicit, local-only, ignored in production, and documented in `implementation-status.md`.
- Never commit `.env`, credentials, session tokens, or production data.

## Admin tooling

An admin interface is not currently implemented. Another model may build it on a separate branch, but it must obey all of these rules:

- every action is authorized on the server using roles (`PLAYER`, `SUPPORT`, `MODERATOR`, `ADMIN`, `ROOT_OWNER`);
- hiding UI is not authorization;
- ordinary players cannot call admin mutations directly;
- every value-changing action records actor, target, reason, before/after data, and timestamp;
- retries are idempotent and dangerous bulk actions require confirmation;
- admin work must not bypass normal ledger/item lineage rules.

## Multi-model workflow

Before editing:

1. Inspect the current branch, `git status`, recent commits, migrations, and relevant tests.
2. Preserve unrelated work. Never reset, overwrite, or reformat someone else's changes.
3. Define one bounded package of work and its acceptance criteria.

While editing:

- Keep feature, migration, tests, and documentation together.
- One model should own a migration sequence at a time. Coordinate before parallel schema edits.
- Do not invent missing balance as fact. Put it under **Open decisions** and use named configuration/constants if a temporary value is required.
- Do not implement a large adjacent system merely because the schema makes it convenient.

Before handoff:

1. Run the complete quality gate from `README.md` (or state exactly what could not run and why).
2. Update `implementation-status.md`; update the roadmap when a decision changed.
3. Summarize migrations, environment variables, local data preparation, known gaps, and the next safe package.
4. Commit/push only when the current task authorizes it. Never force-push shared work.

## Definition of done

A package is not complete until code, schema, tests, player-facing behavior, and repository documentation tell the same story.
