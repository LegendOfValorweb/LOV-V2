import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const DIFFICULTY_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  trivial:   { bg:"from-gray-900 to-gray-950",       border:"border-gray-700",    text:"text-gray-300",    badge:"bg-gray-700 text-gray-300" },
  easy:      { bg:"from-emerald-950 to-green-950",   border:"border-emerald-800", text:"text-emerald-300", badge:"bg-emerald-800 text-emerald-200" },
  medium:    { bg:"from-blue-950 to-indigo-950",     border:"border-blue-800",    text:"text-blue-300",    badge:"bg-blue-800 text-blue-200" },
  hard:      { bg:"from-orange-950 to-red-950",      border:"border-orange-700",  text:"text-orange-300",  badge:"bg-orange-700 text-orange-200" },
  legendary: { bg:"from-yellow-950 to-amber-950",    border:"border-yellow-600",  text:"text-yellow-300",  badge:"bg-yellow-700 text-yellow-200" },
};

const CATEGORY_ICON: Record<string, string> = {
  combat: "⚔️", progression: "📈", wealth: "💰", exploration: "🗺️", mastery: "🎯", fortune: "🍀",
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="text-xs text-gray-500">⏳ {remaining}</span>;
}

function ProgressBar({ current, required }: { current: number; required: number }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, required)) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{current.toLocaleString()} / {required.toLocaleString()}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-blue-600"}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RewardRow({ rewards }: { rewards: any }) {
  const items = [];
  if (rewards.gold > 0)           items.push({ icon:"💰", val:formatNumber(rewards.gold), label:"gold" });
  if (rewards.trainingPoints > 0) items.push({ icon:"📚", val:formatNumber(rewards.trainingPoints), label:"TP" });
  if (rewards.soulShards > 0)     items.push({ icon:"💎", val:rewards.soulShards, label:"shards" });
  if (rewards.focusedShards > 0)  items.push({ icon:"🔮", val:rewards.focusedShards, label:"focused" });
  if (rewards.runes > 0)          items.push({ icon:"🔰", val:rewards.runes, label:"runes" });
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-300">
          {it.icon} {it.val} <span className="text-gray-500">{it.label}</span>
        </span>
      ))}
      {rewards.bonus && (
        <span className="flex items-center gap-1 bg-amber-900/50 border border-amber-700 px-2 py-0.5 rounded text-xs text-amber-300">
          ⭐ {rewards.bonus}
        </span>
      )}
    </div>
  );
}

