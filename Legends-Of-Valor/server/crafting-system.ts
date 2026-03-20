import { db } from "./db";
import { accounts, inventoryItems, recipes, type Item, type Stats } from "@shared/schema";
import { ALL_ITEMS } from "../client/src/lib/items-data";
import { eq, sql } from "drizzle-orm";

export async function craftItem(accountId: string, recipeId: string) {
  const account = (await db.select().from(accounts).where(eq(accounts.id, accountId)))[0];
  if (!account) throw new Error("Account not found");

  let recipe = (await db.select().from(recipes).where(eq(recipes.id, recipeId)))[0];
  if (!recipe) {
    recipe = (await db.select().from(recipes).where(eq(recipes.resultItemId, recipeId)))[0];
  }
  if (!recipe) throw new Error("Recipe not found");

  // Check rank
  const playerRanks = [
    "Novice", "Apprentice", "Initiate", "Journeyman", "Adept", "Expert", "Master",
    "Grandmaster", "Champion", "Overlord", "Sovereign", "Ascendant", "Legend", "Mythic", "Mythical Legend"
  ];
  if (playerRanks.indexOf(account.rank) < playerRanks.indexOf(recipe.requiredRank)) {
    throw new Error("Rank too low for this recipe");
  }

  // Check ingredients in inventory
  const inventory = await db.select().from(inventoryItems).where(eq(inventoryItems.accountId, accountId));
  const ingredients = recipe.ingredients as { itemId: string; quantity: number }[];

  for (const ingredient of ingredients) {
    const count = inventory.filter(item => item.itemId === ingredient.itemId).length;
    if (count < ingredient.quantity) {
      throw new Error(`Missing ingredient: ${ingredient.itemId}`);
    }
  }

  if (account.gold < recipe.goldCost) {
    throw new Error("Not enough gold");
  }

  // Consume ingredients
  for (const ingredient of ingredients) {
    const itemsToRemove = inventory
      .filter(item => item.itemId === ingredient.itemId)
      .slice(0, ingredient.quantity);
    
    for (const item of itemsToRemove) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, item.id));
    }
  }

  // Deduct gold
  await db.update(accounts)
    .set({ gold: account.gold - recipe.goldCost })
    .where(eq(accounts.id, accountId));

  // Add crafted item
  const itemData = ALL_ITEMS.find(i => i.id === recipe.resultItemId);
  if (!itemData) throw new Error("Result item data not found");

  // Crafted items strongest in tier: +10% stat bonus
  const boostedStats = { ...(itemData.stats as any) };
  for (const stat in boostedStats) {
    boostedStats[stat] = Math.floor(boostedStats[stat] * 1.1);
  }

  // Crafted items can have sockets (e.g., 1-3 for high tier)
  let sockets = 0;
  if (["legend", "mythic", "mythical_legend", "divine", "ssumr", "umr", "x_tier"].includes(itemData.tier)) {
    const roll = Math.random();
    if (roll < 0.1) sockets = 3;
    else if (roll < 0.3) sockets = 2;
    else sockets = 1;
  }

  const [newItem] = await db.insert(inventoryItems).values({
    accountId,
    itemId: itemData.id,
    stats: boostedStats,
    sockets,
    gems: [],
  }).returning();

  return newItem;
}

export async function socketGem(accountId: string, itemId: string, gemItemId: string) {
  const item = (await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)))[0];
  if (!item || item.accountId !== accountId) throw new Error("Item not found");

  if (item.sockets <= 0 || (item.gems as any[]).length >= item.sockets) {
    throw new Error("No available sockets");
  }

  const gemInInv = (await db.select().from(inventoryItems)
    .where(sql`${inventoryItems.accountId} = ${accountId} AND ${inventoryItems.itemId} = ${gemItemId}`))[0];
  
  if (!gemInInv) throw new Error("Gem not found in inventory");

  // Add gem to item
  const itemGems = [...(item.gems as any[])];
  itemGems.push({ id: gemInInv.itemId, stats: gemInInv.stats });

  // Update item stats with gem stats
  const currentStats = { ...(item.stats as any) };
  const gemStats = gemInInv.stats as any;
  
  for (const stat in gemStats) {
    currentStats[stat] = (currentStats[stat] || 0) + gemStats[stat];
  }

  await db.update(inventoryItems)
    .set({ gems: itemGems, stats: currentStats })
    .where(eq(inventoryItems.id, itemId));

  // Remove gem from inventory
  await db.delete(inventoryItems).where(eq(inventoryItems.id, gemInInv.id));

  return true;
}

