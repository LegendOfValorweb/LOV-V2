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
  Coins, ArrowUp, Lock, Home, Palette, Trophy, Swords, Users, Calendar,
  Target, Zap, Flame, Crown
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { playerRanks } from "@shared/schema";
import { ZoneScene } from "@/components/zone-scene";
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
    name: "Camp",
    description: "A simple camp with basic amenities.",
    requirements: { gold: 0, rank: "Novice" },
    rooms: ["storage", "rest"],
  },
  {
    tier: 2,
    name: "Lodge",
    description: "A sturdy wooden structure with more space.",
    requirements: { gold: 500000, rank: "Journeyman" },
    rooms: ["storage", "rest", "weapon_locker", "crafting"],
  },
  {
    tier: 3,
    name: "Keep",
    description: "A fortified stone building with defenses.",
    requirements: { gold: 5000000, rank: "Expert" },
    rooms: ["storage", "rest", "weapon_locker", "crafting", "training", "defenses"],
  },
  {
    tier: 4,
    name: "Manor",
    description: "A luxurious manor with all amenities.",
    requirements: { gold: 50000000, rank: "Grandmaster" },
    rooms: ["storage", "rest", "weapon_locker", "crafting", "training", "vault", "defenses"],
  },
  {
    tier: 5,
    name: "Castle",
    description: "An impenetrable fortress befitting a legend.",
    requirements: { gold: 500000000, rank: "Legend" },
    rooms: ["storage", "rest", "weapon_locker", "crafting", "training", "vault", "defenses"],
  },
];

