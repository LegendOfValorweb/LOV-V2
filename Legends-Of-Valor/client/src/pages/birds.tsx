import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bird, Shield, ShoppingBag, ArrowUp, Coins, Loader2, Utensils, Palette, Sparkles, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ZoneScene } from "@/components/zone-scene";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BirdFood {
  id: string;
  name: string;
  price: number;
  defBoost: number;
  spdBoost: number;
  resourceLuckBoost: number;
  carryBoostBoost: number;
}

interface BirdData {
  id: string;
  accountId: string;
  name: string;
  tier: string;
  element: string | null;
  exp: number;
  stats: { Def: number; Spd: number; resourceLuck?: number; carryBoost?: number };
  createdAt: string;
}

interface ShopBird {
  id: string;
  name: string;
  tier: string;
  cost: number;
  element: string;
  baseStats: { Def: number; Spd: number; resourceLuck: number; carryBoost: number };
}

interface ConvergenceData {
  raceElement: string | null;
  petElement: string | null;
  birds: Array<{
    birdId: string;
    birdName: string;
    birdElement: string | null;
    convergence: {
      initiativeBonus: number;
      defenseBonus: number;
      tripleBonus: number;
      description: string[];
    };
  }>;
}

const tierColors: Record<string, string> = {
  egg: "bg-stone-500/20 text-stone-400 border-stone-500/30",
  hatchling: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  adolescent: "bg-green-500/20 text-green-400 border-green-500/30",
  adult: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  elder: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legend: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  immortal: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

const tierEmojis: Record<string, string> = {
  egg: "🥚",
  hatchling: "🐣",
  adolescent: "🐤",
  adult: "🐦",
  elder: "🦅",
  legend: "🦉",
  immortal: "🔥",
};

const EVOLUTION_COSTS: Record<string, { focusShards: number; beakCoins: number } | null> = {
  egg: { focusShards: 50, beakCoins: 100 },
  hatchling: { focusShards: 150, beakCoins: 300 },
  adolescent: { focusShards: 400, beakCoins: 800 },
  adult: { focusShards: 1000, beakCoins: 2000 },
  elder: { focusShards: 2500, beakCoins: 5000 },
  legend: { focusShards: 5000, beakCoins: 10000 },
  immortal: null,
};

const TIER_ORDER = ["egg", "hatchling", "adolescent", "adult", "elder", "legend", "immortal"];

function getNextTier(tier: string): string | null {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export default function Birds() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const { toast } = useToast();
  const [buyingBird, setBuyingBird] = useState<ShopBird | null>(null);
  const [customName, setCustomName] = useState("");
  const [feedingBird, setFeedingBird] = useState<BirdData | null>(null);
  const [selectedFood, setSelectedFood] = useState<BirdFood | null>(null);
  const [skinDialog, setSkinDialog] = useState<BirdData | null>(null);
  const [isSettingSkin, setIsSettingSkin] = useState(false);
  const [evolvingBird, setEvolvingBird] = useState<BirdData | null>(null);

  const { data: shopBirds = [] } = useQuery<ShopBird[]>({
    queryKey: ["/api/bird-shop"],
    queryFn: async () => {
      const res = await fetch("/api/bird-shop");
      return res.json();
    },
  });

  const { data: myBirds = [], isLoading } = useQuery<BirdData[]>({
    queryKey: ["/api/accounts", account?.id, "birds"],
    queryFn: async () => {
      if (!account?.id) return [];
      const res = await fetch(`/api/accounts/${account.id}/birds`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  const { data: birdFood = [] } = useQuery<BirdFood[]>({
    queryKey: ["/api/bird-food"],
    queryFn: async () => {
      const res = await fetch("/api/bird-food");
      return res.json();
    },
  });

  const { data: convergence } = useQuery<ConvergenceData>({
    queryKey: ["/api/accounts", account?.id, "convergence"],
    queryFn: async () => {
      if (!account?.id) return { raceElement: null, petElement: null, birds: [] };
      const res = await fetch(`/api/accounts/${account.id}/convergence`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  interface BirdSkin {
    id: string;
    name: string;
    cost: number;
  }

  const { data: birdSkins = [] } = useQuery<BirdSkin[]>({
    queryKey: ["/api/bird-skins"],
    queryFn: async () => {
      const res = await fetch("/api/bird-skins");
      return res.json();
    },
  });

  const handleSetSkin = async (bird: BirdData, skin: string) => {
    if (!account) return;
    setIsSettingSkin(true);
    try {
      const res = await apiRequest("PATCH", `/api/birds/${bird.id}/skin`, { 
        accountId: account.id, 
        skin 
      });
      const data = await res.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account.id, "birds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account.id] });
      
      toast({
        title: "Skin Applied!",
        description: data.message,
      });
      setSkinDialog(null);
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message || "Could not set skin.",
        variant: "destructive",
      });
    } finally {
      setIsSettingSkin(false);
    }
  };

  const buyMutation = useMutation({
    mutationFn: async ({ birdId, customName }: { birdId: string; customName?: string }) => {
      const res = await apiRequest("POST", "/api/bird-shop/buy", {
        accountId: account?.id,
        birdId,
        customName,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bird Purchased!",
        description: `${data.bird.name} has joined your flock!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "birds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      setBuyingBird(null);
      setCustomName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const feedMutation = useMutation({
    mutationFn: async ({ birdId, foodId }: { birdId: string; foodId: string }) => {
      const res = await apiRequest("POST", `/api/birds/${birdId}/feed`, {
        accountId: account?.id,
        foodId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bird Fed!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "birds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      setFeedingBird(null);
      setSelectedFood(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Feeding Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const evolveMutation = useMutation({
    mutationFn: async ({ birdId }: { birdId: string }) => {
      const res = await apiRequest("POST", `/api/birds/${birdId}/evolve`, {
        accountId: account?.id,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Evolution Complete!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "birds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "convergence"] });
      setEvolvingBird(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Evolution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!account) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view birds</p>
      </div>
    );
  }

  return (
    <ZoneScene
      zoneName="Aviary"
      backdrop="/backdrops/fishing.png"
      ambientClass="zone-ambient-forest"
      overlayOpacity={0.4}
    >
      <div className="h-full flex flex-col p-3">
        <div className="flex-shrink-0 mb-3">
          <div className="flex items-center justify-between">
            <div className="rpg-panel px-3 py-1.5 inline-flex items-center gap-2">
              <Bird className="w-5 h-5 text-sky-400" />
              <span className="rpg-heading text-sm">Bird Aviary</span>
            </div>
            <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sky-400 border-sky-500/50">
              <Bird className="w-3 h-3 mr-1" />
              {account.beakCoins?.toLocaleString() || 0} Beak Coins
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-500/50">
              <Coins className="w-3 h-3 mr-1" />
              {account.focusedShards?.toLocaleString() || 0} Focus Shards
            </Badge>
            </div>
          </div>
        </div>

        {convergence && (convergence.raceElement || convergence.petElement) && convergence.birds.some(b => b.convergence.description.length > 0) && (
          <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Elemental Convergence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                {convergence.raceElement && <span>Race Element: <span className="text-yellow-400">{convergence.raceElement}</span></span>}
                {convergence.petElement && <span>Pet Element: <span className="text-cyan-400">{convergence.petElement}</span></span>}
              </div>
              {convergence.birds.filter(b => b.convergence.description.length > 0).map(b => (
                <div key={b.birdId} className="text-xs">
                  {b.convergence.description.map((desc, i) => (
                    <p key={i} className="text-yellow-300">{desc}</p>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Bird Shop (Eggs)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shopBirds.map((bird) => (
                <div
                  key={bird.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tierEmojis[bird.tier] || "🥚"}</span>
                    <div>
                      <p className="font-medium">{bird.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={tierColors[bird.tier]}>
                          {bird.tier}
                        </Badge>
                        <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                          {bird.element}
                        </Badge>
                        <span>DEF: {bird.baseStats.Def}</span>
                        <span>SPD: {bird.baseStats.Spd}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setBuyingBird(bird)}
                    disabled={account.focusedShards < bird.cost}
                  >
                    <Coins className="w-3 h-3 mr-1" />
                    {bird.cost}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                My Birds ({myBirds.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : myBirds.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No birds yet. Purchase an egg from the shop!
                </p>
              ) : (
                <div className="space-y-3">
                  {myBirds.map((bird) => {
                    const nextTier = getNextTier(bird.tier);
                    const evoCost = EVOLUTION_COSTS[bird.tier];
                    const canEvolve = nextTier && evoCost && 
                      account.focusedShards >= evoCost.focusShards && 
                      account.beakCoins >= evoCost.beakCoins;
                    const birdConvergence = convergence?.birds.find(b => b.birdId === bird.id);

                    return (
                      <div
                        key={bird.id}
                        className="p-3 rounded-lg border bg-card/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tierEmojis[bird.tier] || "🐦"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{bird.name}</p>
                              {bird.element && (
                                <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 text-[10px] shrink-0">
                                  {bird.element}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={tierColors[bird.tier]}>
                                {bird.tier}
                              </Badge>
                              {birdConvergence && birdConvergence.convergence.description.length > 0 && (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 text-[10px]">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                  Resonance
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs mr-2 shrink-0">
                            <p className="text-blue-400">DEF: {bird.stats.Def}</p>
                            <p className="text-green-400">SPD: {bird.stats.Spd}</p>
                            {(bird.stats.resourceLuck || 0) > 0 && <p className="text-amber-400">Luck: +{bird.stats.resourceLuck}</p>}
                            {(bird.stats.carryBoost || 0) > 0 && <p className="text-orange-400">Carry: +{bird.stats.carryBoost}</p>}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            {nextTier && (
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs"
                                onClick={() => setEvolvingBird(bird)}
                                disabled={!canEvolve}
                              >
                                <ArrowUp className="w-3 h-3 mr-1" />
                                Evolve
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => setFeedingBird(bird)}
                            >
                              <Utensils className="w-3 h-3 mr-1" />
                              Feed
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => setSkinDialog(bird)}
                              title="Change Skin"
                            >
                              <Palette className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {nextTier && evoCost && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                            <Zap className="w-3 h-3 text-purple-400" />
                            <span>Evolve to <span className="capitalize font-medium text-foreground">{nextTier}</span>:</span>
                            <span className={account.focusedShards >= evoCost.focusShards ? "text-green-400" : "text-red-400"}>
                              {evoCost.focusShards} Shards
                            </span>
                            <span>+</span>
                            <span className={account.beakCoins >= evoCost.beakCoins ? "text-green-400" : "text-red-400"}>
                              {evoCost.beakCoins} Beak Coins
                            </span>
                          </div>
                        )}
                        {bird.tier === "immortal" && (
                          <div className="mt-2 pt-2 border-t border-yellow-500/30 text-xs text-yellow-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Max Evolution Reached
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!buyingBird} onOpenChange={() => setBuyingBird(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purchase {buyingBird?.name}?</DialogTitle>
              <DialogDescription>
                This will cost {buyingBird?.cost} focus shards. You'll receive a {buyingBird?.element} element egg.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Custom Name (optional)</label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={buyingBird?.name}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBuyingBird(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => buyingBird && buyMutation.mutate({ birdId: buyingBird.id, customName: customName || undefined })}
                disabled={buyMutation.isPending}
              >
                {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Purchase
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!evolvingBird} onOpenChange={() => setEvolvingBird(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUp className="w-5 h-5 text-purple-400" />
                Evolve {evolvingBird?.name}?
              </DialogTitle>
              <DialogDescription>
                {evolvingBird && getNextTier(evolvingBird.tier) && (
                  <>
                    Evolve from <span className="capitalize font-medium">{evolvingBird.tier}</span> to{" "}
                    <span className="capitalize font-medium">{getNextTier(evolvingBird.tier)}</span>.
                    Stats will increase significantly!
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {evolvingBird && EVOLUTION_COSTS[evolvingBird.tier] && (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between p-3 rounded-md bg-purple-500/10 border border-purple-500/20">
                  <span className="text-sm">Focus Shards Cost</span>
                  <span className={`font-mono font-bold ${account.focusedShards >= (EVOLUTION_COSTS[evolvingBird.tier]?.focusShards || 0) ? "text-green-400" : "text-red-400"}`}>
                    {EVOLUTION_COSTS[evolvingBird.tier]?.focusShards} (have {account.focusedShards})
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-sky-500/10 border border-sky-500/20">
                  <span className="text-sm">Beak Coins Cost</span>
                  <span className={`font-mono font-bold ${account.beakCoins >= (EVOLUTION_COSTS[evolvingBird.tier]?.beakCoins || 0) ? "text-green-400" : "text-red-400"}`}>
                    {EVOLUTION_COSTS[evolvingBird.tier]?.beakCoins} (have {account.beakCoins})
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEvolvingBird(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => evolvingBird && evolveMutation.mutate({ birdId: evolvingBird.id })}
                disabled={evolveMutation.isPending || !evolvingBird || !EVOLUTION_COSTS[evolvingBird.tier] ||
                  account.focusedShards < (EVOLUTION_COSTS[evolvingBird.tier]?.focusShards || Infinity) ||
                  account.beakCoins < (EVOLUTION_COSTS[evolvingBird.tier]?.beakCoins || Infinity)}
              >
                {evolveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Evolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!feedingBird} onOpenChange={() => { setFeedingBird(null); setSelectedFood(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Feed {feedingBird?.name}
              </DialogTitle>
              <DialogDescription>
                Buy food with Beak Coins to boost your bird's stats.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-sky-500/10 border border-sky-500/20">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Bird className="w-4 h-4 text-sky-400" />
                  Beak Coins
                </span>
                <span className="font-mono font-bold text-sky-400">{(account?.beakCoins || 0).toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                {birdFood.map((food) => {
                  const canAfford = (account?.beakCoins || 0) >= food.price;
                  return (
                    <div
                      key={food.id}
                      onClick={() => canAfford && setSelectedFood(food)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedFood?.id === food.id 
                          ? 'ring-2 ring-primary border-primary' 
                          : canAfford 
                            ? 'hover:bg-accent/50' 
                            : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{food.name}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {food.defBoost > 0 && <span className="text-blue-400">+{food.defBoost} DEF</span>}
                            {food.spdBoost > 0 && <span className="text-green-400">+{food.spdBoost} SPD</span>}
                            {food.resourceLuckBoost > 0 && <span className="text-amber-400">+{food.resourceLuckBoost} Luck</span>}
                            {food.carryBoostBoost > 0 && <span className="text-orange-400">+{food.carryBoostBoost} Carry</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-sky-400">
                          <Bird className="w-3 h-3 mr-1" />
                          {food.price.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setFeedingBird(null); setSelectedFood(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => feedingBird && selectedFood && feedMutation.mutate({ 
                  birdId: feedingBird.id, 
                  foodId: selectedFood.id 
                })}
                disabled={feedMutation.isPending || !selectedFood}
              >
                {feedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {selectedFood ? `Feed (${selectedFood.price.toLocaleString()} Beak Coins)` : "Select Food"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!skinDialog} onOpenChange={() => setSkinDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Skins for {skinDialog?.name}
              </DialogTitle>
              <DialogDescription>
                Choose a cosmetic skin for your bird. Some skins cost gold to apply.
              </DialogDescription>
            </DialogHeader>
            {skinDialog && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    Your Gold
                  </span>
                  <span className="font-mono font-bold text-yellow-500">{(account?.gold || 0).toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Current Skin: <span className="capitalize font-medium">{(skinDialog as any).skin || "default"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {birdSkins.map(skin => {
                    const isCurrentSkin = (skinDialog as any).skin === skin.id || (!((skinDialog as any).skin) && skin.id === "default");
                    const canAfford = skin.cost === 0 || (account?.gold || 0) >= skin.cost || isCurrentSkin;
                    return (
                      <Button
                        key={skin.id}
                        variant={isCurrentSkin ? "default" : "outline"}
                        className="flex flex-col items-center py-3 h-auto"
                        disabled={isSettingSkin || (!canAfford && !isCurrentSkin)}
                        onClick={() => handleSetSkin(skinDialog, skin.id)}
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
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkinDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ZoneScene>
  );
}
