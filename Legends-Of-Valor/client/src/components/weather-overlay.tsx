import { useState, useEffect } from "react";
import { useLocation } from "wouter";

type WeatherType = "clear" | "rain" | "thunderstorm" | "fog" | "blizzard";
type TimeOfDay = "dawn" | "day" | "dusk" | "night";

interface DayNightState {
  timeOfDay: TimeOfDay;
  cycleProgress: number;
  inGameHour: number;
  inGameMinute: number;
  isNight: boolean;
}

interface WorldTimeData {
  dayNight: DayNightState;
  weather: Record<string, { type: WeatherType }>;
}

const ROUTE_TO_ZONE: Record<string, string> = {
  "/fishing": "crystal_lake",
  "/hell-zone": "hell_zone",
  "/mining": "mountain_caverns",
  "/ruby-mines": "ruby_mines",
  "/pets": "pet_training",
  "/npc-battle": "mystic_tower",
  "/guild": "guild_hall",
  "/base": "capital_city",
  "/shop": "capital_city",
  "/birds": "enchanted_forest",
  "/enchanted-forest": "enchanted_forest",
  "/ancient-ruins": "ancient_ruins",
  "/research-lab": "research_lab",
  "/challenges": "battle_arena",
  "/tournaments": "capital_city",
  "/pet-arena": "pet_training",
  "/pet-shop": "capital_city",
  "/valor-shop": "capital_city",
  "/cosmetics-shop": "capital_city",
  "/black-market": "capital_city",
  "/auction-house": "capital_city",
  "/trading": "capital_city",
  "/quests": "capital_city",
  "/skills": "research_lab",
  "/leaderboard": "capital_city",
  "/inventory": "capital_city",
  "/achievements": "capital_city",
  "/valorpedia": "capital_city",
  "/reputation": "capital_city",
};

export function WeatherOverlay() {
  const [location] = useLocation();
  const [worldTime, setWorldTime] = useState<WorldTimeData | null>(null);
  const [lightning, setLightning] = useState(false);

  useEffect(() => {
    const fetchTime = async () => {
      try {
        const res = await fetch("/api/world-time");
        if (res.ok) {
          const data = await res.json();
          setWorldTime(data);
        }
      } catch (err) {
        console.error("Weather fetch error:", err);
      }
    };

    fetchTime();
    const interval = setInterval(fetchTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentZoneId = ROUTE_TO_ZONE[location] || "capital-city";

  useEffect(() => {
    if (!worldTime) return;
    const zoneWeather = worldTime.weather[currentZoneId];
    const hasThunderstorm = zoneWeather?.type === "thunderstorm";
    if (!hasThunderstorm) return;

    const triggerLightning = () => {
      setLightning(true);
      setTimeout(() => setLightning(false), 150);
    };

    const interval = setInterval(() => {
      if (Math.random() < 0.3) triggerLightning();
    }, 4000);

    return () => clearInterval(interval);
  }, [worldTime, currentZoneId]);

  if (!worldTime) return null;

  const { dayNight, weather } = worldTime;
  const zoneWeather = weather[currentZoneId] || weather["capital-city"] || { type: "clear" };
  const weatherType = zoneWeather.type;

  const hasRain = weatherType === "rain" || weatherType === "thunderstorm";
  const hasFog = weatherType === "fog";
  const hasBlizzard = weatherType === "blizzard";
  const hasThunderstorm = weatherType === "thunderstorm";

  return (
    <div className="weather-overlay-container pointer-events-none">
      {}
      <div
        className={`weather-night-overlay weather-time-${dayNight.timeOfDay}`}
      />

      {}
      {hasRain && (
        <div className="weather-rain-layer">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="weather-raindrop"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {}
      {hasBlizzard && (
        <div className="weather-snow-layer">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="weather-snowflake"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${3 + Math.random() * 3}s`,
                fontSize: `${4 + Math.random() * 6}px`,
              }}
            />
          ))}
        </div>
      )}

      {}
      {hasFog && <div className="weather-fog-layer" />}

      {}
      {lightning && <div className="weather-lightning-flash" />}

      {}
      <div className="weather-hud-indicator">
        <span className="weather-hud-time">
          {dayNight.inGameHour.toString().padStart(2, "0")}:{dayNight.inGameMinute.toString().padStart(2, "0")}
        </span>
        <span className="weather-hud-icon">
          {dayNight.timeOfDay === "night" && "\u{1F319}"}
          {dayNight.timeOfDay === "dawn" && "\u{1F305}"}
          {dayNight.timeOfDay === "day" && "\u2600\uFE0F"}
          {dayNight.timeOfDay === "dusk" && "\u{1F307}"}
        </span>
        <span className="weather-hud-weather-icon">
          {hasThunderstorm && "\u26C8\uFE0F"}
          {hasRain && !hasThunderstorm && "\u{1F327}\uFE0F"}
          {hasFog && "\u{1F32B}\uFE0F"}
          {hasBlizzard && "\u2744\uFE0F"}
          {!hasRain && !hasFog && !hasBlizzard && !hasThunderstorm && "\u2601\uFE0F"}
        </span>
      </div>
    </div>
  );
}
