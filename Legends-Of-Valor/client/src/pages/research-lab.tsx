import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { useZoneDiscovery } from "@/hooks/use-zone-discovery";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FlaskConical, Sparkles, BookOpen, Wrench, Zap, ArrowUpRight, Star, Sword, Lock } from "lucide-react";
import { playerRanks } from "@shared/schema";
import { FOREST_WEAPONS } from "@/lib/items-data";

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


const FOREST_WEAPON_RECIPES_UI = [
  { weaponIndex: 0,  requiredRank: "Novice",          requiredRankIndex: 0,  ingredients: ["Healing Herb x3", "Wood x5"],                                                goldCost: 100 },
  { weaponIndex: 1,  requiredRank: "Apprentice",       requiredRankIndex: 1,  ingredients: ["Wildflower Petal x4", "Meadow Moss x3", "Wood x4"],                         goldCost: 400 },
  { weaponIndex: 2,  requiredRank: "Initiate",         requiredRankIndex: 2,  ingredients: ["Fiber x6", "Wood x5", "Healing Herb x2"],                                   goldCost: 700 },
  { weaponIndex: 3,  requiredRank: "Journeyman",       requiredRankIndex: 3,  ingredients: ["Faerie Dust x2", "Luminous Crystal x1", "Fiber x6"],                        goldCost: 1500 },
  { weaponIndex: 4,  requiredRank: "Adept",            requiredRankIndex: 4,  ingredients: ["Glowing Mushroom x3", "Pixie Wing Dust x2", "Beast Hide x2"],               goldCost: 3000 },
  { weaponIndex: 5,  requiredRank: "Expert",           requiredRankIndex: 5,  ingredients: ["Spirit Bark x2", "Nature Essence x2", "Elder Wood Sap x1"],                 goldCost: 7000 },
  { weaponIndex: 6,  requiredRank: "Master",           requiredRankIndex: 6,  ingredients: ["Forest Spirit Essence x2", "Ancient Leaf x3", "Elder Wood Sap x3"],         goldCost: 18000 },
  { weaponIndex: 7,  requiredRank: "Grandmaster",      requiredRankIndex: 7,  ingredients: ["Forest Spirit Essence x3", "Ancient Leaf x5", "Nature Essence x3"],         goldCost: 50000 },
  { weaponIndex: 8,  requiredRank: "Champion",         requiredRankIndex: 8,  ingredients: ["Forest Spirit Essence x4", "Spirit Bark x4", "Ancient Leaf x6"],            goldCost: 120000 },
  { weaponIndex: 9,  requiredRank: "Overlord",         requiredRankIndex: 9,  ingredients: ["Creature Fang x3", "Void Crystal x2", "Mythic Beast Hide x1"],              goldCost: 280000 },
  { weaponIndex: 10, requiredRank: "Sovereign",        requiredRankIndex: 10, ingredients: ["Mythic Beast Hide x2", "Creature Fang x4", "Void Crystal x3"],              goldCost: 850000 },
  { weaponIndex: 11, requiredRank: "Ascendant",        requiredRankIndex: 11, ingredients: ["Heartwood Crystal x1", "World Tree Sap x1", "Essence of Life x1"],          goldCost: 2300000 },
  { weaponIndex: 12, requiredRank: "Legend",           requiredRankIndex: 12, ingredients: ["Genesis Fragment x2", "Essence of Life x2", "Heartwood Crystal x2"],        goldCost: 11000000 },
  { weaponIndex: 13, requiredRank: "Mythic",           requiredRankIndex: 13, ingredients: ["Primordial Seed x3", "World Tree Sap x3", "Genesis Fragment x3"],           goldCost: 55000000 },
  { weaponIndex: 14, requiredRank: "Mythical Legend",  requiredRankIndex: 14, ingredients: ["Genesis Fragment x5", "Essence of Life x5", "Primordial Seed x5"],          goldCost: 2000000000 },
];

