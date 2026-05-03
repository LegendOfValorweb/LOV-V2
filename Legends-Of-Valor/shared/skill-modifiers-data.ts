// ─── Skill Modifier Definitions ──────────────────────────────────────────────
// 20 modifiers across 5 rarity tiers.
// Attached to player skills in the Skill Workshop and applied server-side during combat.
// ─────────────────────────────────────────────────────────────────────────────

export type ModifierRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type ModifierEffect = {
  spellPowerBoost?: number;    // multiply spellPower by (1 + N/100)
  cooldownReduction?: number;  // reduce skill cooldown by N turns (min 1)
  critBoost?: number;          // +N% crit chance when this skill fires
  lifestealBoost?: number;     // +N% lifesteal from this skill's damage
  defPierce?: number;          // ignore N% of target's DEF
  selfDamagePct?: number;      // take N% of dealt damage as self damage (trade-off)
  statusEffect?: "burn" | "freeze" | "stun" | "poison" | "bleed";
  statusChance?: number;       // % chance to apply the status
  manaCostReduction?: number;  // reduce mana cost by N%
  aoeHits?: number;            // hit target an extra N times at 40% power each
  healingBoost?: number;       // multiply healing effects by (1 + N/100)
  defBoostAfterCast?: number;  // self DEF +N% for 2 turns after casting
  damageToHealing?: number;    // convert N% of damage dealt to self-healing
};

export type SkillModifierDef = {
  id: string;
  name: string;
  description: string;
  rarity: ModifierRarity;
  color: string;           // tailwind text color
  icon: string;            // emoji
  shardCost: number;       // Soul Shards to buy from shop
  effect: ModifierEffect;
  dropWeight: number;      // relative drop weight from dungeons (higher = commoner)
};

