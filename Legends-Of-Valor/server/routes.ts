import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertAccountSchema, insertInventoryItemSchema, playerRanks, playerStatsSchema, equippedSchema, insertEventSchema, insertChallengeSchema, petElements, type GuildBank } from "@shared/schema";
import { z } from "zod";
import type { Account, Event, Challenge } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const MAX_PLAYERS = 20;
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

  app.post("/api/accounts/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string(),
        password: z.string(),
        role: z.enum(["player", "admin"]),
      });
      
      const { username, password, role } = loginSchema.parse(req.body);
      
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
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const account = await storage.createAccount({
        username,
        password: hashedPassword,
        role,
        gold: role === "player" ? 10000 : 0,
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
          
          broadcastToPlayer(winnerId, "challengeResult", {
            challengeId: req.params.id,
            result: "won",
            combatState,
            message: `You won the battle against ${loser?.username}!`,
          });
          
          broadcastToPlayer(loserId, "challengeResult", {
            challengeId: req.params.id,
            result: "lost",
            combatState,
            message: `You lost the battle against ${winner?.username}.`,
          });
          
          res.json({ combatState, finished: true, winnerId });
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
      
      // Calculate player power from stats and equipped items
      const playerStats = account.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
      let playerPower = playerStats.Str + playerStats.Spd + playerStats.Int + playerStats.Luck + playerStats.Pot;
      
      // Add equipped item stats
      const inventory = await storage.getInventoryByAccount(account.id);
      const equipped = account.equipped;
      
      console.log(`Battle Debug - Equipped Slots: ${JSON.stringify(equipped)}`);

      for (const slot of ["weapon", "armor", "accessory1", "accessory2"] as const) {
        const inventoryId = equipped[slot];
        if (inventoryId) {
          const invItem = inventory.find(i => i.id === inventoryId);
          if (invItem) {
            const stats = invItem.stats as any || {};
            // Explicitly convert each stat to number to ensure weapon boosts are added correctly
            const itemPower = (Number(stats.Str) || 0) + (Number(stats.Int) || 0) + (Number(stats.Spd) || 0) + (Number(stats.Luck) || 0) + (Number(stats.Pot) || 0);
            playerPower += itemPower;
            console.log(`Battle Debug - Added ${slot} power: ${itemPower}, Item stats: ${JSON.stringify(stats)}`);
          }
        }
      }
      
      // Add pet power
      let petPower = 0;
      let petElementalPower = 0;
      let petElements: string[] = [];
      let equippedPet = null;
      
      if ((account as any).equippedPetId) {
        equippedPet = await storage.getPet((account as any).equippedPetId);
        if (equippedPet) {
          const petStats = equippedPet.stats as any;
          petPower = (petStats.Str || 0) + (petStats.Spd || 0) + (petStats.Luck || 0);
          petElementalPower = petStats.ElementalPower || 0;
          // Use pet's elements array, fallback to single element if not set
          petElements = equippedPet.elements && equippedPet.elements.length > 0 
            ? equippedPet.elements 
            : [equippedPet.element];
          console.log(`Battle Debug - Equipped Pet: ${equippedPet.name}, Stats: ${JSON.stringify(petStats)}, Elements: ${petElements.join(", ")}`);
        }
      }
      
      // Check if pet's elements are immune - if so, don't add elemental power
      const isElementImmune = petElements.some(elem => npcImmunities.includes(elem));
      
      if (!isElementImmune) {
        playerPower += petElementalPower;
      }
      playerPower += petPower;
      
      // Battle calculation with luck factor
      const luckBonus = Math.random() * ((playerStats.Luck || 10) / 100);
      const effectivePlayerPower = playerPower * (1 + luckBonus);
      
      // Boss fights are harder
      const effectiveNpcPower = isBoss ? npcPower * 1.2 : npcPower;
      
      console.log(`Battle Debug - Player: ${account.username}, Power: ${playerPower}, Luck Bonus: ${luckBonus}, Effective Power: ${effectivePlayerPower}`);
      console.log(`Battle Debug - NPC: ${npcName}, Power: ${npcPower}, Effective Power: ${effectiveNpcPower}, Immunities: ${npcImmunities.join(", ")}`);
      
      const won = effectivePlayerPower >= effectiveNpcPower;
      console.log(`Battle Debug - Result: ${won ? "WON" : "LOST"}`);
      
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
      
      const result = {
        won,
        playerPower: Math.floor(effectivePlayerPower),
        npcPower: Math.floor(effectiveNpcPower),
        npcName: isBoss ? `Floor ${floor} Guardian` : `NPC ${globalLevel}`,
        isBoss,
        bossAbility: isBoss ? getRandomBossAbility(floor) : null,
        npcImmunities,
        petElementImmune: isElementImmune,
        equippedPet: equippedPet ? {
          name: equippedPet.name,
          elements: petElements,
          power: petPower + (isElementImmune ? 0 : petElementalPower),
        } : null,
        rewards,
        newFloor,
        newLevel,
        floor,
        level,
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
  
  // ==================== AI CHAT SYSTEM ====================
  const { chatWithGameAI, getPlayerStoryline, getPendingAdminRequests, resolveAdminRequest, generateWelcomeIntro } = await import("./game-ai");
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
      
      if (account.gold < food.price) {
        return res.status(400).json({ error: `Need ${food.price} gold (have ${account.gold})` });
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
      
      // Use transaction-like approach: update bird stats first, then gold
      // If bird update fails, gold is not deducted
      try {
        await db.update(birds).set({ stats: newStats }).where(eq(birds.id, bird.id));
        await storage.updateAccount(accountId, { gold: account.gold - food.price });
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

  return httpServer;
}
