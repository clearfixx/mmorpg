# Veilfall — Game Design Baseline

**Status:** approved pre-production baseline  
**Version:** 0.2  
**Working title:** Veilfall / «Падіння Завіси»  
**Primary language:** Ukrainian  
**Updated:** 2026-08-03

## 1. Product statement

Veilfall is a text-first browser MMORPG in which a player can survive and make basic progress alone, but meaningful endgame power, rare equipment, advanced talents, runes, and the most valuable activities depend on coordinated clan play.

The game intentionally rewards long-term investment. Time, resources, knowledge, clan coordination, rare equipment, and ascension provide real power. Standard PvP does not normalize that power: a player who has earned an overwhelming advantage may use it fully.

The central promise is:

> Become a capable individual, become indispensable to a clan, defeat enemies that no hero can defeat alone, and eventually become a giant among giants.

## 2. Design pillars

### 2.1 Player interdependence

Solo play is supported but deliberately inefficient beyond the introductory progression. The best rewards and advanced character development require participation in a clan.

### 2.2 Clan as a collective character

A clan has its own level, experience, resources, buildings, development tree, bosses, equipment, history, and strategic identity. It is a persistent entity developed by its members.

### 2.3 Power must be earned and felt

Expensive equipment, talents, runes, enchantments, and ascension create a real advantage. Progress is not flattened merely to make every encounter equal.

### 2.4 Participation creates entitlement

Clan rewards are granted to players who participated and made a valid contribution, not automatically to every clan member.

### 2.5 Risk gives loot meaning

Loot collected during expeditions remains at risk until safely deposited. A backpack is temporary storage; a chest is permanent storage.

### 2.6 Every valuable asset has a history

Currency and important item instances must have traceable origins, transfers, upgrades, and administrative actions.

### 2.7 Server authority and minimal disclosure

The client requests commands but never determines results, prices, rewards, damage, balances, ownership, eligibility, or probabilities. Internal modules receive only the data they require.

### 2.8 Text first, visually expressive

Text carries the world, choices, tactics, and consequences. Visual systems make equipment, identity, rarity, and progression immediately visible.

## 3. Player progression

### 3.1 Progression stages

1. **Initiate:** learns travel, combat, loot, storage, and equipment.
2. **Independent adventurer:** develops basic talents with solo-accessible materials.
3. **Clan contributor:** joins a clan and begins contributing to shared goals.
4. **Clan veteran:** participates in bosses and gains advanced resources.
5. **Endgame specialist:** develops advanced talents, skills, runes, and optimized sets.
6. **Awakened specialist:** develops advanced knowledge and creates Ascended mythic or divine equipment capable of dominating ordinary PvP.

### 3.2 Catch-up principle

As the server ages, the journey to current clan content may become faster, but endgame rewards are never simply granted.

Possible catch-up mechanisms:

- accelerated early levels;
- cheaper legacy basic talents;
- clan rewards for mentoring new members;
- improved access to old seasonal materials;
- onboarding objectives that lead into current clan content.

## 4. Character systems

Each hero has:

- level and experience;
- base attributes;
- passive talents;
- active skills;
- a profession;
- equipment;
- runes;
- enchantments and ascension;
- achievements and titles;
- backpack;
- permanent chest;
- personal showcase;
- static or dynamic avatar.

### 4.1 Base attributes

Initial candidates:

- health;
- damage;
- armor;
- stamina;
- speed;
- reaction;
- accuracy;
- evasion;
- critical chance;
- critical damage;
- resistance.

Not every attribute is directly upgraded. Final values are derived from level, talents, equipment, set bonuses, runes, enchantments, clan bonuses, and temporary effects.

### 4.2 Talents

Talents are permanent passive development.

The introductory talent tree uses accessible solo materials such as iron, copper, bronze, leather, timber, basic crystals, and gold.

At an indicative threshold around level 30, an advanced knowledge system called
**Awakening** begins to open. Its branches add combat techniques, research,
recipe discovery, exploration, gathering, and specialization. Awakening expands
how a hero uses equipment; equipment remains the primary source of raw combat
power. Advanced upgrades require resources obtained primarily or exclusively
from bosses and clan activities. This marks the beginning of the real endgame.

New levels unlock access to additional talent nodes and tiers. A new character cannot immediately purchase endgame power even if resources are transferred to it.

### 4.3 Active skills

Active skills are battle commands and are separate from passive talents. They can be upgraded using scrolls and rare resources.

The number of equipped active skills grows with character progression, while the battle loadout remains limited to preserve tactical clarity.

### 4.4 Professions

Professions reinforce player interdependence. A single character cannot master every profession.

Initial candidates:

- gatherer;
- blacksmith;
- runesmith.

