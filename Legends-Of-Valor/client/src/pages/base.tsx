import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface BuildingDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  unlockTier: number;
  description: string;
}

const ALL_BUILDINGS: BuildingDef[] = [
  { id: "town_hall", name: "Town Hall", icon: <Castle className="w-6 h-6" />, color: "from-yellow-600 to-amber-700", unlockTier: 1, description: "Base upgrade hub and trophy hall." },
  { id: "storage", name: "Storage", icon: <Package className="w-6 h-6" />, color: "from-green-700 to-emerald-800", unlockTier: 1, description: "Store items and resources." },
  { id: "rest", name: "Rest Area", icon: <Home className="w-6 h-6" />, color: "from-blue-700 to-sky-800", unlockTier: 1, description: "Recover HP and energy." },
  { id: "weapon_locker", name: "Weapon Locker", icon: <Swords className="w-6 h-6" />, color: "from-red-700 to-rose-800", unlockTier: 2, description: "Store and swap loadouts." },
  { id: "crafting", name: "Workshop", icon: <Hammer className="w-6 h-6" />, color: "from-orange-700 to-amber-800", unlockTier: 2, description: "Craft weapons and gear." },
  { id: "training", name: "Training Grounds", icon: <Dumbbell className="w-6 h-6" />, color: "from-purple-700 to-violet-800", unlockTier: 3, description: "Offline stat training." },
  { id: "defenses", name: "Defense Tower", icon: <Shield className="w-6 h-6" />, color: "from-slate-600 to-gray-700", unlockTier: 3, description: "Traps and guards." },
  { id: "vault", name: "Vault", icon: <Coins className="w-6 h-6" />, color: "from-yellow-600 to-yellow-800", unlockTier: 4, description: "Secure gold with interest." },
  { id: "raids", name: "War Room", icon: <Target className="w-6 h-6" />, color: "from-red-800 to-red-900", unlockTier: 1, description: "Manage NPC raids." },
  { id: "events", name: "Events Hall", icon: <Calendar className="w-6 h-6" />, color: "from-pink-700 to-fuchsia-800", unlockTier: 1, description: "Weekly events & visitors." },
];

interface BaseSkin {
  id: string;
  name: string;
  cost: number;
}

interface CraftingRecipe {
  id: string;
  name: string;
  resultItemId: string;
  tier: string;
  requiredRank: string;
  ingredients: { itemId: string; quantity: number }[];
  goldCost: number;
  description?: string;
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

  const [openBuilding, setOpenBuilding] = useState<string | null>(null);
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
  const [vaultAmount, setVaultAmount] = useState<string>("");

  const { data: baseSkins = [] } = useQuery<BaseSkin[]>({
    queryKey: ["/api/base-skins"],
    queryFn: async () => {
      const res = await fetch("/api/base-skins");
      return res.json();
    },
  });

