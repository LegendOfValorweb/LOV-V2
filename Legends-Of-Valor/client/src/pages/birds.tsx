import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bird, Shield, ShoppingBag, ArrowLeft, Coins, Loader2, Utensils } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
}

interface BirdData {
  id: string;
  accountId: string;
  name: string;
  tier: string;
  stats: { Def: number; Spd: number };
  createdAt: string;
}

interface ShopBird {
  id: string;
  name: string;
  tier: string;
  cost: number;
  baseStats: { Def: number; Spd: number };
}

const tierColors: Record<string, string> = {
  hatchling: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  fledgling: "bg-green-500/20 text-green-400 border-green-500/30",
  soarer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  raptor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  phoenix: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const tierEmojis: Record<string, string> = {
  hatchling: "🐦",
  fledgling: "🐤",
  soarer: "🦅",
  raptor: "🦉",
  phoenix: "🔥",
};

export default function Birds() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const { toast } = useToast();
  const [buyingBird, setBuyingBird] = useState<ShopBird | null>(null);
  const [customName, setCustomName] = useState("");
  const [feedingBird, setFeedingBird] = useState<BirdData | null>(null);
  const [selectedFood, setSelectedFood] = useState<BirdFood | null>(null);

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

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view birds</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/shop")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold font-serif flex items-center gap-2">
              <Bird className="w-6 h-6 text-sky-400" />
              Bird Aviary
            </h1>
          </div>
          <Badge variant="outline" className="text-purple-400 border-purple-500/50">
            <Coins className="w-3 h-3 mr-1" />
            {account.focusedShards?.toLocaleString() || 0} Focus Shards
          </Badge>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Bird Shop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shopBirds.map((bird) => (
                <div
                  key={bird.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tierEmojis[bird.tier] || "🐦"}</span>
                    <div>
                      <p className="font-medium">{bird.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={tierColors[bird.tier]}>
                          {bird.tier}
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
                  No birds yet. Purchase one from the shop!
                </p>
              ) : (
                <div className="space-y-3">
                  {myBirds.map((bird) => (
                    <div
                      key={bird.id}
                      className="p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tierEmojis[bird.tier] || "🐦"}</span>
                        <div className="flex-1">
                          <p className="font-medium">{bird.name}</p>
                          <Badge variant="outline" className={tierColors[bird.tier]}>
                            {bird.tier}
                          </Badge>
                        </div>
                        <div className="text-right text-sm mr-2">
                          <p className="text-blue-400">DEF: {bird.stats.Def}</p>
                          <p className="text-green-400">SPD: {bird.stats.Spd}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFeedingBird(bird)}
                          className="shrink-0"
                        >
                          <Utensils className="w-3 h-3 mr-1" />
                          Feed
                        </Button>
                      </div>
                    </div>
                  ))}
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
                This will cost {buyingBird?.cost} focus shards.
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

        <Dialog open={!!feedingBird} onOpenChange={() => { setFeedingBird(null); setSelectedFood(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Feed {feedingBird?.name}
              </DialogTitle>
              <DialogDescription>
                Buy food with gold to boost your bird's stats.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-sm font-medium">Your Gold</span>
                <span className="font-mono font-bold text-yellow-500">{(account?.gold || 0).toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                {birdFood.map((food) => {
                  const canAfford = (account?.gold || 0) >= food.price;
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
                          </div>
                        </div>
                        <Badge variant="outline" className="text-yellow-500">
                          <Coins className="w-3 h-3 mr-1" />
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
                {selectedFood ? `Feed (${selectedFood.price.toLocaleString()} Gold)` : "Select Food"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
