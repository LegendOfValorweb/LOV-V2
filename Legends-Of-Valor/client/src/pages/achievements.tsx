import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Lock, Check, Map, Sword, Castle, Coins, Users, Compass, Package, Crown } from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement: { type: string; value: any };
  rewards: { gold?: number; rubies?: number; trainingPoints?: number; soulGins?: number; exp?: number };
}

interface AchievementCategory {
  category: string;
  achievements: Achievement[];
  unlocked?: number;
}

interface TrophyItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned?: boolean;
}

const categoryIcons: Record<string, any> = {
  Combat: Sword,
  Tower: Castle,
  Pets: Star,
  Economy: Coins,
  Social: Users,
  Exploration: Compass,
  Collection: Package,
  Milestones: Crown,
};

export default function Achievements() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [selectedCategory, setSelectedCategory] = useState("Combat");

  const { data: achievementsData } = useQuery<{ categories: AchievementCategory[]; total: number; unlocked: string[] }>({
    queryKey: [`/api/accounts/${account?.id}/achievements`],
    enabled: !!account,
  });

  const { data: trophiesData } = useQuery<{ trophies: TrophyItem[]; total: number; earned: string[] }>({
    queryKey: [`/api/accounts/${account?.id}/full-trophies`],
    enabled: !!account,
  });

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view achievements</p>
      </div>
    );
  }

  const categories = achievementsData?.categories || [];
  const unlockedSet = new Set(achievementsData?.unlocked || []);
  const totalUnlocked = achievementsData?.unlocked?.length || 0;
  const totalAchievements = achievementsData?.total || 0;

  const trophies = trophiesData?.trophies || [];
  const earnedTrophies = trophiesData?.earned?.length || 0;
  const totalTrophies = trophiesData?.total || 0;

  const currentCategory = categories.find(c => c.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <div>
              <h1 className="font-serif text-3xl font-bold">Achievements</h1>
              <p className="text-muted-foreground text-sm">
                {totalUnlocked.toLocaleString()} / {totalAchievements.toLocaleString()} unlocked
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/world-map")}>
            <Map className="w-4 h-4 mr-2" />
            World Map
          </Button>
        </div>

        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Achievements ({totalUnlocked})
            </TabsTrigger>
            <TabsTrigger value="trophies" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Trophies ({earnedTrophies}/{totalTrophies})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achievements" className="space-y-4">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
              {categories.map(cat => {
                const Icon = categoryIcons[cat.category] || Star;
                const unlocked = cat.unlocked || 0;
                const total = cat.achievements.length;
                const isSelected = selectedCategory === cat.category;
                
                return (
                  <Button
                    key={cat.category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col items-center gap-1 h-auto py-2"
                    onClick={() => setSelectedCategory(cat.category)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{cat.category}</span>
                    <span className="text-[8px] text-muted-foreground">{unlocked}/{total}</span>
                  </Button>
                );
              })}
            </div>

            {currentCategory && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = categoryIcons[currentCategory.category] || Star;
                      return <Icon className="w-5 h-5" />;
                    })()}
                    {currentCategory.category} Achievements
                  </CardTitle>
                  <CardDescription>
                    {currentCategory.unlocked || 0} / {currentCategory.achievements.length} completed
                  </CardDescription>
                  <Progress 
                    value={((currentCategory.unlocked || 0) / currentCategory.achievements.length) * 100} 
                    className="h-2"
                  />
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentCategory.achievements.slice(0, 50).map(achievement => {
                        const isUnlocked = unlockedSet.has(achievement.id);
                        
                        return (
                          <div
                            key={achievement.id}
                            className={`p-3 rounded-lg border ${
                              isUnlocked 
                                ? "bg-green-500/10 border-green-500/30" 
                                : "bg-card border-border opacity-60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {isUnlocked ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium text-sm">{achievement.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {achievement.description}
                                </p>
                              </div>
                              {isUnlocked && (
                                <Badge variant="outline" className="bg-green-500/20 text-green-500 text-[10px]">
                                  Complete
                                </Badge>
                              )}
                            </div>
                            {achievement.rewards && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {achievement.rewards?.gold && (
                                  <span className="text-[10px] text-yellow-500">+{achievement.rewards.gold.toLocaleString()} Gold</span>
                                )}
                                {achievement.rewards?.rubies && (
                                  <span className="text-[10px] text-pink-500">+{achievement.rewards.rubies} Rubies</span>
                                )}
                                {achievement.rewards?.trainingPoints && (
                                  <span className="text-[10px] text-blue-500">+{achievement.rewards.trainingPoints} TP</span>
                                )}
                              </div>
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

          <TabsContent value="trophies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Trophy Collection
                </CardTitle>
                <CardDescription>
                  {earnedTrophies} / {totalTrophies} trophies earned
                </CardDescription>
                <Progress value={(earnedTrophies / totalTrophies) * 100} className="h-2" />
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {trophies.map(trophy => (
                      <div
                        key={trophy.id}
                        className={`p-4 rounded-lg border text-center ${
                          trophy.earned
                            ? "bg-yellow-500/10 border-yellow-500/30"
                            : "bg-card border-border opacity-50"
                        }`}
                      >
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                          trophy.earned ? "bg-yellow-500/20" : "bg-muted"
                        }`}>
                          <Trophy className={`w-6 h-6 ${trophy.earned ? "text-yellow-500" : "text-muted-foreground"}`} />
                        </div>
                        <p className="font-medium text-sm">{trophy.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{trophy.description}</p>
                        {trophy.earned && (
                          <Badge className="mt-2 bg-yellow-500/20 text-yellow-500 text-[10px]">Earned</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
