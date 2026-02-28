import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";

const RANK_LEVELS: Record<string, number> = {
  "Novice": 1, "Apprentice": 2, "Initiate": 3, "Journeyman": 4,
  "Adept": 5, "Expert": 6, "Master": 7, "Grandmaster": 8,
  "Champion": 9, "Overlord": 10, "Sovereign": 11, "Ascendant": 12,
  "Legend": 13, "Mythic": 14, "Mythical Legend": 15,
};

const ZONE_NAMES: Record<string, string> = {
  "/world-map": "World Map",
  "/shop": "General Shop",
  "/inventory": "Inventory",
  "/events": "Events Hall",
  "/challenges": "Challenge Board",
  "/pets": "Pet Sanctuary",
  "/npc-battle": "NPC Battle",
  "/leaderboard": "Hall of Fame",
  "/quests": "Quest Board",
  "/guild": "Guild Hall",
  "/skills": "Skill Chamber",
  "/trading": "Trading Post",
  "/ai-chat": "Game Master",
  "/birds": "Aviary",
  "/fishing": "Fishing Grounds",
  "/base": "Home Base",
  "/pet-arena": "Pet Arena",
  "/achievements": "Trophy Hall",
  "/valor-shop": "Valor Shop",
  "/cosmetics-shop": "Cosmetics",
  "/tournaments": "Tournament Arena",
  "/pet-shop": "Pet Shop",
  "/mining": "Mining Camp",
  "/ruby-mines": "Ruby Mines",
  "/hell-zone": "Hell Zone",
  "/valorpedia": "Valorpedia",
  "/admin": "Admin Console",
};

interface PetData {
  id: string;
  name: string;
  element: string;
  tier: string;
  stats: { Str: number; Spd: number; Luck: number; ElementalPower: number };
  isFainted: boolean;
}

