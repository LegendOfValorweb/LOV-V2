import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { useZoneDiscovery } from "@/hooks/use-zone-discovery";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ZoneScene } from "@/components/zone-scene";
import { 
  Mountain, 
  Gem,
  Pickaxe,
  Sparkles,
} from "lucide-react";
import ZoneNPCPanel from "@/components/zone-npc-panel";

const MINING_NODES = [
  { id: "copper", name: "Copper Vein", itemName: "Copper Ore", quantity: 3, difficulty: 1, color: "text-orange-400" },
  { id: "iron", name: "Iron Deposit", itemName: "Iron Ore", quantity: 2, difficulty: 2, color: "text-gray-400" },
  { id: "silver", name: "Silver Ore", itemName: "Silver Ore", quantity: 2, difficulty: 3, color: "text-slate-300" },
  { id: "gold", name: "Gold Vein", itemName: "Gold Ore", quantity: 1, difficulty: 4, color: "text-yellow-400" },
  { id: "mythril", name: "Mythril Crystals", itemName: "Mythril Ore", quantity: 1, difficulty: 5, color: "text-blue-400" },
  { id: "adamantite", name: "Adamantite Chunks", itemName: "Adamantite Ore", quantity: 1, difficulty: 6, color: "text-purple-400" },
];

export default function Mining() {
  useZoneDiscovery("mountain_caverns");
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isMining, setIsMining] = useState<string | null>(null);
  const [miningProgress, setMiningProgress] = useState(0);

  if (!account || account.role !== "player" && account.role !== "admin") {
    navigate("/");
    return null;
  }

  const handleMine = async (nodeId: string) => {
    setIsMining(nodeId);
    setMiningProgress(0);
    
    const node = MINING_NODES.find(n => n.id === nodeId);
    if (!node) return;

    const interval = setInterval(() => {
      setMiningProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(async () => {
      clearInterval(interval);
      try {
        const res = await apiRequest("POST", "/api/mining/mine", {
          accountId: account.id,
          nodeId,
        });
        const data = await res.json();
        
        toast({
          title: "Mining Complete!",
          description: `Found ${data.quantity}x ${data.itemName}! (Worth ~${data.goldValue} gold each)`,
        });

        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) {
          setAccount(await accRes.json());
        }
      } catch (error: any) {
        toast({
          title: "Mining Failed",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsMining(null);
        setMiningProgress(0);
      }
    }, 2000);
  };

  return (
    <ZoneScene
      zoneName="Mining Camp"
      backdrop="/backdrops/base.png"
      ambientClass="zone-ambient-cave"
      overlayOpacity={0.5}
      interactables={MINING_NODES.map((node, i) => ({
        id: node.id,
        type: "resource" as const,
        name: node.name,
        emoji: "💎",
        position: { x: 20 + (i % 3) * 25, y: 30 + Math.floor(i / 3) * 25 },
        animation: "glow" as const,
        disabled: isMining !== null,
        tooltip: `${node.name} - ${node.quantity}x ${node.itemName}`,
        onClick: () => handleMine(node.id),
      }))}
    >
      <div className="game-page">
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center justify-between">
            <div className="rpg-panel px-3 py-1.5 flex items-center gap-2">
              <Mountain className="w-5 h-5 text-amber-400" />
              <span className="rpg-heading text-sm">Mountain Caverns</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-3">
          <ZoneNPCPanel zoneId="mountain-caverns" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MINING_NODES.map((node) => (
              <div key={node.id} className="rpg-card p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Gem className={`w-5 h-5 ${node.color}`} />
                  <span className="rpg-heading text-sm font-bold">{node.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">Difficulty: {"⭐".repeat(node.difficulty)}</p>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Pickaxe className="w-3 h-3 text-amber-400" />
                    {node.quantity}x {node.itemName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    + Luck bonus
                  </span>
                </div>
                
                {isMining === node.id && (
                  <div className="space-y-1">
                    <Progress value={miningProgress} className="h-2" />
                    <p className="text-[10px] text-center text-muted-foreground">Mining...</p>
                  </div>
                )}

                <Button 
                  className="w-full rpg-button text-xs h-8" 
                  onClick={() => handleMine(node.id)}
                  disabled={isMining !== null}
                >
                  <Pickaxe className="w-3 h-3 mr-1" />
                  {isMining === node.id ? "Mining..." : "Mine"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ZoneScene>
  );
}
