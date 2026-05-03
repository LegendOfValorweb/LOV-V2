import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-300 border-gray-500",
  uncommon: "text-green-400 border-green-600",
  rare: "text-blue-400 border-blue-500",
  epic: "text-purple-400 border-purple-500",
  legendary: "text-amber-400 border-amber-500",
  mythic: "text-pink-400 border-pink-500",
};

const RARITY_BG: Record<string, string> = {
  common: "bg-gray-800",
  uncommon: "bg-green-900/30",
  rare: "bg-blue-900/30",
  epic: "bg-purple-900/30",
  legendary: "bg-amber-900/30",
  mythic: "bg-pink-900/30",
};

const MOD_RARITY_COLORS: Record<string, string> = {
  common: "text-gray-300 bg-gray-700/60 border-gray-600",
  rare: "text-blue-400 bg-blue-900/40 border-blue-600",
  epic: "text-purple-400 bg-purple-900/40 border-purple-600",
  legendary: "text-amber-400 bg-amber-900/40 border-amber-600",
  mythic: "text-pink-400 bg-pink-900/40 border-pink-600",
};

const UPGRADE_SPELL_MULT = [1.0, 1.15, 1.32, 1.52, 1.75, 2.10];
const UPGRADE_CDR = [0, 0, 0, 1, 1, 2];
const UPGRADE_GOLD_COST: Record<string, number[]> = {
  common:    [1_000,    5_000,    20_000,    100_000,    500_000],
  uncommon:  [5_000,    25_000,   100_000,   500_000,    2_000_000],
  rare:      [25_000,   100_000,  500_000,   2_000_000,  10_000_000],
  epic:      [100_000,  500_000,  2_000_000, 10_000_000, 50_000_000],
  legendary: [500_000,  2_000_000,10_000_000,50_000_000, 250_000_000],
  mythic:    [2_000_000,10_000_000,50_000_000,250_000_000,1_000_000_000],
};
const UPGRADE_TP_COST = [1, 2, 5, 10, 25];
const FUSION_TP_COST: Record<string, number> = { common:3, uncommon:5, rare:10, epic:20, legendary:50 };

const BASE_MOD_SLOTS: Record<string, number> = { common:1, uncommon:1, rare:2, epic:2, legendary:3, mythic:3 };
function getModSlots(rarity: string, lvl: number) {
  return (BASE_MOD_SLOTS[rarity] ?? 1) + (lvl >= 3 ? 1 : 0) + (lvl >= 5 ? 1 : 0);
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return (n/1e9).toFixed(1)+"B";
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000) return (n/1e3).toFixed(0)+"K";
  return n.toLocaleString();
}

// Static modifier catalogue (mirrors server data without import)
const MOD_DEFS: Record<string, { name:string; description:string; rarity:string; icon:string; shardCost:number }> = {
  mod_empowered:     { name:"Empowered",       description:"+20% skill effectiveness",                    rarity:"common",    icon:"⚡", shardCost:50   },
  mod_swift:         { name:"Swift",            description:"-2 cooldown turns",                          rarity:"common",    icon:"💨", shardCost:50   },
  mod_burning:       { name:"Burning",          description:"35% chance to apply Burn on hit",            rarity:"common",    icon:"🔥", shardCost:40   },
  mod_freezing:      { name:"Freezing",         description:"25% chance to apply Freeze on hit",          rarity:"common",    icon:"❄️", shardCost:40   },
  mod_mana_efficient:{ name:"Mana Efficient",   description:"-30% mana cost",                             rarity:"common",    icon:"💧", shardCost:35   },
  mod_piercing:      { name:"Piercing",         description:"Ignore 25% of target's Defense",             rarity:"rare",      icon:"🗡️", shardCost:150  },
  mod_critical:      { name:"Critical Eye",     description:"+15% critical hit chance",                   rarity:"rare",      icon:"👁️", shardCost:150  },
  mod_draining:      { name:"Draining",         description:"+10% lifesteal from damage",                 rarity:"rare",      icon:"🩸", shardCost:150  },
  mod_fortifying:    { name:"Fortifying",       description:"+20% DEF for 2 turns after cast",            rarity:"rare",      icon:"🛡️", shardCost:130  },
  mod_poisonous:     { name:"Poisonous",        description:"40% chance to apply Poison on hit",          rarity:"rare",      icon:"☠️", shardCost:120  },
  mod_volatile:      { name:"Volatile",         description:"+40% damage, 8% self-damage",                rarity:"rare",      icon:"💥", shardCost:110  },
  mod_bleeding:      { name:"Bleeding",         description:"30% chance to apply Bleed on hit",           rarity:"rare",      icon:"🗡️", shardCost:120  },
  mod_arcane:        { name:"Arcane Infusion",  description:"+30% power, ignore 10% DEF",                 rarity:"epic",      icon:"✨", shardCost:400  },
  mod_runic:         { name:"Runic",            description:"-3 cooldown, -40% mana cost",                rarity:"epic",      icon:"🔮", shardCost:400  },
  mod_vampiric:      { name:"Vampiric",         description:"+15% lifesteal, 20% chance to stun",         rarity:"epic",      icon:"🧛", shardCost:350  },
  mod_divine:        { name:"Divine Echo",      description:"Convert 25% of damage to healing",           rarity:"epic",      icon:"😇", shardCost:350  },
  mod_explosive:     { name:"Explosive",        description:"Strike twice — extra hit at 50% power",      rarity:"epic",      icon:"💣", shardCost:380  },
  mod_stoic:         { name:"Stoic Fury",       description:"+50% power, -4 CDR, ignore 20% DEF",         rarity:"legendary", icon:"⚔️", shardCost:1200 },
  mod_masterful:     { name:"Masterful",        description:"+40% power, +20% crit, +12% lifesteal",      rarity:"legendary", icon:"👑", shardCost:1500 },
  mod_transcendent:  { name:"Transcendent",     description:"+65% power, -5 CDR, -50% mana, +25% crit",  rarity:"mythic",    icon:"🌟", shardCost:5000 },
};

