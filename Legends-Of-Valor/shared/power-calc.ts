// ─── Unified Power Calculation System ─────────────────────────────────────────
// Single source of truth for all combat damage formulas, rank stat bonuses,
// army hero influence, reward scaling, and mode-specific modifiers.
//
// IMPORT THIS FILE instead of duplicating formulas across combat engines.
// All combat systems (PvE, PvP, shadow-echo, dimension, army) draw from here.
// ──────────────────────────────────────────────────────────────────────────────

// ─── Core stat type ───────────────────────────────────────────────────────────
export type CoreStats = {
  Str: number;
  Def: number;
  Spd: number;
  Int: number;
  Luck: number;
  Pot?: number;
};

// ─── Rank stat bonus table ────────────────────────────────────────────────────
// Applied as the FINAL step after base + equipment + pet + guild + prestige.
// Makes each rank promotion mechanically meaningful in every combat mode.
// Deliberately modest (0–65%) so early-game content doesn't instantly trivialise.
export const RANK_STAT_BONUS_PCT: Record<string, number> = {
  "Novice":           0,
  "Apprentice":       3,
  "Initiate":         6,
  "Journeyman":      10,
  "Adept":           14,
  "Expert":          19,
  "Master":          25,
  "Grandmaster":     31,
  "Champion":        38,
  "Overlord":        46,
  "Sovereign":       54,
  "Ascendant":       63,
  "Legend":          73,
  "Mythic":          84,
  "Mythical Legend": 96,
};

// ─── Rank power scores ────────────────────────────────────────────────────────
// Numeric weight used for matchmaking, difficulty scaling, NPC power levels,
// and reward calculation. Novice = 1, Mythical Legend = 150.
export const RANK_POWER_SCORE: Record<string, number> = {
  "Novice":           1,
  "Apprentice":       5,
  "Initiate":        10,
  "Journeyman":      18,
  "Adept":           28,
  "Expert":          42,
  "Master":          58,
  "Grandmaster":     76,
  "Champion":        95,
  "Overlord":       110,
  "Sovereign":      120,
  "Ascendant":      130,
  "Legend":         138,
  "Mythic":         145,
  "Mythical Legend":150,
};

// ─── Rank reward scaling ──────────────────────────────────────────────────────
// Multiplier on base gold/XP rewards. Ensures progression stays meaningful
// at every tier — late-game players earn proportionally more from matched content.
export const RANK_REWARD_SCALING: Record<string, number> = {
  "Novice":           1.00,
  "Apprentice":       1.10,
  "Initiate":         1.22,
  "Journeyman":       1.35,
  "Adept":            1.50,
  "Expert":           1.70,
  "Master":           1.95,
  "Grandmaster":      2.25,
  "Champion":         2.60,
  "Overlord":         3.00,
  "Sovereign":        3.50,
  "Ascendant":        4.05,
  "Legend":           4.65,
  "Mythic":           5.30,
  "Mythical Legend":  6.00,
};

// ─── Combat mode damage modifiers ─────────────────────────────────────────────
// Fine-tune damage output per game mode without touching core stats.
// atk < 1 slows fights (boss survivability), def > 1 boosts survivability (PvP).
export const COMBAT_MODE_MODIFIERS: Record<string, { atk: number; def: number }> = {
  pve_standard:  { atk: 1.00, def: 1.00 }, // Standard tower / zone NPC
  pve_boss:      { atk: 0.80, def: 1.00 }, // Boss — player ATK reduced so bosses last longer
  pvp:           { atk: 0.70, def: 1.15 }, // PvP — reduced ATK + boosted DEF for fair fights
  guild_dungeon: { atk: 1.10, def: 0.90 }, // Guild dungeons — aggressive, teamplay rewarded
  shadow_echo:   { atk: 0.90, def: 1.00 }, // Shadow echo — balanced, slight nerf for clone fights
  dimension:     { atk: 1.05, def: 0.95 }, // Dimension portals — slightly more dangerous
  army_raid:     { atk: 1.00, def: 1.00 }, // Army raids — pure army formula, no mode mod
};

// ─── Race and rank HP tables (canonical source) ───────────────────────────────
// These constants are also referenced in combat-engine.ts (kept in sync here).
export const RACE_BASE_HP: Record<string, number> = {
  human: 100, elf: 85, dwarf: 120, orc: 130, beastfolk: 90,
  mystic: 80, fae: 75, elemental: 95, undead: 110, demon: 105,
  draconic: 115, celestial: 90, aquatic: 95, titan: 140,
};

