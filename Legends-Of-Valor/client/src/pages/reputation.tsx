import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";

export default function Reputation() {
  const { account } = useGame();
  const { toast } = useToast();
  const { data: reputation, refetch } = useQuery({ 
    queryKey: ["/api/accounts/" + account?.id + "/reputation"], 
    enabled: !!account?.id 
  });

  const gainReputationMutation = useMutation({
    mutationFn: async ({ faction, amount }: { faction: string; amount: number }) => {
      const res = await fetch(`/api/accounts/${account?.id}/reputation/gain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faction, amount }),
      });
      if (!res.ok) throw new Error("Failed to gain reputation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/" + account?.id + "/reputation"] });
      toast({
        title: "Reputation Gained",
        description: "You have gained reputation with the faction!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to gain reputation",
        variant: "destructive",
      });
    },
  });

  const isDev = window.location.hostname === "localhost" || window.location.hostname.includes("replit");

  return (
    <div className="game-page-scroll" style={{padding:16}}>
      <h1 style={{color:"#d4af37", fontSize:24, fontWeight:"bold", marginBottom:16}}>🏅 Faction Reputation</h1>
      {reputation?.factions?.map((faction: any) => (
        <div key={faction.id} style={{background:"#1a1a2e", border:"1px solid #333", borderRadius:8, padding:16, marginBottom:12}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
            <span style={{color:"white", fontWeight:"bold"}}>{faction.icon} {faction.name}</span>
            <span style={{color:"#d4af37"}}>{faction.current}/{faction.max}</span>
          </div>
          <div style={{background:"#333", borderRadius:4, height:12, marginBottom:8}}>
            <div style={{background: faction.current >= faction.unlockAt ? "#22c55e" : "#d4af37", height:12, borderRadius:4, width: (faction.current/faction.max*100)+"%", transition:"width 0.3s"}} />
          </div>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div style={{fontSize:12, color: faction.current >= faction.unlockAt ? "#22c55e" : "#888"}}>
              {faction.current >= faction.unlockAt ? "✓ UNLOCKED: " : "Unlock at 50: "}{faction.unlockReward}
            </div>
            {isDev && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => gainReputationMutation.mutate({ faction: faction.id, amount: 5 })}
                disabled={gainReputationMutation.isPending || faction.current >= faction.max}
              >
                Test Gain
              </Button>
            )}
          </div>
        </div>
      ))}
      <div style={{marginTop: 24, padding: 16, background: "#111", borderRadius: 8, border: "1px solid #d4af37"}}>
        <h3 style={{color: "#d4af37", fontWeight: "bold", marginBottom: 8}}>Total Reputation</h3>
        <p style={{color: "white", fontSize: 20}}>{reputation?.totalReputation || 0}</p>
      </div>
    </div>
  );
}
