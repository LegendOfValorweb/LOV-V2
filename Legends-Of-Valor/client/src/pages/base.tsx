import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Castle, Hammer, Package, Dumbbell, Shield, Sparkles,
  Coins, ArrowUp, Lock, Home
} from "lucide-react";
import { useGame } from "@/lib/game-context";

interface BaseRoom {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  level: number;
  maxLevel: number;
  upgradeCost: number;
  benefits: string[];
}

interface BaseTier {
  tier: number;
  name: string;
  description: string;
  requirements: { gold: number; rank: string };
  rooms: string[];
}

const baseTiers: BaseTier[] = [
  {
    tier: 1,
    name: "Humble Camp",
    description: "A simple camp with basic amenities.",
    requirements: { gold: 0, rank: "Novice" },
    rooms: ["storage", "rest"],
  },
  {
    tier: 2,
    name: "Wooden Lodge",
    description: "A sturdy wooden structure with more space.",
    requirements: { gold: 50000, rank: "Apprentice" },
    rooms: ["storage", "rest", "crafting"],
  },
  {
    tier: 3,
    name: "Stone Keep",
    description: "A fortified stone building with defenses.",
    requirements: { gold: 200000, rank: "Journeyman" },
    rooms: ["storage", "rest", "crafting", "training"],
  },
  {
    tier: 4,
    name: "Grand Manor",
    description: "A luxurious manor with all amenities.",
    requirements: { gold: 1000000, rank: "Expert" },
    rooms: ["storage", "rest", "crafting", "training", "vault"],
  },
  {
    tier: 5,
    name: "Fortress Castle",
    description: "An impenetrable fortress befitting a legend.",
    requirements: { gold: 10000000, rank: "Master" },
    rooms: ["storage", "rest", "crafting", "training", "vault", "defenses"],
  },
];

const baseRooms: BaseRoom[] = [
  {
    id: "storage",
    name: "Storage Room",
    description: "Store your items and resources safely.",
    icon: <Package className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 5000,
    benefits: ["+100 storage capacity per level", "Auto-sort items at level 5"],
  },
  {
    id: "rest",
    name: "Rest Area",
    description: "Recover HP and energy between adventures.",
    icon: <Home className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 3000,
    benefits: ["+10% HP recovery per level", "Passive healing at level 5"],
  },
  {
    id: "crafting",
    name: "Crafting Workshop",
    description: "Create weapons, armor, and consumables.",
    icon: <Hammer className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 10000,
    benefits: ["Unlock higher tier recipes", "+5% craft success per level"],
  },
  {
    id: "training",
    name: "Training Grounds",
    description: "Train your stats and practice combat.",
    icon: <Dumbbell className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 15000,
    benefits: ["+10% training efficiency per level", "Auto-train at level 10"],
  },
  {
    id: "vault",
    name: "Secure Vault",
    description: "Store gold and valuables with protection.",
    icon: <Coins className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 25000,
    benefits: ["Interest on stored gold", "Protection from PvP losses"],
  },
  {
    id: "defenses",
    name: "Defense Tower",
    description: "Protect your base from raids and attackers.",
    icon: <Shield className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 50000,
    benefits: ["Guards and traps", "+10% defense per level"],
  },
];

export default function Base() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [currentTier] = useState(1);
  const [roomLevels, setRoomLevels] = useState<Record<string, number>>({
    storage: 1,
    rest: 1,
    crafting: 1,
    training: 1,
    vault: 1,
    defenses: 1,
  });

  if (!account) {
    navigate("/");
    return null;
  }

  const currentTierData = baseTiers[currentTier - 1];
  const availableRooms = baseRooms.filter((room) => 
    currentTierData.rooms.includes(room.id)
  );

  const handleUpgradeRoom = (roomId: string) => {
    const currentLevel = roomLevels[roomId] || 1;
    const room = baseRooms.find((r) => r.id === roomId);
    if (!room || currentLevel >= room.maxLevel) return;
    
    setRoomLevels((prev) => ({
      ...prev,
      [roomId]: currentLevel + 1,
    }));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Castle className="w-8 h-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold text-foreground">Your Base</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/world-map")}>
            World Map
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-2xl">{currentTierData.name}</CardTitle>
                    <CardDescription>{currentTierData.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    Tier {currentTier}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg bg-gradient-to-br from-secondary to-background flex items-center justify-center mb-4">
                  <Castle className="w-24 h-24 text-muted-foreground/30" />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Upgrade to Tier {Math.min(currentTier + 1, 5)}
                  </span>
                  <Button disabled={currentTier >= 5}>
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Upgrade Base
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="rooms">
              <TabsList className="w-full">
                <TabsTrigger value="rooms" className="flex-1">Rooms</TabsTrigger>
                <TabsTrigger value="defenses" className="flex-1">Defenses</TabsTrigger>
                <TabsTrigger value="automation" className="flex-1">Automation</TabsTrigger>
              </TabsList>
              
              <TabsContent value="rooms" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableRooms.map((room) => {
                    const level = roomLevels[room.id] || 1;
                    const progress = (level / room.maxLevel) * 100;
                    
                    return (
                      <Card key={room.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-secondary">{room.icon}</div>
                            <div className="flex-1">
                              <CardTitle className="text-base">{room.name}</CardTitle>
                              <CardDescription className="text-xs">{room.description}</CardDescription>
                            </div>
                            <Badge>Lv. {level}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Progress value={progress} className="h-2 mb-3" />
                          <div className="text-xs text-muted-foreground mb-3">
                            {room.benefits.map((benefit, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-primary" />
                                {benefit}
                              </div>
                            ))}
                          </div>
                          <Button 
                            size="sm" 
                            className="w-full"
                            disabled={level >= room.maxLevel}
                            onClick={() => handleUpgradeRoom(room.id)}
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            Upgrade ({(room.upgradeCost * level).toLocaleString()} Gold)
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="defenses" className="mt-4">
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Defense systems unlock at Tier 5</p>
                    <p className="text-sm mt-2">Upgrade your base to access traps, guards, and magical wards.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="automation" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg font-semibold mb-4">Automation Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <div>
                          <p className="font-medium">Auto-Collect Resources</p>
                          <p className="text-xs text-muted-foreground">Automatically gather nearby resources</p>
                        </div>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <div>
                          <p className="font-medium">Auto-Craft Items</p>
                          <p className="text-xs text-muted-foreground">Queue items for automatic crafting</p>
                        </div>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <div>
                          <p className="font-medium">Auto-Train Stats</p>
                          <p className="text-xs text-muted-foreground">Passive stat training while offline</p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          <Lock className="w-3 h-3 mr-1" /> Tier 4
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Base Tiers</CardTitle>
                <CardDescription>Upgrade path for your home</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {baseTiers.map((tier) => (
                  <div 
                    key={tier.tier}
                    className={`p-3 rounded-lg border ${
                      tier.tier === currentTier 
                        ? "border-primary bg-primary/10" 
                        : tier.tier < currentTier 
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{tier.name}</span>
                      <Badge variant={tier.tier <= currentTier ? "default" : "outline"}>
                        Tier {tier.tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                    {tier.tier > currentTier && (
                      <div className="mt-2 text-xs">
                        <span className="text-yellow-400">
                          {tier.requirements.gold.toLocaleString()} Gold | {tier.requirements.rank}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="font-serif">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Capacity</span>
                  <span>{100 * (roomLevels.storage || 1)} / 1000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Defense Rating</span>
                  <span>{10 * (roomLevels.defenses || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rooms Unlocked</span>
                  <span>{currentTierData.rooms.length} / 6</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
