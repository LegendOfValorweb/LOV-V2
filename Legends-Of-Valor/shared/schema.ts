import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const itemTiers = ["normal", "super_rare", "x_tier", "umr", "ssumr", "divine", "initiate", "journeyman", "adept", "expert", "master", "grandmaster", "champion", "overlord", "sovereign", "ascendant", "legend", "elite", "mythical_legend"] as const;
export type ItemTier = typeof itemTiers[number];

export const itemTypes = ["weapon", "armor", "accessory"] as const;
export type ItemType = typeof itemTypes[number];

export const statsSchema = z.object({
  Str: z.number().optional(),
  Int: z.number().optional(),
  Spd: z.number().optional(),
  Luck: z.number().optional(),
  Pot: z.number().optional(),
});

export type Stats = z.infer<typeof statsSchema>;

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(itemTypes),
  stats: statsSchema,
  special: z.string().optional(),
  price: z.number(),
  tier: z.enum(itemTiers),
});

export type Item = z.infer<typeof itemSchema>;

export const accountRoles = ["player", "admin"] as const;
export type AccountRole = typeof accountRoles[number];

// V2: Expanded 15-rank system with quintillion-safe power scaling
export const playerRanks = [
  "Novice",           // Rank 1 - Beginner tier (1-10K power)
  "Apprentice",       // Rank 2
  "Initiate",         // Rank 3
  "Journeyman",       // Rank 4 - Intermediate tier (10K-10M power)
  "Adept",            // Rank 5
  "Expert",           // Rank 6
  "Master",           // Rank 7 - Advanced tier (10M-10B power)
  "Grandmaster",      // Rank 8
  "Champion",         // Rank 9
  "Overlord",         // Rank 10 - Mastery tier (10B-10T power)
  "Sovereign",        // Rank 11
  "Ascendant",        // Rank 12
  "Legend",           // Rank 13 - Legendary tier (10T-9Q power)
  "Mythic",           // Rank 14
  "Mythical Legend",  // Rank 15 - Max rank
] as const;
export type PlayerRank = typeof playerRanks[number];

// V2: 14 Playable Races with stat modifiers
export const playerRaces = [
  "human",      // Balanced growth, adaptable builds
  "elf",        // High elemental/magic affinity, speed bonuses
  "dwarf",      // High defense, crafting and mining bonuses
  "orc",        // Strength and vitality focused, combat bonuses
  "beastfolk",  // Speed, crit, hunting and gathering bonuses
  "mystic",     // Nature magic, regeneration, pet synergy
  "fae",        // Luck, trick mechanics, illusion bonuses
  "elemental",  // Strong elemental affinity matching chosen element
  "undead",     // Curse resistance, death-related bonuses
  "demon",      // High risk/high reward power scaling
  "draconic",   // Elemental breath, stat scaling with rank
  "celestial",  // Support, buffs, light affinity
  "aquatic",    // Water affinity, fishing and coastal bonuses
  "titan",      // Massive strength and defense scaling (rare unlock)
] as const;
export type PlayerRace = typeof playerRaces[number];

export const playerGenders = ["male", "female"] as const;
export type PlayerGender = typeof playerGenders[number];

// Race stat modifiers (affects base stat growth)
export const raceModifiers: Record<PlayerRace, {
  Str: number;
  Def: number;
  Spd: number;
  Int: number;
  Luck: number;
  description: string;
  element?: string;
}> = {
  human: { Str: 1.0, Def: 1.0, Spd: 1.0, Int: 1.0, Luck: 1.0, description: "Balanced growth, adaptable builds" },
  elf: { Str: 0.9, Def: 0.85, Spd: 1.15, Int: 1.2, Luck: 1.0, description: "High elemental/magic affinity, speed bonuses", element: "Nature" },
  dwarf: { Str: 1.1, Def: 1.2, Spd: 0.85, Int: 0.95, Luck: 1.0, description: "High defense, crafting and mining bonuses", element: "Earth" },
  orc: { Str: 1.2, Def: 1.1, Spd: 0.95, Int: 0.85, Luck: 0.9, description: "Strength and vitality focused, combat bonuses" },
  beastfolk: { Str: 1.0, Def: 0.9, Spd: 1.2, Int: 0.9, Luck: 1.1, description: "Speed, crit, hunting and gathering bonuses" },
  mystic: { Str: 0.85, Def: 0.9, Spd: 1.0, Int: 1.15, Luck: 1.1, description: "Nature magic, regeneration, pet synergy", element: "Nature" },
  fae: { Str: 0.8, Def: 0.85, Spd: 1.1, Int: 1.1, Luck: 1.2, description: "Luck, trick mechanics, illusion bonuses", element: "Light" },
  elemental: { Str: 1.0, Def: 1.0, Spd: 1.0, Int: 1.15, Luck: 0.95, description: "Strong elemental affinity matching chosen element" },
  undead: { Str: 1.05, Def: 1.1, Spd: 0.9, Int: 1.0, Luck: 0.95, description: "Curse resistance, death-related bonuses", element: "Dark" },
  demon: { Str: 1.15, Def: 0.9, Spd: 1.05, Int: 1.1, Luck: 0.85, description: "High risk/high reward power scaling", element: "Dark" },
  draconic: { Str: 1.15, Def: 1.1, Spd: 0.95, Int: 1.0, Luck: 0.9, description: "Elemental breath, stat scaling with rank", element: "Fire" },
  celestial: { Str: 0.9, Def: 1.0, Spd: 1.0, Int: 1.15, Luck: 1.05, description: "Support, buffs, light affinity", element: "Light" },
  aquatic: { Str: 0.95, Def: 1.0, Spd: 1.1, Int: 1.0, Luck: 1.05, description: "Water affinity, fishing and coastal bonuses", element: "Water" },
  titan: { Str: 1.2, Def: 1.2, Spd: 0.8, Int: 0.9, Luck: 0.9, description: "Massive strength and defense scaling (rare unlock)", element: "Earth" },
};

export const CARRY_CAPACITY_BY_RANK: Record<string, number> = {
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

export const ITEM_WEIGHT_BY_TIER: Record<string, number> = {
  normal: 1,
  super_rare: 1,
  x_tier: 2,
  umr: 2,
  ssumr: 3,
  divine: 3,
  initiate: 1,
  journeyman: 1,
  adept: 2,
  expert: 2,
  master: 3,
  grandmaster: 3,
  champion: 3,
  overlord: 5,
  sovereign: 5,
  ascendant: 5,
  legend: 5,
  elite: 5,
  mythical_legend: 5,
};

export const FISH_WEIGHT_BY_RARITY: Record<string, number> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

export const FISH_CRAFTING_MATERIAL: Record<string, boolean> = {
  common: false,
  uncommon: false,
  rare: false,
  epic: false,
  legendary: true,
  mythic: true,
};

export const RESOURCE_WEIGHT_BY_RARITY: Record<string, number> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 5,
};

export const MAX_HERITAGE_REBIRTHS = 10;
export const HERITAGE_BONUS_PER_REBIRTH = 3;
export const MAX_HERITAGE_BONUS = MAX_HERITAGE_REBIRTHS * HERITAGE_BONUS_PER_REBIRTH;

export const HERITAGE_TITLES: Record<number, string> = {
  1: "Reborn",
  2: "Twice-Forged",
  3: "Thrice-Ascended",
  4: "Quad-Risen",
  5: "Penta-Eternal",
  6: "Hex-Immortal",
  7: "Septa-Divine",
  8: "Octa-Transcendent",
  9: "Nona-Mythic",
  10: "Deca-Legend",
};

export const BASE_TIER_NAMES = ["", "Camp", "Lodge", "Keep", "Manor", "Castle"] as const;
export const BASE_TIER_COSTS = [0, 500000, 5000000, 50000000, 500000000];
export const BASE_TIER_RANK_REQUIREMENTS = ["Novice", "Journeyman", "Expert", "Grandmaster", "Legend"];

export const ROOM_MAX_LEVEL_BY_TIER: Record<number, number> = {
  1: 3,
  2: 5,
  3: 7,
  4: 9,
  5: 10,
};

export const OFFLINE_TRAINING_XP_PER_HOUR: Record<number, number> = {
  1: 5,
  2: 10,
  3: 20,
  4: 35,
  5: 50,
};

export const VAULT_INTEREST_RATE: Record<number, number> = {
  1: 0.001,
  2: 0.002,
  3: 0.003,
  4: 0.004,
  5: 0.005,
};

export const VAULT_MAX_GOLD: Record<number, number> = {
  1: 100000,
  2: 500000,
  3: 2000000,
  4: 10000000,
  5: 50000000,
};

export const ROOM_UPGRADE_BASE_COST: Record<string, number> = {
  storage: 5000,
  weapon_locker: 8000,
  rest: 3000,
  crafting: 10000,
  training: 15000,
  vault: 25000,
  defenses: 50000,
};

export function calculateCarryCapacity(rank: string, strength: number, petsCarryBonus: number = 0): number {
  const baseByRank = CARRY_CAPACITY_BY_RANK[rank] || 50;
  return baseByRank + (strength * 2) + petsCarryBonus;
}

export const playerStatsSchema = z.object({
  Str: z.number().default(10),
  Def: z.number().default(10),
  Spd: z.number().default(10),
  Int: z.number().default(10),
  Luck: z.number().default(10),
  Pot: z.number().default(0),
});

export type PlayerStats = z.infer<typeof playerStatsSchema>;

export const equippedSchema = z.object({
  weapon: z.string().nullable(),
  armor: z.string().nullable(),
  accessory1: z.string().nullable(),
  accessory2: z.string().nullable(),
});

