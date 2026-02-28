import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Castle, Mountain, Sword, Swords,
  Trees, Gem, Fish, Shield, Flame, Map, Sparkles, Trophy, 
  ShoppingBag, FlaskConical, Palette, Users
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import { LoadingScreen } from "@/components/loading-screen";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  { id: "your-base", name: "Your Base", description: "Your personal fortress.", landmark: "castle", difficulty: "starter", pvpEnabled: false, activities: ["Storage", "Crafting"], coordinates: { x: 50, y: 52 }, route: "/base" },
  { id: "capital-city", name: "Capital City", description: "The central hub of the realm.", landmark: "city", difficulty: "starter", pvpEnabled: false, activities: ["Shop", "Trade"], coordinates: { x: 32, y: 48 }, route: "/shop" },
  { id: "mystic-tower", name: "Mystic Tower", description: "A towering spire.", landmark: "tower", difficulty: "hard", pvpEnabled: false, activities: ["Battles"], coordinates: { x: 50, y: 18 }, route: "/npc-battle" },
  { id: "mountain-caverns", name: "Mountain Caverns", description: "Deep caves.", landmark: "cave", difficulty: "easy", pvpEnabled: true, rankRequired: "Apprentice", activities: ["Mining"], coordinates: { x: 78, y: 22 }, route: "/mining" },
  { id: "ancient-ruins", name: "Ancient Ruins", description: "Crumbling temples.", landmark: "ruins", difficulty: "medium", pvpEnabled: true, activities: ["Exploration"], coordinates: { x: 18, y: 28 }, route: "/quests" },
  { id: "research-lab", name: "Research Lab", description: "Scholars study arcane arts.", landmark: "lab", difficulty: "medium", pvpEnabled: false, activities: ["Skills"], coordinates: { x: 35, y: 72 }, route: "/skills" },
  { id: "pet-training", name: "Pet Training Grounds", description: "Train your pets.", landmark: "arena", difficulty: "starter", pvpEnabled: false, activities: ["Pet Training"], coordinates: { x: 68, y: 62 }, route: "/pets" },
  { id: "pet-shop", name: "Mystic Egg Emporium", description: "Purchase rare pet eggs.", landmark: "shop", difficulty: "medium", pvpEnabled: false, rankRequired: "Journeyman", activities: ["Buy Eggs"], coordinates: { x: 58, y: 74 }, route: "/pet-shop" },
  { id: "ruby-mines", name: "Ruby Mines", description: "Dangerous mines.", landmark: "mine", difficulty: "medium", pvpEnabled: true, rankRequired: "Expert", activities: ["Mining"], coordinates: { x: 86, y: 48 }, route: "/ruby-mines" },
  { id: "enchanted-forest", name: "Enchanted Forest", description: "A mystical woodland.", landmark: "forest", difficulty: "easy", pvpEnabled: false, activities: ["Gathering"], coordinates: { x: 12, y: 55 }, route: "/birds" },
  { id: "battle-arena", name: "Battle Arena", description: "Prove your worth.", landmark: "colosseum", difficulty: "hard", pvpEnabled: true, activities: ["PvP"], coordinates: { x: 65, y: 33 }, route: "/leaderboard" },
  { id: "tournament-grounds", name: "Tournament Grounds", description: "Compete in tournaments.", landmark: "banner", difficulty: "hard", pvpEnabled: true, activities: ["Tourney"], coordinates: { x: 72, y: 22 }, route: "/tournaments" },
  { id: "pet-arena", name: "Pet Arena", description: "Pet battles.", landmark: "petarena", difficulty: "medium", pvpEnabled: true, activities: ["Pet PvP"], coordinates: { x: 76, y: 42 }, route: "/pet-arena" },
  { id: "crystal-lake", name: "Crystal Lake", description: "Serene waters.", landmark: "lake", difficulty: "starter", pvpEnabled: false, activities: ["Fishing"], coordinates: { x: 15, y: 78 }, route: "/fishing" },
  { id: "guild-hall", name: "Guild Hall", description: "Join forces.", landmark: "guildhall", difficulty: "starter", pvpEnabled: false, activities: ["Guild"], coordinates: { x: 82, y: 78 }, route: "/guild" },
  { id: "hell-zone", name: "Hell Zone", description: "Permadeath risk.", landmark: "hellgate", difficulty: "hell", pvpEnabled: true, rankRequired: "Grand Master", activities: ["High-Risk"], coordinates: { x: 50, y: 6 }, route: "/hell-zone" },
  { id: "valor-shop", name: "$Valor Shop", description: "Premium bundles.", landmark: "valorshop", difficulty: "starter", pvpEnabled: false, activities: ["Premium"], coordinates: { x: 88, y: 12 }, route: "/valor-shop" },
  { id: "cosmetics-shop", name: "Cosmetics Shop", description: "Customize skins.", landmark: "cosmetics", difficulty: "starter", pvpEnabled: false, activities: ["Skins"], coordinates: { x: 12, y: 15 }, route: "/cosmetics-shop" },
];

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
  return playerIdx >= requiredIdx;
}

