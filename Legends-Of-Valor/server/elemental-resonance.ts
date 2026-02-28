export const ELEMENTS = [
  "Fire", "Water", "Air", "Earth", "Nature", "Light", "Dark", "Plasma",
  "Space", "Time", "Aether", "Soul", "Void", "Storm", "Metal", "Blood",
  "Crystal", "Arcane"
] as const;

export type Element = typeof ELEMENTS[number];

export const ELEMENT_COUNTER_MATRIX: Record<string, { strongAgainst: string[]; weakAgainst: string[] }> = {
  Fire:    { strongAgainst: ["Nature", "Metal"],   weakAgainst: ["Water", "Earth"] },
  Water:   { strongAgainst: ["Fire", "Plasma"],    weakAgainst: ["Nature", "Storm"] },
  Air:     { strongAgainst: ["Earth", "Crystal"],  weakAgainst: ["Metal", "Plasma"] },
  Earth:   { strongAgainst: ["Fire", "Storm"],     weakAgainst: ["Air", "Nature"] },
  Nature:  { strongAgainst: ["Water", "Earth"],    weakAgainst: ["Fire", "Blood"] },
  Light:   { strongAgainst: ["Dark", "Void"],      weakAgainst: ["Aether", "Soul"] },
  Dark:    { strongAgainst: ["Light", "Soul"],      weakAgainst: ["Aether", "Plasma"] },
  Plasma:  { strongAgainst: ["Air", "Dark"],       weakAgainst: ["Water", "Earth"] },
  Space:   { strongAgainst: ["Time", "Aether"],    weakAgainst: ["Void", "Soul"] },
  Time:    { strongAgainst: ["Plasma", "Storm"],   weakAgainst: ["Space", "Arcane"] },
  Aether:  { strongAgainst: ["Light", "Dark"],     weakAgainst: ["Void", "Blood"] },
  Soul:    { strongAgainst: ["Aether", "Blood"],   weakAgainst: ["Dark", "Light"] },
  Void:    { strongAgainst: ["Aether", "Space"],   weakAgainst: ["Light", "Nature"] },
  Storm:   { strongAgainst: ["Water", "Air"],      weakAgainst: ["Earth", "Time"] },
  Metal:   { strongAgainst: ["Crystal", "Air"],    weakAgainst: ["Fire", "Nature"] },
  Blood:   { strongAgainst: ["Nature", "Soul"],    weakAgainst: ["Light", "Aether"] },
  Crystal: { strongAgainst: ["Plasma", "Void"],    weakAgainst: ["Metal", "Earth"] },
  Arcane:  { strongAgainst: ["Time", "Aether"],    weakAgainst: ["Void", "Soul"] },
};

export const ELEMENT_MODIFIERS = {
  STRONG: 1.5,
  WEAK: 0.5,
  NEUTRAL: 1.0,
} as const;

export function getElementalModifier(attackerElement: string, defenderElement: string): number {
  const entry = ELEMENT_COUNTER_MATRIX[attackerElement];
  if (!entry) return ELEMENT_MODIFIERS.NEUTRAL;

  if (entry.strongAgainst.includes(defenderElement)) return ELEMENT_MODIFIERS.STRONG;
  if (entry.weakAgainst.includes(defenderElement)) return ELEMENT_MODIFIERS.WEAK;
  return ELEMENT_MODIFIERS.NEUTRAL;
}

export function calculateElementModifier(attackerElements: string[], defenderElements: string[]): number {
  if (attackerElements.length === 0 || defenderElements.length === 0) return ELEMENT_MODIFIERS.NEUTRAL;

  let bestMultiplier: number = ELEMENT_MODIFIERS.NEUTRAL;
  let worstMultiplier: number = ELEMENT_MODIFIERS.NEUTRAL;

  for (const atkEl of attackerElements) {
    for (const defEl of defenderElements) {
      const mod = getElementalModifier(atkEl, defEl);
      if (mod > bestMultiplier) bestMultiplier = mod;
      if (mod < worstMultiplier) worstMultiplier = mod;
    }
  }

  if (bestMultiplier > ELEMENT_MODIFIERS.NEUTRAL) return bestMultiplier;
  if (worstMultiplier < ELEMENT_MODIFIERS.NEUTRAL) return worstMultiplier;
  return ELEMENT_MODIFIERS.NEUTRAL;
}

export interface ResonanceEffect {
  name: string;
  description: string;
  elements: [string, string];
  damageBonus: number;
  statusEffect?: string;
  statusDuration?: number;
  statusChance?: number;
}

