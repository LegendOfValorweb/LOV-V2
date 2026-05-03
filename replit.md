# Legends of Valor

An epic fantasy RPG game with trading, combat, and guild systems.

## Overview

Legends of Valor is a browser-based RPG game where players can:
- Collect legendary weapons, armor, and accessories
- Battle through 50 floors of the NPC Tower
- Join and manage guilds
- Trade with other players
- Chat with an AI Game Master for personalized storylines
- Participate in skill auctions and events

## Home Base (Whiteout Survival-Style)

The `/base` page is the post-login landing for players. It features:
- **CSS-drawn building portraits** — 10 unique building illustrations for Town Hall, Storage, Rest Area, Weapon Locker, Crafting Workshop, Training Grounds, Defense Tower, Vault, War Room, and Events Hall. Each is drawn with layered divs/gradients using no external images.
- **Visible level upgrades** — buildings grow taller, gain more windows, side towers, chimneys, and flags. Level tier (0–3) changes the illustration. Stars (★) at the bottom show level progress (Lv1 = 1★, max = 5★). Level badge shows Lv# or MAX in gold.
- **Sky gradients** — each building card has a unique atmospheric sky gradient (purple for Town Hall, warm brown for Storage, fiery orange for Crafting, etc.).
- **Glow effects** — glowing windows, forge openings, vault gold, and border glows based on the building's color theme.
- **Lock overlays** — locked buildings (not yet available at the player's base tier) are shown with lock icon and tier requirement.
- **Portrait layout** — 5-column grid over the base backdrop image, scrollable.
- **Per-building dialogs** — tapping any unlocked portrait opens a full dialog with that building's functionality.

## Tech Stack

- **Frontend**: React 18 with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI (via Replit AI Integrations) for game AI interactions

## Project Structure

```
Legends-Of-Valor/
├── client/           # React frontend
│   └── src/          # React components and pages
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API routes
│   ├── db.ts         # Database connection
│   ├── storage.ts    # Data access layer
│   └── game-ai.ts    # AI Game Master integration
├── shared/           # Shared schemas and types
│   └── schema.ts     # Drizzle schema definitions
└── dist/             # Production build output
```

## Key Features

- **Authentication**: Player and admin login systems
- **Shop System**: Buy and sell items with different rarity tiers
- **Combat System**: PvP challenges and NPC tower progression
- **Pet System**: Collect and evolve pets with elemental powers
- **Guild System**: Create/join guilds, guild dungeons, and bank
- **Trading System**: Player-to-player trades
- **Event System**: Admin-created events with registrations
- **Quest System**: AI-generated quests with rewards
- **Skill Auction**: Bid on special skills

## Running the Project

Development:
```bash
cd Legends-Of-Valor && npm run dev
```

Production build:
```bash
cd Legends-Of-Valor && npm run build && npm run start
```

Database migration:
```bash
cd Legends-Of-Valor && npm run db:push
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-configured via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (auto-configured via Replit AI Integrations)

## Recent Changes

- May 2026: Fixed 6 frontend/backend mismatches:
  - **Research Lab** — `handleResearch` now calls `POST /api/accounts/:id/research` (deducts gold, boosts stat, grants TP); `handleCraft` calls same route with goldCost only; enchanting tab replaced with redirect to Inventory (real enchanting via Soul Shards)
  - **Ancient Ruins** — `handleExplore` now calls `POST /api/ancient-ruins/explore` instead of the old mining endpoint with unsupported override params
  - **Race Skills tab** — New 4th tab added to `/skills` page: fetches `/api/accounts/:id/race-skills`, shows all race skills with equip-active / equip-passive / unequip buttons
  - **Mounts Stable** — New 🐴 Mounts button in the Base HUD bar opens a full dialog fetching `/api/mounts` and `/api/accounts/:id/mounts`; supports unlock and equip actions
  - **Soul Links** — New Soul Links card section added to `/guild` page; fetches `/api/soul-links/:accountId` and supports creating new links via `POST /api/soul-links`
  - **Backend routes added** — `POST /api/accounts/:id/research` and `POST /api/ancient-ruins/explore` added to `routes.ts`

- January 2026: Initial import and setup in Replit environment
- Configured OpenAI AI integration for game AI features
- Set up PostgreSQL database with Drizzle ORM
- **V2 Phase 1: Race System** - Added 14 playable races (Human, Elf, Dwarf, Orc, Beastfolk, Mystic, Fae, Elemental, Undead, Demon, Draconic, Celestial, Aquatic, Titan) with male/female gender options
- **V2 Phase 1: Rank System** - Expanded to 15 ranks (Novice → Mythical Legend) with quintillion-safe power scaling
- Race stat modifiers affect starting stats based on racial bonuses
- Max 2 players per race limit enforced server-side
- Max 28 players per server (2 per race x 14 races)

## V2 Features

### Implemented
- 14 races x 2 genders = 28 character variants
- Race-based stat modifiers (STR, DEF, SPD, INT, LCK)
- Race availability tracking and selection UI
- New currencies: Soul Gins, Beak Coins, Valor Tokens
- Story progression tracking (Acts 1-4)
- 28 static race portraits for character customization
- V2 Combat Engine with turn-based mechanics:
  - Initiative system (Speed-based turn order)
  - HP calculation based on STR/DEF/Level
  - Damage formulas with DEF reduction
  - Critical hit mechanics (Luck-based)
  - Elemental stacking (x2 for 2 elements, x5 for 3+)
  - 4 combat actions: Attack, Defend, Trick, Dodge
  - Race stat modifiers applied in combat
- World Map with 12 interactive zones (Capital City, Mystic Tower, Mountain Caverns, Ancient Ruins, Research Lab, Pet Training, Ruby Mines, Enchanted Forest, Battle Arena, Crystal Lake, Coastal Village, Hell Zone)
- Base/Home System with 5 tiers (Humble Camp → Fortress Castle) and 6 room types (Storage, Rest, Crafting, Training, Vault, Defenses)
- Zone backdrops: shop (marketplace), fishing (lake), base (castle), arena, tower, pets (training grounds)
- World map is central hub after login with player avatar display, quick travel, and zone navigation

### Session 7 Features (February 2026)
- Tutorial overlay (9-step interactive guide) shown to new players on first world-map visit
  - Covers race/stats, combat, NPC tower, pets, world, guilds, economy
  - Skip button available; progress dots navigation; marks complete via POST /api/ai/tutorial/:id/complete
- Scroll fix: achievements, leaderboard, events, tournaments, quests pages all use game-page-scroll class
- NPC race patch: existing NPC accounts without a race auto-updated on startup

### Session 5-6 Features (February 2026)
- Weather-based spawn modifiers: thunderstorm 3× boss, rain 1.8× elite, fog 2× champion, blizzard 2× boss
- Status effects in NPC combat: stun (😵), freeze (🧊 -50% power), silence (🔇 disables spells)
- Death penalty modal on combat loss + pet HP bar + pet fainting display in NPC battle
- Market price trend indicators (↑/↓) in shop with live market price API
- Faction reputation system: 4 factions (Merchants, Warriors, Scholars, Nature Wardens) with progress bars
  - /reputation page accessible from HUD menu
- Admin tools: Teleport Player dialog + Force-End Challenge button in admin panel
- Offline training UI in base with start/collect buttons and 10s status refresh
- Elemental race registration: element picker + race bonus display in registration form
- NPC Tower scrollable layout with fight button prominently at top of card
- Fixed server crash: authMiddleware now uses optional chaining for req.cookies

### Bug Fixes (January 2026)
- Fixed data persistence: Account data now fetches fresh from server on re-login
- Fixed base page: Imports canonical playerRanks from schema to prevent rank display drift
- Fixed tournament system: Full CRUD with multiple reward types (gold, rubies, soulShards, trainingPoints)
- Fixed null safety: Added proper null checks in cosmetics-shop, achievements, tournaments pages
- Fixed type safety: Added type guards in pets.tsx to prevent runtime errors
- Fixed name truncation: Improved display of long names in leaderboard (12 chars) and tournaments (8 chars)
- Fixed trade batching: addItemsMutation now handles partial failures gracefully
- Removed unused code: Cleaned up admin.tsx unused functions