export const RANK_BASE_HP: Record<string, number> = {
  "Novice": 0,   "Apprentice": 20,  "Initiate": 40,   "Journeyman": 65,
  "Adept": 95,   "Expert": 130,     "Master": 170,    "Grandmaster": 220,
  "Champion": 280, "Overlord": 350, "Sovereign": 430, "Ascendant": 520,
  "Legend": 620, "Mythic": 740,     "Mythical Legend": 880,
};

// ─── Apply rank stat bonus ────────────────────────────────────────────────────
// Call this as the very last step in any stat-building pipeline.
// Applies a uniform percentage bonus to Str/Def/Spd/Int/Luck (and Pot if present).
export function applyRankStatBonus<T extends CoreStats>(
  stats: T,
  rank: string | null | undefined,
): T {
  const bonusPct = RANK_STAT_BONUS_PCT[rank ?? "Novice"] ?? 0;
  if (bonusPct === 0) return stats;
  const mult = 1 + bonusPct / 100;
  return {
    ...stats,
    Str:  Math.round((stats.Str  ?? 10) * mult),
    Def:  Math.round((stats.Def  ?? 10) * mult),
    Spd:  Math.round((stats.Spd  ?? 10) * mult),
    Int:  Math.round((stats.Int  ?? 10) * mult),
    Luck: Math.round((stats.Luck ?? 10) * mult),
    ...(stats.Pot !== undefined ? { Pot: Math.round(stats.Pot * mult) } : {}),
  };
}

// ─── Unified damage formula ───────────────────────────────────────────────────
// THE single formula used by shadow-echo-combat, dimension-combat, and army raids.
// The main combat engine (combat-engine.ts) uses a legacy absorption model that
// is preserved for backwards-compatibility — all NEW combat paths use this.
//
//   rawDamage = (effAtk + flatBonus) × 2.5 + 30
//   defReduction = 100 / (100 + effDef × (1 − pierce))
//   finalDamage  = rawDamage × defReduction × crit × elemental × skill × mode
//
// Physical attack: effAtk = Str + Int×0.3
// Spell attack:    effAtk = Int + Str×0.2

export type DamageModifiers = {
  critMult?:      number; // 1.0 = no crit; pass rank crit multiplier when critting
  elementalMult?: number; // 1.0 neutral; >1 advantage; <1 disadvantage
  skillMult?:     number; // spell power multiplier (1.0 = basic attack)
  modeMult?:      number; // from COMBAT_MODE_MODIFIERS.atk
  flatBonus?:     number; // flat ATK bonus added before squaring
  defPierce?:     number; // 0–1: fraction of defence ignored (e.g. 0.3 = 30% pierce)
};

export function calcDamage(
  atk: CoreStats,
  def: CoreStats,
  mods: DamageModifiers = {},
  isSpell = false,
): number {
  const effAtk = isSpell
    ? (atk.Int  ?? 10) + Math.round((atk.Str  ?? 10) * 0.2)
    : (atk.Str  ?? 10) + Math.round((atk.Int  ?? 10) * 0.3);

  const rawDef   = Math.max(0, def.Def ?? 0);
  const pierce   = Math.min(1, Math.max(0, mods.defPierce ?? 0));
  const effDef   = rawDef * (1 - pierce);
  const flatBase = 30;

  const rawDamage    = (effAtk + (mods.flatBonus ?? 0)) * 2.5 + flatBase;
  const defReduction = 100 / (100 + effDef);
  const critMult     = mods.critMult      ?? 1.0;
  const elemMult     = mods.elementalMult ?? 1.0;
  const skillMult    = mods.skillMult     ?? 1.0;
  const modeMult     = mods.modeMult      ?? 1.0;

  return Math.max(1, Math.floor(rawDamage * defReduction * critMult * elemMult * skillMult * modeMult));
}

// ─── Unified HP formula ───────────────────────────────────────────────────────
// Matches the formula in combat-engine.ts calculateMaxHP.
// Any code that needs to compute max HP should call this.
export function calcMaxHP(
  stats: CoreStats,
  rank: string | null | undefined,
  race: string | null | undefined,
): number {
  const raceHP   = RACE_BASE_HP[race  ?? ""] ?? 100;
  const rankHP   = RANK_BASE_HP[rank ?? "Novice"] ?? 0;
  const vitality = stats.Pot ?? 0;
  const defBonus = Math.floor(Math.max(0, stats.Def ?? 10) * 5);
  return Math.floor(raceHP + rankHP + vitality * 8 + defBonus);
}

// ─── Player power score ───────────────────────────────────────────────────────
// Single numeric representation of a player's total combat capability.
// Used for: matchmaking, leaderboards, difficulty gates, army scaling display.
export function calcPlayerPower(
  stats: CoreStats,
  rank: string | null | undefined,
  level = 1,
): number {
  const rankScore = RANK_POWER_SCORE[rank ?? "Novice"] ?? 1;
  const statSum   = (stats.Str ?? 10) + (stats.Def ?? 10) + (stats.Spd ?? 10)
                  + (stats.Int ?? 10) + (stats.Luck ?? 10);
  const potBonus  = (stats.Pot ?? 0) * 2;
  return Math.floor(statSum * (1 + rankScore / 50) + potBonus + level * 0.5);
}

