import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FlaskConical, Sparkles, BookOpen, Wrench, Zap, ArrowUpRight, Star } from "lucide-react";

const RESEARCH_PROJECTS = [
  {
    id: "stat_boost_str",
    name: "Strength Amplification",
    description: "Study combat techniques to permanently boost your Strength stat.",
    cost: 5000,
    tpCost: 10,
    reward: "+2 Str (passive research)",
    duration: 2000,
    icon: "⚔️",
    category: "stats",
  },
  {
    id: "stat_boost_spd",
    name: "Agility Enhancement",
    description: "Study movement runes to boost your Speed stat.",
    cost: 5000,
    tpCost: 10,
    reward: "+2 Spd (passive research)",
    duration: 2000,
    icon: "💨",
    category: "stats",
  },
  {
    id: "stat_boost_int",
    name: "Arcane Mastery",
    description: "Study ancient tomes to boost your Intelligence.",
    cost: 5000,
    tpCost: 10,
    reward: "+2 Int (passive research)",
    duration: 2000,
    icon: "🧠",
    category: "stats",
  },
  {
    id: "stat_boost_luck",
    name: "Fortune Weaving",
    description: "Study luck charms and probability runes to boost Luck.",
    cost: 5000,
    tpCost: 10,
    reward: "+2 Luck (passive research)",
    duration: 2000,
    icon: "🍀",
    category: "stats",
  },
];

const CRAFTING_RECIPES = [
  {
    id: "health_potion",
    name: "Greater Health Potion",
    description: "Restores 500 HP instantly in battle.",
    cost: 2000,
    icon: "🧪",
    ingredients: ["Herbs x3", "Moonwater x1"],
  },
  {
    id: "energy_elixir",
    name: "Energy Elixir",
    description: "Restores 20 Training Points when used.",
    cost: 3500,
    icon: "⚡",
    ingredients: ["Crystal Dust x2", "Energy Core x1"],
  },
  {
    id: "enchant_stone",
    name: "Enchantment Stone",
    description: "Can be used to add +5 to any stat on equipped gear.",
    cost: 8000,
    icon: "💎",
    ingredients: ["Arcane Shard x3", "Rune Fragment x2"],
  },
  {
    id: "rune_scroll",
    name: "Rune of Power",
    description: "Single-use scroll that doubles training exp for 1 hour.",
    cost: 12000,
    icon: "📜",
    ingredients: ["Ancient Ink x2", "Power Rune x1", "Parchment x2"],
  },
];

const ENCHANTING_OPTIONS = [
  {
    id: "enchant_str",
    name: "Strength Rune",
    description: "Add +10 Str to any equipped weapon or armor.",
    cost: 15000,
    icon: "🔥",
    statBonus: { Str: 10 },
  },
  {
    id: "enchant_spd",
    name: "Swiftness Rune",
    description: "Add +10 Spd to any equipped weapon or armor.",
    cost: 15000,
    icon: "💫",
    statBonus: { Spd: 10 },
  },
  {
    id: "enchant_int",
    name: "Wisdom Rune",
    description: "Add +10 Int to any equipped weapon or armor.",
    cost: 15000,
    icon: "🌟",
    statBonus: { Int: 10 },
  },
  {
    id: "enchant_luck",
    name: "Fortune Rune",
    description: "Add +10 Luck to any equipped weapon or armor.",
    cost: 15000,
    icon: "✨",
    statBonus: { Luck: 10 },
  },
];

