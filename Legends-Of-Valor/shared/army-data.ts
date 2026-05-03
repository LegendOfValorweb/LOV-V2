// ─── Army System — Legends of Valor ──────────────────────────────────────────
// Players raise armies from their Barracks (base room, unlocks tier 5+).
// Soldiers fight in raids against other player bases, with a rock-paper-scissors
// counter system. Your hero leads the army — their equipped items/stats buff it.
// Soldiers train over time (no hard cap). Can't train more until current batch done.
// ──────────────────────────────────────────────────────────────────────────────
import { calcArmyHeroBonuses, getMaxTrainingBatch } from "./power-calc";
export { getMaxTrainingBatch };

export type SoldierType = "infantry" | "archer" | "cavalry" | "siege" | "elite_guard";

export type SoldierDef = {
  id: SoldierType;
  name: string;
  icon: string;
  description: string;
  role: string;
  goldCost: number;          // cost to recruit one soldier
  upkeepPerHour: number;     // gold per soldier per hour
  trainingTimeSec: number;   // seconds to train one soldier
  baseAtk: number;           // base ATK stat at level 1
  baseDef: number;           // base DEF stat at level 1
  baseHp: number;            // base HP at level 1
  atkPerLevel: number;       // ATK gain per level
  defPerLevel: number;
  hpPerLevel: number;
  counters: SoldierType[];   // this type deals 1.5× to these
  weakTo: SoldierType[];     // this type takes 1.5× from these
  counterVsDef: boolean;     // true if this type counters base defenses (2×)
  unlockBarracksLevel: number; // barracks level required to recruit
};

// ─── Cost design philosophy ───────────────────────────────────────────────────
// Barracks unlocks at Base Tier 3 (Keep), typically reached at Expert rank.
// At Expert: ~500K–1.2M gold/hr income.
// At Champion (first major army tier): ~10M–25M gold/hr.
//
// Upkeep is the main limiter for army size:
//   Champion income 10M/hr → can sustain ~20,000 infantry (10M ÷ 500g/hr)
//   Sovereign income 100M/hr → can sustain ~200,000 infantry (feels like a real war kingdom)
// ──────────────────────────────────────────────────────────────────────────────
export const SOLDIER_DEFS: SoldierDef[] = [
  {
    id: "infantry",
    name: "Infantry",
    icon: "🗡️",
    description: "Armored front-line fighters. Tough and reliable, they anchor your battle line against cavalry charges.",
    role: "Tank / Anti-Cavalry",
    goldCost: 2000,
    upkeepPerHour: 500,
    trainingTimeSec: 5,
    baseAtk: 18, baseDef: 22, baseHp: 80,
    atkPerLevel: 4, defPerLevel: 5, hpPerLevel: 15,
    counters: ["cavalry"],
    weakTo: ["archer"],
    counterVsDef: false,
    unlockBarracksLevel: 1,
  },
  {
    id: "archer",
    name: "Archers",
    icon: "🏹",
    description: "Ranged attackers who pepper enemies from a safe distance. Devastating against Infantry formations.",
    role: "Ranged / Anti-Infantry",
    goldCost: 3000,
    upkeepPerHour: 750,
    trainingTimeSec: 8,
    baseAtk: 25, baseDef: 12, baseHp: 55,
    atkPerLevel: 6, defPerLevel: 2, hpPerLevel: 8,
    counters: ["infantry"],
    weakTo: ["cavalry"],
    counterVsDef: false,
    unlockBarracksLevel: 1,
  },
  {
    id: "cavalry",
    name: "Cavalry",
    icon: "🐴",
    description: "Swift mounted warriors who smash through archer lines before they can regroup.",
    role: "Fast / Anti-Archer",
    goldCost: 8000,
    upkeepPerHour: 2000,
    trainingTimeSec: 20,
    baseAtk: 30, baseDef: 16, baseHp: 70,
    atkPerLevel: 7, defPerLevel: 3, hpPerLevel: 12,
    counters: ["archer"],
    weakTo: ["infantry"],
    counterVsDef: false,
    unlockBarracksLevel: 2,
  },
  {
    id: "siege",
    name: "Siege Engines",
    icon: "💣",
    description: "Catapults and battering rams. Ineffective in field battles but absolutely devastate base defenses.",
    role: "Structure Destroyer",
    goldCost: 30000,
    upkeepPerHour: 8000,
    trainingTimeSec: 90,
    baseAtk: 12, baseDef: 8, baseHp: 100,
    atkPerLevel: 3, defPerLevel: 2, hpPerLevel: 20,
    counters: [],
    weakTo: ["infantry", "cavalry"],
    counterVsDef: true,
    unlockBarracksLevel: 3,
  },
  {
    id: "elite_guard",
    name: "Elite Guard",
    icon: "⚔️",
    description: "Your personal guard — hand-picked warriors who inherit your hero's racial combat bonuses. No cap, but very expensive.",
    role: "Hero Unit / All-rounder",
    goldCost: 100000,
    upkeepPerHour: 30000,
    trainingTimeSec: 450,
    baseAtk: 45, baseDef: 40, baseHp: 150,
    atkPerLevel: 10, defPerLevel: 9, hpPerLevel: 25,
    counters: [],
    weakTo: [],
    counterVsDef: false,
    unlockBarracksLevel: 5,
  },
];

