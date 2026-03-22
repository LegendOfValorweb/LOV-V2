import { db } from "./db";
import { serverAchievements, accounts, ZONE_DUNGEON_CONFIGS } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface ServerAchievementDef {
  key: string;
  displayName: string;
  category: string;
  description: string;
}

export const HONOUR_HALL_CATEGORIES = [
  "Combat",
  "Ranks",
  "Mystic Tower",
  "Items",
  "Economy",
  "Crafting & Life Skills",
  "Heritage",
  "Zones",
] as const;

export const SERVER_ACHIEVEMENT_DEFS: ServerAchievementDef[] = [
  // Combat
  { key: "first_win", displayName: "First Blood", category: "Combat", description: "First player to win any battle." },
  { key: "first_10_wins", displayName: "Veteran Fighter", category: "Combat", description: "First player to reach 10 wins." },
  { key: "first_100_wins", displayName: "Battle-Hardened", category: "Combat", description: "First player to reach 100 wins." },
  { key: "first_1000_wins", displayName: "War Legend", category: "Combat", description: "First player to reach 1,000 wins." },
  { key: "first_pvp_win", displayName: "Duelist", category: "Combat", description: "First player to win a PvP challenge." },
  { key: "first_world_boss_kill", displayName: "Boss Slayer", category: "Combat", description: "First player to deliver the killing blow on a World Boss." },

  // Ranks (Rank 2–15 since Rank 1 is starting rank)
  { key: "first_rank_apprentice", displayName: "First Apprentice", category: "Ranks", description: "First player to reach Apprentice rank." },
  { key: "first_rank_initiate", displayName: "First Initiate", category: "Ranks", description: "First player to reach Initiate rank." },
  { key: "first_rank_journeyman", displayName: "First Journeyman", category: "Ranks", description: "First player to reach Journeyman rank." },
  { key: "first_rank_adept", displayName: "First Adept", category: "Ranks", description: "First player to reach Adept rank." },
  { key: "first_rank_expert", displayName: "First Expert", category: "Ranks", description: "First player to reach Expert rank." },
  { key: "first_rank_master", displayName: "First Master", category: "Ranks", description: "First player to reach Master rank." },
  { key: "first_rank_grandmaster", displayName: "First Grandmaster", category: "Ranks", description: "First player to reach Grandmaster rank." },
  { key: "first_rank_champion", displayName: "First Champion", category: "Ranks", description: "First player to reach Champion rank." },
  { key: "first_rank_overlord", displayName: "First Overlord", category: "Ranks", description: "First player to reach Overlord rank." },
  { key: "first_rank_sovereign", displayName: "First Sovereign", category: "Ranks", description: "First player to reach Sovereign rank." },
  { key: "first_rank_ascendant", displayName: "First Ascendant", category: "Ranks", description: "First player to reach Ascendant rank." },
  { key: "first_rank_legend", displayName: "First Legend", category: "Ranks", description: "First player to reach Legend rank." },
  { key: "first_rank_mythic", displayName: "First Mythic", category: "Ranks", description: "First player to reach Mythic rank." },
  { key: "first_rank_mythical_legend", displayName: "First Mythical Legend", category: "Ranks", description: "First player to reach the pinnacle Mythical Legend rank." },

  // Mystic Tower
  { key: "first_tower_floor_10", displayName: "Tower Climber", category: "Mystic Tower", description: "First player to reach Floor 10 of the Mystic Tower." },
  { key: "first_tower_floor_25", displayName: "Tower Veteran", category: "Mystic Tower", description: "First player to reach Floor 25 of the Mystic Tower." },
  { key: "first_tower_floor_50", displayName: "Tower Master", category: "Mystic Tower", description: "First player to reach Floor 50 of the Mystic Tower." },
  { key: "first_tower_floor_75", displayName: "Tower Sovereign", category: "Mystic Tower", description: "First player to reach Floor 75 of the Mystic Tower." },
  { key: "first_tower_floor_100", displayName: "Tower Conqueror", category: "Mystic Tower", description: "First player to conquer all 100 floors of the Mystic Tower." },

  // Items
  { key: "first_legendary_purchase", displayName: "Legend Collector", category: "Items", description: "First player to purchase a Legendary-tier item." },
  { key: "first_mythic_purchase", displayName: "Mythic Collector", category: "Items", description: "First player to purchase a Mythic-tier item." },
  { key: "first_max_skin", displayName: "Style Icon", category: "Items", description: "First player to own a max-tier Mythical Legend skin." },

  // Economy
  { key: "first_1m_gold", displayName: "Millionaire", category: "Economy", description: "First player to accumulate 1,000,000 Gold." },
  { key: "first_ruby_earned", displayName: "Ruby Pioneer", category: "Economy", description: "First player to earn any Ruby." },
  { key: "first_valor_token_spend", displayName: "Valor Spender", category: "Economy", description: "First player to spend Valor Tokens." },

  // Crafting & Life Skills
  { key: "first_craft", displayName: "First Craftsman", category: "Crafting & Life Skills", description: "First player to successfully craft an item." },
  { key: "first_fish", displayName: "First Angler", category: "Crafting & Life Skills", description: "First player to catch a fish." },
  { key: "first_ore_mined", displayName: "First Miner", category: "Crafting & Life Skills", description: "First player to mine ore." },

  // Heritage
  { key: "first_heritage_rebirth", displayName: "Reborn Pioneer", category: "Heritage", description: "First player to complete a Heritage Rebirth." },

  // Zones - one per named zone dungeon
  ...ZONE_DUNGEON_CONFIGS.map(cfg => ({
    key: `first_zone_dungeon_${cfg.zoneId}`,
    displayName: `First to Clear: ${cfg.name}`,
    category: "Zones",
    description: `First player to complete the ${cfg.name} dungeon.`,
  })),
];

