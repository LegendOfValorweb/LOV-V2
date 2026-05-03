import { db } from "./db";
import { accounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { raceModifiers, playerRanks, type PlayerRank, type PlayerRace } from "../shared/schema";
import { calculateElementModifier, checkResonance, ELEMENT_MODIFIERS, type ResonanceResult } from "./elemental-resonance";

export type CCType = "stun" | "freeze" | "silence";

export type DoTType = "burn" | "bleed" | "poison" | "drain" | "amplify" | "root" | "blind";

export interface DoTEffect {
  type: DoTType;
  damagePerTurn: number;
  remainingTurns: number;
  appliedBy: string;
}

export interface DoTTracker {
  activeDoTs: Map<string, DoTEffect[]>;
}

export interface WeaponSpecialEffect {
  lifeStealPct?: number;
  critBonus?: number;
  stunChance?: number;
  burnTurns?: number;
  freezeTurns?: number;
  silenceTurns?: number;
  poisonTurns?: number;
  doubleStrike?: boolean;
  bleedTurns?: number;
  drainPct?: number;
  fireResist?: boolean;
  magicShield?: boolean;
  manaRegen?: boolean;
  label: string;
}

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
  raceCritBonus?: number;
  raceLifeStealPct?: number;
  raceDodgeBonus?: number;
  raceDamageReduction?: number;
  raceThornsPct?: number;
  raceCounterChance?: number;
  raceBonusDamagePct?: number;
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
  healAmount?: number;
  resonance?: ResonanceResult;
  statusEffectsApplied?: { type: CCType; duration: number; target: string }[];
  buffsApplied?: { statType: BuffStatType; bonus: number; target: string; buffName: string }[];
  skippedDueToCC?: CCType;
  dotEffectsApplied?: { type: DoTType; damagePerTurn: number; turns: number; target: string }[];
  weaponSpecialTriggered?: string;
  thornsReflect?: number;
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

const RANK_CRIT_MULTIPLIER: Record<string, number> = {
  "Novice": 2.0,
  "Apprentice": 2.1,
  "Initiate": 2.2,
  "Journeyman": 2.3,
  "Adept": 2.5,
  "Expert": 2.7,
  "Master": 3.0,
  "Grandmaster": 3.2,
  "Champion": 3.5,
  "Overlord": 3.8,
  "Sovereign": 4.0,
  "Ascendant": 4.3,
  "Legend": 4.6,
  "Mythic": 5.0,
  "Mythical Legend": 5.5,
};

export function calculateCritical(attackerLuck: number, attackerRank?: string | null): { isCritical: boolean; multiplier: number } {
  const safeLuck = safeNumber(attackerLuck, 0);
  const critChance = Math.min(safeLuck / 40, 0.5);
  const isCritical = Math.random() < critChance;
  const baseMult = (attackerRank && RANK_CRIT_MULTIPLIER[attackerRank]) ? RANK_CRIT_MULTIPLIER[attackerRank] : 3.0;
  const multiplier = isCritical ? baseMult : 1;
  return { isCritical, multiplier };
}

export function parseWeaponSpecial(special: string | null | undefined): WeaponSpecialEffect | null {
  if (!special) return null;
  const s = special.trim();

  if (/life steal (\d+)%/i.test(s)) {
    const pct = parseInt(s.match(/life steal (\d+)%/i)![1]) / 100;
    return { lifeStealPct: pct, label: s };
  }
  if (/stun (\d+)%/i.test(s)) {
    const chance = parseInt(s.match(/stun (\d+)%/i)![1]) / 100;
    return { stunChance: chance, label: s };
  }
  if (/critical \+(\d+)%/i.test(s)) {
    const bonus = parseInt(s.match(/critical \+(\d+)%/i)![1]) / 100;
    return { critBonus: bonus, label: s };
  }
  if (/burn (\d+)t/i.test(s)) {
    const turns = parseInt(s.match(/burn (\d+)t/i)![1]);
    return { burnTurns: turns, label: s };
  }
  if (/freeze (\d+)t/i.test(s)) {
    const turns = parseInt(s.match(/freeze (\d+)t/i)![1]);
    return { freezeTurns: turns, label: s };
  }
  if (/silence (\d+)t/i.test(s)) {
    const turns = parseInt(s.match(/silence (\d+)t/i)![1]);
    return { silenceTurns: turns, label: s };
  }
  if (/poison (\d+)t/i.test(s)) {
    const turns = parseInt(s.match(/poison (\d+)t/i)![1]);
    return { poisonTurns: turns, label: s };
  }
  if (/bleed (\d+)t/i.test(s)) {
    const turns = parseInt(s.match(/bleed (\d+)t/i)![1]);
    return { bleedTurns: turns, label: s };
  }
  if (/double strike/i.test(s)) {
    return { doubleStrike: true, label: s };
  }
  if (/fire resist/i.test(s)) {
    return { fireResist: true, label: s };
  }
  if (/magic shield/i.test(s)) {
    return { magicShield: true, label: s };
  }
  if (/mana regen/i.test(s)) {
    return { manaRegen: true, label: s };
  }
  return { label: s };
}

export function createDoTTracker(): DoTTracker {
  return { activeDoTs: new Map() };
}

export function applyDoT(
  tracker: DoTTracker,
  targetId: string,
  dotType: DoTType,
  damagePerTurn: number,
  turns: number,
  appliedBy: string
): { applied: boolean; effects: string[] } {
  const effects: string[] = [];
  const existing = tracker.activeDoTs.get(targetId) || [];

  const sameType = existing.filter(d => d.type === dotType && d.remainingTurns > 0);
  if (sameType.length > 0) {
    sameType[0].remainingTurns = Math.max(sameType[0].remainingTurns, turns);
    sameType[0].damagePerTurn = Math.max(sameType[0].damagePerTurn, damagePerTurn);
    effects.push(`${dotType} refreshed (${damagePerTurn} dmg/turn for ${turns} turns).`);
    return { applied: true, effects };
  }

  existing.push({ type: dotType, damagePerTurn, remainingTurns: turns, appliedBy });
  tracker.activeDoTs.set(targetId, existing);

  const dotNames: Record<DoTType, string> = {
    burn: "Burning",
    bleed: "Bleeding",
    poison: "Poisoned",
    drain: "Drained",
    amplify: "Amplified",
    root: "Rooted",
    blind: "Blinded",
  };
  effects.push(`${dotNames[dotType]}! ${damagePerTurn} ${dotType} damage per turn for ${turns} turns.`);
  return { applied: true, effects };
}

export function tickDoTs(
  tracker: DoTTracker,
  targetId: string,
  targetStats: CombatStats
): { totalDamage: number; statPenalties: Partial<CombatStats>; effects: string[] } {
  const effects: string[] = [];
  const dots = tracker.activeDoTs.get(targetId) || [];
  let totalDamage = 0;
  const statPenalties: Partial<CombatStats> = {};

  for (const dot of dots) {
    if (dot.remainingTurns <= 0) continue;

    switch (dot.type) {
      case "burn":
      case "bleed":
      case "poison":
        totalDamage += dot.damagePerTurn;
        const dotLabel = dot.type === "burn" ? "Burning" : dot.type === "bleed" ? "Bleeding" : "Poisoned";
        effects.push(`${dotLabel}: -${dot.damagePerTurn} HP`);
        break;
      case "drain":
        const drainAmt = Math.floor(targetStats.Int * 0.05 + dot.damagePerTurn);
        totalDamage += drainAmt;
        effects.push(`Drain: -${drainAmt} HP (life siphoned)`);
        break;
      case "amplify":
        statPenalties.Def = (statPenalties.Def || 0) - Math.floor(targetStats.Def * 0.10);
        effects.push(`Amplify: Defense reduced by 10% this turn`);
        break;
      case "root":
        statPenalties.Spd = (statPenalties.Spd || 0) - Math.floor(targetStats.Spd * 0.50);
        effects.push(`Rooted: Speed halved this turn`);
        break;
      case "blind":
        statPenalties.Luck = (statPenalties.Luck || 0) - Math.floor(targetStats.Luck * 0.30);
        effects.push(`Blinded: Crit/Luck reduced by 30% this turn`);
        break;
    }

    dot.remainingTurns = Math.max(0, dot.remainingTurns - 1);
    if (dot.remainingTurns === 0) {
      effects.push(`${dot.type} wore off.`);
    }
  }

  tracker.activeDoTs.set(targetId, dots.filter(d => d.remainingTurns > 0));
  return { totalDamage, statPenalties, effects };
}

export function applyDoTStatPenalties(
  buffTracker: BuffTracker,
  targetId: string,
  penalties: Partial<CombatStats>,
  sourceId: string
): void {
  const statMap: Record<string, BuffStatType> = {
    Str: "Str", Def: "Def", Spd: "Spd", Int: "Int", Luck: "Luck",
  };
  const existing = buffTracker.activeBuffs.get(targetId) || [];
  const filtered = existing.filter(b => b.buffName !== "DoT Penalty");
  for (const [key, value] of Object.entries(penalties)) {
    const statType = statMap[key];
    if (statType && typeof value === "number" && value !== 0) {
      filtered.push({
        statType,
        flatBonus: value,
        remainingTurns: 2,
        appliedBy: sourceId,
        buffName: "DoT Penalty",
      });
    }
  }
  buffTracker.activeBuffs.set(targetId, filtered);
}

export function getActiveDoTs(tracker: DoTTracker, targetId: string): DoTEffect[] {
  return (tracker.activeDoTs.get(targetId) || []).filter(d => d.remainingTurns > 0);
}

export function hasActiveDoT(tracker: DoTTracker, targetId: string, dotType: DoTType): boolean {
  return getActiveDoTs(tracker, targetId).some(d => d.type === dotType);
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
  const sameTypeActive = activeOnTarget.filter(e => e.type === ccType && e.remainingTurns > 0);
  if (sameTypeActive.length >= 1) {
    effects.push(`CC blocked: target is already ${ccType}ed.`);
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
  buffTracker?: BuffTracker,
  dotTracker?: DoTTracker,
  attackerWeaponSpecial?: string | null
): CombatRound {
  const effects: string[] = [];
  const statusEffectsApplied: { type: CCType; duration: number; target: string }[] = [];
  const buffsApplied: { statType: BuffStatType; bonus: number; target: string; buffName: string }[] = [];
  const dotEffectsApplied: { type: DoTType; damagePerTurn: number; turns: number; target: string }[] = [];
  let damage = 0;
  let blocked = 0;
  let healAmount = 0;
  let isCritical = false;
  let isEvaded = false;
  let isBlocked = false;
  let elementalMultiplier = 1;
  let resonance: ResonanceResult | undefined;
  let weaponSpecialTriggered: string | undefined;
  let thornsReflect: number | undefined;

  const attackerStats = buffTracker ? getBuffedStats(buffTracker, attacker.id, attacker.stats) : attacker.stats;
  const defenderStats = buffTracker ? getBuffedStats(buffTracker, defender.id, defender.stats) : defender.stats;

  switch (action.type) {
    case "attack": {
      let baseDamage = safeNumber(attackerStats.Str, 10);

      const baseCritResult = calculateCritical(attackerStats.Luck, attacker.rank);
      const raceCritBonusChance = attacker.raceCritBonus || 0;
      let critResult = baseCritResult;
      if (!baseCritResult.isCritical && raceCritBonusChance > 0 && Math.random() < raceCritBonusChance) {
        const rankMult = RANK_CRIT_MULTIPLIER[attacker.rank || "Novice"] || 2.0;
        critResult = { isCritical: true, multiplier: rankMult };
      }
      isCritical = critResult.isCritical;
      if (isCritical) effects.push(`Critical hit! (${critResult.multiplier.toFixed(1)}x)`);

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

      let rawDamage = baseDamage * critResult.multiplier * elementalMultiplier + resonanceBonusDamage;

      const attackerBonusDmgPct = attacker.raceBonusDamagePct || 0;
      if (attackerBonusDmgPct > 0) {
        const bonusDmg = Math.floor(rawDamage * attackerBonusDmgPct);
        rawDamage += bonusDmg;
        effects.push(`Racial power! +${bonusDmg} bonus damage`);
      }

      if (defenderAction?.type === "dodge") {
        const attackerSpd = safeNumber(attackerStats.Spd, 10);
        const defenderSpd = safeNumber(defenderStats.Spd, 10);
        const dodgeBonus = defender.raceDodgeBonus || 0;

        if (defenderSpd > attackerSpd || (dodgeBonus > 0 && Math.random() < dodgeBonus)) {
          isEvaded = true;
          effects.push(`${defender.name} fully evaded the attack!`);
          damage = 0;
        } else {
          const dodgePartialReduction = Math.max(0, defenderSpd - attackerSpd * 0.5) / (attackerSpd * 0.5);
          const partialMitigationPct = Math.min(dodgePartialReduction * 0.25, 0.25);
          const effectiveDef = safeNumber(defenderStats.Def, 0) * (1 + partialMitigationPct);
          damage = applyDiminishingReturns(effectiveDef, Math.floor(rawDamage));
          if (partialMitigationPct > 0) {
            effects.push(`${defender.name} partially dodged! +${Math.round(partialMitigationPct * 100)}% defense`);
          } else {
            effects.push(`${defender.name} failed to dodge!`);
          }
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

      if (damage > 0) {
        const defDmgReduction = defender.raceDamageReduction || 0;
        if (defDmgReduction > 0) {
          const reduced = Math.floor(damage * defDmgReduction);
          damage -= reduced;
          if (reduced > 0) effects.push(`${defender.name}'s racial toughness reduced ${reduced} damage`);
        }

        const defThornsPct = defender.raceThornsPct || 0;
        if (defThornsPct > 0) {
          const thornsDmg = Math.floor(damage * defThornsPct);
          if (thornsDmg > 0) {
            thornsReflect = thornsDmg;
            effects.push(`${defender.name} reflects ${thornsDmg} damage back!`);
          }
        }

        const defCounterChance = defender.raceCounterChance || 0;
        if (defCounterChance > 0 && Math.random() < defCounterChance) {
          const counterDmg = Math.floor(safeNumber(defenderStats.Str, 10) * 0.3);
          if (counterDmg > 0) {
            thornsReflect = (thornsReflect || 0) + counterDmg;
            effects.push(`${defender.name} counter-attacks for ${counterDmg} damage!`);
          }
        }
      }

      if (damage > 0 && attacker.raceLifeStealPct && attacker.raceLifeStealPct > 0) {
        const raceLifeSteal = Math.floor(damage * attacker.raceLifeStealPct);
        if (raceLifeSteal > 0) {
          healAmount += raceLifeSteal;
          effects.push(`Racial passive: recovered ${raceLifeSteal} HP`);
        }
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

        const critResult = calculateCritical(attackerStats.Luck, attacker.rank);
        isCritical = critResult.isCritical;
        if (isCritical) {
          effects.push(`Critical spell hit! (${critResult.multiplier.toFixed(1)}x)`);
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
        const healPower = safeNumber(spellPower, 1.5);
        const baseHeal = safeNumber(attackerStats.Int, 10) * healPower * rankMult;
        const resonanceBonus = (attacker.elements && attacker.elements.elements.length >= 2)
          ? checkResonance(attacker.elements.elements) : null;
        const resonanceBonusHeal = resonanceBonus?.triggered && resonanceBonus.effect
          ? baseHeal * (resonanceBonus.effect.damageBonus * 0.5)
          : 0;
        const critHeal = calculateCritical(attackerStats.Luck, attacker.rank);
        if (critHeal.isCritical) effects.push(`Critical heal! (${critHeal.multiplier.toFixed(1)}x)`);
        healAmount = Math.floor((baseHeal + resonanceBonusHeal) * (critHeal.isCritical ? critHeal.multiplier : 1));
        effects.push(`${attacker.name} casts ${spell?.name || "a healing spell"}! Restores ${healAmount} HP!`);
        break;
      }

      let baseDamage = safeNumber(attackerStats.Int, 10) * spellPower * rankMult;

      const critResult = calculateCritical(attackerStats.Luck, attacker.rank);
      isCritical = critResult.isCritical;
      if (isCritical) effects.push(`Critical spell hit! (${critResult.multiplier.toFixed(1)}x)`);

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
        let aoeBonusDamage = 0;
        for (let i = 1; i < spell.targetCount; i++) {
          aoeBonusDamage += calculateAoEFalloff(primaryDamage, i);
        }
        // Apply AoE bonus damage to the single defender (simulates splash)
        damage = primaryDamage + Math.floor(aoeBonusDamage * 0.5);
        effects.push(`AoE spell hits ${spell.targetCount} targets! Splash bonus: +${Math.floor(aoeBonusDamage * 0.5).toLocaleString()}`);

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
      const trickLuckBonus = attackerStats.Luck / 100;
      const successChance = Math.min(0.5 + trickLuckBonus, 0.85);

      if (Math.random() < successChance) {
        const trickBaseDamage = safeNumber(attackerStats.Str, 10) * 0.5 + safeNumber(attackerStats.Int, 10) * 0.3;
        damage = Math.floor(trickBaseDamage * 1.5);
        effects.push("Trick succeeded!");

        const roll = Math.random();
        if (roll < 0.35 && ccTracker) {
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
        } else if (roll < 0.65 && buffTracker) {
          const defDebuff = Math.floor(safeNumber(defenderStats.Def, 10) * 0.15);
          const debuffResult = applyBuff(
            buffTracker, defender.id, "Def",
            -defDebuff, safeNumber(attackerStats.Int, 10),
            attacker.id, "Trick Debuff", safeNumber(defenderStats.Def, 10), 2, attacker.rank
          );
          if (debuffResult.applied) {
            effects.push(`${defender.name}'s defense reduced by ${defDebuff} for 2 turns!`);
          } else {
            effects.push(...debuffResult.effects);
          }
        } else if (roll < 0.85 && buffTracker) {
          const spdDebuff = Math.floor(safeNumber(defenderStats.Spd, 10) * 0.20);
          const spdDebuffResult = applyBuff(
            buffTracker, defender.id, "Spd",
            -spdDebuff, safeNumber(attackerStats.Int, 10),
            attacker.id, "Trick Debuff", safeNumber(defenderStats.Spd, 10), 2, attacker.rank
          );
          if (spdDebuffResult.applied) {
            effects.push(`${defender.name}'s speed reduced by ${spdDebuff} for 2 turns!`);
          } else {
            effects.push(...spdDebuffResult.effects);
          }
        } else {
          if (buffTracker) {
            const dodgeBuff = Math.floor(safeNumber(attackerStats.Spd, 10) * 0.25);
            const buffResult = applyBuff(
              buffTracker, attacker.id, "Spd",
              dodgeBuff, safeNumber(attackerStats.Int, 10),
              attacker.id, "Evasion Trick", safeNumber(attackerStats.Spd, 10), 2, attacker.rank
            );
            effects.push(...buffResult.effects);
          } else {
            effects.push("Trick grants evasion boost next turn!");
          }
        }
      } else {
        const trickBaseDamage = safeNumber(attackerStats.Str, 10) * 0.5 + safeNumber(attackerStats.Int, 10) * 0.3;
        damage = Math.floor(trickBaseDamage * 0.3);
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

  if (resonance?.triggered && resonance.statusApplied && resonance.effect?.statusEffect) {
    const statusType = resonance.effect.statusEffect as string;
    const ccType = mapResonanceStatusToCC(statusType);
    const DOT_STATUS_TYPES: DoTType[] = ["burn", "bleed", "poison", "drain", "amplify", "root", "blind"];

    if (ccType && ccTracker) {
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
    } else if (DOT_STATUS_TYPES.includes(statusType as DoTType) && dotTracker) {
      const dotType = statusType as DoTType;
      const dotDamage = Math.floor(safeNumber(attackerStats.Int, 10) * 0.15 + safeNumber(attackerStats.Str, 10) * 0.08);
      const dotTurns = resonance.effect.statusDuration || 2;
      const dotResult = applyDoT(dotTracker, defender.id, dotType, dotDamage, dotTurns, attacker.id);
      effects.push(...dotResult.effects);
      if (dotResult.applied) {
        dotEffectsApplied.push({ type: dotType, damagePerTurn: dotDamage, turns: dotTurns, target: defender.id });
      }
    }
  }

  if (damage > 0 && action.type === "attack" && attackerWeaponSpecial) {
    const weaponFx = parseWeaponSpecial(attackerWeaponSpecial);
    if (weaponFx) {
      weaponSpecialTriggered = weaponFx.label;

      if (weaponFx.lifeStealPct && weaponFx.lifeStealPct > 0) {
        const stolen = Math.floor(damage * weaponFx.lifeStealPct);
        healAmount = (healAmount || 0) + stolen;
        effects.push(`Life Steal! Recovered ${stolen} HP.`);
      }
      if (weaponFx.stunChance && Math.random() < weaponFx.stunChance && ccTracker) {
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
      }
      if (weaponFx.critBonus) {
        if (Math.random() < weaponFx.critBonus) {
          const bonusDmg = Math.floor(damage * 0.5);
          damage += bonusDmg;
          effects.push(`Weapon Critical Bonus! +${bonusDmg} extra damage.`);
        }
      }
      if (weaponFx.burnTurns && dotTracker) {
        const burnDmg = Math.floor(safeNumber(attackerStats.Str, 10) * 0.12);
        const dotResult = applyDoT(dotTracker, defender.id, "burn", burnDmg, weaponFx.burnTurns, attacker.id);
        effects.push(...dotResult.effects);
        if (dotResult.applied) {
          dotEffectsApplied.push({ type: "burn", damagePerTurn: burnDmg, turns: weaponFx.burnTurns, target: defender.id });
        }
      }
      if (weaponFx.freezeTurns && ccTracker) {
        const ccResult = applyCC(
          ccTracker, defender.id, "freeze", weaponFx.freezeTurns, attacker.id,
          safeNumber(attackerStats.Int, 10),
          safeNumber(defenderStats.Int, 10),
          safeNumber(defenderStats.Luck, 10)
        );
        effects.push(...ccResult.effects);
        if (ccResult.applied) {
          statusEffectsApplied.push({ type: "freeze", duration: ccResult.duration, target: defender.id });
        }
      }
      if (weaponFx.silenceTurns && ccTracker) {
        const ccResult = applyCC(
          ccTracker, defender.id, "silence", weaponFx.silenceTurns, attacker.id,
          safeNumber(attackerStats.Int, 10),
          safeNumber(defenderStats.Int, 10),
          safeNumber(defenderStats.Luck, 10)
        );
        effects.push(...ccResult.effects);
        if (ccResult.applied) {
          statusEffectsApplied.push({ type: "silence", duration: ccResult.duration, target: defender.id });
        }
      }
      if (weaponFx.poisonTurns && dotTracker) {
        const poisonDmg = Math.floor(safeNumber(attackerStats.Str, 10) * 0.10);
        const dotResult = applyDoT(dotTracker, defender.id, "poison", poisonDmg, weaponFx.poisonTurns, attacker.id);
        effects.push(...dotResult.effects);
        if (dotResult.applied) {
          dotEffectsApplied.push({ type: "poison", damagePerTurn: poisonDmg, turns: weaponFx.poisonTurns, target: defender.id });
        }
      }
      if (weaponFx.bleedTurns && dotTracker) {
        const bleedDmg = Math.floor(safeNumber(attackerStats.Str, 10) * 0.10);
        const dotResult = applyDoT(dotTracker, defender.id, "bleed", bleedDmg, weaponFx.bleedTurns, attacker.id);
        effects.push(...dotResult.effects);
        if (dotResult.applied) {
          dotEffectsApplied.push({ type: "bleed", damagePerTurn: bleedDmg, turns: weaponFx.bleedTurns, target: defender.id });
        }
      }
      if (weaponFx.doubleStrike) {
        const bonusDmg = Math.floor(damage * 0.75);
        damage += bonusDmg;
        effects.push(`Double Strike! +${bonusDmg} additional damage!`);
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
    healAmount: healAmount > 0 ? healAmount : undefined,
    isCritical,
    isEvaded,
    isBlocked,
    elementalMultiplier,
    effects,
    resonance,
    statusEffectsApplied: statusEffectsApplied.length > 0 ? statusEffectsApplied : undefined,
    buffsApplied: buffsApplied.length > 0 ? buffsApplied : undefined,
    dotEffectsApplied: dotEffectsApplied.length > 0 ? dotEffectsApplied : undefined,
    weaponSpecialTriggered,
    thornsReflect,
  };
}

export async function runAutoCombat(
  player: Combatant,
  npc: Combatant,
  maxRounds: number = 20,
  playerWeaponSpecial?: string | null,
  npcWeaponSpecial?: string | null
): Promise<CombatResult> {
  if (player.isPlayer) {
    await db.update(accounts).set({ lastCombatTime: new Date() }).where(eq(accounts.id, player.id)).execute();
  }
  if (npc.isPlayer) {
    await db.update(accounts).set({ lastCombatTime: new Date() }).where(eq(accounts.id, npc.id)).execute();
  }

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
  const dotTracker = createDoTTracker();
  const rounds: CombatRound[] = [];
  let turn = 1;

  const weaponSpecialMap: Record<string, string | null | undefined> = {
    [player.id]: playerWeaponSpecial,
    [npc.id]: npcWeaponSpecial,
  };

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

      const dotResult1 = tickDoTs(dotTracker, first.id, getBuffedStats(buffTracker, first.id, first.stats));
      if (dotResult1.totalDamage > 0) {
        combatState[first.id] -= dotResult1.totalDamage;
        totalDamage[second.id] += dotResult1.totalDamage;
        skipRound.effects.push(...dotResult1.effects);
        skipRound.effects.push(`DoT damage: -${dotResult1.totalDamage} HP`);
      }
      if (Object.keys(dotResult1.statPenalties).length > 0) {
        applyDoTStatPenalties(buffTracker, first.id, dotResult1.statPenalties, second.id);
      }

      rounds.push(skipRound);
      tickStatusEffects(ccTracker, first.id);
      const buffExpiry1Skip = tickBuffs(buffTracker, first.id);
      if (buffExpiry1Skip.length > 0) skipRound.effects.push(...buffExpiry1Skip);
    } else {
      let firstAction: CombatAction = selectAIAction(first, combatState[first.id], first, ccTracker);
      if (firstSilenced && firstAction.type === "spell") {
        firstAction = { type: "attack" };
      }
      const secondAction: CombatAction = selectAIAction(second, combatState[second.id], second, ccTracker);

      const round1 = processAction(
        first, second, firstAction, secondAction,
        ccTracker, buffTracker, dotTracker, weaponSpecialMap[first.id]
      );
      round1.turn = turn;

      const freezeMultiplier = getFreezeDamageMultiplier(ccTracker, second.id);
      if (freezeMultiplier > 1 && round1.damage > 0) {
        round1.damage = Math.floor(round1.damage * freezeMultiplier);
        round1.effects.push(`Frozen target takes ${Math.round((freezeMultiplier - 1) * 100)}% more damage!`);
      }

      rounds.push(round1);

      combatState[second.id] -= round1.damage;
      totalDamage[first.id] += round1.damage;

      if (round1.thornsReflect && round1.thornsReflect > 0) {
        combatState[first.id] -= round1.thornsReflect;
        totalDamage[second.id] += round1.thornsReflect;
      }

      if (round1.healAmount && round1.healAmount > 0) {
        const maxHP1 = calculateMaxHP(first.stats, first.level, first.race, first.rank);
        combatState[first.id] = Math.min(maxHP1, combatState[first.id] + round1.healAmount);
      }

      const dotResult1 = tickDoTs(dotTracker, first.id, getBuffedStats(buffTracker, first.id, first.stats));
      if (dotResult1.totalDamage > 0) {
        combatState[first.id] -= dotResult1.totalDamage;
        totalDamage[second.id] += dotResult1.totalDamage;
        round1.effects.push(...dotResult1.effects);
      }
      if (Object.keys(dotResult1.statPenalties).length > 0) {
        applyDoTStatPenalties(buffTracker, first.id, dotResult1.statPenalties, second.id);
      }

      tickStatusEffects(ccTracker, first.id);
      const buffExpiry1 = tickBuffs(buffTracker, first.id);
      if (buffExpiry1.length > 0) round1.effects.push(...buffExpiry1);
    }

    if (combatState[player.id] <= 0 || combatState[npc.id] <= 0) break;

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

      const dotResult2 = tickDoTs(dotTracker, second.id, getBuffedStats(buffTracker, second.id, second.stats));
      if (dotResult2.totalDamage > 0) {
        combatState[second.id] -= dotResult2.totalDamage;
        totalDamage[first.id] += dotResult2.totalDamage;
        skipRound.effects.push(...dotResult2.effects);
        skipRound.effects.push(`DoT damage: -${dotResult2.totalDamage} HP`);
      }
      if (Object.keys(dotResult2.statPenalties).length > 0) {
        applyDoTStatPenalties(buffTracker, second.id, dotResult2.statPenalties, first.id);
      }

      rounds.push(skipRound);
      tickStatusEffects(ccTracker, second.id);
      const buffExpiry2Skip = tickBuffs(buffTracker, second.id);
      if (buffExpiry2Skip.length > 0) skipRound.effects.push(...buffExpiry2Skip);
    } else {
      let secondAction: CombatAction = selectAIAction(second, combatState[second.id], second, ccTracker);
      if (secondSilenced && secondAction.type === "spell") {
        secondAction = { type: "attack" };
      }
      const firstAction: CombatAction = selectAIAction(first, combatState[first.id], first, ccTracker);

      const round2 = processAction(
        second, first, secondAction, firstAction,
        ccTracker, buffTracker, dotTracker, weaponSpecialMap[second.id]
      );
      round2.turn = turn;

      const freezeMultiplier = getFreezeDamageMultiplier(ccTracker, first.id);
      if (freezeMultiplier > 1 && round2.damage > 0) {
        round2.damage = Math.floor(round2.damage * freezeMultiplier);
        round2.effects.push(`Frozen target takes ${Math.round((freezeMultiplier - 1) * 100)}% more damage!`);
      }

      rounds.push(round2);

      combatState[first.id] -= round2.damage;
      totalDamage[second.id] += round2.damage;

      if (round2.thornsReflect && round2.thornsReflect > 0) {
        combatState[second.id] -= round2.thornsReflect;
        totalDamage[first.id] += round2.thornsReflect;
      }

      if (round2.healAmount && round2.healAmount > 0) {
        const maxHP2 = calculateMaxHP(second.stats, second.level, second.race, second.rank);
        combatState[second.id] = Math.min(maxHP2, combatState[second.id] + round2.healAmount);
      }

      const dotResult2 = tickDoTs(dotTracker, second.id, getBuffedStats(buffTracker, second.id, second.stats));
      if (dotResult2.totalDamage > 0) {
        combatState[second.id] -= dotResult2.totalDamage;
        totalDamage[first.id] += dotResult2.totalDamage;
        round2.effects.push(...dotResult2.effects);
      }
      if (Object.keys(dotResult2.statPenalties).length > 0) {
        applyDoTStatPenalties(buffTracker, second.id, dotResult2.statPenalties, first.id);
      }

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
    finalHP: {
      [player.id]: Math.max(0, combatState[player.id]),
      [npc.id]: Math.max(0, combatState[npc.id]),
    },
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

export function applyRacePassiveSkill(
  baseStats: CombatStats,
  passiveSkillId: string | null | undefined
): CombatStats {
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
          result[statKey] = base + value;
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

// ================================================================
// PVP COMBAT EXPANSION — Tiered Crits, Combos, Elemental Reactions,
// Status Effect Stacking, and Unique Race Active Abilities
// ================================================================

// ─── Race → Primary Element mapping ─────────────────────────────
export const RACE_ELEMENT: Record<string, string> = {
  human:     "Light",
  elf:       "Nature",
  dwarf:     "Earth",
  orc:       "Fire",
  beastfolk: "Air",
  mystic:    "Nature",
  fae:       "Light",
  elemental: "Lightning",
  undead:    "Dark",
  demon:     "Dark",
  draconic:  "Fire",
  celestial: "Light",
  aquatic:   "Water",
  titan:     "Earth",
};

// ─── Tiered Critical Hit System ──────────────────────────────────
// Normal crit  (1.5×): up to 50% chance  (Luck/100 + race bonus)
// Heavy crit   (2.0×): up to 30% chance  (Luck/200 + race bonus×0.7)
// Perfect crit (2.5×): up to 15% chance  (Luck/500 + race bonus×0.4)

export interface TieredCritResult {
  tier: 0 | 1 | 2 | 3;
  mult: number;
  label: string;
}

export function rollTieredCrit(luck: number, raceCritBonus: number = 0): TieredCritResult {
  const normalChance  = Math.min(luck / 100 + raceCritBonus,        0.50);
  const heavyChance   = Math.min(luck / 200 + raceCritBonus * 0.70, 0.30);
  const perfectChance = Math.min(luck / 500 + raceCritBonus * 0.40, 0.15);

  const roll = Math.random();
  if (roll < perfectChance) return { tier: 3, mult: 2.5, label: "✨ PERFECT CRIT" };
  if (roll < heavyChance)   return { tier: 2, mult: 2.0, label: "💥 HEAVY CRIT"   };
  if (roll < normalChance)  return { tier: 1, mult: 1.5, label: "⚡ CRIT"          };
  return { tier: 0, mult: 1.0, label: "" };
}

// ─── Combo Chain System ──────────────────────────────────────────
// Each consecutive "attack" that lands adds +1 combo (max 5).
// Non-attack/non-ability actions reset the combo.
// Bonus: +12% damage per combo stack.

export function getComboMultiplier(comboCount: number): number {
  return 1.0 + Math.min(5, comboCount) * 0.12;
}

// ─── PvP Status Effects ──────────────────────────────────────────
// Stored directly in combatState.player1/player2.statusEffects
// (not in the Map-based trackers used by auto-combat)

export interface PvPStatusEffect {
  type: string;
  magnitude: number;   // multiplier or stack count
  duration: number;    // rounds remaining
  source: string;
}

interface StackRule { max: number }
const PVP_STACK_RULES: Record<string, StackRule> = {
  burn:     { max: 3 },
  poison:   { max: 5 },
  bleed:    { max: 3 },
  stun:     { max: 1 },
  slow:     { max: 1 },
  blind:    { max: 1 },
  empower:  { max: 1 },
  shield:   { max: 1 },
  regen:    { max: 1 },
  weakness: { max: 1 },
};

export function applyPvPStatusEffect(
  effects: PvPStatusEffect[],
  newEffect: PvPStatusEffect,
): PvPStatusEffect[] {
  const rule = PVP_STACK_RULES[newEffect.type];
  if (!rule) return effects;

  const existing = effects.filter(e => e.type === newEffect.type);
  if (existing.length >= rule.max) {
    // Refresh the first matching instance
    return effects.map((e, i) => {
      if (e.type === newEffect.type && effects.indexOf(e) === effects.findIndex(x => x.type === newEffect.type)) {
        return { ...e, duration: Math.max(e.duration, newEffect.duration), magnitude: Math.max(e.magnitude, newEffect.magnitude) };
      }
      return e;
    });
  }
  return [...effects, { ...newEffect }];
}

export interface PvPStatusTickResult {
  dotDamage: number;
  healAmount: number;
  isStunned: boolean;
  updatedEffects: PvPStatusEffect[];
  log: string[];
}

export function tickPvPStatusEffects(
  playerName: string,
  maxHp: number,
  effects: PvPStatusEffect[],
): PvPStatusTickResult {
  let dotDamage = 0;
  let healAmount = 0;
  let isStunned = false;
  const log: string[] = [];

  const surviving: PvPStatusEffect[] = [];

  for (const fx of effects) {
    switch (fx.type) {
      case "burn": {
        const dmg = Math.floor(maxHp * 0.05 * fx.magnitude);
        dotDamage += dmg;
        log.push(`🔥 ${playerName} burns for ${dmg}`);
        break;
      }
      case "poison": {
        const dmg = Math.floor(maxHp * 0.03 * fx.magnitude);
        dotDamage += dmg;
        log.push(`☠️ ${playerName} poisoned for ${dmg}`);
        break;
      }
      case "bleed": {
        const dmg = Math.floor(maxHp * 0.04 * fx.magnitude);
        dotDamage += dmg;
        log.push(`🩸 ${playerName} bleeds for ${dmg}`);
        break;
      }
      case "stun":
        isStunned = true;
        log.push(`💫 ${playerName} is stunned!`);
        break;
      case "regen": {
        const heal = Math.floor(maxHp * 0.08);
        healAmount += heal;
        log.push(`💚 ${playerName} regenerates ${heal} HP`);
        break;
      }
    }

    const remaining = fx.duration - 1;
    if (remaining > 0) {
      surviving.push({ ...fx, duration: remaining });
    } else {
      log.push(`${fx.type.charAt(0).toUpperCase() + fx.type.slice(1)} on ${playerName} faded`);
    }
  }

  return { dotDamage, healAmount, isStunned, updatedEffects: surviving, log };
}

// ─── Elemental Reaction Table ────────────────────────────────────

export interface PvPReaction {
  name: string;
  description: string;
  bonusDamagePct: number;       // fraction of base hit added
  instantCurrentHpPct: number;  // fraction of defender's current HP
  selfHealPct: number;          // fraction of attacker's maxHP healed
  defenderEffects: Omit<PvPStatusEffect, "source">[];
  attackerEffects: Omit<PvPStatusEffect, "source">[];
}

const PVP_REACTIONS: Record<string, PvPReaction> = {
  "Fire+Water": {
    name: "Steam Burst", description: "Scalding steam blinds the target",
    bonusDamagePct: 0.10, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "blind",  magnitude: 1, duration: 2 }], attackerEffects: [],
  },
  "Water+Fire": {
    name: "Steam Burst", description: "Scalding steam blinds the target",
    bonusDamagePct: 0.10, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "blind",  magnitude: 1, duration: 2 }], attackerEffects: [],
  },
  "Fire+Lightning": {
    name: "Overload", description: "Explosive electrical surge — double bonus damage",
    bonusDamagePct: 1.00, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [],
  },
  "Lightning+Fire": {
    name: "Overload", description: "Explosive electrical surge — double bonus damage",
    bonusDamagePct: 1.00, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [],
  },
  "Fire+Earth": {
    name: "Magma Seal", description: "Molten rock burns and slows",
    bonusDamagePct: 0.20, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "burn", magnitude: 2, duration: 2 }, { type: "slow", magnitude: 1, duration: 2 }],
    attackerEffects: [],
  },
  "Earth+Fire": {
    name: "Magma Seal", description: "Molten rock burns and slows",
    bonusDamagePct: 0.20, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "burn", magnitude: 2, duration: 2 }, { type: "slow", magnitude: 1, duration: 2 }],
    attackerEffects: [],
  },
  "Water+Lightning": {
    name: "Electrocution", description: "Conducted electricity stuns",
    bonusDamagePct: 0.30, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "stun", magnitude: 1, duration: 1 }], attackerEffects: [],
  },
  "Lightning+Water": {
    name: "Electrocution", description: "Conducted electricity stuns",
    bonusDamagePct: 0.30, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "stun", magnitude: 1, duration: 1 }], attackerEffects: [],
  },
  "Water+Earth": {
    name: "Mud Trap", description: "Slick mud slows for 3 rounds",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "slow", magnitude: 1, duration: 3 }], attackerEffects: [],
  },
  "Earth+Water": {
    name: "Mud Trap", description: "Slick mud slows for 3 rounds",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "slow", magnitude: 1, duration: 3 }], attackerEffects: [],
  },
  "Dark+Light": {
    name: "Void Collapse", description: "Reality tears — 15% of current HP bonus damage",
    bonusDamagePct: 0, instantCurrentHpPct: 0.15, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [],
  },
  "Light+Dark": {
    name: "Void Collapse", description: "Reality tears — 15% of current HP bonus damage",
    bonusDamagePct: 0, instantCurrentHpPct: 0.15, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [],
  },
  "Dark+Fire": {
    name: "Hellfire", description: "Cursed flames — 3-stack burn for 3 rounds",
    bonusDamagePct: 0.20, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "burn", magnitude: 3, duration: 3 }], attackerEffects: [],
  },
  "Fire+Dark": {
    name: "Hellfire", description: "Cursed flames — 3-stack burn for 3 rounds",
    bonusDamagePct: 0.20, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "burn", magnitude: 3, duration: 3 }], attackerEffects: [],
  },
  "Air+Lightning": {
    name: "Storm Surge", description: "Howling winds empower the attacker for 2 rounds",
    bonusDamagePct: 0.30, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [{ type: "empower", magnitude: 1.4, duration: 2 }],
  },
  "Lightning+Air": {
    name: "Storm Surge", description: "Howling winds empower the attacker for 2 rounds",
    bonusDamagePct: 0.30, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [], attackerEffects: [{ type: "empower", magnitude: 1.4, duration: 2 }],
  },
  "Earth+Light": {
    name: "Sacred Ground", description: "Holy earth heals the attacker for 10% max HP",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0.10,
    defenderEffects: [], attackerEffects: [],
  },
  "Light+Earth": {
    name: "Sacred Ground", description: "Holy earth heals the attacker for 10% max HP",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0.10,
    defenderEffects: [], attackerEffects: [],
  },
  "Nature+Dark": {
    name: "Decay", description: "Life corrupted — 3-stack poison for 3 rounds",
    bonusDamagePct: 0.10, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "poison", magnitude: 3, duration: 3 }], attackerEffects: [],
  },
  "Dark+Nature": {
    name: "Decay", description: "Life corrupted — 3-stack poison for 3 rounds",
    bonusDamagePct: 0.10, instantCurrentHpPct: 0, selfHealPct: 0,
    defenderEffects: [{ type: "poison", magnitude: 3, duration: 3 }], attackerEffects: [],
  },
  "Nature+Water": {
    name: "Overgrowth", description: "Roots ensnare — slow 2 rounds + regen attacker",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0.05,
    defenderEffects: [{ type: "slow", magnitude: 1, duration: 2 }], attackerEffects: [],
  },
  "Water+Nature": {
    name: "Overgrowth", description: "Roots ensnare — slow 2 rounds + regen attacker",
    bonusDamagePct: 0, instantCurrentHpPct: 0, selfHealPct: 0.05,
    defenderEffects: [{ type: "slow", magnitude: 1, duration: 2 }], attackerEffects: [],
  },
};