export type Equipped = z.infer<typeof equippedSchema>;

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().$type<AccountRole>(),
  // V2: Race and gender selection (permanent, max 2 players per race)
  race: text("race").$type<PlayerRace>(),
  gender: text("gender").$type<PlayerGender>(),
  portrait: text("portrait"), // Static portrait identifier
  gold: bigint("gold", { mode: "number" }).notNull().default(10000),
  rubies: bigint("rubies", { mode: "number" }).notNull().default(0),
  soulShards: bigint("soul_shards", { mode: "number" }).notNull().default(0),
  focusedShards: bigint("focused_shards", { mode: "number" }).notNull().default(0),
  trainingPoints: bigint("training_points", { mode: "number" }).notNull().default(0),
  petExp: bigint("pet_exp", { mode: "number" }).notNull().default(0),
  runes: bigint("runes", { mode: "number" }).notNull().default(0),
  // V2: New currencies
  soulGins: bigint("soul_gins", { mode: "number" }).notNull().default(0), // For pet training
  beakCoins: bigint("beak_coins", { mode: "number" }).notNull().default(0), // For bird training
  valorTokens: bigint("valor_tokens", { mode: "number" }).notNull().default(0), // Premium currency ($Valor)
  // $Valor Shop currencies
  bait: bigint("bait", { mode: "number" }).notNull().default(0), // Fishing bait
  craftingMats: bigint("crafting_mats", { mode: "number" }).notNull().default(0), // Crafting materials
  mysticShards: bigint("mystic_shards", { mode: "number" }).notNull().default(0), // Rare mystic shards
  petEggs: bigint("pet_eggs", { mode: "number" }).notNull().default(0), // Basic pet eggs
  rarePetEggs: bigint("rare_pet_eggs", { mode: "number" }).notNull().default(0),
  epicPetEggs: bigint("epic_pet_eggs", { mode: "number" }).notNull().default(0),
  mythicPetEggs: bigint("mythic_pet_eggs", { mode: "number" }).notNull().default(0),
  skinTickets: bigint("skin_tickets", { mode: "number" }).notNull().default(0), // Unlock random skins
  rareSkinTickets: bigint("rare_skin_tickets", { mode: "number" }).notNull().default(0),
  epicSkinTickets: bigint("epic_skin_tickets", { mode: "number" }).notNull().default(0),
  mythicSkinTickets: bigint("mythic_skin_tickets", { mode: "number" }).notNull().default(0),
  unlockedSkins: text("unlocked_skins").array().default(sql`ARRAY[]::text[]`), // Skins player owns
  activeBuffs: jsonb("active_buffs").notNull().default([]).$type<{id: string; expiresAt: string}[]>(), // Temporary boosts
  vipUntil: timestamp("vip_until"), // VIP status expiration
  pets: jsonb("pets").notNull().default([]).$type<string[]>(),
  rank: text("rank").notNull().default("Novice").$type<PlayerRank>(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  stats: jsonb("stats").notNull().default({ Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 }).$type<PlayerStats>(),
  equipped: jsonb("equipped").notNull().default({ weapon: null, armor: null, accessory1: null, accessory2: null }).$type<Equipped>(),
  npcFloor: integer("npc_floor").notNull().default(1),
  npcLevel: integer("npc_level").notNull().default(1),
  equippedPetId: varchar("equipped_pet_id"),
  lastActive: timestamp("last_active").defaultNow(),
  // V2: Story progression tracking
  storyAct: integer("story_act").notNull().default(1), // Current story act (1-4)
  storyCheckpoint: text("story_checkpoint"), // Current story checkpoint
  // V2: Death & Revival system
  isDead: boolean("is_dead").notNull().default(false),
  ghostState: boolean("ghost_state").notNull().default(false),
  lastDeathTime: timestamp("last_death_time"),
  deathCount: integer("death_count").notNull().default(0),
  reviveTokens: integer("revive_tokens").notNull().default(1),
  respawnLocation: text("respawn_location").notNull().default("base"),
  weaknessDebuffExpires: timestamp("weakness_debuff_expires"),
  // V2: Base system
  baseTier: integer("base_tier").notNull().default(1), // Current base tier (1-5)
  baseSkin: text("base_skin").default("default"), // Cosmetic base skin
  baseRoomLevels: jsonb("base_room_levels").notNull().default({ storage: 1, weapon_locker: 1, rest: 1, crafting: 1, training: 1, vault: 1, defenses: 1 }).$type<Record<string, number>>(), // Room upgrade levels
  trophies: text("trophies").array().default(sql`ARRAY[]::text[]`), // Earned trophies
  offlineTrainingStat: text("offline_training_stat"),
  offlineTrainingStartedAt: timestamp("offline_training_started_at"),
  vaultGold: bigint("vault_gold", { mode: "number" }).notNull().default(0),
  lastVaultInterest: timestamp("last_vault_interest").defaultNow(),
  // V2: Equipped cosmetic skins
  equippedCharacterSkin: text("equipped_character_skin").default("default"),
  equippedPetSkin: text("equipped_pet_skin").default("default"),
  equippedBirdSkin: text("equipped_bird_skin").default("default"),
  energy: integer("energy").notNull().default(50),
  maxEnergy: integer("max_energy").notNull().default(50),
  lastEnergyUpdate: timestamp("last_energy_update").defaultNow(),
  currentSessionId: text("current_session_id"),
  lastCombatTime: timestamp("last_combat_time"),
  heritageCount: integer("heritage_count").notNull().default(0),
  heritageBonusPercent: integer("heritage_bonus_percent").notNull().default(0),
  dailyFishCaught: integer("daily_fish_caught").notNull().default(0),
  lastFishingReset: timestamp("last_fishing_reset").defaultNow(),
  dailyPetFeedGain: integer("daily_pet_feed_gain").notNull().default(0),
  lastPetFeedReset: timestamp("last_pet_feed_reset").defaultNow(),
  equippedRaceActive: text("equipped_race_active"),
  equippedRacePassive: text("equipped_race_passive"),
  customSkillNames: jsonb("custom_skill_names").notNull().default({}).$type<Record<string, string>>(),
  mercenarySlots: integer("mercenary_slots").notNull().default(1),
  unityCoins: bigint("unity_coins", { mode: "number" }).notNull().default(0),
  // T039: Shard System - per-race tracking for Convergence War
  humanShards: integer("human_shards").notNull().default(0),
  elfShards: integer("elf_shards").notNull().default(0),
  dwarfShards: integer("dwarf_shards").notNull().default(0),
  orcShards: integer("orc_shards").notNull().default(0),
  beastfolkShards: integer("beastfolk_shards").notNull().default(0),
  mysticShardsCount: integer("mystic_shards_count").notNull().default(0), // Renamed from mysticShards to avoid collision
  faeShards: integer("fae_shards").notNull().default(0),
  elementalShards: integer("elemental_shards").notNull().default(0),
  undeadShards: integer("undead_shards").notNull().default(0),
  demonShards: integer("demon_shards").notNull().default(0),
  draconicShards: integer("draconic_shards").notNull().default(0),
  celestialShards: integer("celestial_shards").notNull().default(0),
  aquaticShards: integer("aquatic_shards").notNull().default(0),
  titanShards: integer("titan_shards").notNull().default(0),
  unlockedRecipes: text("unlocked_recipes").array().default(sql`ARRAY[]::text[]`),
});

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  resultItemId: text("result_item_id").notNull(),
  tier: text("tier").notNull().$type<ItemTier>(),
  requiredRank: text("required_rank").notNull().$type<PlayerRank>(),
  ingredients: jsonb("ingredients").notNull().$type<{itemId: string; quantity: number}[]>(),
  goldCost: integer("gold_cost").notNull().default(0),
  description: text("description"),
});

export const shardTypes = ["human", "elf", "dwarf", "orc", "beastfolk", "mystic", "fae", "elemental", "undead", "demon", "draconic", "celestial", "aquatic", "titan"] as const;
export type ShardType = typeof shardTypes[number];

export const shards = pgTable("shards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shardType: text("shard_type").notNull().$type<ShardType>(),
  ownerId: varchar("owner_id").references(() => accounts.id), // null if in guild storage
  guildId: varchar("guild_id").references(() => guilds.id), // null if in player inventory
  isPhysical: boolean("is_physical").notNull().default(true),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  zone: text("zone").notNull(),
});

export const shardsRelations = relations(shards, ({ one }) => ({
  owner: one(accounts, {
    fields: [shards.ownerId],
    references: [accounts.id],
  }),
  guild: one(guilds, {
    fields: [shards.guildId],
    references: [guilds.id],
  }),
}));

export const insertShardSchema = createInsertSchema(shards).omit({ id: true, collectedAt: true });
export type Shard = typeof shards.$inferSelect;


export const guilds = pgTable("guilds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  masterId: varchar("master_id").notNull().references(() => accounts.id),
  bank: jsonb("bank").notNull().default({ gold: 0, rubies: 0, soulShards: 0, focusedShards: 0, runes: 0, trainingPoints: 0 }).$type<GuildBank>(),
  dungeonFloor: integer("dungeon_floor").notNull().default(1),
  dungeonLevel: integer("dungeon_level").notNull().default(1),
  unityCoins: bigint("unity_coins", { mode: "number" }).notNull().default(0),
  dungeonsCompleted: integer("dungeons_completed").notNull().default(0),
  guildBuffs: jsonb("guild_buffs").notNull().default([]).$type<GuildBuff[]>(),
  wins: integer("wins").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  experience: bigint("experience", { mode: "number" }).notNull().default(0),
});

export const guildQuests = pgTable("guild_quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").references(() => guilds.id, { onDelete: "cascade" }), // null for global templates or admin created
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().$type<"gather" | "dungeon" | "pvp" | "slay">(),
  targetAmount: integer("target_amount").notNull(),
  currentAmount: integer("current_amount").notNull().default(0),
  rewardUnityCoins: integer("reward_unity_coins").notNull().default(0),
  rewardGold: integer("reward_gold").notNull().default(0),
  rewardGuildExp: integer("reward_guild_exp").notNull().default(0),
  status: text("status").notNull().default("active").$type<"active" | "completed" | "expired">(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildQuestContributions = pgTable("guild_quest_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questId: varchar("quest_id").notNull().references(() => guildQuests.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const guildQuestsRelations = relations(guildQuests, ({ one, many }) => ({
  guild: one(guilds, {
    fields: [guildQuests.guildId],
    references: [guilds.id],
  }),
  contributions: many(guildQuestContributions),
}));

export const guildQuestContributionsRelations = relations(guildQuestContributions, ({ one }) => ({
  quest: one(guildQuests, {
    fields: [guildQuestContributions.questId],
    references: [guildQuests.id],
  }),
  account: one(accounts, {
    fields: [guildQuestContributions.accountId],
    references: [accounts.id],
  }),
}));

export const insertGuildQuestSchema = createInsertSchema(guildQuests).omit({ id: true, createdAt: true });
export type GuildQuest = typeof guildQuests.$inferSelect;
export const insertGuildQuestContributionSchema = createInsertSchema(guildQuestContributions).omit({ id: true, updatedAt: true });
export type GuildQuestContribution = typeof guildQuestContributions.$inferSelect;

export const worldBosses = pgTable("world_bosses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rank: text("rank").notNull().$type<PlayerRank>(),
  hp: bigint("hp", { mode: "number" }).notNull(),
  maxHp: bigint("max_hp", { mode: "number" }).notNull(),
  stats: jsonb("stats").notNull().$type<PlayerStats>(),
  elements: text("elements").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("active"),
  spawnedAt: timestamp("spawned_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  defeatedAt: timestamp("defeated_at"),
  location: text("location").notNull().default("World"),
});

export const worldBossDamage = pgTable("world_boss_damage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bossId: varchar("boss_id").notNull().references(() => worldBosses.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  damage: bigint("damage", { mode: "number" }).notNull().default(0),
  lastHitAt: timestamp("last_hit_at").notNull().defaultNow(),
});

export const worldBossesRelations = relations(worldBosses, ({ many }) => ({
  damageContributors: many(worldBossDamage),
}));

export const worldBossDamageRelations = relations(worldBossDamage, ({ one }) => ({
  boss: one(worldBosses, {
    fields: [worldBossDamage.bossId],
    references: [worldBosses.id],
  }),
  account: one(accounts, {
    fields: [worldBossDamage.accountId],
    references: [accounts.id],
  }),
}));

export const insertWorldBossSchema = createInsertSchema(worldBosses).omit({ id: true, spawnedAt: true });
export type WorldBoss = typeof worldBosses.$inferSelect;
export const insertWorldBossDamageSchema = createInsertSchema(worldBossDamage).omit({ id: true, lastHitAt: true });
export type WorldBossDamage = typeof worldBossDamage.$inferSelect;

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  itemId: text("item_id").notNull(),
  stats: jsonb("stats").notNull().default({}).$type<Partial<Stats>>(),
  durability: integer("durability").notNull().default(100),
  maxDurability: integer("max_durability").notNull().default(100),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  sockets: integer("sockets").notNull().default(0),
  gems: jsonb("gems").notNull().default([]).$type<{id: string; stats: Partial<Stats>}[]>(),
});

export const tournamentBetting = pgTable("tournament_betting", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: text("tournament_id").notNull(),
  matchId: integer("match_id").notNull(), // Index in the brackets match array
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  betAmount: integer("bet_amount").notNull(),
  predictedWinner: text("predicted_winner").notNull(), // Username or ID of the player predicted to win
  odds: text("odds").notNull(), // Store as string to handle precision if needed, e.g. "1.5"
  status: text("status").notNull().default("pending").$type<"pending" | "won" | "lost" | "cancelled">(),
  payout: integer("payout").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentBettingRelations = relations(tournamentBetting, ({ one }) => ({
  account: one(accounts, {
    fields: [tournamentBetting.accountId],
    references: [accounts.id],
  }),
}));

export const insertTournamentBettingSchema = createInsertSchema(tournamentBetting).omit({ id: true, createdAt: true });
export type InsertTournamentBetting = z.infer<typeof insertTournamentBettingSchema>;
export type TournamentBetting = typeof tournamentBetting.$inferSelect;

export const accountsRelations = relations(accounts, ({ many }) => ({
  inventory: many(inventoryItems),
  bets: many(tournamentBetting),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  account: one(accounts, {
    fields: [inventoryItems.accountId],
    references: [accounts.id],
  }),
}));

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull().references(() => accounts.id),
});

export const eventRegistrations = pgTable("event_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  isAutoRegistered: boolean("is_auto_registered").notNull().default(false),
});

export const eventsRelations = relations(events, ({ many, one }) => ({
  registrations: many(eventRegistrations),
  creator: one(accounts, {
    fields: [events.createdBy],
    references: [accounts.id],
  }),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
  account: one(accounts, {
    fields: [eventRegistrations.accountId],
    references: [accounts.id],
  }),
}));

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export const insertEventRegistrationSchema = createInsertSchema(eventRegistrations).omit({ id: true, registeredAt: true });
export type InsertEventRegistration = z.infer<typeof insertEventRegistrationSchema>;
export type EventRegistration = typeof eventRegistrations.$inferSelect;

export const challengeStatuses = ["pending", "accepted", "declined", "completed", "cancelled"] as const;
export type ChallengeStatus = typeof challengeStatuses[number];