// Forest weapon recipes: each rank only requires materials available at that rank or lower.
// Rank index reference: Novice(0) Apprentice(1) Initiate(2) Journeyman(3) Adept(4) Expert(5)
//   Master(6) Grandmaster(7) Champion(8) Overlord(9) Sovereign(10) Ascendant(11)
//   Legend(12) Mythic(13) Mythical Legend(14)
// Material tiers: rank0=wood/fiber/herbs, rank3=faerie/mushroom/crystal, rank5=spirit/essence/sap,
//   rank9=creature_fang/void_crystal/mythic_hide, rank11=heartwood/world_tree_sap/genesis
const FOREST_WEAPON_RECIPES = [
  {
    // Rank 0 - Novice: rank-0 materials only
    name: "Novice Meadow Stick",
    resultItemId: "forest_weapon-0",
    tier: "initiate" as const,
    requiredRank: "Novice" as const,
    ingredients: [
      { itemId: "healing_herb", quantity: 3 },
      { itemId: "wood", quantity: 5 },
    ],
    goldCost: 100,
    description: "A simple stick carved from meadow wood, imbued with nature's touch.",
  },
  {
    // Rank 1 - Apprentice: rank-0 materials only
    name: "Apprentice Petal Club",
    resultItemId: "forest_weapon-1",
    tier: "initiate" as const,
    requiredRank: "Apprentice" as const,
    ingredients: [
      { itemId: "wildflower_petal", quantity: 4 },
      { itemId: "meadow_moss", quantity: 3 },
      { itemId: "wood", quantity: 4 },
    ],
    goldCost: 400,
    description: "A club wrapped in wildflower petals, light but infused with meadow magic.",
  },
  {
    // Rank 2 - Initiate: rank-0 materials only
    name: "Initiate Fiber Bow",
    resultItemId: "forest_weapon-2",
    tier: "initiate" as const,
    requiredRank: "Initiate" as const,
    ingredients: [
      { itemId: "fiber", quantity: 6 },
      { itemId: "wood", quantity: 5 },
      { itemId: "healing_herb", quantity: 2 },
    ],
    goldCost: 700,
    description: "A bow strung with forest fiber and reinforced with healer's herbs.",
  },
  {
    // Rank 3 - Journeyman: rank-3 materials (faerie_dust, glowing_mushroom, luminous_crystal, etc.)
    name: "Journeyman Faerie Bow",
    resultItemId: "forest_weapon-3",
    tier: "journeyman" as const,
    requiredRank: "Journeyman" as const,
    ingredients: [
      { itemId: "faerie_dust", quantity: 2 },
      { itemId: "luminous_crystal", quantity: 1 },
      { itemId: "fiber", quantity: 6 },
    ],
    goldCost: 1500,
    description: "A bow strung with forest fiber and crystals of faerie light.",
  },
  {
    // Rank 4 - Adept: rank-3 materials
    name: "Adept Mushroom Staff",
    resultItemId: "forest_weapon-4",
    tier: "adept" as const,
    requiredRank: "Adept" as const,
    ingredients: [
      { itemId: "glowing_mushroom", quantity: 3 },
      { itemId: "pixie_wing_dust", quantity: 2 },
      { itemId: "beast_hide", quantity: 2 },
    ],
    goldCost: 3000,
    description: "A glowing staff carved from a giant mushroom and wrapped in beast hide.",
  },
  {
    // Rank 5 - Expert: rank-5 materials (nature_essence, spirit_bark, elder_wood_sap, etc.)
    name: "Expert Spirit Blade",
    resultItemId: "forest_weapon-5",
    tier: "expert" as const,
    requiredRank: "Expert" as const,
    ingredients: [
      { itemId: "spirit_bark", quantity: 2 },
      { itemId: "nature_essence", quantity: 2 },
      { itemId: "elder_wood_sap", quantity: 1 },
    ],
    goldCost: 7000,
    description: "A blade forged from spirit bark, pulsing with nature's essence.",
  },
  {
    // Rank 6 - Master: rank-5 materials
    name: "Master Ancient Leaf Spear",
    resultItemId: "forest_weapon-6",
    tier: "master" as const,
    requiredRank: "Master" as const,
    ingredients: [
      { itemId: "forest_spirit_essence", quantity: 2 },
      { itemId: "ancient_leaf", quantity: 3 },
      { itemId: "elder_wood_sap", quantity: 3 },
    ],
    goldCost: 18000,
    description: "A spear tipped with an ancient leaf and infused with forest spirit.",
  },
  {
    // Rank 7 - Grandmaster: rank-5 materials (same tier as Expert/Master area)
    name: "Grandmaster Forest Sentinel",
    resultItemId: "forest_weapon-7",
    tier: "grandmaster" as const,
    requiredRank: "Grandmaster" as const,
    ingredients: [
      { itemId: "forest_spirit_essence", quantity: 3 },
      { itemId: "ancient_leaf", quantity: 5 },
      { itemId: "nature_essence", quantity: 3 },
    ],
    goldCost: 50000,
    description: "A sentinel blade that channels the full power of the ancient forest spirits.",
  },
  {
    // Rank 8 - Champion: rank-5 materials (still below creature_den unlock at rank 9)
    name: "Champion Spirit Glaive",
    resultItemId: "forest_weapon-8",
    tier: "champion" as const,
    requiredRank: "Champion" as const,
    ingredients: [
      { itemId: "forest_spirit_essence", quantity: 4 },
      { itemId: "spirit_bark", quantity: 4 },
      { itemId: "ancient_leaf", quantity: 6 },
    ],
    goldCost: 120000,
    description: "A glaive forged from the finest spirit materials the forest offers.",
  },
  {
    // Rank 9 - Overlord: rank-9 materials (creature_fang, void_crystal, mythic_beast_hide)
    name: "Overlord Void Fang",
    resultItemId: "forest_weapon-9",
    tier: "overlord" as const,
    requiredRank: "Overlord" as const,
    ingredients: [
      { itemId: "creature_fang", quantity: 3 },
      { itemId: "void_crystal", quantity: 2 },
      { itemId: "mythic_beast_hide", quantity: 1 },
    ],
    goldCost: 280000,
    description: "A blade fashioned from the fang of a void creature.",
  },
  {
    // Rank 10 - Sovereign: rank-9 materials
    name: "Sovereign Mythic Cleaver",
    resultItemId: "forest_weapon-10",
    tier: "sovereign" as const,
    requiredRank: "Sovereign" as const,
    ingredients: [
      { itemId: "mythic_beast_hide", quantity: 2 },
      { itemId: "creature_fang", quantity: 4 },
      { itemId: "void_crystal", quantity: 3 },
    ],
    goldCost: 850000,
    description: "A cleaver clad in mythic beast hide and infused with void energy.",
  },
  {
    // Rank 11 - Ascendant: rank-11 materials (heartwood_crystal, world_tree_sap, etc.)
    name: "Ascendant Heartwood Scythe",
    resultItemId: "forest_weapon-11",
    tier: "ascendant" as const,
    requiredRank: "Ascendant" as const,
    ingredients: [
      { itemId: "heartwood_crystal", quantity: 1 },
      { itemId: "world_tree_sap", quantity: 1 },
      { itemId: "essence_of_life", quantity: 1 },
    ],
    goldCost: 2300000,
    description: "A scythe forged from the very heart of the World Tree.",
  },
  {
    // Rank 12 - Legend: rank-11 materials
    name: "Legend's Genesis Ragnarok",
    resultItemId: "forest_weapon-12",
    tier: "legend" as const,
    requiredRank: "Legend" as const,
    ingredients: [
      { itemId: "genesis_fragment", quantity: 2 },
      { itemId: "essence_of_life", quantity: 2 },
      { itemId: "heartwood_crystal", quantity: 2 },
    ],
    goldCost: 11000000,
    description: "The legendary weapon forged from genesis fragments at the forest's core.",
  },
  {
    // Rank 13 - Mythic: rank-11 materials
    name: "Mythic World-Root Obliterator",
    resultItemId: "forest_weapon-13",
    tier: "elite" as const,
    requiredRank: "Mythic" as const,
    ingredients: [
      { itemId: "primordial_seed", quantity: 3 },
      { itemId: "world_tree_sap", quantity: 3 },
      { itemId: "genesis_fragment", quantity: 3 },
    ],
    goldCost: 55000000,
    description: "A mythic weapon grown from the primordial seeds of the World Tree.",
  },
  {
    // Rank 14 - Mythical Legend: rank-11 materials
    name: "Mythical Legend's World-Root",
    resultItemId: "forest_weapon-14",
    tier: "mythical_legend" as const,
    requiredRank: "Mythical Legend" as const,
    ingredients: [
      { itemId: "genesis_fragment", quantity: 5 },
      { itemId: "essence_of_life", quantity: 5 },
      { itemId: "primordial_seed", quantity: 5 },
    ],
    goldCost: 2000000000,
    description: "The ultimate weapon born from the World Root, source of all forest life.",
  },
];

