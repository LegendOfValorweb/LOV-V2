import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Castle, Hammer, Package, Dumbbell, Shield, Sparkles,
  Coins, ArrowUp, Lock, Home, Palette, Trophy, Swords, Users, Calendar
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface BaseSkin {
  id: string;
  name: string;
  cost: number;
}

interface TrophyData {
  id: string;
  name: string;
  description: string;
}

export default function Base() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  
  const refetchAccount = async () => {
    if (!account?.id) return;
    try {
      const res = await fetch(`/api/accounts/${account.id}`);
      if (res.ok) {
        const data = await res.json();
        setAccount(data);
      }
    } catch (e) {}
  };
  const [skinDialog, setSkinDialog] = useState(false);
  const [trophyDialog, setTrophyDialog] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSettingSkin, setIsSettingSkin] = useState(false);
  const [roomLevels, setRoomLevels] = useState<Record<string, number>>({
    storage: 1,
    rest: 1,
    crafting: 1,
    training: 1,
    vault: 1,
    defenses: 1,
  });

  const { data: baseSkins = [] } = useQuery<BaseSkin[]>({
    queryKey: ["/api/base-skins"],
    queryFn: async () => {
      const res = await fetch("/api/base-skins");
      return res.json();
    },
  });

  const { data: trophyData } = useQuery<{ earned: TrophyData[], available: TrophyData[] }>({
    queryKey: ["/api/accounts", account?.id, "trophies"],
    queryFn: async () => {
      if (!account?.id) return { earned: [], available: [] };
      const res = await fetch(`/api/accounts/${account.id}/trophies`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  const { data: raidEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/base-raids"],
    queryFn: async () => {
      const res = await fetch("/api/base-raids");
      return res.json();
    },
  });

  const { data: weeklyEvent } = useQuery<{ active: any, allEvents: any[], nextEventIn: number }>({
    queryKey: ["/api/weekly-events"],
    queryFn: async () => {
      const res = await fetch("/api/weekly-events");
      return res.json();
    },
  });

  const [isRaiding, setIsRaiding] = useState(false);
  const [raidResult, setRaidResult] = useState<any>(null);
  const [visitDialog, setVisitDialog] = useState(false);
  const [visitingPlayer, setVisitingPlayer] = useState("");
  const [visitorData, setVisitorData] = useState<any>(null);
  const [isLoadingVisit, setIsLoadingVisit] = useState(false);

  const { data: onlinePlayers = [] } = useQuery<any[]>({
    queryKey: ["/api/online-players"],
    queryFn: async () => {
      const res = await fetch("/api/online-players");
      return res.json();
    },
  });

  const handleVisitBase = async (playerId: string) => {
    setIsLoadingVisit(true);
    try {
      const res = await fetch(`/api/accounts/${playerId}/visitors?visitorId=${account?.id}`);
      const data = await res.json();
      setVisitorData(data);
    } catch (error) {
      toast({
        title: "Visit Failed",
        description: "Could not load base data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVisit(false);
    }
  };

  if (!account) {
    navigate("/");
    return null;
  }

  const currentTier = (account as any).baseTier || 1;
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

  const handleUpgradeBase = async () => {
    if (!account) return;
    setIsUpgrading(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/upgrade-base`, {});
      const data = await res.json();
      toast({
        title: "Base Upgraded!",
        description: data.message,
      });
      refetchAccount();
    } catch (error: any) {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not upgrade base",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleSetSkin = async (skin: string) => {
    if (!account) return;
    setIsSettingSkin(true);
    try {
      const res = await apiRequest("PATCH", `/api/accounts/${account.id}/base-skin`, { skin });
      const data = await res.json();
      toast({
        title: "Skin Applied!",
        description: data.message,
      });
      refetchAccount();
      setSkinDialog(false);
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message || "Could not set skin",
        variant: "destructive",
      });
    } finally {
      setIsSettingSkin(false);
    }
  };

  const handleTriggerRaid = async () => {
    if (!account) return;
    setIsRaiding(true);
    setRaidResult(null);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/trigger-raid`, {});
      const data = await res.json();
      setRaidResult(data);
      toast({
        title: data.result === "victory" ? "Raid Defended!" : data.result === "defeat" ? "Raid Failed!" : "No Raid",
        description: data.message,
        variant: data.result === "defeat" ? "destructive" : "default",
      });
      refetchAccount();
    } catch (error: any) {
      toast({
        title: "Raid Error",
        description: error.message || "Could not trigger raid",
        variant: "destructive",
      });
    } finally {
      setIsRaiding(false);
    }
  };

  const tierCosts = [0, 50000, 200000, 1000000, 10000000];
  const nextTierCost = currentTier < 5 ? tierCosts[currentTier] : 0;

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/base.png')" }}
      />
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 min-h-screen p-4">
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
                
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {currentTier < 5 ? `Upgrade to Tier ${currentTier + 1}: ${nextTierCost.toLocaleString()} gold` : "Maximum tier reached"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSkinDialog(true)}
                    >
                      <Palette className="w-4 h-4 mr-1" />
                      Skins
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTrophyDialog(true)}
                    >
                      <Trophy className="w-4 h-4 mr-1" />
                      Trophies ({(account as any).trophies?.length || 0})
                    </Button>
                    <Button 
                      disabled={currentTier >= 5 || account.gold < nextTierCost || isUpgrading}
                      onClick={handleUpgradeBase}
                    >
                      <ArrowUp className="w-4 h-4 mr-2" />
                      {isUpgrading ? "Upgrading..." : "Upgrade Base"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="rooms">
              <TabsList className="w-full">
                <TabsTrigger value="rooms" className="flex-1">Rooms</TabsTrigger>
                <TabsTrigger value="defenses" className="flex-1">Defenses</TabsTrigger>
                <TabsTrigger value="raids" className="flex-1">Raids</TabsTrigger>
                <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
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

              <TabsContent value="raids" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                        <Swords className="w-5 h-5 text-red-500" />
                        NPC Raids
                      </h3>
                      <Button 
                        onClick={handleTriggerRaid} 
                        disabled={isRaiding}
                        variant="destructive"
                      >
                        {isRaiding ? "Defending..." : "Trigger Raid"}
                      </Button>
                    </div>
                    
                    {raidResult && (
                      <div className={`p-4 rounded-lg mb-4 ${raidResult.result === "victory" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                        <p className="font-medium">{raidResult.message}</p>
                        {raidResult.rewards && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Rewards: {raidResult.rewards.gold.toLocaleString()} gold, {raidResult.rewards.exp} exp
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground mb-3">
                        Raids scale with your Mystic Tower progress. Higher floors unlock harder raids with better rewards.
                      </p>
                      {raidEvents.map((raid: any) => (
                        <div key={raid.id} className="p-3 rounded-lg bg-secondary/50 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{raid.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Unlocks at Tower Floor {raid.minTowerFloor} | Difficulty: {"⭐".repeat(raid.difficulty)}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-yellow-500">{raid.rewards.gold.toLocaleString()} gold</p>
                            <p className="text-blue-500">{raid.rewards.exp} exp</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg font-semibold flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Weekly Events
                    </h3>
                    
                    {weeklyEvent?.active && (
                      <div className={`p-4 rounded-lg mb-4 ${weeklyEvent.active.type === "hero" ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-purple-500/10 border border-purple-500/30"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={weeklyEvent.active.type === "hero" ? "default" : "secondary"}>
                            {weeklyEvent.active.type === "hero" ? "Hero Event" : "Joker Event"}
                          </Badge>
                          <span className="font-semibold">{weeklyEvent.active.name}</span>
                        </div>
                        <p className="text-sm">{weeklyEvent.active.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Next event in: {Math.floor(weeklyEvent.nextEventIn / (1000 * 60 * 60 * 24))} days
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">All Weekly Events</h4>
                      {weeklyEvent?.allEvents?.map((event: any) => (
                        <div 
                          key={event.id} 
                          className={`p-3 rounded-lg bg-secondary/50 ${event.id === weeklyEvent.active?.id ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={event.type === "hero" ? "default" : "outline"} className="text-xs">
                              {event.type === "hero" ? "Hero" : "Joker"}
                            </Badge>
                            <span className="font-medium">{event.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="font-medium">Visitor System</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setVisitDialog(true)}>
                          Visit Player Base
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Visit other players' bases to see their trophies (80% visible). Upgrade your base to impress visitors!
                      </p>
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Skin</span>
                  <span className="capitalize">{(account as any).baseSkin || "default"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={skinDialog} onOpenChange={setSkinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Base Skins
              </DialogTitle>
              <DialogDescription>
                Choose a cosmetic skin for your base. Some skins cost gold.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  Your Gold
                </span>
                <span className="font-mono font-bold text-yellow-500">{(account?.gold || 0).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {baseSkins.map(skin => {
                  const isCurrentSkin = (account as any).baseSkin === skin.id || (!((account as any).baseSkin) && skin.id === "default");
                  const canAfford = skin.cost === 0 || (account?.gold || 0) >= skin.cost || isCurrentSkin;
                  return (
                    <Button
                      key={skin.id}
                      variant={isCurrentSkin ? "default" : "outline"}
                      className="flex flex-col items-center py-3 h-auto"
                      disabled={isSettingSkin || (!canAfford && !isCurrentSkin)}
                      onClick={() => handleSetSkin(skin.id)}
                    >
                      <span className="font-medium">{skin.name}</span>
                      {skin.cost > 0 && !isCurrentSkin && (
                        <span className="text-xs text-yellow-500">{skin.cost.toLocaleString()} gold</span>
                      )}
                      {isCurrentSkin && <span className="text-xs text-green-400">Equipped</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkinDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={trophyDialog} onOpenChange={setTrophyDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Trophies ({trophyData?.earned.length || 0} / {trophyData?.available.length || 0})
              </DialogTitle>
              <DialogDescription>
                Earn trophies by completing achievements. They're visible to visitors!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-green-400">Earned Trophies</h4>
                {trophyData?.earned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trophies earned yet</p>
                ) : (
                  <div className="grid gap-2">
                    {trophyData?.earned.map(trophy => (
                      <div key={trophy.id} className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium">{trophy.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{trophy.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Available Trophies</h4>
                <div className="grid gap-2">
                  {trophyData?.available.filter(t => !trophyData.earned.find(e => e.id === t.id)).map(trophy => (
                    <div key={trophy.id} className="p-3 rounded-lg bg-secondary/30 border border-secondary/50 opacity-60">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{trophy.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{trophy.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTrophyDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={visitDialog} onOpenChange={(open) => { setVisitDialog(open); if (!open) setVisitorData(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Visit Player Base
              </DialogTitle>
              <DialogDescription>
                Select a player to visit their base and see their trophies (80% visibility).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!visitorData ? (
                <>
                  <p className="text-sm text-muted-foreground">Online Players:</p>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {onlinePlayers.filter((p: any) => p.id !== account?.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No other players online</p>
                    ) : (
                      onlinePlayers.filter((p: any) => p.id !== account?.id).map((player: any) => (
                        <Button
                          key={player.id}
                          variant="outline"
                          className="justify-between"
                          onClick={() => handleVisitBase(player.id)}
                          disabled={isLoadingVisit}
                        >
                          <span>{player.username}</span>
                          <Badge variant="outline">{player.rank}</Badge>
                        </Button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{visitorData.ownerName}'s Base</h3>
                      <Badge>{visitorData.ownerRank}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Race:</span>
                        <span className="ml-2 capitalize">{visitorData.ownerRace}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Base Tier:</span>
                        <span className="ml-2">{visitorData.baseTier}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Base Skin:</span>
                        <span className="ml-2 capitalize">{visitorData.baseSkin}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Trophies:</span>
                        <span className="ml-2">{visitorData.trophyCount}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        Visible Trophies
                      </h4>
                      <span className="text-xs text-muted-foreground">{visitorData.visibilityNote}</span>
                    </div>
                    {visitorData.trophies?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No trophies visible</p>
                    ) : (
                      <div className="grid gap-2 max-h-40 overflow-y-auto">
                        {visitorData.trophies?.map((trophyId: string) => (
                          <div key={trophyId} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm capitalize">{trophyId.replace(/_/g, " ")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button variant="outline" onClick={() => setVisitorData(null)} className="w-full">
                    Back to Player List
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setVisitDialog(false); setVisitorData(null); }}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
