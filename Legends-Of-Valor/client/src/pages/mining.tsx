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
  Mountain, 
  ArrowLeft,
  Gem,
  Pickaxe,
  Coins,
  Sparkles,
  Timer
} from "lucide-react";

const MINING_NODES = [
  { id: "copper", name: "Copper Vein", goldReward: 100, expReward: 5, difficulty: 1, color: "text-orange-400" },
  { id: "iron", name: "Iron Deposit", goldReward: 250, expReward: 10, difficulty: 2, color: "text-gray-400" },
  { id: "silver", name: "Silver Ore", goldReward: 500, expReward: 20, difficulty: 3, color: "text-slate-300" },
  { id: "gold", name: "Gold Nuggets", goldReward: 1000, expReward: 50, difficulty: 4, color: "text-yellow-400" },
  { id: "mythril", name: "Mythril Crystals", goldReward: 2500, expReward: 100, difficulty: 5, color: "text-blue-400" },
  { id: "adamantite", name: "Adamantite Chunks", goldReward: 5000, expReward: 200, difficulty: 6, color: "text-purple-400" },
];

export default function Mining() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isMining, setIsMining] = useState<string | null>(null);
  const [miningProgress, setMiningProgress] = useState(0);

  if (!account || account.role !== "player") {
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
          description: `Found ${data.goldReward.toLocaleString()} gold and ${data.expReward} training points!`,
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
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/base.png')" }}
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
                  <Mountain className="w-6 h-6 text-amber-400" />
                  <h1 className="text-2xl font-serif font-bold">Mountain Caverns</h1>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span>{(account.gold || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-lg text-muted-foreground">
              Mine precious ores and gems from the mountain depths
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MINING_NODES.map((node) => (
              <Card key={node.id} className="bg-card/90 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gem className={`w-5 h-5 ${node.color}`} />
                    {node.name}
                  </CardTitle>
                  <CardDescription>Difficulty: {"⭐".repeat(node.difficulty)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      {node.goldReward.toLocaleString()} gold
                    </span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      {node.expReward} exp
                    </span>
                  </div>
                  
                  {isMining === node.id && (
                    <div className="space-y-2">
                      <Progress value={miningProgress} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground">Mining...</p>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    onClick={() => handleMine(node.id)}
                    disabled={isMining !== null}
                  >
                    <Pickaxe className="w-4 h-4 mr-2" />
                    {isMining === node.id ? "Mining..." : "Mine"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
