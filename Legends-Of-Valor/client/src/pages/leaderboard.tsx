import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag, 
  Package, 
  LogOut, 
  Calendar, 
  Swords, 
  Target,
  Trophy,
  TrendingUp,
  Crown,
  Clock,
  RefreshCw,
  Castle,
  Users,
  Sparkles,
  ArrowLeftRight,
  Map,
  Flame,
  Heart,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type LeaderboardEntry = {
  accountId?: string;
  username?: string;
  guildId?: string;
  guildName?: string;
  masterName?: string;
  value: number | string;
  rank: number;
  npcFloor?: number;
  npcLevel?: number;
  dungeonFloor?: number;
  dungeonLevel?: number;
};

type LeaderboardResponse = {
  type: string;
  data: LeaderboardEntry[];
  refreshedAt: string;
  nextRefresh: string;
};

const leaderboardTypes = [
  { id: "pvp",        label: "PvP Elo",      icon: Swords,    color: "text-red-500",     valueLabel: "Elo" },
  { id: "guild",      label: "Guild XP",     icon: Users,     color: "text-emerald-500", valueLabel: "XP" },
  { id: "tower",      label: "Tower Floor",  icon: Target,    color: "text-purple-500",  valueLabel: "Floor" },
  { id: "gathering",  label: "Gathering",    icon: TrendingUp,color: "text-green-500",   valueLabel: "Items" },
  { id: "seasonal",   label: "Seasonal",     icon: Calendar,  color: "text-blue-400",    valueLabel: "Score" },
  { id: "pet-wins",   label: "Pet Wins",     icon: Heart,     color: "text-pink-400",    valueLabel: "Wins" },
  { id: "base-raids", label: "Raid Wins",    icon: Shield,    color: "text-orange-400",  valueLabel: "Raids" },
  { id: "hell-zone",  label: "Hell Zone",    icon: Flame,     color: "text-red-600",     valueLabel: "Score" },
];

const rankColors: Record<string, string> = {
  Novice: "text-gray-400",
  Apprentice: "text-green-500",
  Journeyman: "text-blue-400",
  Expert: "text-purple-400",
  Master: "text-orange-400",
  Grandmaster: "text-red-400",
  Legend: "text-yellow-400",
  Elite: "text-pink-400",
};