export const petTiers = ["egg", "baby", "teen", "adult", "legend", "mythic"] as const;
export type PetTier = typeof petTiers[number];

export const petElements = ["Fire", "Water", "Earth", "Air", "Lightning", "Ice", "Nature", "Dark", "Light", "Arcana", "Chrono", "Plasma", "Void", "Aether", "Hybrid", "Elemental Convergence", "Time", "Space", "Soul", "Mind"] as const;
export type PetElement = typeof petElements[number];

export const petStatsSchema = z.object({
  Str: z.number().default(1),
  Spd: z.number().default(1),
  Luck: z.number().default(1),
  ElementalPower: z.number().default(1),
});

export type PetStats = z.infer<typeof petStatsSchema>;

export const petTierConfig = {
  egg: { maxExp: 100, evolutionCost: 10000, statMultiplier: 1 },
  baby: { maxExp: 500, evolutionCost: 50000, statMultiplier: 2 },
  teen: { maxExp: 2500, evolutionCost: 250000, statMultiplier: 4 },
  adult: { maxExp: 10000, evolutionCost: 1000000, statMultiplier: 8 },
  legend: { maxExp: 100000, evolutionCost: 100000000, statMultiplier: 16 },
  mythic: { maxExp: null, evolutionCost: null, statMultiplier: 32 },
} as const;

export const petPersonalities = ["loyal", "playful", "fierce", "calm", "mysterious"] as const;
export type PetPersonality = typeof petPersonalities[number];

export const pets = pgTable("pets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  element: text("element").notNull().$type<PetElement>().default("Fire"),
  elements: text("elements").array().$type<PetElement[]>().default(sql`ARRAY['Fire']::text[]`),
  tier: text("tier").notNull().$type<PetTier>().default("egg"),
  exp: integer("exp").notNull().default(0),
  stats: jsonb("stats").notNull().default({ Str: 1, Spd: 1, Luck: 1, ElementalPower: 1 }).$type<PetStats>(),
  bondLevel: integer("bond_level").notNull().default(0),
  rebirthCount: integer("rebirth_count").notNull().default(0),
  personality: text("personality").$type<PetPersonality>().default("loyal"),
  skin: text("skin").default("default"),
  isFainted: boolean("is_fainted").notNull().default(false),
  mutationTrait: text("mutation_trait"),
  tempElement: text("temp_element"),
  tempElementExpires: timestamp("temp_element_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  mercenaryUntil: timestamp("mercenary_until"),
  mercenaryRewardGold: integer("mercenary_reward_gold").default(0),
});

export const petsRelations = relations(pets, ({ one }) => ({
  account: one(accounts, {
    fields: [pets.accountId],
    references: [accounts.id],
  }),
}));

export const insertPetSchema = createInsertSchema(pets).omit({ id: true, createdAt: true });
export type InsertPet = z.infer<typeof insertPetSchema>;
export type Pet = typeof pets.$inferSelect;

// Birds - companion creatures that provide defense stats, cost focus shards
export const birdTiers = ["egg", "hatchling", "adolescent", "adult", "elder", "legend", "immortal"] as const;
export type BirdTier = typeof birdTiers[number];

export const birdStatsSchema = z.object({
  Def: z.number().default(1),
  Spd: z.number().default(1),
  resourceLuck: z.number().default(0),
  carryBoost: z.number().default(0),
});
export type BirdStats = z.infer<typeof birdStatsSchema>;

export const BIRD_EVOLUTION_CONFIG: Record<BirdTier, {
  statMultiplier: number;
  evolutionCost: { focusShards: number; beakCoins: number } | null;
  buffCaps: { Def: number; Spd: number; resourceLuck: number; carryBoost: number };
}> = {
  egg:        { statMultiplier: 1,  evolutionCost: { focusShards: 50,   beakCoins: 100 },   buffCaps: { Def: 5, Spd: 5, resourceLuck: 2, carryBoost: 2 } },
  hatchling:  { statMultiplier: 2,  evolutionCost: { focusShards: 150,  beakCoins: 300 },   buffCaps: { Def: 10, Spd: 10, resourceLuck: 5, carryBoost: 5 } },
  adolescent: { statMultiplier: 4,  evolutionCost: { focusShards: 400,  beakCoins: 800 },   buffCaps: { Def: 20, Spd: 20, resourceLuck: 10, carryBoost: 10 } },
  adult:      { statMultiplier: 8,  evolutionCost: { focusShards: 1000, beakCoins: 2000 },  buffCaps: { Def: 35, Spd: 35, resourceLuck: 18, carryBoost: 18 } },
  elder:      { statMultiplier: 12, evolutionCost: { focusShards: 2500, beakCoins: 5000 },  buffCaps: { Def: 50, Spd: 50, resourceLuck: 30, carryBoost: 30 } },
  legend:     { statMultiplier: 18, evolutionCost: { focusShards: 5000, beakCoins: 10000 }, buffCaps: { Def: 75, Spd: 75, resourceLuck: 40, carryBoost: 40 } },
  immortal:   { statMultiplier: 25, evolutionCost: null,                                     buffCaps: { Def: 100, Spd: 100, resourceLuck: 50, carryBoost: 50 } },
};

export function getNextBirdTier(currentTier: BirdTier): BirdTier | null {
  const idx = birdTiers.indexOf(currentTier);
  if (idx < 0 || idx >= birdTiers.length - 1) return null;
  return birdTiers[idx + 1];
}

export function calculateBirdBuffs(stats: BirdStats, tier: BirdTier): { Def: number; Spd: number; resourceLuck: number; carryBoost: number } {
  const config = BIRD_EVOLUTION_CONFIG[tier];
  const caps = config.buffCaps;
  return {
    Def: Math.min(stats.Def, caps.Def),
    Spd: Math.min(stats.Spd, caps.Spd),
    resourceLuck: Math.min(stats.resourceLuck || 0, caps.resourceLuck),
    carryBoost: Math.min(stats.carryBoost || 0, caps.carryBoost),
  };
}

export function calculateConvergence(raceElement?: string, petElement?: string, birdElement?: string): {
  initiativeBonus: number;
  defenseBonus: number;
  tripleBonus: number;
  description: string[];
} {
  const result = { initiativeBonus: 0, defenseBonus: 0, tripleBonus: 0, description: [] as string[] };
  if (!raceElement || !birdElement) return result;

  const raceBirdMatch = raceElement === birdElement;
  const petBirdMatch = petElement && petElement === birdElement;
  const tripleMatch = raceBirdMatch && petBirdMatch;

  if (tripleMatch) {
    result.tripleBonus = 20;
    result.description.push(`Triple Convergence (Race+Pet+Bird: ${raceElement}): +20% all combat stats`);
  } else {
    if (raceBirdMatch) {
      result.initiativeBonus = 10;
      result.description.push(`Race↔Bird Convergence (${raceElement}): +10% initiative`);
    }
    if (petBirdMatch) {
      result.defenseBonus = 10;
      result.description.push(`Pet↔Bird Convergence (${birdElement}): +10% defense`);
    }
  }
  return result;
}

export const birds = pgTable("birds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tier: text("tier").notNull().$type<BirdTier>().default("egg"),
  element: text("element").default("Air"),
  exp: integer("exp").notNull().default(0),
  stats: jsonb("stats").notNull().default({ Def: 1, Spd: 1, resourceLuck: 0, carryBoost: 0 }).$type<BirdStats>(),
  skin: text("skin").default("default"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const birdsRelations = relations(birds, ({ one }) => ({
  account: one(accounts, {
    fields: [birds.accountId],
    references: [accounts.id],
  }),
}));

export const insertBirdSchema = createInsertSchema(birds).omit({ id: true, createdAt: true });
export type InsertBird = z.infer<typeof insertBirdSchema>;
export type Bird = typeof birds.$inferSelect;

// Fish - creatures that can be fed to pets to transfer stats and elements
export const fishRarities = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export type FishRarity = typeof fishRarities[number];

export const DAILY_CATCH_LIMIT_BY_RANK: Record<string, number> = {
  "Novice": 10,
  "Apprentice": 11,
  "Initiate": 12,
  "Journeyman": 14,
  "Adept": 16,
  "Expert": 18,
  "Master": 20,
  "Grandmaster": 22,
  "Champion": 24,
  "Overlord": 26,
  "Sovereign": 28,
  "Ascendant": 30,
  "Legend": 32,
  "Mythic": 36,
  "Mythical Legend": 40,
};

export const PET_FEED_CAP_BY_RANK: Record<string, number> = {
  "Novice": 5,
  "Apprentice": 10,
  "Initiate": 15,
  "Journeyman": 20,
  "Adept": 25,
  "Expert": 30,
  "Master": 35,
  "Grandmaster": 40,
  "Champion": 45,
  "Overlord": 50,
  "Sovereign": 55,
  "Ascendant": 60,
  "Legend": 65,
  "Mythic": 70,
  "Mythical Legend": 75,
};

export const FISHING_RODS: { rank: string; name: string; luckBonus: number; rarityMultiplier: number }[] = [
  { rank: "Novice", name: "Wooden Rod", luckBonus: 0, rarityMultiplier: 1.0 },
  { rank: "Apprentice", name: "Bamboo Rod", luckBonus: 2, rarityMultiplier: 1.05 },
  { rank: "Initiate", name: "Iron Rod", luckBonus: 4, rarityMultiplier: 1.1 },
  { rank: "Journeyman", name: "Steel Rod", luckBonus: 6, rarityMultiplier: 1.15 },
  { rank: "Adept", name: "Silver Rod", luckBonus: 8, rarityMultiplier: 1.2 },
  { rank: "Expert", name: "Mithril Rod", luckBonus: 10, rarityMultiplier: 1.25 },
  { rank: "Master", name: "Enchanted Rod", luckBonus: 13, rarityMultiplier: 1.3 },
  { rank: "Grandmaster", name: "Runic Rod", luckBonus: 16, rarityMultiplier: 1.35 },
  { rank: "Champion", name: "Crystal Rod", luckBonus: 19, rarityMultiplier: 1.4 },
  { rank: "Overlord", name: "Aether Rod", luckBonus: 22, rarityMultiplier: 1.45 },
  { rank: "Sovereign", name: "Void Rod", luckBonus: 25, rarityMultiplier: 1.5 },
  { rank: "Ascendant", name: "Soul Rod", luckBonus: 28, rarityMultiplier: 1.55 },
  { rank: "Legend", name: "Legendary Rod", luckBonus: 32, rarityMultiplier: 1.6 },
  { rank: "Mythic", name: "Mythic Rod", luckBonus: 36, rarityMultiplier: 1.7 },
  { rank: "Mythical Legend", name: "Eternal Rod", luckBonus: 40, rarityMultiplier: 1.8 },
];

export function getRodForRank(rank: string): typeof FISHING_RODS[number] {
  const rankIndex = playerRanks.indexOf(rank as any);
  if (rankIndex < 0) return FISHING_RODS[0];
  const rodIndex = Math.min(rankIndex, FISHING_RODS.length - 1);
  return FISHING_RODS[rodIndex];
}

export const FISH_SELL_PRICES: Record<string, number> = {
  common: 50,
  uncommon: 100,
  rare: 250,
  epic: 500,
  legendary: 1000,
  mythic: 2500,
};

export const FISH_PET_STAT_GAIN: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 7,
};

export const fishStatsSchema = z.object({
  Str: z.number().default(0),
  Spd: z.number().default(0),
  Luck: z.number().default(0),
  ElementalPower: z.number().default(0),
});
export type FishStats = z.infer<typeof fishStatsSchema>;

export const fish = pgTable("fish", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rarity: text("rarity").notNull().$type<FishRarity>().default("common"),
  element: text("element").$type<PetElement>(),
  stats: jsonb("stats").notNull().default({ Str: 0, Spd: 0, Luck: 0, ElementalPower: 0 }).$type<FishStats>(),
  caughtAt: timestamp("caught_at").notNull().defaultNow(),
});

export const fishRelations = relations(fish, ({ one }) => ({
  account: one(accounts, {
    fields: [fish.accountId],
    references: [accounts.id],
  }),
}));

export const insertFishSchema = createInsertSchema(fish).omit({ id: true, caughtAt: true });
export type InsertFish = z.infer<typeof insertFishSchema>;
export type Fish = typeof fish.$inferSelect;

export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  challengedId: varchar("challenged_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<ChallengeStatus>().default("pending"),
  winnerId: varchar("winner_id").references(() => accounts.id),
  combatState: jsonb("combat_state"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
});

