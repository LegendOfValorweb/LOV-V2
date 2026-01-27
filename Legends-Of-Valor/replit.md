# Legend of Valor - RPG Item Shop

## Overview

Legend of Valor is a fantasy RPG item shop web application where players can browse, purchase, and manage inventory items across multiple rarity tiers. The system supports two user roles: players who shop and manage their inventory, and admins who can manage items and give items to players. The application features a dark fantasy gaming aesthetic inspired by games like Diablo and Path of Exile.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: React Context API for game state (accounts, inventory, gold), TanStack Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark fantasy theme, Cinzel font for headings, Inter for body text

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Design**: RESTful JSON API with routes for accounts, inventory, and items
- **Validation**: Zod schemas for request/response validation
- **Build System**: Vite for frontend bundling, esbuild for server bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all database tables and Zod schemas
- **Tables**: `accounts` (users with roles and gold), `inventory_items` (purchased items linked to accounts)
- **Items Data**: Static item definitions stored in `client/src/lib/items-data.ts` (not in database)

### Key Design Patterns
- **Shared Types**: The `shared/` directory contains schema definitions used by both client and server
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared directory
- **Component Structure**: UI primitives in `components/ui/`, feature components at `components/` root
- **Page-based Routing**: Pages in `pages/` directory (landing, shop, inventory, admin)

### Item Tier System
Items are categorized into five rarity tiers with distinct visual styling:
- Normal (gray/green)
- Super Rare (purple)
- X-tier (gold)
- UMR (red)
- SSUMR (pink) - highest tier

### Authentication Model
Username and password authentication. New accounts are created on first login with the chosen password. Existing accounts require the correct password. The admin account has specific credentials (username: "Napoleon", password: "Iamadmin").

### Player Resources
Players have multiple resources tracked:
- **Gold**: Main currency for purchasing items
- **Rubies**: Premium currency
- **Soul Shards**: Used to train pet stats (10 shards per stat point)
- **Focused Shards**: Rare crafting resource  
- **Training Points (TP)**: Used to train base stats (10 TP per stat point)
- **Pets**: Collection of pet companions

All resources can be modified by admins through the admin panel.

### Stat Training System
**Base Stats (Inventory Page)**:
- Players can spend Training Points to permanently increase base stats
- Stats: Str, Def, Spd, Int, Luck
- Cost: 10 TP per stat point
- Buttons: +1, +10, +100, +1000

**Pet Stats (Pets Page)**:
- Players can spend Soul Shards to permanently increase pet stats
- Stats: Str, Spd, Luck, ElementalPower  
- Cost: 10 Soul Shards per stat point
- Buttons: +1, +10, +100

### Guild Dungeon System
Guilds have a two-phase dungeon system:
- **The Great Dungeon** (Floors 1-50): 10x NPC tower strength, no pets allowed, guild bank rewards
- **The Demon Lord's Dungeon** (Floors 51-100): 15x NPC tower strength, pets allowed, 3x rewards

### Guild Battles
Guilds can challenge other guilds to battles:
- Guild master selects fighters and order
- Admin judges each round, winner gets 1 point
- First fighter to win earns the point for their guild
- Guild wins are tracked on the leaderboard

### Player Challenges (Turn-Based Combat)
Players can challenge each other to turn-based battles.

**Combat Stats Include:**
- Base player stats (Str, Def, Spd, Int, Luck)
- Equipped pet stats (Str, Spd, Luck added directly; ElementalPower adds to Int)
- All bird stats (Def and Spd from all owned birds)

**NPC Opponents:**
When challenging an NPC, the NPC automatically selects combat actions based on their total stats (including pets/birds). Actions are weighted by stat strength with some randomness. Admins can also manually select NPC actions in the Challenges tab of the admin panel.

**NPC Power Scaling:**
NPCs scale their stats to match the player power range:
- Guardian_Kira: 100% power (matches strongest player)
- Shadow_Vex: 70% power (upper-mid tier)
- Iron_Magnus: 40% power (lower-mid tier)
- Storm_Lyra: 0% power (matches weakest player)

Players can challenge each other to turn-based battles:

**Combat Actions:**
- **Attack**: Deal damage based on STR stat. Beats Trick, reduced by Defend.
- **Defend**: Reduce incoming damage using DEF stat. Beaten by Trick.
- **Dodge**: Attempt to avoid attacks using SPD stat. Counters Trick if successful.
- **Trick**: Outsmart opponent using INT stat. Beats Defend, loses to Attack.

**Combat Mechanics:**
- Each player has HP based on all their stats: 100 + (STR * 2) + (DEF * 3) + (SPD * 1) + (INT * 1) + (LUCK * 1)
- Both players select actions simultaneously each round (like chess - waits for both moves)
- Actions resolve based on stat matchups and critical hits (affected by LUCK)
- Battle continues until one player's HP reaches 0
- Winner earns a win on the leaderboard
- UI shows "Your Turn" / "Waiting for opponent" status

### Leaderboard Types
- Wins, Losses, NPC Progress, Rank, Guild Dungeon, Guild Wins

## External Dependencies

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for Express sessions

### UI Libraries
- **Radix UI**: Full suite of accessible component primitives (dialogs, dropdowns, tabs, etc.)
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **embla-carousel-react**: Carousel functionality

### Development Tools
- **Vite**: Frontend dev server and bundler with HMR
- **Drizzle Kit**: Database migration and push tooling
- **TypeScript**: Full type coverage across client, server, and shared code

### Replit-specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicator