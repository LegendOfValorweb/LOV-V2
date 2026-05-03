// ─── Genetic Traits System — Legends of Valor ────────────────────────────────
// Every player is assigned 3 genetic traits at creation — permanent, random,
// and entirely their own. Rarity ranges from Common to Mythic.
// ──────────────────────────────────────────────────────────────────────────────

export type TraitRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type TraitEffectType =
  | "stat_mult"       // multiply a base stat: { stat: "Str", mult: 1.10 }
  | "all_stats_mult"  // multiply all stats: { mult: 1.05 }
  | "xp_mult"         // multiply all XP earned
  | "gold_mult"       // multiply all gold earned
  | "shard_mult"      // multiply shard drops
  | "crit_chance"     // flat add to crit chance (0-1 scale)
  | "crit_damage"     // flat add to crit damage multiplier
  | "dodge_chance"    // flat add to dodge chance
  | "lifesteal"       // % of damage dealt restored as HP
  | "heal_mult"       // multiply healing effectiveness
  | "max_hp_mult"     // multiply max HP
  | "special";        // unique effect described in specialKey

export type TraitEffect = {
  type: TraitEffectType;
  stat?: "Str" | "Def" | "Spd" | "Int" | "Luck" | "Pot";
  mult?: number;       // multiplier (1.1 = +10%)
  value?: number;      // flat value (0.05 = 5% for chance effects)
  specialKey?: string; // references special combat logic
  description: string; // human-readable effect description
};

export type GeneticTrait = {
  id: string;
  name: string;
  rarity: TraitRarity;
  icon: string;
  tagline: string;       // short flavour line
  lore: string;          // one-sentence lore
  effects: TraitEffect[];
  category: "Combat" | "Progression" | "Mystical" | "Resilience" | "Fortune" | "Legendary";
};

// ─── Rarity colour palette ────────────────────────────────────────────────────
export const RARITY_STYLES: Record<TraitRarity, { bg: string; border: string; text: string; glow: string; badge: string }> = {
  Common:    { bg:"from-gray-800 to-gray-900",      border:"border-gray-600",   text:"text-gray-300",   glow:"shadow-gray-900",   badge:"bg-gray-700 text-gray-300" },
  Uncommon:  { bg:"from-emerald-950 to-green-950",  border:"border-emerald-700",text:"text-emerald-300",glow:"shadow-emerald-900", badge:"bg-emerald-800 text-emerald-200" },
  Rare:      { bg:"from-blue-950 to-indigo-950",    border:"border-blue-700",   text:"text-blue-300",   glow:"shadow-blue-900",   badge:"bg-blue-800 text-blue-200" },
  Epic:      { bg:"from-purple-950 to-violet-950",  border:"border-purple-600", text:"text-purple-300", glow:"shadow-purple-900", badge:"bg-purple-700 text-purple-200" },
  Legendary: { bg:"from-amber-950 to-yellow-950",   border:"border-amber-500",  text:"text-amber-300",  glow:"shadow-amber-900",  badge:"bg-amber-700 text-amber-200" },
  Mythic:    { bg:"from-red-950 to-pink-950",       border:"border-red-500",    text:"text-red-300",    glow:"shadow-red-900",    badge:"bg-red-700 text-red-200" },
};

// ─── All Genetic Traits (38 total) ───────────────────────────────────────────
export const ALL_TRAITS: GeneticTrait[] = [

  // ── COMMON (10) ─────────────────────────────────────────────────────────────
  {
    id: "iron_skin",
    name: "Iron Skin",
    rarity: "Common", icon: "🛡️", category: "Resilience",
    tagline: "Your hide is naturally tougher than most.",
    lore: "Born with unusually dense muscle fibre, blows that would stagger others barely register.",
    effects: [{ type:"stat_mult", stat:"Def", mult:1.08, description:"+8% Defence" }],
  },
  {
    id: "quick_reflexes",
    name: "Quick Reflexes",
    rarity: "Common", icon: "⚡", category: "Combat",
    tagline: "Your body moves before your mind decides.",
    lore: "Lightning-fast nervous responses make you consistently the first to act.",
    effects: [{ type:"stat_mult", stat:"Spd", mult:1.08, description:"+8% Speed" }],
  },
  {
    id: "steady_hands",
    name: "Steady Hands",
    rarity: "Common", icon: "✋", category: "Combat",
    tagline: "Every strike lands exactly where intended.",
    lore: "An innate steadiness in your hands makes your attacks unnervingly precise.",
    effects: [{ type:"stat_mult", stat:"Str", mult:1.06, description:"+6% Strength" }],
  },
  {
    id: "sharp_eyes",
    name: "Sharp Eyes",
    rarity: "Common", icon: "👁️", category: "Combat",
    tagline: "You see openings that others miss entirely.",
    lore: "Your eyes track micro-movements with predatory precision.",
    effects: [{ type:"crit_chance", value:0.04, description:"+4% Critical Hit Chance" }],
  },
  {
    id: "thick_skull",
    name: "Thick Skull",
    rarity: "Common", icon: "💪", category: "Resilience",
    tagline: "Your constitution is simply built different.",
    lore: "A natural excess of vital force runs through your bloodline.",
    effects: [{ type:"max_hp_mult", mult:1.10, description:"+10% Max HP" }],
  },
  {
    id: "eager_learner",
    name: "Eager Learner",
    rarity: "Common", icon: "📚", category: "Progression",
    tagline: "Lessons come easy — knowledge sticks fast.",
    lore: "Your mind absorbs combat techniques faster than anyone your teachers have seen.",
    effects: [{ type:"xp_mult", mult:1.10, description:"+10% XP gain from all sources" }],
  },
  {
    id: "lucky_star",
    name: "Lucky Star",
    rarity: "Common", icon: "⭐", category: "Fortune",
    tagline: "Fortune seems to tilt in your direction.",
    lore: "You were born under a star whose light brings fortune to those who carry it.",
    effects: [{ type:"stat_mult", stat:"Luck", mult:1.12, description:"+12% Luck" }],
  },
  {
    id: "frugal",
    name: "Frugal",
    rarity: "Common", icon: "💰", category: "Fortune",
    tagline: "Gold has a way of staying in your pocket.",
    lore: "You have an instinct for value that makes merchants hate dealing with you.",
    effects: [{ type:"gold_mult", mult:1.08, description:"+8% Gold from all sources" }],
  },
  {
    id: "arcane_affinity",
    name: "Arcane Affinity",
    rarity: "Common", icon: "🔮", category: "Mystical",
    tagline: "Magic comes naturally — spellcraft feels like breathing.",
    lore: "A faint current of arcane energy has coursed through your family for generations.",
    effects: [{ type:"stat_mult", stat:"Int", mult:1.08, description:"+8% Intelligence" }],
  },
  {
    id: "nimble_feet",
    name: "Nimble Feet",
    rarity: "Common", icon: "🦶", category: "Combat",
    tagline: "You sidestep trouble like it was never there.",
    lore: "Your footwork is involuntary — your body finds the gaps on instinct.",
    effects: [{ type:"dodge_chance", value:0.03, description:"+3% Dodge Chance" }],
  },

  // ── UNCOMMON (10) ───────────────────────────────────────────────────────────
  {
    id: "battle_hardened",
    name: "Battle Hardened",
    rarity: "Uncommon", icon: "⚔️", category: "Combat",
    tagline: "Your body remembers every battle it has survived.",
    lore: "A lifetime of near-misses has conditioned you to absorb punishment others cannot.",
    effects: [
      { type:"stat_mult", stat:"Def", mult:1.12, description:"+12% Defence" },
      { type:"max_hp_mult", mult:1.08, description:"+8% Max HP" },
    ],
  },
  {
    id: "fleet_footed",
    name: "Fleet Footed",
    rarity: "Uncommon", icon: "💨", category: "Combat",
    tagline: "They say you move like the wind — the wind agrees.",
    lore: "Your ancestors were scouts, and their gifts flow through your legs.",
    effects: [
      { type:"stat_mult", stat:"Spd", mult:1.15, description:"+15% Speed" },
      { type:"dodge_chance", value:0.04, description:"+4% Dodge Chance" },
    ],
  },
  {
    id: "heavy_hitter",
    name: "Heavy Hitter",
    rarity: "Uncommon", icon: "🥊", category: "Combat",
    tagline: "Your blows carry weight beyond what your size suggests.",
    lore: "There is a force behind your strikes that defies simple anatomy.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.12, description:"+12% Strength" },
      { type:"crit_damage", value:0.15, description:"+15% Critical Damage" },
    ],
  },
  {
    id: "eagle_eye",
    name: "Eagle Eye",
    rarity: "Uncommon", icon: "🦅", category: "Combat",
    tagline: "Every weakness you find, you exploit.",
    lore: "You see the flinch before it happens and the opening before it forms.",
    effects: [
      { type:"crit_chance", value:0.07, description:"+7% Critical Hit Chance" },
      { type:"crit_damage", value:0.20, description:"+20% Critical Damage" },
    ],
  },
  {
    id: "resilient",
    name: "Resilient",
    rarity: "Uncommon", icon: "💚", category: "Resilience",
    tagline: "Wounds close faster than they should.",
    lore: "Your body devotes extraordinary resources to self-repair.",
    effects: [{ type:"heal_mult", mult:1.25, description:"+25% Healing Effectiveness" }],
  },
  {
    id: "focused_mind",
    name: "Focused Mind",
    rarity: "Uncommon", icon: "🧠", category: "Mystical",
    tagline: "Your will sharpens under pressure — skills detonate harder.",
    lore: "In combat your mind crystallises into something sharper than most swords.",
    effects: [
      { type:"stat_mult", stat:"Int", mult:1.10, description:"+10% Intelligence" },
      { type:"xp_mult", mult:1.08, description:"+8% XP gain" },
    ],
  },
  {
    id: "silver_tongue",
    name: "Silver Tongue",
    rarity: "Uncommon", icon: "🪙", category: "Fortune",
    tagline: "Merchants offer you better deals before you even ask.",
    lore: "Your natural charisma generates wealth that follows you everywhere.",
    effects: [{ type:"gold_mult", mult:1.20, description:"+20% Gold from all sources" }],
  },
  {
    id: "monster_hunter",
    name: "Monster Hunter",
    rarity: "Uncommon", icon: "🐉", category: "Combat",
    tagline: "You study the creatures you hunt, and it shows.",
    lore: "Generations of monster slayers have sharpened the instincts in your blood.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.10, description:"+10% Strength" },
      { type:"crit_chance", value:0.05, description:"+5% Critical Chance vs monsters" },
    ],
  },
  {
    id: "versatile",
    name: "Versatile",
    rarity: "Uncommon", icon: "🔄", category: "Combat",
    tagline: "No single strength — but no weakness either.",
    lore: "Your body optimised across every dimension, trading peaks for consistency.",
    effects: [{ type:"all_stats_mult", mult:1.05, description:"+5% to all stats" }],
  },
  {
    id: "tenacious",
    name: "Tenacious",
    rarity: "Uncommon", icon: "🔥", category: "Progression",
    tagline: "Defeat teaches you more than victory ever could.",
    lore: "Every loss etches lessons into your bones, making you harder to beat twice.",
    effects: [
      { type:"xp_mult", mult:1.15, description:"+15% XP from all sources" },
      { type:"max_hp_mult", mult:1.06, description:"+6% Max HP" },
    ],
  },

  // ── RARE (9) ────────────────────────────────────────────────────────────────
  {
    id: "berserkers_blood",
    name: "Berserker's Blood",
    rarity: "Rare", icon: "🩸", category: "Combat",
    tagline: "Pain awakens something primal in you.",
    lore: "A savage inheritance — when your blood runs hot, your strikes become unstoppable.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.18, description:"+18% Strength (always active)" },
      { type:"special", specialKey:"berserker_low_hp", description:"+25% ATK bonus when below 40% HP" },
    ],
  },
  {
    id: "stone_ward",
    name: "Stone Ward",
    rarity: "Rare", icon: "🪨", category: "Resilience",
    tagline: "Your body absorbs impacts that would shatter stone.",
    lore: "An ancient ward flows through your bloodline, hardening flesh against force.",
    effects: [
      { type:"stat_mult", stat:"Def", mult:1.20, description:"+20% Defence" },
      { type:"special", specialKey:"stun_immunity_once", description:"Immune to the first stun per battle" },
    ],
  },
  {
    id: "shadowstep",
    name: "Shadowstep",
    rarity: "Rare", icon: "🌑", category: "Combat",
    tagline: "You're never where your enemy thinks you are.",
    lore: "A half-step out of phase with the visible world, you move through gaps others cannot see.",
    effects: [
      { type:"dodge_chance", value:0.12, description:"+12% Dodge Chance" },
      { type:"stat_mult", stat:"Spd", mult:1.15, description:"+15% Speed" },
    ],
  },
  {
    id: "arcane_vessel",
    name: "Arcane Vessel",
    rarity: "Rare", icon: "🧿", category: "Mystical",
    tagline: "Your body holds more mana than it should.",
    lore: "The arcane reservoir in your bloodline is simply larger than normal — unnervingly so.",
    effects: [
      { type:"stat_mult", stat:"Int", mult:1.18, description:"+18% Intelligence" },
      { type:"special", specialKey:"mana_pool_boost", description:"+30% Max Mana, skills cost 10% less" },
    ],
  },
  {
    id: "blood_drinker",
    name: "Blood Drinker",
    rarity: "Rare", icon: "🦇", category: "Combat",
    tagline: "Every wound you deal feeds you in return.",
    lore: "An old vampiric strain pulses faintly in your veins, stealing life with every strike.",
    effects: [{ type:"lifesteal", value:0.04, description:"4% Lifesteal on all attacks" }],
  },
  {
    id: "cursed_resolve",
    name: "Cursed Resolve",
    rarity: "Rare", icon: "☠️", category: "Combat",
    tagline: "Curses only make you angrier.",
    lore: "A curse placed on your bloodline backfired — it now fuels your wrath instead.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.15, description:"+15% Strength" },
      { type:"special", specialKey:"debuff_atk_bonus", description:"+35% ATK when under any negative status effect" },
    ],
  },
  {
    id: "fortune_finder",
    name: "Fortune Finder",
    rarity: "Rare", icon: "🍀", category: "Fortune",
    tagline: "Rare things fall your way more often than probability allows.",
    lore: "Fortune-seekers swear something in your presence bends the odds.",
    effects: [
      { type:"shard_mult", mult:1.30, description:"+30% Shard drops" },
      { type:"gold_mult", mult:1.15, description:"+15% Gold drops" },
      { type:"stat_mult", stat:"Luck", mult:1.15, description:"+15% Luck" },
    ],
  },
  {
    id: "battle_trance",
    name: "Battle Trance",
    rarity: "Rare", icon: "😤", category: "Combat",
    tagline: "The longer you fight, the more dangerous you become.",
    lore: "Combat doesn't exhaust you — it centres you. Each blow lands cleaner than the last.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.10, description:"+10% Strength" },
      { type:"special", specialKey:"momentum_stacks", description:"Consecutive hits stack +6% ATK (up to 3 stacks)" },
    ],
  },
  {
    id: "ancient_memory",
    name: "Ancient Memory",
    rarity: "Rare", icon: "📜", category: "Mystical",
    tagline: "You remember skills that haven't been taught in centuries.",
    lore: "Ancestral muscle memory resurfaces in combat — forms you never trained but somehow know.",
    effects: [
      { type:"xp_mult", mult:1.20, description:"+20% XP gain" },
      { type:"special", specialKey:"extra_skill_slot", description:"Equip one additional skill (9 slots instead of 8)" },
    ],
  },

  // ── EPIC (6) ────────────────────────────────────────────────────────────────
  {
    id: "war_gods_favor",
    name: "War God's Favor",
    rarity: "Epic", icon: "⚔️", category: "Combat",
    tagline: "A deity of war marked you before you were born.",
    lore: "The war god's blessing doesn't grant peace — it grants unmatched ferocity.",
    effects: [
      { type:"stat_mult", stat:"Str", mult:1.22, description:"+22% Strength" },
      { type:"stat_mult", stat:"Spd", mult:1.15, description:"+15% Speed" },
      { type:"crit_chance", value:0.08, description:"+8% Critical Chance" },
    ],
  },
  {
    id: "titans_constitution",
    name: "Titan's Constitution",
    rarity: "Epic", icon: "🏔️", category: "Resilience",
    tagline: "Built like stone, enduring like mountains.",
    lore: "Titan blood runs thin in most of the world — not in you.",
    effects: [
      { type:"max_hp_mult", mult:1.30, description:"+30% Max HP" },
      { type:"stat_mult", stat:"Def", mult:1.22, description:"+22% Defence" },
      { type:"heal_mult", mult:1.15, description:"+15% Healing" },
    ],
  },
  {
    id: "shadow_soul",
    name: "Shadow Soul",
    rarity: "Epic", icon: "🌚", category: "Combat",
    tagline: "Half of you lives in the shadow plane — permanently.",
    lore: "The veil between you and darkness has worn gossamer-thin.",
    effects: [
      { type:"crit_damage", value:0.40, description:"+40% Critical Damage" },
      { type:"dodge_chance", value:0.15, description:"+15% Dodge Chance" },
      { type:"lifesteal", value:0.05, description:"5% Lifesteal" },
    ],
  },
  {
    id: "ancestral_power",
    name: "Ancestral Power",
    rarity: "Epic", icon: "🧬", category: "Mystical",
    tagline: "Your racial gifts run deeper than the surface.",
    lore: "The ancient bloodlines that gave each race its nature flow strongest through you.",
    effects: [
      { type:"all_stats_mult", mult:1.10, description:"+10% to all stats" },
      { type:"special", specialKey:"racial_bonus_double", description:"Your racial stat bonuses are doubled" },
    ],
  },
  {
    id: "mana_surge",
    name: "Mana Surge",
    rarity: "Epic", icon: "💫", category: "Mystical",
    tagline: "Your spells don't channel — they erupt.",
    lore: "An uncontrolled arcane resonance makes your magic punch far above its weight.",
    effects: [
      { type:"stat_mult", stat:"Int", mult:1.25, description:"+25% Intelligence" },
      { type:"special", specialKey:"skill_damage_boost", description:"+35% Skill Damage" },
      { type:"special", specialKey:"mana_pool_boost", description:"+25% Max Mana" },
    ],
  },
  {
    id: "fortunes_child",
    name: "Fortune's Child",
    rarity: "Epic", icon: "🌈", category: "Fortune",
    tagline: "The universe conspires to fill your pockets.",
    lore: "Born under a triple conjunction of fortune stars, your wealth magnetism is extraordinary.",
    effects: [
      { type:"gold_mult", mult:1.30, description:"+30% Gold from all sources" },
      { type:"shard_mult", mult:1.25, description:"+25% Shard drops" },
      { type:"stat_mult", stat:"Luck", mult:1.20, description:"+20% Luck" },
    ],
  },

  // ── LEGENDARY (4) ────────────────────────────────────────────────────────────
  {
    id: "undying_will",
    name: "Undying Will",
    rarity: "Legendary", icon: "♾️", category: "Legendary",
    tagline: "Death has tried to collect you before. It failed.",
    lore: "Your will to live defies the natural order — once per battle, death itself flinches.",
    effects: [
      { type:"special", specialKey:"survive_killing_blow", description:"Once per battle: survive a fatal hit with 1 HP" },
      { type:"max_hp_mult", mult:1.15, description:"+15% Max HP" },
      { type:"stat_mult", stat:"Def", mult:1.15, description:"+15% Defence" },
    ],
  },
  {
    id: "true_sight",
    name: "True Sight",
    rarity: "Legendary", icon: "👁️", category: "Legendary",
    tagline: "Nothing is hidden from you — not feints, not shadows, not fate.",
    lore: "Your gaze pierces deception on a fundamental level. Lies wither under your attention.",
    effects: [
      { type:"special", specialKey:"ignore_dodge", description:"Your attacks cannot be dodged" },
      { type:"crit_chance", value:0.15, description:"+15% Critical Chance" },
      { type:"crit_damage", value:0.50, description:"+50% Critical Damage" },
    ],
  },
  {
    id: "bloodline_of_champions",
    name: "Bloodline of Champions",
    rarity: "Legendary", icon: "🏆", category: "Legendary",
    tagline: "Every ancestor of yours was the greatest in their generation.",
    lore: "A dynasty of excellence compresses itself into your veins.",
    effects: [
      { type:"all_stats_mult", mult:1.18, description:"+18% to all stats" },
      { type:"xp_mult", mult:1.20, description:"+20% XP gain" },
      { type:"gold_mult", mult:1.15, description:"+15% Gold gain" },
    ],
  },
  {
    id: "dimensional_anchor",
    name: "Dimensional Anchor",
    rarity: "Legendary", icon: "⚓", category: "Legendary",
    tagline: "Reality holds you more firmly than it holds anyone else.",
    lore: "You are immovably tethered to this plane — debuffs and debilitation cannot find purchase.",
    effects: [
      { type:"special", specialKey:"debuff_immunity", description:"Immune to all negative status effects" },
      { type:"all_stats_mult", mult:1.12, description:"+12% to all stats" },
    ],
  },

  // ── MYTHIC (2) ────────────────────────────────────────────────────────────────
  {
    id: "genesis_blood",
    name: "Genesis Blood",
    rarity: "Mythic", icon: "🌌", category: "Legendary",
    tagline: "You carry the blood of a world's beginning.",
    lore: "A fragment of primordial creation energy encoded itself into your DNA at birth. Scientists cannot explain it. Enemies cannot survive it.",
    effects: [
      { type:"all_stats_mult", mult:1.25, description:"+25% to all stats" },
      { type:"xp_mult", mult:1.25, description:"+25% XP gain" },
      { type:"gold_mult", mult:1.20, description:"+20% Gold gain" },
      { type:"special", specialKey:"genesis_surge", description:"Genesis Surge: once per 10 battles, all stats double for that fight" },
    ],
  },
  {
    id: "the_chosen_one",
    name: "The Chosen One",
    rarity: "Mythic", icon: "✨", category: "Legendary",
    tagline: "There are prophecies about you. They are not wrong.",
    lore: "Written in the stars before your birth — victory is not your goal, it is your destiny.",
    effects: [
      { type:"all_stats_mult", mult:1.20, description:"+20% to all stats" },
      { type:"stat_mult", stat:"Luck", mult:1.50, description:"+50% Luck" },
      { type:"shard_mult", mult:1.50, description:"+50% Shard drops" },
      { type:"special", specialKey:"chosen_surge", description:"Every 100th combat: all stats ×2 for that fight" },
    ],
  },
];