export const challengesRelations = relations(challenges, ({ one }) => ({
  challenger: one(accounts, {
    fields: [challenges.challengerId],
    references: [accounts.id],
    relationName: "challenger",
  }),
  challenged: one(accounts, {
    fields: [challenges.challengedId],
    references: [accounts.id],
    relationName: "challenged",
  }),
  winner: one(accounts, {
    fields: [challenges.winnerId],
    references: [accounts.id],
    relationName: "winner",
  }),
}));

export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true, createdAt: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

export type User = Account;
export type InsertUser = InsertAccount;

// Leaderboard cache - stores aggregated leaderboard data that refreshes every 24 hours
export const leaderboardCache = pgTable("leaderboard_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'wins', 'losses', 'npc_progress', 'rank'
  data: jsonb("data").notNull().$type<LeaderboardEntry[]>(),
  refreshedAt: timestamp("refreshed_at").notNull().defaultNow(),
});

export type LeaderboardEntry = {
  accountId: string;
  username: string;
  value: number | string;
  rank?: number;
  npcFloor?: number;
  npcLevel?: number;
};

export type LeaderboardCache = typeof leaderboardCache.$inferSelect;

// Quests system
export const questStatuses = ["active", "completed", "expired"] as const;
export type QuestStatus = typeof questStatuses[number];

export const questAssignmentStatuses = ["pending", "accepted", "completed", "rewarded"] as const;
export type QuestAssignmentStatus = typeof questAssignmentStatuses[number];

export const quests = pgTable("quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rewards: jsonb("rewards").notNull().$type<QuestRewards>(),
  status: text("status").notNull().$type<QuestStatus>().default("active"),
  createdBy: varchar("created_by").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type QuestRewards = {
  gold?: number;
  rubies?: number;
  soulShards?: number;
  focusedShards?: number;
  trainingPoints?: number;
  runes?: number;
  petExp?: number;
};

export const questAssignments = pgTable("quest_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questId: varchar("quest_id").notNull().references(() => quests.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<QuestAssignmentStatus>().default("pending"),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
  rewardedAt: timestamp("rewarded_at"),
});

export const questsRelations = relations(quests, ({ one, many }) => ({
  createdByAccount: one(accounts, {
    fields: [quests.createdBy],
    references: [accounts.id],
  }),
  assignments: many(questAssignments),
}));

export const questAssignmentsRelations = relations(questAssignments, ({ one }) => ({
  quest: one(quests, {
    fields: [questAssignments.questId],
    references: [quests.id],
  }),
  account: one(accounts, {
    fields: [questAssignments.accountId],
    references: [accounts.id],
  }),
}));

export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, createdAt: true });
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof quests.$inferSelect;

export const insertQuestAssignmentSchema = createInsertSchema(questAssignments).omit({ id: true });
export type InsertQuestAssignment = z.infer<typeof insertQuestAssignmentSchema>;
export type QuestAssignment = typeof questAssignments.$inferSelect;

// Guild system
export const guildBankSchema = z.object({
  gold: z.number().default(0),
  rubies: z.number().default(0),
  soulShards: z.number().default(0),
  focusedShards: z.number().default(0),
  runes: z.number().default(0),
  trainingPoints: z.number().default(0),
});

export type GuildBank = z.infer<typeof guildBankSchema>;

export interface GuildBuff {
  id: string;
  name: string;
  stat: string;
  bonusPercent: number;
  expiresAt: string;
  fromDungeon: number;
}

export const GUILD_DUNGEON_TIERS = [
  {
    tier: 1,
    name: "Shadowed Crypt",
    description: "A dark underground crypt filled with restless undead.",
    unlockRequirement: { guildLevel: 3, previousDungeon: 0 },
    difficultyMultiplier: 1.0,
    rewards: { unityCoins: 50, gold: 500000, shards: 0, label: "Unity Coins, Common Resources" },
    buff: { name: "Crypt Fortitude", stat: "Def", bonusPercent: 5 },
  },
  {
    tier: 2,
    name: "Infernal Mines",
    description: "Molten caverns where fire elementals guard rare ores.",
    unlockRequirement: { guildLevel: 6, previousDungeon: 1 },
    difficultyMultiplier: 2.0,
    rewards: { unityCoins: 120, gold: 2000000, shards: 5, label: "Better Resources, Rare Shards" },
    buff: { name: "Infernal Might", stat: "Str", bonusPercent: 8 },
  },
  {
    tier: 3,
    name: "Abyssal Sanctum",
    description: "An ancient sanctum lost between dimensions.",
    unlockRequirement: { guildLevel: 8, previousDungeon: 2 },
    difficultyMultiplier: 3.5,
    rewards: { unityCoins: 250, gold: 5000000, shards: 15, label: "Higher-tier crafted items" },
    buff: { name: "Abyssal Insight", stat: "Int", bonusPercent: 10 },
  },
  {
    tier: 4,
    name: "Draconic Spire",
    description: "A towering fortress ruled by an elder dragon.",
    unlockRequirement: { guildLevel: 10, previousDungeon: 3 },
    difficultyMultiplier: 5.0,
    rewards: { unityCoins: 500, gold: 15000000, shards: 30, label: "Epic Shards / Exclusive materials" },
    buff: { name: "Draconic Fury", stat: "Spd", bonusPercent: 12 },
  },
  {
    tier: 5,
    name: "Convergence Nexus",
    description: "The ultimate guild trial at the heart of elemental convergence.",
    unlockRequirement: { guildLevel: 10, previousDungeon: 4 },
    difficultyMultiplier: 8.0,
    rewards: { unityCoins: 1000, gold: 50000000, shards: 50, label: "Mythic-tier items, Shard fragments" },
    buff: { name: "Nexus Convergence", stat: "all", bonusPercent: 15 },
  },
] as const;

export type GuildDungeonTier = typeof GUILD_DUNGEON_TIERS[number];

export const GUILD_PERKS: Record<number, { name: string; description: string }> = {
  1: { name: "Basic Guild Storage", description: "Access to guild resource and weapon storage." },
  2: { name: "Guild Shop Access", description: "Buy weapons, items, and skins with Unity Coins." },
  3: { name: "Dungeon Level 1 Unlock", description: "Access the Shadowed Crypt guild dungeon." },
  4: { name: "+10% XP Gain", description: "All members gain +10% XP in guild zones." },
  5: { name: "Guild Chat Global", description: "Guild chat accessible from anywhere." },
  6: { name: "Dungeon Level 2 Unlock", description: "Access the Infernal Mines guild dungeon." },
  7: { name: "+20% Storage Efficiency", description: "Guild storage capacity increased by 20%." },
  8: { name: "Dungeon Level 3 Unlock", description: "Access the Abyssal Sanctum guild dungeon." },
  9: { name: "Guild Title", description: "Members can equip a guild title." },
  10: { name: "Dungeon Level 4 & 5 Unlock", description: "Access the Draconic Spire and Convergence Nexus." },
};

export const guildChat = pgTable("guild_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => accounts.id),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildRoles = ["leader", "officer", "member"] as const;
export type GuildRole = typeof guildRoles[number];

export const guildMembers = pgTable("guild_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  role: text("role").notNull().$type<GuildRole>().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const guildVaultLogs = pgTable("guild_vault_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  playerName: text("player_name").notNull(),
  action: text("action").notNull(),
  resource: text("resource"),
  quantity: integer("quantity"),
  itemId: text("item_id"),
  itemName: text("item_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildVaultLogsRelations = relations(guildVaultLogs, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildVaultLogs.guildId],
    references: [guilds.id],
  }),
  account: one(accounts, {
    fields: [guildVaultLogs.accountId],
    references: [accounts.id],
  }),
}));

export const insertGuildVaultLogSchema = createInsertSchema(guildVaultLogs).omit({ id: true, createdAt: true });
export type InsertGuildVaultLog = z.infer<typeof insertGuildVaultLogSchema>;
export type GuildVaultLog = typeof guildVaultLogs.$inferSelect;

export const guildInvites = pgTable("guild_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  invitedBy: varchar("invited_by").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildChatRelations = relations(guildChat, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildChat.guildId],
    references: [guilds.id],
  }),
  sender: one(accounts, {
    fields: [guildChat.senderId],
    references: [accounts.id],
  }),
}));

export const guildsRelations = relations(guilds, ({ one, many }) => ({
  master: one(accounts, {
    fields: [guilds.masterId],
    references: [accounts.id],
  }),
  members: many(guildMembers),
  invites: many(guildInvites),
  chat: many(guildChat),
}));

export const insertGuildChatSchema = createInsertSchema(guildChat).omit({ id: true, createdAt: true });
export type InsertGuildChat = z.infer<typeof insertGuildChatSchema>;
export type GuildChatMessage = typeof guildChat.$inferSelect;

export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildMembers.guildId],
    references: [guilds.id],
  }),
  account: one(accounts, {
    fields: [guildMembers.accountId],
    references: [accounts.id],
  }),
}));

export const guildInvitesRelations = relations(guildInvites, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildInvites.guildId],
    references: [guilds.id],
  }),
  account: one(accounts, {
    fields: [guildInvites.accountId],
    references: [accounts.id],
  }),
  inviter: one(accounts, {
    fields: [guildInvites.invitedBy],
    references: [accounts.id],
    relationName: "inviter",
  }),
}));

export const insertGuildSchema = createInsertSchema(guilds).omit({ id: true, createdAt: true, bank: true, dungeonFloor: true, dungeonLevel: true, unityCoins: true, dungeonsCompleted: true, guildBuffs: true });
export type InsertGuild = z.infer<typeof insertGuildSchema>;
export type Guild = typeof guilds.$inferSelect;

export const insertGuildMemberSchema = createInsertSchema(guildMembers).omit({ id: true, joinedAt: true });
export type InsertGuildMember = z.infer<typeof insertGuildMemberSchema>;
export type GuildMember = typeof guildMembers.$inferSelect;

export const insertGuildInviteSchema = createInsertSchema(guildInvites).omit({ id: true, createdAt: true });
export type InsertGuildInvite = z.infer<typeof insertGuildInviteSchema>;
export type GuildInvite = typeof guildInvites.$inferSelect;

