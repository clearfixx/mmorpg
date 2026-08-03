# ADR 0002: GraphQL code-first API

**Status:** Accepted

NestJS GraphQL uses the code-first approach with generated schema output. Resolvers map GraphQL operations to explicit application commands and queries. They contain no game rules and expose no generic character-state mutation.

Subscriptions are added only for justified real-time features. Vertical Slice A uses queries and mutations.