export function checkPvPReaction(
  attackerElement: string | undefined,
  defenderPrimedElement: string | undefined,
): PvPReaction | null {
  if (!attackerElement || !defenderPrimedElement) return null;
  if (attackerElement === defenderPrimedElement) return null;
  return PVP_REACTIONS[`${attackerElement}+${defenderPrimedElement}`] ?? null;
}

// ─── Race Active Abilities ────────────────────────────────────────

export interface PvPAbilityResult {
  damage: number;
  selfHeal: number;
  selfDamage: number;
  defenderEffects: PvPStatusEffect[];
  attackerEffects: PvPStatusEffect[];
  cleanseAttacker: boolean;
  message: string;
  isForcedCrit: boolean;
  cooldown: number;
}

interface PvPAbilityDef {
  name: string;
  description: string;
  cooldown: number;
  execute: (
    attackerName: string,
    defenderName: string,
    defenderMaxHp: number,
    attackerMaxHp: number,
    aStr: number, aDef: number, aSpd: number, aInt: number, aLuck: number,
    dStr: number, dDef: number, dSpd: number, dInt: number, dLuck: number,
  ) => Omit<PvPAbilityResult, "cooldown">;
}

const RACE_PVP_ABILITIES: Record<string, PvPAbilityDef> = {
  human: {
    name: "Adaptability", description: "Read the field — Empower self 2 rounds based on opponent's top stat",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt, aLuck, dStr, dDef, dSpd, dInt) {
      const top = Math.max(dStr, dInt, dSpd);
      const mag = top === dInt ? 1.35 : top === dSpd ? 1.30 : 1.25;
      return {
        damage: 0, selfHeal: 0, selfDamage: 0,
        defenderEffects: [],
        attackerEffects: [{ type: "empower", magnitude: mag, duration: 2, source: "Adaptability" }],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} reads the battlefield and adapts — Empowered for 2 rounds!`,
      };
    },
  },
  elf: {
    name: "Arcane Shot", description: "Guaranteed hit — 1.4× INT damage + blind 2 rounds",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt) {
      const dmg = Math.floor(aInt * 1.4);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "blind", magnitude: 1, duration: 2, source: "Arcane Shot" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} fires an Arcane Shot — ${dmg} magic damage! ${dName} is blinded for 2 rounds!`,
      };
    },
  },
  dwarf: {
    name: "Stone Fortress", description: "Absorb 50% incoming damage for 2 rounds",
    cooldown: 4,
    execute(aName) {
      return {
        damage: 0, selfHeal: 0, selfDamage: 0,
        defenderEffects: [],
        attackerEffects: [{ type: "shield", magnitude: 0.50, duration: 2, source: "Stone Fortress" }],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} raises a Stone Fortress — 50% damage shield for 2 rounds!`,
      };
    },
  },
  orc: {
    name: "Blood Frenzy", description: "2.5× STR damage — sacrifice 15% own max HP",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr) {
      const dmg    = Math.floor(aStr * 2.5);
      const selfDmg = Math.floor(aMaxHp * 0.15);
      return {
        damage: dmg, selfHeal: 0, selfDamage: selfDmg,
        defenderEffects: [],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} enters Blood Frenzy — ${dmg} savage damage! Lost ${selfDmg} HP to the rage!`,
      };
    },
  },
  beastfolk: {
    name: "Savage Lunge", description: "Forced Perfect Crit (2.5×) — 1.8× STR + bleed 3 rounds",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr) {
      const dmg = Math.floor(aStr * 1.8 * 2.5);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "bleed", magnitude: 2, duration: 3, source: "Savage Lunge" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: true,
        message: `${aName} leaps with a Savage Lunge — ${dmg} PERFECT CRIT! ${dName} bleeds for 3 rounds!`,
      };
    },
  },
  mystic: {
    name: "Nature's Wrath", description: "1.5× INT damage + poison 3 stacks + stun 1 round",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt) {
      const dmg = Math.floor(aInt * 1.5);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [
          { type: "poison", magnitude: 3, duration: 3, source: "Nature's Wrath" },
          { type: "stun",   magnitude: 1, duration: 1, source: "Nature's Wrath" },
        ],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} calls Nature's Wrath — ${dmg} nature damage! ${dName} is poisoned and rooted!`,
      };
    },
  },
  fae: {
    name: "Mirror Veil", description: "Blind opponent 2 rounds + Empower self 2 rounds",
    cooldown: 4,
    execute(aName, dName) {
      return {
        damage: 0, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "blind",   magnitude: 2, duration: 2, source: "Mirror Veil" }],
        attackerEffects: [{ type: "empower", magnitude: 1.25, duration: 2, source: "Mirror Veil" }],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} weaves a Mirror Veil — ${dName} blinded, ${aName} empowered for 2 rounds!`,
      };
    },
  },
  elemental: {
    name: "Elemental Surge", description: "2.5× INT damage + 3-stack burn for 3 rounds",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt) {
      const dmg = Math.floor(aInt * 2.5);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "burn", magnitude: 3, duration: 3, source: "Elemental Surge" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} unleashes an Elemental Surge — ${dmg} elemental damage! ${dName} burns for 3 rounds!`,
      };
    },
  },
  undead: {
    name: "Necrotic Drain", description: "1.6× STR + 0.6× INT — heals 80% of damage dealt",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt) {
      const dmg  = Math.floor(aStr * 1.6 + aInt * 0.6);
      const heal = Math.floor(dmg * 0.80);
      return {
        damage: dmg, selfHeal: heal, selfDamage: 0,
        defenderEffects: [],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} drains life with Necrotic Drain — ${dmg} damage, healed ${heal} HP!`,
      };
    },
  },
  demon: {
    name: "Hellgate", description: "3× STR + 2-stack burn — sacrifice 25% own max HP",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr) {
      const dmg    = Math.floor(aStr * 3.0);
      const selfDmg = Math.floor(aMaxHp * 0.25);
      return {
        damage: dmg, selfHeal: 0, selfDamage: selfDmg,
        defenderEffects: [{ type: "burn", magnitude: 2, duration: 2, source: "Hellgate" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} opens a Hellgate — ${dmg} infernal damage! ${dName} burns! (${selfDmg} self-sacrifice)`,
      };
    },
  },
  draconic: {
    name: "Dragon's Roar", description: "20% opponent max HP fire damage + 2-stack burn",
    cooldown: 4,
    execute(aName, dName, dMaxHp, aMaxHp, aStr) {
      const dmg = Math.floor(dMaxHp * 0.20 + aStr * 0.5);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "burn", magnitude: 2, duration: 2, source: "Dragon's Roar" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} breathes Dragon Fire — ${dmg} true fire damage! ${dName} is burning!`,
      };
    },
  },
  celestial: {
    name: "Divine Grace", description: "Heal self 30% max HP + blind opponent 2 rounds + Empower self",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp) {
      const heal = Math.floor(aMaxHp * 0.30);
      return {
        damage: 0, selfHeal: heal, selfDamage: 0,
        defenderEffects: [{ type: "blind",   magnitude: 1, duration: 2, source: "Divine Grace" }],
        attackerEffects: [{ type: "empower", magnitude: 1.20, duration: 2, source: "Divine Grace" }],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} invokes Divine Grace — +${heal} HP, ${dName} blinded, self Empowered!`,
      };
    },
  },
  aquatic: {
    name: "Tidal Surge", description: "1.6× SPD + 0.5× INT water damage — slow + cleanse self",
    cooldown: 3,
    execute(aName, dName, dMaxHp, aMaxHp, aStr, aDef, aSpd, aInt) {
      const dmg = Math.floor(aSpd * 1.6 + aInt * 0.5);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "slow", magnitude: 1, duration: 2, source: "Tidal Surge" }],
        attackerEffects: [],
        cleanseAttacker: true, isForcedCrit: false,
        message: `${aName} unleashes a Tidal Surge — ${dmg} water damage, ${dName} slowed, ${aName} cleansed!`,
      };
    },
  },
  titan: {
    name: "Earthshatter", description: "3× STR damage + guaranteed stun 1 round — 5-round cooldown",
    cooldown: 5,
    execute(aName, dName, dMaxHp, aMaxHp, aStr) {
      const dmg = Math.floor(aStr * 3.0);
      return {
        damage: dmg, selfHeal: 0, selfDamage: 0,
        defenderEffects: [{ type: "stun", magnitude: 1, duration: 1, source: "Earthshatter" }],
        attackerEffects: [],
        cleanseAttacker: false, isForcedCrit: false,
        message: `${aName} strikes with Earthshatter — ${dmg} crushing damage! ${dName} is stunned!`,
      };
    },
  },
};

