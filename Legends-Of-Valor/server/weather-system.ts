export type WeatherType = "clear" | "rain" | "thunderstorm" | "fog" | "blizzard";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface DayNightState {
  timeOfDay: TimeOfDay;
  cycleProgress: number;
  inGameHour: number;
  inGameMinute: number;
  isNight: boolean;
  monsterDifficultyMod: number;
  rareSpawnBonus: number;
}

export interface WeatherState {
  type: WeatherType;
  startedAt: number;
  duration: number;
  zoneId: string;
}

export interface WorldTimeInfo {
  dayNight: DayNightState;
  weather: Record<string, WeatherState>;
}

const REAL_MS_PER_GAME_DAY = 30 * 60 * 1000;
const REAL_MS_PER_GAME_HOUR = REAL_MS_PER_GAME_DAY / 24;

const serverStartTime = Date.now();

const zoneWeatherCache = new Map<string, WeatherState>();

const WEATHER_WEIGHTS: Record<WeatherType, number> = {
  clear: 40,
  rain: 25,
  thunderstorm: 10,
  fog: 15,
  blizzard: 10,
};

const WEATHER_DURATION_RANGE = { min: 300000, max: 900000 };

const ALL_ZONES = [
  "capital_city", "mountain_caverns", "ancient_ruins", "enchanted_forest",
  "crystal_lake", "coastal_village", "ruby_mines", "battle_arena",
  "research_lab", "pet_training", "hell_zone", "mystic_tower",
];

function getElapsedGameMs(): number {
  return Date.now() - serverStartTime;
}

export function getDayNightState(): DayNightState {
  const elapsed = getElapsedGameMs();
  const cyclePosition = (elapsed % REAL_MS_PER_GAME_DAY) / REAL_MS_PER_GAME_DAY;

  const inGameTotalMinutes = Math.floor(cyclePosition * 24 * 60);
  const inGameHour = Math.floor(inGameTotalMinutes / 60);
  const inGameMinute = inGameTotalMinutes % 60;

  let timeOfDay: TimeOfDay;
  if (inGameHour >= 5 && inGameHour < 7) {
    timeOfDay = "dawn";
  } else if (inGameHour >= 7 && inGameHour < 18) {
    timeOfDay = "day";
  } else if (inGameHour >= 18 && inGameHour < 20) {
    timeOfDay = "dusk";
  } else {
    timeOfDay = "night";
  }

  const isNight = timeOfDay === "night" || timeOfDay === "dusk";

  const monsterDifficultyMod = isNight ? 1.10 : 1.0;
  const rareSpawnBonus = isNight ? 0.05 : 0.0;

  return {
    timeOfDay,
    cycleProgress: cyclePosition,
    inGameHour,
    inGameMinute,
    isNight,
    monsterDifficultyMod,
    rareSpawnBonus,
  };
}

function rollWeather(zoneId: string): WeatherState {
  const types = Object.keys(WEATHER_WEIGHTS) as WeatherType[];
  const weights = types.map(t => WEATHER_WEIGHTS[t]);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let chosen: WeatherType = "clear";
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = types[i];
      break;
    }
  }

  const duration = WEATHER_DURATION_RANGE.min +
    Math.random() * (WEATHER_DURATION_RANGE.max - WEATHER_DURATION_RANGE.min);

  return {
    type: chosen,
    startedAt: Date.now(),
    duration,
    zoneId,
  };
}

export function getZoneWeatherState(zoneId: string): WeatherState {
  const existing = zoneWeatherCache.get(zoneId);
  const now = Date.now();
  if (existing && now < existing.startedAt + existing.duration) {
    return existing;
  }
  const newWeather = rollWeather(zoneId);
  zoneWeatherCache.set(zoneId, newWeather);
  return newWeather;
}

export function getAllZoneWeatherStates(): Record<string, WeatherState> {
  const result: Record<string, WeatherState> = {};
  for (const zone of ALL_ZONES) {
    result[zone] = getZoneWeatherState(zone);
  }
  return result;
}

export function getWorldTimeInfo(): WorldTimeInfo {
  return {
    dayNight: getDayNightState(),
    weather: getAllZoneWeatherStates(),
  };
}

export function getNightDifficultyMultiplier(): number {
  return getDayNightState().monsterDifficultyMod;
}

export function getNightRareSpawnBonus(): number {
  return getDayNightState().rareSpawnBonus;
}
