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
  Gem, 
  ArrowLeft,
  Coins,
  Sparkles,
  Skull,
  Shield,
  Swords
} from "lucide-react";

const RUBY_NODES = [
  { id: "raw_ruby", name: "Raw Ruby Deposits", rubyReward: 5, goldReward: 500, difficulty: 1, pvpRisk: false },
  { id: "polished_ruby", name: "Polished Ruby Veins", rubyReward: 15, goldReward: 1000, difficulty: 2, pvpRisk: false },
  { id: "crimson_crystal", name: "Crimson Crystal Cave", rubyReward: 35, goldReward: 2500, difficulty: 3, pvpRisk: true },
  { id: "blood_ruby", name: "Blood Ruby Chamber", rubyReward: 75, goldReward: 5000, difficulty: 4, pvpRisk: true },
  { id: "dragon_ruby", name: "Dragon's Ruby Hoard", rubyReward: 150, goldReward: 10000, difficulty: 5, pvpRisk: true },
  { id: "void_ruby", name: "Void Ruby Nexus", rubyReward: 300, goldReward: 25000, difficulty: 6, pvpRisk: true },
];

export default function RubyMines() {
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
    
    const node = RUBY_NODES.find(n => n.id === nodeId);
    if (!node) return;

    const interval = setInterval(() => {
      setMiningProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 150);

    setTimeout(async () => {
      clearInterval(interval);
      try {
        const res = await apiRequest("POST", "/api/ruby-mines/mine", {
          accountId: account.id,
          nodeId,
        });
        const data = await res.json();

        if (data.pvpEncounter) {
          toast({
            title: data.won ? "PvP Victory!" : "PvP Defeat!",
            description: data.message,
            variant: data.won ? "default" : "destructive",
          });
        } else {
          toast({
            title: "Mining Complete!",
            description: `Found ${data.rubyReward} rubies and ${data.goldReward.toLocaleString()} gold!`,
          });
        }

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
    }, 3000);
  };

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/base.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/30 via-black/60 to-black/80" />
      
      <div className="relative z-10">
        <header className="border-b border-red-500/30 bg-black/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Gem className="w-6 h-6 text-red-400" />
                  <h1 className="text-2xl font-serif font-bold text-red-100">Ruby Mines</h1>
                </div>
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Skull className="w-3 h-3" /> PvP Zone
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Gem className="w-4 h-4 text-pink-400" />
                  <span>{(account.rubies || 0).toLocaleString()} Rubies</span>
                </div>
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
            <h2 className="text-lg text-red-200">
              Extract precious rubies from dangerous mines
            </h2>
            <p className="text-sm text-yellow-400 mt-2">
              Warning: Some areas have PvP encounters! You may encounter other miners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {RUBY_NODES.map((node) => (
              <Card key={node.id} className={`bg-card/90 backdrop-blur ${node.pvpRisk ? 'border-red-500/50' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Gem className="w-5 h-5 text-pink-400" />
                      {node.name}
                    </span>
                    {node.pvpRisk && (
                      <Badge variant="destructive" className="text-xs">
                        <Swords className="w-3 h-3 mr-1" /> PvP
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>Difficulty: {"💎".repeat(node.difficulty)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Gem className="w-4 h-4 text-pink-400" />
                      {node.rubyReward} rubies
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      {node.goldReward.toLocaleString()} gold
                    </span>
                  </div>
                  
                  {isMining === node.id && (
                    <div className="space-y-2">
                      <Progress value={miningProgress} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground">Mining rubies...</p>
                    </div>
                  )}

                  <Button 
                    className={`w-full ${node.pvpRisk ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    onClick={() => handleMine(node.id)}
                    disabled={isMining !== null}
                  >
                    <Gem className="w-4 h-4 mr-2" />
                    {isMining === node.id ? "Mining..." : "Extract Rubies"}
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
