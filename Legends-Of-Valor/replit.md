# Legends of Valor V2

## Overview

Legends of Valor is a text-based fantasy RPG with trading, combat, guild systems, and extensive progression mechanics. Players choose from 14 races with unique bonuses, progress through 15 ranks from Novice to Mythical Legend, explore 12 zones, climb a 50-floor Mystic Tower, and work toward endgame content with billion-scale power.

## Army System (Barracks) — Audited & Balanced

The army system uses a **Whiteout Survival-style training queue** with no hard troop cap.

### Key Design Points
- **No army cap** — players can train unlimited soldiers (limited only by gold and upkeep costs)
- **Requires Base Tier 3+ (Keep)** — server-enforced; players must upgrade their base before commanding armies
- **Time-gated training** — gold is spent immediately; soldiers graduate after a training duration
  - Infantry: 5s/unit | Archers: 8s/unit | Cavalry: 20s/unit | Siege: 90s/unit | Elite Guard: 450s/unit
  - Barracks Lv2 = 20% faster, Lv3 = 35% faster, Lv4 = 50% faster, Lv5 = 65% faster
- **Balanced costs** — designed so Champion-rank players (10M–25M g/hr) can sustain ~20,000 infantry comfortably
  - Infantry: 2,000g recruit / 500g/hr upkeep
  - Archers: 3,000g / 750g/hr | Cavalry: 8,000g / 2,000g/hr
  - Siege: 30,000g / 8,000g/hr | Elite Guard: 100,000g / 30,000g/hr
- **Per-attacker raid cooldown** — 2-hour cooldown after each raid (tracked via `armyLastRaidAt` column)
- **Hero leads the army** — the player's equipped gear boosts their Str/Luck stats, which multiply army ATK in raids
  - `heroAtkBonus = 1 + Str/300` | `heroLuckBonus = 1 + Luck/500`
  - The Barracks UI shows these bonuses in real-time
- **Training queue UI** — dedicated "⏳ Training" tab shows in-progress batches with live progress bars and countdowns (auto-refreshes every 5s)

### DB Schema
- `armies` table — active troop counts per type (infantry/archer/cavalry/siege/elite_guard) + level
- `army_training_queue` table — in-flight training batches with `completesAt` timestamp
  - Graduated to `armies` automatically when GET /api/accounts/:id/army or the queue endpoint is called
- `army_raids` table — raid history with snapshots, events, losses, gold looted
- `accounts.armyLastRaidAt` — timestamp of attacker's last raid (for 2-hour cooldown enforcement)

## Game Math Reference (Audited & Fixed)

### HP Formula
`HP = raceBaseHP (75-140) + rankBaseHP (0-880) + Pot × 8 + Def × 5`

The `Def × 5` term was added to fix 1-hit-kill PvP at high stats. This makes Def dual-purpose (damage reduction + health pool). At equal stats, fights last ~8-9 rounds at any tier, keeping the 5-action turn system meaningful.

### Damage Formula
`rawDmg = Str × critMult × comboMult × empowerMult × raceBonusMult`
`defense = Def × 0.40 × (1 − raceDamageReduction)`
`hitDamage = max(rawDmg × 0.15, floor((rawDmg − defense) × (1 − shieldAbsorb)))`

The `rawDmg × 0.15` minimum damage floor (added in audit) prevents unkillable tank builds and ensures crits against heavy-armour opponents still feel impactful.

### Tower NPC Formula
`npcPower = 100 × 1.5^floor × levelProgress (1× at level 1, 2× at level 100)`
`npcStr = npcPower / 5`, `npcDef = npcPower × 0.16`, etc.

Changed from `5^floor` to `1.5^floor`. Floors 1-35 are naturally reachable through training; floors 36-50 require prestige multipliers (aspirational endgame).

| Floor | Boss NPC Str |
|-------|-------------|
| 10 | 1,153 |
| 20 | 66,505 |
| 30 | 3,835,021 |
| 35 | 29,122,192 (ML requirement) |
| 50 | 12,752,430,004 (prestige endgame) |

### Rank Requirements
Win counts unchanged. Floor requirements reduced to match 1.5× tower formula:
- Grandmaster: floor 12, Champion: floor 15, Overlord: floor 18
- Sovereign: floor 22, Ascendant: floor 26, Legend: floor 29
- Mythic: floor 32, Mythical Legend: floor 35

### Base Tier Rank Requirements (Fixed)
`BASE_TIER_RANK_REQUIREMENTS` previously had "Legend" (rank 12) before "Champion" (rank 8), making Tier 4→5 require a higher rank than Tier 5→6. Now fixed to be strictly increasing:
- Tier 1→2: Journeyman | Tier 2→3: Expert | Tier 3→4: Grandmaster
- Tier 4→5: Champion | Tier 5→6: Overlord | Tier 6→7: Ascendant | Tier 7→8: Mythical Legend

Barracks access now aligns with Tier 3 (Keep), which requires Expert rank — a natural mid-early-game milestone.

### PCG Quest Rewards
`reward = BASE_REWARD × rankRewardMult` where `rankRewardMult = 1.3^rankIndex`
(changed from `3.2^rankIndex` which reached 8.7 million× at ML)

Base rewards increased ~5×: trivial 2000g/50TP, easy 8000g/200TP, medium 30000g/750TP, hard 120000g/3000TP, legendary 500000g/12000TP.

## User Preferences

Preferred communication style: Simple, everyday language.

## Tech Stack

- **Frontend**: React 18 with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini (via Replit AI Integrations) for AI Game Master

## Project Structure

