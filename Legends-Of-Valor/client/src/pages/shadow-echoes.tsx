import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const RANK_ORDER = [
  "Novice","Apprentice","Initiate","Journeyman","Adept","Expert","Master",
  "Grandmaster","Champion","Overlord","Sovereign","Ascendant","Legend","Mythic","Mythical Legend",
];

const RANK_COLOR: Record<string, string> = {
  "Novice":"text-gray-400","Apprentice":"text-gray-300","Initiate":"text-gray-300",
  "Journeyman":"text-green-400","Adept":"text-green-300","Expert":"text-teal-400",
  "Master":"text-blue-400","Grandmaster":"text-blue-300","Champion":"text-purple-400",
  "Overlord":"text-purple-300","Sovereign":"text-pink-400","Ascendant":"text-pink-300",
  "Legend":"text-amber-400","Mythic":"text-amber-300","Mythical Legend":"text-yellow-300",
};

const STRATEGY_ICON: Record<string, string> = {
  aggressive:"⚔️", defensive:"🛡️", mage:"🔮", balanced:"⚖️", berserker:"🔥",
};

const STRATEGY_COLOR: Record<string, string> = {
  aggressive:"text-red-400", defensive:"text-blue-400",
  mage:"text-purple-400",    balanced:"text-teal-400", berserker:"text-orange-400",
};

function RankBadge({ rank }: { rank: string }) {
  return (
    <span className={`font-semibold text-xs ${RANK_COLOR[rank] ?? "text-gray-400"}`}>
      {rank}
    </span>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000)     return (n/1e3).toFixed(0)+"K";
  return n.toLocaleString();
}

type Echo = {
  id: string;
  accountId: string;
  username: string;
  race: string;
  rank: string;
  prestigeLevel: number;
  strategyProfile: string;
  hp: number;
  echoWins: number;
  echoLosses: number;
  capturedAt: string;
  stats: Record<string, number>;
};

type BattleEvent = {
  round: number;
  actor: "challenger" | "echo";
  action: string;
  skillName?: string;
  isCrit?: boolean;
  damage?: number;
  healing?: number;
  effectApplied?: string;
  challengerHp: number;
  echoHp: number;
  message: string;
};

type BattleResult = {
  winner: "challenger" | "echo" | "draw";
  rounds: number;
  events: BattleEvent[];
  challengerMaxHp: number;
  echoMaxHp: number;
  goldReward: number;
  shardReward: number;
  xpReward: number;
  echoUsername: string;
};

