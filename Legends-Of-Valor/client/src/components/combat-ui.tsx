import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Sword, Shield, Zap, Brain, Loader2, Heart, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CombatState {
  round: number;
  player1: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    action: string | null;
  };
  player2: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    action: string | null;
  };
  log: string[];
  status: "waiting" | "resolved" | "finished";
  winnerId?: string;
}

interface CombatUIProps {
  challengeId: string;
  currentPlayerId: string;
  challengerName: string;
  challengedName: string;
  onCombatEnd?: () => void;
}

const actionIcons = {
  attack: <Sword className="w-5 h-5" />,
  defend: <Shield className="w-5 h-5" />,
  dodge: <Zap className="w-5 h-5" />,
  trick: <Brain className="w-5 h-5" />,
};

const actionColors = {
  attack: "bg-red-600 hover:bg-red-700",
  defend: "bg-blue-600 hover:bg-blue-700",
  dodge: "bg-green-600 hover:bg-green-700",
  trick: "bg-purple-600 hover:bg-purple-700",
};

const actionDescriptions = {
  attack: "Deal damage based on STR",
  defend: "Reduce incoming damage with DEF",
  dodge: "Attempt to avoid attack with SPD",
  trick: "Outsmart opponent with INT",
};

export default function CombatUI({ 
  challengeId, 
  currentPlayerId,
  challengerName,
  challengedName,
  onCombatEnd 
}: CombatUIProps) {
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const { data: combatState, isLoading, refetch } = useQuery<CombatState | null>({
    queryKey: ["/api/challenges", challengeId, "combat"],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${challengeId}/combat`);
      if (!res.ok) throw new Error("Failed to fetch combat state");
      const data = await res.json();
      return data;
    },
    refetchInterval: 3000,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await apiRequest("POST", `/api/challenges/${challengeId}/combat-action`, {
        playerId: currentPlayerId,
        action,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/challenges", challengeId, "combat"] });
      
      if (data.combatState?.status === "finished") {
        const isWinner = data.combatState.winnerId === currentPlayerId;
        toast({
          title: isWinner ? "Victory!" : "Defeat",
          description: isWinner ? "You won the battle!" : "You were defeated.",
          variant: isWinner ? "default" : "destructive",
        });
        onCombatEnd?.();
      } else if (data.message) {
        toast({
          title: "Action Submitted",
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (action: string) => {
    setSelectedAction(action);
    actionMutation.mutate(action);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!combatState || !combatState.player1 || !combatState.player2) {
    return (
      <Card className="border-yellow-500/50">
        <CardContent className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-500" />
          <p className="text-muted-foreground mb-4">Initializing combat...</p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPlayer1 = combatState.player1.id === currentPlayerId;
  const myState = isPlayer1 ? combatState.player1 : combatState.player2;
  const opponentState = isPlayer1 ? combatState.player2 : combatState.player1;
  const hasSubmittedAction = myState.action !== null;
  const waitingForOpponent = hasSubmittedAction && opponentState.action === null;

  if (combatState.status === "finished") {
    const isWinner = combatState.winnerId === currentPlayerId;
    return (
      <Card className={isWinner ? "border-green-500" : "border-red-500"}>
        <CardHeader>
          <CardTitle className="text-center">
            {isWinner ? "🏆 Victory!" : "💀 Defeat"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {isWinner ? "You won the battle!" : "Better luck next time!"}
          </p>
          <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-mono text-muted-foreground">
              {combatState.log.slice(-5).map((entry, i) => (
                <span key={i} className="block">{entry}</span>
              ))}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Round {combatState.round}</CardTitle>
          <div className="flex items-center gap-2">
            {!hasSubmittedAction && (
              <Badge className="bg-green-600 animate-pulse">Your Turn</Badge>
            )}
            {hasSubmittedAction && !waitingForOpponent && (
              <Badge variant="secondary">Action Submitted</Badge>
            )}
            {waitingForOpponent && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                Waiting for {opponentState.name}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg ${isPlayer1 ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
            <p className="font-medium text-sm mb-1">{combatState.player1.name}</p>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm">{combatState.player1.hp}/{combatState.player1.maxHp}</span>
            </div>
            <Progress 
              value={(combatState.player1.hp / combatState.player1.maxHp) * 100} 
              className="h-2"
            />
            {combatState.player1.action && (
              <Badge className="mt-2" variant="secondary">
                Action submitted
              </Badge>
            )}
          </div>
          <div className={`p-3 rounded-lg ${!isPlayer1 ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
            <p className="font-medium text-sm mb-1">{combatState.player2.name}</p>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm">{combatState.player2.hp}/{combatState.player2.maxHp}</span>
            </div>
            <Progress 
              value={(combatState.player2.hp / combatState.player2.maxHp) * 100} 
              className="h-2"
            />
            {combatState.player2.action && (
              <Badge className="mt-2" variant="secondary">
                Action submitted
              </Badge>
            )}
          </div>
        </div>

        {combatState.log.length > 0 && (
          <div className="bg-muted rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-xs font-mono text-muted-foreground">
              {combatState.log.slice(-3).map((entry, i) => (
                <span key={i} className="block">{entry}</span>
              ))}
            </p>
          </div>
        )}

        {waitingForOpponent ? (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
            <p className="text-sm text-muted-foreground">
              Waiting for opponent to choose their action...
            </p>
            <Button onClick={() => refetch()} variant="ghost" size="sm" className="mt-2">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        ) : hasSubmittedAction ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              You selected: <span className="font-bold capitalize">{myState.action}</span>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Choose your action:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["attack", "defend", "dodge", "trick"] as const).map((action) => (
                <Button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={actionMutation.isPending}
                  className={`flex flex-col items-center gap-1 h-auto py-3 ${actionColors[action]}`}
                >
                  {actionMutation.isPending && selectedAction === action ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    actionIcons[action]
                  )}
                  <span className="capitalize font-bold">{action}</span>
                  <span className="text-xs opacity-75">{actionDescriptions[action]}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
