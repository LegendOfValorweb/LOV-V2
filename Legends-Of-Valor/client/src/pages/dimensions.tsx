import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Static dimension definitions (mirrors server) ────────────────────────────
const DIMENSIONS = [
  {
    id:"void",         name:"The Void",           subtitle:"Where gravity means nothing and shadows eat light",
    icon:"🌑", color:"from-slate-900 to-indigo-950", border:"border-indigo-700", text:"text-indigo-300",
    minRank:"Novice", rules:["⚫ Void Gravity — Speed halved, enemy Def ×1.5, your Str +30%","🚫 Unstable Ground — Defend action disabled"],
    reward:{ currency:"Void Crystal", icon:"💠", goldMult:"1.5×", shardMult:"2.0×" },
  },
  {
    id:"inferno",      name:"Inferno Realm",       subtitle:"Every breath burns, every wound ignites",
    icon:"🔥", color:"from-red-950 to-orange-950", border:"border-red-700", text:"text-red-300",
    minRank:"Expert", rules:["🔥 Eternal Flame — every hit applies 2-round burn","💔 Cauterized Wounds — healing halved"],
    reward:{ currency:"Ember Shard", icon:"🔴", goldMult:"2.0×", shardMult:"1.5×" },
  },
  {
    id:"temporal",     name:"Temporal Rift",        subtitle:"The past and future collapse into a single lethal moment",
    icon:"⏳", color:"from-amber-950 to-yellow-950", border:"border-amber-700", text:"text-amber-300",
    minRank:"Master", rules:["⏳ Temporal Escalation — enemy gains +12% ATK per 3 rounds. End fights fast."],
    reward:{ currency:"Chrono Fragment", icon:"⌚", goldMult:"1.8×", shardMult:"1.8×" },
  },
  {
    id:"crystal",      name:"Crystal Labyrinth",    subtitle:"Physical force shatters against pure crystal — only magic prevails",
    icon:"💎", color:"from-cyan-950 to-teal-950", border:"border-cyan-700", text:"text-cyan-300",
    minRank:"Grandmaster", rules:["💎 Crystal Shell — physical attacks deal 0 damage. Skills only.","💧 Mana Drain — all skills cost double mana"],
    reward:{ currency:"Crystal Essence", icon:"🔷", goldMult:"2.2×", shardMult:"2.0×" },
  },
  {
    id:"shadow_mirror", name:"Shadow Mirror",       subtitle:"Face the darkest reflection of yourself",
    icon:"🪞", color:"from-gray-900 to-zinc-950", border:"border-gray-600", text:"text-gray-300",
    minRank:"Champion", rules:["🪞 Perfect Reflection — enemies mirror your own stats (80-120%)"],
    reward:{ currency:"Mirror Shard", icon:"🔘", goldMult:"2.5×", shardMult:"2.5×" },
  },
  {
    id:"celestial",    name:"Celestial Plane",      subtitle:"Holy ground where brute force is blasphemy",
    icon:"✨", color:"from-yellow-950 to-amber-950", border:"border-yellow-600", text:"text-yellow-300",
    minRank:"Overlord", rules:["✨ Holy Inversion — regular attacks HEAL enemy 30%. Use skills."],
    reward:{ currency:"Stardust", icon:"⭐", goldMult:"2.8×", shardMult:"3.0×" },
  },
  {
    id:"corruption",   name:"Corruption Abyss",     subtitle:"Chaos reigns — even your own skills may betray you",
    icon:"☠️", color:"from-purple-950 to-pink-950", border:"border-purple-700", text:"text-purple-300",
    minRank:"Ascendant", rules:["☠️ Chaos Backfire — 35% chance every skill hits YOU instead"],
    reward:{ currency:"Corruption Essence", icon:"🟣", goldMult:"3.5×", shardMult:"4.0×" },
  },
];

function fmt(n: number) {
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000)     return (n/1e3).toFixed(0)+"K";
  return n.toLocaleString();
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type Tab = "portals" | "library" | "run";