Later professions may include alchemist, armorer, weaponsmith, hunter, and cartographer.

## 5. Clan system

### 5.1 Clan state

A clan has:

- level and experience;
- treasury and resources;
- member roles and permissions;
- development tree;
- buildings;
- armory;
- boss lair;
- activity history;
- rankings and achievements;
- seasonal progress.

### 5.2 Development branches

- **Military:** survivability, combat access, and boss attempts.
- **Hunting:** loot, scouting, and encounter information.
- **Crafting:** forge access, upgrade efficiency, and advanced recipes.
- **Economic:** treasury, storage, membership capacity, and trade benefits.
- **Mystic:** runes, enchantments, seasonal caves, and magical resistance.

High-level development should require specialization. Completing every branch must be difficult and time-consuming.

### 5.3 Buildings

Initial building candidates:

- clan hall;
- forge;
- armory;
- boss lair;
- trophy hall;
- rune altar;
- training yard;
- cartography hall.

Buildings unlock mechanics, not only percentage bonuses.

### 5.4 Membership and leadership

The clan leader cannot leave without transferring leadership or dissolving the clan.

Leadership may be transferred only to a player who has continuously held the `Elder` rank for at least 30 days and accepts the transfer.

The clan decides its own distribution policy. The game provides contribution, activity, participation, and item-use history but does not enforce equal access.

### 5.5 Clan hopping protection

Clan activities may require membership tenure. Indicative rules:

- basic bonuses immediately;
- ordinary bosses after 72 hours;
- seasonal rune activities after 7 days;
- cooldown after voluntary departure;
- no clan change during an active clan event.

Exact values remain balance configuration.

## 6. Clan bosses

Clans develop a lair and unlock progressively stronger bosses. A leader or authorized officer opens an encounter.

Rewards go only to participants who make a valid contribution. Contribution may include:

- damage;
- blocked or absorbed damage;
- healing;
- interrupts;
- buffs and debuffs;
- cleansing;
- execution of encounter mechanics;
- active turns and survival.

Top bosses must remain impossible for a single hero, including the strongest hero on the server. This is enforced through mechanics as well as numerical strength.

The game may support:

- synchronous coordinated boss battles;
- asynchronous clan encounters open for a fixed period, where actions by one player create opportunities for others.

## 7. Clan-owned equipment

A clan item is owned by the clan and temporarily assigned to a member.

It cannot be:

- sold;
- destroyed by a member;
- discarded;
- gifted;
- moved to another clan;
- placed in a personal showcase.

The clan leader may recall it at any time. If it is locked in an active battle snapshot, it is recalled immediately after that battle and cannot be used to start another encounter.

All personal resources invested into a clan item become clan property. The interface must provide an explicit irreversible-contribution warning.

When a player leaves, is removed, or is banned, assigned clan items return to the clan armory.

When a clan is banned, its items become suspended and provide no effects.

When a clan is dissolved, all clan-owned items and their upgrades are permanently destroyed. Dissolution requires strong confirmation and atomic execution.

## 8. Equipment and sets

Initial sets:

### 8.1 Knight set

High armor, health, resistance, block, and critical protection. Low speed and damage. Intended for tank and protection builds.

### 8.2 Berserker set

High damage, critical output, bleeding, and low-health bonuses. Low armor and resistance. Intended for aggressive, support-dependent builds.

### 8.3 Veteran set

Balanced, accessible, and cheaper to improve. Suitable for solo content and early progression but has a lower endgame ceiling.

Sets are not rigid classes. Mixed builds are permitted.

### 8.4 Item dimensions

Each item may have independent properties:

- definition and instance ID;
- equipment slot;
- item level;
- rarity;
- random-roll quality;
- upgrade rank;
- set membership;
- rune slots;
- enchantment or ascension;
- binding type;
- ownership type;
- origin and lineage;
- visual asset identifiers.

### 8.5 Rarity scale

Baseline scale:

1. Common
2. Uncommon
3. Rare
4. Epic
5. Legendary
6. Mythic
7. Divine

At the same item level, the minimum primary roll of a higher rarity must exceed
the maximum primary roll of the preceding rarity. Item level ranges from 1 to 99. A level-1 item of one rarity is not required to exceed a level-99 item of
the preceding rarity, because that would make item level meaningless.

`Collectible` is an independent property, not a power tier.

## 9. Item improvement

### 9.1 Forging

An item can be improved using:

```text
base item + matching donor item + catalyst + currency = improved item
```

The donor and catalyst are consumed. The result cannot be weaker than the base item. Improvement cost rises with progress. Clan forge and profession bonuses may improve the outcome range.

The system should include protection against an endless sequence of minimum random gains.

### 9.2 Runes

