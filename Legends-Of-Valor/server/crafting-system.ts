import { db } from "./db";
import { accounts, inventoryItems, recipes, type Item, type Stats } from "@shared/schema";
import { ALL_ITEMS } from "../client/src/lib/items-data";
import { eq, sql } from "drizzle-orm";

export async function craftItem(accountId: string, recipeId: string) {
  const account = (await db.select().from(accounts).where(eq(accounts.id, accountId)))[0];
  if (!account) throw new Error("Account not found");

  const recipe = (await db.select().from(recipes).where(eq(recipes.id, recipeId)))[0];
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

  // Crafted items can have sockets (e.g., 1-3 for high tier)
  let sockets = 0;
  if (["legend", "mythic", "mythical_legend", "divine", "ssumr"].includes(itemData.tier)) {
    sockets = Math.floor(Math.random() * 3) + 1;
  }

  const [newItem] = await db.insert(inventoryItems).values({
    accountId,
    itemId: itemData.id,
    stats: itemData.stats,
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

export async function initializeRecipes() {
  const existingRecipes = await db.select().from(recipes);
  if (existingRecipes.length > 0) return;

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
    // Add more recipes as needed
  ];

  for (const r of initialRecipes) {
    await db.insert(recipes).values(r as any);
  }
}