export function executePvPRaceAbility(
  race: string,
  attackerName: string,
  defenderName: string,
  defenderMaxHp: number,
  attackerMaxHp: number,
  aStats: { Str: number; Def: number; Spd: number; Int: number; Luck: number },
  dStats: { Str: number; Def: number; Spd: number; Int: number; Luck: number },
): PvPAbilityResult {
  const def = RACE_PVP_ABILITIES[race];
  if (!def) {
    const dmg = Math.floor(aStats.Str * 1.2);
    return {
      damage: dmg, selfHeal: 0, selfDamage: 0,
      defenderEffects: [], attackerEffects: [],
      cleanseAttacker: false, isForcedCrit: false,
      message: `${attackerName} uses a powerful strike for ${dmg}!`,
      cooldown: 3,
    };
  }
  const res = def.execute(
    attackerName, defenderName, defenderMaxHp, attackerMaxHp,
    aStats.Str, aStats.Def, aStats.Spd, aStats.Int, aStats.Luck,
    dStats.Str, dStats.Def, dStats.Spd, dStats.Int, dStats.Luck,
  );
  return { ...res, cooldown: def.cooldown };
}

export function getPvPAbilityInfo(race: string): { name: string; description: string; cooldown: number } {
  const def = RACE_PVP_ABILITIES[race];
  if (!def) return { name: "Special Strike", description: "A powerful racial ability", cooldown: 3 };
  return { name: def.name, description: def.description, cooldown: def.cooldown };
}

