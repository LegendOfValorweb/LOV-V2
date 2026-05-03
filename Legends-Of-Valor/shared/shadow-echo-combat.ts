// ─── Shadow Echo Combat Simulator ─────────────────────────────────────────────
// Fully self-contained, server-side auto-resolved fight between a live player
// and an AI clone built from a stored snapshot of a real player's build.
// No round-trip required — POST once, get the full battle log back.
// ──────────────────────────────────────────────────────────────────────────────

export type StrategyProfile = "aggressive" | "defensive" | "mage" | "balanced" | "berserker";

export type ShadowStats = {
  Str: number; Def: number; Spd: number; Int: number; Luck: number; Pot: number;
};

export type ShadowSkillEffect = {
  type: string;   // "damage" | "heal" | "burn" | "stun" | "freeze" | "stat_boost" | "shield" | "lifesteal"
  value: number;
  duration?: number;
  chance?: number;
  stat?: string;
};

export type ShadowSkill = {
  id: string;
  name: string;
  spellCategory: string;  // "damage" | "aoe" | "heal" | "buff" | "cc"
  spellPower: number;
  cooldown: number;
  manaCost: number;
  effects: ShadowSkillEffect[];
};

export type ShadowStatusEffect = {
  type: "burn" | "poison" | "stun" | "freeze" | "regen" | "shield" | "str_boost" | "def_boost";
  value: number;
  duration: number;
};

export type ShadowCombatant = {
  id: string;
  label: "challenger" | "echo";
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stats: ShadowStats;
  rank: string;
  race: string;
  skills: ShadowSkill[];
  cooldowns: Record<string, number>;
  status: ShadowStatusEffect[];
  strategyProfile: StrategyProfile;
};

export type BattleEvent = {
  round: number;
  actor: "challenger" | "echo";
  action: string;
  skillName?: string;
  isCrit?: boolean;
  damage?: number;
  healing?: number;
  effectApplied?: string;
  challengerHp: number;
  echoHp: number;
  message: string;
};

export type BattleResult = {
  winner: "challenger" | "echo" | "draw";
  rounds: number;
  events: BattleEvent[];
  challengerMaxHp: number;
  echoMaxHp: number;
  goldReward: number;
  shardReward: number;
  xpReward: number;
};

// ─── HP formula (matches combat-engine.ts) ───────────────────────────────────

const RACE_HP: Record<string, number> = {
  human:100, elf:85, dwarf:120, orc:130, beastfolk:90, mystic:80,
  fae:75, elemental:95, undead:110, demon:105, draconic:115,
  celestial:90, aquatic:95, titan:140,
};
const RANK_HP: Record<string, number> = {
  "Novice":0,"Apprentice":20,"Initiate":40,"Journeyman":65,"Adept":95,
  "Expert":130,"Master":170,"Grandmaster":220,"Champion":280,"Overlord":350,
  "Sovereign":430,"Ascendant":520,"Legend":620,"Mythic":740,"Mythical Legend":880,
};

export function calcMaxHp(stats: ShadowStats, race: string, rank: string): number {
  const raceHp = RACE_HP[race] ?? 100;
  const rankHp = RANK_HP[rank] ?? 0;
  return Math.max(50, Math.floor(raceHp + rankHp + (stats.Pot ?? 0) * 8));
}

// ─── Strategy profile detection from skills ──────────────────────────────────

