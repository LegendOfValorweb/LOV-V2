// ─── Procedural Content Generation — Legends of Valor ───────────────────────
// Generates quests, enemies, loot, and world events from templates + rules.
// Nothing here is hardcoded content — everything is a generator.
// ─────────────────────────────────────────────────────────────────────────────

import { playerRanks } from "./schema";
type PlayerRank = typeof playerRanks[number];

// ═══════════════════════════════════════════════════════════════════════════
// REWARD SCALING
// ═══════════════════════════════════════════════════════════════════════════

/** Reward multiplier per rank — 1.3× per rank index.
 *  Novice=1×, Expert≈3.7×, Master≈4.8×, Champion≈8.2×, Mythical Legend≈28.5×
 *  Calibrated so Mythical Legend legendary quests give ~14M gold (reasonable vs lifetime income).
 */
export function rankRewardMult(rank: PlayerRank): number {
  const idx = playerRanks.indexOf(rank);
  return Math.max(1, Math.round(Math.pow(1.3, idx) * 10) / 10);
}

// Base rewards are calibrated so quests pay out 3-5× better than grinding the same activity.
// At Novice, a trivial 10-win quest gives 2000g — compares well to ~500g from natural wins.
// All values scale by rankRewardMult so they remain meaningful at every tier.
const BASE_REWARDS: Record<string, { gold: number; tp: number; shards: number; focusedShards: number; runes: number }> = {
  trivial:   { gold: 2000,    tp: 50,    shards: 10,  focusedShards: 0,  runes: 0  },
  easy:      { gold: 8000,    tp: 200,   shards: 40,  focusedShards: 1,  runes: 1  },
  medium:    { gold: 30000,   tp: 750,   shards: 150, focusedShards: 5,  runes: 5  },
  hard:      { gold: 120000,  tp: 3000,  shards: 600, focusedShards: 20, runes: 20 },
  legendary: { gold: 500000,  tp: 12000, shards: 2500,focusedShards: 80, runes: 80 },
};