export async function initializeRecipes() {
  const existingRecipes = await db.select().from(recipes);

  const initialRecipes = [
    {
      name: "Legendary Sword of Valor",
      resultItemId: "legend-0",
      tier: "legend",
      requiredRank: "Legend",
      ingredients: [{ itemId: "normal-0", quantity: 5 }, { itemId: "super_rare-0", quantity: 2 }],
      goldCost: 100000,
      description: "A powerful sword forged from common materials and pure valor."
    },
    {
      name: "Apprentice Iron Blade",
      resultItemId: "normal-1",
      tier: "normal",
      requiredRank: "Apprentice",
      ingredients: [{ itemId: "normal-0", quantity: 2 }],
      goldCost: 500,
      description: "A sturdy iron blade for aspiring warriors."
    },
    {
      name: "Master's Worldbreaker",
      resultItemId: "master-0",
      tier: "master",
      requiredRank: "Master",
      ingredients: [{ itemId: "expert-0", quantity: 3 }, { itemId: "adept-0", quantity: 5 }],
      goldCost: 50000,
      description: "A weapon capable of shattering worlds."
    }
  ];

  const existingIds = new Set(existingRecipes.map(r => r.resultItemId));

  for (const r of initialRecipes) {
    if (!existingIds.has(r.resultItemId)) {
      await db.insert(recipes).values(r as any);
    }
  }

  for (const r of FOREST_WEAPON_RECIPES) {
    if (!existingIds.has(r.resultItemId)) {
      await db.insert(recipes).values(r as any);
    }
  }
}
