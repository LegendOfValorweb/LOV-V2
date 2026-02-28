import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Castle, Mountain, Skull, FlaskConical, Sword, Swords,
  Trees, Gem, Fish, Shield, Flame, Map, Home, Lock,
  Package, ShoppingBag, Users, LogOut, MessageCircle,
  Crown, Coins, Heart, Target, Zap, Sparkles, Palette, Trophy
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import { LoadingScreen } from "@/components/loading-screen";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TutorialOverlay from "@/components/tutorial-overlay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Zone {
  id: string;
  name: string;
  description: string;
  landmark: string;
  difficulty: "starter" | "easy" | "medium" | "hard" | "hell";
  pvpEnabled: boolean;
  rankRequired?: string;
  activities: string[];
  coordinates: { x: number; y: number };
  route?: string;
}

const rankOrder = [
  "Novice", "Apprentice", "Initiate", "Journeyman", "Adept",
  "Expert", "Master", "Grandmaster", "Champion", "Overlord",
  "Sovereign", "Ascendant", "Legend", "Mythic", "Mythical Legend"
];

const zones: Zone[] = [
  {
    id: "your-base",
    name: "Your Base",
    description: "Your personal fortress. Manage rooms, storage, and upgrades.",
    landmark: "castle",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Storage", "Crafting", "Training", "Rest"],
    coordinates: { x: 50, y: 52 },
    route: "/base",
  },
  {
    id: "capital-city",
    name: "Capital City",
    description: "The central hub of the realm. Trade, socialize, and prepare for adventure.",
    landmark: "city",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Shop", "Trading", "Guild Hall", "Quest Board"],
    coordinates: { x: 32, y: 48 },
    route: "/shop",
  },
  {
    id: "mystic-tower",
    name: "Mystic Tower",
    description: "A towering spire filled with increasingly powerful enemies. 100 floors await.",
    landmark: "tower",
    difficulty: "hard",
    pvpEnabled: false,
    activities: ["NPC Battles", "Boss Fights", "Loot Drops"],
    coordinates: { x: 50, y: 18 },
    route: "/npc-battle",
  },
  {
    id: "mountain-caverns",
    name: "Mountain Caverns",
    description: "Deep caves rich with ore and dangerous creatures lurking in the shadows.",
    landmark: "cave",
    difficulty: "easy",
    pvpEnabled: true,
    rankRequired: "Apprentice",
    activities: ["Mining", "Hunting", "Resource Gathering"],
    coordinates: { x: 78, y: 22 },
    route: "/mining",
  },
  {
    id: "ancient-ruins",
    name: "Ancient Ruins",
    description: "Crumbling temples hiding ancient secrets and powerful artifacts.",
    landmark: "ruins",
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["Exploration", "Artifact Hunting", "Boss Encounters"],
    coordinates: { x: 18, y: 28 },
    route: "/quests",
  },
  {
    id: "research-lab",
    name: "Research Lab",
    description: "Where scholars study the arcane arts and craft powerful items.",
    landmark: "lab",
    difficulty: "medium",
    pvpEnabled: false,
    activities: ["Crafting", "Enchanting", "Skill Research"],
    coordinates: { x: 35, y: 72 },
    route: "/skills",
  },
  {
    id: "pet-training",
    name: "Pet Training Grounds",
    description: "Train and evolve your pets to become powerful battle companions.",
    landmark: "arena",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Pet Training", "Pet Battles", "Evolution"],
    coordinates: { x: 68, y: 62 },
    route: "/pets",
  },
  {
    id: "pet-shop",
    name: "Mystic Egg Emporium",
    description: "Purchase rare pet eggs with exceptional starting stats. Rubies only.",
    landmark: "shop",
    difficulty: "medium",
    pvpEnabled: false,
    rankRequired: "Journeyman",
    activities: ["Buy Eggs", "Rare Pets", "Premium Stats"],
    coordinates: { x: 58, y: 74 },
    route: "/pet-shop",
  },
  {
    id: "ruby-mines",
    name: "Ruby Mines",
    description: "Dangerous mines where rubies and rare gems can be found.",
    landmark: "mine",
    difficulty: "medium",
    pvpEnabled: true,
    rankRequired: "Expert",
    activities: ["Gem Mining", "PvP Combat", "Rare Drops"],
    coordinates: { x: 86, y: 48 },
    route: "/ruby-mines",
  },
  {
    id: "enchanted-forest",
    name: "Enchanted Forest",
    description: "A mystical woodland home to faeries, spirits, and rare creatures.",
    landmark: "forest",
    difficulty: "easy",
    pvpEnabled: false,
    activities: ["Gathering", "Pet Capture", "Quests"],
    coordinates: { x: 12, y: 55 },
    route: "/birds",
  },
  {
    id: "battle-arena",
    name: "Battle Arena",
    description: "Prove your worth against other players in sanctioned combat.",
    landmark: "colosseum",
    difficulty: "hard",
    pvpEnabled: true,
    activities: ["PvP Duels", "Rankings"],
    coordinates: { x: 65, y: 33 },
    route: "/leaderboard",
  },
  {
    id: "tournament-grounds",
    name: "Tournament Grounds",
    description: "Compete in grand tournaments for glory and legendary rewards!",
    landmark: "banner",
    difficulty: "hard",
    pvpEnabled: true,
    activities: ["Tournaments", "Brackets", "Championships"],
    coordinates: { x: 72, y: 22 },
    route: "/tournaments",
  },
  {
    id: "pet-arena",
    name: "Pet Arena",
    description: "Challenge other players to 3v3 pet battles. Train your pets and prove dominance!",
    landmark: "petarena",
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["Pet PvP", "3v3 Battles", "Wagers"],
    coordinates: { x: 76, y: 42 },
    route: "/pet-arena",
  },
  {
    id: "crystal-lake",
    name: "Crystal Lake",
    description: "Serene waters hiding valuable fish and aquatic treasures.",
    landmark: "lake",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Fishing", "Relaxation", "Pet Bonding"],
    coordinates: { x: 15, y: 78 },
    route: "/fishing",
  },
  {
    id: "guild-hall",
    name: "Guild Hall",
    description: "Join forces with other players in powerful guilds.",
    landmark: "guildhall",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Guild Management", "Guild Quests", "Social"],
    coordinates: { x: 82, y: 78 },
    route: "/guild",
  },
  {
    id: "hell-zone",
    name: "Hell Zone",
    description: "The most dangerous area. Permadeath risk, but mythic rewards await.",
    landmark: "hellgate",
    difficulty: "hell",
    pvpEnabled: true,
    rankRequired: "Grand Master",
    activities: ["High-Risk PvP", "Mythic Drops", "Battle Royale"],
    coordinates: { x: 50, y: 6 },
    route: "/hell-zone",
  },
  {
    id: "valor-shop",
    name: "$Valor Shop",
    description: "Premium bundles and exclusive rewards. Support the realm!",
    landmark: "valorshop",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Premium Bundles", "Exclusive Items", "Special Offers"],
    coordinates: { x: 88, y: 12 },
    route: "/valor-shop",
  },
  {
    id: "cosmetics-shop",
    name: "Cosmetics Shop",
    description: "Customize your character, pets, birds, and base with unique skins!",
    landmark: "cosmetics",
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Character Skins", "Pet Skins", "Bird Skins", "Base Skins"],
    coordinates: { x: 12, y: 15 },
    route: "/cosmetics-shop",
  },
];

