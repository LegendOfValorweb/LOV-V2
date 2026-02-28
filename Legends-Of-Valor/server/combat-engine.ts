import { raceModifiers, playerRanks, type PlayerRank, type PlayerRace } from "../shared/schema";
import { calculateElementModifier, checkResonance, ELEMENT_MODIFIERS, type ResonanceResult } from "./elemental-resonance";

export type CCType = "stun" | "freeze" | "silence";

export type BuffStatType = "Str" | "Def" | "Spd" | "Int" | "Luck" | "Pot";

export interface BuffEffect {
  statType: BuffStatType;
  flatBonus: number;
  remainingTurns: number;
  appliedBy: string;
  buffName: string;
}

export interface BuffTracker {
  activeBuffs: Map<string, BuffEffect[]>;
}

export interface StatusEffect {
  type: CCType;
  remainingTurns: number;
  appliedBy: string;
}

export interface CCTracker {
  activeEffects: Map<string, StatusEffect[]>;
  ccHistory: Map<string, number>;
}

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

export type SpellCategoryType = "damage" | "aoe" | "cc" | "buff" | "heal";

export interface SpellInfo {
  name: string;
  multiplier: number;
  element?: string;
  isAoE?: boolean;
  targetCount?: number;
  spellCategory?: SpellCategoryType;
  spellPower?: number;
  ccType?: CCType;
  ccDuration?: number;
  buffStat?: string;
  buffAmount?: number;
  rankMultiplier?: number;
}

export interface Combatant {
  id: string;
  name: string;
  stats: CombatStats;
  race?: string | null;
  rank?: string | null;
  elements?: ElementalAffinity;
  immunities?: string[];
  level: number;
  isPlayer: boolean;
  spell?: SpellInfo | null;
}

export interface CombatAction {
  type: "attack" | "defend" | "dodge" | "spell" | "trick";
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
  resonance?: ResonanceResult;
  statusEffectsApplied?: { type: CCType; duration: number; target: string }[];
  buffsApplied?: { statType: BuffStatType; bonus: number; target: string; buffName: string }[];
  skippedDueToCC?: CCType;
}

export interface CombatResult {
  winner: string;
  loser: string;
  rounds: CombatRound[];
  totalDamageDealt: Record<string, number>;
  finalHP: Record<string, number>;
  rewards?: Record<string, number>;
}

