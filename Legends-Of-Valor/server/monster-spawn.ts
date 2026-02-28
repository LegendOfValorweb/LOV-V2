import { playerRanks } from "../shared/schema";

export type WeatherType = "clear" | "rain" | "thunderstorm" | "fog" | "blizzard";

export interface WeatherState {
  type: WeatherType;
  startedAt: number;
  duration: number;
  zoneId: string;
}

export interface MonsterTemplate {
  name: string;
  element: string;
  baseStats: {
    Str: number;
    Def: number;
    Spd: number;
    Int: number;
    Luck: number;
  };
  hpMultiplier: number;
  rewardMultiplier: number;
  isBoss: boolean;
  weatherExclusive?: WeatherType;
}

export interface SpawnedMonster {
  id: string;
  zoneId: string;
  accountId: string;
  template: MonsterTemplate;
  scaledStats: {
    Str: number;
    Def: number;
    Spd: number;
    Int: number;
    Luck: number;
    Pot: number;
  };
  hp: number;
  maxHp: number;
  level: number;
  spawnedAt: number;
  expiresAt: number;
  source: "timer" | "action";
}

const WEATHER_SPAWN_MODIFIERS: Record<WeatherType, { rateMultiplier: number; difficultyMultiplier: number; rareBossChance: number }> = {
  clear: { rateMultiplier: 1.0, difficultyMultiplier: 1.0, rareBossChance: 0 },
  rain: { rateMultiplier: 1.2, difficultyMultiplier: 1.1, rareBossChance: 0 },
  thunderstorm: { rateMultiplier: 1.5, difficultyMultiplier: 1.3, rareBossChance: 0.05 },
  fog: { rateMultiplier: 0.8, difficultyMultiplier: 1.2, rareBossChance: 0.02 },
  blizzard: { rateMultiplier: 1.3, difficultyMultiplier: 1.4, rareBossChance: 0.03 },
};

