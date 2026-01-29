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
  lastDeathTime: timestamp("last_death_time"),
  deathCount: integer("death_count").notNull().default(0),
  reviveTokens: integer("revive_tokens").notNull().default(1), // One-time revives
  respawnLocation: text("respawn_location").notNull().default("base"), // Where to respawn
  // V2: Base system
  baseTier: integer("base_tier").notNull().default(1), // Current base tier (1-5)
  baseSkin: text("base_skin").default("default"), // Cosmetic base skin
  trophies: text("trophies").array().default(sql`ARRAY[]::text[]`), // Earned trophies
  // V2: Equipped cosmetic skins
  equippedCharacterSkin: text("equipped_character_skin").default("default"),
  equippedPetSkin: text("equipped_pet_skin").default("default"),
  equippedBirdSkin: text("equipped_bird_skin").default("default"),
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  itemId: text("item_id").notNull(),
  stats: jsonb("stats").notNull().default({}).$type<Partial<Stats>>(),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  inventory: many(inventoryItems),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export const birdTiers = ["hatchling", "fledgling", "soarer", "raptor", "phoenix"] as const;
export type BirdTier = typeof birdTiers[number];

export const birdStatsSchema = z.object({
  Def: z.number().default(1),
  Spd: z.number().default(1),
});
export type BirdStats = z.infer<typeof birdStatsSchema>;

export const birds = pgTable("birds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tier: text("tier").notNull().$type<BirdTier>().default("hatchling"),
  stats: jsonb("stats").notNull().default({ Def: 1, Spd: 1 }).$type<BirdStats>(),
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
export const fishRarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type FishRarity = typeof fishRarities[number];

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

export const guilds = pgTable("guilds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  masterId: varchar("master_id").notNull().references(() => accounts.id),
  bank: jsonb("bank").notNull().default({ gold: 0, rubies: 0, soulShards: 0, focusedShards: 0, runes: 0, trainingPoints: 0 }).$type<GuildBank>(),
  dungeonFloor: integer("dungeon_floor").notNull().default(1),
  dungeonLevel: integer("dungeon_level").notNull().default(1),
  wins: integer("wins").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildChat = pgTable("guild_chat", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => accounts.id),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const guildMembers = pgTable("guild_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

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

export const insertGuildSchema = createInsertSchema(guilds).omit({ id: true, createdAt: true, bank: true, dungeonFloor: true, dungeonLevel: true });
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

// ==================== GUILD LEVEL REQUIREMENTS ====================
export const guildLevelRequirements = [
  { level: 1, minDungeonFloor: 0, goldCost: 0 },
  { level: 2, minDungeonFloor: 1, goldCost: 1_000_000_000 }, // 1 billion
  { level: 3, minDungeonFloor: 5, goldCost: 2_000_000_000 },
  { level: 4, minDungeonFloor: 10, goldCost: 5_000_000_000 },
  { level: 5, minDungeonFloor: 15, goldCost: 10_000_000_000 },
  { level: 6, minDungeonFloor: 20, goldCost: 25_000_000_000 },
  { level: 7, minDungeonFloor: 30, goldCost: 50_000_000_000 },
  { level: 8, minDungeonFloor: 40, goldCost: 100_000_000_000 },
  { level: 9, minDungeonFloor: 50, goldCost: 250_000_000_000 },
  { level: 10, minDungeonFloor: 75, goldCost: 1_000_000_000_000 }, // 1 trillion - requires Demon Lord Dungeon
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
