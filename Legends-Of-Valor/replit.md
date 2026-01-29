# Legends of Valor V2

## Overview

Legends of Valor is a text-based fantasy RPG with trading, combat, guild systems, and extensive progression mechanics. Players choose from 14 races with unique bonuses, progress through 15 ranks from Novice to Mythical Legend, explore 12 zones, climb a 10,000-battle Mystic Tower, and work toward endgame content with quintillion-scale power.

## User Preferences

Preferred communication style: Simple, everyday language.

## Tech Stack

- **Frontend**: React 18 with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI (via Replit AI Integrations) for AI Game Master

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
- V2 turn-based combat with Attack/Defend/Trick/Dodge actions
- Initiative system based on Speed stat
- Damage, defense, critical hit, and dodge mechanics
- Elemental stacking (x2 for 2 elements, x5 for 3+)
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

## Recent Changes

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