const ZONE_MONSTER_TEMPLATES: Record<string, MonsterTemplate[]> = {
  capital_city: [
    { name: "Stray Rat", element: "Earth", baseStats: { Str: 3, Def: 2, Spd: 5, Int: 1, Luck: 2 }, hpMultiplier: 0.5, rewardMultiplier: 0.5, isBoss: false },
    { name: "Training Golem", element: "Earth", baseStats: { Str: 5, Def: 8, Spd: 2, Int: 1, Luck: 1 }, hpMultiplier: 0.8, rewardMultiplier: 0.6, isBoss: false },
  ],
  mountain_caverns: [
    { name: "Cave Crawler", element: "Earth", baseStats: { Str: 8, Def: 6, Spd: 4, Int: 2, Luck: 3 }, hpMultiplier: 1.0, rewardMultiplier: 1.0, isBoss: false },
    { name: "Rock Golem", element: "Earth", baseStats: { Str: 12, Def: 15, Spd: 2, Int: 3, Luck: 1 }, hpMultiplier: 1.5, rewardMultiplier: 1.2, isBoss: false },
    { name: "Crystal Guardian", element: "Crystal", baseStats: { Str: 20, Def: 25, Spd: 5, Int: 10, Luck: 5 }, hpMultiplier: 3.0, rewardMultiplier: 3.0, isBoss: true },
  ],
  ancient_ruins: [
    { name: "Cursed Spirit", element: "Dark", baseStats: { Str: 6, Def: 4, Spd: 8, Int: 10, Luck: 5 }, hpMultiplier: 0.8, rewardMultiplier: 1.0, isBoss: false },
    { name: "Stone Sentinel", element: "Earth", baseStats: { Str: 10, Def: 14, Spd: 3, Int: 4, Luck: 2 }, hpMultiplier: 1.3, rewardMultiplier: 1.1, isBoss: false },
    { name: "Ruin Wraith", element: "Void", baseStats: { Str: 15, Def: 8, Spd: 12, Int: 15, Luck: 8 }, hpMultiplier: 2.5, rewardMultiplier: 2.5, isBoss: true },
  ],
  enchanted_forest: [
    { name: "Forest Wolf", element: "Nature", baseStats: { Str: 7, Def: 4, Spd: 10, Int: 3, Luck: 5 }, hpMultiplier: 0.9, rewardMultiplier: 1.0, isBoss: false },
    { name: "Wild Treant", element: "Nature", baseStats: { Str: 10, Def: 12, Spd: 2, Int: 6, Luck: 3 }, hpMultiplier: 1.4, rewardMultiplier: 1.1, isBoss: false },
    { name: "Ancient Ent", element: "Nature", baseStats: { Str: 18, Def: 20, Spd: 4, Int: 12, Luck: 6 }, hpMultiplier: 3.0, rewardMultiplier: 2.8, isBoss: true },
  ],
  crystal_lake: [
    { name: "Lake Sprite", element: "Water", baseStats: { Str: 4, Def: 3, Spd: 9, Int: 8, Luck: 6 }, hpMultiplier: 0.7, rewardMultiplier: 0.8, isBoss: false },
    { name: "Water Elemental", element: "Water", baseStats: { Str: 8, Def: 6, Spd: 7, Int: 10, Luck: 4 }, hpMultiplier: 1.1, rewardMultiplier: 1.0, isBoss: false },
  ],
  coastal_village: [
    { name: "Sea Raider", element: "Water", baseStats: { Str: 9, Def: 7, Spd: 6, Int: 4, Luck: 5 }, hpMultiplier: 1.0, rewardMultiplier: 1.0, isBoss: false },
    { name: "Crab Beast", element: "Water", baseStats: { Str: 11, Def: 14, Spd: 3, Int: 2, Luck: 3 }, hpMultiplier: 1.3, rewardMultiplier: 1.1, isBoss: false },
  ],
  ruby_mines: [
    { name: "Gem Golem", element: "Crystal", baseStats: { Str: 12, Def: 16, Spd: 3, Int: 5, Luck: 4 }, hpMultiplier: 1.4, rewardMultiplier: 1.3, isBoss: false },
    { name: "Mine Crawler", element: "Earth", baseStats: { Str: 10, Def: 8, Spd: 7, Int: 3, Luck: 6 }, hpMultiplier: 1.0, rewardMultiplier: 1.2, isBoss: false },
    { name: "Ruby Wyrm", element: "Fire", baseStats: { Str: 22, Def: 18, Spd: 10, Int: 14, Luck: 8 }, hpMultiplier: 3.5, rewardMultiplier: 3.5, isBoss: true },
  ],
  battle_arena: [
    { name: "Arena Gladiator", element: "Metal", baseStats: { Str: 14, Def: 10, Spd: 8, Int: 4, Luck: 6 }, hpMultiplier: 1.2, rewardMultiplier: 1.5, isBoss: false },
    { name: "Beast Master", element: "Nature", baseStats: { Str: 12, Def: 8, Spd: 10, Int: 8, Luck: 7 }, hpMultiplier: 1.3, rewardMultiplier: 1.4, isBoss: false },
    { name: "Arena Champion", element: "Storm", baseStats: { Str: 25, Def: 20, Spd: 15, Int: 12, Luck: 10 }, hpMultiplier: 4.0, rewardMultiplier: 4.0, isBoss: true },
  ],
  research_lab: [
    { name: "Mutant", element: "Arcane", baseStats: { Str: 10, Def: 6, Spd: 8, Int: 12, Luck: 5 }, hpMultiplier: 1.0, rewardMultiplier: 1.2, isBoss: false },
    { name: "Failed Experiment", element: "Void", baseStats: { Str: 14, Def: 5, Spd: 12, Int: 8, Luck: 3 }, hpMultiplier: 0.9, rewardMultiplier: 1.3, isBoss: false },
  ],
  pet_training: [
    { name: "Wild Pet", element: "Nature", baseStats: { Str: 5, Def: 3, Spd: 7, Int: 2, Luck: 4 }, hpMultiplier: 0.6, rewardMultiplier: 0.7, isBoss: false },
    { name: "Feral Beast", element: "Nature", baseStats: { Str: 8, Def: 5, Spd: 9, Int: 3, Luck: 5 }, hpMultiplier: 0.8, rewardMultiplier: 0.8, isBoss: false },
  ],
  hell_zone: [
    { name: "Demon Soldier", element: "Dark", baseStats: { Str: 18, Def: 14, Spd: 10, Int: 12, Luck: 6 }, hpMultiplier: 1.5, rewardMultiplier: 2.0, isBoss: false },
    { name: "Hellfire Elemental", element: "Fire", baseStats: { Str: 15, Def: 10, Spd: 8, Int: 16, Luck: 5 }, hpMultiplier: 1.3, rewardMultiplier: 2.0, isBoss: false },
    { name: "Abyssal Horror", element: "Void", baseStats: { Str: 20, Def: 16, Spd: 12, Int: 18, Luck: 8 }, hpMultiplier: 2.0, rewardMultiplier: 2.5, isBoss: false },
    { name: "Demon Lord", element: "Dark", baseStats: { Str: 30, Def: 25, Spd: 18, Int: 22, Luck: 12 }, hpMultiplier: 5.0, rewardMultiplier: 5.0, isBoss: true },
  ],
  mystic_tower: [
    { name: "Arcane Sentinel", element: "Arcane", baseStats: { Str: 12, Def: 14, Spd: 6, Int: 14, Luck: 5 }, hpMultiplier: 1.4, rewardMultiplier: 1.5, isBoss: false },
    { name: "Tower Guardian", element: "Light", baseStats: { Str: 16, Def: 18, Spd: 5, Int: 10, Luck: 4 }, hpMultiplier: 1.6, rewardMultiplier: 1.6, isBoss: false },
    { name: "Floor Boss", element: "Aether", baseStats: { Str: 24, Def: 22, Spd: 14, Int: 20, Luck: 10 }, hpMultiplier: 4.0, rewardMultiplier: 4.0, isBoss: true },
  ],
};

