import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pet, PetTier } from "@shared/schema";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Swords, Users, Coins, Trophy, LogOut, ArrowLeft, 
  Crown, Check, X, Zap, Shield, Map
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const tierColors: Record<PetTier, string> = {
  egg: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  baby: "bg-green-500/20 text-green-400 border-green-500/30",
  teen: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  adult: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legend: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  mythic: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

interface PetBattle {
  id: string;
  challengerId: string;
  challengedId: string;
  challengerName: string;
  challengedName: string;
  status: string;
  challengerPets: string[];
  challengedPets: string[];
  challengerPetDetails: Pet[];
  challengedPetDetails: Pet[];
  currentRound: number;
  challengerWins: number;
  challengedWins: number;
  goldWager: number;
  winnerId?: string;
  createdAt: string;
}

interface Opponent {
  id: string;
  username: string;
  rank: string;
  petCount: number;
}

export default function PetArena() {
  const [, navigate] = useLocation();
  const { account, logout } = useGame();
  const { toast } = useToast();
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [goldWager, setGoldWager] = useState(0);
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondBattle, setRespondBattle] = useState<PetBattle | null>(null);
  const [respondPets, setRespondPets] = useState<string[]>([]);

  const { data: playerPets = [], isLoading: petsLoading } = useQuery<Pet[]>({
    queryKey: ["/api/accounts", account?.id, "pets"],
    enabled: !!account?.id,
  });

  const { data: petBattles = [], isLoading: battlesLoading } = useQuery<PetBattle[]>({
    queryKey: ["/api/accounts", account?.id, "pet-battles"],
    enabled: !!account?.id,
    refetchInterval: 5000,
  });

  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ["/api/pet-battles/opponents"],
    queryFn: async () => {
      const res = await fetch(`/api/pet-battles/opponents?accountId=${account?.id}`);
      return res.json();
    },
    enabled: !!account?.id && challengeDialogOpen,
    refetchInterval: challengeDialogOpen ? 5000 : false,
  });

  const challengeMutation = useMutation({
    mutationFn: async (data: { challengedId: string; challengerPets: string[]; goldWager: number }) => {
      return apiRequest("POST", "/api/pet-battles/challenge", {
        challengerId: account!.id,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "pet-battles"] });
      setChallengeDialogOpen(false);
      setSelectedOpponent(null);
      setSelectedPets([]);
      setGoldWager(0);
      toast({ title: "Challenge Sent!", description: "Waiting for opponent to respond..." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send challenge", variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (data: { battleId: string; accept: boolean; challengedPets?: string[] }) => {
      return apiRequest("PATCH", `/api/pet-battles/${data.battleId}/respond`, {
        accountId: account!.id,
        accept: data.accept,
        challengedPets: data.challengedPets,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "pet-battles"] });
      setRespondDialogOpen(false);
      setRespondBattle(null);
      setRespondPets([]);
      toast({ 
        title: variables.accept ? "Battle Accepted!" : "Challenge Declined",
        description: variables.accept ? "The pet battle has begun!" : "You declined the challenge."
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to respond", variant: "destructive" });
    },
  });

  const fightMutation = useMutation({
    mutationFn: async (battleId: string) => {
      return apiRequest("POST", `/api/pet-battles/${battleId}/fight`, {
        accountId: account!.id,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id, "pet-battles"] });
      toast({ 
        title: `Round ${result.round} Complete!`,
        description: result.message,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to fight", variant: "destructive" });
    },
  });

  const togglePetSelection = (petId: string, setFn: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFn(prev => {
      if (prev.includes(petId)) {
        return prev.filter(id => id !== petId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, petId];
    });
  };

  const getPetPower = (pet: Pet) => {
    if (!pet || !pet.stats) return 1;
    const stats = pet.stats as { Str?: number; Spd?: number; Luck?: number; ElementalPower?: number };
    return (stats.Str || 1) * 2 + (stats.Spd || 1) * 1.5 + (stats.Luck || 1) * 0.5 + (stats.ElementalPower || 1) * 3;
  };

  const pendingChallenges = petBattles.filter(b => b.status === "pending" && b.challengedId === account?.id);
  const activeBattles = petBattles.filter(b => b.status === "in_progress");
  const completedBattles = petBattles.filter(b => b.status === "completed" || b.status === "declined").slice(0, 5);

  if (!account) {
    return (
      <div className="h-full flex items-center justify-center">
        <Button onClick={() => navigate("/")}>Return to Login</Button>
      </div>
    );
  }

  return (
    <div className="h-full bg-background text-foreground relative">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: "url('/assets/zone-arena.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
      
      <div className="relative z-10 p-4 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/world-map")}>
              <Map className="h-4 w-4 mr-1" />
              World Map
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Swords className="h-6 w-6 text-red-500" />
              Pet Arena
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{account.username}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {playerPets.length < 3 && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-4">
              <p className="text-yellow-400 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                You need at least 3 pets to participate in Pet Arena battles!
              </p>
              <Button className="mt-2" onClick={() => navigate("/pets")}>
                Go to Pet Training
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Challenge
              </CardTitle>
              <CardDescription>Challenge other players to a 3v3 pet battle</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => setChallengeDialogOpen(true)}
                disabled={playerPets.length < 3}
              >
                <Swords className="h-4 w-4 mr-2" />
                Find Opponent
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Pending Challenges ({pendingChallenges.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingChallenges.length === 0 ? (
                <p className="text-muted-foreground text-sm">No pending challenges</p>
              ) : (
                pendingChallenges.map(battle => (
                  <div key={battle.id} className="p-3 rounded border border-border bg-muted/20">
                    <p className="font-medium">{battle.challengerName} challenges you!</p>
                    <p className="text-sm text-muted-foreground">Wager: {battle.goldWager} gold</p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setRespondBattle(battle);
                          setRespondDialogOpen(true);
                        }}
                        disabled={playerPets.length < 3}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => respondMutation.mutate({ battleId: battle.id, accept: false })}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Active Battles ({activeBattles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeBattles.length === 0 ? (
                <p className="text-muted-foreground text-sm">No active battles</p>
              ) : (
                activeBattles.map(battle => {
                  const isChallenger = battle.challengerId === account.id;
                  const canFight = isChallenger && battle.currentRound <= 3;
                  
                  return (
                    <div key={battle.id} className="p-3 rounded border border-border bg-muted/20">
                      <p className="font-medium">
                        {isChallenger ? `vs ${battle.challengedName}` : `vs ${battle.challengerName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Round {Math.min(battle.currentRound, 3)} | Score: {battle.challengerWins} - {battle.challengedWins}
                      </p>
                      {canFight && (
                        <Button 
                          size="sm" 
                          className="mt-2"
                          onClick={() => fightMutation.mutate(battle.id)}
                          disabled={fightMutation.isPending}
                        >
                          <Swords className="h-4 w-4 mr-1" />
                          Fight Round {battle.currentRound}
                        </Button>
                      )}
                      {!canFight && !isChallenger && (
                        <p className="text-sm text-yellow-400 mt-2">Waiting for opponent...</p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Recent Battles</CardTitle>
          </CardHeader>
          <CardContent>
            {completedBattles.length === 0 ? (
              <p className="text-muted-foreground">No completed battles yet</p>
            ) : (
              <div className="space-y-2">
                {completedBattles.map(battle => {
                  const isChallenger = battle.challengerId === account.id;
                  const won = battle.winnerId === account.id;
                  
                  return (
                    <div key={battle.id} className={`p-3 rounded border ${won ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          vs {isChallenger ? battle.challengedName : battle.challengerName}
                        </p>
                        <Badge className={won ? 'bg-green-500' : 'bg-red-500'}>
                          {battle.status === "declined" ? "Declined" : (won ? "Victory" : "Defeat")}
                        </Badge>
                      </div>
                      {battle.status !== "declined" && (
                        <p className="text-sm text-muted-foreground">
                          Score: {battle.challengerWins} - {battle.challengedWins} | Wager: {battle.goldWager} gold
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Challenge to Pet Battle</DialogTitle>
              <DialogDescription>
                Select an opponent and 3 pets for the battle
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Select Opponent</h4>
                {opponents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No available opponents (need 3+ pets and online)</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {opponents.map(opp => (
                      <Button
                        key={opp.id}
                        variant={selectedOpponent?.id === opp.id ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setSelectedOpponent(opp)}
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        {opp.username} ({opp.petCount} pets)
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Select 3 Pets ({selectedPets.length}/3)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {playerPets.map(pet => (
                    <Button
                      key={pet.id}
                      variant={selectedPets.includes(pet.id) ? "default" : "outline"}
                      className="h-auto py-2 flex-col"
                      onClick={() => togglePetSelection(pet.id, setSelectedPets)}
                    >
                      <span className="font-medium">{pet.name}</span>
                      <span className="text-xs text-muted-foreground">{pet.tier} | Power: {getPetPower(pet).toFixed(0)}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Gold Wager (optional)</h4>
                <Input
                  type="number"
                  value={goldWager}
                  onChange={(e) => setGoldWager(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  max={account.gold}
                />
                <p className="text-xs text-muted-foreground mt-1">Your gold: {account.gold}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChallengeDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => {
                  if (selectedOpponent && selectedPets.length === 3) {
                    challengeMutation.mutate({
                      challengedId: selectedOpponent.id,
                      challengerPets: selectedPets,
                      goldWager,
                    });
                  }
                }}
                disabled={!selectedOpponent || selectedPets.length !== 3 || challengeMutation.isPending}
              >
                <Swords className="h-4 w-4 mr-2" />
                Send Challenge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Accept Pet Battle Challenge</DialogTitle>
              <DialogDescription>
                Select 3 pets to fight against {respondBattle?.challengerName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {respondBattle && (
                <div className="p-3 rounded bg-muted/20 border">
                  <p>Wager: <span className="text-yellow-400">{respondBattle.goldWager} gold</span></p>
                  <p className="text-sm text-muted-foreground">Winner takes the wager from the loser</p>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Select 3 Pets ({respondPets.length}/3)</h4>
                <div className="grid grid-cols-3 gap-2">
                  {playerPets.map(pet => (
                    <Button
                      key={pet.id}
                      variant={respondPets.includes(pet.id) ? "default" : "outline"}
                      className="h-auto py-2 flex-col"
                      onClick={() => togglePetSelection(pet.id, setRespondPets)}
                    >
                      <span className="font-medium">{pet.name}</span>
                      <span className="text-xs text-muted-foreground">{pet.tier} | Power: {getPetPower(pet).toFixed(0)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRespondDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => {
                  if (respondBattle && respondPets.length === 3) {
                    respondMutation.mutate({
                      battleId: respondBattle.id,
                      accept: true,
                      challengedPets: respondPets,
                    });
                  }
                }}
                disabled={respondPets.length !== 3 || respondMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept & Fight
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