// ─── PvP Damage Formula ───────────────────────────────────────────
//
//  baseDamage        = Str  (attack) or  Int  (trick)
//  critMult          = rollTieredCrit → 1.0 | 1.5 | 2.0 | 2.5
//  comboMult         = 1.0 + min(5, comboCount) × 0.12
//  empowerMult       = empower.magnitude if active, else 1.0
//  raceBonusMult     = 1.0 + raceBonusDamagePct
//  rawDmg            = baseDamage × critMult × comboMult × empowerMult × raceBonusMult
//  defense           = Def × 0.40 × (1 - raceDamageReduction)
//  shieldAbsorb      = shield.magnitude if active on defender, else 0
//  hitDamage         = max(1, floor((rawDmg - defense) × (1 - shieldAbsorb)))
//  reactionBonus     = hitDamage × reaction.bonusDamagePct
//                    + defender.hp × reaction.instantCurrentHpPct
//  finalDamage       = hitDamage + reactionBonus
//  lifeSteal         = finalDamage × raceLifeStealPct
//  reactSelfHeal     = attacker.maxHp × reaction.selfHealPct

export interface PvPDamageResult {
  finalDamage: number;
  crit: TieredCritResult;
  comboMultiplier: number;
  lifeSteal: number;
  reaction: PvPReaction | null;
  reactionBonusDamage: number;
  reactSelfHeal: number;
  missed: boolean;
  logParts: string[];
}

