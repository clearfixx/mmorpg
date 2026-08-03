# ADR 0004: Prisma persistence boundaries

**Status:** Accepted

Prisma is isolated in `@veilfall/database` and repository adapters. Controllers, resolvers, React components, and `game-engine` do not import Prisma models.

Cross-domain behavior goes through application services or narrow capabilities. Transaction ownership belongs to the application command coordinating the valuable state change.