```
Legends-Of-Valor/
├── client/           # React frontend
│   └── src/          # React components and pages
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API routes (8000+ lines)
│   ├── db.ts         # Database connection
│   ├── storage.ts    # Data access layer
│   └── game-ai.ts    # AI Game Master integration
├── shared/           # Shared schemas and types
│   └── schema.ts     # Drizzle schema definitions
└── dist/             # Production build output
```

## V2 Features (All Implemented)

### PHASE 1: Race & Rank System
- 14 playable races (Human, Elf, Dwarf, Orc, Beastfolk, Mystic, Fae, Elemental, Undead, Demon, Draconic, Celestial, Aquatic, Titan)
- Male/female gender options per race (28 character variants)
- Max 2 players per race (28 players per server)
- Race-specific stat modifiers and elemental affinities
- 15 ranks: Novice → Mythical Legend with quintillion-safe power tiers

### PHASE 2: Combat System
- V2 turn-based PvP combat with Attack/Defend/Trick/Dodge/Ability (5 actions)
- Initiative system based on Speed stat
- **Tiered critical hits**: Normal (1.5×), Heavy (2.0×), Perfect (2.5×) — Luck + race bonus
- **Combo chain system**: Up to 5× consecutive attacks, each adding +12% damage per stack
- **Elemental reactions**: 20+ unique reactions when elements clash (e.g. Fire+Water=Steam Burst, Dark+Light=Void Collapse)
- **Status effect stacking**: Burn (3 stacks), Poison (5), Bleed (3) with max-HP-scaling DoT; Stun, Slow, Blind, Empower, Shield, Regen
- **14 unique race active abilities** with per-race cooldowns (3–5 rounds):
  - Human: Adaptability, Elf: Arcane Shot, Dwarf: Stone Fortress, Orc: Blood Frenzy
  - Beastfolk: Savage Lunge, Mystic: Nature's Wrath, Fae: Mirror Veil, Elemental: Elemental Surge
  - Undead: Necrotic Drain, Demon: Hellgate, Draconic: Dragon's Roar, Celestial: Divine Grace
  - Aquatic: Tidal Surge, Titan: Earthshatter
- Race passives (critBonus, lifeSteal, thorns, counter-attack, damage reduction) fully applied in PvP
- Death/revival mechanics with PvP drops and respawn

### PHASE 3: Pet/Bird/Fish Systems
- Unlimited pet ownership with 1 active in battle
- Pet bonding, evolution, and AI personalities
- Premium Pet Shop (Mystic Egg Emporium):
  - 6 egg tiers: Forest (500) → Celestial (250K rubies)
  - Higher tiers guarantee better stats and rare elements
  - Rank requirements from Journeyman to Mythical Legend
- Bird system with Beak Coins and tier progression
- Fish system for pet stat transfers

### PHASE 4: Base System
- 5 base tiers (Humble Camp → Fortress Castle)
- Tier costs: T1 Free, T2 500K, T3 5M, T4 50M, T5 500M gold
- 6 room types (Storage, Rest, Crafting, Training, Vault, Defenses)
- Defense system unlocks at T3 with progressive upgrades:
  - T3: Arrow Traps, Magical Wards
  - T4: Fire Pits, Reinforced Walls
  - T5: Arcane Sentinels, Dragon's Wrath
- Guard hiring: Militia (50K/day), Knights (250K/day, T4+), Archmages (1M/day, T5+)
- Auto-craft, auto-level, auto-upgrade automation
- Base raids scaling with Mystic Tower progress
- Weekly Hero/Joker events

### PHASE 5: World Map & Zones
- 15+ interactive zones with unique activities
- Zone mechanics: PvP toggle, fast travel gates, dynamic events
- 5-tier zone difficulty (Starter → Hell)
- Hunting and gathering with efficiency scaling
- New functional zones with rank requirements:
  - Mountain Caverns (Apprentice): Mining copper → adamantite
  - Ruby Mines (Expert): Ruby mining with PvP encounters
  - Hell Zone (Grand Master): High-risk challenges with massive rewards
  - Mystic Egg Emporium (Journeyman): Premium pet shop

### PHASE 6: Economy
- Player trading system
- Admin auction house (8hr bidding)
- Guild shops with progressive unlocks
- $Valor currency packs
- Dynamic market economy: supply/demand tracking in economy-system.ts
  - recordPurchase/recordSale update real-time item prices (0.5x–2.0x base)
  - Shop shows ↑/↓ trend indicators with "Market Trends" panel
  - Price trend sidebar showing hot and discounted items

### PHASE 7: AI Story Guide
- 4-Act storyline (Awakening, Fractured Realms, Hell Zone, Convergence War)
- Companion personalities (friendly/sarcastic/serious/mysterious)
- Act gates enforcing rank/floor/previous act requirements
- Replay logic preventing duplicate rewards

### PHASE 8: Achievements & Hidden Mechanics
- 27 achievements with auto-unlock checking
- Claimed tracking to prevent duplicate rewards
- Hidden triggers with one-time and repeatable events
- Quintillion-safe BigInt stat formulas

### PHASE 9: QoL & Expanded Content
- Auto-loot/gather player settings
- Notification preferences
- Mystic Tower: 100 floors × 100 levels (10,000 battles)
- Rank-gated progression with floor bosses
- Hell Zone: 10% death tax, 50% anti-heal, mythic drops

### PHASE 10: Admin & Endgame
- Admin dashboard with server stats
- Full account/stats/story/ban management
- Resource granting and rank setting
- 8 cosmetic mounts with unlock requirements
- Mythical Legend ascension requirements
- Quintillion power milestones
- Admin teleport: POST /api/admin/teleport-player sets player respawnLocation
- Admin force-end challenge: POST /api/admin/challenges/:id/force-end