const difficultyColors: Record<string, string> = {
  starter: "text-green-400",
  easy: "text-blue-400",
  medium: "text-yellow-400",
  hard: "text-orange-400",
  hell: "text-red-400",
};

const difficultyGlows: Record<string, string> = {
  starter: "drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]",
  easy: "drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]",
  medium: "drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]",
  hard: "drop-shadow-[0_0_8px_rgba(251,146,60,0.7)]",
  hell: "drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]",
};

const HUNTABLE_ZONES = new Set([
  "mountain-caverns", "ancient-ruins", "enchanted-forest", "crystal-lake",
  "coastal-village", "ruby-mines", "battle-arena", "research-lab",
  "pet-training", "hell-zone", "mystic-tower"
]);

const GATHERABLE_ZONES = new Set([
  "mountain-caverns", "enchanted-forest", "ruby-mines", "crystal-lake",
  "coastal-village", "ancient-ruins", "hell-zone"
]);

function LandmarkIcon({ landmark, className = "" }: { landmark: string; className?: string }) {
  const baseClass = `w-7 h-7 ${className}`;
  switch (landmark) {
    case "castle": return <Castle className={baseClass} />;
    case "city": return <ShoppingBag className={baseClass} />;
    case "tower": return <Sword className={baseClass} />;
    case "cave": return <Mountain className={baseClass} />;
    case "ruins": return <Castle className={baseClass} />;
    case "lab": return <FlaskConical className={baseClass} />;
    case "arena": return <Shield className={baseClass} />;
    case "shop": return <Sparkles className={baseClass} />;
    case "mine": return <Gem className={baseClass} />;
    case "forest": return <Trees className={baseClass} />;
    case "colosseum": return <Sword className={baseClass} />;
    case "banner": return <Trophy className={baseClass} />;
    case "petarena": return <Swords className={baseClass} />;
    case "lake": return <Fish className={baseClass} />;
    case "guildhall": return <Users className={baseClass} />;
    case "hellgate": return <Flame className={baseClass} />;
    case "valorshop": return <Sparkles className={baseClass} />;
    case "cosmetics": return <Palette className={baseClass} />;
    default: return <Map className={baseClass} />;
  }
}

