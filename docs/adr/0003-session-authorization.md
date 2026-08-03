# ADR 0003: Session and authorization strategy

**Status:** Accepted for foundation; implementation details remain reviewable

Browser authentication uses secure, HttpOnly, same-site cookies. Authorization is centralized and checks account, character ownership, domain permissions, and staff context server-side.

Staff authorization is separate from public player identity. `ROOT_OWNER` exists as the unrestricted owner role. No public GraphQL player profile exposes staff roles.
