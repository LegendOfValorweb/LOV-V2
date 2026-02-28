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
import { Trophy, Star, Lock, Check, Map, Sword, Castle, Coins, Users, Compass, Package, Crown, Shield, Gem, Zap, Tag } from "lucide-react";

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

interface PlayerTitle {
  id: string;
  titleId: string;
  category: string;
  name: string;
  isEquipped: boolean;
  earnedAt: string;
}

interface PlayerBadge {
  id: string;
  badgeId: string;
  badgeType: string;
  name: string;
  icon: string;
  earnedAt: string;
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

const badgeTypeIcons: Record<string, any> = {
  vip: Zap,
  guild: Shield,
  rank: Crown,
};

const badgeTypeColors: Record<string, string> = {
  vip: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  guild: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  rank: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
};

const titleCategoryColors: Record<string, string> = {
  rank: "text-yellow-500",
  guild: "text-blue-500",
  event: "text-green-500",
};

export default function Achievements() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [selectedCategory, setSelectedCategory] = useState("Combat");
  const queryClient = useQueryClient();

  const { data: achievementsData } = useQuery<{ categories: AchievementCategory[]; total: number; unlocked: string[] }>({
    queryKey: [`/api/accounts/${account?.id}/achievements`],
    enabled: !!account,
  });

  const { data: trophiesData } = useQuery<{ trophies: TrophyItem[]; total: number; earned: string[] }>({
    queryKey: [`/api/accounts/${account?.id}/full-trophies`],
    enabled: !!account,
  });

  const { data: titlesData } = useQuery<{ titles: PlayerTitle[]; equipped: PlayerTitle[]; maxEquipped: number; availableTitles: any[] }>({
    queryKey: [`/api/accounts/${account?.id}/titles`],
    enabled: !!account,
  });

  const { data: badgesData } = useQuery<{ badges: PlayerBadge[] }>({
    queryKey: [`/api/accounts/${account?.id}/badges`],
    enabled: !!account,
  });

  const equipTitle = useMutation({
    mutationFn: async (titleId: string) => {
      const res = await fetch(`/api/accounts/${account?.id}/titles/equip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/${account?.id}/titles`] });
    },
  });

  const unequipTitle = useMutation({
    mutationFn: async (titleId: string) => {
      const res = await fetch(`/api/accounts/${account?.id}/titles/unequip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/accounts/${account?.id}/titles`] });
    },
  });

  if (!account) {
    return (
      <div className="h-full flex items-center justify-center">
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

  const titles = titlesData?.titles || [];
  const equippedTitles = titles.filter(t => t.isEquipped);
  const badges = badgesData?.badges || [];

  const currentCategory = categories.find(c => c.category === selectedCategory);

  return (
    <div className="game-page-scroll bg-gradient-to-br from-background via-background to-accent/10 p-4">
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

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {badges.map(badge => {
              const Icon = badgeTypeIcons[badge.badgeType] || Shield;
              const colorClass = badgeTypeColors[badge.badgeType] || "text-gray-500 bg-gray-500/10 border-gray-500/30";
              return (
                <div key={badge.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colorClass}`}>
                  <Icon className="w-3 h-3" />
                  {badge.name}
                </div>
              );
            })}
          </div>
        )}

        {equippedTitles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {equippedTitles.map(title => (
              <div key={title.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-medium">
                <Tag className="w-3 h-3" />
                {title.name}
                <span className="text-[9px] opacity-60 uppercase">{title.category}</span>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="trophies" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Trophies
            </TabsTrigger>
            <TabsTrigger value="titles" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Titles
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Badges
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
                <Progress value={(earnedTrophies / Math.max(totalTrophies, 1)) * 100} className="h-2" />
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

          <TabsContent value="titles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-500" />
                  Titles
                </CardTitle>
                <CardDescription>
                  {titles.length} titles earned — {equippedTitles.length}/3 equipped (max 1 per category: rank, guild, event)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-6">
                    {(["rank", "guild", "event"] as const).map(category => {
                      const categoryTitles = titles.filter(t => t.category === category);
                      if (categoryTitles.length === 0) return null;
                      return (
                        <div key={category}>
                          <h3 className={`text-sm font-semibold mb-3 uppercase tracking-wider ${titleCategoryColors[category]}`}>
                            {category} Titles ({categoryTitles.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {categoryTitles.map(title => (
                              <div
                                key={title.id}
                                className={`p-3 rounded-lg border flex items-center justify-between ${
                                  title.isEquipped
                                    ? "bg-amber-500/10 border-amber-500/30"
                                    : "bg-card border-border"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Crown className={`w-4 h-4 ${title.isEquipped ? "text-amber-500" : "text-muted-foreground"}`} />
                                  <span className="font-medium text-sm">{title.name}</span>
                                </div>
                                {title.isEquipped ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7"
                                    onClick={() => unequipTitle.mutate(title.titleId)}
                                    disabled={unequipTitle.isPending}
                                  >
                                    Unequip
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7"
                                    onClick={() => equipTitle.mutate(title.titleId)}
                                    disabled={equipTitle.isPending}
                                  >
                                    Equip
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {titles.length === 0 && (
                      <div className="text-center text-muted-foreground py-12">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No titles earned yet. Keep progressing to unlock titles!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  Badges
                </CardTitle>
                <CardDescription>
                  {badges.length} badges earned — Badges are always visible on your profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-6">
                    {(["vip", "guild", "rank"] as const).map(badgeType => {
                      const typeBadges = badges.filter(b => b.badgeType === badgeType);
                      if (typeBadges.length === 0) return null;
                      const Icon = badgeTypeIcons[badgeType] || Shield;
                      return (
                        <div key={badgeType}>
                          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {badgeType === "vip" ? "VIP" : badgeType.charAt(0).toUpperCase() + badgeType.slice(1)} Badges
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {typeBadges.map(badge => {
                              const colorClass = badgeTypeColors[badge.badgeType] || "";
                              return (
                                <div
                                  key={badge.id}
                                  className={`p-4 rounded-lg border text-center ${colorClass}`}
                                >
                                  <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 bg-background/50">
                                    <Icon className="w-7 h-7" />
                                  </div>
                                  <p className="font-medium text-sm">{badge.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(badge.earnedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {badges.length === 0 && (
                      <div className="text-center text-muted-foreground py-12">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No badges earned yet. Badges are awarded for VIP status, guild membership, and rank progress.</p>
                      </div>
                    )}
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