export function getSoldierDef(id: SoldierType): SoldierDef {
  return SOLDIER_DEFS.find(s => s.id === id)!;
}

// ─── No army cap — soldiers are only limited by gold and barracks level ────────
/** @deprecated — no longer enforced; kept for any legacy references */
export const ARMY_CAP_BY_BARRACKS_LEVEL: Record<number, number> = {
  0: 0, 1: 9999999, 2: 9999999, 3: 9999999, 4: 9999999, 5: 9999999,
};

export function getArmyCap(_barracksLevel: number): number {
  return 9999999;
}

// ─── Training time helpers ────────────────────────────────────────────────────
/**
 * Returns the total training duration (ms) for `count` soldiers of a given type.
 * The barracks level can speed training in the future (e.g., lv3+ = 0.75×).
 */
// Barracks level speed tiers — high levels give significant bonuses to support large armies
export function calcTrainingDurationMs(type: SoldierType, count: number, barracksLevel = 1): number {
  const def = getSoldierDef(type);
  const speedMult =
    barracksLevel >= 5 ? 0.35 :
    barracksLevel >= 4 ? 0.50 :
    barracksLevel >= 3 ? 0.65 :
    barracksLevel >= 2 ? 0.80 : 1.0;
  return Math.floor(def.trainingTimeSec * count * speedMult) * 1000;
}

/** Human-readable countdown, e.g. "2h 14m 30s" */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ─── Effective stats for a soldier at a given level ───────────────────────────
export function getSoldierStats(def: SoldierDef, level: number): { atk: number; def: number; hp: number } {
  const lvl = Math.max(1, Math.min(level, 10));
  return {
    atk: def.baseAtk + def.atkPerLevel * (lvl - 1),
    def: def.baseDef + def.defPerLevel * (lvl - 1),
    hp:  def.baseHp  + def.hpPerLevel  * (lvl - 1),
  };
}

// ─── RPS counter damage multiplier ───────────────────────────────────────────
export function getCounterMultiplier(attacker: SoldierType, defender: SoldierType, vsDefenseBonus: boolean): number {
  const atkDef = getSoldierDef(attacker);
  if (vsDefenseBonus && atkDef.counterVsDef) return 2.5;
  if (atkDef.counters.includes(defender)) return 1.5;
  if (atkDef.weakTo.includes(defender)) return 0.65;
  return 1.0;
}

// ─── Training costs per level ─────────────────────────────────────────────────
export function getTrainingCost(type: SoldierType, currentLevel: number): { gold: number; tp: number } {
  const base = { infantry: 500, archer: 750, cavalry: 1200, siege: 2000, elite_guard: 8000 };
  const mult = currentLevel * currentLevel;
  return {
    gold: base[type] * mult,
    tp: Math.max(5, Math.round((base[type] / 100) * mult)),
  };
}

// ─── Raid resolution ─────────────────────────────────────────────────────────
export type TroopSnapshot = { type: SoldierType; count: number; level: number };
export type RaidEvent = { wave: number; message: string; attackerLoss: number; defenderLoss: number };

export type RaidResult = {
  winner: "attacker" | "defender";
  events: RaidEvent[];
  attackerLosses: Record<SoldierType, number>;
  defenderLosses: Record<SoldierType, number>;
  attackerSurvivors: Record<SoldierType, number>;
  goldLooted: number;
  baseDamageDealt: number; // % of defense structures damaged
};

