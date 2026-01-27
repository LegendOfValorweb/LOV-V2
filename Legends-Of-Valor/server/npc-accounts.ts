import { storage } from "./storage";
import bcrypt from "bcrypt";

// NPC player configuration with power level (0 = weakest, 1 = strongest)
export const NPC_PLAYERS = [
  { username: "Guardian_Kira", password: "npc_kira_2024", powerLevel: 1.0 },  // Strongest - matches best player
  { username: "Shadow_Vex", password: "npc_vex_2024", powerLevel: 0.7 },      // Upper-mid tier
  { username: "Iron_Magnus", password: "npc_magnus_2024", powerLevel: 0.4 }, // Lower-mid tier
  { username: "Storm_Lyra", password: "npc_lyra_2024", powerLevel: 0.0 },    // Weakest - matches weakest player
];

export const NPC_GUILD_NAME = "The Eternal Watch";

// Check if account is an NPC
export function isNPCAccount(username: string): boolean {
  return NPC_PLAYERS.some(npc => npc.username === username);
}

// Initialize NPC accounts and guild
export async function initializeNPCAccounts() {
  console.log("[NPC] Initializing NPC player accounts...");
  
  const npcAccountIds: string[] = [];
  
  for (const npc of NPC_PLAYERS) {
    let account = await storage.getAccountByUsername(npc.username);
    
    if (!account) {
      const hashedPassword = await bcrypt.hash(npc.password, 10);
      account = await storage.createAccount({
        username: npc.username,
        password: hashedPassword,
        role: "player",
        gold: 100000,
        rubies: 1000,
        soulShards: 500,
        focusedShards: 100,
        trainingPoints: 10000,
        petExp: 0,
        runes: 100,
        pets: [],
        rank: "Novice",
        wins: 0,
        losses: 0,
        stats: { Str: 15, Def: 15, Spd: 15, Int: 15, Luck: 15, Pot: 0 },
        equipped: { weapon: null, armor: null, accessory1: null, accessory2: null },
        npcFloor: 1,
        npcLevel: 1,
      });
      console.log(`[NPC] Created NPC account: ${npc.username}`);
    }
    
    npcAccountIds.push(account.id);
  }
  
  // Check if NPC guild exists
  const guilds = await storage.getAllGuilds();
  let npcGuild = guilds.find(g => g.name === NPC_GUILD_NAME);
  
  if (!npcGuild && npcAccountIds.length > 0) {
    // Create NPC guild with first NPC as master
    npcGuild = await storage.createGuild({
      name: NPC_GUILD_NAME,
      masterId: npcAccountIds[0],
    });
    console.log(`[NPC] Created NPC guild: ${NPC_GUILD_NAME}`);
    
    // Add other NPCs to guild
    for (let i = 1; i < npcAccountIds.length; i++) {
      await storage.addGuildMember({
        guildId: npcGuild.id,
        accountId: npcAccountIds[i],
      });
    }
    console.log(`[NPC] Added all NPCs to guild`);
  }
  
  console.log("[NPC] NPC initialization complete");
  
  // Scale NPC stats based on player stats range
  await scaleNPCStats();
  
  return { npcAccountIds, npcGuild };
}

