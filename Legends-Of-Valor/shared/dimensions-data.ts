// ─── Alternate Dimensions System ──────────────────────────────────────────────
// Rare portals open rifts to alternate dimensions — each one bending the rules
// of combat in unique ways. 5-encounter runs, scaling rewards, boss at the end.
// ──────────────────────────────────────────────────────────────────────────────

export type DimensionRule =
  | "no_heal"            // all healing is halved
  | "magic_only"         // physical attacks deal 0 damage (skills only)
  | "double_mana"        // all skill mana costs ×2
  | "time_pressure"      // enemy gains +12% ATK per 3 rounds elapsed
  | "mirror_enemy"       // enemy has same stats as player (adjusted)
  | "chaos_backfire"     // 35% chance skills backfire (hit self)
  | "burn_on_hit"        // every hit (both sides) applies 1-round burn
  | "holy_inversion"     // enemy heals 30% of damage from non-skill attacks
  | "void_gravity"       // player Spd halved, enemy Def ×1.5, player Str ×1.3
  | "no_defense_action"; // "defend" action is disabled for both sides

export type DimensionReward = {
  currency: string;   // display name, e.g. "Void Crystal"
  currencyIcon: string;
  currencyField: string; // maps to account field (or "soulShards" as fallback)
  goldMultiplier: number;
  shardMultiplier: number;
};

export type DimensionEnemyTemplate = {
  id: string;
  name: string;
  title: string;       // short flavour
  icon: string;
  isBoss: boolean;
  isMiniBoss: boolean;
  statScale: number;   // multiplied against player's rank-based stat floor
  healthScale: number; // multiplied against player's max HP to set enemy HP
  skills: string[];    // flavour skill names (used for log messages)
  resistances: string[];  // stat names with +40% effective defence
  weaknesses: string[];   // stat names with -30% effective defence
  lootBonus: number;   // 0-1 extra gold multiplier on kill
};

export type DimensionDef = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  color: string;       // tailwind gradient pair e.g. "from-indigo-950 to-purple-950"
  borderColor: string; // e.g. "border-purple-700"
  textColor: string;
  loreText: string;
  accessRequirement: string;  // display text
  minRank: string;
  rules: DimensionRule[];
  ruleDescriptions: string[];
  reward: DimensionReward;
  enemies: DimensionEnemyTemplate[];  // 3 mobs + 1 mini + 1 boss
};