export const MODIFIER_DEFS: SkillModifierDef[] = [
  // ─── Common ──────────────────────────────────────────────────────────────
  {
    id: "mod_empowered",
    name: "Empowered",
    description: "+20% skill effectiveness",
    rarity: "common", color: "text-gray-300", icon: "⚡",
    shardCost: 50, dropWeight: 100,
    effect: { spellPowerBoost: 20 },
  },
  {
    id: "mod_swift",
    name: "Swift",
    description: "-2 cooldown turns",
    rarity: "common", color: "text-gray-300", icon: "💨",
    shardCost: 50, dropWeight: 100,
    effect: { cooldownReduction: 2 },
  },
  {
    id: "mod_burning",
    name: "Burning",
    description: "35% chance to apply Burn on hit",
    rarity: "common", color: "text-gray-300", icon: "🔥",
    shardCost: 40, dropWeight: 90,
    effect: { statusEffect: "burn", statusChance: 35 },
  },
  {
    id: "mod_freezing",
    name: "Freezing",
    description: "25% chance to apply Freeze (1 turn stun) on hit",
    rarity: "common", color: "text-gray-300", icon: "❄️",
    shardCost: 40, dropWeight: 90,
    effect: { statusEffect: "freeze", statusChance: 25 },
  },
  {
    id: "mod_mana_efficient",
    name: "Mana Efficient",
    description: "-30% mana cost",
    rarity: "common", color: "text-gray-300", icon: "💧",
    shardCost: 35, dropWeight: 80,
    effect: { manaCostReduction: 30 },
  },
  // ─── Rare ────────────────────────────────────────────────────────────────
  {
    id: "mod_piercing",
    name: "Piercing",
    description: "Ignore 25% of target's Defense",
    rarity: "rare", color: "text-blue-400", icon: "🗡️",
    shardCost: 150, dropWeight: 50,
    effect: { defPierce: 25 },
  },
  {
    id: "mod_critical",
    name: "Critical Eye",
    description: "+15% critical hit chance",
    rarity: "rare", color: "text-blue-400", icon: "👁️",
    shardCost: 150, dropWeight: 50,
    effect: { critBoost: 15 },
  },
  {
    id: "mod_draining",
    name: "Draining",
    description: "+10% lifesteal from this skill's damage",
    rarity: "rare", color: "text-blue-400", icon: "🩸",
    shardCost: 150, dropWeight: 50,
    effect: { lifestealBoost: 10 },
  },
  {
    id: "mod_fortifying",
    name: "Fortifying",
    description: "Gain +20% DEF for 2 turns after casting",
    rarity: "rare", color: "text-blue-400", icon: "🛡️",
    shardCost: 130, dropWeight: 45,
    effect: { defBoostAfterCast: 20 },
  },
  {
    id: "mod_poisonous",
    name: "Poisonous",
    description: "40% chance to apply Poison on hit",
    rarity: "rare", color: "text-blue-400", icon: "☠️",
    shardCost: 120, dropWeight: 45,
    effect: { statusEffect: "poison", statusChance: 40 },
  },
  {
    id: "mod_volatile",
    name: "Volatile",
    description: "+40% damage but deal 8% of damage to yourself",
    rarity: "rare", color: "text-blue-400", icon: "💥",
    shardCost: 110, dropWeight: 40,
    effect: { spellPowerBoost: 40, selfDamagePct: 8 },
  },
  {
    id: "mod_bleeding",
    name: "Bleeding",
    description: "30% chance to apply Bleed (DoT) on hit",
    rarity: "rare", color: "text-blue-400", icon: "🗡️",
    shardCost: 120, dropWeight: 45,
    effect: { statusEffect: "bleed", statusChance: 30 },
  },
  // ─── Epic ─────────────────────────────────────────────────────────────────
  {
    id: "mod_arcane",
    name: "Arcane Infusion",
    description: "+30% spell power and ignore 10% DEF",
    rarity: "epic", color: "text-purple-400", icon: "✨",
    shardCost: 400, dropWeight: 20,
    effect: { spellPowerBoost: 30, defPierce: 10 },
  },
  {
    id: "mod_runic",
    name: "Runic",
    description: "-3 cooldown, -40% mana cost",
    rarity: "epic", color: "text-purple-400", icon: "🔮",
    shardCost: 400, dropWeight: 18,
    effect: { cooldownReduction: 3, manaCostReduction: 40 },
  },
  {
    id: "mod_vampiric",
    name: "Vampiric",
    description: "+15% lifesteal, 20% chance to stun",
    rarity: "epic", color: "text-purple-400", icon: "🧛",
    shardCost: 350, dropWeight: 18,
    effect: { lifestealBoost: 15, statusEffect: "stun", statusChance: 20 },
  },
  {
    id: "mod_divine",
    name: "Divine Echo",
    description: "Convert 25% of damage dealt into self-healing",
    rarity: "epic", color: "text-purple-400", icon: "😇",
    shardCost: 350, dropWeight: 16,
    effect: { damageToHealing: 25 },
  },
  {
    id: "mod_explosive",
    name: "Explosive",
    description: "Strike twice — extra hit at 50% power",
    rarity: "epic", color: "text-purple-400", icon: "💣",
    shardCost: 380, dropWeight: 15,
    effect: { aoeHits: 1 },
  },
  // ─── Legendary ────────────────────────────────────────────────────────────
  {
    id: "mod_stoic",
    name: "Stoic Fury",
    description: "+50% power, -4 cooldown, ignore 20% DEF",
    rarity: "legendary", color: "text-amber-400", icon: "⚔️",
    shardCost: 1200, dropWeight: 5,
    effect: { spellPowerBoost: 50, cooldownReduction: 4, defPierce: 20 },
  },
  {
    id: "mod_masterful",
    name: "Masterful",
    description: "+40% power, +20% crit, +12% lifesteal",
    rarity: "legendary", color: "text-amber-400", icon: "👑",
    shardCost: 1500, dropWeight: 4,
    effect: { spellPowerBoost: 40, critBoost: 20, lifestealBoost: 12 },
  },
  // ─── Mythic ───────────────────────────────────────────────────────────────
  {
    id: "mod_transcendent",
    name: "Transcendent",
    description: "+65% power, -5 cooldown, -50% mana, +25% crit",
    rarity: "mythic", color: "text-pink-400", icon: "🌟",
    shardCost: 5000, dropWeight: 1,
    effect: { spellPowerBoost: 65, cooldownReduction: 5, manaCostReduction: 50, critBoost: 25 },
  },
];

export const MODIFIER_MAP = Object.fromEntries(MODIFIER_DEFS.map(m => [m.id, m]));

export function getModifierById(id: string): SkillModifierDef | undefined {
  return MODIFIER_MAP[id];
}

// How many modifier slots a skill has based on rarity + upgrade level
export const BASE_MOD_SLOTS: Record<string, number> = {
  common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3,
};

