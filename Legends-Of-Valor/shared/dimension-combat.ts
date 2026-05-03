// ─── Dimension Encounter Combat Runner ──────────────────────────────────────
// Adapts the shadow-echo-combat engine for dimension-specific rule modifiers.
// Each dimension bends the combat rules in meaningful ways.
// ──────────────────────────────────────────────────────────────────────────────

import type { DimensionRule } from "./dimensions-data";
import type { ShadowCombatant, BattleEvent } from "./shadow-echo-combat";

export type EncounterResult = {
  winner: "player" | "enemy";
  rounds: number;
  events: EncounterEvent[];
  playerHpRemaining: number;
  playerMaxHp: number;
  enemyMaxHp: number;
  goldEarned: number;
  shardEarned: number;
  isBoss: boolean;
};

export type EncounterEvent = {
  round: number;
  actor: "player" | "enemy";
  action: string;
  skillName?: string;
  isCrit?: boolean;
  damage?: number;
  healing?: number;
  backfire?: boolean;
  dimensionEffect?: string;
  playerHp: number;
  enemyHp: number;
  message: string;
};

// ─── Main entry: run one dimension encounter ──────────────────────────────────

export function runDimensionEncounter(
  playerCombatant: ShadowCombatant,
  enemy: { name: string; icon: string; hp: number; maxHp: number; stats: Record<string,number>; skills: string[]; lootBonus: number; isBoss: boolean; isMiniBoss: boolean },
  rules: DimensionRule[],
  rankIndex: number,  // 0-14
): EncounterResult {
  const MAX_ROUNDS = 25;
  const MANA_REGEN = 15;

  // Clone player to avoid mutating the original between encounters
  const p: ShadowCombatant = JSON.parse(JSON.stringify(playerCombatant));

  // Apply dimension stat modifiers to player
  if (rules.includes("void_gravity")) {
    p.stats.Spd  = Math.round(p.stats.Spd  * 0.5);
    p.stats.Str  = Math.round(p.stats.Str  * 1.3);
  }

  const e = {
    hp: enemy.hp, maxHp: enemy.maxHp,
    stats: { ...enemy.stats } as any,
    skills: enemy.skills,
    mana: 80, maxMana: 200,
    cooldowns: {} as Record<string, number>,
  };

  // Void gravity also affects enemy
  if (rules.includes("void_gravity")) {
    e.stats.Def = Math.round(e.stats.Def * 1.5);
  }

  const events: EncounterEvent[] = [];
  let roundNum = 0;

  for (roundNum = 1; roundNum <= MAX_ROUNDS; roundNum++) {
    // Tick cooldowns
    for (const k in p.cooldowns) if (p.cooldowns[k] > 0) p.cooldowns[k]--;

    // Tick player status effects
    p.status = p.status.map(s => ({ ...s, duration: s.duration - 1 })).filter(s => s.duration >= 0);
    let burnDot = p.status.filter(s => s.type === "burn" || s.type === "poison").reduce((a, s) => a + s.value, 0);
    let regenVal = p.status.filter(s => s.type === "regen").reduce((a, s) => a + s.value, 0);
    if (burnDot > 0) {
      p.hp = Math.max(0, p.hp - burnDot);
      events.push({ round: roundNum, actor: "player", action: "dot", damage: burnDot, playerHp: p.hp, enemyHp: e.hp, message: `${p.name} takes ${burnDot} from a status effect.` });
    }
    if (regenVal > 0 && !rules.includes("no_heal")) {
      const actual = Math.round(regenVal * (rules.includes("no_heal") ? 0.5 : 1));
      p.hp = Math.min(p.maxHp, p.hp + actual);
    }
    if (p.hp <= 0 || e.hp <= 0) break;

    // Mana regen
    p.mana = Math.min(p.maxMana, p.mana + MANA_REGEN);
    e.mana = Math.min(e.maxMana, e.mana + MANA_REGEN);

    // Time pressure modifier (increases each 3 rounds)
    const timeMultiplier = rules.includes("time_pressure")
      ? 1 + Math.floor((roundNum - 1) / 3) * 0.12
      : 1;

    // ── Player action ──────────────────────────────────────────────────────
    const playerAction = selectPlayerAction(p, rules, roundNum);
    resolvePlayerAction(playerAction, p, e, events, roundNum, rules, timeMultiplier);
    if (e.hp <= 0) break;

    // ── Enemy action ───────────────────────────────────────────────────────
    resolveEnemyAction(enemy, e, p, events, roundNum, rules);
    if (p.hp <= 0) break;

    // Burn on hit rule — apply burn to both after round
    if (rules.includes("burn_on_hit")) {
      const burnVal = Math.max(2, Math.round(rankIndex * 2));
      p.status.push({ type: "burn", value: burnVal, duration: 2 });
      e.hp = Math.max(0, e.hp - burnVal);
      if (e.hp > 0) {
        events.push({ round: roundNum, actor: "player", action: "burn_on_hit", damage: burnVal, dimensionEffect: "Inferno Realm burn", playerHp: p.hp, enemyHp: e.hp, message: `The Inferno Realm ignites both combatants! ${burnVal} burn damage.` });
      }
    }

    if (p.hp <= 0 || e.hp <= 0) break;
  }

  const playerWon = e.hp <= 0 && p.hp > 0;
  const hpPct = e.hp <= 0 ? 1 : (p.hp / p.maxHp > e.hp / e.maxHp ? 1 : 0);
  const winner = p.hp <= 0 ? "enemy" : (e.hp <= 0 ? "player" : (p.hp / p.maxHp >= e.hp / e.maxHp ? "player" : "enemy"));

  // Gold and shard rewards scale with rank + boss status
  const rankMult = rankIndex + 1;
  const bossBonus = enemy.isBoss ? 5 : enemy.isMiniBoss ? 2 : 1;
  const goldEarned = winner === "player"
    ? Math.round(rankMult * 2000 * enemy.lootBonus * bossBonus) : 0;
  const shardEarned = winner === "player"
    ? Math.round(rankMult * 10 * enemy.lootBonus * bossBonus) : 0;

  return {
    winner,
    rounds: roundNum,
    events,
    playerHpRemaining: Math.max(0, p.hp),
    playerMaxHp: p.maxHp,
    enemyMaxHp: enemy.maxHp,
    goldEarned,
    shardEarned,
    isBoss: enemy.isBoss,
  };
}

