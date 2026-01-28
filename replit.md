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

- January 2026: Initial import and setup in Replit environment
- Configured OpenAI AI integration for game AI features
- Set up PostgreSQL database with Drizzle ORM
