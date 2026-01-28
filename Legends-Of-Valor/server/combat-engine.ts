import { raceModifiers } from "../shared/schema";

export interface CombatStats {
  Str: number;
  Def: number;
  Spd: number;
  Int: number;
  Luck: number;
  Pot: number;
  HP?: number;
  maxHP?: number;
}

export interface ElementalAffinity {
  elements: string[];
  elementalPower: number;
}

export interface Combatant {
  id: string;
  name: string;
  stats: CombatStats;
  race?: string | null;
  elements?: ElementalAffinity;
  immunities?: string[];
  level: number;
  isPlayer: boolean;
}

export interface CombatAction {
  type: "attack" | "defend" | "trick" | "dodge";
  targetId?: string;
}

export interface CombatRound {
  turn: number;
  attacker: string;
  defender: string;
  action: CombatAction;
  damage: number;
  blocked: number;
  isCritical: boolean;
  isEvaded: boolean;
  isBlocked: boolean;
  elementalMultiplier: number;
  effects: string[];
}

export interface CombatResult {
  winner: string;
  loser: string;
  rounds: CombatRound[];
  totalDamageDealt: Record<string, number>;
  finalHP: Record<string, number>;
  rewards?: Record<string, number>;
}

const ELEMENT_WEAKNESSES: Record<string, string> = {
  Fire: "Water",
  Water: "Earth",
  Earth: "Wind",
  Wind: "Fire",
  Light: "Dark",
  Dark: "Light",
  Nature: "Fire",
};

const ELEMENT_STRENGTHS: Record<string, string> = {
  Fire: "Nature",
  Water: "Fire",
  Earth: "Water",
  Wind: "Earth",
  Light: "Dark",
  Dark: "Light",
};

export function calculateMaxHP(stats: CombatStats, level: number): number {
  const baseHP = 100;
  const strBonus = stats.Str * 5;
  const defBonus = stats.Def * 3;
  const levelBonus = level * 10;
  return Math.floor(baseHP + strBonus + defBonus + levelBonus);
}

export function calculateInitiative(stats: CombatStats, luck: number): number {
  const speedBase = stats.Spd * 2;
  const luckBonus = Math.random() * (luck / 10);
  return speedBase + luckBonus;
}

export function calculateBaseDamage(stats: CombatStats): number {
  return stats.Str * 2 + stats.Int * 1.5 + (stats.Pot || 0) * 3;
}

export function calculateDefenseReduction(damage: number, defenderDef: number): number {
  const defenseMultiplier = 1 - Math.min(defenderDef / (defenderDef + 100), 0.75);
  return Math.floor(damage * defenseMultiplier);
}

export function calculateCritical(attackerLuck: number): { isCritical: boolean; multiplier: number } {
  const critChance = Math.min(attackerLuck / 200, 0.25);
  const isCritical = Math.random() < critChance;
  const multiplier = isCritical ? 1.5 + (attackerLuck / 500) : 1;
  return { isCritical, multiplier };
}

export function calculateElementalMultiplier(
  attackerElements: string[],
  defenderImmunities: string[],
  defenderWeakness?: string
): number {
  const validElements = attackerElements.filter(e => !defenderImmunities.includes(e));
  
  if (validElements.length === 0) return 0.5;
  
  let multiplier = 1;
  
  const hasStrength = validElements.some(e => defenderWeakness && ELEMENT_STRENGTHS[e] === defenderWeakness);
  if (hasStrength) multiplier *= 1.25;
  
  if (validElements.length === 2) {
    multiplier *= 2;
  } else if (validElements.length >= 3) {
    multiplier *= 5;
  }
  
  return multiplier;
}

export function calculateDodgeChance(defenderSpd: number, attackerSpd: number): number {
  const spdDiff = defenderSpd - attackerSpd;
  const baseChance = 0.05;
  const spdBonus = Math.max(0, spdDiff / 200);
  return Math.min(baseChance + spdBonus, 0.3);
}

export function processAction(
  attacker: Combatant,
  defender: Combatant,
  action: CombatAction,
  defenderAction?: CombatAction
): CombatRound {
  const effects: string[] = [];
  let damage = 0;
  let blocked = 0;
  let isCritical = false;
  let isEvaded = false;
  let isBlocked = false;
  let elementalMultiplier = 1;
  
  switch (action.type) {
    case "attack": {
      const baseDamage = calculateBaseDamage(attacker.stats);
      
      const critResult = calculateCritical(attacker.stats.Luck);
      isCritical = critResult.isCritical;
      if (isCritical) effects.push("Critical hit!");
      
      if (attacker.elements && attacker.elements.elements.length > 0) {
        elementalMultiplier = calculateElementalMultiplier(
          attacker.elements.elements,
          defender.immunities || [],
          defender.elements?.elements[0]
        );
        if (elementalMultiplier > 1) effects.push(`Elemental bonus x${elementalMultiplier.toFixed(1)}`);
        if (elementalMultiplier < 1) effects.push("Element resisted!");
      }
      
      const rawDamage = baseDamage * critResult.multiplier * elementalMultiplier + (attacker.elements?.elementalPower || 0);
      
      if (defenderAction?.type === "dodge") {
        const dodgeChance = calculateDodgeChance(defender.stats.Spd, attacker.stats.Spd) * 2;
        isEvaded = Math.random() < dodgeChance;
        if (isEvaded) {
          effects.push(`${defender.name} dodged the attack!`);
          damage = 0;
        } else {
          damage = calculateDefenseReduction(rawDamage, defender.stats.Def * 0.5);
        }
      } else if (defenderAction?.type === "defend") {
        isBlocked = true;
        const blockRate = 0.5 + (defender.stats.Def / 500);
        blocked = Math.floor(rawDamage * blockRate);
        damage = Math.floor(rawDamage - blocked);
        effects.push(`${defender.name} blocked ${blocked} damage!`);
      } else {
        damage = calculateDefenseReduction(rawDamage, defender.stats.Def);
      }
      break;
    }
    
    case "trick": {
      const trickDamage = calculateBaseDamage(attacker.stats) * 0.6;
      const trickLuckBonus = attacker.stats.Luck / 100;
      
      const successChance = 0.5 + trickLuckBonus;
      if (Math.random() < successChance) {
        damage = Math.floor(trickDamage * 1.5);
        effects.push("Trick succeeded! Extra damage dealt!");
        
        if (Math.random() < 0.3) {
          effects.push(`${defender.name} is stunned!`);
        }
      } else {
        damage = Math.floor(trickDamage * 0.3);
        effects.push("Trick failed! Minimal damage dealt.");
      }
      break;
    }
    
    case "defend": {
      effects.push(`${attacker.name} takes a defensive stance.`);
      break;
    }
    
    case "dodge": {
      effects.push(`${attacker.name} prepares to evade.`);
      break;
    }
  }
  
  return {
    turn: 0,
    attacker: attacker.id,
    defender: defender.id,
    action,
    damage: Math.max(0, Math.floor(damage)),
    blocked,
    isCritical,
    isEvaded,
    isBlocked,
    elementalMultiplier,
    effects,
  };
}

