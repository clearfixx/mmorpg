# ADR 0005: Deterministic combat state

**Status:** Accepted

Combat rules are pure functions in `@veilfall/game-engine`. Randomness is injected through `RandomSource`. Persisted battle state includes a version and reproducible random state or seed.

Each command validates the expected battle version and resolves at most once. Active battles use content snapshots so later balance changes do not alter an encounter already in progress.