### Guild Application System
- `guild_applications` table: applicantId, guildId, status (pending/approved/rejected), createdAt
- POST /api/guilds/:guildId/apply — unguilded player submits a join application
- GET /api/accounts/:accountId/guild-application — get player's pending application
- DELETE /api/guild-applications/:applicationId — cancel own pending application
- GET /api/guilds/:guildId/applications?requesterId= — list pending applications (leader/officer only)
- PATCH /api/guild-applications/:applicationId/respond — approve (adds member) or reject (leader/officer only)
- GET /api/guilds now returns memberCount per guild
- Browse Guilds section in unguilded Guild Hall: lists all guilds with name, level, member count, Apply button
- Pending application status card with Cancel button for unguilded players
- Applications management section (leaders/officers): shows applicants with rank/race, Approve/Reject buttons

### PHASE 11: Recent Additions (Session 5)
- Weather spawn modifiers: thunderstorm +boss ×3, rain +elite ×1.8, fog +champion ×2, blizzard +boss ×2
- Status effects in combat: stun (😵), freeze (🧊), silence (🔇) — 20% boss/champion chance
- Death penalty display modal: shows gold lost + equipment durability damage
- Pet HP bar + fainting mechanic: pets take 10% of player damage, faint when HP=0
- GET /api/accounts/:id/pet/revival-cost endpoint
- Faction Reputation system: 4 factions (Merchants, Warriors, Scholars, Naturalists)
  - reputationData jsonb field in accounts table
  - GET/POST /api/accounts/:id/reputation and /reputation/gain
  - /reputation page with progress bars and unlock rewards
  - 🏅 Rep button in HUD menu
- Offline Training UI in base.tsx: start/collect with 10s refresh
- Race bonus display + elemental race element picker in registration
- Schema: accounts.reputationData (jsonb)

## Running the Project

Development:
```bash
cd Legends-Of-Valor && npm run dev
```

Production build:
```bash
cd Legends-Of-Valor && npm run build && npm run start
```

## Key API Endpoints

### Accounts & Characters
- `GET /api/races/availability` - Race selection and modifiers
- `POST /api/accounts` - Create account with race/gender
- `GET /api/accounts/:id` - Get account details

### Combat
- `POST /api/v2/combat/battle` - Turn-based combat
- `POST /api/accounts/:id/tower-battle` - Mystic Tower battles

### World & Zones
- `GET /api/world-map` - Zone information
- `POST /api/zones/:id/hunt` - Hunt in zones
- `POST /api/zones/:id/gather` - Gather resources

### Hell Zone
- `POST /api/hell-zone/enter` - Enter Hell Zone
- `POST /api/hell-zone/battle` - Battle in Hell Zone
- `POST /api/hell-zone/heal` - Heal with anti-heal penalty

### Story & Progression
- `GET /api/story/acts` - Get story acts
- `POST /api/story/advance` - Advance story with gate checks
- `GET /api/accounts/:id/endgame-progress` - Endgame progress

### Admin
- `GET /api/admin/dashboard` - Server stats and analytics
- `POST /api/admin/set-story-progress` - Modify story progress
- `POST /api/admin/grant-resources` - Grant resources
- `POST /api/admin/broadcast` - Server-wide announcements

### PHASE 11: Enhanced Features (Jan 2026)
- **Voice TTS**: OpenAI voice option for AI Guide (tts-1 model)
- **Welcome Audio**: Personalized welcome message plays on login
- **Skins System**: Character, pet, bird, and base skins with rarity tiers
- **$Valor Shop**: 14 bundles ($0.99-$99.99) with auto-add to inventory
- **Achievements**: 1000+ achievements across 8 categories with progress tracking
- **Trophies**: 50 collectible trophies with claim system
- **Tournament System**: Knockout format with admin controls
- **Leaderboards**: Pet wins and base raid wins sections
- **Navigation**: World Map button on all game pages
- **Admin Dashboard**: Red/orange gradient theme with Tournaments and $Valor tabs

### PHASE 12: Battle Royale (Final V2 Feature)
- **Location**: Hell Zone tab accessible to Grand Master+ players
- **Admin Controls**: Open registration, start battle, close/cancel
- **Registration Phase**: Players register when admin opens, can unregister
- **Battle Phase**: Players locked in until eliminated or victory
- **Combat**: Manual target selection (choose who to attack)
- **Mechanics**: 
  - Damage based on STR, reduced by DEF
  - Counter damage when attacking
  - Critical hits based on Luck
  - Eliminated at 0 HP with placement tracking
- **Rewards (Top 5)**:
  - 1st: 10M gold, 5K rubies, 2K shards, 500 focused, 10K TP, 1K soul gins, 500 beak coins, 200 valor tokens
  - 2nd: 5M gold, 2.5K rubies, 1K shards, 250 focused, 5K TP
  - 3rd: 2.5M gold, 1.5K rubies, 500 shards, 100 focused, 2.5K TP
  - 4th: 1M gold, 750 rubies, 250 shards, 50 focused, 1K TP
  - 5th: 500K gold, 500 rubies, 100 shards, 500 TP

## PHASE 13: Casino System (May 2026)

### New DB tables
- `casino_history` — stores every game result (game type, bet, payout, netGain, outcome jsonb, indexed by accountId)
- `skill_tree_nodes` — tracks unlocked skill tree nodes per player (unique accountId+nodeId)

