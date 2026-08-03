# Veilfall — Vertical Slice A: First Journey

**Status:** implementation specification  
**Version:** 0.1  
**Depends on:** `game-design-v0.2.md`  
**Purpose:** prove the personal progression loop before broad systems are built

## 1. Slice goal

The slice must prove that a new player can:

```text
create a hero → understand a location → make a meaningful choice
→ read an enemy's intent → win or lose a tactical battle
→ receive an equipment item → equip it → see the hero change
→ feel a measurable increase in power → unlock the next location
```

This is not a miniature version of every planned system. It is one complete, polished journey.

## 2. Player experience target

Expected first-session duration: 10–20 minutes.

The player should leave the slice understanding:

- actions are explicit commands;
- enemy intent matters;
- archetypes play differently;
- equipment changes both statistics and appearance;
- defeat has understandable causes;
- the world contains locked paths and stronger enemies;
- future progression will require other players and a clan.

The slice ends with an invitation to continue toward the first settlement and the future clan layer. No clan functionality is implemented in Slice A.

## 3. Provisional fiction

### 3.1 Region

**The Ashen Verge** is a frontier scarred by the collapse of the Veil. Old imperial roads cross abandoned watchposts, mineral ravines, and ruins where distorted creatures gather.

This name and all content names are provisional and must remain configurable.

### 3.2 Locations

#### The Broken Watchpost

Starting safe location. Contains:

- introductory narrative;
- character status;
- a damaged supply chest;
- the first meaningful choice;
- route to the Hollow Road;
- locked route to Cinderhaven.

#### The Hollow Road

First dangerous location. Contains:

- the first mandatory encounter;
- retreat option;
- short environmental description;
- return route to the watchpost.

#### Cinderhaven Gate

Destination unlocked after the first victory and reward claim. In Slice A it is an ending screen and preview of the next milestone.

## 4. Account and character flow

### 4.1 Account

Required:

- registration;
- login;
- logout;
- authenticated session;
- one character per account;
- recovery flow may be stubbed for internal testing but must be designed before public access.

### 4.2 Character creation

Fields:

- unique character name;
- one of five static avatars or dynamic-avatar mode;
- archetype;
- optional origin choice.

Origins provide narrative flavor only in Slice A:

- **Former Sentinel**;
- **Road Survivor**;
- **Archive Exile**.

Origins must not create a permanent balance advantage until their long-term role is designed.

### 4.3 Archetypes

#### Vanguard

Identity: durable defender who responds to heavy attacks.

Starting actions:

- Strike;
- Guard;
- Shield Bash;
- Second Wind.

#### Ranger

Identity: fast attacker who anticipates danger and creates bleeding.

Starting actions:

- Quick Shot;
- Evade;
- Barbed Arrow;
- Focused Shot.

#### Arcanist

Identity: resource-based controller who interrupts and exposes enemies.

Starting actions:

- Arcane Bolt;
- Ward;
- Disrupting Spark;
- Veil Flare.

Names and values are content configuration, not hardcoded engine concepts.

## 5. Introductory choice

At the Broken Watchpost, the player sees signs of an approaching creature and chooses one preparation:

### Search the damaged armory

Reward for the upcoming battle:

- one temporary armor effect;
- narrative clue about blocking heavy attacks.

### Inspect the tracks

Reward for the upcoming battle:

- the enemy's first two intents become visible;
- narrative clue about its vulnerable phase.

### Rest beside the cold brazier

Reward for the upcoming battle:

- full health and resource;
- one temporary regeneration effect.

The choice must change the encounter but must not make any option objectively mandatory.

## 6. First enemy

### Rift-Scarred Marauder

Purpose:

- teach readable enemy intent;
- punish blindly repeating the strongest attack;
- allow every archetype to demonstrate its identity;
- remain beatable after one mistake;
- defeat a player who ignores mechanics repeatedly.

Initial intent cycle:

1. **Measured Strike** — ordinary damage.
2. **Gathering Force** — no immediate damage; prepares Crushing Blow.
3. **Crushing Blow** — high damage; can be guarded, evaded, or interrupted.
4. **Off Balance** — enemy defense is reduced.