function safeNumber(val: any, defaultVal: number = 0): number {
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

function safeStats(stats: CombatStats | null | undefined): CombatStats {
  const defaultStats: CombatStats = { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
  if (!stats) return defaultStats;
  return {
    Str: safeNumber(stats.Str, defaultStats.Str),
    Def: safeNumber(stats.Def, defaultStats.Def),
    Spd: safeNumber(stats.Spd, defaultStats.Spd),
    Int: safeNumber(stats.Int, defaultStats.Int),
    Luck: safeNumber(stats.Luck, defaultStats.Luck),
    Pot: safeNumber(stats.Pot, 0),
    HP: stats.HP !== undefined ? safeNumber(stats.HP) : undefined,
    maxHP: stats.maxHP !== undefined ? safeNumber(stats.maxHP) : undefined,
  };
}

const RACE_BASE_HP: Record<string, number> = {
  human: 100,
  elf: 85,
  dwarf: 120,
  orc: 130,
  beastfolk: 90,
  mystic: 80,
  fae: 75,
  elemental: 95,
  undead: 110,
  demon: 105,
  draconic: 115,
  celestial: 90,
  aquatic: 95,
  titan: 140,
};

const RANK_BASE_HP: Record<string, number> = {
  "Novice": 0,
  "Apprentice": 20,
  "Initiate": 40,
  "Journeyman": 65,
  "Adept": 95,
  "Expert": 130,
  "Master": 170,
  "Grandmaster": 220,
  "Champion": 280,
  "Overlord": 350,
  "Sovereign": 430,
  "Ascendant": 520,
  "Legend": 620,
  "Mythic": 740,
  "Mythical Legend": 880,
};

export function calculateMaxHP(stats: CombatStats, level: number, race?: string | null, rank?: string | null): number {
  const safe = safeStats(stats);
  const raceHP = (race && RACE_BASE_HP[race]) ? RACE_BASE_HP[race] : 100;
  const rankHP = (rank && RANK_BASE_HP[rank]) ? RANK_BASE_HP[rank] : Math.floor(safeNumber(level, 1) * 10);
  const vitality = safe.Pot || 0;
  return Math.floor(raceHP + rankHP + (vitality * 8));
}

export function calculateTurnOrder(combatantA: Combatant, combatantB: Combatant): { first: Combatant; second: Combatant } {
  const spdA = safeNumber(combatantA.stats.Spd, 10);
  const spdB = safeNumber(combatantB.stats.Spd, 10);

  if (spdA > spdB) return { first: combatantA, second: combatantB };
  if (spdB > spdA) return { first: combatantB, second: combatantA };
  return Math.random() < 0.5
    ? { first: combatantA, second: combatantB }
    : { first: combatantB, second: combatantA };
}

export function calculateCritical(attackerLuck: number): { isCritical: boolean; multiplier: number } {
  const safeLuck = safeNumber(attackerLuck, 0);
  const critChance = Math.min(safeLuck / 40, 0.5);
  const isCritical = Math.random() < critChance;
  const multiplier = isCritical ? 3 : 1;
  return { isCritical, multiplier };
}

export function calculateElementalMultiplier(
  attackerElements: string[],
  defenderImmunities: string[],
  defenderElements?: string[]
): number {
  const validElements = attackerElements.filter(e => !defenderImmunities.includes(e));

  if (validElements.length === 0) return ELEMENT_MODIFIERS.WEAK;

  const defElements = defenderElements && defenderElements.length > 0 ? defenderElements : [];

  if (defElements.length === 0) return ELEMENT_MODIFIERS.NEUTRAL;

  return calculateElementModifier(validElements, defElements);
}

function applyDiminishingReturns(rawDefense: number, incomingDamage: number): number {
  if (rawDefense <= 0) return incomingDamage;
  const threshold = incomingDamage * 2;
  let effectiveDef = rawDefense;
  if (rawDefense > threshold) {
    effectiveDef = threshold + (rawDefense - threshold) * 0.5;
  }
  if (effectiveDef >= incomingDamage) return 0;
  return Math.floor(incomingDamage - effectiveDef);
}

export function calculateAoEFalloff(baseDamage: number, targetIndex: number): number {
  if (targetIndex <= 0) return baseDamage;
  const falloff = Math.pow(0.8, targetIndex);
  return Math.floor(baseDamage * falloff);
}

export function createCCTracker(): CCTracker {
  return {
    activeEffects: new Map(),
    ccHistory: new Map(),
  };
}

export function calculateCCSuccess(casterInt: number, targetInt: number, targetLuck: number): boolean {
  const safeCI = safeNumber(casterInt, 10);
  const safeTI = safeNumber(targetInt, 10);
  const safeTL = safeNumber(targetLuck, 10);
  const successChance = safeCI / (safeTI + safeTL);
  return Math.random() < Math.min(successChance, 0.85);
}

export function getCCDiminishedDuration(baseDuration: number, consecutiveCCs: number): number {
  if (consecutiveCCs <= 0) return baseDuration;
  const reduction = Math.pow(0.5, consecutiveCCs);
  return Math.max(1, Math.round(baseDuration * reduction));
}

export function applyCC(
  tracker: CCTracker,
  targetId: string,
  ccType: CCType,
  baseDuration: number,
  casterId: string,
  casterInt: number,
  targetInt: number,
  targetLuck: number
): { applied: boolean; duration: number; effects: string[] } {
  const effects: string[] = [];

  const activeOnTarget = tracker.activeEffects.get(targetId) || [];
  const ccThisTurn = activeOnTarget.filter(e => e.remainingTurns > 0);
  if (ccThisTurn.length >= 1) {
    effects.push("CC blocked: target already has an active CC this turn.");
    return { applied: false, duration: 0, effects };
  }

  if (!calculateCCSuccess(casterInt, targetInt, targetLuck)) {
    effects.push("CC resisted!");
    return { applied: false, duration: 0, effects };
  }

  const historyKey = `${targetId}`;
  const consecutiveCCs = tracker.ccHistory.get(historyKey) || 0;
  const actualDuration = getCCDiminishedDuration(baseDuration, consecutiveCCs);

  const newEffect: StatusEffect = {
    type: ccType,
    remainingTurns: actualDuration,
    appliedBy: casterId,
  };

  activeOnTarget.push(newEffect);
  tracker.activeEffects.set(targetId, activeOnTarget);
  tracker.ccHistory.set(historyKey, consecutiveCCs + 1);

  const ccNames: Record<CCType, string> = {
    stun: "Stunned",
    freeze: "Frozen",
    silence: "Silenced",
  };

  effects.push(`${ccNames[ccType]} for ${actualDuration} turn(s)!`);
  if (consecutiveCCs > 0) {
    effects.push(`(Diminishing returns: duration reduced from ${baseDuration} to ${actualDuration})`);
  }

  return { applied: true, duration: actualDuration, effects };
}

export function tickStatusEffects(tracker: CCTracker, combatantId: string): void {
  const effects = tracker.activeEffects.get(combatantId);
  if (!effects) return;
  for (const effect of effects) {
    effect.remainingTurns = Math.max(0, effect.remainingTurns - 1);
  }
  tracker.activeEffects.set(
    combatantId,
    effects.filter(e => e.remainingTurns > 0)
  );
}

export function hasActiveCC(tracker: CCTracker, combatantId: string, ccType: CCType): boolean {
  const effects = tracker.activeEffects.get(combatantId) || [];
  return effects.some(e => e.type === ccType && e.remainingTurns > 0);
}

export function isStunned(tracker: CCTracker, combatantId: string): boolean {
  return hasActiveCC(tracker, combatantId, "stun");
}

export function isFrozen(tracker: CCTracker, combatantId: string): boolean {
  return hasActiveCC(tracker, combatantId, "freeze");
}

export function isSilenced(tracker: CCTracker, combatantId: string): boolean {
  return hasActiveCC(tracker, combatantId, "silence");
}

export function getActiveStatusEffects(tracker: CCTracker, combatantId: string): StatusEffect[] {
  return tracker.activeEffects.get(combatantId) || [];
}

export function getFreezeDamageMultiplier(tracker: CCTracker, targetId: string): number {
  if (isFrozen(tracker, targetId)) return 1.5;
  return 1.0;
}

const DEFAULT_BUFF_DURATION = 3;
const MAX_BUFF_STACKS = 2;
const MAX_BUFF_MULTIPLIER = 2.0;

const RANK_BUFF_SCALING: Record<string, number> = {
  "Novice": 1.0,
  "Apprentice": 1.05,
  "Initiate": 1.1,
  "Journeyman": 1.15,
  "Adept": 1.2,
  "Expert": 1.25,
  "Master": 1.3,
  "Grandmaster": 1.35,
  "Champion": 1.4,
  "Overlord": 1.45,
  "Sovereign": 1.5,
  "Ascendant": 1.55,
  "Legend": 1.6,
  "Mythic": 1.65,
  "Mythical Legend": 1.7,
};

export function createBuffTracker(): BuffTracker {
  return {
    activeBuffs: new Map(),
  };
}

export function calculateBuffBonus(
  baseAmount: number,
  casterInt: number,
  casterRank?: string | null
): number {
  const intScaling = 1 + (casterInt / 100);
  const rankScaling = (casterRank && RANK_BUFF_SCALING[casterRank]) ? RANK_BUFF_SCALING[casterRank] : 1.0;
  return Math.floor(baseAmount * intScaling * rankScaling);
}

export function applyBuff(
  tracker: BuffTracker,
  targetId: string,
  statType: BuffStatType,
  baseBonus: number,
  casterInt: number,
  casterId: string,
  buffName: string,
  baseStat: number,
  duration: number = DEFAULT_BUFF_DURATION,
  casterRank?: string | null
): { applied: boolean; bonus: number; effects: string[] } {
  const effects: string[] = [];
  const activeOnTarget = tracker.activeBuffs.get(targetId) || [];

  const sameTypeStacks = activeOnTarget.filter(b => b.statType === statType && b.remainingTurns > 0);
  if (sameTypeStacks.length >= MAX_BUFF_STACKS) {
    effects.push(`Buff blocked: max ${MAX_BUFF_STACKS} stacks of ${statType} buff already active.`);
    return { applied: false, bonus: 0, effects };
  }

  let scaledBonus = calculateBuffBonus(baseBonus, casterInt, casterRank);

  const currentTotalBonus = sameTypeStacks.reduce((sum, b) => sum + b.flatBonus, 0);
  const maxAllowedBonus = Math.floor(baseStat * MAX_BUFF_MULTIPLIER) - baseStat;
  const remainingRoom = Math.max(0, maxAllowedBonus - currentTotalBonus);

  if (scaledBonus > remainingRoom) {
    scaledBonus = remainingRoom;
    if (scaledBonus <= 0) {
      effects.push(`Buff blocked: ${statType} already at 2× base cap from buffs.`);
      return { applied: false, bonus: 0, effects };
    }
    effects.push(`Buff capped: ${statType} bonus reduced to ${scaledBonus} (2× base cap).`);
  }

  const newBuff: BuffEffect = {
    statType,
    flatBonus: scaledBonus,
    remainingTurns: duration,
    appliedBy: casterId,
    buffName,
  };

  activeOnTarget.push(newBuff);
  tracker.activeBuffs.set(targetId, activeOnTarget);

  effects.push(`${buffName}: +${scaledBonus} ${statType} for ${duration} turn(s)! (Stack ${sameTypeStacks.length + 1}/${MAX_BUFF_STACKS})`);

  return { applied: true, bonus: scaledBonus, effects };
}

export function tickBuffs(tracker: BuffTracker, combatantId: string): string[] {
  const effects: string[] = [];
  const buffs = tracker.activeBuffs.get(combatantId);
  if (!buffs) return effects;

  for (const buff of buffs) {
    buff.remainingTurns = Math.max(0, buff.remainingTurns - 1);
    if (buff.remainingTurns === 0) {
      effects.push(`${buff.buffName} expired: -${buff.flatBonus} ${buff.statType}`);
    }
  }

  tracker.activeBuffs.set(
    combatantId,
    buffs.filter(b => b.remainingTurns > 0)
  );

  return effects;
}

export function getBuffedStats(tracker: BuffTracker, combatantId: string, baseStats: CombatStats): CombatStats {
  const buffs = tracker.activeBuffs.get(combatantId) || [];
  const bonuses: Partial<Record<BuffStatType, number>> = {};

  for (const buff of buffs) {
    if (buff.remainingTurns > 0) {
      bonuses[buff.statType] = (bonuses[buff.statType] || 0) + buff.flatBonus;
    }
  }

  const statKeys: BuffStatType[] = ["Str", "Def", "Spd", "Int", "Luck", "Pot"];
  const result = { ...baseStats };

  for (const key of statKeys) {
    const baseVal = safeNumber(baseStats[key], 0);
    const bonus = bonuses[key] || 0;
    const maxAllowed = Math.floor(baseVal * MAX_BUFF_MULTIPLIER);
    result[key] = Math.min(baseVal + bonus, maxAllowed);
  }

  return result;
}

export function getActiveBuffs(tracker: BuffTracker, combatantId: string): BuffEffect[] {
  return (tracker.activeBuffs.get(combatantId) || []).filter(b => b.remainingTurns > 0);
}

export function getTotalBuffBonus(tracker: BuffTracker, combatantId: string, statType: BuffStatType): number {
  const buffs = tracker.activeBuffs.get(combatantId) || [];
  return buffs
    .filter(b => b.statType === statType && b.remainingTurns > 0)
    .reduce((sum, b) => sum + b.flatBonus, 0);
}

function mapResonanceStatusToCC(statusType: string): CCType | null {
  switch (statusType) {
    case "stun": return "stun";
    case "freeze": return "freeze";
    case "silence": return "silence";
    default: return null;
  }
}

export function processAction(
  attacker: Combatant,
  defender: Combatant,
  action: CombatAction,
  defenderAction?: CombatAction,
  ccTracker?: CCTracker,
  buffTracker?: BuffTracker
): CombatRound {
  const effects: string[] = [];
  const statusEffectsApplied: { type: CCType; duration: number; target: string }[] = [];
  const buffsApplied: { statType: BuffStatType; bonus: number; target: string; buffName: string }[] = [];
  let damage = 0;
  let blocked = 0;
  let isCritical = false;
  let isEvaded = false;
  let isBlocked = false;
  let elementalMultiplier = 1;
  let resonance: ResonanceResult | undefined;

  const attackerStats = buffTracker ? getBuffedStats(buffTracker, attacker.id, attacker.stats) : attacker.stats;
  const defenderStats = buffTracker ? getBuffedStats(buffTracker, defender.id, defender.stats) : defender.stats;

  switch (action.type) {
    case "attack": {
      let baseDamage = safeNumber(attackerStats.Str, 10);

      const critResult = calculateCritical(attackerStats.Luck);
      isCritical = critResult.isCritical;
      if (isCritical) effects.push("Critical hit!");

      if (attacker.elements && attacker.elements.elements.length > 0) {
        elementalMultiplier = calculateElementalMultiplier(
          attacker.elements.elements,
          defender.immunities || [],
          defender.elements?.elements
        );
        if (elementalMultiplier > 1) effects.push(`Elemental advantage x${elementalMultiplier.toFixed(1)}`);
        if (elementalMultiplier < 1) effects.push("Elemental disadvantage!");
      }

      let resonanceBonusDamage = 0;
      if (attacker.elements && attacker.elements.elements.length >= 2) {
        resonance = checkResonance(attacker.elements.elements);
        if (resonance.triggered && resonance.effect) {
          resonanceBonusDamage = baseDamage * resonance.effect.damageBonus;
          effects.push(`${resonance.effect.name}! ${resonance.effect.description}`);
          if (resonance.statusApplied && resonance.effect.statusEffect) {
            effects.push(`${defender.name} is afflicted with ${resonance.effect.statusEffect} for ${resonance.effect.statusDuration} turns!`);
          }
        }
      }

      const rawDamage = baseDamage * critResult.multiplier * elementalMultiplier + resonanceBonusDamage;

      if (defenderAction?.type === "dodge") {
        const attackerSpd = safeNumber(attackerStats.Spd, 10);
        const defenderSpd = safeNumber(defenderStats.Spd, 10);
        const defenderDef = safeNumber(defenderStats.Def, 10);

        if (defenderSpd > attackerSpd) {
          isEvaded = true;
          effects.push(`${defender.name} fully evaded the attack!`);
          damage = 0;
        } else if (defenderSpd > defenderDef) {
          effects.push(`${defender.name} dodged past defense but was still hit!`);
          damage = Math.floor(rawDamage);
        } else {
          effects.push(`${defender.name} failed to dodge!`);
          damage = applyDiminishingReturns(safeNumber(defenderStats.Def, 0), Math.floor(rawDamage));
        }
      } else if (defenderAction?.type === "defend") {
        isBlocked = true;
        const defenderDef = safeNumber(defenderStats.Def, 0);
        if (defenderDef >= rawDamage) {
          blocked = Math.floor(rawDamage);
          damage = 0;
          effects.push(`${defender.name} completely blocked the attack!`);
        } else {
          blocked = Math.floor(defenderDef);
          damage = applyDiminishingReturns(defenderDef, Math.floor(rawDamage));
          effects.push(`${defender.name} blocked ${blocked} damage!`);
        }
      } else {
        damage = applyDiminishingReturns(safeNumber(defenderStats.Def, 0), Math.floor(rawDamage));
      }
      break;
    }

    case "spell": {
      const spell = attacker.spell;
      const spellCategory = spell?.spellCategory || "damage";
      const spellPower = spell?.spellPower || spell?.multiplier || 1.5;
      const rankMult = spell?.rankMultiplier || 1.0;

      if (spellCategory === "buff") {
        if (buffTracker && spell?.buffStat && spell?.buffAmount) {
          const statMap: Record<string, BuffStatType> = {
            "Str": "Str", "Def": "Def", "Spd": "Spd", "Int": "Int", "Luck": "Luck", "Pot": "Pot",
          };
          const mappedStat = statMap[spell.buffStat];
          if (mappedStat) {
            const baseStat = safeNumber(attackerStats[mappedStat], 10);
            const buffResult = applyBuff(
              buffTracker, attacker.id, mappedStat,
              spell.buffAmount, safeNumber(attackerStats.Int, 10),
              attacker.id, spell.name || "Buff Spell", baseStat,
              3, attacker.rank
            );
            effects.push(...buffResult.effects);
            if (buffResult.applied) {
              buffsApplied.push({ statType: mappedStat, bonus: buffResult.bonus, target: attacker.id, buffName: spell.name || "Buff" });
            }
          }
        }
        effects.push(`${attacker.name} casts ${spell?.name || "a buff spell"}!`);
        break;
      }

      if (spellCategory === "cc") {
        let ccBaseDamage = safeNumber(attackerStats.Int, 10) * spellPower * rankMult;

        const critResult = calculateCritical(attackerStats.Luck);
        isCritical = critResult.isCritical;
        if (isCritical) {
          effects.push("Critical spell hit!");
          ccBaseDamage *= critResult.multiplier;
        }

        let spellElement = spell?.element;
        let spellElements = spellElement ? [spellElement] : (attacker.elements?.elements || []);
        if (spellElements.length > 0) {
          elementalMultiplier = calculateElementalMultiplier(spellElements, defender.immunities || [], defender.elements?.elements);
          if (elementalMultiplier > 1) effects.push(`Elemental advantage x${elementalMultiplier.toFixed(1)}`);
          if (elementalMultiplier < 1) effects.push("Elemental disadvantage!");
        }

        damage = Math.floor(ccBaseDamage * elementalMultiplier);

        if (ccTracker && spell?.ccType && spell?.ccDuration) {
          const ccResult = applyCC(
            ccTracker, defender.id, spell.ccType, spell.ccDuration,
            attacker.id, safeNumber(attackerStats.Int, 10),
            safeNumber(defenderStats.Int, 10), safeNumber(defenderStats.Luck, 10)
          );
          effects.push(...ccResult.effects);
          if (ccResult.applied) {
            statusEffectsApplied.push({ type: spell.ccType, duration: ccResult.duration, target: defender.id });
          }
        }

        effects.push(`${attacker.name} casts ${spell?.name || "a CC spell"}! Ignores defense!`);
        break;
      }

      if (spellCategory === "heal") {
        effects.push(`${attacker.name} casts ${spell?.name || "a healing spell"}!`);
        break;
      }

      let baseDamage = safeNumber(attackerStats.Int, 10) * spellPower * rankMult;

      const critResult = calculateCritical(attackerStats.Luck);
      isCritical = critResult.isCritical;
      if (isCritical) effects.push("Critical spell hit!");

      let spellElement = spell?.element;
      let spellElements = spellElement ? [spellElement] : (attacker.elements?.elements || []);

      if (spellElements.length > 0) {
        elementalMultiplier = calculateElementalMultiplier(
          spellElements,
          defender.immunities || [],
          defender.elements?.elements
        );
        if (elementalMultiplier > 1) effects.push(`Elemental advantage x${elementalMultiplier.toFixed(1)}`);
        if (elementalMultiplier < 1) effects.push("Elemental disadvantage!");
      }

      let resonanceBonusDamage = 0;
      if (spellElements.length >= 2) {
        resonance = checkResonance(spellElements);
        if (resonance.triggered && resonance.effect) {
          resonanceBonusDamage = baseDamage * resonance.effect.damageBonus;
          effects.push(`${resonance.effect.name}! ${resonance.effect.description}`);
          if (resonance.statusApplied && resonance.effect.statusEffect) {
            effects.push(`${defender.name} is afflicted with ${resonance.effect.statusEffect} for ${resonance.effect.statusDuration} turns!`);
          }
        }
      }

      damage = Math.floor((baseDamage * critResult.multiplier * elementalMultiplier) + resonanceBonusDamage);

      if (spellCategory === "aoe" && spell?.targetCount && spell.targetCount > 1) {
        const primaryDamage = damage;
        let totalAoeDamage = primaryDamage;
        for (let i = 1; i < spell.targetCount; i++) {
          totalAoeDamage += calculateAoEFalloff(primaryDamage, i);
        }
        effects.push(`AoE spell hits ${spell.targetCount} targets! Total AoE damage: ${totalAoeDamage}`);

        if (ccTracker && spell?.ccType && spell?.ccDuration) {
          const ccResult = applyCC(
            ccTracker, defender.id, spell.ccType, spell.ccDuration,
            attacker.id, safeNumber(attackerStats.Int, 10),
            safeNumber(defenderStats.Int, 10), safeNumber(defenderStats.Luck, 10)
          );
          effects.push(...ccResult.effects);
          if (ccResult.applied) {
            statusEffectsApplied.push({ type: spell.ccType, duration: ccResult.duration, target: defender.id });
          }
        }
      }

      effects.push(`${attacker.name} casts ${spell?.name || "a spell"}! Ignores defense!`);
      break;
    }

    case "trick": {
      const trickDamage = safeNumber(attackerStats.Str, 10) * 0.6;
      const trickLuckBonus = attackerStats.Luck / 100;

      const successChance = 0.5 + trickLuckBonus;
      if (Math.random() < successChance) {
        damage = Math.floor(trickDamage * 1.5);
        effects.push("Trick succeeded! Extra damage dealt!");

        if (ccTracker && Math.random() < 0.3) {
          const ccResult = applyCC(
            ccTracker, defender.id, "stun", 1, attacker.id,
            safeNumber(attackerStats.Int, 10),
            safeNumber(defenderStats.Int, 10),
            safeNumber(defenderStats.Luck, 10)
          );
          effects.push(...ccResult.effects);
          if (ccResult.applied) {
            statusEffectsApplied.push({ type: "stun", duration: ccResult.duration, target: defender.id });
          }
        } else if (!ccTracker && Math.random() < 0.3) {
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

  if (ccTracker && resonance?.triggered && resonance.statusApplied && resonance.effect?.statusEffect) {
    const statusType = resonance.effect.statusEffect as string;
    const ccType = mapResonanceStatusToCC(statusType);
    if (ccType) {
      const ccResult = applyCC(
        ccTracker, defender.id, ccType,
        resonance.effect.statusDuration || 1,
        attacker.id,
        safeNumber(attackerStats.Int, 10),
        safeNumber(defenderStats.Int, 10),
        safeNumber(defenderStats.Luck, 10)
      );
      effects.push(...ccResult.effects);
      if (ccResult.applied) {
        statusEffectsApplied.push({ type: ccType, duration: ccResult.duration, target: defender.id });
      }
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
    resonance,
    statusEffectsApplied: statusEffectsApplied.length > 0 ? statusEffectsApplied : undefined,
    buffsApplied: buffsApplied.length > 0 ? buffsApplied : undefined,
  };
}

export function runAutoCombat(
  player: Combatant,
  npc: Combatant,
  maxRounds: number = 20
): CombatResult {
  const playerHP = calculateMaxHP(player.stats, player.level, player.race, player.rank);
  const npcHP = calculateMaxHP(npc.stats, npc.level, npc.race, npc.rank);

  const combatState = {
    [player.id]: playerHP,
    [npc.id]: npcHP,
  };

  const totalDamage: Record<string, number> = {
    [player.id]: 0,
    [npc.id]: 0,
  };

  const ccTracker = createCCTracker();
  const buffTracker = createBuffTracker();
  const rounds: CombatRound[] = [];
  let turn = 1;

  while (combatState[player.id] > 0 && combatState[npc.id] > 0 && turn <= maxRounds) {
    const { first, second } = calculateTurnOrder(player, npc);

    const firstStunned = isStunned(ccTracker, first.id);
    const firstFrozen = isFrozen(ccTracker, first.id);
    const firstSilenced = isSilenced(ccTracker, first.id);

    if (firstStunned || firstFrozen) {
      const skipCC = firstStunned ? "stun" as CCType : "freeze" as CCType;
      const skipRound: CombatRound = {
        turn,
        attacker: first.id,
        defender: second.id,
        action: { type: "defend" },
        damage: 0,
        blocked: 0,
        isCritical: false,
        isEvaded: false,
        isBlocked: false,
        elementalMultiplier: 1,
        effects: [`${first.name} is ${firstStunned ? "stunned" : "frozen"} and cannot act!`],
        skippedDueToCC: skipCC,
      };
      rounds.push(skipRound);
      tickStatusEffects(ccTracker, first.id);
    } else {
      let firstAction: CombatAction = selectAIAction(first, combatState[first.id], first, ccTracker);
      if (firstSilenced && firstAction.type === "spell") {
        firstAction = { type: "attack" };
      }
      const secondAction: CombatAction = selectAIAction(second, combatState[second.id], second, ccTracker);

      const round1 = processAction(first, second, firstAction, secondAction, ccTracker, buffTracker);
      round1.turn = turn;

      const freezeMultiplier = getFreezeDamageMultiplier(ccTracker, second.id);
      if (freezeMultiplier > 1 && round1.damage > 0) {
        round1.damage = Math.floor(round1.damage * freezeMultiplier);
        round1.effects.push(`Frozen target takes ${Math.round((freezeMultiplier - 1) * 100)}% more damage!`);
      }

      rounds.push(round1);

      combatState[second.id] -= round1.damage;
      totalDamage[first.id] += round1.damage;

      tickStatusEffects(ccTracker, first.id);
      const buffExpiry1 = tickBuffs(buffTracker, first.id);
      if (buffExpiry1.length > 0) round1.effects.push(...buffExpiry1);
    }

    if (combatState[second.id] <= 0) break;

    const secondStunned = isStunned(ccTracker, second.id);
    const secondFrozen = isFrozen(ccTracker, second.id);
    const secondSilenced = isSilenced(ccTracker, second.id);

    if (secondStunned || secondFrozen) {
      const skipCC = secondStunned ? "stun" as CCType : "freeze" as CCType;
      const skipRound: CombatRound = {
        turn,
        attacker: second.id,
        defender: first.id,
        action: { type: "defend" },
        damage: 0,
        blocked: 0,
        isCritical: false,
        isEvaded: false,
        isBlocked: false,
        elementalMultiplier: 1,
        effects: [`${second.name} is ${secondStunned ? "stunned" : "frozen"} and cannot act!`],
        skippedDueToCC: skipCC,
      };
      rounds.push(skipRound);
      tickStatusEffects(ccTracker, second.id);
    } else {
      let secondAction: CombatAction = selectAIAction(second, combatState[second.id], second, ccTracker);
      if (secondSilenced && secondAction.type === "spell") {
        secondAction = { type: "attack" };
      }
      const firstAction: CombatAction = selectAIAction(first, combatState[first.id], first, ccTracker);

      const round2 = processAction(second, first, secondAction, firstAction, ccTracker, buffTracker);
      round2.turn = turn;

      const freezeMultiplier = getFreezeDamageMultiplier(ccTracker, first.id);
      if (freezeMultiplier > 1 && round2.damage > 0) {
        round2.damage = Math.floor(round2.damage * freezeMultiplier);
        round2.effects.push(`Frozen target takes ${Math.round((freezeMultiplier - 1) * 100)}% more damage!`);
      }

      rounds.push(round2);

      combatState[first.id] -= round2.damage;
      totalDamage[second.id] += round2.damage;

      tickStatusEffects(ccTracker, second.id);
      const buffExpiry2 = tickBuffs(buffTracker, second.id);
      if (buffExpiry2.length > 0) round2.effects.push(...buffExpiry2);
    }

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

function selectAIAction(combatant: Combatant, currentHP: number, fullCombatant: Combatant, ccTracker?: CCTracker): CombatAction {
  const maxHP = calculateMaxHP(combatant.stats, combatant.level, combatant.race, combatant.rank);
  const hpPercent = currentHP / maxHP;
  const roll = Math.random();

  const silenced = ccTracker ? isSilenced(ccTracker, combatant.id) : false;

  if (hpPercent < 0.3 && roll < 0.4) {
    return { type: "defend" };
  }

  if (!silenced && fullCombatant.spell && combatant.stats.Int > combatant.stats.Str && roll < 0.35) {
    return { type: "spell" };
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

export interface DeathPenaltyResult {
  goldLost: number;
  durabilityDamage: number;
  ghostState: boolean;
  weaknessDebuffExpires: Date;
}

export function calculateDeathPenalty(gold: number): DeathPenaltyResult {
  const goldLossPercent = 0.1;
  const goldLost = Math.min(50000, Math.max(50, Math.floor(gold * goldLossPercent)));
  const durabilityDamage = 10;
  const weaknessExpires = new Date(Date.now() + 5 * 60 * 1000);

  return {
    goldLost,
    durabilityDamage,
    ghostState: true,
    weaknessDebuffExpires: weaknessExpires,
  };
}

export function applyWeaknessDebuff(stats: CombatStats, weaknessExpires: Date | null): CombatStats {
  if (!weaknessExpires || new Date() >= weaknessExpires) return stats;
  const reduction = 0.8;
  return {
    Str: Math.floor(stats.Str * reduction),
    Def: Math.floor(stats.Def * reduction),
    Spd: Math.floor(stats.Spd * reduction),
    Int: Math.floor(stats.Int * reduction),
    Luck: Math.floor(stats.Luck * reduction),
    Pot: Math.floor((stats.Pot || 0) * reduction),
    HP: stats.HP,
    maxHP: stats.maxHP,
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

export function applyRacePassiveSkill(baseStats: CombatStats, passiveSkillId: string | null | undefined): CombatStats {
  if (!passiveSkillId) return baseStats;

  try {
    const { getRacePassiveBonuses } = require("../shared/skills-data");
    const passive = getRacePassiveBonuses(passiveSkillId);
    if (!passive) return baseStats;

    const result = { ...baseStats };
    if (passive.statBonus) {
      const bonusMap: Record<string, keyof CombatStats> = {
        Str: "Str", Def: "Def", Spd: "Spd", Int: "Int", Luck: "Luck", Pot: "Pot",
      };
      for (const [key, value] of Object.entries(passive.statBonus)) {
        const statKey = bonusMap[key];
        if (statKey && typeof value === "number") {
          const base = safeNumber(result[statKey], 0);
          result[statKey] = base + Math.floor(base * (value / 100));
        }
      }
    }

    return result;
  } catch {
    return baseStats;
  }
}

export function applyPetMutationTrait(
  stats: CombatStats,
  mutationTrait: string | null | undefined,
  critChanceBonus: { value: number }
): { stats: CombatStats; immunities: string[]; effects: string[] } {
  const effects: string[] = [];
  const immunities: string[] = [];
  const result = { ...stats };

  if (!mutationTrait) return { stats: result, immunities, effects };

  const { PET_MUTATION_TRAITS } = require("../shared/schema");
  const trait = PET_MUTATION_TRAITS[mutationTrait as keyof typeof PET_MUTATION_TRAITS];
  if (!trait) return { stats: result, immunities, effects };

  effects.push(`Pet Mutation: ${trait.name} - ${trait.description}`);

  if ('critBonus' in trait) {
    critChanceBonus.value += trait.critBonus / 100;
  }
  if ('damageBonus' in trait) {
    result.Str = Math.floor(result.Str * 1.1);
  }
  if ('defenseBonus' in trait) {
    result.Def = Math.floor(result.Def * 1.1);
  }
  if ('speedBonus' in trait) {
    result.Spd = Math.floor(result.Spd * 1.1);
  }
  if ('luckBonus' in trait) {
    result.Luck = Math.floor(result.Luck * 1.1);
  }
  if ('statBoost' in trait) {
    const boost = trait.statBoost / 100;
    result.Str = Math.floor(result.Str * (1 + boost));
    result.Def = Math.floor(result.Def * (1 + boost));
    result.Spd = Math.floor(result.Spd * (1 + boost));
    result.Int = Math.floor(result.Int * (1 + boost));
    result.Luck = Math.floor(result.Luck * (1 + boost));
  }
  if ('immunityGrant' in trait) {
    const allElements = ["Fire", "Water", "Earth", "Air", "Lightning", "Ice", "Nature", "Dark", "Light"];
    const randomElement = allElements[Math.floor(Math.random() * allElements.length)];
    immunities.push(randomElement);
    effects.push(`Elemental Ward grants immunity to ${randomElement}!`);
  }

  return { stats: result, immunities, effects };
}

export function getPetTempElement(tempElement: string | null | undefined, tempElementExpires: Date | string | null | undefined): string | null {
  if (!tempElement || !tempElementExpires) return null;
  const expires = typeof tempElementExpires === 'string' ? new Date(tempElementExpires) : tempElementExpires;
  if (new Date() >= expires) return null;
  return tempElement;
}

export function getRaceActiveSpellInfo(activeSkillId: string | null | undefined, stats: CombatStats, petStats?: { Str?: number; Int?: number }): SpellInfo | null {
  if (!activeSkillId) return null;

  try {
    const { getRaceActiveAsSpell } = require("../shared/skills-data");
    const spell = getRaceActiveAsSpell(activeSkillId, stats, petStats);
    if (!spell) return null;

    return {
      name: spell.name,
      multiplier: spell.multiplier,
      element: spell.element,
    };
  } catch {
    return null;
  }
}