// ─── Player AI action selection ───────────────────────────────────────────────

function selectPlayerAction(p: ShadowCombatant, rules: DimensionRule[], round: number): string {
  const hpPct = p.hp / p.maxHp;

  // Can't defend if no_defense_action rule
  const canDefend = !rules.includes("no_defense_action");

  // Try heal skill if hurt
  if (hpPct < 0.35 && !rules.includes("no_heal")) {
    const healSkill = p.skills.find(s =>
      s.spellCategory === "heal" && (p.cooldowns[s.id] ?? 0) === 0 && p.mana >= s.manaCost
    );
    if (healSkill) return `skill:${healSkill.id}`;
  }

  // For magic_only — always try to use a skill
  if (rules.includes("magic_only")) {
    const offSkill = p.skills.find(s =>
      ["damage","aoe","cc"].includes(s.spellCategory) && (p.cooldowns[s.id] ?? 0) === 0 && p.mana >= s.manaCost
    );
    if (offSkill) return `skill:${offSkill.id}`;
    return "dodge"; // No skill available and can't deal damage — dodge to survive
  }

  // Normal action selection
  const offSkill = p.skills
    .filter(s => ["damage","aoe","cc"].includes(s.spellCategory) && (p.cooldowns[s.id] ?? 0) === 0 && p.mana >= s.manaCost)
    .sort((a, b) => (b.spellPower ?? 1) - (a.spellPower ?? 1))[0];

  const r = Math.random();
  if (offSkill && r < 0.45) return `skill:${offSkill.id}`;
  if (canDefend && hpPct < 0.5 && r < 0.65) return "defend";
  return r < 0.65 ? "attack" : "dodge";
}

// ─── Player action resolver ───────────────────────────────────────────────────