export default function WorldMap() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [playerPosition] = useState<string>("your-base");
  const [isTraveling, setIsTraveling] = useState(false);
  const [travelTarget, setTravelTarget] = useState<Zone | null>(null);
  const [travelProgress, setTravelProgress] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleZoneClick = (zone: Zone) => {
    if (!isZoneUnlocked(zone, account?.rank || "Novice")) {
      toast({ title: "Zone Locked", description: `Requires rank: ${zone.rankRequired}`, variant: "destructive" });
      return;
    }
    setSelectedZone(zone);
  };

  const handleTravel = (zone: Zone) => {
    if (!zone.route) return;
    setIsTraveling(true);
    setTravelTarget(zone);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setTravelProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsTraveling(false);
          navigate(zone.route!);
        }, 200);
      }
    }, 40);
  };

  if (!account) return null;

  const currentZone = zones.find(z => z.id === playerPosition);
  const playerCoords = currentZone?.coordinates || { x: 50, y: 50 };

  return (
    <div className="game-page world-map-page overflow-hidden">
      {isTraveling && (
        <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <p className="font-serif text-2xl text-amber-400">Traveling to {travelTarget?.name}...</p>
            <div className="w-64 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all duration-75" style={{ width: `${travelProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full h-full flex items-center justify-center bg-black">
        <div className="relative aspect-[16/9] w-full max-h-full max-w-full" ref={mapRef}>
          <div className="absolute inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/maps/world_map.png')" }} />
          
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none">
            {zones.map((zone) => {
              if (zone.id === playerPosition || !isZoneUnlocked(zone, account.rank || "Novice")) return null;
              return (
                <line key={`path-${zone.id}`} x1={playerCoords.x} y1={playerCoords.y} x2={zone.coordinates.x} y2={zone.coordinates.y}
                  stroke="hsl(45 60% 40%)" strokeWidth="0.2" strokeDasharray="1 1" opacity="0.4" />
              );
            })}
          </svg>

          {zones.map((zone) => {
            const unlocked = isZoneUnlocked(zone, account.rank || "Novice");
            const isSelected = selectedZone?.id === zone.id;
            return (
              <button key={zone.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 focus:outline-none"
                style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
                onMouseEnter={() => unlocked && setHoveredZone(zone)} onMouseLeave={() => setHoveredZone(null)}
                onClick={() => handleZoneClick(zone)}>
                <div className={`p-2 rounded-lg border-2 transition-all ${isSelected ? 'bg-amber-900/80 border-amber-400' : 'bg-card/80 border-amber-700/60'}`}>
                  <LandmarkIcon landmark={zone.landmark} className={unlocked ? 'text-amber-400' : 'text-gray-500'} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedZone} onOpenChange={() => setSelectedZone(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-amber-900/50 text-amber-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-amber-400">{selectedZone?.name}</DialogTitle>
            <DialogDescription className="text-zinc-400">{selectedZone?.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="flex flex-wrap gap-2">
               {selectedZone?.activities.map(act => <Badge key={act} variant="outline" className="border-amber-700/50 text-amber-200">{act}</Badge>)}
             </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold" onClick={() => selectedZone && handleTravel(selectedZone)}>Travel Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
