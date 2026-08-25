# VeilFall — implementation status

Last synchronized: **2026-08-10** on branch `agent/item-power-foundation`. Feature baseline: `8097bb7` (`verify ritual boss reward chain`); later documentation-only corrections do not change runtime status. Update this marker in every meaningful feature commit.

## Current playable loop

A player can authenticate, own a character, progress through deterministic PvE encounters and an escalating road expedition, receive XP/resources/probabilistic equipment, manage a persistent inventory and 14 equipment slots, reach Cinderhaven, develop talents, craft known recipes in parallel queues, join and develop a clan, participate in the faction-front foundation, encounter a rare seal-bearing NPC from level 30, and spend invocation materials on the first two ritual bosses.

## Systems

| Domain                | Status                 | Current reality                                                                                                                                                                                                       | Main gap / next step                                                                                                                       |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity and sessions | Implemented            | Server-owned users, hashed sessions, roles                                                                                                                                                                            | Recovery/moderation/admin UX                                                                                                               |
| Character progression | Implemented            | Levels, XP, talent points, base/defensive stats                                                                                                                                                                       | Complete 1–30 balance and campaign teaching                                                                                                |
| Deterministic combat  | Implemented            | Server-resolved PvE with tested engine; armor uses diminishing mitigation rather than flat subtraction, so high armor cannot create passive immunity                                                                  | More effects, enemy families, group/PvP layers and balance telemetry                                                                       |
| Road expedition       | Implemented            | Escalating stages, personal best, probabilistic drops                                                                                                                                                                 | More locations and encounter variety                                                                                                       |
| Guide checkpoints     | Implemented            | Only a new personal-best victory may offer a paid saved route; saved route enables later return                                                                                                                       | Price/balance telemetry and clearer narrative polish                                                                                       |
| Inventory/equipment   | Implemented            | Persistent item instances and lineage; 14 slots; item levels 1–99; Common–Divine rarity; roll quality; same-level power ranges; encounter rarity caps; probabilistic equipment drops; damage/armor/health allocation  | Balance/calibration of item-level and rarity curves, set bonuses, upgrades, runes and enchantments                                         |
| Resources/ledger      | Implemented foundation | Resource catalog, rarities/origins, atomic grants/spends                                                                                                                                                              | Trading and final scarce primary currency                                                                                                  |
| Crafting              | Implemented foundation | Known recipes, multi-ingredient inputs, queues, concurrent jobs, recipe knowledge UI                                                                                                                                  | Hidden discovery, long rituals, acceleration, claimed recipes                                                                              |
| Cinderhaven           | Implemented foundation | First neutral/semi-neutral hub with working district links                                                                                                                                                            | Trading rows, NPCs, city state/events, stronger visual layer                                                                               |
| Clans                 | Implemented foundation | Membership, treasury, development, clan boss/reward flows                                                                                                                                                             | Social UX, trade, permissions depth, clan war activities                                                                                   |
| Factions/front        | Implemented foundation | Dawn Covenant/Ashen Host data and scripted front concepts                                                                                                                                                             | Player contribution loop, level brackets, territory history                                                                                |
| Lobby/GameShell       | Implemented foundation | Dense shell, navigation, chronicle/status panels, footer diagnostics                                                                                                                                                  | More live data and mockup-level art/layout refinement                                                                                      |
| Rare NPC/seals        | Implemented            | Eligibility level 30; weekly guaranteed first find then diminishing chance up to five; strong neutral encounter; tradeable seal resource                                                                              | Trading UI, more NPC identities, abuse/alt controls                                                                                        |
| Invocation rituals    | Implemented foundation | Seal invokes Cursed Knight Morgrave → `CURSED_HEART`; 3 hearts invoke Fallen Elf Saelir → `FALLEN_ELF_EYE`; both identities, atomic costs, idempotent retry, rewards and return to Cinderhaven are covered end-to-end | Branching/recrafting and later 4–5 boss chain                                                                                              |
| Hero Awakening        | Not implemented        | Legacy `AWAKENED_VITALITY`, `AWAKENED_POWER`, and `AWAKENED_RESILIENCE` raw-stat talents remain as a temporary prototype; they are not the approved Awakening system                                                  | Replace the prototype with a knowledge/research/skills/exploration design that does not displace equipment as the main source of raw power |
| Chat/chronicle        | Foundation             | System chronicle-style panels exist                                                                                                                                                                                   | Real global/faction/clan chat and moderation                                                                                               |
| Admin panel           | Not implemented        | Roles exist; no admin application                                                                                                                                                                                     | Build separately under the security/audit rules in `AGENTS.md`                                                                             |

## Equipment slots

Exactly **14** slots are part of the current model:

1. head
2. shoulders
3. chest
4. bracers
5. hands
6. waist
7. legs
8. feet
9. main hand
10. off hand
11. amulet
12. bracelet
13. ring left
14. ring right

The character page is for equipped gear, combined statistics, progress, and achievements. The inventory page is a full-width chest/bag view without duplicating the character portrait.

## Local boss-chain test mode

The following root `.env` values are documented in `.env.example`:

```dotenv
VEILFALL_TEST_RARE_ENCOUNTERS=true
VEILFALL_TEST_INVOCATION_SEALS=100
```

Outside production they force eligible rare encounters and make the rare NPC grant 100 seals. Production ignores the force flag and grants the normal single seal. The tested character must still be level 30 or higher. Do not promote characters with manual database edits; use the repository fixture below so preparation stays repeatable.

For repeatable local preparation without manual database edits:

```bash
pnpm --filter @veilfall/database test:prepare-boss -- \
  --email player@example.com \
  --confirm PREPARE-LOCAL-HERO
```

The command only accepts a loopback database URL, selects the character by exact account email, never lowers an existing level, prepares level 30 experience, and resets the rare encounter cycle. Normal play uses `VEILFALL_TEST_RARE_ENCOUNTERS=false` and `VEILFALL_TEST_INVOCATION_SEALS=1`.

## Known quality state

At the latest feature baseline, formatting, lint, typecheck, unit tests, build, and API end-to-end tests passed. This is historical evidence, not permission to skip the quality gate after new changes.

## Recommended next packages

1. Add the first branch/recraft choice to the invocation chain without changing the existing default route.
2. Design the third boss stage and its exclusive use for `FALLEN_ELF_EYE`; do not add a placeholder reward without a downstream purpose.
3. Keep the full admin application separate; do not consume the gameplay branch with it.