### Casino — `/casino` (The Golden Den)
Three server-side RNG games with rank-scaled bet limits (min 100 gold, max 500M at Mythical Legend):
- **Lucky Dice** — Pick HIGH (4-6) or LOW (1-3) → 1.9× payout (5% house edge); or exact number (1-6) → 5.5× payout (~8% house edge)
- **Card War** — Draw card 1-13 vs dealer; higher wins 1.9×, tie = push, lower = lose (~4.6% edge)
- **Fortune Wheel** — 20 segments: 12 lose, 5×1.9×, 2×3.5×, 1×10× jackpot
- Full game history and stats tracker (total wagered, net gain, biggest win)
- All randomness computed server-side (no client manipulation)

### Skill Tree — `/skill-tree` (Skill Sanctum)
210-node deep progression system for all 14 races:
- 3 branches per race: **Combat** (Str/damage/crit), **Mastery** (Def/dodge/lifesteal), **Ascension** (all-stats/gold/XP)
- 5 nodes per branch in a diamond pattern: T1 entry → T2a/T2b fork → T3 convergence → T4 Keystone
- Cost: 1/2/3/5 Training Points per tier
- Prerequisites enforced server-side; rank requirements enforced (Novice through Champion)
- **Passive stat bonuses automatically applied in combat** via `computeCombatStats` integration
- Accessible from Skills page (new "Skill Tree" tab) and World Map (Skill Sanctum zone)

### Navigation additions
- World Map: "The Golden Den" zone (casino) and "Skill Sanctum" zone (skill tree)
- Skills page: 5th tab "Skill Tree" with overview card + direct link

## PHASE 14: Modular Ability Workshop (May 2026)

### New DB tables
- `player_modifiers` — tracks each player's modifier crystal inventory (modifierId + quantity)
- `player_skills` extended — added `upgradeLevel` (integer, 0–5) and `attachedModifiers` (jsonb string[])

### Skill Workshop — `/skill-workshop`
Three-tab workshop for deep customisation of owned skills:

**Upgrade Tab:**
- Skills have 5 upgrade levels; each level multiplies spellPower (1.0→1.15→1.32→1.52→1.75→2.10×)
- Cooldown reduced by 1 at Lv 3, by 2 at Lv 5
- Extra modifier slot unlocked at Lv 3 and Lv 5
- Cost per rarity scales from 1K gold / 1 TP (Common Lv1) up to 1B gold / 25 TP (Mythic Lv5)

**Modifiers Tab:**
- 20 modifier crystals across 5 rarities: Common / Rare / Epic / Legendary / Mythic
- Common: Empowered (+20% power), Swift (-2 CDR), Burning (35% burn), Freezing (25% freeze), Mana Efficient (-30% mana)
- Rare: Piercing (25% DEF pierce), Critical Eye (+15% crit), Draining (+10% lifesteal), Fortifying (+20% DEF after cast), Poisonous (40% poison), Volatile (+40% dmg / 8% self dmg), Bleeding (30% bleed)
- Epic: Arcane Infusion (+30% / 10% DEF pierce), Runic (-3 CDR / -40% mana), Vampiric (+15% lifesteal / 20% stun), Divine Echo (25% dmg→heal), Explosive (strike twice)
- Legendary: Stoic Fury (+50% / -4 CDR / 20% pierce), Masterful (+40% / +20% crit / +12% lifesteal)
- Mythic: Transcendent (+65% / -5 CDR / -50% mana / +25% crit)
- Modifier slots per skill: Common/Uncommon = 1, Rare/Epic = 2, Legendary/Mythic = 3 (plus upgrade bonuses)
- Buy modifiers from the in-workshop shop using Soul Shards
- Attach/detach modifiers freely (detach returns to inventory)

**Fusion Tab:**
- Combine two skills of the same rarity → random skill of next rarity tier
- Common+Common → Uncommon (3 TP), Uncommon+Uncommon → Rare (5 TP), ..., Legendary → Mythic (50 TP)
- One modifier randomly inherited from source skills
- Both source skills consumed (irreversible, warned in UI)

### Combat integration
All 4 combat entry points (Tower, monster fight, NPC fight, dungeon) now call `applySkillModifiers()` from `skill-modifiers-data.ts` before building the spell object. Combat receives: adjusted spellPower, cooldown, critBoost, lifestealBoost, defPierce, selfDamagePct, statusEffects (with chance), aoeExtraHits, damageToHealing, defBoostAfterCast.

### Navigation
- World Map: "Skill Workshop" zone added at (35, 72)
- Skills page → Skill Tree tab: "⚗️ Workshop" button + description card

## PHASE 15: Prestige / Meta-Progression System (May 2026)

### New DB tables & columns
- `prestige_history` table — logs each prestige event (level, previous rank, gold kept, timestamp)
- `accounts.prestigeLevel` integer (0–10)
- `accounts.prestigeTokens` integer
- `accounts.permanentStatBonus` integer (additive % from shop Eternal Blessing)

### Prestige — `/prestige` (Hall of Legends on World Map)
Three-tab page for meta-progression beyond Mythical Legend rank:

**How it works:**
- Reach Mythical Legend (rank 15) → prestige once per full rank cycle
- Rank resets to Novice; gold kept = 5% × new prestige level (capped at 50%)
- Training Points, Story Act, and Tower floor reset
- Everything else (pets, skills, skill upgrades/mods, guild, base, skins) persists forever