function resolvePlayerAction(
  action: string,
  p: ShadowCombatant,
  e: { hp: number; maxHp: number; stats: any; mana: number; maxMana: number; cooldowns: Record<string,number> },
  events: EncounterEvent[],
  round: number,
  rules: DimensionRule[],
  timeMultiplier: number,
): void {
  if (action === "defend") {
    p.status.push({ type: "def_boost", value: Math.round(p.stats.Def * 0.5), duration: 1 });
    events.push({ round, actor: "player", action: "defend", playerHp: p.hp, enemyHp: e.hp, message: `${p.name} takes a defensive stance.` });
    return;
  }

  if (action === "dodge") {
    const dodgeChance = Math.min(0.45, 0.1 + p.stats.Spd / 500);
    if (Math.random() < dodgeChance) {
      events.push({ round, actor: "player", action: "dodge", playerHp: p.hp, enemyHp: e.hp, message: `${p.name} nimbly sidesteps!` });
    } else {
      events.push({ round, actor: "player", action: "dodge", playerHp: p.hp, enemyHp: e.hp, message: `${p.name} attempts to dodge but stumbles.` });
    }
    return;
  }

  if (action === "attack") {
    // Magic only rule: physical = 0 damage
    if (rules.includes("magic_only")) {
      events.push({ round, actor: "player", action: "attack", damage: 0, dimensionEffect: "Crystal Labyrinth negates physical", playerHp: p.hp, enemyHp: e.hp, message: `${p.name} swings but the Crystal Shell absorbs all physical damage!` });
      return;
    }

    // Holy inversion: regular attack heals enemy
    if (rules.includes("holy_inversion")) {
      const dmg = calcDmg(p.stats, e.stats, undefined);
      const heal = Math.round(dmg * 0.30);
      e.hp = Math.min(e.maxHp, e.hp + heal);
      events.push({ round, actor: "player", action: "attack", dimensionEffect: "Holy Inversion heals enemy", playerHp: p.hp, enemyHp: e.hp, message: `${p.name} attacks but the Celestial energy heals the enemy for ${heal} HP!` });
      return;
    }

    const { dmg, crit } = calcDmgWithCrit(p.stats, e.stats);
    e.hp = Math.max(0, e.hp - dmg);
    events.push({ round, actor: "player", action: "attack", damage: dmg, isCrit: crit, playerHp: p.hp, enemyHp: e.hp, message: `${p.name} attacks${crit ? " 💥 CRIT" : ""} for ${dmg} damage!` });
    return;
  }

  if (action.startsWith("skill:")) {
    const skillId = action.slice(6);
    const skill = p.skills.find(s => s.id === skillId);
    if (!skill) return;

    // Chaos backfire rule
    if (rules.includes("chaos_backfire") && Math.random() < 0.35) {
      const backfireDmg = calcDmg(p.stats, p.stats, skill);
      p.hp = Math.max(0, p.hp - Math.round(backfireDmg * 0.6));
      p.mana = Math.max(0, p.mana - skill.manaCost * (rules.includes("double_mana") ? 2 : 1));
      p.cooldowns[skill.id] = skill.cooldown;
      events.push({ round, actor: "player", action: "skill", skillName: skill.name, backfire: true, damage: Math.round(backfireDmg * 0.6), dimensionEffect: "Chaos Backfire!", playerHp: p.hp, enemyHp: e.hp, message: `☠️ ${p.name}'s ${skill.name} BACKFIRES, dealing ${Math.round(backfireDmg * 0.6)} damage to self!` });
      return;
    }

    const manaCost = skill.manaCost * (rules.includes("double_mana") ? 2 : 1);
    if (p.mana < manaCost) {
      // Not enough mana — basic attack instead
      const { dmg, crit } = calcDmgWithCrit(p.stats, e.stats);
      e.hp = Math.max(0, e.hp - dmg);
      events.push({ round, actor: "player", action: "attack", damage: dmg, isCrit: crit, playerHp: p.hp, enemyHp: e.hp, message: `${p.name} lacks mana for ${skill.name}, attacks for ${dmg} damage instead.` });
      return;
    }
    p.mana = Math.max(0, p.mana - manaCost);
    p.cooldowns[skill.id] = skill.cooldown;

    const msgs: string[] = [];
    let totalDmg = 0; let totalHeal = 0;
    for (const eff of skill.effects) {
      if (eff.type === "damage") {
        const { dmg, crit } = calcSkillDmgWithCrit(p.stats, e.stats, skill.spellPower ?? 1, eff.value);
        e.hp = Math.max(0, e.hp - dmg);
        totalDmg += dmg;
        if (crit) msgs.push(`💥 CRIT`);
        msgs.push(`${dmg} dmg`);
      } else if (eff.type === "heal") {
        const healMult = rules.includes("no_heal") ? 0.5 : 1;
        const h = Math.round(eff.value * skill.spellPower * healMult);
        p.hp = Math.min(p.maxHp, p.hp + h);
        totalHeal += h;
        msgs.push(`+${h} HP${rules.includes("no_heal") ? " (halved)" : ""}`);
      } else if (eff.type === "burn") {
        e.hp = Math.max(0, e.hp - Math.round(eff.value * 0.5));
        msgs.push(`🔥 burn`);
      } else if (eff.type === "stun") {
        msgs.push(`⚡ stun`);
      } else if (eff.type === "shield") {
        p.status.push({ type: "shield", value: Math.round(eff.value * skill.spellPower), duration: eff.duration ?? 3 });
        msgs.push(`🛡️ shield`);
      } else if (eff.type === "stat_boost") {
        msgs.push(`📈 buff`);
      } else if (eff.type === "lifesteal") {
        const { dmg } = calcSkillDmgWithCrit(p.stats, e.stats, skill.spellPower ?? 1, eff.value);
        const steal = Math.round(dmg * (eff.value / 100));
        e.hp = Math.max(0, e.hp - dmg);
        p.hp = Math.min(p.maxHp, p.hp + steal);
        totalDmg += dmg;
        msgs.push(`${dmg} dmg + 🩸${steal}`);
      }
    }
    events.push({
      round, actor: "player", action: "skill", skillName: skill.name,
      damage: totalDmg || undefined, healing: totalHeal || undefined,
      playerHp: p.hp, enemyHp: e.hp,
      message: `${p.name} uses ${skill.name}! ${msgs.join(", ")}.`,
    });
  }
}