const WEATHER_EXCLUSIVE_BOSSES: MonsterTemplate[] = [
  { name: "Thunderstorm Titan", element: "Storm", baseStats: { Str: 30, Def: 25, Spd: 20, Int: 25, Luck: 12 }, hpMultiplier: 6.0, rewardMultiplier: 8.0, isBoss: true, weatherExclusive: "thunderstorm" },
  { name: "Blizzard Wyrm", element: "Ice", baseStats: { Str: 28, Def: 30, Spd: 10, Int: 20, Luck: 10 }, hpMultiplier: 5.5, rewardMultiplier: 7.0, isBoss: true, weatherExclusive: "blizzard" },
  { name: "Fog Phantom", element: "Void", baseStats: { Str: 22, Def: 15, Spd: 25, Int: 28, Luck: 15 }, hpMultiplier: 4.0, rewardMultiplier: 6.0, isBoss: true, weatherExclusive: "fog" },
  { name: "Rain Serpent", element: "Water", baseStats: { Str: 25, Def: 20, Spd: 18, Int: 22, Luck: 12 }, hpMultiplier: 5.0, rewardMultiplier: 6.5, isBoss: true, weatherExclusive: "rain" },
];

const TIMER_SPAWN_INTERVAL_MS = { min: 60000, max: 180000 };
const ACTION_SPAWN_CHANCE = 0.15;

const activeMonsters = new Map<string, SpawnedMonster>();
const zoneWeather = new Map<string, WeatherState>();
const lastTimerSpawn = new Map<string, number>();
const nextSpawnTime = new Map<string, number>();

let spawnIdCounter = 0;
function generateSpawnId(): string {
  return `monster_${Date.now()}_${++spawnIdCounter}`;
}

function getRandomInterval(): number {
  return TIMER_SPAWN_INTERVAL_MS.min + Math.random() * (TIMER_SPAWN_INTERVAL_MS.max - TIMER_SPAWN_INTERVAL_MS.min);
}