function QuestCard({ quest, onAccept, onComplete, onAbandon, mode }: {
  quest: any; onAccept?: () => void; onComplete?: () => void; onAbandon?: () => void; mode: "available" | "active" | "completed";
}) {
  const styles = DIFFICULTY_STYLES[quest.difficulty] ?? DIFFICULTY_STYLES.easy;
  const catIcon = CATEGORY_ICON[quest.category] ?? "📋";
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${styles.border} overflow-hidden`}>
      <div className={`px-4 py-3 bg-gradient-to-r ${styles.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span>{catIcon}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${styles.badge}`}>{quest.difficulty}</span>
              <span className="text-gray-500 text-xs capitalize">{quest.category}</span>
              {quest.timeLimit && <span className="text-gray-500 text-xs">⏱ {quest.timeLimit}h limit</span>}
              {quest.expiresAt && mode === "active" && <CountdownTimer expiresAt={quest.expiresAt} />}
            </div>
            <h3 className={`font-bold ${styles.text} text-sm leading-tight`}>{quest.title}</h3>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-gray-300 text-xs shrink-0 mt-1">
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {expanded && (
          <p className="text-gray-400 text-xs mt-2 leading-relaxed">{quest.description}</p>
        )}

        <div className={`text-xs mt-2 px-2 py-1.5 rounded-lg ${mode === "completed" && quest.progress?.complete ? "bg-emerald-950/50 text-emerald-300" : "bg-black/30 text-gray-300"}`}>
          <span className="font-medium">Objective: </span>{quest.objective?.description}
          {mode === "active" && quest.progress && (
            <ProgressBar current={quest.progress.current} required={quest.progress.required} />
          )}
          {mode === "completed" && quest.status === "completed" && <span className="ml-2 text-emerald-400">✓ Completed</span>}
          {mode === "completed" && quest.status === "abandoned" && <span className="ml-2 text-gray-500">✗ Abandoned</span>}
        </div>

        <RewardRow rewards={quest.rewards} />
      </div>

      {(onAccept || onComplete || onAbandon) && (
        <div className="flex gap-2 px-4 py-2 bg-black/40 border-t border-white/5">
          {onAccept && (
            <button onClick={onAccept}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 transition-colors text-white">
              Accept Quest
            </button>
          )}
          {onComplete && (
            <button onClick={onComplete}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors text-white ${quest.progress?.complete ? "bg-emerald-600 hover:bg-emerald-500" : "bg-gray-700 hover:bg-gray-600"}`}>
              {quest.progress?.complete ? "✓ Claim Reward" : "Check Progress"}
            </button>
          )}
          {onAbandon && (
            <button onClick={onAbandon}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 hover:bg-red-900 transition-colors text-gray-400 hover:text-red-300">
              Abandon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WorldEventCard({ event }: { event: any }) {
  const { typeId, title, description, effects, expiresAt } = event;
  const colors: Record<string, string> = {
    golden_surge: "from-yellow-950 to-amber-950 border-amber-700",
    shard_rain: "from-cyan-950 to-teal-950 border-cyan-700",
    training_surge: "from-blue-950 to-indigo-950 border-blue-700",
    monster_surge: "from-red-950 to-rose-950 border-red-700",
    pvp_frenzy: "from-orange-950 to-red-950 border-orange-700",
    arcane_blessing: "from-purple-950 to-violet-950 border-purple-700",
    fortune_smile: "from-emerald-950 to-green-950 border-emerald-700",
    warlord_march: "from-rose-950 to-pink-950 border-rose-700",
    stone_skin: "from-stone-950 to-gray-950 border-stone-700",
    rune_tide: "from-indigo-950 to-blue-950 border-indigo-700",
    blood_moon: "from-red-950 to-purple-950 border-red-700",
    celestial_tide: "from-amber-950 to-yellow-900 border-amber-600",
  };
  const colorClass = colors[typeId] ?? "from-gray-900 to-gray-950 border-gray-700";

  return (
    <div className={`rounded-xl border bg-gradient-to-br overflow-hidden ${colorClass}`}>
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{effects?.icon ?? "🌟"}</div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-base">{title}</h3>
            <p className="text-gray-400 text-xs mt-1">{description}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="px-3 py-1.5 bg-black/40 rounded-lg text-sm font-bold text-amber-300">
            {effects?.label ?? "Active Bonus"}
          </div>
          <CountdownTimer expiresAt={expiresAt} />
        </div>
      </div>
    </div>
  );
}

const TABS = ["Available", "Active", "Completed", "World Events"] as const;

export default function QuestBoard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<typeof TABS[number]>("Available");
  const [boardSeed, setBoardSeed] = useState(() => Date.now());

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: boardData, isLoading: loadingBoard, refetch: refetchBoard } = useQuery<{ quests: any[] }>({
    queryKey: [`/api/pcg/quest-board`, acctId, boardSeed],
    queryFn: () => fetch(`/api/pcg/quest-board?accountId=${acctId}&seed=${boardSeed}`).then(r => r.json()),
    enabled: !!acctId,
  });

  const { data: activeData, isLoading: loadingActive } = useQuery<{ quests: any[] }>({
    queryKey: [`/api/pcg/quests/active`, acctId],
    queryFn: () => fetch(`/api/pcg/quests/active?accountId=${acctId}`).then(r => r.json()),
    enabled: !!acctId,
    refetchInterval: 30000,
  });

  const { data: historyData } = useQuery<{ quests: any[] }>({
    queryKey: [`/api/pcg/quests/history`, acctId],
    queryFn: () => fetch(`/api/pcg/quests/history?accountId=${acctId}`).then(r => r.json()),
    enabled: !!acctId,
  });

  const { data: eventsData, isLoading: loadingEvents } = useQuery<{ events: any[] }>({
    queryKey: ["/api/pcg/world-events"],
    queryFn: () => fetch("/api/pcg/world-events").then(r => r.json()),
    refetchInterval: 60000,
  });

  const acceptMut = useMutation({
    mutationFn: (quest: any) => apiRequest("POST", "/api/pcg/quests/accept", { accountId: acctId, quest }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/pcg/quests/active`, acctId] });
      toast({ title: "Quest Accepted!", description: "Track your progress in the Active tab." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const completeMut = useMutation({
    mutationFn: (questId: string) => apiRequest("POST", `/api/pcg/quests/${questId}/complete`, { accountId: acctId }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: [`/api/pcg/quests/active`, acctId] });
      qc.invalidateQueries({ queryKey: [`/api/pcg/quests/history`, acctId] });
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
      if (data?.rewards) {
        const r = data.rewards;
        toast({
          title: "Quest Complete! 🎉",
          description: `Earned: ${r.gold?.toLocaleString()}g, ${r.trainingPoints} TP, ${r.soulShards} shards`,
        });
      }
    },
    onError: (e: any) => toast({ title: "Not Complete Yet", description: e.message, variant: "destructive" }),
  });

  const abandonMut = useMutation({
    mutationFn: (questId: string) => apiRequest("POST", `/api/pcg/quests/${questId}/abandon`, { accountId: acctId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/pcg/quests/active`, acctId] });
      toast({ title: "Quest Abandoned" });
    },
  });

  if (!account) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Please log in.</p>
    </div>
  );

  const board = boardData?.quests ?? [];
  const activeQuests = activeData?.quests ?? [];
  const history = historyData?.quests ?? [];
  const events = eventsData?.events ?? [];
  const activeEventCount = events.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-950 border-b border-emerald-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">📋</div>
            <div>
              <h1 className="text-2xl font-bold text-emerald-200">Quest Board</h1>
              <p className="text-emerald-400 text-sm">Procedurally generated challenges scaled to your progression</p>
            </div>
          </div>
          <div className="flex gap-2 text-right">
            {activeQuests.length > 0 && (
              <div className="bg-blue-800 text-blue-200 text-xs font-bold px-2 py-1 rounded-full">
                {activeQuests.length} Active
              </div>
            )}
            {activeEventCount > 0 && (
              <div className="bg-amber-700 text-amber-200 text-xs font-bold px-2 py-1 rounded-full">
                🌟 {activeEventCount} Event{activeEventCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Event Banner */}
      {activeEventCount > 0 && (
        <div className="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border-b border-amber-800 px-6 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto">
            <span className="text-amber-300 text-xs font-bold shrink-0">ACTIVE:</span>
            {events.map((e: any) => (
              <span key={e.id} className="text-xs text-amber-200 bg-amber-900/50 px-2 py-0.5 rounded-full shrink-0">
                {e.effects?.icon} {e.title}: {e.effects?.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 bg-gray-900 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t ? "bg-emerald-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
              {t === "Active" && activeQuests.length > 0 ? `${t} (${activeQuests.length})` : t}
              {t === "World Events" && activeEventCount > 0 ? ` (${activeEventCount})` : ""}
            </button>
          ))}
        </div>

        {/* ── Available ─────────────────────────────────────────────── */}
        {tab === "Available" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">6 quests generated for your current rank. Refresh anytime for new options.</p>
              <button onClick={() => { setBoardSeed(Date.now()); refetchBoard(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-800 hover:bg-emerald-700 transition-colors text-white shrink-0">
                🔄 Refresh Board
              </button>
            </div>
            {loadingBoard ? (
              <div className="text-center py-8 text-gray-500">Generating quests…</div>
            ) : board.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No quests available. Try refreshing.</div>
            ) : (
              board.map((q: any) => (
                <QuestCard key={q.id} quest={q} mode="available"
                  onAccept={() => acceptMut.mutate(q)} />
              ))
            )}
          </div>
        )}

        {/* ── Active ────────────────────────────────────────────────── */}
        {tab === "Active" && (
          <div className="space-y-3">
            {loadingActive ? (
              <div className="text-center py-8 text-gray-500">Loading active quests…</div>
            ) : activeQuests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No active quests. Accept some from the Available tab.</p>
              </div>
            ) : (
              activeQuests.map((q: any) => (
                <QuestCard key={q.id} quest={q} mode="active"
                  onComplete={() => completeMut.mutate(q.id)}
                  onAbandon={() => abandonMut.mutate(q.id)} />
              ))
            )}
          </div>
        )}

        {/* ── Completed ─────────────────────────────────────────────── */}
        {tab === "Completed" && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No completed quests yet.</div>
            ) : (
              history.map((q: any) => (
                <QuestCard key={q.id} quest={q} mode="completed" />
              ))
            )}
          </div>
        )}

        {/* ── World Events ──────────────────────────────────────────── */}
        {tab === "World Events" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">World events affect all players simultaneously. Check back often — new events start automatically every few hours.</p>
            {loadingEvents ? (
              <div className="text-center py-8 text-gray-500">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">🌙</p>
                <p className="text-gray-400 font-semibold">No Active Events</p>
                <p className="text-gray-500 text-sm mt-1">The realm is quiet for now. A new event will begin soon.</p>
              </div>
            ) : (
              events.map((e: any) => <WorldEventCard key={e.id} event={e} />)
            )}

            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 mt-4">
              <p className="text-gray-300 font-semibold text-sm mb-2">All Possible World Events</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {[
                  ["💰 Golden Surge","2× Gold for 4h"],
                  ["💎 Shard Rain","2.5× Shards for 3h"],
                  ["📚 Surge of Wisdom","1.8× XP/Training for 6h"],
                  ["🐉 Monster Surge","50% harder, 2× loot for 3h"],
                  ["⚔️ PvP Frenzy","2× PvP gold for 4h"],
                  ["🌌 Arcane Blessing","+50% skill damage for 2h"],
                  ["🍀 Fortune's Smile","+50 Luck, 1.5× Shards"],
                  ["🛡️ Warlord's March","+25% ATK for 3h"],
                  ["🪨 Stone Skin","+30% DEF, +20% HP for 4h"],
                  ["🔮 Rune Tide","3× Rune drops for 4h"],
                  ["🌑 Blood Moon","+40% ATK/-20% DEF for 2h"],
                  ["✨ Celestial Tide","1.5× Gold, Shards & TP for 2h"],
                ].map(([name, eff], i) => (
                  <div key={i} className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="font-medium text-gray-300">{name}</div>
                    <div className="text-gray-500">{eff}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