The exact sequence may branch according to battle state, but a seeded battle must be deterministic.

### 6.1 Required tactical lesson

The interface must communicate:

> The marauder plants its feet and raises the cleaver overhead. A devastating strike is coming.

Possible valid responses differ by archetype:

- Vanguard guards or interrupts;
- Ranger evades or commits to a finishing attack;
- Arcanist uses a ward or interruption.

## 7. Combat model

### 7.1 Turn structure

1. Server exposes the current observable battle state and enemy intent.
2. Player submits one allowed command.
3. Server validates actor, battle version, ownership, resource, cooldown, and target.
4. Engine resolves the player action.
5. Engine resolves statuses and enemy response.
6. Server persists the next battle snapshot and log atomically.
7. UI receives the result and renders readable feedback.

### 7.2 Slice resources

- health;
- one archetype resource;
- cooldowns measured in turns;
- temporary effects.

Resource names:

- Vanguard: stamina;
- Ranger: focus;
- Arcanist: mana.

### 7.3 Slice status effects

Only the following effects are required:

- Guarded;
- Bleeding;
- Stunned;
- Exposed;
- Regenerating.

### 7.4 Positioning

Positioning is explicitly out of Slice A.

### 7.5 Randomness

Randomness is injected through `RandomSource`. The battle stores the seed or equivalent deterministic state needed to reproduce outcomes during tests and investigations.

### 7.6 Initial balance envelope

Exact numbers remain typed content configuration. The first balance target is:

- successful informed battle: 5–8 player turns;
- one mistake is survivable;
- two or three ignored heavy attacks usually cause defeat;
- using the archetype response produces a clear advantage;
- the reward weapon shortens a replay by roughly one meaningful turn.

## 8. Defeat, retreat, and retry

### 8.1 Defeat

On first-slice defeat:

- no permanent item is lost;
- the player returns to the Broken Watchpost;
- battle resources reset;
- the combat log explains the decisive mistake;
- the preparation choice may be selected again;
- the player may retry.

Backpack-loss mechanics are introduced in Vertical Slice C, not here.

### 8.2 Retreat

Retreat is available after the first completed round. In Slice A it succeeds deterministically and returns the player to the watchpost without a reward.

### 8.3 Retry protection

- abandoned and completed battle IDs cannot be reused;
- duplicate commands do not resolve another turn;
- duplicate reward claims do not create another item;
- only one active first encounter may exist per character.

## 9. Reward

Victory grants:

- experience;
- a small amount of gold;
- one archetype-compatible Veteran weapon;
- unlock condition for Cinderhaven Gate.

Example items:

- Vanguard: Veteran's Notched Blade;
- Ranger: Veteran's Ashwood Bow;
- Arcanist: Veteran's Cracked Focus.

The item is created as a unique server-owned instance with:

- definition ID;
- instance ID;
- source battle ID;
- owner character ID;
- item level;
- rarity;
- generated roll;
- binding type;
- lineage event;
- visual asset ID.

Slice A item properties:

- Veteran set;
- common or uncommon rarity;
- one primary damage roll;
- no rune slots opened;
- no ascension;
- bound on equip;
- transferable systems not yet exposed.

## 10. Equipment interaction

### 10.1 Full-body character view

The equipment page displays:

- full-body hero in a fixed pose;
- equipment slots around the model;
- current attributes;
- set progress;
- selected item comparison;
- static/dynamic avatar selector.

Only visual layers required by the slice are implemented:

- base body;
- starter clothing;
- main-hand weapon;
- optional starter helmet;
- reward weapon visual;
- portrait crop.

The architecture must support future helmet, chest, hands, legs, boots, off-hand, accessories, runes, and visual effects without implementing all assets now.

### 10.2 Slot selection

Selecting the main-hand slot opens the chest filtered to compatible weapons.

The player sees:

- current item;
- candidate item;
- attribute differences;
- equip requirements;
- resulting set progress;
- visual preview if available.

### 10.3 Equip command

The client sends the selected item instance ID and slot. It does not send final statistics or appearance.

The server validates:

- authenticated character ownership;
- item ownership;
- item location in permanent storage;
- slot compatibility;
- level requirement;
- binding rules;
- item lock state;
- expected character version.