export function calculatePvPDamage(
  attackerName: string,
  attackerElement: string | undefined,
  attackerEffects: PvPStatusEffect[],
  attackerComboCount: number,
  attackerMaxHp: number,
  defenderName: string,
  defenderElement: string | undefined,     // primed element on defender (for reaction)
  defenderCurrentHp: number,
  defenderMaxHp: number,
  defenderEffects: PvPStatusEffect[],
  aStats: { Str: number; Def: number; Spd: number; Int: number; Luck: number },
  dStats: { Str: number; Def: number; Spd: number; Int: number; Luck: number },
  action: string,
  raceCritBonus: number,
  raceLifeStealPct: number,
  raceDamageReduction: number,
  raceBonusDamagePct: number,
): PvPDamageResult {
  const logParts: string[] = [];

  // Blind check — 40% miss chance on attack/trick
  const isBlinded = attackerEffects.some(e => e.type === "blind");
  if (isBlinded && (action === "attack" || action === "trick") && Math.random() < 0.40) {
    return {
      finalDamage: 0, crit: { tier: 0, mult: 1.0, label: "" },
      comboMultiplier: 1, lifeSteal: 0,
      reaction: null, reactionBonusDamage: 0, reactSelfHeal: 0,
      missed: true,
      logParts: [`${attackerName} is blinded and misses!`],
    };
  }

  // Base damage
  const baseDamage = action === "trick" ? aStats.Int * 1.0 : aStats.Str * 1.0;

  // Tiered crit
  const crit = rollTieredCrit(aStats.Luck, raceCritBonus);
  if (crit.tier > 0) logParts.push(crit.label + "!");

  // Combo multiplier
  const comboMult = getComboMultiplier(attackerComboCount);
  if (attackerComboCount >= 2) logParts.push(`${attackerComboCount}× Combo!`);

  // Empower
  const empowerFx = attackerEffects.find(e => e.type === "empower");
  const empowerMult = empowerFx ? empowerFx.magnitude : 1.0;

  // Race bonus
  const raceBonusMult = 1.0 + (raceBonusDamagePct || 0);

  // Raw damage
  const rawDmg = baseDamage * crit.mult * comboMult * empowerMult * raceBonusMult;

  // Defense
  const shieldFx = defenderEffects.find(e => e.type === "shield");
  const shieldAbsorb = shieldFx ? Math.min(0.75, shieldFx.magnitude) : 0;
  const defReduction = Math.min(0.75, raceDamageReduction || 0);
  const defense = dStats.Def * 0.40 * (1 - defReduction);

  const hitDamage = Math.max(1, Math.floor((rawDmg - defense) * (1 - shieldAbsorb)));

  // Elemental reaction
  let reaction: PvPReaction | null = null;
  let reactionBonusDamage = 0;
  let reactSelfHeal = 0;

  if (attackerElement && defenderElement) {
    reaction = checkPvPReaction(attackerElement, defenderElement);
    if (reaction) {
      reactionBonusDamage = Math.floor(hitDamage * reaction.bonusDamagePct)
        + Math.floor(defenderCurrentHp * reaction.instantCurrentHpPct);
      reactSelfHeal = Math.floor(attackerMaxHp * reaction.selfHealPct);
      logParts.push(`⚗️ ${reaction.name}: ${reaction.description}!`);
    }
  }

  const finalDamage = hitDamage + reactionBonusDamage;
  const lifeSteal = Math.floor(finalDamage * (raceLifeStealPct || 0));

  return {
    finalDamage, crit, comboMultiplier: comboMult,
    lifeSteal, reaction, reactionBonusDamage, reactSelfHeal,
    missed: false, logParts,
  };
}