export const DIMENSIONS: DimensionDef[] = [
  // ── 1. THE VOID ─────────────────────────────────────────────────────────────
  {
    id: "void",
    name: "The Void",
    subtitle: "Where gravity means nothing and shadows eat light",
    icon: "🌑",
    color: "from-slate-950 to-indigo-950",
    borderColor: "border-indigo-800",
    textColor: "text-indigo-300",
    loreText: "Beyond the fabric of the known world, The Void stretches endlessly. Creatures that dwell here have shed their physical forms, relying on pure dimensional energy to destroy trespassers.",
    accessRequirement: "Portal Shard or random event",
    minRank: "Novice",
    rules: ["void_gravity", "no_defense_action"],
    ruleDescriptions: [
      "⚫ Void Gravity — your Speed is halved, enemy Defence ×1.5, but your Strength gains +30%",
      "🚫 Unstable Ground — neither side can take the 'Defend' action",
    ],
    reward: {
      currency: "Void Crystal", currencyIcon: "💠", currencyField: "soulShards",
      goldMultiplier: 1.5, shardMultiplier: 2.0,
    },
    enemies: [
      { id:"void_wisp",     name:"Void Wisp",        title:"Spectral Horror",  icon:"👻", isBoss:false, isMiniBoss:false, statScale:0.7, healthScale:0.5, skills:["Void Pulse","Phase Shift"],          resistances:["Def"], weaknesses:["Int"],  lootBonus:0.2 },
      { id:"void_crawler",  name:"Void Crawler",     title:"Dimensional Beast",icon:"🕷️", isBoss:false, isMiniBoss:false, statScale:0.8, healthScale:0.6, skills:["Gravity Crush","Null Strike"],       resistances:["Spd"], weaknesses:["Str"],  lootBonus:0.2 },
      { id:"void_sentinel", name:"Void Sentinel",    title:"Rift Guardian",    icon:"🗿", isBoss:false, isMiniBoss:false, statScale:0.9, healthScale:0.7, skills:["Dimensional Rift","Void Anchor"],     resistances:["Def"], weaknesses:["Luck"], lootBonus:0.3 },
      { id:"void_herald",   name:"Void Herald",      title:"Gate Keeper",      icon:"🌀", isBoss:false, isMiniBoss:true,  statScale:1.1, healthScale:1.0, skills:["Void Warp","Reality Shred","Null Aura"], resistances:["Int"], weaknesses:["Spd"], lootBonus:0.5 },
      { id:"void_sovereign",name:"Voidlord Azarak",  title:"Ruler of Emptiness",icon:"♾️",isBoss:true,  isMiniBoss:false, statScale:1.6, healthScale:1.8, skills:["Absolute Zero","Entropy Collapse","Void Throne","Oblivion"], resistances:["Def","Spd"], weaknesses:["Int"], lootBonus:1.5 },
    ],
  },
  // ── 2. INFERNO REALM ────────────────────────────────────────────────────────
  {
    id: "inferno",
    name: "Inferno Realm",
    subtitle: "Every breath burns, every wound ignites",
    icon: "🔥",
    color: "from-red-950 to-orange-950",
    borderColor: "border-red-700",
    textColor: "text-red-300",
    loreText: "The Inferno Realm is not merely hot — it is the birthplace of fire itself. The creatures here have burned for aeons and feel nothing. Adventurers face constant burn damage regardless of action.",
    accessRequirement: "Portal Shard or rank Expert+",
    minRank: "Expert",
    rules: ["burn_on_hit", "no_heal"],
    ruleDescriptions: [
      "🔥 Eternal Flame — every hit (by both sides) applies a 2-round burn",
      "💔 Cauterized Wounds — all healing is halved in this realm",
    ],
    reward: {
      currency: "Ember Shard", currencyIcon: "🔴", currencyField: "focusedShards",
      goldMultiplier: 2.0, shardMultiplier: 1.5,
    },
    enemies: [
      { id:"fire_imp",     name:"Fire Imp",       title:"Chaos Spawn",    icon:"😈", isBoss:false, isMiniBoss:false, statScale:0.75, healthScale:0.55, skills:["Ember Toss","Ignite"],               resistances:["Int"], weaknesses:["Def"],  lootBonus:0.2 },
      { id:"lava_golem",   name:"Lava Golem",     title:"Molten Terror",  icon:"🌋", isBoss:false, isMiniBoss:false, statScale:0.9,  healthScale:0.85, skills:["Magma Slam","Eruption"],             resistances:["Def"], weaknesses:["Spd"],  lootBonus:0.3 },
      { id:"flame_djinn",  name:"Flame Djinn",    title:"Infernal Spirit",icon:"🧞", isBoss:false, isMiniBoss:false, statScale:0.95, healthScale:0.7,  skills:["Infernal Wish","Fire Storm","Scorch"],resistances:["Int","Str"], weaknesses:["Luck"], lootBonus:0.4 },
      { id:"pyro_knight",  name:"Pyromancer Knight",title:"Blazing Warden",icon:"⚔️",isBoss:false, isMiniBoss:true,  statScale:1.2,  healthScale:1.1,  skills:["Blade of Cinder","Magma Armor","Pyroclast"], resistances:["Def","Int"], weaknesses:["Spd"], lootBonus:0.7 },
      { id:"inferno_king",  name:"Ignar the Undying",title:"Eternal Flame Lord",icon:"👑",isBoss:true,isMiniBoss:false,statScale:1.7,healthScale:2.0,  skills:["World Fire","Eternal Blaze","Undying Pyre","Magma Throne"], resistances:["Def","Int","Str"], weaknesses:["Luck"], lootBonus:2.0 },
    ],
  },
  // ── 3. TEMPORAL RIFT ────────────────────────────────────────────────────────
  {
    id: "temporal",
    name: "Temporal Rift",
    subtitle: "The past and future collapse into a single lethal moment",
    icon: "⏳",
    color: "from-amber-950 to-yellow-950",
    borderColor: "border-amber-700",
    textColor: "text-amber-300",
    loreText: "Inside the Temporal Rift, time fractures. The longer a battle lasts, the more the enemy draws power from all your possible future defeats. Speed is everything here.",
    accessRequirement: "Portal Shard or rank Master+",
    minRank: "Master",
    rules: ["time_pressure"],
    ruleDescriptions: [
      "⏳ Temporal Escalation — enemy gains +12% ATK for every 3 rounds that pass. End fights fast.",
    ],
    reward: {
      currency: "Chrono Fragment", currencyIcon: "⌚", currencyField: "mysticShards",
      goldMultiplier: 1.8, shardMultiplier: 1.8,
    },
    enemies: [
      { id:"time_echo",    name:"Time Echo",       title:"Fractured Memory",icon:"👤",isBoss:false, isMiniBoss:false, statScale:0.8, healthScale:0.6, skills:["Echo Strike","Future Sight"],          resistances:["Spd"], weaknesses:["Str"],  lootBonus:0.2 },
      { id:"chrono_beast", name:"Chrono Beast",    title:"Temporal Hunter", icon:"🦁",isBoss:false, isMiniBoss:false, statScale:0.9, healthScale:0.75, skills:["Time Claw","Rewind"],                 resistances:["Int"], weaknesses:["Def"],  lootBonus:0.3 },
      { id:"paradox_mage", name:"Paradox Mage",    title:"Living Contradiction",icon:"🧙",isBoss:false,isMiniBoss:false,statScale:1.0,healthScale:0.8, skills:["Paradox Bolt","Phase Leap","Temporal Loop"], resistances:["Int","Spd"], weaknesses:["Luck"], lootBonus:0.4 },
      { id:"rift_warden",  name:"Rift Warden",     title:"Keeper of Moments",icon:"🛡️",isBoss:false, isMiniBoss:true,  statScale:1.25, healthScale:1.15, skills:["Time Lock","Moment Crush","Chronosphere"], resistances:["Def","Spd"], weaknesses:["Int"], lootBonus:0.8 },
      { id:"kronos_prime", name:"Kronos Prime",    title:"Architect of Time", icon:"🕰️",isBoss:true,isMiniBoss:false,statScale:1.8,healthScale:2.2,   skills:["Eternal Loop","Time Stop","Destiny Crush","Age of Ruin"], resistances:["Def","Int","Spd"], weaknesses:["Luck"], lootBonus:2.5 },
    ],
  },
  // ── 4. CRYSTAL LABYRINTH ────────────────────────────────────────────────────
  {
    id: "crystal",
    name: "Crystal Labyrinth",
    subtitle: "Physical force shatters against pure crystal — only magic prevails",
    icon: "💎",
    color: "from-cyan-950 to-teal-950",
    borderColor: "border-cyan-700",
    textColor: "text-cyan-300",
    loreText: "The Crystal Labyrinth is a maze of perfectly grown arcane crystals that absorb and reflect physical energy entirely. Only magical skills can damage the crystalline beings within.",
    accessRequirement: "Portal Shard or rank Grandmaster+",
    minRank: "Grandmaster",
    rules: ["magic_only", "double_mana"],
    ruleDescriptions: [
      "💎 Crystal Shell — physical attacks deal zero damage. Skills are the only way to deal damage.",
      "💧 Mana Drain — all skills cost double the normal mana.",
    ],
    reward: {
      currency: "Crystal Essence", currencyIcon: "🔷", currencyField: "focusedShards",
      goldMultiplier: 2.2, shardMultiplier: 2.0,
    },
    enemies: [
      { id:"crystal_sprite",name:"Crystal Sprite",  title:"Gem Guardian",    icon:"🔹",isBoss:false, isMiniBoss:false, statScale:0.8, healthScale:0.65, skills:["Prism Bolt","Crystal Shard"],         resistances:["Def","Str"], weaknesses:["Int"], lootBonus:0.2 },
      { id:"quartz_golem",  name:"Quartz Golem",    title:"Living Mineral",  icon:"🗿",isBoss:false, isMiniBoss:false, statScale:0.9, healthScale:0.9,  skills:["Facet Slam","Refraction"],            resistances:["Def","Str"], weaknesses:["Spd"], lootBonus:0.3 },
      { id:"gem_mage",      name:"Gem Mage",        title:"Arcane Crystallist",icon:"🔮",isBoss:false,isMiniBoss:false,statScale:1.0, healthScale:0.75, skills:["Gem Storm","Crystal Lance","Prismatic Ray"],resistances:["Int"], weaknesses:["Luck"], lootBonus:0.4 },
      { id:"sapphire_lord", name:"Sapphire Lord",   title:"Labyrinth Keeper",icon:"💠",isBoss:false, isMiniBoss:true,  statScale:1.3, healthScale:1.2,  skills:["Azure Torrent","Gem Matrix","Crystal Prison"], resistances:["Def","Str","Int"], weaknesses:["Luck"], lootBonus:0.9 },
      { id:"diamond_titan", name:"Diamondus Rex",   title:"Lord of Pure Form",icon:"💎",isBoss:true, isMiniBoss:false, statScale:1.9, healthScale:2.4,  skills:["Diamond Annihilation","Perfect Prism","Facet Finale","Crystal Genesis"], resistances:["Def","Str","Spd"], weaknesses:["Luck"], lootBonus:3.0 },
    ],
  },
  // ── 5. SHADOW MIRROR ────────────────────────────────────────────────────────
  {
    id: "shadow_mirror",
    name: "Shadow Mirror",
    subtitle: "Face the darkest reflection of yourself",
    icon: "🪞",
    color: "from-gray-950 to-zinc-950",
    borderColor: "border-gray-600",
    textColor: "text-gray-300",
    loreText: "The Shadow Mirror dimension exists as a perfect reflection of the real world. Your shadow-self steps through the glass, bearing your own power against you. To win here, you must know yourself.",
    accessRequirement: "Portal Shard or rank Champion+",
    minRank: "Champion",
    rules: ["mirror_enemy"],
    ruleDescriptions: [
      "🪞 Perfect Reflection — enemies in this dimension scale directly from your own stats (80–120%). No build is safe.",
    ],
    reward: {
      currency: "Mirror Shard", currencyIcon: "🔘", currencyField: "runes",
      goldMultiplier: 2.5, shardMultiplier: 2.5,
    },
    enemies: [
      { id:"shadow_self_1", name:"Faded Echo",      title:"Lesser Reflection",icon:"👤",isBoss:false, isMiniBoss:false, statScale:0.65, healthScale:0.6, skills:["Shadow Strike","Dark Copy"],          resistances:[], weaknesses:[], lootBonus:0.3 },
      { id:"shadow_self_2", name:"Dark Double",     title:"Twisted Mirror",   icon:"🌑",isBoss:false, isMiniBoss:false, statScale:0.80, healthScale:0.75, skills:["Mirror Slash","Void Step"],          resistances:[], weaknesses:[], lootBonus:0.4 },
      { id:"shadow_self_3", name:"Shadow Twin",     title:"Dark Reflection",  icon:"🖤",isBoss:false, isMiniBoss:false, statScale:0.90, healthScale:0.90, skills:["Twin Strike","Reflective Armor","Dark Mimic"], resistances:[], weaknesses:[], lootBonus:0.5 },
      { id:"shadow_self_4", name:"Dark Champion",   title:"Corrupted Self",   icon:"⚫",isBoss:false, isMiniBoss:true,  statScale:1.05, healthScale:1.1,  skills:["Ego Crush","Shadow Nova","Identity Crisis"], resistances:[], weaknesses:[], lootBonus:0.8 },
      { id:"shadow_self_5", name:"The True Shadow", title:"Your Perfect Dark Self",icon:"🌚",isBoss:true,isMiniBoss:false,statScale:1.25,healthScale:1.6,  skills:["Mirror Apocalypse","True Reflection","Shadow Omega","Dark Genesis"], resistances:[], weaknesses:[], lootBonus:2.0 },
    ],
  },
  // ── 6. CELESTIAL PLANE ──────────────────────────────────────────────────────
  {
    id: "celestial",
    name: "Celestial Plane",
    subtitle: "Holy ground where brute force is blasphemy",
    icon: "✨",
    color: "from-yellow-950 to-amber-950",
    borderColor: "border-yellow-600",
    textColor: "text-yellow-300",
    loreText: "Angels and divine constructs maintain order in the Celestial Plane. Basic violence here offends the heavens — regular attacks fortify these beings rather than harming them. Only refined skill can prevail.",
    accessRequirement: "Portal Shard or rank Overlord+",
    minRank: "Overlord",
    rules: ["holy_inversion"],
    ruleDescriptions: [
      "✨ Holy Inversion — regular attacks restore enemy HP (30% of damage). Deal damage through skills instead.",
    ],
    reward: {
      currency: "Stardust", currencyIcon: "⭐", currencyField: "soulShards",
      goldMultiplier: 2.8, shardMultiplier: 3.0,
    },
    enemies: [
      { id:"celestial_scout",  name:"Celestial Scout",   title:"Divine Messenger",icon:"💫",isBoss:false, isMiniBoss:false, statScale:0.85, healthScale:0.7,  skills:["Holy Dart","Divine Tag"],            resistances:["Int"], weaknesses:["Luck"], lootBonus:0.3 },
      { id:"angel_guardian",   name:"Angel Guardian",    title:"Heavenly Warden", icon:"👼",isBoss:false, isMiniBoss:false, statScale:0.95, healthScale:0.85, skills:["Sacred Shield","Radiant Strike"],      resistances:["Def"], weaknesses:["Spd"],  lootBonus:0.4 },
      { id:"seraph_knight",    name:"Seraph Knight",     title:"Blade of Heaven",  icon:"⚔️",isBoss:false, isMiniBoss:false, statScale:1.05, healthScale:1.0,  skills:["Heaven's Blade","Holy Wrath","Celestial Surge"], resistances:["Str","Int"], weaknesses:["Luck"], lootBonus:0.5 },
      { id:"archangel",        name:"Archangel",         title:"Commander Divine", icon:"😇",isBoss:false, isMiniBoss:true,  statScale:1.35, healthScale:1.3,  skills:["Divine Judgment","Holy Nova","Celestial Army"], resistances:["Def","Int"], weaknesses:["Spd"], lootBonus:1.0 },
      { id:"celestial_god",    name:"Aurelion the Pure",  title:"God of Light",    icon:"🌟",isBoss:true, isMiniBoss:false, statScale:2.0,  healthScale:2.5,  skills:["Divine Apocalypse","Heavenly Ruin","Pure Light","God's Judgment"], resistances:["Def","Int","Str"], weaknesses:["Luck"], lootBonus:3.5 },
    ],
  },
  // ── 7. CORRUPTION ABYSS ─────────────────────────────────────────────────────
  {
    id: "corruption",
    name: "Corruption Abyss",
    subtitle: "Chaos reigns — even your own skills may betray you",
    icon: "☠️",
    color: "from-purple-950 to-pink-950",
    borderColor: "border-purple-700",
    textColor: "text-purple-300",
    loreText: "The Corruption Abyss warps magical intent at the source. Spells cast here have a mind of their own, frequently turning on their caster. Master the chaos or be consumed by it.",
    accessRequirement: "Portal Shard or rank Ascendant+",
    minRank: "Ascendant",
    rules: ["chaos_backfire"],
    ruleDescriptions: [
      "☠️ Chaos Backfire — every time you use a skill, there is a 35% chance it hits you instead of the enemy.",
    ],
    reward: {
      currency: "Corruption Essence", currencyIcon: "🟣", currencyField: "mysticShards",
      goldMultiplier: 3.5, shardMultiplier: 4.0,
    },
    enemies: [
      { id:"corrupt_imp",   name:"Corrupted Imp",    title:"Chaos Spawn",     icon:"👿",isBoss:false, isMiniBoss:false, statScale:0.8,  healthScale:0.65, skills:["Chaos Jab","Disorder"],              resistances:["Luck"], weaknesses:["Str"], lootBonus:0.3 },
      { id:"corrupt_mage",  name:"Corrupted Mage",   title:"Unhinged Caster", icon:"🧙",isBoss:false, isMiniBoss:false, statScale:0.9,  healthScale:0.75, skills:["Wild Magic","Chaos Burst","Unravel"], resistances:["Int"], weaknesses:["Def"], lootBonus:0.4 },
      { id:"chaos_knight",  name:"Chaos Knight",     title:"Disorder Incarnate",icon:"⚔️",isBoss:false,isMiniBoss:false,statScale:1.0, healthScale:0.9,  skills:["Entropy Slash","Chaos Armor","Unbound"],resistances:["Str","Def"], weaknesses:["Spd"], lootBonus:0.5 },
      { id:"abyss_lord",    name:"Abyss Lord",       title:"Master of Chaos",  icon:"🌀",isBoss:false, isMiniBoss:true,  statScale:1.4,  healthScale:1.25, skills:["Chaos Nova","Abyss Rift","Disorder Field"], resistances:["Def","Int"], weaknesses:["Luck"], lootBonus:1.0 },
      { id:"corruption_god",name:"Malachar the Broken",title:"God of Chaos",   icon:"💀",isBoss:true,  isMiniBoss:false, statScale:2.1,  healthScale:2.8,  skills:["Perfect Chaos","Entropy God","All is Nothing","Corruption Omega"], resistances:["Def","Int","Str","Spd"], weaknesses:["Luck"], lootBonus:4.0 },
    ],
  },
];