const RANK_TO_KEY: Record<string, string> = {
  "Apprentice": "first_rank_apprentice",
  "Initiate": "first_rank_initiate",
  "Journeyman": "first_rank_journeyman",
  "Adept": "first_rank_adept",
  "Expert": "first_rank_expert",
  "Master": "first_rank_master",
  "Grandmaster": "first_rank_grandmaster",
  "Champion": "first_rank_champion",
  "Overlord": "first_rank_overlord",
  "Sovereign": "first_rank_sovereign",
  "Ascendant": "first_rank_ascendant",
  "Legend": "first_rank_legend",
  "Mythic": "first_rank_mythic",
  "Mythical Legend": "first_rank_mythical_legend",
};

export async function initServerAchievements(): Promise<void> {
  try {
    for (const def of SERVER_ACHIEVEMENT_DEFS) {
      const existing = await db.select().from(serverAchievements)
        .where(eq(serverAchievements.achievementKey, def.key))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(serverAchievements).values({
          achievementKey: def.key,
          displayName: def.displayName,
          category: def.category,
          description: def.description,
          holderAccountId: null,
          holderUsername: null,
          holderRace: null,
          achievedAt: null,
          contextValue: null,
        });
      }
    }
    console.log("[HonourHall] Server achievements initialized.");
  } catch (err) {
    console.error("[HonourHall] Failed to initialize server achievements:", err);
  }
}

export async function claimServerAchievement(
  key: string,
  accountId: string,
  username: string,
  race: string | null | undefined,
  contextValue?: string,
): Promise<boolean> {
  try {
    const existing = await db.select().from(serverAchievements)
      .where(eq(serverAchievements.achievementKey, key))
      .limit(1);
    if (existing.length === 0) return false;
    if (existing[0].holderAccountId !== null) return false;

    await db.update(serverAchievements)
      .set({
        holderAccountId: accountId,
        holderUsername: username,
        holderRace: race || null,
        achievedAt: new Date(),
        contextValue: contextValue || null,
      })
      .where(
        sql`${serverAchievements.achievementKey} = ${key} AND ${serverAchievements.holderAccountId} IS NULL`
      );

    const updated = await db.select().from(serverAchievements)
      .where(eq(serverAchievements.achievementKey, key))
      .limit(1);

    return updated[0]?.holderAccountId === accountId;
  } catch (err) {
    console.error(`[HonourHall] Failed to claim achievement ${key}:`, err);
    return false;
  }
}

export async function checkAndClaimOnWin(
  accountId: string,
  username: string,
  race: string | null | undefined,
  newWins: number,
  isPvp: boolean,
): Promise<string[]> {
  const claimed: string[] = [];
  if (newWins >= 1) {
    if (await claimServerAchievement("first_win", accountId, username, race)) claimed.push("first_win");
  }
  if (newWins >= 10) {
    if (await claimServerAchievement("first_10_wins", accountId, username, race)) claimed.push("first_10_wins");
  }
  if (newWins >= 100) {
    if (await claimServerAchievement("first_100_wins", accountId, username, race)) claimed.push("first_100_wins");
  }
  if (newWins >= 1000) {
    if (await claimServerAchievement("first_1000_wins", accountId, username, race)) claimed.push("first_1000_wins");
  }
  if (isPvp) {
    if (await claimServerAchievement("first_pvp_win", accountId, username, race)) claimed.push("first_pvp_win");
  }
  return claimed;
}

export async function checkAndClaimOnRankUp(
  accountId: string,
  username: string,
  race: string | null | undefined,
  newRank: string,
): Promise<string[]> {
  const claimed: string[] = [];
  const key = RANK_TO_KEY[newRank];
  if (key) {
    if (await claimServerAchievement(key, accountId, username, race)) claimed.push(key);
  }
  return claimed;
}