Items may have up to three rune slots, opened progressively. Runes can modify attributes or combat mechanics.

Runes are acquired primarily through periodic clan competition. A rune event may occur every four weeks. After defeating a boss, the clan may summon a stronger version for better rune rewards.

Higher difficulty introduces mechanics, not only larger health and damage values.

### 9.3 Equipment Ascension

Ascension is reserved for equipment and is the highest personal-power system. It
is separate from hero Awakening, rarity, runes, and ordinary upgrades.

Ascended enchantments may exist at multiple qualities up to mythic and divine. The highest tiers require catastrophically expensive combinations of long-term, seasonal, boss, clan, and economic resources.

There is no fixed limit on the number of ascended items a hero may equip. A complete ascended set is a legitimate long-term goal.

Ascension works at full strength in standard PvP and against weaker players. Mythic and divine effects may alter mechanics rather than only add raw percentages.

Major Ascensions should be transformative rather than incremental. Months of
discovery and material collection must produce a very large primary-stat
increase, changed or unique mechanics, a persistent artifact-development path,
and a long useful life. Major Ascensions should appear in the world chronicle
and player profile.

## 10. Inventory, risk, and storage

### 10.1 Backpack

The backpack contains expedition loot. On defeat, some or all unprotected contents may be lost according to the selected danger tier.

### 10.2 Chest

The chest is permanent personal storage. Deposited items are not lost on expedition defeat.

### 10.3 Protected storage

Possible sinks include protected backpack slots, item insurance, resource insurance, and clan storage services.

### 10.4 Binding types

- freely transferable;
- bound on equip;
- bound on acquisition;
- clan-owned;
- seasonal;
- administrative test asset;
- system asset;
- frozen during investigation.

## 11. Trading

### 11.1 Personal showcase

Players may list items and resources on a public showcase. Purchases are atomic, taxed, audited, and server-authoritative.

### 11.2 Official exchange through an NPC

Two players may use an NPC broker to perform an atomic barter:

1. both deposit offered assets;
2. the server validates ownership and transferability;
3. both review the final agreement;
4. both pay a commission;
5. assets and commission enter escrow;
6. the server atomically completes the exchange.

The commission may use gold, a scarce trade resource such as a Trust Seal, or both. It permanently leaves the economy.

### 11.3 Unofficial exchange

Players may transfer gifts without the broker and avoid the commission, but there is no guaranteed counter-transfer. The UI must warn that administration does not guarantee recovery. The Root Owner may still intervene at their discretion.

## 12. PvP

Standard PvP uses full character power without equipment normalization.

Leagues use character-level eligibility and PvP performance for placement. Equipment remains fully effective within the league.

Future separate modes may normalize most numerical power and emphasize mechanics, skill selection, knowledge, and coordination. They do not replace standard progression PvP.

## 13. Avatar and visual equipment

### 13.1 Avatar modes

Players choose either:

- one of at least five game-provided static avatars;
- a dynamic avatar based on equipped visual items.

User-uploaded images are not supported.

The Root Owner may grant exclusive, non-transferable avatars and frames as rewards.

### 13.2 Dynamic avatar

The dynamic portrait uses the hero bust and visible equipment, especially the helmet and upper armor. Rarity, runes, and ascension may add controlled visual effects.

### 13.3 Equipment screen

The equipment screen shows a full-body layered hero in the center, with equipment slots arranged around the model. Selecting a slot opens the chest filtered to compatible items and provides a comparison before sending an equip command.

The hero is composed from aligned visual layers rather than a pre-rendered image for every combination. Asset production must use a fixed pose, perspective, lighting, canvas, anchors, layer order, and portrait crop.

The server returns an authorized appearance descriptor. The client cannot activate unavailable exclusive visuals.

## 14. Administration

### 14.1 Root Owner

The project owner has an unrestricted `ROOT_OWNER` role and may:

- grant any item, resource, currency, level, talent, skill, rune, or enchantment;
- modify item properties and upgrade ranks;
- grant assets to their own accounts;
- create and delete test accounts;
- create competitions and rewards;
- intervene in the economy;
- reverse or compensate transactions;
- manage all other staff roles;
- bypass ordinary staff approval workflows.

Root actions are recorded for debugging, balance analysis, recovery, and historical reconstruction, not to require approval.

### 14.2 Other administrators

Other administrators cannot grant value to themselves or connected accounts. Economic grants require unanimous administrator approval or approval by the Root Owner.

### 14.3 Hidden staff identity

Staff player characters appear as ordinary players and expose no public badge or role. Staff permissions belong to a separate authorization context.

Official system mail uses a verified system sender that cannot be imitated by a character name.

### 14.4 Moderation visibility

