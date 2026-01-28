import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Castle, Mountain, Skull, FlaskConical, Sword, Swords,
  Trees, Gem, Fish, Shield, Flame, Map, Home, Lock,
  Package, ShoppingBag, Users, LogOut, MessageCircle,
  Crown, Coins, Heart, Target, Zap
} from "lucide-react";
import { useGame } from "@/lib/game-context";
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
  icon: React.ReactNode;
  difficulty: "starter" | "easy" | "medium" | "hard" | "hell";
  pvpEnabled: boolean;
  rankRequired?: string;
  activities: string[];
  coordinates: { x: number; y: number };
  route?: string;
}

const zones: Zone[] = [
  {
    id: "your-base",
    name: "Your Base",
    description: "Your personal fortress. Manage rooms, storage, and upgrades.",
    icon: <Castle className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Storage", "Crafting", "Training", "Rest"],
    coordinates: { x: 50, y: 50 },
    route: "/base",
  },
  {
    id: "capital-city",
    name: "Capital City",
    description: "The central hub of the realm. Trade, socialize, and prepare for adventure.",
    icon: <ShoppingBag className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Shop", "Trading", "Guild Hall", "Quest Board"],
    coordinates: { x: 30, y: 45 },
    route: "/shop",
  },
  {
    id: "mystic-tower",
    name: "Mystic Tower",
    description: "A towering spire filled with increasingly powerful enemies. 100 floors await.",
    icon: <Sword className="w-6 h-6" />,
    difficulty: "hard",
    pvpEnabled: false,
    activities: ["NPC Battles", "Boss Fights", "Loot Drops"],
    coordinates: { x: 50, y: 20 },
    route: "/npc-battle",
  },
  {
    id: "mountain-caverns",
    name: "Mountain Caverns",
    description: "Deep caves rich with ore and dangerous creatures lurking in the shadows.",
    icon: <Mountain className="w-6 h-6" />,
    difficulty: "easy",
    pvpEnabled: true,
    activities: ["Mining", "Hunting", "Resource Gathering"],
    coordinates: { x: 80, y: 25 },
  },
  {
    id: "ancient-ruins",
    name: "Ancient Ruins",
    description: "Crumbling temples hiding ancient secrets and powerful artifacts.",
    icon: <Castle className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["Exploration", "Artifact Hunting", "Boss Encounters"],
    coordinates: { x: 20, y: 30 },
    route: "/quests",
  },
  {
    id: "research-lab",
    name: "Research Lab",
    description: "Where scholars study the arcane arts and craft powerful items.",
    icon: <FlaskConical className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: false,
    activities: ["Crafting", "Enchanting", "Skill Research"],
    coordinates: { x: 35, y: 70 },
    route: "/skills",
  },
  {
    id: "pet-training",
    name: "Pet Training Grounds",
    description: "Train and evolve your pets to become powerful battle companions.",
    icon: <Shield className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Pet Training", "Pet Battles", "Evolution"],
    coordinates: { x: 70, y: 65 },
    route: "/pets",
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
    coordinates: { x: 85, y: 50 },
  },
  {
    id: "enchanted-forest",
    name: "Enchanted Forest",
    description: "A mystical woodland home to faeries, spirits, and rare creatures.",
    icon: <Trees className="w-6 h-6" />,
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
    icon: <Sword className="w-6 h-6" />,
    difficulty: "hard",
    pvpEnabled: true,
    activities: ["PvP Duels", "Tournaments", "Rankings"],
    coordinates: { x: 65, y: 35 },
    route: "/leaderboard",
  },
  {
    id: "pet-arena",
    name: "Pet Arena",
    description: "Challenge other players to 3v3 pet battles. Train your pets and prove dominance!",
    icon: <Swords className="w-6 h-6" />,
    difficulty: "medium",
    pvpEnabled: true,
    activities: ["Pet PvP", "3v3 Battles", "Wagers"],
    coordinates: { x: 75, y: 45 },
    route: "/pet-arena",
  },
  {
    id: "crystal-lake",
    name: "Crystal Lake",
    description: "Serene waters hiding valuable fish and aquatic treasures.",
    icon: <Fish className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Fishing", "Relaxation", "Pet Bonding"],
    coordinates: { x: 15, y: 80 },
    route: "/fishing",
  },
  {
    id: "guild-hall",
    name: "Guild Hall",
    description: "Join forces with other players in powerful guilds.",
    icon: <Users className="w-6 h-6" />,
    difficulty: "starter",
    pvpEnabled: false,
    activities: ["Guild Management", "Guild Quests", "Social"],
    coordinates: { x: 80, y: 80 },
    route: "/guild",
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
    coordinates: { x: 50, y: 8 },
  },
];

