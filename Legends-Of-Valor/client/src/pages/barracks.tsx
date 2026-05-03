import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SOLDIER_DEFS = [
  { id:"infantry",    name:"Infantry",       icon:"🗡️", role:"Tank / Anti-Cavalry",    desc:"Armored front-line fighters. Counter cavalry charges.",          goldCost:200,  upkeep:2,  trainingTimeSec:30,   counters:["cavalry"], weakTo:["archer"],   unlockLv:1, color:"from-slate-700 to-gray-800",    border:"border-slate-600" },
  { id:"archer",      name:"Archers",        icon:"🏹", role:"Ranged / Anti-Infantry",  desc:"Ranged attackers devastating against dense infantry formations.",  goldCost:300,  upkeep:3,  trainingTimeSec:45,   counters:["infantry"],weakTo:["cavalry"],  unlockLv:1, color:"from-green-900 to-emerald-950", border:"border-green-700" },
  { id:"cavalry",     name:"Cavalry",        icon:"🐴", role:"Fast / Anti-Archer",      desc:"Swift mounted warriors who smash archer lines.",                   goldCost:500,  upkeep:5,  trainingTimeSec:120,  counters:["archer"],  weakTo:["infantry"], unlockLv:2, color:"from-amber-900 to-yellow-950",  border:"border-amber-700" },
  { id:"siege",       name:"Siege Engines",  icon:"💣", role:"Structure Destroyer",     desc:"Catapults that devastate base defenses. Weak in open field.",      goldCost:1200, upkeep:12, trainingTimeSec:480,  counters:[],          weakTo:["infantry","cavalry"], unlockLv:3, color:"from-red-900 to-rose-950",   border:"border-red-700" },
  { id:"elite_guard", name:"Elite Guard",    icon:"⚔️", role:"Hero Unit / All-rounder", desc:"Your personal guard. Inherits your hero's racial combat bonuses.", goldCost:5000, upkeep:40, trainingTimeSec:1800, counters:[],          weakTo:[],           unlockLv:5, color:"from-violet-900 to-purple-950", border:"border-violet-700" },
] as const;

type SoldierType = typeof SOLDIER_DEFS[number]["id"];

function fmt(n: number) {
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000)     return (n/1e3).toFixed(1)+"K";
  return n.toLocaleString();
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "Ready!";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function calcTrainingMs(type: SoldierType, count: number, barracksLevel = 1): number {
  const def = SOLDIER_DEFS.find(d => d.id === type)!;
  const speedMult = barracksLevel >= 4 ? 0.6 : barracksLevel >= 3 ? 0.75 : barracksLevel >= 2 ? 0.88 : 1.0;
  return Math.floor(def.trainingTimeSec * count * speedMult) * 1000;
}