The server atomically equips the item, updates binding if necessary, recalculates derived statistics, writes audit/lineage events, and returns the authorized result.

## 11. Dynamic avatar

Five static placeholder avatars and one dynamic-avatar mode are available.

No upload endpoint, file input, remote-image URL, or user-provided image field may exist.

The dynamic avatar is derived from the authorized appearance descriptor. In Slice A it reflects:

- base character bust;
- starter or equipped head appearance;
- upper-body base appearance;
- optional reward-related accent if implemented.

## 12. Screens

Required screens:

1. registration;
2. login;
3. character creation;
4. main game shell;
5. Broken Watchpost location;
6. preparation choice;
7. Hollow Road location;
8. battle;
9. victory/defeat result;
10. reward reveal;
11. equipment and chest;
12. Cinderhaven Gate ending screen.

### 12.1 Desktop shell

- compact navigation rail;
- top character status;
- central narrative/action area;
- contextual right panel;
- readable event log.

### 12.2 Mobile shell

- single central flow;
- compact top status;
- bottom navigation;
- sticky battle actions;
- equipment selection in a bottom sheet or full-screen panel.

## 13. UX requirements

Every command presents:

- pending state;
- success feedback;
- domain failure feedback;
- retry-safe network failure handling;
- disabled reason;
- updated server state.

Battle buttons display relevant cost and availability. Hidden information is not leaked, but observable tactical information is clear.

Accessibility baseline:

- keyboard navigation;
- visible focus;
- semantic buttons;
- readable text size;
- sufficient contrast;
- reduced-motion support;
- status changes communicated without color alone;
- battle-log announcements suitable for assistive technology.

## 14. GraphQL surface

Names are provisional but action-oriented.

### 14.1 Queries

```graphql
viewer
myCharacter
currentLocation
activeEncounter
activeBattle
myChest
characterAppearance
```

### 14.2 Mutations

```graphql
register
login
logout
createCharacter
performLocationAction
travel
startEncounter
submitCombatCommand
retreatFromBattle
claimBattleReward
equipItem
selectAvatarMode
```

Gameplay mutations accept idempotency and expected-version information where relevant.

### 14.3 Subscriptions

No GraphQL subscription is required for Slice A. Single-player battle commands use ordinary mutations. Real-time infrastructure is introduced when a real multi-user use case appears.

## 15. Domain commands

Required command names:

- `CHARACTER_CREATE`;
- `LOCATION_PREPARE`;
- `WORLD_TRAVEL`;
- `ENCOUNTER_START`;
- `COMBAT_ATTACK`;
- `COMBAT_DEFEND`;
- `COMBAT_USE_ABILITY`;
- `COMBAT_RETREAT`;
- `BATTLE_REWARD_CLAIM`;
- `ITEM_EQUIP`;
- `AVATAR_MODE_SELECT`.

Required event names:

- `CharacterCreated`;
- `LocationPreparationSelected`;
- `LocationEntered`;
- `BattleStarted`;
- `CombatTurnResolved`;
- `BattleWon`;
- `BattleLost`;
- `BattleRetreated`;
- `RewardClaimed`;
- `ItemCreated`;
- `ItemEquipped`;
- `LocationUnlocked`;
- `AvatarModeSelected`.

## 16. Initial domain ownership

### Identity

Owns accounts, credentials, sessions, and staff-independent authentication.

### Characters

Owns character identity, level, progression, base configuration, and avatar selection.

### World

Owns regions, locations, connections, travel rules, location actions, and unlocks.

### Combat

Owns battle lifecycle, snapshots, participants, commands, intents, effects, logs, and outcome.

### Inventory

Owns item instances, storage placement, equipment assignment, binding, and item lineage.

### Rewards

Coordinates idempotent reward grants but does not calculate combat outcomes.

### Content

Owns validated definitions for locations, enemies, abilities, encounters, and items.

No module reads or mutates another module's internal persistence tables directly through game logic.

## 17. Minimal persistence model

Only tables justified by the slice should be created. Initial candidates:

- users;
- sessions;
- characters;
- character_progression;
- character_location_unlocks;
- location_action_states;
- battles;
- battle_participants;
- battle_commands;
- combat_log_entries;
- reward_claims;
- item_definitions or published content records;
- item_instances;
- inventory_placements;
- equipment_assignments;
- item_lineage_events;
- audit_events.

The final schema is decided through implementation ADRs and may combine tables where transaction and query patterns justify it.

## 18. Security invariants

- A user can act only for their own character.
- Client-provided damage, health, reward, roll, price, balance, appearance, and unlock state are ignored or rejected.
- A command references server-known IDs and requested intent only.
- Battle version prevents stale or duplicated turns.
- Reward claim has a unique constraint per battle and reward type.
- Item creation and reward claim occur in one transaction or recoverable idempotent workflow.
- Item equip cannot duplicate or lose an item under retries.
- Static avatar IDs are validated against granted entitlements.
- Dynamic appearance is derived from equipped server state.
- Internal errors do not expose database structure or secret state.

## 19. Testing requirements

### 19.1 Game-engine unit tests

- deterministic battle replay;
- each archetype can win using intended mechanics;
- repeated blind attacks can lose;
- Guard mitigates Crushing Blow;
- Evade handles the telegraphed attack;
- interruption cancels the prepared attack;
- Bleeding, Stunned, Exposed, Guarded, and Regenerating resolve correctly;
- battle cannot resolve after completion.

### 19.2 Integration tests

- create one character per account;
- preparation choice persists;
- travel authorization;
- one active encounter;
- concurrent combat commands resolve only once;
- reward claim is idempotent;
- item instance has lineage;
- equip is atomic;
- derived statistics update;
- unauthorized character and item access fails.

### 19.3 End-to-end tests

At minimum:

1. register and create Vanguard;
2. select preparation;
3. travel and start battle;
4. respond to enemy intent;
5. win and claim weapon;
6. open equipment screen;
7. equip weapon;
8. observe visual and statistical change;
9. unlock and enter Cinderhaven Gate.

Additional paths:

- lose and retry;
- retreat and restart;
- network retry during reward claim;
- mobile viewport;
- keyboard-only completion.

## 20. Observability

Track:

- registration and character creation completion;
- preparation choice distribution;
- battle start, victory, defeat, retreat, and turn count;
- ability usage;
- damage source and decisive defeat cause;
- reward claim success and duplicate attempts;
- equip completion;
- time from registration to slice completion;
- domain errors and transaction failures.

Do not log passwords, raw session secrets, full tokens, or unnecessary personal data.

## 21. Content inventory

Slice A requires only:

- one region;
- three locations;
- one enemy definition;
- one encounter definition;
- three archetypes;
- twelve player actions total;
- five status effects;
- three reward weapons;
- starter equipment definitions;
- five static avatar placeholders;
- one layered body model;
- minimal Veteran visual layers;
- introductory and outcome text.

## 22. Explicitly out of scope

- clans and clan bosses;
- clan items;
- PvP;
- professions;
- runes;
- ascension;
- trading and showcases;
- backpack loss;
- mail;
- chat;
- rankings;
- worker processes;
- GraphQL subscriptions;
- broad admin content management;
- microservice extraction;
- Kubernetes deployment beyond architecture-ready container practices.

These systems are planned but must not delay proof of the first loop.

## 23. Definition of done

Vertical Slice A is complete only when:

- a new user can finish it without developer assistance;
- the first tactical lesson is understandable;
- all three archetypes can complete the encounter;
- defeat and retreat work safely;
- the reward cannot be duplicated;
- equipping the reward changes both power and appearance;
- the next location unlocks exactly once;
- desktop and mobile flows are usable;
- keyboard navigation works;
- automated unit, integration, and end-to-end tests pass;
- format, lint, typecheck, test, and build commands pass;
- no known critical authorization, item duplication, or reward exploit remains.

## 24. Next implementation decision

Before repository bootstrap, create architecture decision records for:

1. monorepo boundaries;
2. GraphQL code-first or schema-first approach;
3. session and authorization strategy;
4. domain persistence boundaries with Prisma;
5. deterministic combat-state persistence;
6. item instances, binding, and lineage;
7. Tailwind/shadcn customization and visual-layer asset contract.
