// ─── Skill Tree Definitions ───────────────────────────────────────────────────
// 14 races × 3 branches × 5 nodes = 210 total nodes
// Branch codes: c=combat, m=mastery, a=ascension
// Tier cost: T1=1 TP, T2=2 TP, T3=3 TP, T4=5 TP
// Prerequisites: T2a/b → T1 ; T3 → T2a OR T2b ; T4 → T3
// ─────────────────────────────────────────────────────────────────────────────

export type SkillTreeBranch = "combat" | "mastery" | "ascension";
export type SkillTreeTier = 1 | 2 | 3 | 4;

export type NodeEffect = {
  statPct?: Partial<Record<"all" | "Str" | "Def" | "Spd" | "Int" | "Luck", number>>;
  critChancePct?: number;
  lifestealPct?: number;
  dodgePct?: number;
  damageBoostPct?: number;
  cooldownReduction?: number;
  thornsPct?: number;
  goldBonusPct?: number;
  xpBonusPct?: number;
  description: string;
};

export type SkillTreeNodeDef = {
  id: string;
  race: string;
  branch: SkillTreeBranch;
  tier: SkillTreeTier;
  name: string;
  lore: string;
  cost: number;
  prerequisites: string[];
  rankRequirement: string;
  effect: NodeEffect;
  isKeystone?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const TIER_COST: Record<SkillTreeTier, number> = { 1: 1, 2: 2, 3: 3, 4: 5 };

function n(
  race: string, branch: SkillTreeBranch, tier: SkillTreeTier, sub: "" | "a" | "b",
  name: string, lore: string, effect: NodeEffect, rankRequirement = "Novice",
): SkillTreeNodeDef {
  const id = `${race}_${branch[0]}_t${tier}${sub}`;
  const t1 = `${race}_${branch[0]}_t1`;
  const t2a = `${race}_${branch[0]}_t2a`;
  const t2b = `${race}_${branch[0]}_t2b`;
  const t3 = `${race}_${branch[0]}_t3`;
  const prereqs: string[] =
    tier === 1 ? [] :
    tier === 2 ? [t1] :
    tier === 3 ? [t2a, t2b] : // any one of these
    [t3];
  return {
    id, race, branch, tier, name, lore,
    cost: TIER_COST[tier],
    prerequisites: prereqs,
    rankRequirement,
    effect,
    isKeystone: tier === 4,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN — Balanced, adaptable
// ─────────────────────────────────────────────────────────────────────────────
const HUMAN: SkillTreeNodeDef[] = [
  // Combat
  n("human","combat",1,"","Battle Hardened","Forged in a hundred skirmishes, you hit harder.",{statPct:{Str:5},description:"+5% Strength"}),
  n("human","combat",2,"a","Weapon Mastery","You know every edge of your blade.",{statPct:{Str:8},description:"+8% Strength"}),
  n("human","combat",2,"b","Combat Precision","Every strike finds the gap in the armor.",{critChancePct:4,description:"+4% crit chance"}),
  n("human","combat",3,"","Warrior's Fury","Battle rage amplifies every blow.",{statPct:{Str:8},damageBoostPct:5,description:"+8% Str, +5% damage"},"Adept"),
  n("human","combat",4,"","Champion's Resolve","A true champion does not fall.",{statPct:{Str:15},critChancePct:8,description:"+15% Str, +8% crit"},"Master"),
  // Mastery
  n("human","mastery",1,"","Iron Will","Your body endures what others cannot.",{statPct:{Def:5},description:"+5% Defense"}),
  n("human","mastery",2,"a","Stalwart Defense","You take each blow and stand firm.",{statPct:{Def:8},description:"+8% Defense"}),
  n("human","mastery",2,"b","Evasive Maneuver","You've learned when to step aside.",{dodgePct:4,description:"+4% dodge chance"}),
  n("human","mastery",3,"","Unyielding Stance","Every scar makes you harder to break.",{statPct:{Def:10},thornsPct:3,description:"+10% Def, +3% thorns"},"Adept"),
  n("human","mastery",4,"","Juggernaut","Nothing stops you.",{statPct:{Def:15},thornsPct:6,description:"+15% Def, +6% thorns"},"Master"),
  // Ascension
  n("human","ascension",1,"","Human Ingenuity","Adaptability is humanity's greatest weapon.",{statPct:{all:4},description:"+4% all stats"}),
  n("human","ascension",2,"a","Rising Legend","Your story is still being written.",{xpBonusPct:10,description:"+10% XP gain"}),
  n("human","ascension",2,"b","Merchant's Touch","Gold flows to those who know its worth.",{goldBonusPct:12,description:"+12% gold gain"}),
  n("human","ascension",3,"","Renaissance Soul","You master mind, body, and blade alike.",{statPct:{all:6},description:"+6% all stats"},"Adept"),
  n("human","ascension",4,"","Apex Human","The pinnacle of what a person can become.",{statPct:{all:12},critChancePct:5,description:"+12% all stats, +5% crit"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// ELF — Spd/Int, elemental
// ─────────────────────────────────────────────────────────────────────────────
const ELF: SkillTreeNodeDef[] = [
  n("elf","combat",1,"","Elven Swiftness","You move faster than thought.",{statPct:{Spd:6},description:"+6% Speed"}),
  n("elf","combat",2,"a","Swift Strike","Before they see you, the blow lands.",{statPct:{Spd:5},critChancePct:3,description:"+5% Spd, +3% crit"}),
  n("elf","combat",2,"b","Arcane Blade","Your weapon hums with ancient magic.",{statPct:{Int:6},description:"+6% Intelligence"}),
  n("elf","combat",3,"","Wind Dancer","Strike and vanish, then strike again.",{statPct:{Spd:8},damageBoostPct:5,description:"+8% Spd, +5% damage"},"Adept"),
  n("elf","combat",4,"","Stormweave Elf","Lightning-fast blows imbued with arcane force.",{statPct:{Spd:12},damageBoostPct:10,description:"+12% Spd, +10% damage"},"Master"),
  // Mastery
  n("elf","mastery",1,"","Nature's Grace","The forest sustains and restores you.",{statPct:{Int:5},description:"+5% Intelligence"}),
  n("elf","mastery",2,"a","Forest Veil","Tree shadows make you nearly invisible.",{dodgePct:5,description:"+5% dodge"}),
  n("elf","mastery",2,"b","Elven Resilience","Centuries of hardship bred endurance.",{statPct:{Def:5},description:"+5% Defense"}),
  n("elf","mastery",3,"","Ancient Lore","Old magic flows through your blood.",{statPct:{Int:8},lifestealPct:4,description:"+8% Int, +4% lifesteal"},"Adept"),
  n("elf","mastery",4,"","High Elven Mastery","You are the living conduit of ancient power.",{statPct:{Int:12},dodgePct:5,description:"+12% Int, +5% dodge"},"Master"),
  // Ascension
  n("elf","ascension",1,"","Elven Heritage","Your bloodline carries millennia of grace.",{statPct:{all:3},description:"+3% all stats"}),
  n("elf","ascension",2,"a","Arcane Attunement","You resonate with elemental forces.",{statPct:{Int:8},damageBoostPct:3,description:"+8% Int, +3% damage"}),
  n("elf","ascension",2,"b","Star-Step","You walk paths others cannot see.",{statPct:{Spd:8},dodgePct:4,description:"+8% Spd, +4% dodge"}),
  n("elf","ascension",3,"","Moonweave","Silver light weaves through your every action.",{statPct:{all:5},critChancePct:3,description:"+5% all stats, +3% crit"},"Adept"),
  n("elf","ascension",4,"","Elven Ascendant","You have transcended mortal limitations.",{statPct:{Int:15,Spd:8},description:"+15% Int, +8% Spd"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// DWARF — Def/Str, earth
// ─────────────────────────────────────────────────────────────────────────────
const DWARF: SkillTreeNodeDef[] = [
  n("dwarf","combat",1,"","Runic Rage","Dwarven fury doubles your hammer's weight.",{statPct:{Str:6},description:"+6% Strength"}),
  n("dwarf","combat",2,"a","Earthbreaker","Your blows shake the ground itself.",{statPct:{Str:8},description:"+8% Strength"}),
  n("dwarf","combat",2,"b","Forge-Tempered","Your strikes carry volcanic heat.",{damageBoostPct:5,description:"+5% damage"}),
  n("dwarf","combat",3,"","Mountain Fury","Every hit carries the weight of a peak.",{statPct:{Str:10},damageBoostPct:6,description:"+10% Str, +6% damage"},"Adept"),
  n("dwarf","combat",4,"","Titan Hammer","One swing can level a wall.",{statPct:{Str:18},critChancePct:6,description:"+18% Str, +6% crit"},"Master"),
  // Mastery
  n("dwarf","mastery",1,"","Stonewall","You are as immovable as the mountain.",{statPct:{Def:8},description:"+8% Defense"}),
  n("dwarf","mastery",2,"a","Dragonhide Armor","Forged in dragon-fire, your skin is iron.",{statPct:{Def:10},description:"+10% Defense"}),
  n("dwarf","mastery",2,"b","Spiky Shell","Anyone who hits you regrets it.",{thornsPct:5,description:"+5% thorns damage"}),
  n("dwarf","mastery",3,"","Deepstone Resilience","Deep rock has no cracks.",{statPct:{Def:12},thornsPct:4,description:"+12% Def, +4% thorns"},"Adept"),
  n("dwarf","mastery",4,"","Earth Colossus","You are the mountain.",{statPct:{Def:20},thornsPct:8,description:"+20% Def, +8% thorns"},"Master"),
  // Ascension
  n("dwarf","ascension",1,"","Dwarven Grit","Blood and stone run in your veins.",{statPct:{Str:3,Def:3},description:"+3% Str/Def"}),
  n("dwarf","ascension",2,"a","Master Craftsman","The finest weapons come from dwarven hands.",{goldBonusPct:15,description:"+15% gold gain"}),
  n("dwarf","ascension",2,"b","Mineral Sense","You feel veins of ore from miles away.",{xpBonusPct:10,description:"+10% XP gain"}),
  n("dwarf","ascension",3,"","Ancient Forge","Your body is your greatest creation.",{statPct:{Str:8,Def:8},description:"+8% Str/Def"},"Adept"),
  n("dwarf","ascension",4,"","King Under the Mountain","The mountain bows to you.",{statPct:{Str:12,Def:12},description:"+12% Str/Def"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// ORC — Str/Def, berserker
// ─────────────────────────────────────────────────────────────────────────────
const ORC: SkillTreeNodeDef[] = [
  n("orc","combat",1,"","Bloodlust","The smell of battle awakens something primal.",{statPct:{Str:7},description:"+7% Strength"}),
  n("orc","combat",2,"a","Berserker Rage","Pain fuels your fury.",{statPct:{Str:10},description:"+10% Strength"}),
  n("orc","combat",2,"b","Killing Blow","You know exactly where to strike.",{critChancePct:5,damageBoostPct:4,description:"+5% crit, +4% damage"}),
  n("orc","combat",3,"","Warchief's Might","Orcs follow the strongest. Be that orc.",{statPct:{Str:12},damageBoostPct:8,description:"+12% Str, +8% damage"},"Adept"),
  n("orc","combat",4,"","Orcish Rampage","An unstoppable force of destruction.",{statPct:{Str:20},critChancePct:8,description:"+20% Str, +8% crit"},"Master"),
  // Mastery
  n("orc","mastery",1,"","Thick Hide","Years of battle have toughened your skin.",{statPct:{Def:6},description:"+6% Defense"}),
  n("orc","mastery",2,"a","War Scars","Each wound made you harder.",{statPct:{Def:8},description:"+8% Defense"}),
  n("orc","mastery",2,"b","Blood Feast","You steal life from every blow.",{lifestealPct:5,description:"+5% lifesteal"}),
  n("orc","mastery",3,"","Unbreakable","No enemy can bring you to your knees.",{statPct:{Def:12},lifestealPct:4,description:"+12% Def, +4% lifesteal"},"Adept"),
  n("orc","mastery",4,"","Deathless Warrior","The killing blow only makes you angrier.",{statPct:{Def:18},lifestealPct:7,description:"+18% Def, +7% lifesteal"},"Master"),
  // Ascension
  n("orc","ascension",1,"","Orcish Bloodline","Your blood sings with ancient combat magic.",{statPct:{Str:4,Def:3},description:"+4% Str, +3% Def"}),
  n("orc","ascension",2,"a","Warlord's Eye","You see weakness in every foe.",{critChancePct:6,description:"+6% crit chance"}),
  n("orc","ascension",2,"b","Battle Trophy","You loot the fallen with great efficiency.",{goldBonusPct:12,description:"+12% gold gain"}),
  n("orc","ascension",3,"","Conqueror","Whole armies have fallen before your banner.",{statPct:{Str:10,Def:6},description:"+10% Str, +6% Def"},"Adept"),
  n("orc","ascension",4,"","Overlord of War","You are born to conquer.",{statPct:{Str:15,Def:10},lifestealPct:5,description:"+15% Str, +10% Def, +5% lifesteal"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// BEASTFOLK — Spd/Luck, predator
// ─────────────────────────────────────────────────────────────────────────────
const BEASTFOLK: SkillTreeNodeDef[] = [
  n("beastfolk","combat",1,"","Feral Instinct","Your predator's eyes never miss a weak point.",{critChancePct:4,description:"+4% crit chance"}),
  n("beastfolk","combat",2,"a","Swift Pounce","Attack before the prey sees you move.",{statPct:{Spd:8},critChancePct:3,description:"+8% Spd, +3% crit"}),
  n("beastfolk","combat",2,"b","Claw Mastery","Natural weapons are the deadliest.",{damageBoostPct:6,description:"+6% damage"}),
  n("beastfolk","combat",3,"","Hunter's Frenzy","Strike fast, strike often, never stop.",{statPct:{Spd:10},damageBoostPct:8,description:"+10% Spd, +8% damage"},"Adept"),
  n("beastfolk","combat",4,"","Apex Predator","At the top of every food chain.",{statPct:{Spd:15},critChancePct:10,description:"+15% Spd, +10% crit"},"Master"),
  // Mastery
  n("beastfolk","mastery",1,"","Pack Survivor","You've learned every trick to stay alive.",{dodgePct:5,description:"+5% dodge"}),
  n("beastfolk","mastery",2,"a","Shadow Step","You ghost through the battlefield unseen.",{dodgePct:6,description:"+6% dodge"}),
  n("beastfolk","mastery",2,"b","Thick Fur","Battle-scarred hide absorbs blows.",{statPct:{Def:6},description:"+6% Defense"}),
  n("beastfolk","mastery",3,"","Primal Resilience","The wild makes you near-unkillable.",{dodgePct:6,statPct:{Def:8},description:"+6% dodge, +8% Def"},"Adept"),
  n("beastfolk","mastery",4,"","Ghost of the Wild","You're a shadow that bleeds.",{dodgePct:10,lifestealPct:5,description:"+10% dodge, +5% lifesteal"},"Master"),
  // Ascension
  n("beastfolk","ascension",1,"","Primal Heritage","Ancient beast magic pulses in your veins.",{statPct:{Spd:4,Luck:4},description:"+4% Spd/Luck"}),
  n("beastfolk","ascension",2,"a","Lucky Strikes","Fortune favors the bold predator.",{statPct:{Luck:8},critChancePct:4,description:"+8% Luck, +4% crit"}),
  n("beastfolk","ascension",2,"b","Bounty Hunter","You track gold as well as prey.",{goldBonusPct:14,description:"+14% gold gain"}),
  n("beastfolk","ascension",3,"","Wild Ascendance","Half beast, half legend.",{statPct:{Spd:8,Luck:8},description:"+8% Spd/Luck"},"Adept"),
  n("beastfolk","ascension",4,"","Legendary Beast","Songs will be sung of your hunts.",{statPct:{Spd:12,Luck:12},critChancePct:8,description:"+12% Spd/Luck, +8% crit"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// MYSTIC — Int/regen, nature magic
// ─────────────────────────────────────────────────────────────────────────────
const MYSTIC: SkillTreeNodeDef[] = [
  n("mystic","combat",1,"","Nature's Wrath","The forest strikes through you.",{statPct:{Int:6},description:"+6% Intelligence"}),
  n("mystic","combat",2,"a","Overgrowth","Vines and thorns lash at every foe.",{damageBoostPct:5,thornsPct:3,description:"+5% damage, +3% thorns"}),
  n("mystic","combat",2,"b","Spirit Surge","Channel pure nature energy.",{statPct:{Int:8},description:"+8% Intelligence"}),
  n("mystic","combat",3,"","Verdant Fury","The forest's rage becomes yours.",{statPct:{Int:10},damageBoostPct:8,description:"+10% Int, +8% damage"},"Adept"),
  n("mystic","combat",4,"","Nature's Chosen","You ARE the forest. Tremble.",{statPct:{Int:18},damageBoostPct:12,description:"+18% Int, +12% damage"},"Master"),
  // Mastery
  n("mystic","mastery",1,"","Mystic Attunement","Life energy flows through you constantly.",{lifestealPct:3,description:"+3% lifesteal"}),
  n("mystic","mastery",2,"a","Regenerative Sap","Wounds close before the enemy can land another.",{lifestealPct:5,description:"+5% lifesteal"}),
  n("mystic","mastery",2,"b","Bark Skin","Hardened by ancient nature magic.",{statPct:{Def:7},description:"+7% Defense"}),
  n("mystic","mastery",3,"","Deep Roots","Like an ancient tree, you cannot be toppled.",{statPct:{Def:10},lifestealPct:5,description:"+10% Def, +5% lifesteal"},"Adept"),
  n("mystic","mastery",4,"","Eternal Grove","You regenerate life itself.",{lifestealPct:10,statPct:{Def:12},description:"+10% lifesteal, +12% Def"},"Master"),
  // Ascension
  n("mystic","ascension",1,"","Mystic Bond","You and your companions move as one.",{statPct:{all:3},description:"+3% all stats"}),
  n("mystic","ascension",2,"a","Pet Harmony","Your pet grows stronger by your connection.",{statPct:{Int:8,Luck:4},description:"+8% Int, +4% Luck"}),
  n("mystic","ascension",2,"b","Forest Whisper","Ancient knowledge of the woods grants insight.",{xpBonusPct:12,goldBonusPct:8,description:"+12% XP, +8% gold"}),
  n("mystic","ascension",3,"","Harmonic Resonance","Body, spirit, and nature sing together.",{statPct:{all:6},description:"+6% all stats"},"Adept"),
  n("mystic","ascension",4,"","Mystic Transcendence","You become one with the living world.",{statPct:{Int:15,all:5},lifestealPct:6,description:"+15% Int, +5% all, +6% lifesteal"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// FAE — Luck/tricks, illusion
// ─────────────────────────────────────────────────────────────────────────────
const FAE: SkillTreeNodeDef[] = [
  n("fae","combat",1,"","Trickster's Edge","Your foe never knows where you'll strike next.",{critChancePct:5,description:"+5% crit chance"}),
  n("fae","combat",2,"a","Illusion Slash","Strike from where you aren't.",{critChancePct:6,damageBoostPct:4,description:"+6% crit, +4% damage"}),
  n("fae","combat",2,"b","Luck Spike","Fortune turns your glancing blow into a killing strike.",{statPct:{Luck:8},critChancePct:3,description:"+8% Luck, +3% crit"}),
  n("fae","combat",3,"","Chaos Strike","Chaos finds its way to every weak point.",{critChancePct:8,damageBoostPct:6,description:"+8% crit, +6% damage"},"Adept"),
  n("fae","combat",4,"","Fae Deathblow","A single touch ends it all.",{critChancePct:12,damageBoostPct:10,description:"+12% crit, +10% damage"},"Master"),
  // Mastery
  n("fae","mastery",1,"","Gossamer Veil","Reality bends around you.",{dodgePct:6,description:"+6% dodge"}),
  n("fae","mastery",2,"a","Pixie Dust","Confusion dulls their aim.",{dodgePct:7,description:"+7% dodge"}),
  n("fae","mastery",2,"b","Mirror Image","Which one is real?",{dodgePct:5,statPct:{Spd:5},description:"+5% dodge, +5% Spd"}),
  n("fae","mastery",3,"","Phantom Step","You occupy no space at all.",{dodgePct:10,description:"+10% dodge"},"Adept"),
  n("fae","mastery",4,"","Untouchable","Legend says no blade has ever found you.",{dodgePct:14,statPct:{Spd:8},description:"+14% dodge, +8% Spd"},"Master"),
  // Ascension
  n("fae","ascension",1,"","Fae Blessing","Fortune itself smiles upon you.",{statPct:{Luck:6},description:"+6% Luck"}),
  n("fae","ascension",2,"a","Midas Touch","Gold follows where luck leads.",{goldBonusPct:18,description:"+18% gold gain"}),
  n("fae","ascension",2,"b","Lucky Break","Experience flows faster through fae hands.",{xpBonusPct:15,description:"+15% XP gain"}),
  n("fae","ascension",3,"","Fortune's Favorite","Probability rewrites itself for you.",{statPct:{Luck:12},critChancePct:5,description:"+12% Luck, +5% crit"},"Adept"),
  n("fae","ascension",4,"","Fae Overlord","Luck itself bows before you.",{statPct:{Luck:20},critChancePct:8,goldBonusPct:10,description:"+20% Luck, +8% crit, +10% gold"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENTAL — Int/elemental power
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENTAL: SkillTreeNodeDef[] = [
  n("elemental","combat",1,"","Elemental Spark","Elemental energy crackles in every blow.",{statPct:{Int:6},damageBoostPct:3,description:"+6% Int, +3% damage"}),
  n("elemental","combat",2,"a","Elemental Burst","Raw elemental force erupts from you.",{damageBoostPct:8,description:"+8% damage"}),
  n("elemental","combat",2,"b","Conduit","You channel elemental energy with perfect efficiency.",{statPct:{Int:8},description:"+8% Intelligence"}),
  n("elemental","combat",3,"","Primal Force","The raw stuff of creation flows through you.",{statPct:{Int:10},damageBoostPct:10,description:"+10% Int, +10% damage"},"Adept"),
  n("elemental","combat",4,"","Elemental Fury","You ARE the storm, the flame, the tide.",{statPct:{Int:18},damageBoostPct:15,description:"+18% Int, +15% damage"},"Master"),
  // Mastery
  n("elemental","mastery",1,"","Elemental Skin","Your element protects you from harm.",{statPct:{Def:5},description:"+5% Defense"}),
  n("elemental","mastery",2,"a","Affinity Ward","Elements that match your nature cannot harm you.",{statPct:{Def:8},description:"+8% Defense"}),
  n("elemental","mastery",2,"b","Reactive Shell","When struck, your element strikes back.",{thornsPct:5,description:"+5% thorns"}),
  n("elemental","mastery",3,"","Elemental Fortress","A fortress of pure element surrounds you.",{statPct:{Def:12},thornsPct:5,description:"+12% Def, +5% thorns"},"Adept"),
  n("elemental","mastery",4,"","Living Element","You are invulnerable within your element.",{statPct:{Def:18},thornsPct:8,description:"+18% Def, +8% thorns"},"Master"),
  // Ascension
  n("elemental","ascension",1,"","Elemental Heritage","Born of pure elemental force.",{statPct:{all:3},description:"+3% all stats"}),
  n("elemental","ascension",2,"a","Prismatic Power","You channel multiple elements at once.",{statPct:{Int:8},damageBoostPct:5,description:"+8% Int, +5% damage"}),
  n("elemental","ascension",2,"b","Mana Well","Limitless elemental energy.",{cooldownReduction:1,description:"Cooldowns reduced by 1 turn"}),
  n("elemental","ascension",3,"","Elemental Embodiment","Element and flesh become one.",{statPct:{all:6},description:"+6% all stats"},"Adept"),
  n("elemental","ascension",4,"","Primordial Force","At the origin of all creation.",{statPct:{all:10,Int:8},description:"+10% all, +8% Int"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// UNDEAD — dark power, curses
// ─────────────────────────────────────────────────────────────────────────────
const UNDEAD: SkillTreeNodeDef[] = [
  n("undead","combat",1,"","Death Touch","Your strikes carry the chill of the grave.",{damageBoostPct:5,description:"+5% damage"}),
  n("undead","combat",2,"a","Soul Rend","Tear at the life force of your foe.",{damageBoostPct:7,lifestealPct:3,description:"+7% damage, +3% lifesteal"}),
  n("undead","combat",2,"b","Necrotic Blade","Your weapon corrodes flesh itself.",{statPct:{Int:7},damageBoostPct:5,description:"+7% Int, +5% damage"}),
  n("undead","combat",3,"","Deathbringer","You are death given form.",{damageBoostPct:10,lifestealPct:5,description:"+10% damage, +5% lifesteal"},"Adept"),
  n("undead","combat",4,"","Lich's Power","The power of death itself flows through you.",{statPct:{Int:15},damageBoostPct:15,description:"+15% Int, +15% damage"},"Master"),
  // Mastery
  n("undead","mastery",1,"","Deathly Resilience","What is already dead cannot be killed easily.",{statPct:{Def:6},description:"+6% Defense"}),
  n("undead","mastery",2,"a","Dark Armor","Cursed plate absorbs agony and fuel.",{statPct:{Def:9},description:"+9% Defense"}),
  n("undead","mastery",2,"b","Curse Ward","Dark magic deflects curses back at casters.",{thornsPct:5,description:"+5% thorns"}),
  n("undead","mastery",3,"","Undying Will","Fallen once, you refuse to fall again.",{statPct:{Def:12},lifestealPct:4,description:"+12% Def, +4% lifesteal"},"Adept"),
  n("undead","mastery",4,"","Immortal Husk","Death gave up trying.",{statPct:{Def:18},lifestealPct:8,description:"+18% Def, +8% lifesteal"},"Master"),
  // Ascension
  n("undead","ascension",1,"","Undead Bloodline","Death is your inheritance.",{statPct:{Str:3,Def:4},description:"+3% Str, +4% Def"}),
  n("undead","ascension",2,"a","Soul Harvest","You collect what the dead leave behind.",{goldBonusPct:14,description:"+14% gold gain"}),
  n("undead","ascension",2,"b","Dark Wisdom","Ancient knowledge gleaned from the dead.",{xpBonusPct:12,statPct:{Int:5},description:"+12% XP, +5% Int"}),
  n("undead","ascension",3,"","Grave Power","Your strength grows from those you've buried.",{statPct:{all:5},description:"+5% all stats"},"Adept"),
  n("undead","ascension",4,"","Death Incarnate","You are the end of all things.",{statPct:{all:8},damageBoostPct:10,description:"+8% all, +10% damage"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// DEMON — high risk/reward
// ─────────────────────────────────────────────────────────────────────────────
const DEMON: SkillTreeNodeDef[] = [
  n("demon","combat",1,"","Infernal Hunger","Hellfire burns hotter the more you fight.",{statPct:{Str:6},damageBoostPct:4,description:"+6% Str, +4% damage"}),
  n("demon","combat",2,"a","Hellfire Mastery","Your flames consume everything.",{damageBoostPct:10,description:"+10% damage"}),
  n("demon","combat",2,"b","Demonic Fury","Rage amplifies your every strike.",{statPct:{Str:10},critChancePct:4,description:"+10% Str, +4% crit"}),
  n("demon","combat",3,"","Bloodlust Unleashed","Feed on carnage and grow ever stronger.",{statPct:{Str:12},damageBoostPct:10,lifestealPct:4,description:"+12% Str, +10% damage, +4% lifesteal"},"Adept"),
  n("demon","combat",4,"","Demon Lord","All tremble before your infernal might.",{statPct:{Str:20},damageBoostPct:18,description:"+20% Str, +18% damage"},"Master"),
  // Mastery
  n("demon","mastery",1,"","Hellborn Skin","Fire forged you. Pain is your armor.",{statPct:{Def:5},lifestealPct:3,description:"+5% Def, +3% lifesteal"}),
  n("demon","mastery",2,"a","Dark Pact","Trade blood for power.",{lifestealPct:6,description:"+6% lifesteal"}),
  n("demon","mastery",2,"b","Infernal Ward","Dark magic deflects blows.",{statPct:{Def:8},thornsPct:4,description:"+8% Def, +4% thorns"}),
  n("demon","mastery",3,"","Demonic Resilience","Hell cannot kill what hell made.",{statPct:{Def:12},lifestealPct:5,description:"+12% Def, +5% lifesteal"},"Adept"),
  n("demon","mastery",4,"","Immortal Fiend","Kill it. It gets back up.",{statPct:{Def:16},lifestealPct:9,description:"+16% Def, +9% lifesteal"},"Master"),
  // Ascension
  n("demon","ascension",1,"","Demonic Bloodline","Ancient hellfire flows in your veins.",{statPct:{Str:4,Int:3},description:"+4% Str, +3% Int"}),
  n("demon","ascension",2,"a","Infernal Fortune","Demons are owed tribute.",{goldBonusPct:16,description:"+16% gold gain"}),
  n("demon","ascension",2,"b","Soul Collector","You take the knowledge of the fallen.",{xpBonusPct:14,description:"+14% XP gain"}),
  n("demon","ascension",3,"","Archfiend","Hell's greatest warrior walks among mortals.",{statPct:{Str:8,Int:6},damageBoostPct:8,description:"+8% Str, +6% Int, +8% damage"},"Adept"),
  n("demon","ascension",4,"","Prince of Darkness","All bow to the darkness you carry.",{statPct:{all:8,Str:10},description:"+8% all, +10% Str"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// DRACONIC — scaling with rank
// ─────────────────────────────────────────────────────────────────────────────
const DRACONIC: SkillTreeNodeDef[] = [
  n("draconic","combat",1,"","Dragon's Might","Ancient dragon power awakens within you.",{statPct:{Str:7},description:"+7% Strength"}),
  n("draconic","combat",2,"a","Fire Breath Mastery","Your breath weapon grows ever hotter.",{damageBoostPct:8,description:"+8% damage"}),
  n("draconic","combat",2,"b","Draconic Fury","Dragon instinct makes every blow lethal.",{statPct:{Str:8},critChancePct:4,description:"+8% Str, +4% crit"}),
  n("draconic","combat",3,"","Wyrm's Wrath","The wrath of ancient dragons.",{statPct:{Str:12},damageBoostPct:10,description:"+12% Str, +10% damage"},"Adept"),
  n("draconic","combat",4,"","Elder Dragon","The mightiest of bloodlines fully awakened.",{statPct:{Str:18},damageBoostPct:15,critChancePct:6,description:"+18% Str, +15% damage, +6% crit"},"Master"),
  // Mastery
  n("draconic","mastery",1,"","Dragon Scales","Your scales deflect all but the mightiest blows.",{statPct:{Def:7},description:"+7% Defense"}),
  n("draconic","mastery",2,"a","Scaled Fortress","Layered dragon-scale armor.",{statPct:{Def:10},description:"+10% Defense"}),
  n("draconic","mastery",2,"b","Elemental Heart","Your element protects and empowers you.",{statPct:{Def:7},thornsPct:4,description:"+7% Def, +4% thorns"}),
  n("draconic","mastery",3,"","Ancient Hide","Honed over centuries of battle.",{statPct:{Def:14},thornsPct:5,description:"+14% Def, +5% thorns"},"Adept"),
  n("draconic","mastery",4,"","Invincible Drake","Legend says no weapon has penetrated it.",{statPct:{Def:20},thornsPct:8,description:"+20% Def, +8% thorns"},"Master"),
  // Ascension
  n("draconic","ascension",1,"","Draconic Heritage","Dragon blood grants power over time.",{statPct:{all:3},description:"+3% all stats"}),
  n("draconic","ascension",2,"a","Hoard Instinct","Dragons amass wealth.",{goldBonusPct:14,description:"+14% gold gain"}),
  n("draconic","ascension",2,"b","Ancient Wisdom","Dragon knowledge spans millennia.",{xpBonusPct:12,statPct:{Int:5},description:"+12% XP, +5% Int"}),
  n("draconic","ascension",3,"","Dragon Ascendant","Your power grows with every rank.",{statPct:{all:6},description:"+6% all stats"},"Adept"),
  n("draconic","ascension",4,"","True Dragon","Mortal shell, immortal power.",{statPct:{all:12},damageBoostPct:10,description:"+12% all, +10% damage"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// CELESTIAL — support/light
// ─────────────────────────────────────────────────────────────────────────────
const CELESTIAL: SkillTreeNodeDef[] = [
  n("celestial","combat",1,"","Holy Smite","Divine light burns the wicked.",{statPct:{Int:6},damageBoostPct:4,description:"+6% Int, +4% damage"}),
  n("celestial","combat",2,"a","Radiant Strike","Your blows carry celestial radiance.",{damageBoostPct:7,description:"+7% damage"}),
  n("celestial","combat",2,"b","Star Fire","Summon light itself as your weapon.",{statPct:{Int:8},description:"+8% Intelligence"}),
  n("celestial","combat",3,"","Heaven's Wrath","The wrath of the divine.",{statPct:{Int:10},damageBoostPct:10,description:"+10% Int, +10% damage"},"Adept"),
  n("celestial","combat",4,"","Archangel's Fury","Light made violent.",{statPct:{Int:16},damageBoostPct:14,critChancePct:6,description:"+16% Int, +14% damage, +6% crit"},"Master"),
  // Mastery
  n("celestial","mastery",1,"","Divine Aegis","Celestial light shields you from harm.",{statPct:{Def:6},description:"+6% Defense"}),
  n("celestial","mastery",2,"a","Holy Barrier","Sacred geometry reflects evil.",{statPct:{Def:8},thornsPct:3,description:"+8% Def, +3% thorns"}),
  n("celestial","mastery",2,"b","Celestial Healing","Radiant energy restores you constantly.",{lifestealPct:5,description:"+5% lifesteal"}),
  n("celestial","mastery",3,"","Guardian Angel","You are protected by divine will.",{statPct:{Def:10},lifestealPct:5,description:"+10% Def, +5% lifesteal"},"Adept"),
  n("celestial","mastery",4,"","Divine Vessel","A god's power flows through your frame.",{statPct:{Def:16},lifestealPct:8,description:"+16% Def, +8% lifesteal"},"Master"),
  // Ascension
  n("celestial","ascension",1,"","Celestial Grace","Stars themselves guide your path.",{statPct:{all:3},description:"+3% all stats"}),
  n("celestial","ascension",2,"a","Sacred Wealth","Offerings flow to the divine.",{goldBonusPct:12,description:"+12% gold gain"}),
  n("celestial","ascension",2,"b","Enlightenment","Truth accelerates growth.",{xpBonusPct:14,description:"+14% XP gain"}),
  n("celestial","ascension",3,"","Celestial Harmony","Light, life, and power in perfect balance.",{statPct:{all:6},description:"+6% all stats"},"Adept"),
  n("celestial","ascension",4,"","Avatar of Light","The heavens themselves fight alongside you.",{statPct:{all:10,Int:8},description:"+10% all, +8% Int"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// AQUATIC — water/speed
// ─────────────────────────────────────────────────────────────────────────────
const AQUATIC: SkillTreeNodeDef[] = [
  n("aquatic","combat",1,"","Tidal Force","The ocean's power surges through you.",{statPct:{Spd:6},damageBoostPct:3,description:"+6% Spd, +3% damage"}),
  n("aquatic","combat",2,"a","Riptide Strike","A blow that carries the force of the deep.",{damageBoostPct:7,description:"+7% damage"}),
  n("aquatic","combat",2,"b","Current Rider","Flow like water — attack from all angles.",{statPct:{Spd:8},critChancePct:3,description:"+8% Spd, +3% crit"}),
  n("aquatic","combat",3,"","Ocean's Wrath","The sea shows no mercy.",{statPct:{Spd:10},damageBoostPct:10,description:"+10% Spd, +10% damage"},"Adept"),
  n("aquatic","combat",4,"","Tsunami Force","Unstoppable as a crashing wave.",{statPct:{Spd:15},damageBoostPct:15,description:"+15% Spd, +15% damage"},"Master"),
  // Mastery
  n("aquatic","mastery",1,"","Water Flow","Flow around every attack.",{dodgePct:5,description:"+5% dodge"}),
  n("aquatic","mastery",2,"a","Tide Step","You ripple like water around every blow.",{dodgePct:6,statPct:{Spd:4},description:"+6% dodge, +4% Spd"}),
  n("aquatic","mastery",2,"b","Deep Current","Your toughness is as deep as the ocean.",{statPct:{Def:7},description:"+7% Defense"}),
  n("aquatic","mastery",3,"","Hydro Shield","Water forms a living barrier around you.",{dodgePct:6,statPct:{Def:8},description:"+6% dodge, +8% Def"},"Adept"),
  n("aquatic","mastery",4,"","Leviathan's Shell","Even sea monsters cannot pierce this.",{dodgePct:8,statPct:{Def:14},description:"+8% dodge, +14% Def"},"Master"),
  // Ascension
  n("aquatic","ascension",1,"","Aquatic Heritage","The ocean's ancient power flows within.",{statPct:{Spd:4,Luck:3},description:"+4% Spd, +3% Luck"}),
  n("aquatic","ascension",2,"a","Sea Treasure","The ocean yields its wealth to you.",{goldBonusPct:14,description:"+14% gold gain"}),
  n("aquatic","ascension",2,"b","Deep Knowledge","The depths hold ancient secrets.",{xpBonusPct:12,description:"+12% XP gain"}),
  n("aquatic","ascension",3,"","Ocean Sovereign","The sea obeys you.",{statPct:{all:5},description:"+5% all stats"},"Adept"),
  n("aquatic","ascension",4,"","Abyssal Lord","From the deepest trench, unstoppable.",{statPct:{all:9,Spd:8},description:"+9% all, +8% Spd"},"Master"),
];

// ─────────────────────────────────────────────────────────────────────────────
// TITAN — raw strength/defense
// ─────────────────────────────────────────────────────────────────────────────
const TITAN: SkillTreeNodeDef[] = [
  n("titan","combat",1,"","Titan's Grip","Your hands alone are weapons.",{statPct:{Str:8},description:"+8% Strength"},"Journeyman"),
  n("titan","combat",2,"a","Earthquake Slam","The ground breaks where you walk.",{statPct:{Str:12},description:"+12% Strength"},"Journeyman"),
  n("titan","combat",2,"b","Primal Fury","Titan rage unlocks inhuman power.",{damageBoostPct:10,critChancePct:5,description:"+10% damage, +5% crit"},"Journeyman"),
  n("titan","combat",3,"","World-Breaker","You were made to shatter mountains.",{statPct:{Str:16},damageBoostPct:12,description:"+16% Str, +12% damage"},"Expert"),
  n("titan","combat",4,"","Primordial Titan","At the dawn of time, titans ruled.",{statPct:{Str:25},damageBoostPct:20,description:"+25% Str, +20% damage"},"Champion"),
  // Mastery
  n("titan","mastery",1,"","Immovable","Nothing alive can push you aside.",{statPct:{Def:8},description:"+8% Defense"},"Journeyman"),
  n("titan","mastery",2,"a","Monolith","You are a living fortress.",{statPct:{Def:12},thornsPct:5,description:"+12% Def, +5% thorns"},"Journeyman"),
  n("titan","mastery",2,"b","Stone Blood","Your blood runs thick as stone.",{statPct:{Def:10},lifestealPct:4,description:"+10% Def, +4% lifesteal"},"Journeyman"),
  n("titan","mastery",3,"","Colossus","Titans do not fall.",{statPct:{Def:18},thornsPct:6,description:"+18% Def, +6% thorns"},"Expert"),
  n("titan","mastery",4,"","Unassailable Fortress","Legends speak of the titan that no army could stop.",{statPct:{Def:25},thornsPct:10,description:"+25% Def, +10% thorns"},"Champion"),
  // Ascension
  n("titan","ascension",1,"","Titan Bloodline","Ancient blood grants power beyond measure.",{statPct:{Str:5,Def:5},description:"+5% Str/Def"},"Journeyman"),
  n("titan","ascension",2,"a","Ancient Inheritance","Titans have treasured the earth for eons.",{goldBonusPct:16,description:"+16% gold gain"},"Journeyman"),
  n("titan","ascension",2,"b","Titan's Legacy","Growth comes faster to one of titan lineage.",{xpBonusPct:14,description:"+14% XP gain"},"Journeyman"),
  n("titan","ascension",3,"","Primordial Legacy","You carry the weight of primordial time.",{statPct:{Str:10,Def:10},description:"+10% Str/Def"},"Expert"),
  n("titan","ascension",4,"","God-Titan","Before the gods, there were titans.",{statPct:{all:10,Str:12,Def:12},description:"+10% all, +12% Str/Def"},"Champion"),
];

// ─────────────────────────────────────────────────────────────────────────────
// Master registry
// ─────────────────────────────────────────────────────────────────────────────
const ALL_TREES: Record<string, SkillTreeNodeDef[]> = {
  human: HUMAN, elf: ELF, dwarf: DWARF, orc: ORC, beastfolk: BEASTFOLK,
  mystic: MYSTIC, fae: FAE, elemental: ELEMENTAL, undead: UNDEAD, demon: DEMON,
  draconic: DRACONIC, celestial: CELESTIAL, aquatic: AQUATIC, titan: TITAN,
};

export function getSkillTree(race: string): SkillTreeNodeDef[] {
  return ALL_TREES[race] ?? ALL_TREES["human"];
}

export function getSkillTreeNode(race: string, nodeId: string): SkillTreeNodeDef | undefined {
  return getSkillTree(race).find(n => n.id === nodeId);
}

export function getSkillTreeBranch(race: string, branch: SkillTreeBranch): SkillTreeNodeDef[] {
  return getSkillTree(race).filter(n => n.branch === branch);
}

// Apply all unlocked passive effects to a stat object
export function applySkillTreePassives(
  nodes: SkillTreeNodeDef[],
  stats: { Str: number; Def: number; Spd: number; Int: number; Luck: number },
): { Str: number; Def: number; Spd: number; Int: number; Luck: number } {
  const out = { ...stats };
  for (const node of nodes) {
    const e = node.effect;
    if (e.statPct?.all) {
      const m = e.statPct.all / 100;
      out.Str  = Math.floor(out.Str  * (1 + m));
      out.Def  = Math.floor(out.Def  * (1 + m));
      out.Spd  = Math.floor(out.Spd  * (1 + m));
      out.Int  = Math.floor(out.Int  * (1 + m));
      out.Luck = Math.floor(out.Luck * (1 + m));
    }
    if (e.statPct?.Str)  out.Str  = Math.floor(out.Str  * (1 + e.statPct.Str  / 100));
    if (e.statPct?.Def)  out.Def  = Math.floor(out.Def  * (1 + e.statPct.Def  / 100));
    if (e.statPct?.Spd)  out.Spd  = Math.floor(out.Spd  * (1 + e.statPct.Spd  / 100));
    if (e.statPct?.Int)  out.Int  = Math.floor(out.Int  * (1 + e.statPct.Int  / 100));
    if (e.statPct?.Luck) out.Luck = Math.floor(out.Luck * (1 + e.statPct.Luck / 100));
  }
  return out;
}

// Aggregate all non-stat bonuses for display / combat use
export type AggregatedBonuses = {
  critChancePct: number; lifestealPct: number; dodgePct: number;
  damageBoostPct: number; cooldownReduction: number; thornsPct: number;
  goldBonusPct: number; xpBonusPct: number;
};
export function aggregateBonuses(nodes: SkillTreeNodeDef[]): AggregatedBonuses {
  const b: AggregatedBonuses = {
    critChancePct:0, lifestealPct:0, dodgePct:0, damageBoostPct:0,
    cooldownReduction:0, thornsPct:0, goldBonusPct:0, xpBonusPct:0,
  };
  for (const node of nodes) {
    const e = node.effect;
    if (e.critChancePct)   b.critChancePct   += e.critChancePct;
    if (e.lifestealPct)    b.lifestealPct    += e.lifestealPct;
    if (e.dodgePct)        b.dodgePct        += e.dodgePct;
    if (e.damageBoostPct)  b.damageBoostPct  += e.damageBoostPct;
    if (e.cooldownReduction) b.cooldownReduction += e.cooldownReduction;
    if (e.thornsPct)       b.thornsPct       += e.thornsPct;
    if (e.goldBonusPct)    b.goldBonusPct    += e.goldBonusPct;
    if (e.xpBonusPct)      b.xpBonusPct      += e.xpBonusPct;
  }
  return b;
}