// ─── Enemy action resolver ────────────────────────────────────────────────────

function resolveEnemyAction(
  template: { name: string; skills: string[]; isMiniBoss: boolean; isBoss: boolean },
  e: { hp: number; maxHp: number; stats: any; mana: number; maxMana: number; cooldowns: Record<string,number> },
  p: ShadowCombatant,
  events: EncounterEvent[],
  round: number,
  rules: DimensionRule[],
): void {
  const hpPct = e.hp / e.maxHp;
  const r = Math.random();
  const isBigEnemy = template.isBoss || template.isMiniBoss;

  // Boss/mini-boss use skills more
  const skillChance = isBigEnemy ? 0.60 : 0.35;

  if ((e.cooldowns._skill ?? 0) === 0 && r < skillChance && template.skills.length > 0) {
    const skillName = template.skills[Math.floor(Math.random() * template.skills.length)];
    const isHeavy = isBigEnemy && Math.random() < 0.4;
    const { dmg, crit } = calcDmgWithCrit(e.stats, p.stats);
    const finalDmg = isHeavy ? Math.round(dmg * 1.6) : dmg;
    const shieldAbs = p.status.filter(s => s.type === "shield").reduce((a, s) => a + s.value, 0);
    const actualDmg = Math.max(0, finalDmg - shieldAbs);
    p.hp = Math.max(0, p.hp - actualDmg);
    e.cooldowns._skill = isBigEnemy ? 2 : 3;
    events.push({
      round, actor: "enemy", action: "skill", skillName,
      damage: actualDmg, isCrit: crit,
      playerHp: p.hp, enemyHp: e.hp,
      message: `${template.name} unleashes ${skillName}${crit ? " 💥 CRIT" : ""}${isHeavy ? " (HEAVY)" : ""} for ${actualDmg} damage!`,
    });
  } else if (r < 0.75) {
    const { dmg, crit } = calcDmgWithCrit(e.stats, p.stats);
    const shieldAbs = p.status.filter(s => s.type === "shield").reduce((a, s) => a + s.value, 0);
    const actualDmg = Math.max(0, dmg - shieldAbs);
    p.hp = Math.max(0, p.hp - actualDmg);
    for (const k in e.cooldowns) { if (e.cooldowns[k] > 0) e.cooldowns[k]--; }
    events.push({
      round, actor: "enemy", action: "attack", damage: actualDmg, isCrit: crit,
      playerHp: p.hp, enemyHp: e.hp,
      message: `${template.name} attacks${crit ? " 💥 CRIT" : ""} for ${actualDmg} damage!`,
    });
  } else {
    for (const k in e.cooldowns) { if (e.cooldowns[k] > 0) e.cooldowns[k]--; }
    events.push({ round, actor: "enemy", action: "defend", playerHp: p.hp, enemyHp: e.hp, message: `${template.name} steadies itself.` });
  }
}

// ─── Damage helpers ───────────────────────────────────────────────────────────

function calcDmg(atk: any, def: any, _skill?: any): number {
  const effAtk = (atk.Str ?? 10) + (atk.Int ? Math.round(atk.Int * 0.3) : 0);
  const effDef = def.Def ?? 10;
  const base   = effAtk * 2.5 + 30;
  const mult   = 100 / (100 + effDef);
  return Math.max(1, Math.round(base * mult));
}

function calcDmgWithCrit(atk: any, def: any): { dmg: number; crit: boolean } {
  const base = calcDmg(atk, def);
  const critChance = Math.min(0.40, 0.05 + (atk.Luck ?? 10) / 400);
  const crit = Math.random() < critChance;
  return { dmg: crit ? Math.round(base * 1.75) : base, crit };
}

function calcSkillDmgWithCrit(atk: any, def: any, spellPower: number, baseValue: number): { dmg: number; crit: boolean } {
  const intScale  = (atk.Int ?? 10) * 2;
  const strScale  = (atk.Str ?? 10) * 1.5;
  const scaleStat = atk.Int > atk.Str ? intScale : strScale;
  const effDef    = def.Def ?? 10;
  const base      = scaleStat + (baseValue * spellPower);
  const mult      = 100 / (100 + effDef);
  const raw       = Math.max(1, Math.round(base * mult));
  const critChance = Math.min(0.40, 0.05 + (atk.Luck ?? 10) / 400);
  const crit = Math.random() < critChance;
  return { dmg: crit ? Math.round(raw * 1.75) : raw, crit };
}