  const { data: craftingRecipes = [] } = useQuery<CraftingRecipe[]>({
    queryKey: ["/api/crafting/recipes"],
    queryFn: async () => {
      const res = await fetch("/api/crafting/recipes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!account?.id,
  });

  const craftItemMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const res = await apiRequest("POST", "/api/crafting/craft", { recipeId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Item Crafted!", description: `You crafted ${data.name || "an item"}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/crafting/recipes"] });
      refetchAccount();
    },
    onError: (err: any) => {
      toast({ title: "Craft Failed", description: err.message || "Could not craft item.", variant: "destructive" });
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

  useEffect(() => {
    if (!account) navigate("/");
  }, [account, navigate]);

  const currentTier = (account as any)?.baseTier || 1;
  const currentTierData = baseTiers[currentTier - 1];

  const { data: trainingStatus, refetch: refetchTraining } = useQuery<any>({
    queryKey: ["/api/accounts/" + account?.id + "/offline-training/status"],
    queryFn: async () => {
      const res = await fetch(`/api/accounts/${account.id}/offline-training/status`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 10000,
  });

  const startTrainingMutation = useMutation({
    mutationFn: async (stat: string) => {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/offline-training/start`, { stat });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training Started!" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/" + account?.id + "/offline-training/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to start training", description: err.message, variant: "destructive" });
    }
  });

  const collectTrainingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/offline-training/stop`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Training Collected!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/" + account?.id + "/offline-training/status"] });
      refetchAccount();
    },
    onError: (err: any) => {
      toast({ title: "Failed to collect training", description: err.message, variant: "destructive" });
    }
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

  if (!account) return null;

  const nextTierCost = currentTier < 5 ? [0, 500000, 5000000, 50000000, 500000000][currentTier] : 0;

  const baseSkin = (account as any).baseSkin || "default";
  const skinPath = baseSkin === "default" 
    ? "/backdrops/base.png" 
    : `/skins/base/${baseSkin === "dark" ? "dark_fortress" : baseSkin === "golden" ? "golden_throne" : baseSkin === "mythic" ? "void_dimension" : baseSkin === "autumn" ? "nature_sanctuary" : baseSkin === "winter" ? "ice_citadel" : baseSkin === "spring" ? "elven_treehouse" : baseSkin === "summer" ? "desert_oasis" : "crystal_palace"}.png`;

  const isBuildingUnlocked = (building: BuildingDef) => {
    if (building.unlockTier === 1) return true;
    if (building.id === "raids" || building.id === "events") return true;
    return currentTier >= building.unlockTier;
  };

  const getUnlockLabel = (building: BuildingDef) => {
    const tier = baseTiers[building.unlockTier - 1];
    return `Unlocks at Tier ${building.unlockTier} (${tier?.name || ""})`;
  };

  const getRoomLevel = (roomId: string) => roomLevels[roomId] || 1;

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
              <span className="rpg-heading text-sm">{currentTierData?.name || "Your Base"}</span>
              <Badge variant="secondary" className="text-xs">Tier {currentTier}</Badge>
            </div>
          </div>
        </div>

        <div className="relative flex-1 rounded-xl overflow-hidden mb-3 min-h-0" style={{ minHeight: "320px" }}>
          <img
            src={skinPath}
            alt="Base"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/backdrops/base.png"; }}
          />
          <div className="absolute inset-0 bg-black/40" />

          <div className="absolute inset-0 p-3 grid grid-cols-5 gap-2 content-start">
            {ALL_BUILDINGS.map((building) => {
              const unlocked = isBuildingUnlocked(building);
              return (
                <button
                  key={building.id}
                  onClick={() => unlocked && setOpenBuilding(building.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all group relative
                    ${unlocked
                      ? "border-white/20 bg-black/50 hover:bg-black/70 hover:border-white/50 cursor-pointer"
                      : "border-white/10 bg-black/30 opacity-50 cursor-not-allowed"
                    }`}
                  title={unlocked ? building.name : getUnlockLabel(building)}
                >
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                      <Lock className="w-4 h-4 text-white/60" />
                    </div>
                  )}
                  <div className={`p-1.5 rounded-md bg-gradient-to-br ${building.color} ${!unlocked ? "opacity-30" : ""}`}>
                    {building.icon}
                  </div>
                  <span className="text-white text-xs font-medium leading-tight text-center line-clamp-2 hidden sm:block">
                    {building.name}
                  </span>
                  {unlocked && building.id !== "town_hall" && building.id !== "raids" && building.id !== "events" && (
                    <Badge className="text-[10px] h-4 px-1 bg-primary/80">
                      Lv.{getRoomLevel(building.id)}
                    </Badge>
                  )}
                  {!unlocked && (
                    <span className="text-white/40 text-[10px] leading-tight text-center hidden sm:block">
                      Tier {building.unlockTier}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-shrink-0 text-xs text-center text-muted-foreground">
          Tap a building to open it — locked buildings show what tier unlocks them
        </div>
      </div>

      {/* Town Hall Dialog */}
      <Dialog open={openBuilding === "town_hall"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Castle className="w-5 h-5 text-yellow-500" />
              Town Hall
            </DialogTitle>
            <DialogDescription>Your base upgrade hub and trophy room.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
              <div>
                <p className="font-serif text-xl font-semibold">{currentTierData.name}</p>
                <p className="text-sm text-muted-foreground">{currentTierData.description}</p>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">Tier {currentTier}</Badge>
            </div>

            {currentTier < 5 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Next tier: <span className="font-medium text-yellow-400">{baseTiers[currentTier]?.name}</span> — costs {nextTierCost.toLocaleString()} gold
                </p>
                <p className="text-xs text-muted-foreground">
                  Required rank: {baseTiers[currentTier]?.requirements.rank}
                </p>
                <Button 
                  disabled={currentTier >= 5 || account.gold < nextTierCost || isUpgrading}
                  onClick={handleUpgradeBase}
                  className="w-full"
                >
                  <ArrowUp className="w-4 h-4 mr-2" />
                  {isUpgrading ? "Upgrading..." : `Upgrade to ${baseTiers[currentTier]?.name} (${nextTierCost.toLocaleString()} gold)`}
                </Button>
              </div>
            )}
            {currentTier >= 5 && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                <Crown className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                <p className="font-medium">Maximum Tier Reached — Castle</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">TIER PROGRESSION</h4>
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
                    <Badge variant={tier.tier <= currentTier ? "default" : "outline"}>Tier {tier.tier}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                  {tier.tier > currentTier && (
                    <div className="mt-2 text-xs text-yellow-400">
                      {tier.requirements.gold.toLocaleString()} Gold | {tier.requirements.rank}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setSkinDialog(true); }}>
                <Palette className="w-4 h-4 mr-2" />
                Base Skins
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setTrophyDialog(true); }}>
                <Trophy className="w-4 h-4 mr-2" />
                Trophies ({(account as any).trophies?.length || 0})
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Storage Dialog */}
      <Dialog open={openBuilding === "storage"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-500" />
              Storage Room
            </DialogTitle>
            <DialogDescription>Store your items and resources safely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "storage")!;
              const level = getRoomLevel("storage");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["storage"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                    <span className="text-sm text-muted-foreground">Capacity: {100 * level} / 1000</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("storage")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rest Area Dialog */}
      <Dialog open={openBuilding === "rest"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-500" />
              Rest Area
            </DialogTitle>
            <DialogDescription>Recover HP and energy faster.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "rest")!;
              const level = getRoomLevel("rest");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["rest"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                    <span className="text-sm text-muted-foreground">HP Regen: +{level * 10}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("rest")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weapon Locker Dialog */}
      <Dialog open={openBuilding === "weapon_locker"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-500" />
              Weapon Locker
            </DialogTitle>
            <DialogDescription>Store extra weapons and armor sets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "weapon_locker")!;
              const level = getRoomLevel("weapon_locker");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["weapon_locker"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                    <span className="text-sm text-muted-foreground">Slots: {level * 2}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("weapon_locker")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crafting Workshop Dialog */}
      <Dialog open={openBuilding === "crafting"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="w-5 h-5 text-orange-500" />
              Crafting Workshop
            </DialogTitle>
            <DialogDescription>Create weapons, armor, and consumables.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "crafting")!;
              const level = getRoomLevel("crafting");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["crafting"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                    <span className="text-sm text-muted-foreground">Success Bonus: +{level * 5}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("crafting")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-orange-400" /> Crafting Recipes
                </h4>
                <Badge variant="secondary">{craftingRecipes.length} recipes</Badge>
              </div>
              {craftingRecipes.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  <Hammer className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No crafting recipes available yet.</p>
                  <p className="text-xs mt-1">Advance your rank to unlock recipes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {craftingRecipes.map((recipe) => {
                    const canCraft = (account?.rank && recipe.requiredRank)
                      ? playerRanks.indexOf(account.rank as any) >= playerRanks.indexOf(recipe.requiredRank as any)
                      : false;
                    return (
                      <Card key={recipe.id} className={!canCraft ? "opacity-60" : ""}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{recipe.name}</CardTitle>
                            <Badge variant="outline" className="text-xs capitalize">{recipe.tier}</Badge>
                          </div>
                          {recipe.description && (
                            <CardDescription className="text-xs">{recipe.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Required Rank:</span>{" "}
                              <span className={canCraft ? "text-green-400" : "text-red-400"}>{recipe.requiredRank}</span>
                            </div>
                            <div className="text-xs">
                              <span className="font-medium text-muted-foreground">Ingredients:</span>
                              <div className="mt-1 space-y-0.5">
                                {recipe.ingredients.map((ing, i) => (
                                  <div key={i} className="flex items-center gap-1 text-muted-foreground">
                                    <span>×{ing.quantity}</span>
                                    <span className="capitalize">{ing.itemId.replace(/_/g, " ")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {recipe.goldCost > 0 && (
                              <div className="text-xs flex items-center gap-1 text-yellow-400">
                                <Coins className="w-3 h-3" />
                                {recipe.goldCost.toLocaleString()} gold
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              disabled={!canCraft || craftItemMutation.isPending}
                              onClick={() => craftItemMutation.mutate(recipe.id)}
                            >
                              <Hammer className="w-3 h-3 mr-1" />
                              {!canCraft ? `Requires ${recipe.requiredRank}` : "Craft"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Grounds Dialog */}
      <Dialog open={openBuilding === "training"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-purple-500" />
              Training Grounds
            </DialogTitle>
            <DialogDescription>Train your stats while offline. Accumulates XP while away.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "training")!;
              const level = getRoomLevel("training");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["training"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("training")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}

            <div className="border-t border-border pt-4">
              {currentTier >= 3 ? (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" /> Offline Training
                  </h3>
                  {trainingStatus?.active ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <p>Training: <strong>{trainingStatus.stat}</strong></p>
                        <p className="text-sm text-muted-foreground">Started: {trainingStatus.startedAt ? new Date(trainingStatus.startedAt).toLocaleTimeString() : "Unknown"}</p>
                        <p className="text-sm">Accumulated XP: <strong>{trainingStatus.accumulatedXp || 0}</strong></p>
                        <p className="text-xs text-muted-foreground">Rate: {trainingStatus.xpPerHour} XP/hour</p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => collectTrainingMutation.mutate()}
                        disabled={collectTrainingMutation.isPending}
                      >
                        Collect Training ({trainingStatus.accumulatedXp || 0} XP)
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Select a stat to train while offline (Max 24h):</p>
                      <div className="flex flex-wrap gap-2">
                        {["Str", "Def", "Spd", "Int", "Luck"].map(stat => (
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
                        className="w-full"
                        onClick={() => startTrainingMutation.mutate(selectedTrainingStat)}
                        disabled={startTrainingMutation.isPending}
                      >
                        Start Training {selectedTrainingStat}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Offline training unlocks at Tier 3 (Keep)</p>
                  <p className="text-xs mt-1">Upgrade your base to train stats while offline.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secure Vault Dialog */}
      <Dialog open={openBuilding === "vault"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              Secure Vault
            </DialogTitle>
            <DialogDescription>Store gold safely and earn daily interest.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "vault")!;
              const level = getRoomLevel("vault");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["vault"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("vault")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}

            <div className="border-t border-border pt-4">
              {currentTier >= 4 ? (
                <div className="space-y-4">
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
                    <Button size="sm" onClick={handleVaultDeposit} disabled={!vaultAmount}>Deposit</Button>
                    <Button size="sm" variant="outline" onClick={handleVaultWithdraw} disabled={!vaultAmount}>Withdraw</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gold in the vault is protected from raids and PvP losses. Interest is calculated on login.
                  </p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Vault operations unlock at Tier 4 (Manor)</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Defense Tower Dialog */}
      <Dialog open={openBuilding === "defenses"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-400" />
              Defense Tower
            </DialogTitle>
            <DialogDescription>Arrow Traps, Magic Wards, and elite guards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const room = baseRooms.find(r => r.id === "defenses")!;
              const level = getRoomLevel("defenses");
              const maxLevel = ROOM_MAX_LEVEL_BY_TIER[currentTier] || 3;
              const progress = (level / maxLevel) * 100;
              const upgradeCost = ROOM_UPGRADE_BASE_COST["defenses"] * level;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <Badge>Level {level} / {maxLevel}</Badge>
                    <span className="text-sm text-muted-foreground">Defense Rating: {level * 10}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="space-y-1">
                    {room.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-primary" />{b}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={level >= maxLevel}
                    onClick={() => handleUpgradeRoom("defenses")}
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    {level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toLocaleString()} Gold)`}
                  </Button>
                </>
              );
            })()}

            {currentTier >= 3 ? (
              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground">TRAPS & SENTRIES</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-secondary/50 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium flex items-center gap-2"><Target className="w-4 h-4 text-red-400" />Arrow Traps</p>
                      <Badge variant="outline" className="text-xs">Level {getRoomLevel("defenses")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Deals {getRoomLevel("defenses") * 50} damage to raiders.</p>
                    <Progress value={getRoomLevel("defenses") * 10} className="h-1.5" />
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />Magical Wards</p>
                      <Badge variant="outline" className="text-xs">Level {getRoomLevel("defenses")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Reduces gold lost by {getRoomLevel("defenses") * 5}%.</p>
                    <Progress value={getRoomLevel("defenses") * 10} className="h-1.5" />
                  </div>
                  {currentTier >= 4 && (
                    <>
                      <div className="p-4 rounded-lg bg-secondary/50 border border-orange-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" />Fire Pits</p>
                          <Badge variant="outline" className="text-xs bg-orange-500/10">Tier 4+</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Burns {getRoomLevel("defenses") * 2}% of raider HP over time.</p>
                        <Progress value={getRoomLevel("defenses") * 10} className="h-1.5" />
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/50 border border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" />Reinforced Walls</p>
                          <Badge variant="outline" className="text-xs bg-blue-500/10">Tier 4+</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">+{getRoomLevel("defenses") * 100} base defense rating.</p>
                        <Progress value={getRoomLevel("defenses") * 10} className="h-1.5" />
                      </div>
                    </>
                  )}
                  {currentTier >= 5 && (
                    <>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-400" />Arcane Sentinels</p>
                          <Badge className="text-xs bg-purple-600">Tier 5</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Summons {Math.floor(getRoomLevel("defenses") / 2) + 1} magical guardians.</p>
                        <Progress value={getRoomLevel("defenses") * 10} className="h-1.5" />
                      </div>
                      <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-400" />Dragon's Wrath</p>
                          <Badge className="text-xs bg-yellow-600">Tier 5</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Ultimate defense — 25% chance to instantly defeat raiders.</p>
                        <Progress value={100} className="h-1.5" />
                      </div>
                    </>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-muted-foreground pt-2">HIRE GUARDS</h4>
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
                      <Crown className="w-8 h-8 text-purple-400" />
                      <div>
                        <p className="font-medium">Dragon Guard</p>
                        <p className="text-xs text-muted-foreground">Legendary protectors</p>
                      </div>
                    </div>
                    <p className="text-xs mb-2">+2000 Defense Rating</p>
                    <Button size="sm" variant="outline" className="w-full" disabled={currentTier < 5}>
                      {currentTier >= 5 ? <><Coins className="w-3 h-3 mr-1" /> 1,000,000/day</> : <><Lock className="w-3 h-3 mr-1" /> Tier 5</>}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-4 text-center text-muted-foreground py-4">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Defense systems unlock at Tier 3 (Keep)</p>
                <p className="text-xs mt-1">Upgrade your base to access traps and guards.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* War Room (Raids) Dialog */}
      <Dialog open={openBuilding === "raids"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              War Room — NPC Raids
            </DialogTitle>
            <DialogDescription>Test your defenses against waves of attackers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Raids scale with your rank. Defend for gold and XP!</p>
              <Button onClick={handleTriggerRaid} disabled={isRaiding} variant="destructive" size="sm">
                {isRaiding ? "Defending..." : "Trigger Raid"}
              </Button>
            </div>

            {raidResult && (
              <div className={`p-4 rounded-lg ${raidResult.result === "victory" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                <p className="font-medium">{raidResult.message}</p>
                {raidResult.rewards && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Rewards: {raidResult.rewards.gold.toLocaleString()} gold, {raidResult.rewards.exp} exp
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Events Hall Dialog */}
      <Dialog open={openBuilding === "events"} onOpenChange={(open) => !open && setOpenBuilding(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Events Hall
            </DialogTitle>
            <DialogDescription>Weekly events and visitor system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {weeklyEvent?.active && (
              <div className={`p-4 rounded-lg ${weeklyEvent.active.type === "hero" ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-purple-500/10 border border-purple-500/30"}`}>
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

            <div className="space-y-2">
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

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Visitor System</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setOpenBuilding(null); setVisitDialog(true); }}>
                  Visit Player Base
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Visit other players' bases to see their trophies (80% visible). Upgrade your base to impress visitors!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBuilding(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Base Skins Dialog */}
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

      {/* Trophies Dialog */}
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

      {/* Visit Player Base Dialog */}
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
                    <div><span className="text-muted-foreground">Race:</span><span className="ml-2 capitalize">{visitorData.ownerRace}</span></div>
                    <div><span className="text-muted-foreground">Base Tier:</span><span className="ml-2">{visitorData.baseTier}</span></div>
                    <div><span className="text-muted-foreground">Base Skin:</span><span className="ml-2 capitalize">{visitorData.baseSkin}</span></div>
                    <div><span className="text-muted-foreground">Total Trophies:</span><span className="ml-2">{visitorData.trophyCount}</span></div>
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
    </ZoneScene>
  );
}
