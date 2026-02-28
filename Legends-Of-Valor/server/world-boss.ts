import { db } from "./db";
import { worldBosses, worldBossDamage, accounts, playerRanks, type WorldBoss, type PlayerRank } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { spawnMonster } from "./monster-spawn";

export async function getActiveWorldBoss(): Promise<WorldBoss | null> {
  const [boss] = await db.select()
    .from(worldBosses)
    .where(eq(worldBosses.status, "active"))
    .limit(1);
  
  if (boss && new Date() > boss.expiresAt) {
    await db.update(worldBosses)
      .set({ status: "expired" })
      .where(eq(worldBosses.id, boss.id));
    return null;
  }
  
  return boss || null;
}

export async function spawnWorldBoss(manual: boolean = false): Promise<WorldBoss> {
  // HP scales with server population: HP = 10000 × playerCount
  const activePlayers = await db.select({ count: sql<number>`count(*)::int` })
    .from(accounts)
    .where(eq(accounts.role, "player"));
  
  const playerCount = activePlayers[0]?.count || 1;
  const bossRank: PlayerRank = "Mythic"; // World bosses are usually high rank
  
  // Create a powerful boss
  const totalHp = 10000 * playerCount;

  const bossStats = {
    Str: 500,
    Def: 400,
    Spd: 300,
    Int: 400,
    Luck: 200,
    Pot: 1000,
  };

  const [newBoss] = await db.insert(worldBosses).values({
    name: "Aether Devourer",
    type: "World Boss",
    rank: bossRank,
    hp: totalHp,
    maxHp: totalHp,
    stats: bossStats,
    elements: ["Void", "Aether"],
    status: "active",
    spawnedAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    location: "Astral Plane",
  }).returning();

  return newBoss;
}

export async function recordBossDamage(bossId: string, accountId: string, damage: number) {
  const [existing] = await db.select()
    .from(worldBossDamage)
    .where(and(
      eq(worldBossDamage.bossId, bossId),
      eq(worldBossDamage.accountId, accountId)
    ));

  if (existing) {
    await db.update(worldBossDamage)
      .set({ 
        damage: existing.damage + damage,
        lastHitAt: new Date()
      })
      .where(eq(worldBossDamage.id, existing.id));
  } else {
    await db.insert(worldBossDamage).values({
      bossId,
      accountId,
      damage,
    });
  }

  // Update boss HP
  const [boss] = await db.select().from(worldBosses).where(eq(worldBosses.id, bossId));
  if (boss) {
    const newHp = Math.max(0, boss.hp - damage);
    if (newHp === 0 && boss.status === "active") {
      await db.update(worldBosses)
        .set({ 
          hp: 0, 
          status: "defeated",
          defeatedAt: new Date()
        })
        .where(eq(worldBosses.id, bossId));
      
      // Distribute rewards
      await distributeBossRewards(bossId);
    } else if (boss.status === "active") {
      await db.update(worldBosses)
        .set({ hp: newHp })
        .where(eq(worldBosses.id, bossId));
    }
  }
}

async function distributeBossRewards(bossId: string) {
  const contributors = await db.select()
    .from(worldBossDamage)
    .where(eq(worldBossDamage.bossId, bossId))
    .orderBy(desc(worldBossDamage.damage));

  for (let i = 0; i < contributors.length; i++) {
    const contributor = contributors[i];
    const rank = i + 1;
    
    // Reward logic: Mythic items distributed by damage rank
    // Rare resources, "World Slayer" title
    let goldReward = 50000;
    let rubyReward = 10;
    let title = null;
    
    if (rank === 1) {
       goldReward = 500000;
       rubyReward = 100;
       title = "World Slayer";
    } else if (rank <= 3) {
       goldReward = 250000;
       rubyReward = 50;
    } else if (rank <= 10) {
       goldReward = 100000;
       rubyReward = 20;
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.id, contributor.accountId));
    if (account) {
      const updates: any = {
        gold: sql`${accounts.gold} + ${goldReward}`,
        rubies: sql`${accounts.rubies} + ${rubyReward}`
      };
      
      if (title) {
        const currentTitles = (account as any).unlockedTitles || [];
        if (!currentTitles.includes(title)) {
          updates.unlockedTitles = [...currentTitles, title];
        }
      }
      
      // Add Mythic item for top rank
      if (rank === 1) {
        // Just as an example, we could add a specific mythic item to inventory
        // But for now we just give a lot of gold/rubies as per existing logic, 
        // and a title.
      }

      await db.update(accounts)
        .set(updates)
        .where(eq(accounts.id, contributor.accountId));
    }
  }
}
