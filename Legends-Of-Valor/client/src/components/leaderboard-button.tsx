import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, X, RefreshCw, Medal } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  username?: string;
  guildName?: string;
  value: number | string;
  accountId?: string;
}

interface LeaderboardButtonProps {
  type: string;
  label: string;
  icon?: string;
  currentPlayerId?: string;
  variant?: "gold" | "purple" | "red" | "blue" | "green";
}

const MEDAL_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

async function fetchLeaderboard(type: string): Promise<LeaderboardEntry[]> {
  let url = "";
  if (type === "pet-wins") url = "/api/leaderboard/pet-wins";
  else if (type === "base-raids") url = "/api/leaderboard/base-raids";
  else if (type === "hell-zone") url = "/api/hell-zone/leaderboard";
  else url = `/api/leaderboards/${type}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.leaderboard) {
    return data.leaderboard.map((e: any, i: number) => ({
      rank: i + 1,
      username: e.username,
      value: e.score ?? e.petWins ?? e.raidWins ?? e.wins ?? e.kills ?? 0,
      accountId: e.accountId,
    }));
  }
  if (data.data) {
    return data.data;
  }
  return [];
}

const VARIANT_STYLES: Record<string, string> = {
  gold: "bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-300",
  purple: "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-300",
  red: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-300",
  blue: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-300",
  green: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300",
};

export function LeaderboardButton({ type, label, icon = "🏆", currentPlayerId, variant = "gold" }: LeaderboardButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: entries = [], isLoading, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: [`leaderboard-mini-${type}`],
    queryFn: () => fetchLeaderboard(type),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.gold;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${variantClass}`}
      >
        <span>{icon}</span>
        <span>Leaderboard</span>
        <Trophy className="w-3 h-3" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/60">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-white text-sm">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refetch()} className="text-gray-400 hover:text-white transition-colors p-1 rounded">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Loading...</div>
              ) : entries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">No data yet</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {entries.slice(0, 20).map((entry) => {
                    const isMe = entry.accountId === currentPlayerId;
                    return (
                      <div
                        key={entry.rank}
                        className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-yellow-500/10" : "hover:bg-gray-800/60"} transition-colors`}
                      >
                        <div className="w-6 text-center flex-shrink-0">
                          {entry.rank <= 3 ? (
                            <Medal className={`w-4 h-4 mx-auto ${MEDAL_COLORS[entry.rank - 1]}`} />
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{entry.rank}</span>
                          )}
                        </div>
                        <span className={`flex-1 text-sm font-medium truncate ${isMe ? "text-yellow-300" : "text-gray-200"}`}>
                          {entry.username || entry.guildName || "Unknown"}
                          {isMe && <span className="ml-1 text-xs text-yellow-500">(you)</span>}
                        </span>
                        <span className="text-xs font-mono text-gray-300 flex-shrink-0">
                          {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/40">
              <button
                className="w-full text-center text-xs text-purple-400 hover:text-purple-300 transition-colors"
                onClick={() => { setOpen(false); window.location.href = "/leaderboard"; }}
              >
                View full leaderboard →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