Authorized staff may inspect clan and other chats for moderation and investigations. Access is permission-controlled and audited. The game's rules and privacy notice disclose this possibility.

### 14.5 Balance laboratory

Administration should eventually support creating character copies, arbitrary builds, boss simulations, mass battle simulations, and economic impact comparisons.

## 15. Mail

System mail may deliver announcements, compensation, rewards, items, resources, and currency. Attachments are claimed atomically and idempotently.

Official sender types include Administration, System, Support, Event, and Clan. These are not ordinary player accounts.

Player-to-player mail may be added later with spam protection, blocking, transfer restrictions, and audit.

## 16. Security and economic integrity

### 16.1 Atomic commands

The client does not ask whether it can purchase and then submit a second command. It submits the purchase command. The server validates and executes the entire operation in one transaction.

### 16.2 Minimal module knowledge

A market module should not read a player's entire resource state. It asks a wallet capability to perform an atomic debit and receives a minimal success or decline result.

### 16.3 Required controls

- unique item-instance identifiers;
- currency ledger;
- item lineage;
- append-only administrative audit;
- idempotency keys;
- anti-replay protection;
- optimistic locking and version columns;
- unique database constraints;
- server time and server randomness;
- transaction boundaries for all valuable operations;
- rate limits and behavioral risk scoring;
- content and loot-table versioning;
- battle snapshots;
- multi-account detection and reward controls.

### 16.4 Administrative reversals

History is not deleted. Disputed operations are resolved through freezes and compensating transactions linked to the original event.

## 17. Engagement principles

The game targets an active audience and does not optimize for a once-per-week reward button.

High engagement should come from:

- clan coordination;
- preparation for bosses;
- risk decisions;
- professions and trade;
- rotating events;
- build experimentation;
- competition;
- meaningful contribution.

Progress should not primarily reward mindless repetition, because that makes bots and multi-account automation dominant.

## 18. Anti-abuse product rules

The project must define before public testing:

- allowed number of accounts and characters;
- whether related accounts may join the same clan encounter;
- whether related accounts may trade;
- clan reward eligibility;
- bot and automation policy;
- response to account theft;
- responsibility for unofficial gifts;
- staff access to communications;
- sanctions and appeal flow.

## 19. Technical direction

Required stack:

- Next.js App Router, React, and TypeScript;
- Tailwind CSS;
- shadcn/ui using owned and heavily customized source components;
- a distinct game design system rather than the default shadcn appearance;
- NestJS and GraphQL;
- PostgreSQL and Prisma;
- Redis and BullMQ when their workloads are introduced;
- pnpm workspace and Turborepo;
- Docker and a planned Kubernetes deployment path;
- Vitest, Playwright, observability, and structured audit.

GraphQL mutations represent explicit domain commands. Resolvers contain no game rules and do not expose generic arbitrary state mutation.

The initial implementation may be a modular deployment while bounded contexts are designed for eventual service extraction. Microservices and Kubernetes are intentional target architecture, introduced according to operational and scaling needs.

## 20. Vertical slices

### Slice A — Personal progression

```text
create hero → enter location → fight → receive loot → equip item
→ see visual change → see measurable power increase → unlock destination
```

### Slice B — Clan dependency

```text
join clan → contribute → participate in clan boss → receive clan resource
→ unlock advanced talent → use a clan-owned item → defeat stronger content
```

### Slice C — Risk and economy

```text
enter risky expedition → collect backpack loot → return or die
→ deposit surviving loot → trade through broker → improve equipment
```

These three slices must be proven before broad content production.

## 21. Deferred systems

Deferred until the relevant vertical slices work:

- normalized skill-only PvP modes;
- territory warfare;
- large-scale faction conflict;
- native mobile applications;
- player-created visual uploads;
- AI-controlled economy or balance;
- unrestricted procedural content;
- broad microservice decomposition without measured need.

## 22. Open balance decisions

The following remain configurable rather than frozen:

- exact level cap and advanced-talent threshold;
- clan membership eligibility delays;
- boss group sizes and asynchronous windows;
- backpack loss percentages;
- profession count and specialization limits;
- rune event cadence;
- trade commission resources and amounts;
- equipment Ascension formulas;
- PvP league level bands;
- binding rules for ordinary high-rarity items;
- multi-account policy;
- precise clan contribution metrics.

## 23. Immediate next milestone

Before implementation, produce:

1. a precise specification for Vertical Slice A;
2. an initial domain map and ownership boundaries;
3. architecture decision records for GraphQL, authorization, item instances, currency ledger, and visual equipment layers;
4. a small-commit repository bootstrap plan;
5. a minimal content list for the first playable encounter.

Until Slice A is playable, no broad scaffolding of deferred systems should take priority over the complete player experience.
