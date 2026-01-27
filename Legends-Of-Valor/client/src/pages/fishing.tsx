import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Fish, ArrowLeft, Loader2, Sparkles, Zap, Clover, Flame, Droplet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-orange-500/20 text-orange-400 border-orange-500/30",
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
        description: `A ${data.fish.rarity} ${data.fish.name}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "fish"] });
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
        description: `${data.fishConsumed} was consumed. Your pet gained its stats and element!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "fish"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "pets"] });
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

  const startFishing = () => {
    setIsFishing(true);
    setLastCatch(null);
    setTimeout(() => {
      fishMutation.mutate();
    }, 2000);
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to go fishing</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900/20 to-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/shop")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold font-serif flex items-center gap-2">
              <Fish className="w-6 h-6 text-blue-400" />
              Fishing
            </h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-6xl">🌊</div>
                    <p className="text-muted-foreground">
                      Cast your line to catch fish!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Feed fish to your pets to transfer their stats and elements
                    </p>
                  </div>
                )}
              </div>

              <Button
                size="lg"
                onClick={startFishing}
                disabled={isFishing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isFishing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fishing...
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFeedingFish(fish)}
                          disabled={myPets.length === 0}
                        >
                          Feed to Pet
                        </Button>
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
                The fish will be consumed and all its stats and element will be added to your pet.
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
    </div>
  );
}