export default function ShadowEchoes() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filterRank, setFilterRank] = useState<string>("all");
  const [selectedEcho, setSelectedEcho] = useState<Echo | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [replayIdx, setReplayIdx] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  // Auto-refresh snapshot on page mount
  const refreshSnap = useMutation({
    mutationFn: () => apiRequest("POST", `/api/accounts/${acctId}/snapshot`),
  });
  useEffect(() => {
    if (acctId) refreshSnap.mutate();
  }, [acctId]);

  const { data: echoes = [], isLoading } = useQuery<Echo[]>({
    queryKey: ["/api/shadow-echoes", filterRank],
    queryFn: () =>
      apiRequest("GET", `/api/shadow-echoes?rank=${filterRank}&exclude=${acctId ?? ""}`),
    enabled: !!acctId,
  });

  const { data: mySnap } = useQuery<any>({
    queryKey: [`/api/shadow-echoes/mine/${acctId}`],
    enabled: !!acctId,
  });

  const battleMut = useMutation({
    mutationFn: (snapshotId: string) =>
      apiRequest("POST", `/api/shadow-echoes/${snapshotId}/battle`, { challengerId: acctId }),
    onSuccess: (data: BattleResult) => {
      setBattleResult(data);
      setReplayIdx(0);
      startReplay(data.events.length);
      qc.invalidateQueries({ queryKey: ["/api/shadow-echoes"] });
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
    },
    onError: (e: any) =>
      toast({ title: "Battle failed", description: e.message, variant: "destructive" }),
  });

  function startReplay(total: number) {
    setIsReplaying(true);
    setReplayIdx(0);
    let idx = 0;
    replayTimer.current = setInterval(() => {
      idx++;
      setReplayIdx(idx);
      if (idx >= total) {
        clearInterval(replayTimer.current!);
        setIsReplaying(false);
      }
    }, 350);
  }

  useEffect(() => () => { if (replayTimer.current) clearInterval(replayTimer.current); }, []);

  const displayedEchoes = echoes.filter(e =>
    filterRank === "all" || e.rank === filterRank
  );

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Please log in.</p>
      </div>
    );
  }

  const myRankIdx = RANK_ORDER.indexOf(account.rank ?? "Novice");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-indigo-950 border-b border-purple-800 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">👥</div>
            <div>
              <h1 className="text-2xl font-bold text-purple-200">Shadow Realm</h1>
              <p className="text-purple-400 text-sm">Fight AI clones built from real players' builds and strategies</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-purple-300 font-semibold">Your Echo</div>
            {mySnap ? (
              <div className="text-gray-400 text-xs mt-0.5">
                W/L: {mySnap.echoWins}/{mySnap.echoLosses} · {mySnap.strategyProfile}
              </div>
            ) : (
              <div className="text-gray-500 text-xs">Capturing snapshot…</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-5">
        {/* ── Left: Echo List ──────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-3">
          {/* Filter */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Filter by Rank</label>
            <select
              value={filterRank}
              onChange={e => setFilterRank(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Ranks</option>
              {RANK_ORDER.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Difficulty hint */}
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg px-3 py-2 text-xs text-blue-300">
            💡 Your rank: <strong>{account.rank}</strong>. Echoes near your rank offer the best challenge.
          </div>

          {/* Echo cards */}
          {isLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading echoes…</p>
          ) : displayedEchoes.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 text-center">
              <p className="text-4xl mb-2">🌑</p>
              <p className="text-gray-400 text-sm">No echoes found. Be the first to venture here.</p>
            </div>
          ) : (
            displayedEchoes.map(echo => {
              const echoRankIdx = RANK_ORDER.indexOf(echo.rank);
              const diff = echoRankIdx - myRankIdx;
              const diffLabel = diff > 2 ? "Dangerous" : diff < -2 ? "Easy" : "Fair";
              const diffColor = diff > 2 ? "text-red-400" : diff < -2 ? "text-green-400" : "text-yellow-400";

              return (
                <div key={echo.id}
                  onClick={() => { setSelectedEcho(echo); setBattleResult(null); }}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    selectedEcho?.id === echo.id
                      ? "border-purple-500 bg-purple-950/30"
                      : "border-gray-700 bg-gray-900 hover:border-purple-600 hover:bg-purple-950/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm truncate">{echo.username}</span>
                    <span className={`text-xs ${diffColor}`}>{diffLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <RankBadge rank={echo.rank} />
                    {echo.prestigeLevel > 0 && (
                      <span className="text-amber-400">P{echo.prestigeLevel}</span>
                    )}
                    <span className={`${STRATEGY_COLOR[echo.strategyProfile] ?? "text-gray-400"}`}>
                      {STRATEGY_ICON[echo.strategyProfile]} {echo.strategyProfile}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                    <span>W:{echo.echoWins}</span>
                    <span>L:{echo.echoLosses}</span>
                    <span>{echo.race}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Right: Echo Detail + Battle ────────────────────────────── */}
        <div className="flex-1 space-y-4">
          {!selectedEcho && !battleResult && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-10 text-center">
              <p className="text-5xl mb-3">👥</p>
              <p className="text-gray-300 font-semibold">Select an Echo to Challenge</p>
              <p className="text-gray-500 text-sm mt-2">Each echo is an AI clone of a real player's exact stats, gear, and skills — playing with their combat style.</p>
            </div>
          )}

          {selectedEcho && !battleResult && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              {/* Echo Header */}
              <div className={`px-6 py-5 bg-gradient-to-r ${
                selectedEcho.strategyProfile === "berserker" ? "from-red-950 to-orange-950" :
                selectedEcho.strategyProfile === "mage" ? "from-purple-950 to-indigo-950" :
                selectedEcho.strategyProfile === "defensive" ? "from-blue-950 to-cyan-950" :
                "from-gray-900 to-gray-800"
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {selectedEcho.username}
                      {selectedEcho.prestigeLevel > 0 && (
                        <span className="text-amber-400 text-sm">★ Prestige {selectedEcho.prestigeLevel}</span>
                      )}
                    </h2>
                    <div className="flex gap-3 mt-1 text-sm flex-wrap">
                      <RankBadge rank={selectedEcho.rank} />
                      <span className="text-gray-400">{selectedEcho.race}</span>
                      <span className={STRATEGY_COLOR[selectedEcho.strategyProfile]}>
                        {STRATEGY_ICON[selectedEcho.strategyProfile]} {selectedEcho.strategyProfile} build
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-green-400 font-bold text-lg">{selectedEcho.echoWins}W</div>
                    <div className="text-red-400 text-sm">{selectedEcho.echoLosses}L</div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 py-4 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-3">Echo Stats (at time of snapshot)</p>
                <div className="grid grid-cols-5 gap-2">
                  {["Str","Def","Spd","Int","Luck"].map(stat => (
                    <div key={stat} className="bg-gray-800 rounded-lg p-2.5 text-center">
                      <div className="text-white font-bold">{selectedEcho.stats[stat] ?? 0}</div>
                      <div className="text-gray-500 text-xs">{stat}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards preview */}
              <div className="px-6 py-4 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-2">If you win:</p>
                <div className="flex gap-3 text-sm">
                  {(() => {
                    const rankIdx = RANK_ORDER.indexOf(selectedEcho.rank);
                    const tier = Math.max(0, rankIdx);
                    const gold = (tier + 1) * 5_000 * (1 + selectedEcho.prestigeLevel);
                    const shards = (tier + 1) * 25;
                    return (
                      <>
                        <span className="text-yellow-400">💰 {fmt(gold)} gold</span>
                        <span className="text-blue-400">💎 {shards} shards</span>
                        <span className="text-purple-400">✨ {(tier + 1) * 500} XP equivalent</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Challenge button */}
              <div className="px-6 py-4 border-t border-gray-700">
                <button
                  onClick={() => battleMut.mutate(selectedEcho.id)}
                  disabled={battleMut.isPending}
                  className="w-full py-3 rounded-xl font-bold text-base bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 hover:from-purple-600 hover:via-indigo-600 hover:to-purple-600 shadow-lg shadow-purple-900/50 transition-all disabled:opacity-50"
                >
                  {battleMut.isPending ? "Simulating battle…" : `⚔️ Challenge the Echo of ${selectedEcho.username}`}
                </button>
                <p className="text-gray-600 text-xs text-center mt-2">
                  Battle is auto-resolved server-side using your current build
                </p>
              </div>
            </div>
          )}

          {/* ── Battle Result ──────────────────────────────────────────── */}
          {battleResult && (
            <div className="space-y-4">
              {/* Result banner */}
              <div className={`rounded-xl border p-5 text-center ${
                battleResult.winner === "challenger"
                  ? "bg-emerald-950/50 border-emerald-600"
                  : battleResult.winner === "echo"
                  ? "bg-red-950/50 border-red-600"
                  : "bg-gray-800 border-gray-600"
              }`}>
                <div className="text-4xl mb-2">
                  {battleResult.winner === "challenger" ? "🏆" : battleResult.winner === "echo" ? "💀" : "🤝"}
                </div>
                <div className={`text-2xl font-bold ${
                  battleResult.winner === "challenger" ? "text-emerald-300" :
                  battleResult.winner === "echo"       ? "text-red-300" : "text-gray-300"
                }`}>
                  {battleResult.winner === "challenger"
                    ? `Victory! You defeated ${battleResult.echoUsername}'s Echo!`
                    : battleResult.winner === "echo"
                    ? `Defeated by ${battleResult.echoUsername}'s Echo`
                    : "Draw — a legendary duel!"}
                </div>
                {battleResult.winner === "challenger" && (
                  <div className="flex justify-center gap-5 mt-3 text-sm">
                    <span className="text-yellow-400">+{fmt(battleResult.goldReward)} gold</span>
                    <span className="text-blue-400">+{battleResult.shardReward} shards</span>
                  </div>
                )}
                <div className="text-gray-500 text-xs mt-2">{battleResult.rounds} rounds</div>
              </div>

              {/* HP bar comparison */}
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 flex gap-4">
                {/* Challenger */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>You</span>
                    <span>{Math.max(0, battleResult.events[Math.min(replayIdx, battleResult.events.length-1)]?.challengerHp ?? 0)} / {battleResult.challengerMaxHp}</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{
                      width: `${Math.max(0, ((battleResult.events[Math.min(replayIdx, battleResult.events.length-1)]?.challengerHp ?? battleResult.challengerMaxHp) / battleResult.challengerMaxHp) * 100)}%`
                    }} />
                  </div>
                </div>
                <div className="text-gray-600 font-bold">VS</div>
                {/* Echo */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{selectedEcho?.username ?? "Echo"}</span>
                    <span>{Math.max(0, battleResult.events[Math.min(replayIdx, battleResult.events.length-1)]?.echoHp ?? 0)} / {battleResult.echoMaxHp}</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{
                      width: `${Math.max(0, ((battleResult.events[Math.min(replayIdx, battleResult.events.length-1)]?.echoHp ?? battleResult.echoMaxHp) / battleResult.echoMaxHp) * 100)}%`
                    }} />
                  </div>
                </div>
              </div>

              {/* Battle log */}
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-300">Battle Log</h3>
                  <div className="flex gap-2">
                    {!isReplaying && (
                      <button
                        onClick={() => startReplay(battleResult.events.length)}
                        className="text-xs bg-purple-800 hover:bg-purple-700 px-3 py-1 rounded-lg transition-all"
                      >
                        ▶ Replay
                      </button>
                    )}
                    {isReplaying && (
                      <button
                        onClick={() => {
                          clearInterval(replayTimer.current!);
                          setIsReplaying(false);
                          setReplayIdx(battleResult.events.length);
                        }}
                        className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg transition-all"
                      >
                        ⏭ Skip
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {battleResult.events.slice(0, replayIdx + 1).map((ev, i) => (
                    <div key={i} className={`text-xs px-3 py-1.5 rounded-lg flex items-start gap-2 ${
                      ev.actor === "challenger"
                        ? "bg-emerald-950/30 border border-emerald-900/40"
                        : ev.action === "dot"
                        ? "bg-orange-950/20 border border-orange-900/30"
                        : "bg-red-950/20 border border-red-900/30"
                    }`}>
                      <span className="text-gray-500 shrink-0">R{ev.round}</span>
                      <span className={ev.actor === "challenger" ? "text-emerald-300" : ev.action === "dot" ? "text-orange-300" : "text-red-300"}>
                        {ev.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Challenge again */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setBattleResult(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-all"
                >
                  ← Back to Echo
                </button>
                <button
                  onClick={() => {
                    setBattleResult(null);
                    setTimeout(() => battleMut.mutate(selectedEcho!.id), 100);
                  }}
                  disabled={battleMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 font-bold transition-all disabled:opacity-50"
                >
                  ⚔️ Rematch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