export function runAutoCombat(
  player: Combatant,
  npc: Combatant,
  maxRounds: number = 20
): CombatResult {
  const playerHP = calculateMaxHP(player.stats, player.level);
  const npcHP = calculateMaxHP(npc.stats, npc.level);
  
  const combatState = {
    [player.id]: playerHP,
    [npc.id]: npcHP,
  };
  
  const totalDamage: Record<string, number> = {
    [player.id]: 0,
    [npc.id]: 0,
  };
  
  const rounds: CombatRound[] = [];
  let turn = 1;
  
  while (combatState[player.id] > 0 && combatState[npc.id] > 0 && turn <= maxRounds) {
    const playerInit = calculateInitiative(player.stats, player.stats.Luck);
    const npcInit = calculateInitiative(npc.stats, npc.stats.Luck);
    
    const first = playerInit >= npcInit ? player : npc;
    const second = playerInit >= npcInit ? npc : player;
    
    const firstAction: CombatAction = selectAIAction(first, combatState[first.id], first.isPlayer);
    const secondAction: CombatAction = selectAIAction(second, combatState[second.id], second.isPlayer);
    
    const round1 = processAction(first, second, firstAction, secondAction);
    round1.turn = turn;
    rounds.push(round1);
    
    combatState[second.id] -= round1.damage;
    totalDamage[first.id] += round1.damage;
    
    if (combatState[second.id] <= 0) break;
    
    const round2 = processAction(second, first, secondAction, firstAction);
    round2.turn = turn;
    rounds.push(round2);
    
    combatState[first.id] -= round2.damage;
    totalDamage[second.id] += round2.damage;
    
    turn++;
  }
  
  const winner = combatState[player.id] > combatState[npc.id] ? player.id : npc.id;
  const loser = winner === player.id ? npc.id : player.id;
  
  return {
    winner,
    loser,
    rounds,
    totalDamageDealt: totalDamage,
    finalHP: combatState,
  };
}

function selectAIAction(combatant: Combatant, currentHP: number, isPlayer: boolean): CombatAction {
  const hpPercent = currentHP / calculateMaxHP(combatant.stats, combatant.level);
  const roll = Math.random();
  
  if (hpPercent < 0.3 && roll < 0.4) {
    return { type: "defend" };
  }
  
  if (combatant.stats.Spd > 30 && roll < 0.2) {
    return { type: "dodge" };
  }
  
  if (combatant.stats.Luck > 25 && roll < 0.25) {
    return { type: "trick" };
  }
  
  return { type: "attack" };
}

export function calculateCombatRewards(
  npcLevel: number,
  isBoss: boolean,
  playerWon: boolean
): Record<string, number> {
  if (!playerWon) {
    return { gold: 0, trainingPoints: 0, soulShards: 0, petExp: 0, runes: 0 };
  }
  
  const baseMultiplier = isBoss ? 3 : 1;
  
  return {
    gold: Math.floor(npcLevel * 50 * baseMultiplier),
    trainingPoints: Math.floor(npcLevel * 10 * baseMultiplier),
    soulShards: Math.floor(npcLevel * 2 * baseMultiplier),
    petExp: Math.floor(npcLevel * 100 * baseMultiplier),
    runes: isBoss ? Math.floor(npcLevel / 100) * 10 : 0,
  };
}

export function getRaceStatModifiers(race: string | null): Partial<CombatStats> {
  if (!race || !raceModifiers[race as keyof typeof raceModifiers]) {
    return {};
  }
  
  const modifier = raceModifiers[race as keyof typeof raceModifiers];
  return {
    Str: modifier.Str,
    Def: modifier.Def,
    Spd: modifier.Spd,
    Int: modifier.Int,
    Luck: modifier.Luck,
  };
}

export function applyRaceModifiers(baseStats: CombatStats, race: string | null): CombatStats {
  const modifiers = getRaceStatModifiers(race);
  
  return {
    Str: Math.floor(baseStats.Str * (modifiers.Str || 1)),
    Def: Math.floor(baseStats.Def * (modifiers.Def || 1)),
    Spd: Math.floor(baseStats.Spd * (modifiers.Spd || 1)),
    Int: Math.floor(baseStats.Int * (modifiers.Int || 1)),
    Luck: Math.floor(baseStats.Luck * (modifiers.Luck || 1)),
    Pot: baseStats.Pot || 0,
  };
}