export default function ResearchLab() {
  useZoneDiscovery("research_lab");
  const [, navigate] = useLocation();
  const { account, setAccount } = useGame();
  const { toast } = useToast();
  const [isWorking, setIsWorking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("research");

  useEffect(() => {
    if (!account || account.role !== "player") {
      navigate("/");
    }
  }, [account, navigate]);

  if (!account || account.role !== "player") return null;

  const playerRankIndex = playerRanks.indexOf(account.rank as any);

  const STAT_MAP: Record<string, string> = {
    stat_boost_str: "Str",
    stat_boost_spd: "Spd",
    stat_boost_int: "Int",
    stat_boost_luck: "Luck",
  };

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
      const stat = STAT_MAP[projectId];
      const res = await apiRequest("POST", `/api/accounts/${account.id}/research`, {
        projectId,
        goldCost: cost,
        tpGain: project.tpCost * 2,
        ...(stat ? { statBoost: { stat, amount: 2 } } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: "Research Complete!",
        description: `${project.name} finished! ${project.reward}${data.tpGained ? ` (+${data.tpGained} TP)` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Research Failed", description: err?.message || "Server error", variant: "destructive" });
    }

    const accRes = await fetch(`/api/accounts/${account.id}`);
    if (accRes.ok) setAccount(await accRes.json());
    setIsWorking(null);
  };

  const handleCraft = async (recipeId: string, cost: number) => {
    if (!account || (account.gold ?? 0) < cost) {
      toast({ title: "Not enough gold", description: `You need ${cost.toLocaleString()} gold.`, variant: "destructive" });
      return;
    }
    setIsWorking(recipeId);
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/research`, {
        projectId: recipeId,
        goldCost: cost,
        tpGain: 0,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Item Crafted!", description: `${recipe.name} crafted! (-${cost.toLocaleString()} gold)` });
      const accRes = await fetch(`/api/accounts/${account.id}`);
      if (accRes.ok) setAccount(await accRes.json());
    } catch (err: any) {
      toast({ title: "Craft Failed", description: err?.message || "Server error", variant: "destructive" });
    }
    setIsWorking(null);
  };

  const handleCraftForestWeapon = async (weaponIndex: number, goldCost: number, requiredRankIndex: number, requiredRank: string) => {
    if (!account) return;

    if (playerRankIndex < requiredRankIndex) {
      toast({ title: "Rank Too Low", description: `You need ${requiredRank} rank to craft this weapon.`, variant: "destructive" });
      return;
    }

    if ((account.gold ?? 0) < goldCost) {
      toast({ title: "Not enough gold", description: `You need ${goldCost.toLocaleString()} gold.`, variant: "destructive" });
      return;
    }

    const recipeId = `forest_weapon-${weaponIndex}`;
    try {
      await apiRequest("POST", "/api/craft", { accountId: account.id, recipeId });
      toast({ title: "Weapon Crafted!", description: `${FOREST_WEAPONS[weaponIndex].name} added to inventory!` });
      const accRes = await fetch(`/api/accounts/${account.id}`);
      if (accRes.ok) setAccount(await accRes.json());
    } catch (error: any) {
      const data = await error?.json?.() || {};
      toast({ title: "Crafting Failed", description: data.error || "Check you have all the required forest materials.", variant: "destructive" });
    }
  };

  return (
    <ZoneScene
      zoneName="Research Lab"
      backdrop="/backdrops/skills.png"
      ambientClass="zone-ambient-arcane"
      loreText="Where scholars unlock the secrets of the arcane arts. Craft, enchant, and research to grow stronger..."
      interactables={[
        { id: "lab", type: "shop", name: "Alchemy Bench", emoji: "⚗️", position: { x: 25, y: 45 }, onClick: () => setActiveTab("crafting") },
        { id: "rune", type: "resource", name: "Rune Table", emoji: "✨", position: { x: 72, y: 38 }, onClick: () => setActiveTab("enchanting") },
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
            <TabsList className="w-full mb-3 bg-black/60 border border-blue-900/40 grid grid-cols-4">
              <TabsTrigger value="research" className="text-xs">
                <BookOpen className="w-3 h-3 mr-1" /> Research
              </TabsTrigger>
              <TabsTrigger value="crafting" className="text-xs">
                <Wrench className="w-3 h-3 mr-1" /> Crafting
              </TabsTrigger>
              <TabsTrigger value="enchanting" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> Enchanting
              </TabsTrigger>
              <TabsTrigger value="forest_weapons" className="text-xs">
                <Sword className="w-3 h-3 mr-1" /> Forest
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
              <Card className="bg-black/60 border-purple-900/40">
                <CardContent className="p-4 text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white mb-1">Enchant Items in Your Inventory</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Item enchanting is done directly in your Inventory. Select any item and click <span className="text-purple-300 font-medium">✦ Enchant</span> to add random stat bonuses using Soul Shards.
                  </p>
                  <p className="text-xs text-purple-400/80 mb-3">Each enchant costs Soul Shards and adds +5–15 to a random stat. Max 10 enchantment levels per item.</p>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = "/inventory"}
                    className="bg-purple-800 hover:bg-purple-700 border border-purple-600/40 text-purple-100"
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> Go to Inventory
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forest_weapons" className="space-y-2 mt-0">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Sword className="w-3 h-3 text-green-400" />
                Craft powerful weapons from materials gathered in the Enchanted Forest. One weapon per rank.
              </p>
              {FOREST_WEAPON_RECIPES_UI.map(recipe => {
                const weapon = FOREST_WEAPONS[recipe.weaponIndex];
                if (!weapon) return null;
                const isLocked = playerRankIndex < recipe.requiredRankIndex;
                const canAfford = (account.gold ?? 0) >= recipe.goldCost;
                const statEntries = Object.entries(weapon.stats).filter(([, v]) => v && v > 0);
                return (
                  <Card key={recipe.weaponIndex} className={`border-green-900/40 ${isLocked ? "bg-black/40 opacity-75" : "bg-black/60"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{isLocked ? "🔒" : "🌿"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-sm font-semibold ${isLocked ? "text-gray-400" : "text-white"}`}>{weapon.name}</h3>
                            <Badge className={`text-[10px] h-4 ${isLocked ? "bg-orange-900/50 text-orange-400 border-orange-700/30" : "bg-green-900/40 text-green-400 border-green-700/30"}`}>
                              {isLocked && <Lock className="w-2.5 h-2.5 mr-0.5" />}
                              {recipe.requiredRank}
                            </Badge>
                          </div>
                          {weapon.special && (
                            <p className="text-xs text-purple-400 mt-0.5">✦ {weapon.special}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {statEntries.map(([stat, val]) => (
                              <span key={stat} className="text-[10px] text-blue-300 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/30">
                                +{(val as number).toLocaleString()} {stat}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {recipe.ingredients.map(ing => (
                              <Badge key={ing} variant="outline" className="text-[9px] h-4 bg-green-950/50 border-green-800/40 text-green-300">
                                {ing}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-yellow-400 mt-1">💰 {recipe.goldCost.toLocaleString()} gold</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={isLocked || !canAfford}
                          onClick={() => handleCraftForestWeapon(recipe.weaponIndex, recipe.goldCost, recipe.requiredRankIndex, recipe.requiredRank)}
                          className={`shrink-0 text-xs h-8 border ${isLocked ? "bg-gray-800/50 border-gray-700/40 text-gray-500" : !canAfford ? "bg-gray-800/50 border-gray-700/40 text-gray-500" : "bg-green-800 hover:bg-green-700 border-green-600/40 text-green-100"}`}
                        >
                          {isLocked ? <><Lock className="w-3 h-3 mr-1" />Locked</> : "Craft"}
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