export function getZoneWeather(zoneId: string): WeatherState {
  const existing = zoneWeather.get(zoneId);
  const now = Date.now();
  if (existing && now < existing.startedAt + existing.duration) {
    return existing;
  }
  const newWeather = rollNewWeather(zoneId);
  zoneWeather.set(zoneId, newWeather);
  return newWeather;
}

function rollNewWeather(zoneId: string): WeatherState {
  const types: WeatherType[] = ["clear", "rain", "thunderstorm", "fog", "blizzard"];
  const weights = [40, 25, 10, 15, 10];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let chosen: WeatherType = "clear";
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = types[i];
      break;
    }
  }
  return {
    type: chosen,
    startedAt: Date.now(),
    duration: 300000 + Math.random() * 600000,
    zoneId,
  };
}

function scaleMonsterStats(
  template: MonsterTemplate,
  playerRankIndex: number,
  weather: WeatherState
): { stats: SpawnedMonster["scaledStats"]; hp: number; level: number } {
  const rankScale = 1 + playerRankIndex * 0.5;
  const weatherMod = WEATHER_SPAWN_MODIFIERS[weather.type];
  const diffMod = weatherMod.difficultyMultiplier;

  const level = Math.max(1, Math.floor((playerRankIndex + 1) * 10 * (template.isBoss ? 1.5 : 1)));

  const stats = {
    Str: Math.max(1, Math.floor(template.baseStats.Str * rankScale * diffMod)),
    Def: Math.max(1, Math.floor(template.baseStats.Def * rankScale * diffMod)),
    Spd: Math.max(1, Math.floor(template.baseStats.Spd * rankScale * diffMod)),
    Int: Math.max(1, Math.floor(template.baseStats.Int * rankScale * diffMod)),
    Luck: Math.max(1, Math.floor(template.baseStats.Luck * rankScale * diffMod)),
    Pot: 0,
  };

  const baseHp = (stats.Str + stats.Def) * 5;
  const hp = Math.max(10, Math.floor(baseHp * template.hpMultiplier * diffMod));

  return { stats, hp, level };
}

function selectMonsterTemplate(zoneId: string, weather: WeatherState): MonsterTemplate {
  const weatherMod = WEATHER_SPAWN_MODIFIERS[weather.type];

  if (weatherMod.rareBossChance > 0 && Math.random() < weatherMod.rareBossChance) {
    const exclusiveBosses = WEATHER_EXCLUSIVE_BOSSES.filter(b => b.weatherExclusive === weather.type);
    if (exclusiveBosses.length > 0) {
      return exclusiveBosses[Math.floor(Math.random() * exclusiveBosses.length)];
    }
  }

  const templates = ZONE_MONSTER_TEMPLATES[zoneId] || ZONE_MONSTER_TEMPLATES["capital_city"];
  const normalMonsters = templates.filter(t => !t.isBoss);
  const bosses = templates.filter(t => t.isBoss);

  const bossChance = 0.08 * weatherMod.rateMultiplier;
  if (bosses.length > 0 && Math.random() < bossChance) {
    return bosses[Math.floor(Math.random() * bosses.length)];
  }

  if (normalMonsters.length === 0) return templates[0];
  return normalMonsters[Math.floor(Math.random() * normalMonsters.length)];
}

export function getActiveMonster(zoneId: string, accountId: string): SpawnedMonster | null {
  const key = `${zoneId}:${accountId}`;
  const monster = activeMonsters.get(key);
  if (!monster) return null;
  if (Date.now() > monster.expiresAt) {
    activeMonsters.delete(key);
    return null;
  }
  return monster;
}

export function clearActiveMonster(zoneId: string, accountId: string): void {
  const key = `${zoneId}:${accountId}`;
  activeMonsters.delete(key);
}

