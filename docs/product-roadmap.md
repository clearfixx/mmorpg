# VeilFall — product decisions and roadmap

This document consolidates approved direction from design discussions. `implementation-status.md` says what exists today; this document says what VeilFall is becoming. Examples are not final balance unless explicitly marked.

## Product pillars

- A persistent game measured in months and years, not a one-day content run.
- Equipment, crafting, discovery, clans, factions, and world history reinforce one another.
- Long effort receives a transformative, visible reward.
- New players receive meaningful milestones; top players receive difficult aspirational layers without farming beginners.
- Time gates create anticipation but must coexist with active play and parallel progress.

## Approved direction

### Loot, item power, and rarity

Ordinary bosses do not award equipment every time. Resources, XP, and progression points may be guaranteed; swords, helmets, and other equipment use explicit random chances.

Items have levels from 1 to 99 and rarity-specific power bands. At the same item level, the minimum primary roll of a higher rarity must exceed the maximum primary roll of the preceding rarity. A low-level higher-rarity item is not required to outperform a high-level lower-rarity item; otherwise item level would lose its purpose. Equipment remains the primary source of raw combat power.

### Hero Awakening versus item transformation

The two systems require different names and purposes:

- **Hero Awakening**: a large knowledge/science/skill tree with combat choices, recipe discovery, exploration abilities, and economic passives such as a restrained daily “Greed” yield.
- **Item transformation** (final name open): an extremely expensive qualitative improvement to a specific item. Its reward must be powerful enough to justify months of discovery and gathering; a token percentage increase is unacceptable.

### Resource taxonomy and crafting

Resources have rarity and one of three origins:

1. battle-found (iron, copper, plants, etc.);
2. crafted-only from known recipes (example: iron + catalyst → titanium);
3. boss-exclusive and unavailable from ordinary levels or basic conversion.

Crafting recipes may require 1–7 distinct ingredients in different quantities. The simple “base + property + catalyst” pattern fits some equipment but is not a universal formula. Players can run other crafts while a long job (even a many-day ritual) is in progress. Acceleration may consume precious resources.

Known standard recipes belong in an in-game formula book/wiki. Better recipes are discovered through clues, NPCs, experimentation, lore, and rare content. Globally limited recipes may become claimed by the first discoverer, create a unique frame/title and world-chronicle event, and remain usable only by that player. The exact failure/ingredient-consumption UX for another player attempting a claimed formula is an open safety and fairness decision.

### Rare NPC and invocation chain

From level 30, a suitably developed hero can meet a rare, strong NPC. The first qualifying meeting per weekly cycle is guaranteed; up to four more use diminishing probability. Victory grants an invocation seal with 100% certainty.

Seals persist indefinitely and are intended to become transferable/tradeable. Players may accumulate them, sell them, give them to clans, or use them as an emergent high-value exchange good. Level and difficulty requirements are deliberate friction against cheap alternate-account farming.

An invocation begins a branching chain of 4–5 increasingly difficult bosses. A boss gives exclusive resources and the input for the next stage. Some seals can eventually be recrafted to change the invoked lineage—for example Cursed Knight, Fallen Elf, or Dark Priest—with a corresponding reward family. The final bosses are top-player content. The current code implements the first two stages only.

### Campaign and lore

The game needs a real protagonist context, places, causes of war, and a campaign rather than disconnected combat. The campaign teaches battle, equipment, growth, crafting, and cooperation. Temporary NPC companions should demonstrate that group strength matters. Dialogue scenes and basic rewards support the tutorial rather than replace gameplay.

### Cinderhaven

Cinderhaven (Попелястий Прихисток) is the first major neutral or semi-neutral city and the player's early/mid-game home base: fortified, worn by war, rebuilt by refugees, mercenaries, craftsmen, clans, and mutually dependent factions.

Core districts: Hall of Tempering, Armory, Workshop, War Council, Clan Courtyard, and future Trading Rows. Tavern, archive, gates, named NPCs, city events, and changing faction presence are natural extensions. It is a refuge, not a pristine imperial capital.

### Factions and world war

Factions share the same UX and information architecture; only palette, icons, labels, and small thematic details differ. Registration may allow choice or auto-balance toward the smaller faction. A player may change sides at most once; constant switching is blocked.

The first world war is a scripted simulation among NPC forces, not 200 fully simulated combatants. Scripts move the front so neither side permanently wins by itself. Living players fight actual enemies and influence location capture. Real opposing players may later appear in contested locations. War zones are level-bracketed so stronger heroes compete for stronger rewards without farming beginners.

Lobby and world map show faction influence, controlled locations, active conflict, routes, events, and chronicle entries. The supplied map mockup is the long-term visual reference, not a demand for immediate painted assets.

### Lobby and communication

The lobby is a dashboard: news/chronicle, chat, activity entry points, war state, territory control, daily tasks, events, and online presence should be close at hand. Global and clan chat are required; faction chat is a likely extension. The UI should feel like a game, not a minimalist landing page.

## Approved but deferred systems

### Labyrinth

A large branching mode (roughly 500 conceptual floors) uses daily energy, currently envisioned as 10, restored at midnight. A medium-cost crafted bottle restores a full set. Every tenth floor is a boss milestone; floors 300+ introduce higher-value enchantment stones. Eight rotating labyrinth families may correspond to equipment-part fragments, with weekly bosses, luck chests, and final-boss ingredients for top recipes. Exact floor count, reset rules, stone tree, and fragment prices require a dedicated balance design before implementation.

### Competitive and social activities

- matched PvP arena;
- daily clan battle for an outpost;
- weekly large faction/clan structure battle;
- scalable Goblin Cave PvE;
- elimination tournaments with tiered prizes.

These follow combat balance, anti-abuse, matchmaking, and economy foundations. A winning clan must not automatically drain another clan's stored property; taxes/tribute need a fair server-economy design.

## Open decisions

- Final name for the item-transforming ritual (must differ from Hero Awakening).
- Exact calibration of same-level rarity curves, encounter rarity caps, and drop rates.
- The scarce primary currency/resource used broadly across the economy, its faucets, sinks, and permanent-deficit controls.
- Rules for claimed hidden recipes, including failed attempts and whether ingredients may be consumed without revealing why.
- Exact crafting acceleration economy and maximum parallel queue capacity.
- Final faction names and whether initial selection is manual, automatic, or hybrid.
- Trading taxes, price discovery, seal market safeguards, and clan transfer permissions.
- PvP death/risk rules and how real players enter scripted war locations.

## Documentation discipline

When an open decision is approved, move it into the relevant approved section. When a system ships, update `implementation-status.md`. Never mark a feature implemented because it appears in this roadmap or in a mockup.