function RpsTag({ type, label }: { type: "beats"|"weak", label: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${type === "beats" ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700" : "bg-red-950/60 text-red-300 border border-red-800"}`}>
      {type === "beats" ? "✓" : "✗"} {label}
    </span>
  );
}

function TrainingTimer({ completesAt }: { completesAt: string }) {
  const [remaining, setRemaining] = useState(() => new Date(completesAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(new Date(completesAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [completesAt]);
  const pct = Math.max(0, Math.min(100, 100 - (remaining / (new Date(completesAt).getTime() - Date.now() + remaining)) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={remaining <= 0 ? "text-emerald-400 font-bold" : "text-amber-300"}>{remaining <= 0 ? "✅ Ready to collect" : `⏳ ${fmtDuration(remaining)}`}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000" style={{ width: `${remaining <= 0 ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

type Tab = "army" | "train" | "queue" | "raid" | "reports";

export default function Barracks() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("army");
  const [recruitAmounts, setRecruitAmounts] = useState<Record<SoldierType, number>>({
    infantry:10, archer:10, cavalry:5, siege:2, elite_guard:1,
  });
  const [expandedEnemy, setExpandedEnemy] = useState<string|null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: army = [], refetch: refetchArmy } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/army`],
    enabled: !!acctId,
  });

  const { data: trainingQueue = [], refetch: refetchQueue } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/army/training-queue`],
    queryFn: () => apiRequest("GET", `/api/accounts/${acctId}/army/training-queue`),
    enabled: !!acctId,
    refetchInterval: 5000,
  });

  const { data: raidTargets = [] } = useQuery<any[]>({
    queryKey: [`/api/army/raid-targets`, acctId],
    queryFn: () => apiRequest("GET", `/api/army/raid-targets?accountId=${acctId}`),
    enabled: !!acctId && tab === "raid",
  });

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/raid-history`],
    enabled: !!acctId && tab === "reports",
  });

  const recruitMut = useMutation({
    mutationFn: (vars: { type: SoldierType; count: number }) =>
      apiRequest("POST", `/api/accounts/${acctId}/army/recruit`, vars),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
      refetchArmy();
      refetchQueue();
      toast({ title: "Training started!", description: d.message });
      setTab("queue");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const trainMut = useMutation({
    mutationFn: (type: SoldierType) =>
      apiRequest("POST", `/api/accounts/${acctId}/army/train`, { type }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
      refetchArmy();
      toast({ title: "Training complete!", description: d.message });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const raidMut = useMutation({
    mutationFn: (defenderId: string) =>
      apiRequest("POST", `/api/army/raid`, { attackerId: acctId, defenderId }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
      refetchArmy();
      qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/raid-history`] });
      if (d.winner === "attacker") {
        toast({ title: "Victory!", description: `Raided successfully! +${fmt(d.goldLooted)} gold` });
      } else {
        toast({ title: "Defeat!", description: "Your army was repelled.", variant: "destructive" });
      }
      setTab("reports");
    },
    onError: (e: any) => toast({ title: "Raid failed", description: e.message, variant: "destructive" }),
  });

  if (!account) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Please log in.</p>
    </div>
  );

  const barracksLevel = (account.baseRoomLevels?.barracks) ?? 0;
  const totalTroops = army.reduce((s: number, t: any) => s + t.count, 0);
  const trainingCount = trainingQueue.reduce((s: number, j: any) => s + j.count, 0);
  const peaceShield = account.peaceShieldExpires ? new Date(account.peaceShieldExpires) > new Date() : false;
  const shieldRemaining = peaceShield
    ? Math.ceil((new Date(account.peaceShieldExpires).getTime() - Date.now()) / 60_000)
    : 0;

  function getTroop(type: SoldierType) {
    return army.find((t: any) => t.soldierType === type) ?? { count: 0, level: 1 };
  }

  function getHourlyUpkeep() {
    return army.reduce((s: number, t: any) => {
      const def = SOLDIER_DEFS.find(d => d.id === t.soldierType);
      return s + (def?.upkeep ?? 0) * t.count;
    }, 0);
  }

  function getTrainCost(type: SoldierType, level: number) {
    const base: Record<SoldierType, number> = { infantry:500, archer:750, cavalry:1200, siege:2000, elite_guard:8000 };
    const mult = level * level;
    return { gold: base[type] * mult, tp: Math.max(5, Math.round((base[type]/100) * mult)) };
  }

  // Hero stats for army bonus preview
  const stats = account.stats ?? {};
  const heroAtkBonus = (1 + (stats.Str ?? 10) / 300);
  const heroLuckBonus = (1 + (stats.Luck ?? 10) / 500);
  const totalHeroMult = heroAtkBonus * heroLuckBonus;

  const speedMult = barracksLevel >= 4 ? 0.6 : barracksLevel >= 3 ? 0.75 : barracksLevel >= 2 ? 0.88 : 1.0;
  const speedLabel = barracksLevel >= 4 ? "40% faster" : barracksLevel >= 3 ? "25% faster" : barracksLevel >= 2 ? "12% faster" : "Normal speed";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-blue-950 to-indigo-950 border-b border-indigo-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🏰</div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-200">Barracks</h1>
              <p className="text-indigo-400 text-sm">You are the Hero leading this army. Your stats power every battle.</p>
            </div>
          </div>
          <div className="text-right space-y-1 text-sm">
            <div className="flex gap-3 justify-end flex-wrap">
              <div className="bg-indigo-900/40 border border-indigo-700 rounded-lg px-3 py-1.5 text-center">
                <div className="text-2xl font-bold text-white">{totalTroops.toLocaleString()}</div>
                <div className="text-indigo-400 text-xs">Active troops</div>
              </div>
              {trainingCount > 0 && (
                <div className="bg-amber-900/40 border border-amber-700 rounded-lg px-3 py-1.5 text-center">
                  <div className="text-2xl font-bold text-amber-300">{trainingCount.toLocaleString()}</div>
                  <div className="text-amber-500 text-xs">In training</div>
                </div>
              )}
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5 text-center">
                <div className="text-lg font-bold text-yellow-400">{getHourlyUpkeep().toLocaleString()}g/hr</div>
                <div className="text-gray-500 text-xs">Upkeep cost</div>
              </div>
            </div>
            {peaceShield && <div className="text-xs text-blue-400">🛡️ Peace shield: {shieldRemaining}m left</div>}
            {barracksLevel === 0 && <div className="text-xs text-orange-400">⚠️ Build Barracks in your Base first</div>}
          </div>
        </div>

        {/* Hero bonus banner */}
        <div className="max-w-4xl mx-auto mt-4 bg-violet-950/40 border border-violet-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚔️</span>
            <div>
              <div className="font-bold text-violet-200">Hero Commands</div>
              <div className="text-violet-400 text-xs">Your equipped gear and stats amplify your army's power</div>
            </div>
          </div>
          <div className="flex gap-3 ml-auto flex-wrap text-xs">
            <div className="bg-violet-900/50 rounded px-2 py-1 text-violet-300">STR {stats.Str ?? 10} → <span className="text-white font-bold">+{((heroAtkBonus - 1)*100).toFixed(1)}% ATK</span></div>
            <div className="bg-violet-900/50 rounded px-2 py-1 text-violet-300">LCK {stats.Luck ?? 10} → <span className="text-white font-bold">+{((heroLuckBonus - 1)*100).toFixed(1)}% Hit</span></div>
            <div className="bg-emerald-900/50 rounded px-2 py-1 text-emerald-300">Total army bonus: <span className="text-white font-bold">{totalHeroMult.toFixed(3)}×</span></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl overflow-x-auto">
          {([
            ["army","🗡️ My Army"],
            ["queue","⏳ Training"],
            ["train","📈 Level Up"],
            ["raid","⚔️ Raid"],
            ["reports","📋 Reports"],
          ] as [Tab,string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap relative ${tab===t ? "bg-indigo-700 text-white shadow" : "text-gray-400 hover:text-gray-200"}`}>
              {label}
              {t === "queue" && trainingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-xs text-black flex items-center justify-center font-bold">{trainingQueue.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── MY ARMY TAB ──────────────────────────────────────────────────── */}
        {tab === "army" && (
          <div className="space-y-3">
            {barracksLevel === 0 && (
              <div className="bg-amber-950/30 border border-amber-700 rounded-xl p-5 text-center">
                <p className="text-3xl mb-2">🏗️</p>
                <p className="text-amber-200 font-bold">No Barracks built yet</p>
                <p className="text-gray-400 text-sm mt-1">Build or upgrade a Barracks in your Base (requires Tier 5+) to raise an army.</p>
              </div>
            )}

            {SOLDIER_DEFS.map(def => {
              const troop = getTroop(def.id);
              const locked = barracksLevel < def.unlockLv;
              const pendingJobs = trainingQueue.filter((j: any) => j.soldierType === def.id);
              const pendingCount = pendingJobs.reduce((s: number, j: any) => s + j.count, 0);
              const canRecruit = !locked && barracksLevel > 0;
              const amt = recruitAmounts[def.id];
              const previewMs = calcTrainingMs(def.id, amt, barracksLevel);
              const totalCost = def.goldCost * amt;
              const canAfford = (account.gold ?? 0) >= totalCost;

              return (
                <div key={def.id} className={`rounded-xl border ${def.border} overflow-hidden ${locked ? "opacity-50" : ""}`}>
                  <div className={`px-4 py-3 bg-gradient-to-r ${def.color} flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{def.icon}</span>
                      <div>
                        <div className="font-bold text-white">{def.name}</div>
                        <div className="text-gray-400 text-xs">{def.role}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-bold text-white">{troop.count.toLocaleString()}</div>
                      {pendingCount > 0 && <div className="text-amber-400 text-xs">+{pendingCount.toLocaleString()} training</div>}
                      <div className="text-gray-400 text-xs">Lv {troop.level} · {def.goldCost.toLocaleString()}g ea</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-black/20 border-t border-white/5">
                    <p className="text-gray-400 text-xs mb-2">{def.desc}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {def.counters.map(c => <RpsTag key={c} type="beats" label={c} />)}
                      {def.weakTo.map(c => <RpsTag key={c} type="weak" label={c} />)}
                      {def.id === "siege" && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300 border border-orange-700">2× vs Defenses</span>}
                      <span className="text-xs text-gray-600 ml-auto">{def.upkeep}g/hr upkeep ea</span>
                    </div>

                    {locked ? (
                      <p className="text-gray-600 text-xs">🔒 Requires Barracks level {def.unlockLv}</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setRecruitAmounts(p => ({ ...p, [def.id]: Math.max(1, p[def.id] - (p[def.id] >= 100 ? 50 : p[def.id] >= 10 ? 10 : 1)) }))} className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-sm font-bold">−</button>
                            <input
                              type="number" min={1}
                              value={recruitAmounts[def.id]}
                              onChange={e => setRecruitAmounts(p => ({ ...p, [def.id]: Math.max(1, parseInt(e.target.value)||1) }))}
                              className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-center"
                            />
                            <button onClick={() => setRecruitAmounts(p => ({ ...p, [def.id]: p[def.id] + (p[def.id] >= 100 ? 50 : p[def.id] >= 10 ? 10 : 1) }))} className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-sm font-bold">+</button>
                          </div>
                          <button
                            onClick={() => recruitMut.mutate({ type: def.id, count: amt })}
                            disabled={recruitMut.isPending || !canAfford || amt <= 0}
                            className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 transition-all">
                            {recruitMut.isPending ? "Queuing…" : `Train ${amt} (${fmt(totalCost)}g)`}
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>⏱ Training time: <span className="text-amber-400">{fmtDuration(previewMs)}</span></span>
                          <span className="text-indigo-400">{speedLabel}</span>
                        </div>
                        {!canAfford && <p className="text-red-400 text-xs">Need {fmt(totalCost - (account.gold ?? 0))}g more</p>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* RPS Legend */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 text-xs text-gray-400">
              <p className="font-bold text-gray-300 mb-2">⚔️ Rock-Paper-Scissors Combat</p>
              <div className="grid grid-cols-2 gap-1">
                <span>🗡️ Infantry beats 🐴 Cavalry</span>
                <span>🏹 Archers beat 🗡️ Infantry</span>
                <span>🐴 Cavalry beats 🏹 Archers</span>
                <span>💣 Siege destroys base defenses (2×)</span>
                <span className="col-span-2">⚔️ Elite Guard — no weakness, inherits your hero's racial combat bonus</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TRAINING QUEUE TAB ────────────────────────────────────────────── */}
        {tab === "queue" && (
          <div className="space-y-3">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 text-sm text-gray-400">
              <p className="font-bold text-gray-200 mb-1">⏳ Training Queue</p>
              <p>Gold is spent immediately when you start training. Troops are added to your army once training completes. This page refreshes automatically every 5 seconds.</p>
            </div>

            {trainingQueue.length === 0 ? (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-4xl mb-3">🏋️</p>
                <p className="text-white font-bold">No troops in training</p>
                <p className="text-gray-500 text-sm mt-1">Go to <button onClick={() => setTab("army")} className="text-indigo-400 underline">My Army</button> to recruit soldiers.</p>
              </div>
            ) : (
              trainingQueue.map((job: any) => {
                const def = SOLDIER_DEFS.find(d => d.id === job.soldierType);
                if (!def) return null;
                const totalMs = new Date(job.completesAt).getTime() - new Date(job.startedAt).getTime();
                const elapsed = Date.now() - new Date(job.startedAt).getTime();
                const pct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
                const remaining = Math.max(0, new Date(job.completesAt).getTime() - Date.now());
                return (
                  <div key={job.id} className={`rounded-xl border ${def.border} overflow-hidden`}>
                    <div className={`px-4 py-3 bg-gradient-to-r ${def.color} flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{def.icon}</span>
                        <div>
                          <div className="font-bold text-white">{def.name}</div>
                          <div className="text-gray-300 text-sm">Training {job.count.toLocaleString()} soldiers</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${remaining <= 0 ? "text-emerald-400" : "text-amber-300"}`}>
                          {remaining <= 0 ? "✅ Done" : fmtDuration(remaining)}
                        </div>
                        <div className="text-gray-400 text-xs">{Math.round(pct)}% complete</div>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="px-4 py-2 bg-black/20 text-xs text-gray-500 flex justify-between">
                      <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                      <span>Finishes: {new Date(job.completesAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}

            {trainingQueue.length > 0 && (
              <button
                onClick={() => { refetchArmy(); refetchQueue(); }}
                className="w-full py-2.5 rounded-xl border border-indigo-700 text-indigo-300 hover:bg-indigo-900/30 text-sm font-semibold transition-all">
                🔄 Refresh & collect ready troops
              </button>
            )}
          </div>
        )}

        {/* ── LEVEL UP TROOPS TAB ──────────────────────────────────────────── */}
        {tab === "train" && (
          <div className="space-y-3">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 text-sm text-gray-400 mb-2">
              Level up troop types to increase their ATK, DEF, and HP. All active units of that type benefit. Max level: 10.
            </div>
            {SOLDIER_DEFS.map(def => {
              const troop = getTroop(def.id);
              const locked = barracksLevel < def.unlockLv || troop.count === 0;
              const maxed = troop.level >= 10;
              const cost = getTrainCost(def.id, troop.level);
              const canAfford = (account.gold ?? 0) >= cost.gold && (account.trainingPoints ?? 0) >= cost.tp;
              const atkValues: Record<SoldierType, {base:number,perLv:number}> = {
                infantry:{base:18,perLv:4}, archer:{base:25,perLv:6}, cavalry:{base:30,perLv:7},
                siege:{base:12,perLv:3}, elite_guard:{base:45,perLv:10},
              };
              const av = atkValues[def.id];
              const atkNow = av.base + av.perLv * (troop.level - 1);
              const atkNext = troop.level < 10 ? atkNow + av.perLv : atkNow;
              return (
                <div key={def.id} className={`rounded-xl border ${def.border} overflow-hidden ${locked ? "opacity-40" : ""}`}>
                  <div className={`px-4 py-3 bg-gradient-to-r ${def.color} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{def.icon}</span>
                      <div>
                        <div className="font-bold text-white">{def.name}</div>
                        <div className="text-gray-400 text-xs">{troop.count.toLocaleString()} units · Level {troop.level}/10</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-300">ATK: <span className="text-white font-bold">{atkNow}</span>{!maxed && <span className="text-emerald-400"> → {atkNext}</span>}</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all" style={{ width: `${(troop.level/10)*100}%` }} />
                  </div>
                  <div className="px-4 py-3 bg-black/20 border-t border-white/5">
                    {locked ? (
                      <p className="text-xs text-gray-600">{troop.count === 0 ? "Recruit some troops first" : `Requires Barracks Lv ${def.unlockLv}`}</p>
                    ) : maxed ? (
                      <p className="text-xs text-emerald-400 font-bold">⭐ Max Level reached!</p>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                          Cost: <span className="text-yellow-400">{fmt(cost.gold)}g</span> + <span className="text-blue-400">{cost.tp} TP</span>
                        </div>
                        <button
                          onClick={() => trainMut.mutate(def.id)}
                          disabled={trainMut.isPending || !canAfford}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 transition-all">
                          {trainMut.isPending ? "Training…" : "↑ Level Up"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RAID TAB ─────────────────────────────────────────────────────── */}
        {tab === "raid" && (
          <div className="space-y-4">
            {totalTroops === 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-center">
                <p className="text-3xl mb-2">🪖</p>
                <p className="text-white font-bold">No troops to deploy</p>
                <p className="text-gray-500 text-sm mt-1">Recruit and train soldiers before launching a raid.</p>
              </div>
            )}
            {peaceShield && (
              <div className="bg-blue-950/40 border border-blue-700 rounded-xl p-4 text-center">
                <p className="text-blue-300 font-bold">🛡️ Peace shield active — {shieldRemaining}m remaining</p>
                <p className="text-gray-500 text-xs mt-1">You cannot raid while protected. Raiding also lifts your shield.</p>
              </div>
            )}
            {raidTargets.length === 0 && totalTroops > 0 && !peaceShield && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-white font-bold">No raid targets available</p>
                <p className="text-gray-500 text-sm mt-1">Other players near your rank without peace shields appear here.</p>
              </div>
            )}
            {raidTargets.map((target: any) => (
              <div key={target.id} className={`rounded-xl border ${expandedEnemy === target.id ? "border-red-600" : "border-gray-700"} bg-gray-900 overflow-hidden transition-all`}>
                <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedEnemy(expandedEnemy === target.id ? null : target.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-lg">
                      {target.race === "elf" ? "🧝" : target.race === "orc" ? "👹" : target.race === "dwarf" ? "⛏️" : "🧙"}
                    </div>
                    <div>
                      <div className="font-bold text-white">{target.username}</div>
                      <div className="text-gray-500 text-xs">{target.rank} · Tier {target.baseTier} Base</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-yellow-400 font-bold">{fmt(target.estimatedGold)}</div>
                    <div className="text-gray-500 text-xs">~est. loot</div>
                  </div>
                </div>
                {expandedEnemy === target.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-800 space-y-3">
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {SOLDIER_DEFS.map(def => {
                        const count = target.armySize?.[def.id] ?? 0;
                        return (
                          <div key={def.id} className="bg-gray-800 rounded p-2 text-center">
                            <div className="text-lg">{def.icon}</div>
                            <div className="text-white font-bold">{count}</div>
                            <div className="text-gray-500">{def.name}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-400">
                      Defense towers: <span className="text-white">Lv {target.defenseLevel}</span> · Total soldiers: <span className="text-white">{Object.values(target.armySize ?? {}).reduce((a: number, b: any) => a + b, 0)}</span>
                    </div>
                    <button
                      onClick={() => raidMut.mutate(target.id)}
                      disabled={raidMut.isPending || totalTroops === 0 || peaceShield}
                      className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-red-800 to-rose-800 hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-40">
                      {raidMut.isPending ? "Marching…" : `⚔️ Raid ${target.username}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── BATTLE REPORTS TAB ───────────────────────────────────────────── */}
        {tab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-white font-bold">No battle reports yet</p>
                <p className="text-gray-500 text-sm mt-1">Reports appear here after you attack or are attacked.</p>
              </div>
            )}
            {reports.map((r: any) => {
              const isAttacker = r.attackerId === acctId;
              const won = (isAttacker && r.winner === "attacker") || (!isAttacker && r.winner === "defender");
              return (
                <div key={r.id} className={`rounded-xl border overflow-hidden ${won ? "border-emerald-700 bg-emerald-950/20" : "border-red-800 bg-red-950/20"}`}>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{won ? "🏆" : "💀"}</span>
                      <div>
                        <div className={`font-bold ${won ? "text-emerald-300" : "text-red-300"}`}>
                          {isAttacker ? `You raided ${r.defenderUsername}` : `${r.attackerUsername} raided you`}
                        </div>
                        <div className="text-gray-500 text-xs">{new Date(r.startedAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${r.goldLooted > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                        {isAttacker ? (r.winner === "attacker" ? `+${fmt(r.goldLooted)}g` : "No loot") : (r.winner === "attacker" ? `-${fmt(r.goldLooted)}g` : "Defended!")}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 space-y-1">
                    {(r.events ?? []).map((ev: any, i: number) => (
                      <p key={i} className="text-xs text-gray-400 bg-gray-900/40 rounded px-2 py-1">{ev.message}</p>
                    ))}
                    {r.baseDamageDealt > 0 && (
                      <p className="text-xs text-orange-400 bg-orange-950/20 rounded px-2 py-1">💣 Base structure damage: {r.baseDamageDealt}%</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