export async function checkAndClaimOnTowerFloor(
  accountId: string,
  username: string,
  race: string | null | undefined,
  newFloor: number,
): Promise<string[]> {
  const claimed: string[] = [];
  const checkpoints = [
    { floor: 10, key: "first_tower_floor_10" },
    { floor: 25, key: "first_tower_floor_25" },
    { floor: 50, key: "first_tower_floor_50" },
    { floor: 75, key: "first_tower_floor_75" },
    { floor: 100, key: "first_tower_floor_100" },
  ];
  for (const cp of checkpoints) {
    if (newFloor >= cp.floor) {
      if (await claimServerAchievement(cp.key, accountId, username, race)) claimed.push(cp.key);
    }
  }
  return claimed;
}

export async function checkAndClaimOnItemPurchase(
  accountId: string,
  username: string,
  race: string | null | undefined,
  itemTier: string,
  itemName: string,
): Promise<string[]> {
  const claimed: string[] = [];
  const legendaryTiers = ["legend", "elite"];
  const mythicTiers = ["mythical_legend"];

  if (legendaryTiers.includes(itemTier)) {
    if (await claimServerAchievement("first_legendary_purchase", accountId, username, race, itemName)) {
      claimed.push("first_legendary_purchase");
    }
  }
  if (mythicTiers.includes(itemTier)) {
    if (await claimServerAchievement("first_mythic_purchase", accountId, username, race, itemName)) {
      claimed.push("first_mythic_purchase");
    }
  }
  return claimed;
}

export async function checkAndClaimOnSkinPurchase(
  accountId: string,
  username: string,
  race: string | null | undefined,
  skinRarity: string,
  skinName: string,
): Promise<string[]> {
  const claimed: string[] = [];
  const maxTierRarities = ["mythic", "mythical_legend", "mythic_legend"];
  if (maxTierRarities.includes(skinRarity.toLowerCase())) {
    if (await claimServerAchievement("first_max_skin", accountId, username, race, skinName)) {
      claimed.push("first_max_skin");
    }
  }
  return claimed;
}

export async function checkAndClaimOnGold(
  accountId: string,
  username: string,
  race: string | null | undefined,
  newGold: number,
): Promise<string[]> {
  const claimed: string[] = [];
  if (newGold >= 1000000) {
    if (await claimServerAchievement("first_1m_gold", accountId, username, race)) claimed.push("first_1m_gold");
  }
  return claimed;
}

export async function checkAndClaimOnRubyEarned(
  accountId: string,
  username: string,
  race: string | null | undefined,
  newRubies: number,
): Promise<string[]> {
  const claimed: string[] = [];
  if (newRubies >= 1) {
    if (await claimServerAchievement("first_ruby_earned", accountId, username, race)) claimed.push("first_ruby_earned");
  }
  return claimed;
}

export async function checkAndClaimOnValorSpend(
  accountId: string,
  username: string,
  race: string | null | undefined,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_valor_token_spend", accountId, username, race)) {
    claimed.push("first_valor_token_spend");
  }
  return claimed;
}

export async function checkAndClaimOnCraft(
  accountId: string,
  username: string,
  race: string | null | undefined,
  itemName: string,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_craft", accountId, username, race, itemName)) {
    claimed.push("first_craft");
  }
  return claimed;
}

export async function checkAndClaimOnFish(
  accountId: string,
  username: string,
  race: string | null | undefined,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_fish", accountId, username, race)) {
    claimed.push("first_fish");
  }
  return claimed;
}

export async function checkAndClaimOnOreMined(
  accountId: string,
  username: string,
  race: string | null | undefined,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_ore_mined", accountId, username, race)) {
    claimed.push("first_ore_mined");
  }
  return claimed;
}

export async function checkAndClaimOnHeritage(
  accountId: string,
  username: string,
  race: string | null | undefined,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_heritage_rebirth", accountId, username, race)) {
    claimed.push("first_heritage_rebirth");
  }
  return claimed;
}

export async function checkAndClaimOnZoneDungeon(
  accountId: string,
  username: string,
  race: string | null | undefined,
  zoneId: string,
): Promise<string[]> {
  const claimed: string[] = [];
  const key = `first_zone_dungeon_${zoneId}`;
  if (await claimServerAchievement(key, accountId, username, race)) {
    claimed.push(key);
  }
  return claimed;
}

export async function checkAndClaimOnWorldBossKill(
  accountId: string,
  username: string,
  race: string | null | undefined,
  bossName: string,
): Promise<string[]> {
  const claimed: string[] = [];
  if (await claimServerAchievement("first_world_boss_kill", accountId, username, race, bossName)) {
    claimed.push("first_world_boss_kill");
  }
  return claimed;
}

export function getAchievementDisplayName(key: string): string {
  const def = SERVER_ACHIEVEMENT_DEFS.find(d => d.key === key);
  return def?.displayName || key;
}