**10 Prestige Tiers — cumulative permanent bonuses:**
| P | Title | Stat Mult | Gold | XP | TP | Crit | Lifesteal | Tokens |
|---|-------|-----------|------|----|----|------|-----------|--------|
| 1 | Reborn         | +10% | +15% | —   | —   | —   | —   | 1 |
| 2 | Twice-Forged   | +20% | +30% | +20%| —   | —   | —   | 1 |
| 3 | Thrice-Risen   | +30% | +40% | +40%| —   | +5% | —   | 2 |
| 4 | Veteran Soul   | +40% | +50% | +60%| +25%| +5% | —   | 1 |
| 5 | Ascendant Soul | +55% | +60% | +60%| +50%| +5% | +2% | 2 |
| 6 | Ancient        | +65% | +70% | +85%|+100%| +10%| +2% | 2 |
| 7 | Eternal        | +75% | +80% | +85%|+100%| +15%| +4% | 2 |
| 8 | Undying        | +85% | +95% |+110%|+150%| +15%| +6% | 2 |
| 9 | Myth-Walker    | +95% |+105% |+160%|+150%| +20%| +8% | 3 |
| 10| Legend Reborn  |+100% |+115% |+160%|+200%| +25%|+10% | 5 |

**Prestige Shop (Prestige Tokens):**
- Soul Infusion (1T) → 1,000 Soul Shards
- Gold Surge (1T) → 500K gold
- TP Surge (1T) → 200 Training Points
- Legendary Tome (3T) → random Legendary skill
- Ruby Cache (2T) → 5,000 Rubies
- Eternal Blessing (4T, P5+) → permanent +3% all stats (stackable ×5)
- Mythic Scroll (8T, P7+) → random Mythic skill
- Legend's Brand (5T, P10) → exclusive cosmetic title

**Combat integration:**
`computeCombatStats` now applies `getPrestigeStatMult(prestigeLevel) × (1 + permanentStatBonus/100)` to all 5 base stats (Str, Def, Spd, Int, Luck) before returning. Prestige 10 alone doubles all stats.

### Navigation
- World Map: "Hall of Legends" zone (hell-tier, top-center at 50, 15)

## PHASE 16: Shadow Echoes (May 2026)

### New DB table
- `player_snapshots` — one row per player, upserted whenever they visit the Shadow Realm (or win a fight)
  - Stores: username, race, rank, prestige level, computed stats, equipped skill IDs, detected strategy profile, echo W/L record

### Shadow Echoes — `/shadow-echoes` (Shadow Realm on World Map)

**Concept:** Every player who enters the Shadow Realm registers an AI "Shadow Echo" — a fully-accurate clone of their current build, stat-for-stat, skill-for-skill — that other players can fight at any time.

**Strategy Profile Detection (auto from build):**
- `berserker` — very high Str + 2+ damage skills
- `mage` — Int > Str × 1.5 + at least 1 skill
- `defensive` — 2+ heal or buff skills
- `aggressive` — 3+ damage/AOE skills
- `balanced` — default

**Combat Simulator (`shared/shadow-echo-combat.ts`):**
- Fully server-side, auto-resolved in a single POST — no round-trip
- Both combatants act each round (speed determines order within round)
- AI selects: attack / defend / dodge / skill — weighted by strategy profile
- Skill AI: offensive, heal, and buff skills selected from pool, respecting cooldowns and mana
- Status effects: burn, poison, regen, stun, freeze, shield, stat boosts — all tick each round
- Crit rolls: `min(40%, 5% + Luck/400)`
- Shield absorption before HP damage
- 25-round cap; timed out → highest HP% wins
- Reward scaling: `(rankIndex + 1) × 5,000 gold × (1 + prestige)` on victory

**API Routes:**
- `POST /api/accounts/:id/snapshot` — capture/refresh player's echo snapshot
- `GET /api/shadow-echoes?rank=&exclude=` — browse available echoes
- `GET /api/shadow-echoes/mine/:accountId` — own echo status
- `POST /api/shadow-echoes/:snapshotId/battle` — run battle, award gold + shards to winner

**Frontend features:**
- Rank filter dropdown + difficulty indicator (Easy/Fair/Dangerous vs your rank)
- Echo profile card: stats grid, strategy badge, W/L record, reward preview
- Battle log with animated replay (350ms/event) + HP bars updating in real-time
- Rematch button

### Navigation
- World Map: "Shadow Realm" zone (hard, east side at 78, 35)

## PHASE 17: Alternate Dimensions (May 2026)

### New DB tables
- `dimension_portals` — tracks open portals per player (24-hour expiry, 1 use each)
- `dimension_runs` — tracks in-progress and completed dimension runs with per-encounter results (JSONB)

### Alternate Dimensions — `/dimensions` (Portal Nexus on World Map)

**Concept:** Dimensional portals open rare rifts to 7 alternate realms, each with unique physics-bending combat rules, 5-encounter gauntlets, and exclusive currencies.

**Portal Access:**
- `🔍 Scan` — 6% random chance to open a portal (free, cooldown-free)
- `💫 Force Open` — spend 500 runes to guarantee a portal immediately
- Portals expire in 24 hours, single-use
- Portal dimension is random (weighted by player rank — higher ranks unlock harder dimensions)

**The 7 Dimensions:**

| Dimension | Min Rank | Rules | Currency |
|---|---|---|---|
| 🌑 The Void | Novice | Void Gravity (Spd ÷2, Def ×1.5, Str +30%), no Defend action | Void Crystal |
| 🔥 Inferno Realm | Expert | Every hit applies burn, healing halved | Ember Shard |
| ⏳ Temporal Rift | Master | Enemy gains +12% ATK per 3 rounds — end fights fast | Chrono Fragment |
| 💎 Crystal Labyrinth | Grandmaster | Physical = 0 damage (skills only), mana costs ×2 | Crystal Essence |
| 🪞 Shadow Mirror | Champion | Enemies mirror your own stats (80-120% of yours) | Mirror Shard |
| ✨ Celestial Plane | Overlord | Regular attacks heal the enemy (+30%) — use skills | Stardust |
| ☠️ Corruption Abyss | Ascendant | 35% chance every skill backfires onto yourself | Corruption Essence |