// Scale NPC stats to match player power range
export async function scaleNPCStats() {
  try {
    // Get all non-NPC player accounts
    const allAccounts = await storage.getAllAccounts();
    const playerAccounts = allAccounts.filter(acc => !isNPCAccount(acc.username) && acc.role !== "admin");
    
    if (playerAccounts.length === 0) {
      console.log("[NPC] No players to scale against, using defaults");
      return;
    }
    
    // Calculate total power for each player (sum of all stats)
    const playerPowers = playerAccounts.map(acc => {
      const stats = acc.stats as any || {};
      return {
        account: acc,
        power: (stats.Str || 10) + (stats.Def || 10) + (stats.Spd || 10) + (stats.Int || 10) + (stats.Luck || 10),
      };
    });
    
    // Find min and max power
    const minPower = Math.min(...playerPowers.map(p => p.power));
    const maxPower = Math.max(...playerPowers.map(p => p.power));
    const powerRange = maxPower - minPower;
    
    console.log(`[NPC] Player power range: ${minPower} - ${maxPower}`);
    
    // Scale each NPC based on their power level
    for (const npc of NPC_PLAYERS) {
      const account = await storage.getAccountByUsername(npc.username);
      if (!account) continue;
      
      // Calculate target power for this NPC
      const targetPower = powerRange > 0 
        ? minPower + (powerRange * npc.powerLevel)
        : minPower;
      
      // Distribute power across stats (slightly varied for flavor)
      const baseStat = Math.floor(targetPower / 5);
      const newStats = {
        Str: Math.max(10, baseStat + Math.floor(Math.random() * 5)),
        Def: Math.max(10, baseStat + Math.floor(Math.random() * 5)),
        Spd: Math.max(10, baseStat + Math.floor(Math.random() * 5)),
        Int: Math.max(10, baseStat + Math.floor(Math.random() * 5)),
        Luck: Math.max(10, baseStat + Math.floor(Math.random() * 5)),
        Pot: 0,
      };
      
      await storage.updateAccount(account.id, { stats: newStats });
      console.log(`[NPC] Scaled ${npc.username} to power ${targetPower} (${npc.powerLevel * 100}%)`);
    }
    
    console.log("[NPC] NPC stats scaling complete");
  } catch (error) {
    console.error("[NPC] Failed to scale NPC stats:", error);
  }
}

// Auto-accept challenge for NPC
export async function autoAcceptNPCChallenge(challengeId: string) {
  const challenge = await storage.getChallenge(challengeId);
  if (!challenge) return false;
  
  const challenged = await storage.getAccount(challenge.challengedId);
  if (!challenged || !isNPCAccount(challenged.username)) return false;
  
  // NPCs always accept challenges
  await storage.updateChallengeStatus(challengeId, "accepted", new Date());
  
  console.log(`[NPC] ${challenged.username} auto-accepted challenge ${challengeId}`);
  return true;
}

// NPC progression - called periodically to make NPCs progress through NPC tower
export async function progressNPCAccounts() {
  for (const npc of NPC_PLAYERS) {
    const account = await storage.getAccountByUsername(npc.username);
    if (!account) continue;
    
    // Random chance to progress (simulate playing)
    const progressChance = Math.random();
    if (progressChance < 0.3) { // 30% chance each tick
      let newLevel = account.npcLevel + 1;
      let newFloor = account.npcFloor;
      
      if (newLevel > 100) {
        newLevel = 1;
        newFloor = Math.min(newFloor + 1, 50);
      }
      
      // NPCs don't progress past floor 25 to keep them beatable
      if (newFloor <= 25) {
        await storage.updateNpcProgress(account.id, newFloor, newLevel);
        
        // Small chance to gain training points
        if (Math.random() < 0.2) {
          await storage.updateAccount(account.id, {
            trainingPoints: account.trainingPoints + Math.floor(Math.random() * 100) + 10,
          });
        }
      }
    }
  }
}

// Start NPC progression loop (runs every 5 minutes)
let npcProgressionInterval: NodeJS.Timeout | null = null;

export function startNPCProgressionLoop() {
  if (npcProgressionInterval) return;
  
  npcProgressionInterval = setInterval(() => {
    progressNPCAccounts().catch(err => {
      console.error("[NPC] Progression error:", err);
    });
  }, 5 * 60 * 1000); // Every 5 minutes
  
  console.log("[NPC] Started NPC progression loop");
}

export function stopNPCProgressionLoop() {
  if (npcProgressionInterval) {
    clearInterval(npcProgressionInterval);
    npcProgressionInterval = null;
  }
}
