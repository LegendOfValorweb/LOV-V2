# Legends of Valor V2

## Overview

Legends of Valor is a text-based fantasy RPG with trading, combat, guild systems, and extensive progression mechanics. Players choose from 14 races with unique bonuses, progress through 15 ranks from Novice to Mythical Legend, explore 12 zones, climb a 10,000-battle Mystic Tower, and work toward endgame content with quintillion-scale power.

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

## Recent Changes

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
