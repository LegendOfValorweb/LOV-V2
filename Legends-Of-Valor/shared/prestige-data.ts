// ─── Prestige / Meta-Progression System ──────────────────────────────────────
// Players who reach Mythical Legend can PRESTIGE: rank resets to Novice but
// permanent multipliers, special content, and Prestige Tokens carry forward.
// Up to 10 prestige levels, each one richer than the last.
// ─────────────────────────────────────────────────────────────────────────────

export type PrestigePerkDef = {
  level: number;
  title: string;               // special honorific unlocked
  icon: string;
  flavorText: string;
  tokens: number;              // Prestige Tokens awarded on reaching this level
  // Per-level ADDITIVE bonuses (these accumulate across prestige levels)
  statMult: number;            // +N% to all base stats (additive per level)
  goldBonus: number;           // +N% to gold rewards from all sources
  xpBonus: number;             // +N% to XP gain (rank-up speed)
  tpBonus: number;             // +N% to Training Points from fights
  critBonus: number;           // +N flat % crit chance
  lifestealBonus: number;      // +N flat % lifesteal passive
  unlockedContent: string[];   // feature names unlocked at this level
};

export const PRESTIGE_PERKS: PrestigePerkDef[] = [
  {
    level: 1, title: "Reborn", icon: "⭐", tokens: 1,
    flavorText: "You have shattered your limits and walked the path a second time. The world bends to your will.",
    statMult: 10, goldBonus: 15, xpBonus: 0,  tpBonus: 0,  critBonus: 0,   lifestealBonus: 0,
    unlockedContent: ["Prestige Shop", "Prestige Badge"],
  },
  {
    level: 2, title: "Twice-Forged", icon: "⭐⭐", tokens: 1,
    flavorText: "Twice you have walked through death and returned stronger. Legends speak of those like you.",
    statMult: 10, goldBonus: 15, xpBonus: 20, tpBonus: 0,  critBonus: 0,   lifestealBonus: 0,
    unlockedContent: ["Prestige Skill Auctions"],
  },
  {
    level: 3, title: "Thrice-Risen", icon: "🌟", tokens: 2,
    flavorText: "Three cycles of death and rebirth have carved your soul into something beyond mortal comprehension.",
    statMult: 10, goldBonus: 10, xpBonus: 20, tpBonus: 0,  critBonus: 5,   lifestealBonus: 0,
    unlockedContent: ["Prestige Dungeon"],
  },
  {
    level: 4, title: "Veteran Soul", icon: "🌟🌟", tokens: 1,
    flavorText: "Veterans respect your silence. You've seen things that break lesser warriors.",
    statMult: 10, goldBonus: 10, xpBonus: 20, tpBonus: 25, critBonus: 0,   lifestealBonus: 0,
    unlockedContent: ["Veteran Title", "Prestige Leaderboard"],
  },
  {
    level: 5, title: "Ascendant Soul", icon: "💫", tokens: 2,
    flavorText: "Halfway to legend. Your aura radiates power that lesser creatures flee from on sight.",
    statMult: 15, goldBonus: 10, xpBonus: 0,  tpBonus: 25, critBonus: 0,   lifestealBonus: 2,
    unlockedContent: ["Ancestral Crafting", "Soulbound Gear Slot"],
  },
  {
    level: 6, title: "Ancient", icon: "🔥", tokens: 2,
    flavorText: "Ancient texts record warriors of your calibre appearing once per century. You are living history.",
    statMult: 10, goldBonus: 10, xpBonus: 25, tpBonus: 50, critBonus: 5,   lifestealBonus: 0,
    unlockedContent: ["Ancient Title", "Prestige Arena"],
  },
  {
    level: 7, title: "Eternal", icon: "🔥🔥", tokens: 2,
    flavorText: "Time cannot claim you. The gods themselves wonder how you keep returning.",
    statMult: 10, goldBonus: 10, xpBonus: 0,  tpBonus: 0,  critBonus: 5,   lifestealBonus: 2,
    unlockedContent: ["Eternal Title", "Soul Resonance System"],
  },
  {
    level: 8, title: "Undying", icon: "💠", tokens: 2,
    flavorText: "The cycle of life and death means nothing to you. You are the cycle.",
    statMult: 10, goldBonus: 15, xpBonus: 25, tpBonus: 50, critBonus: 0,   lifestealBonus: 2,
    unlockedContent: ["Undying Badge", "Legend's Vault"],
  },
  {
    level: 9, title: "Myth-Walker", icon: "💠💠", tokens: 3,
    flavorText: "You don't just witness legends — you are the source of them.",
    statMult: 10, goldBonus: 10, xpBonus: 50, tpBonus: 0,  critBonus: 5,   lifestealBonus: 2,
    unlockedContent: ["Myth-Walker Title", "Prestige Endgame Challenges"],
  },
  {
    level: 10, title: "Legend Reborn", icon: "👑", tokens: 5,
    flavorText: "Ten lifetimes of battle. Ten deaths defeated. You stand at the absolute peak of mortal achievement.",
    statMult: 5,  goldBonus: 10, xpBonus: 0,  tpBonus: 50, critBonus: 5,   lifestealBonus: 2,
    unlockedContent: ["Legend Reborn Title", "Mythic Prestige Frame", "Ultimate Prestige Cosmetics"],
  },
];

