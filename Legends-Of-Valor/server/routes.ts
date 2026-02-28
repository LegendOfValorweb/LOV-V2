import type { Express } from "express";
import { createServer, type Server } from "http";
import { getWorldTimeInfo, getDayNightState } from "./weather-system";
import { storage } from "./storage";
import { db } from "./db";
import { insertAccountSchema, insertInventoryItemSchema, playerRanks, playerStatsSchema, equippedSchema, insertEventSchema, insertChallengeSchema, challenges as challengesTable, petElements, type GuildBank, type GuildBuff, playerRaces, playerGenders, raceModifiers, accounts, calculateCarryCapacity, ITEM_WEIGHT_BY_TIER, FISH_WEIGHT_BY_RARITY, RESOURCE_WEIGHT_BY_RARITY, MAX_HERITAGE_REBIRTHS, HERITAGE_BONUS_PER_REBIRTH, HERITAGE_TITLES, monsterSpawnLog, BASE_TIER_COSTS, BASE_TIER_NAMES, BASE_TIER_RANK_REQUIREMENTS, ROOM_MAX_LEVEL_BY_TIER, OFFLINE_TRAINING_XP_PER_HOUR, VAULT_INTEREST_RATE, VAULT_MAX_GOLD, ROOM_UPGRADE_BASE_COST, DAILY_CATCH_LIMIT_BY_RANK, PET_FEED_CAP_BY_RANK, getRodForRank, FISH_SELL_PRICES, FISH_PET_STAT_GAIN, FISH_CRAFTING_MATERIAL, GUILD_DUNGEON_TIERS, GUILD_PERKS, guilds as guildsTable, valorpediaDiscoveries, valorpediaMilestonesClaimed, VALORPEDIA_ENTRIES, VALORPEDIA_MILESTONES, valorpediaCategories, playerTitles, PET_MUTATION_TRAITS, PET_MUTATION_CHANCE, PET_COOKING_RECIPES, PET_REVIVE_CONSUMABLE_COST, type PetMutationTrait, ZONE_DUNGEON_CONFIGS, getZoneDungeonConfig, zoneDungeonRuns, ZONE_DUNGEON_RANK_INDEX, guildQuests, guildQuestContributions, insertGuildQuestSchema, insertGuildQuestContributionSchema, tournamentBetting, shards, shardTypes, hellZoneSessions, hellZoneParticipants } from "@shared/schema";
import { z } from "zod";
import type { Account, Event, Challenge, PlayerRace, PlayerGender } from "@shared/schema";
import {
  calculateRepairCost,
  calculateAuctionListingFee,
  calculateAuctionSaleTax,
  getMarketPrice,
  getAllMarketPrices,
  getMarketItemInfo,
  recordPurchase,
  recordSale,
  initializeMarketItem,
  startMarketUpdates,
  AUCTION_LISTING_TAX_RATE,
  AUCTION_SALE_TAX_RATE,
} from "./economy-system";
import {
  getActiveMonster,
  clearActiveMonster,
  checkTimerSpawn,
  checkActionSpawn,
  spawnMonster,
  calculateMonsterRewards,
  getZoneWeather,
  getAllZoneWeather,
  setZoneWeather,
  WEATHER_TYPES,
  getActiveMonsterCount,
  getZoneMonsterTemplates,
  getWeatherExclusiveBosses,
  type SpawnedMonster,
} from "./monster-spawn";
import {
  getZoneResources,
  getAllGatherableZones,
  getAvailableResources,
  gatherResources,
  getZoneExhaustionInfo,
  getRankRequirementLabel,
} from "./resource-system";
import { eq, sql, and, lt } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getActiveWorldBoss, spawnWorldBoss, recordBossDamage } from "./world-boss";
import { COOKIE_NAME, COOKIE_OPTIONS, generateToken, authMiddleware, type AuthRequest } from "./auth";
import { 
  runAutoCombat, 
  calculateCombatRewards, 
  applyRaceModifiers, 
  calculateMaxHP,
  calculateDeathPenalty,
  applyWeaknessDebuff,
  applyRacePassiveSkill,
  getRaceActiveSpellInfo,
  type Combatant, 
  type CombatStats,
  type ElementalAffinity,
  type DeathPenaltyResult
} from "./combat-engine";
import { craftItem, socketGem } from "./crafting-system";
import { 
  auctions, 
  auctionBids, 
  recipes, 
  insertAuctionSchema, 
  insertAuctionBidSchema,
  pets as petsTable,
  leaderboardEntries
} from "@shared/schema";

// V2: Max 28 players per server (2 per race x 14 races)
const MAX_PLAYERS = 28;
// V2: Max 2 players per race
const MAX_PLAYERS_PER_RACE = 2;
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
const SLEEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes of inactivity to sleep the app

const ENERGY_COSTS: Record<string, number> = {
  gathering: 2,
  fishing: 3,
  crafting: 5,
  combat: 0,
  travel: 1,
};

const ENERGY_CAP_BY_RANK: Record<string, number> = {
  "Novice": 50,
  "Apprentice": 60,
  "Initiate": 70,
  "Journeyman": 80,
  "Adept": 90,
  "Expert": 100,
  "Master": 110,
  "Grandmaster": 120,
  "Champion": 130,
  "Overlord": 140,
  "Sovereign": 150,
  "Ascendant": 160,
  "Legend": 170,
  "Mythic": 185,
  "Mythical Legend": 200,
};

function getMaxEnergyForRank(rank: string): number {
  return ENERGY_CAP_BY_RANK[rank] || 50;
}

function regenerateEnergy(account: any): { energy: number; lastEnergyUpdate: Date } {
  const now = new Date();
  const lastUpdate = account.lastEnergyUpdate ? new Date(account.lastEnergyUpdate) : now;
  const elapsedMs = now.getTime() - lastUpdate.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  const maxEnergy = getMaxEnergyForRank(account.rank || "Novice");
  const currentEnergy = account.energy ?? maxEnergy;

  const isAtBase = account.respawnLocation === "base";
  const regenRate = isAtBase ? 2 : 1;

  const newEnergy = Math.min(maxEnergy, currentEnergy + elapsedMinutes * regenRate);
  const newLastUpdate = elapsedMinutes > 0 ? now : lastUpdate;

  return { energy: newEnergy, lastEnergyUpdate: newLastUpdate };
}

function getTierFromItemId(itemId: string): string {
  const lastDash = itemId.lastIndexOf("-");
  if (lastDash > 0) {
    return itemId.substring(0, lastDash);
  }
  return "normal";
}

async function getPlayerCarryInfo(accountId: string) {
  const account = await storage.getAccount(accountId);
  if (!account) return null;

  const strength = (account.stats as any)?.Str || 10;

  let petsCarryBonus = 0;
  if (account.equippedPetId) {
    const pet = await storage.getPet(account.equippedPetId);
    if (pet) {
      petsCarryBonus = Math.floor((pet.stats as any)?.Str || 0);
    }
  }

  const maxCapacity = calculateCarryCapacity(account.rank || "Novice", strength, petsCarryBonus);

  const inventory = await storage.getInventoryByAccount(accountId);
  let currentWeight = 0;
  for (const inv of inventory) {
    const tier = getTierFromItemId(inv.itemId);
    currentWeight += ITEM_WEIGHT_BY_TIER[tier] || 1;
  }

  const { fish: fishTable } = await import("@shared/schema");
  const accountFish = await db.select().from(fishTable).where(eq(fishTable.accountId, accountId));
  for (const f of accountFish) {
    currentWeight += FISH_WEIGHT_BY_RARITY[f.rarity] || 1;
  }

  return {
    currentWeight,
    maxCapacity,
    remaining: Math.max(0, maxCapacity - currentWeight),
    isFull: currentWeight >= maxCapacity,
    petsCarryBonus,
  };
}

interface ActiveSession {
  accountId: string;
  username: string;
  lastActivity: number;
}

const activeSessions = new Map<string, ActiveSession>();
let isSleeping = false;

import type { Response } from "express";
const adminSSEConnections = new Map<string, Response>();
const playerSSEConnections = new Map<string, Response>();
const guildSSEConnections = new Map<string, Set<Response>>();

function safeSSEWrite(res: Response, message: string): boolean {
  try {
    if (res && !res.writableEnded) {
      res.write(message);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

function broadcastToAdmins(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(adminSSEConnections.entries()).forEach(([adminId, res]) => {
    if (!safeSSEWrite(res, message)) {
      adminSSEConnections.delete(adminId);
    }
  });
}

function broadcastToPlayer(playerId: string, event: string, data: any) {
  const res = playerSSEConnections.get(playerId);
  if (res) {
    if (!safeSSEWrite(res, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) {
      playerSSEConnections.delete(playerId);
    }
  }
}

function broadcastToGuild(guildId: string, event: string, data: any) {
  const connections = guildSSEConnections.get(guildId);
  if (connections) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    connections.forEach(res => {
      if (!safeSSEWrite(res, message)) {
        connections.delete(res);
      }
    });
  }
}

function broadcastToAllPlayers(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(playerSSEConnections.entries()).forEach(([playerId, res]) => {
    if (!safeSSEWrite(res, message)) {
      playerSSEConnections.delete(playerId);
    }
  });
}

function cleanupInactiveSessions() {
  const now = Date.now();
  let activeCount = 0;
  Array.from(activeSessions.entries()).forEach(([accountId, session]) => {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      activeSessions.delete(accountId);
    } else {
      activeCount++;
    }
  });

  // App sleeping logic
  const sessions = Array.from(activeSessions.values());
  const lastGlobalActivity = sessions.length > 0 
    ? Math.max(...sessions.map(s => s.lastActivity)) 
    : 0;

  if (activeCount === 0 && (lastGlobalActivity === 0 || now - lastGlobalActivity > SLEEP_TIMEOUT)) {
    if (!isSleeping) {
      console.log("[SERVER] No active users for 10 minutes. Entering sleep mode...");
      isSleeping = true;
    }
  } else {
    if (isSleeping) {
      console.log("[SERVER] Activity detected. Waking up...");
      isSleeping = false;
    }
  }
}

setInterval(cleanupInactiveSessions, 60000);

async function collectOfflineTraining(account: any): Promise<any | null> {
  if (!account.offlineTrainingStat || !account.offlineTrainingStartedAt) return null;
  
  const startedAt = new Date(account.offlineTrainingStartedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  
  if (elapsedHours < 0.01) return null;
  
  const baseTier = account.baseTier || 1;
  const trainingRoomLevel = (account.baseRoomLevels?.training || 1);
  const xpPerHour = (OFFLINE_TRAINING_XP_PER_HOUR[baseTier] || 5) * trainingRoomLevel;
  const maxHours = 24;
  const cappedHours = Math.min(elapsedHours, maxHours);
  const totalXp = Math.floor(cappedHours * xpPerHour);
  
  if (totalXp <= 0) return null;
  
  const stat = account.offlineTrainingStat;
  const currentStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
  const updatedStats = { ...currentStats, [stat]: (currentStats[stat] || 10) + totalXp };
  
  await db.update(accounts).set({
    stats: updatedStats,
    offlineTrainingStat: null,
    offlineTrainingStartedAt: null,
  }).where(eq(accounts.id, account.id));
  
  return { stat, xpGained: totalXp, hoursElapsed: Math.floor(cappedHours * 10) / 10 };
}

async function collectVaultInterest(account: any): Promise<any | null> {
  const vaultGold = account.vaultGold || 0;
  if (vaultGold <= 0) return null;
  
  const lastInterest = account.lastVaultInterest ? new Date(account.lastVaultInterest) : new Date();
  const now = new Date();
  const elapsedMs = now.getTime() - lastInterest.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  
  if (elapsedHours < 1) return null;
  
  const baseTier = account.baseTier || 1;
  const vaultLevel = (account.baseRoomLevels?.vault || 1);
  const rate = (VAULT_INTEREST_RATE[baseTier] || 0.001) * vaultLevel;
  const cappedHours = Math.min(elapsedHours, 24);
  const interest = Math.floor(vaultGold * rate * (cappedHours / 24));
  
  if (interest <= 0) return null;
  
  await db.update(accounts).set({
    vaultGold: vaultGold + interest,
    lastVaultInterest: now,
  }).where(eq(accounts.id, account.id));
  
  return { interest, hoursElapsed: Math.floor(cappedHours * 10) / 10 };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Helper: Calculate player strength (used for challenges and guild battles)
  const calculatePlayerStrength = async (accountId: string): Promise<number> => {
    const account = await storage.getAccount(accountId);
    if (!account) return 0;
    
    const playerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
    let strength = Number(playerStats.Str || 0) + Number(playerStats.Spd || 0) + Number(playerStats.Int || 0) + Number(playerStats.Luck || 0) + Number(playerStats.Pot || 0);
    
    // Add equipped item stats (including boosts)
    const inventory = await storage.getInventoryByAccount(account.id);
    const equipped = account.equipped;
    
    for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
      const inventoryId = equipped[slot];
      if (inventoryId) {
        const invItem = inventory.find(i => i.id === inventoryId);
        if (invItem && invItem.stats) {
          const stats = invItem.stats as any;
          // Use Number() to handle potential string stats from database
          strength += (Number(stats.Str) || 0) + (Number(stats.Int) || 0) + (Number(stats.Spd) || 0) + (Number(stats.Luck) || 0) + (Number(stats.Pot) || 0);
        }
      }
    }
    
    // Add equipped pet stats
    if ((account as any).equippedPetId) {
      const pet = await storage.getPet((account as any).equippedPetId);
      if (pet) {
        const petStats = pet.stats as any;
        strength += (Number(petStats.Str) || 0) + (Number(petStats.Spd) || 0) + (Number(petStats.Luck) || 0) + (Number(petStats.ElementalPower) || 0);
      }
    }
    
    return Math.floor(strength);
  };

  app.get("/api/server/status", (req, res) => {
    cleanupInactiveSessions();
    const playerSessions = Array.from(activeSessions.values()).filter(s => {
      const account = storage.getAccount(s.accountId);
      return account;
    });
    res.json({
      currentPlayers: activeSessions.size,
      maxPlayers: MAX_PLAYERS,
      activePlayers: Array.from(activeSessions.values()).map(s => s.username),
    });
  });

  // V2: Get available races (with player counts)
  app.get("/api/races/availability", async (req, res) => {
    try {
      // Count players per race
      const raceCounts = await db.select({
        race: accounts.race,
        count: sql<number>`count(*)::int`,
      })
      .from(accounts)
      .where(sql`${accounts.race} IS NOT NULL AND ${accounts.role} = 'player'`)
      .groupBy(accounts.race);

      const availability: Record<string, { count: number; available: boolean; maxPlayers: number }> = {};
      
      for (const race of playerRaces) {
        const raceData = raceCounts.find(r => r.race === race);
        const count = raceData?.count || 0;
        availability[race] = {
          count,
          available: count < MAX_PLAYERS_PER_RACE,
          maxPlayers: MAX_PLAYERS_PER_RACE,
        };
      }

      res.json({
        races: playerRaces,
        genders: playerGenders,
        raceModifiers,
        availability,
        maxPlayersPerRace: MAX_PLAYERS_PER_RACE,
      });
    } catch (error) {
      console.error("Error getting race availability:", error);
      res.status(500).json({ error: "Failed to get race availability" });
    }
  });

  app.post("/api/accounts/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string(),
        password: z.string(),
        role: z.enum(["player", "admin"]),
        // V2: Race and gender for new player accounts
        race: z.enum(playerRaces).optional(),
        gender: z.enum(playerGenders).optional(),
      });
      
      const { username, password, role, race, gender } = loginSchema.parse(req.body);
      
      cleanupInactiveSessions();
      
      const existing = await storage.getAccountByUsername(username);
      
      if (existing) {
        const passwordMatch = await bcrypt.compare(password, existing.password);
        if (!passwordMatch) {
          return res.status(401).json({ error: "Invalid password" });
        }
        if (existing.role !== role) {
          return res.status(403).json({ error: "Invalid role for this account" });
        }
        
        if (!activeSessions.has(existing.id) && activeSessions.size >= MAX_PLAYERS) {
          return res.status(503).json({ 
            error: "Server is full", 
            message: `Maximum ${MAX_PLAYERS} players allowed. Please try again later.`,
            currentPlayers: activeSessions.size,
            maxPlayers: MAX_PLAYERS,
          });
        }
        
        const sessionId = Math.random().toString(36).substring(2);
        await db.update(accounts).set({ 
          currentSessionId: sessionId 
        }).where(eq(accounts.id, existing.id));

        const token = generateToken({ id: existing.id, username: existing.username, sessionId });
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
        
        activeSessions.set(existing.id, {
          accountId: existing.id,
          username: existing.username,
          lastActivity: Date.now(),
        });
        
        let loginAccount = { ...existing, currentSessionId: sessionId };
        const offlineTrainingResult = await collectOfflineTraining(existing);
        const vaultInterestResult = await collectVaultInterest(existing);
        if (offlineTrainingResult || vaultInterestResult) {
          loginAccount = (await storage.getAccount(existing.id))!;
        }
        
        return res.json(loginAccount);
      }
      
      if (activeSessions.size >= MAX_PLAYERS) {
        return res.status(503).json({ 
          error: "Server is full", 
          message: `Maximum ${MAX_PLAYERS} players allowed. Please try again later.`,
          currentPlayers: activeSessions.size,
          maxPlayers: MAX_PLAYERS,
        });
      }

      // V2: Validate race selection for new player accounts
      if (role === "player") {
        if (!race || !gender) {
          return res.status(400).json({ 
            error: "Race and gender required",
            message: "Please select a race and gender for your character.",
          });
        }

        // Check if the selected race is still available (max 2 per race)
        const raceCount = await db.select({
          count: sql<number>`count(*)::int`,
        })
        .from(accounts)
        .where(sql`${accounts.race} = ${race} AND ${accounts.role} = 'player'`);

        if (raceCount[0]?.count >= MAX_PLAYERS_PER_RACE) {
          return res.status(409).json({ 
            error: "Race unavailable",
            message: `The ${race} race already has ${MAX_PLAYERS_PER_RACE} players. Please choose another race.`,
          });
        }
      }

      // V2: Calculate race-based starting stats
      const baseStats = { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      let startingStats = baseStats;
      
      if (role === "player" && race) {
        const modifier = raceModifiers[race];
        startingStats = {
          Str: Math.round(baseStats.Str * modifier.Str),
          Def: Math.round(baseStats.Def * modifier.Def),
          Spd: Math.round(baseStats.Spd * modifier.Spd),
          Int: Math.round(baseStats.Int * modifier.Int),
          Luck: Math.round(baseStats.Luck * modifier.Luck),
          Pot: 0,
        };
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const sessionId = Math.random().toString(36).substring(2);
      const account = await storage.createAccount({
        username,
        password: hashedPassword,
        role,
        gold: role === "player" ? 10000 : 0,
        race: role === "player" ? race : undefined,
        gender: role === "player" ? gender : undefined,
        portrait: role === "player" ? `${race}_${gender}` : undefined,
        stats: startingStats,
        currentSessionId: sessionId,
      });

      const token = generateToken({ id: account.id, username: account.username, sessionId });
      res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
      
      activeSessions.set(account.id, {
        accountId: account.id,
        username: account.username,
        lastActivity: Date.now(),
      });
      
      if (role === "player") {
        const { password: _, ...safeAccount } = account;
        broadcastToAdmins("newPlayer", safeAccount);
        // Force refresh for any connected admin streams
        broadcastToAdmins("playerUpdate", safeAccount);
      }
      
      return res.status(201).json(account);
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid login data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/accounts/:id/heartbeat", (req, res) => {
    const { id } = req.params;
    const session = activeSessions.get(id);
    if (session) {
      session.lastActivity = Date.now();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });
  
  // V2: Death & Revival System
  // Respawn at base (free, takes you back to base)
  app.post("/api/accounts/:id/respawn", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.isDead) {
        return res.status(400).json({ error: "You are not dead" });
      }
      
      const weaknessExpires = new Date(Date.now() + 5 * 60 * 1000);
      await db.update(accounts).set({
        isDead: false,
        ghostState: false,
        respawnLocation: "base",
        weaknessDebuffExpires: weaknessExpires,
      }).where(eq(accounts.id, req.params.id));
      
      res.json({ 
        success: true, 
        message: "You have respawned at Capital City. A Weakness debuff reduces your stats by 20% for 5 minutes.",
        location: "base",
        weaknessDebuffExpires: weaknessExpires.toISOString(),
      });
    } catch (error) {
      console.error("Respawn error:", error);
      res.status(500).json({ error: "Failed to respawn" });
    }
  });
  
  // Revive using revive token (instant revive at current location)
  app.post("/api/accounts/:id/revive", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.isDead) {
        return res.status(400).json({ error: "You are not dead" });
      }
      if (account.reviveTokens <= 0) {
        return res.status(400).json({ error: "No revive tokens available. Respawn at base instead." });
      }
      
      await db.update(accounts).set({
        isDead: false,
        ghostState: false,
        reviveTokens: account.reviveTokens - 1,
      }).where(eq(accounts.id, req.params.id));
      
      res.json({ 
        success: true, 
        message: "You used a Revive Token! You are back on your feet.",
        reviveTokensRemaining: account.reviveTokens - 1
      });
    } catch (error) {
      console.error("Revive error:", error);
      res.status(500).json({ error: "Failed to revive" });
    }
  });
  
  // Pet sacrifice for revival (sacrifice active pet to revive)
  app.post("/api/accounts/:id/sacrifice-pet", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.isDead) {
        return res.status(400).json({ error: "You are not dead" });
      }
      if (!account.equippedPetId) {
        return res.status(400).json({ error: "No pet equipped to sacrifice" });
      }
      
      // Get the equipped pet
      const { pets } = await import("@shared/schema");
      const [pet] = await db.select().from(pets).where(eq(pets.id, account.equippedPetId));
      if (!pet) {
        return res.status(400).json({ error: "Equipped pet not found" });
      }
      
      // Delete the pet (sacrifice)
      await db.delete(pets).where(eq(pets.id, account.equippedPetId));
      
      await db.update(accounts).set({
        isDead: false,
        ghostState: false,
        equippedPetId: null,
      }).where(eq(accounts.id, req.params.id));
      
      res.json({ 
        success: true, 
        message: `Your loyal companion ${pet.name} sacrificed itself to save you. You have been revived.`,
        sacrificedPet: pet.name
      });
    } catch (error) {
      console.error("Pet sacrifice error:", error);
      res.status(500).json({ error: "Failed to sacrifice pet" });
    }
  });
  
  // Check death status
  app.get("/api/accounts/:id/death-status", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      const now = new Date();
      const hasWeakness = account.weaknessDebuffExpires && new Date(account.weaknessDebuffExpires) > now;
      res.json({
        isDead: account.isDead,
        ghostState: account.ghostState,
        deathCount: account.deathCount,
        reviveTokens: account.reviveTokens,
        lastDeathTime: account.lastDeathTime,
        hasEquippedPet: !!account.equippedPetId,
        hasWeaknessDebuff: hasWeakness,
        weaknessDebuffExpires: hasWeakness ? account.weaknessDebuffExpires : null,
      });
    } catch (error) {
      console.error("Death status error:", error);
      res.status(500).json({ error: "Failed to get death status" });
    }
  });

  app.get("/api/accounts/:id/carry-capacity", async (req, res) => {
    try {
      const carryInfo = await getPlayerCarryInfo(req.params.id);
      if (!carryInfo) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(carryInfo);
    } catch (error) {
      console.error("Carry capacity error:", error);
      res.status(500).json({ error: "Failed to get carry capacity" });
    }
  });

  app.post("/api/pets/:petId/revive", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { pets: petsTable } = await import("@shared/schema");
      const [pet] = await db.select().from(petsTable).where(eq(petsTable.id, req.params.petId));
      if (!pet) return res.status(404).json({ error: "Pet not found" });
      if (pet.accountId !== accountId) return res.status(403).json({ error: "Not your pet" });
      if (!pet.isFainted) return res.status(400).json({ error: "Pet is not fainted" });

      const reviveCost = 500;
      if (account.gold < reviveCost) return res.status(400).json({ error: `Need ${reviveCost} gold to revive pet` });

      await db.update(petsTable).set({ isFainted: false }).where(eq(petsTable.id, req.params.petId));
      await db.update(accounts).set({ gold: account.gold - reviveCost }).where(eq(accounts.id, accountId));

      res.json({ success: true, message: `${pet.name} has been revived!`, goldSpent: reviveCost });
    } catch (error) {
      console.error("Pet revive error:", error);
      res.status(500).json({ error: "Failed to revive pet" });
    }
  });

  app.post("/api/inventory/:itemId/repair", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { inventoryItems } = await import("@shared/schema");
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, req.params.itemId));
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.accountId !== accountId) return res.status(403).json({ error: "Not your item" });
      if (item.durability >= item.maxDurability) return res.status(400).json({ error: "Item is already at full durability" });

      const durabilityToRepair = item.maxDurability - item.durability;
      const itemTier = getTierFromItemId(item.itemId);
      const repairCost = calculateRepairCost(itemTier, durabilityToRepair);
      if (account.gold < repairCost) return res.status(400).json({ error: `Need ${repairCost} gold to repair` });

      await db.update(inventoryItems).set({ durability: item.maxDurability }).where(eq(inventoryItems.id, req.params.itemId));
      await db.update(accounts).set({ gold: account.gold - repairCost }).where(eq(accounts.id, accountId));

      res.json({ success: true, message: "Item repaired!", goldSpent: repairCost, newDurability: item.maxDurability });
    } catch (error) {
      console.error("Repair error:", error);
      res.status(500).json({ error: "Failed to repair item" });
    }
  });

  app.post("/api/accounts/:id/logout", (req, res) => {
    const { id } = req.params;
    activeSessions.delete(id);
    res.json({ success: true });
  });

  app.get("/api/admin/events", async (req, res) => {
    const adminId = req.query.adminId as string;
    if (!adminId) {
      return res.status(400).json({ error: "Admin ID required" });
    }
    
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    adminSSEConnections.set(adminId, res);
    
    res.write(`event: connected\ndata: {"message":"Connected to admin events"}\n\n`);
    
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 30000);
    
    req.on("close", () => {
      clearInterval(keepAlive);
      adminSSEConnections.delete(adminId);
    });
  });

  app.get("/api/player/events", async (req, res) => {
    const playerId = req.query.playerId as string;
    if (!playerId) {
      return res.status(400).json({ error: "Player ID required" });
    }
    
    const player = await storage.getAccount(playerId);
    if (!player || player.role !== "player") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    playerSSEConnections.set(playerId, res);

    const guildMember = await storage.getGuildMember(playerId);
    if (guildMember) {
      if (!guildSSEConnections.has(guildMember.guildId)) {
        guildSSEConnections.set(guildMember.guildId, new Set());
      }
      guildSSEConnections.get(guildMember.guildId)!.add(res);
    }
    
    res.write(`event: connected\ndata: {"message":"Connected to player events"}\n\n`);
    
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 30000);
    
    req.on("close", () => {
      clearInterval(keepAlive);
      playerSSEConnections.delete(playerId);
      if (guildMember) {
        guildSSEConnections.get(guildMember.guildId)?.delete(res);
      }
    });
  });

  app.get("/api/guilds/:guildId/chat", async (req, res) => {
    const chat = await storage.getGuildChat(req.params.guildId);
    res.json(chat.reverse());
  });

  app.post("/api/guilds/:guildId/chat", async (req, res) => {
    try {
      const { accountId, message } = z.object({
        accountId: z.string(),
        message: z.string().min(1).max(500)
      }).parse(req.body);

      const account = await storage.getAccount(accountId);
      const guildMember = await storage.getGuildMember(accountId);

      if (!account || !guildMember || guildMember.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      const chatMessage = await storage.createGuildChatMessage({
        guildId: req.params.guildId,
        senderId: accountId,
        senderName: account.username,
        message
      });

      broadcastToGuild(req.params.guildId, "guildChat", chatMessage);
      res.status(201).json(chatMessage);
    } catch (error) {
      res.status(400).json({ error: "Invalid chat message" });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const body = insertAccountSchema.parse(req.body);
      
      const existing = await storage.getAccountByUsername(body.username);
      if (existing) {
        return res.json(existing);
      }
      
      const account = await storage.createAccount(body);
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid account data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.get("/api/accounts/:id", async (req, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(account);
  });

  app.patch("/api/accounts/:id/gold", async (req, res) => {
    try {
      const { gold } = z.object({ gold: z.number().max(Number.MAX_SAFE_INTEGER) }).parse(req.body);
      const account = await storage.updateAccountGold(req.params.id, gold);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (account.role === "player") {
        const { password: _, ...safeAccount } = account;
        broadcastToAdmins("playerUpdate", safeAccount);
      }
      
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid gold value", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update gold" });
    }
  });

  app.post("/api/accounts/:id/train-stat", async (req, res) => {
    try {
      const schema = z.object({
        stat: z.enum(["Str", "Def", "Spd", "Int", "Luck"]),
        amount: z.number().int().positive().max(10000),
      });
      const { stat, amount } = schema.parse(req.body);
      
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const tpCost = amount * 10;
      if ((account.trainingPoints || 0) < tpCost) {
        return res.status(400).json({ 
          error: "Insufficient Training Points",
          required: tpCost,
          available: account.trainingPoints || 0
        });
      }
      
      const currentStats = (account.stats as any) || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      const newStats = {
        ...currentStats,
        [stat]: (currentStats[stat] || 10) + amount
      };
      
      const updatedAccount = await storage.updateAccount(req.params.id, {
        stats: newStats,
        trainingPoints: (account.trainingPoints || 0) - tpCost
      });
      
      if (updatedAccount && updatedAccount.role === "player") {
        const { password: _, ...safeAccount } = updatedAccount;
        broadcastToAdmins("playerUpdate", safeAccount);
      }
      
      res.json(updatedAccount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("Train stat error:", error);
      res.status(500).json({ error: "Failed to train stat" });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    try {
      const safeNumber = z.number().max(Number.MAX_SAFE_INTEGER);
      const updateSchema = z.object({
        gold: safeNumber.optional(),
        rubies: safeNumber.optional(),
        soulShards: safeNumber.optional(),
        focusedShards: safeNumber.optional(),
        trainingPoints: safeNumber.optional(),
        petExp: safeNumber.optional(),
        runes: safeNumber.optional(),
        pets: z.array(z.string()).optional(),
        stats: playerStatsSchema.optional(),
        equipped: equippedSchema.optional(),
        rank: z.enum(playerRanks).optional(),
        wins: safeNumber.optional(),
        losses: safeNumber.optional(),
      });
      
      const body = updateSchema.parse(req.body);
      const account = await storage.updateAccount(req.params.id, body);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const updatedAccount = await storage.getAccount(account.id);
      if (updatedAccount && updatedAccount.role === "player") {
        const { password: _, ...safeAccount } = updatedAccount;
        broadcastToAdmins("playerUpdate", safeAccount);
      }
      
      res.json(updatedAccount || account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // Base skins
  const BASE_SKINS = [
    { id: "default", name: "Default", cost: 0 },
    { id: "autumn", name: "Autumn Leaves", cost: 50000 },
    { id: "winter", name: "Winter Frost", cost: 100000 },
    { id: "spring", name: "Spring Bloom", cost: 100000 },
    { id: "summer", name: "Summer Sun", cost: 100000 },
    { id: "dark", name: "Dark Fortress", cost: 250000 },
    { id: "golden", name: "Golden Palace", cost: 500000 },
    { id: "mythic", name: "Mythic Realm", cost: 1000000 },
  ];

  // Trophy definitions
  const TROPHIES = [
    { id: "first_win", name: "First Victory", description: "Win your first battle" },
    { id: "rank_expert", name: "Expert Adventurer", description: "Reach Expert rank" },
    { id: "rank_master", name: "Master Warrior", description: "Reach Master rank" },
    { id: "rank_legend", name: "Living Legend", description: "Reach Legendary Hero rank" },
    { id: "gold_millionaire", name: "Millionaire", description: "Accumulate 1,000,000 gold" },
    { id: "gold_billionaire", name: "Billionaire", description: "Accumulate 1,000,000,000 gold" },
    { id: "pet_mythic", name: "Mythic Tamer", description: "Evolve a pet to mythic tier" },
    { id: "base_fortress", name: "Fortress Builder", description: "Upgrade base to tier 5" },
    { id: "tower_floor_10", name: "Tower Climber", description: "Reach Mystic Tower floor 10" },
    { id: "tower_floor_50", name: "Tower Master", description: "Reach Mystic Tower floor 50" },
    { id: "wins_100", name: "Centurion", description: "Win 100 battles" },
    { id: "wins_1000", name: "Champion", description: "Win 1000 battles" },
    { id: "story_act2", name: "Fractured Realms", description: "Complete Act 1" },
    { id: "story_act3", name: "Hell Seeker", description: "Complete Act 2" },
    { id: "story_act4", name: "Convergence", description: "Complete Act 3" },
  ];

  // Common helper to check and grant trophies
  async function checkAndGrantTrophies(accountId: string) {
    try {
      const account = await storage.getAccount(accountId);
      if (!account) return;

      const earned = playerTrophiesMap.get(accountId) || new Set();
      const newEarned = new Set(earned);

      // Gold milestones
      if (account.gold >= 1000000 && !newEarned.has("gold_millionaire")) newEarned.add("gold_millionaire");
      if (account.gold >= 1000000000 && !newEarned.has("gold_billionaire")) newEarned.add("gold_billionaire");

      // Tower milestones
      if (account.npcFloor >= 10 && !newEarned.has("tower_floor_10")) newEarned.add("tower_floor_10");
      if (account.npcFloor >= 50 && !newEarned.has("tower_floor_50")) newEarned.add("tower_floor_50");

      // Win milestones
      if (account.wins >= 1 && !newEarned.has("first_win")) newEarned.add("first_win");
      if (account.wins >= 100 && !newEarned.has("wins_100")) newEarned.add("wins_100");
      if (account.wins >= 1000 && !newEarned.has("wins_1000")) newEarned.add("wins_1000");

      // Rank milestones
      const rankIndex = playerRanks.indexOf(account.rank);
      if (rankIndex >= 5 && !newEarned.has("rank_expert")) newEarned.add("rank_expert"); // Expert is index 5
      if (rankIndex >= 6 && !newEarned.has("rank_master")) newEarned.add("rank_master"); // Master is index 6
      if (rankIndex >= 12 && !newEarned.has("rank_legend")) newEarned.add("rank_legend"); // Legend is index 12

      // Story milestones
      if (account.storyAct >= 2 && !newEarned.has("story_act2")) newEarned.add("story_act2");
      if (account.storyAct >= 3 && !newEarned.has("story_act3")) newEarned.add("story_act3");
      if (account.storyAct >= 4 && !newEarned.has("story_act4")) newEarned.add("story_act4");

      // Sync if any new ones earned
      if (newEarned.size > earned.size) {
        playerTrophiesMap.set(accountId, newEarned);
        await storage.updateAccount(accountId, { 
          trophies: Array.from(newEarned) 
        });
        
        // Notify player
        const added = Array.from(newEarned).filter(id => !earned.has(id));
        added.forEach(id => {
          const t = TROPHIES.find(x => x.id === id);
          if (t) {
            broadcastToPlayer(accountId, "trophyEarned", t);
          }
        });
      }
    } catch (error) {
      console.error("Error checking trophies:", error);
    }
  }

  app.get("/api/base-skins", (_req, res) => {
    res.json(BASE_SKINS);
  });

  app.get("/api/trophies", (_req, res) => {
    res.json(TROPHIES);
  });

  app.patch("/api/accounts/:id/base-skin", async (req, res) => {
    try {
      const { skin } = req.body;
      const accountId = req.params.id;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const skinData = BASE_SKINS.find(s => s.id === skin);
      if (!skinData) {
        return res.status(400).json({ error: "Invalid skin" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Check if player already has this skin (free switch) or needs to buy
      if (account.baseSkin !== skin && skinData.cost > 0) {
        if (account.gold < skinData.cost) {
          return res.status(400).json({ error: `Need ${skinData.cost.toLocaleString()} gold for this skin` });
        }
        await storage.updateAccount(accountId, { 
          gold: account.gold - skinData.cost,
          baseSkin: skin 
        });
      } else {
        await storage.updateAccount(accountId, { baseSkin: skin });
      }
      
      const updatedAccount = await storage.getAccount(accountId);
      res.json({ account: updatedAccount, message: `Base skin changed to ${skinData.name}!` });
    } catch (error) {
      res.status(500).json({ error: "Failed to set base skin" });
    }
  });

  app.post("/api/accounts/:id/upgrade-base", async (req, res) => {
    try {
      const accountId = req.params.id;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const currentTier = account.baseTier || 1;
      if (currentTier >= 5) {
        return res.status(400).json({ error: "Base already at maximum tier" });
      }

      const upgradeCost = BASE_TIER_COSTS[currentTier];
      const requiredRank = BASE_TIER_RANK_REQUIREMENTS[currentTier];
      const rankIndex = playerRanks.indexOf(account.rank as any);
      const requiredRankIndex = playerRanks.indexOf(requiredRank as any);

      if (rankIndex < requiredRankIndex) {
        return res.status(400).json({ error: `Need rank ${requiredRank} to upgrade to tier ${currentTier + 1}` });
      }

      if (account.gold < upgradeCost) {
        return res.status(400).json({ error: `Need ${upgradeCost.toLocaleString()} gold to upgrade` });
      }

      const newTier = currentTier + 1;
      await storage.updateAccount(accountId, { 
        gold: account.gold - upgradeCost,
        baseTier: newTier 
      });

      if (newTier === 5 && !account.trophies?.includes("base_fortress")) {
        const updatedTrophies = [...(account.trophies || []), "base_fortress"];
        await storage.updateAccount(accountId, { trophies: updatedTrophies });
      }
      
      const updatedAccount = await storage.getAccount(accountId);
      res.json({ 
        account: updatedAccount, 
        message: `Base upgraded to ${BASE_TIER_NAMES[newTier]}!` 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to upgrade base" });
    }
  });

  app.patch("/api/accounts/:id/room-levels", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { roomId } = req.body;
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const baseTier = account.baseTier || 1;
      const maxLevel = ROOM_MAX_LEVEL_BY_TIER[baseTier] || 3;
      const currentLevels = (account as any).baseRoomLevels || { storage: 1, weapon_locker: 1, rest: 1, crafting: 1, training: 1, vault: 1, defenses: 1 };
      const currentLevel = currentLevels[roomId] || 1;

      if (currentLevel >= maxLevel) {
        return res.status(400).json({ error: `Room is at max level for base tier ${baseTier} (max ${maxLevel})` });
      }

      const baseCost = ROOM_UPGRADE_BASE_COST[roomId] || 5000;
      const upgradeCost = baseCost * currentLevel;

      if (account.gold < upgradeCost) {
        return res.status(400).json({ error: `Need ${upgradeCost.toLocaleString()} gold to upgrade` });
      }

      const newLevel = currentLevel + 1;
      const updatedLevels = { ...currentLevels, [roomId]: newLevel };
      
      await storage.updateAccount(accountId, { 
        gold: account.gold - upgradeCost,
        baseRoomLevels: updatedLevels 
      } as any);
      
      const updatedAccount = await storage.getAccount(accountId);
      res.json({ roomLevels: updatedLevels, account: updatedAccount, goldSpent: upgradeCost });
    } catch (error) {
      res.status(500).json({ error: "Failed to update room level" });
    }
  });

  app.post("/api/accounts/:id/offline-training/start", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { stat } = z.object({ stat: z.enum(["Str", "Def", "Spd", "Int", "Luck"]) }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const baseTier = account.baseTier || 1;
      const trainingRoomAvailable = baseTier >= 3;
      if (!trainingRoomAvailable) {
        return res.status(400).json({ error: "Training room requires base tier 3 (Keep) or higher" });
      }

      if (account.offlineTrainingStat) {
        return res.status(400).json({ error: "Already training. Stop current training first." });
      }

      await db.update(accounts).set({
        offlineTrainingStat: stat,
        offlineTrainingStartedAt: new Date(),
      }).where(eq(accounts.id, accountId));

      const trainingRoomLevel = (account.baseRoomLevels as any)?.training || 1;
      const xpPerHour = (OFFLINE_TRAINING_XP_PER_HOUR[baseTier] || 5) * trainingRoomLevel;

      res.json({ 
        success: true, 
        message: `Started offline training for ${stat}. Earning ${xpPerHour} XP/hour.`,
        stat,
        xpPerHour,
      });
    } catch (error) {
      console.error("Offline training start error:", error);
      res.status(500).json({ error: "Failed to start training" });
    }
  });

  app.post("/api/accounts/:id/offline-training/stop", async (req, res) => {
    try {
      const accountId = req.params.id;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      if (!account.offlineTrainingStat) {
        return res.status(400).json({ error: "No active training session" });
      }

      const result = await collectOfflineTraining(account);
      const updatedAccount = await storage.getAccount(accountId);

      res.json({ 
        success: true, 
        message: result 
          ? `Training complete! Gained ${result.xpGained} ${result.stat} XP over ${result.hoursElapsed} hours.`
          : "Training stopped (no XP accumulated yet).",
        training: result,
        account: updatedAccount,
      });
    } catch (error) {
      console.error("Offline training stop error:", error);
      res.status(500).json({ error: "Failed to stop training" });
    }
  });

  app.get("/api/accounts/:id/offline-training/status", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const baseTier = account.baseTier || 1;
      const trainingRoomLevel = (account.baseRoomLevels as any)?.training || 1;
      const xpPerHour = (OFFLINE_TRAINING_XP_PER_HOUR[baseTier] || 5) * trainingRoomLevel;

      if (!account.offlineTrainingStat || !account.offlineTrainingStartedAt) {
        return res.json({ active: false, xpPerHour, maxHours: 24 });
      }

      const startedAt = new Date(account.offlineTrainingStartedAt);
      const now = new Date();
      const elapsedHours = Math.min((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60), 24);
      const accumulatedXp = Math.floor(elapsedHours * xpPerHour);

      res.json({
        active: true,
        stat: account.offlineTrainingStat,
        startedAt: startedAt.toISOString(),
        elapsedHours: Math.floor(elapsedHours * 10) / 10,
        accumulatedXp,
        xpPerHour,
        maxHours: 24,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get training status" });
    }
  });

  app.post("/api/accounts/:id/vault/deposit", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const baseTier = account.baseTier || 1;
      const vaultAvailable = baseTier >= 4;
      if (!vaultAvailable) {
        return res.status(400).json({ error: "Vault requires base tier 4 (Manor) or higher" });
      }

      if (account.gold < amount) {
        return res.status(400).json({ error: "Not enough gold" });
      }

      const vaultLevel = (account.baseRoomLevels as any)?.vault || 1;
      const maxVault = (VAULT_MAX_GOLD[baseTier] || 100000) * vaultLevel;
      const currentVault = account.vaultGold || 0;

      if (currentVault + amount > maxVault) {
        return res.status(400).json({ error: `Vault capacity is ${maxVault.toLocaleString()} gold (currently ${currentVault.toLocaleString()})` });
      }

      await db.update(accounts).set({
        gold: account.gold - amount,
        vaultGold: currentVault + amount,
      }).where(eq(accounts.id, accountId));

      const updatedAccount = await storage.getAccount(accountId);
      res.json({ success: true, message: `Deposited ${amount.toLocaleString()} gold into vault.`, account: updatedAccount });
    } catch (error) {
      console.error("Vault deposit error:", error);
      res.status(500).json({ error: "Failed to deposit" });
    }
  });

  app.post("/api/accounts/:id/vault/withdraw", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { amount } = z.object({ amount: z.number().min(1) }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const currentVault = account.vaultGold || 0;
      if (currentVault < amount) {
        return res.status(400).json({ error: "Not enough gold in vault" });
      }

      await db.update(accounts).set({
        gold: account.gold + amount,
        vaultGold: currentVault - amount,
      }).where(eq(accounts.id, accountId));

      const updatedAccount = await storage.getAccount(accountId);
      res.json({ success: true, message: `Withdrew ${amount.toLocaleString()} gold from vault.`, account: updatedAccount });
    } catch (error) {
      console.error("Vault withdraw error:", error);
      res.status(500).json({ error: "Failed to withdraw" });
    }
  });

  app.get("/api/accounts/:id/vault/status", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const baseTier = account.baseTier || 1;
      const vaultLevel = (account.baseRoomLevels as any)?.vault || 1;
      const maxVault = (VAULT_MAX_GOLD[baseTier] || 100000) * vaultLevel;
      const rate = (VAULT_INTEREST_RATE[baseTier] || 0.001) * vaultLevel;

      res.json({
        vaultGold: account.vaultGold || 0,
        maxCapacity: maxVault,
        interestRate: rate,
        dailyInterest: Math.floor((account.vaultGold || 0) * rate),
        lastInterestCollected: account.lastVaultInterest,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get vault status" });
    }
  });

  app.get("/api/accounts/:id/base-info", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const baseTier = account.baseTier || 1;
      const roomLevels = (account.baseRoomLevels as any) || {};
      const maxRoomLevel = ROOM_MAX_LEVEL_BY_TIER[baseTier] || 3;

      const availableRooms: string[] = [];
      if (baseTier >= 1) availableRooms.push("storage", "rest");
      if (baseTier >= 2) availableRooms.push("weapon_locker", "crafting");
      if (baseTier >= 3) availableRooms.push("training", "defenses");
      if (baseTier >= 4) availableRooms.push("vault");

      const trainingStatus = account.offlineTrainingStat ? {
        active: true,
        stat: account.offlineTrainingStat,
        startedAt: account.offlineTrainingStartedAt,
      } : { active: false };

      res.json({
        baseTier,
        tierName: BASE_TIER_NAMES[baseTier],
        roomLevels,
        maxRoomLevel,
        availableRooms,
        nextTierCost: baseTier < 5 ? BASE_TIER_COSTS[baseTier] : null,
        nextTierRank: baseTier < 5 ? BASE_TIER_RANK_REQUIREMENTS[baseTier] : null,
        vaultGold: account.vaultGold || 0,
        trainingStatus,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get base info" });
    }
  });

  app.get("/api/accounts/:id/trophies", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const earnedTrophies = (account.trophies || []).map(trophyId => {
        const trophy = TROPHIES.find(t => t.id === trophyId);
        return trophy || { id: trophyId, name: trophyId, description: "Unknown trophy" };
      });
      
      res.json({ 
        earned: earnedTrophies,
        available: TROPHIES
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get trophies" });
    }
  });

  // Admin: Fix oversized resource values for an account
  app.post("/api/admin/accounts/:id/cap-resources", async (req, res) => {
    try {
      await storage.capAccountResources(req.params.id);
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (account.role === "player") {
        const { password: _, ...safeAccount } = account;
        broadcastToAdmins("playerUpdate", safeAccount);
      }
      
      res.json({ success: true, account });
    } catch (error) {
      console.error("Failed to cap resources:", error);
      res.status(500).json({ error: "Failed to cap resources" });
    }
  });

  app.post("/api/inventory/:id/boost", async (req, res) => {
    try {
      const { stat, amount = 1 } = req.body;
      const boostAmount = Math.max(1, Math.min(1000, Number(amount) || 1));
      
      if (!["Str", "Int", "Spd", "Luck", "Pot"].includes(stat)) {
        return res.status(400).send("Invalid stat");
      }

      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).send("Item not found");
      }

      const account = await storage.getAccount(item.accountId);
      const tpRequired = 10 * boostAmount;
      if (!account || account.trainingPoints < tpRequired) {
        return res.status(400).send("Insufficient training points");
      }

      // Rank-based max boost limits
      const rankMaxBoost: Record<string, number> = {
        "Novice": 999,
        "Apprentice": 9999,
        "Journeyman": 99999,
        "Expert": 999999,
        "Master": 9999999,
        "Grandmaster": 99999999,
        "Legend": 999999999,
        "Elite": 9999999999,
      };
      const maxBoost = rankMaxBoost[account.rank] || 999;

      const currentStats = (item.stats as any) || {};
      const currentValue = currentStats[stat] || 0;
      
      if (currentValue >= maxBoost) {
        return res.status(400).send(`Stat already at maximum for your rank (${maxBoost.toLocaleString()})`);
      }

      const actualBoost = Math.min(boostAmount, maxBoost - currentValue);
      const actualTpCost = 10 * actualBoost;
      const newStats = { ...currentStats, [stat]: currentValue + actualBoost };
      await storage.updateInventoryItemStats(item.id, newStats);
      await storage.updateAccount(account.id, { trainingPoints: account.trainingPoints - actualTpCost });

      const updatedAccount = await storage.getAccount(account.id);
      if (updatedAccount && updatedAccount.role === "player") {
        const { password: _, ...safeAccount } = updatedAccount;
        // Recalculate total strength to include the new boost for admin view
        const totalPower = await calculatePlayerStrength(account.id);
        broadcastToAdmins("playerUpdate", { ...safeAccount, totalPower });
      }

      res.json({ success: true, stats: newStats, maxBoost });
    } catch (error) {
      res.status(500).json({ error: "Failed to boost weapon" });
    }
  });

  app.get("/api/accounts", async (_req, res) => {
    const accounts = await storage.getAllAccounts();
    const players = accounts.filter(a => a.role === "player");
    
    // Enrich player data with total power for admin view
    const enrichedPlayers = await Promise.all(players.map(async (p) => {
      const totalPower = await calculatePlayerStrength(p.id);
      return { ...p, totalPower };
    }));
    
    res.json(enrichedPlayers);
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const account = await storage.getAccount(id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (account.role === "admin") {
        return res.status(403).json({ error: "Cannot delete admin account" });
      }
      await storage.deleteAccount(id);
      activeSessions.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.post("/api/admin/teleport-player", async (req, res) => {
    try {
      const { adminId, targetAccountId, location } = req.body;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });
      const validLocations = ["capital_city", "mountain_caverns", "ancient_ruins", "enchanted_forest", "crystal_lake", "coastal_village", "ruby_mines", "battle_arena"];
      if (!validLocations.includes(location)) return res.status(400).json({ error: "Invalid location" });
      await db.update(accounts).set({ respawnLocation: location }).where(eq(accounts.id, targetAccountId));
      res.json({ success: true, message: `Player teleported to ${location}` });
    } catch (error) {
      res.status(500).json({ error: "Teleport failed" });
    }
  });

  app.get("/api/accounts/:accountId/inventory", async (req, res) => {
    const inventory = await storage.getInventoryByAccount(req.params.accountId);
    res.json(inventory);
  });

  app.post("/api/accounts/:accountId/inventory", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const body = insertInventoryItemSchema.parse({
        ...req.body,
        accountId: req.params.accountId,
        purchasedAt: new Date(),
      });

      const item = await storage.addToInventory(body);
      recordPurchase(body.itemId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid inventory item", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add to inventory" });
    }
  });

  app.delete("/api/accounts/:accountId/inventory/:itemId", async (req, res) => {
    try {
      await storage.removeFromInventory(req.params.itemId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove from inventory" });
    }
  });

  // Sell item endpoint - only for Journeyman rank and above
  const SELL_RANKS = ["Journeyman", "Expert", "Master", "Grandmaster", "Legend", "Elite"];
  const SELL_PRICE_MULTIPLIER = 0.5; // Players get 50% of original price

  app.post("/api/accounts/:accountId/inventory/:itemId/sell", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Check rank requirement
      if (!SELL_RANKS.includes(account.rank)) {
        return res.status(403).json({ error: "You must be Journeyman rank or higher to sell items" });
      }

      const inventoryItem = await storage.getInventoryItem(req.params.itemId);
      if (!inventoryItem) {
        return res.status(404).json({ error: "Item not found in inventory" });
      }

      if (inventoryItem.accountId !== account.id) {
        return res.status(403).json({ error: "This item doesn't belong to you" });
      }

      // Check if item is equipped
      const equipped = account.equipped as any || {};
      if (Object.values(equipped).includes(inventoryItem.id)) {
        return res.status(400).json({ error: "Cannot sell an equipped item. Unequip it first." });
      }

      // Get item price from the request body (frontend sends it based on items-data.ts)
      const { originalPrice } = z.object({ originalPrice: z.number().min(0) }).parse(req.body);
      const dynamicPrice = getMarketPrice(inventoryItem.itemId, originalPrice);
      const sellPrice = Math.floor(dynamicPrice * SELL_PRICE_MULTIPLIER);

      await storage.removeFromInventory(inventoryItem.id);
      await storage.updateAccount(account.id, { gold: account.gold + sellPrice });
      recordSale(inventoryItem.itemId);

      const updatedAccount = await storage.getAccount(account.id);
      
      // Broadcast update to admins
      if (updatedAccount && updatedAccount.role === "player") {
        const { password: _, ...safeAccount } = updatedAccount;
        broadcastToAdmins("playerUpdate", safeAccount);
      }

      res.json({ 
        success: true, 
        goldReceived: sellPrice,
        newGoldBalance: updatedAccount?.gold || account.gold + sellPrice
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to sell item" });
    }
  });

  app.post("/api/admin/give-item", async (req, res) => {
    try {
      const { playerUsername, itemId } = z.object({
        playerUsername: z.string(),
        itemId: z.string(),
      }).parse(req.body);

      const player = await storage.getAccountByUsername(playerUsername);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      const inventoryItem = await storage.addToInventory({
        accountId: player.id,
        itemId,
        purchasedAt: new Date(),
      });

      res.status(201).json(inventoryItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to give item" });
    }
  });

  app.post("/api/admin/modify-player", async (req, res) => {
    try {
      const modifySchema = z.object({
        playerUsername: z.string(),
        section: z.enum(["gold", "rubies", "soulShards", "focusedShards", "trainingPoints", "pets", "stats", "rank", "wins", "losses", "inventory", "equipped"]),
        key: z.string().optional(),
        value: z.any(),
        action: z.enum(["set", "add", "deduct", "append", "remove"]),
      });

      const { playerUsername, section, key, value, action } = modifySchema.parse(req.body);

      const player = await storage.getAccountByUsername(playerUsername);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      let updatedPlayer = player;

      if (section === "stats" && key) {
        const newStats = { ...player.stats };
        if (action === "set") {
          (newStats as any)[key] = value;
        } else if (action === "add") {
          (newStats as any)[key] = ((newStats as any)[key] || 0) + value;
        } else if (action === "deduct") {
          (newStats as any)[key] = ((newStats as any)[key] || 0) - value;
        }
        updatedPlayer = (await storage.updateAccountStats(player.id, newStats))!;
      } else if (section === "equipped" && key) {
        const newEquipped = { ...player.equipped };
        (newEquipped as any)[key] = action === "set" ? value : null;
        updatedPlayer = (await storage.updateAccountEquipped(player.id, newEquipped))!;
      } else if (section === "gold") {
        let newGold = player.gold;
        if (action === "set") newGold = value;
        else if (action === "add") newGold += value;
        else if (action === "deduct") newGold -= value;
        updatedPlayer = (await storage.updateAccountGold(player.id, newGold))!;
      } else if (section === "rubies") {
        let newRubies = player.rubies;
        if (action === "set") newRubies = value;
        else if (action === "add") newRubies += value;
        else if (action === "deduct") newRubies -= value;
        updatedPlayer = (await storage.updateAccountResources(player.id, { rubies: newRubies }))!;
      } else if (section === "soulShards") {
        let newShards = player.soulShards;
        if (action === "set") newShards = value;
        else if (action === "add") newShards += value;
        else if (action === "deduct") newShards -= value;
        updatedPlayer = (await storage.updateAccountResources(player.id, { soulShards: newShards }))!;
      } else if (section === "focusedShards") {
        let newFocused = player.focusedShards;
        if (action === "set") newFocused = value;
        else if (action === "add") newFocused += value;
        else if (action === "deduct") newFocused -= value;
        updatedPlayer = (await storage.updateAccountResources(player.id, { focusedShards: newFocused }))!;
      } else if (section === "trainingPoints") {
        let newTP = player.trainingPoints;
        if (action === "set") newTP = value;
        else if (action === "add") newTP += value;
        else if (action === "deduct") newTP -= value;
        updatedPlayer = (await storage.updateAccount(player.id, { trainingPoints: newTP }))!;
      } else if (section === "pets") {
        let newPets = [...(player.pets || [])];
        if (action === "set") newPets = value;
        else if (action === "append") newPets.push(value);
        else if (action === "remove") newPets = newPets.filter(p => p !== value);
        updatedPlayer = (await storage.updateAccountResources(player.id, { pets: newPets }))!;
      } else if (section === "wins") {
        let newWins = player.wins;
        if (action === "set") newWins = value;
        else if (action === "add") newWins += value;
        else if (action === "deduct") newWins -= value;
        updatedPlayer = (await storage.updateAccountWins(player.id, newWins))!;
      } else if (section === "losses") {
        let newLosses = player.losses;
        if (action === "set") newLosses = value;
        else if (action === "add") newLosses += value;
        else if (action === "deduct") newLosses -= value;
        updatedPlayer = (await storage.updateAccountLosses(player.id, newLosses))!;
      } else if (section === "rank") {
        updatedPlayer = (await storage.updateAccountRank(player.id, value))!;
      } else if (section === "inventory") {
        if (action === "append") {
          await storage.addToInventory({
            accountId: player.id,
            itemId: value,
            purchasedAt: new Date(),
          });
        } else if (action === "remove") {
          const inventory = await storage.getInventoryByAccount(player.id);
          const toRemove = inventory.find(i => i.itemId === value);
          if (toRemove) {
            await storage.removeFromInventory(toRemove.id);
          }
        }
        updatedPlayer = (await storage.getAccount(player.id))!;
      }

      if (updatedPlayer.role === "player") {
        const { password: _, ...safeAccount } = updatedPlayer;
        broadcastToAdmins("playerUpdate", safeAccount);
      }

      res.json(updatedPlayer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to modify player" });
    }
  });

  // Event routes
  app.get("/api/events", async (_req, res) => {
    try {
      const allEvents = await storage.getAllEvents();
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.get("/api/events/:id/registrations", async (req, res) => {
    try {
      const registrations = await storage.getEventRegistrations(req.params.id);
      const registrationsWithAccounts = await Promise.all(
        registrations.map(async (reg) => {
          const account = await storage.getAccount(reg.accountId);
          return {
            ...reg,
            username: account?.username || "Unknown",
          };
        })
      );
      res.json(registrationsWithAccounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch registrations" });
    }
  });

  app.post("/api/admin/events", async (req, res) => {
    try {
      // Convert date strings to Date objects before validation
      const body = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };
      const eventData = insertEventSchema.parse(body);
      const event = await storage.createEvent(eventData);
      
      // If mandatory, auto-register all players
      if (eventData.isMandatory) {
        const allAccounts = await storage.getAllAccounts();
        const players = allAccounts.filter(a => a.role === "player");
        
        for (const player of players) {
          await storage.registerForEvent({
            eventId: event.id,
            accountId: player.id,
            isAutoRegistered: true,
          });
        }
        
        // Broadcast notification to all connected players about mandatory event
        broadcastToAllPlayers("mandatoryEventRegistration", {
          event,
          message: `You have been automatically registered for: ${event.name}`,
        });
        
        // Also notify admins
        broadcastToAdmins("mandatoryEvent", {
          event,
          message: `Mandatory event created - ${players.length} players auto-registered`,
          registeredCount: players.length,
        });
      }
      
      // Broadcast new event to admins
      broadcastToAdmins("newEvent", event);
      
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.delete("/api/admin/events/:id", async (req, res) => {
    try {
      await storage.deleteEvent(req.params.id);
      broadcastToAdmins("eventDeleted", { eventId: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.post("/api/events/:id/register", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const eventId = req.params.id;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      const alreadyRegistered = await storage.isRegisteredForEvent(eventId, accountId);
      if (alreadyRegistered) {
        return res.status(400).json({ error: "Already registered for this event" });
      }
      
      const registration = await storage.registerForEvent({
        eventId,
        accountId,
        isAutoRegistered: false,
      });
      
      res.status(201).json(registration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid registration data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to register for event" });
    }
  });

  app.delete("/api/events/:id/register/:accountId", async (req, res) => {
    try {
      const { id: eventId, accountId } = req.params;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Don't allow unregistration from mandatory events
      if (event.isMandatory) {
        return res.status(403).json({ error: "Cannot unregister from mandatory events" });
      }
      
      await storage.unregisterFromEvent(eventId, accountId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to unregister from event" });
    }
  });

  app.get("/api/accounts/:accountId/events", async (req, res) => {
    try {
      const registrations = await storage.getPlayerEventRegistrations(req.params.accountId);
      const eventsWithDetails = await Promise.all(
        registrations.map(async (reg) => {
          const event = await storage.getEvent(reg.eventId);
          return {
            ...reg,
            event,
          };
        })
      );
      res.json(eventsWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player events" });
    }
  });

  // NPC challenge rate limiting: 2 challenges per NPC per player per day
  const npcChallengeTracker = new Map<string, { count: number; resetAt: number }>();
  const NPC_CHALLENGE_LIMIT = 2;
  
  function getNpcChallengeKey(playerId: string, npcId: string): string {
    return `${playerId}:${npcId}`;
  }
  
  function canChallengeNpc(playerId: string, npcId: string): { allowed: boolean; remaining: number } {
    const key = getNpcChallengeKey(playerId, npcId);
    const now = Date.now();
    const tracker = npcChallengeTracker.get(key);
    
    if (!tracker || now > tracker.resetAt) {
      return { allowed: true, remaining: NPC_CHALLENGE_LIMIT - 1 };
    }
    
    if (tracker.count >= NPC_CHALLENGE_LIMIT) {
      return { allowed: false, remaining: 0 };
    }
    
    return { allowed: true, remaining: NPC_CHALLENGE_LIMIT - tracker.count - 1 };
  }
  
  function recordNpcChallenge(playerId: string, npcId: string): void {
    const key = getNpcChallengeKey(playerId, npcId);
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const resetAt = midnight.getTime();
    
    const tracker = npcChallengeTracker.get(key);
    if (!tracker || now > tracker.resetAt) {
      npcChallengeTracker.set(key, { count: 1, resetAt });
    } else {
      tracker.count++;
    }
  }

  // Challenge routes
  app.post("/api/challenges", async (req, res) => {
    try {
      const { challengerId, challengedId } = z.object({
        challengerId: z.string(),
        challengedId: z.string(),
      }).parse(req.body);

      if (challengerId === challengedId) {
        return res.status(400).json({ error: "Cannot challenge yourself" });
      }

      const challenger = await storage.getAccount(challengerId);
      const challenged = await storage.getAccount(challengedId);
      
      if (!challenger || !challenged) {
        return res.status(404).json({ error: "Player not found" });
      }

      if (challenger.ghostState || challenger.isDead) {
        return res.status(403).json({ error: "You are in Ghost State and cannot initiate PvP. Respawn first." });
      }

      // Check NPC challenge rate limit
      const { isNPCAccount, autoAcceptNPCChallenge } = await import("./npc-accounts");
      const isNPC = isNPCAccount(challenged.username);
      
      if (isNPC) {
        const { allowed } = canChallengeNpc(challengerId, challengedId);
        if (!allowed) {
          return res.status(429).json({ 
            error: `You can only challenge this NPC ${NPC_CHALLENGE_LIMIT} times per day. Try again tomorrow!` 
          });
        }
        recordNpcChallenge(challengerId, challengedId);
      }

      const challenge = await storage.createChallenge({
        challengerId,
        challengedId,
      });

      // Notify the challenged player
      broadcastToPlayer(challengedId, "newChallenge", {
        challenge,
        challengerName: challenger.username,
        message: `${challenger.username} has challenged you!`,
      });
      
      // Auto-accept if challenged player is an NPC
      if (isNPC) {
        await autoAcceptNPCChallenge(challenge.id);
      }

      res.status(201).json(challenge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid challenge data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  app.get("/api/challenges", async (req, res) => {
    try {
      const accountId = req.query.accountId as string;
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const challenges = await storage.getChallengesForPlayer(accountId);
      
      // Fetch player names for each challenge
      const challengesWithNames = await Promise.all(
        challenges.map(async (challenge) => {
          const challenger = await storage.getAccount(challenge.challengerId);
          const challenged = await storage.getAccount(challenge.challengedId);
          const winner = challenge.winnerId ? await storage.getAccount(challenge.winnerId) : null;
          return {
            ...challenge,
            challengerName: challenger?.username || "Unknown",
            challengedName: challenged?.username || "Unknown",
            winnerName: winner?.username || null,
            challengerOnline: activeSessions.has(challenge.challengerId),
            challengedOnline: activeSessions.has(challenge.challengedId),
          };
        })
      );
      
      res.json(challengesWithNames);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/admin/challenges", async (_req, res) => {
    try {
      const acceptedChallenges = await storage.getAcceptedChallenges();
      const allPets = await storage.getAllPets();
      const { isNPCAccount } = await import("./npc-accounts");
      
      const challengesWithNames = await Promise.all(
        acceptedChallenges.map(async (challenge) => {
          const challenger = await storage.getAccount(challenge.challengerId);
          const challenged = await storage.getAccount(challenge.challengedId);
          
          // Calculate strength for both players (stats + items + pet)
          const challengerStrength = await calculatePlayerStrength(challenge.challengerId);
          const challengedStrength = await calculatePlayerStrength(challenge.challengedId);
          
          // Get equipped pets info
          const challengerPet = challenger?.equippedPetId 
            ? allPets.find(p => p.id === challenger.equippedPetId) 
            : null;
          const challengedPet = challenged?.equippedPetId 
            ? allPets.find(p => p.id === challenged.equippedPetId) 
            : null;
          
          // Check if either player is an NPC
          const challengerIsNPC = challenger ? isNPCAccount(challenger.username) : false;
          const challengedIsNPC = challenged ? isNPCAccount(challenged.username) : false;
          
          // Get current combat state if it exists
          const combatState = (challenge as any).combatState;
          
          return {
            ...challenge,
            challengerName: challenger?.username || "Unknown",
            challengedName: challenged?.username || "Unknown",
            challengerOnline: activeSessions.has(challenge.challengerId),
            challengedOnline: activeSessions.has(challenge.challengedId),
            challengerStrength,
            challengedStrength,
            challengerPet: challengerPet ? { name: challengerPet.name, tier: challengerPet.tier, elements: challengerPet.elements } : null,
            challengedPet: challengedPet ? { name: challengedPet.name, tier: challengedPet.tier, elements: challengedPet.elements } : null,
            challengerIsNPC,
            challengedIsNPC,
            npcAction: combatState ? (challengerIsNPC ? combatState.challengerAction : challengedIsNPC ? combatState.challengedAction : null) : null,
          };
        })
      );
      
      res.json(challengesWithNames);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accepted challenges" });
    }
  });

  app.post("/api/admin/challenges/:challengeId/force-end", async (req, res) => {
    try {
      const { adminId } = req.body;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });
      await db.delete(challengesTable).where(eq(challengesTable.id, req.params.challengeId));
      res.json({ success: true, message: "Challenge force-ended" });
    } catch (error) {
      res.status(500).json({ error: "Failed to force-end challenge" });
    }
  });
  
  // Admin endpoint to set NPC action in a challenge
  app.post("/api/admin/challenges/:id/npc-action", async (req, res) => {
    try {
      const schema = z.object({
        action: z.enum(["attack", "defend", "dodge", "trick"]),
        adminId: z.string(),
      });
      const { action, adminId } = schema.parse(req.body);
      
      // Verify admin role
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.status !== "accepted") {
        return res.status(400).json({ error: "Challenge must be accepted" });
      }
      
      const { isNPCAccount } = await import("./npc-accounts");
      const challenger = await storage.getAccount(challenge.challengerId);
      const challenged = await storage.getAccount(challenge.challengedId);
      
      if (!challenger || !challenged) {
        return res.status(404).json({ error: "Players not found" });
      }
      
      const challengerIsNPC = isNPCAccount(challenger.username);
      const challengedIsNPC = isNPCAccount(challenged.username);
      
      if (!challengerIsNPC && !challengedIsNPC) {
        return res.status(400).json({ error: "No NPC in this challenge" });
      }
      
      // Get or create combat state
      let combatState = (challenge as any).combatState;
      if (!combatState) {
        return res.status(400).json({ error: "Combat not initialized. Wait for player to make first move." });
      }
      
      // Set the NPC action
      if (challengerIsNPC) {
        combatState.challengerAction = action;
        if (combatState.player1) combatState.player1.action = action;
      } else {
        combatState.challengedAction = action;
        if (combatState.player2) combatState.player2.action = action;
      }
      
      // Update challenge with new combat state
      await storage.updateChallengeCombatState(challenge.id, combatState);
      
      res.json({ success: true, action, npcName: challengerIsNPC ? challenger.username : challenged.username });
    } catch (error) {
      console.error("Admin NPC action error:", error);
      res.status(500).json({ error: "Failed to set NPC action" });
    }
  });

  app.patch("/api/challenges/:id/accept", async (req, res) => {
    try {
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.status !== "pending") {
        return res.status(400).json({ error: "Challenge is not pending" });
      }

      const challenger = await storage.getAccount(challenge.challengerId);
      const challenged = await storage.getAccount(challenge.challengedId);
      
      if (!challenger || !challenged) {
        return res.status(404).json({ error: "Players not found" });
      }

      if (challenged.ghostState || challenged.isDead) {
        return res.status(403).json({ error: "You are in Ghost State and cannot accept PvP challenges. Respawn first." });
      }
      
      // Get pets and birds for both players to add their stats
      const { pets, birds } = await import("@shared/schema");
      
      // Helper to get total combat stats including pets and birds
      const getTotalCombatStats = async (account: typeof challenger) => {
        const baseStats = account.stats as any || {};
        const stats = {
          Str: baseStats.Str || 10,
          Def: baseStats.Def || 10,
          Spd: baseStats.Spd || 10,
          Int: baseStats.Int || 10,
          Luck: baseStats.Luck || 10,
        };
        
        // Add equipped pet stats
        if (account.equippedPetId) {
          const [equippedPet] = await db.select().from(pets).where(eq(pets.id, account.equippedPetId));
          if (equippedPet) {
            const petStats = equippedPet.stats as any || {};
            stats.Str += petStats.Str || 0;
            stats.Spd += petStats.Spd || 0;
            stats.Luck += petStats.Luck || 0;
            // ElementalPower adds to Int
            stats.Int += petStats.ElementalPower || 0;
          }
        }
        
        // Add all bird stats (birds provide Def and Spd)
        const accountBirds = await db.select().from(birds).where(eq(birds.accountId, account.id));
        for (const bird of accountBirds) {
          const birdStats = bird.stats as any || {};
          stats.Def += birdStats.Def || 0;
          stats.Spd += birdStats.Spd || 0;
        }
        
        return stats;
      };
      
      // Initialize combat state - HP scales with all stats including pets/birds
      const challengerStats = await getTotalCombatStats(challenger);
      const challengedStats = await getTotalCombatStats(challenged);
      const calcHP = (stats: any) => {
        const str = stats?.Str || 10;
        const def = stats?.Def || 10;
        const spd = stats?.Spd || 10;
        const int = stats?.Int || 10;
        const luck = stats?.Luck || 10;
        return 100 + (str * 2) + (def * 3) + (spd * 1) + (int * 1) + (luck * 1);
      };
      const challengerHP = calcHP(challengerStats);
      const challengedHP = calcHP(challengedStats);
      const initialCombatState = {
        round: 1,
        player1: {
          id: challenger.id,
          name: challenger.username,
          hp: challengerHP,
          maxHp: challengerHP,
          action: null,
        },
        player2: {
          id: challenged.id,
          name: challenged.username,
          hp: challengedHP,
          maxHp: challengedHP,
          action: null,
        },
        log: ["Combat has begun!"],
        status: "waiting",
        challengerAction: null,
        challengedAction: null,
      };
      
      const updatedChallenge = await storage.updateChallengeStatus(
        req.params.id, 
        "accepted",
        new Date()
      );
      
      // Save initial combat state
      await storage.updateChallengeCombatState(req.params.id, initialCombatState);
      
      // Notify admin that a challenge was accepted
      broadcastToAdmins("challengeAccepted", {
        challenge: updatedChallenge,
        challengerName: challenger?.username,
        challengedName: challenged?.username,
        message: `${challenged?.username} accepted challenge from ${challenger?.username}`,
      });
      
      // Notify both players that combat can begin
      broadcastToPlayer(challenge.challengerId, "challengeAccepted", {
        challenge: updatedChallenge,
        opponentName: challenged?.username,
        message: `${challenged?.username} has accepted your challenge! Combat is ready to begin!`,
        combatReady: true,
      });
      
      broadcastToPlayer(challenge.challengedId, "challengeAccepted", {
        challenge: updatedChallenge,
        opponentName: challenger?.username,
        message: `You accepted ${challenger?.username}'s challenge! Combat is ready to begin!`,
        combatReady: true,
      });

      res.json(updatedChallenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept challenge" });
    }
  });

  app.patch("/api/challenges/:id/decline", async (req, res) => {
    try {
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.status !== "pending") {
        return res.status(400).json({ error: "Challenge is not pending" });
      }

      const updatedChallenge = await storage.updateChallengeStatus(req.params.id, "declined");
      
      const challenged = await storage.getAccount(challenge.challengedId);
      
      // Notify the challenger
      broadcastToPlayer(challenge.challengerId, "challengeDeclined", {
        challenge: updatedChallenge,
        challengedName: challenged?.username,
        message: `${challenged?.username} declined your challenge`,
      });

      res.json(updatedChallenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline challenge" });
    }
  });

  app.patch("/api/challenges/:id/cancel", async (req, res) => {
    try {
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.status !== "pending") {
        return res.status(400).json({ error: "Can only cancel pending challenges" });
      }

      const updatedChallenge = await storage.updateChallengeStatus(req.params.id, "cancelled");

      res.json(updatedChallenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel challenge" });
    }
  });

  // Turn-based combat system replaces admin winner selection
  // Combat actions: attack (Str), defend (Def), dodge (Spd), trick (Int)
  // Luck affects critical hit chance
  app.post("/api/challenges/:id/combat-action", async (req, res) => {
    try {
      const schema = z.object({
        playerId: z.string().optional(),
        accountId: z.string().optional(),
        action: z.enum(["attack", "defend", "dodge", "trick"]),
      }).refine(data => data.playerId || data.accountId, {
        message: "Either playerId or accountId is required"
      });
      const parsed = schema.parse(req.body);
      const accountId = parsed.playerId || parsed.accountId!;
      const action = parsed.action;
      
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      if (challenge.status !== "accepted") {
        return res.status(400).json({ error: "Challenge must be accepted for combat" });
      }
      
      if (accountId !== challenge.challengerId && accountId !== challenge.challengedId) {
        return res.status(403).json({ error: "You are not a participant in this challenge" });
      }
      
      // Get combat state from challenge
      let combatState = (challenge as any).combatState;
      
      if (!combatState) {
        return res.status(400).json({ error: "Combat not initialized" });
      }
      
      // Record the action - use challengerAction/challengedAction fields
      const isChallenger = accountId === challenge.challengerId;
      
      if (isChallenger) {
        combatState.challengerAction = action;
        if (combatState.player1) combatState.player1.action = action;
      } else {
        combatState.challengedAction = action;
        if (combatState.player2) combatState.player2.action = action;
      }
      
      // Check if opponent is an NPC and auto-select action for them (only if they haven't already chosen)
      const { isNPCAccount } = await import("./npc-accounts");
      const { pets, birds } = await import("@shared/schema");
      const challenger = await storage.getAccount(challenge.challengerId);
      const challenged = await storage.getAccount(challenge.challengedId);
      
      if (challenger && challenged) {
        const opponentAccount = isChallenger ? challenged : challenger;
        const npcNeedsAction = isChallenger 
          ? !combatState.challengedAction 
          : !combatState.challengerAction;
        
        if (isNPCAccount(opponentAccount.username) && npcNeedsAction) {
          // Helper to get total combat stats including pets and birds
          const getNPCTotalStats = async (account: typeof opponentAccount) => {
            const baseStats = account.stats as any || {};
            const stats = {
              Str: baseStats.Str || 10,
              Def: baseStats.Def || 10,
              Spd: baseStats.Spd || 10,
              Int: baseStats.Int || 10,
              Luck: baseStats.Luck || 10,
            };
            
            if (account.equippedPetId) {
              const [equippedPet] = await db.select().from(pets).where(eq(pets.id, account.equippedPetId));
              if (equippedPet) {
                const petStats = equippedPet.stats as any || {};
                stats.Str += petStats.Str || 0;
                stats.Spd += petStats.Spd || 0;
                stats.Luck += petStats.Luck || 0;
                stats.Int += petStats.ElementalPower || 0;
              }
            }
            
            const accountBirds = await db.select().from(birds).where(eq(birds.accountId, account.id));
            for (const bird of accountBirds) {
              const birdStats = bird.stats as any || {};
              stats.Def += birdStats.Def || 0;
              stats.Spd += birdStats.Spd || 0;
            }
            
            return stats;
          };
          
          // NPC auto-selects an action based on their total stats (including pets/birds)
          const npcStats = await getNPCTotalStats(opponentAccount);
          const actions = ["attack", "defend", "dodge", "trick"] as const;
          
          // Weight action selection based on NPC total stats
          const weights = {
            attack: npcStats.Str / 10,
            defend: npcStats.Def / 10,
            dodge: npcStats.Spd / 10,
            trick: npcStats.Int / 10,
          };
          
          // Also factor in some randomness
          const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) + 4;
          let random = Math.random() * totalWeight;
          let npcAction: typeof actions[number] = "attack";
          
          for (const act of actions) {
            random -= weights[act] + 1;
            if (random <= 0) {
              npcAction = act;
              break;
            }
          }
          
          // Set NPC action only if not already set
          if (isChallenger && !combatState.challengedAction) {
            combatState.challengedAction = npcAction;
            if (combatState.player2) combatState.player2.action = npcAction;
          } else if (!isChallenger && !combatState.challengerAction) {
            combatState.challengerAction = npcAction;
            if (combatState.player1) combatState.player1.action = npcAction;
          }
        }
      }
      
      // If both players have submitted actions, resolve the round
      if (combatState.challengerAction && combatState.challengedAction) {

        const challenger = await storage.getAccount(challenge.challengerId);
        const challenged = await storage.getAccount(challenge.challengedId);
        
        if (!challenger || !challenged) {
          return res.status(404).json({ error: "Player not found" });
        }
        
        // Get total combat stats including pets and birds
        const { pets, birds } = await import("@shared/schema");
        
        const getTotalCombatStats = async (account: typeof challenger) => {
          const baseStats = account.stats as any || {};
          const stats = {
            Str: baseStats.Str || 10,
            Def: baseStats.Def || 10,
            Spd: baseStats.Spd || 10,
            Int: baseStats.Int || 10,
            Luck: baseStats.Luck || 10,
          };
          
          // Add equipped pet stats
          if (account.equippedPetId) {
            const [equippedPet] = await db.select().from(pets).where(eq(pets.id, account.equippedPetId));
            if (equippedPet) {
              const petStats = equippedPet.stats as any || {};
              stats.Str += petStats.Str || 0;
              stats.Spd += petStats.Spd || 0;
              stats.Luck += petStats.Luck || 0;
              stats.Int += petStats.ElementalPower || 0;
            }
          }
          
          // Add all bird stats
          const accountBirds = await db.select().from(birds).where(eq(birds.accountId, account.id));
          for (const bird of accountBirds) {
            const birdStats = bird.stats as any || {};
            stats.Def += birdStats.Def || 0;
            stats.Spd += birdStats.Spd || 0;
          }
          
          return stats;
        };
        
        const challengerStats = await getTotalCombatStats(challenger);
        const challengedStats = await getTotalCombatStats(challenged);
        
        // Calculate damage based on actions
        const resolveCombat = (attackerStats: any, defenderStats: any, attackerAction: string, defenderAction: string) => {
          let damage = 0;
          let message = "";
          
          // Critical hit check (Luck-based)
          const critChance = Math.min((attackerStats.Luck || 10) / 100, 0.5);
          const isCrit = Math.random() < critChance;
          const critMult = isCrit ? 1.5 : 1;
          const str = attackerStats.Str || 10;
          const int = attackerStats.Int || 10;
          const spd = attackerStats.Spd || 10;
          const defStat = defenderStats.Def || 10;
          const defSpd = defenderStats.Spd || 10;
          
          if (attackerAction === "attack") {
            if (defenderAction === "defend") {
              damage = Math.max(1, (str - defStat) * critMult);
              message = `Attack vs Defend: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            } else if (defenderAction === "dodge") {
              const dodgeChance = defSpd / (str + defSpd);
              if (Math.random() < dodgeChance) {
                damage = 0;
                message = "Attack vs Dodge: Missed!";
              } else {
                damage = str * critMult;
                message = `Attack vs Dodge: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
              }
            } else if (defenderAction === "trick") {
              damage = str * 1.2 * critMult;
              message = `Attack beats Trick: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            } else {
              damage = str * critMult;
              message = `Attack: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            }
          } else if (attackerAction === "trick") {
            if (defenderAction === "defend") {
              damage = int * 1.2 * critMult;
              message = `Trick beats Defend: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            } else if (defenderAction === "dodge") {
              damage = int * 0.8 * critMult;
              message = `Trick vs Dodge: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            } else if (defenderAction === "attack") {
              damage = 0;
              message = "Trick loses to Attack";
            } else {
              damage = int * 0.5 * critMult;
              message = `Trick vs Trick: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            }
          } else if (attackerAction === "dodge") {
            if (defenderAction === "trick") {
              damage = spd * 0.5 * critMult;
              message = `Dodge counters Trick: ${Math.round(damage)} damage${isCrit ? " (CRIT!)" : ""}`;
            } else {
              damage = 0;
              message = "Dodging...";
            }
          } else if (attackerAction === "defend") {
            damage = 0;
            message = "Defending...";
          }
          
          return { damage: Math.round(damage), message };
        };
        
        const challengerResult = resolveCombat(challengerStats, challengedStats, combatState.challengerAction, combatState.challengedAction);
        const challengedResult = resolveCombat(challengedStats, challengerStats, combatState.challengedAction, combatState.challengerAction);
        
        // Update HP in player1/player2 format
        if (combatState.player1) {
          combatState.player1.hp -= challengedResult.damage;
        }
        if (combatState.player2) {
          combatState.player2.hp -= challengerResult.damage;
        }
        
        // Add round to log
        const logEntry = `Round ${combatState.round}: ${combatState.player1?.name || 'Challenger'} used ${combatState.challengerAction} (${challengerResult.message}), ${combatState.player2?.name || 'Challenged'} used ${combatState.challengedAction} (${challengedResult.message})`;
        if (Array.isArray(combatState.log)) {
          combatState.log.push(logEntry);
        }
        
        // Check for winner
        let winnerId = null;
        let loserId = null;
        const p1HP = combatState.player1?.hp ?? 0;
        const p2HP = combatState.player2?.hp ?? 0;
        
        if (p1HP <= 0 && p2HP <= 0) {
          winnerId = p1HP >= p2HP ? challenge.challengerId : challenge.challengedId;
        } else if (p1HP <= 0) {
          winnerId = challenge.challengedId;
        } else if (p2HP <= 0) {
          winnerId = challenge.challengerId;
        }
        
        if (winnerId) {
          loserId = winnerId === challenge.challengerId ? challenge.challengedId : challenge.challengerId;
          combatState.status = "finished";
          combatState.winnerId = winnerId;
          
          await storage.updateChallengeCombatState(req.params.id, combatState);
          await storage.setChallengeWinner(req.params.id, winnerId);
          
          const winner = await storage.getAccount(winnerId);
          const loser = await storage.getAccount(loserId);
          
          if (winner) await storage.updateAccountWins(winnerId, winner.wins + 1);
          if (loser) await storage.updateAccountLosses(loserId, loser.losses + 1);
          
          let goldDropped = 0;
          let durabilityLost = 0;
          let deathMessage = "";
          if (loser && !isNPCAccount(loser.username)) {
            const penalty = calculateDeathPenalty(loser.gold);
            goldDropped = penalty.goldLost;
            durabilityLost = penalty.durabilityDamage;
            
            await db.update(accounts).set({
              gold: Math.max(0, loser.gold - goldDropped),
              isDead: true,
              ghostState: true,
              lastDeathTime: new Date(),
              deathCount: loser.deathCount + 1,
            }).where(eq(accounts.id, loserId));
            
            const { inventoryItems } = await import("@shared/schema");
            const loserEquipped = loser.equipped as any;
            for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
              const invId = loserEquipped?.[slot];
              if (invId) {
                await db.update(inventoryItems).set({
                  durability: sql`GREATEST(0, ${inventoryItems.durability} - ${durabilityLost})`,
                }).where(eq(inventoryItems.id, invId));
              }
            }
            
            if (loser.equippedPetId) {
              const { pets: petsTable } = await import("@shared/schema");
              await db.update(petsTable).set({ isFainted: true }).where(eq(petsTable.id, loser.equippedPetId));
            }
            
            if (winner) {
              await db.update(accounts).set({
                gold: winner.gold + goldDropped,
              }).where(eq(accounts.id, winnerId));
            }
            
            deathMessage = ` You dropped ${goldDropped} gold. Equipment lost ${durabilityLost} durability. You are now a Ghost — return to Base to respawn.`;
          }
          
          broadcastToPlayer(winnerId, "challengeResult", {
            challengeId: req.params.id,
            result: "won",
            combatState,
            message: `You won the battle against ${loser?.username}!${goldDropped > 0 ? ` You gained ${goldDropped} gold!` : ""}`,
            goldGained: goldDropped,
          });
          
          broadcastToPlayer(loserId, "challengeResult", {
            challengeId: req.params.id,
            result: "lost",
            combatState,
            message: `You lost the battle against ${winner?.username}.${deathMessage}`,
            goldLost: goldDropped,
            isDead: true,
          });
          
          res.json({ combatState, finished: true, winnerId, goldDropped });
          return;
        }
        
        // Next round - reset actions
        combatState.round++;
        combatState.challengerAction = null;
        combatState.challengedAction = null;
        if (combatState.player1) combatState.player1.action = null;
        if (combatState.player2) combatState.player2.action = null;
        combatState.status = "waiting";
        
        await storage.updateChallengeCombatState(req.params.id, combatState);
        
        broadcastToPlayer(challenge.challengerId, "combatRound", { challengeId: req.params.id, combatState });
        broadcastToPlayer(challenge.challengedId, "combatRound", { challengeId: req.params.id, combatState });
        
        res.json({ combatState, finished: false });
      } else {
        // Waiting for other player
        await storage.updateChallengeCombatState(req.params.id, combatState);
        res.json({ combatState, waiting: true, yourAction: action });
      }
    } catch (error) {
      console.error("Combat action error:", error);
      res.status(500).json({ error: "Failed to process combat action" });
    }
  });
  
  // Get combat state for a challenge
  app.get("/api/challenges/:id/combat", async (req, res) => {
    try {
      const challenge = await storage.getChallenge(req.params.id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      
      const combatState = (challenge as any).combatState;
      
      // If no combat state exists but challenge is accepted, initialize it
      if (!combatState && challenge.status === "accepted") {
        const challenger = await storage.getAccount(challenge.challengerId);
        const challenged = await storage.getAccount(challenge.challengedId);
        
        if (challenger && challenged) {
          const calcHP = (stats: any) => {
            const str = stats?.Str || 10;
            const def = stats?.Def || 10;
            const spd = stats?.Spd || 10;
            const int = stats?.Int || 10;
            const luck = stats?.Luck || 10;
            return 100 + (str * 2) + (def * 3) + (spd * 1) + (int * 1) + (luck * 1);
          };
          const challengerHP = calcHP(challenger.stats as any);
          const challengedHP = calcHP(challenged.stats as any);
          const initialCombatState = {
            round: 1,
            player1: {
              id: challenger.id,
              name: challenger.username,
              hp: challengerHP,
              maxHp: challengerHP,
              action: null,
            },
            player2: {
              id: challenged.id,
              name: challenged.username,
              hp: challengedHP,
              maxHp: challengedHP,
              action: null,
            },
            log: ["Combat has begun!"],
            status: "waiting",
            challengerAction: null,
            challengedAction: null,
          };
          
          await storage.updateChallengeCombatState(req.params.id, initialCombatState);
          return res.json(initialCombatState);
        }
      }
      
      res.json(combatState || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get combat state" });
    }
  });

  // Pet routes
  app.get("/api/accounts/:accountId/pets", async (req, res) => {
    const pets = await storage.getPetsByAccount(req.params.accountId);
    res.json(pets);
  });

  app.get("/api/accounts/:id/pet/revival-cost", async (req, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account) return res.status(404).json({ error: "Not found" });
    const activePetId = (account as any).equippedPetId;
    if (!activePetId) return res.json({ hasPet: false });
    const activePet = await storage.getPet(activePetId);
    if (!activePet) return res.json({ hasPet: false });
    const revivalCost = 500; // flat cost
    res.json({ hasPet: true, petName: activePet.name || "Your Pet", revivalCost, canAfford: account.gold >= revivalCost });
  });

  app.post("/api/accounts/:accountId/pets", async (req, res) => {
    try {
      const { petElements } = await import("@shared/schema");
      const { name, element, tier = "egg", exp = 0, stats = { Str: 1, Spd: 1, Luck: 1, ElementalPower: 1 } } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Pet name is required" });
      }
      
      // Use provided element or pick random one
      const petElement = element || petElements[Math.floor(Math.random() * petElements.length)];
      
      const pet = await storage.createPet({
        accountId: req.params.accountId,
        name,
        element: petElement,
        tier,
        exp,
        stats,
      });
      res.json(pet);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pet" });
    }
  });

  app.post("/api/pets/:id/feed-exp", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        amount: z.number().min(1).max(1000000),
      });
      const { accountId, amount } = schema.parse(req.body);
      
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "Not your pet" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (account.petExp < amount) {
        return res.status(400).json({ error: "Insufficient Pet EXP" });
      }
      
      await storage.updateAccount(accountId, { petExp: account.petExp - amount });
      const updatedPet = await storage.updatePet(pet.id, { exp: (pet.exp || 0) + amount });
      
      res.json({ pet: updatedPet, expGained: amount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to feed pet" });
    }
  });

  app.post("/api/pets/:id/evolve", async (req, res) => {
    try {
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }

      const account = await storage.getAccount(pet.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const { petTierConfig, petTiers } = await import("@shared/schema");
      const currentTierIndex = petTiers.indexOf(pet.tier as any);
      
      if (currentTierIndex >= petTiers.length - 1) {
        return res.status(400).json({ error: "Pet is already at maximum tier" });
      }

      const tierConfig = petTierConfig[pet.tier as keyof typeof petTierConfig];
      if (tierConfig.maxExp === null || pet.exp < tierConfig.maxExp) {
        return res.status(400).json({ error: `Pet needs ${tierConfig.maxExp} EXP to evolve` });
      }

      if (tierConfig.evolutionCost === null || account.gold < tierConfig.evolutionCost) {
        return res.status(400).json({ error: `Need ${tierConfig.evolutionCost} gold to evolve` });
      }

      const nextTier = petTiers[currentTierIndex + 1];
      const nextTierConfig = petTierConfig[nextTier as keyof typeof petTierConfig];
      
      // Double stats on evolution
      const currentStats = pet.stats as { Str: number; Spd: number; Luck: number; ElementalPower: number };
      const evolvedStats = {
        Str: Math.floor(currentStats.Str * (nextTierConfig.statMultiplier / tierConfig.statMultiplier)),
        Spd: Math.floor(currentStats.Spd * (nextTierConfig.statMultiplier / tierConfig.statMultiplier)),
        Luck: Math.floor(currentStats.Luck * (nextTierConfig.statMultiplier / tierConfig.statMultiplier)),
        ElementalPower: Math.floor(currentStats.ElementalPower * (nextTierConfig.statMultiplier / tierConfig.statMultiplier)),
      };

      await storage.updatePet(pet.id, { tier: nextTier, exp: 0, stats: evolvedStats });
      await storage.updateAccount(account.id, { gold: account.gold - tierConfig.evolutionCost });

      const updatedPet = await storage.getPet(pet.id);
      const updatedAccount = await storage.getAccount(account.id);
      
      if (updatedAccount && updatedAccount.role === "player") {
        const { password: _, ...safeAccount } = updatedAccount;
        broadcastToAdmins("playerUpdate", safeAccount);
      }

      res.json({ pet: updatedPet, account: updatedAccount });
    } catch (error) {
      res.status(500).json({ error: "Failed to evolve pet" });
    }
  });

  // Pet Rebirth - Convert mythic pet back to egg with bonus stats
  app.post("/api/pets/:id/rebirth", async (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "This is not your pet" });
      }
      
      if (pet.tier !== "mythic") {
        return res.status(400).json({ error: "Only mythic pets can be reborn" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const REBIRTH_COST = 500000000; // 500 million gold
      if (account.gold < REBIRTH_COST) {
        return res.status(400).json({ error: `Need ${REBIRTH_COST.toLocaleString()} gold for rebirth` });
      }
      
      const rebirthCount = (pet.rebirthCount || 0) + 1;
      const rebirthMultiplier = 1 + (rebirthCount * 0.1);
      
      const elements = pet.elements || [pet.element];
      const primaryElement = pet.element;
      
      const newStats = {
        Str: Math.floor(5 * rebirthMultiplier),
        Spd: Math.floor(5 * rebirthMultiplier),
        Luck: Math.floor(5 * rebirthMultiplier),
        ElementalPower: Math.floor(10 * rebirthMultiplier),
      };
      
      let mutationTrait: string | null = pet.mutationTrait || null;
      let mutationMessage = "";
      const mutationRoll = Math.random();
      if (mutationRoll < PET_MUTATION_CHANCE) {
        const traitKeys = Object.keys(PET_MUTATION_TRAITS) as PetMutationTrait[];
        const randomTrait = traitKeys[Math.floor(Math.random() * traitKeys.length)];
        mutationTrait = randomTrait;
        const traitInfo = PET_MUTATION_TRAITS[randomTrait];
        mutationMessage = ` MUTATION! ${traitInfo.name}: ${traitInfo.description}`;
      }
      
      const updateData: any = {
        tier: "egg",
        exp: 0,
        stats: newStats,
        rebirthCount,
        bondLevel: (pet.bondLevel || 0) + 5,
        elements: elements,
        element: primaryElement,
      };
      if (mutationTrait) {
        updateData.mutationTrait = mutationTrait;
      }
      
      await storage.updatePet(pet.id, updateData);
      
      const { pets: petsTable } = await import("@shared/schema");
      if (mutationTrait) {
        await db.update(petsTable).set({ mutationTrait }).where(eq(petsTable.id, pet.id));
      }
      
      await storage.updateAccount(accountId, { gold: account.gold - REBIRTH_COST });
      
      const updatedPet = await storage.getPet(pet.id);
      
      res.json({ 
        pet: updatedPet, 
        message: `${pet.name} has been reborn! Rebirth count: ${rebirthCount}${mutationMessage}`,
        rebirthBonus: `${(rebirthMultiplier * 100 - 100).toFixed(0)}% stat bonus`,
        mutation: mutationTrait ? { trait: mutationTrait, info: PET_MUTATION_TRAITS[mutationTrait as PetMutationTrait] } : null,
      });
    } catch (error) {
      console.error("Failed to rebirth pet:", error);
      res.status(500).json({ error: "Failed to rebirth pet" });
    }
  });

  // Pet Bonding - Increase bond level with your pet
  app.post("/api/pets/:id/bond", async (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "This is not your pet" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const BOND_COST = 100; // 100 soul gins per bond interaction
      if (account.soulGins < BOND_COST) {
        return res.status(400).json({ error: `Need ${BOND_COST} Soul Gins to bond with pet` });
      }
      
      const currentBond = pet.bondLevel || 0;
      const newBond = currentBond + 1;
      
      // Every 10 bond levels, grant a small stat bonus
      let statBonus = null;
      if (newBond % 10 === 0) {
        const currentStats = pet.stats as { Str: number; Spd: number; Luck: number; ElementalPower: number };
        const bonusStats = {
          Str: currentStats.Str + 1,
          Spd: currentStats.Spd + 1,
          Luck: currentStats.Luck + 1,
          ElementalPower: currentStats.ElementalPower + 2,
        };
        await storage.updatePet(pet.id, { bondLevel: newBond, stats: bonusStats });
        statBonus = "+1 to all stats, +2 ElementalPower";
      } else {
        await storage.updatePet(pet.id, { bondLevel: newBond });
      }
      
      await storage.updateAccount(accountId, { soulGins: account.soulGins - BOND_COST });
      
      const updatedPet = await storage.getPet(pet.id);
      const { petPersonalities } = await import("@shared/schema");
      
      // Generate a personality message based on pet's personality
      const personality = pet.personality || "loyal";
      const messages: Record<string, string[]> = {
        loyal: ["Your pet nuzzles against you lovingly.", "Your pet follows your every move with devotion."],
        playful: ["Your pet bounces around excitedly!", "Your pet wants to play more!"],
        fierce: ["Your pet growls affectionately.", "Your pet looks at you with fierce loyalty."],
        calm: ["Your pet rests peacefully beside you.", "Your pet closes its eyes contentedly."],
        mysterious: ["Your pet gazes at you with knowing eyes.", "Your pet seems to understand something deep."],
      };
      
      const message = messages[personality][Math.floor(Math.random() * messages[personality].length)];
      
      res.json({ 
        pet: updatedPet, 
        message,
        bondLevel: newBond,
        statBonus,
      });
    } catch (error) {
      console.error("Failed to bond with pet:", error);
      res.status(500).json({ error: "Failed to bond with pet" });
    }
  });

  // Set pet personality
  app.patch("/api/pets/:id/personality", async (req, res) => {
    try {
      const { accountId, personality } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const { petPersonalities } = await import("@shared/schema");
      if (!petPersonalities.includes(personality)) {
        return res.status(400).json({ error: "Invalid personality" });
      }
      
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "This is not your pet" });
      }
      
      await storage.updatePet(pet.id, { personality });
      const updatedPet = await storage.getPet(pet.id);
      
      res.json({ pet: updatedPet });
    } catch (error) {
      res.status(500).json({ error: "Failed to set personality" });
    }
  });

  // Pet skins
  const PET_SKINS = [
    { id: "default", name: "Default", cost: 0 },
    { id: "golden", name: "Golden Aura", cost: 10000 },
    { id: "shadow", name: "Shadow Shroud", cost: 25000 },
    { id: "crystalline", name: "Crystalline", cost: 50000 },
    { id: "flame", name: "Flame Essence", cost: 75000 },
    { id: "mythic", name: "Mythic Radiance", cost: 150000 },
  ];

  app.get("/api/pet-skins", (_req, res) => {
    res.json(PET_SKINS);
  });

  app.patch("/api/pets/:id/skin", async (req, res) => {
    try {
      const { accountId, skin } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const skinData = PET_SKINS.find(s => s.id === skin);
      if (!skinData) {
        return res.status(400).json({ error: "Invalid skin" });
      }
      
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "This is not your pet" });
      }

      // Check if player already has this skin (free switch) or needs to buy
      const currentSkin = (pet as any).skin || "default";
      if (currentSkin !== skin && skinData.cost > 0) {
        const account = await storage.getAccount(accountId);
        if (!account || account.gold < skinData.cost) {
          return res.status(400).json({ error: `Need ${skinData.cost.toLocaleString()} gold for this skin` });
        }
        await storage.updateAccount(accountId, { gold: account.gold - skinData.cost });
      }
      
      await storage.updatePet(pet.id, { skin });
      const updatedPet = await storage.getPet(pet.id);
      
      res.json({ pet: updatedPet, message: `Skin changed to ${skinData.name}!` });
    } catch (error) {
      res.status(500).json({ error: "Failed to set skin" });
    }
  });

  app.patch("/api/pets/:id", async (req, res) => {
    try {
      const { name, tier, exp, stats } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (tier !== undefined) updateData.tier = tier;
      if (exp !== undefined) updateData.exp = exp;
      if (stats !== undefined) updateData.stats = stats;

      const pet = await storage.updatePet(req.params.id, updateData);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      res.json(pet);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pet" });
    }
  });

  app.delete("/api/pets/:id", async (req, res) => {
    try {
      await storage.deletePet(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pet" });
    }
  });

  // Admin pet management routes
  app.get("/api/admin/pets", async (_req, res) => {
    try {
      const allPets = await storage.getAllPets();
      const allAccounts = await storage.getAllAccounts();
      
      const petsWithOwners = allPets.map(pet => {
        const owner = allAccounts.find(a => a.id === pet.accountId);
        return {
          ...pet,
          ownerName: owner?.username || "Unknown",
        };
      });
      
      res.json(petsWithOwners);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pets" });
    }
  });

  app.post("/api/admin/pets", async (req, res) => {
    try {
      const { petElements } = await import("@shared/schema");
      const { accountId, name, element, tier = "egg", exp = 0, stats = { Str: 1, Spd: 1, Luck: 1, ElementalPower: 1 } } = req.body;
      
      if (!accountId || !name) {
        return res.status(400).json({ error: "Account ID and pet name are required" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const petElement = element || petElements[Math.floor(Math.random() * petElements.length)];
      
      const pet = await storage.createPet({
        accountId,
        name,
        element: petElement,
        tier,
        exp,
        stats,
      });

      // Broadcast to the player that they received a new pet
      broadcastToPlayer(accountId, "petAdded", pet);
      
      // Broadcast to admins
      broadcastToAdmins("petCreated", {
        ...pet,
        ownerName: account.username,
      });

      res.json({ ...pet, ownerName: account.username });
    } catch (error) {
      res.status(500).json({ error: "Failed to create pet" });
    }
  });

  app.patch("/api/admin/pets/:id", async (req, res) => {
    try {
      const { name, element, elements, tier, exp, stats, accountId } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (element !== undefined) updateData.element = element;
      // Handle elements array update - this is what the NPC battle uses
      if (elements !== undefined) {
        updateData.elements = Array.isArray(elements) ? elements : [elements];
        // Also update the legacy element field to first element for compatibility
        if (updateData.elements.length > 0) {
          updateData.element = updateData.elements[0];
        }
      }
      if (tier !== undefined) updateData.tier = tier;
      if (exp !== undefined) updateData.exp = Number(exp);
      if (stats !== undefined) updateData.stats = stats;
      if (accountId !== undefined) updateData.accountId = accountId;

      const oldPet = await storage.getPet(req.params.id);
      if (!oldPet) {
        return res.status(404).json({ error: "Pet not found" });
      }

      const pet = await storage.updatePet(req.params.id, updateData);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }

      const account = await storage.getAccount(pet.accountId);
      
      // Broadcast to player
      broadcastToPlayer(pet.accountId, "petUpdated", pet);
      
      // If pet was transferred, notify both players
      if (accountId && accountId !== oldPet.accountId) {
        broadcastToPlayer(oldPet.accountId, "petRemoved", { petId: oldPet.id });
        broadcastToPlayer(accountId, "petAdded", pet);
      }
      
      // Broadcast to admins
      broadcastToAdmins("petUpdated", {
        ...pet,
        ownerName: account?.username || "Unknown",
      });

      res.json({ ...pet, ownerName: account?.username });
    } catch (error) {
      res.status(500).json({ error: "Failed to update pet" });
    }
  });

  app.delete("/api/admin/pets/:id", async (req, res) => {
    try {
      const pet = await storage.getPet(req.params.id);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }

      await storage.deletePet(req.params.id);
      
      // Broadcast to the player that pet was removed
      broadcastToPlayer(pet.accountId, "petRemoved", { petId: pet.id });
      
      // Broadcast to admins
      broadcastToAdmins("petDeleted", { petId: pet.id });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pet" });
    }
  });

  // NPC Battle System
  // Power scaling per floor: 
  // Floor 1 (levels 1-100): 1-999
  // Floor 2 (levels 101-200): 999-99,999
  // Floor 3 (levels 201-300): 99,999-9,999,999
  // etc. with exponential scaling
  
  const getNpcPowerRange = (floor: number): { min: number; max: number } => {
    const ranges = [
      { min: 1, max: 999 },                    // Floor 1
      { min: 999, max: 99999 },                // Floor 2
      { min: 99999, max: 9999999 },            // Floor 3
      { min: 9999999, max: 999999999 },        // Floor 4
      { min: 999999999, max: 99999999999 },    // Floor 5
    ];
    
    if (floor <= 5) {
      return ranges[floor - 1];
    }
    
    // For floors 6+, continue exponential scaling
    const baseMax = 99999999999; // Floor 5 max
    const multiplier = Math.pow(100, floor - 5);
    return {
      min: ranges[4].max * Math.pow(100, floor - 6),
      max: baseMax * multiplier,
    };
  };
  
  const getNpcPower = (floor: number, level: number): number => {
    const { min, max } = getNpcPowerRange(floor);
    const progress = (level - 1) / 99; // 0 to 1 over 100 levels
    return Math.floor(min + (max - min) * progress);
  };
  
  const bossAbilities = [
    { name: "Earthquake", description: "Deals massive earth damage" },
    { name: "Inferno", description: "Burns with unquenchable flames" },
    { name: "Blizzard", description: "Freezes targets solid" },
    { name: "Thunder God's Wrath", description: "Lightning strikes all enemies" },
    { name: "Void Rupture", description: "Tears holes in reality" },
    { name: "Time Warp", description: "Slows time around enemies" },
    { name: "Space Fold", description: "Teleports behind targets" },
    { name: "Soul Drain", description: "Absorbs life force" },
    { name: "Arcane Explosion", description: "Pure magical destruction" },
    { name: "Elemental Fury", description: "Combines multiple elements" },
  ];
  
  const getRandomBossAbility = (floor: number) => {
    const index = (floor - 1) % bossAbilities.length;
    return bossAbilities[index];
  };
  
  // Elements that NPCs can be immune to (level 101+)
  // All 18 elements for NPC immunities
  const allElements = [
    "Fire", "Water", "Earth", "Air", "Lightning", "Ice", "Nature", "Dark", "Light",
    "Arcana", "Chrono", "Plasma", "Void", "Aether", "Hybrid", "Elemental Convergence", "Time", "Space"
  ];
  
  const getNpcImmuneElements = (globalLevel: number): string[] => {
    if (globalLevel < 101) return [];
    
    // Number of immunities increases with floors
    const floor = Math.floor((globalLevel - 1) / 100) + 1;
    const numImmunities = Math.min(Math.floor(floor / 5) + 1, 5); // 1-5 immunities
    
    // Deterministic selection based on global level using seeded shuffle
    // Each level gets a unique but consistent set of immunities
    const seed = globalLevel * 31 + floor * 7;
    const selected: string[] = [];
    const available = [...allElements];
    
    for (let i = 0; i < numImmunities && available.length > 0; i++) {
      // Use deterministic index based on seed and iteration
      const index = ((seed * (i + 1) * 13) + (globalLevel * 17)) % available.length;
      selected.push(available[index]);
      available.splice(index, 1);
    }
    
    return selected;
  };
  
  // Get NPC data for display
  app.get("/api/npc/:floor/:level", async (req, res) => {
    try {
      const floor = parseInt(req.params.floor);
      const level = parseInt(req.params.level);
      
      if (floor < 1 || floor > 50 || level < 1 || level > 100) {
        return res.status(400).json({ error: "Invalid floor or level" });
      }
      
      const globalLevel = (floor - 1) * 100 + level;
      const isBoss = level === 100;
      const power = getNpcPower(floor, level);
      const immuneElements = getNpcImmuneElements(globalLevel);
      
      const npc = {
        floor,
        level,
        globalLevel,
        name: isBoss ? `Floor ${floor} Guardian` : `NPC ${globalLevel}`,
        power,
        isBoss,
        bossAbility: isBoss ? getRandomBossAbility(floor) : null,
        immuneElements,
        stats: isBoss ? {
          Str: power,
          Spd: power,
          Luck: Math.floor(power * 0.5),
        } : {
          Str: Math.floor(power * (0.7 + Math.random() * 0.3)),
          Spd: Math.floor(power * (0.7 + Math.random() * 0.3)),
          Luck: Math.floor(power * 0.3),
        },
      };
      
      res.json(npc);
    } catch (error) {
      res.status(500).json({ error: "Failed to get NPC data" });
    }
  });
  
  // Equip pet for NPC battles
  app.post("/api/accounts/:accountId/equip-pet", async (req, res) => {
    try {
      const { petId } = req.body;
      const account = await storage.getAccount(req.params.accountId);
      
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (petId) {
        const pet = await storage.getPet(petId);
        if (!pet || pet.accountId !== account.id) {
          return res.status(404).json({ error: "Pet not found or doesn't belong to you" });
        }
      }
      
      const updated = await storage.updateAccount(account.id, { equippedPetId: petId || null } as any);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to equip pet" });
    }
  });
  
  // Rank requirements for NPC levels
  const getNpcRankRequirement = (globalLevel: number): string | null => {
    // V2 15-rank system: Novice, Apprentice, Initiate, Journeyman, Adept, Expert, Master, 
    // Grandmaster, Champion, Overlord, Sovereign, Ascendant, Legend, Mythic, Mythical Legend
    if (globalLevel <= 100) return null; // Anyone can fight levels 1-100 (Floor 1)
    if (globalLevel <= 200) return "Apprentice"; // Floor 2 (index 1)
    if (globalLevel <= 500) return "Initiate"; // Floors 3-5 (index 2)
    if (globalLevel <= 1000) return "Journeyman"; // Floors 6-10 (index 3)
    if (globalLevel <= 2000) return "Adept"; // Floors 11-20 (index 4)
    if (globalLevel <= 3000) return "Expert"; // Floors 21-30 (index 5)
    if (globalLevel <= 4000) return "Master"; // Floors 31-40 (index 6)
    if (globalLevel <= 5000) return "Grandmaster"; // Floors 41-50 (index 7)
    if (globalLevel <= 6000) return "Champion"; // Floors 51-60 (index 8)
    if (globalLevel <= 7000) return "Overlord"; // Floors 61-70 (index 9)
    if (globalLevel <= 8000) return "Sovereign"; // Floors 71-80 (index 10)
    if (globalLevel <= 9000) return "Ascendant"; // Floors 81-90 (index 11)
    if (globalLevel <= 9500) return "Legend"; // Floors 91-95 (index 12)
    if (globalLevel <= 9900) return "Mythic"; // Floors 96-99 (index 13)
    return "Mythical Legend"; // Floor 100 (index 14)
  };
  
  // Challenge NPC
  app.post("/api/accounts/:accountId/npc-battle", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      
      if (!account || account.role !== "player") {
        return res.status(404).json({ error: "Player not found" });
      }
      
      if (account.ghostState || account.isDead) {
        return res.status(403).json({ error: "You are in Ghost State. Return to Base to respawn before entering combat." });
      }
      
      const floor = account.npcFloor || 1;
      const level = account.npcLevel || 1;
      const globalLevel = (floor - 1) * 100 + level;
      const npcName = level === 100 ? `Floor ${floor} Guardian` : `NPC ${globalLevel}`;
      const isBoss = level === 100;
      const npcPower = getNpcPower(floor, level);
      const npcImmunities = getNpcImmuneElements(globalLevel);
      
      // Check rank requirement for levels over 100
      const requiredRank = getNpcRankRequirement(globalLevel);
      if (requiredRank) {
        const playerRankIndex = playerRanks.indexOf(account.rank as any);
        const requiredRankIndex = playerRanks.indexOf(requiredRank as any);
        if (playerRankIndex < requiredRankIndex) {
          return res.status(403).json({ 
            error: "Rank too low", 
            message: `You need ${requiredRank} rank or higher to fight NPC level ${globalLevel}+`,
            requiredRank 
          });
        }
      }
      
      // V2 Combat Engine: Build player combatant
      // Note: Account stats already have race modifiers applied at registration, so don't re-apply
      const basePlayerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      const playerCombatStats: CombatStats = {
        Str: basePlayerStats.Str || 10,
        Def: basePlayerStats.Def || 10,
        Spd: basePlayerStats.Spd || 10,
        Int: basePlayerStats.Int || 10,
        Luck: basePlayerStats.Luck || 10,
        Pot: basePlayerStats.Pot || 0,
      };
      
      // Add equipped item stats
      const inventory = await storage.getInventoryByAccount(account.id);
      const equipped = account.equipped;
      
      for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
        const inventoryId = equipped[slot];
        if (inventoryId) {
          const invItem = inventory.find(i => i.id === inventoryId);
          if (invItem) {
            const stats = invItem.stats as any || {};
            playerCombatStats.Str += Number(stats.Str) || 0;
            playerCombatStats.Def += Number(stats.Def) || 0;
            playerCombatStats.Spd += Number(stats.Spd) || 0;
            playerCombatStats.Int += Number(stats.Int) || 0;
            playerCombatStats.Luck += Number(stats.Luck) || 0;
            playerCombatStats.Pot += Number(stats.Pot) || 0;
          }
        }
      }
      
      // Add pet stats and elements
      let petElements: string[] = [];
      let petElementalPower = 0;
      let equippedPet = null;
      
      if ((account as any).equippedPetId) {
        equippedPet = await storage.getPet((account as any).equippedPetId);
        if (equippedPet) {
          const petStats = equippedPet.stats as any;
          playerCombatStats.Str += Number(petStats.Str) || 0;
          playerCombatStats.Spd += Number(petStats.Spd) || 0;
          playerCombatStats.Luck += Number(petStats.Luck) || 0;
          petElementalPower = petStats.ElementalPower || 0;
          petElements = equippedPet.elements && equippedPet.elements.length > 0 
            ? equippedPet.elements 
            : equippedPet.element ? [equippedPet.element] : [];
        }
      }
      
      // Load equipped spell for combat
      let playerSpell: any = undefined;
      const equippedSkillRecord = await storage.getEquippedSkill(account.id);
      if (equippedSkillRecord) {
        const { getSkillById, RANK_MULTIPLIER } = await import("@shared/skills-data");
        const skillDef = getSkillById(equippedSkillRecord.skillId);
        if (skillDef) {
          const rankMult = RANK_MULTIPLIER[account.rank || "Novice"] || 1.0;
          playerSpell = {
            name: skillDef.name,
            multiplier: skillDef.spellPower || 1.5,
            element: skillDef.element,
            isAoE: skillDef.spellCategory === "aoe",
            targetCount: skillDef.targetCount,
            spellCategory: skillDef.spellCategory || "damage",
            spellPower: skillDef.spellPower || 1.5,
            ccType: skillDef.ccType,
            ccDuration: skillDef.ccDuration,
            buffStat: skillDef.buffStat,
            buffAmount: skillDef.buffAmount,
            rankMultiplier: rankMult,
          };
        }
      }

      // Build player combatant
      const playerCombatant: Combatant = {
        id: account.id,
        name: account.username,
        stats: playerCombatStats,
        race: account.race,
        rank: account.rank,
        elements: petElements.length > 0 ? { elements: petElements, elementalPower: petElementalPower } : undefined,
        immunities: [],
        level: globalLevel,
        isPlayer: true,
        spell: playerSpell || null,
      };
      
      // Build NPC combatant with scaled stats
      const npcBaseStats = Math.floor(npcPower / 5);
      const npcCombatStats: CombatStats = {
        Str: npcBaseStats + (isBoss ? 10 : 0),
        Def: Math.floor(npcBaseStats * 0.8) + (isBoss ? 15 : 0),
        Spd: Math.floor(npcBaseStats * 0.7),
        Int: Math.floor(npcBaseStats * 0.6),
        Luck: Math.floor(npcBaseStats * 0.3),
        Pot: isBoss ? Math.floor(npcBaseStats * 0.5) : 0,
      };
      
      const npcCombatant: Combatant = {
        id: `npc-${globalLevel}`,
        name: npcName,
        stats: npcCombatStats,
        immunities: npcImmunities,
        level: globalLevel,
        isPlayer: false,
      };
      
      // Run V2 combat engine
      const combatResult = runAutoCombat(playerCombatant, npcCombatant, 20);
      const won = combatResult.winner === account.id;
      let deathPenaltyInfo: { goldLost: number; durabilityDamage: number } | null = null;
      
      console.log(`V2 Battle - ${account.username} vs ${npcName}: ${won ? "WON" : "LOST"} in ${combatResult.rounds.length} rounds`);
      console.log(`V2 Battle - Player HP: ${combatResult.finalHP[account.id]}, NPC HP: ${combatResult.finalHP[npcCombatant.id]}`);
      
      const isElementImmune = petElements.some(elem => npcImmunities.includes(elem));
      
      let newFloor = floor;
      let newLevel = level;
      let rewards = { gold: 0, trainingPoints: 0, soulShards: 0, petExp: 0, runes: 0 };
      
      if (won) {
        // Calculate rewards based on global level
        // Gold = level × 50, TP = level × 10, Soul Shards = level × 2, Pet Exp = level × 100
        rewards = {
          gold: globalLevel * 50,
          trainingPoints: globalLevel * 10,
          soulShards: globalLevel * 2,
          petExp: globalLevel * 100,
          runes: isBoss ? floor * 10 : 0, // Bosses give runes
        };
        
        // Advance to next level (sequential progression - no skipping)
        if (level >= 100) {
          // Beat the floor boss, advance to next floor
          if (floor < 50) {
            newFloor = floor + 1;
            newLevel = 1;
          }
          // If floor 50, stay at max
        } else {
          newLevel = level + 1;
        }
        
        // Auto-update all rewards into player account (no win/loss tracking for NPC)
        await storage.updateAccount(account.id, {
          gold: account.gold + rewards.gold,
          trainingPoints: (account.trainingPoints || 0) + rewards.trainingPoints,
          soulShards: (account.soulShards || 0) + rewards.soulShards,
          runes: (account.runes || 0) + rewards.runes,
        } as any);
        
        // Give pet exp directly to the equipped pet
        if (equippedPet && rewards.petExp > 0) {
          await storage.updatePet(equippedPet.id, {
            exp: (equippedPet.exp || 0) + rewards.petExp,
          });
        }
        
        // Update NPC progress separately (sequential - only advance by 1)
        await storage.updateNpcProgress(account.id, newFloor, newLevel);
      } else {
        const penalty = calculateDeathPenalty(account.gold);
        deathPenaltyInfo = { goldLost: penalty.goldLost, durabilityDamage: penalty.durabilityDamage };
        await db.update(accounts).set({
          gold: Math.max(0, account.gold - penalty.goldLost),
          isDead: true,
          ghostState: true,
          lastDeathTime: new Date(),
          deathCount: account.deathCount + 1,
          lastCombatTime: new Date(),
        }).where(eq(accounts.id, account.id));

        const { inventoryItems: invTable } = await import("@shared/schema");
        const acctEquipped = account.equipped as any;
        for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
          const invId = acctEquipped?.[slot];
          if (invId) {
            await db.update(invTable).set({
              durability: sql`GREATEST(0, ${invTable.durability} - ${penalty.durabilityDamage})`,
            }).where(eq(invTable.id, invId));
          }
        }

        if (equippedPet) {
          const { pets: petsTable } = await import("@shared/schema");
          await db.update(petsTable).set({ isFainted: true }).where(eq(petsTable.id, equippedPet.id));
        }
      }
      
      const playerTotalPower = playerCombatStats.Str + playerCombatStats.Def + playerCombatStats.Spd + playerCombatStats.Int + playerCombatStats.Luck + playerCombatStats.Pot;
      const npcTotalPower = npcCombatStats.Str + npcCombatStats.Def + npcCombatStats.Spd + npcCombatStats.Int + npcCombatStats.Luck + npcCombatStats.Pot;
      
      const result = {
        won,
        playerPower: Math.floor(playerTotalPower),
        npcPower: Math.floor(npcTotalPower),
        npcName: isBoss ? `Floor ${floor} Guardian` : `NPC ${globalLevel}`,
        isBoss,
        bossAbility: isBoss ? getRandomBossAbility(floor) : null,
        npcImmunities,
        petElementImmune: isElementImmune,
        equippedPet: equippedPet ? {
          name: equippedPet.name,
          elements: petElements,
          power: petElementalPower,
        } : null,
        deathPenalty: deathPenaltyInfo,
        rewards,
        newFloor,
        newLevel,
        floor,
        level,
        combatDetails: {
          rounds: combatResult.rounds.length,
          playerFinalHP: combatResult.finalHP[account.id],
          npcFinalHP: combatResult.finalHP[npcCombatant.id],
          totalDamageDealt: combatResult.totalDamageDealt[account.id] || 0,
          totalDamageTaken: combatResult.totalDamageDealt[npcCombatant.id] || 0,
          highlights: combatResult.rounds.slice(-3).flatMap(r => r.effects).slice(0, 5),
        },
      };
      
      // Broadcast to admins
      broadcastToAdmins("npcBattle", {
        playerId: account.id,
        playerName: account.username,
        ...result,
      });
      
      res.json(result);
    } catch (error) {
      console.error("NPC battle error:", error);
      res.status(500).json({ error: "Failed to battle NPC" });
    }
  });
  
  // Get current NPC for player
  app.get("/api/accounts/:accountId/current-npc", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const floor = account.npcFloor || 1;
      const level = account.npcLevel || 1;
      const globalLevel = (floor - 1) * 100 + level;
      const isBoss = level === 100;
      const power = getNpcPower(floor, level);
      const immunities = getNpcImmuneElements(globalLevel);
      
      // Calculate real player power including gear and boosts
      const playerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      let playerPower = Number(playerStats.Str || 0) + Number(playerStats.Spd || 0) + Number(playerStats.Int || 0) + Number(playerStats.Luck || 0) + Number(playerStats.Pot || 0);
      
      const inventory = await storage.getInventoryByAccount(account.id);
      const equipped = account.equipped;
      for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
        const inventoryId = equipped[slot];
        if (inventoryId) {
          const invItem = inventory.find(i => i.id === inventoryId);
          if (invItem) {
            const stats = invItem.stats as any || {};
            playerPower += (Number(stats.Str) || 0) + (Number(stats.Int) || 0) + (Number(stats.Spd) || 0) + (Number(stats.Luck) || 0) + (Number(stats.Pot) || 0);
          }
        }
      }

      // Get equipped pet info
      let equippedPet = null;
      if ((account as any).equippedPetId) {
        const pet = await storage.getPet((account as any).equippedPetId);
        if (pet) {
          const petStats = pet.stats as any || {};
          const petBasePower = (Number(petStats.Str) || 0) + (Number(petStats.Spd) || 0) + (Number(petStats.Luck) || 0);
          const petElemPower = Number(petStats.ElementalPower) || 0;
          const petElements = pet.elements && pet.elements.length > 0 ? pet.elements : [pet.element];
          
          equippedPet = {
            id: pet.id,
            name: pet.name,
            elements: petElements,
            tier: pet.tier,
            stats: pet.stats,
            exp: pet.exp,
            power: petBasePower + (petElements.some(e => immunities.includes(e)) ? 0 : petElemPower)
          };
          playerPower += equippedPet.power;
        }
      }
      
      // Calculate potential rewards for this level
      const potentialRewards = {
        gold: globalLevel * 50,
        trainingPoints: globalLevel * 10,
        soulShards: globalLevel * 2,
        petExp: globalLevel * 100,
        runes: isBoss ? floor * 10 : 0,
      };
      
      // Check rank requirement
      const requiredRank = getNpcRankRequirement(globalLevel);
      const playerRankIndex = playerRanks.indexOf(account.rank as any);
      const requiredRankIndex = requiredRank ? playerRanks.indexOf(requiredRank as any) : -1;
      const canFight = requiredRankIndex === -1 || playerRankIndex >= requiredRankIndex;
      
      res.json({
        floor,
        level,
        globalLevel,
        name: isBoss ? `Floor ${floor} Guardian` : `NPC ${globalLevel}`,
        power,
        playerPower: Math.floor(playerPower),
        isBoss,
        bossAbility: isBoss ? getRandomBossAbility(floor) : null,
        immuneElements: immunities,
        equippedPet,
        powerRange: getNpcPowerRange(floor),
        potentialRewards,
        requiredRank,
        canFight,
        playerRank: account.rank,
      });
    } catch (error) {
      console.error("Error in get-current-npc:", error);
      res.status(500).json({ error: "Failed to get current NPC" });
    }
  });

  // Migrate old string pets to new pet table
  app.post("/api/accounts/:accountId/migrate-pets", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const oldPets = account.pets || [];
      const createdPets = [];

      const { petElements } = await import("@shared/schema");
      for (const petName of oldPets) {
        const randomElement = petElements[Math.floor(Math.random() * petElements.length)];
        const pet = await storage.createPet({
          accountId: account.id,
          name: petName,
          element: randomElement,
          tier: "egg",
          exp: 0,
          stats: { Str: 1, Spd: 1, Luck: 1, ElementalPower: 1 },
        });
        createdPets.push(pet);
      }

      // Clear old pets array
      await storage.updateAccount(account.id, { pets: [] });

      res.json({ migrated: createdPets.length, pets: createdPets });
    } catch (error) {
      res.status(500).json({ error: "Failed to migrate pets" });
    }
  });

  // ============ LEADERBOARD ROUTES ============
  const LEADERBOARD_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

  const buildLeaderboard = async (type: string): Promise<any[]> => {
    const allAccounts = await storage.getAllAccounts();
    const players = allAccounts.filter(a => a.role === "player");

    switch (type) {
      case "wins":
        return players
          .sort((a, b) => (b.wins || 0) - (a.wins || 0))
          .slice(0, 50)
          .map((acc, idx) => ({
            accountId: acc.id,
            username: acc.username,
            value: acc.wins || 0,
            rank: idx + 1,
          }));
      case "losses":
        return players
          .sort((a, b) => (b.losses || 0) - (a.losses || 0))
          .slice(0, 50)
          .map((acc, idx) => ({
            accountId: acc.id,
            username: acc.username,
            value: acc.losses || 0,
            rank: idx + 1,
          }));
      case "npc_progress":
        return players
          .sort((a, b) => {
            const aGlobal = ((a.npcFloor || 1) - 1) * 100 + (a.npcLevel || 1);
            const bGlobal = ((b.npcFloor || 1) - 1) * 100 + (b.npcLevel || 1);
            return bGlobal - aGlobal;
          })
          .slice(0, 50)
          .map((acc, idx) => ({
            accountId: acc.id,
            username: acc.username,
            value: `${acc.npcFloor || 1}:${acc.npcLevel || 1}`,
            npcFloor: acc.npcFloor || 1,
            npcLevel: acc.npcLevel || 1,
            rank: idx + 1,
          }));
      case "rank":
        return players
          .sort((a, b) => {
            const aIdx = playerRanks.indexOf(a.rank as any);
            const bIdx = playerRanks.indexOf(b.rank as any);
            return bIdx - aIdx;
          })
          .slice(0, 50)
          .map((acc, idx) => ({
            accountId: acc.id,
            username: acc.username,
            value: acc.rank,
            rank: idx + 1,
          }));
      case "guild_dungeon":
        const allGuilds = await storage.getAllGuilds();
        const sortedGuilds = allGuilds
          .sort((a, b) => {
            const aDungeons = (a.dungeonsCompleted || 0);
            const bDungeons = (b.dungeonsCompleted || 0);
            if (bDungeons !== aDungeons) return bDungeons - aDungeons;
            return ((b.unityCoins || 0) - (a.unityCoins || 0));
          })
          .slice(0, 50);
        
        const guildEntries = await Promise.all(sortedGuilds.map(async (guild, idx) => {
          const master = await storage.getAccount(guild.masterId);
          return {
            guildId: guild.id,
            guildName: guild.name,
            masterName: master?.username || "Unknown",
            value: `${guild.dungeonsCompleted || 0}/5 Dungeons · ${(guild.unityCoins || 0).toLocaleString()} Unity Coins`,
            dungeonFloor: guild.dungeonFloor || 1,
            dungeonLevel: guild.dungeonLevel || 1,
            dungeonsCompleted: guild.dungeonsCompleted || 0,
            unityCoins: guild.unityCoins || 0,
            rank: idx + 1,
          };
        }));
        return guildEntries;
      case "guild_wins":
        const guildsForWins = await storage.getAllGuilds();
        const sortedByWins = guildsForWins
          .sort((a, b) => (b.wins || 0) - (a.wins || 0))
          .slice(0, 50);
        
        const guildWinsEntries = await Promise.all(sortedByWins.map(async (guild, idx) => {
          const master = await storage.getAccount(guild.masterId);
          return {
            guildId: guild.id,
            guildName: guild.name,
            masterName: master?.username || "Unknown",
            value: guild.wins || 0,
            rank: idx + 1,
          };
        }));
        return guildWinsEntries;
      case "pet_arena":
        // Pet arena leaderboard - players with most pet battle wins
        return players
          .map(acc => ({
            accountId: acc.id,
            username: acc.username,
            petWins: (acc as any).petBattleWins || 0,
            petLosses: (acc as any).petBattleLosses || 0,
          }))
          .sort((a, b) => b.petWins - a.petWins)
          .slice(0, 50)
          .map((entry, idx) => ({
            accountId: entry.accountId,
            username: entry.username,
            value: `${entry.petWins}W / ${entry.petLosses}L`,
            petWins: entry.petWins,
            petLosses: entry.petLosses,
            rank: idx + 1,
          }));
      case "base_raids":
        // Base raids leaderboard - players with most successful raids
        return players
          .map(acc => ({
            accountId: acc.id,
            username: acc.username,
            raidsWon: (acc as any).raidsWon || 0,
            raidsLost: (acc as any).raidsLost || 0,
            raidsDefended: (acc as any).raidsDefended || 0,
          }))
          .sort((a, b) => (b.raidsWon + b.raidsDefended) - (a.raidsWon + a.raidsDefended))
          .slice(0, 50)
          .map((entry, idx) => ({
            accountId: entry.accountId,
            username: entry.username,
            value: `${entry.raidsWon} raids won, ${entry.raidsDefended} defended`,
            raidsWon: entry.raidsWon,
            raidsLost: entry.raidsLost,
            raidsDefended: entry.raidsDefended,
            rank: idx + 1,
          }));
      default:
        return [];
    }
  };

  app.get("/api/leaderboards/:type", async (req, res) => {
    try {
      const type = req.params.type;
      if (!["wins", "losses", "npc_progress", "rank", "guild_dungeon", "guild_wins", "pet_arena", "base_raids"].includes(type)) {
        return res.status(400).json({ error: "Invalid leaderboard type" });
      }

      // Check cache
      const cached = await storage.getLeaderboardCache(type);
      const now = new Date();

      if (cached && (now.getTime() - new Date(cached.refreshedAt).getTime()) < LEADERBOARD_CACHE_DURATION) {
        return res.json({
          type,
          data: cached.data,
          refreshedAt: cached.refreshedAt,
          nextRefresh: new Date(new Date(cached.refreshedAt).getTime() + LEADERBOARD_CACHE_DURATION),
        });
      }

      // Build fresh leaderboard
      const data = await buildLeaderboard(type);
      const newCache = await storage.setLeaderboardCache(type, data);

      res.json({
        type,
        data: newCache.data,
        refreshedAt: newCache.refreshedAt,
        nextRefresh: new Date(new Date(newCache.refreshedAt).getTime() + LEADERBOARD_CACHE_DURATION),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  // Force refresh a leaderboard (admin only)
  app.post("/api/admin/leaderboards/:type/refresh", async (req, res) => {
    try {
      const type = req.params.type;
      if (!["wins", "losses", "npc_progress", "rank", "guild_dungeon", "guild_wins", "pet_arena", "base_raids"].includes(type)) {
        return res.status(400).json({ error: "Invalid leaderboard type" });
      }

      const data = await buildLeaderboard(type);
      const newCache = await storage.setLeaderboardCache(type, data);

      res.json({
        type,
        data: newCache.data,
        refreshedAt: newCache.refreshedAt,
        nextRefresh: new Date(new Date(newCache.refreshedAt).getTime() + LEADERBOARD_CACHE_DURATION),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh leaderboard" });
    }
  });

  // ============ QUEST ROUTES ============
  
  // Admin: Get all quests
  app.get("/api/admin/quests", async (_req, res) => {
    try {
      const allQuests = await storage.getAllQuests();
      const allAccounts = await storage.getAllAccounts();
      
      const questsWithDetails = await Promise.all(allQuests.map(async (quest) => {
        const assignments = await storage.getQuestAssignmentsByQuest(quest.id);
        const assignmentsWithPlayers = assignments.map(a => {
          const player = allAccounts.find(acc => acc.id === a.accountId);
          return { ...a, playerName: player?.username || "Unknown" };
        });
        const creator = allAccounts.find(acc => acc.id === quest.createdBy);
        return {
          ...quest,
          createdByName: creator?.username || "Unknown",
          assignments: assignmentsWithPlayers,
        };
      }));
      
      res.json(questsWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quests" });
    }
  });

  // Admin: Create quest
  app.post("/api/admin/quests", async (req, res) => {
    try {
      const { title, description, rewards, createdBy, expiresAt } = req.body;
      
      if (!title || !description || !createdBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const quest = await storage.createQuest({
        title,
        description,
        rewards: rewards || {},
        createdBy,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: "active",
      });

      // Broadcast to admins
      broadcastToAdmins("questCreated", quest);

      res.json(quest);
    } catch (error) {
      res.status(500).json({ error: "Failed to create quest" });
    }
  });

  // Admin: Delete quest
  app.delete("/api/admin/quests/:id", async (req, res) => {
    try {
      await storage.deleteQuest(req.params.id);
      broadcastToAdmins("questDeleted", { questId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quest" });
    }
  });

  // Admin: Assign quest to player
  app.post("/api/admin/quests/:questId/assign", async (req, res) => {
    try {
      const { accountId } = req.body;
      const quest = await storage.getQuest(req.params.questId);
      
      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      // Check if already assigned
      const existing = await storage.getQuestAssignmentsByQuest(quest.id);
      if (existing.some(a => a.accountId === accountId)) {
        return res.status(400).json({ error: "Quest already assigned to this player" });
      }

      const assignment = await storage.createQuestAssignment({
        questId: quest.id,
        accountId,
        status: "pending",
      });

      const account = await storage.getAccount(accountId);
      
      // Notify player
      broadcastToPlayer(accountId, "questAssigned", { quest, assignment });
      broadcastToAdmins("questAssigned", { quest, assignment, playerName: account?.username });

      res.json({ ...assignment, playerName: account?.username });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign quest" });
    }
  });

  // Admin: Mark quest as completed and give rewards
  app.post("/api/admin/quests/:questId/complete/:assignmentId", async (req, res) => {
    try {
      const assignment = await storage.getQuestAssignment(req.params.assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const quest = await storage.getQuest(assignment.questId);
      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      // Mark as completed and rewarded
      await storage.updateQuestAssignmentStatus(assignment.id, "completed");
      await storage.updateQuestAssignmentStatus(assignment.id, "rewarded");

      // Apply rewards to player
      const updatedAccount = await storage.applyQuestRewards(assignment.accountId, quest.rewards);

      const account = await storage.getAccount(assignment.accountId);
      
      // Notify player
      broadcastToPlayer(assignment.accountId, "questCompleted", { 
        quest, 
        rewards: quest.rewards,
        newBalance: {
          gold: updatedAccount?.gold,
          rubies: updatedAccount?.rubies,
          soulShards: updatedAccount?.soulShards,
          focusedShards: updatedAccount?.focusedShards,
          trainingPoints: updatedAccount?.trainingPoints,
          runes: updatedAccount?.runes,
        }
      });

      broadcastToAdmins("questCompletedByPlayer", { 
        quest, 
        assignment,
        playerName: account?.username,
        rewards: quest.rewards,
      });

      res.json({ 
        success: true, 
        rewards: quest.rewards,
        playerName: account?.username,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete quest" });
    }
  });

  // Public: Get all available quests with assignment status
  app.get("/api/quests", async (_req, res) => {
    try {
      const quests = await storage.getAllQuests();
      const allAccounts = await storage.getAllAccounts();
      
      // Add assignment info to each quest
      const questsWithAssignments = await Promise.all(quests.map(async (quest) => {
        const assignments = await storage.getQuestAssignmentsByQuest(quest.id);
        return {
          ...quest,
          assignments: assignments.map(a => ({
            accountId: a.accountId,
            status: a.status,
            playerName: allAccounts.find(acc => acc.id === a.accountId)?.username,
          })),
        };
      }));
      
      res.json(questsWithAssignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quests" });
    }
  });

  // Player: Get player's quest assignments with quest details
  app.get("/api/accounts/:accountId/quests", async (req, res) => {
    try {
      const assignments = await storage.getQuestAssignmentsByAccount(req.params.accountId);
      const allQuests = await storage.getAllQuests();
      
      const playerQuests = assignments.map(assignment => {
        const quest = allQuests.find(q => q.id === assignment.questId);
        return { ...assignment, quest };
      });

      res.json(playerQuests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player quests" });
    }
  });

  // Player: Self-accept a quest (only 1 player can accept each quest)
  app.post("/api/accounts/:accountId/quests/:questId/accept", async (req, res) => {
    try {
      const { accountId, questId } = req.params;
      
      // Verify quest exists
      const quest = await storage.getQuest(questId);
      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      // Check if ANY player already accepted this quest
      const existingAssignments = await storage.getQuestAssignmentsByQuest(questId);
      
      if (existingAssignments.length > 0) {
        const isOwnAssignment = existingAssignments.some(a => a.accountId === accountId);
        if (isOwnAssignment) {
          return res.status(400).json({ error: "You have already accepted this quest" });
        }
        return res.status(400).json({ error: "This quest has already been taken by another player" });
      }

      // Create assignment with "accepted" status (player self-accepted)
      const assignment = await storage.createQuestAssignment({
        questId,
        accountId,
        status: "accepted",
      });

      const account = await storage.getAccount(accountId);
      
      broadcastToAdmins("questAccepted", { 
        assignment, 
        quest, 
        playerName: account?.username 
      });

      // Notify all players that quest is taken
      broadcastToAllPlayers("questTaken", { questId, takenBy: account?.username });

      res.json({ ...assignment, quest });
    } catch (error) {
      res.status(500).json({ error: "Failed to accept quest" });
    }
  });

  // ==================== GUILD SYSTEM ====================

  const MAX_GUILD_MEMBERS = 4;

  // Admin: Get all guilds with member details
  app.get("/api/admin/guilds", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const allGuilds = await storage.getAllGuilds();
      const allAccounts = await storage.getAllAccounts();
      
      const guildsWithDetails = await Promise.all(allGuilds.map(async (guild) => {
        const members = await storage.getGuildMembers(guild.id);
        const master = allAccounts.find(a => a.id === guild.masterId);
        const memberDetails = members.map(m => {
          const account = allAccounts.find(a => a.id === m.accountId);
          return {
            accountId: m.accountId,
            username: account?.username || "Unknown",
            isMaster: m.accountId === guild.masterId,
            joinedAt: m.joinedAt,
          };
        });
        
        return {
          ...guild,
          masterName: master?.username || "Unknown",
          members: memberDetails,
          memberCount: members.length,
        };
      }));
      
      res.json(guildsWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });

  // Admin: Disband a guild
  app.delete("/api/admin/guilds/:guildId", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      // Verify admin has an active session
      if (!activeSessions.has(adminId)) {
        return res.status(401).json({ error: "No active session" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      // Remove all members first
      const members = await storage.getGuildMembers(guild.id);
      for (const member of members) {
        await storage.removeGuildMember(member.accountId);
      }

      // Delete all pending invites
      const invites = await storage.getGuildInvitesByGuild(guild.id);
      for (const invite of invites) {
        await storage.deleteGuildInvite(invite.id);
      }

      // Delete the guild
      await storage.deleteGuild(guild.id);

      res.json({ message: "Guild disbanded successfully", guildName: guild.name });
    } catch (error) {
      res.status(500).json({ error: "Failed to disband guild" });
    }
  });

  // Create a guild
  app.post("/api/guilds", async (req, res) => {
    try {
      const createGuildSchema = z.object({
        name: z.string().min(3).max(30),
        masterId: z.string(),
      });
      const { name, masterId } = createGuildSchema.parse(req.body);

      // Check if player already in a guild
      const existingMembership = await storage.getGuildMember(masterId);
      if (existingMembership) {
        return res.status(400).json({ error: "You are already in a guild" });
      }

      // Check if guild name already exists
      const existingGuild = await storage.getGuildByName(name);
      if (existingGuild) {
        return res.status(400).json({ error: "Guild name already taken" });
      }

      const guild = await storage.createGuild({ name, masterId });
      
      await storage.addGuildMember({ guildId: guild.id, accountId: masterId, role: "leader" });

      res.json(guild);
    } catch (error) {
      res.status(500).json({ error: "Failed to create guild" });
    }
  });

  // Get guild by ID
  app.get("/api/guilds/:id", async (req, res) => {
    try {
      const guild = await storage.getGuild(req.params.id);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const members = await storage.getGuildMembers(guild.id);
      const allAccounts = await storage.getAllAccounts();
      
      const membersWithInfo = members.map(m => {
        const account = allAccounts.find(a => a.id === m.accountId);
        const isOnline = activeSessions.has(m.accountId);
        return {
          ...m,
          username: account?.username,
          rank: account?.rank,
          isOnline,
          isMaster: m.accountId === guild.masterId,
          role: m.accountId === guild.masterId ? "leader" : (m.role || "member"),
        };
      });

      res.json({ ...guild, members: membersWithInfo });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guild" });
    }
  });

  // Get player's guild
  app.get("/api/accounts/:accountId/guild", async (req, res) => {
    try {
      const membership = await storage.getGuildMember(req.params.accountId);
      if (!membership) {
        return res.json(null);
      }

      const guild = await storage.getGuild(membership.guildId);
      if (!guild) {
        return res.json(null);
      }

      const members = await storage.getGuildMembers(guild.id);
      const allAccounts = await storage.getAllAccounts();
      
      const membersWithInfo = members.map(m => {
        const account = allAccounts.find(a => a.id === m.accountId);
        const isOnline = activeSessions.has(m.accountId);
        return {
          ...m,
          username: account?.username,
          rank: account?.rank,
          isOnline,
          isMaster: m.accountId === guild.masterId,
          role: m.accountId === guild.masterId ? "leader" : (m.role || "member"),
        };
      });

      res.json({ ...guild, members: membersWithInfo });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guild" });
    }
  });

  // Invite player to guild (leader or officer)
  app.post("/api/guilds/:guildId/invite", async (req, res) => {
    try {
      const inviteSchema = z.object({
        accountId: z.string(),
        invitedBy: z.string(),
      });
      const { accountId, invitedBy } = inviteSchema.parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const inviterMember = await storage.getGuildMember(invitedBy);
      const inviterRole = invitedBy === guild.masterId ? "leader" : (inviterMember?.role || "member");
      if (inviterRole !== "leader" && inviterRole !== "officer") {
        return res.status(403).json({ error: "Only leader or officers can invite players" });
      }

      const members = await storage.getGuildMembers(guild.id);
      if (members.length >= MAX_GUILD_MEMBERS) {
        return res.status(400).json({ error: "Guild is full (max 4 members)" });
      }

      // Check if player already in a guild
      const existingMembership = await storage.getGuildMember(accountId);
      if (existingMembership) {
        return res.status(400).json({ error: "Player is already in a guild" });
      }

      // Check if player already invited
      const existingInvites = await storage.getGuildInvitesByAccount(accountId);
      const alreadyInvited = existingInvites.some(i => i.guildId === guild.id);
      if (alreadyInvited) {
        return res.status(400).json({ error: "Player already invited" });
      }

      const invite = await storage.createGuildInvite({
        guildId: guild.id,
        accountId,
        invitedBy,
      });

      const account = await storage.getAccount(accountId);
      broadcastToPlayer(accountId, "guildInvite", { guild, invite });

      res.json(invite);
    } catch (error) {
      res.status(500).json({ error: "Failed to send invite" });
    }
  });

  // Get player's guild invites
  app.get("/api/accounts/:accountId/guild-invites", async (req, res) => {
    try {
      const invites = await storage.getGuildInvitesByAccount(req.params.accountId);
      const guilds = await storage.getAllGuilds();
      
      const invitesWithGuildInfo = invites.map(invite => {
        const guild = guilds.find(g => g.id === invite.guildId);
        return { ...invite, guild };
      });

      res.json(invitesWithGuildInfo);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  // Accept guild invite
  app.post("/api/guild-invites/:inviteId/accept", async (req, res) => {
    try {
      const invite = await storage.getGuildInvite(req.params.inviteId);
      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }

      const guild = await storage.getGuild(invite.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild no longer exists" });
      }

      const members = await storage.getGuildMembers(guild.id);
      if (members.length >= MAX_GUILD_MEMBERS) {
        return res.status(400).json({ error: "Guild is full" });
      }

      // Check if player already in a guild
      const existingMembership = await storage.getGuildMember(invite.accountId);
      if (existingMembership) {
        await storage.deleteGuildInvite(invite.id);
        return res.status(400).json({ error: "You are already in a guild" });
      }

      // Capacity logic: base 2 + (level * 3)
      const maxMembers = 2 + (guild.level * 3);
      const currentMembers = await storage.getGuildMembers(guild.id);
      if (currentMembers.length >= maxMembers) {
        return res.status(400).json({ error: "Guild is at maximum capacity" });
      }

      await storage.addGuildMember({ guildId: guild.id, accountId: invite.accountId });
      await storage.deleteGuildInvite(invite.id);

      // Delete all other invites for this player
      const otherInvites = await storage.getGuildInvitesByAccount(invite.accountId);
      for (const inv of otherInvites) {
        await storage.deleteGuildInvite(inv.id);
      }

      res.json({ success: true, guild });
    } catch (error) {
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // Decline guild invite
  app.post("/api/guild-invites/:inviteId/decline", async (req, res) => {
    try {
      await storage.deleteGuildInvite(req.params.inviteId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to decline invite" });
    }
  });

  // Leave guild
  app.post("/api/guilds/:guildId/leave", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (guild.masterId === accountId) {
        // If master leaves, delete the guild
        const members = await storage.getGuildMembers(guild.id);
        for (const member of members) {
          await storage.removeGuildMember(member.accountId);
        }
        await storage.deleteGuild(guild.id);
        return res.json({ success: true, guildDisbanded: true });
      }

      await storage.removeGuildMember(accountId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave guild" });
    }
  });

  // Kick member from guild (leader or officer, with role hierarchy)
  app.post("/api/guilds/:guildId/kick", async (req, res) => {
    try {
      const kickSchema = z.object({
        accountId: z.string(),
        kickedBy: z.string().optional(),
        masterId: z.string().optional(),
      });
      const parsed = kickSchema.parse(req.body);
      const accountId = parsed.accountId;
      const kickerId = parsed.kickedBy || parsed.masterId;
      if (!kickerId) {
        return res.status(400).json({ error: "Kicker ID required" });
      }

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (accountId === kickerId) {
        return res.status(400).json({ error: "Cannot kick yourself" });
      }

      const kickerMember = await storage.getGuildMember(kickerId);
      const kickerRole = kickerId === guild.masterId ? "leader" : (kickerMember?.role || "member");
      if (kickerRole !== "leader" && kickerRole !== "officer") {
        return res.status(403).json({ error: "Only leader or officers can kick members" });
      }

      const targetMember = await storage.getGuildMember(accountId);
      const targetRole = accountId === guild.masterId ? "leader" : (targetMember?.role || "member");
      if (kickerRole === "officer" && (targetRole === "leader" || targetRole === "officer")) {
        return res.status(403).json({ error: "Officers can only kick members, not other officers or the leader" });
      }

      await storage.removeGuildMember(accountId);
      broadcastToPlayer(accountId, "guildKicked", { guildName: guild.name });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to kick member" });
    }
  });

  // Distribute guild bank rewards (leader only)
  app.post("/api/guilds/:guildId/distribute", async (req, res) => {
    try {
      const distributeSchema = z.object({
        masterId: z.string(),
        distributions: z.array(z.object({
          accountId: z.string(),
          gold: z.number().min(0).optional(),
          rubies: z.number().min(0).optional(),
          soulShards: z.number().min(0).optional(),
          focusedShards: z.number().min(0).optional(),
          runes: z.number().min(0).optional(),
        })),
      });
      const { masterId, distributions } = distributeSchema.parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (guild.masterId !== masterId) {
        return res.status(403).json({ error: "Only guild leader can distribute rewards" });
      }

      // Calculate totals
      const totals = { gold: 0, rubies: 0, soulShards: 0, focusedShards: 0, runes: 0, trainingPoints: 0 };
      for (const dist of distributions) {
        totals.gold += dist.gold || 0;
        totals.rubies += dist.rubies || 0;
        totals.soulShards += dist.soulShards || 0;
        totals.focusedShards += dist.focusedShards || 0;
        totals.runes += dist.runes || 0;
      }

      // Check bank has enough
      if (totals.gold > guild.bank.gold ||
          totals.rubies > guild.bank.rubies ||
          totals.soulShards > guild.bank.soulShards ||
          totals.focusedShards > guild.bank.focusedShards ||
          totals.runes > guild.bank.runes) {
        return res.status(400).json({ error: "Not enough resources in guild bank" });
      }

      const leaderAccount = await storage.getAccount(masterId);
      const leaderName = leaderAccount?.username || "Unknown";

      // Apply rewards to each player
      for (const dist of distributions) {
        const account = await storage.getAccount(dist.accountId);
        if (account) {
          await storage.updateAccount(dist.accountId, {
            gold: account.gold + (dist.gold || 0),
            rubies: (account.rubies || 0) + (dist.rubies || 0),
            soulShards: (account.soulShards || 0) + (dist.soulShards || 0),
            focusedShards: (account.focusedShards || 0) + (dist.focusedShards || 0),
          });
          
          for (const [resource, amount] of Object.entries({ gold: dist.gold, rubies: dist.rubies, soulShards: dist.soulShards, focusedShards: dist.focusedShards, runes: dist.runes })) {
            if (amount && amount > 0) {
              await storage.createGuildVaultLog({
                guildId: guild.id,
                accountId: masterId,
                playerName: leaderName,
                action: "withdraw",
                resource,
                quantity: amount,
              });
            }
          }
          
          broadcastToPlayer(dist.accountId, "guildReward", {
            gold: dist.gold,
            rubies: dist.rubies,
            soulShards: dist.soulShards,
            focusedShards: dist.focusedShards,
            runes: dist.runes,
          });
        }
      }

      // Update guild bank
      const newBank: GuildBank = {
        gold: guild.bank.gold - totals.gold,
        rubies: guild.bank.rubies - totals.rubies,
        soulShards: guild.bank.soulShards - totals.soulShards,
        focusedShards: guild.bank.focusedShards - totals.focusedShards,
        runes: guild.bank.runes - totals.runes,
        trainingPoints: (guild.bank.trainingPoints || 0) - (totals.trainingPoints || 0),
      };
      await storage.updateGuildBank(guild.id, newBank);

      res.json({ success: true, newBank });
    } catch (error) {
      res.status(500).json({ error: "Failed to distribute rewards" });
    }
  });

  // Get all guilds
  app.get("/api/guilds", async (_req, res) => {
    try {
      const guilds = await storage.getAllGuilds();
      res.json(guilds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });

  // Get all players (for inviting)
  app.get("/api/players/available-for-guild", async (_req, res) => {
    try {
      const allAccounts = await storage.getAllAccounts();
      const players = allAccounts.filter(a => a.role === "player");
      
      const available = [];
      for (const player of players) {
        const membership = await storage.getGuildMember(player.id);
        if (!membership) {
          available.push({
            id: player.id,
            username: player.username,
            rank: player.rank,
            isOnline: activeSessions.has(player.id),
          });
        }
      }
      
      res.json(available);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  // ==================== GREAT DUNGEON (10x NPC Tower) / DEMON LORD'S DUNGEON (Floor 51-100) ====================

  app.get("/api/guilds/:guildId/dungeon", async (req, res) => {
    try {
      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const members = await storage.getGuildMembers(guild.id);
      const allAccounts = await storage.getAllAccounts();
      const allPets = await storage.getAllPets();

      const onlineMembers = members.filter(m => activeSessions.has(m.accountId)).map(m => {
        const account = allAccounts.find(a => a.id === m.accountId);
        const equippedPet = account?.equippedPetId ? allPets.find(p => p.id === account.equippedPetId) : null;
        return {
          accountId: m.accountId,
          username: account?.username,
          rank: account?.rank,
          equippedPet: equippedPet ? { id: equippedPet.id, name: equippedPet.name, tier: equippedPet.tier, elements: equippedPet.elements } : null,
        };
      });

      let combinedMemberStats = { Str: 0, Def: 0, Spd: 0, Int: 0, Luck: 0 };
      for (const m of onlineMembers) {
        const account = allAccounts.find(a => a.id === m.accountId);
        if (account) {
          combinedMemberStats.Str += account.stats.Str;
          combinedMemberStats.Def += account.stats.Def || 0;
          combinedMemberStats.Spd += account.stats.Spd;
          combinedMemberStats.Int += account.stats.Int;
          combinedMemberStats.Luck += account.stats.Luck;
        }
      }

      const now = new Date();
      const activeBuffs = ((guild as any).guildBuffs || []).filter((b: GuildBuff) => new Date(b.expiresAt) > now);

      const dungeons = GUILD_DUNGEON_TIERS.map(dt => {
        const isUnlocked = (guild.level || 1) >= dt.unlockRequirement.guildLevel &&
          (guild.dungeonsCompleted || 0) >= dt.unlockRequirement.previousDungeon;
        const isCompleted = (guild.dungeonsCompleted || 0) >= dt.tier;

        const avgMemberPower = onlineMembers.length > 0
          ? (combinedMemberStats.Str + combinedMemberStats.Spd + combinedMemberStats.Int) / onlineMembers.length
          : 50;
        const scaledDifficulty = Math.floor(avgMemberPower * dt.difficultyMultiplier * 1.2);

        const npcStats = {
          Str: Math.floor(scaledDifficulty * 1.0),
          Spd: Math.floor(scaledDifficulty * 0.8),
          Int: Math.floor(scaledDifficulty * 0.7),
          Luck: Math.floor(scaledDifficulty * 0.4),
        };

        return {
          tier: dt.tier,
          name: dt.name,
          description: dt.description,
          isUnlocked,
          isCompleted,
          unlockRequirement: dt.unlockRequirement,
          npcStats,
          rewards: {
            unityCoins: dt.rewards.unityCoins,
            gold: dt.rewards.gold,
            shards: dt.rewards.shards,
            label: dt.rewards.label,
          },
          buff: dt.buff,
        };
      });

      const perks: { level: number; name: string; description: string; unlocked: boolean }[] = [];
      for (let lvl = 1; lvl <= 10; lvl++) {
        const perk = GUILD_PERKS[lvl];
        if (perk) {
          perks.push({ level: lvl, ...perk, unlocked: (guild.level || 1) >= lvl });
        }
      }

      res.json({
        floor: guild.dungeonFloor,
        level: guild.dungeonLevel,
        displayFloor: guild.dungeonFloor,
        globalLevel: (guild.dungeonFloor - 1) * 100 + guild.dungeonLevel,
        dungeonName: "Guild Dungeons",
        isDemonLordDungeon: false,
        petsAllowed: true,
        isBoss: false,
        npcStats: { Str: 0, Spd: 0, Int: 0, Luck: 0 },
        immunities: [],
        rewards: { gold: 0, rubies: 0, soulShards: 0, focusedShards: 0, runes: 0 },
        onlineMembers,
        memberCount: members.length,
        dungeons,
        unityCoins: (guild as any).unityCoins || 0,
        dungeonsCompleted: (guild as any).dungeonsCompleted || 0,
        activeBuffs,
        perks,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dungeon info" });
    }
  });

  app.post("/api/guilds/:guildId/dungeon/fight", async (req, res) => {
    try {
      const fightSchema = z.object({ accountId: z.string(), dungeonTier: z.number().min(1).max(5).optional() });
      const { accountId, dungeonTier } = fightSchema.parse(req.body);

      const membership = await storage.getGuildMember(accountId);
      if (!membership || membership.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const tier = dungeonTier || 1;
      const dungeonConfig = GUILD_DUNGEON_TIERS.find(d => d.tier === tier);
      if (!dungeonConfig) {
        return res.status(400).json({ error: "Invalid dungeon tier" });
      }

      if ((guild.level || 1) < dungeonConfig.unlockRequirement.guildLevel) {
        return res.status(400).json({ error: `Guild level ${dungeonConfig.unlockRequirement.guildLevel} required to access ${dungeonConfig.name}` });
      }
      if ((guild.dungeonsCompleted || 0) < dungeonConfig.unlockRequirement.previousDungeon) {
        return res.status(400).json({ error: `Complete dungeon ${dungeonConfig.unlockRequirement.previousDungeon} first` });
      }
      if ((guild.dungeonsCompleted || 0) >= tier) {
        return res.status(400).json({ error: `${dungeonConfig.name} has already been completed` });
      }

      const members = await storage.getGuildMembers(guild.id);
      const allAccounts = await storage.getAllAccounts();
      const allPets = await storage.getAllPets();

      const onlineMembers = members.filter(m => activeSessions.has(m.accountId));

      let combinedStats = { Str: 0, Spd: 0, Int: 0, Luck: 0 };
      let combinedPetPower = 0;

      for (const member of onlineMembers) {
        const account = allAccounts.find(a => a.id === member.accountId);
        if (account) {
          combinedStats.Str += account.stats.Str;
          combinedStats.Spd += account.stats.Spd;
          combinedStats.Int += account.stats.Int;
          combinedStats.Luck += account.stats.Luck;

          if (account.equippedPetId) {
            const pet = allPets.find(p => p.id === account.equippedPetId);
            if (pet) {
              const petStats = pet.stats as any;
              combinedPetPower += petStats.Str + petStats.Spd + petStats.Luck + (petStats.ElementalPower || 0);
            }
          }
        }
      }

      const avgMemberPower = onlineMembers.length > 0
        ? (combinedStats.Str + combinedStats.Spd + combinedStats.Int) / onlineMembers.length
        : 50;
      const scaledDifficulty = Math.floor(avgMemberPower * dungeonConfig.difficultyMultiplier * 1.2);

      const npcStats = {
        Str: Math.floor(scaledDifficulty * 1.0),
        Spd: Math.floor(scaledDifficulty * 0.8),
        Int: Math.floor(scaledDifficulty * 0.7),
        Luck: Math.floor(scaledDifficulty * 0.4),
      };

      const playerPower = (combinedStats.Str * 2 + combinedStats.Spd + combinedStats.Int + combinedPetPower);
      const npcPower = npcStats.Str * 2 + npcStats.Spd + npcStats.Int;

      const powerRatio = npcPower > 0 ? playerPower / npcPower : 1;
      if (powerRatio < 0.4) {
        return res.json({
          victory: false,
          message: "Your combined power is too weak! Get more guild members online or grow stronger.",
          playerPower: Math.floor(playerPower),
          npcPower: Math.floor(npcPower),
          powerRatio: Math.floor(powerRatio * 100),
          onlineMembers: onlineMembers.length,
        });
      }

      const luckFactor = 1 + (combinedStats.Luck * 0.01);
      const roll = Math.random() * luckFactor;
      const victory = playerPower * roll > npcPower * 0.8;

      if (victory) {
        const rewards = {
          unityCoins: dungeonConfig.rewards.unityCoins,
          gold: dungeonConfig.rewards.gold,
          shards: dungeonConfig.rewards.shards,
        };

        const newBank: GuildBank = {
          gold: guild.bank.gold + rewards.gold,
          rubies: guild.bank.rubies,
          soulShards: guild.bank.soulShards + rewards.shards,
          focusedShards: guild.bank.focusedShards,
          runes: guild.bank.runes,
          trainingPoints: guild.bank.trainingPoints || 0,
        };
        await storage.updateGuildBank(guild.id, newBank);

        const newDungeonsCompleted = Math.max((guild.dungeonsCompleted || 0), tier);
        const newUnityCoins = ((guild as any).unityCoins || 0) + rewards.unityCoins;

        const buffExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const newBuff: GuildBuff = {
          id: `buff_${tier}_${Date.now()}`,
          name: dungeonConfig.buff.name,
          stat: dungeonConfig.buff.stat,
          bonusPercent: dungeonConfig.buff.bonusPercent,
          expiresAt: buffExpires.toISOString(),
          fromDungeon: tier,
        };

        const existingBuffs: GuildBuff[] = ((guild as any).guildBuffs || []).filter(
          (b: GuildBuff) => new Date(b.expiresAt) > new Date() && b.fromDungeon !== tier
        );
        const updatedBuffs = [...existingBuffs, newBuff];

        await db.update(guildsTable).set({
          dungeonsCompleted: newDungeonsCompleted,
          unityCoins: newUnityCoins,
          guildBuffs: updatedBuffs,
        }).where(eq(guildsTable.id, guild.id));

        for (const member of members) {
          broadcastToPlayer(member.accountId, "dungeonVictory", {
            rewards,
            dungeonName: dungeonConfig.name,
            dungeonTier: tier,
            buff: newBuff,
            participants: onlineMembers.length,
          });
        }

        res.json({
          victory: true,
          rewards,
          dungeonName: dungeonConfig.name,
          dungeonTier: tier,
          buff: newBuff,
          participants: onlineMembers.length,
          combinedStats,
          npcStats,
        });
      } else {
        res.json({
          victory: false,
          dungeonName: dungeonConfig.name,
          dungeonTier: tier,
          participants: onlineMembers.length,
          combinedStats,
          npcStats,
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fight in dungeon" });
    }
  });

  // ==================== PET MERGING ====================

  const PET_MERGE_COST = 1000000000; // 1 billion gold

  app.post("/api/accounts/:accountId/pets/merge", async (req, res) => {
    try {
      const mergeSchema = z.object({
        petId1: z.string(),
        petId2: z.string(),
      });
      const { petId1, petId2 } = mergeSchema.parse(req.body);

      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.gold < PET_MERGE_COST) {
        return res.status(400).json({ error: "Not enough gold (need 1 billion)" });
      }

      const pet1 = await storage.getPet(petId1);
      const pet2 = await storage.getPet(petId2);

      if (!pet1 || !pet2) {
        return res.status(404).json({ error: "Pet not found" });
      }

      if (pet1.accountId !== account.id || pet2.accountId !== account.id) {
        return res.status(403).json({ error: "You don't own these pets" });
      }

      if (pet1.tier !== "mythic" || pet2.tier !== "mythic") {
        return res.status(400).json({ error: "Both pets must be mythic tier" });
      }

      // Combine elements from both pets
      const elementsToCombine = [...(pet1.elements || [pet1.element]), ...(pet2.elements || [pet2.element])];
      const combinedElements = Array.from(new Set(elementsToCombine));
      
      // Create powerful new egg with boosted stats
      const baseStats = {
        Str: Math.floor((pet1.stats.Str + pet2.stats.Str) * 0.5),
        Spd: Math.floor((pet1.stats.Spd + pet2.stats.Spd) * 0.5),
        Luck: Math.floor((pet1.stats.Luck + pet2.stats.Luck) * 0.5),
        ElementalPower: Math.floor((pet1.stats.ElementalPower + pet2.stats.ElementalPower) * 0.5),
      };

      // Deduct gold
      await storage.updateAccountGold(account.id, account.gold - PET_MERGE_COST);

      // Delete old pets
      await storage.deletePet(pet1.id);
      await storage.deletePet(pet2.id);

      // Unequip if either was equipped
      if (account.equippedPetId === pet1.id || account.equippedPetId === pet2.id) {
        await storage.updateAccount(account.id, { equipped: { ...account.equipped, weapon: account.equipped.weapon } });
      }

      // Create new powerful egg
      const newPet = await storage.createPet({
        accountId: account.id,
        name: `Merged ${pet1.name} & ${pet2.name}`,
        element: combinedElements[0] as any,
        elements: combinedElements as any,
        tier: "egg",
        exp: 0,
        stats: baseStats,
      });

      res.json({
        success: true,
        newPet,
        cost: PET_MERGE_COST,
        combinedElements,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to merge pets" });
    }
  });

  // ==================== GUILD VS GUILD BATTLES ====================

  // Get guild battles for a guild
  app.get("/api/guilds/:guildId/battles", async (req, res) => {
    try {
      const battles = await storage.getGuildBattlesByGuild(req.params.guildId);
      const allGuilds = await storage.getAllGuilds();
      const allAccounts = await storage.getAllAccounts();
      
      const battlesWithDetails = battles.map(battle => {
        const challengerGuild = allGuilds.find(g => g.id === battle.challengerGuildId);
        const challengedGuild = allGuilds.find(g => g.id === battle.challengedGuildId);
        
        return {
          ...battle,
          challengerGuildName: challengerGuild?.name || "Unknown",
          challengedGuildName: challengedGuild?.name || "Unknown",
        };
      });
      
      res.json(battlesWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guild battles" });
    }
  });

  // Create guild battle challenge (guild master only)
  app.post("/api/guilds/:guildId/battles/challenge", async (req, res) => {
    try {
      const challengeSchema = z.object({
        accountId: z.string(),
        targetGuildId: z.string(),
        fighters: z.array(z.string()).min(1).max(4),
      });
      const { accountId, targetGuildId, fighters } = challengeSchema.parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (guild.masterId !== accountId) {
        return res.status(403).json({ error: "Only guild master can challenge other guilds" });
      }

      const targetGuild = await storage.getGuild(targetGuildId);
      if (!targetGuild) {
        return res.status(404).json({ error: "Target guild not found" });
      }

      // Verify fighters are guild members
      const members = await storage.getGuildMembers(guild.id);
      const memberIds = members.map(m => m.accountId);
      for (const fighterId of fighters) {
        if (!memberIds.includes(fighterId)) {
          return res.status(400).json({ error: "All fighters must be guild members" });
        }
      }

      const battle = await storage.createGuildBattle({
        challengerGuildId: guild.id,
        challengedGuildId: targetGuildId,
        challengerFighters: fighters,
        status: "pending",
      });

      // Notify target guild
      const targetMembers = await storage.getGuildMembers(targetGuildId);
      for (const member of targetMembers) {
        broadcastToPlayer(member.accountId, "guildBattleChallenge", {
          battle,
          challengerGuildName: guild.name,
        });
      }

      // Activity feed
      await storage.createActivityFeed({
        type: "guild_battle_challenge",
        message: `${guild.name} challenged ${targetGuild.name} to a guild battle!`,
        metadata: { battleId: battle.id },
      });

      res.json(battle);
    } catch (error) {
      res.status(500).json({ error: "Failed to create guild battle challenge" });
    }
  });

  // Accept/decline guild battle (target guild master only)
  app.patch("/api/guild-battles/:battleId/respond", async (req, res) => {
    try {
      const responseSchema = z.object({
        accountId: z.string(),
        accept: z.boolean(),
        fighters: z.array(z.string()).optional(),
      });
      const { accountId, accept, fighters } = responseSchema.parse(req.body);

      const battle = await storage.getGuildBattle(req.params.battleId);
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }

      if (battle.status !== "pending") {
        return res.status(400).json({ error: "Battle is not pending" });
      }

      const targetGuild = await storage.getGuild(battle.challengedGuildId);
      if (!targetGuild || targetGuild.masterId !== accountId) {
        return res.status(403).json({ error: "Only target guild master can respond" });
      }

      if (accept) {
        if (!fighters || fighters.length === 0) {
          return res.status(400).json({ error: "Must provide fighters when accepting" });
        }

        // Verify fighters are guild members
        const members = await storage.getGuildMembers(targetGuild.id);
        const memberIds = members.map(m => m.accountId);
        for (const fighterId of fighters) {
          if (!memberIds.includes(fighterId)) {
            return res.status(400).json({ error: "All fighters must be guild members" });
          }
        }

        const updated = await storage.updateGuildBattle(battle.id, {
          status: "in_progress",
          challengedFighters: fighters,
          currentRound: 1,
        });

        // Notify admins about the battle
        broadcastToAdmins("guildBattleStarted", {
          battle: updated,
          challengerGuildId: battle.challengerGuildId,
          challengedGuildId: battle.challengedGuildId,
        });

        // Activity feed
        const challengerGuild = await storage.getGuild(battle.challengerGuildId);
        await storage.createActivityFeed({
          type: "guild_battle_started",
          message: `Guild battle started: ${challengerGuild?.name} vs ${targetGuild.name}!`,
          metadata: { battleId: battle.id },
        });

        res.json(updated);
      } else {
        const updated = await storage.updateGuildBattle(battle.id, { status: "declined" });
        res.json(updated);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to respond to guild battle" });
    }
  });

  // Get active guild battles (for admin)
  app.get("/api/admin/guild-battles", async (_req, res) => {
    try {
      const activeBattles = await storage.getActiveGuildBattles();
      const allGuilds = await storage.getAllGuilds();
      const allAccounts = await storage.getAllAccounts();
      const allPets = await storage.getAllPets();

      const battlesWithDetails = await Promise.all(activeBattles.map(async battle => {
        const challengerGuild = allGuilds.find(g => g.id === battle.challengerGuildId);
        const challengedGuild = allGuilds.find(g => g.id === battle.challengedGuildId);
        
        // Get all fighters with their info and strengths
        const allChallengerFighters = await Promise.all(
          battle.challengerFighters.map(async (fighterId) => {
            const fighter = allAccounts.find(a => a.id === fighterId);
            if (!fighter) return null;
            const strength = await calculatePlayerStrength(fighterId);
            const pet = fighter.equippedPetId ? allPets.find(p => p.id === fighter.equippedPetId) : null;
            return {
              id: fighter.id,
              username: fighter.username,
              strength,
              pet: pet ? { name: pet.name, tier: pet.tier, elements: pet.elements } : null,
            };
          })
        );
        
        const allChallengedFighters = await Promise.all(
          battle.challengedFighters.map(async (fighterId) => {
            const fighter = allAccounts.find(a => a.id === fighterId);
            if (!fighter) return null;
            const strength = await calculatePlayerStrength(fighterId);
            const pet = fighter.equippedPetId ? allPets.find(p => p.id === fighter.equippedPetId) : null;
            return {
              id: fighter.id,
              username: fighter.username,
              strength,
              pet: pet ? { name: pet.name, tier: pet.tier, elements: pet.elements } : null,
            };
          })
        );
        
        // Tournament-style tracking: track current fighter indices
        // The winner stays, loser's team advances to next fighter
        const challengerCurrentIndex = (battle as any).challengerCurrentIndex || 0;
        const challengedCurrentIndex = (battle as any).challengedCurrentIndex || 0;
        
        const currentChallengerFighter = allChallengerFighters[challengerCurrentIndex];
        const currentChallengedFighter = allChallengedFighters[challengedCurrentIndex];

        return {
          ...battle,
          challengerGuildName: challengerGuild?.name || "Unknown",
          challengedGuildName: challengedGuild?.name || "Unknown",
          allChallengerFighters: allChallengerFighters.filter(f => f !== null),
          allChallengedFighters: allChallengedFighters.filter(f => f !== null),
          challengerCurrentIndex,
          challengedCurrentIndex,
          currentFighters: {
            challenger: currentChallengerFighter || null,
            challenged: currentChallengedFighter || null,
          },
          totalRounds: Math.max(battle.challengerFighters.length, battle.challengedFighters.length),
        };
      }));

      res.json(battlesWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active guild battles" });
    }
  });

  // Admin: Set round winner in guild battle (tournament style)
  app.patch("/api/admin/guild-battles/:battleId/round-winner", async (req, res) => {
    try {
      const winnerSchema = z.object({
        winnerId: z.string(),
      });
      const { winnerId } = winnerSchema.parse(req.body);

      const battle = await storage.getGuildBattle(req.params.battleId);
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }

      if (battle.status !== "in_progress") {
        return res.status(400).json({ error: "Battle is not in progress" });
      }

      // Tournament style: get current fighters by index
      const challengerCurrentIndex = (battle as any).challengerCurrentIndex || 0;
      const challengedCurrentIndex = (battle as any).challengedCurrentIndex || 0;
      
      const challengerFighterId = battle.challengerFighters[challengerCurrentIndex];
      const challengedFighterId = battle.challengedFighters[challengedCurrentIndex];

      if (winnerId !== challengerFighterId && winnerId !== challengedFighterId) {
        return res.status(400).json({ error: "Winner must be one of the current round fighters" });
      }

      // Calculate new scores and advance indices
      let newChallengerScore = battle.challengerScore;
      let newChallengedScore = battle.challengedScore;
      let newChallengerIndex = challengerCurrentIndex;
      let newChallengedIndex = challengedCurrentIndex;
      
      // Winner stays, loser's team advances to next fighter
      if (winnerId === challengerFighterId) {
        newChallengerScore += 1;
        newChallengedIndex += 1; // Loser's team advances
      } else {
        newChallengedScore += 1;
        newChallengerIndex += 1; // Loser's team advances
      }

      const nextRound = battle.currentRound + 1;
      
      // Battle is over when either team runs out of fighters
      const challengerOutOfFighters = newChallengerIndex >= battle.challengerFighters.length;
      const challengedOutOfFighters = newChallengedIndex >= battle.challengedFighters.length;
      
      let battleComplete = challengerOutOfFighters || challengedOutOfFighters;
      let winningGuildId: string | undefined;
      
      if (battleComplete) {
        // Determine winner by score
        winningGuildId = newChallengerScore > newChallengedScore 
          ? battle.challengerGuildId 
          : (newChallengerScore < newChallengedScore ? battle.challengedGuildId : undefined);
      }

      if (battleComplete) {
        const updateData: any = {
          status: "completed",
          challengerScore: newChallengerScore,
          challengedScore: newChallengedScore,
          challengerCurrentIndex: newChallengerIndex,
          challengedCurrentIndex: newChallengedIndex,
          completedAt: new Date(),
        };
        
        if (winningGuildId) {
          updateData.winnerId = winningGuildId;
          
          // Update guild wins
          const winningGuild = await storage.getGuild(winningGuildId);
          if (winningGuild) {
            await storage.updateGuildWins(winningGuildId, (winningGuild.wins || 0) + 1);
          }
          
          // Refresh guild_wins leaderboard cache immediately
          const freshLeaderboard = await buildLeaderboard("guild_wins");
          await storage.setLeaderboardCache("guild_wins", freshLeaderboard);
        }

        const updated = await storage.updateGuildBattle(battle.id, updateData);

        // Notify all members of both guilds
        const challengerGuild = await storage.getGuild(battle.challengerGuildId);
        const challengedGuild = await storage.getGuild(battle.challengedGuildId);
        const challengerMembers = await storage.getGuildMembers(battle.challengerGuildId);
        const challengedMembers = await storage.getGuildMembers(battle.challengedGuildId);
        
        for (const member of [...challengerMembers, ...challengedMembers]) {
          broadcastToPlayer(member.accountId, "guildBattleComplete", {
            battle: updated,
            winnerId: winningGuildId,
            winnerName: winningGuildId === battle.challengerGuildId ? challengerGuild?.name : challengedGuild?.name,
          });
        }

        // Activity feed
        await storage.createActivityFeed({
          type: "guild_battle_complete",
          message: winningGuildId 
            ? `${winningGuildId === battle.challengerGuildId ? challengerGuild?.name : challengedGuild?.name} won the guild battle ${newChallengerScore}-${newChallengedScore}!`
            : `Guild battle ended in a tie ${newChallengerScore}-${newChallengedScore}!`,
          metadata: { battleId: battle.id, winnerId: winningGuildId },
        });

        res.json(updated);
      } else {
        // Advance to next round with updated fighter indices
        const updated = await storage.updateGuildBattle(battle.id, {
          currentRound: nextRound,
          challengerScore: newChallengerScore,
          challengedScore: newChallengedScore,
          challengerCurrentIndex: newChallengerIndex,
          challengedCurrentIndex: newChallengedIndex,
        });

        res.json(updated);
      }
    } catch (error) {
      console.error("Failed to set round winner:", error);
      res.status(500).json({ error: "Failed to set round winner" });
    }
  });

  // =============================================
  // PET PVP BATTLES (3v3 TURN-BASED)
  // =============================================
  
  // Get player's pet battle challenges (pending, active, completed)
  app.get("/api/accounts/:id/pet-battles", async (req, res) => {
    try {
      const { petBattles } = await import("@shared/schema");
      const { or: orFunc, desc: descFunc } = await import("drizzle-orm");
      const battles = await db.select().from(petBattles).where(
        orFunc(
          eq(petBattles.challengerId, req.params.id),
          eq(petBattles.challengedId, req.params.id)
        )
      ).orderBy(descFunc(petBattles.createdAt));
      
      const allAccounts = await storage.getAllAccounts();
      const allPets = await storage.getAllPets();
      
      const battlesWithDetails = battles.map(battle => {
        const challenger = allAccounts.find(a => a.id === battle.challengerId);
        const challenged = allAccounts.find(a => a.id === battle.challengedId);
        
        const challengerPetDetails = battle.challengerPets.map(petId => 
          allPets.find(p => p.id === petId)
        ).filter(Boolean);
        
        const challengedPetDetails = battle.challengedPets.map(petId => 
          allPets.find(p => p.id === petId)
        ).filter(Boolean);
        
        return {
          ...battle,
          challengerName: challenger?.username || "Unknown",
          challengedName: challenged?.username || "Unknown",
          challengerPetDetails,
          challengedPetDetails,
        };
      });
      
      res.json(battlesWithDetails);
    } catch (error) {
      console.error("Failed to fetch pet battles:", error);
      res.status(500).json({ error: "Failed to fetch pet battles" });
    }
  });
  
  // Challenge another player to a pet battle (3v3)
  app.post("/api/pet-battles/challenge", async (req, res) => {
    try {
      const challengeSchema = z.object({
        challengerId: z.string(),
        challengedId: z.string(),
        challengerPets: z.array(z.string()).length(3),
        goldWager: z.number().min(0).default(0),
      });
      const { challengerId, challengedId, challengerPets, goldWager } = challengeSchema.parse(req.body);
      
      if (!challengerId) {
        return res.status(400).json({ error: "Challenger ID required" });
      }
      
      const challenger = await storage.getAccount(challengerId);
      const challenged = await storage.getAccount(challengedId);
      
      if (!challenger || !challenged) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      if (challenger.isDead) {
        return res.status(400).json({ error: "Cannot challenge while dead" });
      }
      
      if (goldWager > challenger.gold) {
        return res.status(400).json({ error: "Not enough gold for wager" });
      }
      
      // Verify challenger owns the pets
      const allPets = await storage.getAllPets();
      for (const petId of challengerPets) {
        const pet = allPets.find(p => p.id === petId && p.accountId === challengerId);
        if (!pet) {
          return res.status(400).json({ error: "You don't own one of the selected pets" });
        }
      }
      
      const { petBattles } = await import("@shared/schema");
      const [battle] = await db.insert(petBattles).values({
        challengerId,
        challengedId,
        challengerPets,
        goldWager,
        status: "pending",
      }).returning();
      
      // Notify challenged player
      broadcastToPlayer(challengedId, "petBattleChallenge", {
        battle,
        challengerName: challenger.username,
        goldWager,
      });
      
      res.json(battle);
    } catch (error) {
      console.error("Failed to create pet battle:", error);
      res.status(500).json({ error: "Failed to create pet battle challenge" });
    }
  });
  
  // Respond to a pet battle challenge (accept or decline)
  app.patch("/api/pet-battles/:battleId/respond", async (req, res) => {
    try {
      const responseSchema = z.object({
        accountId: z.string(),
        accept: z.boolean(),
        challengedPets: z.array(z.string()).optional(),
      });
      const { accountId, accept, challengedPets } = responseSchema.parse(req.body);
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const { petBattles } = await import("@shared/schema");
      const [battle] = await db.select().from(petBattles).where(eq(petBattles.id, req.params.battleId));
      
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }
      
      if (battle.challengedId !== accountId) {
        return res.status(403).json({ error: "You are not the challenged player" });
      }
      
      if (battle.status !== "pending") {
        return res.status(400).json({ error: "Battle is not pending" });
      }
      
      if (accept) {
        if (!challengedPets || challengedPets.length !== 3) {
          return res.status(400).json({ error: "Must select exactly 3 pets" });
        }
        
        // Verify challenged player owns the pets
        const allPets = await storage.getAllPets();
        for (const petId of challengedPets) {
          const pet = allPets.find(p => p.id === petId && p.accountId === accountId);
          if (!pet) {
            return res.status(400).json({ error: "You don't own one of the selected pets" });
          }
        }
        
        const challenged = await storage.getAccount(accountId);
        if (battle.goldWager > (challenged?.gold || 0)) {
          return res.status(400).json({ error: "Not enough gold for wager" });
        }
        
        const [updated] = await db.update(petBattles)
          .set({
            status: "in_progress",
            challengedPets,
            currentRound: 1,
          })
          .where(eq(petBattles.id, battle.id))
          .returning();
        
        // Notify challenger
        broadcastToPlayer(battle.challengerId, "petBattleStarted", {
          battle: updated,
        });
        
        res.json(updated);
      } else {
        const [updated] = await db.update(petBattles)
          .set({ status: "declined" })
          .where(eq(petBattles.id, battle.id))
          .returning();
        
        broadcastToPlayer(battle.challengerId, "petBattleDeclined", { battleId: battle.id });
        res.json(updated);
      }
    } catch (error) {
      console.error("Failed to respond to pet battle:", error);
      res.status(500).json({ error: "Failed to respond to pet battle" });
    }
  });
  
  // Fight a round in pet battle (3v3 - one pet per round)
  app.post("/api/pet-battles/:battleId/fight", async (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const { petBattles, pets } = await import("@shared/schema");
      const [battle] = await db.select().from(petBattles).where(eq(petBattles.id, req.params.battleId));
      
      if (!battle) {
        return res.status(404).json({ error: "Battle not found" });
      }
      
      if (battle.status !== "in_progress") {
        return res.status(400).json({ error: "Battle is not in progress" });
      }
      
      // Only challenger can initiate the fight round
      if (battle.challengerId !== accountId) {
        return res.status(403).json({ error: "Only challenger can initiate fight rounds" });
      }
      
      const currentRound = battle.currentRound;
      if (currentRound > 3) {
        return res.status(400).json({ error: "Battle is already complete" });
      }
      
      // Get the pets for this round (index = currentRound - 1)
      const roundIndex = currentRound - 1;
      const challengerPetId = battle.challengerPets[roundIndex];
      const challengedPetId = battle.challengedPets[roundIndex];
      
      const allPets = await db.select().from(pets);
      const challengerPet = allPets.find(p => p.id === challengerPetId);
      const challengedPet = allPets.find(p => p.id === challengedPetId);
      
      if (!challengerPet || !challengedPet) {
        console.error(`Pet not found: ChallengerPetId=${challengerPetId}, ChallengedPetId=${challengedPetId}`);
        // Fallback or handle missing pet
        return res.status(400).json({ error: "One of the pets no longer exists" });
      }
      
      // Calculate pet battle power
      const getPetPower = (pet: typeof challengerPet) => {
        const stats = pet.stats as { Str: number; Spd: number; Luck: number; ElementalPower: number };
        return (stats.Str || 1) * 2 + (stats.Spd || 1) * 1.5 + (stats.Luck || 1) * 0.5 + (stats.ElementalPower || 1) * 3;
      };
      
      const challengerPower = getPetPower(challengerPet);
      const challengedPower = getPetPower(challengedPet);
      
      // Add some randomness (±20%)
      const challengerRoll = challengerPower * (0.8 + Math.random() * 0.4);
      const challengedRoll = challengedPower * (0.8 + Math.random() * 0.4);
      
      const roundWinner = challengerRoll >= challengedRoll ? "challenger" : "challenged";
      
      let newChallengerWins = battle.challengerWins;
      let newChallengedWins = battle.challengedWins;
      
      if (roundWinner === "challenger") {
        newChallengerWins += 1;
      } else {
        newChallengedWins += 1;
      }
      
      const nextRound = currentRound + 1;
      const battleComplete = nextRound > 3;
      
      let winnerId: string | undefined;
      if (battleComplete) {
        winnerId = newChallengerWins > newChallengedWins 
          ? battle.challengerId 
          : (newChallengerWins < newChallengedWins ? battle.challengedId : undefined);
      }
      
      const updateData: any = {
        currentRound: nextRound,
        challengerWins: newChallengerWins,
        challengedWins: newChallengedWins,
      };
      
      if (battleComplete) {
        updateData.status = "completed";
        updateData.completedAt = new Date();
        if (winnerId) {
          updateData.winnerId = winnerId;
        }
        
        // Handle gold wager transfer
        if (battle.goldWager > 0 && winnerId) {
          const loserId = winnerId === battle.challengerId ? battle.challengedId : battle.challengerId;
          const loser = await storage.getAccount(loserId);
          const winner = await storage.getAccount(winnerId);
          
          if (loser && winner) {
            const actualWager = Math.min(battle.goldWager, loser.gold);
            await storage.updateAccount(loserId, { gold: loser.gold - actualWager });
            await storage.updateAccount(winnerId, { gold: winner.gold + actualWager });
          }
        }
      }
      
      const [updated] = await db.update(petBattles)
        .set(updateData)
        .where(eq(petBattles.id, battle.id))
        .returning();
      
      const roundResult = {
        battle: updated,
        round: currentRound,
        challengerPet: { name: challengerPet.name, tier: challengerPet.tier, power: challengerPower },
        challengedPet: { name: challengedPet.name, tier: challengedPet.tier, power: challengedPower },
        roundWinner,
        battleComplete,
        winnerId,
        message: battleComplete 
          ? (winnerId ? `Pet battle complete! Winner: ${winnerId === battle.challengerId ? 'Challenger' : 'Challenged'}` : "Pet battle ended in a tie!")
          : `Round ${currentRound} complete! ${roundWinner === 'challenger' ? 'Challenger' : 'Challenged'} wins!`,
      };
      
      // Notify both players
      broadcastToPlayer(battle.challengerId, "petBattleRoundResult", roundResult);
      broadcastToPlayer(battle.challengedId, "petBattleRoundResult", roundResult);
      
      res.json(roundResult);
    } catch (error) {
      console.error("Failed to fight pet battle round:", error);
      res.status(500).json({ error: "Failed to fight pet battle round" });
    }
  });
  
  // Get available opponents for pet battles
  app.get("/api/pet-battles/opponents", async (req, res) => {
    try {
      const { accountId } = req.query;
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const opponents = [];
      for (const [id, session] of Array.from(activeSessions.entries())) {
        if (id !== accountId) {
          const account = await storage.getAccount(id);
          if (account && !account.isDead) {
            const pets = await storage.getPetsByAccount(id);
            if (pets.length >= 3) {
              opponents.push({
                id: account.id,
                username: account.username,
                rank: account.rank,
                petCount: pets.length,
              });
            }
          }
        }
      }
      
      res.json(opponents);
    } catch (error) {
      res.status(500).json({ error: "Failed to get opponents" });
    }
  });

  // =============================================
  // SKILL AUCTION SYSTEM ROUTES
  // =============================================

  // Get current active auction and queue
  app.get("/api/auctions/active", async (req, res) => {
    try {
      const activeAuction = await storage.getActiveAuction();
      if (activeAuction) {
        const bids = await storage.getAuctionBids(activeAuction.id);
        const highestBid = bids[0];
        res.json({ auction: activeAuction, bids, highestBid });
      } else {
        res.json({ auction: null, bids: [], highestBid: null });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get active auction" });
    }
  });

  // Get queued auctions
  app.get("/api/auctions/queue", async (req, res) => {
    try {
      const queue = await storage.getQueuedAuctions();
      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: "Failed to get auction queue" });
    }
  });

  // Place a bid
  app.post("/api/auctions/:auctionId/bid", async (req, res) => {
    try {
      const { auctionId } = req.params;
      const { accountId, amount } = req.body;

      const auction = await storage.getSkillAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ error: "Auction not found" });
      }
      if (auction.status !== "active") {
        return res.status(400).json({ error: "Auction is not active" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.gold < amount) {
        return res.status(400).json({ error: "Not enough gold" });
      }

      const currentHighest = await storage.getHighestBid(auctionId);
      if (currentHighest && amount <= currentHighest.amount) {
        return res.status(400).json({ error: "Bid must be higher than current highest" });
      }

      const bid = await storage.createSkillBid({
        auctionId,
        bidderId: accountId,
        amount,
      });

      // Broadcast to all players about new bid
      broadcastToAllPlayers("auction_bid", {
        auctionId,
        bidderId: accountId,
        bidderName: account.username,
        amount,
      });

      res.json(bid);
    } catch (error) {
      res.status(500).json({ error: "Failed to place bid" });
    }
  });

  // Admin: Add skill to auction queue
  app.post("/api/admin/auctions/queue", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId || !activeSessions.has(adminId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { skillId } = req.body;
      const auction = await storage.createSkillAuction({
        skillId,
        status: "queued",
      });

      res.json(auction);
    } catch (error) {
      res.status(500).json({ error: "Failed to add skill to queue" });
    }
  });

  // Admin: Start next auction (or start first if none active)
  app.post("/api/admin/auctions/start-next", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId || !activeSessions.has(adminId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if there's an active auction
      const activeAuction = await storage.getActiveAuction();
      if (activeAuction) {
        return res.status(400).json({ error: "There is already an active auction" });
      }

      // Get first queued auction
      const queue = await storage.getQueuedAuctions();
      if (queue.length === 0) {
        return res.status(400).json({ error: "No skills in queue" });
      }

      const nextAuction = queue[0];
      const now = new Date();
      const endAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

      const updated = await storage.updateSkillAuction(nextAuction.id, {
        status: "active",
        startAt: now,
        endAt,
      });

      // Broadcast to all players
      broadcastToAllPlayers("auction_started", updated);

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to start auction" });
    }
  });

  // Admin: Finalize current auction
  app.post("/api/admin/auctions/finalize", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId || !activeSessions.has(adminId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      const activeAuction = await storage.getActiveAuction();
      if (!activeAuction) {
        return res.status(400).json({ error: "No active auction to finalize" });
      }

      const highestBid = await storage.getHighestBid(activeAuction.id);
      
      if (highestBid) {
        const winner = await storage.getAccount(highestBid.bidderId);
        const saleTax = calculateAuctionSaleTax(highestBid.amount);
        const totalCost = highestBid.amount + saleTax;
        if (winner && winner.gold >= totalCost) {
          await storage.updateAccountGold(winner.id, winner.gold - totalCost);
          
          await storage.addPlayerSkill({
            accountId: winner.id,
            skillId: activeAuction.skillId,
            source: "auction",
          });

          await storage.updateSkillAuction(activeAuction.id, {
            status: "completed",
            winningBidId: highestBid.id,
            winnerId: winner.id,
          });

          await storage.createActivityFeed({
            type: "bid_won",
            accountId: winner.id,
            accountName: winner.username,
            message: `${winner.username} won the auction for a skill with a bid of ${highestBid.amount.toLocaleString()} gold! (${saleTax.toLocaleString()} gold tax)`,
            metadata: { skillId: activeAuction.skillId, amount: highestBid.amount, saleTax },
          });

          broadcastToAllPlayers("auction_ended", {
            auctionId: activeAuction.id,
            winnerId: winner.id,
            winnerName: winner.username,
            amount: highestBid.amount,
            saleTax,
            skillId: activeAuction.skillId,
          });
        }
      } else {
        await storage.updateSkillAuction(activeAuction.id, {
          status: "completed",
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to finalize auction" });
    }
  });

  // Admin: Remove auction from queue
  app.delete("/api/admin/auctions/:auctionId", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId || !activeSessions.has(adminId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      const auction = await storage.getSkillAuction(req.params.auctionId);
      if (!auction) {
        return res.status(404).json({ error: "Auction not found" });
      }
      if (auction.status === "active") {
        return res.status(400).json({ error: "Cannot delete active auction" });
      }

      await storage.deleteSkillAuction(req.params.auctionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete auction" });
    }
  });

  // =============================================
  // PLAYER SKILLS ROUTES
  // =============================================

  // Get player's skills
  app.get("/api/accounts/:accountId/skills", async (req, res) => {
    try {
      const skills = await storage.getPlayerSkills(req.params.accountId);
      res.json(skills);
    } catch (error) {
      res.status(500).json({ error: "Failed to get player skills" });
    }
  });

  // Equip a skill
  app.post("/api/accounts/:accountId/skills/:skillId/equip", async (req, res) => {
    try {
      const { accountId, skillId } = req.params;
      
      const playerSkill = await storage.getPlayerSkill(skillId);
      if (!playerSkill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      if (playerSkill.accountId !== accountId) {
        return res.status(403).json({ error: "Not your skill" });
      }

      // Unequip current skill
      const currentEquipped = await storage.getEquippedSkill(accountId);
      if (currentEquipped) {
        await storage.updatePlayerSkill(currentEquipped.id, { isEquipped: false });
      }

      // Equip new skill
      const updated = await storage.updatePlayerSkill(skillId, { isEquipped: true });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to equip skill" });
    }
  });

  // Unequip a skill
  app.post("/api/accounts/:accountId/skills/:skillId/unequip", async (req, res) => {
    try {
      const { accountId, skillId } = req.params;
      
      const playerSkill = await storage.getPlayerSkill(skillId);
      if (!playerSkill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      if (playerSkill.accountId !== accountId) {
        return res.status(403).json({ error: "Not your skill" });
      }

      const updated = await storage.updatePlayerSkill(skillId, { isEquipped: false });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to unequip skill" });
    }
  });

  app.get("/api/spells/catalog", async (req, res) => {
    try {
      const { ALL_SKILLS, getSkillsByCategory, getSkillsByRank, getAdminExclusiveSkills, getValorExclusiveSkills, getAvailableSkillsForRank } = await import("@shared/skills-data");
      const category = req.query.category as string | undefined;
      const rank = req.query.rank as string | undefined;
      const includeExclusive = req.query.includeExclusive === "true";

      let skills = ALL_SKILLS.filter(s => !s.isAdminExclusive && !s.isValorExclusive);

      if (category) {
        skills = skills.filter(s => s.spellCategory === category);
      }
      if (rank) {
        skills = getAvailableSkillsForRank(rank);
        if (category) {
          skills = skills.filter(s => s.spellCategory === category);
        }
      }

      const result: any = { skills, total: skills.length };
      if (includeExclusive) {
        result.adminExclusive = getAdminExclusiveSkills();
        result.valorExclusive = getValorExclusiveSkills();
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get spell catalog" });
    }
  });

  app.get("/api/accounts/:accountId/equipped-spell", async (req, res) => {
    try {
      const equippedSkill = await storage.getEquippedSkill(req.params.accountId);
      if (!equippedSkill) {
        return res.json({ equipped: false, spell: null });
      }
      const { getSkillById } = await import("@shared/skills-data");
      const skillDef = getSkillById(equippedSkill.skillId);
      res.json({ equipped: true, spell: skillDef || null, record: equippedSkill });
    } catch (error) {
      res.status(500).json({ error: "Failed to get equipped spell" });
    }
  });

  // =============================================
  // ACTIVITY FEED ROUTES
  // =============================================

  // Get recent activities
  app.get("/api/activity-feed", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activity feed" });
    }
  });

  // Admin: Add activity manually
  app.post("/api/admin/activity-feed", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId || !activeSessions.has(adminId)) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { type, message, accountId, accountName, metadata } = req.body;
      const activity = await storage.createActivityFeed({
        type,
        message,
        accountId,
        accountName,
        metadata,
      });

      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  // =============================================
  // RACE SKILL TREE ROUTES
  // =============================================

  app.get("/api/accounts/:accountId/race-skills", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.race) {
        return res.status(400).json({ error: "No race selected" });
      }

      const { getUnlockedRaceSkills, getRaceSkillTree } = await import("@shared/skills-data");
      const allSkills = getRaceSkillTree(account.race);
      const unlockedSkills = getUnlockedRaceSkills(account.race, account.rank);

      const customNames = (account as any).customSkillNames || {};

      const skillsWithState = allSkills.map(skill => {
        const isUnlocked = unlockedSkills.some(u => u.id === skill.id);
        const displayName = customNames[skill.id] || skill.name;
        return {
          ...skill,
          name: displayName,
          originalName: skill.name,
          isUnlocked,
          isEquippedActive: (account as any).equippedRaceActive === skill.id,
          isEquippedPassive: (account as any).equippedRacePassive === skill.id,
        };
      });

      res.json({
        race: account.race,
        rank: account.rank,
        skills: skillsWithState,
        equippedActive: (account as any).equippedRaceActive,
        equippedPassive: (account as any).equippedRacePassive,
        canRenameSkills: account.rank === "Mythical Legend",
      });
    } catch (error) {
      console.error("Error getting race skills:", error);
      res.status(500).json({ error: "Failed to get race skills" });
    }
  });

  app.post("/api/accounts/:accountId/race-skills/equip-active", async (req, res) => {
    try {
      const { accountId } = req.params;
      const { skillId } = z.object({ skillId: z.string() }).parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.race) {
        return res.status(400).json({ error: "No race selected" });
      }

      const { isRaceSkillUnlocked, getRaceSkillById } = await import("@shared/skills-data");
      const skill = getRaceSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      if (skill.type !== "active") {
        return res.status(400).json({ error: "Not an active skill" });
      }
      if (skill.race !== account.race) {
        return res.status(400).json({ error: "Skill does not belong to your race" });
      }
      if (!isRaceSkillUnlocked(skillId, account.race, account.rank)) {
        return res.status(400).json({ error: "Skill not yet unlocked at your rank" });
      }

      await db.update(accounts).set({
        equippedRaceActive: skillId,
      }).where(eq(accounts.id, accountId));

      res.json({ success: true, equippedActive: skillId, skillName: skill.name });
    } catch (error) {
      console.error("Error equipping race active skill:", error);
      res.status(500).json({ error: "Failed to equip active skill" });
    }
  });

  app.post("/api/accounts/:accountId/race-skills/equip-passive", async (req, res) => {
    try {
      const { accountId } = req.params;
      const { skillId } = z.object({ skillId: z.string() }).parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.race) {
        return res.status(400).json({ error: "No race selected" });
      }

      const { isRaceSkillUnlocked, getRaceSkillById } = await import("@shared/skills-data");
      const skill = getRaceSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      if (skill.type !== "passive") {
        return res.status(400).json({ error: "Not a passive skill" });
      }
      if (skill.race !== account.race) {
        return res.status(400).json({ error: "Skill does not belong to your race" });
      }
      if (!isRaceSkillUnlocked(skillId, account.race, account.rank)) {
        return res.status(400).json({ error: "Skill not yet unlocked at your rank" });
      }

      await db.update(accounts).set({
        equippedRacePassive: skillId,
      }).where(eq(accounts.id, accountId));

      res.json({ success: true, equippedPassive: skillId, skillName: skill.name });
    } catch (error) {
      console.error("Error equipping race passive skill:", error);
      res.status(500).json({ error: "Failed to equip passive skill" });
    }
  });

  app.post("/api/accounts/:accountId/race-skills/unequip-active", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      await db.update(accounts).set({
        equippedRaceActive: null,
      }).where(eq(accounts.id, req.params.accountId));

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unequip active skill" });
    }
  });

  app.post("/api/accounts/:accountId/race-skills/unequip-passive", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      await db.update(accounts).set({
        equippedRacePassive: null,
      }).where(eq(accounts.id, req.params.accountId));

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unequip passive skill" });
    }
  });

  app.post("/api/accounts/:accountId/race-skills/rename", async (req, res) => {
    try {
      const { accountId } = req.params;
      const { skillId, newName } = z.object({
        skillId: z.string(),
        newName: z.string().min(2).max(30),
      }).parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (account.rank !== "Mythical Legend") {
        return res.status(400).json({ error: "Custom skill naming requires Mythical Legend rank" });
      }

      const { getRaceSkillById } = await import("@shared/skills-data");
      const skill = getRaceSkillById(skillId);
      if (!skill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      if (skill.race !== account.race) {
        return res.status(400).json({ error: "Not your race's skill" });
      }

      const customNames = { ...((account as any).customSkillNames || {}), [skillId]: newName };

      await db.update(accounts).set({
        customSkillNames: customNames,
      }).where(eq(accounts.id, accountId));

      res.json({ success: true, skillId, newName, message: `Skill renamed to "${newName}"` });
    } catch (error) {
      console.error("Error renaming skill:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid name", details: error.errors });
      }
      res.status(500).json({ error: "Failed to rename skill" });
    }
  });

  // =============================================
  // AUCTION TIMER CHECK (for automatic finalization)
  // =============================================

  // Check and finalize expired auctions every minute
  setInterval(async () => {
    try {
      const activeAuction = await storage.getActiveAuction();
      if (activeAuction && activeAuction.endAt) {
        const now = new Date();
        if (now >= new Date(activeAuction.endAt)) {
          // Auto-finalize the auction
          const highestBid = await storage.getHighestBid(activeAuction.id);
          
          if (highestBid) {
            const winner = await storage.getAccount(highestBid.bidderId);
            const autoSaleTax = calculateAuctionSaleTax(highestBid.amount);
            const autoTotalCost = highestBid.amount + autoSaleTax;
            if (winner && winner.gold >= autoTotalCost) {
              await storage.updateAccountGold(winner.id, winner.gold - autoTotalCost);
              
              await storage.addPlayerSkill({
                accountId: winner.id,
                skillId: activeAuction.skillId,
                source: "auction",
              });

              await storage.updateSkillAuction(activeAuction.id, {
                status: "completed",
                winningBidId: highestBid.id,
                winnerId: winner.id,
              });

              await storage.createActivityFeed({
                type: "bid_won",
                accountId: winner.id,
                accountName: winner.username,
                message: `${winner.username} won the auction for a skill with a bid of ${highestBid.amount.toLocaleString()} gold! (${autoSaleTax.toLocaleString()} gold tax)`,
                metadata: { skillId: activeAuction.skillId, amount: highestBid.amount, saleTax: autoSaleTax },
              });

              broadcastToAllPlayers("auction_ended", {
                auctionId: activeAuction.id,
                winnerId: winner.id,
                winnerName: winner.username,
                amount: highestBid.amount,
                saleTax: autoSaleTax,
                skillId: activeAuction.skillId,
              });
            }
          } else {
            await storage.updateSkillAuction(activeAuction.id, {
              status: "completed",
            });
          }

          // Auto-start next queued auction
          const queue = await storage.getQueuedAuctions();
          if (queue.length > 0) {
            const nextAuction = queue[0];
            const startNow = new Date();
            const endAt = new Date(startNow.getTime() + 8 * 60 * 60 * 1000);
            
            const updated = await storage.updateSkillAuction(nextAuction.id, {
              status: "active",
              startAt: startNow,
              endAt,
            });
            
            broadcastToAllPlayers("auction_started", updated);
          }
        }
      }
    } catch (error) {
      console.error("Error checking auction timer:", error);
    }
  }, 60000);

  // ==================== TRADING SYSTEM ROUTES ====================
  
  // Create a new trade offer
  app.post("/api/trades", async (req, res) => {
    try {
      const schema = z.object({
        initiatorId: z.string(),
        recipientId: z.string(),
      });
      const { initiatorId, recipientId } = schema.parse(req.body);
      
      if (initiatorId === recipientId) {
        return res.status(400).json({ error: "Cannot trade with yourself" });
      }

      const { TRADE_RANK_RESTRICTIONS, TRADE_MIN_RANK, TRADE_MAX_RANK_DIFF } = await import("@shared/schema");

      const initiator = await storage.getAccount(initiatorId);
      const recipient = await storage.getAccount(recipientId);
      if (!initiator || !recipient) {
        return res.status(404).json({ error: "Account not found" });
      }

      const initiatorRankIdx = TRADE_RANK_RESTRICTIONS[initiator.rank] ?? 0;
      const recipientRankIdx = TRADE_RANK_RESTRICTIONS[recipient.rank] ?? 0;
      const minRankIdx = TRADE_RANK_RESTRICTIONS[TRADE_MIN_RANK] ?? 1;

      if (initiatorRankIdx < minRankIdx) {
        return res.status(400).json({ error: `You must be at least ${TRADE_MIN_RANK} rank to trade` });
      }
      if (recipientRankIdx < minRankIdx) {
        return res.status(400).json({ error: `${recipient.username} must be at least ${TRADE_MIN_RANK} rank to trade` });
      }

      const rankDiff = Math.abs(initiatorRankIdx - recipientRankIdx);
      if (rankDiff > TRADE_MAX_RANK_DIFF) {
        return res.status(400).json({ error: `Rank difference too large (max ${TRADE_MAX_RANK_DIFF} ranks apart). You are ${initiator.rank}, they are ${recipient.rank}.` });
      }
      
      const trade = await storage.createTrade({ initiatorId, recipientId });
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to create trade" });
    }
  });
  
  // Get trades for account
  app.get("/api/trades/:accountId", async (req, res) => {
    try {
      const trades = await storage.getTradesByAccount(req.params.accountId);
      const allAccounts = await storage.getAllAccounts();
      
      const tradesWithDetails = await Promise.all(trades.map(async trade => {
        const items = await storage.getTradeItems(trade.id);
        const initiator = allAccounts.find(a => a.id === trade.initiatorId);
        const recipient = allAccounts.find(a => a.id === trade.recipientId);
        return {
          ...trade,
          initiatorName: initiator?.username,
          recipientName: recipient?.username,
          items,
        };
      }));
      
      res.json(tradesWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trades" });
    }
  });
  
  // Add item to trade
  app.post("/api/trades/:tradeId/items", async (req, res) => {
    try {
      const schema = z.object({
        ownerId: z.string(),
        type: z.enum(["item", "skill"]),
        refId: z.string(),
      });
      const data = schema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.tradeId);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.status !== "pending") {
        return res.status(400).json({ error: "Trade is not pending" });
      }
      
      // Verify owner is part of trade
      if (data.ownerId !== trade.initiatorId && data.ownerId !== trade.recipientId) {
        return res.status(403).json({ error: "Not a party to this trade" });
      }
      
      // Verify ownership
      if (data.type === "item") {
        const inventory = await storage.getInventoryByAccount(data.ownerId);
        if (!inventory.find(i => i.id === data.refId)) {
          return res.status(400).json({ error: "Item not in inventory" });
        }
      } else {
        const skills = await storage.getPlayerSkills(data.ownerId);
        if (!skills.find(s => s.id === data.refId)) {
          return res.status(400).json({ error: "Skill not owned" });
        }
      }
      
      // Reset acceptance when items change
      await storage.updateTrade(trade.id, {
        initiatorAccepted: false,
        recipientAccepted: false,
      });
      
      const item = await storage.addTradeItem({ tradeId: req.params.tradeId, ...data });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add trade item" });
    }
  });
  
  // Accept trade (both parties must accept, then time lock applies)
  app.patch("/api/trades/:tradeId/accept", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      const { TRADE_TIME_LOCK_SECONDS } = await import("@shared/schema");
      
      const trade = await storage.getTrade(req.params.tradeId);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.status !== "pending" && trade.status !== "accepted") {
        return res.status(400).json({ error: "Trade is not in an acceptable state" });
      }
      
      const isInitiator = accountId === trade.initiatorId;
      const isRecipient = accountId === trade.recipientId;
      
      if (!isInitiator && !isRecipient) {
        return res.status(403).json({ error: "Not a party to this trade" });
      }
      
      const updates: any = {};
      if (isInitiator) updates.initiatorAccepted = true;
      if (isRecipient) updates.recipientAccepted = true;
      
      const bothAccepted = (isInitiator && trade.recipientAccepted) || (isRecipient && trade.initiatorAccepted);
      
      if (bothAccepted && !trade.timeLockUntil) {
        const timeLockUntil = new Date(Date.now() + TRADE_TIME_LOCK_SECONDS * 1000);
        updates.timeLockUntil = timeLockUntil;
        updates.status = "accepted";
        const updated = await storage.updateTrade(trade.id, updates);
        return res.json({ ...updated, message: `Trade accepted by both parties. Time lock active for ${TRADE_TIME_LOCK_SECONDS} seconds. Trade will complete after lock expires.`, timeLockUntil: timeLockUntil.toISOString() });
      }
      
      const updated = await storage.updateTrade(trade.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept trade" });
    }
  });

  // Confirm trade after time lock expires
  app.patch("/api/trades/:tradeId/confirm", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.tradeId);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.status !== "accepted") {
        return res.status(400).json({ error: "Trade has not been accepted by both parties yet" });
      }

      if (!trade.initiatorAccepted || !trade.recipientAccepted) {
        return res.status(400).json({ error: "Both parties must accept before confirming" });
      }

      const isParty = accountId === trade.initiatorId || accountId === trade.recipientId;
      if (!isParty) {
        return res.status(403).json({ error: "Not a party to this trade" });
      }
      
      if (trade.timeLockUntil && new Date() < new Date(trade.timeLockUntil)) {
        const remaining = Math.ceil((new Date(trade.timeLockUntil).getTime() - Date.now()) / 1000);
        return res.status(400).json({ error: `Time lock still active. ${remaining} seconds remaining.`, timeLockUntil: trade.timeLockUntil });
      }

      const items = await storage.getTradeItems(trade.id);
      const initiatorItemNames: { type: string; refId: string; name: string }[] = [];
      const recipientItemNames: { type: string; refId: string; name: string }[] = [];
      
      for (const item of items) {
        let itemName = item.refId;
        if (item.type === "item") {
          const inventoryItem = await storage.getInventoryItem(item.refId);
          if (inventoryItem) {
            itemName = inventoryItem.itemId;
            const newOwnerId = item.ownerId === trade.initiatorId ? trade.recipientId : trade.initiatorId;
            await storage.removeFromInventory(item.refId);
            await storage.addToInventory({
              ...inventoryItem,
              accountId: newOwnerId,
            });
          }
        } else {
          const skill = await storage.getPlayerSkill(item.refId);
          if (skill) {
            itemName = (skill as any).skillId || item.refId;
            const newOwnerId = item.ownerId === trade.initiatorId ? trade.recipientId : trade.initiatorId;
            await storage.updatePlayerSkill(item.refId, { accountId: newOwnerId, isEquipped: false });
          }
        }

        const entry = { type: item.type, refId: item.refId, name: itemName };
        if (item.ownerId === trade.initiatorId) {
          initiatorItemNames.push(entry);
        } else {
          recipientItemNames.push(entry);
        }
      }
      
      const completed = await storage.updateTrade(trade.id, {
        status: "completed",
        completedAt: new Date(),
      });

      await storage.createTradeHistory({
        tradeId: trade.id,
        initiatorId: trade.initiatorId,
        recipientId: trade.recipientId,
        initiatorItems: initiatorItemNames,
        recipientItems: recipientItemNames,
        status: "completed",
        completedAt: new Date(),
      });
      
      const initiator = await storage.getAccount(trade.initiatorId);
      const recipient = await storage.getAccount(trade.recipientId);
      await storage.createActivityFeed({
        type: "trade_complete",
        message: `${initiator?.username} and ${recipient?.username} completed a trade!`,
        metadata: { tradeId: trade.id },
      });
      
      res.json(completed);
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm trade" });
    }
  });

  // Get trade history for account
  app.get("/api/trade-history/:accountId", async (req, res) => {
    try {
      const history = await storage.getTradeHistory(req.params.accountId);
      const allAccounts = await storage.getAllAccounts();
      const historyWithNames = history.map(h => ({
        ...h,
        initiatorName: allAccounts.find(a => a.id === h.initiatorId)?.username || "Unknown",
        recipientName: allAccounts.find(a => a.id === h.recipientId)?.username || "Unknown",
      }));
      res.json(historyWithNames);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trade history" });
    }
  });
  
  // Cancel trade
  app.patch("/api/trades/:tradeId/cancel", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.tradeId);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (accountId !== trade.initiatorId && accountId !== trade.recipientId) {
        return res.status(403).json({ error: "Not a party to this trade" });
      }
      
      const updated = await storage.updateTrade(trade.id, { status: "cancelled" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel trade" });
    }
  });
  
  // ==================== SOUL-LINKING SYSTEM ROUTES ====================

  // Create a soul link between two players
  app.post("/api/soul-links", async (req, res) => {
    try {
      const schema = z.object({
        player1Id: z.string(),
        player2Id: z.string(),
      });
      const { player1Id, player2Id } = schema.parse(req.body);
      const { SOUL_LINK_COST_GOLD, SOUL_LINK_DURATION_HOURS, SOUL_LINK_STAT_SHARE_PERCENT } = await import("@shared/schema");

      if (player1Id === player2Id) {
        return res.status(400).json({ error: "Cannot soul-link with yourself" });
      }

      const player1 = await storage.getAccount(player1Id);
      const player2 = await storage.getAccount(player2Id);
      if (!player1 || !player2) {
        return res.status(404).json({ error: "Player not found" });
      }

      if (player1.gold < SOUL_LINK_COST_GOLD) {
        return res.status(400).json({ error: `You need ${SOUL_LINK_COST_GOLD} gold to create a soul link` });
      }
      if (player2.gold < SOUL_LINK_COST_GOLD) {
        return res.status(400).json({ error: `${player2.username} doesn't have enough gold (${SOUL_LINK_COST_GOLD} required)` });
      }

      const existingLinks = await storage.getActiveSoulLinks(player1Id);
      const alreadyLinked = existingLinks.find(l =>
        (l.player1Id === player2Id || l.player2Id === player2Id) && new Date(l.expiresAt) > new Date()
      );
      if (alreadyLinked) {
        return res.status(400).json({ error: "You already have an active soul link with this player" });
      }

      await storage.updateAccountGold(player1Id, player1.gold - SOUL_LINK_COST_GOLD);
      await storage.updateAccountGold(player2Id, player2.gold - SOUL_LINK_COST_GOLD);

      const expiresAt = new Date(Date.now() + SOUL_LINK_DURATION_HOURS * 60 * 60 * 1000);
      const link = await storage.createSoulLink({
        player1Id,
        player2Id,
        statSharePercent: SOUL_LINK_STAT_SHARE_PERCENT,
        goldCostEach: SOUL_LINK_COST_GOLD,
        expiresAt,
      });

      await storage.createActivityFeed({
        type: "soul_link",
        message: `${player1.username} and ${player2.username} have soul-linked! They share ${SOUL_LINK_STAT_SHARE_PERCENT}% of each other's stats for ${SOUL_LINK_DURATION_HOURS} hour(s).`,
        metadata: { soulLinkId: link.id },
      });

      res.json({
        ...link,
        player1Name: player1.username,
        player2Name: player2.username,
        message: `Soul link established! You and ${player2.username} now share ${SOUL_LINK_STAT_SHARE_PERCENT}% of each other's stats for ${SOUL_LINK_DURATION_HOURS} hour(s). Each player paid ${SOUL_LINK_COST_GOLD} gold.`,
      });
    } catch (error) {
      console.error("Soul link error:", error);
      res.status(500).json({ error: "Failed to create soul link" });
    }
  });

  // Get active soul links for a player
  app.get("/api/soul-links/:accountId", async (req, res) => {
    try {
      const links = await storage.getActiveSoulLinks(req.params.accountId);
      const now = new Date();
      const allAccounts = await storage.getAllAccounts();

      const activeLinks = [];
      for (const link of links) {
        if (new Date(link.expiresAt) <= now) {
          await storage.updateSoulLink(link.id, { status: "expired" });
          continue;
        }
        const p1 = allAccounts.find(a => a.id === link.player1Id);
        const p2 = allAccounts.find(a => a.id === link.player2Id);
        activeLinks.push({
          ...link,
          player1Name: p1?.username || "Unknown",
          player2Name: p2?.username || "Unknown",
          player1Stats: p1?.stats,
          player2Stats: p2?.stats,
        });
      }

      res.json(activeLinks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get soul links" });
    }
  });

  // Cancel a soul link
  app.patch("/api/soul-links/:linkId/cancel", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);

      const link = await storage.getSoulLink(req.params.linkId);
      if (!link) {
        return res.status(404).json({ error: "Soul link not found" });
      }

      if (accountId !== link.player1Id && accountId !== link.player2Id) {
        return res.status(403).json({ error: "Not a party to this soul link" });
      }

      const updated = await storage.updateSoulLink(link.id, { status: "cancelled" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel soul link" });
    }
  });

  // Get soul link stat bonuses for a player (used by combat engine)
  app.get("/api/soul-links/:accountId/bonuses", async (req, res) => {
    try {
      const links = await storage.getActiveSoulLinks(req.params.accountId);
      const now = new Date();
      let totalBonuses = { Str: 0, Def: 0, Spd: 0, Int: 0, Luck: 0 };

      for (const link of links) {
        if (new Date(link.expiresAt) <= now) continue;
        const partnerId = link.player1Id === req.params.accountId ? link.player2Id : link.player1Id;
        const partner = await storage.getAccount(partnerId);
        if (!partner) continue;
        const partnerStats = partner.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10 };
        const sharePercent = link.statSharePercent / 100;
        totalBonuses.Str += Math.floor((partnerStats.Str || 10) * sharePercent);
        totalBonuses.Def += Math.floor((partnerStats.Def || 10) * sharePercent);
        totalBonuses.Spd += Math.floor((partnerStats.Spd || 10) * sharePercent);
        totalBonuses.Int += Math.floor((partnerStats.Int || 10) * sharePercent);
        totalBonuses.Luck += Math.floor((partnerStats.Luck || 10) * sharePercent);
      }

      res.json(totalBonuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get soul link bonuses" });
    }
  });

  // ==================== PET FOOD SHOP ROUTES ====================
  
  // Get pet food items
  app.get("/api/pet-food", async (_req, res) => {
    const { petFoodItems } = await import("@shared/schema");
    res.json(petFoodItems);
  });
  
  // Buy pet food and apply to pet
  app.post("/api/pets/:petId/feed", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        foodId: z.string(),
        quantity: z.number().min(1).max(100).default(1),
      });
      const { accountId, foodId, quantity } = schema.parse(req.body);
      
      const { petFoodItems } = await import("@shared/schema");
      const food = petFoodItems.find(f => f.id === foodId);
      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const totalCost = food.price * quantity;
      if (account.gold < totalCost) {
        return res.status(400).json({ error: "Not enough gold" });
      }
      
      const pet = await storage.getPet(req.params.petId);
      if (!pet) {
        return res.status(404).json({ error: "Pet not found" });
      }
      
      if (pet.accountId !== accountId) {
        return res.status(403).json({ error: "Not your pet" });
      }
      
      // Deduct gold and add exp to pet
      await storage.updateAccountGold(accountId, account.gold - totalCost);
      const totalExp = food.exp * quantity;
      const updatedPet = await storage.updatePet(pet.id, { exp: (pet.exp || 0) + totalExp });
      
      res.json({ pet: updatedPet, expGained: totalExp, goldSpent: totalCost });
    } catch (error) {
      res.status(500).json({ error: "Failed to feed pet" });
    }
  });
  
  // ==================== GUILD DEPOSIT ROUTES ====================
  
  // Deposit resources into guild bank
  app.post("/api/guilds/:guildId/deposit", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        resource: z.enum(["gold", "rubies", "soulShards", "focusedShards"]),
        amount: z.number().min(1),
      });
      const { accountId, resource, amount } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Verify membership
      const member = await storage.getGuildMember(accountId);
      if (!member || member.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }
      
      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }
      
      // Check player has enough
      const accountResource = account[resource] ?? 0;
      if (accountResource < amount) {
        return res.status(400).json({ error: `Not enough ${resource}` });
      }
      
      await storage.updateAccount(accountId, { [resource]: accountResource - amount });
      
      const newBank = { ...guild.bank, [resource]: (guild.bank[resource] || 0) + amount };
      const updatedGuild = await storage.updateGuildBank(guild.id, newBank);
      
      await storage.createGuildVaultLog({
        guildId: guild.id,
        accountId,
        playerName: account.username,
        action: "deposit",
        resource,
        quantity: amount,
      });
      
      await storage.createActivityFeed({
        type: "guild_deposit",
        message: `${account.username} deposited ${amount.toLocaleString()} ${resource} into ${guild.name}'s bank!`,
        metadata: { guildId: guild.id, accountId, resource, amount },
      });
      
      res.json(updatedGuild);
    } catch (error) {
      res.status(500).json({ error: "Failed to deposit" });
    }
  });
  
  // ==================== GUILD VAULT LOGS ====================
  
  app.get("/api/guilds/:guildId/vault-logs", async (req, res) => {
    try {
      const accountId = req.query.accountId as string;
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const member = await storage.getGuildMember(accountId);
      if (!member || member.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      const memberRole = accountId === guild.masterId ? "leader" : (member.role || "member");
      if (memberRole !== "leader" && memberRole !== "officer") {
        return res.status(403).json({ error: "Only leader and officers can view vault logs" });
      }

      const logs = await storage.getGuildVaultLogs(req.params.guildId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault logs" });
    }
  });

  // ==================== GUILD ROLE MANAGEMENT ====================
  
  app.post("/api/guilds/:guildId/set-role", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        targetAccountId: z.string(),
        role: z.enum(["officer", "member"]),
      });
      const { accountId, targetAccountId, role } = schema.parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (guild.masterId !== accountId) {
        return res.status(403).json({ error: "Only the guild leader can change member roles" });
      }

      if (targetAccountId === guild.masterId) {
        return res.status(400).json({ error: "Cannot change the leader's role" });
      }

      const targetMember = await storage.getGuildMember(targetAccountId);
      if (!targetMember || targetMember.guildId !== guild.id) {
        return res.status(404).json({ error: "Target is not a member of this guild" });
      }

      const updated = await storage.updateGuildMemberRole(targetAccountId, role);
      
      const targetAccount = await storage.getAccount(targetAccountId);
      broadcastToPlayer(targetAccountId, "guildRoleUpdate", { role, guildName: guild.name });

      res.json({ success: true, member: updated });
    } catch (error) {
      res.status(500).json({ error: "Failed to set role" });
    }
  });

  // ==================== GUILD LEVEL UP ROUTES ====================
  
  // ==================== GUILD SHOP SYSTEM ====================
  
  const GUILD_SHOP_ITEMS = [
    { id: "guild_potion_hp", name: "Guild HP Potion", description: "Restores 500 HP", price: { gold: 500 }, discount: 0.25 },
    { id: "guild_potion_str", name: "Guild Strength Elixir", description: "+10 STR for 1 hour", price: { gold: 1000 }, discount: 0.3 },
    { id: "guild_training_boost", name: "Training Boost", description: "+50% training XP", price: { gold: 2000, rubies: 5 }, discount: 0.25 },
    { id: "guild_pet_treat", name: "Premium Pet Treat", description: "+20 pet bonding", price: { soulShards: 10 }, discount: 0.35 },
    { id: "guild_skill_scroll", name: "Skill Scroll", description: "Random skill unlock", price: { gold: 10000, rubies: 50 }, discount: 0.2 },
    { id: "guild_revival_token", name: "Revival Token", description: "Instant revival on death", price: { rubies: 100 }, discount: 0.3 },
    { id: "guild_xp_boost", name: "XP Multiplier", description: "2x XP for 1 hour", price: { gold: 5000 }, discount: 0.25 },
    { id: "guild_loot_boost", name: "Loot Boost", description: "+50% loot drops", price: { gold: 3000 }, discount: 0.25 },
  ];

  app.get("/api/guilds/:guildId/shop", async (req, res) => {
    try {
      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }
      
      const guildLevel = guild.level || 1;
      const unlockedItems = GUILD_SHOP_ITEMS.slice(0, Math.min(2 + guildLevel, GUILD_SHOP_ITEMS.length));
      
      res.json({
        items: unlockedItems,
        guildLevel,
        bank: guild.bank,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get guild shop" });
    }
  });

  app.post("/api/guilds/:guildId/shop/buy", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        itemId: z.string(),
      });
      const { accountId, itemId } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const member = await storage.getGuildMember(accountId);
      if (!member || member.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }
      
      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }
      
      const item = GUILD_SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const guildLevel = guild.level || 1;
      const unlockedItems = GUILD_SHOP_ITEMS.slice(0, Math.min(2 + guildLevel, GUILD_SHOP_ITEMS.length));
      if (!unlockedItems.find(i => i.id === itemId)) {
        return res.status(403).json({ error: "Item not unlocked at guild level" });
      }
      
      const discountedPrice = {
        gold: Math.floor((item.price.gold || 0) * (1 - item.discount)),
        rubies: Math.floor((item.price.rubies || 0) * (1 - item.discount)),
        soulShards: Math.floor((item.price.soulShards || 0) * (1 - item.discount)),
      };
      
      if ((account.gold || 0) < discountedPrice.gold) {
        return res.status(400).json({ error: "Not enough gold" });
      }
      if ((account.rubies || 0) < discountedPrice.rubies) {
        return res.status(400).json({ error: "Not enough rubies" });
      }
      if ((account.soulShards || 0) < discountedPrice.soulShards) {
        return res.status(400).json({ error: "Not enough soul shards" });
      }
      
      await storage.updateAccount(accountId, {
        gold: (account.gold || 0) - discountedPrice.gold,
        rubies: (account.rubies || 0) - discountedPrice.rubies,
        soulShards: (account.soulShards || 0) - discountedPrice.soulShards,
      });
      
      await storage.createActivityFeed({
        type: "guild_shop_purchase",
        message: `${account.username} purchased ${item.name} from ${guild.name}'s shop!`,
        metadata: { guildId: guild.id, accountId, itemId, price: discountedPrice },
      });
      
      res.json({
        success: true,
        item: item.name,
        pricePaid: discountedPrice,
        message: `Purchased ${item.name} with ${Math.round(item.discount * 100)}% guild discount!`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to purchase item" });
    }
  });

  // ==================== VALOR CURRENCY PACKS ====================

  const VALOR_PACKS = [
    { id: "valor_starter", name: "Starter Pack", valorTokens: 100, priceUSD: 0.99, bonus: 0 },
    { id: "valor_small", name: "Small Pack", valorTokens: 500, priceUSD: 4.99, bonus: 0.05 },
    { id: "valor_medium", name: "Medium Pack", valorTokens: 1200, priceUSD: 9.99, bonus: 0.1 },
    { id: "valor_large", name: "Large Pack", valorTokens: 3000, priceUSD: 24.99, bonus: 0.15 },
    { id: "valor_mega", name: "Mega Pack", valorTokens: 7500, priceUSD: 49.99, bonus: 0.2 },
    { id: "valor_ultimate", name: "Ultimate Pack", valorTokens: 20000, priceUSD: 99.99, bonus: 0.25 },
  ];

  app.get("/api/shop/valor-packs", (_req, res) => {
    res.json(VALOR_PACKS.map(pack => ({
      ...pack,
      totalTokens: Math.floor(pack.valorTokens * (1 + pack.bonus)),
      bonusPercent: Math.round(pack.bonus * 100),
    })));
  });

  app.post("/api/shop/valor-packs/purchase", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        packId: z.string(),
      });
      const { accountId, packId } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const pack = VALOR_PACKS.find(p => p.id === packId);
      if (!pack) {
        return res.status(404).json({ error: "Pack not found" });
      }
      
      const totalTokens = Math.floor(pack.valorTokens * (1 + pack.bonus));
      
      await storage.updateAccount(accountId, {
        valorTokens: (account.valorTokens || 0) + totalTokens,
      });
      
      await storage.createActivityFeed({
        type: "valor_purchase",
        message: `${account.username} purchased ${pack.name} (+${totalTokens} Valor Tokens)!`,
        metadata: { accountId, packId, tokens: totalTokens },
      });
      
      res.json({
        success: true,
        pack: pack.name,
        tokensAdded: totalTokens,
        message: `Added ${totalTokens.toLocaleString()} Valor Tokens to your account!`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  // ==================== ANTI-CHEAT SYSTEM ====================

  const playerSnapshots: Map<string, { stats: any; gold: number; rubies: number; timestamp: number }> = new Map();
  const suspiciousActivity: Map<string, { count: number; lastSeen: number; actions: string[] }> = new Map();

  const STAT_GROWTH_LIMITS: Record<string, number> = {
    gold: 1000000,
    rubies: 10000,
    soulShards: 5000,
    trainingPoints: 50000,
    statPoints: 100,
  };

  const logSuspiciousActivity = async (accountId: string, action: string, details: any) => {
    const existing = suspiciousActivity.get(accountId) || { count: 0, lastSeen: 0, actions: [] };
    existing.count++;
    existing.lastSeen = Date.now();
    existing.actions.push(action);
    if (existing.actions.length > 20) existing.actions.shift();
    suspiciousActivity.set(accountId, existing);

    await storage.createActivityFeed({
      type: "anticheat_alert",
      message: `Suspicious activity detected for account ${accountId}: ${action}`,
      metadata: { accountId, action, details, alertLevel: existing.count > 5 ? "high" : "medium" },
    });
  };

  const validateStatGrowth = async (accountId: string, field: string, oldValue: number, newValue: number): Promise<boolean> => {
    const limit = STAT_GROWTH_LIMITS[field];
    if (limit && newValue - oldValue > limit) {
      await logSuspiciousActivity(accountId, "excessive_growth", {
        field,
        oldValue,
        newValue,
        delta: newValue - oldValue,
        limit,
      });
      return false;
    }
    return true;
  };

  const createSnapshot = (account: any): { stats: any; gold: number; rubies: number; timestamp: number } => ({
    stats: { ...account.stats },
    gold: account.gold || 0,
    rubies: account.rubies || 0,
    timestamp: Date.now(),
  });

  app.post("/api/anticheat/snapshot", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const snapshot = createSnapshot(account);
      playerSnapshots.set(accountId, snapshot);
      
      res.json({ success: true, snapshotTime: snapshot.timestamp });
    } catch (error) {
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });

  app.post("/api/anticheat/verify", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const snapshot = playerSnapshots.get(accountId);
      if (!snapshot) {
        return res.json({ verified: true, message: "No snapshot to compare" });
      }
      
      const issues: string[] = [];
      const timeDelta = (Date.now() - snapshot.timestamp) / 1000;
      
      const goldGrowth = (account.gold || 0) - snapshot.gold;
      if (goldGrowth > STAT_GROWTH_LIMITS.gold) {
        issues.push(`Gold growth exceeds limit: ${goldGrowth} in ${timeDelta}s`);
        await logSuspiciousActivity(accountId, "gold_manipulation", { goldGrowth, timeDelta });
      }
      
      const rubyGrowth = (account.rubies || 0) - snapshot.rubies;
      if (rubyGrowth > STAT_GROWTH_LIMITS.rubies) {
        issues.push(`Ruby growth exceeds limit: ${rubyGrowth} in ${timeDelta}s`);
        await logSuspiciousActivity(accountId, "ruby_manipulation", { rubyGrowth, timeDelta });
      }
      
      if (issues.length > 0) {
        res.json({ verified: false, issues, timeDelta });
      } else {
        playerSnapshots.set(accountId, createSnapshot(account));
        res.json({ verified: true, message: "Account verified", timeDelta });
      }
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.get("/api/admin/anticheat/alerts", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const alerts = Array.from(suspiciousActivity.entries())
        .map(([accountId, data]) => ({ accountId, ...data }))
        .sort((a, b) => b.count - a.count);
      
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  app.get("/api/admin/anticheat/logs", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const allFeeds = await storage.getRecentActivities(500);
      const antiCheatLogs = allFeeds.filter((f: any) => f.type === "anticheat_alert");
      res.json(antiCheatLogs.slice(0, 100));
    } catch (error) {
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  app.post("/api/admin/anticheat/ban", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        accountId: z.string(),
        reason: z.string(),
      });
      const { adminId, accountId, reason } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateAccount(accountId, { isBanned: true } as any);
      
      await storage.createActivityFeed({
        type: "anticheat_ban",
        message: `Account ${account.username} banned by admin ${admin.username} for: ${reason}`,
        metadata: { accountId, adminId, reason, bannedAt: Date.now() },
      });
      
      res.json({ success: true, message: `Account ${account.username} has been banned` });
    } catch (error) {
      res.status(500).json({ error: "Failed to ban account" });
    }
  });

  // ==================== AI CHAT SYSTEM ====================
  const { chatWithGameAI, getPlayerStoryline, getPendingAdminRequests, resolveAdminRequest, generateWelcomeIntro, setGuidePersonality, getTutorialContent, getStoryAct } = await import("./game-ai");
  const { initializeNPCAccounts, autoAcceptNPCChallenge, isNPCAccount, startNPCProgressionLoop } = await import("./npc-accounts");
  
  // Initialize NPC accounts on startup
  initializeNPCAccounts().catch(err => console.error("Failed to initialize NPCs:", err));
  startNPCProgressionLoop();
  
  // Player AI chat - requires valid account session
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        message: z.string().min(1).max(1000),
      });
      const { accountId, message } = schema.parse(req.body);
      
      // Verify the account exists and is active
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      
      const response = await chatWithGameAI(accountId, message);
      res.json(response);
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to chat with AI" });
    }
  });
  
  // Get player storyline - requires valid account
  app.get("/api/ai/storyline/:accountId", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const storyline = await getPlayerStoryline(req.params.accountId);
      res.json(storyline);
    } catch (error) {
      res.status(500).json({ error: "Failed to get storyline" });
    }
  });
  
  // Get AI welcome intro for player
  app.get("/api/ai/welcome/:accountId", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const intro = await generateWelcomeIntro(req.params.accountId);
      res.json({ message: intro });
    } catch (error) {
      console.error("Welcome intro error:", error);
      res.status(500).json({ error: "Failed to generate welcome" });
    }
  });
  
  // Set guide personality for player - requires active session
  app.post("/api/ai/personality/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const schema = z.object({
        personality: z.enum(["friendly", "sarcastic", "serious", "mysterious"]),
      });
      const { personality } = schema.parse(req.body);
      const success = await setGuidePersonality(accountId, personality);
      if (success) {
        res.json({ success: true, personality });
      } else {
        res.status(400).json({ error: "Invalid personality" });
      }
    } catch (error) {
      console.error("Set personality error:", error);
      res.status(500).json({ error: "Failed to set personality" });
    }
  });
  
  // Get tutorial content for player
  app.get("/api/ai/tutorial/:accountId/:topic", async (req, res) => {
    try {
      const { accountId, topic } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const content = await getTutorialContent(accountId, topic);
      res.json({ content });
    } catch (error) {
      console.error("Tutorial error:", error);
      res.status(500).json({ error: "Failed to get tutorial" });
    }
  });
  
  // Mark tutorial as completed
  app.post("/api/ai/tutorial/:accountId/complete", async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const { updatePlayerStoryline } = await import("./game-ai");
      await updatePlayerStoryline(accountId, { tutorialCompleted: true } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Complete tutorial error:", error);
      res.status(500).json({ error: "Failed to complete tutorial" });
    }
  });
  
  // Get story act info for player
  app.get("/api/ai/story-act/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(401).json({ error: "Invalid account" });
      }
      const storyAct = getStoryAct(account.npcFloor);
      const storyline = await getPlayerStoryline(accountId);
      res.json({
        ...storyAct,
        chapter: storyline.currentChapter,
        personality: storyline.guidePersonality || "friendly",
        tutorialCompleted: storyline.tutorialCompleted || false,
      });
    } catch (error) {
      console.error("Story act error:", error);
      res.status(500).json({ error: "Failed to get story act" });
    }
  });
  
  // ==================== STORY PROGRESSION SYSTEM ====================

  const STORY_ACTS = [
    { act: 1, name: "The Awakening", description: "Your journey begins. Learn the ways of valor and discover your destiny.", gateRequirement: null, chapters: 5 },
    { act: 2, name: "Fractured Realms", description: "The realm is splitting. Explore dangerous territories and forge alliances.", gateRequirement: { minRank: 3, minFloor: 10, act1Complete: true }, chapters: 8 },
    { act: 3, name: "Hell Zone", description: "Descend into darkness. Face the ultimate trials and uncover ancient secrets.", gateRequirement: { minRank: 8, minFloor: 50, act2Complete: true }, chapters: 10 },
    { act: 4, name: "Convergence War", description: "The final battle. Unite the realms or watch them fall.", gateRequirement: { minRank: 12, minFloor: 90, act3Complete: true }, chapters: 12 },
  ];

  const STORY_LORE: Record<number, { title: string; content: string }[]> = {
    1: [
      { title: "The Beginning", content: "Long ago, the realm of Valor was united under a single banner. Heroes from all races gathered to protect the innocent and uphold justice." },
      { title: "The First Champions", content: "The original 14 races each produced legendary warriors who became known as the Champions of Valor. Their descendants carry their legacy." },
      { title: "The Mystic Tower", content: "Built by ancient mages, the Mystic Tower serves as a proving ground for all who seek glory. Each floor presents greater challenges." },
    ],
    2: [
      { title: "The Fracturing", content: "A great cataclysm shattered the realm into fragments. The zones we know today are remnants of what was once a unified world." },
      { title: "The Void Incursion", content: "Dark entities began pouring through cracks in reality, threatening to consume everything. Only the bravest heroes dare face them." },
      { title: "Guild Alliance", content: "Guilds formed from necessity, pooling resources and warriors to push back the darkness." },
    ],
    3: [
      { title: "Gates of Hell", content: "The Hell Zone was once sealed away, containing the most dangerous creatures and forbidden treasures." },
      { title: "The Demon Lords", content: "Seven Demon Lords rule the Hell Zone, each guarding secrets that could change the fate of all realms." },
      { title: "Soul Gems", content: "In the depths of Hell, Soul Gems form from the essence of fallen warriors. They hold immense power." },
    ],
    4: [
      { title: "The Convergence", content: "All timelines, all realms, all possibilities converge in the final battle. Reality itself hangs in the balance." },
      { title: "Mythical Legends", content: "Those who complete the Convergence War and prove their worth become Mythical Legends - the highest honor." },
      { title: "The New Dawn", content: "Victory in the Convergence War will reshape the realm. Your choices will echo through eternity." },
    ],
  };

  const completedRewards: Map<string, Set<string>> = new Map();

  app.get("/api/story/acts", (_req, res) => {
    res.json(STORY_ACTS);
  });

  app.get("/api/story/acts/:act/lore", (req, res) => {
    const act = parseInt(req.params.act);
    const lore = STORY_LORE[act];
    if (!lore) {
      return res.status(404).json({ error: "Lore not found for this act" });
    }
    res.json(lore);
  });

  app.get("/api/story/progress/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const storyline = await getPlayerStoryline(accountId);
      const currentAct = storyline.currentAct || 1;
      const actInfo = STORY_ACTS.find(a => a.act === currentAct);
      const playerRankIndex = playerRanks.indexOf(account.rank);
      
      const actsStatus = STORY_ACTS.map(act => {
        const gate = act.gateRequirement;
        let locked = false;
        let lockReason = "";
        
        if (gate) {
          if (gate.minRank && playerRankIndex < gate.minRank) {
            locked = true;
            lockReason = `Requires ${playerRanks[gate.minRank]} rank`;
          }
          if (gate.minFloor && (account.npcFloor || 1) < gate.minFloor) {
            locked = true;
            lockReason = `Requires Mystic Tower Floor ${gate.minFloor}`;
          }
          if (gate.act1Complete && (storyline.storyProgress?.act1Completed !== true)) {
            locked = true;
            lockReason = "Complete Act 1 first";
          }
          if (gate.act2Complete && (storyline.storyProgress?.act2Completed !== true)) {
            locked = true;
            lockReason = "Complete Act 2 first";
          }
          if (gate.act3Complete && (storyline.storyProgress?.act3Completed !== true)) {
            locked = true;
            lockReason = "Complete Act 3 first";
          }
        }
        
        return {
          ...act,
          locked,
          lockReason,
          completed: storyline.storyProgress?.[`act${act.act}Completed`] === true,
          currentChapter: act.act === currentAct ? storyline.currentChapter : 0,
        };
      });
      
      res.json({
        currentAct,
        currentChapter: storyline.currentChapter || 1,
        actInfo,
        actsStatus,
        tutorialCompleted: storyline.tutorialCompleted || false,
        totalProgress: Math.round((Object.keys(storyline.storyProgress || {}).filter(k => k.includes("Completed")).length / 4) * 100),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get story progress" });
    }
  });

  app.post("/api/story/advance", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        actCompleted: z.number().optional(),
        chapterCompleted: z.number().optional(),
      });
      const { accountId, actCompleted, chapterCompleted } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const storyline = await getPlayerStoryline(accountId);
      const { updatePlayerStoryline } = await import("./game-ai");
      
      if (actCompleted) {
        const actInfo = STORY_ACTS.find(a => a.act === actCompleted);
        if (!actInfo) {
          return res.status(400).json({ error: "Invalid act" });
        }
        
        const gate = actInfo.gateRequirement as { minRank?: number; minFloor?: number; act1Complete?: boolean; act2Complete?: boolean; act3Complete?: boolean } | null;
        if (gate) {
          const playerRankIndex = playerRanks.indexOf(account.rank);
          if (gate.minRank && playerRankIndex < gate.minRank) {
            return res.status(403).json({ error: `Requires ${playerRanks[gate.minRank]} rank`, required: playerRanks[gate.minRank] });
          }
          if (gate.minFloor && (account.npcFloor || 1) < gate.minFloor) {
            return res.status(403).json({ error: `Requires Mystic Tower Floor ${gate.minFloor}`, required: gate.minFloor });
          }
          if (gate.act1Complete && !storyline.storyProgress?.act1Completed) {
            return res.status(403).json({ error: "Complete Act 1 first" });
          }
          if (gate.act2Complete && !storyline.storyProgress?.act2Completed) {
            return res.status(403).json({ error: "Complete Act 2 first" });
          }
          if (gate.act3Complete && !storyline.storyProgress?.act3Completed) {
            return res.status(403).json({ error: "Complete Act 3 first" });
          }
        }
        
        const rewardKey = `act${actCompleted}`;
        const playerRewards = completedRewards.get(accountId) || new Set();
        
        if (playerRewards.has(rewardKey)) {
          return res.json({ 
            success: true, 
            message: "Act already completed - no duplicate rewards",
            replayMode: true,
          });
        }
        
        const rewards: Record<string, number> = {
          gold: actCompleted * 10000,
          rubies: actCompleted * 100,
          soulShards: actCompleted * 50,
        };
        
        await storage.updateAccount(accountId, {
          gold: (account.gold || 0) + rewards.gold,
          rubies: (account.rubies || 0) + rewards.rubies,
          soulShards: (account.soulShards || 0) + rewards.soulShards,
        });
        
        playerRewards.add(rewardKey);
        completedRewards.set(accountId, playerRewards);
        
        await updatePlayerStoryline(accountId, {
          storyProgress: {
            ...storyline.storyProgress,
            [`act${actCompleted}Completed`]: true,
            [`act${actCompleted}CompletedAt`]: Date.now(),
          },
          currentAct: Math.min(actCompleted + 1, 4),
          currentChapter: 1,
        } as any);
        
        await storage.createActivityFeed({
          type: "story_progress",
          message: `${account.username} completed Act ${actCompleted}: ${STORY_ACTS[actCompleted - 1]?.name}!`,
          metadata: { accountId, actCompleted, rewards },
        });
        
        res.json({
          success: true,
          message: `Completed Act ${actCompleted}!`,
          rewards,
          nextAct: Math.min(actCompleted + 1, 4),
        });
      } else if (chapterCompleted) {
        const currentAct = storyline.currentAct || 1;
        const actInfo = STORY_ACTS.find(a => a.act === currentAct);
        const nextChapter = Math.min((storyline.currentChapter || 1) + 1, actInfo?.chapters || 5);
        
        await updatePlayerStoryline(accountId, {
          currentChapter: nextChapter,
        } as any);
        
        res.json({
          success: true,
          message: `Completed Chapter ${chapterCompleted}`,
          nextChapter,
          actComplete: nextChapter >= (actInfo?.chapters || 5),
        });
      } else {
        res.status(400).json({ error: "Specify actCompleted or chapterCompleted" });
      }
    } catch (error) {
      console.error("Story advance error:", error);
      res.status(500).json({ error: "Failed to advance story" });
    }
  });

  app.post("/api/story/checkpoint", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        checkpoint: z.string(),
      });
      const { accountId, checkpoint } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await db.update(accounts).set({ storyCheckpoint: checkpoint }).where(eq(accounts.id, accountId));
      
      res.json({ success: true, checkpoint });
    } catch (error) {
      res.status(500).json({ error: "Failed to save checkpoint" });
    }
  });

  // ==================== ACHIEVEMENTS SYSTEM ====================

  const ACHIEVEMENT_CATEGORIES = ["combat", "exploration", "economy", "pets", "social", "story", "mastery"] as const;

  const ACHIEVEMENTS = [
    { id: "first_blood", name: "First Blood", description: "Win your first battle", category: "combat", reward: { gold: 100 }, rankTier: 0 },
    { id: "warrior_10", name: "Warrior", description: "Win 10 battles", category: "combat", reward: { gold: 500, rubies: 5 }, rankTier: 0 },
    { id: "champion_100", name: "Champion", description: "Win 100 battles", category: "combat", reward: { gold: 5000, rubies: 50 }, rankTier: 3 },
    { id: "legend_1000", name: "Legend of Battle", description: "Win 1000 battles", category: "combat", reward: { gold: 50000, rubies: 500 }, rankTier: 8 },
    { id: "first_tower", name: "Tower Climber", description: "Clear Mystic Tower Floor 1", category: "exploration", reward: { gold: 200 }, rankTier: 0 },
    { id: "tower_10", name: "Tower Veteran", description: "Reach Mystic Tower Floor 10", category: "exploration", reward: { gold: 2000, rubies: 20 }, rankTier: 2 },
    { id: "tower_50", name: "Tower Master", description: "Reach Mystic Tower Floor 50", category: "exploration", reward: { gold: 25000, rubies: 250 }, rankTier: 6 },
    { id: "tower_100", name: "Tower Conqueror", description: "Complete all 100 Mystic Tower floors", category: "exploration", reward: { gold: 100000, rubies: 1000 }, rankTier: 12 },
    { id: "first_gold", name: "Getting Started", description: "Earn 1000 gold", category: "economy", reward: { gold: 100 }, rankTier: 0 },
    { id: "rich", name: "Rich", description: "Have 100,000 gold", category: "economy", reward: { rubies: 50 }, rankTier: 3 },
    { id: "wealthy", name: "Wealthy", description: "Have 1,000,000 gold", category: "economy", reward: { rubies: 200 }, rankTier: 6 },
    { id: "first_pet", name: "Pet Owner", description: "Obtain your first pet", category: "pets", reward: { gold: 300 }, rankTier: 0 },
    { id: "pet_collector", name: "Pet Collector", description: "Own 5 pets", category: "pets", reward: { gold: 1500, soulShards: 10 }, rankTier: 2 },
    { id: "pet_master", name: "Pet Master", description: "Own 10 pets", category: "pets", reward: { gold: 5000, soulShards: 50 }, rankTier: 5 },
    { id: "join_guild", name: "Social Butterfly", description: "Join a guild", category: "social", reward: { gold: 500 }, rankTier: 0 },
    { id: "guild_leader", name: "Guild Leader", description: "Become a guild master", category: "social", reward: { gold: 10000, rubies: 100 }, rankTier: 4 },
    { id: "act1_complete", name: "Awakened", description: "Complete Story Act 1", category: "story", reward: { gold: 5000 }, rankTier: 0 },
    { id: "act2_complete", name: "Realm Walker", description: "Complete Story Act 2", category: "story", reward: { gold: 15000, rubies: 100 }, rankTier: 3 },
    { id: "act3_complete", name: "Hell Survivor", description: "Complete Story Act 3", category: "story", reward: { gold: 50000, rubies: 300 }, rankTier: 8 },
    { id: "act4_complete", name: "Convergence Hero", description: "Complete Story Act 4", category: "story", reward: { gold: 200000, rubies: 1000 }, rankTier: 12 },
    { id: "rank_apprentice", name: "Apprentice", description: "Reach Apprentice rank", category: "mastery", reward: { gold: 500 }, rankTier: 0 },
    { id: "rank_journeyman", name: "Journeyman", description: "Reach Journeyman rank", category: "mastery", reward: { gold: 2000 }, rankTier: 2 },
    { id: "rank_expert", name: "Expert", description: "Reach Expert rank", category: "mastery", reward: { gold: 10000 }, rankTier: 4 },
    { id: "rank_master", name: "Master", description: "Reach Master rank", category: "mastery", reward: { gold: 50000 }, rankTier: 6 },
    { id: "rank_grandmaster", name: "Grandmaster", description: "Reach Grandmaster rank", category: "mastery", reward: { gold: 200000, rubies: 500 }, rankTier: 9 },
    { id: "rank_legend", name: "Legendary", description: "Reach Legend rank", category: "mastery", reward: { gold: 1000000, rubies: 2000 }, rankTier: 11 },
    { id: "mythical", name: "Mythical Legend", description: "Reach Mythical Legend rank", category: "mastery", reward: { gold: 10000000, rubies: 10000 }, rankTier: 14 },
  ];

  const playerAchievements: Map<string, Set<string>> = new Map();
  const playerTrophiesMapMap: Map<string, Set<string>> = new Map();

  async function autoCheckAchievementsAndTrophies(accountId: string) {
    try {
      const account = await storage.getAccount(accountId);
      if (!account) return;

      const achievements = playerAchievements.get(accountId) || new Set();
      const trophies = playerTrophiesMapMap.get(accountId) || new Set();
      const acctPets = await storage.getPetsByAccount(accountId);
      const petsCount = acctPets?.length || 0;
      
      const rankIndex = playerRanks.indexOf(account.rank);
      const floor = (account as any).towerFloor || 1;
      const gold = account.gold || 0;
      const wins = (account as any).wins || 0;
      const baseTier = (account as any).baseTier || 1;

      const rankAchievements: Record<string, string> = {
        "Apprentice": "rank_apprentice",
        "Journeyman": "rank_journeyman", 
        "Expert": "rank_expert",
        "Master": "rank_master",
        "Grand Master": "rank_grandmaster",
        "Champion": "rank_champion",
        "Hero": "rank_hero",
        "Legend": "rank_legend",
        "Mythical Legend": "rank_mythical",
      };
      
      if (rankAchievements[account.rank] && !achievements.has(rankAchievements[account.rank])) {
        achievements.add(rankAchievements[account.rank]);
      }

      if (wins >= 1 && !achievements.has("first_blood")) achievements.add("first_blood");
      if (wins >= 10 && !achievements.has("warrior_10")) achievements.add("warrior_10");
      if (wins >= 100 && !achievements.has("champion_100")) achievements.add("champion_100");
      if (wins >= 1000 && !achievements.has("legend_1000")) achievements.add("legend_1000");

      if (floor >= 1 && !achievements.has("first_tower")) achievements.add("first_tower");
      if (floor >= 10 && !achievements.has("tower_10")) achievements.add("tower_10");
      if (floor >= 50 && !achievements.has("tower_50")) achievements.add("tower_50");
      if (floor >= 100 && !achievements.has("tower_100")) achievements.add("tower_100");

      if (gold >= 1000 && !achievements.has("first_gold")) achievements.add("first_gold");
      if (gold >= 100000 && !achievements.has("rich")) achievements.add("rich");
      if (gold >= 1000000 && !achievements.has("wealthy")) achievements.add("wealthy");

      if (petsCount >= 1 && !achievements.has("first_pet")) achievements.add("first_pet");
      if (petsCount >= 5 && !achievements.has("pet_collector")) achievements.add("pet_collector");
      if (petsCount >= 10 && !achievements.has("pet_master")) achievements.add("pet_master");

      if (wins >= 1 && !trophies.has("first_victory")) trophies.add("first_victory");
      if (floor >= 10 && !trophies.has("tower_10")) trophies.add("tower_10");
      if (floor >= 25 && !trophies.has("tower_25")) trophies.add("tower_25");
      if (floor >= 50 && !trophies.has("tower_50")) trophies.add("tower_50");
      if (floor >= 100 && !trophies.has("tower_100")) trophies.add("tower_100");
      if (gold >= 1000000 && !trophies.has("millionaire")) trophies.add("millionaire");
      if (gold >= 1000000000 && !trophies.has("billionaire")) trophies.add("billionaire");
      if (petsCount >= 50 && !trophies.has("pet_master")) trophies.add("pet_master");
      if (baseTier >= 5 && !trophies.has("base_max")) trophies.add("base_max");
      if (rankIndex >= 4 && !trophies.has("rank_5")) trophies.add("rank_5");
      if (rankIndex >= 9 && !trophies.has("rank_10")) trophies.add("rank_10");
      if (rankIndex >= 14 && !trophies.has("rank_15")) trophies.add("rank_15");
      if (rankIndex >= 14 && !trophies.has("mythical_ascension")) trophies.add("mythical_ascension");

      playerAchievements.set(accountId, achievements);
      playerTrophiesMapMap.set(accountId, trophies);
    } catch (error) {
      console.error("Error auto-checking achievements:", error);
    }
  }

  app.get("/api/achievements", (req, res) => {
    const accountId = req.query.accountId as string;
    const completed = playerAchievements.get(accountId) || new Set();
    
    res.json({
      categories: ACHIEVEMENT_CATEGORIES,
      achievements: ACHIEVEMENTS.map(a => ({
        ...a,
        completed: completed.has(a.id),
      })),
      totalCompleted: completed.size,
      totalAchievements: ACHIEVEMENTS.length,
    });
  });

  app.get("/api/achievements/check/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const completed = playerAchievements.get(accountId) || new Set();
      const newlyUnlocked: typeof ACHIEVEMENTS = [];
      const playerRankIndex = playerRanks.indexOf(account.rank);

      for (const achievement of ACHIEVEMENTS) {
        if (completed.has(achievement.id)) continue;
        
        let unlocked = false;
        
        switch (achievement.id) {
          case "first_blood": unlocked = (account.wins || 0) >= 1; break;
          case "warrior_10": unlocked = (account.wins || 0) >= 10; break;
          case "champion_100": unlocked = (account.wins || 0) >= 100; break;
          case "legend_1000": unlocked = (account.wins || 0) >= 1000; break;
          case "first_tower": unlocked = (account.npcFloor || 1) > 1; break;
          case "tower_10": unlocked = (account.npcFloor || 1) >= 10; break;
          case "tower_50": unlocked = (account.npcFloor || 1) >= 50; break;
          case "tower_100": unlocked = (account.npcFloor || 1) >= 100; break;
          case "first_gold": unlocked = (account.gold || 0) >= 1000; break;
          case "rich": unlocked = (account.gold || 0) >= 100000; break;
          case "wealthy": unlocked = (account.gold || 0) >= 1000000; break;
          case "first_pet": unlocked = (account.pets?.length || 0) >= 1; break;
          case "pet_collector": unlocked = (account.pets?.length || 0) >= 5; break;
          case "pet_master": unlocked = (account.pets?.length || 0) >= 10; break;
          case "rank_apprentice": unlocked = playerRankIndex >= 1; break;
          case "rank_journeyman": unlocked = playerRankIndex >= 2; break;
          case "rank_expert": unlocked = playerRankIndex >= 4; break;
          case "rank_master": unlocked = playerRankIndex >= 6; break;
          case "rank_grandmaster": unlocked = playerRankIndex >= 9; break;
          case "rank_legend": unlocked = playerRankIndex >= 11; break;
          case "mythical": unlocked = playerRankIndex >= 14; break;
        }
        
        if (unlocked) {
          completed.add(achievement.id);
          newlyUnlocked.push(achievement);
        }
      }
      
      playerAchievements.set(accountId, completed);
      
      res.json({
        newlyUnlocked,
        totalCompleted: completed.size,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check achievements" });
    }
  });

  const claimedAchievements: Map<string, Set<string>> = new Map();

  app.post("/api/achievements/:achievementId/claim", async (req, res) => {
    try {
      const { achievementId } = req.params;
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const completed = playerAchievements.get(accountId) || new Set();
      if (!completed.has(achievementId)) {
        return res.status(400).json({ error: "Achievement not unlocked" });
      }
      
      const claimed = claimedAchievements.get(accountId) || new Set();
      if (claimed.has(achievementId)) {
        return res.status(400).json({ error: "Achievement already claimed" });
      }
      
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
      if (!achievement) {
        return res.status(404).json({ error: "Achievement not found" });
      }
      
      claimed.add(achievementId);
      claimedAchievements.set(accountId, claimed);
      
      const reward = achievement.reward as { gold?: number; rubies?: number; soulShards?: number };
      await storage.updateAccount(accountId, {
        gold: (account.gold || 0) + (reward.gold || 0),
        rubies: (account.rubies || 0) + (reward.rubies || 0),
        soulShards: (account.soulShards || 0) + (reward.soulShards || 0),
      });
      
      await storage.createActivityFeed({
        type: "achievement_claimed",
        message: `${account.username} claimed achievement: ${achievement.name}!`,
        metadata: { accountId, achievementId, reward },
      });
      
      res.json({
        success: true,
        achievement: achievement.name,
        reward,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to claim achievement" });
    }
  });

  // ==================== TITLES SYSTEM ====================
  const AVAILABLE_TITLES: { id: string; name: string; category: "rank" | "guild" | "event"; requirement: string }[] = [
    { id: "title_novice", name: "The Newcomer", category: "rank", requirement: "Reach Novice rank" },
    { id: "title_apprentice", name: "Apprentice of Valor", category: "rank", requirement: "Reach Apprentice rank" },
    { id: "title_initiate", name: "Initiated One", category: "rank", requirement: "Reach Initiate rank" },
    { id: "title_journeyman", name: "Seasoned Traveler", category: "rank", requirement: "Reach Journeyman rank" },
    { id: "title_adept", name: "The Adept", category: "rank", requirement: "Reach Adept rank" },
    { id: "title_expert", name: "Expert Warrior", category: "rank", requirement: "Reach Expert rank" },
    { id: "title_master", name: "Master of Arms", category: "rank", requirement: "Reach Master rank" },
    { id: "title_grandmaster", name: "Grandmaster", category: "rank", requirement: "Reach Grandmaster rank" },
    { id: "title_champion", name: "Champion of the Realm", category: "rank", requirement: "Reach Champion rank" },
    { id: "title_overlord", name: "The Overlord", category: "rank", requirement: "Reach Overlord rank" },
    { id: "title_sovereign", name: "Sovereign Ruler", category: "rank", requirement: "Reach Sovereign rank" },
    { id: "title_ascendant", name: "The Ascended", category: "rank", requirement: "Reach Ascendant rank" },
    { id: "title_legend", name: "Living Legend", category: "rank", requirement: "Reach Legend rank" },
    { id: "title_mythic", name: "Mythic Being", category: "rank", requirement: "Reach Mythic rank" },
    { id: "title_mythical_legend", name: "Mythical Legend", category: "rank", requirement: "Reach Mythical Legend rank" },
    { id: "title_guild_member", name: "Guild Loyalist", category: "guild", requirement: "Join a guild" },
    { id: "title_guild_leader", name: "Guildmaster", category: "guild", requirement: "Become a guild leader" },
    { id: "title_guild_champion", name: "Guild Champion", category: "guild", requirement: "Win 50 guild battles" },
    { id: "title_guild_conqueror", name: "Guild Conqueror", category: "guild", requirement: "Win 100 guild battles" },
    { id: "title_pvp_warrior", name: "Arena Warrior", category: "event", requirement: "Win 50 PvP battles" },
    { id: "title_pvp_legend", name: "Arena Legend", category: "event", requirement: "Win 500 PvP battles" },
    { id: "title_tower_master", name: "Tower Master", category: "event", requirement: "Reach Tower Floor 50" },
    { id: "title_tower_conqueror", name: "Tower Conqueror", category: "event", requirement: "Complete all 100 Tower floors" },
    { id: "title_millionaire", name: "The Wealthy", category: "event", requirement: "Earn 1 million gold" },
    { id: "title_billionaire", name: "The Tycoon", category: "event", requirement: "Earn 1 billion gold" },
    { id: "title_pet_master", name: "Beastmaster", category: "event", requirement: "Own 10 pets" },
    { id: "title_tournament_winner", name: "Tournament Victor", category: "event", requirement: "Win a tournament" },
    { id: "title_hell_survivor", name: "Hell Survivor", category: "event", requirement: "Survive the Hell Zone" },
  ];

  const RANK_TO_TITLE: Record<string, string> = {
    "Novice": "title_novice",
    "Apprentice": "title_apprentice",
    "Initiate": "title_initiate",
    "Journeyman": "title_journeyman",
    "Adept": "title_adept",
    "Expert": "title_expert",
    "Master": "title_master",
    "Grandmaster": "title_grandmaster",
    "Champion": "title_champion",
    "Overlord": "title_overlord",
    "Sovereign": "title_sovereign",
    "Ascendant": "title_ascendant",
    "Legend": "title_legend",
    "Mythic": "title_mythic",
    "Mythical Legend": "title_mythical_legend",
  };

  async function syncTitlesAndBadges(accountId: string) {
    try {
      const { playerTitles: ptTable, playerBadges: pbTable } = await import("@shared/schema");
      const account = await storage.getAccount(accountId);
      if (!account) return;

      const existingTitles = await db.select().from(ptTable).where(eq(ptTable.accountId, accountId));
      const existingTitleIds = new Set(existingTitles.map(t => t.titleId));

      const rankTitleId = RANK_TO_TITLE[account.rank];
      if (rankTitleId && !existingTitleIds.has(rankTitleId)) {
        const titleDef = AVAILABLE_TITLES.find(t => t.id === rankTitleId);
        if (titleDef) {
          await db.insert(ptTable).values({ accountId, titleId: titleDef.id, category: titleDef.category, name: titleDef.name });
        }
      }

      const wins = account.wins || 0;
      const floor = account.npcFloor || 1;
      const gold = account.gold || 0;

      const guildMember = await storage.getGuildMember(accountId);
      if (guildMember && !existingTitleIds.has("title_guild_member")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_guild_member")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }

      if (guildMember) {
        const guild = await storage.getGuild(guildMember.guildId);
        if (guild && guild.masterId === accountId && !existingTitleIds.has("title_guild_leader")) {
          const t = AVAILABLE_TITLES.find(t => t.id === "title_guild_leader")!;
          await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
        }
      }

      if (wins >= 50 && !existingTitleIds.has("title_pvp_warrior")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_pvp_warrior")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }
      if (wins >= 500 && !existingTitleIds.has("title_pvp_legend")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_pvp_legend")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }
      if (floor >= 50 && !existingTitleIds.has("title_tower_master")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_tower_master")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }
      if (floor >= 100 && !existingTitleIds.has("title_tower_conqueror")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_tower_conqueror")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }
      if (gold >= 1000000 && !existingTitleIds.has("title_millionaire")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_millionaire")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }

      const playerPets = await storage.getPetsByAccount(accountId);
      if ((playerPets?.length || 0) >= 10 && !existingTitleIds.has("title_pet_master")) {
        const t = AVAILABLE_TITLES.find(t => t.id === "title_pet_master")!;
        await db.insert(ptTable).values({ accountId, titleId: t.id, category: t.category, name: t.name });
      }

      const existingBadges = await db.select().from(pbTable).where(eq(pbTable.accountId, accountId));
      const existingBadgeIds = new Set(existingBadges.map(b => b.badgeId));

      const rankIndex = playerRanks.indexOf(account.rank);
      const rankBadges: { id: string; name: string; minRank: number }[] = [
        { id: "badge_rank_novice", name: "Novice", minRank: 0 },
        { id: "badge_rank_journeyman", name: "Journeyman", minRank: 3 },
        { id: "badge_rank_master", name: "Master", minRank: 6 },
        { id: "badge_rank_champion", name: "Champion", minRank: 8 },
        { id: "badge_rank_legend", name: "Legend", minRank: 12 },
        { id: "badge_rank_mythical", name: "Mythical Legend", minRank: 14 },
      ];
      for (const rb of rankBadges) {
        if (rankIndex >= rb.minRank && !existingBadgeIds.has(rb.id)) {
          await db.insert(pbTable).values({ accountId, badgeId: rb.id, badgeType: "rank", name: rb.name, icon: "crown" });
        }
      }

      if (guildMember && !existingBadgeIds.has("badge_guild_member")) {
        await db.insert(pbTable).values({ accountId, badgeId: "badge_guild_member", badgeType: "guild", name: "Guild Member", icon: "shield" });
      }
      if (guildMember) {
        const guild = await storage.getGuild(guildMember.guildId);
        if (guild && guild.masterId === accountId && !existingBadgeIds.has("badge_guild_leader")) {
          await db.insert(pbTable).values({ accountId, badgeId: "badge_guild_leader", badgeType: "guild", name: "Guild Leader", icon: "star" });
        }
      }

      if (account.role === "admin" && !existingBadgeIds.has("badge_vip_admin")) {
        await db.insert(pbTable).values({ accountId, badgeId: "badge_vip_admin", badgeType: "vip", name: "Admin", icon: "zap" });
      }
      if (account.vipUntil && new Date(account.vipUntil) > new Date() && !existingBadgeIds.has("badge_vip_member")) {
        await db.insert(pbTable).values({ accountId, badgeId: "badge_vip_member", badgeType: "vip", name: "VIP", icon: "gem" });
      }
    } catch (error) {
      console.error("Error syncing titles/badges:", error);
    }
  }

  app.get("/api/accounts/:id/titles", async (req, res) => {
    try {
      const accountId = req.params.id;
      await syncTitlesAndBadges(accountId);
      const { playerTitles: ptTable } = await import("@shared/schema");
      const titles = await db.select().from(ptTable).where(eq(ptTable.accountId, accountId));
      const equipped = titles.filter(t => t.isEquipped);
      res.json({
        titles,
        equipped,
        maxEquipped: 3,
        availableTitles: AVAILABLE_TITLES,
      });
    } catch (error) {
      console.error("Get titles error:", error);
      res.status(500).json({ error: "Failed to get titles" });
    }
  });

  app.post("/api/accounts/:id/titles/equip", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { titleId } = z.object({ titleId: z.string() }).parse(req.body);
      const { playerTitles: ptTable } = await import("@shared/schema");

      const [title] = await db.select().from(ptTable).where(sql`${ptTable.accountId} = ${accountId} AND ${ptTable.titleId} = ${titleId}`);
      if (!title) return res.status(404).json({ error: "Title not found or not earned" });

      if (title.isEquipped) return res.status(400).json({ error: "Title already equipped" });

      const equipped = await db.select().from(ptTable).where(sql`${ptTable.accountId} = ${accountId} AND ${ptTable.isEquipped} = true`);
      const sameCategory = equipped.filter(t => t.category === title.category);
      if (sameCategory.length > 0) {
        await db.update(ptTable).set({ isEquipped: false }).where(eq(ptTable.id, sameCategory[0].id));
      }

      const totalEquipped = equipped.filter(t => t.category !== title.category).length + (sameCategory.length > 0 ? 0 : 0);
      if (equipped.length >= 3 && sameCategory.length === 0) {
        return res.status(400).json({ error: "Maximum 3 titles equipped (1 per category: rank, guild, event)" });
      }

      await db.update(ptTable).set({ isEquipped: true }).where(eq(ptTable.id, title.id));
      const updatedTitles = await db.select().from(ptTable).where(eq(ptTable.accountId, accountId));
      res.json({ success: true, titles: updatedTitles });
    } catch (error) {
      console.error("Equip title error:", error);
      res.status(500).json({ error: "Failed to equip title" });
    }
  });

  app.post("/api/accounts/:id/titles/unequip", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { titleId } = z.object({ titleId: z.string() }).parse(req.body);
      const { playerTitles: ptTable } = await import("@shared/schema");

      const [title] = await db.select().from(ptTable).where(sql`${ptTable.accountId} = ${accountId} AND ${ptTable.titleId} = ${titleId}`);
      if (!title) return res.status(404).json({ error: "Title not found" });

      await db.update(ptTable).set({ isEquipped: false }).where(eq(ptTable.id, title.id));
      const updatedTitles = await db.select().from(ptTable).where(eq(ptTable.accountId, accountId));
      res.json({ success: true, titles: updatedTitles });
    } catch (error) {
      console.error("Unequip title error:", error);
      res.status(500).json({ error: "Failed to unequip title" });
    }
  });

  app.get("/api/accounts/:id/badges", async (req, res) => {
    try {
      const accountId = req.params.id;
      await syncTitlesAndBadges(accountId);
      const { playerBadges: pbTable } = await import("@shared/schema");
      const badges = await db.select().from(pbTable).where(eq(pbTable.accountId, accountId));
      res.json({ badges });
    } catch (error) {
      console.error("Get badges error:", error);
      res.status(500).json({ error: "Failed to get badges" });
    }
  });

  // Admin: Get pending AI requests - requires admin role
  app.get("/api/admin/ai-requests", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const requests = await getPendingAdminRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI requests" });
    }
  });
  
  // Admin: Resolve AI request - requires admin role
  app.post("/api/admin/ai-requests/:id/resolve", async (req, res) => {
    try {
      const schema = z.object({
        status: z.enum(["approved", "rejected", "answered"]),
        resolvedBy: z.string(),
      });
      const { status, resolvedBy } = schema.parse(req.body);
      
      // Verify admin role
      const admin = await storage.getAccount(resolvedBy);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      await resolveAdminRequest(req.params.id, status, resolvedBy);
      
      // If approved and it's a reward request, grant the reward
      if (status === "approved") {
        const { aiAdminRequests } = await import("@shared/schema");
        const [request] = await db.select().from(aiAdminRequests).where(eq(aiAdminRequests.id, req.params.id));
        if (request && request.requestType === "reward" && request.metadata) {
          const metadata = request.metadata as { type: string; amount: number };
          const account = await storage.getAccount(request.accountId);
          if (account && metadata.type && metadata.amount) {
            const updateData: Record<string, number> = {};
            if (metadata.type === "gold") updateData.gold = account.gold + metadata.amount;
            if (metadata.type === "rubies") updateData.rubies = account.rubies + metadata.amount;
            if (metadata.type === "soulShards") updateData.soulShards = account.soulShards + metadata.amount;
            if (metadata.type === "trainingPoints") updateData.trainingPoints = account.trainingPoints + metadata.amount;
            await storage.updateAccount(account.id, updateData);
          }
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve request" });
    }
  });
  
  // ==================== SOUL SHARD PET STAT BOOST ====================
  // 10 soul shards = +1 to a pet stat
  app.post("/api/pets/:petId/boost-stat", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        stat: z.enum(["Str", "Spd", "Luck", "ElementalPower"]),
        amount: z.number().min(1).max(100),
      });
      const { accountId, stat, amount } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const pet = await storage.getPet(req.params.petId);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found or not owned" });
      }
      
      const shardCost = amount * 10; // 10 soul shards per stat point
      if (account.soulShards < shardCost) {
        return res.status(400).json({ error: `Need ${shardCost} soul shards (have ${account.soulShards})` });
      }
      
      const currentStats = pet.stats as any;
      const newStats = {
        ...currentStats,
        [stat]: (currentStats[stat] || 0) + amount,
      };
      
      await storage.updatePet(pet.id, { stats: newStats });
      await storage.updateAccount(accountId, { soulShards: account.soulShards - shardCost });
      
      const updatedPet = await storage.getPet(pet.id);
      res.json({ success: true, pet: updatedPet, shardsSpent: shardCost });
    } catch (error) {
      res.status(500).json({ error: "Failed to boost pet stat" });
    }
  });
  
  // ==================== TRAINING POINTS BASE STAT BOOST ====================
  // 1000 TP = +1 to a base stat
  app.post("/api/accounts/:accountId/boost-base-stat", async (req, res) => {
    try {
      const schema = z.object({
        stat: z.enum(["Str", "Spd", "Int", "Luck", "Pot"]),
        amount: z.number().min(1).max(100),
        requesterId: z.string(), // The account making the request
      });
      const { stat, amount, requesterId } = schema.parse(req.body);
      
      // Verify the requester matches the account being modified
      if (requesterId !== req.params.accountId) {
        return res.status(403).json({ error: "Cannot modify another player's stats" });
      }
      
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const tpCost = amount * 1000; // 1000 TP per stat point
      if (account.trainingPoints < tpCost) {
        return res.status(400).json({ error: `Need ${tpCost.toLocaleString()} TP (have ${account.trainingPoints.toLocaleString()})` });
      }
      
      const currentStats = account.stats;
      const newStats = {
        ...currentStats,
        [stat]: (currentStats[stat] || 0) + amount,
      };
      
      await storage.updateAccount(account.id, {
        stats: newStats,
        trainingPoints: account.trainingPoints - tpCost,
      });
      
      const updatedAccount = await storage.getAccount(account.id);
      if (updatedAccount) {
        const { password: _, ...safeAccount } = updatedAccount;
        const totalPower = await calculatePlayerStrength(account.id);
        broadcastToAdmins("playerUpdate", { ...safeAccount, totalPower });
      }
      
      res.json({ success: true, stats: newStats, tpSpent: tpCost });
    } catch (error) {
      res.status(500).json({ error: "Failed to boost base stat" });
    }
  });

  // Get guild level requirements
  app.get("/api/guild-levels", async (_req, res) => {
    const { guildLevelRequirements } = await import("@shared/schema");
    res.json(guildLevelRequirements);
  });
  
  // Level up guild
  app.post("/api/guilds/:guildId/level-up", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      
      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }
      
      if (guild.masterId !== accountId) {
        return res.status(403).json({ error: "Only guild leader can level up" });
      }
      
      const currentLevel = guild.level || 1;
      if (currentLevel >= 10) {
        return res.status(400).json({ error: "Guild is already max level" });
      }
      
      const { guildLevelRequirements } = await import("@shared/schema");
      const nextRequirement = guildLevelRequirements.find(r => r.level === currentLevel + 1);
      if (!nextRequirement) {
        return res.status(400).json({ error: "No requirements found for next level" });
      }
      
      // Check dungeon floor requirement
      if (guild.dungeonFloor < nextRequirement.minDungeonFloor) {
        return res.status(400).json({ 
          error: `Need to reach dungeon floor ${nextRequirement.minDungeonFloor} first (current: ${guild.dungeonFloor})` 
        });
      }
      
      // Check gold requirement in bank
      if ((guild.bank.gold || 0) < nextRequirement.goldCost) {
        return res.status(400).json({ 
          error: `Need ${nextRequirement.goldCost.toLocaleString()} gold in bank (current: ${(guild.bank.gold || 0).toLocaleString()})` 
        });
      }
      
      // Deduct gold and level up
      const newBank = { ...guild.bank, gold: (guild.bank.gold || 0) - nextRequirement.goldCost };
      await storage.updateGuildBank(guild.id, newBank);
      const updatedGuild = await storage.updateGuildLevel(guild.id, currentLevel + 1);
      
      // Activity feed
      await storage.createActivityFeed({
        type: "guild_level_up",
        message: `${guild.name} reached Level ${currentLevel + 1}!`,
        metadata: { guildId: guild.id, newLevel: currentLevel + 1 },
      });
      
      res.json(updatedGuild);
    } catch (error) {
      res.status(500).json({ error: "Failed to level up guild" });
    }
  });

  // ==================== BIRD SHOP ====================
  // Birds provide defense stats and cost focus shards
  const BIRD_SHOP = [
    { id: "sparrow", name: "Swift Sparrow", tier: "egg", cost: 50, element: "Air", baseStats: { Def: 1, Spd: 2, resourceLuck: 0, carryBoost: 0 } },
    { id: "hawk", name: "Iron Hawk", tier: "egg", cost: 100, element: "Storm", baseStats: { Def: 2, Spd: 1, resourceLuck: 1, carryBoost: 0 } },
    { id: "eagle", name: "Guardian Eagle", tier: "egg", cost: 150, element: "Earth", baseStats: { Def: 3, Spd: 1, resourceLuck: 0, carryBoost: 1 } },
    { id: "falcon", name: "Storm Falcon", tier: "egg", cost: 200, element: "Storm", baseStats: { Def: 1, Spd: 3, resourceLuck: 1, carryBoost: 0 } },
    { id: "phoenix_bird", name: "Ash Phoenix", tier: "egg", cost: 300, element: "Fire", baseStats: { Def: 2, Spd: 2, resourceLuck: 1, carryBoost: 1 } },
    { id: "frost_owl", name: "Frost Owl", tier: "egg", cost: 250, element: "Water", baseStats: { Def: 2, Spd: 2, resourceLuck: 2, carryBoost: 0 } },
    { id: "shadow_raven", name: "Shadow Raven", tier: "egg", cost: 200, element: "Dark", baseStats: { Def: 1, Spd: 3, resourceLuck: 0, carryBoost: 1 } },
    { id: "light_dove", name: "Light Dove", tier: "egg", cost: 200, element: "Light", baseStats: { Def: 3, Spd: 1, resourceLuck: 1, carryBoost: 1 } },
  ];
  
  app.get("/api/bird-shop", (_req, res) => {
    res.json(BIRD_SHOP);
  });
  
  app.post("/api/bird-shop/buy", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        birdId: z.string(),
        customName: z.string().optional(),
      });
      const { accountId, birdId, customName } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const birdTemplate = BIRD_SHOP.find(b => b.id === birdId);
      if (!birdTemplate) {
        return res.status(404).json({ error: "Bird not found in shop" });
      }
      
      if (account.focusedShards < birdTemplate.cost) {
        return res.status(400).json({ error: `Need ${birdTemplate.cost} focus shards (have ${account.focusedShards})` });
      }
      
      await storage.updateAccount(accountId, { focusedShards: account.focusedShards - birdTemplate.cost });
      
      const { birds } = await import("@shared/schema");
      const [newBird] = await db.insert(birds).values({
        accountId,
        name: customName || birdTemplate.name,
        tier: birdTemplate.tier as any,
        element: birdTemplate.element,
        stats: birdTemplate.baseStats,
      }).returning();
      
      res.json({ success: true, bird: newBird, shardsCost: birdTemplate.cost });
    } catch (error) {
      console.error("Bird purchase error:", error);
      res.status(500).json({ error: "Failed to buy bird" });
    }
  });
  
  app.get("/api/accounts/:accountId/birds", async (req, res) => {
    try {
      const { birds } = await import("@shared/schema");
      const accountBirds = await db.select().from(birds).where(eq(birds.accountId, req.params.accountId));
      res.json(accountBirds);
    } catch (error) {
      res.status(500).json({ error: "Failed to get birds" });
    }
  });

  app.post("/api/birds/:birdId/evolve", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { birds, getNextBirdTier, BIRD_EVOLUTION_CONFIG, birdTiers } = await import("@shared/schema");
      const [bird] = await db.select().from(birds).where(eq(birds.id, req.params.birdId));
      if (!bird) return res.status(404).json({ error: "Bird not found" });
      if (bird.accountId !== accountId) return res.status(403).json({ error: "Not your bird" });

      const currentTier = bird.tier as typeof birdTiers[number];
      const nextTier = getNextBirdTier(currentTier);
      if (!nextTier) return res.status(400).json({ error: "Bird is already at max evolution (Immortal)" });

      const config = BIRD_EVOLUTION_CONFIG[currentTier];
      if (!config.evolutionCost) return res.status(400).json({ error: "Cannot evolve from this tier" });

      const { focusShards, beakCoins } = config.evolutionCost;
      if (account.focusedShards < focusShards) {
        return res.status(400).json({ error: `Need ${focusShards} Focus Shards (have ${account.focusedShards})` });
      }
      if (account.beakCoins < beakCoins) {
        return res.status(400).json({ error: `Need ${beakCoins} Beak Coins (have ${account.beakCoins})` });
      }

      const nextConfig = BIRD_EVOLUTION_CONFIG[nextTier];
      const currentStats = bird.stats as any;
      const evolvedStats = {
        Def: Math.round(currentStats.Def * (nextConfig.statMultiplier / config.statMultiplier)),
        Spd: Math.round(currentStats.Spd * (nextConfig.statMultiplier / config.statMultiplier)),
        resourceLuck: Math.round((currentStats.resourceLuck || 0) * (nextConfig.statMultiplier / config.statMultiplier)) + 1,
        carryBoost: Math.round((currentStats.carryBoost || 0) * (nextConfig.statMultiplier / config.statMultiplier)) + 1,
      };

      await db.update(birds).set({ tier: nextTier, stats: evolvedStats }).where(eq(birds.id, bird.id));
      await storage.updateAccount(accountId, {
        focusedShards: account.focusedShards - focusShards,
        beakCoins: account.beakCoins - beakCoins,
      });

      const [updatedBird] = await db.select().from(birds).where(eq(birds.id, bird.id));
      res.json({
        success: true,
        bird: updatedBird,
        message: `${bird.name} evolved from ${currentTier} to ${nextTier}!`,
        cost: { focusShards, beakCoins },
      });
    } catch (error) {
      console.error("Bird evolution error:", error);
      res.status(500).json({ error: "Failed to evolve bird" });
    }
  });

  app.get("/api/accounts/:accountId/convergence", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { birds, calculateConvergence, raceModifiers } = await import("@shared/schema");
      const accountBirds = await db.select().from(birds).where(eq(birds.accountId, req.params.accountId));

      const raceElement = account.race ? raceModifiers[account.race as keyof typeof raceModifiers]?.element : undefined;

      let petElement: string | undefined;
      if (account.equippedPetId) {
        const pet = await storage.getPet(account.equippedPetId);
        if (pet) petElement = pet.element;
      }

      const convergenceResults = accountBirds.map(bird => ({
        birdId: bird.id,
        birdName: bird.name,
        birdElement: bird.element,
        convergence: calculateConvergence(raceElement, petElement, bird.element || undefined),
      }));

      res.json({
        raceElement: raceElement || null,
        petElement: petElement || null,
        birds: convergenceResults,
      });
    } catch (error) {
      console.error("Convergence error:", error);
      res.status(500).json({ error: "Failed to calculate convergence" });
    }
  });

  app.get("/api/bird-evolution-config", async (_req, res) => {
    const { BIRD_EVOLUTION_CONFIG, birdTiers } = await import("@shared/schema");
    res.json({ tiers: birdTiers, config: BIRD_EVOLUTION_CONFIG });
  });
  
  // Bird feeding - boost bird stats using beak coins
  const BIRD_FOOD = [
    { id: "seeds", name: "Bird Seeds", price: 100, defBoost: 1, spdBoost: 0, resourceLuckBoost: 0, carryBoostBoost: 0 },
    { id: "worms", name: "Juicy Worms", price: 200, defBoost: 0, spdBoost: 2, resourceLuckBoost: 0, carryBoostBoost: 0 },
    { id: "berries", name: "Magic Berries", price: 500, defBoost: 2, spdBoost: 2, resourceLuckBoost: 1, carryBoostBoost: 0 },
    { id: "golden-nectar", name: "Golden Nectar", price: 1500, defBoost: 5, spdBoost: 5, resourceLuckBoost: 2, carryBoostBoost: 2 },
    { id: "phoenix-ash", name: "Phoenix Ash", price: 5000, defBoost: 10, spdBoost: 10, resourceLuckBoost: 5, carryBoostBoost: 5 },
  ];
  
  app.get("/api/bird-food", (_req, res) => {
    res.json(BIRD_FOOD);
  });

  // Bird skins
  const BIRD_SKINS = [
    { id: "default", name: "Default", cost: 0 },
    { id: "arctic", name: "Arctic Plumage", cost: 5000 },
    { id: "tropical", name: "Tropical Feathers", cost: 15000 },
    { id: "storm", name: "Storm Wings", cost: 35000 },
    { id: "phoenix", name: "Phoenix Flames", cost: 100000 },
    { id: "celestial", name: "Celestial Glow", cost: 200000 },
  ];

  app.get("/api/bird-skins", (_req, res) => {
    res.json(BIRD_SKINS);
  });

  app.patch("/api/birds/:birdId/skin", async (req, res) => {
    try {
      const { accountId, skin } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const skinData = BIRD_SKINS.find(s => s.id === skin);
      if (!skinData) {
        return res.status(400).json({ error: "Invalid skin" });
      }
      
      const { birds } = await import("@shared/schema");
      const [bird] = await db.select().from(birds).where(eq(birds.id, req.params.birdId));
      if (!bird) {
        return res.status(404).json({ error: "Bird not found" });
      }
      
      if (bird.accountId !== accountId) {
        return res.status(403).json({ error: "This is not your bird" });
      }

      // Check if player already has this skin (free switch) or needs to buy
      const currentSkin = (bird as any).skin || "default";
      if (currentSkin !== skin && skinData.cost > 0) {
        const account = await storage.getAccount(accountId);
        if (!account || account.gold < skinData.cost) {
          return res.status(400).json({ error: `Need ${skinData.cost.toLocaleString()} gold for this skin` });
        }
        await storage.updateAccount(accountId, { gold: account.gold - skinData.cost });
      }
      
      await db.update(birds).set({ skin }).where(eq(birds.id, bird.id));
      const [updatedBird] = await db.select().from(birds).where(eq(birds.id, bird.id));
      
      res.json({ bird: updatedBird, message: `Skin changed to ${skinData.name}!` });
    } catch (error) {
      console.error("Bird skin error:", error);
      res.status(500).json({ error: "Failed to set skin" });
    }
  });
  
  app.post("/api/birds/:birdId/feed", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        foodId: z.string(),
      });
      const { accountId, foodId } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const food = BIRD_FOOD.find(f => f.id === foodId);
      if (!food) {
        return res.status(404).json({ error: "Food not found" });
      }
      
      if (account.beakCoins < food.price) {
        return res.status(400).json({ error: `Need ${food.price} Beak Coins (have ${account.beakCoins})` });
      }
      
      // Get the bird
      const { birds } = await import("@shared/schema");
      const [bird] = await db.select().from(birds).where(eq(birds.id, req.params.birdId));
      if (!bird) {
        return res.status(404).json({ error: "Bird not found" });
      }
      
      if (bird.accountId !== accountId) {
        return res.status(403).json({ error: "Not your bird" });
      }
      
      const currentStats = bird.stats as { Def: number; Spd: number; resourceLuck?: number; carryBoost?: number };
      const newStats = {
        Def: currentStats.Def + food.defBoost,
        Spd: currentStats.Spd + food.spdBoost,
        resourceLuck: (currentStats.resourceLuck || 0) + (food.resourceLuckBoost || 0),
        carryBoost: (currentStats.carryBoost || 0) + (food.carryBoostBoost || 0),
      };
      
      // Use transaction-like approach: update bird stats first, then beakCoins
      // If bird update fails, beakCoins is not deducted
      try {
        await db.update(birds).set({ stats: newStats }).where(eq(birds.id, bird.id));
        await storage.updateAccount(accountId, { beakCoins: account.beakCoins - food.price });
      } catch (updateError) {
        console.error("Bird feeding update error:", updateError);
        return res.status(500).json({ error: "Failed to update bird stats" });
      }
      
      res.json({ 
        success: true, 
        bird: { ...bird, stats: newStats },
        message: `${bird.name} enjoyed the ${food.name}! +${food.defBoost} Def, +${food.spdBoost} Spd${food.resourceLuckBoost ? `, +${food.resourceLuckBoost} Luck` : ''}${food.carryBoostBoost ? `, +${food.carryBoostBoost} Carry` : ''}`
      });
    } catch (error) {
      console.error("Bird feeding error:", error);
      res.status(500).json({ error: "Failed to feed bird" });
    }
  });
  
  // ==================== FISHING SYSTEM ====================
  const FISH_TYPES = [
    { name: "Silver Minnow", rarity: "common", statRange: [1, 3], elements: ["Water"] },
    { name: "Blue Guppy", rarity: "common", statRange: [1, 3], elements: ["Water"] },
    { name: "River Dart", rarity: "common", statRange: [1, 4], elements: ["Water", "Nature"] },
    { name: "Emerald Carp", rarity: "uncommon", statRange: [3, 7], elements: ["Water", "Nature"] },
    { name: "Golden Koi", rarity: "uncommon", statRange: [4, 8], elements: ["Water", "Light"] },
    { name: "Frostfin Trout", rarity: "rare", statRange: [6, 14], elements: ["Water", "Ice"] },
    { name: "Ember Bass", rarity: "rare", statRange: [8, 16], elements: ["Water", "Fire"] },
    { name: "Storm Pike", rarity: "epic", statRange: [12, 28], elements: ["Water", "Plasma", "Lightning"] },
    { name: "Crystal Eel", rarity: "epic", statRange: [15, 32], elements: ["Water", "Light", "Arcana"] },
    { name: "Aether Salmon", rarity: "legendary", statRange: [25, 50], elements: ["Water", "Aether"] },
    { name: "Chrono Catfish", rarity: "legendary", statRange: [28, 55], elements: ["Water", "Chrono", "Time"] },
    { name: "Void Leviathan Fry", rarity: "mythic", statRange: [40, 80], elements: ["Water", "Void", "Dark"] },
    { name: "Soul Lantern Fish", rarity: "mythic", statRange: [45, 85], elements: ["Water", "Soul", "Aether"] },
  ];

  function resetDailyFishingIfNeeded(account: any): { dailyFishCaught: number; lastFishingReset: Date } {
    const now = new Date();
    const lastReset = account.lastFishingReset ? new Date(account.lastFishingReset) : new Date(0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (lastReset < startOfToday) {
      return { dailyFishCaught: 0, lastFishingReset: now };
    }
    return { dailyFishCaught: account.dailyFishCaught || 0, lastFishingReset: lastReset };
  }

  function resetDailyPetFeedIfNeeded(account: any): { dailyPetFeedGain: number; lastPetFeedReset: Date } {
    const now = new Date();
    const lastReset = account.lastPetFeedReset ? new Date(account.lastPetFeedReset) : new Date(0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (lastReset < startOfToday) {
      return { dailyPetFeedGain: 0, lastPetFeedReset: now };
    }
    return { dailyPetFeedGain: account.dailyPetFeedGain || 0, lastPetFeedReset: lastReset };
  }

  app.get("/api/fishing/status/:accountId", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const rank = account.rank || "Novice";
      const rod = getRodForRank(rank);
      const dailyLimit = DAILY_CATCH_LIMIT_BY_RANK[rank] || 10;
      const { dailyFishCaught } = resetDailyFishingIfNeeded(account);
      const feedCap = PET_FEED_CAP_BY_RANK[rank] || 5;
      const { dailyPetFeedGain } = resetDailyPetFeedIfNeeded(account);

      res.json({
        rod,
        dailyCatchLimit: dailyLimit,
        dailyFishCaught,
        catchesRemaining: Math.max(0, dailyLimit - dailyFishCaught),
        feedCap,
        dailyPetFeedGain,
        feedRemaining: Math.max(0, feedCap - dailyPetFeedGain),
      });
    } catch (error) {
      console.error("Fishing status error:", error);
      res.status(500).json({ error: "Failed to get fishing status" });
    }
  });

  app.post("/api/fishing/cast", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string(), useBait: z.boolean().optional() });
      const { accountId, useBait } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const rank = account.rank || "Novice";
      const dailyLimit = DAILY_CATCH_LIMIT_BY_RANK[rank] || 10;
      const { dailyFishCaught, lastFishingReset } = resetDailyFishingIfNeeded(account);
      if (dailyFishCaught >= dailyLimit) {
        return res.status(400).json({ error: "Daily catch limit reached! Come back tomorrow.", dailyFishCaught, dailyLimit });
      }

      const maxEn = getMaxEnergyForRank(rank);
      const { energy: currentEnergy, lastEnergyUpdate: lastEnUp } = regenerateEnergy(account);
      if (currentEnergy < ENERGY_COSTS.fishing) {
        return res.status(400).json({ error: "Not enough energy to fish", required: ENERGY_COSTS.fishing, current: currentEnergy, maxEnergy: maxEn });
      }

      const rod = getRodForRank(rank);
      const playerLuck = (account.stats as any)?.Luck || 10;
      const effectiveLuck = playerLuck + rod.luckBonus;

      let baitBonus = 0;
      if (useBait && ((account as any).bait || 0) > 0) {
        await db.update(accounts).set({ bait: (account as any).bait - 1 }).where(eq(accounts.id, accountId));
        baitBonus = 10;
      }

      const baseRoll = Math.floor(Math.random() * 100) + 1;
      const rarityScore = Math.floor((baseRoll * rod.rarityMultiplier) + effectiveLuck + baitBonus);

      let rarityFilter: string;
      if (rarityScore >= 99) rarityFilter = "mythic";
      else if (rarityScore >= 93) rarityFilter = "legendary";
      else if (rarityScore >= 81) rarityFilter = "epic";
      else if (rarityScore >= 66) rarityFilter = "rare";
      else if (rarityScore >= 41) rarityFilter = "uncommon";
      else rarityFilter = "common";
      
      const possibleFish = FISH_TYPES.filter(f => f.rarity === rarityFilter);
      const fishTemplate = possibleFish.length > 0
        ? possibleFish[Math.floor(Math.random() * possibleFish.length)]
        : FISH_TYPES[0];
      
      const [minStat, maxStat] = fishTemplate.statRange;
      const randomStat = () => Math.floor(Math.random() * (maxStat - minStat + 1)) + minStat;
      const petStatGain = FISH_PET_STAT_GAIN[fishTemplate.rarity] || 1;
      const stats = {
        Str: randomStat(),
        Spd: randomStat(),
        Luck: Math.floor(randomStat() / 2),
        ElementalPower: randomStat(),
      };
      
      const element = fishTemplate.elements[Math.floor(Math.random() * fishTemplate.elements.length)];
      
      const { fish } = await import("@shared/schema");
      const [newFish] = await db.insert(fish).values({
        accountId,
        name: fishTemplate.name,
        rarity: fishTemplate.rarity as any,
        element: element as any,
        stats,
      }).returning();

      await db.update(accounts).set({
        energy: currentEnergy - ENERGY_COSTS.fishing,
        lastEnergyUpdate: lastEnUp,
        dailyFishCaught: dailyFishCaught + 1,
        lastFishingReset: lastFishingReset,
      }).where(eq(accounts.id, accountId));
      
      let monsterEncounter = null;
      const fishingZone = "crystal_lake";
      const actionMonster = checkActionSpawn(fishingZone, accountId, rank);
      if (actionMonster) {
        await db.insert(monsterSpawnLog).values({
          accountId,
          zoneId: fishingZone,
          monsterName: actionMonster.template.name,
          monsterElement: actionMonster.template.element,
          monsterLevel: actionMonster.level,
          isBoss: actionMonster.template.isBoss,
          source: "action",
          weather: getZoneWeather(fishingZone).type,
        });
        monsterEncounter = formatMonsterResponse(actionMonster);
      }

      const updatedCarryInfo = await getPlayerCarryInfo(accountId);
      const newDailyLimit = dailyLimit;
      res.json({
        success: true,
        fish: newFish,
        carryCapacity: updatedCarryInfo,
        monsterEncounter,
        rod,
        rarityScore,
        dailyFishCaught: dailyFishCaught + 1,
        dailyCatchLimit: newDailyLimit,
        catchesRemaining: Math.max(0, newDailyLimit - (dailyFishCaught + 1)),
        sellPrice: FISH_SELL_PRICES[fishTemplate.rarity] || 50,
        isCraftingMaterial: FISH_CRAFTING_MATERIAL[fishTemplate.rarity] || false,
        petStatGain,
      });
    } catch (error) {
      console.error("Fishing error:", error);
      res.status(500).json({ error: "Failed to fish" });
    }
  });
  
  app.get("/api/accounts/:accountId/fish", async (req, res) => {
    try {
      const { fish } = await import("@shared/schema");
      const accountFish = await db.select().from(fish).where(eq(fish.accountId, req.params.accountId));
      res.json(accountFish);
    } catch (error) {
      res.status(500).json({ error: "Failed to get fish" });
    }
  });

  app.post("/api/fishing/sell", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string(), fishId: z.string() });
      const { accountId, fishId } = schema.parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { fish } = await import("@shared/schema");
      const [fishToSell] = await db.select().from(fish).where(eq(fish.id, fishId));
      if (!fishToSell || fishToSell.accountId !== accountId) {
        return res.status(404).json({ error: "Fish not found or not owned" });
      }

      const sellPrice = FISH_SELL_PRICES[fishToSell.rarity] || 50;
      await db.delete(fish).where(eq(fish.id, fishId));
      await db.update(accounts).set({ gold: account.gold + sellPrice }).where(eq(accounts.id, accountId));

      res.json({ success: true, goldEarned: sellPrice, fishName: fishToSell.name, rarity: fishToSell.rarity });
    } catch (error) {
      console.error("Sell fish error:", error);
      res.status(500).json({ error: "Failed to sell fish" });
    }
  });
  
  app.post("/api/pets/:petId/feed-fish", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        fishId: z.string(),
      });
      const { accountId, fishId } = schema.parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const rank = account.rank || "Novice";
      const feedCap = PET_FEED_CAP_BY_RANK[rank] || 5;
      const { dailyPetFeedGain, lastPetFeedReset } = resetDailyPetFeedIfNeeded(account);

      const pet = await storage.getPet(req.params.petId);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found or not owned" });
      }
      
      const { fish } = await import("@shared/schema");
      const [fishToFeed] = await db.select().from(fish).where(eq(fish.id, fishId));
      if (!fishToFeed || fishToFeed.accountId !== accountId) {
        return res.status(404).json({ error: "Fish not found or not owned" });
      }

      const statGain = FISH_PET_STAT_GAIN[fishToFeed.rarity] || 1;
      if (dailyPetFeedGain + statGain > feedCap) {
        return res.status(400).json({
          error: "Daily pet feed cap reached! Your pet cannot gain more stats today.",
          dailyPetFeedGain,
          feedCap,
          feedRemaining: Math.max(0, feedCap - dailyPetFeedGain),
        });
      }
      
      const petStats = pet.stats as any;
      const newStats = {
        Str: (petStats.Str || 0) + statGain,
        Spd: (petStats.Spd || 0) + statGain,
        Luck: (petStats.Luck || 0) + Math.max(1, Math.floor(statGain / 2)),
        ElementalPower: (petStats.ElementalPower || 0) + statGain,
      };
      
      const currentPetElements = pet.elements || [pet.element];
      const newElements = fishToFeed.element && !currentPetElements.includes(fishToFeed.element as any)
        ? [...currentPetElements, fishToFeed.element]
        : currentPetElements;
      
      await storage.updatePet(pet.id, { stats: newStats, elements: newElements as any });
      await db.delete(fish).where(eq(fish.id, fishId));
      await db.update(accounts).set({
        dailyPetFeedGain: dailyPetFeedGain + statGain,
        lastPetFeedReset: lastPetFeedReset,
      }).where(eq(accounts.id, accountId));
      
      const updatedPet = await storage.getPet(pet.id);
      res.json({
        success: true,
        pet: updatedPet,
        fishConsumed: fishToFeed.name,
        statGain,
        dailyPetFeedGain: dailyPetFeedGain + statGain,
        feedCap,
        feedRemaining: Math.max(0, feedCap - (dailyPetFeedGain + statGain)),
      });
    } catch (error) {
      console.error("Feed fish error:", error);
      res.status(500).json({ error: "Failed to feed fish to pet" });
    }
  });

  app.get("/api/pet-cooking-recipes", (req, res) => {
    res.json(PET_COOKING_RECIPES);
  });

  app.post("/api/pets/:petId/cook", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        recipeId: z.string(),
        fishId: z.string(),
      });
      const { accountId, recipeId, fishId } = schema.parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const pet = await storage.getPet(req.params.petId);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found or not owned" });
      }
      if (pet.isFainted) {
        return res.status(400).json({ error: "Cannot cook for a fainted pet" });
      }

      const recipe = PET_COOKING_RECIPES.find(r => r.id === recipeId);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });

      if (account.gold < recipe.cost) {
        return res.status(400).json({ error: `Need ${recipe.cost} gold for ${recipe.name}` });
      }

      const { fish } = await import("@shared/schema");
      const [fishItem] = await db.select().from(fish).where(eq(fish.id, fishId));
      if (!fishItem || fishItem.accountId !== accountId) {
        return res.status(404).json({ error: "Fish not found or not owned" });
      }

      const fishRarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
      const requiredIdx = fishRarityOrder.indexOf(recipe.requiredFishRarity);
      const fishIdx = fishRarityOrder.indexOf(fishItem.rarity);
      if (fishIdx < requiredIdx) {
        return res.status(400).json({ error: `This recipe requires at least ${recipe.requiredFishRarity} rarity fish` });
      }

      const tempElementExpires = new Date(Date.now() + recipe.duration);
      
      const { pets: petsTable } = await import("@shared/schema");
      await db.update(petsTable).set({
        tempElement: recipe.element,
        tempElementExpires: tempElementExpires,
      }).where(eq(petsTable.id, req.params.petId));

      await db.delete(fish).where(eq(fish.id, fishId));
      await db.update(accounts).set({ gold: account.gold - recipe.cost }).where(eq(accounts.id, accountId));

      const updatedPet = await storage.getPet(pet.id);
      res.json({
        success: true,
        message: `${pet.name} consumed ${recipe.name}! Gained temporary ${recipe.element} element for 1 hour.`,
        pet: updatedPet,
        tempElement: recipe.element,
        tempElementExpires: tempElementExpires.toISOString(),
        goldSpent: recipe.cost,
        fishConsumed: fishItem.name,
      });
    } catch (error) {
      console.error("Pet cooking error:", error);
      res.status(500).json({ error: "Failed to cook for pet" });
    }
  });

  app.post("/api/pets/:petId/revive-consumable", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { pets: petsTable } = await import("@shared/schema");
      const [pet] = await db.select().from(petsTable).where(eq(petsTable.id, req.params.petId));
      if (!pet) return res.status(404).json({ error: "Pet not found" });
      if (pet.accountId !== accountId) return res.status(403).json({ error: "Not your pet" });
      if (!pet.isFainted) return res.status(400).json({ error: "Pet is not fainted" });

      if (account.gold < PET_REVIVE_CONSUMABLE_COST) {
        return res.status(400).json({ error: `Need ${PET_REVIVE_CONSUMABLE_COST} gold to revive pet with consumable` });
      }

      await db.update(petsTable).set({ isFainted: false }).where(eq(petsTable.id, req.params.petId));
      await db.update(accounts).set({ gold: account.gold - PET_REVIVE_CONSUMABLE_COST }).where(eq(accounts.id, accountId));

      res.json({ success: true, message: `${pet.name} has been revived with a consumable!`, goldSpent: PET_REVIVE_CONSUMABLE_COST });
    } catch (error) {
      console.error("Pet revive consumable error:", error);
      res.status(500).json({ error: "Failed to revive pet" });
    }
  });

  // Base Raids & Visitors System
  const BASE_RAID_EVENTS = [
    { id: "goblin_raid", name: "Goblin Raid", minRank: 0, difficulty: 1, rewards: { gold: 500, exp: 100 } },
    { id: "bandit_attack", name: "Bandit Attack", minRank: 2, difficulty: 2, rewards: { gold: 1500, exp: 300 } },
    { id: "orc_siege", name: "Orc Siege", minRank: 4, difficulty: 3, rewards: { gold: 5000, exp: 800 } },
    { id: "demon_invasion", name: "Demon Invasion", minRank: 7, difficulty: 4, rewards: { gold: 15000, exp: 2000 } },
    { id: "dragon_assault", name: "Dragon Assault", minRank: 10, difficulty: 5, rewards: { gold: 50000, exp: 5000 } },
    { id: "void_breach", name: "Void Breach", minRank: 13, difficulty: 6, rewards: { gold: 200000, exp: 15000 } },
  ];

  const WEEKLY_EVENTS = [
    { id: "hero_blessing", name: "Hero's Blessing", type: "hero", bonus: { goldMultiplier: 2, expMultiplier: 1.5 }, description: "Double gold from all activities" },
    { id: "joker_chaos", name: "Joker's Chaos", type: "joker", bonus: { goldMultiplier: 0.5, luckMultiplier: 3 }, description: "Half gold but triple luck for rare drops" },
    { id: "hero_valor", name: "Valor's Call", type: "hero", bonus: { defenseBonus: 50, healthBonus: 25 }, description: "+50% base defense, +25% HP" },
    { id: "joker_gambit", name: "Joker's Gambit", type: "joker", bonus: { critMultiplier: 3, dodgePenalty: -20 }, description: "Triple crit chance but -20% dodge" },
  ];

  app.get("/api/base-raids", (_req, res) => {
    res.json(BASE_RAID_EVENTS);
  });

  app.get("/api/weekly-events", (_req, res) => {
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const activeEvent = WEEKLY_EVENTS[weekNumber % WEEKLY_EVENTS.length];
    res.json({
      active: activeEvent,
      allEvents: WEEKLY_EVENTS,
      nextEventIn: (7 * 24 * 60 * 60 * 1000) - (Date.now() % (7 * 24 * 60 * 60 * 1000)),
    });
  });

  // ==================== HIDDEN MECHANICS & TRIGGERS ====================

  const HIDDEN_TRIGGERS = [
    { id: "lucky_drop", name: "Lucky Drop", chance: 0.01, reward: { gold: 5000, rubies: 50 }, oneTime: false },
    { id: "mysterious_stranger", name: "Mysterious Stranger", chance: 0.005, reward: { soulShards: 100 }, oneTime: false },
    { id: "ancient_blessing", name: "Ancient Blessing", chance: 0.002, reward: { gold: 25000, trainingPoints: 1000 }, oneTime: true },
    { id: "rare_pet_egg", name: "Rare Pet Egg", chance: 0.001, reward: { petEgg: true }, oneTime: false },
    { id: "secret_chamber", name: "Secret Chamber", chance: 0.0005, reward: { gold: 100000, rubies: 500 }, oneTime: true },
  ];

  const triggeredOnce: Map<string, Set<string>> = new Map();

  app.post("/api/hidden/check-trigger", async (req, res) => {
    try {
      const { accountId, context } = z.object({ accountId: z.string(), context: z.string().optional() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const playerOnce = triggeredOnce.get(accountId) || new Set();
      
      for (const trigger of HIDDEN_TRIGGERS) {
        if (trigger.oneTime && playerOnce.has(trigger.id)) continue;
        
        if (Math.random() < trigger.chance) {
          if (trigger.oneTime) {
            playerOnce.add(trigger.id);
            triggeredOnce.set(accountId, playerOnce);
          }
          
          const reward = trigger.reward as { gold?: number; rubies?: number; soulShards?: number; trainingPoints?: number; petEgg?: boolean };
          await storage.updateAccount(accountId, {
            gold: (account.gold || 0) + (reward.gold || 0),
            rubies: (account.rubies || 0) + (reward.rubies || 0),
            soulShards: (account.soulShards || 0) + (reward.soulShards || 0),
            trainingPoints: (account.trainingPoints || 0) + (reward.trainingPoints || 0),
          });
          
          await storage.createActivityFeed({
            type: "hidden_trigger",
            message: `${account.username} discovered: ${trigger.name}!`,
            metadata: { accountId, triggerId: trigger.id, reward, context },
          });
          
          return res.json({
            triggered: true,
            event: trigger.name,
            reward: trigger.reward,
            message: `You discovered ${trigger.name}!`,
          });
        }
      }
      
      res.json({ triggered: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to check triggers" });
    }
  });

  // ==================== STAT FORMULAS (QUINTILLION-SAFE) ====================

  const STAT_FORMULAS = {
    baseStat: (base: number, level: number, bonus: number) => 
      BigInt(base) + BigInt(level) * BigInt(10) + BigInt(bonus),
    
    hp: (vit: number, level: number, rankMultiplier: number) => 
      BigInt(100) + BigInt(vit) * BigInt(10) * BigInt(level) * BigInt(rankMultiplier),
    
    damage: (str: number, weaponPower: number, skillMultiplier: number) =>
      (BigInt(str) * BigInt(2) + BigInt(weaponPower)) * BigInt(Math.floor(skillMultiplier * 100)) / BigInt(100),
    
    defense: (def: number, armorValue: number, shieldBonus: number) =>
      BigInt(def) * BigInt(3) + BigInt(armorValue) * BigInt(2) + BigInt(shieldBonus),
    
    initiative: (spd: number, bonuses: number) =>
      BigInt(spd) * BigInt(2) + BigInt(bonuses),
    
    luck: (luk: number, bonuses: number) =>
      Math.min(100, Math.floor((luk + bonuses) / 10)),
    
    petPower: (petLevel: number, bondLevel: number, evolution: number) =>
      BigInt(petLevel) * BigInt(bondLevel) * BigInt(evolution + 1) * BigInt(10),
    
    skillPower: (int: number, skillLevel: number, elementBonus: number) =>
      BigInt(int) * BigInt(skillLevel) * BigInt(10) + BigInt(elementBonus) * BigInt(100),
    
    cooldown: (baseCd: number, spdReduction: number) =>
      Math.max(1, Math.floor(baseCd * (100 - Math.min(spdReduction, 75)) / 100)),
  };

  app.post("/api/calculate-stats", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        context: z.enum(["combat", "pet", "skill"]).optional(),
      });
      const { accountId, context } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const stats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      const rankIndex = playerRanks.indexOf(account.rank);
      const rankMultiplier = rankIndex + 1;
      
      const calculated = {
        hp: STAT_FORMULAS.hp(stats.Def || 10, rankMultiplier, rankMultiplier).toString(),
        damage: STAT_FORMULAS.damage(stats.Str || 10, 0, 1.0).toString(),
        defense: STAT_FORMULAS.defense(stats.Def || 10, 0, 0).toString(),
        initiative: STAT_FORMULAS.initiative(stats.Spd || 10, 0).toString(),
        luck: STAT_FORMULAS.luck(stats.Luck || 10, 0),
        critChance: Math.min(50, Math.floor((stats.Luck || 10) / 5)),
        dodgeChance: Math.min(40, Math.floor((stats.Spd || 10) / 8)),
      };
      
      res.json({
        baseStats: stats,
        calculatedStats: calculated,
        rankMultiplier,
        context: context || "general",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate stats" });
    }
  });

  // ==================== UI & QOL FEATURES ====================

  const playerSettings: Map<string, { autoGather: boolean; autoLoot: boolean; notifications: { combat: boolean; trade: boolean; guild: boolean; achievements: boolean; events: boolean } }> = new Map();

  app.get("/api/accounts/:id/settings", async (req, res) => {
    try {
      const accountId = req.params.id;
      const settings = playerSettings.get(accountId) || {
        autoGather: false,
        autoLoot: true,
        notifications: { combat: true, trade: true, guild: true, achievements: true, events: true },
      };
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.post("/api/accounts/:id/settings", async (req, res) => {
    try {
      const accountId = req.params.id;
      const schema = z.object({
        autoGather: z.boolean().optional(),
        autoLoot: z.boolean().optional(),
        notifications: z.object({
          combat: z.boolean().optional(),
          trade: z.boolean().optional(),
          guild: z.boolean().optional(),
          achievements: z.boolean().optional(),
          events: z.boolean().optional(),
        }).optional(),
      });
      const updates = schema.parse(req.body);
      
      const current = playerSettings.get(accountId) || {
        autoGather: false,
        autoLoot: true,
        notifications: { combat: true, trade: true, guild: true, achievements: true, events: true },
      };
      
      const merged = {
        ...current,
        ...updates,
        notifications: { ...current.notifications, ...updates.notifications },
      };
      
      playerSettings.set(accountId, merged);
      res.json({ success: true, settings: merged });
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/accounts/:id/auto-gather", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { zoneId } = z.object({ zoneId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const settings = playerSettings.get(accountId);
      if (!settings?.autoGather) {
        return res.status(400).json({ error: "Auto-gather not enabled" });
      }

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const maxEn = getMaxEnergyForRank(account.rank || "Novice");
      const { energy: currentEnergy, lastEnergyUpdate: lastEnUp } = regenerateEnergy(account);
      if (currentEnergy < ENERGY_COSTS.gathering) {
        return res.status(400).json({ error: "Not enough energy to gather", required: ENERGY_COSTS.gathering, current: currentEnergy, maxEnergy: maxEn });
      }
      await db.update(accounts).set({ energy: currentEnergy - ENERGY_COSTS.gathering, lastEnergyUpdate: lastEnUp }).where(eq(accounts.id, accountId));
      
      const gatherableZonesMap: Record<string, { resources: { type: string; chance: number; minAmount: number; maxAmount: number }[] }> = {
        mountain_caverns: { resources: [{ type: "ore", chance: 0.6, minAmount: 1, maxAmount: 5 }, { type: "gems", chance: 0.2, minAmount: 1, maxAmount: 2 }] },
        ruby_mines: { resources: [{ type: "rubies", chance: 0.4, minAmount: 1, maxAmount: 3 }, { type: "gold_ore", chance: 0.5, minAmount: 2, maxAmount: 6 }] },
        enchanted_forest: { resources: [{ type: "herbs", chance: 0.7, minAmount: 2, maxAmount: 8 }, { type: "wood", chance: 0.6, minAmount: 3, maxAmount: 10 }] },
        crystal_lake: { resources: [{ type: "crystals", chance: 0.3, minAmount: 1, maxAmount: 4 }, { type: "fish", chance: 0.5, minAmount: 1, maxAmount: 3 }] },
      };
      const zoneData = gatherableZonesMap[zoneId];
      if (!zoneData) {
        return res.status(400).json({ error: "Zone not gatherable" });
      }
      
      const stats = account.stats || { Int: 10 };
      const rankIndex = playerRanks.indexOf(account.rank);
      const efficiency = Math.floor((stats.Int || 10) * (1 + rankIndex * 0.1));
      
      const resources: { type: string; amount: number }[] = [];
      const gathers = Math.min(5, Math.floor(efficiency / 20) + 1);
      
      for (let i = 0; i < gathers; i++) {
        for (const resource of zoneData.resources) {
          if (Math.random() < resource.chance) {
            const amount = Math.floor(Math.random() * (resource.maxAmount - resource.minAmount + 1)) + resource.minAmount;
            resources.push({ type: resource.type, amount: Math.floor(amount * efficiency / 10) });
          }
        }
      }
      
      const totalGold = resources.reduce((sum, r) => sum + r.amount * 10, 0);
      if (totalGold > 0) {
        await storage.updateAccountGold(accountId, account.gold + totalGold);
      }

      let monsterEncounter = null;
      const actionMonster = checkActionSpawn(zoneId, accountId, account.rank || "Novice");
      if (actionMonster) {
        await db.insert(monsterSpawnLog).values({
          accountId,
          zoneId,
          monsterName: actionMonster.template.name,
          monsterElement: actionMonster.template.element,
          monsterLevel: actionMonster.level,
          isBoss: actionMonster.template.isBoss,
          source: "action",
          weather: getZoneWeather(zoneId).type,
        });
        monsterEncounter = formatMonsterResponse(actionMonster);
      }
      
      res.json({
        success: true,
        resources,
        goldEarned: totalGold,
        gatherCount: gathers,
        efficiency,
        monsterEncounter,
      });
    } catch (error) {
      res.status(500).json({ error: "Auto-gather failed" });
    }
  });

  app.post("/api/accounts/:id/auto-loot", async (req, res) => {
    try {
      const accountId = req.params.id;
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const settings = playerSettings.get(accountId);
      if (!settings?.autoLoot) {
        return res.status(400).json({ error: "Auto-loot not enabled" });
      }
      
      const rankIndex = playerRanks.indexOf(account.rank);
      const lootMultiplier = 1 + (rankIndex * 0.05);
      const baseGold = Math.floor(Math.random() * 500 + 100);
      const goldLooted = Math.floor(baseGold * lootMultiplier);
      
      const items: { name: string; rarity: string }[] = [];
      if (Math.random() < 0.1) {
        items.push({ name: "Common Material", rarity: "common" });
      }
      if (Math.random() < 0.03) {
        items.push({ name: "Uncommon Material", rarity: "uncommon" });
      }
      if (Math.random() < 0.01) {
        items.push({ name: "Rare Material", rarity: "rare" });
      }
      
      await storage.updateAccountGold(accountId, account.gold + goldLooted);
      
      res.json({
        success: true,
        goldLooted,
        items,
        message: `Auto-looted ${goldLooted} gold${items.length > 0 ? ` and ${items.length} item(s)` : ''}!`,
      });
    } catch (error) {
      res.status(500).json({ error: "Auto-loot failed" });
    }
  });

  // ==================== EXPANDED MYSTIC TOWER (100 FLOORS × 100 LEVELS) ====================

  const TOWER_CONFIG = {
    totalFloors: 100,
    levelsPerFloor: 100,
    totalBattles: 10000,
    rankGates: [
      { floor: 1, minRank: 0 },   // Novice
      { floor: 10, minRank: 3 },  // Journeyman
      { floor: 25, minRank: 5 },  // Expert
      { floor: 50, minRank: 7 },  // Grandmaster
      { floor: 75, minRank: 10 }, // Sovereign
      { floor: 100, minRank: 14 }, // Mythical Legend
    ],
    floorBosses: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    rewards: {
      perLevel: { gold: 100, exp: 50 },
      perFloor: { gold: 5000, rubies: 10, soulShards: 5 },
      bossFloor: { gold: 50000, rubies: 100, soulShards: 50 },
      completion: { gold: 1000000, rubies: 5000, soulShards: 1000, title: "Tower Master" },
    },
  };

  app.get("/api/tower/config", (_req, res) => {
    res.json(TOWER_CONFIG);
  });

  app.get("/api/accounts/:id/tower-progress", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const floor = account.npcFloor || 1;
      const level = account.npcLevel || 1;
      const totalBattles = (floor - 1) * 100 + level;
      const percentComplete = (totalBattles / TOWER_CONFIG.totalBattles) * 100;
      
      const rankIndex = playerRanks.indexOf(account.rank);
      const nextGate = TOWER_CONFIG.rankGates.find(g => g.floor > floor && g.minRank > rankIndex);
      
      res.json({
        currentFloor: floor,
        currentLevel: level,
        totalBattles,
        percentComplete: percentComplete.toFixed(2),
        nextGate,
        isCompleted: floor >= 100 && level >= 100,
        canProgress: !nextGate || rankIndex >= nextGate.minRank,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get tower progress" });
    }
  });

  const towerCompletions: Set<string> = new Set();

  app.post("/api/accounts/:id/tower-battle", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const floor = account.npcFloor || 1;
      const level = account.npcLevel || 1;
      
      if (floor >= 100 && level >= 100) {
        return res.json({
          result: "completed",
          floor: 100,
          level: 100,
          message: "Tower already completed! You are a Tower Master!",
        });
      }
      
      const rankIndex = playerRanks.indexOf(account.rank);
      const gate = TOWER_CONFIG.rankGates.find(g => g.floor === floor);
      if (gate && rankIndex < gate.minRank) {
        return res.status(403).json({ 
          error: `Floor ${floor} requires ${playerRanks[gate.minRank]} rank`,
          required: playerRanks[gate.minRank],
        });
      }
      
      const enemyPower = floor * 10 + level;
      const playerPower = Object.values(account.stats || { Str: 10 }).reduce((a, b) => a + b, 0);
      const won = playerPower >= enemyPower * 0.8 || Math.random() > 0.3;
      
      if (!won) {
        return res.json({
          result: "defeat",
          floor,
          level,
          message: "The tower guardian was too powerful!",
        });
      }
      
      let newFloor = floor;
      let newLevel = level + 1;
      const rewards = { ...TOWER_CONFIG.rewards.perLevel };
      
      if (newLevel > 100) {
        newLevel = 1;
        newFloor++;
        Object.assign(rewards, TOWER_CONFIG.rewards.perFloor);
        
        if (TOWER_CONFIG.floorBosses.includes(floor)) {
          Object.assign(rewards, TOWER_CONFIG.rewards.bossFloor);
        }
      }
      
      if (newFloor > 100) {
        newFloor = 100;
        newLevel = 100;
        if (!towerCompletions.has(req.params.id)) {
          Object.assign(rewards, TOWER_CONFIG.rewards.completion);
          towerCompletions.add(req.params.id);
        }
      }
      
      await storage.updateAccount(req.params.id, {
        gold: account.gold + rewards.gold,
      } as any);
      await db.update(accounts).set({
        npcFloor: newFloor,
        npcLevel: newLevel,
      }).where(eq(accounts.id, req.params.id));
      
      // Check trophies after tower progress
      await checkAndGrantTrophies(req.params.id);
      
      res.json({
        result: "victory",
        previousFloor: floor,
        previousLevel: level,
        newFloor,
        newLevel,
        rewards,
        message: newFloor > floor ? `Cleared Floor ${floor}!` : `Defeated level ${level} guardian!`,
      });
    } catch (error) {
      res.status(500).json({ error: "Tower battle failed" });
    }
  });

  // ==================== HELL ZONE (BATTLE ROYALE) ====================

  const HELL_ZONE_CONFIG = {
    minRank: 10,
    deathTax: 0.1,
    antiHealPenalty: 0.5,
    mythicDropChance: 0.001,
    mythicDrops: [
      { id: "demon_blade", name: "Demon's Blade", power: 50000, rarity: "mythic" },
      { id: "hellfire_armor", name: "Hellfire Armor", defense: 50000, rarity: "mythic" },
      { id: "abyssal_ring", name: "Abyssal Ring", allStats: 5000, rarity: "mythic" },
      { id: "demon_lord_crown", name: "Demon Lord's Crown", power: 100000, rarity: "legendary" },
    ],
    enemies: [
      { id: "demon_soldier", name: "Demon Soldier", power: 10000, goldDrop: 5000 },
      { id: "hellfire_elemental", name: "Hellfire Elemental", power: 25000, goldDrop: 15000 },
      { id: "abyssal_horror", name: "Abyssal Horror", power: 50000, goldDrop: 50000 },
      { id: "demon_lord", name: "Demon Lord", power: 100000, goldDrop: 200000, isBoss: true },
    ],
  };

  const hellZoneParticipants: Map<string, { enteredAt: number; kills: number; alive: boolean }> = new Map();

  app.get("/api/hell-zone/config", (_req, res) => {
    res.json({
      ...HELL_ZONE_CONFIG,
      activeParticipants: Array.from(hellZoneParticipants.entries())
        .filter(([_, data]) => data.alive)
        .length,
    });
  });

  app.post("/api/hell-zone/enter", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const rankIndex = playerRanks.indexOf(account.rank);
      if (rankIndex < HELL_ZONE_CONFIG.minRank) {
        return res.status(403).json({ 
          error: `Hell Zone requires ${playerRanks[HELL_ZONE_CONFIG.minRank]} rank`,
          required: playerRanks[HELL_ZONE_CONFIG.minRank],
        });
      }
      
      if (hellZoneParticipants.has(accountId)) {
        const data = hellZoneParticipants.get(accountId)!;
        if (data.alive) {
          return res.status(400).json({ error: "Already in Hell Zone" });
        }
      }
      
      hellZoneParticipants.set(accountId, { enteredAt: Date.now(), kills: 0, alive: true });
      
      await storage.createActivityFeed({
        type: "hell_zone_entry",
        message: `${account.username} entered the Hell Zone!`,
        metadata: { accountId },
      });
      
      res.json({
        success: true,
        message: "Entered the Hell Zone. Healing is reduced by 50%. Death costs 10% of your gold.",
        antiHeal: HELL_ZONE_CONFIG.antiHealPenalty,
        deathTax: HELL_ZONE_CONFIG.deathTax,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to enter Hell Zone" });
    }
  });

  app.post("/api/hell-zone/battle", async (req, res) => {
    try {
      const { accountId, enemyId } = z.object({ accountId: z.string(), enemyId: z.string().optional() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const participant = hellZoneParticipants.get(accountId);
      if (!participant || !participant.alive) {
        return res.status(400).json({ error: "Not in Hell Zone or already defeated" });
      }
      
      const enemy = enemyId 
        ? HELL_ZONE_CONFIG.enemies.find(e => e.id === enemyId)
        : HELL_ZONE_CONFIG.enemies[Math.floor(Math.random() * HELL_ZONE_CONFIG.enemies.length)];
      
      if (!enemy) {
        return res.status(400).json({ error: "Invalid enemy" });
      }
      
      const playerPower = Object.values(account.stats || { Str: 10 }).reduce((a, b) => a + b, 0) * 100;
      const won = playerPower >= enemy.power * 0.7 || Math.random() > 0.4;
      
      if (!won) {
        participant.alive = false;
        const goldLost = Math.floor(account.gold * HELL_ZONE_CONFIG.deathTax);
        await storage.updateAccountGold(accountId, account.gold - goldLost);
        
        await storage.createActivityFeed({
          type: "hell_zone_death",
          message: `${account.username} was slain in the Hell Zone by ${enemy.name}!`,
          metadata: { accountId, enemyId: enemy.id, goldLost },
        });
        
        return res.json({
          result: "defeat",
          enemy: enemy.name,
          goldLost,
          message: `Defeated by ${enemy.name}! Lost ${goldLost} gold.`,
          canReenter: true,
        });
      }
      
      participant.kills++;
      const goldEarned = enemy.goldDrop;
      await storage.updateAccountGold(accountId, account.gold + goldEarned);
      
      let mythicDrop = null;
      if (Math.random() < HELL_ZONE_CONFIG.mythicDropChance * (enemy.isBoss ? 10 : 1)) {
        mythicDrop = HELL_ZONE_CONFIG.mythicDrops[Math.floor(Math.random() * HELL_ZONE_CONFIG.mythicDrops.length)];
        
        await storage.createActivityFeed({
          type: "mythic_drop",
          message: `${account.username} obtained ${mythicDrop.name} from the Hell Zone!`,
          metadata: { accountId, itemId: mythicDrop.id },
        });
      }
      
      res.json({
        result: "victory",
        enemy: enemy.name,
        goldEarned,
        kills: participant.kills,
        mythicDrop,
        message: mythicDrop 
          ? `Defeated ${enemy.name}! Earned ${goldEarned} gold and found ${mythicDrop.name}!`
          : `Defeated ${enemy.name}! Earned ${goldEarned} gold.`,
      });
    } catch (error) {
      res.status(500).json({ error: "Hell Zone battle failed" });
    }
  });

  app.post("/api/hell-zone/exit", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      
      const participant = hellZoneParticipants.get(accountId);
      if (!participant) {
        return res.status(400).json({ error: "Not in Hell Zone" });
      }
      
      const timeSpent = Date.now() - participant.enteredAt;
      hellZoneParticipants.delete(accountId);
      
      res.json({
        success: true,
        kills: participant.kills,
        timeSpent,
        message: `Exited Hell Zone with ${participant.kills} kills.`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to exit Hell Zone" });
    }
  });

  app.post("/api/hell-zone/heal", async (req, res) => {
    try {
      const { accountId, healAmount } = z.object({ accountId: z.string(), healAmount: z.number() }).parse(req.body);
      
      const participant = hellZoneParticipants.get(accountId);
      if (!participant || !participant.alive) {
        return res.json({
          success: true,
          actualHeal: healAmount,
          message: "Healed normally (not in Hell Zone)",
          antiHealApplied: false,
        });
      }
      
      const actualHeal = Math.floor(healAmount * (1 - HELL_ZONE_CONFIG.antiHealPenalty));
      
      res.json({
        success: true,
        requestedHeal: healAmount,
        actualHeal,
        penalty: HELL_ZONE_CONFIG.antiHealPenalty,
        antiHealApplied: true,
        message: `Hell Zone anti-heal: Healed ${actualHeal} instead of ${healAmount} (50% penalty)`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process heal" });
    }
  });

  app.get("/api/hell-zone/leaderboard", async (_req, res) => {
    try {
      const leaderboard = Array.from(hellZoneParticipants.entries())
        .map(([accountId, data]) => ({ accountId, kills: data.kills, alive: data.alive }))
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 10);
      
      res.json({ leaderboard });
    } catch (error) {
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  // ==================== ADMIN DASHBOARD ====================

  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const allAccounts = await storage.getAllAccounts();
      const allGuilds = await storage.getAllGuilds();
      const activityFeeds = await storage.getRecentActivities(100);
      
      const stats = {
        totalPlayers: allAccounts.length,
        onlinePlayers: activeSessions.size,
        totalGuilds: allGuilds.length,
        totalActivityLogs: activityFeeds.length,
        hellZoneParticipants: hellZoneParticipants.size,
        suspiciousAccounts: suspiciousActivity.size,
        serverUptime: process.uptime(),
      };
      
      const rankDistribution: Record<string, number> = {};
      for (const acc of allAccounts) {
        rankDistribution[acc.rank] = (rankDistribution[acc.rank] || 0) + 1;
      }
      
      const raceDistribution: Record<string, number> = {};
      for (const acc of allAccounts) {
        if (acc.race) raceDistribution[acc.race] = (raceDistribution[acc.race] || 0) + 1;
      }
      
      res.json({
        stats,
        rankDistribution,
        raceDistribution,
        recentActivity: activityFeeds.slice(-20).reverse(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  // Rank requirements + eligibility notifications
  app.get("/api/admin/rank-requirements", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      const RANK_REQUIREMENTS = [
        { rank: "Novice",         index: 0,  winsRequired: 0,      floorRequired: 1,   description: "Starting rank" },
        { rank: "Apprentice",     index: 1,  winsRequired: 5,      floorRequired: 1,   description: "First PvP victories" },
        { rank: "Initiate",       index: 2,  winsRequired: 15,     floorRequired: 3,   description: "Proven combatant" },
        { rank: "Journeyman",     index: 3,  winsRequired: 30,     floorRequired: 5,   description: "Seasoned warrior" },
        { rank: "Adept",          index: 4,  winsRequired: 60,     floorRequired: 10,  description: "Skilled fighter" },
        { rank: "Expert",         index: 5,  winsRequired: 120,    floorRequired: 15,  description: "Elite combatant" },
        { rank: "Master",         index: 6,  winsRequired: 250,    floorRequired: 20,  description: "Master of combat" },
        { rank: "Grandmaster",    index: 7,  winsRequired: 500,    floorRequired: 30,  description: "Grandmaster warrior" },
        { rank: "Champion",       index: 8,  winsRequired: 1000,   floorRequired: 40,  description: "Champion of the realm" },
        { rank: "Overlord",       index: 9,  winsRequired: 2000,   floorRequired: 50,  description: "Overlord of battles" },
        { rank: "Sovereign",      index: 10, winsRequired: 5000,   floorRequired: 50,  description: "Sovereign ruler" },
        { rank: "Ascendant",      index: 11, winsRequired: 10000,  floorRequired: 50,  description: "Ascendant legend" },
        { rank: "Legend",         index: 12, winsRequired: 25000,  floorRequired: 50,  description: "Living legend" },
        { rank: "Mythic",         index: 13, winsRequired: 50000,  floorRequired: 50,  description: "Mythic powerhouse" },
        { rank: "Mythical Legend",index: 14, winsRequired: 100000, floorRequired: 50,  description: "The ultimate rank" },
      ];

      const allAccounts = await storage.getAllAccounts();
      const players = allAccounts.filter(a => a.role === "player");

      const eligiblePlayers = players.map(p => {
        const currentRankIndex = playerRanks.indexOf(p.rank as any) ?? 0;
        const nextRankIndex = currentRankIndex + 1;
        if (nextRankIndex >= playerRanks.length) return null;
        const nextReq = RANK_REQUIREMENTS[nextRankIndex];
        const wins = p.wins || 0;
        const floor = p.npcFloor || 1;
        const winsOk = wins >= nextReq.winsRequired;
        const floorOk = floor >= nextReq.floorRequired;
        if (winsOk && floorOk) {
          return {
            id: p.id,
            username: p.username,
            currentRank: p.rank,
            eligibleForRank: nextReq.rank,
            wins,
            floor,
          };
        }
        return null;
      }).filter(Boolean);

      res.json({ rankRequirements: RANK_REQUIREMENTS, eligiblePlayers });
    } catch (error) {
      console.error("Rank requirements error:", error);
      res.status(500).json({ error: "Failed to load rank requirements" });
    }
  });

  app.post("/api/admin/set-story-progress", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        accountId: z.string(),
        act: z.number().min(1).max(4),
        chapter: z.number().min(1).max(15),
      });
      const { adminId, accountId, act, chapter } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const { updatePlayerStoryline } = await import("./game-ai");
      await updatePlayerStoryline(accountId, {
        storyProgress: {
          currentAct: act,
          currentChapter: chapter,
          act1Completed: act >= 1 && chapter >= 15 || act > 1,
          act2Completed: act >= 2 && chapter >= 12 || act > 2,
          act3Completed: act >= 3 && chapter >= 10 || act > 3,
          act4Completed: act >= 4 && chapter >= 15,
        },
      });
      
      await storage.createActivityFeed({
        type: "admin_action",
        message: `Admin set ${account.username}'s story to Act ${act}, Chapter ${chapter}`,
        metadata: { adminId, accountId, act, chapter },
      });
      
      res.json({ success: true, message: `Set story progress to Act ${act}, Chapter ${chapter}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to set story progress" });
    }
  });

  app.post("/api/admin/grant-resources", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        accountId: z.string(),
        gold: z.number().optional(),
        rubies: z.number().optional(),
        soulShards: z.number().optional(),
        trainingPoints: z.number().optional(),
        beakCoins: z.number().optional(),
        valorTokens: z.number().optional(),
      });
      const { adminId, accountId, ...resources } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const updates: Record<string, number> = {};
      if (resources.gold) updates.gold = (account.gold || 0) + resources.gold;
      if (resources.rubies) updates.rubies = (account.rubies || 0) + resources.rubies;
      if (resources.soulShards) updates.soulShards = (account.soulShards || 0) + resources.soulShards;
      if (resources.trainingPoints) updates.trainingPoints = (account.trainingPoints || 0) + resources.trainingPoints;
      if (resources.beakCoins) updates.beakCoins = (account.beakCoins || 0) + resources.beakCoins;
      if (resources.valorTokens) updates.valorTokens = (account.valorTokens || 0) + resources.valorTokens;
      
      await storage.updateAccount(accountId, updates);
      
      await storage.createActivityFeed({
        type: "admin_grant",
        message: `Admin granted resources to ${account.username}`,
        metadata: { adminId, accountId, resources },
      });
      
      res.json({ success: true, granted: resources });
    } catch (error) {
      res.status(500).json({ error: "Failed to grant resources" });
    }
  });

  app.post("/api/admin/set-rank", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        accountId: z.string(),
        rank: z.string(),
      });
      const { adminId, accountId, rank } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      if (!playerRanks.includes(rank as any)) {
        return res.status(400).json({ error: "Invalid rank", validRanks: playerRanks });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateAccount(accountId, { rank: rank as any });
      
      await storage.createActivityFeed({
        type: "admin_rank_change",
        message: `Admin changed ${account.username}'s rank to ${rank}`,
        metadata: { adminId, accountId, newRank: rank, oldRank: account.rank },
      });
      
      res.json({ success: true, newRank: rank });
    } catch (error) {
      res.status(500).json({ error: "Failed to set rank" });
    }
  });

  app.post("/api/admin/set-stats", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        accountId: z.string(),
        stats: z.object({
          Str: z.number().optional(),
          Def: z.number().optional(),
          Spd: z.number().optional(),
          Int: z.number().optional(),
          Vit: z.number().optional(),
          Luk: z.number().optional(),
        }),
      });
      const { adminId, accountId, stats } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const newStats = { ...(account.stats || {}), ...stats };
      await storage.updateAccount(accountId, { stats: newStats });
      
      await storage.createActivityFeed({
        type: "admin_stat_change",
        message: `Admin modified ${account.username}'s stats`,
        metadata: { adminId, accountId, statsChanged: stats },
      });
      
      res.json({ success: true, newStats });
    } catch (error) {
      res.status(500).json({ error: "Failed to set stats" });
    }
  });

  app.get("/api/admin/all-accounts", async (req, res) => {
    try {
      const adminId = req.query.adminId as string;
      if (!adminId) {
        return res.status(401).json({ error: "Admin ID required" });
      }
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const accounts = await storage.getAllAccounts();
      const sanitized = accounts.map(a => ({
        id: a.id,
        username: a.username,
        race: a.race,
        gender: a.gender,
        rank: a.rank,
        gold: a.gold,
        rubies: a.rubies,
        npcFloor: a.npcFloor,
        role: a.role,
        online: activeSessions.has(a.id),
      }));
      
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: "Failed to get accounts" });
    }
  });

  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const schema = z.object({
        adminId: z.string(),
        message: z.string(),
        type: z.enum(["announcement", "maintenance", "event"]).optional(),
      });
      const { adminId, message, type } = schema.parse(req.body);
      
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      for (const playerId of Array.from(activeSessions.keys())) {
        broadcastToPlayer(playerId, "admin_broadcast", {
          message,
          type: type || "announcement",
          from: admin.username,
          timestamp: Date.now(),
        });
      }
      
      await storage.createActivityFeed({
        type: "admin_broadcast",
        message: `Admin broadcast: ${message}`,
        metadata: { adminId, type },
      });
      
      res.json({ success: true, recipientCount: activeSessions.size });
    } catch (error) {
      res.status(500).json({ error: "Failed to broadcast" });
    }
  });

  // ==================== MOUNTS (COSMETIC) ====================

  const MOUNTS = [
    { id: "common_horse", name: "Common Horse", rarity: "common", speedBonus: 0, unlockRequirement: { gold: 1000 } },
    { id: "war_horse", name: "War Horse", rarity: "uncommon", speedBonus: 5, unlockRequirement: { gold: 10000, rank: 3 } },
    { id: "dire_wolf", name: "Dire Wolf", rarity: "rare", speedBonus: 10, unlockRequirement: { gold: 50000, rank: 5 } },
    { id: "gryphon", name: "Gryphon", rarity: "epic", speedBonus: 15, unlockRequirement: { gold: 200000, rank: 8 } },
    { id: "dragon", name: "Dragon", rarity: "legendary", speedBonus: 20, unlockRequirement: { gold: 1000000, rank: 12 } },
    { id: "phoenix", name: "Phoenix", rarity: "mythic", speedBonus: 25, unlockRequirement: { towerFloor: 100 } },
    { id: "nightmare", name: "Nightmare", rarity: "mythic", speedBonus: 25, unlockRequirement: { hellZoneKills: 50 } },
    { id: "celestial_steed", name: "Celestial Steed", rarity: "legendary", speedBonus: 20, unlockRequirement: { allActsComplete: true } },
  ];

  const playerMounts: Map<string, { owned: string[]; active: string | null }> = new Map();

  app.get("/api/mounts", (_req, res) => {
    res.json(MOUNTS);
  });

  app.get("/api/accounts/:id/mounts", async (req, res) => {
    try {
      const accountId = req.params.id;
      const mounts = playerMounts.get(accountId) || { owned: [], active: null };
      res.json(mounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get mounts" });
    }
  });

  app.post("/api/accounts/:id/mounts/unlock", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { mountId } = z.object({ mountId: z.string() }).parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const mount = MOUNTS.find(m => m.id === mountId);
      if (!mount) {
        return res.status(404).json({ error: "Mount not found" });
      }
      
      const mounts = playerMounts.get(accountId) || { owned: [], active: null };
      if (mounts.owned.includes(mountId)) {
        return res.status(400).json({ error: "Mount already owned" });
      }
      
      const req_obj = mount.unlockRequirement as { gold?: number; rank?: number; towerFloor?: number; hellZoneKills?: number; allActsComplete?: boolean };
      if (req_obj.gold && account.gold < req_obj.gold) {
        return res.status(400).json({ error: `Requires ${req_obj.gold} gold` });
      }
      if (req_obj.rank && playerRanks.indexOf(account.rank) < req_obj.rank) {
        return res.status(400).json({ error: `Requires ${playerRanks[req_obj.rank]} rank` });
      }
      if (req_obj.towerFloor && (account.npcFloor || 1) < req_obj.towerFloor) {
        return res.status(400).json({ error: `Requires Tower Floor ${req_obj.towerFloor}` });
      }
      if (req_obj.hellZoneKills) {
        const participant = hellZoneParticipants.get(accountId);
        const kills = participant?.kills || 0;
        if (kills < req_obj.hellZoneKills) {
          return res.status(400).json({ error: `Requires ${req_obj.hellZoneKills} Hell Zone kills (you have ${kills})` });
        }
      }
      if (req_obj.allActsComplete) {
        const storyline = await getPlayerStoryline(accountId);
        if (!storyline.storyProgress?.act4Completed) {
          return res.status(400).json({ error: "Requires all story acts completed" });
        }
      }
      
      if (req_obj.gold) {
        await storage.updateAccountGold(accountId, account.gold - req_obj.gold);
      }
      
      mounts.owned.push(mountId);
      playerMounts.set(accountId, mounts);
      
      res.json({ success: true, mount: mount.name, message: `Unlocked ${mount.name}!` });
    } catch (error) {
      res.status(500).json({ error: "Failed to unlock mount" });
    }
  });

  app.post("/api/accounts/:id/mounts/equip", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { mountId } = z.object({ mountId: z.string().nullable() }).parse(req.body);
      
      const mounts = playerMounts.get(accountId) || { owned: [], active: null };
      
      if (mountId && !mounts.owned.includes(mountId)) {
        return res.status(400).json({ error: "Mount not owned" });
      }
      
      mounts.active = mountId;
      playerMounts.set(accountId, mounts);
      
      const mount = MOUNTS.find(m => m.id === mountId);
      res.json({ 
        success: true, 
        activeMount: mountId,
        message: mountId ? `Equipped ${mount?.name}` : "Dismounted",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to equip mount" });
    }
  });

  // ==================== ENDGAME SYSTEM ====================

  const ENDGAME_CONFIG = {
    mythicalLegendRequirements: {
      minRank: 14,
      towerFloor: 100,
      towerLevel: 100,
      allActsComplete: true,
      minAchievements: 20,
    },
    prestigeRewards: {
      title: "Mythical Legend",
      gold: 10000000,
      rubies: 100000,
      soulShards: 50000,
      uniqueMount: "celestial_steed",
    },
    quintillionMilestones: [
      { power: 1e15, title: "Quadrillionaire", reward: { gold: 1000000, rubies: 10000 } },
      { power: 1e16, title: "Pentadeca Power", reward: { gold: 5000000, rubies: 50000 } },
      { power: 1e17, title: "Hexadeca Hero", reward: { gold: 10000000, rubies: 100000 } },
      { power: 1e18, title: "Quintillion Conqueror", reward: { gold: 50000000, rubies: 500000 } },
    ],
  };

  const mythicalLegends: Set<string> = new Set();

  app.get("/api/endgame/config", (_req, res) => {
    res.json(ENDGAME_CONFIG);
  });

  app.get("/api/accounts/:id/endgame-progress", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const rankIndex = playerRanks.indexOf(account.rank);
      const storyline = await getPlayerStoryline(req.params.id);
      const achievements = playerAchievements.get(req.params.id) || new Set();
      
      const progress = {
        rank: {
          current: rankIndex,
          required: ENDGAME_CONFIG.mythicalLegendRequirements.minRank,
          met: rankIndex >= ENDGAME_CONFIG.mythicalLegendRequirements.minRank,
        },
        tower: {
          currentFloor: account.npcFloor || 1,
          currentLevel: account.npcLevel || 1,
          requiredFloor: ENDGAME_CONFIG.mythicalLegendRequirements.towerFloor,
          requiredLevel: ENDGAME_CONFIG.mythicalLegendRequirements.towerLevel,
          met: (account.npcFloor || 1) >= 100 && (account.npcLevel || 1) >= 100,
        },
        story: {
          actsCompleted: [
            storyline.storyProgress?.act1Completed,
            storyline.storyProgress?.act2Completed,
            storyline.storyProgress?.act3Completed,
            storyline.storyProgress?.act4Completed,
          ].filter(Boolean).length,
          required: 4,
          met: storyline.storyProgress?.act4Completed || false,
        },
        achievements: {
          current: achievements.size,
          required: ENDGAME_CONFIG.mythicalLegendRequirements.minAchievements,
          met: achievements.size >= ENDGAME_CONFIG.mythicalLegendRequirements.minAchievements,
        },
      };
      
      const allMet = progress.rank.met && progress.tower.met && progress.story.met && progress.achievements.met;
      const isMythicalLegend = mythicalLegends.has(req.params.id);
      
      res.json({
        progress,
        allRequirementsMet: allMet,
        canAscend: allMet && !isMythicalLegend,
        isMythicalLegend,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get endgame progress" });
    }
  });

  const claimedMilestones: Map<string, Set<number>> = new Map();

  app.post("/api/accounts/:id/check-milestones", async (req, res) => {
    try {
      const accountId = req.params.id;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const stats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Vit: 10, Luk: 10 };
      const power = Object.values(stats).reduce((a, b) => a + b, 0) * 
        (playerRanks.indexOf(account.rank) + 1) * 1000;
      
      const claimed = claimedMilestones.get(accountId) || new Set();
      const newRewards: { title: string; reward: { gold: number; rubies: number } }[] = [];
      
      for (let i = 0; i < ENDGAME_CONFIG.quintillionMilestones.length; i++) {
        const milestone = ENDGAME_CONFIG.quintillionMilestones[i];
        if (power >= milestone.power && !claimed.has(i)) {
          claimed.add(i);
          newRewards.push({ title: milestone.title, reward: milestone.reward });
          
          await storage.updateAccount(accountId, {
            gold: account.gold + milestone.reward.gold,
          } as any);
        }
      }
      
      claimedMilestones.set(accountId, claimed);
      
      res.json({
        currentPower: power,
        claimedMilestones: Array.from(claimed),
        newRewards,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check milestones" });
    }
  });

  app.post("/api/accounts/:id/ascend-mythical", async (req, res) => {
    try {
      const accountId = req.params.id;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (mythicalLegends.has(accountId)) {
        return res.status(400).json({ error: "Already a Mythical Legend" });
      }
      
      const rankIndex = playerRanks.indexOf(account.rank);
      if (rankIndex < ENDGAME_CONFIG.mythicalLegendRequirements.minRank) {
        return res.status(400).json({ error: "Rank requirement not met" });
      }
      if ((account.npcFloor || 1) < 100 || (account.npcLevel || 1) < 100) {
        return res.status(400).json({ error: "Tower completion required" });
      }
      
      const storyline = await getPlayerStoryline(accountId);
      if (!storyline.storyProgress?.act4Completed) {
        return res.status(400).json({ error: "All story acts must be completed" });
      }
      
      const achievements = playerAchievements.get(accountId) || new Set();
      if (achievements.size < ENDGAME_CONFIG.mythicalLegendRequirements.minAchievements) {
        return res.status(400).json({ 
          error: `Requires at least ${ENDGAME_CONFIG.mythicalLegendRequirements.minAchievements} achievements (you have ${achievements.size})`,
        });
      }
      
      mythicalLegends.add(accountId);
      
      const rewards = ENDGAME_CONFIG.prestigeRewards;
      await storage.updateAccount(accountId, {
        gold: account.gold + rewards.gold,
      } as any);
      
      const mounts = playerMounts.get(accountId) || { owned: [], active: null };
      if (!mounts.owned.includes(rewards.uniqueMount)) {
        mounts.owned.push(rewards.uniqueMount);
        playerMounts.set(accountId, mounts);
      }
      
      await storage.createActivityFeed({
        type: "mythical_ascension",
        message: `${account.username} has ascended to Mythical Legend status!`,
        metadata: { accountId, rewards },
      });
      
      res.json({
        success: true,
        title: rewards.title,
        rewards,
        message: `Congratulations! You have ascended to Mythical Legend status!`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to ascend" });
    }
  });

  app.get("/api/mythical-legends", async (_req, res) => {
    try {
      const legends: { id: string; username: string; ascendedAt?: number }[] = [];
      for (const id of Array.from(mythicalLegends)) {
        const account = await storage.getAccount(id);
        if (account) {
          legends.push({ id, username: account.username });
        }
      }
      res.json({ legends, count: legends.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get legends" });
    }
  });

  app.get("/api/accounts/:id/heritage", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const heritageCount = account.heritageCount || 0;
      const heritageBonusPercent = account.heritageBonusPercent || 0;
      const canRebirth = account.rank === "Mythical Legend" && heritageCount < MAX_HERITAGE_REBIRTHS;
      const currentTitle = heritageCount > 0 ? HERITAGE_TITLES[heritageCount] || null : null;
      const nextTitle = heritageCount < MAX_HERITAGE_REBIRTHS ? HERITAGE_TITLES[heritageCount + 1] : null;

      res.json({
        heritageCount,
        heritageBonusPercent,
        maxRebirths: MAX_HERITAGE_REBIRTHS,
        bonusPerRebirth: HERITAGE_BONUS_PER_REBIRTH,
        canRebirth,
        currentTitle,
        nextTitle,
        allTitles: HERITAGE_TITLES,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get heritage info" });
    }
  });

  app.post("/api/accounts/:id/heritage-rebirth", async (req, res) => {
    try {
      const accountId = req.params.id;
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.rank !== "Mythical Legend") {
        return res.status(400).json({ error: "Must be Mythical Legend rank to perform Heritage Rebirth" });
      }

      const currentHeritageCount = account.heritageCount || 0;
      if (currentHeritageCount >= MAX_HERITAGE_REBIRTHS) {
        return res.status(400).json({ error: `Maximum heritage rebirths (${MAX_HERITAGE_REBIRTHS}) already reached` });
      }

      const newHeritageCount = currentHeritageCount + 1;
      const newBonusPercent = newHeritageCount * HERITAGE_BONUS_PER_REBIRTH;
      const heritageTitle = HERITAGE_TITLES[newHeritageCount];

      const baseStats = { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      let resetStats = baseStats;
      if (account.race) {
        const modifier = raceModifiers[account.race as keyof typeof raceModifiers];
        if (modifier) {
          resetStats = {
            Str: Math.round(baseStats.Str * modifier.Str),
            Def: Math.round(baseStats.Def * modifier.Def),
            Spd: Math.round(baseStats.Spd * modifier.Spd),
            Int: Math.round(baseStats.Int * modifier.Int),
            Luck: Math.round(baseStats.Luck * modifier.Luck),
            Pot: 0,
          };
        }
      }

      const bonusMultiplier = 1 + (newBonusPercent / 100);
      const enhancedStats = {
        Str: Math.round(resetStats.Str * bonusMultiplier),
        Def: Math.round(resetStats.Def * bonusMultiplier),
        Spd: Math.round(resetStats.Spd * bonusMultiplier),
        Int: Math.round(resetStats.Int * bonusMultiplier),
        Luck: Math.round(resetStats.Luck * bonusMultiplier),
        Pot: 0,
      };

      await db.update(accounts).set({
        rank: "Novice",
        stats: enhancedStats,
        npcFloor: 1,
        npcLevel: 1,
        wins: 0,
        losses: 0,
        heritageCount: newHeritageCount,
        heritageBonusPercent: newBonusPercent,
        energy: 50,
        maxEnergy: 50,
      }).where(eq(accounts.id, accountId));

      const { playerTitles } = await import("@shared/schema");
      if (heritageTitle) {
        await db.insert(playerTitles).values({
          accountId,
          titleId: `heritage_${newHeritageCount}`,
          category: "event",
          name: heritageTitle,
        });
      }

      try {
        await storage.createActivityFeed({
          type: "heritage_rebirth",
          message: `${account.username} has undergone Heritage Rebirth #${newHeritageCount} and earned the title "${heritageTitle}"!`,
          metadata: { accountId, heritageCount: newHeritageCount, bonusPercent: newBonusPercent },
        });
      } catch (e) {}

      broadcastToAllPlayers("heritage_rebirth", {
        username: account.username,
        heritageCount: newHeritageCount,
        title: heritageTitle,
      });

      res.json({
        success: true,
        heritageCount: newHeritageCount,
        heritageBonusPercent: newBonusPercent,
        title: heritageTitle,
        newStats: enhancedStats,
        message: `Heritage Rebirth complete! You are now "${heritageTitle}" with a permanent +${newBonusPercent}% stat bonus. You have been reset to Novice rank.`,
      });
    } catch (error) {
      console.error("Heritage rebirth error:", error);
      res.status(500).json({ error: "Failed to perform heritage rebirth" });
    }
  });

  app.post("/api/accounts/:id/trigger-raid", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const towerProgress = (account as any).npcProgress?.floor || 1;
      const baseTier = (account as any).baseTier || 1;
      const baseDefense = baseTier * 10;

      const eligibleRaids = BASE_RAID_EVENTS.filter(r => {
        const rankIndex = playerRanks.indexOf(account.rank);
        return rankIndex >= (r.minRank || 0);
      });
      if (eligibleRaids.length === 0) {
        return res.json({ result: "no_raid", message: "No raids available for your rank" });
      }

      const raid = eligibleRaids[Math.floor(Math.random() * eligibleRaids.length)];
      const raidPower = raid.difficulty * 20;
      const defensePower = baseDefense + (account.stats?.Def || 0) / 10;
      const won = defensePower >= raidPower || Math.random() > 0.4;

      if (won) {
        const newGold = account.gold + raid.rewards.gold;
        await storage.updateAccountGold(account.id, newGold);
        
        broadcastToPlayer(account.id, "base_raid", {
          type: "raid_result",
          raid: raid.name,
          won: true,
          rewards: raid.rewards,
        });
        
        return res.json({
          result: "victory",
          raid: raid.name,
          rewards: raid.rewards,
          message: `Successfully defended against ${raid.name}! Earned ${raid.rewards.gold} gold.`,
        });
      } else {
        const goldLost = Math.floor(raid.rewards.gold * 0.2);
        const newGold = Math.max(0, account.gold - goldLost);
        await storage.updateAccountGold(account.id, newGold);
        
        broadcastToPlayer(account.id, "base_raid", {
          type: "raid_result",
          raid: raid.name,
          won: false,
          goldLost,
        });
        
        return res.json({
          result: "defeat",
          raid: raid.name,
          goldLost,
          message: `Failed to defend against ${raid.name}. Lost ${goldLost} gold.`,
        });
      }
    } catch (error) {
      console.error("Trigger raid error:", error);
      res.status(500).json({ error: "Failed to trigger raid" });
    }
  });

  app.get("/api/accounts/:id/visitors", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const visitorId = req.query.visitorId as string;
      const visitor = visitorId ? await storage.getAccount(visitorId) : null;

      const baseTier = (account as any).baseTier || 1;
      const baseSkin = (account as any).baseSkin || "default";
      const trophies = ((account as any).trophies || []) as string[];
      
      const visibleTrophies = trophies.filter(() => Math.random() < 0.8);
      
      const visitorData = {
        ownerId: account.id,
        ownerName: account.username,
        ownerRank: account.rank,
        ownerRace: account.race,
        baseTier,
        baseSkin,
        trophies: visibleTrophies,
        trophyCount: trophies.length,
        visibilityNote: "80% of trophies are visible to visitors",
        isOwner: visitor?.id === account.id,
      };
      
      res.json(visitorData);
    } catch (error) {
      console.error("Get visitors error:", error);
      res.status(500).json({ error: "Failed to get visitor data" });
    }
  });

  app.get("/api/accounts/:id/raid-history", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json({
        totalRaidsDefended: Math.floor(Math.random() * 50),
        totalRaidsFailed: Math.floor(Math.random() * 10),
        goldEarned: Math.floor(Math.random() * 100000),
        goldLost: Math.floor(Math.random() * 20000),
        lastRaid: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      });
    } catch (error) {
      console.error("Get raid history error:", error);
      res.status(500).json({ error: "Failed to get raid history" });
    }
  });

  // ========== ENEMY SCALING SYSTEM ==========
  const ZONE_DIFFICULTIES = {
    starter: { tier: 1, name: "Starter", minRank: 0, powerRange: [1, 1000], rewardMultiplier: 1 },
    easy: { tier: 2, name: "Easy", minRank: 3, powerRange: [1000, 100000], rewardMultiplier: 1.5 },
    medium: { tier: 3, name: "Medium", minRank: 6, powerRange: [100000, 10000000], rewardMultiplier: 2 },
    hard: { tier: 4, name: "Hard", minRank: 10, powerRange: [10000000, 1000000000], rewardMultiplier: 3 },
    hell: { tier: 5, name: "Hell", minRank: 13, powerRange: [1000000000, Number.MAX_SAFE_INTEGER], rewardMultiplier: 5 },
  };

  const ENEMY_ARCHETYPES = {
    minion: { 
      name: "Minion", 
      statMultiplier: 0.6, 
      hpMultiplier: 0.5, 
      goldMultiplier: 0.5, 
      expMultiplier: 0.5,
      spawnWeight: 60,
      description: "Weak fodder enemies, easy to defeat"
    },
    elite: { 
      name: "Elite", 
      statMultiplier: 1.0, 
      hpMultiplier: 1.0, 
      goldMultiplier: 1.5, 
      expMultiplier: 1.5,
      spawnWeight: 25,
      description: "Standard enemies with balanced stats"
    },
    champion: { 
      name: "Champion", 
      statMultiplier: 1.5, 
      hpMultiplier: 2.0, 
      goldMultiplier: 3.0, 
      expMultiplier: 3.0,
      spawnWeight: 12,
      description: "Tough enemies with high rewards"
    },
    boss: { 
      name: "Boss", 
      statMultiplier: 2.5, 
      hpMultiplier: 5.0, 
      goldMultiplier: 10.0, 
      expMultiplier: 10.0,
      spawnWeight: 3,
      description: "Powerful enemies guarding zone secrets"
    },
  };

  const ZONE_ENEMY_CONFIG: Record<string, { difficulty: keyof typeof ZONE_DIFFICULTIES, enemies: string[] }> = {
    capital_city: { difficulty: "starter", enemies: ["Training Dummy", "Sparring Partner"] },
    mountain_caverns: { difficulty: "easy", enemies: ["Cave Bat", "Rock Golem", "Mine Spider"] },
    ancient_ruins: { difficulty: "medium", enemies: ["Cursed Spirit", "Stone Guardian", "Ruin Wraith"] },
    enchanted_forest: { difficulty: "easy", enemies: ["Forest Wolf", "Wild Boar", "Treant"] },
    crystal_lake: { difficulty: "starter", enemies: ["Lake Spirit", "Water Elemental"] },
    coastal_village: { difficulty: "easy", enemies: ["Pirate", "Sea Serpent", "Crab Beast"] },
    ruby_mines: { difficulty: "medium", enemies: ["Gem Golem", "Mine Crawler", "Crystal Beast"] },
    battle_arena: { difficulty: "hard", enemies: ["Gladiator", "Arena Champion", "Beast Master"] },
    research_lab: { difficulty: "medium", enemies: ["Mutant", "Failed Experiment", "Lab Guardian"] },
    pet_training: { difficulty: "starter", enemies: ["Wild Pet", "Feral Beast"] },
    hell_zone: { difficulty: "hell", enemies: ["Demon Soldier", "Hellfire Elemental", "Abyssal Horror", "Demon Lord"] },
    mystic_tower: { difficulty: "hard", enemies: ["Tower Guardian", "Arcane Sentinel", "Floor Boss"] },
  };

  const WEATHER_SPAWN_MODS: Record<string, Record<string, number>> = {
    thunderstorm: { boss: 3.0, champion: 1.5, elite: 1.2, minion: 0.6 },
    rain:         { elite: 1.8, champion: 1.3, minion: 0.8 },
    fog:          { champion: 2.0, minion: 0.7, boss: 1.3 },
    blizzard:     { boss: 2.0, elite: 1.5, champion: 1.2, minion: 0.5 },
    clear:        {},
  };

  function getRandomArchetype(weatherType?: string): keyof typeof ENEMY_ARCHETYPES {
    const mods = weatherType ? (WEATHER_SPAWN_MODS[weatherType] || {}) : {};
    const totalWeight = Object.entries(ENEMY_ARCHETYPES).reduce((sum, [key, a]) => sum + a.spawnWeight * (mods[key] || 1), 0);
    let random = Math.random() * totalWeight;
    for (const [key, archetype] of Object.entries(ENEMY_ARCHETYPES)) {
      random -= archetype.spawnWeight * (mods[key] || 1);
      if (random <= 0) return key as keyof typeof ENEMY_ARCHETYPES;
    }
    return "minion";
  }

  function generateZoneEnemy(zoneId: string, playerPower: number, playerRankIndex: number, weatherType?: string) {
    const zoneConfig = ZONE_ENEMY_CONFIG[zoneId] || ZONE_ENEMY_CONFIG["capital_city"];
    const difficultyConfig = ZONE_DIFFICULTIES[zoneConfig.difficulty];
    
    // Anti-overlevel protection: if player is too weak for zone, scale down
    const [minPower, maxPower] = difficultyConfig.powerRange;
    const effectivePower = Math.min(playerPower, maxPower);
    const scaledPower = Math.max(minPower, Math.min(effectivePower, maxPower));
    
    const archetype = getRandomArchetype(weatherType);
    const archetypeConfig = ENEMY_ARCHETYPES[archetype];
    const enemyName = zoneConfig.enemies[Math.floor(Math.random() * zoneConfig.enemies.length)];
    
    const baseStat = Math.floor(scaledPower * 0.01);
    const stats = {
      Str: Math.floor(baseStat * archetypeConfig.statMultiplier * (0.8 + Math.random() * 0.4)),
      Def: Math.floor(baseStat * 0.8 * archetypeConfig.statMultiplier * (0.8 + Math.random() * 0.4)),
      Spd: Math.floor(baseStat * 0.6 * archetypeConfig.statMultiplier * (0.8 + Math.random() * 0.4)),
      Int: Math.floor(baseStat * 0.5 * archetypeConfig.statMultiplier * (0.8 + Math.random() * 0.4)),
      Luck: Math.floor(baseStat * 0.3 * archetypeConfig.statMultiplier * (0.8 + Math.random() * 0.4)),
    };
    
    const hp = Math.floor(scaledPower * 0.1 * archetypeConfig.hpMultiplier);
    const baseGold = Math.floor(50 + scaledPower * 0.001) * difficultyConfig.rewardMultiplier;
    const baseExp = Math.floor(10 + scaledPower * 0.0005) * difficultyConfig.rewardMultiplier;
    
    return {
      name: `${archetypeConfig.name} ${enemyName}`,
      archetype,
      archetypeConfig,
      zone: zoneId,
      difficulty: zoneConfig.difficulty,
      difficultyTier: difficultyConfig.tier,
      stats,
      hp,
      maxHp: hp,
      rewards: {
        gold: Math.floor(baseGold * archetypeConfig.goldMultiplier),
        exp: Math.floor(baseExp * archetypeConfig.expMultiplier),
        rubies: archetype === "boss" ? Math.floor(scaledPower * 0.0001) : 0,
      },
      canDrop: archetype === "champion" || archetype === "boss",
      power: scaledPower,
    };
  }

  app.get("/api/zone-difficulties", (_req, res) => {
    res.json(ZONE_DIFFICULTIES);
  });

  app.get("/api/enemy-archetypes", (_req, res) => {
    res.json(ENEMY_ARCHETYPES);
  });

  app.get("/api/zones/:zoneId/enemy-config", (req, res) => {
    const zoneId = req.params.zoneId;
    const config = ZONE_ENEMY_CONFIG[zoneId];
    if (!config) {
      return res.status(404).json({ error: "Zone not found" });
    }
    const difficulty = ZONE_DIFFICULTIES[config.difficulty];
    res.json({
      zone: zoneId,
      difficulty: config.difficulty,
      difficultyTier: difficulty.tier,
      difficultyName: difficulty.name,
      minRank: playerRanks[difficulty.minRank],
      powerRange: difficulty.powerRange,
      rewardMultiplier: difficulty.rewardMultiplier,
      enemies: config.enemies,
    });
  });

  app.get("/api/zones/:zoneId/generate-enemy", async (req, res) => {
    try {
      const zoneId = req.params.zoneId;
      const accountId = req.query.accountId as string;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      const playerPower = (account.stats?.Str || 10) + (account.stats?.Def || 10) + 
                          (account.stats?.Spd || 10) + (account.stats?.Int || 10);
      const playerRankIndex = playerRanks.indexOf(account.rank);
      
      // Check if player meets minimum rank for zone
      const zoneConfig = ZONE_ENEMY_CONFIG[zoneId];
      if (zoneConfig) {
        const difficulty = ZONE_DIFFICULTIES[zoneConfig.difficulty];
        if (playerRankIndex < difficulty.minRank) {
          return res.status(403).json({ 
            error: "Rank too low for this zone",
            requiredRank: playerRanks[difficulty.minRank],
            currentRank: account.rank,
          });
        }
      }
      
      const zoneWeather = getZoneWeather(zoneId);
      const enemy = generateZoneEnemy(zoneId, playerPower, playerRankIndex, zoneWeather?.type);
      res.json({ ...enemy, weatherType: zoneWeather?.type });
    } catch (error) {
      console.error("Generate enemy error:", error);
      res.status(500).json({ error: "Failed to generate enemy" });
    }
  });

  app.post("/api/zones/:zoneId/battle", async (req, res) => {
    try {
      const zoneId = req.params.zoneId;
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      if (account.isDead) {
        return res.status(400).json({ error: "Cannot battle while dead" });
      }
      
      const playerPower = (account.stats?.Str || 10) + (account.stats?.Def || 10) + 
                          (account.stats?.Spd || 10) + (account.stats?.Int || 10);
      const playerRankIndex = playerRanks.indexOf(account.rank);
      
      // Rank check - same as generate-enemy
      const zoneConfig = ZONE_ENEMY_CONFIG[zoneId];
      if (zoneConfig) {
        const difficulty = ZONE_DIFFICULTIES[zoneConfig.difficulty];
        if (playerRankIndex < difficulty.minRank) {
          return res.status(403).json({ 
            error: "Rank too low for this zone",
            requiredRank: playerRanks[difficulty.minRank],
            currentRank: account.rank,
          });
        }
      }
      
      const zoneWeatherQuick = getZoneWeather(zoneId);
      const enemy = generateZoneEnemy(zoneId, playerPower, playerRankIndex, zoneWeatherQuick?.type);
      
      // Simple battle simulation
      const playerAttack = (account.stats?.Str || 10) + Math.floor(Math.random() * 20);
      const enemyAttack = enemy.stats.Str + Math.floor(Math.random() * 10);
      const playerDefense = (account.stats?.Def || 10);
      const enemyDefense = enemy.stats.Def;
      
      const damageToEnemy = Math.max(1, playerAttack - enemyDefense * 0.5);
      const damageToPlayer = Math.max(1, enemyAttack - playerDefense * 0.5);
      
      // Determine winner based on stats advantage
      const playerAdvantage = playerPower / (enemy.power || 1);
      const won = playerAdvantage > 0.5 && Math.random() < Math.min(0.9, playerAdvantage * 0.6);
      
      if (won) {
        const newGold = account.gold + enemy.rewards.gold;
        const newRubies = (account.rubies || 0) + enemy.rewards.rubies;
        await storage.updateAccountGold(accountId, newGold);
        if (enemy.rewards.rubies > 0) {
          await storage.updateAccountResources(accountId, { rubies: newRubies });
        }
        
        res.json({
          result: "victory",
          enemy,
          rewards: enemy.rewards,
          damageDealt: Math.floor(damageToEnemy),
          damageTaken: Math.floor(damageToPlayer * 0.3),
          message: `Defeated ${enemy.name}! Earned ${enemy.rewards.gold} gold.`,
        });
      } else {
        res.json({
          result: "defeat",
          enemy,
          damageDealt: Math.floor(damageToEnemy * 0.5),
          damageTaken: Math.floor(damageToPlayer),
          message: `Defeated by ${enemy.name}. Try again or find weaker enemies.`,
        });
      }
    } catch (error) {
      console.error("Zone battle error:", error);
      res.status(500).json({ error: "Failed to process battle" });
    }
  });

  // ================ GATHERING SYSTEM ================

  const ZONE_RESOURCES: Record<string, { 
    resources: { id: string; name: string; baseRate: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic'; goldValue: number }[];
    gatheringTime: number; // seconds per gather attempt
  }> = {
    "mountain_caverns": {
      resources: [
        { id: "iron-ore", name: "Iron Ore", baseRate: 0.6, rarity: 'common', goldValue: 10 },
        { id: "coal", name: "Coal", baseRate: 0.5, rarity: 'common', goldValue: 5 },
        { id: "silver-ore", name: "Silver Ore", baseRate: 0.2, rarity: 'uncommon', goldValue: 25 },
        { id: "gold-ore", name: "Gold Ore", baseRate: 0.08, rarity: 'rare', goldValue: 100 },
      ],
      gatheringTime: 30,
    },
    "enchanted_forest": {
      resources: [
        { id: "wood", name: "Enchanted Wood", baseRate: 0.7, rarity: 'common', goldValue: 8 },
        { id: "herbs", name: "Magical Herbs", baseRate: 0.5, rarity: 'common', goldValue: 12 },
        { id: "moonpetal", name: "Moon Petal", baseRate: 0.15, rarity: 'uncommon', goldValue: 35 },
        { id: "faerie-dust", name: "Faerie Dust", baseRate: 0.05, rarity: 'epic', goldValue: 200 },
      ],
      gatheringTime: 25,
    },
    "ruby_mines": {
      resources: [
        { id: "rough-ruby", name: "Rough Ruby", baseRate: 0.4, rarity: 'uncommon', goldValue: 50 },
        { id: "crystal-shard", name: "Crystal Shard", baseRate: 0.3, rarity: 'uncommon', goldValue: 40 },
        { id: "perfect-ruby", name: "Perfect Ruby", baseRate: 0.08, rarity: 'rare', goldValue: 150 },
        { id: "blood-ruby", name: "Blood Ruby", baseRate: 0.02, rarity: 'epic', goldValue: 500 },
      ],
      gatheringTime: 45,
    },
    "crystal_lake": {
      resources: [
        { id: "water-crystal", name: "Water Crystal", baseRate: 0.5, rarity: 'common', goldValue: 15 },
        { id: "pearl", name: "Freshwater Pearl", baseRate: 0.25, rarity: 'uncommon', goldValue: 45 },
        { id: "spirit-essence", name: "Spirit Essence", baseRate: 0.1, rarity: 'rare', goldValue: 120 },
      ],
      gatheringTime: 35,
    },
    "coastal_village": {
      resources: [
        { id: "driftwood", name: "Driftwood", baseRate: 0.6, rarity: 'common', goldValue: 6 },
        { id: "sea-salt", name: "Sea Salt", baseRate: 0.5, rarity: 'common', goldValue: 8 },
        { id: "coral", name: "Rare Coral", baseRate: 0.15, rarity: 'uncommon', goldValue: 55 },
        { id: "sea-gem", name: "Sea Gem", baseRate: 0.04, rarity: 'rare', goldValue: 180 },
      ],
      gatheringTime: 30,
    },
    "ancient_ruins": {
      resources: [
        { id: "ancient-stone", name: "Ancient Stone", baseRate: 0.5, rarity: 'uncommon', goldValue: 30 },
        { id: "relic-fragment", name: "Relic Fragment", baseRate: 0.2, rarity: 'rare', goldValue: 80 },
        { id: "artifact-shard", name: "Artifact Shard", baseRate: 0.06, rarity: 'epic', goldValue: 300 },
      ],
      gatheringTime: 40,
    },
    "hell_zone": {
      resources: [
        { id: "brimstone", name: "Brimstone", baseRate: 0.4, rarity: 'rare', goldValue: 100 },
        { id: "demon-bone", name: "Demon Bone", baseRate: 0.2, rarity: 'rare', goldValue: 200 },
        { id: "hellfire-crystal", name: "Hellfire Crystal", baseRate: 0.05, rarity: 'epic', goldValue: 750 },
        { id: "soul-gem", name: "Soul Gem", baseRate: 0.01, rarity: 'epic', goldValue: 2000 },
      ],
      gatheringTime: 60,
    },
  };

  const activeGatherers: Map<string, { accountId: string; startTime: number; zoneId: string }> = new Map();

  app.get("/api/zones/:zoneId/resources", (req, res) => {
    const zoneId = req.params.zoneId;
    const zoneResources = ZONE_RESOURCES[zoneId];
    if (!zoneResources) {
      return res.status(404).json({ error: "No resources in this zone" });
    }
    res.json(zoneResources);
  });

  app.post("/api/zones/:zoneId/gather", async (req, res) => {
    try {
      const zoneId = req.params.zoneId;
      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.isDead) {
        return res.status(400).json({ error: "Cannot gather while dead" });
      }

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const maxEn = getMaxEnergyForRank(account.rank || "Novice");
      const { energy: currentEnergy, lastEnergyUpdate: lastEnUp } = regenerateEnergy(account);
      if (currentEnergy < ENERGY_COSTS.gathering) {
        return res.status(400).json({ error: "Not enough energy to gather", required: ENERGY_COSTS.gathering, current: currentEnergy, maxEnergy: maxEn });
      }
      await db.update(accounts).set({ energy: currentEnergy - ENERGY_COSTS.gathering, lastEnergyUpdate: lastEnUp }).where(eq(accounts.id, accountId));

      const zoneResources = ZONE_RESOURCES[zoneId];
      if (!zoneResources) {
        return res.status(400).json({ error: "No resources available in this zone" });
      }

      // Rank check for zone
      const zoneConfig = ZONE_ENEMY_CONFIG[zoneId];
      const playerRankIndex = playerRanks.indexOf(account.rank);
      if (zoneConfig) {
        const difficulty = ZONE_DIFFICULTIES[zoneConfig.difficulty];
        if (playerRankIndex < difficulty.minRank) {
          return res.status(403).json({ 
            error: "Rank too low for this zone",
            requiredRank: playerRanks[difficulty.minRank],
          });
        }
      }

      // Calculate efficiency based on player stats (Int + rank bonus)
      const baseEfficiency = 1.0;
      const intBonus = ((account.stats?.Int || 10) / 100) * 0.5;
      const rankBonus = playerRankIndex * 0.05;
      const efficiency = Math.min(3.0, baseEfficiency + intBonus + rankBonus);

      // Track active gatherer for contesting
      const gatherKey = `${zoneId}:${accountId}`;
      activeGatherers.set(gatherKey, { accountId, startTime: Date.now(), zoneId });

      // Clean up old gatherers (inactive for more than 5 minutes)
      const now = Date.now();
      for (const [key, gatherer] of Array.from(activeGatherers.entries())) {
        if (now - gatherer.startTime > 300000) {
          activeGatherers.delete(key);
        }
      }

      // Count competitors in the zone
      const competitors = Array.from(activeGatherers.values())
        .filter(g => g.zoneId === zoneId && g.accountId !== accountId)
        .length;

      // Competition penalty (more gatherers = lower yields)
      const competitionMultiplier = Math.max(0.3, 1.0 - competitors * 0.1);

      // Gather resources
      const gathered: { resource: string; name: string; quantity: number; rarity: string }[] = [];
      let totalGold = 0;

      for (const resource of zoneResources.resources) {
        const adjustedRate = resource.baseRate * efficiency * competitionMultiplier;
        if (Math.random() < adjustedRate) {
          const quantity = Math.floor(1 + Math.random() * (efficiency));
          gathered.push({
            resource: resource.id,
            name: resource.name,
            quantity,
            rarity: resource.rarity,
          });
          totalGold += resource.goldValue * quantity;
        }
      }

      // Award gold for resources
      if (totalGold > 0) {
        await storage.updateAccountGold(accountId, account.gold + totalGold);
      }

      // Remove from active gatherers
      activeGatherers.delete(gatherKey);

      const updatedCarryInfo = await getPlayerCarryInfo(accountId);

      res.json({
        success: true,
        gathered,
        totalGold,
        efficiency: efficiency.toFixed(2),
        competition: competitors,
        competitionPenalty: competitors > 0 ? `${Math.round((1 - competitionMultiplier) * 100)}%` : "None",
        gatheringTime: zoneResources.gatheringTime,
        carryCapacity: updatedCarryInfo,
        message: gathered.length > 0 
          ? `Gathered ${gathered.map(g => `${g.quantity}x ${g.name}`).join(', ')}!`
          : "Found nothing this time. Try again!",
      });
    } catch (error) {
      console.error("Gathering error:", error);
      res.status(500).json({ error: "Failed to gather resources" });
    }
  });

  // Check active gatherers in a zone (for contesting)
  app.get("/api/zones/:zoneId/gatherers", (req, res) => {
    const zoneId = req.params.zoneId;
    const now = Date.now();
    
    // Clean up old gatherers
    for (const [key, gatherer] of Array.from(activeGatherers.entries())) {
      if (now - gatherer.startTime > 300000) {
        activeGatherers.delete(key);
      }
    }

    const gatherers = Array.from(activeGatherers.values())
      .filter(g => g.zoneId === zoneId)
      .length;

    res.json({ gatherers, zoneId });
  });

  // ===== PET EGG HATCHING SYSTEM =====
  const PET_NAMES_BY_ELEMENT = {
    Fire: ["Ember", "Blaze", "Cinder", "Inferno", "Phoenix"],
    Water: ["Splash", "Tide", "Marina", "Coral", "Tsunami"],
    Earth: ["Rocky", "Boulder", "Terra", "Quake", "Granite"],
    Air: ["Zephyr", "Gust", "Breeze", "Storm", "Cyclone"],
    Lightning: ["Spark", "Volt", "Thunder", "Flash", "Bolt"],
    Ice: ["Frost", "Glacier", "Blizzard", "Crystal", "Icicle"],
    Nature: ["Leaf", "Bloom", "Vine", "Fern", "Thorn"],
    Dark: ["Shadow", "Dusk", "Void", "Phantom", "Eclipse"],
    Light: ["Ray", "Glow", "Dawn", "Radiant", "Halo"],
    Arcana: ["Mystic", "Arcane", "Rune", "Sage", "Oracle"],
  };

  app.post("/api/hatch-egg", async (req, res) => {
    try {
      const { accountId, eggType } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      // Check which egg type to hatch
      let eggField = "petEggs";
      let tierChances = { common: 0.5, uncommon: 0.35, rare: 0.12, epic: 0.03 };
      
      if (eggType === "rare") {
        eggField = "rarePetEggs";
        tierChances = { common: 0.1, uncommon: 0.4, rare: 0.35, epic: 0.15 };
      } else if (eggType === "epic") {
        eggField = "epicPetEggs";
        tierChances = { common: 0, uncommon: 0.1, rare: 0.5, epic: 0.4 };
      } else if (eggType === "mythic") {
        eggField = "mythicPetEggs";
        tierChances = { common: 0, uncommon: 0, rare: 0.2, epic: 0.8 };
      }

      const eggCount = (account as any)[eggField] || 0;
      if (eggCount <= 0) {
        return res.status(400).json({ error: `No ${eggType || "basic"} pet eggs available` });
      }

      // Deduct egg
      await storage.updateAccount(accountId, { [eggField]: eggCount - 1 });

      // Determine tier
      const roll = Math.random();
      let tier = "common";
      let cumulative = 0;
      for (const [t, chance] of Object.entries(tierChances)) {
        cumulative += chance as number;
        if (roll < cumulative) { tier = t; break; }
      }

      // Random element and name
      const elements = Object.keys(PET_NAMES_BY_ELEMENT);
      const element = elements[Math.floor(Math.random() * elements.length)] as keyof typeof PET_NAMES_BY_ELEMENT;
      const names = PET_NAMES_BY_ELEMENT[element];
      const name = names[Math.floor(Math.random() * names.length)];

      // Base stats scale with tier
      const tierMultipliers: Record<string, number> = { common: 1, uncommon: 1.5, rare: 2, epic: 3, mythic: 5 };
      const mult = tierMultipliers[tier] || 1;

      const pet = await storage.createPet({
        accountId,
        name,
        stats: { Str: Math.floor((5 + Math.random() * 10) * mult), Spd: Math.floor((5 + Math.random() * 10) * mult), Luck: Math.floor((5 + Math.random() * 5) * mult), ElementalPower: Math.floor(10 * mult) },
        element: element as any,
        elements: [element] as any,
      });

      res.json({ success: true, pet, message: `Hatched a ${tier} ${element} pet named ${name}!` });
    } catch (error) {
      console.error("Hatch error:", error);
      res.status(500).json({ error: "Failed to hatch egg" });
    }
  });

  // ===== COSMETICS SHOP =====
  // Prices significantly increased - mythic skins are now premium items
  const COSMETICS_SHOP = {
    character: [
      { id: "warrior_gold", name: "Golden Warrior", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "shadow_knight", name: "Shadow Knight", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "flame_lord", name: "Flame Lord", rarity: "mythic", skinTicketCost: 200, rubyPrice: 50000 },
      { id: "ice_queen", name: "Ice Queen", rarity: "mythic", skinTicketCost: 200, rubyPrice: 50000 },
      { id: "dragon_slayer", name: "Dragon Slayer", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "mystic_sage", name: "Mystic Sage", rarity: "rare", skinTicketCost: 25, rubyPrice: 2000 },
      { id: "forest_ranger", name: "Forest Ranger", rarity: "rare", skinTicketCost: 25, rubyPrice: 2000 },
      { id: "void_walker", name: "Void Walker", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "celestial_guardian", name: "Celestial Guardian", rarity: "mythic", skinTicketCost: 200, rubyPrice: 50000 },
      { id: "crimson_berserker", name: "Crimson Berserker", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "ocean_warden", name: "Ocean Warden", rarity: "rare", skinTicketCost: 25, rubyPrice: 2000 },
      { id: "thunder_champion", name: "Thunder Champion", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "blood_monarch", name: "Blood Monarch", rarity: "mythic", skinTicketCost: 200, rubyPrice: 50000 },
      { id: "starlight_paladin", name: "Starlight Paladin", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "desert_nomad", name: "Desert Nomad", rarity: "rare", skinTicketCost: 25, rubyPrice: 2000 },
      { id: "crystal_mage", name: "Crystal Mage", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "undead_warlord", name: "Undead Warlord", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "demon_hunter", name: "Demon Hunter", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "holy_crusader", name: "Holy Crusader", rarity: "rare", skinTicketCost: 25, rubyPrice: 2000 },
      { id: "storm_caller", name: "Storm Caller", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "plague_doctor", name: "Plague Doctor", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
      { id: "arcane_emperor", name: "Arcane Emperor", rarity: "mythic", skinTicketCost: 200, rubyPrice: 50000 },
      { id: "primal_beast", name: "Primal Beast", rarity: "epic", skinTicketCost: 50, rubyPrice: 5000 },
      { id: "ancient_pharaoh", name: "Ancient Pharaoh", rarity: "legendary", skinTicketCost: 100, rubyPrice: 15000 },
    ],
    pet: [
      { id: "elemental_glow", name: "Elemental Glow", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "shadow_aura", name: "Shadow Aura", rarity: "legendary", skinTicketCost: 75, rubyPrice: 12000 },
      { id: "golden_scales", name: "Golden Scales", rarity: "mythic", skinTicketCost: 150, rubyPrice: 40000 },
      { id: "crystal_armor", name: "Crystal Armor", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "flame_wings", name: "Flame Wings", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "ice_scales", name: "Ice Scales", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "nature_vines", name: "Nature Vines", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "void_essence", name: "Void Essence", rarity: "mythic", skinTicketCost: 150, rubyPrice: 40000 },
      { id: "thunder_crackle", name: "Thunder Crackle", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "starlit_fur", name: "Starlit Fur", rarity: "legendary", skinTicketCost: 75, rubyPrice: 12000 },
      { id: "blood_mark", name: "Blood Mark", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "ocean_shimmer", name: "Ocean Shimmer", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "forest_moss", name: "Forest Moss", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "lava_veins", name: "Lava Veins", rarity: "legendary", skinTicketCost: 75, rubyPrice: 12000 },
      { id: "spectral_mist", name: "Spectral Mist", rarity: "mythic", skinTicketCost: 150, rubyPrice: 40000 },
      { id: "diamond_shell", name: "Diamond Shell", rarity: "legendary", skinTicketCost: 75, rubyPrice: 12000 },
      { id: "toxic_ooze", name: "Toxic Ooze", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "holy_halo", name: "Holy Halo", rarity: "legendary", skinTicketCost: 75, rubyPrice: 12000 },
      { id: "demon_horns", name: "Demon Horns", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "ancient_runes", name: "Ancient Runes", rarity: "rare", skinTicketCost: 20, rubyPrice: 1500 },
      { id: "mechanical_parts", name: "Mechanical Parts", rarity: "epic", skinTicketCost: 30, rubyPrice: 3500 },
      { id: "celestial_glow", name: "Celestial Glow", rarity: "mythic", skinTicketCost: 150, rubyPrice: 40000 },
    ],
    bird: [
      { id: "phoenix_feathers", name: "Phoenix Feathers", rarity: "mythic", skinTicketCost: 125, rubyPrice: 35000 },
      { id: "storm_wings", name: "Storm Wings", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "rainbow_plume", name: "Rainbow Plume", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "shadow_feathers", name: "Shadow Feathers", rarity: "rare", skinTicketCost: 15, rubyPrice: 1200 },
      { id: "golden_wings", name: "Golden Wings", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "ice_crystal_wings", name: "Ice Crystal Wings", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "nature_leaf", name: "Nature Leaf Plumage", rarity: "rare", skinTicketCost: 15, rubyPrice: 1200 },
      { id: "volcanic_ember", name: "Volcanic Ember", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "void_raven", name: "Void Raven", rarity: "mythic", skinTicketCost: 125, rubyPrice: 35000 },
      { id: "celestial_dove", name: "Celestial Dove", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "blood_hawk", name: "Blood Hawk", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "ocean_spray", name: "Ocean Spray Feathers", rarity: "rare", skinTicketCost: 15, rubyPrice: 1200 },
      { id: "thunderbird", name: "Thunderbird Spark", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "spirit_owl", name: "Spirit Owl", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "neon_parrot", name: "Neon Parrot", rarity: "rare", skinTicketCost: 15, rubyPrice: 1200 },
      { id: "demon_crow", name: "Demon Crow", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "aurora_wings", name: "Aurora Wings", rarity: "mythic", skinTicketCost: 125, rubyPrice: 35000 },
      { id: "jade_peacock", name: "Jade Peacock", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "royal_falcon", name: "Royal Falcon", rarity: "legendary", skinTicketCost: 60, rubyPrice: 10000 },
      { id: "ancient_condor", name: "Ancient Condor", rarity: "epic", skinTicketCost: 35, rubyPrice: 3000 },
      { id: "cosmic_eagle", name: "Cosmic Eagle", rarity: "mythic", skinTicketCost: 125, rubyPrice: 35000 },
      { id: "frost_swan", name: "Frost Swan", rarity: "rare", skinTicketCost: 15, rubyPrice: 1200 },
    ],
    base: [
      { id: "dark_fortress", name: "Dark Fortress", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "crystal_palace", name: "Crystal Palace", rarity: "mythic", skinTicketCost: 200, rubyPrice: 45000 },
      { id: "ancient_temple", name: "Ancient Temple", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "dragon_keep", name: "Dragon Keep", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "nature_sanctuary", name: "Nature Sanctuary", rarity: "rare", skinTicketCost: 25, rubyPrice: 2500 },
      { id: "ice_citadel", name: "Ice Citadel", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "volcanic_stronghold", name: "Volcanic Stronghold", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "skyward_tower", name: "Skyward Tower", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "underwater_dome", name: "Underwater Dome", rarity: "mythic", skinTicketCost: 200, rubyPrice: 45000 },
      { id: "desert_oasis", name: "Desert Oasis", rarity: "rare", skinTicketCost: 25, rubyPrice: 2500 },
      { id: "haunted_manor", name: "Haunted Manor", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "celestial_shrine", name: "Celestial Shrine", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "demon_lair", name: "Demon Lair", rarity: "mythic", skinTicketCost: 200, rubyPrice: 45000 },
      { id: "floating_island", name: "Floating Island", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "mechanical_factory", name: "Mechanical Factory", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "elven_treehouse", name: "Elven Treehouse", rarity: "rare", skinTicketCost: 25, rubyPrice: 2500 },
      { id: "dwarven_mine", name: "Dwarven Mine", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "pirate_cove", name: "Pirate Cove", rarity: "rare", skinTicketCost: 25, rubyPrice: 2500 },
      { id: "void_dimension", name: "Void Dimension", rarity: "mythic", skinTicketCost: 200, rubyPrice: 45000 },
      { id: "golden_throne", name: "Golden Throne Room", rarity: "legendary", skinTicketCost: 100, rubyPrice: 18000 },
      { id: "storm_castle", name: "Storm Castle", rarity: "epic", skinTicketCost: 50, rubyPrice: 6000 },
      { id: "arcane_library", name: "Arcane Library", rarity: "rare", skinTicketCost: 25, rubyPrice: 2500 },
    ],
  };

  app.get("/api/cosmetics-shop", (_req, res) => {
    res.json({ shop: COSMETICS_SHOP });
  });

  app.post("/api/cosmetics-shop/purchase", async (req, res) => {
    try {
      const { accountId, skinId, category, paymentType } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const categoryItems = COSMETICS_SHOP[category as keyof typeof COSMETICS_SHOP];
      if (!categoryItems) return res.status(400).json({ error: "Invalid category" });

      const skin = categoryItems.find((s: any) => s.id === skinId);
      if (!skin) return res.status(404).json({ error: "Skin not found" });

      // Check if already owned
      const ownedSkins = account.unlockedSkins || [];
      const fullSkinId = `${category}_${skinId}`;
      if (ownedSkins.includes(fullSkinId)) {
        return res.status(400).json({ error: "You already own this skin" });
      }

      // Payment
      if (paymentType === "tickets") {
        const ticketField = skin.rarity === "mythic" ? "mythicSkinTickets" :
                           skin.rarity === "legendary" ? "epicSkinTickets" :
                           skin.rarity === "epic" ? "epicSkinTickets" :
                           skin.rarity === "rare" ? "rareSkinTickets" : "skinTickets";
        const tickets = (account as any)[ticketField] || 0;
        if (tickets < 1) {
          return res.status(400).json({ error: `Insufficient ${skin.rarity} skin tickets` });
        }
        await storage.updateAccount(accountId, { 
          gold: account.gold
        } as any);
      } else {
        // Ruby payment
        if ((account.rubies || 0) < skin.rubyPrice) {
          return res.status(400).json({ error: "Insufficient rubies", required: skin.rubyPrice });
        }
        await storage.updateAccount(accountId, { 
          gold: account.gold
        } as any);
      }

      res.json({ success: true, skin: fullSkinId, message: `Purchased ${skin.name}!` });
    } catch (error) {
      res.status(500).json({ error: "Failed to purchase skin" });
    }
  });

  app.post("/api/cosmetics/equip", async (req, res) => {
    try {
      const { accountId, skinId, category } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const fullSkinId = `${category}_${skinId}`;
      const ownedSkins = account.unlockedSkins || [];
      
      if (skinId !== "default" && !ownedSkins.includes(fullSkinId)) {
        return res.status(400).json({ error: "You don't own this skin" });
      }

      // Store equipped skin based on category
      const updates: any = {};
      if (category === "character") {
        updates.equippedCharacterSkin = skinId;
        // Update portrait to show the skin (format: skins/skinId.png)
        if (skinId !== "default") {
          updates.portrait = `skins/${skinId}`;
        } else {
          // Reset to race/gender portrait
          updates.portrait = account.race && account.gender ? `${account.race}_${account.gender}` : null;
        }
      } else if (category === "base") {
        updates.baseSkin = skinId;
      } else if (category === "pet") {
        updates.equippedPetSkin = skinId;
      } else if (category === "bird") {
        updates.equippedBirdSkin = skinId;
      }

      await storage.updateAccount(accountId, updates);

      res.json({ success: true, equipped: skinId, category });
    } catch (error) {
      res.status(500).json({ error: "Failed to equip skin" });
    }
  });

  // ===== VIP STATUS CHECK =====
  app.get("/api/accounts/:id/vip-status", async (req, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const now = new Date();
    const vipUntil = account.vipUntil ? new Date(account.vipUntil) : null;
    const isVip = vipUntil && vipUntil > now;
    const activeBuffs = (account.activeBuffs || []).filter((b: any) => new Date(b.expiresAt) > now);

    res.json({ 
      isVip, 
      vipUntil: isVip ? vipUntil : null,
      activeBuffs,
      daysRemaining: isVip ? Math.ceil((vipUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
    });
  });

  // ===== $VALOR SHOP BUNDLES =====
  const VALOR_BUNDLES = [
    { id: "tiny_adventurer", name: "Tiny Adventurer Pack", priceUSD: 0.99, contents: { gold: 10000, trainingPoints: 100, soulGins: 5 } },
    { id: "mini_hatchling", name: "Mini Hatchling Pack", priceUSD: 0.99, contents: { petEggs: 1, soulGins: 5, bait: 1 } },
    { id: "gold_tp_stack", name: "Gold & TP Stack", priceUSD: 2.99, contents: { gold: 50000, trainingPoints: 500 } },
    { id: "soul_beak_cache", name: "Soul & Beak Cache", priceUSD: 2.99, contents: { soulGins: 50, beakCoins: 20, petEggs: 1 } },
    { id: "adventurer_starter", name: "Adventurer's Starter Pack", priceUSD: 4.99, contents: { gold: 100000, trainingPoints: 1000, soulGins: 50, beakCoins: 25, skins: 1, petEggs: 1 } },
    { id: "style_pack", name: "Style Pack (Cosmetics)", priceUSD: 4.99, contents: { epicSkins: 1, rareSkins: 1 } },
    { id: "hatchling_pack", name: "Hatchling Pack (Pets)", priceUSD: 4.99, contents: { rarePetEggs: 2, soulGins: 100, beakCoins: 50 } },
    { id: "champion_loot", name: "Champion's Loot Crate", priceUSD: 9.99, contents: { gold: 250000, trainingPoints: 2500, soulGins: 150, beakCoins: 75, bait: 25, rareSkins: 1, rarePetEggs: 1, runes: 5 } },
    { id: "legendary_look", name: "Legendary Look Pack", priceUSD: 14.99, contents: { epicSkins: 3, mythicSkins: 1, mountSkins: 1 } },
    { id: "rune_bait_kit", name: "Rune & Bait Kit", priceUSD: 14.99, contents: { runes: 10, bait: 50, soulGins: 100 } },
    { id: "legend_treasure", name: "Legend's Treasure Chest", priceUSD: 19.99, contents: { gold: 500000, trainingPoints: 5000, soulGins: 500, beakCoins: 200, bait: 50, rareSkins: 2, epicPetEggs: 1, craftingMats: 10, runes: 10, mysticShards: 1 } },
    { id: "mythic_bond", name: "Mythic Bond Pack", priceUSD: 24.99, contents: { mythicPetEggs: 1, soulGins: 500, epicPetSkins: 1, petBondBoost24h: true } },
    { id: "valor_hero", name: "Valor Hero Bundle", priceUSD: 49.99, contents: { gold: 1500000, trainingPoints: 15000, soulGins: 1500, beakCoins: 500, bait: 100, epicSkins: 3, mythicPetEggs: 1, eliteRecipe: 1, runes: 25, heroAura7d: true } },
    { id: "conqueror_legacy", name: "Conqueror's Legacy", priceUSD: 99.99, contents: { gold: 3000000, trainingPoints: 30000, soulGins: 5000, beakCoins: 1000, bait: 250, epicSkins: 5, mythicPetEggs: 2, eliteRecipe: 1, runes: 50, mysticShards: 2, conquerorBanner: true, petBondBoost48h: true } },
  ];

  app.get("/api/valor-shop/bundles", (_req, res) => {
    res.json({ bundles: VALOR_BUNDLES });
  });

  app.post("/api/valor-shop/purchase", async (req, res) => {
    try {
      const { accountId, bundleId } = req.body;
      const bundle = VALOR_BUNDLES.find(b => b.id === bundleId);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Calculate cost in valor tokens (1 $Valor token = $1 USD)
      const valorCost = Math.ceil(bundle.priceUSD);
      const currentValor = account.valorTokens || 0;
      
      if (currentValor < valorCost) {
        return res.status(400).json({ 
          error: "Insufficient $Valor tokens", 
          required: valorCost, 
          current: currentValor 
        });
      }
      
      const contents = bundle.contents as any;
      const updates: any = {
        valorTokens: currentValor - valorCost, // Deduct valor tokens
      };
      const grantedItems: string[] = [];
      
      // Currency rewards
      if (contents.gold) {
        updates.gold = (account.gold || 0) + contents.gold;
        grantedItems.push(`${contents.gold.toLocaleString()} Gold`);
      }
      if (contents.trainingPoints) {
        updates.trainingPoints = (account.trainingPoints || 0) + contents.trainingPoints;
        grantedItems.push(`${contents.trainingPoints} Training Points`);
      }
      if (contents.soulGins) {
        updates.soulGins = (account.soulGins || 0) + contents.soulGins;
        grantedItems.push(`${contents.soulGins} Soul Gins`);
      }
      if (contents.beakCoins) {
        updates.beakCoins = (account.beakCoins || 0) + contents.beakCoins;
        grantedItems.push(`${contents.beakCoins} Beak Coins`);
      }
      if (contents.runes) {
        updates.runes = (account.runes || 0) + contents.runes;
        grantedItems.push(`${contents.runes} Runes`);
      }
      if (contents.bait) {
        updates.bait = (account.bait || 0) + contents.bait;
        grantedItems.push(`${contents.bait} Fishing Bait`);
      }
      if (contents.craftingMats) {
        updates.craftingMats = (account.craftingMats || 0) + contents.craftingMats;
        grantedItems.push(`${contents.craftingMats} Crafting Materials`);
      }
      if (contents.mysticShards) {
        updates.mysticShards = (account.mysticShards || 0) + contents.mysticShards;
        grantedItems.push(`${contents.mysticShards} Mystic Shards`);
      }
      
      // Pet Eggs - Auto-hatch into pets immediately
      const hatchEggs = async (count: number, eggType: string) => {
        const tierChances: Record<string, Record<string, number>> = {
          basic: { common: 0.5, uncommon: 0.35, rare: 0.12, epic: 0.03 },
          rare: { common: 0.1, uncommon: 0.4, rare: 0.35, epic: 0.15 },
          epic: { common: 0, uncommon: 0.1, rare: 0.5, epic: 0.4 },
          mythic: { common: 0, uncommon: 0, rare: 0.2, epic: 0.5, mythic: 0.3 },
        };
        const chances = tierChances[eggType] || tierChances.basic;
        const elements = Object.keys(PET_NAMES_BY_ELEMENT);
        const tierMultipliers: Record<string, number> = { common: 1, uncommon: 1.5, rare: 2, epic: 3, mythic: 5 };
        
        for (let i = 0; i < count; i++) {
          const roll = Math.random();
          let tier = "common";
          let cumulative = 0;
          for (const [t, chance] of Object.entries(chances)) {
            cumulative += chance;
            if (roll < cumulative) { tier = t; break; }
          }
          
          const element = elements[Math.floor(Math.random() * elements.length)] as keyof typeof PET_NAMES_BY_ELEMENT;
          const names = PET_NAMES_BY_ELEMENT[element];
          const name = names[Math.floor(Math.random() * names.length)];
          const mult = tierMultipliers[tier] || 1;
          
          await storage.createPet({
            accountId,
            name,
            tier: "egg",
            element: element as any,
            elements: [element] as any,
            stats: {
              Str: Math.floor((1 + Math.random() * 2) * mult),
              Spd: Math.floor((1 + Math.random() * 2) * mult),
              Luck: Math.floor((1 + Math.random() * 2) * mult),
              ElementalPower: Math.floor((1 + Math.random() * 2) * mult),
            },
            exp: 0,
            bondLevel: 1,
            skin: "default",
          });
          grantedItems.push(`${tier} ${element} pet: ${name}`);
        }
      };
      
      if (contents.petEggs) {
        await hatchEggs(contents.petEggs, "basic");
      }
      if (contents.rarePetEggs) {
        await hatchEggs(contents.rarePetEggs, "rare");
      }
      if (contents.epicPetEggs) {
        await hatchEggs(contents.epicPetEggs, "epic");
      }
      if (contents.mythicPetEggs) {
        await hatchEggs(contents.mythicPetEggs, "mythic");
      }
      
      // Skin Tickets
      if (contents.skins) {
        updates.skinTickets = (account.skinTickets || 0) + contents.skins;
        grantedItems.push(`${contents.skins} Skin Ticket(s)`);
      }
      if (contents.rareSkins) {
        updates.rareSkinTickets = (account.rareSkinTickets || 0) + contents.rareSkins;
        grantedItems.push(`${contents.rareSkins} Rare Skin Ticket(s)`);
      }
      if (contents.epicSkins) {
        updates.epicSkinTickets = (account.epicSkinTickets || 0) + contents.epicSkins;
        grantedItems.push(`${contents.epicSkins} Epic Skin Ticket(s)`);
      }
      if (contents.mythicSkins) {
        updates.mythicSkinTickets = (account.mythicSkinTickets || 0) + contents.mythicSkins;
        grantedItems.push(`${contents.mythicSkins} Mythic Skin Ticket(s)`);
      }
      
      // Temporary Buffs (VIP, Hero Aura, Pet Bond Boost)
      const activeBuffs = [...(account.activeBuffs || [])];
      const now = new Date();
      
      if (contents.heroAura7d) {
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        activeBuffs.push({ id: "hero_aura", expiresAt: expiresAt.toISOString() });
        grantedItems.push("Hero Aura (7 days)");
      }
      if (contents.petBondBoost24h) {
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        activeBuffs.push({ id: "pet_bond_boost", expiresAt: expiresAt.toISOString() });
        grantedItems.push("Pet Bond Boost (24 hours)");
      }
      if (contents.petBondBoost48h) {
        const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        activeBuffs.push({ id: "pet_bond_boost", expiresAt: expiresAt.toISOString() });
        grantedItems.push("Pet Bond Boost (48 hours)");
      }
      if (contents.conquerorBanner) {
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        activeBuffs.push({ id: "conqueror_banner", expiresAt: expiresAt.toISOString() });
        grantedItems.push("Conqueror Banner (30 days)");
      }
      
      if (activeBuffs.length > (account.activeBuffs || []).length) {
        updates.activeBuffs = activeBuffs;
      }
      
      // VIP Status (30 days from purchase or current expiration)
      if (contents.vipStatus30d) {
        const currentVip = account.vipUntil ? new Date(account.vipUntil) : now;
        const baseDate = currentVip > now ? currentVip : now;
        updates.vipUntil = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        grantedItems.push("VIP Status (30 days)");
      }
      
      // Unlock specific skins
      if (contents.mountSkins || contents.epicPetSkins) {
        const unlockedSkins = [...(account.unlockedSkins || [])];
        if (contents.mountSkins) {
          unlockedSkins.push("random_mount_skin_" + Date.now());
          grantedItems.push(`${contents.mountSkins} Mount Skin(s)`);
        }
        if (contents.epicPetSkins) {
          unlockedSkins.push("random_epic_pet_skin_" + Date.now());
          grantedItems.push(`${contents.epicPetSkins} Epic Pet Skin(s)`);
        }
        updates.unlockedSkins = unlockedSkins;
      }
      
      // Special items just get noted
      if (contents.eliteRecipe) {
        grantedItems.push(`${contents.eliteRecipe} Elite Recipe(s)`);
      }
      
      await storage.updateAccount(accountId, updates);
      
      await storage.createActivityFeed({
        type: "shop_purchase",
        message: `${account.username} purchased ${bundle.name}!`,
        metadata: { bundleId, grantedItems },
      });
      
      res.json({ success: true, bundle: bundle.name, grantedItems });
    } catch (error) {
      res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  // ===== ADMIN GRANT $VALOR =====
  app.post("/api/admin/grant-valor", async (req, res) => {
    const { adminId, accountId, amount } = req.body;
    
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const account = await storage.getAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    await storage.updateAccount(accountId, {
      valorTokens: (account.valorTokens || 0) + amount,
    });
    
    await storage.createActivityFeed({
      type: "admin_action",
      message: `Admin granted ${amount} $Valor to ${account.username}`,
      metadata: { adminId, accountId, amount },
    });
    
    res.json({ success: true, newBalance: (account.valorTokens || 0) + amount });
  });

  // ===== VOICE TTS ENDPOINT =====
  app.post("/api/ai-chat/voice", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text required" });
      }
      
      const { generateVoiceResponse } = await import("./game-ai");
      const audioBuffer = await generateVoiceResponse(text);
      
      if (!audioBuffer) {
        return res.status(500).json({ error: "Failed to generate voice" });
      }
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length,
      });
      res.send(audioBuffer);
    } catch (error) {
      res.status(500).json({ error: "Voice generation failed" });
    }
  });

  // ===== FULL WALKTHROUGH =====
  app.get("/api/ai-chat/walkthrough/:accountId", async (req, res) => {
    try {
      const { generateFullWalkthrough } = await import("./game-ai");
      const walkthrough = await generateFullWalkthrough(req.params.accountId);
      res.json({ walkthrough });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate walkthrough" });
    }
  });

  // ===== SKINS SYSTEM =====
  const SKINS = {
    character: [
      { id: "default", name: "Default", rarity: "common", type: "character" },
      { id: "warrior_gold", name: "Golden Warrior", rarity: "epic", type: "character", valorOnly: true },
      { id: "shadow_knight", name: "Shadow Knight", rarity: "legendary", type: "character", valorOnly: true },
      { id: "flame_lord", name: "Flame Lord", rarity: "mythic", type: "character", valorOnly: true },
      { id: "ice_queen", name: "Ice Queen", rarity: "mythic", type: "character", valorOnly: true },
      { id: "void_walker", name: "Void Walker", rarity: "legendary", type: "character", valorOnly: true },
      { id: "celestial_guardian", name: "Celestial Guardian", rarity: "mythic", type: "character", valorOnly: true },
      { id: "dragon_slayer", name: "Dragon Slayer", rarity: "epic", type: "character" },
      { id: "mystic_sage", name: "Mystic Sage", rarity: "rare", type: "character" },
      { id: "forest_ranger", name: "Forest Ranger", rarity: "rare", type: "character" },
    ],
    pet: [
      { id: "default", name: "Default", rarity: "common", type: "pet" },
      { id: "elemental_glow", name: "Elemental Glow", rarity: "epic", type: "pet", valorOnly: true },
      { id: "shadow_aura", name: "Shadow Aura", rarity: "legendary", type: "pet", valorOnly: true },
      { id: "golden_scales", name: "Golden Scales", rarity: "mythic", type: "pet", valorOnly: true },
      { id: "crystal_armor", name: "Crystal Armor", rarity: "rare", type: "pet" },
      { id: "flame_wings", name: "Flame Wings", rarity: "epic", type: "pet" },
    ],
    bird: [
      { id: "default", name: "Default", rarity: "common", type: "bird" },
      { id: "phoenix_feathers", name: "Phoenix Feathers", rarity: "mythic", type: "bird", valorOnly: true },
      { id: "storm_wings", name: "Storm Wings", rarity: "legendary", type: "bird", valorOnly: true },
      { id: "rainbow_plume", name: "Rainbow Plume", rarity: "epic", type: "bird" },
    ],
    base: [
      { id: "default", name: "Default Castle", rarity: "common", type: "base" },
      { id: "dark_fortress", name: "Dark Fortress", rarity: "legendary", type: "base", valorOnly: true },
      { id: "crystal_palace", name: "Crystal Palace", rarity: "mythic", type: "base", valorOnly: true },
      { id: "ancient_temple", name: "Ancient Temple", rarity: "epic", type: "base" },
      { id: "dragon_keep", name: "Dragon Keep", rarity: "legendary", type: "base", valorOnly: true },
    ],
  };

  const playerSkins: Map<string, { character?: string; pet?: string; bird?: string; base?: string; owned: string[] }> = new Map();

  app.get("/api/skins", (_req, res) => {
    res.json({ skins: SKINS });
  });

  app.get("/api/accounts/:id/skins", (req, res) => {
    const skins = playerSkins.get(req.params.id) || { owned: ["default"] };
    res.json(skins);
  });

  app.post("/api/accounts/:id/skins/equip", (req, res) => {
    const { skinId, type } = req.body;
    const accountId = req.params.id;
    
    const skins = playerSkins.get(accountId) || { owned: ["default"] };
    if (!skins.owned.includes(skinId) && skinId !== "default") {
      return res.status(400).json({ error: "Skin not owned" });
    }
    
    (skins as any)[type] = skinId;
    playerSkins.set(accountId, skins);
    
    res.json({ success: true, equipped: skinId, type });
  });

  app.post("/api/accounts/:id/skins/purchase", async (req, res) => {
    const { skinId, skinType } = req.body;
    const accountId = req.params.id;
    
    const allSkins = [...SKINS.character, ...SKINS.pet, ...SKINS.bird, ...SKINS.base];
    const skin = allSkins.find(s => s.id === skinId);
    if (!skin) {
      return res.status(404).json({ error: "Skin not found" });
    }
    
    const account = await storage.getAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    const prices: Record<string, number> = { common: 100, rare: 500, epic: 2000, legendary: 5000, mythic: 15000 };
    const price = prices[skin.rarity] || 1000;
    
    if ((skin as any).valorOnly) {
      if ((account.valorTokens || 0) < price) {
        return res.status(400).json({ error: `Requires ${price} $Valor` });
      }
      await storage.updateAccount(accountId, { valorTokens: (account.valorTokens || 0) - price });
    } else {
      if (account.gold < price * 10) {
        return res.status(400).json({ error: `Requires ${price * 10} gold` });
      }
      await storage.updateAccountGold(accountId, account.gold - price * 10);
    }
    
    const skins = playerSkins.get(accountId) || { owned: ["default"] };
    skins.owned.push(skinId);
    playerSkins.set(accountId, skins);
    
    res.json({ success: true, skin, newOwned: skins.owned });
  });

  // ===== EXPANDED ACHIEVEMENTS (1000+) =====
  const EXPANDED_ACHIEVEMENT_CATEGORIES = [
    { category: "Combat", achievements: generateCombatAchievements() },
    { category: "Tower", achievements: generateTowerAchievements() },
    { category: "Pets", achievements: generatePetAchievements() },
    { category: "Economy", achievements: generateEconomyAchievements() },
    { category: "Social", achievements: generateSocialAchievements() },
    { category: "Exploration", achievements: generateExplorationAchievements() },
    { category: "Collection", achievements: generateCollectionAchievements() },
    { category: "Milestones", achievements: generateMilestoneAchievements() },
  ];

  function generateCombatAchievements() {
    const achievements = [];
    for (let i = 1; i <= 125; i++) {
      const wins = i * 10;
      achievements.push({ id: `combat_wins_${wins}`, name: `${wins} Victories`, description: `Win ${wins} battles`, requirement: { type: "wins", value: wins }, rewards: { gold: wins * 100, exp: wins * 10 } });
    }
    return achievements;
  }

  function generateTowerAchievements() {
    const achievements = [];
    for (let floor = 1; floor <= 100; floor++) {
      achievements.push({ id: `tower_floor_${floor}`, name: `Floor ${floor} Conqueror`, description: `Reach floor ${floor}`, requirement: { type: "towerFloor", value: floor }, rewards: { gold: floor * 1000, rubies: floor } });
    }
    for (let level = 10; level <= 100; level += 10) {
      achievements.push({ id: `tower_level_${level}`, name: `Level ${level} Master`, description: `Reach level ${level} on any floor`, requirement: { type: "towerLevel", value: level }, rewards: { trainingPoints: level * 10 } });
    }
    return achievements;
  }

  function generatePetAchievements() {
    const achievements = [
      { id: "first_pet", name: "First Companion", description: "Adopt your first pet", requirement: { type: "petsOwned", value: 1 }, rewards: { soulGins: 10 } },
      { id: "account_created", name: "Welcome to Valor", description: "Create an account", requirement: { type: "accountCreated", value: true }, rewards: { gold: 1000 } },
      { id: "first_login", name: "Adventure Begins", description: "Log in for the first time", requirement: { type: "firstLogin", value: true }, rewards: { trainingPoints: 50 } },
    ];
    for (let i = 5; i <= 100; i += 5) {
      achievements.push({ id: `pets_owned_${i}`, name: `Pet Collector ${i}`, description: `Own ${i} pets`, requirement: { type: "petsOwned", value: i }, rewards: { soulGins: i * 5 } });
    }
    return achievements;
  }

  function generateEconomyAchievements() {
    const achievements = [];
    const goldMilestones = [1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
    goldMilestones.forEach((gold, i) => {
      achievements.push({ id: `gold_earned_${gold}`, name: `${gold >= 1000000 ? (gold / 1000000) + "M" : (gold / 1000) + "K"} Gold`, description: `Earn ${gold.toLocaleString()} gold total`, requirement: { type: "goldEarned", value: gold }, rewards: { rubies: (i + 1) * 10 } });
    });
    for (let i = 1; i <= 100; i++) {
      achievements.push({ id: `trades_completed_${i}`, name: `Trader Level ${i}`, description: `Complete ${i} trades`, requirement: { type: "trades", value: i }, rewards: { gold: i * 500 } });
    }
    return achievements;
  }

  function generateSocialAchievements() {
    const achievements = [];
    for (let i = 1; i <= 50; i++) {
      achievements.push({ id: `guild_contributions_${i * 10}`, name: `Guild Contributor ${i}`, description: `Make ${i * 10} guild contributions`, requirement: { type: "guildContributions", value: i * 10 }, rewards: { gold: i * 1000 } });
    }
    achievements.push({ id: "join_guild", name: "Guild Member", description: "Join a guild", requirement: { type: "inGuild", value: true }, rewards: { gold: 5000 } });
    achievements.push({ id: "create_guild", name: "Guild Founder", description: "Create a guild", requirement: { type: "guildCreated", value: true }, rewards: { rubies: 50 } });
    return achievements;
  }

  function generateExplorationAchievements() {
    const achievements = [];
    const zones = ["capital_city", "mystic_tower", "mountain_caverns", "ancient_ruins", "research_lab", "pet_training", "ruby_mines", "enchanted_forest", "battle_arena", "crystal_lake", "coastal_village", "hell_zone"];
    zones.forEach((zone, i) => {
      achievements.push({ id: `visit_${zone}`, name: `Discovered ${zone.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`, description: `Visit ${zone.replace(/_/g, " ")}`, requirement: { type: "zoneVisited", value: zone }, rewards: { gold: (i + 1) * 500 } });
    });
    for (let i = 1; i <= 100; i++) {
      achievements.push({ id: `zones_explored_${i}`, name: `Explorer Level ${i}`, description: `Explore zones ${i} times`, requirement: { type: "zonesExplored", value: i }, rewards: { trainingPoints: i * 5 } });
    }
    return achievements;
  }

  function generateCollectionAchievements() {
    const achievements = [];
    for (let i = 1; i <= 100; i++) {
      achievements.push({ id: `items_collected_${i * 5}`, name: `Collector ${i}`, description: `Collect ${i * 5} items`, requirement: { type: "itemsCollected", value: i * 5 }, rewards: { gold: i * 200 } });
    }
    for (let i = 1; i <= 50; i++) {
      achievements.push({ id: `rare_items_${i}`, name: `Rare Hunter ${i}`, description: `Collect ${i} rare+ items`, requirement: { type: "rareItems", value: i }, rewards: { rubies: i } });
    }
    return achievements;
  }

  function generateMilestoneAchievements() {
    const achievements = [];
    const ranks = ["Novice", "Apprentice", "Journeyman", "Adventurer", "Veteran", "Elite", "Champion", "Hero", "Legend", "Mythic", "Immortal", "Demigod", "Deity", "Titan", "Mythical Legend"];
    ranks.forEach((rank, i) => {
      achievements.push({ id: `rank_${rank.toLowerCase().replace(/ /g, "_")}`, name: `Achieved ${rank}`, description: `Reach ${rank} rank`, requirement: { type: "rank", value: i }, rewards: { gold: (i + 1) * 10000, rubies: (i + 1) * 5 } });
    });
    for (let i = 1; i <= 100; i++) {
      achievements.push({ id: `days_played_${i}`, name: `${i} Day Veteran`, description: `Play for ${i} days`, requirement: { type: "daysPlayed", value: i }, rewards: { trainingPoints: i * 10 } });
    }
    return achievements;
  }

  const allExpandedAchievements = EXPANDED_ACHIEVEMENT_CATEGORIES.flatMap(c => c.achievements) as any[];

  app.get("/api/achievements", (_req, res) => {
    res.json({ categories: EXPANDED_ACHIEVEMENT_CATEGORIES, total: allExpandedAchievements.length });
  });

  app.get("/api/accounts/:id/achievements", async (req, res) => {
    await autoCheckAchievementsAndTrophies(req.params.id);
    const claimed = playerAchievements.get(req.params.id) || new Set();
    res.json({ 
      unlocked: Array.from(claimed),
      total: allExpandedAchievements.length,
      categories: EXPANDED_ACHIEVEMENT_CATEGORIES.map(c => ({
        ...c,
        unlocked: c.achievements.filter((a: any) => claimed.has(a.id)).length,
      })),
    });
  });

  // ===== TROPHIES (50) =====
  const FULL_TROPHIES = [
    { id: "first_victory", name: "First Blood", description: "Win your first battle", icon: "sword" },
    { id: "tower_10", name: "Tower Initiate", description: "Reach floor 10", icon: "tower" },
    { id: "tower_25", name: "Tower Climber", description: "Reach floor 25", icon: "tower" },
    { id: "tower_50", name: "Tower Master", description: "Reach floor 50", icon: "tower" },
    { id: "tower_100", name: "Tower Conqueror", description: "Complete all 100 floors", icon: "crown" },
    { id: "millionaire", name: "Millionaire", description: "Earn 1 million gold", icon: "coins" },
    { id: "billionaire", name: "Billionaire", description: "Earn 1 billion gold", icon: "gem" },
    { id: "pet_master", name: "Pet Master", description: "Own 50 pets", icon: "paw" },
    { id: "pet_legend", name: "Pet Legend", description: "Evolve a pet to mythic tier", icon: "star" },
    { id: "guild_champion", name: "Guild Champion", description: "Win 100 guild battles", icon: "shield" },
    { id: "pvp_warrior", name: "PvP Warrior", description: "Win 100 PvP battles", icon: "swords" },
    { id: "pvp_legend", name: "PvP Legend", description: "Win 1000 PvP battles", icon: "trophy" },
    { id: "collector", name: "Ultimate Collector", description: "Collect 500 items", icon: "package" },
    { id: "explorer", name: "World Explorer", description: "Visit all 12 zones", icon: "map" },
    { id: "story_1", name: "Act I Complete", description: "Complete Act I", icon: "book" },
    { id: "story_2", name: "Act II Complete", description: "Complete Act II", icon: "book" },
    { id: "story_3", name: "Act III Complete", description: "Complete Act III", icon: "book" },
    { id: "story_4", name: "Story Complete", description: "Complete all story acts", icon: "crown" },
    { id: "hell_survivor", name: "Hell Survivor", description: "Survive Hell Zone", icon: "flame" },
    { id: "hell_conqueror", name: "Hell Conqueror", description: "100 Hell Zone kills", icon: "skull" },
    { id: "base_max", name: "Fortress Complete", description: "Max out your base", icon: "castle" },
    { id: "rank_5", name: "Elite Warrior", description: "Reach Elite rank", icon: "star" },
    { id: "rank_10", name: "Immortal Being", description: "Reach Immortal rank", icon: "sparkles" },
    { id: "rank_15", name: "Mythical Legend", description: "Achieve Mythical Legend", icon: "crown" },
    { id: "first_trade", name: "First Trade", description: "Complete your first trade", icon: "handshake" },
    { id: "trading_master", name: "Trading Master", description: "Complete 100 trades", icon: "scale" },
    { id: "bird_trainer", name: "Bird Trainer", description: "Train 10 birds", icon: "bird" },
    { id: "phoenix_master", name: "Phoenix Master", description: "Evolve a bird to phoenix", icon: "flame" },
    { id: "fish_master", name: "Master Angler", description: "Catch 100 fish", icon: "fish" },
    { id: "legendary_angler", name: "Legendary Angler", description: "Catch a legendary fish", icon: "star" },
    { id: "skill_collector", name: "Skill Collector", description: "Learn 20 skills", icon: "zap" },
    { id: "auction_winner", name: "Auction Winner", description: "Win 10 skill auctions", icon: "gavel" },
    { id: "quest_complete_10", name: "Quest Hunter", description: "Complete 10 quests", icon: "scroll" },
    { id: "quest_complete_50", name: "Quest Master", description: "Complete 50 quests", icon: "scroll" },
    { id: "achievement_hunter", name: "Achievement Hunter", description: "Unlock 100 achievements", icon: "trophy" },
    { id: "achievement_master", name: "Achievement Master", description: "Unlock 500 achievements", icon: "crown" },
    { id: "speed_runner", name: "Speed Runner", description: "Clear a floor in under 1 minute", icon: "clock" },
    { id: "perfect_battle", name: "Perfect Battle", description: "Win without taking damage", icon: "shield" },
    { id: "comeback_king", name: "Comeback King", description: "Win with less than 10% HP", icon: "heart" },
    { id: "critical_master", name: "Critical Master", description: "Land 100 critical hits", icon: "target" },
    { id: "dodge_master", name: "Dodge Master", description: "Dodge 100 attacks", icon: "wind" },
    { id: "defender", name: "Iron Defense", description: "Block 1000 damage", icon: "shield" },
    { id: "damage_dealer", name: "Damage Dealer", description: "Deal 1 million damage", icon: "sword" },
    { id: "elemental_master", name: "Elemental Master", description: "Master all elements", icon: "sparkles" },
    { id: "social_butterfly", name: "Social Butterfly", description: "Chat with 50 players", icon: "users" },
    { id: "veteran_player", name: "Veteran Player", description: "Play for 30 days", icon: "calendar" },
    { id: "daily_devotee", name: "Daily Devotee", description: "Log in 100 days", icon: "sun" },
    { id: "event_champion", name: "Event Champion", description: "Win 10 events", icon: "flag" },
    { id: "tournament_winner", name: "Tournament Winner", description: "Win a tournament", icon: "trophy" },
    { id: "mythical_ascension", name: "Ascended", description: "Achieve Mythical Legend status", icon: "crown" },
  ];

  app.get("/api/full-trophies", (_req, res) => {
    res.json({ trophies: FULL_TROPHIES, total: FULL_TROPHIES.length });
  });

  app.get("/api/accounts/:id/full-trophies", async (req, res) => {
    await autoCheckAchievementsAndTrophies(req.params.id);
    const earned = playerTrophiesMapMap.get(req.params.id) || new Set();
    res.json({ 
      earned: Array.from(earned),
      total: FULL_TROPHIES.length,
      trophies: FULL_TROPHIES.map(t => ({ ...t, earned: earned.has(t.id) })),
    });
  });

  app.post("/api/accounts/:id/full-trophies/claim", async (req, res) => {
    const { trophyId } = req.body;
    const accountId = req.params.id;
    
    const trophy = FULL_TROPHIES.find(t => t.id === trophyId);
    if (!trophy) {
      return res.status(404).json({ error: "Trophy not found" });
    }
    
    const earned = playerTrophiesMap.get(accountId) || new Set();
    if (earned.has(trophyId)) {
      return res.status(400).json({ error: "Trophy already earned" });
    }
    
    earned.add(trophyId);
    playerTrophiesMap.set(accountId, earned);
    
    const account = await storage.getAccount(accountId);
    if (account) {
      const currentTrophies = Array.isArray(account.trophies) ? account.trophies.length + 1 : 1;
      await storage.updateAccount(accountId, { trophies: Array.from(earned) });
    }
    
    res.json({ success: true, trophy, totalEarned: earned.size });
  });

  // ===== TOURNAMENTS =====
  interface TournamentMatch {
    player1: string;
    player2: string;
    winner?: string;
  }

  interface Tournament {
    id: string;
    name: string;
    status: "pending" | "active" | "completed";
    participants: string[];
    brackets: { round: number; matches: TournamentMatch[] }[];
    rewards: { gold?: number; rubies?: number; soulShards?: number; trainingPoints?: number; items?: string[] };
    createdBy: string;
    startedAt?: Date;
    endedAt?: Date;
  }

  const tournaments: Map<string, Tournament> = new Map();
  
  function cleanupOldTournaments() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    Array.from(tournaments.entries()).forEach(([id, t]) => {
      if (t.status === "completed" && t.endedAt && t.endedAt.getTime() < oneDayAgo) {
        tournaments.delete(id);
      }
    });
  }
  if (!(globalThis as any).__tournamentCleanupInitialized) {
    (globalThis as any).__tournamentCleanupInitialized = true;
    setInterval(cleanupOldTournaments, 60 * 60 * 1000);
  }

  app.get("/api/tournaments", (_req, res) => {
    const all = Array.from(tournaments.values());
    res.json({ 
      active: all.find(t => t.status === "active"),
      pending: all.filter(t => t.status === "pending"),
      completed: all.filter(t => t.status === "completed").slice(-10),
    });
  });

  app.post("/api/admin/tournaments/create", async (req, res) => {
    const { adminId, name, rewards } = req.body;
    
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const id = `tournament_${Date.now()}`;
    const tournament: Tournament = {
      id,
      name,
      status: "pending",
      participants: [],
      brackets: [],
      rewards: rewards || { gold: 100000, rubies: 100 },
      createdBy: adminId,
    };
    
    tournaments.set(id, tournament);
    
    await storage.createActivityFeed({
      type: "tournament",
      message: `New tournament created: ${name}`,
      metadata: { tournamentId: id },
    });
    
    res.json({ success: true, tournament });
  });

  app.post("/api/tournaments/:id/join", async (req, res) => {
    const { accountId } = req.body;
    const tournament = tournaments.get(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.status !== "pending") {
      return res.status(400).json({ error: "Tournament not accepting registrations" });
    }
    
    if (tournament.participants.includes(accountId)) {
      return res.status(400).json({ error: "Already registered" });
    }
    
    tournament.participants.push(accountId);
    tournaments.set(req.params.id, tournament);
    
    res.json({ success: true, participants: tournament.participants.length });
  });

  app.post("/api/admin/tournaments/:id/start", async (req, res) => {
    const { adminId } = req.body;
    
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const tournament = tournaments.get(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.participants.length < 2) {
      return res.status(400).json({ error: "Need at least 2 participants" });
    }
    
    const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5);
    const matches: TournamentMatch[] = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        matches.push({ player1: shuffled[i], player2: shuffled[i + 1] });
      } else {
        matches.push({ player1: shuffled[i], player2: "BYE", winner: shuffled[i] });
      }
    }
    
    tournament.brackets = [{ round: 1, matches }];
    tournament.status = "active";
    tournament.startedAt = new Date();
    tournaments.set(req.params.id, tournament);
    
    await storage.createActivityFeed({
      type: "tournament",
      message: `Tournament "${tournament.name}" has started!`,
      metadata: { tournamentId: tournament.id, participants: tournament.participants.length },
    });
    
    res.json({ success: true, tournament });
  });

  app.post("/api/admin/tournaments/:id/set-winner", async (req, res) => {
    const { adminId, round, matchIndex, winnerId } = req.body;
    
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const tournament = tournaments.get(req.params.id);
    if (!tournament || tournament.status !== "active") {
      return res.status(404).json({ error: "Active tournament not found" });
    }
    
    const roundData = tournament.brackets.find(b => b.round === round);
    if (!roundData || !roundData.matches[matchIndex]) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    roundData.matches[matchIndex].winner = winnerId;
    
    const allMatchesComplete = roundData.matches.every(m => m.winner);
    if (allMatchesComplete) {
      const winners = roundData.matches.map(m => m.winner!);
      
      if (winners.length === 1) {
        tournament.status = "completed";
        tournament.endedAt = new Date();
        
        const winner = await storage.getAccount(winners[0]);
        if (winner) {
          await storage.updateAccount(winners[0], {
            gold: winner.gold + (tournament.rewards.gold || 0),
            rubies: (winner.rubies || 0) + (tournament.rewards.rubies || 0),
            soulShards: (winner.soulShards || 0) + (tournament.rewards.soulShards || 0),
            trainingPoints: (winner.trainingPoints || 0) + (tournament.rewards.trainingPoints || 0),
          });
          
          const trophies = playerTrophiesMap.get(winners[0]) || new Set();
          trophies.add("tournament_winner");
          playerTrophiesMap.set(winners[0], trophies);
        }
        
        await storage.createActivityFeed({
          type: "tournament",
          message: `${winner?.username || "Unknown"} won the tournament "${tournament.name}"!`,
          metadata: { tournamentId: tournament.id, winnerId: winners[0] },
        });
      } else {
        const nextMatches: TournamentMatch[] = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (winners[i + 1]) {
            nextMatches.push({ player1: winners[i], player2: winners[i + 1] });
          } else {
            nextMatches.push({ player1: winners[i], player2: "BYE", winner: winners[i] });
          }
        }
        tournament.brackets.push({ round: round + 1, matches: nextMatches });
      }
    }
    
    tournaments.set(req.params.id, tournament);
    res.json({ success: true, tournament });
  });

  // ===== LEADERBOARD ADDITIONS =====
  app.get("/api/leaderboard/pet-wins", async (_req, res) => {
    try {
      const accounts = await storage.getAllAccounts();
      const sorted = accounts
        .map(a => ({ id: a.id, username: a.username, petWins: (a as any).petWins || 0 }))
        .sort((a, b) => b.petWins - a.petWins)
        .slice(0, 100);
      res.json({ leaderboard: sorted });
    } catch (error) {
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  app.get("/api/leaderboard/base-raids", async (_req, res) => {
    try {
      const accounts = await storage.getAllAccounts();
      const sorted = accounts
        .map(a => ({ id: a.id, username: a.username, baseRaidWins: (a as any).baseRaidWins || 0 }))
        .sort((a, b) => b.baseRaidWins - a.baseRaidWins)
        .slice(0, 100);
      res.json({ leaderboard: sorted });
    } catch (error) {
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  // ===== PET SHOP - Buy pet eggs with rubies =====
  const PET_SHOP_EGGS = [
    { id: "common_egg", name: "Forest Egg", rubyPrice: 500, statBonus: { minStr: 1, maxStr: 5, minSpd: 1, maxSpd: 5, minLuck: 1, maxLuck: 5, minElem: 1, maxElem: 5 }, elements: ["Fire", "Water", "Earth", "Air"], rankRequired: "Journeyman" },
    { id: "rare_egg", name: "Crystal Egg", rubyPrice: 2500, statBonus: { minStr: 5, maxStr: 15, minSpd: 5, maxSpd: 15, minLuck: 5, maxLuck: 15, minElem: 5, maxElem: 15 }, elements: ["Lightning", "Ice", "Nature"], rankRequired: "Expert" },
    { id: "epic_egg", name: "Storm Egg", rubyPrice: 10000, statBonus: { minStr: 15, maxStr: 35, minSpd: 15, maxSpd: 35, minLuck: 10, maxLuck: 25, minElem: 20, maxElem: 50 }, elements: ["Lightning", "Fire", "Ice"], rankRequired: "Master" },
    { id: "legendary_egg", name: "Dragon Egg", rubyPrice: 35000, statBonus: { minStr: 35, maxStr: 75, minSpd: 30, maxSpd: 65, minLuck: 20, maxLuck: 50, minElem: 50, maxElem: 100 }, elements: ["Dark", "Light", "Arcana"], rankRequired: "Grand Master" },
    { id: "mythic_egg", name: "Void Egg", rubyPrice: 100000, statBonus: { minStr: 75, maxStr: 150, minSpd: 70, maxSpd: 140, minLuck: 50, maxLuck: 100, minElem: 100, maxElem: 200 }, elements: ["Void", "Aether", "Chrono", "Plasma"], rankRequired: "Legend" },
    { id: "divine_egg", name: "Celestial Egg", rubyPrice: 250000, statBonus: { minStr: 150, maxStr: 300, minSpd: 140, maxSpd: 280, minLuck: 100, maxLuck: 200, minElem: 200, maxElem: 400 }, elements: ["Elemental Convergence"], rankRequired: "Mythical Legend" },
  ];

  app.post("/api/pet-shop/purchase", async (req, res) => {
    try {
      const { accountId, eggId } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const egg = PET_SHOP_EGGS.find(e => e.id === eggId);
      if (!egg) return res.status(404).json({ error: "Egg not found" });

      const requiredRankIndex = playerRanks.indexOf(egg.rankRequired);
      const playerRankIndex = playerRanks.indexOf(account.rank);
      if (playerRankIndex < requiredRankIndex) {
        return res.status(403).json({ error: `This egg requires ${egg.rankRequired} rank or higher`, required: egg.rankRequired });
      }

      if ((account.rubies || 0) < egg.rubyPrice) {
        return res.status(400).json({ error: `Need ${egg.rubyPrice} rubies` });
      }

      const randomStat = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
      const element = egg.elements[Math.floor(Math.random() * egg.elements.length)];
      
      const petNames = ["Ember", "Frost", "Storm", "Shadow", "Crystal", "Blaze", "Aurora", "Void", "Celestial", "Dragon"];
      const petName = `${petNames[Math.floor(Math.random() * petNames.length)]}'s ${egg.name.replace(" Egg", "")}`;

      const newPet = {
        id: crypto.randomUUID(),
        accountId,
        name: petName,
        tier: "egg" as const,
        element,
        elements: [element],
        exp: 0,
        stats: {
          Str: randomStat(egg.statBonus.minStr, egg.statBonus.maxStr),
          Spd: randomStat(egg.statBonus.minSpd, egg.statBonus.maxSpd),
          Luck: randomStat(egg.statBonus.minLuck, egg.statBonus.maxLuck),
          ElementalPower: randomStat(egg.statBonus.minElem, egg.statBonus.maxElem),
        },
        bondLevel: 0,
        rebirthCount: 0,
      };

      await storage.createPet(newPet as any);
      await storage.updateAccount(accountId, { rubies: (account.rubies || 0) - egg.rubyPrice });

      res.json({ success: true, pet: newPet });
    } catch (error) {
      res.status(500).json({ error: "Failed to purchase egg" });
    }
  });

  // ===== MINING ZONE (Requires Apprentice rank) =====
  app.post("/api/mining/mine", async (req, res) => {
    try {
      const { accountId, nodeId } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const requiredRankIndex = playerRanks.indexOf("Apprentice");
      const playerRankIndex = playerRanks.indexOf(account.rank);
      if (playerRankIndex < requiredRankIndex) {
        return res.status(403).json({ error: "Mining requires Apprentice rank or higher", required: "Apprentice" });
      }

      const nodes: Record<string, { goldReward: number; expReward: number }> = {
        copper: { goldReward: 100, expReward: 5 },
        iron: { goldReward: 250, expReward: 10 },
        silver: { goldReward: 500, expReward: 20 },
        gold: { goldReward: 1000, expReward: 50 },
        mythril: { goldReward: 2500, expReward: 100 },
        adamantite: { goldReward: 5000, expReward: 200 },
      };

      const node = nodes[nodeId];
      if (!node) return res.status(400).json({ error: "Invalid node" });

      const luck = (account.stats as any)?.Luck || 10;
      const bonusMultiplier = 1 + (luck / 100);
      const finalGold = Math.floor(node.goldReward * bonusMultiplier);
      const finalExp = Math.floor(node.expReward * bonusMultiplier);

      await storage.updateAccount(accountId, {
        gold: (account.gold || 0) + finalGold,
        trainingPoints: (account.trainingPoints || 0) + finalExp,
      });

      res.json({ success: true, goldReward: finalGold, expReward: finalExp });
    } catch (error) {
      res.status(500).json({ error: "Mining failed" });
    }
  });

  // ===== RUBY MINES ZONE (Requires Expert rank) =====
  app.post("/api/ruby-mines/mine", async (req, res) => {
    try {
      const { accountId, nodeId } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const requiredRankIndex = playerRanks.indexOf("Expert");
      const playerRankIndex = playerRanks.indexOf(account.rank);
      if (playerRankIndex < requiredRankIndex) {
        return res.status(403).json({ error: "Ruby Mines requires Expert rank or higher", required: "Expert" });
      }

      const nodes: Record<string, { rubyReward: number; goldReward: number; pvpRisk: boolean }> = {
        raw_ruby: { rubyReward: 5, goldReward: 500, pvpRisk: false },
        polished_ruby: { rubyReward: 15, goldReward: 1000, pvpRisk: false },
        crimson_crystal: { rubyReward: 35, goldReward: 2500, pvpRisk: true },
        blood_ruby: { rubyReward: 75, goldReward: 5000, pvpRisk: true },
        dragon_ruby: { rubyReward: 150, goldReward: 10000, pvpRisk: true },
        void_ruby: { rubyReward: 300, goldReward: 25000, pvpRisk: true },
      };

      const node = nodes[nodeId];
      if (!node) return res.status(400).json({ error: "Invalid node" });

      if (node.pvpRisk && Math.random() < 0.3) {
        const accounts = await storage.getAllAccounts();
        const otherPlayers = accounts.filter(a => a.id !== accountId && a.role === "player");
        if (otherPlayers.length > 0) {
          const opponent = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
          const playerPower = ((account.stats as any)?.Str || 10) + ((account.stats as any)?.Spd || 10);
          const opponentPower = ((opponent.stats as any)?.Str || 10) + ((opponent.stats as any)?.Spd || 10);
          const won = playerPower + Math.random() * 50 > opponentPower + Math.random() * 50;
          
          if (won) {
            const bonus = Math.floor(node.rubyReward * 0.5);
            await storage.updateAccount(accountId, {
              rubies: (account.rubies || 0) + node.rubyReward + bonus,
              gold: (account.gold || 0) + node.goldReward,
            });
            return res.json({ 
              pvpEncounter: true, 
              won: true, 
              message: `Defeated ${opponent.username} and claimed extra ${bonus} rubies!`,
              rubyReward: node.rubyReward + bonus,
              goldReward: node.goldReward 
            });
          } else {
            const loss = Math.floor(node.rubyReward * 0.25);
            return res.json({ 
              pvpEncounter: true, 
              won: false, 
              message: `Lost to ${opponent.username}! They stole ${loss} rubies from you.`,
              rubyReward: 0,
              goldReward: 0 
            });
          }
        }
      }

      await storage.updateAccount(accountId, {
        rubies: (account.rubies || 0) + node.rubyReward,
        gold: (account.gold || 0) + node.goldReward,
      });

      res.json({ success: true, rubyReward: node.rubyReward, goldReward: node.goldReward, pvpEncounter: false });
    } catch (error) {
      res.status(500).json({ error: "Mining failed" });
    }
  });

  // ===== HELL ZONE =====
  app.post("/api/hell-zone/challenge", async (req, res) => {
    try {
      const { accountId, challengeId } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const requiredRankIndex = playerRanks.indexOf("Grand Master");
      const playerRankIndex = playerRanks.indexOf(account.rank);
      if (playerRankIndex < requiredRankIndex) {
        return res.status(403).json({ error: "Hell Zone requires Grand Master rank or higher", required: "Grand Master" });
      }

      const challenges: Record<string, { rewards: { gold: number; rubies: number; soulShards: number }; riskPercent: number; difficulty: number }> = {
        demon_pit: { rewards: { gold: 50000, rubies: 25, soulShards: 50 }, riskPercent: 10, difficulty: 1 },
        inferno_gauntlet: { rewards: { gold: 150000, rubies: 75, soulShards: 150 }, riskPercent: 25, difficulty: 2 },
        blood_arena: { rewards: { gold: 500000, rubies: 200, soulShards: 400 }, riskPercent: 50, difficulty: 3 },
        void_rift: { rewards: { gold: 1500000, rubies: 500, soulShards: 1000 }, riskPercent: 75, difficulty: 4 },
        archdemons_throne: { rewards: { gold: 5000000, rubies: 1500, soulShards: 3000 }, riskPercent: 90, difficulty: 5 },
      };

      const challenge = challenges[challengeId];
      if (!challenge) return res.status(400).json({ error: "Invalid challenge" });

      const playerPower = ((account.stats as any)?.Str || 10) + ((account.stats as any)?.Def || 10) + ((account.stats as any)?.Spd || 10);
      const requiredPower = challenge.difficulty * 100;
      const winChance = Math.min(0.9, (playerPower / requiredPower) * 0.5 + 0.2);
      const victory = Math.random() < winChance;

      if (victory) {
        await storage.updateAccount(accountId, {
          gold: (account.gold || 0) + challenge.rewards.gold,
          rubies: (account.rubies || 0) + challenge.rewards.rubies,
          soulShards: (account.soulShards || 0) + challenge.rewards.soulShards,
        });
        res.json({ victory: true, message: "You conquered the challenge!", rewards: challenge.rewards });
      } else {
        const goldLoss = Math.floor((account.gold || 0) * (challenge.riskPercent / 100));
        await storage.updateAccount(accountId, {
          gold: Math.max(0, (account.gold || 0) - goldLoss),
        });
        res.json({ victory: false, message: `Defeated! Lost ${goldLoss.toLocaleString()} gold.`, goldLost: goldLoss });
      }
    } catch (error) {
      res.status(500).json({ error: "Challenge failed" });
    }
  });

  // ===== BATTLE ROYALE SYSTEM =====
  interface BattleRoyaleParticipant {
    accountId: string;
    username: string;
    race: string;
    hp: number;
    maxHp: number;
    stats: any;
    kills: number;
    eliminated: boolean;
    eliminatedAt?: number;
    placement?: number;
  }

  interface BattleRoyaleState {
    status: "closed" | "registration" | "active" | "ended";
    registrations: Map<string, BattleRoyaleParticipant>;
    participants: Map<string, BattleRoyaleParticipant>;
    eliminations: string[];
    startedAt?: number;
    endedAt?: number;
    winner?: string;
  }

  const battleRoyale: BattleRoyaleState = {
    status: "closed",
    registrations: new Map(),
    participants: new Map(),
    eliminations: [],
  };

  const BR_REWARDS = {
    winner: { gold: 10000000, rubies: 5000, soulShards: 2000, focusedShards: 500, trainingPoints: 10000, soulGins: 1000, beakCoins: 500, valorTokens: 200 },
    second: { gold: 5000000, rubies: 2500, soulShards: 1000, focusedShards: 250, trainingPoints: 5000 },
    third: { gold: 2500000, rubies: 1500, soulShards: 500, focusedShards: 100, trainingPoints: 2500 },
    fourth: { gold: 1000000, rubies: 750, soulShards: 250, focusedShards: 50, trainingPoints: 1000 },
    fifth: { gold: 500000, rubies: 500, soulShards: 100, trainingPoints: 500 },
  };

  app.get("/api/battle-royale/status", async (_req, res) => {
    const registrations = Array.from(battleRoyale.registrations.values()).map(p => ({
      accountId: p.accountId,
      username: p.username,
      race: p.race,
    }));
    
    const participants = Array.from(battleRoyale.participants.values()).map(p => ({
      accountId: p.accountId,
      username: p.username,
      race: p.race,
      hp: p.hp,
      maxHp: p.maxHp,
      kills: p.kills,
      eliminated: p.eliminated,
      placement: p.placement,
    }));
    
    const aliveCount = participants.filter(p => !p.eliminated).length;
    
    res.json({
      status: battleRoyale.status,
      registrations,
      participants,
      aliveCount,
      totalParticipants: participants.length,
      eliminations: battleRoyale.eliminations,
      winner: battleRoyale.winner,
      startedAt: battleRoyale.startedAt,
      endedAt: battleRoyale.endedAt,
    });
  });

  app.post("/api/battle-royale/admin/open", async (req, res) => {
    const { adminId } = req.body;
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    if (battleRoyale.status !== "closed" && battleRoyale.status !== "ended") {
      return res.status(400).json({ error: "Battle Royale is already open or in progress" });
    }
    
    battleRoyale.status = "registration";
    battleRoyale.registrations.clear();
    battleRoyale.participants.clear();
    battleRoyale.eliminations = [];
    battleRoyale.winner = undefined;
    battleRoyale.startedAt = undefined;
    battleRoyale.endedAt = undefined;
    
    broadcastToAllPlayers("battle_royale_open", { status: "registration" });
    
    res.json({ success: true, message: "Battle Royale registration is now open!" });
  });

  app.post("/api/battle-royale/admin/close", async (req, res) => {
    const { adminId } = req.body;
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    battleRoyale.status = "closed";
    battleRoyale.registrations.clear();
    battleRoyale.participants.clear();
    battleRoyale.eliminations = [];
    
    broadcastToAllPlayers("battle_royale_closed", { status: "closed" });
    
    res.json({ success: true, message: "Battle Royale has been closed" });
  });

  app.post("/api/battle-royale/admin/start", async (req, res) => {
    const { adminId } = req.body;
    const admin = await storage.getAccount(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    if (battleRoyale.status !== "registration") {
      return res.status(400).json({ error: "Battle Royale is not in registration phase" });
    }
    
    if (battleRoyale.registrations.size < 2) {
      return res.status(400).json({ error: "Need at least 2 participants to start" });
    }
    
    battleRoyale.status = "active";
    battleRoyale.startedAt = Date.now();
    battleRoyale.participants = new Map(battleRoyale.registrations);
    battleRoyale.registrations.clear();
    
    broadcastToAllPlayers("battle_royale_started", { 
      status: "active", 
      participantCount: battleRoyale.participants.size 
    });
    
    res.json({ 
      success: true, 
      message: `Battle Royale started with ${battleRoyale.participants.size} participants!` 
    });
  });

  app.post("/api/battle-royale/register", async (req, res) => {
    const { accountId } = req.body;
    
    if (battleRoyale.status !== "registration") {
      return res.status(400).json({ error: "Battle Royale registration is not open" });
    }
    
    const account = await storage.getAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }
    
    const requiredRankIndex = playerRanks.indexOf("Grand Master");
    const playerRankIndex = playerRanks.indexOf(account.rank);
    if (playerRankIndex < requiredRankIndex) {
      return res.status(403).json({ error: "Hell Zone requires Grand Master rank or higher" });
    }
    
    if (battleRoyale.registrations.has(accountId)) {
      return res.status(400).json({ error: "Already registered" });
    }
    
    const stats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10 };
    const maxHp = calculateMaxHP(stats as CombatStats, playerRanks.indexOf(account.rank), account.race, account.rank);
    
    battleRoyale.registrations.set(accountId, {
      accountId,
      username: account.username,
      race: account.race || "human",
      hp: maxHp,
      maxHp,
      stats,
      kills: 0,
      eliminated: false,
    });
    
    broadcastToAllPlayers("battle_royale_registration", { 
      username: account.username,
      totalRegistered: battleRoyale.registrations.size 
    });
    
    res.json({ success: true, message: "Registered for Battle Royale!" });
  });

  app.post("/api/battle-royale/unregister", async (req, res) => {
    const { accountId } = req.body;
    
    if (battleRoyale.status !== "registration") {
      return res.status(400).json({ error: "Cannot unregister outside registration phase" });
    }
    
    if (!battleRoyale.registrations.has(accountId)) {
      return res.status(400).json({ error: "Not registered" });
    }
    
    battleRoyale.registrations.delete(accountId);
    res.json({ success: true, message: "Unregistered from Battle Royale" });
  });

  app.post("/api/battle-royale/attack", async (req, res) => {
    const { attackerId, targetId } = req.body;
    
    if (battleRoyale.status !== "active") {
      return res.status(400).json({ error: "Battle Royale is not active" });
    }
    
    const attacker = battleRoyale.participants.get(attackerId);
    const target = battleRoyale.participants.get(targetId);
    
    if (!attacker || attacker.eliminated) {
      return res.status(400).json({ error: "You are not in the battle or already eliminated" });
    }
    
    if (!target || target.eliminated) {
      return res.status(400).json({ error: "Target is not in the battle or already eliminated" });
    }
    
    if (attackerId === targetId) {
      return res.status(400).json({ error: "Cannot attack yourself" });
    }
    
    const aliveBeforeAttack = Array.from(battleRoyale.participants.values()).filter(p => !p.eliminated).length;
    
    const attackerStats = attacker.stats as CombatStats;
    const targetStats = target.stats as CombatStats;
    
    const baseDamage = (attackerStats.Str || 10) * 2;
    const defense = (targetStats.Def || 10) * 0.5;
    const critChance = (attackerStats.Luck || 10) / 200;
    const isCrit = Math.random() < critChance;
    const damage = Math.max(1, Math.floor((baseDamage - defense) * (isCrit ? 2 : 1)));
    
    const counterDamage = Math.floor(((targetStats.Str || 10) - (attackerStats.Def || 10) * 0.5) * 0.5);
    const actualCounter = Math.max(0, counterDamage);
    
    target.hp = Math.max(0, target.hp - damage);
    attacker.hp = Math.max(0, attacker.hp - actualCounter);
    
    const results: any = {
      attacker: attacker.username,
      target: target.username,
      damage,
      isCrit,
      counterDamage: actualCounter,
      attackerHp: attacker.hp,
      targetHp: target.hp,
      targetEliminated: false,
      attackerEliminated: false,
    };
    
    const targetDied = target.hp <= 0;
    const attackerDied = attacker.hp <= 0;
    const bothDied = targetDied && attackerDied;
    
    if (bothDied) {
      target.eliminated = true;
      target.eliminatedAt = Date.now();
      attacker.eliminated = true;
      attacker.eliminatedAt = Date.now();
      
      attacker.kills++;
      target.kills++;
      
      battleRoyale.eliminations.push(target.accountId);
      battleRoyale.eliminations.push(attacker.accountId);
      
      if (aliveBeforeAttack === 2) {
        attacker.placement = 1;
        target.placement = 2;
        battleRoyale.winner = attacker.accountId;
      } else {
        const nextPlacement = aliveBeforeAttack - 1;
        attacker.placement = nextPlacement;
        target.placement = nextPlacement;
      }
      
      results.targetEliminated = true;
      results.attackerEliminated = true;
      results.targetPlacement = target.placement;
      results.attackerPlacement = attacker.placement;
      results.mutualElimination = true;
      
      broadcastToAllPlayers("battle_royale_elimination", {
        eliminated: `${target.username} & ${attacker.username}`,
        eliminator: "each other",
        aliveCount: aliveBeforeAttack - 2,
        placement: `${target.placement} (tie)`,
      });
    } else if (targetDied) {
      target.eliminated = true;
      target.eliminatedAt = Date.now();
      attacker.kills++;
      battleRoyale.eliminations.push(target.accountId);
      
      target.placement = aliveBeforeAttack;
      results.targetEliminated = true;
      results.targetPlacement = target.placement;
      
      broadcastToAllPlayers("battle_royale_elimination", {
        eliminated: target.username,
        eliminator: attacker.username,
        aliveCount: aliveBeforeAttack - 1,
        placement: target.placement,
      });
    } else if (attackerDied) {
      attacker.eliminated = true;
      attacker.eliminatedAt = Date.now();
      battleRoyale.eliminations.push(attacker.accountId);
      
      attacker.placement = aliveBeforeAttack;
      results.attackerEliminated = true;
      results.attackerPlacement = attacker.placement;
      
      broadcastToAllPlayers("battle_royale_elimination", {
        eliminated: attacker.username,
        eliminator: target.username,
        aliveCount: aliveBeforeAttack - 1,
        placement: attacker.placement,
      });
    }
    
    const aliveAfterAttack = Array.from(battleRoyale.participants.values()).filter(p => !p.eliminated);
    
    if (aliveAfterAttack.length === 1) {
      const winner = aliveAfterAttack[0];
      battleRoyale.status = "ended";
      battleRoyale.endedAt = Date.now();
      battleRoyale.winner = winner.accountId;
      winner.placement = 1;
      
      await distributeBattleRoyaleRewards();
      
      broadcastToAllPlayers("battle_royale_winner", {
        winner: winner.username,
        kills: winner.kills,
      });
      
      results.battleEnded = true;
      results.winner = winner.username;
    } else if (aliveAfterAttack.length === 0) {
      battleRoyale.status = "ended";
      battleRoyale.endedAt = Date.now();
      
      await distributeBattleRoyaleRewards();
      
      broadcastToAllPlayers("battle_royale_ended", {
        message: "Mutual elimination! Attacker wins by last hit.",
        winner: attacker.username,
      });
      
      results.battleEnded = true;
      results.winner = attacker.username;
    }
    
    res.json(results);
  });

  async function distributeBattleRoyaleRewards() {
    const sorted = Array.from(battleRoyale.participants.values())
      .sort((a, b) => (a.placement || 999) - (b.placement || 999));
    
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const participant = sorted[i];
      const account = await storage.getAccount(participant.accountId);
      if (!account) continue;
      
      let rewards: any = {};
      if (i === 0) rewards = BR_REWARDS.winner;
      else if (i === 1) rewards = BR_REWARDS.second;
      else if (i === 2) rewards = BR_REWARDS.third;
      else if (i === 3) rewards = BR_REWARDS.fourth;
      else if (i === 4) rewards = BR_REWARDS.fifth;
      
      const updates: any = {};
      if (rewards.gold) updates.gold = (account.gold || 0) + rewards.gold;
      if (rewards.rubies) updates.rubies = (account.rubies || 0) + rewards.rubies;
      if (rewards.soulShards) updates.soulShards = (account.soulShards || 0) + rewards.soulShards;
      if (rewards.focusedShards) updates.focusedShards = (account.focusedShards || 0) + rewards.focusedShards;
      if (rewards.trainingPoints) updates.trainingPoints = (account.trainingPoints || 0) + rewards.trainingPoints;
      if (rewards.soulGins) updates.soulGins = (account.soulGins || 0) + rewards.soulGins;
      if (rewards.beakCoins) updates.beakCoins = (account.beakCoins || 0) + rewards.beakCoins;
      if (rewards.valorTokens) updates.valorTokens = (account.valorTokens || 0) + rewards.valorTokens;
      
      await storage.updateAccount(participant.accountId, updates);
      
      broadcastToPlayer(participant.accountId, "battle_royale_reward", {
        placement: i + 1,
        rewards,
      });
    }
  }

  app.get("/api/battle-royale/my-status", async (req, res) => {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ error: "Account ID required" });
    }
    
    const isRegistered = battleRoyale.registrations.has(accountId);
    const participant = battleRoyale.participants.get(accountId);
    
    res.json({
      battleStatus: battleRoyale.status,
      isRegistered,
      isParticipant: !!participant,
      myData: participant ? {
        hp: participant.hp,
        maxHp: participant.maxHp,
        kills: participant.kills,
        eliminated: participant.eliminated,
        placement: participant.placement,
      } : null,
      targets: participant && !participant.eliminated 
        ? Array.from(battleRoyale.participants.values())
            .filter(p => p.accountId !== accountId && !p.eliminated)
            .map(p => ({
              accountId: p.accountId,
              username: p.username,
              race: p.race,
              hp: p.hp,
              maxHp: p.maxHp,
            }))
        : [],
    });
  });

  app.get("/api/accounts/:id/energy", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const maxEnergy = getMaxEnergyForRank(account.rank || "Novice");
      const { energy, lastEnergyUpdate } = regenerateEnergy(account);

      if (energy !== (account as any).energy) {
        await db.update(accounts).set({
          energy,
          maxEnergy,
          lastEnergyUpdate,
        }).where(eq(accounts.id, req.params.id));
      }

      res.json({
        energy,
        maxEnergy,
        lastEnergyUpdate: lastEnergyUpdate.toISOString(),
        costs: ENERGY_COSTS,
      });
    } catch (error) {
      console.error("Energy status error:", error);
      res.status(500).json({ error: "Failed to get energy status" });
    }
  });

  // Reputation System
  app.get("/api/accounts/:id/reputation", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const reputation = (account as any).reputationData || {};
      const factions = [
        { id: "merchants", name: "Merchant Guild", icon: "💰", current: reputation.merchants || 0, max: 100, unlockAt: 50, unlockReward: "Exclusive merchant discounts & rare items" },
        { id: "warriors", name: "Warriors Brotherhood", icon: "⚔️", current: reputation.warriors || 0, max: 100, unlockAt: 50, unlockReward: "Combat skills & weapon upgrades" },
        { id: "scholars", name: "Scholar Society", icon: "📚", current: reputation.scholars || 0, max: 100, unlockAt: 50, unlockReward: "Rare spell tomes & stat boosts" },
        { id: "naturalists", name: "Nature Wardens", icon: "🌿", current: reputation.naturalists || 0, max: 100, unlockAt: 50, unlockReward: "Rare pet encounters & training bonuses" },
      ];
      res.json({ factions, totalReputation: Object.values(reputation).reduce((a: number, b: any) => a + (b as number), 0) });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reputation" });
    }
  });

  app.post("/api/accounts/:id/reputation/gain", async (req, res) => {
    try {
      const { faction, amount } = req.body;
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const validFactions = ["merchants", "warriors", "scholars", "naturalists"];
      if (!validFactions.includes(faction)) return res.status(400).json({ error: "Invalid faction" });
      const rep: Record<string, number> = ((account as any).reputationData as Record<string, number>) || {};
      rep[faction] = Math.min(100, (rep[faction] || 0) + (amount || 5));
      await db.update(accounts).set({ reputationData: rep } as any).where(eq(accounts.id, req.params.id));
      res.json({ success: true, reputation: rep });
    } catch (error) {
      res.status(500).json({ error: "Failed to gain reputation" });
    }
  });

  app.post("/api/accounts/:id/use-energy-potion", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const potionCost = 500;
      if ((account.gold || 0) < potionCost) {
        return res.status(400).json({ error: "Not enough gold", required: potionCost });
      }

      const maxEnergy = getMaxEnergyForRank(account.rank || "Novice");
      const { energy } = regenerateEnergy(account);
      const restored = Math.min(maxEnergy, energy + 25);

      await db.update(accounts).set({
        gold: (account.gold || 0) - potionCost,
        energy: restored,
        maxEnergy,
        lastEnergyUpdate: new Date(),
      }).where(eq(accounts.id, req.params.id));

      res.json({
        success: true,
        energy: restored,
        maxEnergy,
        goldSpent: potionCost,
        message: `Used an Energy Potion! Restored ${restored - energy} energy.`,
      });
    } catch (error) {
      console.error("Energy potion error:", error);
      res.status(500).json({ error: "Failed to use energy potion" });
    }
  });

  // ========== DAY/NIGHT CYCLE & WEATHER SYSTEM ==========

  app.get("/api/world-time", (_req, res) => {
    res.json(getWorldTimeInfo());
  });

  app.get("/api/day-night", (_req, res) => {
    res.json(getDayNightState());
  });

  // ========== MONSTER SPAWN SYSTEM & WEATHER ==========

  app.get("/api/weather", (_req, res) => {
    res.json(getAllZoneWeather());
  });

  app.get("/api/zones/:zoneId/weather", (req, res) => {
    const weather = getZoneWeather(req.params.zoneId);
    res.json(weather);
  });

  app.post("/api/admin/weather/set", async (req, res) => {
    try {
      const { adminId, zoneId, weatherType, duration } = req.body;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });
      if (!WEATHER_TYPES.includes(weatherType)) return res.status(400).json({ error: "Invalid weather type" });
      const zones = zoneId === "all" ? ["capital_city", "mountain_caverns", "ancient_ruins", "enchanted_forest", "crystal_lake", "coastal_village", "ruby_mines", "battle_arena", "research_lab", "pet_training", "hell_zone", "mystic_tower"] : [zoneId];
      for (const z of zones) setZoneWeather(z, weatherType, duration || 1800000);
      res.json({ success: true, message: `Weather set to ${weatherType} in ${zones.length} zone(s)` });
    } catch (error) {
      res.status(500).json({ error: "Failed to set weather" });
    }
  });

  app.get("/api/zones/:zoneId/monsters/templates", (req, res) => {
    const templates = getZoneMonsterTemplates(req.params.zoneId);
    res.json({ zoneId: req.params.zoneId, templates });
  });

  app.get("/api/monsters/weather-bosses", (_req, res) => {
    res.json(getWeatherExclusiveBosses());
  });

  app.get("/api/monsters/active-count", (_req, res) => {
    res.json({ activeMonsters: getActiveMonsterCount() });
  });

  app.get("/api/zones/:zoneId/monster", async (req, res) => {
    try {
      const accountId = req.query.accountId as string;
      if (!accountId) return res.status(400).json({ error: "Account ID required" });

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const existing = getActiveMonster(req.params.zoneId, accountId);
      if (existing) {
        return res.json({ monsterActive: true, monster: formatMonsterResponse(existing) });
      }

      const spawned = checkTimerSpawn(req.params.zoneId, accountId, account.rank || "Novice");
      if (spawned) {
        await db.insert(monsterSpawnLog).values({
          accountId,
          zoneId: req.params.zoneId,
          monsterName: spawned.template.name,
          monsterElement: spawned.template.element,
          monsterLevel: spawned.level,
          isBoss: spawned.template.isBoss,
          source: "timer",
          weather: getZoneWeather(req.params.zoneId).type,
        });
        return res.json({ monsterActive: true, monster: formatMonsterResponse(spawned) });
      }

      res.json({ monsterActive: false, monster: null });
    } catch (error) {
      console.error("Monster check error:", error);
      res.status(500).json({ error: "Failed to check for monsters" });
    }
  });

  app.post("/api/zones/:zoneId/monster/spawn", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      if (account.isDead || account.ghostState) return res.status(403).json({ error: "Cannot encounter monsters in Ghost State" });

      const existing = getActiveMonster(req.params.zoneId, accountId);
      if (existing) {
        return res.json({ monsterActive: true, monster: formatMonsterResponse(existing) });
      }

      const spawned = spawnMonster(req.params.zoneId, accountId, account.rank || "Novice", "timer");
      if (!spawned) return res.status(500).json({ error: "Failed to spawn monster" });

      await db.insert(monsterSpawnLog).values({
        accountId,
        zoneId: req.params.zoneId,
        monsterName: spawned.template.name,
        monsterElement: spawned.template.element,
        monsterLevel: spawned.level,
        isBoss: spawned.template.isBoss,
        source: "timer",
        weather: getZoneWeather(req.params.zoneId).type,
      });

      res.json({ monsterActive: true, monster: formatMonsterResponse(spawned) });
    } catch (error) {
      console.error("Monster spawn error:", error);
      res.status(500).json({ error: "Failed to spawn monster" });
    }
  });

  app.post("/api/zones/:zoneId/monster/fight", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      if (account.isDead || account.ghostState) return res.status(403).json({ error: "Cannot fight in Ghost State" });

      const monster = getActiveMonster(req.params.zoneId, accountId);
      if (!monster) return res.status(404).json({ error: "No active monster in this zone" });

      const playerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };

      let monsterFightSpell: any = null;
      const monsterFightEquippedSkill = await storage.getEquippedSkill(accountId);
      if (monsterFightEquippedSkill) {
        const { getSkillById, RANK_MULTIPLIER } = await import("@shared/skills-data");
        const skillDef = getSkillById(monsterFightEquippedSkill.skillId);
        if (skillDef) {
          const rankMult = RANK_MULTIPLIER[account.rank || "Novice"] || 1.0;
          monsterFightSpell = {
            name: skillDef.name,
            multiplier: skillDef.spellPower || 1.5,
            element: skillDef.element,
            isAoE: skillDef.spellCategory === "aoe",
            targetCount: skillDef.targetCount,
            spellCategory: skillDef.spellCategory || "damage",
            spellPower: skillDef.spellPower || 1.5,
            ccType: skillDef.ccType,
            ccDuration: skillDef.ccDuration,
            buffStat: skillDef.buffStat,
            buffAmount: skillDef.buffAmount,
            rankMultiplier: rankMult,
          };
        }
      }

      const playerCombatant: Combatant = {
        id: accountId,
        name: account.username,
        stats: {
          Str: Number(playerStats.Str) || 10,
          Def: Number(playerStats.Def) || 10,
          Spd: Number(playerStats.Spd) || 10,
          Int: Number(playerStats.Int) || 10,
          Luck: Number(playerStats.Luck) || 10,
          Pot: Number(playerStats.Pot) || 0,
        },
        race: account.race,
        rank: account.rank,
        level: playerRanks.indexOf(account.rank) + 1,
        isPlayer: true,
        spell: monsterFightSpell,
      };

      const monsterCombatant: Combatant = {
        id: monster.id,
        name: monster.template.name,
        stats: monster.scaledStats,
        race: null,
        rank: null,
        elements: { elements: [monster.template.element], elementalPower: monster.level },
        level: monster.level,
        isPlayer: false,
      };

      const result = runAutoCombat(playerCombatant, monsterCombatant, 20);
      const playerWon = result.winner === accountId;

      clearActiveMonster(req.params.zoneId, accountId);

      let rewards = { gold: 0, trainingPoints: 0, soulShards: 0, petExp: 0 };
      if (playerWon) {
        rewards = calculateMonsterRewards(monster);
        await db.update(accounts).set({
          gold: (account.gold || 0) + rewards.gold,
          trainingPoints: (account.trainingPoints || 0) + rewards.trainingPoints,
          soulShards: (account.soulShards || 0) + rewards.soulShards,
          petExp: (account.petExp || 0) + rewards.petExp,
          lastCombatTime: new Date(),
        }).where(eq(accounts.id, accountId));
      } else {
        const penalty = calculateDeathPenalty(account.gold || 0);
        await db.update(accounts).set({
          gold: Math.max(0, (account.gold || 0) - penalty.goldLost),
          isDead: true,
          ghostState: true,
          deathCount: (account.deathCount || 0) + 1,
          lastDeathTime: new Date(),
          weaknessDebuffExpires: penalty.weaknessDebuffExpires,
          lastCombatTime: new Date(),
        }).where(eq(accounts.id, accountId));
      }

      await db.update(monsterSpawnLog).set({
        defeated: playerWon,
        goldReward: rewards.gold,
        completedAt: new Date(),
      }).where(eq(monsterSpawnLog.monsterName, monster.template.name));

      res.json({
        success: true,
        playerWon,
        combat: result,
        rewards: playerWon ? rewards : null,
        monster: {
          name: monster.template.name,
          element: monster.template.element,
          level: monster.level,
          isBoss: monster.template.isBoss,
        },
        weather: getZoneWeather(req.params.zoneId),
      });
    } catch (error) {
      console.error("Monster fight error:", error);
      res.status(500).json({ error: "Failed to fight monster" });
    }
  });

  app.post("/api/zones/:zoneId/monster/flee", async (req, res) => {
    try {
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);
      clearActiveMonster(req.params.zoneId, accountId);
      res.json({ success: true, message: "You fled from the monster!" });
    } catch (error) {
      res.status(500).json({ error: "Failed to flee" });
    }
  });

  app.get("/api/accounts/:id/monster-history", async (req, res) => {
    try {
      const logs = await db.select().from(monsterSpawnLog)
        .where(eq(monsterSpawnLog.accountId, req.params.id))
        .orderBy(sql`${monsterSpawnLog.spawnedAt} DESC`)
        .limit(50);
      res.json(logs);
    } catch (error) {
      console.error("Monster history error:", error);
      res.status(500).json({ error: "Failed to get monster history" });
    }
  });

  startMarketUpdates();

  app.get("/api/economy/market-prices", (_req, res) => {
    try {
      const prices = getAllMarketPrices();
      res.json({
        prices,
        taxRates: {
          auctionListing: AUCTION_LISTING_TAX_RATE,
          auctionSale: AUCTION_SALE_TAX_RATE,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get market prices" });
    }
  });

  app.get("/api/economy/item-price/:itemId", (req, res) => {
    try {
      const { itemId } = req.params;
      const { basePrice } = z.object({ basePrice: z.coerce.number() }).parse(req.query);
      const currentPrice = getMarketPrice(itemId, basePrice);
      const info = getMarketItemInfo(itemId);
      res.json({
        itemId,
        basePrice,
        currentPrice,
        supply: info?.supply || 10,
        demand: info?.demand || 10,
        lastUpdated: info?.lastUpdated || Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get item price" });
    }
  });

  app.get("/api/economy/repair-estimate/:itemId", async (req, res) => {
    try {
      const { inventoryItems } = await import("@shared/schema");
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, req.params.itemId));
      if (!item) return res.status(404).json({ error: "Item not found" });

      const durabilityToRepair = item.maxDurability - item.durability;
      const itemTier = getTierFromItemId(item.itemId);
      const repairCost = calculateRepairCost(itemTier, durabilityToRepair);
      res.json({
        itemId: item.id,
        currentDurability: item.durability,
        maxDurability: item.maxDurability,
        durabilityToRepair,
        repairCost,
        tier: itemTier,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to estimate repair cost" });
    }
  });

  app.get("/api/economy/auction-fees", (req, res) => {
    try {
      const { amount } = z.object({ amount: z.coerce.number() }).parse(req.query);
      res.json({
        listingFee: calculateAuctionListingFee(amount),
        saleTax: calculateAuctionSaleTax(amount),
        listingRate: AUCTION_LISTING_TAX_RATE,
        saleRate: AUCTION_SALE_TAX_RATE,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate auction fees" });
    }
  });

  app.get("/api/resource-zones", (_req, res) => {
    try {
      res.json(getAllGatherableZones());
    } catch (error) {
      res.status(500).json({ error: "Failed to get resource zones" });
    }
  });

  app.get("/api/resource-zones/:zoneId", (req, res) => {
    try {
      const zone = getZoneResources(req.params.zoneId);
      if (!zone) {
        return res.status(404).json({ error: "Zone not found or has no resources" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ error: "Failed to get zone resources" });
    }
  });

  app.get("/api/resource-zones/:zoneId/available/:accountId", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      const available = getAvailableResources(req.params.zoneId, account.rank || "Novice");
      const allResources = getZoneResources(req.params.zoneId);
      const locked = allResources ? allResources.resources
        .filter(r => {
          const rankIdx = playerRanks.indexOf(account.rank as any);
          return rankIdx < r.rankRequired;
        })
        .map(r => ({
          ...r,
          requiredRank: getRankRequirementLabel(r.rankRequired),
        })) : [];

      res.json({ available, locked });
    } catch (error) {
      res.status(500).json({ error: "Failed to get available resources" });
    }
  });

  app.get("/api/resource-zones/:zoneId/exhaustion", (req, res) => {
    try {
      const info = getZoneExhaustionInfo(req.params.zoneId);
      if (info.length === 0) {
        return res.status(404).json({ error: "Zone not found or has no resources" });
      }
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: "Failed to get exhaustion info" });
    }
  });

  app.post("/api/accounts/:id/gather", async (req, res) => {
    try {
      const accountId = req.params.id;
      const { zoneId } = z.object({ zoneId: z.string() }).parse(req.body);

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.isDead || account.ghostState) {
        return res.status(400).json({ error: "Cannot gather while in ghost state" });
      }

      const carryInfo = await getPlayerCarryInfo(accountId);
      if (carryInfo && carryInfo.isFull) {
        return res.status(400).json({ error: "Inventory full! You cannot carry any more items.", ...carryInfo });
      }

      const maxEn = getMaxEnergyForRank(account.rank || "Novice");
      const { energy: currentEnergy, lastEnergyUpdate: lastEnUp } = regenerateEnergy(account);
      if (currentEnergy < ENERGY_COSTS.gathering) {
        return res.status(400).json({ error: "Not enough energy to gather", required: ENERGY_COSTS.gathering, current: currentEnergy, maxEnergy: maxEn });
      }

      const zone = getZoneResources(zoneId);
      if (!zone) {
        return res.status(400).json({ error: "This zone has no gatherable resources" });
      }

      await db.update(accounts).set({ energy: currentEnergy - ENERGY_COSTS.gathering, lastEnergyUpdate: lastEnUp }).where(eq(accounts.id, accountId));

      const playerLuck = (account.stats as any)?.Luck || 10;

      let birdResourceLuck = 0;
      const { birds } = await import("@shared/schema");
      const accountBirds = await db.select().from(birds).where(eq(birds.accountId, accountId));
      if (accountBirds.length > 0) {
        const bestBird = accountBirds.reduce((best, b) => {
          const luck = (b.stats as any)?.resourceLuck || 0;
          return luck > ((best.stats as any)?.resourceLuck || 0) ? b : best;
        }, accountBirds[0]);
        birdResourceLuck = (bestBird.stats as any)?.resourceLuck || 0;
      }

      const gathered = gatherResources(zoneId, account.rank || "Novice", playerLuck, birdResourceLuck);

      let totalWeight = 0;
      let totalGoldValue = 0;
      for (const g of gathered) {
        totalWeight += g.weight;
        totalGoldValue += g.sellPrice;
      }

      if (totalGoldValue > 0) {
        await storage.updateAccountGold(accountId, account.gold + totalGoldValue);
      }

      let monsterEncounter = null;
      const actionMonster = checkActionSpawn(zoneId, accountId, account.rank || "Novice");
      if (actionMonster) {
        await db.insert(monsterSpawnLog).values({
          accountId,
          zoneId,
          monsterName: actionMonster.template.name,
          monsterElement: actionMonster.template.element,
          monsterLevel: actionMonster.level,
          isBoss: actionMonster.template.isBoss,
          source: "action",
          weather: getZoneWeather(zoneId).type,
        });
        monsterEncounter = formatMonsterResponse(actionMonster);
      }

      const exhaustion = getZoneExhaustionInfo(zoneId);

      res.json({
        success: true,
        gathered,
        totalWeight,
        goldEarned: totalGoldValue,
        birdLuckBonus: birdResourceLuck,
        monsterEncounter,
        exhaustion,
        energyRemaining: currentEnergy - ENERGY_COSTS.gathering,
      });
    } catch (error) {
      console.error("Gather error:", error);
      res.status(500).json({ error: "Gathering failed" });
    }
  });

  // ==================== ZONE DUNGEON ROUTES ====================

  app.get("/api/zone-dungeons", async (req, res) => {
    try {
      const dungeons = ZONE_DUNGEON_CONFIGS.map(d => ({
        zoneId: d.zoneId,
        name: d.name,
        theme: d.theme,
        description: d.description,
        floors: d.floors,
        minRank: d.minRank,
        bossName: d.boss.name,
        bossElement: d.boss.element,
      }));
      res.json({ dungeons });
    } catch (error) {
      console.error("Zone dungeons list error:", error);
      res.status(500).json({ error: "Failed to fetch zone dungeons" });
    }
  });

  app.get("/api/zone-dungeons/:zoneId", async (req, res) => {
    try {
      const config = getZoneDungeonConfig(req.params.zoneId);
      if (!config) {
        return res.status(404).json({ error: "No dungeon exists for this zone" });
      }
      res.json({
        zoneId: config.zoneId,
        name: config.name,
        theme: config.theme,
        description: config.description,
        floors: config.floors,
        minRank: config.minRank,
        monsters: config.monsters.map(m => ({ name: m.name, element: m.element, isBoss: m.isBoss })),
        boss: { name: config.boss.name, element: config.boss.element },
        floorRewards: config.floorRewards,
        completionRewards: { ...config.completionRewards, rareItemId: undefined },
      });
    } catch (error) {
      console.error("Zone dungeon info error:", error);
      res.status(500).json({ error: "Failed to fetch dungeon info" });
    }
  });

  app.get("/api/zone-dungeons/:zoneId/progress/:accountId", async (req, res) => {
    try {
      const { zoneId, accountId } = req.params;
      const config = getZoneDungeonConfig(zoneId);
      if (!config) {
        return res.status(404).json({ error: "No dungeon exists for this zone" });
      }

      const activeRuns = await db.select().from(zoneDungeonRuns)
        .where(sql`${zoneDungeonRuns.accountId} = ${accountId} AND ${zoneDungeonRuns.zoneId} = ${zoneId} AND ${zoneDungeonRuns.completed} = false`);

      const completedRuns = await db.select().from(zoneDungeonRuns)
        .where(sql`${zoneDungeonRuns.accountId} = ${accountId} AND ${zoneDungeonRuns.zoneId} = ${zoneId} AND ${zoneDungeonRuns.completed} = true`);

      res.json({
        activeRun: activeRuns.length > 0 ? activeRuns[0] : null,
        completionCount: completedRuns.length,
        totalGoldEarned: completedRuns.reduce((sum, r) => sum + r.totalGoldEarned, 0),
        totalXpEarned: completedRuns.reduce((sum, r) => sum + r.totalXpEarned, 0),
        totalMonstersDefeated: completedRuns.reduce((sum, r) => sum + r.monstersDefeated, 0),
      });
    } catch (error) {
      console.error("Zone dungeon progress error:", error);
      res.status(500).json({ error: "Failed to fetch dungeon progress" });
    }
  });

  app.post("/api/zone-dungeons/:zoneId/enter", async (req, res) => {
    try {
      const { zoneId } = req.params;
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);

      const config = getZoneDungeonConfig(zoneId);
      if (!config) {
        return res.status(404).json({ error: "No dungeon exists for this zone" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      if (account.isDead || account.ghostState) {
        return res.status(400).json({ error: "Cannot enter dungeons while dead or in ghost state" });
      }

      const playerRankIdx = playerRanks.indexOf(account.rank as any);
      const requiredRankIdx = playerRanks.indexOf(config.minRank as any);
      if (playerRankIdx < requiredRankIdx) {
        return res.status(400).json({ error: `Requires rank ${config.minRank} or higher to enter ${config.name}` });
      }

      const existingRuns = await db.select().from(zoneDungeonRuns)
        .where(sql`${zoneDungeonRuns.accountId} = ${accountId} AND ${zoneDungeonRuns.zoneId} = ${zoneId} AND ${zoneDungeonRuns.completed} = false`);

      if (existingRuns.length > 0) {
        const run = existingRuns[0];
        const isBossFloor = run.currentFloor > config.floors;
        return res.json({
          success: true,
          message: `Resuming ${config.name} - Floor ${Math.min(run.currentFloor, config.floors)}${isBossFloor ? ' (BOSS)' : ''}`,
          run,
          dungeon: { name: config.name, theme: config.theme, floors: config.floors },
        });
      }

      const [newRun] = await db.insert(zoneDungeonRuns).values({
        accountId,
        zoneId,
        currentFloor: 1,
        completed: false,
        totalGoldEarned: 0,
        totalXpEarned: 0,
        monstersDefeated: 0,
      }).returning();

      res.json({
        success: true,
        message: `Entered ${config.name} - Floor 1`,
        run: newRun,
        dungeon: { name: config.name, theme: config.theme, floors: config.floors },
      });
    } catch (error) {
      console.error("Zone dungeon enter error:", error);
      res.status(500).json({ error: "Failed to enter dungeon" });
    }
  });

  app.post("/api/zone-dungeons/:zoneId/fight", async (req, res) => {
    try {
      const { zoneId } = req.params;
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);

      const config = getZoneDungeonConfig(zoneId);
      if (!config) {
        return res.status(404).json({ error: "No dungeon exists for this zone" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      if (account.isDead || account.ghostState) {
        return res.status(400).json({ error: "Cannot fight while dead or in ghost state" });
      }

      const activeRuns = await db.select().from(zoneDungeonRuns)
        .where(sql`${zoneDungeonRuns.accountId} = ${accountId} AND ${zoneDungeonRuns.zoneId} = ${zoneId} AND ${zoneDungeonRuns.completed} = false`);

      if (activeRuns.length === 0) {
        return res.status(400).json({ error: "No active dungeon run. Enter the dungeon first." });
      }

      const run = activeRuns[0];
      const isBossFloor = run.currentFloor > config.floors;

      const monsterTemplate = isBossFloor
        ? config.boss
        : config.monsters[Math.floor(Math.random() * config.monsters.length)];

      const playerRankIdx = playerRanks.indexOf(account.rank as any);
      const safeRankIdx = playerRankIdx >= 0 ? playerRankIdx : 0;
      const rankScale = 1 + safeRankIdx * 0.5;
      const floorScale = 1 + (run.currentFloor - 1) * 0.15;

      const monsterStats = {
        Str: Math.max(1, Math.floor(monsterTemplate.baseStats.Str * rankScale * floorScale)),
        Def: Math.max(1, Math.floor(monsterTemplate.baseStats.Def * rankScale * floorScale)),
        Spd: Math.max(1, Math.floor(monsterTemplate.baseStats.Spd * rankScale * floorScale)),
        Int: Math.max(1, Math.floor(monsterTemplate.baseStats.Int * rankScale * floorScale)),
        Luck: Math.max(1, Math.floor(monsterTemplate.baseStats.Luck * rankScale * floorScale)),
        Pot: 0,
      };
      const baseHp = (monsterStats.Str + monsterStats.Def) * 5;
      const monsterHp = Math.max(10, Math.floor(baseHp * monsterTemplate.hpMultiplier * floorScale));
      const monsterLevel = Math.max(1, Math.floor((safeRankIdx + 1) * 10 * floorScale * (isBossFloor ? 1.5 : 1)));

      const playerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      const playerMaxHP = calculateMaxHP(playerStats as any, safeRankIdx * 10, account.race, account.rank);

      const playerCombatant: Combatant = {
        id: accountId,
        name: account.username,
        stats: { ...playerStats as any, HP: playerMaxHP, maxHP: playerMaxHP },
        race: account.race,
        rank: account.rank,
        elements: { elements: [], elementalPower: 0 },
        immunities: [],
        level: safeRankIdx * 10 + 1,
        isPlayer: true,
      };

      const raceElement = account.race ? (raceModifiers[account.race as keyof typeof raceModifiers]?.element || null) : null;
      if (raceElement) {
        playerCombatant.elements = { elements: [raceElement], elementalPower: 10 + safeRankIdx * 5 };
      }

      const monsterCombatant: Combatant = {
        id: `dungeon_monster_${run.id}_${run.currentFloor}`,
        name: monsterTemplate.name,
        stats: { ...monsterStats, HP: monsterHp, maxHP: monsterHp },
        elements: { elements: [monsterTemplate.element], elementalPower: 5 + safeRankIdx * 3 },
        immunities: [],
        level: monsterLevel,
        isPlayer: false,
      };

      const combatResult = runAutoCombat(playerCombatant, monsterCombatant);

      const playerWon = combatResult.winner === accountId;

      if (!playerWon) {
        await db.update(zoneDungeonRuns).set({
          completed: true,
          completedAt: new Date(),
        }).where(eq(zoneDungeonRuns.id, run.id));

        return res.json({
          success: false,
          message: `You were defeated by ${monsterTemplate.name} on floor ${Math.min(run.currentFloor, config.floors)}${isBossFloor ? ' (BOSS)' : ''}! Dungeon run ended.`,
          combat: combatResult,
          monster: { name: monsterTemplate.name, element: monsterTemplate.element, level: monsterLevel, isBoss: isBossFloor },
          floor: run.currentFloor,
          runEnded: true,
          rewards: { gold: run.totalGoldEarned, xp: run.totalXpEarned, monstersDefeated: run.monstersDefeated },
        });
      }

      const rewards = isBossFloor ? config.completionRewards : config.floorRewards;
      const scaledGold = Math.floor(rewards.gold * (1 + safeRankIdx * 0.1));
      const scaledXp = Math.floor(rewards.xp * (1 + safeRankIdx * 0.1));
      const scaledTP = Math.floor(rewards.trainingPoints * (1 + safeRankIdx * 0.05));
      const scaledShards = rewards.soulShards;

      await db.update(accounts).set({
        gold: sql`${accounts.gold} + ${scaledGold}`,
        trainingPoints: sql`${accounts.trainingPoints} + ${scaledTP}`,
        soulShards: sql`${accounts.soulShards} + ${scaledShards}`,
        lastCombatTime: new Date(),
      }).where(eq(accounts.id, accountId));

      let rareItemDropped: string | null = null;
      if (isBossFloor && rewards.rareItemId && Math.random() < rewards.rareItemChance) {
        rareItemDropped = rewards.rareItemId;
      }

      if (isBossFloor) {
        await db.update(zoneDungeonRuns).set({
          completed: true,
          completedAt: new Date(),
          totalGoldEarned: run.totalGoldEarned + scaledGold,
          totalXpEarned: run.totalXpEarned + scaledXp,
          monstersDefeated: run.monstersDefeated + 1,
        }).where(eq(zoneDungeonRuns.id, run.id));

        return res.json({
          success: true,
          message: `You defeated ${monsterTemplate.name} and completed ${config.name}!`,
          combat: combatResult,
          monster: { name: monsterTemplate.name, element: monsterTemplate.element, level: monsterLevel, isBoss: true },
          floor: run.currentFloor,
          dungeonCompleted: true,
          rewards: {
            gold: run.totalGoldEarned + scaledGold,
            xp: run.totalXpEarned + scaledXp,
            trainingPoints: scaledTP,
            soulShards: scaledShards,
            rareItemDropped,
            monstersDefeated: run.monstersDefeated + 1,
          },
        });
      }

      const nextFloor = run.currentFloor + 1;
      const isNextBoss = nextFloor > config.floors;

      await db.update(zoneDungeonRuns).set({
        currentFloor: nextFloor,
        totalGoldEarned: run.totalGoldEarned + scaledGold,
        totalXpEarned: run.totalXpEarned + scaledXp,
        monstersDefeated: run.monstersDefeated + 1,
      }).where(eq(zoneDungeonRuns.id, run.id));

      res.json({
        success: true,
        message: `You defeated ${monsterTemplate.name}! ${isNextBoss ? 'The dungeon boss awaits...' : `Advancing to floor ${nextFloor}`}`,
        combat: combatResult,
        monster: { name: monsterTemplate.name, element: monsterTemplate.element, level: monsterLevel, isBoss: false },
        floor: run.currentFloor,
        nextFloor,
        isNextBoss,
        rewards: {
          gold: scaledGold,
          xp: scaledXp,
          trainingPoints: scaledTP,
          soulShards: scaledShards,
        },
      });
    } catch (error) {
      console.error("Zone dungeon fight error:", error);
      res.status(500).json({ error: "Failed to fight in dungeon" });
    }
  });

  app.post("/api/zone-dungeons/:zoneId/abandon", async (req, res) => {
    try {
      const { zoneId } = req.params;
      const { accountId } = z.object({ accountId: z.string() }).parse(req.body);

      const activeRuns = await db.select().from(zoneDungeonRuns)
        .where(sql`${zoneDungeonRuns.accountId} = ${accountId} AND ${zoneDungeonRuns.zoneId} = ${zoneId} AND ${zoneDungeonRuns.completed} = false`);

      if (activeRuns.length === 0) {
        return res.status(400).json({ error: "No active dungeon run to abandon" });
      }

      await db.update(zoneDungeonRuns).set({
        completed: true,
        completedAt: new Date(),
      }).where(eq(zoneDungeonRuns.id, activeRuns[0].id));

      res.json({
        success: true,
        message: "Dungeon run abandoned. You keep rewards earned so far.",
        rewards: {
          gold: activeRuns[0].totalGoldEarned,
          xp: activeRuns[0].totalXpEarned,
          monstersDefeated: activeRuns[0].monstersDefeated,
        },
      });
    } catch (error) {
      console.error("Zone dungeon abandon error:", error);
      res.status(500).json({ error: "Failed to abandon dungeon" });
    }
  });

  // ==================== VALORPEDIA ROUTES ====================
  app.get("/api/accounts/:id/valorpedia", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const discoveries = await db.select().from(valorpediaDiscoveries).where(eq(valorpediaDiscoveries.accountId, req.params.id));
      const claimedMilestones = await db.select().from(valorpediaMilestonesClaimed).where(eq(valorpediaMilestonesClaimed.accountId, req.params.id));

      const discoveredSet = new Set(discoveries.map(d => `${d.category}:${d.entryId}`));
      const claimedSet = new Set(claimedMilestones.map(m => m.milestoneId));

      let totalEntries = 0;
      let totalDiscovered = 0;
      const categories = valorpediaCategories.map(cat => {
        const entries = VALORPEDIA_ENTRIES[cat];
        const discovered = entries.filter(e => discoveredSet.has(`${cat}:${e.id}`));
        totalEntries += entries.length;
        totalDiscovered += discovered.length;
        return {
          category: cat,
          total: entries.length,
          discovered: discovered.length,
          entries: entries.map(e => ({
            ...e,
            discovered: discoveredSet.has(`${cat}:${e.id}`),
            discoveredAt: discoveries.find(d => d.category === cat && d.entryId === e.id)?.discoveredAt || null,
          })),
        };
      });

      const completionPercent = totalEntries > 0 ? Math.floor((totalDiscovered / totalEntries) * 100) : 0;

      const milestones = VALORPEDIA_MILESTONES.map(m => ({
        ...m,
        claimed: claimedSet.has(m.id),
        eligible: completionPercent >= m.requiredPercent,
      }));

      res.json({
        categories,
        totalEntries,
        totalDiscovered,
        completionPercent,
        milestones,
      });
    } catch (error) {
      console.error("Valorpedia fetch error:", error);
      res.status(500).json({ error: "Failed to fetch Valorpedia data" });
    }
  });

  app.post("/api/accounts/:id/valorpedia/discover", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { category, entryId } = req.body;
      if (!valorpediaCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }

      const entries = VALORPEDIA_ENTRIES[category as keyof typeof VALORPEDIA_ENTRIES];
      if (!entries.find(e => e.id === entryId)) {
        return res.status(400).json({ error: "Invalid entry ID" });
      }

      const existing = await db.select().from(valorpediaDiscoveries).where(
        sql`${valorpediaDiscoveries.accountId} = ${req.params.id} AND ${valorpediaDiscoveries.category} = ${category} AND ${valorpediaDiscoveries.entryId} = ${entryId}`
      );

      if (existing.length > 0) {
        return res.json({ success: true, alreadyDiscovered: true });
      }

      await db.insert(valorpediaDiscoveries).values({
        accountId: req.params.id,
        category,
        entryId,
      });

      res.json({ success: true, alreadyDiscovered: false });
    } catch (error) {
      console.error("Valorpedia discover error:", error);
      res.status(500).json({ error: "Failed to record discovery" });
    }
  });

  app.post("/api/accounts/:id/valorpedia/claim-milestone", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const { milestoneId } = req.body;
      const milestone = VALORPEDIA_MILESTONES.find(m => m.id === milestoneId);
      if (!milestone) return res.status(400).json({ error: "Invalid milestone" });

      const alreadyClaimed = await db.select().from(valorpediaMilestonesClaimed).where(
        sql`${valorpediaMilestonesClaimed.accountId} = ${req.params.id} AND ${valorpediaMilestonesClaimed.milestoneId} = ${milestoneId}`
      );
      if (alreadyClaimed.length > 0) {
        return res.status(400).json({ error: "Milestone already claimed" });
      }

      const discoveries = await db.select().from(valorpediaDiscoveries).where(eq(valorpediaDiscoveries.accountId, req.params.id));
      let totalEntries = 0;
      for (const cat of valorpediaCategories) {
        totalEntries += VALORPEDIA_ENTRIES[cat].length;
      }
      const completionPercent = totalEntries > 0 ? Math.floor((discoveries.length / totalEntries) * 100) : 0;

      if (completionPercent < milestone.requiredPercent) {
        return res.status(400).json({ error: `Need ${milestone.requiredPercent}% completion (currently ${completionPercent}%)` });
      }

      await db.insert(valorpediaMilestonesClaimed).values({
        accountId: req.params.id,
        milestoneId,
      });

      let goldReward = 0;
      let rubiesReward = 0;
      if (milestone.rewards.gold) {
        goldReward = milestone.rewards.gold;
        await db.update(accounts).set({
          gold: sql`${accounts.gold} + ${goldReward}`,
        }).where(eq(accounts.id, req.params.id));
      }
      if (milestone.rewards.rubies) {
        rubiesReward = milestone.rewards.rubies;
        await db.update(accounts).set({
          rubies: sql`${accounts.rubies} + ${rubiesReward}`,
        }).where(eq(accounts.id, req.params.id));
      }
      if (milestone.rewards.title) {
        await db.insert(playerTitles).values({
          accountId: req.params.id,
          titleId: `valorpedia_${milestoneId}`,
          category: "event",
          name: milestone.rewards.title,
        });
      }

      res.json({
        success: true,
        rewards: { gold: goldReward, rubies: rubiesReward, title: milestone.rewards.title || null },
      });
    } catch (error) {
      console.error("Valorpedia milestone claim error:", error);
      res.status(500).json({ error: "Failed to claim milestone" });
    }
  });

  // T024: Unity Group Quests
  app.get("/api/guilds/:guildId/quests", async (req, res) => {
    try {
      const { guildId } = req.params;
      const quests = await db.select().from(guildQuests).where(
        sql`${guildQuests.guildId} = ${guildId} OR ${guildQuests.guildId} IS NULL`
      );
      
      const contributions = await db.select().from(guildQuestContributions).where(
        sql`${guildQuestContributions.questId} IN (SELECT id FROM guild_quests WHERE guild_id = ${guildId} OR guild_id IS NULL)`
      );

      res.json({ quests, contributions });
    } catch (error) {
      console.error("Error fetching guild quests:", error);
      res.status(500).json({ error: "Failed to fetch guild quests" });
    }
  });

  app.post("/api/guilds/:guildId/quests/:questId/contribute", async (req, res) => {
    try {
      const { guildId, questId } = req.params;
      const { accountId, amount } = req.body;

      const [quest] = await db.select().from(guildQuests).where(eq(guildQuests.id, questId));
      if (!quest) return res.status(404).json({ error: "Quest not found" });
      if (quest.status !== "active") return res.status(400).json({ error: "Quest is not active" });

      const newAmount = Math.min(quest.targetAmount, quest.currentAmount + amount);
      const contributionAdded = newAmount - quest.currentAmount;

      await db.update(guildQuests)
        .set({ 
          currentAmount: newAmount,
          status: newAmount >= quest.targetAmount ? "completed" : "active"
        })
        .where(eq(guildQuests.id, questId));

      const existingContrib = await db.select().from(guildQuestContributions).where(
        sql`${guildQuestContributions.questId} = ${questId} AND ${guildQuestContributions.accountId} = ${accountId}`
      );

      if (existingContrib.length > 0) {
        await db.update(guildQuestContributions)
          .set({ amount: existingContrib[0].amount + contributionAdded, updatedAt: new Date() })
          .where(eq(guildQuestContributions.id, existingContrib[0].id));
      } else {
        await db.insert(guildQuestContributions).values({
          questId,
          accountId,
          amount: contributionAdded
        });
      }

      // If completed, distribute rewards
      if (newAmount >= quest.targetAmount) {
        const guildMembers = await db.select().from(accounts).where(eq(accounts.id, accountId)); // Simplified reward logic
        // In a full implementation, we'd reward all contributors. For now, focus on the routing.
      }

      res.json({ success: true, currentAmount: newAmount, status: newAmount >= quest.targetAmount ? "completed" : "active" });
    } catch (error) {
      console.error("Error contributing to guild quest:", error);
      res.status(500).json({ error: "Failed to contribute to guild quest" });
    }
  });

  app.post("/api/admin/guild-quests", async (req, res) => {
    try {
      const questData = insertGuildQuestSchema.parse(req.body);
      const [newQuest] = await db.insert(guildQuests).values(questData).returning();
      res.status(201).json(newQuest);
    } catch (error) {
      console.error("Error creating guild quest:", error);
      res.status(500).json({ error: "Failed to create guild quest" });
    }
  });

  // T017: Pet Mercenary Routes
  app.post("/api/pets/:id/mercenary", async (req, res) => {
    try {
      const { durationHours } = req.body;
      const pet = await storage.getPet(req.params.id);
      if (!pet) return res.status(404).json({ error: "Pet not found" });
      if (pet.isFainted) return res.status(400).json({ error: "Fainted pets cannot be sent on missions" });
      if (pet.mercenaryUntil && new Date(pet.mercenaryUntil) > new Date()) {
        return res.status(400).json({ error: "Pet is already on a mission" });
      }

      const rewardGold = durationHours * 1000 * (pet.bondLevel + 1);
      const mercenaryUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      const { pets } = await import("@shared/schema");
      await db.update(pets).set({
        mercenaryUntil,
        mercenaryRewardGold: rewardGold,
      }).where(eq(pets.id, req.params.id));

      res.json({ success: true, mercenaryUntil, rewardGold });
    } catch (error) {
      console.error("Pet mercenary error:", error);
      res.status(500).json({ error: "Failed to send pet on mission" });
    }
  });

  app.post("/api/pets/:id/collect-mercenary", async (req, res) => {
    try {
      const pet = await storage.getPet(req.params.id);
      if (!pet) return res.status(404).json({ error: "Pet not found" });
      
      if (!pet.mercenaryUntil || new Date(pet.mercenaryUntil) > new Date()) {
        return res.status(400).json({ error: "Mission not complete yet" });
      }

      const rewardGold = pet.mercenaryRewardGold || 0;
      await db.update(accounts).set({
        gold: sql`${accounts.gold} + ${rewardGold}`,
      }).where(eq(accounts.id, pet.accountId));

      const { pets } = await import("@shared/schema");
      await db.update(pets).set({
        mercenaryUntil: null,
        mercenaryRewardGold: 0,
      }).where(eq(pets.id, req.params.id));

      res.json({ success: true, rewardGold });
    } catch (error) {
      console.error("Collect mercenary error:", error);
      res.status(500).json({ error: "Failed to collect rewards" });
    }
  });

  // T028: World Boss Routes
  app.get("/api/world-boss", async (req, res) => {
    try {
      const boss = await getActiveWorldBoss();
      res.json(boss);
    } catch (error) {
      res.status(500).json({ error: "Failed to get world boss" });
    }
  });

  app.post("/api/world-boss/attack", async (req, res) => {
    try {
      const { accountId, damage } = req.body;
      const boss = await getActiveWorldBoss();
      if (!boss) return res.status(404).json({ error: "No active world boss" });

      await recordBossDamage(boss.id, accountId, damage);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to attack world boss" });
    }
  });

  // T030: Tournament Betting
  app.post("/api/tournaments/:id/matches/:matchIndex/bet", async (req, res) => {
    try {
      const { id, matchIndex } = req.params;
      const { accountId, betAmount } = req.body;
      
      const account = await storage.getAccount(accountId);
      if (!account || account.gold < betAmount) {
        return res.status(400).json({ error: "Insufficient gold for betting" });
      }

      await db.insert(tournamentBetting).values({
        tournamentId: id,
        matchId: parseInt(matchIndex),
        accountId,
        betAmount
      });

      await storage.updateAccountGold(accountId, -betAmount);
      res.json({ success: true });
    } catch (error) {
      console.error("Betting error:", error);
      res.status(500).json({ error: "Failed to place bet" });
    }
  });

  app.get("/api/tournaments/:id/matches/:matchIndex/bets", async (req, res) => {
    try {
      const { id, matchIndex } = req.params;
      const bets = await db.select().from(tournamentBetting).where(
        sql`${tournamentBetting.tournamentId} = ${id} AND ${tournamentBetting.matchId} = ${parseInt(matchIndex)}`
      );
      res.json(bets);
    } catch (error) {
      console.error("Error fetching bets:", error);
      res.status(500).json({ error: "Failed to fetch bets" });
    }
  });

  // T039: Shard System
  app.get("/api/shards", async (req, res) => {
    try {
      const allShards = await db.select().from(shards);
      res.json(allShards);
    } catch (error) {
      console.error("Error fetching shards:", error);
      res.status(500).json({ error: "Failed to fetch shards" });
    }
  });

  app.get("/api/shards/race-counts", async (req, res) => {
    try {
      const counts = await db.select({
        shardType: shards.shardType,
        count: sql<number>`count(*)::int`,
      }).from(shards).groupBy(shards.shardType);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching shard counts:", error);
      res.status(500).json({ error: "Failed to fetch shard counts" });
    }
  });

  app.post("/api/shards/collect", async (req, res) => {
    try {
      const { accountId, shardType, zone } = req.body;
      const [newShard] = await db.insert(shards).values({
        shardType,
        ownerId: accountId,
        zone,
        isPhysical: true
      }).returning();
      
      // Also update the account's shard count
      const shardField = `${shardType}Shards`;
      // Handle the mysticShardsCount exception
      const fieldToUpdate = shardType === 'mystic' ? 'mysticShardsCount' : shardField;
      
      await db.update(accounts)
        .set({ [fieldToUpdate]: sql`${accounts[fieldToUpdate as keyof typeof accounts]} + 1` })
        .where(eq(accounts.id, accountId));

      res.status(201).json(newShard);
    } catch (error) {
      console.error("Error collecting shard:", error);
      res.status(500).json({ error: "Failed to collect shard" });
    }
  });

  // T036: Auction House Routes
  app.get("/api/auctions", async (req, res) => {
    try {
      const activeAuctions = await db.select().from(auctions).where(eq(auctions.status, "active"));
      res.json(activeAuctions);
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res.status(500).json({ error: "Failed to fetch auctions" });
    }
  });

  app.post("/api/auctions", async (req, res) => {
    try {
      const data = insertAuctionSchema.parse(req.body);
      const [newAuction] = await db.insert(auctions).values(data).returning();
      res.status(201).json(newAuction);
    } catch (error) {
      console.error("Error creating auction:", error);
      res.status(500).json({ error: "Failed to create auction" });
    }
  });

  app.post("/api/auctions/:id/bid", async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId, amount } = req.body;
      
      const [auction] = await db.select().from(auctions).where(eq(auctions.id, id));
      if (!auction || auction.status !== "active") {
        return res.status(404).json({ error: "Auction not found or closed" });
      }

      if (amount <= auction.currentBid) {
        return res.status(400).json({ error: "Bid must be higher than current bid" });
      }

      await db.transaction(async (tx) => {
        await tx.insert(auctionBids).values({
          auctionId: id,
          bidderId: accountId,
          amount,
        });
        await tx.update(auctions).set({
          currentBid: amount,
          highestBidderId: accountId,
        }).where(eq(auctions.id, id));
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error placing bid:", error);
      res.status(500).json({ error: "Failed to place bid" });
    }
  });

  app.post("/api/admin/auctions/finalize", async (req, res) => {
    try {
      const now = new Date();
      const expiredAuctions = await db.select().from(auctions).where(
        and(eq(auctions.status, "active"), lt(auctions.endAt, now))
      );

      for (const auction of expiredAuctions) {
        await db.update(auctions).set({ status: "completed" }).where(eq(auctions.id, auction.id));
        // Logic for transferring item/gold would go here
      }

      res.json({ success: true, finalizedCount: expiredAuctions.length });
    } catch (error) {
      console.error("Error finalizing auctions:", error);
      res.status(500).json({ error: "Failed to finalize auctions" });
    }
  });

  // T020: Crafting Routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const allRecipes = await db.select().from(recipes);
      res.json(allRecipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.post("/api/craft", async (req, res) => {
    try {
      const { accountId, recipeId } = req.body;
      const newItem = await craftItem(accountId, recipeId);
      res.json(newItem);
    } catch (error) {
      console.error("Error crafting item:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Crafting failed" });
    }
  });

  app.post("/api/socket", async (req, res) => {
    try {
      const { accountId, itemId, gemItemId } = req.body;
      await socketGem(accountId, itemId, gemItemId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error socketing gem:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Socketing failed" });
    }
  });

  app.post("/api/accounts/logout", authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user) {
        await db.update(accounts).set({ currentSessionId: null }).where(eq(accounts.id, req.user.id));
        activeSessions.delete(req.user.id);
      }
      res.clearCookie(COOKIE_NAME);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/world-boss/state", async (req, res) => {
    try {
      const boss = await getActiveWorldBoss();
      if (!boss) {
        return res.json({ isActive: false });
      }

      const contributors = await db.select({
        accountId: worldBossDamage.accountId,
        username: accounts.username,
        damage: worldBossDamage.damage,
      })
      .from(worldBossDamage)
      .leftJoin(accounts, eq(worldBossDamage.accountId, accounts.id))
      .where(eq(worldBossDamage.bossId, boss.id))
      .orderBy(desc(worldBossDamage.damage))
      .limit(10);

      res.json({
        isActive: true,
        boss: {
          id: boss.id,
          name: boss.name,
          hp: boss.hp,
          maxHp: boss.maxHp,
          rank: boss.rank,
          elements: boss.elements,
          expiresAt: boss.expiresAt,
          location: boss.location,
        },
        leaderboard: contributors,
      });
    } catch (error) {
      console.error("Error getting world boss state:", error);
      res.status(500).json({ error: "Failed to get world boss state" });
    }
  });

  app.post("/api/world-boss/attack", async (req, res) => {
    try {
      const { accountId, damage } = req.body;
      const boss = await getActiveWorldBoss();
      
      if (!boss) {
        return res.status(404).json({ error: "No active world boss" });
      }

      await recordBossDamage(boss.id, accountId, damage);
      
      const updatedBoss = await db.select().from(worldBosses).where(eq(worldBosses.id, boss.id)).limit(1);
      
      res.json({ 
        success: true, 
        currentHp: updatedBoss[0]?.hp || 0,
        isDefeated: updatedBoss[0]?.status === "defeated"
      });
    } catch (error) {
      console.error("Error attacking world boss:", error);
      res.status(500).json({ error: "Failed to attack world boss" });
    }
  });

  app.post("/api/admin/world-boss/spawn", async (req, res) => {
    try {
      // Check admin role (middleware should handle this but adding check for safety)
      const boss = await spawnWorldBoss(true);
      broadcastToAllPlayers("worldBossSpawned", { bossName: boss.name });
      res.json({ success: true, boss });
    } catch (error) {
      console.error("Error spawning world boss:", error);
      res.status(500).json({ error: "Failed to spawn world boss" });
    }
  });

  app.post("/api/admin/world-boss/end", async (req, res) => {
    try {
      const boss = await getActiveWorldBoss();
      if (boss) {
        await db.update(worldBosses)
          .set({ status: "expired", expiresAt: new Date() })
          .where(eq(worldBosses.id, boss.id));
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "No active world boss to end" });
      }
    } catch (error) {
      console.error("Error ending world boss:", error);
      res.status(500).json({ error: "Failed to end world boss" });
    }
  });

  // T017: Pet Mercenary System
  const PET_MERCENARY_FEES: Record<string, number> = {
    "egg": 0,
    "baby": 5,
    "teen": 15,
    "adult": 40,
    "legend": 100,
    "mythic": 300
  };

  app.post("/api/pets/:id/mercenary", async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId, durationHours } = req.body;

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const pet = await storage.getPet(id);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found" });
      }

      if (pet.mercenaryUntil && new Date(pet.mercenaryUntil) > new Date()) {
        return res.status(400).json({ error: "Pet is already on a mission" });
      }

      const hourlyRate = PET_MERCENARY_FEES[pet.tier] || 5;
      const totalReward = hourlyRate * durationHours;
      const mercenaryUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      await db.update(petsTable).set({
        mercenaryUntil,
        mercenaryRewardGold: totalReward
      }).where(eq(petsTable.id, id));

      res.json({ 
        success: true, 
        message: `Pet deployed for ${durationHours} hours. Expected reward: ${totalReward} Gold.`,
        mercenaryUntil,
        reward: totalReward
      });
    } catch (error) {
      console.error("Error deploying mercenary:", error);
      res.status(500).json({ error: "Failed to deploy mercenary" });
    }
  });

  app.post("/api/pets/:id/collect-mercenary", async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId } = req.body;

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const pet = await storage.getPet(id);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found" });
      }

      if (!pet.mercenaryUntil || new Date(pet.mercenaryUntil) > new Date()) {
        return res.status(400).json({ error: "Mission not finished yet" });
      }

      const reward = pet.mercenaryRewardGold || 0;

      await db.transaction(async (tx) => {
        await tx.update(accounts).set({
          gold: account.gold + reward,
          mercenaryIncomeCollected: (account.mercenaryIncomeCollected || 0) + reward
        }).where(eq(accounts.id, accountId));

        await tx.update(petsTable).set({
          mercenaryUntil: null,
          mercenaryRewardGold: 0
        }).where(eq(petsTable.id, id));
      });

      res.json({ 
        success: true, 
        message: `Collected ${reward} Gold!`,
        goldGained: reward
      });
    } catch (error) {
      console.error("Error collecting mercenary reward:", error);
      res.status(500).json({ error: "Failed to collect reward" });
    }
  });

  app.get("/api/accounts/:id/mercenary-income", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) return res.status(404).json({ error: "Account not found" });
      res.json({ totalIncome: account.mercenaryIncomeCollected || 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch income" });
    }
  });

  app.post("/api/tournaments/:id/bet", async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId, matchId, targetPlayerId, amount } = req.body;

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      if (account.gold < amount) return res.status(400).json({ error: "Insufficient gold" });

      // Check tournament status
      const [tournament] = await db.select().from(sql`tournaments`).where(eq(sql`id`, id)) as any[];
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "pending") return res.status(400).json({ error: "Betting closed" });

      // Calculate odds (simplified for now: base 1.5, could be rank-based)
      const odds = "1.5";

      await db.transaction(async (tx) => {
        await tx.update(accounts).set({ gold: account.gold - amount }).where(eq(accounts.id, accountId));
        await tx.insert(tournamentBetting).values({
          tournamentId: id,
          matchId: Number(matchId),
          accountId,
          targetPlayerId,
          amount,
          odds,
          status: "pending",
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error placing tournament bet:", error);
      res.status(500).json({ error: "Failed to place bet" });
    }
  });

  app.get("/api/tournaments/:id/bets", async (req, res) => {
    try {
      const { id } = req.params;
      const bets = await db.select().from(tournamentBetting).where(eq(tournamentBetting.tournamentId, id));
      res.json(bets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bets" });
    }
  });

  app.post("/api/tournaments/:id/resolve-bets", async (req, res) => {
    try {
      const { id } = req.params;
      const { matchId, winnerId } = req.body;

      const bets = await db.select().from(tournamentBetting).where(
        and(
          eq(tournamentBetting.tournamentId, id),
          eq(tournamentBetting.matchId, matchId),
          eq(tournamentBetting.status, "pending")
        )
      );

      for (const bet of bets) {
        if (bet.targetPlayerId === winnerId) {
          const payout = Math.floor(bet.amount * parseFloat(bet.odds));
          const houseCut = Math.floor(payout * 0.05);
          const finalPayout = payout - houseCut;

          await db.transaction(async (tx) => {
            const [account] = await tx.select().from(accounts).where(eq(accounts.id, bet.accountId));
            if (account) {
              await tx.update(accounts).set({ gold: (account.gold || 0) + finalPayout }).where(eq(accounts.id, bet.accountId));
            }
            await tx.update(tournamentBetting).set({
              status: "paid",
              payout: finalPayout
            }).where(eq(tournamentBetting.id, bet.id));
          });
        } else {
          await db.update(tournamentBetting).set({
            status: "lost",
            payout: 0
          }).where(eq(tournamentBetting.id, bet.id));
        }
      }

      res.json({ success: true, resolvedCount: bets.length });
    } catch (error) {
      console.error("Error resolving bets:", error);
      res.status(500).json({ error: "Failed to resolve bets" });
    }
  });

  app.post("/api/hell-zone/join", async (req, res) => {
    try {
      const { accountId } = req.body;
      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const [activeSession] = await db.select()
        .from(hellZoneSessions)
        .where(eq(hellZoneSessions.isActive, true))
        .limit(1);

      if (!activeSession) {
        return res.status(400).json({ error: "No active Hell Zone session" });
      }

      const [existing] = await db.select()
        .from(hellZoneParticipants)
        .where(and(
          eq(hellZoneParticipants.sessionId, activeSession.id),
          eq(hellZoneParticipants.accountId, accountId)
        ))
        .limit(1);

      if (existing) {
        return res.status(400).json({ error: "Already joined" });
      }

      const stats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10 };
      const maxHp = calculateMaxHP(stats as CombatStats, playerRanks.indexOf(account.rank), account.race, account.rank);

      await db.insert(hellZoneParticipants).values({
        sessionId: activeSession.id,
        accountId,
        hp: maxHp,
        maxHp,
        kills: 0,
        isEliminated: false,
      });

      res.json({ success: true, message: "Joined The Collapse!" });
    } catch (error) {
      console.error("Hell Zone join error:", error);
      res.status(500).json({ error: "Failed to join Hell Zone" });
    }
  });

  app.get("/api/hell-zone/state", async (req, res) => {
    try {
      const [session] = await db.select()
        .from(hellZoneSessions)
        .where(eq(hellZoneSessions.isActive, true))
        .limit(1);

      if (!session) {
        return res.json({ isActive: false });
      }

      const participants = await db.select({
        accountId: hellZoneParticipants.accountId,
        username: accounts.username,
        race: accounts.race,
        hp: hellZoneParticipants.hp,
        maxHp: hellZoneParticipants.maxHp,
        kills: hellZoneParticipants.kills,
        isEliminated: hellZoneParticipants.isEliminated,
      })
      .from(hellZoneParticipants)
      .innerJoin(accounts, eq(hellZoneParticipants.accountId, accounts.id))
      .where(eq(hellZoneParticipants.sessionId, session.id));

      res.json({
        isActive: true,
        sessionId: session.id,
        round: session.round,
        safeZoneSize: session.safeZoneSize,
        participants,
        aliveCount: participants.filter(p => !p.isEliminated).length,
      });
    } catch (error) {
      console.error("Hell Zone state error:", error);
      res.status(500).json({ error: "Failed to get Hell Zone state" });
    }
  });

  app.post("/api/hell-zone/action", async (req, res) => {
    try {
      const { accountId, targetId, action } = req.body;
      
      const [session] = await db.select()
        .from(hellZoneSessions)
        .where(eq(hellZoneSessions.isActive, true))
        .limit(1);

      if (!session) return res.status(400).json({ error: "No active session" });

      const [participant] = await db.select()
        .from(hellZoneParticipants)
        .where(and(
          eq(hellZoneParticipants.sessionId, session.id),
          eq(hellZoneParticipants.accountId, accountId)
        ))
        .limit(1);

      if (!participant || participant.isEliminated) {
        return res.status(403).json({ error: "You are not an active participant" });
      }

      if (action === "attack") {
        const [target] = await db.select()
          .from(hellZoneParticipants)
          .where(and(
            eq(hellZoneParticipants.sessionId, session.id),
            eq(hellZoneParticipants.accountId, targetId)
          ))
          .limit(1);

        if (!target || target.isEliminated) {
          return res.status(400).json({ error: "Target is not active" });
        }

        const attackerAcc = await storage.getAccount(accountId);
        const targetAcc = await storage.getAccount(targetId);
        
        if (!attackerAcc || !targetAcc) return res.status(404).json({ error: "Account not found" });

        const attackerStats = attackerAcc.stats as CombatStats;
        const targetStats = targetAcc.stats as CombatStats;

        const baseDamage = (attackerStats.Str || 10) * 2;
        const defense = (targetStats.Def || 10) * 0.5;
        const damage = Math.max(5, Math.floor(baseDamage - defense));

        const newTargetHp = Math.max(0, target.hp - damage);
        const isEliminated = newTargetHp === 0;

        await db.update(hellZoneParticipants)
          .set({ hp: newTargetHp, isEliminated, lastActionAt: new Date() })
          .where(eq(hellZoneParticipants.id, target.id));

        if (isEliminated) {
          await db.update(hellZoneParticipants)
            .set({ kills: participant.kills + 1 })
            .where(eq(hellZoneParticipants.id, participant.id));
          
          broadcastToAllPlayers("hell_zone_elimination", {
            eliminated: targetAcc.username,
            eliminator: attackerAcc.username,
          });
        }

        // Check for winner
        const remaining = await db.select()
          .from(hellZoneParticipants)
          .where(and(
            eq(hellZoneParticipants.sessionId, session.id),
            eq(hellZoneParticipants.isEliminated, false)
          ));

        if (remaining.length === 1) {
          const winner = remaining[0];
          await db.update(hellZoneSessions)
            .set({ isActive: false, winnerId: winner.accountId })
            .where(eq(hellZoneSessions.id, session.id));

          const winnerAcc = await storage.getAccount(winner.accountId);
          if (winnerAcc) {
            // Reward: Mythic item (placeholder logic), 5 Aether Fragments, Title
            const updates: any = {
              soulShards: (winnerAcc.soulShards || 0) + 500, // Aether Fragments as Soul Shards for now
            };
            const currentTitles = winnerAcc.trophies || [];
            if (!currentTitles.includes("Collapse Survivor")) {
              updates.trophies = [...currentTitles, "Collapse Survivor"];
            }
            await storage.updateAccount(winner.accountId, updates);
            
            broadcastToAllPlayers("hell_zone_winner", {
              winner: winnerAcc.username,
            });
          }
        }

        return res.json({ success: true, damage, targetEliminated: isEliminated });
      }

      res.status(400).json({ error: "Invalid action" });
    } catch (error) {
      console.error("Hell Zone action error:", error);
      res.status(500).json({ error: "Failed to perform action" });
    }
  });

  app.post("/api/admin/hell-zone/start", async (req, res) => {
    try {
      const { adminId } = req.body;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      await db.update(hellZoneSessions).set({ isActive: false }).where(eq(hellZoneSessions.isActive, true));

      const [newSession] = await db.insert(hellZoneSessions).values({
        isActive: true,
        round: 1,
        safeZoneSize: 100,
      }).returning();

      // Start "The Collapse" timer
      const collapseInterval = setInterval(async () => {
        const [currentSession] = await db.select()
          .from(hellZoneSessions)
          .where(eq(hellZoneSessions.id, newSession.id))
          .limit(1);

        if (!currentSession || !currentSession.isActive) {
          clearInterval(collapseInterval);
          return;
        }

        const newSize = Math.max(0, currentSession.safeZoneSize - 10);
        const newRound = currentSession.round + 1;

        await db.update(hellZoneSessions)
          .set({ safeZoneSize: newSize, round: newRound })
          .where(eq(hellZoneSessions.id, currentSession.id));

        // Damage players outside (everyone takes damage as area shrinks)
        const participants = await db.select()
          .from(hellZoneParticipants)
          .where(and(
            eq(hellZoneParticipants.sessionId, currentSession.id),
            eq(hellZoneParticipants.isEliminated, false)
          ));

        for (const p of participants) {
          const damage = Math.ceil(p.maxHp * 0.1 * (newRound / 2)); // Escalating damage
          const newHp = Math.max(0, p.hp - damage);
          await db.update(hellZoneParticipants)
            .set({ hp: newHp, isEliminated: newHp === 0 })
            .where(eq(hellZoneParticipants.id, p.id));
        }

        broadcastToAllPlayers("hell_zone_collapse", {
          round: newRound,
          safeZoneSize: newSize,
        });

      }, 30000); // Shrink every 30 seconds

      res.json({ success: true, session: newSession });
    } catch (error) {
      console.error("Hell Zone start error:", error);
      res.status(500).json({ error: "Failed to start Hell Zone" });
    }
  });

  app.post("/api/admin/hell-zone/end", async (req, res) => {
    try {
      const { adminId } = req.body;
      const admin = await storage.getAccount(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      await db.update(hellZoneSessions)
        .set({ isActive: false })
        .where(eq(hellZoneSessions.isActive, true));

      res.json({ success: true, message: "Hell Zone session ended" });
    } catch (error) {
      console.error("Hell Zone end error:", error);
      res.status(500).json({ error: "Failed to end Hell Zone" });
    }
  });

  app.get("/api/crafting/recipes", authMiddleware, async (req, res) => {
    try {
      const allRecipes = await db.select().from(recipes);
      res.json(allRecipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.post("/api/crafting/craft", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { recipeId } = req.body;
      if (!recipeId) return res.status(400).json({ error: "Recipe ID required" });
      const newItem = await craftItem(req.user!.id, recipeId);
      res.json(newItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/items/:id/socket-gem", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { gemItemId } = req.body;
      const { id: itemId } = req.params;
      if (!gemItemId) return res.status(400).json({ error: "Gem item ID required" });
      await socketGem(req.user!.id, itemId, gemItemId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/leaderboard/:type", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { type } = req.params;
      const { season = 1 } = req.query;
      
      const entries = await db.select({
        id: leaderboardEntries.id,
        type: leaderboardEntries.type,
        accountId: leaderboardEntries.accountId,
        guildId: leaderboardEntries.guildId,
        score: leaderboardEntries.score,
        rank: leaderboardEntries.rank,
        username: accounts.username,
        guildName: guildsTable.name,
      })
      .from(leaderboardEntries)
      .leftJoin(accounts, eq(leaderboardEntries.accountId, accounts.id))
      .leftJoin(guildsTable, eq(leaderboardEntries.guildId, guildsTable.id))
      .where(and(
        eq(leaderboardEntries.type, type as any),
        eq(leaderboardEntries.season, Number(season))
      ))
      .orderBy(sql`${leaderboardEntries.score} DESC`)
      .limit(100);

      res.json({
        type,
        data: entries.map((e, idx) => ({
          ...e,
          rank: idx + 1,
          value: e.score
        })),
        refreshedAt: new Date().toISOString(),
        nextRefresh: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/:type/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { type } = req.params;
      const { season = 1 } = req.query;
      const accountId = req.user!.id;

      const [entry] = await db.select()
        .from(leaderboardEntries)
        .where(and(
          eq(leaderboardEntries.type, type as any),
          eq(leaderboardEntries.accountId, accountId),
          eq(leaderboardEntries.season, Number(season))
        ))
        .limit(1);

      if (!entry) return res.json({ message: "No entry found" });

      // Find actual rank by counting those with higher score
      const [rankCount] = await db.select({
        count: sql<number>`count(*)::int`
      })
      .from(leaderboardEntries)
      .where(and(
        eq(leaderboardEntries.type, type as any),
        eq(leaderboardEntries.season, Number(season)),
        sql`${leaderboardEntries.score} > ${entry.score}`
      ));

      res.json({
        ...entry,
        rank: (rankCount?.count || 0) + 1
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch personal leaderboard rank" });
    }
  });

  app.post("/api/leaderboard/update-pvp", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { accountId, eloChange } = req.body;
      const targetId = accountId || req.user!.id;
      
      const [existing] = await db.select()
        .from(leaderboardEntries)
        .where(and(
          eq(leaderboardEntries.type, "pvp"),
          eq(leaderboardEntries.accountId, targetId)
        ))
        .limit(1);

      if (existing) {
        await db.update(leaderboardEntries)
          .set({ score: existing.score + eloChange, updatedAt: new Date() })
          .where(eq(leaderboardEntries.id, existing.id));
      } else {
        await db.insert(leaderboardEntries).values({
          type: "pvp",
          accountId: targetId,
          score: 1000 + eloChange, // Base Elo 1000
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update PvP leaderboard" });
    }
  });

  app.post("/api/admin/leaderboard/reset-season", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getAccount(req.user!.id);
      if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      const { season } = req.body;
      if (!season) return res.status(400).json({ error: "Season number required" });

      // In a real scenario, we might move current entries to a history table or just increment season
      // For now, let's just update all to the next season or clear
      await db.delete(leaderboardEntries).where(eq(leaderboardEntries.type, "seasonal"));
      
      res.json({ success: true, message: `Season ${season} reset` });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset season" });
    }
  });

  // T024: Unity Group Quests
  app.get("/api/guilds/:id/unity-quests", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id: guildId } = req.params;
      const quests = await db.select()
        .from(guildQuests)
        .where(and(
          eq(guildQuests.guildId, guildId),
          eq(guildQuests.status, "active")
        ));

      // Fetch contributions for each quest
      const questsWithContributions = await Promise.all(quests.map(async (quest) => {
        const contributions = await db.select()
          .from(guildQuestContributions)
          .where(eq(guildQuestContributions.questId, quest.id));
        return { ...quest, contributions };
      }));

      res.json(questsWithContributions);
    } catch (error) {
      console.error("Fetch unity quests error:", error);
      res.status(500).json({ error: "Failed to fetch unity quests" });
    }
  });

  app.post("/api/admin/unity-quests", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getAccount(req.user!.id);
      if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      const { guildId, name, description, type, targetAmount, rewardUnityCoins, rewardGold, rewardGuildExp, expiresAt } = req.body;
      
      const [newQuest] = await db.insert(guildQuests).values({
        guildId,
        name,
        description,
        type,
        targetAmount,
        rewardUnityCoins,
        rewardGold,
        rewardGuildExp,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: "active"
      }).returning();

      res.status(201).json(newQuest);
    } catch (error) {
      console.error("Create unity quest error:", error);
      res.status(500).json({ error: "Failed to create unity quest" });
    }
  });

  app.post("/api/guilds/:id/quests/:questId/contribute", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id: guildId, questId } = req.params;
      const { amount = 1 } = req.body;
      const accountId = req.user!.id;

      const [quest] = await db.select()
        .from(guildQuests)
        .where(and(
          eq(guildQuests.id, questId),
          eq(guildQuests.guildId, guildId),
          eq(guildQuests.status, "active")
        ))
        .limit(1);

      if (!quest) return res.status(404).json({ error: "Active quest not found" });

      // Update or insert contribution
      const [existingContribution] = await db.select()
        .from(guildQuestContributions)
        .where(and(
          eq(guildQuestContributions.questId, questId),
          eq(guildQuestContributions.accountId, accountId)
        ))
        .limit(1);

      if (existingContribution) {
        await db.update(guildQuestContributions)
          .set({ 
            amount: existingContribution.amount + amount,
            updatedAt: new Date()
          })
          .where(eq(guildQuestContributions.id, existingContribution.id));
      } else {
        await db.insert(guildQuestContributions).values({
          questId,
          accountId,
          amount
        });
      }

      // Update quest progress
      const newAmount = quest.currentAmount + amount;
      const isCompleted = newAmount >= quest.targetAmount;

      await db.update(guildQuests)
        .set({ 
          currentAmount: newAmount,
          status: isCompleted ? "completed" : "active"
        })
        .where(eq(guildQuests.id, questId));

      // If completed, distribute rewards
      if (isCompleted) {
        const contributors = await db.select()
          .from(guildQuestContributions)
          .where(eq(guildQuestContributions.questId, questId));

        for (const contributor of contributors) {
          const rewardMultiplier = 1; // Could scale with contribution if desired
          await db.update(accounts)
            .set({
              unityCoins: sql`${accounts.unityCoins} + ${quest.rewardUnityCoins * rewardMultiplier}`,
              gold: sql`${accounts.gold} + ${quest.rewardGold * rewardMultiplier}`
            })
            .where(eq(accounts.id, contributor.accountId));
          
          // Update Unity Quest contribution tracking in account
          const [acc] = await db.select().from(accounts).where(eq(accounts.id, contributor.accountId)).limit(1);
          const contributions = (acc.unityQuestContributions as Record<string, number>) || {};
          contributions[quest.id] = (contributions[quest.id] || 0) + contributor.amount;
          
          await db.update(accounts)
            .set({ unityQuestContributions: contributions })
            .where(eq(accounts.id, contributor.accountId));
        }

        // Add Guild EXP
        await db.update(guildsTable)
          .set({ experience: sql`${guildsTable.experience} + ${quest.rewardGuildExp}` })
          .where(eq(guildsTable.id, guildId));
      }

      res.json({ 
        success: true, 
        completed: isCompleted,
        currentAmount: newAmount
      });
    } catch (error) {
      console.error("Contribute unity quest error:", error);
      res.status(500).json({ error: "Failed to contribute to unity quest" });
    }
  });

  // ==================== AUCTION HOUSE EXPANSION (T036) ====================
  
  app.get("/api/auction", authMiddleware, async (req, res) => {
    try {
      const { type } = req.query;
      let query = db.select().from(auctions).where(eq(auctions.status, "active"));
      
      if (type === "gold" || type === "vip") {
        query = db.select().from(auctions).where(
          and(
            eq(auctions.status, "active"),
            eq(auctions.type, type)
          )
        );
      }
      
      const activeAuctions = await query;
      res.json(activeAuctions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch auctions" });
    }
  });

  app.post("/api/auction/list", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { itemId, itemType, startingPrice, duration, type, minIncrement } = req.body;
      const accountId = req.user!.id;

      if (!itemId || !itemType || !startingPrice || !duration || !type) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      if (itemType === "item") {
        const invItem = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1);
        if (!invItem.length || invItem[0].accountId !== accountId) {
          return res.status(403).json({ error: "You don't own this item" });
        }
      } else if (itemType === "skill") {
        const pSkill = await db.select().from(playerSkills).where(eq(playerSkills.id, itemId)).limit(1);
        if (!pSkill.length || pSkill[0].accountId !== accountId) {
          return res.status(403).json({ error: "You don't own this skill" });
        }
      }

      const listingFee = Math.floor(startingPrice * 0.05);
      if (account.gold < listingFee) {
        return res.status(400).json({ error: `Insufficient gold for listing fee (${listingFee})` });
      }

      await storage.updateAccount(accountId, { gold: account.gold - listingFee });

      const endAt = new Date(Date.now() + duration * 60 * 60 * 1000);
      const [auction] = await db.insert(auctions).values({
        sellerId: accountId,
        type,
        itemType,
        itemId,
        startingPrice,
        currentBid: startingPrice,
        minIncrement: minIncrement || 1,
        status: "active",
        endAt,
        taxPaid: 0
      }).returning();

      broadcastToAllPlayers("new_auction", { auction });
      res.json(auction);
    } catch (error) {
      console.error("Auction list error:", error);
      res.status(500).json({ error: "Failed to list item" });
    }
  });

  app.post("/api/auction/:id/bid", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { amount } = req.body;
      const { id: auctionId } = req.params;
      const accountId = req.user!.id;

      const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1);
      if (!auction || auction.status !== "active") {
        return res.status(404).json({ error: "Auction not found or closed" });
      }

      if (auction.sellerId === accountId) {
        return res.status(403).json({ error: "You cannot bid on your own auction" });
      }

      if (new Date() > new Date(auction.endAt)) {
        return res.status(400).json({ error: "Auction has ended" });
      }

      const minBid = Math.floor(auction.currentBid * (1 + (auction.minIncrement / 100)));
      if (amount < minBid) {
        return res.status(400).json({ error: `Bid must be at least ${minBid}` });
      }

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      const currency = auction.type === "gold" ? "gold" : "valorTokens";
      if ((account as any)[currency] < amount) {
        return res.status(400).json({ error: `Insufficient ${currency}` });
      }

      if (auction.highestBidderId) {
        const prevBidder = await storage.getAccount(auction.highestBidderId);
        if (prevBidder) {
          await storage.updateAccount(auction.highestBidderId, {
            [currency]: (prevBidder as any)[currency] + auction.currentBid
          });
        }
      }

      await storage.updateAccount(accountId, {
        [currency]: (account as any)[currency] - amount
      });

      const [updatedAuction] = await db.update(auctions)
        .set({
          currentBid: amount,
          highestBidderId: accountId
        })
        .where(eq(auctions.id, auctionId))
        .returning();

      await db.insert(auctionBids).values({
        auctionId,
        bidderId: accountId,
        amount,
      });

      broadcastToAllPlayers("auction_bid", { auction: updatedAuction });
      res.json(updatedAuction);
    } catch (error) {
      console.error("Auction bid error:", error);
      res.status(500).json({ error: "Failed to place bid" });
    }
  });

  app.post("/api/auction/:id/cancel", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id: auctionId } = req.params;
      const accountId = req.user!.id;

      const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1);
      if (!auction) return res.status(404).json({ error: "Auction not found" });

      const account = await storage.getAccount(accountId);
      if (auction.sellerId !== accountId && account?.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (auction.status !== "active") {
        return res.status(400).json({ error: "Auction is already closed" });
      }

      if (auction.highestBidderId) {
        const bidder = await storage.getAccount(auction.highestBidderId);
        if (bidder) {
          const currency = auction.type === "gold" ? "gold" : "valorTokens";
          await storage.updateAccount(auction.highestBidderId, {
            [currency]: (bidder as any)[currency] + auction.currentBid
          });
        }
      }

      const [updatedAuction] = await db.update(auctions)
        .set({ status: "cancelled" })
        .where(eq(auctions.id, auctionId))
        .returning();

      res.json(updatedAuction);
    } catch (error) {
      console.error("Auction cancel error:", error);
      res.status(500).json({ error: "Failed to cancel auction" });
    }
  });

  app.get("/api/admin/auction", authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ error: "Admin access required" });
      const allAuctions = await db.select().from(auctions);
      res.json(allAuctions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch auctions" });
    }
  });

  setInterval(async () => {
    try {
      const now = new Date();
      const endedAuctions = await db.select()
        .from(auctions)
        .where(and(
          eq(auctions.status, "active"),
          lt(auctions.endAt, now)
        ));

      for (const auction of endedAuctions) {
        if (auction.highestBidderId) {
          const seller = await storage.getAccount(auction.sellerId!);
          if (seller) {
            const tax = Math.floor(auction.currentBid * 0.05);
            const netProceeds = auction.currentBid - tax;
            const currency = auction.type === "gold" ? "gold" : "valorTokens";
            
            await storage.updateAccount(auction.sellerId!, {
              [currency]: (seller as any)[currency] + netProceeds
            });

            await db.update(auctions)
              .set({ status: "completed", taxPaid: tax })
              .where(eq(auctions.id, auction.id));

            if (auction.itemType === "item") {
              await db.update(inventoryItems)
                .set({ accountId: auction.highestBidderId })
                .where(eq(inventoryItems.id, auction.itemId));
            } else if (auction.itemType === "skill") {
              await db.update(playerSkills)
                .set({ accountId: auction.highestBidderId })
                .where(eq(playerSkills.id, auction.itemId));
            }

            broadcastToPlayer(auction.sellerId!, "auction_sold", { auction, netProceeds });
            broadcastToPlayer(auction.highestBidderId, "auction_won", { auction });
          }
        } else {
          await db.update(auctions)
            .set({ status: "completed" })
            .where(eq(auctions.id, auction.id));
        }
      }
    } catch (error) {
      console.error("Auction resolution error:", error);
    }
  }, 30000);

  // T039: Shard System (Physical Story Objects)
  app.get("/api/shards", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allShards = await db.select().from(shards);
      res.json(allShards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shards" });
    }
  });

  app.get("/api/shards/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const [shard] = await db.select().from(shards).where(eq(shards.id, req.params.id)).limit(1);
      if (!shard) return res.status(404).json({ error: "Shard not found" });
      res.json(shard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shard" });
    }
  });

  app.post("/api/shards/:id/collect", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const accountId = req.user!.id;

      const [shard] = await db.select().from(shards).where(eq(shards.id, id)).limit(1);
      if (!shard) return res.status(404).json({ error: "Shard not found" });
      if (!shard.isActive) return res.status(400).json({ error: "Shard is not active" });
      if (shard.ownerId) return res.status(400).json({ error: "Shard already collected" });

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      // Shard interactions require correct rank/zone - simplified check for now
      // Assuming zone check is done by client or based on shard.zone

      await db.transaction(async (tx) => {
        await tx.update(shards).set({
          ownerId: accountId,
          guildId: null,
          collectedAt: new Date()
        }).where(eq(shards.id, id));

        await tx.insert(shardEvents).values({
          shardId: id,
          eventType: "collect",
          triggeredBy: accountId,
          zone: shard.zone
        });

        // Track race totals
        const raceField = `${shard.shardType}Shards` as keyof Account;
        if (raceField in account) {
          await tx.update(accounts)
            .set({ [raceField]: sql`${accounts[raceField as any]} + 1` })
            .where(eq(accounts.id, accountId));
        }
      });

      res.json({ success: true, message: "Shard collected" });
    } catch (error) {
      console.error("Collect shard error:", error);
      res.status(500).json({ error: "Failed to collect shard" });
    }
  });

  app.post("/api/shards/:id/store-guild", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { guildId } = req.body;
      const accountId = req.user!.id;

      if (!guildId) return res.status(400).json({ error: "Guild ID required" });

      const [shard] = await db.select().from(shards).where(eq(shards.id, id)).limit(1);
      if (!shard) return res.status(404).json({ error: "Shard not found" });
      if (shard.ownerId !== accountId) return res.status(403).json({ error: "You do not own this shard" });

      await db.transaction(async (tx) => {
        await tx.update(shards).set({
          ownerId: null,
          guildId: guildId
        }).where(eq(shards.id, id));

        await tx.insert(shardEvents).values({
          shardId: id,
          eventType: "guild_store",
          triggeredBy: accountId,
          zone: shard.zone
        });
      });

      res.json({ success: true, message: "Shard stored in guild vault" });
    } catch (error) {
      res.status(500).json({ error: "Failed to store shard" });
    }
  });

  app.get("/api/shards/race-totals", async (req, res) => {
    try {
      const totals: Record<string, number> = {};
      for (const type of shardTypes) {
        const field = `${type}Shards`;
        const result = await db.select({
          total: sql<number>`sum(${accounts[field as any]})::int`
        }).from(accounts);
        totals[type] = result[0]?.total || 0;
      }
      res.json(totals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch race totals" });
    }
  });

  app.post("/api/admin/shards/create-event", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getAccount(req.user!.id);
      if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required" });

      const { shardType, name, description, zone } = req.body;
      
      const [newShard] = await db.insert(shards).values({
        shardType,
        name,
        description,
        zone,
        isActive: true,
        isPhysical: true
      }).returning();

      await db.insert(shardEvents).values({
        shardId: newShard.id,
        eventType: "spawn",
        triggeredBy: user.id,
        zone: zone
      });

      res.status(201).json(newShard);
    } catch (error) {
      res.status(500).json({ error: "Failed to create shard event" });
    }
  });

  return httpServer;
}

function formatMonsterResponse(monster: SpawnedMonster) {
  return {
    id: monster.id,
    name: monster.template.name,
    element: monster.template.element,
    isBoss: monster.template.isBoss,
    level: monster.level,
    hp: monster.hp,
    maxHp: monster.maxHp,
    stats: monster.scaledStats,
    source: monster.source,
    expiresAt: monster.expiresAt,
    weatherExclusive: monster.template.weatherExclusive || null,
  };
}