export function resolveRaid(
  attackerTroops: TroopSnapshot[],
  defenderTroops: TroopSnapshot[],
  attackerStats: { Str: number; Int: number; Luck: number; Def?: number },
  defenderStats: { Str: number; Def: number },
  defenderGold: number,
  defenderBaseDefLevel: number,
  attackerRank?: string,
  defenderRank?: string,
): RaidResult {
  const events: RaidEvent[] = [];
  const atkLosses: Record<string, number> = {};
  const defLosses: Record<string, number> = {};
  const atkCurrent: Record<string, number> = {};
  const defCurrent: Record<string, number> = {};

  for (const t of attackerTroops) atkCurrent[t.type] = t.count;
  for (const t of defenderTroops) defCurrent[t.type] = t.count;
  for (const t of attackerTroops) atkLosses[t.type] = 0;
  for (const t of defenderTroops) defLosses[t.type] = 0;

  // Hero bonuses: derived from hero stats + rank via unified power-calc formulas
  const heroBonus = calcArmyHeroBonuses(
    { Str: attackerStats.Str ?? 10, Def: attackerStats.Def ?? 10, Int: attackerStats.Int ?? 10, Luck: attackerStats.Luck ?? 10 },
    attackerRank,
  );
  const heroAtkBonus  = heroBonus.atkMult  * heroBonus.rankMult;
  const heroLuckBonus = heroBonus.hitMult;
  const heroSiegeMult = heroBonus.siegeMult;

  // Defender hero bonus improves towers
  const defHeroBonus = calcArmyHeroBonuses(
    { Str: defenderStats.Str ?? 10, Def: defenderStats.Def ?? 10, Int: 10, Luck: 10 },
    defenderRank,
  );

  // Defense tower effective troops (based on defenses room level)
  const defTowerTroops = defenderBaseDefLevel * 8;
  const defTowerAtk = (defenderBaseDefLevel * 15 + (defenderStats.Def ?? 10) * 0.5) * defHeroBonus.defMult;

  // 3 combat waves
  const WAVES = 3;
  for (let wave = 1; wave <= WAVES; wave++) {
    let waveMsgParts: string[] = [];
    let waveAtkLoss = 0;
    let waveDefLoss = 0;

    const atkTypes = attackerTroops.map(t => t.type);
    const defTypes = defenderTroops.map(t => t.type);

    for (const atkType of atkTypes) {
      const atkCount = atkCurrent[atkType] ?? 0;
      if (atkCount <= 0) continue;
      const atkSnapshot = attackerTroops.find(t => t.type === atkType)!;
      const atkStats = getSoldierStats(getSoldierDef(atkType), atkSnapshot.level);

      for (const defType of defTypes) {
        const defCount = defCurrent[defType] ?? 0;
        if (defCount <= 0) continue;
        const defSnapshot = defenderTroops.find(t => t.type === defType)!;
        const defStats = getSoldierStats(getSoldierDef(defType), defSnapshot.level);

        const mult = getCounterMultiplier(atkType, defType, false);
        // Siege bonus only applies when the siege unit is attacking structures; in field battles use heroSiegeMult for siege type
        const typeBonus = atkType === "siege" ? heroSiegeMult : 1.0;
        const effAtk = atkStats.atk * mult * heroAtkBonus * heroLuckBonus * typeBonus;
        const damageToDefUnit = Math.max(1, effAtk - defStats.def * 0.5);
        const unitsKilled = Math.min(defCount, Math.floor((atkCount * damageToDefUnit) / (defStats.hp * (wave === 1 ? 1.2 : 1))));

        if (unitsKilled > 0) {
          defCurrent[defType] = Math.max(0, defCount - unitsKilled);
          defLosses[defType] = (defLosses[defType] ?? 0) + unitsKilled;
          waveDefLoss += unitsKilled;
        }

        const counterMult = getCounterMultiplier(defType, atkType, false);
        const defEffAtk = defStats.atk * counterMult;
        const damageToAtkUnit = Math.max(1, defEffAtk - atkStats.def * 0.5);
        const atkUnitsLost = Math.min(atkCount, Math.floor((defCount * damageToAtkUnit) / (atkStats.hp * 1.5)));
        if (atkUnitsLost > 0) {
          atkCurrent[atkType] = Math.max(0, atkCount - atkUnitsLost);
          atkLosses[atkType] = (atkLosses[atkType] ?? 0) + atkUnitsLost;
          waveAtkLoss += atkUnitsLost;
        }
      }
    }

    // Defense towers engage in wave 1+2
    if (wave <= 2 && defTowerTroops > 0) {
      const siegeCount = atkCurrent["siege"] ?? 0;
      const siegeMultiplier = siegeCount > 0 ? 0.35 : 1;
      const towerDmg = defTowerAtk * siegeMultiplier;
      const frontline = (atkCurrent["infantry"] ?? 0) + (atkCurrent["archer"] ?? 0);
      if (frontline > 0) {
        const towerKills = Math.min(frontline, Math.floor(towerDmg / 30));
        if (towerKills > 0) {
          const infKills = Math.min(atkCurrent["infantry"] ?? 0, Math.round(towerKills * 0.6));
          const arcKills = Math.min(atkCurrent["archer"] ?? 0, towerKills - infKills);
          atkCurrent["infantry"] = Math.max(0, (atkCurrent["infantry"] ?? 0) - infKills);
          atkCurrent["archer"] = Math.max(0, (atkCurrent["archer"] ?? 0) - arcKills);
          atkLosses["infantry"] = (atkLosses["infantry"] ?? 0) + infKills;
          atkLosses["archer"] = (atkLosses["archer"] ?? 0) + arcKills;
          waveAtkLoss += infKills + arcKills;
          waveMsgParts.push(`Defense towers struck the frontline (${towerKills} casualties)${siegeCount > 0 ? " — weakened by Siege" : ""}`);
        }
      }
    }

    const totalAtk = Object.values(atkCurrent).reduce((a, b) => a + b, 0);
    const totalDef = Object.values(defCurrent).reduce((a, b) => a + b, 0);
    waveMsgParts.push(`Wave ${wave}: ${waveAtkLoss} attackers fell, ${waveDefLoss} defenders fell. Remaining — Attackers: ${totalAtk} | Defenders: ${totalDef}`);
    events.push({ wave, message: waveMsgParts.join(". "), attackerLoss: waveAtkLoss, defenderLoss: waveDefLoss });

    if (totalAtk === 0 || totalDef === 0) break;
  }

  const atkTotal = Object.values(atkCurrent).reduce((a, b) => a + b, 0);
  const defTotal = Object.values(defCurrent).reduce((a, b) => a + b, 0);

  const attackerWon = atkTotal > 0 && (atkTotal > defTotal || defTotal === 0);

  const lootPct = attackerWon ? 0.25 : 0;
  const goldLooted = Math.round(defenderGold * lootPct);

  const siegeSurvivors = atkCurrent["siege"] ?? 0;
  // Siege base damage boosted by hero Int (siegeMult from calcArmyHeroBonuses)
  const baseDamageDealt = attackerWon ? Math.min(100, Math.floor(siegeSurvivors * 2 * heroSiegeMult)) : 0;

  const survivors: Record<SoldierType, number> = {
    infantry: atkCurrent["infantry"] ?? 0,
    archer: atkCurrent["archer"] ?? 0,
    cavalry: atkCurrent["cavalry"] ?? 0,
    siege: atkCurrent["siege"] ?? 0,
    elite_guard: atkCurrent["elite_guard"] ?? 0,
  };

  return {
    winner: attackerWon ? "attacker" : "defender",
    events,
    attackerLosses: atkLosses as Record<SoldierType, number>,
    defenderLosses: defLosses as Record<SoldierType, number>,
    attackerSurvivors: survivors,
    goldLooted,
    baseDamageDealt,
  };
}

