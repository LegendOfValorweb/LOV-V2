import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sword, Crown, Castle, Star, Coins, Flame, Hammer, Globe, Trophy, Shield, ArrowLeft,
} from "lucide-react";

interface ServerAchievement {
  id: string;
  achievementKey: string;
  displayName: string;
  category: string;
  description: string;
  holderAccountId: string | null;
  holderUsername: string | null;
  holderRace: string | null;
  achievedAt: string | null;
  contextValue: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Combat: Sword,
  Ranks: Crown,
  "Mystic Tower": Castle,
  Items: Star,
  Economy: Coins,
  "Crafting & Life Skills": Hammer,
  Heritage: Flame,
  Zones: Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
  Combat: "text-red-400 border-red-800/40 bg-red-950/20",
  Ranks: "text-yellow-400 border-yellow-700/40 bg-yellow-950/20",
  "Mystic Tower": "text-purple-400 border-purple-800/40 bg-purple-950/20",
  Items: "text-cyan-400 border-cyan-800/40 bg-cyan-950/20",
  Economy: "text-emerald-400 border-emerald-800/40 bg-emerald-950/20",
  "Crafting & Life Skills": "text-orange-400 border-orange-800/40 bg-orange-950/20",
  Heritage: "text-rose-400 border-rose-800/40 bg-rose-950/20",
  Zones: "text-teal-400 border-teal-800/40 bg-teal-950/20",
};

const RACE_EMBLEMS: Record<string, string> = {
  Human: "⚔️",
  Elf: "🌿",
  Dwarf: "⛏️",
  Orc: "💀",
  Undead: "💀",
  Dragonborn: "🐉",
  Vampire: "🩸",
  Werewolf: "🌙",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function AchievementCard({ achievement }: { achievement: ServerAchievement }) {
  const claimed = !!achievement.holderAccountId;
  const colorClass = CATEGORY_COLORS[achievement.category] || "text-gray-400 border-gray-700/40 bg-gray-900/20";

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        claimed
          ? `${colorClass} shadow-md`
          : "border-gray-800/40 bg-gray-900/10 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {achievement.displayName}
            </span>
            {claimed && (
              <Trophy className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            {achievement.description}
          </p>
        </div>
      </div>

      {claimed ? (
        <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white/90">
            {RACE_EMBLEMS[achievement.holderRace || ""] || "🗡️"}{" "}
            {achievement.holderUsername}
          </span>
          {achievement.holderRace && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-white/20 text-gray-300">
              {achievement.holderRace}
            </Badge>
          )}
          {achievement.contextValue && (
            <span className="text-[10px] text-gray-400 italic truncate">
              ({achievement.contextValue})
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-500">
            {formatDate(achievement.achievedAt)}
          </span>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-[10px] text-gray-500 italic">Unclaimed — awaiting the first champion</span>
        </div>
      )}
    </div>
  );
}

export default function HonourHall() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const accountId = account?.id ?? null;

  const { data, isLoading, error } = useQuery<{ achievements: ServerAchievement[]; byCategory: Record<string, ServerAchievement[]> }>({
    queryKey: ["/api/honour-hall"],
    refetchInterval: 30000,
  });

  const { data: playerData } = useQuery<{ achievements: ServerAchievement[] }>({
    queryKey: [`/api/honour-hall/player/${accountId}`],
    enabled: !!accountId,
  });

  const categories = data?.byCategory ? Object.keys(data.byCategory) : [];
  const claimedCount = data?.achievements.filter(a => a.holderAccountId).length ?? 0;
  const totalCount = data?.achievements.length ?? 0;
  const playerClaimedCount = playerData?.achievements.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-5xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-yellow-300">
              ⚜ Honour Hall ⚜
            </h1>
            <p className="text-sm text-gray-400">
              Server-wide firsts — the legends who shaped the realm
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Card className="bg-gray-900/60 border-gray-700/40">
            <CardContent className="p-3 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-xs text-gray-400">Claimed</p>
                <p className="text-lg font-bold text-yellow-300">{claimedCount}<span className="text-sm text-gray-500">/{totalCount}</span></p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/60 border-gray-700/40">
            <CardContent className="p-3 flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              <div>
                <p className="text-xs text-gray-400">Unclaimed</p>
                <p className="text-lg font-bold text-cyan-300">{totalCount - claimedCount}</p>
              </div>
            </CardContent>
          </Card>
          {accountId && (
            <Card className="bg-gray-900/60 border-gray-700/40">
              <CardContent className="p-3 flex items-center gap-3">
                <Crown className="w-6 h-6 text-purple-400" />
                <div>
                  <p className="text-xs text-gray-400">Your Firsts</p>
                  <p className="text-lg font-bold text-purple-300">{playerClaimedCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-10 h-10 mx-auto mb-3 animate-pulse text-yellow-600" />
            <p>Consulting the annals of history...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-16 text-red-400">
            <p>Failed to load the Honour Hall. Please try again.</p>
          </div>
        )}

        {/* Categories */}
        {data && (
          <div className="space-y-6">
            {categories.map(category => {
              const Icon = CATEGORY_ICONS[category] || Trophy;
              const achievements = data.byCategory[category] || [];
              const catClaimed = achievements.filter(a => a.holderAccountId).length;
              const colorClass = CATEGORY_COLORS[category] || "text-gray-400";

              return (
                <Card key={category} className="bg-gray-900/40 border-gray-700/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className={`w-5 h-5 ${colorClass.split(" ")[0]}`} />
                      <span className={colorClass.split(" ")[0]}>{category}</span>
                      <Badge variant="outline" className="ml-auto text-xs border-gray-600 text-gray-400">
                        {catClaimed}/{achievements.length} claimed
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {achievements.map(ach => (
                        <AchievementCard key={ach.achievementKey} achievement={ach} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
