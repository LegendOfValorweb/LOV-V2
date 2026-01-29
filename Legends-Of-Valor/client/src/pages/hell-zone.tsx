import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Flame, 
  ArrowLeft,
  Skull,
  Coins,
  Gem,
  Swords,
  AlertTriangle,
  Crown,
  Sparkles
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const HELL_CHALLENGES = [
  { 
    id: "demon_pit", 
    name: "Demon Pit", 
    description: "Face hordes of lesser demons",
    rewards: { gold: 50000, rubies: 25, soulShards: 50 },
    risk: "10% gold loss on defeat",
    difficulty: 1
  },
  { 
    id: "inferno_gauntlet", 
    name: "Inferno Gauntlet", 
    description: "Survive waves of fire elementals",
    rewards: { gold: 150000, rubies: 75, soulShards: 150 },
    risk: "25% gold loss on defeat",
    difficulty: 2
  },
  { 
    id: "blood_arena", 
    name: "Blood Arena", 
    description: "Battle against elite PvP champions",
    rewards: { gold: 500000, rubies: 200, soulShards: 400 },
    risk: "50% gold loss on defeat",
    difficulty: 3
  },
  { 
    id: "void_rift", 
    name: "Void Rift", 
    description: "Challenge creatures from beyond reality",
    rewards: { gold: 1500000, rubies: 500, soulShards: 1000 },
    risk: "75% gold loss on defeat",
    difficulty: 4
  },
  { 
    id: "archdemons_throne", 
    name: "Archdemon's Throne", 
    description: "Face the ultimate boss for mythic rewards",
    rewards: { gold: 5000000, rubies: 1500, soulShards: 3000, mythicItem: true },
    risk: "Character reset on defeat",
    difficulty: 5
  },
];

export default function HellZone() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [selectedChallenge, setSelectedChallenge] = useState<typeof HELL_CHALLENGES[0] | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<any>(null);

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const handleChallenge = async () => {
    if (!selectedChallenge) return;
    
    setIsFighting(true);
    setBattleResult(null);

    try {
      const res = await apiRequest("POST", "/api/hell-zone/challenge", {
        accountId: account.id,
        challengeId: selectedChallenge.id,
      });
      const data = await res.json();
      setBattleResult(data);

      const accRes = await fetch(`/api/accounts/${account.id}`);
      if (accRes.ok) {
        setAccount(await accRes.json());
      }
    } catch (error: any) {
      toast({
        title: "Challenge Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setSelectedChallenge(null);
    } finally {
      setIsFighting(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/arena.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/50 via-black/70 to-black/90" />
      
      <div className="relative z-10">
        <header className="border-b border-red-500/50 bg-black/70 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
                  <h1 className="text-2xl font-serif font-bold text-red-100">Hell Zone</h1>
                </div>
                <Badge className="bg-red-600 text-white flex items-center gap-1">
                  <Skull className="w-3 h-3" /> EXTREME DANGER
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-red-500/30">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span>{(account.gold || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-red-500/30">
                  <Gem className="w-4 h-4 text-pink-400" />
                  <span>{(account.rubies || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-yellow-400 mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">WARNING: HIGH RISK ZONE</span>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-red-200">
              The Hell Zone offers the greatest rewards in the realm, but failure comes with severe consequences.
              Only the strongest warriors should attempt these challenges.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Requires Grand Master rank or higher to enter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {HELL_CHALLENGES.map((challenge) => (
              <Card 
                key={challenge.id} 
                className="bg-gradient-to-br from-red-950/80 to-black/90 border-red-500/30 hover:border-red-500/60 transition-all cursor-pointer"
                onClick={() => setSelectedChallenge(challenge)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-100">
                    <Flame className="w-5 h-5 text-orange-500" />
                    {challenge.name}
                  </CardTitle>
                  <CardDescription className="text-red-200/70">
                    {challenge.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span>{challenge.rewards.gold.toLocaleString()} gold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gem className="w-4 h-4 text-pink-400" />
                      <span>{challenge.rewards.rubies} rubies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>{challenge.rewards.soulShards} soul shards</span>
                    </div>
                    {challenge.rewards.mythicItem && (
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-pink-400" />
                        <span className="text-pink-400">Mythic Item Chance!</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t border-red-500/30">
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <Skull className="w-3 h-3" />
                      {challenge.risk}
                    </p>
                  </div>

                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    Enter Challenge
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        <Dialog open={!!selectedChallenge} onOpenChange={() => { setSelectedChallenge(null); setBattleResult(null); }}>
          <DialogContent className="bg-gradient-to-br from-red-950 to-black border-red-500/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-100">
                <Flame className="w-5 h-5 text-orange-500" />
                {selectedChallenge?.name}
              </DialogTitle>
              <DialogDescription className="text-red-200/70">
                {battleResult ? (battleResult.victory ? "VICTORY!" : "DEFEAT...") : "Are you prepared to face this challenge?"}
              </DialogDescription>
            </DialogHeader>

            {!battleResult ? (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/30">
                  <h4 className="font-semibold text-red-100 mb-2">Rewards on Victory:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      {selectedChallenge?.rewards.gold.toLocaleString()} gold
                    </div>
                    <div className="flex items-center gap-1">
                      <Gem className="w-4 h-4 text-pink-400" />
                      {selectedChallenge?.rewards.rubies} rubies
                    </div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      {selectedChallenge?.rewards.soulShards} shards
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-black/50 border border-red-600/50">
                  <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Risk on Defeat:
                  </h4>
                  <p className="text-sm text-red-300">{selectedChallenge?.risk}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className={`p-6 rounded-lg text-center ${battleResult.victory ? 'bg-green-900/30 border-green-500/30' : 'bg-red-900/30 border-red-500/30'} border`}>
                  <h3 className={`text-2xl font-bold ${battleResult.victory ? 'text-green-400' : 'text-red-400'}`}>
                    {battleResult.victory ? "VICTORY!" : "DEFEAT"}
                  </h3>
                  <p className="text-muted-foreground mt-2">{battleResult.message}</p>
                  {battleResult.victory && battleResult.rewards && (
                    <div className="mt-4 space-y-1 text-sm">
                      <p>+{battleResult.rewards.gold?.toLocaleString()} gold</p>
                      <p>+{battleResult.rewards.rubies} rubies</p>
                      <p>+{battleResult.rewards.soulShards} soul shards</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              {!battleResult ? (
                <>
                  <Button variant="outline" onClick={() => setSelectedChallenge(null)}>
                    Retreat
                  </Button>
                  <Button 
                    onClick={handleChallenge} 
                    disabled={isFighting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isFighting ? "Fighting..." : "Begin Challenge"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => { setSelectedChallenge(null); setBattleResult(null); }}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