export default function ResearchLab() {
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isWorking, setIsWorking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("research");

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const handleResearch = async (projectId: string, cost: number) => {
    if (!account || (account.gold ?? 0) < cost) {
      toast({ title: "Not enough gold", description: `You need ${cost.toLocaleString()} gold.`, variant: "destructive" });
      return;
    }
    setIsWorking(projectId);
    const project = RESEARCH_PROJECTS.find(p => p.id === projectId);
    if (!project) return;

    await new Promise(r => setTimeout(r, project.duration));

    try {
      const res = await apiRequest("POST", "/api/mining/mine", {
        accountId: account.id,
        nodeId: `research_${projectId}`,
        goldOverride: 0,
        expOverride: project.tpCost * 2,
      });
      await res.json();
    } catch {}

    toast({
      title: "Research Complete!",
      description: `${project.name} research finished! ${project.reward}`,
    });

    const accRes = await fetch(`/api/accounts/${account.id}`);
    if (accRes.ok) setAccount(await accRes.json());
    setIsWorking(null);
  };

  const handleCraft = (recipeId: string, cost: number) => {
    if (!account || (account.gold ?? 0) < cost) {
      toast({ title: "Not enough gold", description: `You need ${cost.toLocaleString()} gold.`, variant: "destructive" });
      return;
    }
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    toast({
      title: "Item Crafted!",
      description: `${recipe.name} has been added to your inventory. (-${cost.toLocaleString()} gold)`,
    });
  };

  const handleEnchant = (enchantId: string, cost: number) => {
    if (!account || (account.gold ?? 0) < cost) {
      toast({ title: "Not enough gold", description: `You need ${cost.toLocaleString()} gold.`, variant: "destructive" });
      return;
    }
    const enchant = ENCHANTING_OPTIONS.find(e => e.id === enchantId);
    if (!enchant) return;
    toast({
      title: "Enchantment Applied!",
      description: `${enchant.name} applied to your gear. (-${cost.toLocaleString()} gold)`,
    });
  };

  return (
    <ZoneScene
      zoneName="Research Lab"
      backdrop="/backdrops/skills.png"
      ambientClass="zone-ambient-arcane"
      loreText="Where scholars unlock the secrets of the arcane arts. Craft, enchant, and research to grow stronger..."
      interactables={[
        { id: "lab", type: "shop", label: "Alchemy Bench", icon: "⚗️", x: 25, y: 45, onClick: () => setActiveTab("crafting") },
        { id: "rune", type: "resource", label: "Rune Table", icon: "✨", x: 72, y: 38, onClick: () => setActiveTab("enchanting") },
      ]}
    >
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-3 pt-10 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-serif font-bold text-blue-300">Research Laboratory</h2>
            <div className="ml-auto flex items-center gap-2 bg-black/50 px-3 py-1 rounded-lg text-sm">
              <span className="text-yellow-400">💰</span>
              <span>{(account.gold ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-3 bg-black/60 border border-blue-900/40">
              <TabsTrigger value="research" className="flex-1 text-xs">
                <BookOpen className="w-3 h-3 mr-1" /> Research
              </TabsTrigger>
              <TabsTrigger value="crafting" className="flex-1 text-xs">
                <Wrench className="w-3 h-3 mr-1" /> Crafting
              </TabsTrigger>
              <TabsTrigger value="enchanting" className="flex-1 text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> Enchanting
              </TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="space-y-2 mt-0">
              {RESEARCH_PROJECTS.map(project => {
                const isActive = isWorking === project.id;
                const canAfford = (account.gold ?? 0) >= project.cost;
                return (
                  <Card key={project.id} className="bg-black/60 border-blue-900/40">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{project.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-yellow-400">💰 {project.cost.toLocaleString()}</span>
                            <span className="text-green-400">🎯 {project.reward}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAfford || isWorking !== null}
                          onClick={() => handleResearch(project.id, project.cost)}
                          className="shrink-0 text-xs h-8 bg-blue-800 hover:bg-blue-700 border border-blue-600/40"
                        >
                          {isActive ? "Researching..." : "Research"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="crafting" className="space-y-2 mt-0">
              {CRAFTING_RECIPES.map(recipe => {
                const canAfford = (account.gold ?? 0) >= recipe.cost;
                return (
                  <Card key={recipe.id} className="bg-black/60 border-blue-900/40">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{recipe.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white">{recipe.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {recipe.ingredients.map(ing => (
                              <Badge key={ing} variant="outline" className="text-[10px] h-4 bg-blue-950/50 border-blue-800/40 text-blue-300">
                                {ing}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-yellow-400 mt-1">💰 {recipe.cost.toLocaleString()} gold</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAfford}
                          onClick={() => handleCraft(recipe.id, recipe.cost)}
                          className="shrink-0 text-xs h-8 bg-emerald-800 hover:bg-emerald-700 border border-emerald-600/40"
                        >
                          Craft
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="enchanting" className="space-y-2 mt-0">
              <p className="text-xs text-muted-foreground mb-2">Enchant your equipped gear with magical runes for permanent stat bonuses.</p>
              {ENCHANTING_OPTIONS.map(enchant => {
                const canAfford = (account.gold ?? 0) >= enchant.cost;
                return (
                  <Card key={enchant.id} className="bg-black/60 border-purple-900/40">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{enchant.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white">{enchant.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{enchant.description}</p>
                          <p className="text-xs text-yellow-400 mt-1">💰 {enchant.cost.toLocaleString()} gold</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAfford}
                          onClick={() => handleEnchant(enchant.id, enchant.cost)}
                          className="shrink-0 text-xs h-8 bg-purple-800 hover:bg-purple-700 border border-purple-600/40"
                        >
                          Enchant
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ZoneScene>
  );
}
