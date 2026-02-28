import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Fish, Loader2, Sparkles, Zap, Flame, Droplet, Weight, Coins, Anchor } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FishData {
  id: string;
  accountId: string;
  name: string;
  rarity: string;
  element: string | null;
  stats: { Str: number; Spd: number; Luck: number; ElementalPower: number };
  caughtAt: string;
}

interface PetData {
  id: string;
  name: string;
  element: string;
  tier: string;
}

interface FishingStatus {
  rod: { rank: string; name: string; luckBonus: number; rarityMultiplier: number };
  dailyCatchLimit: number;
  dailyFishCaught: number;
  catchesRemaining: number;
  feedCap: number;
  dailyPetFeedGain: number;
  feedRemaining: number;
}

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  mythic: "bg-red-500/20 text-red-400 border-red-500/30",
};

const sellPrices: Record<string, number> = {
  common: 50,
  uncommon: 100,
  rare: 250,
  epic: 500,
  legendary: 1000,
  mythic: 2500,
};

const elementIcons: Record<string, any> = {
  Fire: Flame,
  Water: Droplet,
  Nature: Sparkles,
  Shadow: Zap,
  Light: Sparkles,
  Plasma: Zap,
};

export default function Fishing() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const { toast } = useToast();
  const [isFishing, setIsFishing] = useState(false);
  const [lastCatch, setLastCatch] = useState<FishData | null>(null);
  const [feedingFish, setFeedingFish] = useState<FishData | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string>("");

  const { data: myFish = [], isLoading } = useQuery<FishData[]>({
    queryKey: ["/api/accounts", account?.id, "fish"],
    queryFn: async () => {
      if (!account?.id) return [];
      const res = await fetch(`/api/accounts/${account.id}/fish`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  const { data: myPets = [] } = useQuery<PetData[]>({
    queryKey: ["/api/accounts", account?.id, "pets"],
    queryFn: async () => {
      if (!account?.id) return [];
      const res = await fetch(`/api/accounts/${account.id}/pets`);
      return res.json();
    },
    enabled: !!account?.id,
  });

  const { data: carryCapacity } = useQuery<{ currentWeight: number; maxCapacity: number; remaining: number; isFull: boolean }>({
    queryKey: ["/api/accounts", account?.id, "carry-capacity"],
    queryFn: async () => {
      if (!account?.id) return { currentWeight: 0, maxCapacity: 50, remaining: 50, isFull: false };
      const res = await fetch(`/api/accounts/${account.id}/carry-capacity`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  const { data: fishingStatus } = useQuery<FishingStatus>({
    queryKey: ["/api/fishing/status", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const res = await fetch(`/api/fishing/status/${account.id}`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  const fishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fishing/cast", {
        accountId: account?.id,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastCatch(data.fish);
      toast({
        title: "You caught something!",
        description: `A ${data.fish.rarity} ${data.fish.name}! (Score: ${data.rarityScore})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "fish"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "carry-capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fishing/status", account?.id] });
      setIsFishing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fishing Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsFishing(false);
    },
  });

  const feedMutation = useMutation({
    mutationFn: async ({ petId, fishId }: { petId: string; fishId: string }) => {
      const res = await apiRequest("POST", `/api/pets/${petId}/feed-fish`, {
        accountId: account?.id,
        fishId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Fish Fed to Pet!",
        description: `${data.fishConsumed} was consumed. +${data.statGain} stats! (${data.feedRemaining} feed remaining today)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "fish"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "pets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fishing/status", account?.id] });
      setFeedingFish(null);
      setSelectedPetId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Feeding Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sellMutation = useMutation({
    mutationFn: async (fishId: string) => {
      const res = await apiRequest("POST", "/api/fishing/sell", {
        accountId: account?.id,
        fishId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Fish Sold!",
        description: `Sold ${data.fishName} for ${data.goldEarned} gold!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "fish"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "carry-capacity"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sale Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startFishing = () => {
    setIsFishing(true);
    setLastCatch(null);
    setTimeout(() => {
      fishMutation.mutate();
    }, 2000);
  };

  const canFish = !isFishing && !(carryCapacity?.isFull) && (fishingStatus?.catchesRemaining ?? 1) > 0;

  if (!account) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to go fishing</p>
      </div>
    );
  }

  return (
    <ZoneScene
      zoneName="Fishing Grounds"
      backdrop="/backdrops/fishing.png"
      ambientClass="zone-ambient-lake"
      overlayOpacity={0.35}
      interactables={[
        {
          id: "fishing-spot",
          type: "resource",
          name: "Fishing Spot",
          emoji: "🎣",
          position: { x: 70, y: 55 },
          animation: "shimmer",
          disabled: !canFish,
          onClick: startFishing,
        },
      ]}
    >
      <div className="h-full flex flex-col p-3">
        <div className="flex-shrink-0 mb-3">
          <div className="rpg-panel px-3 py-1.5 inline-flex items-center gap-2">
            <Fish className="w-5 h-5 text-blue-400" />
            <span className="rpg-heading text-sm">Lavic Lake</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {fishingStatus && (
              <Card className="border-amber-500/30">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Anchor className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-400">{fishingStatus.rod.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      Luck +{fishingStatus.rod.luckBonus} | x{fishingStatus.rod.rarityMultiplier.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily Catches</span>
                      <span className={fishingStatus.catchesRemaining === 0 ? "text-red-400 font-mono" : "font-mono"}>
                        {fishingStatus.dailyFishCaught}/{fishingStatus.dailyCatchLimit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Feed Today</span>
                      <span className={fishingStatus.feedRemaining === 0 ? "text-red-400 font-mono" : "font-mono"}>
                        {fishingStatus.dailyPetFeedGain}/{fishingStatus.feedCap}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-blue-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Fish className="w-5 h-5" />
                  Cast Your Line
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <div className="py-8">
                  {isFishing ? (
                    <div className="space-y-4">
                      <div className="text-6xl animate-bounce">🎣</div>
                      <p className="text-muted-foreground">Waiting for a bite...</p>
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                    </div>
                  ) : lastCatch ? (
                    <div className="space-y-4">
                      <div className="text-6xl">🐟</div>
                      <div className="p-4 rounded-lg bg-card border">
                        <p className="font-bold text-lg">{lastCatch.name}</p>
                        <Badge className={rarityColors[lastCatch.rarity]}>
                          {lastCatch.rarity}
                        </Badge>
                        {lastCatch.element && (
                          <Badge variant="outline" className="ml-2">
                            {lastCatch.element}
                          </Badge>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                          <p>STR: +{lastCatch.stats.Str}</p>
                          <p>SPD: +{lastCatch.stats.Spd}</p>
                          <p>LUCK: +{lastCatch.stats.Luck}</p>
                          <p>ELEM: +{lastCatch.stats.ElementalPower}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Sell value: {sellPrices[lastCatch.rarity] || 50} gold
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-6xl">🌊</div>
                      <p className="text-muted-foreground">
                        Cast your line to catch fish!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Feed fish to your pets, sell for gold, or save crafting materials
                      </p>
                    </div>
                  )}
                </div>

                {carryCapacity && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Weight className="w-3 h-3" /> Carry Weight
                      </span>
                      <span className={carryCapacity.isFull ? "text-red-400 font-mono" : "font-mono"}>
                        {carryCapacity.currentWeight} / {carryCapacity.maxCapacity}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${carryCapacity.isFull ? "bg-red-500" : carryCapacity.currentWeight / carryCapacity.maxCapacity > 0.8 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, (carryCapacity.currentWeight / carryCapacity.maxCapacity) * 100)}%` }}
                      />
                    </div>
                    {carryCapacity.isFull && (
                      <p className="text-xs text-red-400">Inventory full! Sell or discard items before fishing.</p>
                    )}
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={startFishing}
                  disabled={!canFish}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isFishing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fishing...
                    </>
                  ) : carryCapacity?.isFull ? (
                    <>
                      <Weight className="w-4 h-4 mr-2" />
                      Inventory Full
                    </>
                  ) : fishingStatus?.catchesRemaining === 0 ? (
                    <>
                      <Fish className="w-4 h-4 mr-2" />
                      Daily Limit Reached
                    </>
                  ) : (
                    <>
                      <Fish className="w-4 h-4 mr-2" />
                      Cast Line
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fish className="w-5 h-5" />
                My Fish ({myFish.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : myFish.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No fish yet. Go fishing to catch some!
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {myFish.map((fish) => (
                    <div
                      key={fish.id}
                      className="p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{fish.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={rarityColors[fish.rarity]}>
                              {fish.rarity}
                            </Badge>
                            {fish.element && (
                              <Badge variant="outline" className="text-xs">
                                {fish.element}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            <span>STR +{fish.stats.Str}</span>
                            <span>SPD +{fish.stats.Spd}</span>
                            <span>LUCK +{fish.stats.Luck}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFeedingFish(fish)}
                            disabled={myPets.length === 0 || (fishingStatus?.feedRemaining ?? 1) === 0}
                          >
                            Feed Pet
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-yellow-500 hover:text-yellow-400"
                            onClick={() => sellMutation.mutate(fish.id)}
                            disabled={sellMutation.isPending}
                          >
                            <Coins className="w-3 h-3 mr-1" />
                            {sellPrices[fish.rarity] || 50}g
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!feedingFish} onOpenChange={() => setFeedingFish(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Feed {feedingFish?.name} to Pet</DialogTitle>
              <DialogDescription>
                The fish will be consumed and your pet will gain stats based on the fish rarity.
                {fishingStatus && (
                  <span className="block mt-1">
                    Feed remaining today: {fishingStatus.feedRemaining}/{fishingStatus.feedCap}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {feedingFish && (
              <div className="space-y-4">
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium">{feedingFish.name}</p>
                  <p className="text-sm text-muted-foreground">
                    STR +{feedingFish.stats.Str}, SPD +{feedingFish.stats.Spd}, 
                    LUCK +{feedingFish.stats.Luck}, ELEM +{feedingFish.stats.ElementalPower}
                  </p>
                  {feedingFish.element && (
                    <p className="text-sm text-blue-400">Element: {feedingFish.element}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Select Pet</label>
                  <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a pet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myPets.map((pet) => (
                        <SelectItem key={pet.id} value={pet.id}>
                          {pet.name} ({pet.tier} - {pet.element})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedingFish(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => feedingFish && selectedPetId && feedMutation.mutate({ petId: selectedPetId, fishId: feedingFish.id })}
                disabled={!selectedPetId || feedMutation.isPending}
              >
                {feedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Feed Fish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ZoneScene>
  );
}
