import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  ArrowLeft,
  Gem,
  Egg,
  Star,
  Zap,
  Heart,
  Shield,
  Lock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PetEgg {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  rubyPrice: number;
  statBonus: {
    minStr: number;
    maxStr: number;
    minSpd: number;
    maxSpd: number;
    minLuck: number;
    maxLuck: number;
    minElem: number;
    maxElem: number;
  };
  guaranteedElements?: string[];
  rankRequired: string;
}

const PET_EGGS: PetEgg[] = [
  {
    id: "common_egg",
    name: "Forest Egg",
    description: "A simple egg found in the wild. Basic starting stats.",
    rarity: "common",
    rubyPrice: 500,
    statBonus: { minStr: 1, maxStr: 5, minSpd: 1, maxSpd: 5, minLuck: 1, maxLuck: 5, minElem: 1, maxElem: 5 },
    rankRequired: "Journeyman",
  },
  {
    id: "rare_egg",
    name: "Crystal Egg",
    description: "A shimmering egg with enhanced potential. Better base stats.",
    rarity: "rare",
    rubyPrice: 2500,
    statBonus: { minStr: 5, maxStr: 15, minSpd: 5, maxSpd: 15, minLuck: 5, maxLuck: 15, minElem: 5, maxElem: 15 },
    rankRequired: "Expert",
  },
  {
    id: "epic_egg",
    name: "Storm Egg",
    description: "Crackling with elemental energy. Strong starting stats guaranteed.",
    rarity: "epic",
    rubyPrice: 10000,
    statBonus: { minStr: 15, maxStr: 35, minSpd: 15, maxSpd: 35, minLuck: 10, maxLuck: 25, minElem: 20, maxElem: 50 },
    guaranteedElements: ["Lightning", "Fire", "Ice"],
    rankRequired: "Master",
  },
  {
    id: "legendary_egg",
    name: "Dragon Egg",
    description: "Ancient and powerful. Exceptional stats with rare element chance.",
    rarity: "legendary",
    rubyPrice: 35000,
    statBonus: { minStr: 35, maxStr: 75, minSpd: 30, maxSpd: 65, minLuck: 20, maxLuck: 50, minElem: 50, maxElem: 100 },
    guaranteedElements: ["Dark", "Light", "Arcana"],
    rankRequired: "Grand Master",
  },
  {
    id: "mythic_egg",
    name: "Void Egg",
    description: "Legendary artifact from another dimension. Maximum potential unlocked.",
    rarity: "mythic",
    rubyPrice: 100000,
    statBonus: { minStr: 75, maxStr: 150, minSpd: 70, maxSpd: 140, minLuck: 50, maxLuck: 100, minElem: 100, maxElem: 200 },
    guaranteedElements: ["Void", "Aether", "Chrono", "Plasma"],
    rankRequired: "Legend",
  },
  {
    id: "divine_egg",
    name: "Celestial Egg",
    description: "Born from the heavens. The ultimate pet companion awaits within.",
    rarity: "mythic",
    rubyPrice: 250000,
    statBonus: { minStr: 150, maxStr: 300, minSpd: 140, maxSpd: 280, minLuck: 100, maxLuck: 200, minElem: 200, maxElem: 400 },
    guaranteedElements: ["Elemental Convergence"],
    rankRequired: "Mythical Legend",
  },
];

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 border-gray-500 text-gray-300",
  rare: "bg-blue-500/20 border-blue-500 text-blue-300",
  epic: "bg-purple-500/20 border-purple-500 text-purple-300",
  legendary: "bg-yellow-500/20 border-yellow-500 text-yellow-300",
  mythic: "bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500 text-pink-300",
};

const RANK_ORDER = [
  "Novice", "Apprentice", "Journeyman", "Expert", "Master",
  "Grand Master", "Champion", "Hero", "Legend", "Mythical Legend"
];