export function scaleRewards(difficulty: string, rank: PlayerRank) {
  const base = BASE_REWARDS[difficulty] ?? BASE_REWARDS.medium;
  const m = rankRewardMult(rank);
  return {
    gold:          Math.round(base.gold          * m),
    trainingPoints:Math.round(base.tp            * m),
    soulShards:    Math.round(base.shards        * m),
    focusedShards: Math.round(base.focusedShards * (m > 1 ? Math.sqrt(m) : 1)),
    runes:         Math.round(base.runes         * (m > 1 ? Math.log2(m) + 1 : 1)),
    bonus: null as string | null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEST TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export type QuestObjectiveType =
  | "win_battles"    // Win X battles since acceptance (delta from account.wins)
  | "reach_rank"     // Reach a specific rank
  | "climb_floors"   // Reach NPC tower floor X (absolute)
  | "train_stat"     // Raise a stat to X value
  | "earn_gold"      // Have X gold right now
  | "collect_shards" // Have X soul shards right now
  | "upgrade_base"   // Reach base tier X
  | "reach_prestige" // Reach prestige level X
  | "defeat_npc_level"; // Reach global NPC level (floor*100+level) X

export type QuestObjective = {
  type: QuestObjectiveType;
  description: string;
  required: number;
  stat?: string;
  targetRank?: PlayerRank;
  targetRankIndex?: number;
  baseline?: { wins?: number; npcFloor?: number; npcLevel?: number; soulShards?: number };
};

export type QuestRewards = {
  gold: number;
  trainingPoints: number;
  soulShards: number;
  focusedShards: number;
  runes: number;
  bonus: string | null;
};

type QuestTemplate = {
  id: string;
  category: "combat" | "progression" | "wealth" | "exploration" | "mastery" | "fortune";
  difficulty: "trivial" | "easy" | "medium" | "hard" | "legendary";
  minRankIndex: number;
  maxRankIndex: number;
  titleFn: (params: QuestParams) => string;
  descFn: (params: QuestParams) => string;
  objectiveFn: (account: QuestAccount) => QuestObjective;
  rewardBonus?: string;
  timeLimit?: number; // hours
};

type QuestParams = { count: number; rank: string; stat: string; floor: number; tier: number };
type QuestAccount = {
  rank: PlayerRank;
  wins: number;
  npcFloor: number;
  npcLevel: number;
  stats: Record<string, number>;
  gold: number;
  soulShards: number;
  baseTier: number;
  prestigeLevel: number;
};

function rankIdx(rank: PlayerRank) { return playerRanks.indexOf(rank); }

/** Scale an integer target to player's progression level */
function scaleTarget(base: number, rank: PlayerRank, power = 1.5): number {
  return Math.max(base, Math.round(base * Math.pow(1 + rankIdx(rank) * 0.4, power)));
}

const STAT_NAMES = ["Str", "Def", "Spd", "Int", "Luck"] as const;

const QUEST_TEMPLATES: QuestTemplate[] = [
  // ── COMBAT ──────────────────────────────────────────────────────────────
  {
    id: "win_10_battles",
    category: "combat", difficulty: "trivial", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ count }) => `Warrior's Trial: ${count} Victories`,
    descFn: ({ count }) => `Prove your combat worth. Win ${count} battles — any opponent counts.`,
    objectiveFn: (a) => ({
      type: "win_battles", description: `Win ${scaleTarget(10, a.rank, 0.8)} battles`,
      required: scaleTarget(10, a.rank, 0.8),
      baseline: { wins: a.wins },
    }),
  },
  {
    id: "win_50_battles",
    category: "combat", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ count }) => `Battle-Tested: ${count} Wins`,
    descFn: ({ count }) => `The arena demands ${count} wins. Show no mercy, take no rest.`,
    objectiveFn: (a) => ({
      type: "win_battles", description: `Win ${scaleTarget(50, a.rank)} battles`,
      required: scaleTarget(50, a.rank),
      baseline: { wins: a.wins },
    }),
  },
  {
    id: "win_200_battles",
    category: "combat", difficulty: "medium", minRankIndex: 2, maxRankIndex: 14,
    titleFn: ({ count }) => `Champion's Road: ${count} Victories`,
    descFn: ({ count }) => `Only the most relentless fighters complete this challenge. Win ${count} battles.`,
    objectiveFn: (a) => ({
      type: "win_battles", description: `Win ${scaleTarget(200, a.rank)} battles`,
      required: scaleTarget(200, a.rank),
      baseline: { wins: a.wins },
    }),
  },
  {
    id: "win_500_battles",
    category: "combat", difficulty: "hard", minRankIndex: 4, maxRankIndex: 14,
    titleFn: ({ count }) => `Warlord's Mandate: ${count} Wins`,
    descFn: ({ count }) => `The Warlord's crest is awarded only after ${count} proven victories. Earn it.`,
    objectiveFn: (a) => ({
      type: "win_battles", description: `Win ${scaleTarget(500, a.rank)} battles`,
      required: scaleTarget(500, a.rank),
      baseline: { wins: a.wins },
    }),
  },
  {
    id: "win_legendary_battles",
    category: "combat", difficulty: "legendary", minRankIndex: 7, maxRankIndex: 14,
    titleFn: ({ count }) => `Legend's Gauntlet: ${count} Kills`,
    descFn: ({ count }) => `Only legends win ${count} battles. The world will remember your name.`,
    objectiveFn: (a) => ({
      type: "win_battles", description: `Win ${scaleTarget(1000, a.rank)} battles`,
      required: scaleTarget(1000, a.rank),
      baseline: { wins: a.wins },
    }),
    rewardBonus: "Legendary Combatant title",
  },

  // ── PROGRESSION ──────────────────────────────────────────────────────────
  {
    id: "reach_rank_easy",
    category: "progression", difficulty: "easy", minRankIndex: 0, maxRankIndex: 12,
    titleFn: ({ rank }) => `Rise: Reach ${rank}`,
    descFn: ({ rank }) => `Your blood calls you higher. Reach the rank of ${rank} to claim your reward.`,
    objectiveFn: (a) => {
      const targetIdx = Math.min(rankIdx(a.rank) + 2, playerRanks.length - 1);
      const targetRank = playerRanks[targetIdx];
      return { type: "reach_rank", description: `Reach ${targetRank} rank`, required: targetIdx, targetRank, targetRankIndex: targetIdx };
    },
  },
  {
    id: "reach_rank_hard",
    category: "progression", difficulty: "hard", minRankIndex: 3, maxRankIndex: 12,
    titleFn: ({ rank }) => `Ascension: The Path to ${rank}`,
    descFn: ({ rank }) => `True ascension requires reaching ${rank}. The road is long; the reward is legendary.`,
    objectiveFn: (a) => {
      const targetIdx = Math.min(rankIdx(a.rank) + 4, playerRanks.length - 1);
      const targetRank = playerRanks[targetIdx];
      return { type: "reach_rank", description: `Reach ${targetRank} rank`, required: targetIdx, targetRank, targetRankIndex: targetIdx };
    },
    rewardBonus: "+500 bonus Training Points",
    timeLimit: 72,
  },
  {
    id: "climb_tower_easy",
    category: "progression", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ floor }) => `Tower Climber: Floor ${floor}`,
    descFn: ({ floor }) => `Conquer the tower up to floor ${floor}. Each floor you climb makes you stronger.`,
    objectiveFn: (a) => {
      const targetFloor = Math.min(50, a.npcFloor + 2);
      const targetLevel = targetFloor * 100;
      return { type: "climb_floors", description: `Reach NPC tower floor ${targetFloor}`, required: targetLevel, baseline: { npcFloor: a.npcFloor, npcLevel: a.npcLevel } };
    },
  },
  {
    id: "climb_tower_hard",
    category: "progression", difficulty: "hard", minRankIndex: 2, maxRankIndex: 14,
    titleFn: ({ floor }) => `Tower Conqueror: Floor ${floor}`,
    descFn: ({ floor }) => `The tower depths beyond floor ${floor} hold power few dare to seek.`,
    objectiveFn: (a) => {
      const targetFloor = Math.min(50, a.npcFloor + 6);
      const targetLevel = targetFloor * 100;
      return { type: "climb_floors", description: `Reach NPC tower floor ${targetFloor}`, required: targetLevel, baseline: { npcFloor: a.npcFloor, npcLevel: a.npcLevel } };
    },
    rewardBonus: "Tower Explorer title",
  },
  {
    id: "climb_tower_legendary",
    category: "progression", difficulty: "legendary", minRankIndex: 5, maxRankIndex: 14,
    titleFn: ({ floor }) => `Tower Sovereign: Floor ${floor}`,
    descFn: ({ floor }) => `Reach floor ${floor} of the Eternal Tower. The summit is reserved for legends.`,
    objectiveFn: (a) => {
      const targetFloor = Math.min(50, a.npcFloor + 15);
      const targetLevel = targetFloor * 100;
      return { type: "climb_floors", description: `Reach NPC tower floor ${targetFloor}`, required: targetLevel, baseline: { npcFloor: a.npcFloor } };
    },
    rewardBonus: "Tower Sovereign title",
    timeLimit: 168,
  },

  // ── STAT TRAINING ─────────────────────────────────────────────────────────
  {
    id: "train_str",
    category: "mastery", difficulty: "medium", minRankIndex: 0, maxRankIndex: 14,
    titleFn: () => `Iron Fists: Strength Training`,
    descFn: ({ count }) => `Your fists are your fortune. Raise your Strength to ${count}.`,
    objectiveFn: (a) => {
      const target = scaleTarget(Math.max(50, (a.stats.Str || 10) + 30), a.rank, 0.5);
      return { type: "train_stat", stat: "Str", description: `Raise Strength to ${target}`, required: target };
    },
  },
  {
    id: "train_def",
    category: "mastery", difficulty: "medium", minRankIndex: 0, maxRankIndex: 14,
    titleFn: () => `Iron Wall: Defence Training`,
    descFn: ({ count }) => `An unbreakable defence is worth a thousand swords. Raise Defence to ${count}.`,
    objectiveFn: (a) => {
      const target = scaleTarget(Math.max(50, (a.stats.Def || 10) + 30), a.rank, 0.5);
      return { type: "train_stat", stat: "Def", description: `Raise Defence to ${target}`, required: target };
    },
  },
  {
    id: "train_spd",
    category: "mastery", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: () => `Wind Runner: Speed Training`,
    descFn: ({ count }) => `Speed is life. Train your Speed stat to ${count}.`,
    objectiveFn: (a) => {
      const target = scaleTarget(Math.max(50, (a.stats.Spd || 10) + 25), a.rank, 0.5);
      return { type: "train_stat", stat: "Spd", description: `Raise Speed to ${target}`, required: target };
    },
  },
  {
    id: "train_int",
    category: "mastery", difficulty: "medium", minRankIndex: 0, maxRankIndex: 14,
    titleFn: () => `Arcane Scholar: Intelligence`,
    descFn: ({ count }) => `Magic bends to the brilliant mind. Raise Intelligence to ${count}.`,
    objectiveFn: (a) => {
      const target = scaleTarget(Math.max(50, (a.stats.Int || 10) + 30), a.rank, 0.5);
      return { type: "train_stat", stat: "Int", description: `Raise Intelligence to ${target}`, required: target };
    },
  },
  {
    id: "train_luck",
    category: "fortune", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: () => `Fortune's Favourite: Luck Training`,
    descFn: ({ count }) => `The stars favour the prepared. Raise your Luck to ${count}.`,
    objectiveFn: (a) => {
      const target = scaleTarget(Math.max(50, (a.stats.Luck || 10) + 25), a.rank, 0.5);
      return { type: "train_stat", stat: "Luck", description: `Raise Luck to ${target}`, required: target };
    },
  },
  {
    id: "train_all_stats_hard",
    category: "mastery", difficulty: "hard", minRankIndex: 3, maxRankIndex: 14,
    titleFn: () => `Complete Mastery: Balanced Build`,
    descFn: ({ count }) => `True mastery is balanced. Raise ALL five stats above ${count}.`,
    objectiveFn: (a) => {
      const lowest = Math.min(...STAT_NAMES.map(s => a.stats[s] || 10));
      const target = scaleTarget(Math.max(80, lowest + 50), a.rank, 0.4);
      return { type: "train_stat", stat: "Str", description: `Raise all stats to ${target} (check Str as proxy)`, required: target };
    },
    rewardBonus: "Balanced Warrior title",
  },

  // ── WEALTH ────────────────────────────────────────────────────────────────
  {
    id: "earn_gold_easy",
    category: "wealth", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ count }) => `Gold Rush: ${count.toLocaleString()}g`,
    descFn: ({ count }) => `The treasury is empty. Accumulate ${count.toLocaleString()} gold.`,
    objectiveFn: (a) => {
      const target = scaleTarget(5000, a.rank, 1.2);
      return { type: "earn_gold", description: `Hold ${target.toLocaleString()} gold`, required: target };
    },
  },
  {
    id: "earn_gold_medium",
    category: "wealth", difficulty: "medium", minRankIndex: 2, maxRankIndex: 14,
    titleFn: ({ count }) => `Merchant Lord: ${count.toLocaleString()}g`,
    descFn: ({ count }) => `A merchant lord holds no less than ${count.toLocaleString()} gold in reserve.`,
    objectiveFn: (a) => {
      const target = scaleTarget(25000, a.rank, 1.3);
      return { type: "earn_gold", description: `Hold ${target.toLocaleString()} gold`, required: target };
    },
  },
  {
    id: "earn_gold_hard",
    category: "wealth", difficulty: "hard", minRankIndex: 4, maxRankIndex: 14,
    titleFn: ({ count }) => `Dragon's Hoard: ${count.toLocaleString()}g`,
    descFn: ({ count }) => `Even dragons are envious of ${count.toLocaleString()} gold. Build your hoard.`,
    objectiveFn: (a) => {
      const target = scaleTarget(150000, a.rank, 1.5);
      return { type: "earn_gold", description: `Hold ${target.toLocaleString()} gold`, required: target };
    },
    rewardBonus: "Dragon Hoarder title",
  },
  {
    id: "collect_shards_easy",
    category: "wealth", difficulty: "easy", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ count }) => `Shard Collector: ${count} Shards`,
    descFn: ({ count }) => `Soul shards hold tremendous power. Accumulate ${count} soul shards.`,
    objectiveFn: (a) => {
      const target = scaleTarget(50, a.rank, 1.0);
      return { type: "collect_shards", description: `Hold ${target} soul shards`, required: target };
    },
  },
  {
    id: "collect_shards_hard",
    category: "wealth", difficulty: "hard", minRankIndex: 3, maxRankIndex: 14,
    titleFn: ({ count }) => `Shard Sovereign: ${count} Shards`,
    descFn: ({ count }) => `The Shard Sovereign commands ${count} soul shards. Prove your worth.`,
    objectiveFn: (a) => {
      const target = scaleTarget(500, a.rank, 1.2);
      return { type: "collect_shards", description: `Hold ${target} soul shards`, required: target };
    },
  },

  // ── BASE BUILDING / PRESTIGE ──────────────────────────────────────────────
  {
    id: "upgrade_base_2",
    category: "exploration", difficulty: "easy", minRankIndex: 0, maxRankIndex: 5,
    titleFn: () => `Home Builder: Upgrade Your Base`,
    descFn: ({ tier }) => `A warrior without a home is merely a wanderer. Upgrade your Base to Tier ${tier}.`,
    objectiveFn: (a) => {
      const target = Math.min(5, a.baseTier + 1);
      return { type: "upgrade_base", description: `Reach Base Tier ${target}`, required: target };
    },
  },
  {
    id: "upgrade_base_hard",
    category: "exploration", difficulty: "hard", minRankIndex: 2, maxRankIndex: 14,
    titleFn: () => `Castle Lord: Fortress of Power`,
    descFn: ({ tier }) => `Your fortress defines your legacy. Expand your Base to Tier ${tier}.`,
    objectiveFn: (a) => {
      const target = Math.min(5, Math.max(3, a.baseTier + 2));
      return { type: "upgrade_base", description: `Reach Base Tier ${target}`, required: target };
    },
    rewardBonus: "Castle Lord title",
  },
  {
    id: "prestige_first",
    category: "mastery", difficulty: "legendary", minRankIndex: 13, maxRankIndex: 14,
    titleFn: () => `The Great Rebirth: First Prestige`,
    descFn: () => `The ultimate trial — sacrifice your progress to emerge transformed. Achieve Prestige Level 1.`,
    objectiveFn: (_a) => ({
      type: "reach_prestige", description: "Reach Prestige Level 1", required: 1,
    }),
    rewardBonus: "Prestige Pioneer title",
  },
  {
    id: "prestige_deep",
    category: "mastery", difficulty: "legendary", minRankIndex: 14, maxRankIndex: 14,
    titleFn: ({ count }) => `Eternal Cycle: Prestige ${count}`,
    descFn: ({ count }) => `You who have walked the cycle — reach Prestige ${count} and transcend mortality.`,
    objectiveFn: (a) => {
      const target = a.prestigeLevel + 2;
      return { type: "reach_prestige", description: `Reach Prestige Level ${target}`, required: target };
    },
    rewardBonus: "Eternal Cycler title",
  },

  // ── EXPLORATION / NPC COMBAT ──────────────────────────────────────────────
  {
    id: "defeat_npc_medium",
    category: "exploration", difficulty: "medium", minRankIndex: 0, maxRankIndex: 14,
    titleFn: ({ count }) => `Tower Slayer: NPC Level ${count}`,
    descFn: ({ count }) => `The Tower Guardian at level ${count} awaits. Defeat them to claim your prize.`,
    objectiveFn: (a) => {
      const current = (a.npcFloor - 1) * 100 + a.npcLevel;
      const target = current + scaleTarget(50, a.rank, 0.6);
      return { type: "defeat_npc_level", description: `Reach NPC level ${target} in the Tower`, required: target };
    },
  },
  {
    id: "defeat_npc_hard",
    category: "exploration", difficulty: "hard", minRankIndex: 2, maxRankIndex: 14,
    titleFn: ({ count }) => `Deep Delver: NPC Level ${count}`,
    descFn: ({ count }) => `Deep in the tower at level ${count}, something ancient stirs. Conquer it.`,
    objectiveFn: (a) => {
      const current = (a.npcFloor - 1) * 100 + a.npcLevel;
      const target = current + scaleTarget(150, a.rank, 0.7);
      return { type: "defeat_npc_level", description: `Reach NPC level ${target} in the Tower`, required: target };
    },
  },
];