// ─── Army hero bonus calculation ──────────────────────────────────────────────
// Derives army ATK/DEF/siege multipliers from hero stats + rank.
// Use in resolveRaid() — stronger heroes lead more effective armies.
export type ArmyHeroBonuses = {
  atkMult:   number; // Str → all attacker unit ATK
  defMult:   number; // Def → tower damage + frontline toughness
  hitMult:   number; // Luck → effective hit rate / accuracy
  siegeMult: number; // Int → siege engine effectiveness vs structures
  rankMult:  number; // Rank → global army combat bonus
};

export function calcArmyHeroBonuses(
  heroStats: { Str: number; Def: number; Int: number; Luck: number },
  heroRank: string | null | undefined,
): ArmyHeroBonuses {
  const rankScore = RANK_POWER_SCORE[heroRank ?? "Novice"] ?? 1;
  return {
    atkMult:  1 + (heroStats.Str  ?? 10) / 200,  // Str 200 → +100% army ATK
    defMult:  1 + (heroStats.Def  ?? 10) / 250,  // Def 250 → +100% tower DEF
    hitMult:  1 + (heroStats.Luck ?? 10) / 400,  // Luck 400 → +100% hit rate
    siegeMult:1 + (heroStats.Int  ?? 10) / 300,  // Int 300 → +100% siege damage
    rankMult: 1 + rankScore / 200,               // Rank ML(150) → +75% all army
  };
}

// ─── Rank-scaled gold reward ──────────────────────────────────────────────────
// Apply to base gold rewards so higher-ranked players earn proportionally more
// from rank-appropriate content. Does NOT scale down low-level rewards — the
// design intent is that late-game players ignore trivial gold sources naturally.
export function scaleGoldReward(
  baseGold: number,
  rank: string | null | undefined,
): number {
  const mult = RANK_REWARD_SCALING[rank ?? "Novice"] ?? 1.0;
  return Math.floor(baseGold * mult);
}

// ─── Army training: max batch size by barracks level ─────────────────────────
// Enforced server-side on the /recruit route to prevent instant army creation.
// Higher barracks levels unlock training larger groups at once.
export const MAX_TRAINING_BATCH_BY_BARRACKS_LEVEL: Record<number, number> = {
  0: 0,
  1: 50,
  2: 200,
  3: 500,
  4: 1000,
  5: 2500,
};

export function getMaxTrainingBatch(barracksLevel: number): number {
  const lvl = Math.min(5, Math.max(0, barracksLevel || 1));
  return MAX_TRAINING_BATCH_BY_BARRACKS_LEVEL[lvl] ?? 50;
}

// ─── Rank unlock descriptions ─────────────────────────────────────────────────
// Human-readable list of what each rank grants the player. Used in UI tooltips.
export const RANK_UNLOCKS: Record<string, string[]> = {
  "Novice":           ["Basic combat", "Zone 1 access", "Camp (Base Tier 1)"],
  "Apprentice":       ["+3% all stats", "Fishing unlocked", "Zone 2 access"],
  "Initiate":         ["+6% all stats", "Crafting unlocked", "Zone 3 access"],
  "Journeyman":       ["+10% all stats", "Lodge (Base Tier 2)", "Pet system"],
  "Adept":            ["+14% all stats", "Guild joining", "Zone 4 access"],
  "Expert":           ["+19% all stats", "Keep (Base Tier 3)", "Barracks + Army system", "Zone dungeons"],
  "Master":           ["+25% all stats", "Dimension portals", "Zone 5 access"],
  "Grandmaster":      ["+31% all stats", "Fortress (Base Tier 4)", "Elite skills"],
  "Champion":         ["+38% all stats", "Shadow Echo system", "Tier 4 barracks units"],
  "Overlord":         ["+46% all stats", "Citadel (Base Tier 5)", "World boss access"],
  "Sovereign":        ["+54% all stats", "Prestige system", "Tier 5 content"],
  "Ascendant":        ["+63% all stats", "Stronghold (Base Tier 6)", "Hell Zone"],
  "Legend":           ["+73% all stats", "Bastion (Base Tier 7)", "Mythic dungeons"],
  "Mythic":           ["+84% all stats", "Heritage rebirths", "Endgame content"],
  "Mythical Legend":  ["+96% all stats", "Eternal Fortress (Base Tier 8)", "Full endgame mastery"],
};