type Tab = "upgrade" | "modifiers" | "fusion";

export default function SkillWorkshop() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("upgrade");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [fuseSkill1, setFuseSkill1] = useState<string>("");
  const [fuseSkill2, setFuseSkill2] = useState<string>("");
  const [attachTarget, setAttachTarget] = useState<string | null>(null);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: playerSkills = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/skills`],
    enabled: !!acctId,
  });

  const { data: modInventory = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/modifiers`],
    enabled: !!acctId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/skills`] });
    qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/modifiers`] });
    qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
  };

  const upgradeMut = useMutation({
    mutationFn: (skillId: string) =>
      apiRequest("POST", `/api/accounts/${acctId}/skills/${skillId}/upgrade`),
    onSuccess: (data: any) => {
      toast({ title: `${data.skillName} upgraded to Level ${data.newLevel}!`, description: `Spent ${fmt(data.goldSpent)} gold + ${data.tpSpent} TP` });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Upgrade failed", description: e.message, variant: "destructive" }),
  });

  const attachMut = useMutation({
    mutationFn: ({ skillId, modifierId }: { skillId: string; modifierId: string }) =>
      apiRequest("POST", `/api/accounts/${acctId}/skills/${skillId}/attach-modifier`, { modifierId }),
    onSuccess: (data: any) => {
      toast({ title: `${data.modifierName} attached!` });
      setAttachTarget(null);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const detachMut = useMutation({
    mutationFn: ({ skillId, modifierId }: { skillId: string; modifierId: string }) =>
      apiRequest("POST", `/api/accounts/${acctId}/skills/${skillId}/detach-modifier`, { modifierId }),
    onSuccess: (data: any) => {
      toast({ title: `${data.modifierName} returned to inventory` });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const fuseMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/accounts/${acctId}/skills/fuse`, { skillId1: fuseSkill1, skillId2: fuseSkill2 }),
    onSuccess: (data: any) => {
      toast({ title: `Fusion complete! Obtained ${data.resultSkill.name}`, description: `Rarity: ${data.resultSkill.rarity}` });
      setFuseSkill1(""); setFuseSkill2("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Fusion failed", description: e.message, variant: "destructive" }),
  });

  const buyModMut = useMutation({
    mutationFn: (modifierId: string) =>
      apiRequest("POST", `/api/accounts/${acctId}/modifiers/buy`, { modifierId }),
    onSuccess: (data: any) => {
      toast({ title: `Purchased ${data.modifierName}`, description: `${data.shardsRemaining} Soul Shards remaining` });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
  });

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Please log in.</p>
      </div>
    );
  }

  const getSkillRecord = (id: string) => playerSkills.find((s: any) => s.id === id);
  const selectedRecord = getSkillRecord(selectedSkillId);
  const selectedDef = selectedRecord ? (selectedRecord as any) : null;

  // Helper to build a display card for a skill
  const SkillCard = ({ record }: { record: any }) => {
    if (!record) return null;
    const lvl = record.upgradeLevel ?? 0;
    const mods: string[] = record.attachedModifiers ?? [];
    const rarity = record.rarity ?? "common";
    const mult = UPGRADE_SPELL_MULT[lvl];
    return (
      <div className={`rounded-xl border p-4 ${RARITY_COLORS[rarity]} ${RARITY_BG[rarity]}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-lg font-bold mr-2">{record.icon && <span className="mr-1">{record.icon}</span>}{record.name}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${RARITY_COLORS[rarity]}`}>{rarity}</span>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full ${lvl >= i ? "bg-yellow-400" : "bg-gray-700"}`} />
            ))}
          </div>
        </div>
        <p className="text-gray-300 text-sm mb-2">{record.description}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-black/30 px-2 py-0.5 rounded">Power: {(record.spellPower * mult).toFixed(2)}×</span>
          <span className="bg-black/30 px-2 py-0.5 rounded">CD: {Math.max(1, (record.cooldown || 5) - UPGRADE_CDR[lvl])} turns</span>
          {mods.length > 0 && mods.map(m => (
            <span key={m} className="bg-purple-900/50 border border-purple-700 px-2 py-0.5 rounded">
              {MOD_DEFS[m]?.icon} {MOD_DEFS[m]?.name ?? m}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-indigo-950 border-b border-purple-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <span className="text-4xl">⚗️</span>
          <div>
            <h1 className="text-2xl font-bold text-purple-200">Skill Workshop</h1>
            <p className="text-purple-400 text-sm">Upgrade, modify, and fuse your abilities</p>
          </div>
          <div className="ml-auto flex gap-4 text-sm text-right">
            <div><div className="text-yellow-400 font-bold">{fmt(account.gold ?? 0)}</div><div className="text-gray-500 text-xs">Gold</div></div>
            <div><div className="text-blue-400 font-bold">{account.trainingPoints ?? 0}</div><div className="text-gray-500 text-xs">TP</div></div>
            <div><div className="text-cyan-400 font-bold">{account.soulShards ?? 0}</div><div className="text-gray-500 text-xs">Shards</div></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl">
          {(["upgrade", "modifiers", "fusion"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm capitalize transition-all ${
                tab === t ? "bg-purple-700 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "upgrade" ? "⬆️ Upgrade" : t === "modifiers" ? "💎 Modifiers" : "🔀 Fusion"}
            </button>
          ))}
        </div>

        {/* ── UPGRADE TAB ─────────────────────────────────────────────────── */}
        {tab === "upgrade" && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-bold mb-4 text-purple-300">Select a Skill to Upgrade</h2>
              {playerSkills.length === 0 ? (
                <p className="text-gray-500">You don't own any skills yet. Win them from auctions!</p>
              ) : (
                <div className="grid gap-3">
                  {playerSkills.map((s: any) => {
                    const lvl = s.upgradeLevel ?? 0;
                    const rarity = s.rarity ?? "common";
                    const goldCost = lvl < 5 ? (UPGRADE_GOLD_COST[rarity] ?? UPGRADE_GOLD_COST["common"])[lvl] : 0;
                    const tpCost = lvl < 5 ? UPGRADE_TP_COST[lvl] : 0;
                    const canAfford = (account.gold ?? 0) >= goldCost && (account.trainingPoints ?? 0) >= tpCost;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-lg border p-4 cursor-pointer transition-all ${
                          selectedSkillId === s.id
                            ? "border-purple-500 bg-purple-900/20"
                            : `border-gray-700 bg-gray-800/50 hover:border-gray-500`
                        }`}
                        onClick={() => setSelectedSkillId(selectedSkillId === s.id ? "" : s.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{s.icon ?? "⚔️"}</span>
                            <div>
                              <div className={`font-bold ${RARITY_COLORS[rarity].split(" ")[0]}`}>{s.name}</div>
                              <div className="text-xs text-gray-400">{s.element ?? "No element"} · {s.spellCategory ?? "damage"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <div key={i} className={`w-2.5 h-2.5 rounded-full ${lvl >= i ? "bg-yellow-400" : "bg-gray-700"}`} />
                              ))}
                            </div>
                            <span className="text-xs text-gray-400">Lv {lvl}/5</span>
                            {lvl < 5 && (
                              <div className="text-right text-xs">
                                <div className={canAfford ? "text-yellow-300" : "text-red-400"}>{fmt(goldCost)} gold</div>
                                <div className={canAfford ? "text-blue-300" : "text-red-400"}>{tpCost} TP</div>
                              </div>
                            )}
                            {lvl >= 5 && <span className="text-yellow-400 text-xs font-bold">MAX</span>}
                          </div>
                        </div>

                        {selectedSkillId === s.id && lvl < 5 && (
                          <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-gray-900 rounded-lg p-3">
                                <div className="text-gray-400 text-xs mb-1">Current (Lv {lvl})</div>
                                <div className="text-white font-mono">{(s.spellPower * UPGRADE_SPELL_MULT[lvl]).toFixed(2)}× power</div>
                                <div className="text-gray-300 font-mono">CD {Math.max(1,(s.cooldown||5)-UPGRADE_CDR[lvl])} turns</div>
                                <div className="text-gray-300 font-mono">{getModSlots(rarity, lvl)} mod slot{getModSlots(rarity, lvl)!==1?"s":""}</div>
                              </div>
                              <div className="bg-purple-950/50 border border-purple-800 rounded-lg p-3">
                                <div className="text-purple-300 text-xs mb-1">After Upgrade (Lv {lvl+1})</div>
                                <div className="text-yellow-300 font-mono">{(s.spellPower * UPGRADE_SPELL_MULT[lvl+1]).toFixed(2)}× power</div>
                                <div className="text-blue-300 font-mono">CD {Math.max(1,(s.cooldown||5)-UPGRADE_CDR[lvl+1])} turns</div>
                                <div className="text-green-300 font-mono">{getModSlots(rarity, lvl+1)} mod slot{getModSlots(rarity, lvl+1)!==1?"s":""}</div>
                              </div>
                            </div>
                            <button
                              disabled={!canAfford || upgradeMut.isPending}
                              onClick={e => { e.stopPropagation(); upgradeMut.mutate(s.id); }}
                              className="w-full py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {upgradeMut.isPending ? "Upgrading…" : `Upgrade → Level ${lvl+1}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODIFIERS TAB ───────────────────────────────────────────────── */}
        {tab === "modifiers" && (
          <div className="space-y-6">
            {/* Skill selector */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-bold mb-3 text-purple-300">Choose a Skill</h2>
              <select
                value={selectedSkillId}
                onChange={e => { setSelectedSkillId(e.target.value); setAttachTarget(null); }}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">— Select a skill —</option>
                {playerSkills.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.rarity}, Lv {s.upgradeLevel ?? 0})</option>
                ))}
              </select>
            </div>

            {selectedRecord && (
              <>
                {/* Modifier slots */}
                <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
                  <h2 className="text-lg font-bold mb-1 text-purple-300">Modifier Slots</h2>
                  <p className="text-xs text-gray-500 mb-4">
                    {getModSlots(selectedRecord.rarity ?? "common", selectedRecord.upgradeLevel ?? 0)} slot{getModSlots(selectedRecord.rarity ?? "common", selectedRecord.upgradeLevel ?? 0)!==1?"s":""} available
                    {(selectedRecord.upgradeLevel ?? 0) < 3 && <span> · Reach Lv 3 to unlock extra slot</span>}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {Array.from({ length: getModSlots(selectedRecord.rarity ?? "common", selectedRecord.upgradeLevel ?? 0) }).map((_, i) => {
                      const modId = ((selectedRecord.attachedModifiers ?? []) as string[])[i];
                      const modDef = modId ? MOD_DEFS[modId] : null;
                      return (
                        <div key={i} className={`flex-1 min-w-[140px] rounded-xl border-2 p-3 transition-all ${
                          modDef
                            ? `${MOD_RARITY_COLORS[modDef.rarity]} cursor-pointer`
                            : attachTarget === selectedRecord.id
                            ? "border-purple-500 bg-purple-900/20 cursor-pointer"
                            : "border-dashed border-gray-600 bg-gray-800/40 cursor-pointer hover:border-gray-400"
                        }`}
                          onClick={() => {
                            if (modDef) {
                              detachMut.mutate({ skillId: selectedRecord.id, modifierId: modId });
                            } else {
                              setAttachTarget(attachTarget === selectedRecord.id ? null : selectedRecord.id);
                            }
                          }}
                        >
                          {modDef ? (
                            <div className="text-center">
                              <div className="text-2xl mb-1">{modDef.icon}</div>
                              <div className="font-bold text-sm">{modDef.name}</div>
                              <div className="text-xs mt-1 opacity-80">{modDef.description}</div>
                              <div className="text-xs mt-2 text-red-400 opacity-70">Click to detach</div>
                            </div>
                          ) : (
                            <div className="text-center text-gray-500">
                              <div className="text-2xl mb-1">＋</div>
                              <div className="text-xs">Empty Slot</div>
                              <div className="text-xs mt-1 opacity-60">Click to attach</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Modifier picker */}
                  {attachTarget === selectedRecord.id && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Your Modifier Inventory</h3>
                      {modInventory.length === 0 ? (
                        <p className="text-gray-500 text-sm">No modifiers in inventory. Buy them from the shop below.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {modInventory.map((row: any) => {
                            const def = MOD_DEFS[row.modifierId];
                            if (!def) return null;
                            return (
                              <button
                                key={row.id}
                                onClick={() => attachMut.mutate({ skillId: selectedRecord.id, modifierId: row.modifierId })}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold hover:brightness-125 transition-all ${MOD_RARITY_COLORS[def.rarity]}`}
                              >
                                {def.icon} {def.name}
                                <span className="ml-1 bg-black/30 px-1 rounded text-xs">×{row.quantity}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Modifier Shop */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-bold mb-1 text-purple-300">Modifier Shop</h2>
              <p className="text-gray-500 text-xs mb-4">Purchase modifiers with Soul Shards · You have <span className="text-cyan-400">{account.soulShards ?? 0}</span> shards</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(MOD_DEFS).map(([id, def]) => {
                  const canAfford = (account.soulShards ?? 0) >= def.shardCost;
                  const owned = modInventory.find((r: any) => r.modifierId === id)?.quantity ?? 0;
                  return (
                    <div key={id} className={`flex items-center justify-between rounded-lg border p-3 ${MOD_RARITY_COLORS[def.rarity]}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{def.icon}</span>
                        <div>
                          <div className="font-semibold text-sm">{def.name}
                            {owned > 0 && <span className="ml-2 text-xs bg-black/40 px-1 rounded">Owned: {owned}</span>}
                          </div>
                          <div className="text-xs opacity-75">{def.description}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => buyModMut.mutate(id)}
                        disabled={!canAfford || buyModMut.isPending}
                        className="ml-3 shrink-0 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                      >
                        {def.shardCost} 💎
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── FUSION TAB ──────────────────────────────────────────────────── */}
        {tab === "fusion" && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-bold mb-1 text-purple-300">Skill Fusion</h2>
              <p className="text-gray-400 text-sm mb-5">
                Combine two skills of the <strong>same rarity</strong> to receive a random skill of the next rarity tier. Both source skills are consumed. One attached modifier may transfer to the result.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Skill 1 */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold uppercase">Skill 1</label>
                  <select
                    value={fuseSkill1}
                    onChange={e => setFuseSkill1(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Select —</option>
                    {playerSkills
                      .filter((s: any) => s.id !== fuseSkill2)
                      .map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.rarity})</option>
                      ))}
                  </select>
                  {fuseSkill1 && (() => {
                    const r = getSkillRecord(fuseSkill1);
                    return r ? (
                      <div className={`rounded-lg border p-3 text-sm ${RARITY_COLORS[r.rarity ?? "common"]} ${RARITY_BG[r.rarity ?? "common"]}`}>
                        <div className="font-bold">{r.icon} {r.name}</div>
                        <div className="text-xs opacity-70 mt-1">{r.rarity} · Lv {r.upgradeLevel ?? 0}</div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Arrow / result info */}
                <div className="text-center space-y-2">
                  <div className="text-4xl">🔀</div>
                  {fuseSkill1 && fuseSkill2 && (() => {
                    const r1 = getSkillRecord(fuseSkill1);
                    const r2 = getSkillRecord(fuseSkill2);
                    if (!r1 || !r2) return null;
                    const rarityOrder = ["common","uncommon","rare","epic","legendary","mythic"];
                    const idx1 = rarityOrder.indexOf(r1.rarity ?? "common");
                    const idx2 = rarityOrder.indexOf(r2.rarity ?? "common");
                    const sameRarity = r1.rarity === r2.rarity;
                    const canFuse = sameRarity && idx1 < rarityOrder.length - 1;
                    const tpCost = FUSION_TP_COST[r1.rarity ?? "common"] ?? 3;
                    const nextRarity = canFuse ? rarityOrder[idx1 + 1] : null;
                    return (
                      <div className={`text-sm rounded-lg p-3 ${canFuse ? "bg-purple-900/40 border border-purple-700" : "bg-red-900/30 border border-red-700"}`}>
                        {canFuse ? (
                          <>
                            <div className="text-purple-300 font-bold">→ Random {nextRarity} skill</div>
                            <div className="text-blue-300 text-xs mt-1">Cost: {tpCost} TP</div>
                          </>
                        ) : (
                          <div className="text-red-400 text-xs">{!sameRarity ? "Different rarities!" : "Mythic skills cannot be fused"}</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Skill 2 */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-semibold uppercase">Skill 2</label>
                  <select
                    value={fuseSkill2}
                    onChange={e => setFuseSkill2(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Select —</option>
                    {playerSkills
                      .filter((s: any) => s.id !== fuseSkill1)
                      .map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.rarity})</option>
                      ))}
                  </select>
                  {fuseSkill2 && (() => {
                    const r = getSkillRecord(fuseSkill2);
                    return r ? (
                      <div className={`rounded-lg border p-3 text-sm ${RARITY_COLORS[r.rarity ?? "common"]} ${RARITY_BG[r.rarity ?? "common"]}`}>
                        <div className="font-bold">{r.icon} {r.name}</div>
                        <div className="text-xs opacity-70 mt-1">{r.rarity} · Lv {r.upgradeLevel ?? 0}</div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Fuse button */}
              {fuseSkill1 && fuseSkill2 && (() => {
                const r1 = getSkillRecord(fuseSkill1);
                const r2 = getSkillRecord(fuseSkill2);
                if (!r1 || !r2) return null;
                const rarityOrder = ["common","uncommon","rare","epic","legendary","mythic"];
                const canFuse = r1.rarity === r2.rarity && rarityOrder.indexOf(r1.rarity ?? "common") < rarityOrder.length - 1;
                const tpCost = FUSION_TP_COST[r1.rarity ?? "common"] ?? 3;
                const canAfford = (account.trainingPoints ?? 0) >= tpCost;
                return (
                  <div className="mt-6 border-t border-gray-700 pt-5">
                    <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-3 text-xs text-amber-300 mb-4">
                      ⚠️ This action is <strong>irreversible</strong>. Both selected skills will be destroyed. The result is a random skill of the next rarity tier.
                    </div>
                    <button
                      disabled={!canFuse || !canAfford || fuseMut.isPending}
                      onClick={() => fuseMut.mutate()}
                      className="w-full py-3 rounded-xl font-bold text-base bg-gradient-to-r from-purple-700 via-pink-700 to-indigo-700 hover:from-purple-600 hover:via-pink-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {fuseMut.isPending ? "Fusing…" : `⚡ Fuse Skills (${tpCost} TP)`}
                    </button>
                    {!canAfford && <p className="text-red-400 text-xs text-center mt-2">Insufficient TP ({account.trainingPoints ?? 0} / {tpCost})</p>}
                  </div>
                );
              })()}
            </div>

            {/* Fusion guide */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h3 className="font-bold text-purple-300 mb-3">Fusion Tier Chart</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                {[
                  ["Common","Uncommon",3], ["Uncommon","Rare",5],
                  ["Rare","Epic",10], ["Epic","Legendary",20], ["Legendary","Mythic",50]
                ].map(([from, to, tp]) => (
                  <div key={from as string} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                    <span className={RARITY_COLORS[String(from).toLowerCase()]?.split(" ")[0]}>{from}</span>
                    <span className="text-gray-500">+</span>
                    <span className={RARITY_COLORS[String(from).toLowerCase()]?.split(" ")[0]}>{from}</span>
                    <span className="text-gray-500">→</span>
                    <span className={RARITY_COLORS[String(to).toLowerCase()]?.split(" ")[0]}>{to}</span>
                    <span className="text-blue-400 text-xs">({tp} TP)</span>
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