export const RESONANCE_COMBOS: ResonanceEffect[] = [
  {
    name: "Steam Burn",
    description: "Fire and Water combine to create scalding steam",
    elements: ["Fire", "Water"],
    damageBonus: 0.2,
    statusEffect: "burn",
    statusDuration: 2,
    statusChance: 0.4,
  },
  {
    name: "Eclipse Stun",
    description: "Dark and Light collide to create a blinding eclipse",
    elements: ["Dark", "Light"],
    damageBonus: 0.15,
    statusEffect: "stun",
    statusDuration: 1,
    statusChance: 0.35,
  },
  {
    name: "Magma Surge",
    description: "Fire and Earth merge into molten fury",
    elements: ["Fire", "Earth"],
    damageBonus: 0.25,
    statusEffect: "burn",
    statusDuration: 3,
    statusChance: 0.3,
  },
  {
    name: "Frozen Gale",
    description: "Water and Air create a freezing tempest",
    elements: ["Water", "Air"],
    damageBonus: 0.2,
    statusEffect: "freeze",
    statusDuration: 1,
    statusChance: 0.3,
  },
  {
    name: "Life Drain",
    description: "Nature and Soul intertwine to siphon vitality",
    elements: ["Nature", "Soul"],
    damageBonus: 0.15,
    statusEffect: "drain",
    statusDuration: 2,
    statusChance: 0.35,
  },
  {
    name: "Void Rift",
    description: "Void and Space tear reality itself",
    elements: ["Void", "Space"],
    damageBonus: 0.3,
    statusEffect: "silence",
    statusDuration: 1,
    statusChance: 0.25,
  },
  {
    name: "Temporal Shock",
    description: "Time and Plasma create a chrono-electric burst",
    elements: ["Time", "Plasma"],
    damageBonus: 0.2,
    statusEffect: "stun",
    statusDuration: 1,
    statusChance: 0.3,
  },
  {
    name: "Thunderstrike",
    description: "Storm and Metal channel devastating lightning",
    elements: ["Storm", "Metal"],
    damageBonus: 0.25,
    statusEffect: "stun",
    statusDuration: 1,
    statusChance: 0.35,
  },
  {
    name: "Blood Moon",
    description: "Blood and Dark create a sinister crimson aura",
    elements: ["Blood", "Dark"],
    damageBonus: 0.2,
    statusEffect: "drain",
    statusDuration: 2,
    statusChance: 0.3,
  },
  {
    name: "Crystal Resonance",
    description: "Crystal and Aether vibrate with amplifying energy",
    elements: ["Crystal", "Aether"],
    damageBonus: 0.15,
    statusEffect: "amplify",
    statusDuration: 2,
    statusChance: 0.4,
  },
  {
    name: "Arcane Storm",
    description: "Arcane and Storm unleash chaotic magical energy",
    elements: ["Arcane", "Storm"],
    damageBonus: 0.25,
    statusEffect: "silence",
    statusDuration: 1,
    statusChance: 0.3,
  },
  {
    name: "Nature's Wrath",
    description: "Nature and Earth form an overwhelming natural force",
    elements: ["Nature", "Earth"],
    damageBonus: 0.2,
    statusEffect: "root",
    statusDuration: 1,
    statusChance: 0.35,
  },
  {
    name: "Soul Fire",
    description: "Soul and Fire ignite spiritual flames",
    elements: ["Soul", "Fire"],
    damageBonus: 0.2,
    statusEffect: "burn",
    statusDuration: 2,
    statusChance: 0.35,
  },
  {
    name: "Light Prism",
    description: "Light and Crystal refract into devastating beams",
    elements: ["Light", "Crystal"],
    damageBonus: 0.2,
    statusEffect: "blind",
    statusDuration: 1,
    statusChance: 0.3,
  },
  {
    name: "Chronolock",
    description: "Time and Arcane freeze the target in temporal stasis",
    elements: ["Time", "Arcane"],
    damageBonus: 0.1,
    statusEffect: "freeze",
    statusDuration: 2,
    statusChance: 0.25,
  },
  {
    name: "Plasma Blade",
    description: "Plasma and Metal forge a superheated cutting edge",
    elements: ["Plasma", "Metal"],
    damageBonus: 0.25,
    statusEffect: "bleed",
    statusDuration: 3,
    statusChance: 0.3,
  },
  {
    name: "Aether Void",
    description: "Aether and Void create a pocket of absolute nullification",
    elements: ["Aether", "Void"],
    damageBonus: 0.3,
    statusEffect: "silence",
    statusDuration: 2,
    statusChance: 0.2,
  },
  {
    name: "Blood Storm",
    description: "Blood and Storm create a crimson hurricane",
    elements: ["Blood", "Storm"],
    damageBonus: 0.25,
    statusEffect: "bleed",
    statusDuration: 2,
    statusChance: 0.35,
  },
];

export interface ResonanceResult {
  triggered: boolean;
  effect?: ResonanceEffect;
  statusApplied: boolean;
}

export function checkResonance(attackerElements: string[]): ResonanceResult {
  if (attackerElements.length < 2) {
    return { triggered: false, statusApplied: false };
  }

  for (const combo of RESONANCE_COMBOS) {
    const [el1, el2] = combo.elements;
    if (attackerElements.includes(el1) && attackerElements.includes(el2)) {
      const statusApplied = Math.random() < (combo.statusChance || 0);
      return {
        triggered: true,
        effect: combo,
        statusApplied,
      };
    }
  }

  return { triggered: false, statusApplied: false };
}