function isZoneUnlocked(zone: Zone, playerRank: string): boolean {
  if (!zone.rankRequired) return true;
  const playerIdx = rankOrder.indexOf(playerRank);
  const requiredIdx = rankOrder.indexOf(zone.rankRequired);
  if (playerIdx === -1 || requiredIdx === -1) return true;
  return playerIdx >= requiredIdx;
}

export default function WorldMap() {
  const [, navigate] = useLocation();
  const { account, logout, setAccount } = useGame();
  const { toast } = useToast();
  const [showTutorial, setShowTutorial] = useState(false);

  const { data: storylineData } = useQuery<any>({
    queryKey: ["/api/ai/storyline", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const res = await fetch(`/api/ai/storyline/${account.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!account?.id,
    staleTime: 60000,
  });

  useEffect(() => {
    if (storylineData && storylineData.tutorialCompleted === false) {
      setShowTutorial(true);
    }
  }, [storylineData]);

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [playerPosition, setPlayerPosition] = useState<string>("your-base");
  const [isTraveling, setIsTraveling] = useState(false);
  const [travelTarget, setTravelTarget] = useState<Zone | null>(null);
  const [travelProgress, setTravelProgress] = useState(0);
  const [battleDialog, setBattleDialog] = useState(false);
  const [isBattling, setIsBattling] = useState(false);
  const [currentEnemy, setCurrentEnemy] = useState<any>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [gatherDialog, setGatherDialog] = useState(false);
  const [isGathering, setIsGathering] = useState(false);
  const [gatherResult, setGatherResult] = useState<any>(null);
  const [zoneResources, setZoneResources] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const welcomeKey = `lov_welcome_played_${account?.id}`;
    const justLoggedIn = sessionStorage.getItem('lov_just_logged_in');
    
    if (account && justLoggedIn) {
      sessionStorage.removeItem('lov_just_logged_in');
      
      const playWelcomeAudio = () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `Welcome to Legends of Valor, ${account.username}! Your adventure awaits. Explore the world, battle fearsome foes, and become a legend!`
          );
          utterance.rate = 0.9;
          utterance.pitch = 1.1;
          utterance.volume = 0.8;
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(v => v.name.includes('English') && v.name.includes('Female')) 
            || voices.find(v => v.lang.startsWith('en'))
            || voices[0];
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          window.speechSynthesis.speak(utterance);
        }
      };
      
      setTimeout(() => {
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => playWelcomeAudio();
        } else {
          playWelcomeAudio();
        }
      }, 500);
    }
    
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [account?.id, account?.username]);

  const { data: zoneDifficulties, isLoading: isZonesLoading } = useQuery<any>({
    queryKey: ["/api/zone-difficulties"],
    queryFn: async () => {
      const res = await fetch("/api/zone-difficulties");
      return res.json();
    },
  });

  const { data: enemyArchetypes, isLoading: isArchetypesLoading } = useQuery<any>({
    queryKey: ["/api/enemy-archetypes"],
    queryFn: async () => {
      const res = await fetch("/api/enemy-archetypes");
      return res.json();
    },
  });

  const { data: equippedSkins, isLoading: isSkinsLoading } = useQuery<{ character?: string; pet?: string; bird?: string; base?: string }>({
    queryKey: [`/api/accounts/${account?.id}/skins`],
    queryFn: async () => {
      const res = await fetch(`/api/accounts/${account?.id}/skins`);
      return res.json();
    },
    enabled: !!account,
  });

  const isPageLoading = isZonesLoading || isArchetypesLoading || isSkinsLoading;

  if (!account) {
    navigate("/");
    return null;
  }

  const handleZoneHover = (zone: Zone, e: React.MouseEvent) => {
    setHoveredZone(zone);
    const rect = mapRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleZoneClick = (zone: Zone) => {
    const unlocked = isZoneUnlocked(zone, account.rank || "Novice");
    if (!unlocked) {
      toast({
        title: "Zone Locked",
        description: `Requires rank: ${zone.rankRequired}`,
        variant: "destructive",
      });
      return;
    }
    setSelectedZone(zone);
  };

  const handleTravelToZone = (zone: Zone) => {
    if (!zone.route) return;
    setIsTraveling(true);
    setTravelTarget(zone);
    setTravelProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setTravelProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setPlayerPosition(zone.id);
          setIsTraveling(false);
          setTravelTarget(null);
          setTravelProgress(0);
          setSelectedZone(null);
          navigate(zone.route!);
        }, 200);
      }
    }, 40);
  };

  const handleHuntInZone = async (zone: Zone) => {
    if (!account) return;
    setBattleDialog(true);
    setBattleResult(null);
    
    try {
      const res = await fetch(`/api/zones/${zone.id.replace(/-/g, "_")}/generate-enemy?accountId=${account.id}`);
      const data = await res.json();
      
      if (res.ok) {
        setCurrentEnemy(data);
      } else {
        toast({
          title: "Cannot Hunt",
          description: data.error || "Failed to find enemies",
          variant: "destructive",
        });
        setBattleDialog(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to find enemies in this zone",
        variant: "destructive",
      });
      setBattleDialog(false);
    }
  };

  const handleBattle = async () => {
    if (!account || !selectedZone || !currentEnemy) return;
    setIsBattling(true);
    
    try {
      const res = await apiRequest("POST", `/api/zones/${selectedZone.id.replace(/-/g, "_")}/battle`, {
        accountId: account.id,
      });
      const data = await res.json();
      setBattleResult(data);
      
      if (data.result === "victory") {
        toast({
          title: "Victory!",
          description: `Defeated ${data.enemy.name}! Earned ${data.rewards.gold} gold.`,
        });
        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) {
          setAccount(await accRes.json());
        }
      } else {
        toast({
          title: "Defeat",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Battle Error",
        description: error.message || "Battle failed",
        variant: "destructive",
      });
    } finally {
      setIsBattling(false);
    }
  };

  const handleFightAgain = async () => {
    if (selectedZone) {
      setBattleResult(null);
      setCurrentEnemy(null);
      await handleHuntInZone(selectedZone);
    }
  };

  const handleGatherInZone = async (zone: Zone) => {
    if (!account) return;
    setGatherDialog(true);
    setGatherResult(null);
    
    try {
      const res = await fetch(`/api/zones/${zone.id.replace(/-/g, "_")}/resources`);
      const data = await res.json();
      
      if (res.ok) {
        setZoneResources(data);
      } else {
        toast({
          title: "Cannot Gather",
          description: data.error || "No resources in this zone",
          variant: "destructive",
        });
        setGatherDialog(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load zone resources",
        variant: "destructive",
      });
      setGatherDialog(false);
    }
  };

  const handleGather = async () => {
    if (!account || !selectedZone) return;
    setIsGathering(true);
    
    try {
      const res = await apiRequest("POST", `/api/zones/${selectedZone.id.replace(/-/g, "_")}/gather`, {
        accountId: account.id,
      });
      const data = await res.json();
      setGatherResult(data);
      
      if (data.success && data.totalGold > 0) {
        toast({
          title: "Gathering Complete!",
          description: `Earned ${data.totalGold.toLocaleString()} gold from resources!`,
        });
        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) {
          setAccount(await accRes.json());
        }
      }
    } catch (error: any) {
      toast({
        title: "Gathering Error",
        description: error.message || "Failed to gather",
        variant: "destructive",
      });
    } finally {
      setIsGathering(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const currentZone = zones.find(z => z.id === playerPosition);
  const playerCoords = currentZone?.coordinates || { x: 50, y: 50 };

  if (isPageLoading) {
    return <LoadingScreen message="Preparing the realm..." />;
  }

  return (
    <div className="game-page world-map-page">
      {showTutorial && (
        <TutorialOverlay onComplete={() => setShowTutorial(false)} />
      )}
      {isTraveling && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center transition-opacity duration-300">
          <div className="text-center space-y-4">
            <p className="font-serif text-2xl text-amber-400 rpg-embossed animate-pulse">
              Traveling to {travelTarget?.name}...
            </p>
            <div className="w-64 h-3 rpg-progress-bar mx-auto">
              <div
                className="bar-fill rpg-progress-xp"
                style={{ width: `${travelProgress}%`, transition: 'width 0.04s linear' }}
              />
            </div>
            <p className="text-sm text-muted-foreground italic">
              The road stretches before you...
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-0" ref={mapRef}>
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/maps/world_map.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" style={{ opacity: 0.3 }}>
          {zones.map((zone) => {
            if (zone.id === playerPosition) return null;
            const unlocked = isZoneUnlocked(zone, account.rank || "Novice");
            if (!unlocked) return null;
            return (
              <line
                key={`path-${zone.id}`}
                x1={`${playerCoords.x}%`}
                y1={`${playerCoords.y}%`}
                x2={`${zone.coordinates.x}%`}
                y2={`${zone.coordinates.y}%`}
                stroke="hsl(45 60% 40%)"
                strokeWidth="1"
                strokeDasharray="6 4"
                opacity="0.4"
              />
            );
          })}
        </svg>

        {zones.map((zone) => {
          const unlocked = isZoneUnlocked(zone, account.rank || "Novice");
          const isSelected = selectedZone?.id === zone.id;
          const isPlayerHere = playerPosition === zone.id;

          return (
            <button
              key={zone.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group transition-all duration-300 focus:outline-none
                ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}
              `}
              style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
              onClick={() => handleZoneClick(zone)}
              onMouseEnter={(e) => handleZoneHover(zone, e)}
              onMouseMove={(e) => handleZoneHover(zone, e)}
              onMouseLeave={() => setHoveredZone(null)}
            >
              <div className={`relative flex flex-col items-center transition-transform duration-300
                ${isSelected ? 'scale-125' : 'group-hover:scale-110'}
                ${!unlocked ? 'opacity-40 grayscale' : ''}
              `}>
                <div className={`relative p-2 rounded-lg border-2 transition-all duration-300
                  ${isSelected 
                    ? 'bg-amber-900/80 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]' 
                    : unlocked 
                      ? `bg-card/80 border-amber-700/60 group-hover:border-amber-500/80 group-hover:shadow-[0_0_12px_rgba(251,191,36,0.3)]`
                      : 'bg-gray-900/60 border-gray-600/40'
                  }
                  ${zone.difficulty === 'hell' && unlocked ? 'animate-pulse border-red-500/70' : ''}
                `}>
                  <div className={`${difficultyColors[zone.difficulty]} ${unlocked ? difficultyGlows[zone.difficulty] : ''}`}>
                    <LandmarkIcon landmark={zone.landmark} />
                  </div>

                  {!unlocked && (
                    <div className="absolute -top-1 -right-1 bg-gray-800 border border-gray-500 rounded-full p-0.5">
                      <Lock className="w-3 h-3 text-gray-400" />
                    </div>
                  )}

                  {zone.pvpEnabled && unlocked && (
                    <div className="absolute -top-1 -right-1 bg-red-900/90 border border-red-500/60 rounded-full p-0.5">
                      <Skull className="w-3 h-3 text-red-400" />
                    </div>
                  )}

                  {isPlayerHere && (
                    <div className="absolute -bottom-1 -left-1 w-4 h-4">
                      <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-50" />
                      <div className="absolute inset-0 bg-green-400 rounded-full border border-green-300" />
                    </div>
                  )}
                </div>

                <span className={`mt-1 text-[10px] font-serif font-bold whitespace-nowrap px-1.5 py-0.5 rounded
                  ${isSelected 
                    ? 'bg-amber-900/90 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.3)]' 
                    : unlocked 
                      ? 'bg-black/70 text-amber-200/90' 
                      : 'bg-black/50 text-gray-500'
                  }
                `}>
                  {zone.name}
                </span>
              </div>
            </button>
          );
        })}

        {hoveredZone && (
          <div
            className="absolute z-50 pointer-events-none rpg-tooltip max-w-[220px]"
            style={{
              left: `${Math.min(tooltipPos.x + 16, (mapRef.current?.clientWidth || 800) - 240)}px`,
              top: `${Math.max(tooltipPos.y - 80, 8)}px`,
            }}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`font-serif font-bold text-sm ${difficultyColors[hoveredZone.difficulty]}`}>
                  {hoveredZone.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{hoveredZone.description}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`uppercase font-bold ${difficultyColors[hoveredZone.difficulty]}`}>
                  {hoveredZone.difficulty}
                </span>
                {hoveredZone.pvpEnabled && (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <Skull className="w-3 h-3" /> PvP
                  </span>
                )}
              </div>
              {hoveredZone.rankRequired && (
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <Lock className="w-3 h-3" />
                  Requires: {hoveredZone.rankRequired}
                </div>
              )}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {hoveredZone.activities.slice(0, 3).map((a) => (
                  <span key={a} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-amber-300/80">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedZone && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
          <div className="rpg-panel-ornate p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-black/40 ${difficultyColors[selectedZone.difficulty]}`}>
                <LandmarkIcon landmark={selectedZone.landmark} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif font-bold text-amber-200 text-lg">{selectedZone.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs uppercase font-bold ${difficultyColors[selectedZone.difficulty]}`}>
                    {selectedZone.difficulty}
                  </span>
                  {selectedZone.pvpEnabled && (
                    <span className="text-xs text-red-400 flex items-center gap-0.5">
                      <Skull className="w-3 h-3" /> PvP Zone
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedZone(null)}
                className="rpg-close-button"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground rpg-dialogue">{selectedZone.description}</p>

            {selectedZone.rankRequired && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/5 border border-yellow-500/20 p-1.5 rounded">
                <Lock className="w-3.5 h-3.5" />
                Requires: {selectedZone.rankRequired}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {selectedZone.activities.map((activity) => (
                <span key={activity} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-amber-300/80 font-serif">
                  {activity}
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                className="rpg-button flex-1 px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                onClick={() => handleTravelToZone(selectedZone)}
                disabled={!selectedZone.route || isTraveling}
              >
                {selectedZone.route ? (
                  <>
                    <Map className="w-4 h-4" />
                    Travel
                  </>
                ) : "Coming Soon"}
              </button>
              {HUNTABLE_ZONES.has(selectedZone.id) && (
                <button
                  className="rpg-button-danger flex-1 px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                  onClick={() => handleHuntInZone(selectedZone)}
                >
                  <Target className="w-4 h-4" />
                  Hunt
                </button>
              )}
              {GATHERABLE_ZONES.has(selectedZone.id) && (
                <button
                  className="rpg-button-secondary flex-1 px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                  onClick={() => handleGatherInZone(selectedZone)}
                >
                  <Gem className="w-4 h-4" />
                  Gather
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={battleDialog} onOpenChange={(open) => { setBattleDialog(open); if (!open) { setCurrentEnemy(null); setBattleResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-500" />
              {battleResult ? (battleResult.result === "victory" ? "Victory!" : "Defeat") : "Zone Battle"}
            </DialogTitle>
            <DialogDescription>
              {selectedZone?.name} - {selectedZone?.difficulty.toUpperCase()} Difficulty
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!battleResult && currentEnemy && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{currentEnemy.name}</h3>
                    <Badge variant="destructive">{currentEnemy.archetype}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">STR:</span>
                      <span className="ml-1 font-mono">{currentEnemy.stats?.Str}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DEF:</span>
                      <span className="ml-1 font-mono">{currentEnemy.stats?.Def}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SPD:</span>
                      <span className="ml-1 font-mono">{currentEnemy.stats?.Spd}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span>{currentEnemy.hp} HP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      <span>{currentEnemy.rewards?.gold} gold</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <h4 className="font-medium mb-2">Your Stats</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">STR:</span>
                      <span className="ml-1 font-mono">{account?.stats?.Str || 10}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DEF:</span>
                      <span className="ml-1 font-mono">{account?.stats?.Def || 10}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">SPD:</span>
                      <span className="ml-1 font-mono">{account?.stats?.Spd || 10}</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  variant="destructive"
                  onClick={handleBattle}
                  disabled={isBattling}
                >
                  {isBattling ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Fighting...
                    </>
                  ) : (
                    <>
                      <Sword className="w-4 h-4 mr-2" />
                      Attack!
                    </>
                  )}
                </Button>
              </div>
            )}

            {battleResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${battleResult.result === "victory" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                  <p className="font-medium text-lg mb-2">{battleResult.message}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Damage Dealt:</span>
                      <span className="ml-1 font-mono text-green-400">{battleResult.damageDealt}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Damage Taken:</span>
                      <span className="ml-1 font-mono text-red-400">{battleResult.damageTaken}</span>
                    </div>
                  </div>
                  {battleResult.result === "victory" && battleResult.rewards && (
                    <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        Rewards: {battleResult.rewards.gold} gold
                        {battleResult.rewards.rubies > 0 && `, ${battleResult.rewards.rubies} rubies`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleFightAgain} className="flex-1" variant="destructive">
                    <Target className="w-4 h-4 mr-2" />
                    Hunt Again
                  </Button>
                  <Button onClick={() => { setBattleDialog(false); setBattleResult(null); setCurrentEnemy(null); }} variant="outline" className="flex-1">
                    Leave
                  </Button>
                </div>
              </div>
            )}

            {!currentEnemy && !battleResult && (
              <div className="text-center py-8">
                <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Searching for enemies...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gatherDialog} onOpenChange={(open) => { setGatherDialog(open); if (!open) { setZoneResources(null); setGatherResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="w-5 h-5 text-emerald-500" />
              {gatherResult ? "Gathering Complete" : "Resource Gathering"}
            </DialogTitle>
            <DialogDescription>
              {selectedZone?.name} - {zoneResources?.gatheringTime || 30}s per attempt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!gatherResult && zoneResources && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <h3 className="font-semibold mb-3">Available Resources</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {zoneResources.resources?.map((resource: any) => (
                      <div key={resource.id} className="flex items-center gap-2 text-sm">
                        <Badge variant={
                          resource.rarity === 'epic' ? 'default' :
                          resource.rarity === 'rare' ? 'secondary' : 'outline'
                        } className={
                          resource.rarity === 'epic' ? 'bg-purple-500' :
                          resource.rarity === 'rare' ? 'bg-blue-500' :
                          resource.rarity === 'uncommon' ? 'bg-green-500' : ''
                        }>
                          {resource.rarity}
                        </Badge>
                        <span>{resource.name}</span>
                        <span className="text-yellow-400 ml-auto">{resource.goldValue}g</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
                  <p className="text-muted-foreground">
                    Your INT stat ({account?.stats?.Int || 10}) and rank affect gathering efficiency.
                    More gatherers in the zone reduce yields.
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={handleGather}
                  disabled={isGathering}
                >
                  {isGathering ? (
                    <>
                      <Gem className="w-4 h-4 mr-2 animate-pulse" />
                      Gathering...
                    </>
                  ) : (
                    <>
                      <Gem className="w-4 h-4 mr-2" />
                      Start Gathering
                    </>
                  )}
                </Button>
              </div>
            )}

            {gatherResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${gatherResult.gathered?.length > 0 ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}>
                  <p className="font-medium text-lg mb-2">{gatherResult.message}</p>
                  
                  {gatherResult.gathered?.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {gatherResult.gathered.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              item.rarity === 'epic' ? 'default' :
                              item.rarity === 'rare' ? 'secondary' : 'outline'
                            } className={
                              item.rarity === 'epic' ? 'bg-purple-500' :
                              item.rarity === 'rare' ? 'bg-blue-500' :
                              item.rarity === 'uncommon' ? 'bg-green-500' : ''
                            }>
                              {item.rarity}
                            </Badge>
                            <span>{item.quantity}x {item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {gatherResult.totalGold > 0 && (
                    <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        Total Value: {gatherResult.totalGold.toLocaleString()} gold
                      </p>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Efficiency: {gatherResult.efficiency}x</div>
                    <div>Competition: {gatherResult.competition} gatherers</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => { setGatherResult(null); }} className="flex-1">
                    <Gem className="w-4 h-4 mr-2" />
                    Gather Again
                  </Button>
                  <Button onClick={() => { setGatherDialog(false); setGatherResult(null); setZoneResources(null); }} variant="outline" className="flex-1">
                    Leave
                  </Button>
                </div>
              </div>
            )}

            {!zoneResources && !gatherResult && (
              <div className="text-center py-8">
                <Gem className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Loading zone resources...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}