export { QUEST_TEMPLATES };

// ─── Board Generator ─────────────────────────────────────────────────────────

export type GeneratedQuest = {
  id: string;
  templateId: string;
  category: string;
  difficulty: string;
  title: string;
  description: string;
  objective: QuestObjective;
  rewards: QuestRewards;
  timeLimit: number | null;
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function generateQuestBoard(account: QuestAccount, count = 6, seed?: number): GeneratedQuest[] {
  const rng = seededRandom(seed ?? Date.now() % 999983);
  const rankIndex = playerRanks.indexOf(account.rank);

  const eligible = QUEST_TEMPLATES.filter(t =>
    rankIndex >= t.minRankIndex && rankIndex <= t.maxRankIndex
  );

  // Target distribution: 2 trivial/easy, 2 medium, 1 hard, 1 legendary (adjusted by rank)
  const targets: string[] = [];
  if (rankIndex < 3) {
    targets.push("trivial","trivial","easy","easy","medium","medium");
  } else if (rankIndex < 7) {
    targets.push("trivial","easy","easy","medium","hard","medium");
  } else {
    targets.push("easy","medium","medium","hard","hard","legendary");
  }

  const chosen: QuestTemplate[] = [];
  const usedIds = new Set<string>();

  for (const diff of targets.slice(0, count)) {
    const pool = eligible.filter(t => t.difficulty === diff && !usedIds.has(t.id));
    const fallback = eligible.filter(t => !usedIds.has(t.id));
    const source = pool.length > 0 ? pool : fallback;
    if (source.length === 0) continue;
    const pick = source[Math.floor(rng() * source.length)];
    usedIds.add(pick.id);
    chosen.push(pick);
  }

  // Fill remaining slots if needed
  while (chosen.length < count) {
    const remaining = eligible.filter(t => !usedIds.has(t.id));
    if (remaining.length === 0) break;
    const pick = remaining[Math.floor(rng() * remaining.length)];
    usedIds.add(pick.id);
    chosen.push(pick);
  }

  return chosen.map((template, i) => {
    const obj = template.objectiveFn(account);
    const rewards = {
      ...scaleRewards(template.difficulty, account.rank),
      bonus: template.rewardBonus ?? null,
    };
    const params: QuestParams = {
      count: obj.required,
      rank: obj.targetRank ?? account.rank,
      stat: obj.stat ?? "Str",
      floor: obj.required,
      tier: obj.required,
    };
    return {
      id: `gen-${Date.now()}-${i}`,
      templateId: template.id,
      category: template.category,
      difficulty: template.difficulty,
      title: template.titleFn(params),
      description: template.descFn(params),
      objective: obj,
      rewards,
      timeLimit: template.timeLimit ?? null,
    };
  });
}

// ─── Quest Validation ─────────────────────────────────────────────────────────

export function validateQuestProgress(
  objective: QuestObjective,
  account: QuestAccount
): { complete: boolean; current: number; required: number } {
  const required = objective.required;
  let current = 0;

  switch (objective.type) {
    case "win_battles": {
      const base = objective.baseline?.wins ?? 0;
      current = Math.max(0, account.wins - base);
      break;
    }
    case "reach_rank":
      current = playerRanks.indexOf(account.rank);
      break;
    case "climb_floors":
      current = (account.npcFloor - 1) * 100 + account.npcLevel;
      break;
    case "defeat_npc_level":
      current = (account.npcFloor - 1) * 100 + account.npcLevel;
      break;
    case "train_stat":
      current = account.stats[objective.stat ?? "Str"] ?? 0;
      break;
    case "earn_gold":
      current = account.gold;
      break;
    case "collect_shards":
      current = account.soulShards;
      break;
    case "upgrade_base":
      current = account.baseTier;
      break;
    case "reach_prestige":
      current = account.prestigeLevel;
      break;
  }

  return { complete: current >= required, current, required };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENEMY ARCHETYPES & GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export type EnemyArchetype = {
  id: string;
  family: string;
  names: string[];
  icon: string;
  statRatios: { Str: number; Def: number; Spd: number; Int: number; Luck: number };
  abilities: string[];
  immunities: string[];
  lootTier: "common" | "uncommon" | "rare" | "epic";
  description: string;
};

export const ENEMY_ARCHETYPES: EnemyArchetype[] = [
  // ── Undead ──────────────────────────────────────────────────────────────
  {
    id: "skeleton", family: "Undead", icon: "💀",
    names: ["Skeleton Warrior", "Bone Archer", "Rattling Guard", "Ancient Skeleton"],
    statRatios: { Str: 0.9, Def: 0.7, Spd: 0.8, Int: 0.4, Luck: 0.5 },
    abilities: ["Bone Shield", "Rattle Strike", "Undying Resolve"],
    immunities: ["Poison", "Sleep"], lootTier: "common",
    description: "The animated bones of fallen warriors, driven by an ancient grudge.",
  },
  {
    id: "zombie", family: "Undead", icon: "🧟",
    names: ["Shambling Zombie", "Plague Carrier", "Rotting Brute", "Corpse Giant"],
    statRatios: { Str: 1.1, Def: 0.9, Spd: 0.5, Int: 0.2, Luck: 0.3 },
    abilities: ["Infectious Bite", "Relentless Advance", "Plague Aura"],
    immunities: ["Poison", "Fear"], lootTier: "common",
    description: "Slow but unstoppable — their bites carry curses older than kingdoms.",
  },
  {
    id: "lich", family: "Undead", icon: "🔮",
    names: ["Lich Apprentice", "Death Mage", "Soul Binder", "Bone Sorcerer"],
    statRatios: { Str: 0.6, Def: 0.8, Spd: 0.7, Int: 1.5, Luck: 0.9 },
    abilities: ["Soul Drain", "Death Bolt", "Curse of Ages", "Phylactery Shield"],
    immunities: ["Poison", "Curse", "Sleep"], lootTier: "rare",
    description: "Sorcerers who cheated death — and now wield it as a weapon.",
  },
  // ── Beast ────────────────────────────────────────────────────────────────
  {
    id: "wolf", family: "Beast", icon: "🐺",
    names: ["Dire Wolf", "Pack Alpha", "Shadow Wolf", "Frost Fang"],
    statRatios: { Str: 1.0, Def: 0.6, Spd: 1.4, Int: 0.4, Luck: 0.7 },
    abilities: ["Pack Howl", "Feral Lunge", "Rend"],
    immunities: [], lootTier: "common",
    description: "The apex predators of the wild — more cunning than they appear.",
  },
  {
    id: "bear", family: "Beast", icon: "🐻",
    names: ["Cave Bear", "Dire Bear", "Ironhide Grizzly", "Bloodmaw"],
    statRatios: { Str: 1.3, Def: 1.1, Spd: 0.7, Int: 0.3, Luck: 0.5 },
    abilities: ["Maul", "Bear Charge", "Thick Hide"],
    immunities: ["Stun"], lootTier: "uncommon",
    description: "Their hide deflects arrows; their claws split steel.",
  },
  {
    id: "wyvern", family: "Beast", icon: "🦎",
    names: ["Forest Wyvern", "Venomtail", "Stone Scale Wyvern", "Obsidian Wyvern"],
    statRatios: { Str: 1.1, Def: 0.9, Spd: 1.2, Int: 0.6, Luck: 0.7 },
    abilities: ["Poison Sting", "Wing Slash", "Venom Shroud"],
    immunities: ["Poison"], lootTier: "rare",
    description: "Lesser cousins of dragons — but no less deadly in the right hands.",
  },
  // ── Elemental ────────────────────────────────────────────────────────────
  {
    id: "fire_elemental", family: "Elemental", icon: "🔥",
    names: ["Flame Sprite", "Ember Wraith", "Inferno Core", "Magma Titan"],
    statRatios: { Str: 1.2, Def: 0.7, Spd: 1.0, Int: 1.1, Luck: 0.6 },
    abilities: ["Burning Touch", "Flame Burst", "Wildfire Aura"],
    immunities: ["Fire", "Burn"], lootTier: "uncommon",
    description: "Primordial fire given will — their touch scorches the soul, not just the flesh.",
  },
  {
    id: "stone_golem", family: "Elemental", icon: "🗿",
    names: ["Stone Golem", "Iron Sentinel", "Crystal Warden", "Adamantine Colossus"],
    statRatios: { Str: 1.0, Def: 1.6, Spd: 0.4, Int: 0.4, Luck: 0.4 },
    abilities: ["Stone Fist", "Earthen Armor", "Tremor Stomp"],
    immunities: ["Stun", "Freeze", "Poison"], lootTier: "uncommon",
    description: "Animated from quarried mountains — near-indestructible and utterly relentless.",
  },
  {
    id: "storm_harpy", family: "Elemental", icon: "⚡",
    names: ["Storm Harpy", "Lightning Banshee", "Tempest Weaver", "Thunder Queen"],
    statRatios: { Str: 0.9, Def: 0.6, Spd: 1.5, Int: 1.2, Luck: 0.9 },
    abilities: ["Lightning Strike", "Wind Cutter", "Static Charge", "Gale Shriek"],
    immunities: ["Lightning", "Wind"], lootTier: "rare",
    description: "Born from storms over the Northern Sea — their screams shatter eardrums.",
  },
  {
    id: "ice_titan", family: "Elemental", icon: "❄️",
    names: ["Ice Titan", "Frost Colossus", "Glacial Wraith", "Absolute Zero"],
    statRatios: { Str: 1.2, Def: 1.2, Spd: 0.6, Int: 1.0, Luck: 0.7 },
    abilities: ["Blizzard Fist", "Frost Aura", "Glacier Crash", "Absolute Freeze"],
    immunities: ["Ice", "Freeze", "Slow"], lootTier: "epic",
    description: "Ancient ice given terrible form — a touch of their hand causes instant frostbite.",
  },
  // ── Demon ───────────────────────────────────────────────────────────────
  {
    id: "imp", family: "Demon", icon: "😈",
    names: ["Imp", "Mischief Fiend", "Shadow Imp", "Chaos Sprite"],
    statRatios: { Str: 0.7, Def: 0.5, Spd: 1.3, Int: 0.9, Luck: 1.1 },
    abilities: ["Trickster's Strike", "Hex", "Vanish"],
    immunities: ["Fear"], lootTier: "common",
    description: "Small, fast, and infuriating — their hexes can cripple unprepared fighters.",
  },
  {
    id: "hellhound", family: "Demon", icon: "🐕",
    names: ["Hellhound", "Abyssal Hound", "Brimstone Stalker", "Soul Hound"],
    statRatios: { Str: 1.2, Def: 0.7, Spd: 1.3, Int: 0.5, Luck: 0.8 },
    abilities: ["Hellfire Bite", "Tracking Howl", "Smoldering Claws"],
    immunities: ["Fire", "Fear"], lootTier: "uncommon",
    description: "Bred in the Abyss to hunt souls — once they lock onto a scent, they never stop.",
  },
  {
    id: "daemon", family: "Demon", icon: "👹",
    names: ["Daemon", "Blood Daemon", "Void Herald", "Archfiend Thrall"],
    statRatios: { Str: 1.3, Def: 1.0, Spd: 0.9, Int: 1.2, Luck: 0.7 },
    abilities: ["Soul Rend", "Demonic Surge", "Corruption Aura", "Hellfire Burst"],
    immunities: ["Fire", "Curse", "Fear"], lootTier: "rare",
    description: "Greater demons who have broken free from the Abyss — they feed on despair.",
  },
  // ── Dragon ──────────────────────────────────────────────────────────────
  {
    id: "drake", family: "Dragon", icon: "🐲",
    names: ["Forest Drake", "Sea Drake", "Mountain Drake", "Shadow Drake"],
    statRatios: { Str: 1.1, Def: 0.9, Spd: 1.0, Int: 0.7, Luck: 0.8 },
    abilities: ["Claw Swipe", "Wing Buffet", "Drake Breath"],
    immunities: [], lootTier: "uncommon",
    description: "Young dragons with only a fraction of their elder kin's power — still deadly.",
  },
  {
    id: "elder_dragon", family: "Dragon", icon: "🐉",
    names: ["Elder Dragon", "Primordial Wyrm", "Ancient Devastator", "World-Ender"],
    statRatios: { Str: 1.5, Def: 1.3, Spd: 0.9, Int: 1.4, Luck: 1.0 },
    abilities: ["Inferno Breath", "Dragon's Wrath", "Ancient Scale", "World-Rending Claw", "Terrorize"],
    immunities: ["Fire", "Fear", "Stun", "Freeze"], lootTier: "epic",
    description: "Living mountains that have seen empires rise and fall — and are unimpressed by both.",
  },
  // ── Humanoid ────────────────────────────────────────────────────────────
  {
    id: "bandit", family: "Humanoid", icon: "🗡️",
    names: ["Road Bandit", "Cutthroat", "Desperate Raider", "Hired Knife"],
    statRatios: { Str: 0.9, Def: 0.7, Spd: 1.1, Int: 0.6, Luck: 0.9 },
    abilities: ["Ambush", "Backstab", "Dirty Trick"],
    immunities: [], lootTier: "common",
    description: "Opportunistic and cowardly in isolation — terrifying in numbers.",
  },
  {
    id: "dark_knight", family: "Humanoid", icon: "⚔️",
    names: ["Dark Knight", "Fallen Paladin", "Shadow Champion", "Void Crusader"],
    statRatios: { Str: 1.2, Def: 1.2, Spd: 0.8, Int: 0.9, Luck: 0.6 },
    abilities: ["Shield Bash", "Dark Slash", "Unholy Armor", "Condemn"],
    immunities: ["Fear"], lootTier: "rare",
    description: "Warriors who sold their honour for power — they paid a price they do not regret.",
  },
  {
    id: "assassin", family: "Humanoid", icon: "🥷",
    names: ["Guild Assassin", "Shadow Stalker", "Void Dancer", "Death's Emissary"],
    statRatios: { Str: 1.1, Def: 0.6, Spd: 1.5, Int: 0.8, Luck: 1.2 },
    abilities: ["Shadowstep", "Lethal Strike", "Poison Blade", "Vanishing Act", "Assassinate"],
    immunities: ["Stun", "Slow"], lootTier: "rare",
    description: "Hired for a single purpose — they complete it with economical brutality.",
  },
  {
    id: "warlord", family: "Humanoid", icon: "🛡️",
    names: ["Barbarian Warlord", "Iron Warlord", "Siege Commander", "Chaos Marshal"],
    statRatios: { Str: 1.4, Def: 1.1, Spd: 0.9, Int: 0.8, Luck: 0.7 },
    abilities: ["War Cry", "Berserker Charge", "Iron Will", "Rally the Dead"],
    immunities: ["Fear", "Stun"], lootTier: "epic",
    description: "Conquerors who have broken a hundred kingdoms — your base is their next target.",
  },
];

export type GeneratedEnemy = {
  id: string;
  name: string;
  icon: string;
  family: string;
  archetype: string;
  difficulty: string;
  stats: { Str: number; Def: number; Spd: number; Int: number; Luck: number; HP: number };
  abilities: string[];
  immunities: string[];
  lootTier: string;
  description: string;
  powerRating: number;
};

/** Generate a single enemy scaled to a player's rank and requested difficulty */
export function generateEnemy(
  rank: PlayerRank, difficulty: "easy" | "medium" | "hard" | "boss", archetypeId?: string, seed?: number
): GeneratedEnemy {
  const rng = seededRandom(seed ?? Date.now() % 999983);
  const rankIndex = playerRanks.indexOf(rank);
  const arch = archetypeId
    ? ENEMY_ARCHETYPES.find(a => a.id === archetypeId) ?? ENEMY_ARCHETYPES[Math.floor(rng() * ENEMY_ARCHETYPES.length)]
    : ENEMY_ARCHETYPES[Math.floor(rng() * ENEMY_ARCHETYPES.length)];

  const diffMult: Record<string, number> = { easy: 0.7, medium: 1.0, hard: 1.4, boss: 2.2 };
  const basePower = 10 * Math.pow(2.5, rankIndex) * (diffMult[difficulty] ?? 1.0);
  const jitter = 0.9 + rng() * 0.2; // ±10% variance

  const stats = {
    Str:  Math.round(basePower * arch.statRatios.Str  * jitter),
    Def:  Math.round(basePower * arch.statRatios.Def  * jitter),
    Spd:  Math.round(basePower * arch.statRatios.Spd  * jitter),
    Int:  Math.round(basePower * arch.statRatios.Int  * jitter),
    Luck: Math.round(basePower * arch.statRatios.Luck * jitter),
    HP:   Math.round(basePower * 8 * jitter),
  };

  const numAbilities = difficulty === "boss" ? arch.abilities.length : Math.min(arch.abilities.length, 2 + Math.floor(rankIndex / 3));
  const shuffled = [...arch.abilities].sort(() => rng() - 0.5);
  const abilities = shuffled.slice(0, numAbilities);

  const name = arch.names[Math.floor(rng() * arch.names.length)];
  const prefix = difficulty === "boss" ? "Ancient " : difficulty === "hard" ? "Veteran " : "";
  const powerRating = Object.values(stats).reduce((a, b) => a + b, 0);

  return {
    id: `enemy-${arch.id}-${seed ?? Date.now()}`,
    name: `${prefix}${name}`,
    icon: arch.icon,
    family: arch.family,
    archetype: arch.id,
    difficulty,
    stats,
    abilities,
    immunities: arch.immunities,
    lootTier: difficulty === "boss" || difficulty === "hard" ? "epic" : arch.lootTier,
    description: arch.description,
    powerRating,
  };
}

/** Generate an encounter (1–4 enemies) matching difficulty and rank */
export function generateEncounter(
  rank: PlayerRank, zone: string, difficulty: "easy" | "medium" | "hard" | "boss"
): GeneratedEnemy[] {
  const seed = Math.abs(zone.split("").reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0));
  const rng = seededRandom(seed + Date.now() % 9999);

  const counts: Record<string, number> = { easy: 1, medium: 2, hard: 3, boss: 1 };
  const count = counts[difficulty] ?? 1;

  return Array.from({ length: count }, (_, i) =>
    generateEnemy(rank, difficulty === "boss" && i === 0 ? "boss" : difficulty, undefined, seed + i)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOT TABLES
// ═══════════════════════════════════════════════════════════════════════════

export type LootBundle = {
  gold: number;
  trainingPoints: number;
  soulShards: number;
  focusedShards: number;
  runes: number;
  items: string[];
};

const LOOT_TIER_BASES = {
  common:   { gold: 200,    tp: 2,    shards: 1,  focused: 0, runes: 0 },
  uncommon: { gold: 800,    tp: 8,    shards: 4,  focused: 0, runes: 1 },
  rare:     { gold: 3000,   tp: 30,   shards: 15, focused: 1, runes: 4 },
  epic:     { gold: 12000,  tp: 120,  shards: 60, focused: 5, runes: 15 },
  legendary:{ gold: 50000,  tp: 500,  shards: 250,focused: 20,runes: 60 },
};

const ITEM_NAMES_BY_TIER: Record<string, string[]> = {
  common:    ["Tattered Cloth", "Iron Shard", "Cracked Bone", "Common Herb"],
  uncommon:  ["Reinforced Leather", "Polished Fang", "Mana Crystal", "Spirit Essence"],
  rare:      ["Enchanted Gauntlet", "Shadow Silk", "Arcane Dust", "Ember Core"],
  epic:      ["Void-Touched Relic", "Dragon Scale Fragment", "Soul Prism", "Ancient Artefact"],
  legendary: ["Primordial Core", "World-Shard", "Legend's Echo", "Mythic Remnant"],
};

export function rollLoot(tier: string, rank: PlayerRank, seed?: number): LootBundle {
  const rng = seededRandom(seed ?? Date.now() % 99991);
  const base = LOOT_TIER_BASES[tier as keyof typeof LOOT_TIER_BASES] ?? LOOT_TIER_BASES.common;
  const m = rankRewardMult(rank);
  const jitter = 0.8 + rng() * 0.4;

  const items: string[] = [];
  const names = ITEM_NAMES_BY_TIER[tier] ?? ITEM_NAMES_BY_TIER.common;
  if (rng() > 0.5) items.push(names[Math.floor(rng() * names.length)]);
  if (tier === "epic" || tier === "legendary") {
    const betterNames = ITEM_NAMES_BY_TIER[tier === "epic" ? "rare" : "epic"];
    if (rng() > 0.6) items.push(betterNames[Math.floor(rng() * betterNames.length)]);
  }

  return {
    gold:          Math.round(base.gold    * m * jitter),
    trainingPoints:Math.round(base.tp      * m * jitter),
    soulShards:    Math.round(base.shards  * m * jitter),
    focusedShards: Math.round(base.focused * Math.sqrt(m) * jitter),
    runes:         Math.round(base.runes   * Math.log2(m + 1) * jitter),
    items,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export type WorldEventType = {
  id: string;
  name: string;
  icon: string;
  description: string;
  effects: WorldEventEffects;
  durationHours: number;
  minRankIndex: number;
  color: string;
};

export type WorldEventEffects = {
  goldMult?: number;
  xpMult?: number;
  shardMult?: number;
  tpMult?: number;
  runeMult?: number;
  luckBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  pvpGoldMult?: number;
  skillDamageMult?: number;
  hpMult?: number;
  label: string;
};

export const WORLD_EVENT_TYPES: WorldEventType[] = [
  {
    id: "golden_surge", name: "Golden Surge", icon: "💰",
    description: "A tidal wave of fortune floods the land. Gold from all sources is doubled.",
    effects: { goldMult: 2.0, label: "2× Gold" }, durationHours: 4, minRankIndex: 0,
    color: "from-yellow-900 to-amber-900",
  },
  {
    id: "shard_rain", name: "Shard Rain", icon: "💎",
    description: "Soul shards fall like rain from a rift in the heavens.",
    effects: { shardMult: 2.5, label: "2.5× Soul Shards" }, durationHours: 3, minRankIndex: 0,
    color: "from-cyan-900 to-teal-900",
  },
  {
    id: "training_surge", name: "Surge of Wisdom", icon: "📚",
    description: "An ancient blessing sharpens minds across the realm. Training yields more progress.",
    effects: { xpMult: 1.8, tpMult: 1.8, label: "1.8× XP & Training" }, durationHours: 6, minRankIndex: 0,
    color: "from-blue-900 to-indigo-900",
  },
  {
    id: "monster_surge", name: "Monster Surge", icon: "🐉",
    description: "Emboldened creatures roam the land — more dangerous, but carrying richer plunder.",
    effects: { goldMult: 1.5, shardMult: 2.0, hpMult: 1.5, label: "+50% Loot, +50% Enemy HP" }, durationHours: 3, minRankIndex: 1,
    color: "from-red-900 to-rose-900",
  },
  {
    id: "pvp_frenzy", name: "PvP Frenzy", icon: "⚔️",
    description: "The Warchief has declared open season. PvP gold gains are doubled.",
    effects: { pvpGoldMult: 2.0, label: "2× PvP Gold" }, durationHours: 4, minRankIndex: 2,
    color: "from-orange-900 to-red-900",
  },
  {
    id: "arcane_blessing", name: "Arcane Blessing", icon: "🌌",
    description: "Ley lines pulse with power — skills strike harder than ever.",
    effects: { skillDamageMult: 1.5, label: "+50% Skill Damage" }, durationHours: 2, minRankIndex: 1,
    color: "from-purple-900 to-violet-900",
  },
  {
    id: "fortune_smile", name: "Fortune's Smile", icon: "🍀",
    description: "The goddess of luck smiles upon the realm. All players gain a temporary Luck surge.",
    effects: { luckBonus: 50, shardMult: 1.5, label: "+50 Luck, 1.5× Shards" }, durationHours: 2, minRankIndex: 0,
    color: "from-emerald-900 to-green-900",
  },
  {
    id: "warlord_march", name: "Warlord's March", icon: "🛡️",
    description: "The war drums thunder. All warriors fight with renewed ferocity.",
    effects: { atkBonus: 0.25, label: "+25% ATK in all combat" }, durationHours: 3, minRankIndex: 3,
    color: "from-rose-900 to-pink-900",
  },
  {
    id: "stone_skin", name: "Stone Skin Blessing", icon: "🪨",
    description: "The earth goddess hardens the skin of her champions.",
    effects: { defBonus: 0.30, hpMult: 1.2, label: "+30% DEF, +20% HP" }, durationHours: 4, minRankIndex: 2,
    color: "from-stone-900 to-gray-900",
  },
  {
    id: "rune_tide", name: "Rune Tide", icon: "🔮",
    description: "Ancient runes wash ashore from forgotten shores. Rune drops surge.",
    effects: { runeMult: 3.0, label: "3× Rune drops" }, durationHours: 4, minRankIndex: 4,
    color: "from-indigo-900 to-blue-900",
  },
  {
    id: "blood_moon", name: "Blood Moon", icon: "🌑",
    description: "The blood moon rises. Attacks tear through defences — but fighters are more vulnerable.",
    effects: { atkBonus: 0.40, defBonus: -0.20, label: "+40% ATK / -20% DEF" }, durationHours: 2, minRankIndex: 5,
    color: "from-red-950 to-purple-950",
  },
  {
    id: "celestial_tide", name: "Celestial Tide", icon: "✨",
    description: "A celestial conjunction empowers all — gold, shards, and training all surge.",
    effects: { goldMult: 1.5, shardMult: 1.5, tpMult: 1.5, label: "1.5× Gold, Shards & Training" }, durationHours: 2, minRankIndex: 6,
    color: "from-amber-900 to-yellow-800",
  },
];

export function generateWorldEvent(seed?: number): { typeId: string; expiresInMs: number } {
  const rng = seededRandom(seed ?? Date.now() % 888887);
  const type = WORLD_EVENT_TYPES[Math.floor(rng() * WORLD_EVENT_TYPES.length)];
  const durationMs = type.durationHours * 3600 * 1000;
  return { typeId: type.id, expiresInMs: durationMs };
}

export function getWorldEventType(typeId: string): WorldEventType | undefined {
  return WORLD_EVENT_TYPES.find(e => e.id === typeId);
}

// Active event cache type (populated at runtime)
export type ActiveWorldEventBonuses = {
  goldMult: number;
  xpMult: number;
  shardMult: number;
  tpMult: number;
  runeMult: number;
  luckBonus: number;
  atkBonus: number;
  defBonus: number;
  pvpGoldMult: number;
  skillDamageMult: number;
  hpMult: number;
};

export function aggregateEventBonuses(effects: WorldEventEffects[]): ActiveWorldEventBonuses {
  const b: ActiveWorldEventBonuses = {
    goldMult: 1, xpMult: 1, shardMult: 1, tpMult: 1, runeMult: 1,
    luckBonus: 0, atkBonus: 0, defBonus: 0, pvpGoldMult: 1,
    skillDamageMult: 1, hpMult: 1,
  };
  for (const eff of effects) {
    if (eff.goldMult)        b.goldMult        *= eff.goldMult;
    if (eff.xpMult)         b.xpMult          *= eff.xpMult;
    if (eff.shardMult)       b.shardMult       *= eff.shardMult;
    if (eff.tpMult)          b.tpMult          *= eff.tpMult;
    if (eff.runeMult)        b.runeMult        *= eff.runeMult;
    if (eff.luckBonus)       b.luckBonus       += eff.luckBonus;
    if (eff.atkBonus)        b.atkBonus        += eff.atkBonus;
    if (eff.defBonus)        b.defBonus        += eff.defBonus;
    if (eff.pvpGoldMult)     b.pvpGoldMult     *= eff.pvpGoldMult;
    if (eff.skillDamageMult) b.skillDamageMult *= eff.skillDamageMult;
    if (eff.hpMult)          b.hpMult          *= eff.hpMult;
  }
  return b;
}
