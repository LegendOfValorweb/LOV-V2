import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ScrollText, Gem, Swords, Star, Package, ArrowLeft, Search, Sparkles, Skull } from "lucide-react";

const EXPLORATION_SITES = [
  {
    id: "outer_courtyard",
    name: "Outer Courtyard",
    description: "Crumbling walls of an ancient temple. Scattered relics may be found.",
    goldReward: 800,
    expReward: 15,
    difficulty: 1,
    loreChance: 0.3,
    icon: "🏛️",
  },
  {
    id: "inner_sanctum",
    name: "Inner Sanctum",
    description: "The sacred heart of the ruins. Ancient traps guard powerful artifacts.",
    goldReward: 2000,
    expReward: 40,
    difficulty: 2,
    loreChance: 0.5,
    icon: "⚗️",
  },
  {
    id: "crypt_of_elders",
    name: "Crypt of Elders",
    description: "Resting place of ancient warriors. Undead guardians protect the tombs.",
    goldReward: 5000,
    expReward: 100,
    difficulty: 3,
    loreChance: 0.6,
    pvpRisk: true,
    icon: "💀",
  },
  {
    id: "forbidden_vault",
    name: "Forbidden Vault",
    description: "The sealed treasury of a fallen civilization. Immense danger, immense reward.",
    goldReward: 15000,
    expReward: 250,
    difficulty: 4,
    loreChance: 0.8,
    pvpRisk: true,
    icon: "🔒",
  },
  {
    id: "apex_tower",
    name: "Apex Observation Tower",
    description: "The highest point of the ruins. An ancient lich guards the legendary crown.",
    goldReward: 40000,
    expReward: 500,
    difficulty: 5,
    loreChance: 1.0,
    pvpRisk: true,
    bossEncounter: true,
    icon: "🗼",
  },
];

const ARTIFACT_LORE = [
  "\"The realm was once united under the Valorian Pact, forged in the Age of Stars...\"",
  "\"Only those who master all elements may open the Gate of Eternity...\"",
  "\"The First King did not die — he merely ascended beyond mortal sight...\"",
  "\"Seven artifacts scattered across the world hold the key to ultimate power...\"",
  "\"The ancient ones feared not death, but the silence that follows rebirth...\"",
  "\"Legends speak of a weapon forged from starlight that could sever fate itself...\"",
];

export default function AncientRuins() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isExploring, setIsExploring] = useState<string | null>(null);
  const [explorationProgress, setExplorationProgress] = useState(0);
  const [lastDiscovery, setLastDiscovery] = useState<{ lore: string } | null>(null);

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const handleExplore = async (siteId: string) => {
    setIsExploring(siteId);
    setExplorationProgress(0);
    setLastDiscovery(null);

    const site = EXPLORATION_SITES.find(s => s.id === siteId);
    if (!site) return;

    const duration = 2000 + site.difficulty * 600;
    const interval = setInterval(() => {
      setExplorationProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      setExplorationProgress(100);
      try {
        const res = await apiRequest("POST", "/api/mining/mine", {
          accountId: account.id,
          nodeId: `ruins_${siteId}`,
          goldOverride: site.goldReward,
          expOverride: site.expReward,
        });
        const data = await res.json();

        const foundLore = Math.random() < site.loreChance;
        const loreText = foundLore
          ? ARTIFACT_LORE[Math.floor(Math.random() * ARTIFACT_LORE.length)]
          : null;

        if (loreText) setLastDiscovery({ lore: loreText });

        const goldGained = data.goldReward ?? site.goldReward;
        toast({
          title: site.bossEncounter ? "Boss Defeated!" : "Exploration Complete!",
          description: `Discovered ${goldGained.toLocaleString()} gold${loreText ? " and an ancient lore fragment!" : "!"}`,
        });

        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) setAccount(await accRes.json());
      } catch {
        const goldGained = site.goldReward;
        toast({
          title: "Exploration Complete!",
          description: `Discovered ${goldGained.toLocaleString()} gold from the ruins!`,
        });
        const accRes = await fetch(`/api/accounts/${account.id}`);
        if (accRes.ok) setAccount(await accRes.json());
      } finally {
        setIsExploring(null);
        setExplorationProgress(0);
      }
    }, duration);
  };

  return (
    <ZoneScene
      zoneName="Ancient Ruins"
      backdrop="/backdrops/ruins.png"
      ambientClass="zone-ambient-mystical"
      loreText="Crumbling temples of a forgotten age. Artifacts of immense power lie buried beneath the stone..."
      interactables={[
        { id: "scroll", type: "resource", name: "Lore Scroll", emoji: "📜", position: { x: 20, y: 40 }, onClick: () => {} },
        { id: "boss", type: "npc", name: "Ancient Boss", emoji: "☠️", position: { x: 78, y: 30 }, onClick: () => {} },
      ]}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-3 pt-10 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-serif font-bold text-amber-300 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Exploration Sites
              </h2>
              <p className="text-xs text-muted-foreground">Search the ruins for ancient artifacts and gold</p>
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-lg text-sm">
              <span className="text-yellow-400">⚡</span>
              <span>{account.trainingPoints ?? 0} TP</span>
            </div>
          </div>
          {lastDiscovery && (
            <Card className="bg-amber-900/30 border-amber-500/40 mb-3">
              <CardContent className="p-3">
                <p className="text-xs text-amber-300 italic flex gap-2">
                  <ScrollText className="w-4 h-4 shrink-0 mt-0.5" />
                  {lastDiscovery.lore}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {EXPLORATION_SITES.map(site => {
            const isActive = isExploring === site.id;
            const anyExploring = isExploring !== null;
            return (
              <Card key={site.id} className="bg-black/60 border-amber-900/40">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl shrink-0">{site.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{site.name}</h3>
                          {site.pvpRisk && <Badge variant="destructive" className="text-[10px] h-4">PvP Zone</Badge>}
                          {site.bossEncounter && (
                            <Badge className="text-[10px] h-4 bg-purple-700 text-white border-purple-500">Boss</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{site.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-yellow-400 flex items-center gap-1">
                            💰 {site.goldReward.toLocaleString()} gold
                          </span>
                          <span className="text-blue-400 flex items-center gap-1">
                            ⚡ {site.expReward} TP
                          </span>
                          <span className="text-amber-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {Math.round(site.loreChance * 100)}% lore
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleExplore(site.id)}
                      disabled={anyExploring}
                      className="shrink-0 text-xs h-8 bg-amber-800 hover:bg-amber-700 border border-amber-600/40 text-amber-100"
                    >
                      {isActive ? "Exploring..." : "Explore"}
                    </Button>
                  </div>
                  {isActive && (
                    <div className="mt-2">
                      <Progress value={explorationProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-1">Searching the ruins...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ZoneScene>
  );
}