const ROOM_MAX_LEVEL_BY_TIER: Record<number, number> = { 1: 3, 2: 5, 3: 7, 4: 9, 5: 10 };
const ROOM_UPGRADE_BASE_COST: Record<string, number> = {
  storage: 5000, weapon_locker: 8000, rest: 3000, crafting: 10000, training: 15000, vault: 25000, defenses: 50000,
};

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
    id: "weapon_locker",
    name: "Weapon Locker",
    description: "Store extra weapons and armor sets.",
    icon: <Swords className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 8000,
    benefits: ["+2 weapon/armor slots per level", "Quick-swap loadouts at level 5"],
  },
  {
    id: "rest",
    name: "Rest Area",
    description: "Recover HP and energy faster.",
    icon: <Home className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 3000,
    benefits: ["+10% HP regen per level", "2x energy regen while at base"],
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
    description: "Train stats offline. Accumulates XP while away.",
    icon: <Dumbbell className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 15000,
    benefits: ["Offline stat XP accumulation", "+XP/hour per level"],
  },
  {
    id: "vault",
    name: "Secure Vault",
    description: "Store gold safely with daily interest.",
    icon: <Coins className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 25000,
    benefits: ["Daily interest on stored gold", "Protected from raids/PvP losses"],
  },
  {
    id: "defenses",
    name: "Defense Tower",
    description: "Arrow Traps, Magic Wards and more.",
    icon: <Shield className="w-5 h-5" />,
    level: 1,
    maxLevel: 10,
    upgradeCost: 50000,
    benefits: ["Arrow Traps deal damage to raiders", "Magic Wards reduce gold lost"],
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
  const [roomLevels, setRoomLevels] = useState<Record<string, number>>(() => {
    return (account as any)?.baseRoomLevels || {
      storage: 1,
      weapon_locker: 1,
      rest: 1,
      crafting: 1,
      training: 1,
      vault: 1,
      defenses: 1,
    };
  });
  const [selectedTrainingStat, setSelectedTrainingStat] = useState<string>("Str");
  const [isTraining, setIsTraining] = useState(false);
  const [vaultAmount, setVaultAmount] = useState<string>("");

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

  const { data: trainingStatus, refetch: refetchTraining } = useQuery<any>({
    queryKey: ["/api/accounts", account?.id, "offline-training-status"],
    queryFn: async () => {
      if (!account?.id) return { active: false };
      const res = await fetch(`/api/accounts/${account.id}/offline-training/status`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  const { data: vaultStatus, refetch: refetchVault } = useQuery<any>({
    queryKey: ["/api/accounts", account?.id, "vault-status"],
    queryFn: async () => {
      if (!account?.id) return null;
      const res = await fetch(`/api/accounts/${account.id}/vault/status`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  const handleUpgradeRoom = async (roomId: string) => {
    const currentLevel = roomLevels[roomId] || 1;
    const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
    if (currentLevel >= maxLevel || !account) return;
    
    try {
      const res = await fetch(`/api/accounts/${account.id}/room-levels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Upgrade Failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data.roomLevels) {
        setRoomLevels(data.roomLevels);
        setAccount({ ...account, baseRoomLevels: data.roomLevels, gold: data.account?.gold ?? account.gold });
      }
      toast({ title: "Room Upgraded!", description: `Spent ${(data.goldSpent || 0).toLocaleString()} gold.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upgrade room", variant: "destructive" });
    }
  };

  const handleStartTraining = async () => {
    if (!account) return;
    setIsTraining(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/offline-training/start`, { stat: selectedTrainingStat });
      const data = await res.json();
      toast({ title: "Training Started!", description: data.message });
      refetchTraining();
    } catch (error: any) {
      toast({ title: "Training Failed", description: error.message || "Could not start training", variant: "destructive" });
    } finally {
      setIsTraining(false);
    }
  };

  const handleStopTraining = async () => {
    if (!account) return;
    setIsTraining(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/offline-training/stop`, {});
      const data = await res.json();
      toast({ title: "Training Complete!", description: data.message });
      refetchTraining();
      refetchAccount();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not stop training", variant: "destructive" });
    } finally {
      setIsTraining(false);
    }
  };

  const handleVaultDeposit = async () => {
    if (!account) return;
    const amount = parseInt(vaultAmount);
    if (!amount || amount <= 0) return;
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/vault/deposit`, { amount });
      const data = await res.json();
      toast({ title: "Deposited!", description: data.message });
      if (data.account) setAccount(data.account);
      setVaultAmount("");
      refetchVault();
    } catch (error: any) {
      toast({ title: "Deposit Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleVaultWithdraw = async () => {
    if (!account) return;
    const amount = parseInt(vaultAmount);
    if (!amount || amount <= 0) return;
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/vault/withdraw`, { amount });
      const data = await res.json();
      toast({ title: "Withdrawn!", description: data.message });
      if (data.account) setAccount(data.account);
      setVaultAmount("");
      refetchVault();
    } catch (error: any) {
      toast({ title: "Withdrawal Failed", description: error.message, variant: "destructive" });
    }
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

  const nextTierCost = currentTier < 5 ? [0, 500000, 5000000, 50000000, 500000000][currentTier] : 0;

  return (
    <ZoneScene
      zoneName="Home Base"
      backdrop="/backdrops/base.png"
      ambientClass="zone-ambient-shop"
      overlayOpacity={0.35}
    >
      <div className="h-full flex flex-col p-3">
        <div className="flex-shrink-0 mb-3">
          <div className="flex items-center justify-between">
            <div className="rpg-panel px-3 py-1.5 flex items-center gap-2">
              <Castle className="w-5 h-5 text-primary" />
              <span className="rpg-heading text-sm">{baseTiers[currentTier - 1]?.name || "Your Base"}</span>
          </div>
          <Button variant="outline" size="sm" className="rpg-button-secondary text-xs" onClick={() => navigate("/world-map")}>
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
                <div className="aspect-video rounded-lg bg-gradient-to-br from-secondary to-background flex items-center justify-center mb-4 overflow-hidden relative">
                  {(() => {
                    const baseSkin = (account as any).baseSkin || "default";
                    const skinPath = baseSkin === "default" 
                      ? "/backdrops/base.png" 
                      : `/skins/base/${baseSkin === "dark" ? "dark_fortress" : baseSkin === "golden" ? "golden_throne" : baseSkin === "mythic" ? "void_dimension" : baseSkin === "autumn" ? "nature_sanctuary" : baseSkin === "winter" ? "ice_citadel" : baseSkin === "spring" ? "elven_treehouse" : baseSkin === "summer" ? "desert_oasis" : "crystal_palace"}.png`;
                    return (
                      <img 
                        src={skinPath}
                        alt="Base"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/backdrops/base.png";
                        }}
                      />
                    );
                  })()}
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
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="rooms" className="flex-1">Rooms</TabsTrigger>
                <TabsTrigger value="training" className="flex-1">Training</TabsTrigger>
                <TabsTrigger value="vault" className="flex-1">Vault</TabsTrigger>
                <TabsTrigger value="defenses" className="flex-1">Defenses</TabsTrigger>
                <TabsTrigger value="raids" className="flex-1">Raids</TabsTrigger>
                <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="rooms" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableRooms.map((room) => {
                    const level = roomLevels[room.id] || 1;
                    const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
                    const progress = (level / maxLevel) * 100;
                    const baseCost = ROOM_UPGRADE_BASE_COST[room.id] || 5000;
                    const upgradeCost = baseCost * level;
                    
                    return (
                      <Card key={room.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-secondary">{room.icon}</div>
                            <div className="flex-1">
                              <CardTitle className="text-base">{room.name}</CardTitle>
                              <CardDescription className="text-xs">{room.description}</CardDescription>
                            </div>
                            <Badge>Lv. {level}/{maxLevel}</Badge>
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
                            disabled={level >= maxLevel}
                            onClick={() => handleUpgradeRoom(room.id)}
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="training" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    {currentTier >= 3 ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                            <Dumbbell className="w-5 h-5 text-orange-500" />
                            Offline Training
                          </h3>
                          <Badge variant="secondary">Lv. {roomLevels.training || 1}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Train a stat while you're away. XP accumulates automatically for up to 24 hours.
                          Rate: {trainingStatus?.xpPerHour || 0} XP/hour
                        </p>

                        {trainingStatus?.active ? (
                          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">Training: {trainingStatus.stat}</span>
                              <Badge className="bg-orange-600">{trainingStatus.elapsedHours}h elapsed</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              Accumulated: +{trainingStatus.accumulatedXp} {trainingStatus.stat} XP
                            </p>
                            <Button
                              onClick={handleStopTraining}
                              disabled={isTraining}
                              variant="destructive"
                              className="w-full"
                            >
                              {isTraining ? "Collecting..." : "Stop & Collect XP"}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-5 gap-2">
                              {["Str", "Def", "Spd", "Int", "Luck"].map((stat) => (
                                <Button
                                  key={stat}
                                  variant={selectedTrainingStat === stat ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedTrainingStat(stat)}
                                >
                                  {stat}
                                </Button>
                              ))}
                            </div>
                            <Button
                              onClick={handleStartTraining}
                              disabled={isTraining}
                              className="w-full"
                            >
                              <Dumbbell className="w-4 h-4 mr-2" />
                              {isTraining ? "Starting..." : `Start Training ${selectedTrainingStat}`}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-6">
                        <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Training Grounds unlock at Tier 3 (Keep)</p>
                        <p className="text-sm mt-2">Upgrade your base to train stats while offline.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vault" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    {currentTier >= 4 ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                            <Coins className="w-5 h-5 text-yellow-500" />
                            Secure Vault
                          </h3>
                          <Badge variant="secondary">Lv. {roomLevels.vault || 1}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-xs text-muted-foreground">Vault Gold</p>
                            <p className="text-lg font-bold text-yellow-500">{(vaultStatus?.vaultGold || 0).toLocaleString()}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <p className="text-xs text-muted-foreground">Capacity</p>
                            <p className="text-lg font-bold">{(vaultStatus?.maxCapacity || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs text-muted-foreground">Daily Interest</p>
                          <p className="text-sm font-medium text-green-500">
                            +{(vaultStatus?.dailyInterest || 0).toLocaleString()} gold/day ({((vaultStatus?.interestRate || 0) * 100).toFixed(1)}%)
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={vaultAmount}
                            onChange={(e) => setVaultAmount(e.target.value)}
                            placeholder="Amount"
                            className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
                          />
                          <Button size="sm" onClick={handleVaultDeposit} disabled={!vaultAmount}>
                            Deposit
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleVaultWithdraw} disabled={!vaultAmount}>
                            Withdraw
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Gold in the vault is protected from raids and PvP losses. Interest is calculated on login.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-6">
                        <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Secure Vault unlocks at Tier 4 (Manor)</p>
                        <p className="text-sm mt-2">Store gold safely and earn daily interest.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="defenses" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    {currentTier >= 3 ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Base Defenses
                          </h3>
                          <Badge variant="secondary">Tier {currentTier} Defenses</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your {currentTierData.name} is equipped with defensive systems. Higher tiers unlock more options.
                        </p>
                        
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-muted-foreground">TRAPS & SENTRIES</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-secondary/50 border border-primary/20">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium flex items-center gap-2">
                                  <Target className="w-4 h-4 text-red-400" />
                                  Arrow Traps
                                </p>
                                <Badge variant="outline" className="text-xs">Level {roomLevels["defenses"] || 1}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">Deals {(roomLevels["defenses"] || 1) * 50} damage to raiders.</p>
                              <Progress value={(roomLevels["defenses"] || 1) * 10} className="h-1.5" />
                            </div>
                            <div className="p-4 rounded-lg bg-secondary/50 border border-primary/20">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-yellow-400" />
                                  Magical Wards
                                </p>
                                <Badge variant="outline" className="text-xs">Level {roomLevels["defenses"] || 1}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">Reduces gold lost by {(roomLevels["defenses"] || 1) * 5}%.</p>
                              <Progress value={(roomLevels["defenses"] || 1) * 10} className="h-1.5" />
                            </div>
                            {currentTier >= 4 && (
                              <>
                                <div className="p-4 rounded-lg bg-secondary/50 border border-orange-500/20">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium flex items-center gap-2">
                                      <Flame className="w-4 h-4 text-orange-400" />
                                      Fire Pits
                                    </p>
                                    <Badge variant="outline" className="text-xs bg-orange-500/10">Tier 4+</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">Burns {(roomLevels["defenses"] || 1) * 2}% of raider HP over time.</p>
                                  <Progress value={(roomLevels["defenses"] || 1) * 10} className="h-1.5" />
                                </div>
                                <div className="p-4 rounded-lg bg-secondary/50 border border-blue-500/20">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium flex items-center gap-2">
                                      <Shield className="w-4 h-4 text-blue-400" />
                                      Reinforced Walls
                                    </p>
                                    <Badge variant="outline" className="text-xs bg-blue-500/10">Tier 4+</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">+{(roomLevels["defenses"] || 1) * 100} base defense rating.</p>
                                  <Progress value={(roomLevels["defenses"] || 1) * 10} className="h-1.5" />
                                </div>
                              </>
                            )}
                            {currentTier >= 5 && (
                              <>
                                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-purple-400" />
                                      Arcane Sentinels
                                    </p>
                                    <Badge className="text-xs bg-purple-600">Tier 5</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">Summons {Math.floor((roomLevels["defenses"] || 1) / 2) + 1} magical guardians.</p>
                                  <Progress value={(roomLevels["defenses"] || 1) * 10} className="h-1.5" />
                                </div>
                                <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium flex items-center gap-2">
                                      <Crown className="w-4 h-4 text-yellow-400" />
                                      Dragon's Wrath
                                    </p>
                                    <Badge className="text-xs bg-yellow-600">Tier 5</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">Ultimate defense - 25% chance to instantly defeat raiders.</p>
                                  <Progress value={100} className="h-1.5" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border/50">
                          <h4 className="text-sm font-semibold text-muted-foreground">HIRE GUARDS</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors cursor-pointer">
                              <div className="flex items-center gap-3 mb-2">
                                <Users className="w-8 h-8 text-green-400" />
                                <div>
                                  <p className="font-medium">Militia</p>
                                  <p className="text-xs text-muted-foreground">Basic guards</p>
                                </div>
                              </div>
                              <p className="text-xs mb-2">+100 Defense Rating</p>
                              <Button size="sm" variant="outline" className="w-full">
                                <Coins className="w-3 h-3 mr-1" /> 50,000/day
                              </Button>
                            </div>
                            <div className={`p-4 rounded-lg bg-secondary/50 border ${currentTier >= 4 ? 'border-border hover:border-primary/50 cursor-pointer' : 'border-border/30 opacity-50'} transition-colors`}>
                              <div className="flex items-center gap-3 mb-2">
                                <Swords className="w-8 h-8 text-blue-400" />
                                <div>
                                  <p className="font-medium">Knights</p>
                                  <p className="text-xs text-muted-foreground">Elite warriors</p>
                                </div>
                              </div>
                              <p className="text-xs mb-2">+500 Defense Rating</p>
                              <Button size="sm" variant="outline" className="w-full" disabled={currentTier < 4}>
                                {currentTier >= 4 ? <><Coins className="w-3 h-3 mr-1" /> 250,000/day</> : <><Lock className="w-3 h-3 mr-1" /> Tier 4</>}
                              </Button>
                            </div>
                            <div className={`p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border ${currentTier >= 5 ? 'border-purple-500/30 hover:border-purple-500/50 cursor-pointer' : 'border-border/30 opacity-50'} transition-colors`}>
                              <div className="flex items-center gap-3 mb-2">
                                <Sparkles className="w-8 h-8 text-purple-400" />
                                <div>
                                  <p className="font-medium">Archmages</p>
                                  <p className="text-xs text-muted-foreground">Legendary mages</p>
                                </div>
                              </div>
                              <p className="text-xs mb-2">+2000 Defense Rating</p>
                              <Button size="sm" variant="outline" className="w-full" disabled={currentTier < 5}>
                                {currentTier >= 5 ? <><Coins className="w-3 h-3 mr-1" /> 1,000,000/day</> : <><Lock className="w-3 h-3 mr-1" /> Tier 5</>}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-6">
                        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Defense systems unlock at Tier 3 (Stone Keep)</p>
                        <p className="text-sm mt-2">Upgrade your base to access traps, guards, and magical wards.</p>
                        <p className="text-xs mt-4 text-yellow-400">Requires: 5,000,000 gold + Expert rank</p>
                      </div>
                    )}
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
                        Raids scale with your rank. Higher ranks unlock harder raids with better rewards.
                      </p>
                      {raidEvents.map((raid: any) => (
                        <div key={raid.id} className="p-3 rounded-lg bg-secondary/50 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{raid.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Unlocks at Rank {playerRanks[raid.minRank || 0]} | Difficulty: {"⭐".repeat(raid.difficulty)}
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

              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg font-semibold flex items-center gap-2 mb-4">
                      <Home className="w-5 h-5 text-primary" />
                      Base Automation Settings
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure automatic features for your base. Higher tier bases unlock more automation.
                    </p>

                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium">Auto-Loot</p>
                              <p className="text-xs text-muted-foreground">Automatically collect drops from battles</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${currentTier >= 2 ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {currentTier >= 2 ? 'Enabled' : 'Tier 2 Required'}
                            </span>
                            {currentTier >= 2 && <Sparkles className="w-4 h-4 text-green-500" />}
                          </div>
                        </div>
                        {currentTier >= 2 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            All battle rewards are automatically added to your inventory.
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Hammer className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium">Auto-Gather</p>
                              <p className="text-xs text-muted-foreground">Passively gather resources over time</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${currentTier >= 3 ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {currentTier >= 3 ? 'Enabled' : 'Tier 3 Required'}
                            </span>
                            {currentTier >= 3 && <Sparkles className="w-4 h-4 text-green-500" />}
                          </div>
                        </div>
                        {currentTier >= 3 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            Your base generates {(currentTier * 100).toLocaleString()} gold and {currentTier * 5} training points per hour.
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Dumbbell className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="font-medium">Auto-Train Pets</p>
                              <p className="text-xs text-muted-foreground">Pets gain experience while you're away</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${currentTier >= 4 ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {currentTier >= 4 ? 'Enabled' : 'Tier 4 Required'}
                            </span>
                            {currentTier >= 4 && <Sparkles className="w-4 h-4 text-green-500" />}
                          </div>
                        </div>
                        {currentTier >= 4 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            All pets gain {currentTier * 10} experience points per hour.
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Crown className="w-5 h-5 text-purple-500" />
                            <div>
                              <p className="font-medium">Auto-Defend</p>
                              <p className="text-xs text-muted-foreground">Maximum defense automation</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${currentTier >= 5 ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {currentTier >= 5 ? 'Enabled' : 'Tier 5 Required'}
                            </span>
                            {currentTier >= 5 && <Sparkles className="w-4 h-4 text-purple-500" />}
                          </div>
                        </div>
                        {currentTier >= 5 && (
                          <div className="mt-3 text-xs text-muted-foreground">
                            Your fortress automatically repels weak raiders and triggers counter-attacks.
                          </div>
                        )}
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
                  <span>{currentTierData.rooms.length} / 7</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Room Max Level</span>
                  <span>{ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vault Gold</span>
                  <span className="text-yellow-500">{((account as any).vaultGold || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Training</span>
                  <span className={trainingStatus?.active ? "text-orange-500" : "text-muted-foreground"}>
                    {trainingStatus?.active ? `${trainingStatus.stat} (${trainingStatus.elapsedHours}h)` : "Idle"}
                  </span>
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
    </ZoneScene>
  );
}