// Max prestige level
export const MAX_PRESTIGE_LEVEL = 10;

// Compute CUMULATIVE bonuses at a given prestige level (0 = no bonus)
export function getCumulativePrestigeBonus(level: number): {
  statMultiplier: number;   // e.g. 1.30 means all stats ×1.30
  goldBonus: number;        // e.g. 30 means +30%
  xpBonus: number;
  tpBonus: number;
  critBonus: number;
  lifestealBonus: number;
} {
  const lvl = Math.max(0, Math.min(level, MAX_PRESTIGE_LEVEL));
  let totalStat = 0, totalGold = 0, totalXp = 0, totalTp = 0, totalCrit = 0, totalLifesteal = 0;
  for (let i = 0; i < lvl; i++) {
    const p = PRESTIGE_PERKS[i];
    totalStat      += p.statMult;
    totalGold      += p.goldBonus;
    totalXp        += p.xpBonus;
    totalTp        += p.tpBonus;
    totalCrit      += p.critBonus;
    totalLifesteal += p.lifestealBonus;
  }
  return {
    statMultiplier: 1 + totalStat / 100,
    goldBonus:      totalGold,
    xpBonus:        totalXp,
    tpBonus:        totalTp,
    critBonus:      totalCrit,
    lifestealBonus: totalLifesteal,
  };
}

// Shortcut for the stat multiplier only (most common use in combat)
export function getPrestigeStatMult(level: number): number {
  return getCumulativePrestigeBonus(level).statMultiplier;
}

// How much gold to keep on prestige (5% per level, capped at 50%)
export function getPrestigeGoldKeepPct(level: number): number {
  return Math.min(0.5, 0.05 * level);
}

// Requirement to perform prestige
export const PRESTIGE_REQUIREMENTS = {
  rank: "Mythical Legend",
  minPrestigeCooldownHours: 0, // no cooldown — just reach max rank each time
};

// ─── Prestige Shop ────────────────────────────────────────────────────────────

export type PrestigeShopItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tokenCost: number;
  minPrestige: number;      // requires at least this prestige level to buy
  category: "power" | "cosmetic" | "resource" | "special";
  reward: {
    gold?: number;
    soulShards?: number;
    trainingPoints?: number;
    rubies?: number;
    statBoostPct?: number;   // temporary: stored in account.prestigeStatBoost
    skillRarity?: string;    // "legendary" | "mythic" — grants a random skill
    cosmeticTitle?: string;
    permanentStatBonus?: number; // permanent +N% to all stats
  };
};

export const PRESTIGE_SHOP: PrestigeShopItem[] = [
  {
    id: "ps_soul_infusion", name: "Soul Infusion", icon: "💎",
    description: "Instantly receive 1,000 Soul Shards.",
    tokenCost: 1, minPrestige: 1, category: "resource",
    reward: { soulShards: 1000 },
  },
  {
    id: "ps_gold_surge", name: "Gold Surge", icon: "💰",
    description: "Instantly receive a hefty gold boost (scales with prestige level).",
    tokenCost: 1, minPrestige: 1, category: "resource",
    reward: { gold: 500_000 },
  },
  {
    id: "ps_tp_surge", name: "TP Surge", icon: "📚",
    description: "Instantly receive 200 Training Points.",
    tokenCost: 1, minPrestige: 1, category: "resource",
    reward: { trainingPoints: 200 },
  },
  {
    id: "ps_legendary_tome", name: "Legendary Tome", icon: "📖",
    description: "Grants a random Legendary skill from the auction pool.",
    tokenCost: 3, minPrestige: 2, category: "special",
    reward: { skillRarity: "legendary" },
  },
  {
    id: "ps_ruby_cache", name: "Ruby Cache", icon: "💍",
    description: "Receive 5,000 Rubies for the cosmetics and auction house.",
    tokenCost: 2, minPrestige: 2, category: "resource",
    reward: { rubies: 5000 },
  },
  {
    id: "ps_eternal_blessing", name: "Eternal Blessing", icon: "✨",
    description: "Permanently increase all your stats by +3%. Stackable up to 5 times.",
    tokenCost: 4, minPrestige: 5, category: "power",
    reward: { permanentStatBonus: 3 },
  },
  {
    id: "ps_mythic_scroll", name: "Mythic Scroll", icon: "🌟",
    description: "Grants a random Mythic skill. Extremely rare — only one can exist.",
    tokenCost: 8, minPrestige: 7, category: "special",
    reward: { skillRarity: "mythic" },
  },
  {
    id: "ps_legend_title", name: "Legend's Brand", icon: "👑",
    description: "Unlock the exclusive 'Legend's Brand' cosmetic title.",
    tokenCost: 5, minPrestige: 10, category: "cosmetic",
    reward: { cosmeticTitle: "Legend's Brand" },
  },
];