// ─── Rarity roll tables ────────────────────────────────────────────────────────
// 3 traits per player, each rolled from progressively rarer pools

const SLOT_WEIGHTS: Record<number, [TraitRarity, number][]> = {
  0: [["Common", 70], ["Uncommon", 25], ["Rare", 5]],
  1: [["Common", 35], ["Uncommon", 35], ["Rare", 22], ["Epic", 8]],
  2: [["Common", 15], ["Uncommon", 28], ["Rare", 30], ["Epic", 18], ["Legendary", 7], ["Mythic", 2]],
};

export const RARITY_CHANCE: Record<TraitRarity, number> = {
  Common: (70 + 35 + 15) / 300,
  Uncommon: (25 + 35 + 28) / 300,
  Rare: (5 + 22 + 30) / 300,
  Epic: (8 + 18) / 300,
  Legendary: 7 / 300,
  Mythic: 2 / 300,
};

function rollRarity(slot: number): TraitRarity {
  const weights = SLOT_WEIGHTS[slot] ?? SLOT_WEIGHTS[2];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "Common";
}

export function rollGeneticTraits(): string[] {
  const traitsByRarity = ALL_TRAITS.reduce((acc, t) => {
    if (!acc[t.rarity]) acc[t.rarity] = [];
    acc[t.rarity].push(t.id);
    return acc;
  }, {} as Record<TraitRarity, string[]>);

  const chosen: string[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const rarity = rollRarity(slot);
    const pool = traitsByRarity[rarity] ?? traitsByRarity["Common"];
    const available = pool.filter(id => !chosen.includes(id));
    if (available.length > 0) {
      chosen.push(available[Math.floor(Math.random() * available.length)]);
    }
  }
  return chosen;
}

