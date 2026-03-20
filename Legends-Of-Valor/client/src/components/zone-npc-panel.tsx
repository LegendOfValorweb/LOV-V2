import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Swords, MessageCircle, Star, Shield, Zap, Target, ChevronRight, Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ZoneNPCData {
  id: string;
  zoneId: string;
  name: string;
  race: string;
  element: string;
  personality: string;
  lore: string;
  dialogue: {
    greeting: string;
    hints: string[];
    onDefeat: string;
    onPlayerDefeat: string;
  };
  emoji: string;
  portrait: string;
  scaledStats: {
    Str: number;
    Def: number;
    Spd: number;
    Int: number;
    Luck: number;
    hp: number;
  };
  rewards: {
    gold: number;
    trainingPoints: number;
    soulShards: number;
    rubies: number;
  };
  defeatCount: number;
  growthRate?: number;
}

interface CombatRound {
  turn: number;
  attacker: string;
  defender: string;
  damage: number;
  isCritical: boolean;
  isEvaded: boolean;
  effects: string[];
}

interface FightResult {
  playerWon: boolean;
  combat: {
    winner: string;
    rounds: CombatRound[];
    finalHP: Record<string, number>;
  };
  rewards: {
    gold: number;
    trainingPoints: number;
    soulShards: number;
    rubies: number;
  } | null;
  npc: {
    id: string;
    name: string;
    defeatCount: number;
    dialogue: string;
  };
}

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#ff4400",
  Water: "#0088ff",
  Air: "#88ddff",
  Earth: "#aa7722",
  Nature: "#22cc44",
  Light: "#ffee88",
  Dark: "#8833aa",
  Aether: "#7799ff",
  Void: "#555566",
  Storm: "#ffdd00",
  Metal: "#99aabb",
  Crystal: "#88eeff",
  Arcane: "#aa44ff",
};

interface ZoneNPCPanelProps {
  zoneId: string;
}

