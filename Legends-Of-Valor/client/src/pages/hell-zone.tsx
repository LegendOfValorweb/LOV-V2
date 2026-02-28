import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Flame, 
  ArrowLeft,
  Skull,
  Coins,
  Gem,
  Swords,
  AlertTriangle,
  Crown,
  Sparkles,
  Users,
  Target,
  Shield,
  Heart,
  Trophy,
  Clock,
  Zap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface BRParticipant {
  accountId: string;
  username: string;
  race: string;
  hp?: number;
  maxHp?: number;
  kills?: number;
  eliminated?: boolean;
  placement?: number;
}

interface BRStatus {
  status: "closed" | "registration" | "active" | "ended";
  registrations: BRParticipant[];
  participants: BRParticipant[];
  aliveCount: number;
  totalParticipants: number;
  winner?: string;
}

interface MyBRStatus {
  battleStatus: string;
  isRegistered: boolean;
  isParticipant: boolean;
  currentTurn?: number;
  safeZoneRadius?: number;
  myData: {
    hp: number;
    maxHp: number;
    kills: number;
    eliminated: boolean;
    placement?: number;
  } | null;
  targets: BRParticipant[];
}

export default function HellZone() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChallenge, setSelectedChallenge] = useState<typeof HELL_CHALLENGES[0] | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<BRParticipant | null>(null);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("challenges");

  const { data: hellZoneState, refetch: refetchHellZone } = useQuery({
    queryKey: ["hell-zone-state"],
    queryFn: async () => {
      const res = await fetch("/api/hell-zone/state");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const joinHellZoneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hell-zone/join", { accountId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Joined!", description: "You are now in The Collapse" });
      refetchHellZone();
    },
    onError: (err: any) => {
      toast({ title: "Join Failed", description: err.message, variant: "destructive" });
    },
  });

  const hellZoneActionMutation = useMutation({
    mutationFn: async ({ targetId, action }: { targetId: string, action: string }) => {
      const res = await apiRequest("POST", "/api/hell-zone/action", { 
        accountId: account?.id, 
        targetId,
        action 
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.targetEliminated) {
        toast({ title: "Elimination!", description: "You eliminated a target!" });
      }
      refetchHellZone();
    },
  });

  const adminStartHellZoneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/hell-zone/start", { adminId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hell Zone Started", description: "The Collapse has begun!" });
      refetchHellZone();
    },
  });

  const adminEndHellZoneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/hell-zone/end", { adminId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hell Zone Ended" });
      refetchHellZone();
    },
  });

  const { data: brStatus, refetch: refetchBR } = useQuery<BRStatus>({
    queryKey: ["battle-royale-status"],
    queryFn: async () => {
      const res = await fetch("/api/battle-royale/status");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const { data: myBRStatus, refetch: refetchMyBR } = useQuery<MyBRStatus>({
    queryKey: ["battle-royale-my-status", account?.id],
    queryFn: async () => {
      const res = await fetch(`/api/battle-royale/my-status?accountId=${account?.id}`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 2000,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle-royale/register", { accountId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Registered!", description: "You are now registered for Battle Royale" });
      refetchBR();
      refetchMyBR();
    },
    onError: (err: any) => {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle-royale/unregister", { accountId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Unregistered", description: "You have left the Battle Royale registration" });
      refetchBR();
      refetchMyBR();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const attackMutation = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiRequest("POST", "/api/battle-royale/attack", { 
        attackerId: account?.id, 
        targetId 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAttackResult(data);
      refetchBR();
      refetchMyBR();
      
      if (data.battleEnded) {
        toast({ 
          title: "Battle Royale Ended!", 
          description: `Winner: ${data.winner}` 
        });
      } else if (data.targetEliminated) {
        toast({ 
          title: "Elimination!", 
          description: `You eliminated ${data.target}!` 
        });
      }
      
      const accRes = fetch(`/api/accounts/${account?.id}`).then(r => r.json()).then(setAccount);
    },
    onError: (err: any) => {
      toast({ title: "Attack Failed", description: err.message, variant: "destructive" });
    },
  });

  const adminOpenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle-royale/admin/open", { adminId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Battle Royale Opened", description: "Registration is now open!" });
      refetchBR();
    },
  });

  const adminCloseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle-royale/admin/close", { adminId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Battle Royale Closed" });
      refetchBR();
    },
  });

  const adminStartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle-royale/admin/start", { adminId: account?.id });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Battle Royale Started!", description: "The battle has begun!" });
      refetchBR();
      refetchMyBR();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (brStatus?.status === "active" || brStatus?.status === "registration") {
      setActiveTab("royale");
    }
  }, [brStatus?.status]);

  if (!account || account.role !== "player") {
    if (account?.role === "admin") {
    } else {
      navigate("/");
      return null;
    }
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

  const isAdmin = account?.role === "admin";
  const isInBattle = myBRStatus?.isParticipant && !myBRStatus?.myData?.eliminated;
  const canLeave = !isInBattle || brStatus?.status !== "active";

  return (
    <ZoneScene
      zoneName="Hell Zone"
      backdrop="/backdrops/arena.png"
      ambientClass="zone-ambient-hell"
      overlayOpacity={0.5}
    >
      <div className="h-full flex flex-col">
        <header className="border-b border-red-500/50 bg-black/70 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/world-map")}
                  disabled={!canLeave}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
                  <h1 className="text-2xl font-serif font-bold text-red-100">Hell Zone</h1>
                </div>
                <Badge className="bg-red-600 text-white flex items-center gap-1">
                  <Skull className="w-3 h-3" /> EXTREME DANGER
                </Badge>
                {brStatus?.status === "active" && (
                  <Badge className="bg-purple-600 text-white animate-pulse flex items-center gap-1">
                    <Zap className="w-3 h-3" /> BATTLE ROYALE ACTIVE
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-red-500/30">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span>{(account?.gold || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-red-500/30">
                  <Gem className="w-4 h-4 text-pink-400" />
                  <span>{(account?.rubies || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-black/50 border border-red-500/30">
              <TabsTrigger value="challenges" className="data-[state=active]:bg-red-600">
                <Swords className="w-4 h-4 mr-2" />
                Challenges
              </TabsTrigger>
              <TabsTrigger value="royale" className="data-[state=active]:bg-purple-600">
                <Crown className="w-4 h-4 mr-2" />
                Battle Royale
                {brStatus?.status !== "closed" && (
                  <Badge className="ml-2 bg-yellow-500 text-black text-xs">LIVE</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="challenges" className="mt-6">
              <div className="max-w-3xl mx-auto text-center mb-8">
                <div className="flex items-center justify-center gap-2 text-yellow-400 mb-4">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">WARNING: HIGH RISK ZONE</span>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <p className="text-red-200">
                  The Hell Zone offers the greatest rewards in the realm, but failure comes with severe consequences.
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
                      </div>
                      
                      <div className="pt-2 border-t border-red-500/30">
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <Skull className="w-3 h-3" />
                          {challenge.risk}
                        </p>
                      </div>

                      <Button className="w-full bg-red-600 hover:bg-red-700">
                        <Swords className="w-4 h-4 mr-2" />
                        Enter Challenge
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="royale" className="mt-6">
              {isAdmin && (
                <Card className="mb-6 bg-gradient-to-r from-purple-900/50 to-black/50 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-100">
                      <Crown className="w-5 h-5" />
                      Admin Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-4">
                    <Button 
                      onClick={() => adminOpenMutation.mutate()}
                      disabled={brStatus?.status === "registration" || brStatus?.status === "active"}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Open Registration
                    </Button>
                    <Button 
                      onClick={() => adminStartMutation.mutate()}
                      disabled={brStatus?.status !== "registration"}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Start Battle ({brStatus?.registrations?.length || 0} registered)
                    </Button>
                    <Button 
                      onClick={() => adminCloseMutation.mutate()}
                      variant="destructive"
                    >
                      Close/Cancel
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-gradient-to-br from-purple-950/80 to-black/90 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-purple-100">
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-400" />
                        Battle Royale Arena
                      </div>
                      <Badge className={
                        brStatus?.status === "closed" ? "bg-gray-600" :
                        brStatus?.status === "registration" ? "bg-blue-600" :
                        brStatus?.status === "active" ? "bg-red-600 animate-pulse" :
                        "bg-green-600"
                      }>
                        {brStatus?.status === "closed" && "Closed"}
                        {brStatus?.status === "registration" && "Registration Open"}
                        {brStatus?.status === "active" && `ACTIVE - ${brStatus.aliveCount} Alive`}
                        {brStatus?.status === "ended" && "Ended"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-purple-200/70">
                      Last one standing wins all rewards!
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {brStatus?.status === "closed" && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Battle Royale is currently closed.</p>
                        <p className="text-sm">Wait for admin to open registration.</p>
                      </div>
                    )}

                    {brStatus?.status === "registration" && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <Users className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                          <h3 className="text-xl font-bold text-blue-100 mb-2">Registration Open!</h3>
                          <p className="text-muted-foreground mb-4">
                            {brStatus.registrations?.length || 0} warriors registered
                          </p>
                          
                          {myBRStatus?.isRegistered ? (
                            <div className="space-y-4">
                              <Badge className="bg-green-600 text-lg px-4 py-2">You are Registered!</Badge>
                              <Button 
                                variant="outline" 
                                onClick={() => unregisterMutation.mutate()}
                                className="block mx-auto"
                              >
                                Leave Registration
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => registerMutation.mutate()}
                              className="bg-blue-600 hover:bg-blue-700"
                              size="lg"
                            >
                              <Swords className="w-5 h-5 mr-2" />
                              Register for Battle
                            </Button>
                          )}
                        </div>

                        {(brStatus.registrations?.length ?? 0) > 0 && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-3 text-purple-100">Registered Warriors:</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {brStatus.registrations?.map((p) => (
                                <div 
                                  key={p.accountId} 
                                  className={`p-2 rounded border ${
                                    p.accountId === account?.id 
                                      ? "border-yellow-500 bg-yellow-500/10" 
                                      : "border-purple-500/30 bg-black/30"
                                  }`}
                                >
                                  <span className="font-medium">{p.username}</span>
                                  <span className="text-xs text-muted-foreground ml-2 capitalize">({p.race})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {brStatus?.status === "active" && myBRStatus && (
                      <div className="space-y-6">
                        {myBRStatus.isParticipant && myBRStatus.myData && (
                          <div className="p-4 rounded-lg bg-black/50 border border-purple-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-purple-100">Your Status</span>
                              {myBRStatus.myData.eliminated ? (
                                <Badge variant="destructive">Eliminated #{myBRStatus.myData.placement}</Badge>
                              ) : (
                                <Badge className="bg-green-600">Fighting</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="w-4 h-4 text-red-400" />
                              <Progress 
                                value={(myBRStatus.myData.hp / myBRStatus.myData.maxHp) * 100} 
                                className="flex-1 h-3"
                              />
                              <span className="text-sm">{myBRStatus.myData.hp}/{myBRStatus.myData.maxHp}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Skull className="w-4 h-4 text-purple-400" />
                              <span>Kills: {myBRStatus.myData.kills}</span>
                            </div>
                            {myBRStatus.safeZoneRadius !== undefined && (
                              <div className="mt-4 pt-4 border-t border-purple-500/30 space-y-2">
                                <div className="flex items-center justify-between text-xs text-purple-200/70">
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                                    The Collapse
                                  </span>
                                  <span>Turn {myBRStatus.currentTurn}</span>
                                </div>
                                <Progress 
                                  value={myBRStatus.safeZoneRadius} 
                                  className="h-2 bg-purple-900"
                                />
                                <p className="text-[10px] text-center text-red-400 animate-pulse">
                                  Safe Zone: {myBRStatus.safeZoneRadius}% - Avoid the edges!
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {!myBRStatus.myData?.eliminated && myBRStatus.targets && myBRStatus.targets.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3 text-purple-100 flex items-center gap-2">
                              <Target className="w-4 h-4" />
                              Select Target to Attack
                            </h4>
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-2">
                                {myBRStatus.targets.map((target) => (
                                  <div 
                                    key={target.accountId}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                      selectedTarget?.accountId === target.accountId
                                        ? "border-yellow-500 bg-yellow-500/20"
                                        : "border-purple-500/30 bg-black/30 hover:border-purple-500/60"
                                    }`}
                                    onClick={() => setSelectedTarget(target)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-medium">{target.username}</span>
                                        <span className="text-xs text-muted-foreground ml-2 capitalize">({target.race})</span>
                                      </div>
                                      <Button 
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          attackMutation.mutate(target.accountId);
                                        }}
                                        disabled={attackMutation.isPending}
                                      >
                                        <Swords className="w-4 h-4 mr-1" />
                                        Attack
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Heart className="w-3 h-3 text-red-400" />
                                      <Progress 
                                        value={((target.hp || 0) / (target.maxHp || 1)) * 100} 
                                        className="flex-1 h-2"
                                      />
                                      <span className="text-xs">{target.hp}/{target.maxHp}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {myBRStatus.myData?.eliminated && (
                          <div className="text-center py-8">
                            <Skull className="w-16 h-16 mx-auto mb-4 text-red-400" />
                            <h3 className="text-xl font-bold text-red-100 mb-2">You have been eliminated!</h3>
                            <p className="text-muted-foreground">
                              Placement: #{myBRStatus.myData.placement}
                            </p>
                            {(myBRStatus.myData.placement ?? 999) <= 5 && (
                              <Badge className="mt-4 bg-yellow-600">Top 5 - Rewards Claimed!</Badge>
                            )}
                          </div>
                        )}

                        {!myBRStatus.isParticipant && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>You are not participating in this Battle Royale.</p>
                            <p className="text-sm">Watch the action unfold!</p>
                          </div>
                        )}
                      </div>
                    )}

                    {brStatus?.status === "ended" && (
                      <div className="text-center py-12">
                        <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                        <h3 className="text-2xl font-bold text-yellow-100 mb-2">Battle Royale Complete!</h3>
                        <p className="text-lg text-muted-foreground">
                          Winner will be announced soon.
                        </p>
                        
                        {brStatus.participants && brStatus.participants.length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-3">Final Standings:</h4>
                            <div className="max-w-md mx-auto space-y-2">
                              {brStatus.participants
                                .filter(p => p.placement)
                                .sort((a, b) => (a.placement || 999) - (b.placement || 999))
                                .slice(0, 5)
                                .map((p, i) => (
                                  <div 
                                    key={p.accountId}
                                    className={`p-3 rounded-lg border flex items-center justify-between ${
                                      i === 0 ? "border-yellow-500 bg-yellow-500/20" :
                                      i === 1 ? "border-gray-400 bg-gray-500/20" :
                                      i === 2 ? "border-orange-600 bg-orange-500/20" :
                                      "border-purple-500/30 bg-black/30"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-lg">#{p.placement}</span>
                                      <span>{p.username}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">{p.kills} kills</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-950/50 to-black/90 border-yellow-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-100">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                      <div className="flex items-center gap-2 font-bold text-yellow-100 mb-2">
                        <Crown className="w-4 h-4" /> 1st Place (Winner)
                      </div>
                      <div className="text-sm space-y-1 text-yellow-200/80">
                        <p>10,000,000 Gold</p>
                        <p>5,000 Rubies</p>
                        <p>2,000 Soul Shards</p>
                        <p>500 Focused Shards</p>
                        <p>10,000 Training Points</p>
                        <p>1,000 Soul Gins</p>
                        <p>500 Beak Coins</p>
                        <p>200 Valor Tokens</p>
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-gray-400/50 bg-gray-500/10">
                      <div className="font-semibold text-gray-100 mb-1">2nd Place</div>
                      <p className="text-xs text-gray-300">5M Gold, 2.5K Rubies, 1K Shards, 250 Focused, 5K TP</p>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-orange-600/50 bg-orange-500/10">
                      <div className="font-semibold text-orange-100 mb-1">3rd Place</div>
                      <p className="text-xs text-orange-300">2.5M Gold, 1.5K Rubies, 500 Shards, 100 Focused, 2.5K TP</p>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10">
                      <div className="font-semibold text-purple-100 mb-1">4th Place</div>
                      <p className="text-xs text-purple-300">1M Gold, 750 Rubies, 250 Shards, 50 Focused, 1K TP</p>
                    </div>
                    
                    <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10">
                      <div className="font-semibold text-purple-100 mb-1">5th Place</div>
                      <p className="text-xs text-purple-300">500K Gold, 500 Rubies, 100 Shards, 500 TP</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
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

        <Dialog open={!!attackResult} onOpenChange={() => setAttackResult(null)}>
          <DialogContent className="bg-gradient-to-br from-purple-950 to-black border-purple-500/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-purple-100">
                <Swords className="w-5 h-5 text-red-400" />
                Combat Result
              </DialogTitle>
            </DialogHeader>
            
            {attackResult && (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-black/50 border border-purple-500/30">
                  <div className="text-center mb-4">
                    <p className="text-lg">
                      <span className="text-yellow-400">{attackResult.attacker}</span>
                      {" vs "}
                      <span className="text-red-400">{attackResult.target}</span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-400">
                        Dealt: {attackResult.damage} damage 
                        {attackResult.isCrit && <span className="text-yellow-400"> CRIT!</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-red-400">Received: {attackResult.counterDamage} counter</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Your HP</p>
                      <p className={attackResult.attackerEliminated ? "text-red-400" : "text-green-400"}>
                        {attackResult.attackerHp}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Target HP</p>
                      <p className={attackResult.targetEliminated ? "text-red-400" : "text-green-400"}>
                        {attackResult.targetHp}
                      </p>
                    </div>
                  </div>
                </div>
                
                {attackResult.targetEliminated && (
                  <div className="p-4 rounded-lg bg-green-900/30 border border-green-500/30 text-center">
                    <Skull className="w-8 h-8 mx-auto mb-2 text-red-400" />
                    <p className="font-bold text-green-400">ELIMINATION!</p>
                    <p className="text-sm">{attackResult.target} has been eliminated</p>
                  </div>
                )}
                
                {attackResult.attackerEliminated && (
                  <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-center">
                    <Skull className="w-8 h-8 mx-auto mb-2 text-red-400" />
                    <p className="font-bold text-red-400">YOU WERE ELIMINATED!</p>
                    <p className="text-sm">Placement: #{attackResult.attackerPlacement}</p>
                  </div>
                )}
                
                {attackResult.battleEnded && (
                  <div className="p-4 rounded-lg bg-yellow-900/30 border border-yellow-500/30 text-center">
                    <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                    <p className="font-bold text-yellow-400">BATTLE ROYALE COMPLETE!</p>
                    <p className="text-lg">Winner: {attackResult.winner}</p>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button onClick={() => setAttackResult(null)}>
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ZoneScene>
  );
}