export function getTraitDef(id: string): GeneticTrait | undefined {
  return ALL_TRAITS.find(t => t.id === id);
}

// ─── Bonus calculator ─────────────────────────────────────────────────────────
// Returns effective stat multipliers and special flags from an array of trait IDs

export type TraitBonuses = {
  statMult: Record<string, number>;  // "Str" → multiplier applied on top of each other
  maxHpMult: number;
  xpMult: number;
  goldMult: number;
  shardMult: number;
  critChanceBonus: number;
  critDamageBonus: number;
  dodgeChanceBonus: number;
  lifesteal: number;
  healMult: number;
  specialKeys: string[];
};

export function calcTraitBonuses(traitIds: string[]): TraitBonuses {
  const out: TraitBonuses = {
    statMult: { Str:1, Def:1, Spd:1, Int:1, Luck:1, Pot:1 },
    maxHpMult: 1, xpMult: 1, goldMult: 1, shardMult: 1,
    critChanceBonus: 0, critDamageBonus: 0, dodgeChanceBonus: 0,
    lifesteal: 0, healMult: 1, specialKeys: [],
  };

  for (const id of traitIds) {
    const trait = getTraitDef(id);
    if (!trait) continue;
    for (const eff of trait.effects) {
      switch (eff.type) {
        case "stat_mult":
          if (eff.stat) out.statMult[eff.stat] = (out.statMult[eff.stat] ?? 1) * (eff.mult ?? 1);
          break;
        case "all_stats_mult":
          for (const k of ["Str","Def","Spd","Int","Luck"]) {
            out.statMult[k] = (out.statMult[k] ?? 1) * (eff.mult ?? 1);
          }
          break;
        case "max_hp_mult":    out.maxHpMult         *= eff.mult ?? 1;    break;
        case "xp_mult":        out.xpMult            *= eff.mult ?? 1;    break;
        case "gold_mult":      out.goldMult          *= eff.mult ?? 1;    break;
        case "shard_mult":     out.shardMult         *= eff.mult ?? 1;    break;
        case "crit_chance":    out.critChanceBonus   += eff.value ?? 0;   break;
        case "crit_damage":    out.critDamageBonus   += eff.value ?? 0;   break;
        case "dodge_chance":   out.dodgeChanceBonus  += eff.value ?? 0;   break;
        case "lifesteal":      out.lifesteal         += eff.value ?? 0;   break;
        case "heal_mult":      out.healMult          *= eff.mult ?? 1;    break;
        case "special":
          if (eff.specialKey) out.specialKeys.push(eff.specialKey);
          break;
      }
    }
  }
  return out;
}

export function applyTraitStatMult(stats: Record<string,number>, bonuses: TraitBonuses): Record<string,number> {
  const out: Record<string,number> = { ...stats };
  for (const [k, mult] of Object.entries(bonuses.statMult)) {
    if (out[k] !== undefined && mult !== 1) out[k] = Math.round(out[k] * mult);
  }
  return out;
}
