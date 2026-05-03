import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SOLDIER_DEFS = [
  { id:"infantry",    name:"Infantry",       icon:"🗡️", role:"Tank / Anti-Cavalry",   desc:"Armored front-line fighters. Counter cavalry charges.",           goldCost:200,  upkeep:2,  counters:["cavalry"], weakTo:["archer"],   unlockLv:1, color:"from-slate-700 to-gray-800",   border:"border-slate-600" },
  { id:"archer",      name:"Archers",        icon:"🏹", role:"Ranged / Anti-Infantry", desc:"Ranged attackers devastating against dense infantry formations.",   goldCost:300,  upkeep:3,  counters:["infantry"],weakTo:["cavalry"],  unlockLv:1, color:"from-green-900 to-emerald-950", border:"border-green-700" },
  { id:"cavalry",     name:"Cavalry",        icon:"🐴", role:"Fast / Anti-Archer",     desc:"Swift mounted warriors who smash archer lines.",                    goldCost:500,  upkeep:5,  counters:["archer"],  weakTo:["infantry"], unlockLv:2, color:"from-amber-900 to-yellow-950",  border:"border-amber-700" },
  { id:"siege",       name:"Siege Engines",  icon:"💣", role:"Structure Destroyer",    desc:"Catapults that devastate base defenses. Weak in open field.",       goldCost:1200, upkeep:12, counters:[],          weakTo:["infantry","cavalry"], unlockLv:3, color:"from-red-900 to-rose-950", border:"border-red-700" },
  { id:"elite_guard", name:"Elite Guard",    icon:"⚔️", role:"Hero Unit / All-rounder","desc":"Your personal guard inheriting your racial bonuses. Max 50.",     goldCost:5000, upkeep:40, counters:[],          weakTo:[],           unlockLv:5, color:"from-violet-900 to-purple-950", border:"border-violet-700" },
] as const;

type SoldierType = typeof SOLDIER_DEFS[number]["id"];

function fmt(n: number) {
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000)     return (n/1e3).toFixed(0)+"K";
  return n.toLocaleString();
}