export function spawnMonster(
  zoneId: string,
  accountId: string,
  playerRank: string,
  source: "timer" | "action"
): SpawnedMonster | null {
  const key = `${zoneId}:${accountId}`;
  if (activeMonsters.has(key)) {
    return activeMonsters.get(key)!;
  }

  const weather = getZoneWeather(zoneId);
  const template = selectMonsterTemplate(zoneId, weather);
  const rankIndex = playerRanks.indexOf(playerRank as any);
  const safeRankIndex = rankIndex >= 0 ? rankIndex : 0;
  const { stats, hp, level } = scaleMonsterStats(template, safeRankIndex, weather);

  const now = Date.now();
  const monster: SpawnedMonster = {
    id: generateSpawnId(),
    zoneId,
    accountId,
    template,
    scaledStats: stats,
    hp,
    maxHp: hp,
    level,
    spawnedAt: now,
    expiresAt: now + 300000,
    source,
  };

  activeMonsters.set(key, monster);
  return monster;
}

export function checkTimerSpawn(zoneId: string, accountId: string, playerRank: string): SpawnedMonster | null {
  const key = `${zoneId}:${accountId}`;

  if (activeMonsters.has(key)) return null;

  const now = Date.now();
  const nextTime = nextSpawnTime.get(key);
  if (nextTime && now < nextTime) return null;

  const weather = getZoneWeather(zoneId);
  const weatherMod = WEATHER_SPAWN_MODIFIERS[weather.type];
  const interval = getRandomInterval() / weatherMod.rateMultiplier;
  nextSpawnTime.set(key, now + interval);

  return spawnMonster(zoneId, accountId, playerRank, "timer");
}

export function checkActionSpawn(zoneId: string, accountId: string, playerRank: string): SpawnedMonster | null {
  const key = `${zoneId}:${accountId}`;
  if (activeMonsters.has(key)) return null;

  const weather = getZoneWeather(zoneId);
  const weatherMod = WEATHER_SPAWN_MODIFIERS[weather.type];
  const effectiveChance = ACTION_SPAWN_CHANCE * weatherMod.rateMultiplier;

  if (Math.random() < effectiveChance) {
    return spawnMonster(zoneId, accountId, playerRank, "action");
  }
  return null;
}

export function calculateMonsterRewards(monster: SpawnedMonster): {
  gold: number;
  trainingPoints: number;
  soulShards: number;
  petExp: number;
} {
  const baseGold = 50 + monster.level * 10;
  const baseTP = 5 + monster.level * 2;
  const baseShards = Math.floor(monster.level / 5);
  const basePetExp = 10 + monster.level * 5;

  const rewardMult = monster.template.rewardMultiplier;

  return {
    gold: Math.floor(baseGold * rewardMult),
    trainingPoints: Math.floor(baseTP * rewardMult),
    soulShards: Math.max(0, Math.floor(baseShards * rewardMult)),
    petExp: Math.floor(basePetExp * rewardMult),
  };
}

export function getAllZoneWeather(): Record<string, WeatherState> {
  const allZones = Object.keys(ZONE_MONSTER_TEMPLATES);
  const result: Record<string, WeatherState> = {};
  for (const zone of allZones) {
    result[zone] = getZoneWeather(zone);
  }
  return result;
}

export function getActiveMonsterCount(): number {
  const now = Date.now();
  let count = 0;
  const entries = Array.from(activeMonsters.entries());
  for (const [key, monster] of entries) {
    if (now > monster.expiresAt) {
      activeMonsters.delete(key);
    } else {
      count++;
    }
  }
  return count;
}

export function getZoneMonsterTemplates(zoneId: string): MonsterTemplate[] {
  return ZONE_MONSTER_TEMPLATES[zoneId] || [];
}

export function getWeatherExclusiveBosses(): MonsterTemplate[] {
  return [...WEATHER_EXCLUSIVE_BOSSES];
}

export { WEATHER_SPAWN_MODIFIERS, ZONE_MONSTER_TEMPLATES, ACTION_SPAWN_CHANCE, TIMER_SPAWN_INTERVAL_MS };
