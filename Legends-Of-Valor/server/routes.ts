import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertAccountSchema, insertInventoryItemSchema, playerRanks, playerStatsSchema, equippedSchema, insertEventSchema, insertChallengeSchema, petElements, type GuildBank, playerRaces, playerGenders, raceModifiers, accounts } from "@shared/schema";
import { z } from "zod";
import type { Account, Event, Challenge, PlayerRace, PlayerGender } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { 
  runAutoCombat, 
  calculateCombatRewards, 
  applyRaceModifiers, 
  calculateMaxHP,
  type Combatant, 
  type CombatStats,
  type ElementalAffinity
} from "./combat-engine";

// V2: Max 28 players per server (2 per race x 14 races)
const MAX_PLAYERS = 28;
// V2: Max 2 players per race
const MAX_PLAYERS_PER_RACE = 2;
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
const SLEEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes of inactivity to sleep the app

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

function broadcastToAdmins(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(adminSSEConnections.entries()).forEach(([adminId, res]) => {
    try {
      res.write(message);
    } catch (error) {
      adminSSEConnections.delete(adminId);
    }
  });
}

function broadcastToPlayer(playerId: string, event: string, data: any) {
  const res = playerSSEConnections.get(playerId);
  if (res) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      playerSSEConnections.delete(playerId);
    }
  }
}

function broadcastToGuild(guildId: string, event: string, data: any) {
  const connections = guildSSEConnections.get(guildId);
  if (connections) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    connections.forEach(res => {
      try {
        res.write(message);
      } catch (error) {
        connections.delete(res);
      }
    });
  }
}