export default function PetShop() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [selectedEgg, setSelectedEgg] = useState<PetEgg | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const playerRankIndex = RANK_ORDER.indexOf(account.rank || "Novice");

  const canAfford = (egg: PetEgg) => (account.rubies || 0) >= egg.rubyPrice;
  const meetsRank = (egg: PetEgg) => playerRankIndex >= RANK_ORDER.indexOf(egg.rankRequired);

  const handlePurchase = async () => {
    if (!selectedEgg || !account) return;
    
    setIsPurchasing(true);
    try {
      const res = await apiRequest("POST", "/api/pet-shop/purchase", {
        accountId: account.id,
        eggId: selectedEgg.id,
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Egg Purchased!",
          description: `You received a ${data.pet.name}! Check your pets page.`,
        });
        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) {
          setAccount(await accRes.json());
        }
      }
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message || "Could not purchase egg",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
      setSelectedEgg(null);
    }
  };

  return (
    <div className="h-full relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/pets.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />
      
      <div className="relative z-10">
        <header className="border-b border-border/50 bg-black/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Egg className="w-6 h-6 text-purple-400" />
                  <h1 className="text-2xl font-serif font-bold">Mystic Egg Emporium</h1>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Gem className="w-4 h-4 text-pink-400" />
                  <span className="font-mono">{(account.rubies || 0).toLocaleString()} Rubies</span>
                </div>
                <Badge variant="secondary">{account.rank || "Novice"}</Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-lg text-muted-foreground">
              Purchase premium pet eggs with enhanced starting stats
            </h2>
            <p className="text-sm text-yellow-400 mt-2">
              Higher rarity eggs guarantee better stats and rare elements!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PET_EGGS.map((egg) => {
              const affordable = canAfford(egg);
              const hasRank = meetsRank(egg);
              const available = affordable && hasRank;

              return (
                <Card 
                  key={egg.id}
                  className={`relative overflow-hidden transition-all ${rarityColors[egg.rarity]} ${
                    available ? 'cursor-pointer hover:scale-105' : 'opacity-60'
                  }`}
                  onClick={() => available && setSelectedEgg(egg)}
                >
                  {!hasRank && (
                    <div className="absolute top-2 right-2 bg-red-500/80 rounded-full p-1">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Egg className={`w-6 h-6 ${
                          egg.rarity === "mythic" ? "text-pink-400" :
                          egg.rarity === "legendary" ? "text-yellow-400" :
                          egg.rarity === "epic" ? "text-purple-400" :
                          egg.rarity === "rare" ? "text-blue-400" : "text-gray-400"
                        }`} />
                        {egg.name}
                      </CardTitle>
                      <Badge className={rarityColors[egg.rarity]}>
                        {egg.rarity.charAt(0).toUpperCase() + egg.rarity.slice(1)}
                      </Badge>
                    </div>
                    <CardDescription>{egg.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-red-400" />
                        <span>STR: {egg.statBonus.minStr}-{egg.statBonus.maxStr}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span>SPD: {egg.statBonus.minSpd}-{egg.statBonus.maxSpd}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-green-400" />
                        <span>LCK: {egg.statBonus.minLuck}-{egg.statBonus.maxLuck}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-orange-400" />
                        <span>ELEM: {egg.statBonus.minElem}-{egg.statBonus.maxElem}</span>
                      </div>
                    </div>

                    {egg.guaranteedElements && (
                      <div className="flex flex-wrap gap-1">
                        {egg.guaranteedElements.map(elem => (
                          <Badge key={elem} variant="outline" className="text-xs">
                            {elem}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Requires: {egg.rankRequired}
                        </span>
                        <div className="flex items-center gap-1 font-bold">
                          <Gem className="w-4 h-4 text-pink-400" />
                          <span className={affordable ? "text-green-400" : "text-red-400"}>
                            {egg.rubyPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>

        <Dialog open={!!selectedEgg} onOpenChange={() => setSelectedEgg(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Egg className="w-5 h-5 text-purple-400" />
                Purchase {selectedEgg?.name}?
              </DialogTitle>
              <DialogDescription>
                This egg will hatch into a pet with enhanced starting stats!
              </DialogDescription>
            </DialogHeader>

            {selectedEgg && (
              <div className="py-4 space-y-4">
                <div className={`p-4 rounded-lg ${rarityColors[selectedEgg.rarity]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedEgg.name}</span>
                    <Badge>{selectedEgg.rarity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedEgg.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>STR: {selectedEgg.statBonus.minStr}-{selectedEgg.statBonus.maxStr}</div>
                    <div>SPD: {selectedEgg.statBonus.minSpd}-{selectedEgg.statBonus.maxSpd}</div>
                    <div>LCK: {selectedEgg.statBonus.minLuck}-{selectedEgg.statBonus.maxLuck}</div>
                    <div>ELEM: {selectedEgg.statBonus.minElem}-{selectedEgg.statBonus.maxElem}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span>Cost:</span>
                  <div className="flex items-center gap-2">
                    <Gem className="w-5 h-5 text-pink-400" />
                    <span className="font-bold text-lg">{selectedEgg.rubyPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span>Your Balance:</span>
                  <div className="flex items-center gap-2">
                    <Gem className="w-5 h-5 text-pink-400" />
                    <span className="font-mono">{(account.rubies || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedEgg(null)} disabled={isPurchasing}>
                Cancel
              </Button>
              <Button 
                onClick={handlePurchase} 
                disabled={isPurchasing}
                className="bg-gradient-to-r from-pink-600 to-purple-600"
              >
                {isPurchasing ? "Purchasing..." : "Confirm Purchase"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