**Run Structure:**
- 5 encounters: encounters 1-3 (mobs) → encounter 4 (mini-boss) → encounter 5 (boss)
- Each encounter is auto-resolved (same engine as Shadow Echoes, with dimension modifiers)
- Player HP carries between encounters, recovering +20% max HP after each fight
- Rewards accumulate mid-run (gold + soul shards / special currency)
- `Flee` at any time after a won encounter to keep accumulated rewards

**Dimension-Specific Rules (applied to combat engine):**
- `void_gravity` — player Spd ×0.5, enemy Def ×1.5, player Str ×1.3
- `no_defense_action` — Defend action disabled for both sides
- `burn_on_hit` — every hit from either side applies 2-round burn DoT
- `no_heal` — all healing effects halved
- `time_pressure` — enemy ATK multiplier escalates +12% per 3 rounds elapsed
- `magic_only` — physical attacks deal 0 damage (only skills can damage)
- `double_mana` — all skill mana costs ×2
- `mirror_enemy` — enemy stats built from player's own stats × template.statScale
- `holy_inversion` — regular attacks restore 30% of dealt damage as enemy HP
- `chaos_backfire` — 35% chance each skill activation hits the caster instead

**Reward Scaling:**
- Base: `rankIndex × 2,000 × lootBonus × bossMultiplier` gold per fight
- Boss fight: ×5 bonus; Mini-boss: ×2 bonus
- Soul shards: same formula scaled smaller
- Special currency (per-dimension) used for future upgrades / crafting

**API Routes:**
- `GET /api/accounts/:id/portals` — list active portals (auto-expires old ones)
- `POST /api/accounts/:id/portals/scan` — 6% chance portal generation
- `POST /api/accounts/:id/portals/force` — guaranteed portal (500 runes)
- `POST /api/portals/:portalId/enter` — create dimension run
- `GET /api/dimension-runs/:runId` — run state
- `POST /api/dimension-runs/:runId/next` — resolve next encounter (full auto-combat)
- `POST /api/dimension-runs/:runId/flee` — exit, keep rewards so far

**Frontend features:**
- Portals tab: active portals with countdown timers + dimension rule previews + enter button
- Dimension Library tab: all 7 dimensions with expandable lore, rules, and reward details
- Active Run tab: encounter progress dots (mob/mini-boss/boss labeled), animated battle log (300ms/event), live HP tracking, flee button showing current earned gold
- Run complete / fled / failed screen with full reward summary

### Navigation
- World Map: "Portal Nexus" zone (hard, center-right at 62, 52)

## PHASE 18: Army System (May 2026)

### New DB tables
- `armies` — one row per soldier type per player (type, count, level)
- `army_raids` — full raid history with army snapshots, events, losses, loot

### New account fields
- `peaceShieldExpires` — timestamp; protects from raids for 8 hours after being attacked
- `armyLastCheckedAt` — used for upkeep calculation

### Army System — `/barracks` (War Front on World Map)

**Concept:** Build a Barracks at your base (Tier 5+), recruit soldiers, level them up, and raid other players' bases to steal their gold. Defenders get an 8-hour peace shield after each successful raid.

**Barracks Room (Base Integration):**
- Unlocks at Base Tier 5 (Castle) — reduced from Tier 7
- Level 1-5 sets army cap: Lv1=60, Lv2=120, Lv3=200, Lv4=300, Lv5=400 soldiers
- Base dialog shows troop types + "Open Barracks →" button linking to `/barracks`

**5 Soldier Types (Rock-Paper-Scissors system):**

| Type | Icon | Beats | Weak to | Gold/unit | Upkeep/hr | Unlock |
|---|---|---|---|---|---|---|
| Infantry | 🗡️ | Cavalry (1.5×) | Archers (0.65×) | 200 | 2 | Barracks Lv1 |
| Archers | 🏹 | Infantry (1.5×) | Cavalry (0.65×) | 300 | 3 | Barracks Lv1 |
| Cavalry | 🐴 | Archers (1.5×) | Infantry (0.65×) | 500 | 5 | Barracks Lv2 |
| Siege Engines | 💣 | Defenses (2.5×) | Inf/Cav (0.65×) | 1,200 | 12 | Barracks Lv3 |
| Elite Guard | ⚔️ | No weakness | No weakness | 5,000 | 40 | Barracks Lv5, max 50 |

**Troop Training (levels 1-10):**
- Each soldier type can be leveled 1-10 independently
- Costs scale quadratically: `base × level²` gold + `base/100 × level²` Training Points
- Each level increases ATK, DEF, and HP

**Upkeep & Desertion:**
- Soldiers require gold upkeep per hour (checked each time army page is loaded)
- If you can't afford upkeep: cheapest troops desert first until the bill is covered
- Max upkeep charge per load: 24 hours of back-pay

**Raid System:**
- Target browser: players within ±2 ranks of yours, with gold > 5,000, no peace shield
- Raid resolves instantly: 3 combat waves with full event log
- RPS counters applied per type matchup
- Attacker's Str/Luck provides hero ATK bonus to army
- Defender's Defense room level = passive tower troops (reduced 65% if attacker has Siege)
- Victory: steal 25% of defender's gold; defender gets 8-hour peace shield
- Defeat: no loot; attacker still takes losses
- All losses applied immediately to both armies after battle