export function detectStrategyProfile(skills: ShadowSkill[], stats: ShadowStats): StrategyProfile {
  const dmgSkills  = skills.filter(s => ["damage","aoe"].includes(s.spellCategory)).length;
  const healSkills = skills.filter(s => s.spellCategory === "heal").length;
  const buffSkills = skills.filter(s => s.spellCategory === "buff").length;

  if (stats.Str > stats.Int * 1.5 && dmgSkills >= 2) return "berserker";
  if (stats.Int > stats.Str * 1.5 && dmgSkills >= 1) return "mage";
  if (healSkills >= 2 || buffSkills >= 2)              return "defensive";
  if (dmgSkills >= 3)                                  return "aggressive";
  return "balanced";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rng(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function getStatusValue(c: ShadowCombatant, type: string): number {
  return c.status.filter(e => e.type === type).reduce((a, e) => a + e.value, 0);
}

function tickStatus(c: ShadowCombatant): { burn: number; poison: number; regen: number } {
  let burn = 0, poison = 0, regen = 0;
  c.status = c.status.map(e => ({ ...e, duration: e.duration - 1 }))
    .filter(e => e.duration > 0);
  c.status.forEach(e => {
    if (e.type === "burn")   burn   += e.value;
    if (e.type === "poison") poison += e.value;
    if (e.type === "regen")  regen  += e.value;
  });
  return { burn, poison, regen };
}

function isStunned(c: ShadowCombatant): boolean {
  return c.status.some(e => (e.type === "stun" || e.type === "freeze") && e.duration > 0);
}

function tickCooldowns(c: ShadowCombatant) {
  for (const k in c.cooldowns) {
    if (c.cooldowns[k] > 0) c.cooldowns[k]--;
  }
}

function getBestSkill(c: ShadowCombatant, category: "offensive" | "heal" | "buff"): ShadowSkill | null {
  const cats: Record<string, string[]> = {
    offensive: ["damage", "aoe", "cc"],
    heal:      ["heal"],
    buff:      ["buff"],
  };
  const pool = c.skills.filter(s =>
    cats[category].includes(s.spellCategory) &&
    (c.cooldowns[s.id] ?? 0) === 0 &&
    c.mana >= s.manaCost
  );
  if (!pool.length) return null;
  // pick highest spellPower
  return pool.sort((a, b) => (b.spellPower ?? 1) - (a.spellPower ?? 1))[0];
}

// ─── AI action selection ──────────────────────────────────────────────────────

function selectAction(c: ShadowCombatant, opp: ShadowCombatant): string {
  if (isStunned(c)) return "stunned";

  const hpPct = c.hp / c.maxHp;

  // Emergency heal
  if (hpPct < 0.25) {
    const heal = getBestSkill(c, "heal");
    if (heal) return `skill:${heal.id}`;
    if (c.strategyProfile === "defensive") return "defend";
  }

  // Try buff if fresh
  if (hpPct > 0.6 && c.strategyProfile !== "berserker") {
    const buff = getBestSkill(c, "buff");
    if (buff && Math.random() < 0.3) return `skill:${buff.id}`;
  }

  const off = getBestSkill(c, "offensive");

  const r = Math.random();
  switch (c.strategyProfile) {
    case "berserker":
      if (off && r < 0.55) return `skill:${off.id}`;
      return r < 0.90 ? "attack" : "dodge";
    case "aggressive":
      if (off && r < 0.50) return `skill:${off.id}`;
      return r < 0.75 ? "attack" : "dodge";
    case "mage":
      if (off && r < 0.65) return `skill:${off.id}`;
      return r < 0.45 ? "attack" : "dodge";
    case "defensive":
      if (off && r < 0.35) return `skill:${off.id}`;
      return r < 0.45 ? "defend" : r < 0.75 ? "attack" : "dodge";
    default: // balanced
      if (off && r < 0.45) return `skill:${off.id}`;
      return r < 0.50 ? "attack" : r < 0.72 ? "defend" : "dodge";
  }
}

// ─── Damage calculation ───────────────────────────────────────────────────────

function calcBaseDamage(atk: ShadowCombatant, def: ShadowCombatant, skill?: ShadowSkill): {
  damage: number; isCrit: boolean;
} {
  const strBoost  = getStatusValue(atk, "str_boost");
  const defBoost  = getStatusValue(def, "def_boost");
  const effStr    = (atk.stats.Str + strBoost) || 1;
  const effInt    = (atk.stats.Int)             || 1;
  const effDef    = (def.stats.Def + defBoost)  || 1;

  const shieldAbs = getStatusValue(def, "shield");

  let base = 0;
  if (skill) {
    const dmgEff = skill.effects.find(e => e.type === "damage");
    if (dmgEff) {
      const scaleStat = skill.spellCategory === "damage" && effInt > effStr * 1.2 ? effInt : effStr;
      base = (scaleStat * 2) + (dmgEff.value * skill.spellPower);
    } else {
      base = effStr * 2.5 + 30;
    }
  } else {
    base = effStr * 2.5 + 30;
  }

  const defMult = 100 / (100 + effDef);
  let dmg = base * defMult;

  const critChance = clamp(0.05 + atk.stats.Luck / 400, 0.05, 0.40);
  const isCrit = Math.random() < critChance;
  if (isCrit) dmg *= 1.75;

  dmg -= shieldAbs;
  if (shieldAbs > 0) {
    // drain shield
    def.status = def.status.map(e =>
      e.type === "shield" ? { ...e, value: Math.max(0, e.value - Math.floor(shieldAbs)) } : e
    ).filter(e => !(e.type === "shield" && e.value <= 0));
  }

  return { damage: Math.max(1, Math.round(dmg)), isCrit };
}

// ─── Round resolver ───────────────────────────────────────────────────────────

function resolveAction(
  actor: ShadowCombatant,
  target: ShadowCombatant,
  action: string,
  round: number,
  events: BattleEvent[],
  oppAction: string,
) {
  const label = actor.label;
  let msg = "";

  if (action === "stunned") {
    events.push({
      round, actor: label, action: "stunned",
      challengerHp: label === "challenger" ? actor.hp : target.hp,
      echoHp:       label === "echo"       ? actor.hp : target.hp,
      message: `${actor.name} is stunned and cannot act!`,
    });
    return;
  }

  if (action === "defend") {
    // mark for this round
    actor.status.push({ type: "def_boost", value: actor.stats.Def * 0.5, duration: 1 });
    events.push({
      round, actor: label, action: "defend",
      challengerHp: label === "challenger" ? actor.hp : target.hp,
      echoHp:       label === "echo"       ? actor.hp : target.hp,
      message: `${actor.name} braces for impact, temporarily boosting defense!`,
    });
    return;
  }

  if (action === "dodge") {
    const dodgeChance = clamp(0.10 + actor.stats.Spd / 500, 0.10, 0.50);
    if (Math.random() < dodgeChance) {
      events.push({
        round, actor: label, action: "dodge",
        challengerHp: label === "challenger" ? actor.hp : target.hp,
        echoHp:       label === "echo"       ? actor.hp : target.hp,
        message: `${actor.name} nimbly dodges! The next attack may miss.`,
      });
    } else {
      // Dodging missed — just a wasted turn; deal light counter
      const { damage, isCrit } = calcBaseDamage(actor, target);
      const dmg = Math.round(damage * 0.5);
      target.hp = Math.max(0, target.hp - dmg);
      events.push({
        round, actor: label, action: "dodge",
        damage: dmg, isCrit,
        challengerHp: label === "challenger" ? actor.hp : target.hp,
        echoHp:       label === "echo"       ? actor.hp : target.hp,
        message: `${actor.name} attempts to dodge but grazes ${target.name} for ${dmg} damage.`,
      });
    }
    return;
  }

  if (action === "attack") {
    const { damage, isCrit } = calcBaseDamage(actor, target);
    target.hp = Math.max(0, target.hp - damage);
    msg = `${actor.name} attacks${isCrit ? " 💥 CRITICAL" : ""} for ${damage} damage!`;
    events.push({
      round, actor: label, action: "attack",
      damage, isCrit,
      challengerHp: label === "challenger" ? actor.hp : target.hp,
      echoHp:       label === "echo"       ? actor.hp : target.hp,
      message: msg,
    });
    return;
  }

  if (action.startsWith("skill:")) {
    const skillId = action.slice(6);
    const skill = actor.skills.find(s => s.id === skillId);
    if (!skill) return;

    // spend mana
    actor.mana = Math.max(0, actor.mana - skill.manaCost);
    actor.cooldowns[skill.id] = skill.cooldown;

    const msgs: string[] = [];
    let totalDamage = 0;
    let totalHeal = 0;
    let appliedEffect = "";

    for (const eff of skill.effects) {
      if (eff.type === "damage") {
        const { damage, isCrit } = calcBaseDamage(actor, target, skill);
        target.hp = Math.max(0, target.hp - damage);
        totalDamage += damage;
        if (isCrit) msgs.push(`💥 CRIT`);
        msgs.push(`${damage} dmg`);
      } else if (eff.type === "heal") {
        const healAmt = Math.round(eff.value * skill.spellPower);
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        totalHeal += healAmt;
        msgs.push(`heals ${healAmt} HP`);
      } else if (eff.type === "burn") {
        target.status.push({ type: "burn", value: Math.round(eff.value * 0.5), duration: eff.duration ?? 3 });
        appliedEffect = "burn";
        msgs.push(`ignites target 🔥`);
      } else if (eff.type === "stun") {
        const chance = eff.chance ?? 100;
        if (Math.random() * 100 < chance) {
          target.status.push({ type: "stun", value: 0, duration: eff.duration ?? 1 });
          appliedEffect = "stun";
          msgs.push(`stuns target ⚡`);
        }
      } else if (eff.type === "freeze") {
        target.status.push({ type: "freeze", value: 0, duration: eff.duration ?? 1 });
        appliedEffect = "freeze";
        msgs.push(`freezes target ❄️`);
      } else if (eff.type === "shield") {
        actor.status.push({ type: "shield", value: Math.round(eff.value * skill.spellPower), duration: eff.duration ?? 3 });
        msgs.push(`gains a shield 🛡️`);
      } else if (eff.type === "stat_boost") {
        const stat = eff.stat?.toLowerCase() ?? "str";
        if (stat === "str" || stat === "all") {
          actor.status.push({ type: "str_boost", value: eff.value, duration: eff.duration ?? 5 });
          msgs.push(`+${eff.value} Str boost`);
        }
        if (stat === "def" || stat === "all") {
          actor.status.push({ type: "def_boost", value: eff.value, duration: eff.duration ?? 5 });
          msgs.push(`+${eff.value} Def boost`);
        }
        appliedEffect = "buff";
      } else if (eff.type === "lifesteal") {
        const { damage } = calcBaseDamage(actor, target, skill);
        const stolen = Math.round(damage * (eff.value / 100));
        target.hp = Math.max(0, target.hp - damage);
        actor.hp = Math.min(actor.maxHp, actor.hp + stolen);
        totalDamage += damage;
        msgs.push(`${damage} dmg + steals ${stolen} HP 🩸`);
      } else if (eff.type === "poison") {
        target.status.push({ type: "poison", value: Math.round(eff.value * 0.4), duration: eff.duration ?? 4 });
        appliedEffect = "poison";
        msgs.push(`poisons target ☠️`);
      } else if (eff.type === "regen") {
        actor.status.push({ type: "regen", value: eff.value, duration: eff.duration ?? 4 });
        msgs.push(`gains regen ✨`);
      }
    }

    events.push({
      round, actor: label, action: "skill",
      skillName: skill.name,
      damage: totalDamage || undefined,
      healing: totalHeal || undefined,
      effectApplied: appliedEffect || undefined,
      challengerHp: label === "challenger" ? actor.hp : target.hp,
      echoHp:       label === "echo"       ? actor.hp : target.hp,
      message: `${actor.name} uses ${skill.name}! ${msgs.join(", ")}.`,
    });
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function runShadowEchoBattle(
  challenger: ShadowCombatant,
  echo: ShadowCombatant,
): BattleResult {
  const MAX_ROUNDS = 25;
  const events: BattleEvent[] = [];

  // Mana regen per round
  const MANA_REGEN = 15;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Tick cooldowns
    tickCooldowns(challenger);
    tickCooldowns(echo);

    // Tick status effects (burn/poison damage, regen heal)
    const cTick = tickStatus(challenger);
    const eTick = tickStatus(echo);

    if (cTick.burn + cTick.poison > 0) {
      challenger.hp = Math.max(0, challenger.hp - cTick.burn - cTick.poison);
      events.push({
        round, actor: "challenger", action: "dot",
        damage: cTick.burn + cTick.poison,
        challengerHp: challenger.hp, echoHp: echo.hp,
        message: `${challenger.name} takes ${cTick.burn + cTick.poison} from status effects.`,
      });
    }
    if (cTick.regen > 0) {
      challenger.hp = Math.min(challenger.maxHp, challenger.hp + cTick.regen);
    }
    if (eTick.burn + eTick.poison > 0) {
      echo.hp = Math.max(0, echo.hp - eTick.burn - eTick.poison);
      events.push({
        round, actor: "echo", action: "dot",
        damage: eTick.burn + eTick.poison,
        challengerHp: challenger.hp, echoHp: echo.hp,
        message: `${echo.name} takes ${eTick.burn + eTick.poison} from status effects.`,
      });
    }
    if (eTick.regen > 0) {
      echo.hp = Math.min(echo.maxHp, echo.hp + eTick.regen);
    }

    if (challenger.hp <= 0 || echo.hp <= 0) break;

    // Mana regeneration
    challenger.mana = Math.min(challenger.maxMana, challenger.mana + MANA_REGEN);
    echo.mana       = Math.min(echo.maxMana,       echo.mana       + MANA_REGEN);

    // Select actions
    const cAction = selectAction(challenger, echo);
    const eAction = selectAction(echo, challenger);

    // Determine order by speed (faster goes first, but both always act)
    const cSpd = challenger.stats.Spd + rng(-5, 5);
    const eSpd = echo.stats.Spd       + rng(-5, 5);

    if (cSpd >= eSpd) {
      resolveAction(challenger, echo, cAction, round, events, eAction);
      if (echo.hp > 0) resolveAction(echo, challenger, eAction, round, events, cAction);
    } else {
      resolveAction(echo, challenger, eAction, round, events, cAction);
      if (challenger.hp > 0) resolveAction(challenger, echo, cAction, round, events, eAction);
    }

    if (challenger.hp <= 0 || echo.hp <= 0) break;
  }

  // Determine winner
  let winner: "challenger" | "echo" | "draw";
  const cPct = challenger.hp / challenger.maxHp;
  const ePct = echo.hp       / echo.maxHp;

  if      (challenger.hp <= 0 && echo.hp <= 0) winner = "draw";
  else if (challenger.hp <= 0)                 winner = "echo";
  else if (echo.hp <= 0)                       winner = "challenger";
  else winner = cPct >= ePct ? "challenger" : "echo";  // timeout: highest HP%

  // Determine rewards (scale with echo's rank)
  const rankIdx = [
    "Novice","Apprentice","Initiate","Journeyman","Adept","Expert","Master",
    "Grandmaster","Champion","Overlord","Sovereign","Ascendant","Legend","Mythic","Mythical Legend"
  ].indexOf(echo.rank);
  const rankTier = Math.max(0, rankIdx);

  const goldReward  = winner === "challenger" ? (rankTier + 1) * 5_000  * (1 + (echo as any).prestigeLevel ?? 0) : 0;
  const shardReward = winner === "challenger" ? (rankTier + 1) * 25     : 0;
  const xpReward    = winner === "challenger" ? (rankTier + 1) * 500    : Math.floor((rankTier + 1) * 100);

  return {
    winner,
    rounds: events.filter(e => e.round === Math.max(...events.map(ev => ev.round))).length > 0
      ? Math.max(...events.map(ev => ev.round)) : 1,
    events,
    challengerMaxHp: challenger.maxHp,
    echoMaxHp:       echo.maxHp,
    goldReward,
    shardReward,
    xpReward,
  };
}
