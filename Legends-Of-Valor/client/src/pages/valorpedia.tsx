import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Fish, Skull, Gem, PawPrint, Sparkles, Map, Lock, Check, Gift, Award } from "lucide-react";

interface ValorpediaEntry {
  id: string;
  name: string;
  description: string;
  discovered: boolean;
  discoveredAt: string | null;
}

interface ValorpediaCategory {
  category: string;
  total: number;
  discovered: number;
  entries: ValorpediaEntry[];
}

interface ValorpediaMilestone {
  id: string;
  name: string;
  requiredPercent: number;
  rewards: { gold?: number; rubies?: number; title?: string };
  claimed: boolean;
  eligible: boolean;
}

interface ValorpediaData {
  categories: ValorpediaCategory[];
  totalEntries: number;
  totalDiscovered: number;
  completionPercent: number;
  milestones: ValorpediaMilestone[];
}

const categoryIcons: Record<string, any> = {
  fish: Fish,
  monsters: Skull,
  resources: Gem,
  pets: PawPrint,
  spells: Sparkles,
  zones: Map,
};

const categoryColors: Record<string, string> = {
  fish: "text-blue-400",
  monsters: "text-red-400",
  resources: "text-amber-400",
  pets: "text-green-400",
  spells: "text-purple-400",
  zones: "text-cyan-400",
};

const categoryBgColors: Record<string, string> = {
  fish: "bg-blue-500/10 border-blue-500/30",
  monsters: "bg-red-500/10 border-red-500/30",
  resources: "bg-amber-500/10 border-amber-500/30",
  pets: "bg-green-500/10 border-green-500/30",
  spells: "bg-purple-500/10 border-purple-500/30",
  zones: "bg-cyan-500/10 border-cyan-500/30",
};

export default function Valorpedia() {
  const [, navigate] = useLocation();
  const { account, refetchAccount } = useGame();
  const [selectedCategory, setSelectedCategory] = useState("fish");
  const queryClient = useQueryClient();

  const { data: valorpediaData } = useQuery<ValorpediaData>({
    queryKey: [`/api/accounts/${account?.id}/valorpedia`],
    enabled: !!account,
  });

  const claimMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await fetch(`/api/accounts/${account?.id}/valorpedia/claim-milestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/${account?.id}/valorpedia`] });
      refetchAccount();
    },
  });

  if (!account) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view Valorpedia</p>
      </div>
    );
  }

  const categories = valorpediaData?.categories || [];
  const totalEntries = valorpediaData?.totalEntries || 0;
  const totalDiscovered = valorpediaData?.totalDiscovered || 0;
  const completionPercent = valorpediaData?.completionPercent || 0;
  const milestones = valorpediaData?.milestones || [];

  const currentCategory = categories.find(c => c.category === selectedCategory);

  return (
    <div className="h-full bg-gradient-to-br from-background via-background to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-amber-500" />
            <div>
              <h1 className="font-serif text-3xl font-bold">Valorpedia</h1>
              <p className="text-muted-foreground text-sm">
                {totalDiscovered} / {totalEntries} discovered ({completionPercent}%)
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/world-map")}>
            <Map className="w-4 h-4 mr-2" />
            World Map
          </Button>
        </div>

        <div className="mb-4">
          <Progress value={completionPercent} className="h-3" />
        </div>

        <Tabs defaultValue="encyclopedia" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="encyclopedia" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Encyclopedia
            </TabsTrigger>
            <TabsTrigger value="milestones" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Milestones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="encyclopedia" className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
              {categories.map(cat => {
                const Icon = categoryIcons[cat.category] || BookOpen;
                const colorClass = categoryColors[cat.category] || "text-gray-400";
                const isSelected = selectedCategory === cat.category;

                return (
                  <Button
                    key={cat.category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => setSelectedCategory(cat.category)}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "" : colorClass}`} />
                    <span className="text-xs capitalize">{cat.category}</span>
                    <span className="text-[10px] text-muted-foreground">{cat.discovered}/{cat.total}</span>
                  </Button>
                );
              })}
            </div>

            {currentCategory && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 capitalize">
                    {(() => {
                      const Icon = categoryIcons[currentCategory.category] || BookOpen;
                      return <Icon className={`w-5 h-5 ${categoryColors[currentCategory.category]}`} />;
                    })()}
                    {currentCategory.category}
                  </CardTitle>
                  <CardDescription>
                    {currentCategory.discovered} / {currentCategory.total} discovered
                  </CardDescription>
                  <Progress
                    value={currentCategory.total > 0 ? (currentCategory.discovered / currentCategory.total) * 100 : 0}
                    className="h-2"
                  />
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[450px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentCategory.entries.map(entry => {
                        const bgColor = categoryBgColors[currentCategory.category] || "";
                        return (
                          <div
                            key={entry.id}
                            className={`p-3 rounded-lg border ${
                              entry.discovered
                                ? bgColor
                                : "bg-card border-border opacity-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {entry.discovered ? (
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm">
                                {entry.discovered ? entry.name : "???"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground pl-6">
                              {entry.discovered ? entry.description : "Not yet discovered"}
                            </p>
                            {entry.discovered && entry.discoveredAt && (
                              <p className="text-[10px] text-muted-foreground pl-6 mt-1">
                                Discovered {new Date(entry.discoveredAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Discovery Milestones
                </CardTitle>
                <CardDescription>
                  Reach completion milestones to earn rewards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className={`p-4 rounded-lg border ${
                        milestone.claimed
                          ? "bg-green-500/10 border-green-500/30"
                          : milestone.eligible
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            milestone.claimed
                              ? "bg-green-500/20"
                              : milestone.eligible
                              ? "bg-amber-500/20"
                              : "bg-muted"
                          }`}>
                            {milestone.claimed ? (
                              <Check className="w-5 h-5 text-green-500" />
                            ) : (
                              <Gift className={`w-5 h-5 ${milestone.eligible ? "text-amber-500" : "text-muted-foreground"}`} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{milestone.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Requires {milestone.requiredPercent}% completion
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex gap-2 flex-wrap justify-end">
                              {milestone.rewards.gold && (
                                <Badge variant="outline" className="text-yellow-500 text-[10px]">
                                  +{milestone.rewards.gold.toLocaleString()} Gold
                                </Badge>
                              )}
                              {milestone.rewards.rubies && (
                                <Badge variant="outline" className="text-pink-500 text-[10px]">
                                  +{milestone.rewards.rubies} Rubies
                                </Badge>
                              )}
                              {milestone.rewards.title && (
                                <Badge variant="outline" className="text-purple-500 text-[10px]">
                                  Title: {milestone.rewards.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {!milestone.claimed && milestone.eligible && (
                            <Button
                              size="sm"
                              onClick={() => claimMilestone.mutate(milestone.id)}
                              disabled={claimMilestone.isPending}
                            >
                              Claim
                            </Button>
                          )}
                          {milestone.claimed && (
                            <Badge className="bg-green-500/20 text-green-500">Claimed</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Progress
                          value={Math.min(completionPercent, milestone.requiredPercent) / milestone.requiredPercent * 100}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