interface BirdData {
  id: string;
  name: string;
  tier: string;
  stats: { Def: number; Spd: number };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function GameHUD() {
  const [location, navigate] = useLocation();
  const { account } = useGame();
  const [energyData, setEnergyData] = useState<{ energy: number; maxEnergy: number } | null>(null);
  const [activePet, setActivePet] = useState<PetData | null>(null);
  const [activeBird, setActiveBird] = useState<BirdData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isVisible = location !== "/" && !!account;
  const accountId = account?.id;
  const accountRole = account?.role;
  const equippedPetId = account?.equippedPetId;

  useEffect(() => {
    if (!isVisible || !accountId || accountRole !== "player") return;
    const fetchEnergy = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/energy`);
        if (res.ok) {
          const data = await res.json();
          setEnergyData({ energy: data.energy, maxEnergy: data.maxEnergy });
        }
      } catch {}
    };
    fetchEnergy();
    const interval = setInterval(fetchEnergy, 30000);
    return () => clearInterval(interval);
  }, [isVisible, accountId, accountRole]);

  useEffect(() => {
    if (!isVisible || !accountId) {
      setActivePet(null);
      return;
    }
    if (!equippedPetId) {
      setActivePet(null);
      return;
    }
    const fetchPet = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/pets`);
        if (res.ok) {
          const pets: PetData[] = await res.json();
          const equipped = pets.find(p => p.id === equippedPetId);
          setActivePet(equipped || null);
        }
      } catch {}
    };
    fetchPet();
  }, [isVisible, accountId, equippedPetId]);

  useEffect(() => {
    if (!isVisible || !accountId) return;
    const fetchBird = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/birds`);
        if (res.ok) {
          const birds: BirdData[] = await res.json();
          setActiveBird(birds.length > 0 ? birds[0] : null);
        }
      } catch {}
    };
    fetchBird();
  }, [isVisible, accountId]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navigateTo = useCallback((path: string) => {
    setMenuOpen(false);
    navigate(path);
  }, [navigate]);

  if (!isVisible || !account) return null;

  const zoneName = ZONE_NAMES[location] || "Unknown Zone";
  const rankLevel = RANK_LEVELS[account.rank] || 1;
  const energy = energyData?.energy ?? account.energy ?? 50;
  const maxEnergy = energyData?.maxEnergy ?? account.maxEnergy ?? 50;
  const energyPercent = Math.min(100, (energy / maxEnergy) * 100);

  const getPortraitPath = () => {
    if (account.equippedCharacterSkin && account.equippedCharacterSkin !== 'default') {
      return `/skins/character/${account.equippedCharacterSkin}.png`;
    }
    if (account.portrait) {
      if (account.portrait.startsWith('skins/')) return `/${account.portrait}.png`;
      if (account.portrait.includes('/')) return account.portrait;
      return `/portraits/${account.portrait}.png`;
    }
    if (account.race && account.gender) return `/portraits/${account.race}_${account.gender}.png`;
    return '/portraits/human_male.png';
  };

  return (
    <div className="game-hud">
      <div className="hud-top-bar">
        <div className="hud-zone-info">
          <span className="hud-zone-icon">⚔</span>
          <span className="hud-zone-name">{zoneName}</span>
        </div>
        <div className="hud-currencies">
          <div className="hud-currency" title="Gold">
            <span className="hud-currency-icon hud-icon-gold">⬤</span>
            <span className="hud-currency-value">{formatNumber(account.gold || 0)}</span>
          </div>
          <div className="hud-currency" title="Rubies">
            <span className="hud-currency-icon hud-icon-ruby">◆</span>
            <span className="hud-currency-value">{formatNumber(account.rubies || 0)}</span>
          </div>
          <div className="hud-currency" title="$Valor">
            <span className="hud-currency-icon hud-icon-valor">$V</span>
            <span className="hud-currency-value">{formatNumber(account.valorTokens || 0)}</span>
          </div>
          <div className="hud-currency" title="Energy">
            <span className="hud-currency-icon hud-icon-energy">⚡</span>
            <span className="hud-currency-value">{energy}/{maxEnergy}</span>
          </div>
        </div>
      </div>

      <div className="hud-left-strip">
        <button
          className={`hud-icon-btn ${location === '/world-map' ? 'hud-icon-active' : ''}`}
          onClick={() => navigateTo("/world-map")}
          title="World Map"
        >
          <span className="hud-icon-sprite">🗺</span>
        </button>
        <button
          className={`hud-icon-btn ${location === '/inventory' ? 'hud-icon-active' : ''}`}
          onClick={() => navigateTo("/inventory")}
          title="Inventory"
        >
          <span className="hud-icon-sprite">🎒</span>
        </button>
        <button
          className={`hud-icon-btn ${location === '/skills' ? 'hud-icon-active' : ''}`}
          onClick={() => navigateTo("/skills")}
          title="Skills"
        >
          <span className="hud-icon-sprite">📖</span>
        </button>
        <button
          className={`hud-icon-btn ${location === '/quests' ? 'hud-icon-active' : ''}`}
          onClick={() => navigateTo("/quests")}
          title="Quests"
        >
          <span className="hud-icon-sprite">📜</span>
        </button>
        <button
          className={`hud-icon-btn ${menuOpen ? 'hud-icon-active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="More..."
        >
          <span className="hud-icon-sprite">☰</span>
        </button>
      </div>

      {menuOpen && (
        <div className="hud-menu-popup">
          <div className="hud-menu-grid">
            <button className="hud-menu-item" onClick={() => navigateTo("/base")}>
              <span>🏰</span><span>Base</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/shop")}>
              <span>🛒</span><span>Shop</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/pets")}>
              <span>🐾</span><span>Pets</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/birds")}>
              <span>🦅</span><span>Birds</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/guild")}>
              <span>⚜</span><span>Guild</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/trading")}>
              <span>🤝</span><span>Trade</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/fishing")}>
              <span>🎣</span><span>Fish</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/mining")}>
              <span>⛏</span><span>Mine</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/leaderboard")}>
              <span>🏆</span><span>Ranks</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/achievements")}>
              <span>🎖</span><span>Achieve</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/valorpedia")}>
              <span>📚</span><span>Pedia</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/tournaments")}>
              <span>⚔</span><span>Tourney</span>
            </button>
            <button className="hud-menu-item" onClick={() => navigateTo("/events")}>
              <span>📅</span><span>Events</span>
            </button>
            {account.role === "admin" && (
              <button className="hud-menu-item" onClick={() => navigateTo("/admin")}>
                <span>🔧</span><span>Admin</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="hud-bottom-left">
        <div className="hud-player-panel">
          <img
            src={getPortraitPath()}
            alt={account.username}
            className="hud-player-portrait"
            onError={(e) => { (e.target as HTMLImageElement).src = "/portraits/human_male.png"; }}
          />
          <div className="hud-player-info">
            <div className="hud-player-name">
              {account.username}
              {account.vipUntil && new Date(account.vipUntil) > new Date() && (
                <span className="hud-vip-badge">VIP</span>
              )}
            </div>
            <div className="hud-player-rank">
              <span className="hud-rank-badge">Lv.{rankLevel}</span>
              <span className="hud-rank-name">{account.rank}</span>
            </div>
            <div className="hud-bar-container" title={`Energy: ${energy}/${maxEnergy}`}>
              <div className="hud-bar hud-bar-energy">
                <div className="hud-bar-fill" style={{ width: `${energyPercent}%` }} />
              </div>
              <span className="hud-bar-label">⚡ {energy}/{maxEnergy}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hud-bottom-right">
        {activePet && (
          <div className="hud-companion-panel">
            <div className="hud-companion-icon" title={`${activePet.name} (${activePet.tier})`}>
              <span className="hud-companion-emoji">🐾</span>
              {activePet.isFainted && <span className="hud-fainted-overlay">💀</span>}
            </div>
            <div className="hud-companion-info">
              <span className="hud-companion-name">{activePet.name}</span>
              <span className="hud-companion-tier">{activePet.tier} · {activePet.element}</span>
            </div>
          </div>
        )}
        {activeBird && (
          <div className="hud-companion-panel">
            <div className="hud-companion-icon" title={`${activeBird.name} (${activeBird.tier})`}>
              <span className="hud-companion-emoji">🦅</span>
            </div>
            <div className="hud-companion-info">
              <span className="hud-companion-name">{activeBird.name}</span>
              <span className="hud-companion-tier">{activeBird.tier}</span>
            </div>
          </div>
        )}
        {!activePet && !activeBird && (
          <div className="hud-companion-panel hud-companion-empty">
            <span className="hud-companion-emoji">—</span>
            <span className="hud-companion-info-empty">No companion</span>
          </div>
        )}
      </div>

      {account.ghostState && (
        <div className="hud-ghost-overlay">
          <span>👻 GHOST STATE</span>
        </div>
      )}
    </div>
  );
}