// Skill Auction System
export const skillAuctions = pgTable("skill_auctions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  skillId: text("skill_id").notNull(),
  status: text("status").notNull().default("queued"), // queued, active, completed
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  winningBidId: varchar("winning_bid_id"),
  winnerId: varchar("winner_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const skillBids = pgTable("skill_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auctionId: varchar("auction_id").notNull().references(() => skillAuctions.id, { onDelete: "cascade" }),
  bidderId: varchar("bidder_id").notNull().references(() => accounts.id),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerSkills = pgTable("player_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull(),
  isEquipped: boolean("is_equipped").notNull().default(false),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
  source: text("source").notNull().default("auction"), // auction, quest, admin
});

export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // bid_won, pet_acquired, quest_received, quest_completed, item_purchased, etc.
  accountId: varchar("account_id").references(() => accounts.id),
  accountName: text("account_name"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const skillAuctionsRelations = relations(skillAuctions, ({ many }) => ({
  bids: many(skillBids),
}));

export const skillBidsRelations = relations(skillBids, ({ one }) => ({
  auction: one(skillAuctions, {
    fields: [skillBids.auctionId],
    references: [skillAuctions.id],
  }),
  bidder: one(accounts, {
    fields: [skillBids.bidderId],
    references: [accounts.id],
  }),
}));

export const playerSkillsRelations = relations(playerSkills, ({ one }) => ({
  account: one(accounts, {
    fields: [playerSkills.accountId],
    references: [accounts.id],
  }),
}));

export const insertSkillAuctionSchema = createInsertSchema(skillAuctions).omit({ id: true, createdAt: true });
export type InsertSkillAuction = z.infer<typeof insertSkillAuctionSchema>;
export type SkillAuction = typeof skillAuctions.$inferSelect;

export const insertSkillBidSchema = createInsertSchema(skillBids).omit({ id: true, createdAt: true });
export type InsertSkillBid = z.infer<typeof insertSkillBidSchema>;
export type SkillBid = typeof skillBids.$inferSelect;

export const insertPlayerSkillSchema = createInsertSchema(playerSkills).omit({ id: true, acquiredAt: true });
export type InsertPlayerSkill = z.infer<typeof insertPlayerSkillSchema>;
export type PlayerSkill = typeof playerSkills.$inferSelect;

export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ id: true, createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type ActivityFeed = typeof activityFeed.$inferSelect;

// Guild Battles (Guild vs Guild)
export const guildBattleStatuses = ["pending", "accepted", "in_progress", "completed", "declined"] as const;
export type GuildBattleStatus = typeof guildBattleStatuses[number];

export const guildBattles = pgTable("guild_battles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerGuildId: varchar("challenger_guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  challengedGuildId: varchar("challenged_guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<GuildBattleStatus>().default("pending"),
  challengerFighters: jsonb("challenger_fighters").notNull().default([]).$type<string[]>(),
  challengedFighters: jsonb("challenged_fighters").notNull().default([]).$type<string[]>(),
  currentRound: integer("current_round").notNull().default(0),
  challengerScore: integer("challenger_score").notNull().default(0),
  challengedScore: integer("challenged_score").notNull().default(0),
  challengerCurrentIndex: integer("challenger_current_index").notNull().default(0),
  challengedCurrentIndex: integer("challenged_current_index").notNull().default(0),
  winnerId: varchar("winner_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const guildBattlesRelations = relations(guildBattles, ({ one }) => ({
  challengerGuild: one(guilds, {
    fields: [guildBattles.challengerGuildId],
    references: [guilds.id],
    relationName: "challengerGuild",
  }),
  challengedGuild: one(guilds, {
    fields: [guildBattles.challengedGuildId],
    references: [guilds.id],
    relationName: "challengedGuild",
  }),
}));

export const insertGuildBattleSchema = createInsertSchema(guildBattles).omit({ id: true, createdAt: true });
export type InsertGuildBattle = z.infer<typeof insertGuildBattleSchema>;
export type GuildBattle = typeof guildBattles.$inferSelect;

// ==================== AUCTION HOUSE EXPANSION ====================
export const auctionTypes = ["gold", "vip"] as const;
export type AuctionType = typeof auctionTypes[number];

export const auctionItemTypes = ["item", "skill"] as const;
export type AuctionItemType = typeof auctionItemTypes[number];

export const auctions = pgTable("auctions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => accounts.id), // null if admin/system
  type: text("type").notNull().$type<AuctionType>().default("gold"),
  itemType: text("item_type").notNull().$type<AuctionItemType>().default("item"),
  itemId: text("item_id").notNull(), // refId for inventory item or skill ID
  startingPrice: integer("starting_price").notNull(),
  minIncrement: integer("min_increment").notNull().default(1), // percentage (1-5%)
  currentBid: integer("current_bid").notNull().default(0),
  highestBidderId: varchar("highest_bidder_id").references(() => accounts.id),
  status: text("status").notNull().default("active"), // active, completed, cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endAt: timestamp("end_at").notNull(),
});

export const auctionBids = pgTable("auction_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auctionId: varchar("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  bidderId: varchar("bidder_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  isAutoBid: boolean("is_auto_bid").notNull().default(false),
  maxAutoBid: integer("max_auto_bid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  seller: one(accounts, {
    fields: [auctions.sellerId],
    references: [accounts.id],
    relationName: "seller",
  }),
  highestBidder: one(accounts, {
    fields: [auctions.highestBidderId],
    references: [accounts.id],
    relationName: "highestBidder",
  }),
  bids: many(auctionBids),
}));

export const auctionBidsRelations = relations(auctionBids, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionBids.auctionId],
    references: [auctions.id],
  }),
  bidder: one(accounts, {
    fields: [auctionBids.bidderId],
    references: [accounts.id],
  }),
}));

export const insertAuctionSchema = createInsertSchema(auctions).omit({ id: true, createdAt: true });
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
export type Auction = typeof auctions.$inferSelect;

export const insertAuctionBidSchema = createInsertSchema(auctionBids).omit({ id: true, createdAt: true });
export type InsertAuctionBid = z.infer<typeof insertAuctionBidSchema>;
export type AuctionBid = typeof auctionBids.$inferSelect;

// ==================== PET PVP BATTLES (3v3) ====================
export const petBattleStatuses = ["pending", "accepted", "in_progress", "completed", "declined"] as const;
export type PetBattleStatus = typeof petBattleStatuses[number];

export const petBattles = pgTable("pet_battles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  challengedId: varchar("challenged_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<PetBattleStatus>().default("pending"),
  challengerPets: text("challenger_pets").array().notNull().default(sql`ARRAY[]::text[]`),
  challengedPets: text("challenged_pets").array().notNull().default(sql`ARRAY[]::text[]`),
  currentRound: integer("current_round").notNull().default(1),
  challengerWins: integer("challenger_wins").notNull().default(0),
  challengedWins: integer("challenged_wins").notNull().default(0),
  winnerId: varchar("winner_id"),
  goldWager: integer("gold_wager").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const petBattlesRelations = relations(petBattles, ({ one }) => ({
  challenger: one(accounts, {
    fields: [petBattles.challengerId],
    references: [accounts.id],
    relationName: "challenger",
  }),
  challenged: one(accounts, {
    fields: [petBattles.challengedId],
    references: [accounts.id],
    relationName: "challenged",
  }),
}));

export const insertPetBattleSchema = createInsertSchema(petBattles).omit({ id: true, createdAt: true });
export type InsertPetBattle = z.infer<typeof insertPetBattleSchema>;
export type PetBattle = typeof petBattles.$inferSelect;

// ==================== PLAYER TRADING SYSTEM ====================
export const tradeStatuses = ["pending", "accepted", "completed", "cancelled", "expired"] as const;
export type TradeStatus = typeof tradeStatuses[number];

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  initiatorId: varchar("initiator_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<TradeStatus>().default("pending"),
  initiatorAccepted: boolean("initiator_accepted").notNull().default(false),
  recipientAccepted: boolean("recipient_accepted").notNull().default(false),
  timeLockUntil: timestamp("time_lock_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const tradeItems = pgTable("trade_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull().references(() => accounts.id),
  type: text("type").notNull().$type<"item" | "skill">(),
  refId: varchar("ref_id").notNull(), // inventory item id or player skill id
});

export const tradesRelations = relations(trades, ({ one, many }) => ({
  initiator: one(accounts, {
    fields: [trades.initiatorId],
    references: [accounts.id],
    relationName: "initiator",
  }),
  recipient: one(accounts, {
    fields: [trades.recipientId],
    references: [accounts.id],
    relationName: "recipient",
  }),
  items: many(tradeItems),
}));

export const tradeItemsRelations = relations(tradeItems, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeItems.tradeId],
    references: [trades.id],
  }),
  owner: one(accounts, {
    fields: [tradeItems.ownerId],
    references: [accounts.id],
  }),
}));

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export const insertTradeItemSchema = createInsertSchema(tradeItems).omit({ id: true });
export type InsertTradeItem = z.infer<typeof insertTradeItemSchema>;
export type TradeItem = typeof tradeItems.$inferSelect;

// ==================== PET FOOD SYSTEM ====================
export const petFoodItems = [
  { id: "basic_treat", name: "Basic Treat", exp: 10, price: 100 },
  { id: "tasty_snack", name: "Tasty Snack", exp: 50, price: 400 },
  { id: "gourmet_meal", name: "Gourmet Meal", exp: 200, price: 1500 },
  { id: "royal_feast", name: "Royal Feast", exp: 1000, price: 6000 },
  { id: "mystic_elixir", name: "Mystic Elixir", exp: 5000, price: 25000 },
  { id: "dragon_essence", name: "Dragon Essence", exp: 25000, price: 100000 },
] as const;

export type PetFoodItem = typeof petFoodItems[number];

export const PET_MUTATION_TRAITS = {
  crit_boost: { name: "Critical Surge", description: "+10% crit chance in combat", critBonus: 10 },
  elemental_immunity: { name: "Elemental Ward", description: "Immune to one random element", immunityGrant: true },
  stat_redistribute: { name: "Adaptive Form", description: "Stats redistributed for higher total", statBoost: 15 },
  damage_boost: { name: "Ferocious Strike", description: "+10% damage dealt in combat", damageBonus: 10 },
  defense_aura: { name: "Iron Hide", description: "+10% defense in combat", defenseBonus: 10 },
  speed_surge: { name: "Lightning Reflexes", description: "+10% speed in combat", speedBonus: 10 },
  luck_blessing: { name: "Fortune's Favor", description: "+10% luck in combat", luckBonus: 10 },
} as const;

export type PetMutationTrait = keyof typeof PET_MUTATION_TRAITS;

export const PET_MUTATION_CHANCE = 0.15;

export const PET_COOKING_RECIPES: {
  id: string;
  name: string;
  element: string;
  requiredFishRarity: string;
  duration: number;
  cost: number;
}[] = [
  { id: "fire_infusion", name: "Fire Infusion", element: "Fire", requiredFishRarity: "rare", duration: 3600000, cost: 5000 },
  { id: "water_blessing", name: "Water Blessing", element: "Water", requiredFishRarity: "rare", duration: 3600000, cost: 5000 },
  { id: "earth_attunement", name: "Earth Attunement", element: "Earth", requiredFishRarity: "rare", duration: 3600000, cost: 5000 },
  { id: "air_channeling", name: "Air Channeling", element: "Air", requiredFishRarity: "rare", duration: 3600000, cost: 5000 },
  { id: "lightning_charge", name: "Lightning Charge", element: "Lightning", requiredFishRarity: "epic", duration: 3600000, cost: 10000 },
  { id: "ice_crystal", name: "Ice Crystal", element: "Ice", requiredFishRarity: "epic", duration: 3600000, cost: 10000 },
  { id: "nature_essence", name: "Nature Essence", element: "Nature", requiredFishRarity: "epic", duration: 3600000, cost: 10000 },
  { id: "dark_infusion", name: "Dark Infusion", element: "Dark", requiredFishRarity: "legendary", duration: 3600000, cost: 25000 },
  { id: "light_blessing", name: "Light Blessing", element: "Light", requiredFishRarity: "legendary", duration: 3600000, cost: 25000 },
  { id: "arcana_surge", name: "Arcana Surge", element: "Arcana", requiredFishRarity: "mythic", duration: 3600000, cost: 50000 },
  { id: "void_touch", name: "Void Touch", element: "Void", requiredFishRarity: "mythic", duration: 3600000, cost: 50000 },
  { id: "aether_pulse", name: "Aether Pulse", element: "Aether", requiredFishRarity: "mythic", duration: 3600000, cost: 50000 },
];

export const PET_REVIVE_CONSUMABLE_COST = 500;

// ==================== GUILD LEVEL REQUIREMENTS ====================
export const guildLevelRequirements = [
  { level: 1, minDungeonFloor: 0, minDungeonsCompleted: 0, goldCost: 0 },
  { level: 2, minDungeonFloor: 1, minDungeonsCompleted: 0, goldCost: 1_000_000_000 },
  { level: 3, minDungeonFloor: 5, minDungeonsCompleted: 0, goldCost: 2_000_000_000 },
  { level: 4, minDungeonFloor: 10, minDungeonsCompleted: 1, goldCost: 5_000_000_000 },
  { level: 5, minDungeonFloor: 15, minDungeonsCompleted: 1, goldCost: 10_000_000_000 },
  { level: 6, minDungeonFloor: 20, minDungeonsCompleted: 1, goldCost: 25_000_000_000 },
  { level: 7, minDungeonFloor: 30, minDungeonsCompleted: 2, goldCost: 50_000_000_000 },
  { level: 8, minDungeonFloor: 40, minDungeonsCompleted: 2, goldCost: 100_000_000_000 },
  { level: 9, minDungeonFloor: 50, minDungeonsCompleted: 3, goldCost: 250_000_000_000 },
  { level: 10, minDungeonFloor: 75, minDungeonsCompleted: 4, goldCost: 1_000_000_000_000 },
] as const;

export type GuildLevelRequirement = typeof guildLevelRequirements[number];

// ==================== AI CHAT SYSTEM ====================
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ==================== PLAYER AI STORYLINE SYSTEM ====================
export const playerStorylines = pgTable("player_storylines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  currentChapter: integer("current_chapter").notNull().default(1),
  currentAct: integer("current_act").notNull().default(1),
  guidePersonality: text("guide_personality").notNull().default("friendly"),
  tutorialCompleted: boolean("tutorial_completed").notNull().default(false),
  storyProgress: jsonb("story_progress").notNull().default({}).$type<Record<string, any>>(),
  conversationHistory: jsonb("conversation_history").notNull().default([]).$type<Array<{ role: string; content: string }>>(),
  pendingRewards: jsonb("pending_rewards").notNull().default([]).$type<Array<{ type: string; amount: number; reason: string }>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiAdminRequests = pgTable("ai_admin_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  requestType: text("request_type").notNull(), // 'reward', 'question', 'error'
  message: text("message").notNull(),
  aiResponse: text("ai_response"),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'answered'
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => accounts.id),
});