export function getModifierSlots(rarity: string, upgradeLevel: number): number {
  const base = BASE_MOD_SLOTS[rarity as keyof typeof BASE_MOD_SLOTS] ?? 1;
  const extra = (upgradeLevel >= 3 ? 1 : 0) + (upgradeLevel >= 5 ? 1 : 0);
  return base + extra;
}

// Upgrade multipliers per level (applied to spellPower)
export const UPGRADE_SPELL_MULT = [1.0, 1.15, 1.32, 1.52, 1.75, 2.10];
// Cooldown reduction per upgrade level (cumulative)
export const UPGRADE_CDR = [0, 0, 0, 1, 1, 2];

// Gold cost to reach next level (index = current level, so [0]=cost to go 0→1)
export const UPGRADE_GOLD_COST: Record<string, number[]> = {
  common:    [1_000,    5_000,    20_000,    100_000,    500_000],
  uncommon:  [5_000,    25_000,   100_000,   500_000,    2_000_000],
  rare:      [25_000,   100_000,  500_000,   2_000_000,  10_000_000],
  epic:      [100_000,  500_000,  2_000_000, 10_000_000, 50_000_000],
  legendary: [500_000,  2_000_000,10_000_000,50_000_000, 250_000_000],
  mythic:    [2_000_000,10_000_000,50_000_000,250_000_000,1_000_000_000],
};
// TP cost per upgrade level
export const UPGRADE_TP_COST = [1, 2, 5, 10, 25];

// Fusion cost in TP (cost to fuse two skills of this rarity)
export const FUSION_TP_COST: Record<string, number> = {
  common: 3, uncommon: 5, rare: 10, epic: 20, legendary: 50,
};

// Build an effective spell object incorporating upgrade + modifiers
export function applySkillModifiers(
  baseSpellPower: number,
  baseCooldown: number,
  upgradeLevel: number,
  attachedModifierIds: string[],
): {
  spellPower: number;
  cooldown: number;
  critBoost: number;
  lifestealBoost: number;
  defPierce: number;
  selfDamagePct: number;
  statusEffects: { effect: string; chance: number }[];
  manaCostMult: number;
  aoeExtraHits: number;
  damageToHealing: number;
  defBoostAfterCast: number;
  description: string;
} {
  const level = Math.max(0, Math.min(5, upgradeLevel));
  let sp = baseSpellPower * UPGRADE_SPELL_MULT[level];
  let cd = Math.max(1, baseCooldown - UPGRADE_CDR[level]);
  let critBoost = 0;
  let lifestealBoost = 0;
  let defPierce = 0;
  let selfDamagePct = 0;
  let manaCostMult = 1.0;
  let aoeExtraHits = 0;
  let damageToHealing = 0;
  let defBoostAfterCast = 0;
  const statusEffects: { effect: string; chance: number }[] = [];

  for (const modId of attachedModifierIds) {
    const mod = getModifierById(modId);
    if (!mod) continue;
    const e = mod.effect;
    if (e.spellPowerBoost) sp *= (1 + e.spellPowerBoost / 100);
    if (e.cooldownReduction) cd = Math.max(1, cd - e.cooldownReduction);
    if (e.critBoost) critBoost += e.critBoost;
    if (e.lifestealBoost) lifestealBoost += e.lifestealBoost;
    if (e.defPierce) defPierce += e.defPierce;
    if (e.selfDamagePct) selfDamagePct += e.selfDamagePct;
    if (e.manaCostReduction) manaCostMult *= (1 - e.manaCostReduction / 100);
    if (e.aoeHits) aoeExtraHits += e.aoeHits;
    if (e.damageToHealing) damageToHealing += e.damageToHealing;
    if (e.defBoostAfterCast) defBoostAfterCast += e.defBoostAfterCast;
    if (e.statusEffect && e.statusChance) {
      statusEffects.push({ effect: e.statusEffect, chance: e.statusChance });
    }
  }

  const mods = attachedModifierIds.map(id => getModifierById(id)?.name ?? id).join(", ");
  const upgradeDesc = level > 0 ? `+${Math.round((UPGRADE_SPELL_MULT[level] - 1) * 100)}% power (Lv${level})` : "";
  const description = [upgradeDesc, mods ? `Mods: ${mods}` : ""].filter(Boolean).join(" | ");

  return { spellPower: sp, cooldown: cd, critBoost, lifestealBoost, defPierce, selfDamagePct, statusEffects, manaCostMult, aoeExtraHits, damageToHealing, defBoostAfterCast, description };
}
