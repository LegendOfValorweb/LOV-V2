import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { 
  Settings, MessageSquare, Volume2, VolumeX, Music,
  Castle, ShoppingBag, Star, Users, Coins, Fish, Pickaxe,
  Trophy, Book, Swords, Calendar, Hammer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AudioPlayer from "./audio-player";

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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <div className="flex items-center gap-3 pointer-events-auto">
          <img 
            src={getPortraitPath()} 
            alt={account.username} 
            className="hud-player-portrait-small" 
            onClick={() => navigateTo("/base")}
            title="View Base"
          />
          <div className="flex flex-col">
            <div className="hud-player-name-small">
              {account.username}
              {account.vipUntil && new Date(account.vipUntil) > new Date() && <span className="hud-vip-badge-mini">VIP</span>}
            </div>
            <div className="hud-player-rank-small">Lv.{rankLevel} {account.rank}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="hud-currencies-compact mr-2">
            <div className="hud-currency-mini" title="Gold">
              <span className="text-amber-500 mr-1 text-[10px]">⬤</span>
              <span>{formatNumber(account.gold || 0)}</span>
            </div>
            <div className="hud-currency-mini" title="Rubies">
              <span className="text-red-500 mr-1 text-[10px]">◆</span>
              <span>{formatNumber(account.rubies || 0)}</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-400" onClick={() => navigateTo("/ai-chat")}>
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-400" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="hud-left-strip">
        <button className={`hud-icon-btn ${location === '/world-map' ? 'hud-icon-active' : ''}`} onClick={() => navigateTo("/world-map")} title="World Map">
          <span className="hud-icon-sprite">🗺</span>
        </button>
        <button className={`hud-icon-btn ${location === '/inventory' ? 'hud-icon-active' : ''}`} onClick={() => navigateTo("/inventory")} title="Inventory">
          <span className="hud-icon-sprite">🎒</span>
        </button>
        <button className={`hud-icon-btn ${location === '/skills' ? 'hud-icon-active' : ''}`} onClick={() => navigateTo("/skills")} title="Skills">
          <span className="hud-icon-sprite">📖</span>
        </button>
        <button className={`hud-icon-btn ${location === '/quests' ? 'hud-icon-active' : ''}`} onClick={() => navigateTo("/quests")} title="Quests">
          <span className="hud-icon-sprite">📜</span>
        </button>
        <button className={`hud-icon-btn ${menuOpen ? 'hud-icon-active' : ''}`} onClick={() => setMenuOpen(!menuOpen)} title="More...">
          <span className="hud-icon-sprite">☰</span>
        </button>
      </div>

      {menuOpen && (
        <div className="hud-menu-popup">
          <div className="hud-menu-grid">
            <button className="hud-menu-item" onClick={() => navigateTo("/base")}>🏰 Base</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/shop")}>🛒 Shop</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/pets")}>🐾 Pets</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/birds")}>🦅 Birds</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/guild")}>⚜ Guild</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/trading")}>🤝 Trade</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/fishing")}>🎣 Fish</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/mining")}>⛏ Mine</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/leaderboard")}>🏆 Ranks</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/achievements")}>🎖 Achieve</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/valorpedia")}>📚 Pedia</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/tournaments")}>⚔ Tourney</button>
            <button className="hud-menu-item" onClick={() => navigateTo("/events")}>📅 Events Hall</button>
            {account.role === "admin" && (
              <button className="hud-menu-item" onClick={() => navigateTo("/admin")}>🔧 Admin</button>
            )}
          </div>
        </div>
      )}

      <div className="hud-bottom-left">
        {/* Profile moved to top-left */}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-zinc-900 border-amber-900/50 text-amber-50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-amber-400">Settings & Music</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div>
              <h3 className="text-xs uppercase text-zinc-500 font-bold mb-3 tracking-widest">Audio Control</h3>
              <AudioPlayer />
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:text-white" onClick={() => window.location.reload()}>
                Reload Game
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