export function getDimension(id: string): DimensionDef | undefined {
  return DIMENSIONS.find(d => d.id === id);
}

// ─── Portal chance helpers ────────────────────────────────────────────────────

export const PORTAL_BASE_CHANCE = 0.06;  // 6% on each login

/** Eligible dimensions based on player rank */
export function getEligibleDimensions(rank: string): DimensionDef[] {
  const rankIndex = [
    "Novice","Apprentice","Initiate","Journeyman","Adept","Expert","Master",
    "Grandmaster","Champion","Overlord","Sovereign","Ascendant","Legend","Mythic","Mythical Legend"
  ].indexOf(rank);
  return DIMENSIONS.filter(d => {
    const minIdx = [
      "Novice","Apprentice","Initiate","Journeyman","Adept","Expert","Master",
      "Grandmaster","Champion","Overlord","Sovereign","Ascendant","Legend","Mythic","Mythical Legend"
    ].indexOf(d.minRank);
    return rankIndex >= minIdx;
  });
}

/** Pick a random dimension for a portal event */
export function rollRandomDimension(rank: string): DimensionDef {
  const eligible = getEligibleDimensions(rank);
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ─── Rank-based stat floor for enemy scaling ──────────────────────────────────
const RANK_STAT_FLOOR: Record<string, number> = {
  "Novice":10,"Apprentice":15,"Initiate":20,"Journeyman":28,"Adept":38,"Expert":50,
  "Master":65,"Grandmaster":85,"Champion":110,"Overlord":140,"Sovereign":175,
  "Ascendant":215,"Legend":260,"Mythic":310,"Mythical Legend":370,
};

export function buildEnemyCombatant(
  template: DimensionEnemyTemplate,
  playerRank: string,
  playerStats: Record<string, number>,
  dimensionRules: DimensionRule[],
): {
  name: string; icon: string;
  hp: number; maxHp: number;
  stats: Record<string, number>;
  isBoss: boolean;
  isMiniBoss: boolean;
  skills: string[];
  lootBonus: number;
} {
  const floor = RANK_STAT_FLOOR[playerRank] ?? 10;
  const base = floor * template.statScale;

  let str  = Math.round(base * 1.0);
  let def  = Math.round(base * 0.85);
  let spd  = Math.round(base * 0.90);
  let int_ = Math.round(base * 0.80);
  let luck = Math.round(base * 0.70);

  // If mirror enemy, base on player stats directly
  if (dimensionRules.includes("mirror_enemy")) {
    str  = Math.round((playerStats.Str  ?? floor) * template.statScale);
    def  = Math.round((playerStats.Def  ?? floor) * template.statScale);
    spd  = Math.round((playerStats.Spd  ?? floor) * template.statScale);
    int_ = Math.round((playerStats.Int  ?? floor) * template.statScale);
    luck = Math.round((playerStats.Luck ?? floor) * template.statScale);
  }

  // Apply resistances and weaknesses
  const resistBoost  = 1.4;
  const weakenReduce = 0.7;
  if (template.resistances.includes("Str"))  str  = Math.round(str  * resistBoost);
  if (template.resistances.includes("Def"))  def  = Math.round(def  * resistBoost);
  if (template.resistances.includes("Spd"))  spd  = Math.round(spd  * resistBoost);
  if (template.resistances.includes("Int"))  int_ = Math.round(int_ * resistBoost);
  if (template.resistances.includes("Luck")) luck = Math.round(luck * resistBoost);
  if (template.weaknesses.includes("Str"))   str  = Math.round(str  * weakenReduce);
  if (template.weaknesses.includes("Def"))   def  = Math.round(def  * weakenReduce);
  if (template.weaknesses.includes("Spd"))   spd  = Math.round(spd  * weakenReduce);
  if (template.weaknesses.includes("Int"))   int_ = Math.round(int_ * weakenReduce);
  if (template.weaknesses.includes("Luck"))  luck = Math.round(luck * weakenReduce);

  const RANK_HP: Record<string, number> = {
    "Novice":0,"Apprentice":20,"Initiate":40,"Journeyman":65,"Adept":95,
    "Expert":130,"Master":170,"Grandmaster":220,"Champion":280,"Overlord":350,
    "Sovereign":430,"Ascendant":520,"Legend":620,"Mythic":740,"Mythical Legend":880,
  };
  const rankHp = RANK_HP[playerRank] ?? 0;
  const baseHp = Math.round((100 + rankHp) * template.healthScale);

  return {
    name:        template.name,
    icon:        template.icon,
    hp:          baseHp,
    maxHp:       baseHp,
    stats:       { Str:str, Def:def, Spd:spd, Int:int_, Luck:luck, Pot:0 },
    isBoss:      template.isBoss,
    isMiniBoss:  template.isMiniBoss,
    skills:      template.skills,
    lootBonus:   template.lootBonus,
  };
}
