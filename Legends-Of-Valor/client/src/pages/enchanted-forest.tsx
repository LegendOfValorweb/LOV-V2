import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Leaf, TreePine, Sparkles, Star, Heart, Zap } from "lucide-react";
import ZoneNPCPanel from "@/components/zone-npc-panel";

const FOREST_AREAS = [
  {
    id: "meadow_edge",
    name: "Sunlit Meadow",
    description: "Wildflowers and healing herbs grow in abundance near the forest's edge.",
    goldReward: 400,
    expReward: 8,
    difficulty: 1,
    specialChance: 0.2,
    specialItem: "Healing Herb",
    icon: "🌸",
  },
  {
    id: "faerie_grove",
    name: "Faerie Grove",
    description: "Magical faeries dance among luminescent mushrooms. Strange energy permeates the air.",
    goldReward: 1200,
    expReward: 25,
    difficulty: 2,
    specialChance: 0.4,
    specialItem: "Faerie Dust",
    icon: "🧚",
  },
  {
    id: "spirit_wood",
    name: "Ancient Spirit Wood",
    description: "Ancient trees whisper forgotten secrets. Forest spirits inhabit the elder oaks.",
    goldReward: 3000,
    expReward: 60,
    difficulty: 3,
    specialChance: 0.5,
    specialItem: "Spirit Essence",
    icon: "🌲",
  },
  {
    id: "creature_den",
    name: "Creature Den",
    description: "Rare magical creatures make their home here. Approach with caution.",
    goldReward: 7000,
    expReward: 120,
    difficulty: 4,
    specialChance: 0.65,
    specialItem: "Rare Pet Fragment",
    icon: "🦊",
    pvpRisk: true,
  },
  {
    id: "heartwood",
    name: "The Heartwood",
    description: "The mystical center of the enchanted forest. The World Tree's power flows here.",
    goldReward: 20000,
    expReward: 300,
    difficulty: 5,
    specialChance: 0.8,
    specialItem: "Heartwood Crystal",
    pvpRisk: true,
    icon: "🌳",
  },
];

const SPIRIT_ENCOUNTERS = [
  "A forest sprite grants you its blessing, boosting your luck temporarily.",
  "Ancient runes carved into a tree glow as you pass — a hidden message from the old world.",
  "A mystical deer emerges from the mist, studying you before vanishing into light.",
  "The trees seem to breathe around you. You feel attuned to nature's power.",
  "A wise owl perches nearby and speaks a prophecy: 'The key lies where shadows end.'",
];

export default function EnchantedForest() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isGathering, setIsGathering] = useState<string | null>(null);
  const [gatherProgress, setGatherProgress] = useState(0);
  const [spiritMessage, setSpiritMessage] = useState<string | null>(null);

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const handleGather = async (areaId: string) => {
    setIsGathering(areaId);
    setGatherProgress(0);
    setSpiritMessage(null);

    const area = FOREST_AREAS.find(a => a.id === areaId);
    if (!area) return;

    const duration = 1800 + area.difficulty * 500;
    const interval = setInterval(() => {
      setGatherProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      setGatherProgress(100);

      const foundSpecial = Math.random() < area.specialChance;
      const foundSpirit = Math.random() < 0.35;

      if (foundSpirit) {
        setSpiritMessage(SPIRIT_ENCOUNTERS[Math.floor(Math.random() * SPIRIT_ENCOUNTERS.length)]);
      }

      try {
        await apiRequest("POST", "/api/mining/mine", {
          accountId: account.id,
          nodeId: `forest_${areaId}`,
          goldOverride: area.goldReward,
          expOverride: area.expReward,
        });
      } catch {}

      toast({
        title: "Gathering Complete!",
        description: foundSpecial
          ? `Found ${area.goldReward.toLocaleString()} gold and a rare ${area.specialItem}!`
          : `Gathered resources worth ${area.goldReward.toLocaleString()} gold!`,
      });

      const accRes = await fetch(`/api/accounts/${account.id}`);
      if (accRes.ok) setAccount(await accRes.json());
      setIsGathering(null);
      setGatherProgress(0);
    }, duration);
  };

  return (
    <ZoneScene
      zoneName="Enchanted Forest"
      backdrop="/backdrops/forest.png"
      ambientClass="zone-ambient-forest"
      loreText="A mystical woodland alive with ancient magic. Faeries, spirits, and rare creatures call this place home..."
      interactables={[
        { id: "herb", type: "resource", name: "Rare Herbs", emoji: "🌿", position: { x: 20, y: 55 }, onClick: () => handleGather("meadow_edge") },
        { id: "faerie", type: "npc", name: "Faerie Queen", emoji: "🧚", position: { x: 65, y: 38 }, onClick: () => {} },
        { id: "tree", type: "resource", name: "Spirit Tree", emoji: "🌲", position: { x: 45, y: 30 }, onClick: () => handleGather("spirit_wood") },
      ]}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-3 pt-10 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <TreePine className="w-4 h-4 text-green-400" />
            <h2 className="text-base font-serif font-bold text-green-300">Enchanted Forest</h2>
            <div className="ml-auto flex items-center gap-2 bg-black/50 px-3 py-1 rounded-lg text-sm">
              <span className="text-yellow-400">💰</span>
              <span>{(account.gold ?? 0).toLocaleString()}</span>
            </div>
          </div>
          {spiritMessage && (
            <Card className="bg-green-900/30 border-green-500/40 mb-3">
              <CardContent className="p-3">
                <p className="text-xs text-green-300 italic flex gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
                  {spiritMessage}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          <ZoneNPCPanel zoneId="enchanted-forest" />
          {FOREST_AREAS.map(area => {
            const isActive = isGathering === area.id;
            const anyGathering = isGathering !== null;
            return (
              <Card key={area.id} className="bg-black/60 border-green-900/40">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-2xl shrink-0">{area.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{area.name}</h3>
                          {area.pvpRisk && <Badge variant="destructive" className="text-[10px] h-4">PvP</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{area.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-yellow-400">💰 {area.goldReward.toLocaleString()}</span>
                          <span className="text-blue-400">⚡ {area.expReward} TP</span>
                          <span className="text-green-400 flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {Math.round(area.specialChance * 100)}% rare
                          </span>
                        </div>
                        {area.specialItem && (
                          <p className="text-xs text-purple-400 mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            May find: {area.specialItem}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleGather(area.id)}
                      disabled={anyGathering}
                      className="shrink-0 text-xs h-8 bg-green-800 hover:bg-green-700 border border-green-600/40 text-green-100"
                    >
                      {isActive ? "Gathering..." : "Gather"}
                    </Button>
                  </div>
                  {isActive && (
                    <div className="mt-2">
                      <Progress value={gatherProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-1">Exploring the forest...</p>
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
