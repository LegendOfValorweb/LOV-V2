import { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Castle, Mountain, Sword, Swords,
  Trees, Gem, Fish, Shield, Flame, Map, Sparkles, Trophy, 
  ShoppingBag, FlaskConical, Palette, Users, Lock
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
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

const difficultyColor: Record<string, string> = {
  starter: "text-green-400",
  easy: "text-lime-400",
  medium: "text-yellow-400",
  hard: "text-orange-400",
  hell: "text-red-500",
};

// RE-ALIGNED COORDINATES FOR world_map.png
const zones: Zone[] = [
  { id: "your-base", name: "Your Base", description: "Your personal fortress — upgrade rooms, store loot and train offline.", landmark: "castle", difficulty: "starter", pvpEnabled: false, activities: ["Storage", "Crafting", "Training", "Vault"], coordinates: { x: 52, y: 48 }, route: "/base" },
  { id: "capital-city", name: "Capital City", description: "The bustling central hub. Buy weapons, armor and potions.", landmark: "city", difficulty: "starter", pvpEnabled: false, activities: ["Shop", "Trade"], coordinates: { x: 48, y: 52 }, route: "/shop" },
  { id: "mystic-tower", name: "Mystic Tower", description: "Ascend floors vs. NPC bosses. The primary source of XP and rank-ups.", landmark: "tower", difficulty: "hard", pvpEnabled: false, activities: ["NPC Battles", "Floor Climbs"], coordinates: { x: 40, y: 12 }, route: "/npc-battle" },
  { id: "mountain-caverns", name: "Mountain Caverns", description: "Mine ore and rare crystals. Beware — PvP is enabled here.", landmark: "cave", difficulty: "easy", pvpEnabled: true, rankRequired: "Apprentice", activities: ["Mining", "PvP"], coordinates: { x: 68, y: 22 }, route: "/mining" },
  { id: "ancient-ruins", name: "Ancient Ruins", description: "Crumbling temples full of quests, exploration and ancient artifacts.", landmark: "ruins", difficulty: "medium", pvpEnabled: true, activities: ["Quests", "Exploration", "PvP"], coordinates: { x: 22, y: 45 }, route: "/quests" },
  { id: "research-lab", name: "Research Lab", description: "Train and upgrade skills. Unlock powerful race abilities here.", landmark: "lab", difficulty: "medium", pvpEnabled: false, activities: ["Skill Training"], coordinates: { x: 38, y: 55 }, route: "/skills" },
  { id: "pet-training", name: "Pet Sanctuary", description: "Hatch eggs, train and equip your pet companions.", landmark: "arena", difficulty: "starter", pvpEnabled: false, activities: ["Hatch Eggs", "Pet Training", "Equip Pets"], coordinates: { x: 84, y: 55 }, route: "/pets" },
  { id: "pet-shop", name: "Egg Emporium", description: "Buy rare and epic pet eggs from exotic traders.", landmark: "shop", difficulty: "medium", pvpEnabled: false, rankRequired: "Journeyman", activities: ["Rare Eggs", "Epic Eggs"], coordinates: { x: 78, y: 44 }, route: "/pet-shop" },
  { id: "ruby-mines", name: "Ruby Mines", description: "Volcanic mines rich in Rubies and rare gems. High risk, high reward.", landmark: "mine", difficulty: "medium", pvpEnabled: true, rankRequired: "Expert", activities: ["Ruby Mining", "PvP"], coordinates: { x: 88, y: 68 }, route: "/ruby-mines" },
  { id: "enchanted-forest", name: "Enchanted Forest", description: "A mystical woodland. Train Birds and gather rare herbs.", landmark: "forest", difficulty: "easy", pvpEnabled: false, activities: ["Bird Training", "Gathering"], coordinates: { x: 32, y: 46 }, route: "/birds" },
  { id: "battle-arena", name: "Battle Arena", description: "PvP colosseum. Fight other players for glory and Elo ranking.", landmark: "colosseum", difficulty: "hard", pvpEnabled: true, activities: ["PvP", "Leaderboard"], coordinates: { x: 42, y: 65 }, route: "/leaderboard" },
  { id: "tournament-grounds", name: "Tournament Grounds", description: "Organized tournaments with betting, brackets and grand prizes.", landmark: "banner", difficulty: "hard", pvpEnabled: true, activities: ["Tournaments", "Betting"], coordinates: { x: 75, y: 32 }, route: "/tournaments" },
  { id: "pet-arena", name: "Pet Arena", description: "Send your pets to battle. PvP with your companion lineup.", landmark: "petarena", difficulty: "medium", pvpEnabled: true, activities: ["Pet PvP"], coordinates: { x: 70, y: 58 }, route: "/pet-arena" },
  { id: "crystal-lake", name: "Crystal Lake", description: "Peaceful fishing grounds. Catch fish for gold and rare crafting materials.", landmark: "lake", difficulty: "starter", pvpEnabled: false, activities: ["Fishing"], coordinates: { x: 18, y: 58 }, route: "/fishing" },
  { id: "guild-hall", name: "Guild Hall", description: "Join a guild for dungeons, quests and world boss events.", landmark: "guildhall", difficulty: "starter", pvpEnabled: false, activities: ["Guild", "Dungeons", "Unity Quests"], coordinates: { x: 80, y: 62 }, route: "/guild" },
  { id: "hell-zone", name: "Hell Zone", description: "Permadeath risk. The Collapse — last one standing wins Mythic rewards.", landmark: "hellgate", difficulty: "hell", pvpEnabled: true, rankRequired: "Grandmaster", activities: ["Battle Royale", "High-Risk PvP"], coordinates: { x: 50, y: 8 }, route: "/hell-zone" },
  { id: "valor-shop", name: "$Valor Shop", description: "Premium bundles — VIP, exclusive eggs, rare skins and buffs.", landmark: "valorshop", difficulty: "starter", pvpEnabled: false, activities: ["Premium Items", "VIP"], coordinates: { x: 86, y: 15 }, route: "/valor-shop" },
  { id: "cosmetics-shop", name: "Cosmetics Shop", description: "Unlock character skins, base skins and cosmetic items.", landmark: "cosmetics", difficulty: "starter", pvpEnabled: false, activities: ["Skins", "Cosmetics"], coordinates: { x: 14, y: 14 }, route: "/cosmetics-shop" },
];

function LandmarkIcon({ landmark, className = "" }: { landmark: string; className?: string }) {
  const baseClass = `w-4 h-4 ${className}`;
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
  const { account } = useGame();
  const { toast } = useToast();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isTraveling, setIsTraveling] = useState(false);
  const [travelTarget, setTravelTarget] = useState<Zone | null>(null);
  const [travelProgress, setTravelProgress] = useState(0);

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

  return (
    <div className="game-page world-map-page bg-black overflow-hidden h-full w-full">
      {isTraveling && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <p className="font-serif text-2xl text-amber-400">Traveling to {travelTarget?.name}...</p>
            <div className="w-64 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all duration-75" style={{ width: `${travelProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full h-full flex items-center justify-center map-container">
        <div className="relative aspect-[16/9] w-full max-h-full max-w-full">
          <img 
            src="/maps/world_map.png" 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none map-image" 
            alt="World Map"
          />

          {zones.map((zone) => {
            const unlocked = isZoneUnlocked(zone, account.rank || "Novice");
            const isSelected = selectedZone?.id === zone.id;
            return (
              <button
                key={zone.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 focus:outline-none map-zone-pin ${isSelected ? 'map-zone-pin-active' : ''} ${!unlocked ? 'map-zone-pin-locked' : ''}`}
                style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
                onClick={() => handleZoneClick(zone)}
              >
                <div className="map-pin-card">
                  <div className="map-pin-icon-row">
                    {!unlocked
                      ? <Lock className="w-3 h-3 text-zinc-500" />
                      : <LandmarkIcon landmark={zone.landmark} className={difficultyColor[zone.difficulty]} />
                    }
                  </div>
                  <span className="map-pin-name">{zone.name}</span>
                  {unlocked && (
                    <div className="map-pin-features">
                      {zone.activities.slice(0, 3).map(act => (
                        <span key={act} className="map-pin-feature-tag">{act}</span>
                      ))}
                    </div>
                  )}
                  <div className="map-pin-features">
                    {zone.rankRequired && !unlocked && (
                      <span className="map-pin-rank-badge">🔒 {zone.rankRequired}</span>
                    )}
                    {zone.pvpEnabled && unlocked && (
                      <span className="map-pin-pvp-badge">⚔ PvP</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedZone} onOpenChange={() => setSelectedZone(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-900/98 border-amber-900/50 text-amber-50 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-amber-400 flex items-center gap-2">
              <LandmarkIcon landmark={selectedZone?.landmark || ""} className={difficultyColor[selectedZone?.difficulty || "starter"]} />
              {selectedZone?.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-300 text-sm leading-relaxed">
              {selectedZone?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-wrap gap-2">
              {selectedZone?.activities.map(act => (
                <Badge key={act} variant="outline" className="border-amber-700/50 text-amber-200 text-xs">
                  {act}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className={`font-semibold capitalize ${difficultyColor[selectedZone?.difficulty || "starter"]}`}>
                {selectedZone?.difficulty} zone
              </span>
              {selectedZone?.pvpEnabled && <span className="text-red-400 font-semibold">⚔ PvP Enabled</span>}
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold"
              onClick={() => selectedZone && handleTravel(selectedZone)}
            >
              Travel to {selectedZone?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