**API Routes:**
- `GET /api/accounts/:id/army` — get army (runs upkeep check on load)
- `POST /api/accounts/:id/army/recruit` — recruit soldiers (gold cost, cap enforced)
- `POST /api/accounts/:id/army/train` — level up a troop type (gold + TP)
- `GET /api/army/raid-targets?accountId=` — nearby-rank targets without peace shield
- `POST /api/army/raid` — execute raid (full auto-resolution, returns events)
- `GET /api/accounts/:id/raid-history` — past raids as attacker and defender

**Frontend features:**
- **My Army tab**: recruit widgets with RPS counter tags, per-type count display, upkeep readout
- **Train Troops tab**: level-up bars, current vs next-level stats, gold+TP costs
- **Launch Raid tab**: enemy base cards showing army composition + defense level, raid button
- **Battle Reports tab**: color-coded wins/losses, per-wave event log, gold gained/lost

### Navigation
- World Map: "War Front" zone (hard, PvP, center at 48, 68)

## PHASE 19: Genetic Traits (May 2026)

### New DB field
- `geneticTraits: jsonb` on accounts — array of 3 trait ID strings, assigned at creation

### Genetic Traits System — `/traits` (Trait Shrine on World Map)

**Concept:** Every player is permanently assigned 3 genetic traits at character creation. These traits cannot be changed or re-rolled. Rarity ranges from Common to Mythic, with the third trait slot having the best odds of rare results. Traits stack multiplicatively with race bonuses, prestige multipliers, skill tree passives, and equipment stats.

**38 Total Traits across 6 Rarities:**

| Rarity | Count | Approximate Drop Rate | Typical Effect |
|---|---|---|---|
| Common | 10 | ~40% | +6–12% to a single stat or mechanic |
| Uncommon | 10 | ~29% | +10–20% with dual effects |
| Rare | 9 | ~19% | 2–3 effects including special combat keys |
| Epic | 6 | ~9% | Major multi-stat boosts or unique mechanics |
| Legendary | 4 | ~2.3% | Game-changing passives (undying will, true sight, etc.) |
| Mythic | 2 | ~0.7% | Genesis Blood (+25% all stats), The Chosen One |

**Slot Roll Distribution:**
- Slot 1: 70% Common / 25% Uncommon / 5% Rare
- Slot 2: 35% Common / 35% Uncommon / 22% Rare / 8% Epic
- Slot 3: 15% Common / 28% Uncommon / 30% Rare / 18% Epic / 7% Legendary / 2% Mythic

**6 Trait Categories:**
- Combat — ATK, DEF, SPD, crit, dodge, lifesteal
- Resilience — max HP, defence, healing
- Progression — XP multipliers
- Fortune — gold multipliers, shard drops, Luck
- Mystical — Int, mana pool, skill damage
- Legendary — unique special effects

**Notable Special Traits:**
- `undying_will`: Survive a killing blow with 1 HP — once per battle
- `true_sight`: Attacks cannot be dodged; crits deal +50% extra damage
- `bloodline_of_champions`: +18% all stats, +20% XP, +15% gold
- `dimensional_anchor`: Immune to all debuffs + status effects
- `genesis_blood`: +25% all stats, +25% XP, +20% gold — Mythic
- `the_chosen_one`: +20% all stats, +50% Luck, +50% shard drops — Mythic

**Combat Injection:**
Trait stat multipliers are applied at 4 injection points:
1. `computeCombatStats()` — PvP challenge combat
2. NPC tower battle (`/api/accounts/:id/npc-battle`) — stats + reward multipliers
3. Monster zone fight (`/api/accounts/:id/zones/:zoneId/fight-monster`)
4. NPC world fight (`/api/accounts/:id/zones/:zoneId/fight-npc`)

Gold and shard rewards from tower fights are multiplied by `goldMult` and `shardMult` from the player's active traits.

**Retroactive Assignment:**
Existing accounts without traits are automatically assigned on their first visit to `/api/accounts/:id/traits`. The POST `/api/accounts/:id/traits/assign` endpoint allows explicit assignment for accounts that bypassed the lazy check.

**API Routes:**
- `GET /api/accounts/:id/traits` — fetch traits (auto-assigns if none)
- `POST /api/accounts/:id/traits/assign` — explicit one-time assignment

**Frontend `/traits`:**
- Header showing "Genetic Blueprint"
- 3 full trait cards with rarity gradients, icons, lore, and effect badges
- Combined Bonus Summary section listing every active effect
- Collapsible Trait Codex showing all 38 traits (filterable by rarity)
- "How it works" explainer section

### Navigation
- World Map: "Trait Shrine" zone (easy, no PvP, at 22, 42)

## PHASE 20: Procedural Content Generation (May 2026)

### New DB Tables
- `player_quests` — accepted/completed/abandoned procedural quests per player (objective JSONB with baseline tracking)
- `world_events` — server-wide timed bonus events (persistent, active flag, effects JSONB)

### New Shared File
- `shared/pcg-templates.ts` — all PCG logic: quest templates (30), enemy archetypes (20), loot tables (6 tiers), world event types (12), generators, validators

### Quest Board System — `/quest-board` (Quest Board on World Map)

**Concept:** Every player gets a procedurally generated board of 6 quests scaled to their current rank. Quests fall into 5 categories (combat, progression, wealth, exploration, mastery) and 5 difficulties (trivial → legendary). Objectives are verified against live account state using baseline snapshots captured at accept time.

**Quest Objective Types:**
- `win_battles` — win X battles since acceptance (delta from baseline)
- `reach_rank` — achieve a target rank
- `climb_floors` — reach NPC tower floor X
- `train_stat` — raise a specific stat to X
- `earn_gold` — hold X gold
- `collect_shards` — hold X soul shards
- `upgrade_base` — reach base tier X
- `reach_prestige` — reach prestige level X
- `defeat_npc_level` — reach NPC global level X in tower