function broadcastToAllPlayers(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  Array.from(playerSSEConnections.entries()).forEach(([playerId, res]) => {
    try {
      res.write(message);
    } catch (error) {
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
        
        activeSessions.set(existing.id, {
          accountId: existing.id,
          username: existing.username,
          lastActivity: Date.now(),
        });
        
        return res.json(existing);
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
      const account = await storage.createAccount({
        username,
        password: hashedPassword,
        role,
        gold: role === "player" ? 10000 : 0,
        race: role === "player" ? race : undefined,
        gender: role === "player" ? gender : undefined,
        portrait: role === "player" ? `${race}_${gender}` : undefined,
        stats: startingStats,
      });
      
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
      const session = activeSessions.get(req.params.id);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (!account.isDead) {
        return res.status(400).json({ error: "You are not dead" });
      }
      
      // Respawn at base with full HP recovery
      await db.update(accounts).set({
        isDead: false,
        respawnLocation: "base",
      }).where(eq(accounts.id, req.params.id));
      
      res.json({ 
        success: true, 
        message: "You have respawned at your Base. Your wounds have healed.",
        location: "base"
      });
    } catch (error) {
      console.error("Respawn error:", error);
      res.status(500).json({ error: "Failed to respawn" });
    }
  });
  
  // Revive using revive token (instant revive at current location)
  app.post("/api/accounts/:id/revive", async (req, res) => {
    try {
      const session = activeSessions.get(req.params.id);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
      
      // Use revive token to revive at current location
      await db.update(accounts).set({
        isDead: false,
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
      const session = activeSessions.get(req.params.id);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
      
      // Revive player and unequip pet
      await db.update(accounts).set({
        isDead: false,
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
  
  // Check death status - requires active session
  app.get("/api/accounts/:id/death-status", async (req, res) => {
    try {
      const session = activeSessions.get(req.params.id);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json({
        isDead: account.isDead,
        deathCount: account.deathCount,
        reviveTokens: account.reviveTokens,
        lastDeathTime: account.lastDeathTime,
        hasEquippedPet: !!account.equippedPetId,
      });
    } catch (error) {
      console.error("Death status error:", error);
      res.status(500).json({ error: "Failed to get death status" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const currentTier = account.baseTier || 1;
      if (currentTier >= 5) {
        return res.status(400).json({ error: "Base already at maximum tier" });
      }

      // Tier upgrade costs
      const tierCosts = [0, 50000, 200000, 1000000, 10000000]; // Cost to upgrade TO each tier
      const upgradeCost = tierCosts[currentTier]; // Cost to go to next tier

      if (account.gold < upgradeCost) {
        return res.status(400).json({ error: `Need ${upgradeCost.toLocaleString()} gold to upgrade` });
      }

      const newTier = currentTier + 1;
      await storage.updateAccount(accountId, { 
        gold: account.gold - upgradeCost,
        baseTier: newTier 
      });

      // Grant trophy for reaching tier 5
      if (newTier === 5 && !account.trophies?.includes("base_fortress")) {
        const updatedTrophies = [...(account.trophies || []), "base_fortress"];
        await storage.updateAccount(accountId, { trophies: updatedTrophies });
      }
      
      const updatedAccount = await storage.getAccount(accountId);
      const tierNames = ["", "Humble Camp", "Wooden Lodge", "Stone Keep", "Grand Manor", "Fortress Castle"];
      res.json({ 
        account: updatedAccount, 
        message: `Base upgraded to ${tierNames[newTier]}!` 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to upgrade base" });
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
      const sellPrice = Math.floor(originalPrice * SELL_PRICE_MULTIPLIER);

      // Remove item and give gold
      await storage.removeFromInventory(inventoryItem.id);
      await storage.updateAccount(account.id, { gold: account.gold + sellPrice });

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
      const { isNPCAccount, autoAcceptNPCChallenge } = await import("./npc-accounts");
      if (isNPCAccount(challenged.username)) {
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
          
          // V2: Death & Revival - Apply PvP drops and death state
          let goldDropped = 0;
          let deathMessage = "";
          if (loser && !isNPCAccount(loser.username)) {
            // Loser drops 10% of their gold (min 100, max 10000)
            goldDropped = Math.min(10000, Math.max(100, Math.floor(loser.gold * 0.1)));
            
            // Update loser: mark as dead, lose gold, increment death count
            await db.update(accounts).set({
              gold: loser.gold - goldDropped,
              isDead: true,
              lastDeathTime: new Date(),
              deathCount: loser.deathCount + 1,
            }).where(eq(accounts.id, loserId));
            
            // Update winner: gain gold
            if (winner) {
              await db.update(accounts).set({
                gold: winner.gold + goldDropped,
              }).where(eq(accounts.id, winnerId));
            }
            
            deathMessage = ` You dropped ${goldDropped} gold. Return to your Base to respawn.`;
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      // Rebirth bonuses: Each rebirth adds +10% to base stats
      const rebirthCount = (pet.rebirthCount || 0) + 1;
      const rebirthMultiplier = 1 + (rebirthCount * 0.1); // 1.1, 1.2, 1.3, etc.
      
      // Keep elements from mythic stage
      const elements = pet.elements || [pet.element];
      const primaryElement = pet.element;
      
      // New egg stats are boosted based on rebirth count
      const newStats = {
        Str: Math.floor(5 * rebirthMultiplier),
        Spd: Math.floor(5 * rebirthMultiplier),
        Luck: Math.floor(5 * rebirthMultiplier),
        ElementalPower: Math.floor(10 * rebirthMultiplier),
      };
      
      // Update pet to egg tier with boosted stats, preserving elements and personality
      await storage.updatePet(pet.id, {
        tier: "egg",
        exp: 0,
        stats: newStats,
        rebirthCount,
        bondLevel: (pet.bondLevel || 0) + 5, // Rebirth increases bond
        elements: elements, // Preserve all elements
        element: primaryElement, // Preserve primary element
      });
      
      await storage.updateAccount(accountId, { gold: account.gold - REBIRTH_COST });
      
      const updatedPet = await storage.getPet(pet.id);
      
      res.json({ 
        pet: updatedPet, 
        message: `${pet.name} has been reborn! Rebirth count: ${rebirthCount}`,
        rebirthBonus: `${(rebirthMultiplier * 100 - 100).toFixed(0)}% stat bonus`
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
    if (globalLevel <= 100) return null; // Anyone can fight levels 1-100
    if (globalLevel <= 200) return "Apprentice";
    if (globalLevel <= 500) return "Journeyman";
    if (globalLevel <= 1000) return "Expert";
    if (globalLevel <= 2000) return "Master";
    if (globalLevel <= 3000) return "Grandmaster";
    if (globalLevel <= 4000) return "Legend";
    return "Elite"; // 4001+
  };
  
  // Challenge NPC
  app.post("/api/accounts/:accountId/npc-battle", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      
      if (!account || account.role !== "player") {
        return res.status(404).json({ error: "Player not found" });
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
      const basePlayerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      const playerCombatStats: CombatStats = applyRaceModifiers(
        { ...basePlayerStats, Def: basePlayerStats.Def || 10 } as CombatStats,
        account.race || null
      );
      
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
      
      // Build player combatant
      const playerCombatant: Combatant = {
        id: account.id,
        name: account.username,
        stats: playerCombatStats,
        race: account.race,
        elements: petElements.length > 0 ? { elements: petElements, elementalPower: petElementalPower } : undefined,
        immunities: [],
        level: globalLevel,
        isPlayer: true,
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
            const aGlobal = ((a.dungeonFloor || 1) - 1) * 100 + (a.dungeonLevel || 1);
            const bGlobal = ((b.dungeonFloor || 1) - 1) * 100 + (b.dungeonLevel || 1);
            return bGlobal - aGlobal;
          })
          .slice(0, 50);
        
        const guildEntries = await Promise.all(sortedGuilds.map(async (guild, idx) => {
          const master = await storage.getAccount(guild.masterId);
          return {
            guildId: guild.id,
            guildName: guild.name,
            masterName: master?.username || "Unknown",
            value: `Floor ${guild.dungeonFloor || 1} - Level ${guild.dungeonLevel || 1}`,
            dungeonFloor: guild.dungeonFloor || 1,
            dungeonLevel: guild.dungeonLevel || 1,
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
      default:
        return [];
    }
  };

  app.get("/api/leaderboards/:type", async (req, res) => {
    try {
      const type = req.params.type;
      if (!["wins", "losses", "npc_progress", "rank", "guild_dungeon", "guild_wins"].includes(type)) {
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
      if (!["wins", "losses", "npc_progress", "rank", "guild_dungeon", "guild_wins"].includes(type)) {
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
      // Verify admin has an active session
      if (!activeSessions.has(adminId)) {
        return res.status(401).json({ error: "No active session" });
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
      
      // Add master as first member
      await storage.addGuildMember({ guildId: guild.id, accountId: masterId });

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
        };
      });

      res.json({ ...guild, members: membersWithInfo });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch guild" });
    }
  });

  // Invite player to guild (master only)
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

      if (guild.masterId !== invitedBy) {
        return res.status(403).json({ error: "Only guild master can invite players" });
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

  // Kick member from guild (master only)
  app.post("/api/guilds/:guildId/kick", async (req, res) => {
    try {
      const kickSchema = z.object({
        accountId: z.string(),
        masterId: z.string(),
      });
      const { accountId, masterId } = kickSchema.parse(req.body);

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      if (guild.masterId !== masterId) {
        return res.status(403).json({ error: "Only guild master can kick members" });
      }

      if (accountId === masterId) {
        return res.status(400).json({ error: "Cannot kick yourself" });
      }

      await storage.removeGuildMember(accountId);
      broadcastToPlayer(accountId, "guildKicked", { guildName: guild.name });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to kick member" });
    }
  });

  // Distribute guild bank rewards (master only)
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
        return res.status(403).json({ error: "Only guild master can distribute rewards" });
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
          
          // Notify player
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

      // Get online guild members with their pets
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

      const floor = guild.dungeonFloor;
      const level = guild.dungeonLevel;
      const globalLevel = (floor - 1) * 100 + level;
      
      // Determine dungeon type
      const isDemonLordDungeon = floor > 50;
      const dungeonName = isDemonLordDungeon ? "The Demon Lord's Dungeon" : "The Great Dungeon";
      const displayFloor = isDemonLordDungeon ? floor - 50 : floor;
      
      // Demon Lord's Dungeon is stronger than NPC tower (15x vs 10x for regular)
      // and allows pets, with 3x rewards compared to Great Dungeon
      const strengthMultiplier = isDemonLordDungeon ? 15 : 10;
      const rewardMultiplier = isDemonLordDungeon ? 3 : 1; // 3x rewards for Demon Lord's Dungeon
      
      const baseStats = {
        Str: Math.floor((10 + globalLevel * 5) * strengthMultiplier),
        Spd: Math.floor((10 + globalLevel * 4) * strengthMultiplier),
        Int: Math.floor((10 + globalLevel * 3) * strengthMultiplier),
        Luck: Math.floor((5 + globalLevel * 2) * strengthMultiplier),
      };

      const isBoss = level % 10 === 0;
      const floorMultiplier = 1 + (floor - 1) * 0.5;
      
      if (isBoss) {
        baseStats.Str = Math.floor(baseStats.Str * 2 * floorMultiplier);
        baseStats.Spd = Math.floor(baseStats.Spd * 1.5 * floorMultiplier);
        baseStats.Int = Math.floor(baseStats.Int * 1.5 * floorMultiplier);
      }

      // Determine immunities
      const immunities: string[] = [];
      if (floor >= 5) {
        const numImmunities = Math.min(Math.floor((floor - 4) / 3) + 1, 6);
        const seed = floor * 100 + level;
        const shuffledElements = [...petElements].sort((a, b) => {
          const hashA = (seed * a.charCodeAt(0)) % 1000;
          const hashB = (seed * b.charCodeAt(0)) % 1000;
          return hashA - hashB;
        });
        for (let i = 0; i < numImmunities; i++) {
          immunities.push(shuffledElements[i]);
        }
      }

      // Calculate rewards (3x for Demon Lord's Dungeon)
      // Note: We need the accountId here, which should be passed in or available from context
      // For this GET route, we'll assume the caller wants to see rewards based on the guild's state
      // or we use a query param if specific player context is needed.
      // Since it's /api/guilds/:guildId/dungeon, let's use the guild master as fallback if no accountId provided
      const dungeonGuild = await storage.getGuild(req.params.guildId);
      const guildMultiplier = dungeonGuild ? 1 + (dungeonGuild.level * 0.1) : 1; // 10% bonus per level
      
      const baseGold = Math.floor((100 + globalLevel * 50) * 10 * rewardMultiplier * guildMultiplier);
      const rewards = {
        gold: isBoss ? baseGold * 5 : baseGold,
        rubies: isBoss ? Math.floor(level / 2) * 10 * rewardMultiplier * guildMultiplier : 0,
        soulShards: floor >= 10 ? Math.floor(floor / 5) * 10 * rewardMultiplier * guildMultiplier : 0,
        focusedShards: floor >= 25 ? Math.floor((floor - 20) / 5) * 10 * rewardMultiplier * guildMultiplier : 0,
        runes: floor >= 15 ? Math.floor(floor / 10) * 10 * rewardMultiplier * guildMultiplier : 0,
      };

      res.json({
        floor,
        level,
        displayFloor,
        globalLevel,
        dungeonName,
        isDemonLordDungeon,
        petsAllowed: isDemonLordDungeon, // Pets only allowed in Demon Lord's Dungeon
        isBoss,
        npcStats: baseStats,
        immunities,
        rewards,
        onlineMembers,
        memberCount: members.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dungeon info" });
    }
  });

  // Fight in Great Dungeon / Demon Lord's Dungeon (multiplayer - combines online members' stats)
  app.post("/api/guilds/:guildId/dungeon/fight", async (req, res) => {
    try {
      const fightSchema = z.object({ accountId: z.string() });
      const { accountId } = fightSchema.parse(req.body);

      const membership = await storage.getGuildMember(accountId);
      if (!membership || membership.guildId !== req.params.guildId) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      const guild = await storage.getGuild(req.params.guildId);
      if (!guild) {
        return res.status(404).json({ error: "Guild not found" });
      }

      const members = await storage.getGuildMembers(guild.id);
      const allAccounts = await storage.getAllAccounts();
      const allPets = await storage.getAllPets();

      const floor = guild.dungeonFloor;
      const level = guild.dungeonLevel;
      const isDemonLordDungeon = floor > 50;
      
      // Get online members and combine their stats
      const onlineMembers = members.filter(m => activeSessions.has(m.accountId));
      
      let combinedStats = { Str: 0, Spd: 0, Int: 0, Luck: 0 };
      let combinedElementsRaw: string[] = [];
      let combinedPetPower = 0;
      
      for (const member of onlineMembers) {
        const account = allAccounts.find(a => a.id === member.accountId);
        if (account) {
          combinedStats.Str += account.stats.Str;
          combinedStats.Spd += account.stats.Spd;
          combinedStats.Int += account.stats.Int;
          combinedStats.Luck += account.stats.Luck;
          
          // Add equipped pet stats - only in Demon Lord's Dungeon
          if (isDemonLordDungeon && account.equippedPetId) {
            const pet = allPets.find(p => p.id === account.equippedPetId);
            if (pet) {
              const petStats = pet.stats as any;
              combinedPetPower += petStats.Str + petStats.Spd + petStats.Luck + (petStats.ElementalPower || 0);
              if (pet.elements) {
                combinedElementsRaw.push(...pet.elements);
              }
            }
          }
        }
      }
      
      // Combined elements (unique set)
      const combinedElements = Array.from(new Set(combinedElementsRaw));

      // Calculate dungeon NPC stats - 15x for Demon Lord's, 10x for Great Dungeon
      const globalLevel = (floor - 1) * 100 + level;
      const strengthMultiplier = isDemonLordDungeon ? 15 : 10;
      
      const npcStats = {
        Str: Math.floor((10 + globalLevel * 5) * strengthMultiplier),
        Spd: Math.floor((10 + globalLevel * 4) * strengthMultiplier),
        Int: Math.floor((10 + globalLevel * 3) * strengthMultiplier),
        Luck: Math.floor((5 + globalLevel * 2) * strengthMultiplier),
      };

      const isBoss = level % 10 === 0;
      const floorMultiplier = 1 + (floor - 1) * 0.5;
      
      if (isBoss) {
        npcStats.Str = Math.floor(npcStats.Str * 2 * floorMultiplier);
        npcStats.Spd = Math.floor(npcStats.Spd * 1.5 * floorMultiplier);
        npcStats.Int = Math.floor(npcStats.Int * 1.5 * floorMultiplier);
      }

      // Calculate immunities
      const immunities: string[] = [];
      if (floor >= 5) {
        const numImmunities = Math.min(Math.floor((floor - 4) / 3) + 1, 6);
        const seed = floor * 100 + level;
        const shuffledElements = [...petElements].sort((a, b) => {
          const hashA = (seed * a.charCodeAt(0)) % 1000;
          const hashB = (seed * b.charCodeAt(0)) % 1000;
          return hashA - hashB;
        });
        for (let i = 0; i < numImmunities; i++) {
          immunities.push(shuffledElements[i]);
        }
      }

      // Check if any combined elements bypass immunities
      const effectiveElements = combinedElements.filter(e => !immunities.includes(e));
      const elementBonus = effectiveElements.length > 0 ? 1.25 : 1;

      // Battle calculation - include pet power in Demon Lord's Dungeon
      const basePower = combinedStats.Str * 2 + combinedStats.Spd + combinedStats.Int;
      const playerPower = (basePower + (isDemonLordDungeon ? combinedPetPower : 0)) * elementBonus;
      const npcPower = npcStats.Str * 2 + npcStats.Spd + npcStats.Int;
      
      // Minimum power check - must have at least 40% of NPC power to have any chance
      const powerRatio = playerPower / npcPower;
      if (powerRatio < 0.4) {
        return res.json({
          victory: false,
          message: isDemonLordDungeon 
            ? "Your combined power is too weak! Equip pets and get more guild members online."
            : "Your combined power is too weak! You need more guild members online or stronger stats.",
          playerPower: Math.floor(playerPower),
          npcPower: Math.floor(npcPower),
          powerRatio: Math.floor(powerRatio * 100),
          onlineMembers: onlineMembers.length,
          petsUsed: isDemonLordDungeon,
        });
      }
      
      const luckFactor = 1 + (combinedStats.Luck * 0.01);
      const roll = Math.random() * luckFactor;
      
      // Victory chance scales with power ratio - need at least 60% power for decent odds
      const victory = playerPower * roll > npcPower * 0.8;

      if (victory) {
        // Calculate rewards - 3x for Demon Lord's Dungeon
        const rewardMultiplier = isDemonLordDungeon ? 3 : 1;
        const baseGold = Math.floor((100 + globalLevel * 50) * 10 * rewardMultiplier);
        const rewards = {
          gold: isBoss ? baseGold * 5 : baseGold,
          rubies: isBoss ? Math.floor(level / 2) * 10 * rewardMultiplier : 0,
          soulShards: floor >= 10 ? Math.floor(floor / 5) * 10 * rewardMultiplier : 0,
          focusedShards: floor >= 25 ? Math.floor((floor - 20) / 5) * 10 * rewardMultiplier : 0,
          runes: floor >= 15 ? Math.floor(floor / 10) * 10 * rewardMultiplier : 0,
          trainingPoints: floor >= 5 ? Math.floor(floor / 3) * 5 * rewardMultiplier : 0,
        };

        // Add rewards to guild bank
        const newBank: GuildBank = {
          gold: guild.bank.gold + rewards.gold,
          rubies: guild.bank.rubies + rewards.rubies,
          soulShards: guild.bank.soulShards + rewards.soulShards,
          focusedShards: guild.bank.focusedShards + rewards.focusedShards,
          runes: guild.bank.runes + rewards.runes,
          trainingPoints: (guild.bank.trainingPoints || 0) + rewards.trainingPoints,
        };
        await storage.updateGuildBank(guild.id, newBank);

        // Advance dungeon progress - now goes up to 100 (50 Great Dungeon + 50 Demon Lord's Dungeon)
        let newFloor = floor;
        let newLevel = level + 1;
        if (newLevel > 50) { // NPC level max is 50 for dungeon
          newLevel = 1;
          newFloor = Math.min(floor + 1, 100); // Max 100 floors total (50 Great + 50 Demon Lord)
        }
        await storage.updateGuildDungeonProgress(guild.id, newFloor, newLevel);

        // Notify all guild members
        for (const member of members) {
          broadcastToPlayer(member.accountId, "dungeonVictory", {
            rewards,
            newFloor,
            newLevel,
            participants: onlineMembers.length,
          });
        }

        res.json({
          victory: true,
          rewards,
          newFloor,
          newLevel,
          participants: onlineMembers.length,
          combinedStats,
          npcStats,
        });
      } else {
        res.json({
          victory: false,
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
      const session = activeSessions.get(req.params.id);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
      
      const session = activeSessions.get(challengerId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      if (!accountId || !activeSessions.has(accountId as string)) {
        return res.status(401).json({ error: "Active session required" });
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
        // Deduct gold from winner
        const winner = await storage.getAccount(highestBid.bidderId);
        if (winner && winner.gold >= highestBid.amount) {
          await storage.updateAccountGold(winner.id, winner.gold - highestBid.amount);
          
          // Grant skill to winner
          await storage.addPlayerSkill({
            accountId: winner.id,
            skillId: activeAuction.skillId,
            source: "auction",
          });

          // Update auction
          await storage.updateSkillAuction(activeAuction.id, {
            status: "completed",
            winningBidId: highestBid.id,
            winnerId: winner.id,
          });

          // Add to activity feed
          await storage.createActivityFeed({
            type: "bid_won",
            accountId: winner.id,
            accountName: winner.username,
            message: `${winner.username} won the auction for a skill with a bid of ${highestBid.amount.toLocaleString()} gold!`,
            metadata: { skillId: activeAuction.skillId, amount: highestBid.amount },
          });

          // Broadcast to all
          broadcastToAllPlayers("auction_ended", {
            auctionId: activeAuction.id,
            winnerId: winner.id,
            winnerName: winner.username,
            amount: highestBid.amount,
            skillId: activeAuction.skillId,
          });
        }
      } else {
        // No bids, just complete the auction
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
            if (winner && winner.gold >= highestBid.amount) {
              await storage.updateAccountGold(winner.id, winner.gold - highestBid.amount);
              
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
                message: `${winner.username} won the auction for a skill with a bid of ${highestBid.amount.toLocaleString()} gold!`,
                metadata: { skillId: activeAuction.skillId, amount: highestBid.amount },
              });

              broadcastToAllPlayers("auction_ended", {
                auctionId: activeAuction.id,
                winnerId: winner.id,
                winnerName: winner.username,
                amount: highestBid.amount,
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
  
  // Accept trade (both parties must accept)
  app.patch("/api/trades/:tradeId/accept", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.tradeId);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.status !== "pending") {
        return res.status(400).json({ error: "Trade is not pending" });
      }
      
      const isInitiator = accountId === trade.initiatorId;
      const isRecipient = accountId === trade.recipientId;
      
      if (!isInitiator && !isRecipient) {
        return res.status(403).json({ error: "Not a party to this trade" });
      }
      
      const updates: any = {};
      if (isInitiator) updates.initiatorAccepted = true;
      if (isRecipient) updates.recipientAccepted = true;
      
      const updated = await storage.updateTrade(trade.id, updates);
      
      // Check if both accepted
      if ((isInitiator && trade.recipientAccepted) || (isRecipient && trade.initiatorAccepted)) {
        // Execute trade - transfer items
        const items = await storage.getTradeItems(trade.id);
        
        for (const item of items) {
          if (item.type === "item") {
            const inventoryItem = await storage.getInventoryItem(item.refId);
            if (inventoryItem) {
              // Remove from original owner and add to new owner
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
              const newOwnerId = item.ownerId === trade.initiatorId ? trade.recipientId : trade.initiatorId;
              await storage.updatePlayerSkill(item.refId, { accountId: newOwnerId, isEquipped: false });
            }
          }
        }
        
        const completed = await storage.updateTrade(trade.id, {
          status: "completed",
          completedAt: new Date(),
        });
        
        // Activity feed
        const initiator = await storage.getAccount(trade.initiatorId);
        const recipient = await storage.getAccount(trade.recipientId);
        await storage.createActivityFeed({
          type: "trade_complete",
          message: `${initiator?.username} and ${recipient?.username} completed a trade!`,
          metadata: { tradeId: trade.id },
        });
        
        res.json(completed);
      } else {
        res.json(updated);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to accept trade" });
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
      
      // Deduct from player
      await storage.updateAccount(accountId, { [resource]: accountResource - amount });
      
      // Add to guild bank
      const newBank = { ...guild.bank, [resource]: (guild.bank[resource] || 0) + amount };
      const updatedGuild = await storage.updateGuildBank(guild.id, newBank);
      
      // Activity feed
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
      
      const allFeeds = await storage.getAllActivityFeeds();
      const antiCheatLogs = allFeeds.filter(f => f.type === "anticheat_alert");
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
      
      await storage.updateAccountDeath(accountId, true);
      
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
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
  
  // Get tutorial content for player - requires active session
  app.get("/api/ai/tutorial/:accountId/:topic", async (req, res) => {
    try {
      const { accountId, topic } = req.params;
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
  
  // Mark tutorial as completed - requires active session
  app.post("/api/ai/tutorial/:accountId/complete", async (req, res) => {
    try {
      const { accountId } = req.params;
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
  
  // Get story act info for player - requires active session
  app.get("/api/ai/story-act/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
      }
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
        return res.status(403).json({ error: "Only guild master can level up" });
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
    { id: "sparrow", name: "Swift Sparrow", tier: "hatchling", cost: 50, baseStats: { Def: 2, Spd: 3 } },
    { id: "hawk", name: "Iron Hawk", tier: "fledgling", cost: 150, baseStats: { Def: 5, Spd: 4 } },
    { id: "eagle", name: "Guardian Eagle", tier: "soarer", cost: 400, baseStats: { Def: 10, Spd: 8 } },
    { id: "falcon", name: "Storm Falcon", tier: "raptor", cost: 1000, baseStats: { Def: 20, Spd: 15 } },
    { id: "phoenix_bird", name: "Ash Phoenix", tier: "phoenix", cost: 2500, baseStats: { Def: 40, Spd: 30 } },
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
      
      // Deduct focus shards
      await storage.updateAccount(accountId, { focusedShards: account.focusedShards - birdTemplate.cost });
      
      // Create bird
      const { birds } = await import("@shared/schema");
      const [newBird] = await db.insert(birds).values({
        accountId,
        name: customName || birdTemplate.name,
        tier: birdTemplate.tier as any,
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
  
  // Bird feeding - boost bird stats using gold
  const BIRD_FOOD = [
    { id: "seeds", name: "Bird Seeds", price: 100, defBoost: 1, spdBoost: 0 },
    { id: "worms", name: "Juicy Worms", price: 200, defBoost: 0, spdBoost: 2 },
    { id: "berries", name: "Magic Berries", price: 500, defBoost: 2, spdBoost: 2 },
    { id: "golden-nectar", name: "Golden Nectar", price: 1500, defBoost: 5, spdBoost: 5 },
    { id: "phoenix-ash", name: "Phoenix Ash", price: 5000, defBoost: 10, spdBoost: 10 },
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
      
      const session = activeSessions.get(accountId);
      if (!session) {
        return res.status(401).json({ error: "Active session required" });
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
      
      const currentStats = bird.stats as { Def: number; Spd: number };
      const newStats = {
        Def: currentStats.Def + food.defBoost,
        Spd: currentStats.Spd + food.spdBoost,
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
        message: `${bird.name} enjoyed the ${food.name}! +${food.defBoost} Def, +${food.spdBoost} Spd`
      });
    } catch (error) {
      console.error("Bird feeding error:", error);
      res.status(500).json({ error: "Failed to feed bird" });
    }
  });
  
  // ==================== FISHING SYSTEM ====================
  // Fish can be fed to pets to transfer stats and elements
  const FISH_TYPES = [
    { name: "Minnow", rarity: "common", statRange: [1, 3], elements: ["Water"] },
    { name: "Trout", rarity: "common", statRange: [2, 5], elements: ["Water", "Nature"] },
    { name: "Bass", rarity: "uncommon", statRange: [3, 7], elements: ["Water", "Nature"] },
    { name: "Salmon", rarity: "uncommon", statRange: [5, 10], elements: ["Water", "Fire"] },
    { name: "Catfish", rarity: "rare", statRange: [8, 15], elements: ["Water", "Shadow"] },
    { name: "Swordfish", rarity: "rare", statRange: [10, 20], elements: ["Water", "Light"] },
    { name: "Electric Eel", rarity: "epic", statRange: [15, 30], elements: ["Water", "Plasma"] },
    { name: "Kraken Spawn", rarity: "epic", statRange: [20, 40], elements: ["Water", "Shadow", "Plasma"] },
    { name: "Leviathan Scale", rarity: "legendary", statRange: [30, 60], elements: ["Water", "Fire", "Shadow", "Light"] },
  ];
  
  app.post("/api/fishing/cast", async (req, res) => {
    try {
      const schema = z.object({ accountId: z.string() });
      const { accountId } = schema.parse(req.body);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      // Random fish based on rarity
      const roll = Math.random();
      let rarityFilter: string;
      if (roll < 0.5) rarityFilter = "common";
      else if (roll < 0.8) rarityFilter = "uncommon";
      else if (roll < 0.95) rarityFilter = "rare";
      else if (roll < 0.99) rarityFilter = "epic";
      else rarityFilter = "legendary";
      
      const possibleFish = FISH_TYPES.filter(f => f.rarity === rarityFilter);
      const fishTemplate = possibleFish[Math.floor(Math.random() * possibleFish.length)];
      
      // Generate random stats
      const [minStat, maxStat] = fishTemplate.statRange;
      const randomStat = () => Math.floor(Math.random() * (maxStat - minStat + 1)) + minStat;
      const stats = {
        Str: randomStat(),
        Spd: randomStat(),
        Luck: Math.floor(randomStat() / 2),
        ElementalPower: randomStat(),
      };
      
      // Random element from fish's possible elements
      const element = fishTemplate.elements[Math.floor(Math.random() * fishTemplate.elements.length)];
      
      // Create fish
      const { fish } = await import("@shared/schema");
      const [newFish] = await db.insert(fish).values({
        accountId,
        name: fishTemplate.name,
        rarity: fishTemplate.rarity as any,
        element: element as any,
        stats,
      }).returning();
      
      res.json({ success: true, fish: newFish });
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
  
  // Feed fish to pet - transfers all stats and element
  app.post("/api/pets/:petId/feed-fish", async (req, res) => {
    try {
      const schema = z.object({
        accountId: z.string(),
        fishId: z.string(),
      });
      const { accountId, fishId } = schema.parse(req.body);
      
      const pet = await storage.getPet(req.params.petId);
      if (!pet || pet.accountId !== accountId) {
        return res.status(404).json({ error: "Pet not found or not owned" });
      }
      
      const { fish } = await import("@shared/schema");
      const [fishToFeed] = await db.select().from(fish).where(eq(fish.id, fishId));
      if (!fishToFeed || fishToFeed.accountId !== accountId) {
        return res.status(404).json({ error: "Fish not found or not owned" });
      }
      
      // Add fish stats to pet
      const petStats = pet.stats as any;
      const fishStats = fishToFeed.stats as any;
      const newStats = {
        Str: (petStats.Str || 0) + (fishStats.Str || 0),
        Spd: (petStats.Spd || 0) + (fishStats.Spd || 0),
        Luck: (petStats.Luck || 0) + (fishStats.Luck || 0),
        ElementalPower: (petStats.ElementalPower || 0) + (fishStats.ElementalPower || 0),
      };
      
      // Add fish element to pet if it doesn't have it
      const petElements = pet.elements || [pet.element];
      const newElements = fishToFeed.element && !petElements.includes(fishToFeed.element as any)
        ? [...petElements, fishToFeed.element]
        : petElements;
      
      await storage.updatePet(pet.id, { stats: newStats, elements: newElements as any });
      
      // Delete the fish
      await db.delete(fish).where(eq(fish.id, fishId));
      
      const updatedPet = await storage.getPet(pet.id);
      res.json({ success: true, pet: updatedPet, fishConsumed: fishToFeed.name });
    } catch (error) {
      console.error("Feed fish error:", error);
      res.status(500).json({ error: "Failed to feed fish to pet" });
    }
  });

  // Base Raids & Visitors System
  const BASE_RAID_EVENTS = [
    { id: "goblin_raid", name: "Goblin Raid", minTowerFloor: 1, difficulty: 1, rewards: { gold: 500, exp: 100 } },
    { id: "bandit_attack", name: "Bandit Attack", minTowerFloor: 5, difficulty: 2, rewards: { gold: 1500, exp: 300 } },
    { id: "orc_siege", name: "Orc Siege", minTowerFloor: 10, difficulty: 3, rewards: { gold: 5000, exp: 800 } },
    { id: "demon_invasion", name: "Demon Invasion", minTowerFloor: 20, difficulty: 4, rewards: { gold: 15000, exp: 2000 } },
    { id: "dragon_assault", name: "Dragon Assault", minTowerFloor: 30, difficulty: 5, rewards: { gold: 50000, exp: 5000 } },
    { id: "void_breach", name: "Void Breach", minTowerFloor: 50, difficulty: 6, rewards: { gold: 200000, exp: 15000 } },
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
      
      const stats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Vit: 10, Luk: 10 };
      const rankIndex = playerRanks.indexOf(account.rank);
      const rankMultiplier = rankIndex + 1;
      
      const calculated = {
        hp: STAT_FORMULAS.hp(stats.Vit || 10, rankMultiplier, rankMultiplier).toString(),
        damage: STAT_FORMULAS.damage(stats.Str || 10, 0, 1.0).toString(),
        defense: STAT_FORMULAS.defense(stats.Def || 10, 0, 0).toString(),
        initiative: STAT_FORMULAS.initiative(stats.Spd || 10, 0).toString(),
        luck: STAT_FORMULAS.luck(stats.Luk || 10, 0),
        critChance: Math.min(50, Math.floor((stats.Luk || 10) / 5)),
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
      
      const zone = GATHERABLE_ZONES.find(z => z.id === zoneId);
      if (!zone) {
        return res.status(400).json({ error: "Zone not gatherable" });
      }
      
      const stats = account.stats || { Int: 10 };
      const rankIndex = playerRanks.indexOf(account.rank);
      const efficiency = Math.floor((stats.Int || 10) * (1 + rankIndex * 0.1));
      
      const resources: { type: string; amount: number }[] = [];
      const gathers = Math.min(5, Math.floor(efficiency / 20) + 1);
      
      for (let i = 0; i < gathers; i++) {
        for (const res of zone.resources) {
          if (Math.random() < res.chance) {
            const amount = Math.floor(Math.random() * (res.maxAmount - res.minAmount + 1)) + res.minAmount;
            resources.push({ type: res.type, amount: Math.floor(amount * efficiency / 10) });
          }
        }
      }
      
      const totalGold = resources.reduce((sum, r) => sum + r.amount * 10, 0);
      if (totalGold > 0) {
        await storage.updateAccountGold(accountId, account.gold + totalGold);
      }
      
      res.json({
        success: true,
        resources,
        goldEarned: totalGold,
        gatherCount: gathers,
        efficiency,
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
      { floor: 1, minRank: 0 },
      { floor: 10, minRank: 2 },
      { floor: 25, minRank: 4 },
      { floor: 50, minRank: 7 },
      { floor: 75, minRank: 10 },
      { floor: 100, minRank: 13 },
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
        npcFloor: newFloor,
        npcLevel: newLevel,
        gold: account.gold + rewards.gold,
        rubies: (account.rubies || 0) + (rewards.rubies || 0),
        soulShards: (account.soulShards || 0) + (rewards.soulShards || 0),
      });
      
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
      const activityFeeds = await storage.getAllActivityFeeds();
      
      const stats = {
        totalPlayers: allAccounts.length,
        onlinePlayers: onlinePlayers.size,
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
        raceDistribution[acc.race] = (raceDistribution[acc.race] || 0) + 1;
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
      
      if (!playerRanks.includes(rank)) {
        return res.status(400).json({ error: "Invalid rank", validRanks: playerRanks });
      }
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      
      await storage.updateAccount(accountId, { rank });
      
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
        createdAt: a.createdAt,
        role: a.role,
        online: onlinePlayers.has(a.id),
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
      
      for (const playerId of onlinePlayers.keys()) {
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
      
      res.json({ success: true, recipientCount: onlinePlayers.size });
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
            rubies: (account.rubies || 0) + milestone.reward.rubies,
            title: milestone.title,
          });
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
        rubies: (account.rubies || 0) + rewards.rubies,
        soulShards: (account.soulShards || 0) + rewards.soulShards,
        title: rewards.title,
      });
      
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
      for (const id of mythicalLegends) {
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

  app.post("/api/accounts/:id/trigger-raid", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const towerProgress = (account as any).npcProgress?.floor || 1;
      const baseTier = (account as any).baseTier || 1;
      const baseDefense = baseTier * 10;

      const eligibleRaids = BASE_RAID_EVENTS.filter(r => r.minTowerFloor <= towerProgress);
      if (eligibleRaids.length === 0) {
        return res.json({ result: "no_raid", message: "No raids available for your tower progress" });
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

  function getRandomArchetype(): keyof typeof ENEMY_ARCHETYPES {
    const totalWeight = Object.values(ENEMY_ARCHETYPES).reduce((sum, a) => sum + a.spawnWeight, 0);
    let random = Math.random() * totalWeight;
    for (const [key, archetype] of Object.entries(ENEMY_ARCHETYPES)) {
      random -= archetype.spawnWeight;
      if (random <= 0) return key as keyof typeof ENEMY_ARCHETYPES;
    }
    return "minion";
  }

  function generateZoneEnemy(zoneId: string, playerPower: number, playerRankIndex: number) {
    const zoneConfig = ZONE_ENEMY_CONFIG[zoneId] || ZONE_ENEMY_CONFIG["capital_city"];
    const difficultyConfig = ZONE_DIFFICULTIES[zoneConfig.difficulty];
    
    // Anti-overlevel protection: if player is too weak for zone, scale down
    const [minPower, maxPower] = difficultyConfig.powerRange;
    const effectivePower = Math.min(playerPower, maxPower);
    const scaledPower = Math.max(minPower, Math.min(effectivePower, maxPower));
    
    const archetype = getRandomArchetype();
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
      
      const enemy = generateZoneEnemy(zoneId, playerPower, playerRankIndex);
      res.json(enemy);
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
      
      const enemy = generateZoneEnemy(zoneId, playerPower, playerRankIndex);
      
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
      for (const [key, gatherer] of activeGatherers.entries()) {
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

      res.json({
        success: true,
        gathered,
        totalGold,
        efficiency: efficiency.toFixed(2),
        competition: competitors,
        competitionPenalty: competitors > 0 ? `${Math.round((1 - competitionMultiplier) * 100)}%` : "None",
        gatheringTime: zoneResources.gatheringTime,
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
    for (const [key, gatherer] of activeGatherers.entries()) {
      if (now - gatherer.startTime > 300000) {
        activeGatherers.delete(key);
      }
    }

    const gatherers = Array.from(activeGatherers.values())
      .filter(g => g.zoneId === zoneId)
      .length;

    res.json({ gatherers, zoneId });
  });

  return httpServer;
}