function RpsTag({ type, label }: { type: "beats"|"weak", label: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${type === "beats" ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700" : "bg-red-950/60 text-red-300 border border-red-800"}`}>
      {type === "beats" ? "✓" : "✗"} {label}
    </span>
  );
}

type Tab = "army" | "train" | "raid" | "reports";

export default function Barracks() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("army");
  const [recruitAmounts, setRecruitAmounts] = useState<Record<SoldierType, number>>({
    infantry:1, archer:1, cavalry:1, siege:1, elite_guard:1,
  });
  const [expandedEnemy, setExpandedEnemy] = useState<string|null>(null);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: army = [], refetch: refetchArmy } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/army`],
    enabled: !!acctId,
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
      toast({ title: `Recruited!`, description: d.message });
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
  const armyCap = barracksLevel > 0 ? [0,60,120,200,300,400][Math.min(barracksLevel, 5)] : 0;
  const totalTroops = army.reduce((s: number, t: any) => s + t.count, 0);
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-blue-950 to-indigo-950 border-b border-indigo-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🏰</div>
            <div>
              <h1 className="text-2xl font-bold text-indigo-200">Barracks</h1>
              <p className="text-indigo-400 text-sm">Raise an army. Raid your enemies. Conquer their gold.</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div>
              <span className="text-xs text-gray-500">Troops </span>
              <span className={`font-bold ${totalTroops >= armyCap ? "text-red-400" : "text-white"}`}>{totalTroops}</span>
              <span className="text-gray-500"> / {armyCap}</span>
            </div>
            <div className="text-xs text-yellow-400">⚔️ Upkeep: {getHourlyUpkeep().toLocaleString()} g/hr</div>
            {peaceShield && (
              <div className="text-xs text-blue-400">🛡️ Peace shield: {shieldRemaining}m left</div>
            )}
            {barracksLevel === 0 && (
              <div className="text-xs text-orange-400">⚠️ Build Barracks in your Base first</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl">
          {([
            ["army","🗡️ My Army"],
            ["train","📈 Train Troops"],
            ["raid","⚔️ Launch Raid"],
            ["reports","📋 Battle Reports"],
          ] as [Tab,string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${tab===t ? "bg-indigo-700 text-white shadow" : "text-gray-400 hover:text-gray-200"}`}>
              {label}
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
              const isFull = totalTroops >= armyCap;
              const isEliteMax = def.id === "elite_guard" && troop.count >= 50;
              const maxCanBuy = Math.min(
                recruitAmounts[def.id],
                armyCap - totalTroops,
                def.id === "elite_guard" ? Math.max(0, 50 - troop.count) : 9999,
              );
              const totalCost = def.goldCost * maxCanBuy;

              return (
                <div key={def.id} className={`rounded-xl border ${def.border} overflow-hidden ${locked ? "opacity-50" : ""}`}>
                  <div className={`px-4 py-3 bg-gradient-to-r ${def.color} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{def.icon}</span>
                      <div>
                        <div className="font-bold text-white">{def.name}</div>
                        <div className="text-gray-400 text-xs">{def.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{troop.count.toLocaleString()}</div>
                      <div className="text-gray-400 text-xs">Lv {troop.level} · {def.goldCost.toLocaleString()}g ea</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-black/20 border-t border-white/5">
                    <p className="text-gray-400 text-xs mb-2">{def.desc}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {def.counters.map(c => <RpsTag key={c} type="beats" label={c} />)}
                      {def.weakTo.map(c => <RpsTag key={c} type="weak" label={c} />)}
                      {def.id === "siege" && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300 border border-orange-700">2× vs Defenses</span>}
                      <span className="text-xs text-gray-600 ml-auto">{def.upkeep}g/hr upkeep</span>
                    </div>
                    {locked ? (
                      <p className="text-gray-600 text-xs">Requires Barracks level {def.unlockLv}</p>
                    ) : isEliteMax ? (
                      <p className="text-gray-500 text-xs">Elite Guard capped at 50 units</p>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number" min={1} max={999}
                          value={recruitAmounts[def.id]}
                          onChange={e => setRecruitAmounts(p => ({ ...p, [def.id]: Math.max(1, parseInt(e.target.value)||1) }))}
                          className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-center"
                        />
                        <button
                          onClick={() => recruitMut.mutate({ type: def.id, count: maxCanBuy })}
                          disabled={recruitMut.isPending || isFull || maxCanBuy <= 0 || (account.gold ?? 0) < totalCost}
                          className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 transition-all">
                          {recruitMut.isPending ? "Recruiting…" : `Recruit ${maxCanBuy > 0 ? maxCanBuy : 0} (${fmt(totalCost)}g)`}
                        </button>
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
                <span className="col-span-2">⚔️ Elite Guard — no weakness, inherits your racial combat bonus</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TRAIN TROOPS TAB ─────────────────────────────────────────────── */}
        {tab === "train" && (
          <div className="space-y-3">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 text-sm text-gray-400 mb-2">
              Level up troop types to increase their ATK, DEF, and HP. All troop units of that type benefit. Max level: 10.
            </div>
            {SOLDIER_DEFS.map(def => {
              const troop = getTroop(def.id);
              const locked = barracksLevel < def.unlockLv || troop.count === 0;
              const maxed = troop.level >= 10;
              const cost = getTrainCost(def.id, troop.level);
              const canAfford = (account.gold ?? 0) >= cost.gold && (account.trainingPoints ?? 0) >= cost.tp;
              const atkNow = def.id === "infantry" ? 18 + 4*(troop.level-1) : def.id === "archer" ? 25 + 6*(troop.level-1) : def.id === "cavalry" ? 30+7*(troop.level-1) : def.id === "siege" ? 12+3*(troop.level-1) : 45+10*(troop.level-1);
              const atkNext = troop.level < 10 ? atkNow + (def.id === "infantry" ? 4 : def.id === "archer" ? 6 : def.id === "cavalry" ? 7 : def.id === "siege" ? 3 : 10) : atkNow;
              return (
                <div key={def.id} className={`rounded-xl border ${def.border} overflow-hidden ${locked ? "opacity-40" : ""}`}>
                  <div className={`px-4 py-3 bg-gradient-to-r ${def.color} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{def.icon}</span>
                      <div>
                        <div className="font-bold text-white">{def.name}</div>
                        <div className="text-gray-400 text-xs">{troop.count} units · Level {troop.level}/10</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-300">ATK: <span className="text-white font-bold">{atkNow}</span>{!maxed && <span className="text-emerald-400"> → {atkNext}</span>}</div>
                    </div>
                  </div>
                  {/* Level bar */}
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
                          {trainMut.isPending ? "Training…" : `↑ Level Up`}
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
                <p className="text-gray-500 text-sm mt-1">Recruit soldiers first before launching a raid.</p>
              </div>
            )}
            {peaceShield && (
              <div className="bg-blue-950/40 border border-blue-700 rounded-xl p-4 text-center">
                <p className="text-blue-300 font-bold">🛡️ You are under a peace shield for {shieldRemaining} more minutes</p>
                <p className="text-gray-500 text-xs mt-1">You cannot raid while protected — your peace shield also prevents incoming raids.</p>
              </div>
            )}
            {raidTargets.length === 0 && totalTroops > 0 && !peaceShield && (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-white font-bold">No raid targets available</p>
                <p className="text-gray-500 text-sm mt-1">Other players near your rank who aren't under peace shields will appear here.</p>
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
                    <div className="text-gray-500 text-xs">~est. gold</div>
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
                        <div className="text-gray-500 text-xs">
                          {new Date(r.startedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${r.goldLooted > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                        {isAttacker ? (r.winner === "attacker" ? `+${fmt(r.goldLooted)}g` : "No loot") : (r.winner === "attacker" ? `-${fmt(r.goldLooted)}g` : "Defended!")}
                      </div>
                    </div>
                  </div>
                  {/* Battle events */}
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