**Reward Scaling:** Base rewards × `Math.pow(3.2, rankIndex)` — ensures meaningful rewards at every tier.

**API Routes:**
- `GET /api/pcg/quest-board?accountId=&seed=` — generate fresh board of 6 quests
- `POST /api/pcg/quests/accept` — accept a quest (saves with baseline snapshot)
- `GET /api/pcg/quests/active?accountId=` — active quests with live progress
- `POST /api/pcg/quests/:id/complete` — validate + claim rewards
- `POST /api/pcg/quests/:id/abandon` — abandon
- `GET /api/pcg/quests/history?accountId=` — completed/abandoned history
- `GET /api/pcg/enemies?rank=&difficulty=&archetypeId=` — generate single enemy
- `GET /api/pcg/encounter?rank=&zone=&difficulty=` — generate 1–4 enemy encounter
- `GET /api/pcg/loot?tier=&rank=` — roll loot bundle
- `GET /api/pcg/world-events` — current active world events
- `POST /api/pcg/world-events/generate` — admin: force generate a new event

### Enemy Generator
20 archetypes across 6 families (Undead, Beast, Elemental, Demon, Dragon, Humanoid). Each archetype has stat ratios, ability pool, immunities, loot tier. Stats scale with `Math.pow(2.5, rankIndex)` × difficulty multiplier × ±10% jitter.

### World Events
12 event types that apply server-wide bonuses (goldMult, xpMult, shardMult, tpMult, runeMult, luckBonus, atkBonus, defBonus, pvpGoldMult, skillDamageMult, hpMult). Events auto-seed on server start (1 initial event), auto-generate every 3 hours if < 2 are active. Quest rewards respect active event multipliers at claim time. In-memory cache with 60s TTL for zero-latency bonus lookups.

**Active events:** displayed as a banner on the Quest Board and in the World Events tab.

### Frontend `/quest-board`
- 4-tab UI: Available | Active | Completed | World Events
- Available: 6 ranked quest cards with difficulty color coding, expandable descriptions, reward badges, Accept button; "Refresh Board" for new quests
- Active: progress bars (current/required), Check Progress + Claim buttons, abandon option
- Completed: scrollable history with status (Completed ✓ / Abandoned ✗)
- World Events: live event cards with countdown timers, event reference table showing all 12 possible events
- Active event banner persists across all tabs

### Navigation
- World Map: "Quest Board" zone (easy, no PvP, at 38, 28)

## Recent Changes

- May 2026: PCG system (30 quest templates, 20 enemy archetypes, 12 world events, loot tables, `/quest-board` page)
- May 2026: Genetic Traits (38 traits, 6 rarities, permanent at creation, full combat injection)
- May 2026: Army system (5 soldier types, RPS combat, raids, upkeep, peace shields)
- May 2026: Alternate Dimensions (7 realms, dimension-specific combat rules, portals, 5-encounter runs)
- May 2026: Shadow Echoes system (AI player clones, strategy profiles, auto-combat simulator)
- May 2026: Prestige system (10 tiers, permanent bonuses, shop, combat integration)
- May 2026: Modular ability workshop (upgrade / modifiers / fusion), combat modifier integration
- May 2026: Casino system (3 games + history), Skill Tree (210 nodes × 14 races), passive combat integration
- January 2026: Complete V2 implementation
- Phase 11: Voice TTS, skins, $Valor shop, 1000+ achievements, tournaments
- 14 races × 2 genders with stat modifiers
- 15-rank progression system
- Mystic Tower expanded to 100×100 (10K battles)
- Hell Zone with battle royale mechanics
- Endgame Mythical Legend ascension
- Comprehensive admin dashboard with enhanced styling
- Quintillion-safe stat formulas with BigInt
- **Bug Fix**: Race modifiers now only apply at registration (not doubled in combat)
- **$Valor Shop**: Full purchase system with token deduction and reward granting
- **Cosmetics Shop**: Character/pet/bird/base skins via skin tickets or rubies
- **Pet Egg System**: Tier-based hatching (basic/rare/epic/mythic eggs → pets)
- **Fishing Bait**: Consuming bait provides 15% boost to rare fish chances
- **VIP Display**: Crown icon next to username when VIP status is active
- **Admin $Valor Grant**: Admins can grant $Valor tokens to players
- **Expanded Cosmetics Shop**: 24 character skins, 22 pet skins, 22 bird skins, 22 base skins (90+ total)
- **Skin Equip System**: Character skins update the player's portrait when equipped
- **Tournament Player UI**: Full tournament page at /tournaments with join, view brackets, and auto-refresh. Tournament Grounds zone added to World Map
- **Battle Royale**: Full PvP mode in Hell Zone with admin controls, registration, target selection, elimination mechanics, and top 5 rewards (final V2 feature)
- **Auto-Achievements**: Automatic achievement/trophy unlocking based on player progress
- **Game Math Audit** (May 2026): Fixed calculateMaxHP (+Def×5), min damage floor (15%), tower NPC multiplier (5→1.5), rank floor requirements, PCG quest rewards (1.3^idx × 5× base)
- **In-Game Visual Overhaul** (May 2026): Added `GameBackground` component (canvas particle system with ember/orb effects + dimmed `races-battle.png`) injected into `GameViewport` for all in-game pages; redesigned `PageLayout` with cinematic ornate header (portrait frame, gold separators, zone title with Cinzel font, resource bars); enhanced HUD CSS (top bar blur, icon strip glow states, player panel, menu popup glassmorphism); page backgrounds now transparent to reveal atmospheric layer