export const playerStorylinesRelations = relations(playerStorylines, ({ one }) => ({
  account: one(accounts, {
    fields: [playerStorylines.accountId],
    references: [accounts.id],
  }),
}));

export const aiAdminRequestsRelations = relations(aiAdminRequests, ({ one }) => ({
  account: one(accounts, {
    fields: [aiAdminRequests.accountId],
    references: [accounts.id],
  }),
  resolver: one(accounts, {
    fields: [aiAdminRequests.resolvedBy],
    references: [accounts.id],
    relationName: "resolver",
  }),
}));

export const insertPlayerStorylineSchema = createInsertSchema(playerStorylines).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayerStoryline = z.infer<typeof insertPlayerStorylineSchema>;
export type PlayerStoryline = typeof playerStorylines.$inferSelect;

export const insertAiAdminRequestSchema = createInsertSchema(aiAdminRequests).omit({ id: true, createdAt: true });
export type InsertAiAdminRequest = z.infer<typeof insertAiAdminRequestSchema>;
export type AiAdminRequest = typeof aiAdminRequests.$inferSelect;

// ==================== ACHIEVEMENTS, TITLES & BADGES ====================
export const playerAchievements = pgTable("player_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
});

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  account: one(accounts, {
    fields: [playerAchievements.accountId],
    references: [accounts.id],
  }),
}));

export const insertPlayerAchievementSchema = createInsertSchema(playerAchievements).omit({ id: true, unlockedAt: true });
export type InsertPlayerAchievement = z.infer<typeof insertPlayerAchievementSchema>;
export type PlayerAchievement = typeof playerAchievements.$inferSelect;

export const titleCategories = ["rank", "guild", "event"] as const;
export type TitleCategory = typeof titleCategories[number];