async function fetchLeaderboardData(activeTab: string): Promise<LeaderboardResponse> {
  if (activeTab === "pet-wins") {
    const res = await fetch("/api/leaderboard/pet-wins");
    const data = await res.json();
    const entries = (data.leaderboard || []).map((e: any, i: number) => ({
      accountId: e.accountId, username: e.username,
      value: e.petWins ?? e.wins ?? 0, rank: i + 1,
    }));
    return { type: "pet-wins", data: entries, refreshedAt: new Date().toISOString(), nextRefresh: new Date(Date.now() + 30 * 60000).toISOString() };
  }
  if (activeTab === "base-raids") {
    const res = await fetch("/api/leaderboard/base-raids");
    const data = await res.json();
    const entries = (data.leaderboard || []).map((e: any, i: number) => ({
      accountId: e.accountId, username: e.username,
      value: e.raidWins ?? e.wins ?? 0, rank: i + 1,
    }));
    return { type: "base-raids", data: entries, refreshedAt: new Date().toISOString(), nextRefresh: new Date(Date.now() + 30 * 60000).toISOString() };
  }
  if (activeTab === "hell-zone") {
    const res = await fetch("/api/hell-zone/leaderboard");
    const data = await res.json();
    const entries = (data.leaderboard || []).map((e: any, i: number) => ({
      accountId: e.accountId, username: e.username,
      value: e.score ?? e.kills ?? 0, rank: i + 1,
    }));
    return { type: "hell-zone", data: entries, refreshedAt: new Date().toISOString(), nextRefresh: new Date(Date.now() + 30 * 60000).toISOString() };
  }
  const res = await fetch(`/api/leaderboards/${activeTab}`);
  return res.json();
}

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const { account, logout } = useGame();
  const [activeTab, setActiveTab] = useState("pvp");

  const { data: leaderboard, isLoading, refetch } = useQuery<LeaderboardResponse>({
    queryKey: [`leaderboard-${activeTab}`],
    queryFn: () => fetchLeaderboardData(activeTab),
    enabled: !!account,
    refetchInterval: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!account) navigate("/");
  }, [account]);

  if (!account) return null;

  const truncateName = (name: string | undefined): string => {
    if (!name) return "";
    return name.length > 14 ? `${name.substring(0, 14)}...` : name;
  };

  const activeType = leaderboardTypes.find(t => t.id === activeTab);

  const renderLeaderboardEntry = (entry: LeaderboardEntry, type: string, key: string) => {
    const isGuildLeaderboard = type === "guild";
    const isCurrentPlayer = !isGuildLeaderboard && entry.accountId === account.id;
    const displayName = truncateName(isGuildLeaderboard ? entry.guildName : entry.username);
    
    const rankBadge = entry.rank <= 3 ? (
      <Badge variant={entry.rank === 1 ? "default" : "secondary"} className={
        entry.rank === 1 ? "bg-yellow-500 text-black min-w-[2rem] justify-center" : 
        entry.rank === 2 ? "bg-gray-300 text-black min-w-[2rem] justify-center" : 
        "bg-amber-700 text-white min-w-[2rem] justify-center"
      }>
        #{entry.rank}
      </Badge>
    ) : (
      <span className="text-muted-foreground w-8 text-center text-sm">#{entry.rank}</span>
    );

    return (
      <div
        key={key}
        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
          isCurrentPlayer ? "bg-primary/10 border border-primary/30" : "bg-card/50 hover:bg-card/80"
        }`}
      >
        <div className="flex items-center gap-3">
          {rankBadge}
          {isGuildLeaderboard && <Castle className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
          <div className="flex flex-col">
            <span className={`font-medium text-sm ${isCurrentPlayer ? "text-primary" : ""}`}>
              {displayName}
              {isCurrentPlayer && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
            </span>
            {isGuildLeaderboard && entry.masterName && (
              <span className="text-xs text-muted-foreground">Leader: {truncateName(entry.masterName)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {type === "tower" ? (
            <Badge variant="outline" className="font-mono text-xs">
              Floor {entry.value}
            </Badge>
          ) : (
            <span className="font-mono font-bold text-sm">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="game-page-scroll bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-cinzel text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboards
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => navigate("/world-map")}>
                <Map className="h-3.5 w-3.5 mr-1" /> Map
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")}>
                <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Shop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")}>
                <Package className="h-3.5 w-3.5 mr-1" /> Inventory
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/challenges")}>
                <Swords className="h-3.5 w-3.5 mr-1" /> PvP
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/guild")}>
                <Users className="h-3.5 w-3.5 mr-1" /> Guild
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-3.5 w-3.5 mr-1" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Hall of Champions
              </CardTitle>
              {leaderboard && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(leaderboard.refreshedAt), { addSuffix: true })}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Tab bar — scrollable on mobile */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {leaderboardTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveTab(type.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    activeTab === type.id
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <type.icon className={`h-3.5 w-3.5 ${activeTab === type.id ? "" : type.color}`} />
                  {type.label}
                </button>
              ))}
            </div>

            {/* Value label */}
            {activeType && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground font-medium">Player / Guild</span>
                <span className="text-xs text-muted-foreground font-medium">{activeType.valueLabel}</span>
              </div>
            )}

            {/* Entries */}
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leaderboard?.data?.length ? (
              <div className="space-y-1.5">
                {leaderboard.data.map((entry) => {
                  const entryKey = (activeTab === "guild") 
                    ? entry.guildId || `guild-${entry.rank}` 
                    : entry.accountId || `player-${entry.rank}`;
                  return renderLeaderboardEntry(entry, activeTab, entryKey);
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No data available yet. Be the first to climb!
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {leaderboard ? `Next refresh: ${formatDistanceToNow(new Date(leaderboard.nextRefresh), { addSuffix: true })}` : "—"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
