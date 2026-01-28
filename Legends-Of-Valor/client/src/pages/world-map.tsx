import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Castle, Mountain, Skull, FlaskConical, Sword, 
  Trees, Gem, Fish, Shield, Flame, Map, Home, Lock
} from "lucide-react";
import { useGame } from "@/lib/game-context";

interface Zone {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  difficulty: "starter" | "easy" | "medium" | "hard" | "hell";
  pvpEnabled: boolean;
  rankRequired?: string;
  activities: string[];
  coordinates: { x: number; y: number };
}

const zones: Zone[] = [
  {
    id: "capital-city",
    name: "Capital City",
    description: "The central hub of the realm. Trade, socialize, and prepare for adventure.",
    icon: <Castle className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Trading", "Guild Hall", "Auction House", "Quest Board"],
    coordinates: { x: 50, y: 50 },
  },
  {
    id: "mystic-tower",
    name: "Mystic Tower",
    description: "A towering spire filled with increasingly powerful enemies. 100 floors await.",
    icon: <Sword className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: false,
    activities: ["NPC Battles", "Boss Fights", "Loot Drops"],
    coordinates: { x: 50, y: 25 },
  },
  {
    id: "mountain-caverns",
    name: "Mountain Caverns",
    description: "Deep caves rich with ore and dangerous creatures lurking in the shadows.",
    icon: <Mountain className="w-6 h-6" />,
    difficulty: "easy",
    pvpEnabled: true,
    activities: ["Mining", "Hunting", "Resource Gathering"],
    coordinates: { x: 75, y: 30 },
  },
  {
    id: "ancient-ruins",
    name: "Ancient Ruins",
    description: "Crumbling temples hiding ancient secrets and powerful artifacts.",
    icon: <Castle className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["Exploration", "Artifact Hunting", "Boss Encounters"],
    coordinates: { x: 25, y: 35 },
  },
  {
    id: "research-lab",
    name: "Research Lab",
    description: "Where scholars study the arcane arts and craft powerful items.",
    icon: <FlaskConical className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Crafting", "Enchanting", "Skill Research"],
    coordinates: { x: 35, y: 65 },
  },
  {
    id: "pet-training",
    name: "Pet Training Grounds",
    description: "Train and evolve your pets to become powerful battle companions.",
    icon: <Shield className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Pet Training", "Pet Battles", "Evolution"],
    coordinates: { x: 65, y: 65 },
  },
  {
    id: "ruby-mines",
    name: "Ruby Mines",
    description: "Dangerous mines where rubies and rare gems can be found.",
    icon: <Gem className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: true,
    rankRequired: "Apprentice",
    activities: ["Gem Mining", "PvP Combat", "Rare Drops"],
    coordinates: { x: 85, y: 55 },
  },
  {
    id: "enchanted-forest",
    name: "Enchanted Forest",
    description: "A mystical woodland home to faeries, spirits, and rare creatures.",
    icon: <Trees className="w-6 h-6" />,
    difficulty: "easy",
    pvpEnabled: false,
    activities: ["Gathering", "Pet Capture", "Quests"],
    coordinates: { x: 15, y: 55 },
  },
  {
    id: "battle-arena",
    name: "Battle Arena",
    description: "Prove your worth against other players in sanctioned combat.",
    icon: <Sword className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["PvP Duels", "Tournaments", "Rankings"],
    coordinates: { x: 50, y: 75 },
  },
  {
    id: "crystal-lake",
    name: "Crystal Lake",
    description: "Serene waters hiding valuable fish and aquatic treasures.",
    icon: <Fish className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Fishing", "Relaxation", "Pet Bonding"],
    coordinates: { x: 20, y: 80 },
  },
  {
    id: "coastal-village",
    name: "Coastal Village",
    description: "A peaceful seaside settlement with traders and fishermen.",
    icon: <Home className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Trading", "Fishing", "Quests"],
    coordinates: { x: 80, y: 80 },
  },
  {
    id: "hell-zone",
    name: "Hell Zone",
    description: "The most dangerous area. Permadeath risk, but mythic rewards await.",
    icon: <Flame className="w-6 h-6" />,
    difficulty: "hell",
    pvpEnabled: true,
    rankRequired: "Grand Master",
    activities: ["High-Risk PvP", "Mythic Drops", "Battle Royale"],
    coordinates: { x: 50, y: 10 },
  },
];

const difficultyColors: Record<string, string> = {
  starter: "bg-green-500/20 text-green-400",
  easy: "bg-blue-500/20 text-blue-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  hard: "bg-orange-500/20 text-orange-400",
  hell: "bg-red-500/20 text-red-400",
};

export default function WorldMap() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  if (!account) {
    navigate("/");
    return null;
  }

  const handleZoneClick = (zone: Zone) => {
    setSelectedZone(zone);
  };

  const handleEnterZone = (zone: Zone) => {
    switch (zone.id) {
      case "mystic-tower":
        navigate("/npc-battle");
        break;
      case "pet-training":
        navigate("/pets");
        break;
      case "capital-city":
        navigate("/trading");
        break;
      case "crystal-lake":
        navigate("/fishing");
        break;
      case "battle-arena":
        navigate("/leaderboard");
        break;
      case "research-lab":
        navigate("/skills");
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Map className="w-8 h-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold text-foreground">World Map</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/ai-chat")}>
            Back to Hub
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif">Realm of Valor</CardTitle>
                <CardDescription>Click on a zone to view details</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative aspect-video">
                  <img 
                    src="/maps/world_map.png" 
                    alt="World Map" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0">
                    {zones.map((zone) => (
                      <button
                        key={zone.id}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-2 rounded-full transition-all hover:scale-110 ${
                          selectedZone?.id === zone.id 
                            ? "bg-primary ring-2 ring-primary-foreground" 
                            : "bg-card/80 hover:bg-card"
                        }`}
                        style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
                        onClick={() => handleZoneClick(zone)}
                        title={zone.name}
                      >
                        {zone.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            {selectedZone ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">{selectedZone.icon}</div>
                    <div>
                      <CardTitle className="font-serif">{selectedZone.name}</CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge className={difficultyColors[selectedZone.difficulty]}>
                          {selectedZone.difficulty.toUpperCase()}
                        </Badge>
                        {selectedZone.pvpEnabled && (
                          <Badge variant="destructive">PvP</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{selectedZone.description}</p>
                  
                  {selectedZone.rankRequired && (
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <Lock className="w-4 h-4" />
                      Requires: {selectedZone.rankRequired}
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Activities:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedZone.activities.map((activity) => (
                        <Badge key={activity} variant="outline">{activity}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={() => handleEnterZone(selectedZone)}
                  >
                    Enter Zone
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a zone on the map to view details</p>
                </CardContent>
              </Card>
            )}

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Zone List</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <div className="p-4 space-y-2">
                    {zones.map((zone) => (
                      <button
                        key={zone.id}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          selectedZone?.id === zone.id
                            ? "bg-primary/20"
                            : "hover:bg-secondary/50"
                        }`}
                        onClick={() => handleZoneClick(zone)}
                      >
                        <div className="p-1.5 rounded bg-secondary">{zone.icon}</div>
                        <div className="text-left flex-1">
                          <div className="text-sm font-medium">{zone.name}</div>
                          <Badge className={`${difficultyColors[zone.difficulty]} text-xs`}>
                            {zone.difficulty}
                          </Badge>
                        </div>
                        {zone.pvpEnabled && (
                          <Skull className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