export default function ZoneNPCPanel({ zoneId }: ZoneNPCPanelProps) {
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showTalkDialog, setShowTalkDialog] = useState(false);
  const [showFightDialog, setShowFightDialog] = useState(false);
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const normalizedZoneId = zoneId.replace(/-/g, "_");

  const { data: npc, isLoading } = useQuery<ZoneNPCData>({
    queryKey: [`/api/zones/${normalizedZoneId}/npc`, account?.id],
    queryFn: async () => {
      const res = await fetch(`/api/zones/${normalizedZoneId}/npc?accountId=${account?.id}`);
      if (!res.ok) {
        if (res.status === 404) return null as any;
        throw new Error("Failed to fetch NPC");
      }
      return res.json();
    },
    enabled: !!account?.id,
    staleTime: 30000,
  });

  const fightMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/zones/${normalizedZoneId}/npc/fight`, {
        accountId: account?.id,
      });
      return res.json();
    },
    onSuccess: async (data: FightResult) => {
      setFightResult(data);
      setShowFightDialog(false);
      setShowResultDialog(true);
      queryClient.invalidateQueries({ queryKey: [`/api/zones/${normalizedZoneId}/npc`, account?.id] });
      if (account?.id) {
        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) setAccount(await accRes.json());
      }
    },
    onError: (err: any) => {
      toast({ title: "Fight Failed", description: err.message, variant: "destructive" });
      setShowFightDialog(false);
    },
  });

  if (isLoading || !npc) return null;

  const elementColor = ELEMENT_COLORS[npc.element] || "#ffffff";
  const portraitSrc = `/portraits/${npc.portrait}.png`;

  return (
    <>
      <Card className="bg-black/70 border-purple-800/50 overflow-hidden">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{npc.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm text-purple-300">{npc.name}</CardTitle>
                <Badge
                  className="text-[10px] px-1 py-0"
                  style={{ backgroundColor: elementColor + "33", color: elementColor, borderColor: elementColor + "66" }}
                >
                  {npc.element}
                </Badge>
                <Badge className="text-[10px] px-1 py-0 bg-slate-800 text-slate-300 border-slate-700">
                  {npc.race}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{npc.personality}</p>
            </div>
            <div className="shrink-0">
              <img
                src={portraitSrc}
                alt={npc.name}
                className="w-10 h-10 rounded-full border-2 object-cover"
                style={{ borderColor: elementColor }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/portraits/human_male.png";
                }}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{npc.lore}</p>

          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="bg-black/40 rounded px-1.5 py-1 text-center">
              <span className="text-red-400">⚔</span>
              <span className="ml-1 text-white">{npc.scaledStats.Str}</span>
            </div>
            <div className="bg-black/40 rounded px-1.5 py-1 text-center">
              <span className="text-blue-400">🛡</span>
              <span className="ml-1 text-white">{npc.scaledStats.Def}</span>
            </div>
            <div className="bg-black/40 rounded px-1.5 py-1 text-center">
              <span className="text-yellow-400">❤</span>
              <span className="ml-1 text-white">{npc.scaledStats.hp}</span>
            </div>
          </div>

          {npc.defeatCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
              <Trophy className="w-3 h-3" />
              <span>Defeated {npc.defeatCount}x — now stronger</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[10px] bg-black/30 rounded p-2">
            <div>
              <span className="text-yellow-400">Gold:</span>
              <span className="ml-1 text-white">{npc.rewards.gold.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-cyan-400">TP:</span>
              <span className="ml-1 text-white">{npc.rewards.trainingPoints}</span>
            </div>
            {npc.rewards.soulShards > 0 && (
              <div>
                <span className="text-purple-400">Shards:</span>
                <span className="ml-1 text-white">{npc.rewards.soulShards}</span>
              </div>
            )}
            {npc.rewards.rubies > 0 && (
              <div>
                <span className="text-red-400">Rubies:</span>
                <span className="ml-1 text-white">{npc.rewards.rubies}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-blue-700 text-blue-300 hover:bg-blue-900/30"
              onClick={() => setShowTalkDialog(true)}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Talk
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-red-900/60 hover:bg-red-900/80 border border-red-700 text-red-200"
              onClick={() => setShowFightDialog(true)}
              disabled={account?.isDead || account?.ghostState}
            >
              <Swords className="w-3 h-3 mr-1" />
              Challenge
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showTalkDialog} onOpenChange={setShowTalkDialog}>
        <DialogContent className="bg-slate-900 border-purple-800/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-300">
              <span className="text-xl">{npc.emoji}</span>
              {npc.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400 italic text-sm">
              {npc.race} · {npc.element} · {npc.personality}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-black/50 rounded-lg p-3 border border-purple-900/40">
              <p className="text-sm text-slate-200 italic">"{npc.dialogue.greeting}"</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold">Progression Hints:</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {npc.dialogue.hints.map((hint, i) => (
                    <div key={i} className="flex gap-2 items-start text-xs text-slate-300">
                      <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-purple-400" />
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="bg-black/30 rounded p-3 border border-slate-700/40">
              <p className="text-[11px] text-slate-400 leading-relaxed">{npc.lore}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTalkDialog(false)}>
              Farewell
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFightDialog} onOpenChange={setShowFightDialog}>
        <DialogContent className="bg-slate-900 border-red-800/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <Swords className="w-4 h-4" />
              Challenge {npc.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This is a tough fight. Are you ready?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 rounded p-2">
                <p className="text-slate-400 mb-1">NPC Stats</p>
                <p>STR: {npc.scaledStats.Str} | DEF: {npc.scaledStats.Def}</p>
                <p>SPD: {npc.scaledStats.Spd} | INT: {npc.scaledStats.Int}</p>
                <p className="text-red-300">HP: {npc.scaledStats.hp}</p>
              </div>
              <div className="bg-black/40 rounded p-2">
                <p className="text-slate-400 mb-1">Your Rewards</p>
                <p className="text-yellow-400">{npc.rewards.gold.toLocaleString()} gold</p>
                <p className="text-cyan-400">{npc.rewards.trainingPoints} TP</p>
                {npc.rewards.soulShards > 0 && <p className="text-purple-400">{npc.rewards.soulShards} shards</p>}
              </div>
            </div>
            {npc.defeatCount > 0 && (
              <p className="text-amber-400 text-xs text-center">
                You've defeated this NPC {npc.defeatCount} time(s). They're getting stronger!
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFightDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-800 hover:bg-red-700 text-white"
              onClick={() => fightMutation.mutate()}
              disabled={fightMutation.isPending}
            >
              {fightMutation.isPending ? "Fighting..." : "Fight!"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className={`border max-w-md ${fightResult?.playerWon ? "bg-slate-900 border-green-800/50" : "bg-slate-900 border-red-800/50"}`}>
          <DialogHeader>
            <DialogTitle className={fightResult?.playerWon ? "text-green-300" : "text-red-300"}>
              {fightResult?.playerWon ? "🏆 Victory!" : "💀 Defeat"}
            </DialogTitle>
          </DialogHeader>

          {fightResult && (
            <div className="space-y-3">
              <div className={`rounded-lg p-3 border ${fightResult.playerWon ? "bg-green-900/20 border-green-800/40" : "bg-red-900/20 border-red-800/40"}`}>
                <p className="text-sm italic text-slate-300">"{fightResult.npc.dialogue}"</p>
                <p className="text-xs text-slate-500 mt-1">— {fightResult.npc.name}</p>
              </div>

              {fightResult.playerWon && fightResult.rewards && (
                <div className="bg-black/40 rounded p-3">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">Rewards Earned:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-yellow-400">+{fightResult.rewards.gold.toLocaleString()} gold</span>
                    <span className="text-cyan-400">+{fightResult.rewards.trainingPoints} TP</span>
                    {fightResult.rewards.soulShards > 0 && (
                      <span className="text-purple-400">+{fightResult.rewards.soulShards} soul shards</span>
                    )}
                    {fightResult.rewards.rubies > 0 && (
                      <span className="text-red-400">+{fightResult.rewards.rubies} rubies</span>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-black/30 rounded p-2">
                <p className="text-xs text-slate-400 mb-1">Battle Log (last 5 rounds):</p>
                <ScrollArea className="max-h-28">
                  <div className="space-y-1">
                    {fightResult.combat.rounds.slice(-5).map((round, i) => (
                      <p key={i} className="text-[10px] text-slate-400">
                        Round {round.turn}: {round.attacker === account?.id ? "You" : npc.name} dealt {round.damage} dmg
                        {round.isCritical && " (CRIT!)"}
                        {round.effects.length > 0 && ` — ${round.effects.join(", ")}`}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {fightResult.playerWon && (
                <p className="text-xs text-amber-400 text-center">
                  {npc.name} is now {Math.round(npc.growthRate * 100)}% stronger for your next encounter!
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowResultDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