const difficultyColors: Record<string, string> = {
  starter: "bg-green-500/20 text-green-400 border-green-500/30",
  easy: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  hell: "bg-red-500/20 text-red-400 border-red-500/30",
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

export default function WorldMap() {
  const [, navigate] = useLocation();
  const { account, logout, setAccount } = useGame();
  const { toast } = useToast();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [battleDialog, setBattleDialog] = useState(false);
  const [isBattling, setIsBattling] = useState(false);
  const [currentEnemy, setCurrentEnemy] = useState<any>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [gatherDialog, setGatherDialog] = useState(false);
  const [isGathering, setIsGathering] = useState(false);
  const [gatherResult, setGatherResult] = useState<any>(null);
  const [zoneResources, setZoneResources] = useState<any>(null);

  const { data: zoneDifficulties } = useQuery<any>({
    queryKey: ["/api/zone-difficulties"],
    queryFn: async () => {
      const res = await fetch("/api/zone-difficulties");
      return res.json();
    },
  });

  const { data: enemyArchetypes } = useQuery<any>({
    queryKey: ["/api/enemy-archetypes"],
    queryFn: async () => {
      const res = await fetch("/api/enemy-archetypes");
      return res.json();
    },
  });

  if (!account) {
    navigate("/");
    return null;
  }

  const handleZoneClick = (zone: Zone) => {
    setSelectedZone(zone);
  };

  const handleEnterZone = (zone: Zone) => {
    if (zone.route) {
      navigate(zone.route);
    }
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
        // Refresh account
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

  const portraitPath = account.portrait || `/portraits/${account.race}_${account.gender}.png`;

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/maps/world_map.png')" }}
      />
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative z-10 min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Card className="bg-card/90 backdrop-blur">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={portraitPath}
                    alt={account.username}
                    className="w-16 h-16 rounded-lg border-2 border-primary object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/portraits/human_male.png";
                    }}
                  />
                  <Badge className="absolute -bottom-1 -right-1 text-xs">
                    {account.rank || "Novice"}
                  </Badge>
                </div>
                <div>
                  <h2 className="font-serif font-bold text-lg">{account.username}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="capitalize">{account.race} {account.gender}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span>{(account.gold || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="bg-card/90 backdrop-blur"
                onClick={() => navigate("/inventory")}
              >
                <Package className="w-4 h-4 mr-2" />
                Inventory
              </Button>
              <Button 
                variant="outline" 
                className="bg-card/90 backdrop-blur"
                onClick={() => navigate("/ai-chat")}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                AI Guide
              </Button>
              <Button 
                variant="outline" 
                className="bg-card/90 backdrop-blur"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <Card className="bg-card/80 backdrop-blur overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-primary" />
                    <CardTitle className="font-serif">Realm of Valor</CardTitle>
                  </div>
                  <CardDescription>Click on a location to travel</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="relative aspect-[16/9] rounded-lg overflow-hidden">
                    <img 
                      src="/maps/world_map.png" 
                      alt="World Map" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0">
                      {zones.map((zone) => (
                        <button
                          key={zone.id}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-2 rounded-full transition-all hover:scale-125 shadow-lg ${
                            selectedZone?.id === zone.id 
                              ? "bg-primary ring-2 ring-white scale-110" 
                              : `bg-card/90 hover:bg-primary/80 ${difficultyColors[zone.difficulty]}`
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

            <div className="lg:col-span-1 space-y-4">
              {selectedZone ? (
                <Card className="bg-card/90 backdrop-blur">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${difficultyColors[selectedZone.difficulty]}`}>
                        {selectedZone.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="font-serif text-lg">{selectedZone.name}</CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge className={difficultyColors[selectedZone.difficulty]}>
                            {selectedZone.difficulty.toUpperCase()}
                          </Badge>
                          {selectedZone.pvpEnabled && (
                            <Badge variant="destructive" className="text-xs">
                              <Skull className="w-3 h-3 mr-1" />
                              PvP
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{selectedZone.description}</p>
                    
                    {selectedZone.rankRequired && (
                      <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 p-2 rounded">
                        <Lock className="w-4 h-4" />
                        Requires: {selectedZone.rankRequired}
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-xs font-semibold mb-2 text-muted-foreground">ACTIVITIES:</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedZone.activities.map((activity) => (
                          <Badge key={activity} variant="outline" className="text-xs">
                            {activity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        onClick={() => handleEnterZone(selectedZone)}
                        disabled={!selectedZone.route}
                      >
                        {selectedZone.route ? "Travel Here" : "Coming Soon"}
                      </Button>
                      {HUNTABLE_ZONES.has(selectedZone.id) && (
                        <Button 
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleHuntInZone(selectedZone)}
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Hunt
                        </Button>
                      )}
                      {GATHERABLE_ZONES.has(selectedZone.id) && (
                        <Button 
                          variant="secondary"
                          className="flex-1"
                          onClick={() => handleGatherInZone(selectedZone)}
                        >
                          <Gem className="w-4 h-4 mr-2" />
                          Gather
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/90 backdrop-blur">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Select a location on the map</p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card/90 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif text-sm">Quick Travel</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1 pr-2">
                      {zones.filter(z => z.route).map((zone) => (
                        <button
                          key={zone.id}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                            selectedZone?.id === zone.id
                              ? "bg-primary/20"
                              : "hover:bg-secondary/50"
                          }`}
                          onClick={() => {
                            setSelectedZone(zone);
                            if (zone.route) navigate(zone.route);
                          }}
                        >
                          <div className={`p-1 rounded ${difficultyColors[zone.difficulty]}`}>
                            {zone.icon}
                          </div>
                          <span className="text-sm flex-1">{zone.name}</span>
                          {zone.pvpEnabled && (
                            <Skull className="w-3 h-3 text-red-400" />
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
    </div>
  );
}