export default function Dimensions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("portals");
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [replayIdx, setReplayIdx] = useState(0);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (replayTimer.current) clearInterval(replayTimer.current); }, []);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: portals = [], refetch: refetchPortals } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/portals`],
    enabled: !!acctId,
  });

  const { data: activeRun, refetch: refetchRun } = useQuery<any>({
    queryKey: [`/api/dimension-runs/${activeRunId}`],
    enabled: !!activeRunId,
  });

  const scanMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/accounts/${acctId}/portals/scan`),
    onSuccess: (d: any) => {
      refetchPortals();
      if (d.found) {
        toast({ title: `🌀 Portal Opened!`, description: `A rift to ${d.dimensionName} has appeared!` });
      } else {
        toast({ title: "No portal found", description: "The dimensional fabric is still this time. Try again later.", variant: "default" });
      }
    },
  });

  const forceMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/accounts/${acctId}/portals/force`, {}),
    onSuccess: (d: any) => {
      refetchPortals();
      toast({ title: `🌀 Portal Forced Open!`, description: `A rift to ${d.dimensionName} has appeared! (500 runes spent)` });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const enterMut = useMutation({
    mutationFn: (portalId: string) =>
      apiRequest("POST", `/api/portals/${portalId}/enter`, { accountId: acctId }),
    onSuccess: (d: any) => {
      setActiveRunId(d.runId);
      setTab("run");
      setReplayIdx(0);
      qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/portals`] });
    },
    onError: (e: any) => toast({ title: "Failed to enter portal", description: e.message, variant: "destructive" }),
  });

  const fightMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/dimension-runs/${activeRunId}/next`, { accountId: acctId }),
    onSuccess: (d: any) => {
      refetchRun();
      setReplayIdx(0);
      startReplay(d.events?.length ?? 0);
      if (d.status === "completed") {
        qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
        toast({ title: "Run Complete!", description: `You cleared the dimension! +${fmt(d.totalGold)} gold, +${d.totalShards} shards` });
      } else if (d.status === "failed") {
        qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
        toast({ title: "Defeated!", description: "You were overcome. Better luck next time.", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fleeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/dimension-runs/${activeRunId}/flee`, { accountId: acctId }),
    onSuccess: (d: any) => {
      refetchRun();
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
      toast({ title: "Fled!", description: `Escaped with ${fmt(d.goldKept)} gold and ${d.shardsKept} shards.` });
    },
  });

  function startReplay(total: number) {
    setReplayIdx(0);
    let idx = 0;
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = setInterval(() => {
      idx++;
      setReplayIdx(idx);
      if (idx >= total) clearInterval(replayTimer.current!);
    }, 300);
  }

  if (!account) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Please log in.</p>
    </div>
  );

  const currentEncounterResult = activeRun?.encounterResults?.[activeRun.currentEncounter - 1];
  const runDim = DIMENSIONS.find(d => d.id === activeRun?.dimensionId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-950 via-purple-950 to-violet-950 border-b border-purple-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🌀</div>
            <div>
              <h1 className="text-2xl font-bold text-violet-200">Alternate Dimensions</h1>
              <p className="text-violet-400 text-sm">Rare portals to realms with warped rules, fearsome enemies, and unique rewards</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-yellow-400 font-bold">{(account.runes ?? 0).toLocaleString()}</div>
            <div className="text-gray-500 text-xs">Runes (force-open cost: 500)</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl">
          {([
            ["portals","🌀 Portals"],
            ["library","📖 Dimension Library"],
            ...(activeRunId && activeRun?.status === "active" ? [["run","⚔️ Active Run"]] : []),
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${tab === t ? "bg-violet-700 text-white shadow" : "text-gray-400 hover:text-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PORTALS TAB ─────────────────────────────────────────────────── */}
        {tab === "portals" && (
          <div className="space-y-4">
            {/* Scan controls */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="font-bold text-lg text-violet-300 mb-3">Open a Portal</h2>
              <p className="text-gray-400 text-sm mb-4">
                Dimensional rifts appear randomly (6% chance per scan). If the fabric resists, force one open for 500 runes.
              </p>
              <div className="flex gap-3">
                <button onClick={() => scanMut.mutate()} disabled={scanMut.isPending}
                  className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-violet-700 to-purple-700 hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50">
                  {scanMut.isPending ? "Scanning…" : "🔍 Scan for Portal"}
                </button>
                <button onClick={() => forceMut.mutate()} disabled={forceMut.isPending || (account.runes ?? 0) < 500}
                  className="flex-1 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 transition-all disabled:opacity-40">
                  {forceMut.isPending ? "Opening…" : "💫 Force Open (500 runes)"}
                </button>
              </div>
            </div>

            {/* Active portals */}
            {portals.length === 0 ? (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-5xl mb-3">🌑</p>
                <p className="text-gray-300 font-semibold">No active portals</p>
                <p className="text-gray-500 text-sm mt-1">Scan for one or force it open. Portals expire in 24 hours.</p>
              </div>
            ) : (
              portals.map((portal: any) => {
                const dim = DIMENSIONS.find(d => d.id === portal.dimensionId);
                if (!dim) return null;
                return (
                  <div key={portal.id} className={`rounded-xl border ${dim.border} overflow-hidden`}>
                    <div className={`px-5 py-4 bg-gradient-to-r ${dim.color} flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{dim.icon}</span>
                        <div>
                          <div className={`font-bold text-lg ${dim.text}`}>{dim.name}</div>
                          <div className="text-gray-400 text-sm">{dim.subtitle}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-orange-300 font-bold text-sm">⏱ {timeLeft(portal.expiresAt)}</div>
                        <div className="text-gray-500 text-xs">{portal.usesLeft} use{portal.usesLeft !== 1 ? "s" : ""} left</div>
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-black/30 border-t border-white/5">
                      <div className="flex flex-wrap gap-2 mb-3 text-xs">
                        {dim.rules.map((r, i) => (
                          <span key={i} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-gray-300">{r}</span>
                        ))}
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400 mb-3">
                        <span>{dim.reward.icon} {dim.reward.currency}</span>
                        <span>💰 {dim.reward.goldMult} gold</span>
                        <span>💎 {dim.reward.shardMult} shards</span>
                      </div>
                      <button
                        onClick={() => { enterMut.mutate(portal.id); }}
                        disabled={enterMut.isPending}
                        className={`w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r ${dim.color} border ${dim.border} hover:opacity-80 transition-all disabled:opacity-50`}>
                        {enterMut.isPending ? "Entering…" : `⚔️ Enter ${dim.name}`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── LIBRARY TAB ──────────────────────────────────────────────────── */}
        {tab === "library" && (
          <div className="space-y-3">
            {DIMENSIONS.map(dim => (
              <div key={dim.id} className={`rounded-xl border ${dim.border} overflow-hidden cursor-pointer`}
                onClick={() => setExpandedDim(expandedDim === dim.id ? null : dim.id)}>
                <div className={`px-5 py-4 bg-gradient-to-r ${dim.color} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{dim.icon}</span>
                    <div>
                      <div className={`font-bold ${dim.text}`}>{dim.name}</div>
                      <div className="text-gray-400 text-sm">{dim.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">Min: <span className="text-white">{dim.minRank}</span></span>
                    <span className="text-gray-500">{expandedDim === dim.id ? "▲" : "▼"}</span>
                  </div>
                </div>
                {expandedDim === dim.id && (
                  <div className="px-5 py-4 bg-black/30 border-t border-white/5 space-y-3">
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Dimension Rules</p>
                      <div className="space-y-1">
                        {dim.rules.map((r, i) => (
                          <div key={i} className="bg-gray-800/60 rounded px-3 py-2 text-sm text-gray-200">{r}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Special Currency</p>
                        <span className={`font-bold ${dim.text}`}>{dim.reward.icon} {dim.reward.currency}</span>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Gold Multiplier</p>
                        <span className="text-yellow-400 font-bold">{dim.reward.goldMult}</span>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Shard Multiplier</p>
                        <span className="text-blue-400 font-bold">{dim.reward.shardMult}</span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs">5 encounters: 3 enemies · 1 mini-boss · 1 dimensional boss</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ACTIVE RUN TAB ────────────────────────────────────────────────── */}
        {tab === "run" && activeRun && (
          <div className="space-y-4">
            {/* Run header */}
            <div className={`rounded-xl border ${runDim?.border ?? "border-gray-700"} overflow-hidden`}>
              <div className={`px-5 py-4 bg-gradient-to-r ${runDim?.color ?? "from-gray-900 to-gray-800"} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{runDim?.icon ?? "🌀"}</span>
                  <div>
                    <div className={`font-bold text-lg ${runDim?.text ?? "text-white"}`}>{runDim?.name ?? "Dimension"}</div>
                    <div className="text-gray-400 text-sm">
                      {activeRun.status === "completed" ? "Run complete!" :
                       activeRun.status === "failed" ? "Defeated!" :
                       activeRun.status === "fled" ? "Fled!" :
                       `Encounter ${activeRun.currentEncounter} / ${activeRun.totalEncounters}`}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-yellow-400 font-bold">{fmt(activeRun.goldEarned)}</div>
                  <div className="text-blue-400 text-xs">{activeRun.shardEarned} shards</div>
                </div>
              </div>

              {/* Encounter progress dots */}
              <div className="px-5 py-3 bg-black/30 border-t border-white/5 flex gap-2 items-center">
                <span className="text-gray-500 text-xs mr-2">Progress:</span>
                {Array.from({ length: activeRun.totalEncounters }).map((_, i) => {
                  const res = activeRun.encounterResults?.[i];
                  const isDone = i < activeRun.currentEncounter;
                  const isCurrent = i === activeRun.currentEncounter - 1;
                  const isBoss = i === 4;
                  const isMini = i === 3;
                  return (
                    <div key={i} className={`relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      isDone && res?.winner === "player" ? "bg-emerald-700 border-emerald-500 text-white" :
                      isDone && res?.winner === "enemy"  ? "bg-red-900 border-red-600 text-white" :
                      isCurrent ? "bg-violet-700 border-violet-400 text-white animate-pulse" :
                      "bg-gray-800 border-gray-600 text-gray-500"
                    }`}>
                      {isBoss ? "👑" : isMini ? "⚡" : i + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current encounter result */}
            {currentEncounterResult && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                <div className={`px-4 py-3 flex items-center justify-between ${currentEncounterResult.winner === "player" ? "bg-emerald-950/50" : "bg-red-950/50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{currentEncounterResult.winner === "player" ? "🏆" : "💀"}</span>
                    <div>
                      <div className={`font-bold ${currentEncounterResult.winner === "player" ? "text-emerald-300" : "text-red-300"}`}>
                        {currentEncounterResult.winner === "player"
                          ? `Defeated ${currentEncounterResult.enemyName}!`
                          : `Defeated by ${currentEncounterResult.enemyName}`}
                      </div>
                      <div className="text-gray-400 text-xs">{currentEncounterResult.rounds} rounds · +{fmt(currentEncounterResult.goldEarned)} gold</div>
                    </div>
                  </div>
                  {/* HP bars */}
                  <div className="text-right text-xs text-gray-400">
                    <div>HP: {Math.max(0, currentEncounterResult.playerHpRemaining)} / {currentEncounterResult.playerMaxHp}</div>
                  </div>
                </div>
                {/* Battle log replay */}
                <div className="px-4 py-3 max-h-48 overflow-y-auto space-y-1">
                  {(currentEncounterResult.events ?? []).slice(0, replayIdx + 1).map((ev: any, i: number) => (
                    <div key={i} className={`text-xs px-2.5 py-1 rounded flex gap-2 ${
                      ev.actor === "player"
                        ? ev.backfire ? "bg-red-950/40 text-red-300" : "bg-emerald-950/30 text-emerald-300"
                        : ev.action === "dot" ? "bg-orange-950/30 text-orange-300" : "bg-red-950/20 text-red-300"
                    }`}>
                      <span className="text-gray-600 shrink-0">R{ev.round}</span>
                      <span>{ev.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {activeRun.status === "active" && (
              <div className="flex gap-3">
                {activeRun.currentEncounter < activeRun.totalEncounters && currentEncounterResult?.winner === "player" && (
                  <button onClick={() => fightMut.mutate()} disabled={fightMut.isPending}
                    className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-violet-700 to-purple-700 hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50">
                    {fightMut.isPending ? "Fighting…" : `⚔️ Next Encounter →`}
                  </button>
                )}
                {!currentEncounterResult && activeRun.currentEncounter === 0 && (
                  <button onClick={() => fightMut.mutate()} disabled={fightMut.isPending}
                    className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-violet-700 to-purple-700 hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50">
                    {fightMut.isPending ? "Entering…" : "⚔️ Begin First Encounter"}
                  </button>
                )}
                {activeRun.currentEncounter > 0 && currentEncounterResult?.winner === "player" && (
                  <button onClick={() => fleeMut.mutate()} disabled={fleeMut.isPending}
                    className="px-5 py-3 rounded-xl font-semibold bg-gray-700 hover:bg-gray-600 transition-all disabled:opacity-50 text-sm">
                    🏃 Flee (+{fmt(activeRun.goldEarned)})
                  </button>
                )}
              </div>
            )}

            {/* Run complete / failed */}
            {(activeRun.status === "completed" || activeRun.status === "failed" || activeRun.status === "fled") && (
              <div className={`rounded-xl border p-6 text-center ${
                activeRun.status === "completed" ? "border-emerald-600 bg-emerald-950/40" :
                activeRun.status === "fled"       ? "border-yellow-600 bg-yellow-950/30" :
                                                    "border-red-600 bg-red-950/30"
              }`}>
                <div className="text-5xl mb-3">
                  {activeRun.status === "completed" ? "🏆" : activeRun.status === "fled" ? "🏃" : "💀"}
                </div>
                <div className={`text-xl font-bold mb-2 ${
                  activeRun.status === "completed" ? "text-emerald-300" :
                  activeRun.status === "fled"      ? "text-yellow-300" : "text-red-300"
                }`}>
                  {activeRun.status === "completed" ? "Dimension Cleared!" :
                   activeRun.status === "fled"       ? "You escaped safely" : "Defeated in the Dimension"}
                </div>
                <div className="flex justify-center gap-6 text-sm">
                  <div><div className="text-yellow-400 font-bold text-xl">{fmt(activeRun.goldEarned)}</div><div className="text-gray-500 text-xs">gold earned</div></div>
                  <div><div className="text-blue-400 font-bold text-xl">{activeRun.shardEarned}</div><div className="text-gray-500 text-xs">shards earned</div></div>
                </div>
                <button onClick={() => { setActiveRunId(null); setTab("portals"); refetchPortals(); }}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-all">
                  ← Back to Portals
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