export const playerTitles = pgTable("player_titles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  titleId: text("title_id").notNull(),
  category: text("category").notNull().$type<TitleCategory>(),
  name: text("name").notNull(),
  isEquipped: boolean("is_equipped").notNull().default(false),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const playerTitlesRelations = relations(playerTitles, ({ one }) => ({
  account: one(accounts, {
    fields: [playerTitles.accountId],
    references: [accounts.id],
  }),
}));

export const insertPlayerTitleSchema = createInsertSchema(playerTitles).omit({ id: true, earnedAt: true });
export type InsertPlayerTitle = z.infer<typeof insertPlayerTitleSchema>;
export type PlayerTitle = typeof playerTitles.$inferSelect;

export const badgeTypes = ["vip", "guild", "rank"] as const;
export type BadgeType = typeof badgeTypes[number];

export const playerBadges = pgTable("player_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  badgeId: text("badge_id").notNull(),
  badgeType: text("badge_type").notNull().$type<BadgeType>(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("shield"),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const playerBadgesRelations = relations(playerBadges, ({ one }) => ({
  account: one(accounts, {
    fields: [playerBadges.accountId],
    references: [accounts.id],
  }),
}));

export const insertPlayerBadgeSchema = createInsertSchema(playerBadges).omit({ id: true, earnedAt: true });
export type InsertPlayerBadge = z.infer<typeof insertPlayerBadgeSchema>;
export type PlayerBadge = typeof playerBadges.$inferSelect;

// ==================== MONSTER SPAWNS ====================
export const monsterSpawnLog = pgTable("monster_spawn_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  zoneId: text("zone_id").notNull(),
  monsterName: text("monster_name").notNull(),
  monsterElement: text("monster_element").notNull(),
  monsterLevel: integer("monster_level").notNull(),
  isBoss: boolean("is_boss").notNull().default(false),
  source: text("source").notNull().$type<"timer" | "action">(),
  weather: text("weather").notNull(),
  defeated: boolean("defeated").notNull().default(false),
  goldReward: integer("gold_reward").notNull().default(0),
  spawnedAt: timestamp("spawned_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const monsterSpawnLogRelations = relations(monsterSpawnLog, ({ one }) => ({
  account: one(accounts, {
    fields: [monsterSpawnLog.accountId],
    references: [accounts.id],
  }),
}));

export const insertMonsterSpawnLogSchema = createInsertSchema(monsterSpawnLog).omit({ id: true, spawnedAt: true });
export type InsertMonsterSpawnLog = z.infer<typeof insertMonsterSpawnLogSchema>;
export type MonsterSpawnLog = typeof monsterSpawnLog.$inferSelect;

// ==================== ZONE DUNGEONS (One per Zone) ====================
export interface ZoneDungeonMonster {
  name: string;
  element: string;
  baseStats: { Str: number; Def: number; Spd: number; Int: number; Luck: number };
  hpMultiplier: number;
  isBoss: boolean;
}

export interface ZoneDungeonReward {
  gold: number;
  trainingPoints: number;
  soulShards: number;
  xp: number;
  rareItemChance: number;
  rareItemId?: string;
}

export interface ZoneDungeonConfig {
  zoneId: string;
  name: string;
  theme: string;
  description: string;
  floors: number;
  minRank: string;
  monsters: ZoneDungeonMonster[];
  boss: ZoneDungeonMonster;
  floorRewards: ZoneDungeonReward;
  completionRewards: ZoneDungeonReward;
}

export const ZONE_DUNGEON_CONFIGS: ZoneDungeonConfig[] = [
  {
    zoneId: "capital_city",
    name: "The Sewers of Valorheim",
    theme: "underground",
    description: "Dark tunnels beneath the capital, infested with vermin and forgotten experiments.",
    floors: 3,
    minRank: "Novice",
    monsters: [
      { name: "Sewer Rat King", element: "Earth", baseStats: { Str: 5, Def: 3, Spd: 7, Int: 2, Luck: 3 }, hpMultiplier: 0.8, isBoss: false },
      { name: "Slime Abomination", element: "Water", baseStats: { Str: 4, Def: 6, Spd: 2, Int: 3, Luck: 1 }, hpMultiplier: 1.0, isBoss: false },
      { name: "Forgotten Automaton", element: "Metal", baseStats: { Str: 7, Def: 8, Spd: 3, Int: 1, Luck: 2 }, hpMultiplier: 1.2, isBoss: false },
    ],
    boss: { name: "The Undercity Hydra", element: "Dark", baseStats: { Str: 15, Def: 12, Spd: 8, Int: 10, Luck: 5 }, hpMultiplier: 3.0, isBoss: true },
    floorRewards: { gold: 200, trainingPoints: 10, soulShards: 1, xp: 50, rareItemChance: 0.05 },
    completionRewards: { gold: 1000, trainingPoints: 50, soulShards: 5, xp: 300, rareItemChance: 0.2, rareItemId: "divine-weapon-sewer-blade" },
  },
  {
    zoneId: "mountain_caverns",
    name: "The Deepstone Abyss",
    theme: "cavern",
    description: "A labyrinth of crystalline caves hiding ancient mineral guardians and stone beasts.",
    floors: 5,
    minRank: "Apprentice",
    monsters: [
      { name: "Deepstone Worm", element: "Earth", baseStats: { Str: 10, Def: 8, Spd: 4, Int: 3, Luck: 3 }, hpMultiplier: 1.0, isBoss: false },
      { name: "Crystal Crawler", element: "Crystal", baseStats: { Str: 8, Def: 12, Spd: 5, Int: 6, Luck: 4 }, hpMultiplier: 1.2, isBoss: false },
      { name: "Ore Elemental", element: "Metal", baseStats: { Str: 12, Def: 14, Spd: 3, Int: 4, Luck: 2 }, hpMultiplier: 1.4, isBoss: false },
    ],
    boss: { name: "Gorath the Stone Titan", element: "Earth", baseStats: { Str: 25, Def: 30, Spd: 5, Int: 8, Luck: 4 }, hpMultiplier: 4.0, isBoss: true },
    floorRewards: { gold: 400, trainingPoints: 15, soulShards: 2, xp: 80, rareItemChance: 0.08 },
    completionRewards: { gold: 3000, trainingPoints: 80, soulShards: 10, xp: 500, rareItemChance: 0.25, rareItemId: "divine-armor-deepstone-plate" },
  },
  {
    zoneId: "ancient_ruins",
    name: "The Forgotten Sanctum",
    theme: "ruins",
    description: "Crumbling temples haunted by spirits of an ancient civilization and their cursed guardians.",
    floors: 5,
    minRank: "Initiate",
    monsters: [
      { name: "Tomb Wraith", element: "Dark", baseStats: { Str: 8, Def: 5, Spd: 10, Int: 12, Luck: 6 }, hpMultiplier: 0.9, isBoss: false },
      { name: "Cursed Sentinel", element: "Void", baseStats: { Str: 12, Def: 10, Spd: 6, Int: 8, Luck: 4 }, hpMultiplier: 1.3, isBoss: false },
      { name: "Ancient Golem", element: "Earth", baseStats: { Str: 14, Def: 16, Spd: 3, Int: 5, Luck: 2 }, hpMultiplier: 1.5, isBoss: false },
    ],
    boss: { name: "Pharaoh Khet'zul", element: "Soul", baseStats: { Str: 20, Def: 15, Spd: 12, Int: 22, Luck: 8 }, hpMultiplier: 3.5, isBoss: true },
    floorRewards: { gold: 500, trainingPoints: 18, soulShards: 3, xp: 100, rareItemChance: 0.1 },
    completionRewards: { gold: 4000, trainingPoints: 100, soulShards: 15, xp: 600, rareItemChance: 0.3, rareItemId: "divine-accessory-pharaohs-amulet" },
  },
  {
    zoneId: "enchanted_forest",
    name: "The Verdant Hollow",
    theme: "forest",
    description: "A dark grove at the forest's heart where nature spirits and feral beasts guard ancient secrets.",
    floors: 4,
    minRank: "Apprentice",
    monsters: [
      { name: "Thorn Stalker", element: "Nature", baseStats: { Str: 9, Def: 6, Spd: 11, Int: 5, Luck: 6 }, hpMultiplier: 0.9, isBoss: false },
      { name: "Fungal Horror", element: "Nature", baseStats: { Str: 7, Def: 10, Spd: 4, Int: 8, Luck: 3 }, hpMultiplier: 1.2, isBoss: false },
      { name: "Elder Wolfskin", element: "Blood", baseStats: { Str: 12, Def: 7, Spd: 13, Int: 4, Luck: 7 }, hpMultiplier: 1.1, isBoss: false },
    ],
    boss: { name: "Sylvara the Ancient Ent", element: "Nature", baseStats: { Str: 22, Def: 24, Spd: 6, Int: 14, Luck: 7 }, hpMultiplier: 3.5, isBoss: true },
    floorRewards: { gold: 350, trainingPoints: 14, soulShards: 2, xp: 75, rareItemChance: 0.07 },
    completionRewards: { gold: 2500, trainingPoints: 70, soulShards: 8, xp: 450, rareItemChance: 0.25, rareItemId: "divine-weapon-verdant-bow" },
  },
  {
    zoneId: "crystal_lake",
    name: "The Sunken Grotto",
    theme: "underwater",
    description: "Submerged caverns beneath the lake where aquatic horrors dwell among enchanted crystals.",
    floors: 4,
    minRank: "Journeyman",
    monsters: [
      { name: "Drowned Revenant", element: "Water", baseStats: { Str: 10, Def: 8, Spd: 7, Int: 9, Luck: 5 }, hpMultiplier: 1.0, isBoss: false },
      { name: "Crystal Serpent", element: "Crystal", baseStats: { Str: 8, Def: 11, Spd: 9, Int: 7, Luck: 6 }, hpMultiplier: 1.1, isBoss: false },
      { name: "Tide Shaman", element: "Water", baseStats: { Str: 6, Def: 6, Spd: 8, Int: 14, Luck: 5 }, hpMultiplier: 0.9, isBoss: false },
    ],
    boss: { name: "Leviathara the Deep One", element: "Water", baseStats: { Str: 24, Def: 18, Spd: 14, Int: 16, Luck: 8 }, hpMultiplier: 3.8, isBoss: true },
    floorRewards: { gold: 450, trainingPoints: 16, soulShards: 2, xp: 90, rareItemChance: 0.09 },
    completionRewards: { gold: 3500, trainingPoints: 90, soulShards: 12, xp: 550, rareItemChance: 0.28, rareItemId: "divine-accessory-tidal-ring" },
  },
  {
    zoneId: "coastal_village",
    name: "The Corsair's Cove",
    theme: "pirate",
    description: "A hidden pirate hideout in the sea caves, guarded by undead pirates and sea monsters.",
    floors: 4,
    minRank: "Journeyman",
    monsters: [
      { name: "Undead Buccaneer", element: "Dark", baseStats: { Str: 11, Def: 8, Spd: 7, Int: 4, Luck: 6 }, hpMultiplier: 1.0, isBoss: false },
      { name: "Sea Hag", element: "Water", baseStats: { Str: 6, Def: 5, Spd: 8, Int: 13, Luck: 7 }, hpMultiplier: 0.9, isBoss: false },
      { name: "Anchor Golem", element: "Metal", baseStats: { Str: 14, Def: 16, Spd: 3, Int: 2, Luck: 2 }, hpMultiplier: 1.4, isBoss: false },
    ],
    boss: { name: "Captain Dreadmaw", element: "Storm", baseStats: { Str: 22, Def: 16, Spd: 14, Int: 12, Luck: 10 }, hpMultiplier: 3.5, isBoss: true },
    floorRewards: { gold: 450, trainingPoints: 16, soulShards: 2, xp: 85, rareItemChance: 0.08 },
    completionRewards: { gold: 3200, trainingPoints: 85, soulShards: 10, xp: 500, rareItemChance: 0.25, rareItemId: "divine-weapon-corsairs-cutlass" },
  },
  {
    zoneId: "ruby_mines",
    name: "The Infernal Vein",
    theme: "volcanic",
    description: "Magma-filled tunnels deep within the mines where fire elementals and gem constructs lurk.",
    floors: 5,
    minRank: "Adept",
    monsters: [
      { name: "Magma Slug", element: "Fire", baseStats: { Str: 12, Def: 10, Spd: 4, Int: 6, Luck: 3 }, hpMultiplier: 1.2, isBoss: false },
      { name: "Ruby Construct", element: "Crystal", baseStats: { Str: 14, Def: 18, Spd: 3, Int: 5, Luck: 5 }, hpMultiplier: 1.5, isBoss: false },
      { name: "Flame Phantom", element: "Fire", baseStats: { Str: 10, Def: 6, Spd: 12, Int: 14, Luck: 6 }, hpMultiplier: 1.0, isBoss: false },
    ],
    boss: { name: "Ignatar the Molten King", element: "Fire", baseStats: { Str: 28, Def: 22, Spd: 12, Int: 18, Luck: 8 }, hpMultiplier: 4.5, isBoss: true },
    floorRewards: { gold: 600, trainingPoints: 20, soulShards: 3, xp: 110, rareItemChance: 0.1 },
    completionRewards: { gold: 5000, trainingPoints: 120, soulShards: 18, xp: 700, rareItemChance: 0.3, rareItemId: "divine-armor-infernal-plate" },
  },
  {
    zoneId: "battle_arena",
    name: "The Champion's Gauntlet",
    theme: "gladiator",
    description: "An underground arena where the fiercest warriors face waves of elite combatants.",
    floors: 5,
    minRank: "Expert",
    monsters: [
      { name: "Arena Berserker", element: "Blood", baseStats: { Str: 16, Def: 8, Spd: 10, Int: 4, Luck: 7 }, hpMultiplier: 1.1, isBoss: false },
      { name: "Shield Centurion", element: "Metal", baseStats: { Str: 12, Def: 18, Spd: 6, Int: 5, Luck: 4 }, hpMultiplier: 1.4, isBoss: false },
      { name: "Spell Duelist", element: "Arcane", baseStats: { Str: 8, Def: 6, Spd: 12, Int: 18, Luck: 6 }, hpMultiplier: 1.0, isBoss: false },
    ],
    boss: { name: "Grand Champion Vexor", element: "Storm", baseStats: { Str: 28, Def: 24, Spd: 18, Int: 16, Luck: 12 }, hpMultiplier: 4.5, isBoss: true },
    floorRewards: { gold: 700, trainingPoints: 22, soulShards: 4, xp: 120, rareItemChance: 0.12 },
    completionRewards: { gold: 6000, trainingPoints: 140, soulShards: 20, xp: 800, rareItemChance: 0.35, rareItemId: "divine-weapon-champions-blade" },
  },
  {
    zoneId: "research_lab",
    name: "The Unstable Core",
    theme: "arcane-tech",
    description: "A containment zone for failed experiments and rogue arcane constructs gone haywire.",
    floors: 4,
    minRank: "Adept",
    monsters: [
      { name: "Rogue Automaton", element: "Plasma", baseStats: { Str: 12, Def: 10, Spd: 8, Int: 10, Luck: 4 }, hpMultiplier: 1.1, isBoss: false },
      { name: "Arcane Mutant", element: "Arcane", baseStats: { Str: 10, Def: 6, Spd: 10, Int: 14, Luck: 5 }, hpMultiplier: 1.0, isBoss: false },
      { name: "Void Breach", element: "Void", baseStats: { Str: 14, Def: 8, Spd: 6, Int: 16, Luck: 3 }, hpMultiplier: 1.3, isBoss: false },
    ],
    boss: { name: "Experiment Omega", element: "Void", baseStats: { Str: 24, Def: 18, Spd: 14, Int: 26, Luck: 8 }, hpMultiplier: 4.0, isBoss: true },
    floorRewards: { gold: 550, trainingPoints: 18, soulShards: 3, xp: 100, rareItemChance: 0.1 },
    completionRewards: { gold: 4500, trainingPoints: 110, soulShards: 15, xp: 650, rareItemChance: 0.3, rareItemId: "divine-accessory-unstable-core" },
  },
  {
    zoneId: "pet_training",
    name: "The Beastmaster's Trial",
    theme: "wilderness",
    description: "A primal proving ground where wild beasts test the bond between trainer and companion.",
    floors: 3,
    minRank: "Novice",
    monsters: [
      { name: "Feral Packleader", element: "Nature", baseStats: { Str: 7, Def: 4, Spd: 10, Int: 3, Luck: 5 }, hpMultiplier: 0.8, isBoss: false },
      { name: "Wild Chimera Pup", element: "Fire", baseStats: { Str: 8, Def: 5, Spd: 8, Int: 4, Luck: 4 }, hpMultiplier: 0.9, isBoss: false },
      { name: "Alpha Dire Wolf", element: "Nature", baseStats: { Str: 10, Def: 7, Spd: 11, Int: 4, Luck: 6 }, hpMultiplier: 1.1, isBoss: false },
    ],
    boss: { name: "The Primal Beast", element: "Nature", baseStats: { Str: 16, Def: 12, Spd: 14, Int: 6, Luck: 8 }, hpMultiplier: 3.0, isBoss: true },
    floorRewards: { gold: 200, trainingPoints: 10, soulShards: 1, xp: 50, rareItemChance: 0.05 },
    completionRewards: { gold: 1200, trainingPoints: 50, soulShards: 5, xp: 300, rareItemChance: 0.2, rareItemId: "divine-accessory-beast-collar" },
  },
  {
    zoneId: "hell_zone",
    name: "The Abyssal Pit",
    theme: "demonic",
    description: "The deepest layer of the Hell Zone where the most powerful demons await challengers.",
    floors: 7,
    minRank: "Master",
    monsters: [
      { name: "Pit Fiend", element: "Dark", baseStats: { Str: 20, Def: 16, Spd: 12, Int: 14, Luck: 7 }, hpMultiplier: 1.5, isBoss: false },
      { name: "Hellfire Archon", element: "Fire", baseStats: { Str: 18, Def: 12, Spd: 14, Int: 20, Luck: 6 }, hpMultiplier: 1.4, isBoss: false },
      { name: "Void Devourer", element: "Void", baseStats: { Str: 22, Def: 18, Spd: 10, Int: 16, Luck: 8 }, hpMultiplier: 1.6, isBoss: false },
    ],
    boss: { name: "Azrath the Abyssal Overlord", element: "Dark", baseStats: { Str: 35, Def: 28, Spd: 20, Int: 30, Luck: 14 }, hpMultiplier: 6.0, isBoss: true },
    floorRewards: { gold: 1000, trainingPoints: 30, soulShards: 5, xp: 150, rareItemChance: 0.15 },
    completionRewards: { gold: 10000, trainingPoints: 200, soulShards: 30, xp: 1200, rareItemChance: 0.4, rareItemId: "mythical_legend-weapon-abyssal-scythe" },
  },
  {
    zoneId: "mystic_tower",
    name: "The Arcanum Sanctum",
    theme: "magical",
    description: "A hidden chamber within the tower where powerful arcane entities guard ultimate knowledge.",
    floors: 6,
    minRank: "Grandmaster",
    monsters: [
      { name: "Arcane Wraith", element: "Arcane", baseStats: { Str: 14, Def: 10, Spd: 12, Int: 22, Luck: 8 }, hpMultiplier: 1.3, isBoss: false },
      { name: "Aether Construct", element: "Aether", baseStats: { Str: 18, Def: 20, Spd: 8, Int: 16, Luck: 5 }, hpMultiplier: 1.6, isBoss: false },
      { name: "Time Weaver", element: "Time", baseStats: { Str: 12, Def: 8, Spd: 18, Int: 24, Luck: 10 }, hpMultiplier: 1.2, isBoss: false },
    ],
    boss: { name: "The Eternal Archmage", element: "Aether", baseStats: { Str: 30, Def: 25, Spd: 18, Int: 35, Luck: 12 }, hpMultiplier: 5.5, isBoss: true },
    floorRewards: { gold: 800, trainingPoints: 25, soulShards: 4, xp: 130, rareItemChance: 0.12 },
    completionRewards: { gold: 8000, trainingPoints: 180, soulShards: 25, xp: 1000, rareItemChance: 0.35, rareItemId: "mythical_legend-accessory-archmages-orb" },
  },
];

export function getZoneDungeonConfig(zoneId: string): ZoneDungeonConfig | null {
  return ZONE_DUNGEON_CONFIGS.find(d => d.zoneId === zoneId) || null;
}

export const ZONE_DUNGEON_RANK_INDEX: Record<string, number> = {};
for (const rank of playerRanks) {
  ZONE_DUNGEON_RANK_INDEX[rank] = playerRanks.indexOf(rank);
}

export const zoneDungeonRuns = pgTable("zone_dungeon_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  zoneId: text("zone_id").notNull(),
  currentFloor: integer("current_floor").notNull().default(1),
  completed: boolean("completed").notNull().default(false),
  totalGoldEarned: integer("total_gold_earned").notNull().default(0),
  totalXpEarned: integer("total_xp_earned").notNull().default(0),
  monstersDefeated: integer("monsters_defeated").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const zoneDungeonRunsRelations = relations(zoneDungeonRuns, ({ one }) => ({
  account: one(accounts, {
    fields: [zoneDungeonRuns.accountId],
    references: [accounts.id],
  }),
}));

export const insertZoneDungeonRunSchema = createInsertSchema(zoneDungeonRuns).omit({ id: true, startedAt: true });
export type InsertZoneDungeonRun = z.infer<typeof insertZoneDungeonRunSchema>;
export type ZoneDungeonRun = typeof zoneDungeonRuns.$inferSelect;

// ==================== VALORPEDIA (Discovery/Collection Log) ====================
export const valorpediaCategories = ["fish", "monsters", "resources", "pets", "spells", "zones"] as const;
export type ValorpediaCategory = typeof valorpediaCategories[number];

export const valorpediaDiscoveries = pgTable("valorpedia_discoveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  category: text("category").notNull().$type<ValorpediaCategory>(),
  entryId: text("entry_id").notNull(),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
});

export const valorpediaDiscoveriesRelations = relations(valorpediaDiscoveries, ({ one }) => ({
  account: one(accounts, {
    fields: [valorpediaDiscoveries.accountId],
    references: [accounts.id],
  }),
}));

export const insertValorpediaDiscoverySchema = createInsertSchema(valorpediaDiscoveries).omit({ id: true, discoveredAt: true });
export type InsertValorpediaDiscovery = z.infer<typeof insertValorpediaDiscoverySchema>;
export type ValorpediaDiscovery = typeof valorpediaDiscoveries.$inferSelect;

export const valorpediaMilestonesClaimed = pgTable("valorpedia_milestones_claimed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  milestoneId: text("milestone_id").notNull(),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
});

export const valorpediaMilestonesClaimedRelations = relations(valorpediaMilestonesClaimed, ({ one }) => ({
  account: one(accounts, {
    fields: [valorpediaMilestonesClaimed.accountId],
    references: [accounts.id],
  }),
}));

export const insertValorpediaMilestoneClaimedSchema = createInsertSchema(valorpediaMilestonesClaimed).omit({ id: true, claimedAt: true });
export type InsertValorpediaMilestoneClaimed = z.infer<typeof insertValorpediaMilestoneClaimedSchema>;
export type ValorpediaMilestoneClaimed = typeof valorpediaMilestonesClaimed.$inferSelect;

export const VALORPEDIA_ENTRIES: Record<ValorpediaCategory, { id: string; name: string; description: string }[]> = {
  fish: [
    { id: "minnow", name: "Minnow", description: "A tiny common fish found in all waters." },
    { id: "trout", name: "Trout", description: "A freshwater fish enjoyed by travelers." },
    { id: "salmon", name: "Salmon", description: "A strong swimmer found in cold rivers." },
    { id: "catfish", name: "Catfish", description: "A bottom-dweller with keen senses." },
    { id: "pike", name: "Pike", description: "An aggressive predatory freshwater fish." },
    { id: "golden_carp", name: "Golden Carp", description: "A rare golden-scaled carp prized by collectors." },
    { id: "shadow_eel", name: "Shadow Eel", description: "An eel that thrives in dark waters." },
    { id: "crystal_bass", name: "Crystal Bass", description: "A bass with translucent scales." },
    { id: "storm_marlin", name: "Storm Marlin", description: "A massive fish that appears during thunderstorms." },
    { id: "void_angler", name: "Void Angler", description: "A deep-sea fish from the abyss." },
    { id: "aether_koi", name: "Aether Koi", description: "A mythical koi infused with Aether energy." },
    { id: "leviathan_fry", name: "Leviathan Fry", description: "The young of a legendary sea creature." },
  ],
  monsters: [
    { id: "goblin", name: "Goblin", description: "A weak but cunning creature." },
    { id: "wolf", name: "Dire Wolf", description: "A large predatory canine." },
    { id: "skeleton", name: "Skeleton Warrior", description: "An undead fighter raised from the grave." },
    { id: "slime", name: "Slime", description: "A gelatinous elemental creature." },
    { id: "bandit", name: "Bandit", description: "A rogue fighter who ambushes travelers." },
    { id: "golem", name: "Stone Golem", description: "A construct animated by ancient magic." },
    { id: "wyvern", name: "Wyvern", description: "A lesser dragon with deadly claws." },
    { id: "wraith", name: "Wraith", description: "A spectral entity that drains life force." },
    { id: "elemental", name: "Elemental", description: "A being of pure elemental energy." },
    { id: "drake", name: "Drake", description: "A young dragon with fierce breath." },
    { id: "demon_imp", name: "Demon Imp", description: "A lesser demon summoned from the abyss." },
    { id: "crystal_spider", name: "Crystal Spider", description: "A spider with crystalline webs." },
    { id: "thunder_hawk", name: "Thunder Hawk", description: "A storm-charged bird of prey." },
    { id: "shadow_stalker", name: "Shadow Stalker", description: "An assassin creature from the Dark realm." },
    { id: "ancient_treant", name: "Ancient Treant", description: "A massive living tree guardian." },
    { id: "void_beast", name: "Void Beast", description: "A creature from beyond the known world." },
  ],
  resources: [
    { id: "iron_ore", name: "Iron Ore", description: "Common metal ore used in basic crafting." },
    { id: "silver_ore", name: "Silver Ore", description: "A precious metal with magical conductivity." },
    { id: "ruby", name: "Ruby", description: "A fiery red gemstone with mystical properties." },
    { id: "mythril", name: "Mythril", description: "A rare lightweight metal of immense strength." },
    { id: "plasma_core", name: "Plasma Core", description: "A volatile energy source from deep mines." },
    { id: "chrono_crystal", name: "Chrono Crystal", description: "A crystal that resonates with time energy." },
    { id: "wood", name: "Wood", description: "Standard timber for construction and crafting." },
    { id: "fiber", name: "Fiber", description: "Plant-based material used in weaving." },
    { id: "beast_hide", name: "Beast Hide", description: "Durable hide from wild creatures." },
    { id: "nature_essence", name: "Nature Essence", description: "Concentrated natural energy." },
    { id: "soul_shard", name: "Soul Shard", description: "A fragment of captured soul energy." },
    { id: "aether_fragment", name: "Aether Fragment", description: "A piece of pure Aether." },
    { id: "rare_essence", name: "Rare Essence", description: "A concentrated magical essence." },
    { id: "tempest_stone", name: "Tempest Stone", description: "A stone charged with storm energy." },
  ],
  pets: [
    { id: "fire_hound", name: "Fire Hound", description: "A loyal canine wreathed in flames." },
    { id: "water_sprite", name: "Water Sprite", description: "A playful water elemental companion." },
    { id: "earth_golem", name: "Earth Golem", description: "A sturdy companion made of living rock." },
    { id: "air_wisp", name: "Air Wisp", description: "A swift and elusive wind spirit." },
    { id: "lightning_fox", name: "Lightning Fox", description: "A fox crackling with electric energy." },
    { id: "ice_phoenix", name: "Ice Phoenix", description: "A majestic bird of frost and rebirth." },
    { id: "nature_fairy", name: "Nature Fairy", description: "A tiny fairy with healing powers." },
    { id: "dark_panther", name: "Dark Panther", description: "A stealthy feline of shadow." },
    { id: "light_unicorn", name: "Light Unicorn", description: "A radiant creature of pure light." },
    { id: "arcane_owl", name: "Arcane Owl", description: "A wise owl infused with arcane knowledge." },
    { id: "chrono_serpent", name: "Chrono Serpent", description: "A serpent that slithers through time." },
    { id: "void_cat", name: "Void Cat", description: "A cat that phases between dimensions." },
  ],
  spells: [
    { id: "fireball", name: "Fireball", description: "A classic fire spell that deals AoE damage." },
    { id: "ice_lance", name: "Ice Lance", description: "A piercing shard of ice." },
    { id: "thunder_strike", name: "Thunder Strike", description: "A bolt of lightning from above." },
    { id: "earth_shatter", name: "Earth Shatter", description: "Shatters the ground beneath enemies." },
    { id: "healing_light", name: "Healing Light", description: "Restores HP with holy energy." },
    { id: "shadow_bolt", name: "Shadow Bolt", description: "A bolt of dark energy." },
    { id: "wind_slash", name: "Wind Slash", description: "A cutting blade of air." },
    { id: "water_surge", name: "Water Surge", description: "A powerful wave of water." },
    { id: "arcane_missile", name: "Arcane Missile", description: "Guided missiles of pure magic." },
    { id: "soul_drain", name: "Soul Drain", description: "Drains life force from the target." },
    { id: "void_rift", name: "Void Rift", description: "Opens a rift to the void." },
    { id: "plasma_burst", name: "Plasma Burst", description: "An explosion of superheated plasma." },
    { id: "time_stop", name: "Time Stop", description: "Briefly halts time around the caster." },
    { id: "crystal_shield", name: "Crystal Shield", description: "Creates a protective crystalline barrier." },
  ],
  zones: [
    { id: "capital_city", name: "Capital City", description: "The central hub where all adventurers gather." },
    { id: "glorifac_cave", name: "Glorifac Cave", description: "A deep cave system rich with ores and minerals." },
    { id: "whispering_forest", name: "Whispering Forest", description: "An ancient forest full of natural resources." },
    { id: "lavic_town", name: "Lavic Town", description: "A coastal town known for fishing and trade." },
    { id: "mystic_tower", name: "Mystic Tower", description: "A towering structure of arcane knowledge." },
    { id: "shadow_realm", name: "Shadow Realm", description: "A dark dimension of shadows and danger." },
    { id: "crystal_peaks", name: "Crystal Peaks", description: "Mountain peaks covered in gleaming crystals." },
    { id: "storm_coast", name: "Storm Coast", description: "A coastline battered by eternal storms." },
    { id: "void_wastes", name: "Void Wastes", description: "A barren land touched by void energy." },
    { id: "fire_plains", name: "Fire Plains", description: "Scorched plains with volcanic activity." },
    { id: "frozen_tundra", name: "Frozen Tundra", description: "An icy wasteland of extreme cold." },
    { id: "celestial_garden", name: "Celestial Garden", description: "A heavenly garden above the clouds." },
    { id: "demon_abyss", name: "Demon Abyss", description: "The gateway to the underworld." },
    { id: "ancient_ruins", name: "Ancient Ruins", description: "Remnants of a lost civilization." },
    { id: "dragon_spine", name: "Dragon Spine", description: "A mountain range shaped like a sleeping dragon." },
    { id: "emerald_marsh", name: "Emerald Marsh", description: "A lush swamp teeming with life." },
    { id: "astral_plane", name: "Astral Plane", description: "A plane between reality and dreams." },
    { id: "hell_zone", name: "Hell Zone", description: "The most dangerous PvP battleground." },
  ],
};

export const VALORPEDIA_MILESTONES: { id: string; name: string; requiredPercent: number; rewards: { gold?: number; rubies?: number; title?: string } }[] = [
  { id: "explorer_10", name: "Curious Explorer", requiredPercent: 10, rewards: { gold: 5000 } },
  { id: "explorer_25", name: "Keen Discoverer", requiredPercent: 25, rewards: { gold: 25000, rubies: 5 } },
  { id: "explorer_50", name: "Seasoned Scholar", requiredPercent: 50, rewards: { gold: 100000, rubies: 20, title: "Scholar" } },
  { id: "explorer_75", name: "Master Cataloger", requiredPercent: 75, rewards: { gold: 500000, rubies: 50, title: "Lorekeeper" } },
  { id: "explorer_100", name: "Valorpedia Completionist", requiredPercent: 100, rewards: { gold: 2000000, rubies: 100, title: "Living Encyclopedia" } },
];

export const TRADE_TIME_LOCK_SECONDS = 90;

export const TRADE_RANK_RESTRICTIONS: Record<string, number> = {
  "Novice": 0,
  "Apprentice": 1,
  "Initiate": 2,
  "Journeyman": 3,
  "Adept": 4,
  "Expert": 5,
  "Master": 6,
  "Grandmaster": 7,
  "Champion": 8,
  "Overlord": 9,
  "Sovereign": 10,
  "Ascendant": 11,
  "Legend": 12,
  "Mythic": 13,
  "Mythical Legend": 14,
};

export const TRADE_MIN_RANK = "Apprentice";
export const TRADE_MAX_RANK_DIFF = 5;

export const tradeHistory = pgTable("trade_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull(),
  initiatorId: varchar("initiator_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  initiatorItems: jsonb("initiator_items").notNull().default([]).$type<{ type: string; refId: string; name: string }[]>(),
  recipientItems: jsonb("recipient_items").notNull().default([]).$type<{ type: string; refId: string; name: string }[]>(),
  status: text("status").notNull().$type<TradeStatus>(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const insertTradeHistorySchema = createInsertSchema(tradeHistory).omit({ id: true });
export type InsertTradeHistory = z.infer<typeof insertTradeHistorySchema>;
export type TradeHistory = typeof tradeHistory.$inferSelect;

export const soulLinkStatuses = ["active", "expired", "cancelled"] as const;
export type SoulLinkStatus = typeof soulLinkStatuses[number];

export const SOUL_LINK_COST_GOLD = 50000;
export const SOUL_LINK_DURATION_HOURS = 1;
export const SOUL_LINK_STAT_SHARE_PERCENT = 10;

export const soulLinks = pgTable("soul_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  player2Id: varchar("player2_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<SoulLinkStatus>().default("active"),
  statSharePercent: integer("stat_share_percent").notNull().default(10),
  goldCostEach: bigint("gold_cost_each", { mode: "number" }).notNull().default(50000),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const soulLinksRelations = relations(soulLinks, ({ one }) => ({
  player1: one(accounts, {
    fields: [soulLinks.player1Id],
    references: [accounts.id],
    relationName: "soulLinkPlayer1",
  }),
  player2: one(accounts, {
    fields: [soulLinks.player2Id],
    references: [accounts.id],
    relationName: "soulLinkPlayer2",
  }),
}));

export const insertSoulLinkSchema = createInsertSchema(soulLinks).omit({ id: true, createdAt: true });
export type InsertSoulLink = z.infer<typeof insertSoulLinkSchema>;
export type SoulLink = typeof soulLinks.$inferSelect;