// ─── Upkeep calculation ───────────────────────────────────────────────────────
export function calcUpkeepOwed(
  troops: TroopSnapshot[],
  lastCheckedAt: Date,
): number {
  const hours = Math.min(24, (Date.now() - lastCheckedAt.getTime()) / 3_600_000);
  return troops.reduce((sum, t) => {
    const def = getSoldierDef(t.type);
    return sum + Math.round(def.upkeepPerHour * t.count * hours);
  }, 0);
}

// ─── Desertion when upkeep unpaid ─────────────────────────────────────────────
export function calcDesertion(
  troops: TroopSnapshot[],
  goldShortfall: number,
): Record<SoldierType, number> {
  if (goldShortfall <= 0) return {} as Record<SoldierType, number>;
  const result: Record<string, number> = {};
  const sorted = [...troops].sort((a, b) =>
    getSoldierDef(a.type).goldCost - getSoldierDef(b.type).goldCost
  );
  let remaining = goldShortfall;
  for (const t of sorted) {
    if (remaining <= 0) break;
    const def = getSoldierDef(t.type);
    const desertCount = Math.min(t.count, Math.ceil(remaining / def.goldCost));
    result[t.type] = desertCount;
    remaining -= desertCount * def.goldCost;
  }
  return result as Record<SoldierType, number>;
}
