import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Static prestige data (mirrors server) ────────────────────────────────────
const PRESTIGE_PERKS = [
  { level:1,  title:"Reborn",          icon:"⭐",   tokens:1, statMult:10, goldBonus:15, xpBonus:0,   tpBonus:0,   critBonus:0,  lifestealBonus:0, unlockedContent:["Prestige Shop","Prestige Badge"],         flavorText:"You have shattered your limits and walked the path a second time." },
  { level:2,  title:"Twice-Forged",    icon:"⭐⭐",  tokens:1, statMult:10, goldBonus:15, xpBonus:20,  tpBonus:0,   critBonus:0,  lifestealBonus:0, unlockedContent:["Prestige Skill Auctions"],                  flavorText:"Twice you have walked through death and returned stronger." },
  { level:3,  title:"Thrice-Risen",    icon:"🌟",   tokens:2, statMult:10, goldBonus:10, xpBonus:20,  tpBonus:0,   critBonus:5,  lifestealBonus:0, unlockedContent:["Prestige Dungeon"],                         flavorText:"Three cycles of death and rebirth have carved your soul." },
  { level:4,  title:"Veteran Soul",    icon:"🌟🌟",  tokens:1, statMult:10, goldBonus:10, xpBonus:20,  tpBonus:25,  critBonus:0,  lifestealBonus:0, unlockedContent:["Veteran Title","Prestige Leaderboard"],     flavorText:"Veterans respect your silence." },
  { level:5,  title:"Ascendant Soul",  icon:"💫",   tokens:2, statMult:15, goldBonus:10, xpBonus:0,   tpBonus:25,  critBonus:0,  lifestealBonus:2, unlockedContent:["Ancestral Crafting","Soulbound Gear Slot"], flavorText:"Halfway to legend. Your aura radiates power." },
  { level:6,  title:"Ancient",         icon:"🔥",   tokens:2, statMult:10, goldBonus:10, xpBonus:25,  tpBonus:50,  critBonus:5,  lifestealBonus:0, unlockedContent:["Ancient Title","Prestige Arena"],           flavorText:"Ancient texts record warriors of your calibre appearing once per century." },
  { level:7,  title:"Eternal",         icon:"🔥🔥",  tokens:2, statMult:10, goldBonus:10, xpBonus:0,   tpBonus:0,   critBonus:5,  lifestealBonus:2, unlockedContent:["Eternal Title","Soul Resonance System"],    flavorText:"Time cannot claim you." },
  { level:8,  title:"Undying",         icon:"💠",   tokens:2, statMult:10, goldBonus:15, xpBonus:25,  tpBonus:50,  critBonus:0,  lifestealBonus:2, unlockedContent:["Undying Badge","Legend's Vault"],           flavorText:"The cycle of life and death means nothing to you." },
  { level:9,  title:"Myth-Walker",     icon:"💠💠",  tokens:3, statMult:10, goldBonus:10, xpBonus:50,  tpBonus:0,   critBonus:5,  lifestealBonus:2, unlockedContent:["Myth-Walker Title","Prestige Endgame"],     flavorText:"You don't just witness legends — you are the source of them." },
  { level:10, title:"Legend Reborn",   icon:"👑",   tokens:5, statMult:5,  goldBonus:10, xpBonus:0,   tpBonus:50,  critBonus:5,  lifestealBonus:2, unlockedContent:["Legend Reborn Title","Mythic Prestige Frame","Ultimate Prestige Cosmetics"], flavorText:"Ten lifetimes of battle. Ten deaths defeated." },
];

const SHOP_ITEMS = [
  { id:"ps_soul_infusion",  name:"Soul Infusion",     icon:"💎", description:"Instantly receive 1,000 Soul Shards.",                              tokenCost:1, minPrestige:1, category:"resource" },
  { id:"ps_gold_surge",     name:"Gold Surge",        icon:"💰", description:"Instantly receive 500,000 gold.",                                   tokenCost:1, minPrestige:1, category:"resource" },
  { id:"ps_tp_surge",       name:"TP Surge",          icon:"📚", description:"Instantly receive 200 Training Points.",                            tokenCost:1, minPrestige:1, category:"resource" },
  { id:"ps_legendary_tome", name:"Legendary Tome",    icon:"📖", description:"Grants a random Legendary skill from the auction pool.",           tokenCost:3, minPrestige:2, category:"special"  },
  { id:"ps_ruby_cache",     name:"Ruby Cache",        icon:"💍", description:"Receive 5,000 Rubies for cosmetics and auctions.",                 tokenCost:2, minPrestige:2, category:"resource" },
  { id:"ps_eternal_blessing",name:"Eternal Blessing", icon:"✨", description:"Permanently +3% all stats. Stackable up to 5×.",                  tokenCost:4, minPrestige:5, category:"power"    },
  { id:"ps_mythic_scroll",  name:"Mythic Scroll",     icon:"🌟", description:"Grants a random Mythic skill. Extremely rare.",                    tokenCost:8, minPrestige:7, category:"special"  },
  { id:"ps_legend_title",   name:"Legend's Brand",    icon:"👑", description:"Unlock the exclusive 'Legend's Brand' cosmetic title.",            tokenCost:5, minPrestige:10,category:"cosmetic"  },
];

function getCumulative(level: number) {
  let stat=0, gold=0, xp=0, tp=0, crit=0, ls=0;
  for (let i = 0; i < Math.min(level, 10); i++) {
    stat += PRESTIGE_PERKS[i].statMult;
    gold += PRESTIGE_PERKS[i].goldBonus;
    xp   += PRESTIGE_PERKS[i].xpBonus;
    tp   += PRESTIGE_PERKS[i].tpBonus;
    crit += PRESTIGE_PERKS[i].critBonus;
    ls   += PRESTIGE_PERKS[i].lifestealBonus;
  }
  return { stat, gold, xp, tp, crit, ls };
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return (n/1e9).toFixed(1)+"B";
  if (n >= 1_000_000) return (n/1e6).toFixed(1)+"M";
  if (n >= 1_000) return (n/1e3).toFixed(0)+"K";
  return n.toLocaleString();
}

type Tab = "overview" | "shop" | "history";

const STAR_ROWS = [
  [1,2,3,4,5],
  [6,7,8,9,10],
];

export default function Prestige() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmStep, setConfirmStep] = useState(0); // 0=idle, 1=first confirm, 2=final confirm
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: prestigeInfo } = useQuery<any>({
    queryKey: [`/api/accounts/${acctId}/prestige-info`],
    enabled: !!acctId,
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${acctId}/prestige-history`],
    enabled: !!acctId && tab === "history",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/accounts/me"] });
    qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/prestige-info`] });
    qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/prestige-history`] });
  };

  const prestigeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/accounts/${acctId}/prestige`),
    onSuccess: (data: any) => {
      toast({
        title: `🌟 Prestige ${data.newPrestigeLevel} Achieved!`,
        description: `Welcome, ${data.newTitle}. You earned ${data.tokensAwarded} Prestige Token${data.tokensAwarded !== 1 ? "s" : ""}.`,
      });
      setConfirmStep(0);
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Prestige failed", description: e.message, variant: "destructive" });
      setConfirmStep(0);
    },
  });

  const buyMut = useMutation({
    mutationFn: (itemId: string) =>
      apiRequest("POST", `/api/accounts/${acctId}/prestige-shop/buy`, { itemId }),
    onSuccess: (data: any) => {
      toast({ title: `Purchased: ${data.itemName}`, description: data.description });
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

  const currentPrestige = account.prestigeLevel ?? 0;
  const tokens = account.prestigeTokens ?? 0;
  const permBonus = account.permanentStatBonus ?? 0;
  const cum = getCumulative(currentPrestige);
  const nextPerk = currentPrestige < 10 ? PRESTIGE_PERKS[currentPrestige] : null;
  const canPrestige = prestigeInfo?.canPrestige ?? false;
  const goldKeepPct = Math.min(50, 5 * (currentPrestige + 1));
  const goldToKeep = Math.floor((account.gold ?? 0) * goldKeepPct / 100);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-950 via-amber-950 to-yellow-950 border-b border-yellow-800 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{currentPrestige >= 10 ? "👑" : currentPrestige >= 5 ? "💫" : currentPrestige >= 1 ? "⭐" : "🌑"}</div>
              <div>
                <h1 className="text-2xl font-bold text-amber-200">Hall of Legends</h1>
                <p className="text-amber-400 text-sm">Prestige — meta-progression beyond Mythical Legend</p>
                {currentPrestige > 0 && (
                  <p className="text-yellow-300 font-semibold mt-1">
                    Prestige {currentPrestige} · {PRESTIGE_PERKS[currentPrestige - 1].title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-5 text-right text-sm">
              <div><div className="text-amber-300 font-bold text-lg">{tokens}</div><div className="text-gray-500 text-xs">Prestige Tokens</div></div>
              <div><div className="text-purple-300 font-bold text-lg">{currentPrestige}/10</div><div className="text-gray-500 text-xs">Prestige Level</div></div>
              {permBonus > 0 && <div><div className="text-green-300 font-bold text-lg">+{permBonus}%</div><div className="text-gray-500 text-xs">Perm Bonus</div></div>}
            </div>
          </div>

          {/* Star row */}
          <div className="mt-4 flex gap-2">
            {STAR_ROWS.flat().map(lvl => (
              <div key={lvl} className={`flex-1 h-2 rounded-full transition-all ${
                lvl <= currentPrestige ? "bg-amber-400 shadow-amber-400/50 shadow-sm" : "bg-gray-700"
              }`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl">
          {(["overview", "shop", "history"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm capitalize transition-all ${
                tab === t ? "bg-amber-700 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}>
              {t === "overview" ? "🌟 Overview" : t === "shop" ? "🛒 Prestige Shop" : "📜 History"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Current bonuses */}
            {currentPrestige > 0 && (
              <div className="bg-gradient-to-br from-amber-950/60 to-yellow-950/40 rounded-xl border border-amber-700/50 p-5">
                <h2 className="text-amber-300 font-bold text-lg mb-3">Your Active Prestige Bonuses</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: "All Stats",    value: `+${cum.stat}%`,  color: "text-green-400", icon: "⚔️" },
                    { label: "Gold Drops",   value: `+${cum.gold}%`,  color: "text-yellow-400", icon: "💰" },
                    { label: "XP Gain",      value: `+${cum.xp}%`,   color: "text-blue-400",   icon: "📈" },
                    { label: "TP Gain",      value: `+${cum.tp}%`,   color: "text-purple-400", icon: "📚" },
                    { label: "Crit Chance",  value: `+${cum.crit}%`, color: "text-red-400",    icon: "🎯" },
                    { label: "Lifesteal",    value: `+${cum.ls}%`,   color: "text-pink-400",   icon: "🩸" },
                  ].map(b => b.value !== "+0%" && (
                    <div key={b.label} className="bg-black/30 rounded-lg p-3 flex items-center gap-2">
                      <span className="text-xl">{b.icon}</span>
                      <div>
                        <div className={`font-bold ${b.color}`}>{b.value}</div>
                        <div className="text-gray-400 text-xs">{b.label}</div>
                      </div>
                    </div>
                  ))}
                  {permBonus > 0 && (
                    <div className="bg-black/30 rounded-lg p-3 flex items-center gap-2">
                      <span className="text-xl">✨</span>
                      <div>
                        <div className="font-bold text-emerald-400">+{permBonus}% (perm)</div>
                        <div className="text-gray-400 text-xs">Shop Bonus</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prestige action card */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg text-white">
                    {currentPrestige < 10 ? `Prestige → Level ${currentPrestige + 1}` : "Maximum Prestige Reached"}
                  </h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {currentPrestige < 10
                      ? `Requires rank: Mythical Legend (your rank: ${account.rank})`
                      : "You have achieved the ultimate prestige. You are Legend Reborn."}
                  </p>
                </div>
                {nextPerk && <span className="text-4xl">{nextPerk.icon}</span>}
              </div>

              {currentPrestige < 10 && (
                <>
                  {/* Next perk preview */}
                  {nextPerk && (
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4 mb-4">
                      <p className="text-amber-300 font-semibold text-sm mb-2">Rewards at Prestige {nextPerk.level}:</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {nextPerk.statMult > 0     && <span className="bg-green-900/40  border border-green-700  px-2 py-1 rounded text-green-300">+{nextPerk.statMult}% All Stats</span>}
                        {nextPerk.goldBonus > 0    && <span className="bg-yellow-900/40 border border-yellow-700 px-2 py-1 rounded text-yellow-300">+{nextPerk.goldBonus}% Gold</span>}
                        {nextPerk.xpBonus > 0      && <span className="bg-blue-900/40   border border-blue-700   px-2 py-1 rounded text-blue-300">+{nextPerk.xpBonus}% XP</span>}
                        {nextPerk.tpBonus > 0      && <span className="bg-purple-900/40 border border-purple-700 px-2 py-1 rounded text-purple-300">+{nextPerk.tpBonus}% TP</span>}
                        {nextPerk.critBonus > 0    && <span className="bg-red-900/40    border border-red-700    px-2 py-1 rounded text-red-300">+{nextPerk.critBonus}% Crit</span>}
                        {nextPerk.lifestealBonus > 0 && <span className="bg-pink-900/40 border border-pink-700   px-2 py-1 rounded text-pink-300">+{nextPerk.lifestealBonus}% Lifesteal</span>}
                        <span className="bg-amber-900/40 border border-amber-600 px-2 py-1 rounded text-amber-300">+{nextPerk.tokens} Token{nextPerk.tokens !== 1 ? "s" : ""}</span>
                        <span className="bg-indigo-900/40 border border-indigo-600 px-2 py-1 rounded text-indigo-300">Title: {nextPerk.title}</span>
                      </div>
                      {nextPerk.unlockedContent.length > 0 && (
                        <div className="mt-2 text-xs text-emerald-400">
                          🔓 Unlocks: {nextPerk.unlockedContent.join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* What resets */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                    <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-3">
                      <p className="text-red-300 font-semibold mb-2">🔄 Resets</p>
                      <ul className="text-gray-400 space-y-1">
                        <li>• Rank → Novice</li>
                        <li>• Keep {goldKeepPct}% gold ({fmt(goldToKeep)})</li>
                        <li>• Training Points → 0</li>
                        <li>• Story Act → 1</li>
                        <li>• Mystic Tower → Floor 1</li>
                      </ul>
                    </div>
                    <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-3">
                      <p className="text-green-300 font-semibold mb-2">✅ Keeps Forever</p>
                      <ul className="text-gray-400 space-y-1">
                        <li>• All Pets & Skills</li>
                        <li>• Skill upgrades & mods</li>
                        <li>• Guild & base</li>
                        <li>• Skins & cosmetics</li>
                        <li>• Prestige bonuses</li>
                      </ul>
                    </div>
                  </div>

                  {/* Prestige button flow */}
                  {!canPrestige ? (
                    <div className="bg-gray-800 rounded-lg p-3 text-center text-gray-400 text-sm">
                      ⚔️ Reach <strong className="text-white">Mythical Legend</strong> rank to unlock prestige
                    </div>
                  ) : confirmStep === 0 ? (
                    <button
                      onClick={() => setConfirmStep(1)}
                      className="w-full py-3 rounded-xl font-bold text-base bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-500 shadow-lg shadow-amber-900/50 transition-all"
                    >
                      ⭐ Prestige Now — Become {nextPerk?.title}
                    </button>
                  ) : confirmStep === 1 ? (
                    <div className="space-y-3">
                      <div className="bg-amber-950/60 border border-amber-600 rounded-xl p-4 text-center">
                        <p className="text-amber-200 font-bold mb-1">Are you absolutely sure?</p>
                        <p className="text-gray-400 text-sm">Your rank will reset to Novice. You'll keep {goldKeepPct}% of your gold ({fmt(goldToKeep)}) and all your pets, skills, and gear.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setConfirmStep(0)} className="py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all">Cancel</button>
                        <button onClick={() => setConfirmStep(2)} className="py-2.5 rounded-lg bg-amber-700 hover:bg-amber-600 font-bold transition-all">Yes, Continue</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-950/60 border border-red-600 rounded-xl p-4 text-center">
                        <p className="text-red-300 font-bold mb-1">⚠️ Final Confirmation</p>
                        <p className="text-gray-300 text-sm">This is irreversible. Your rank resets. Click Prestige to confirm.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setConfirmStep(0)} className="py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-all">Cancel</button>
                        <button
                          onClick={() => prestigeMut.mutate()}
                          disabled={prestigeMut.isPending}
                          className="py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 font-bold transition-all disabled:opacity-50"
                        >
                          {prestigeMut.isPending ? "Prestiging…" : "✨ PRESTIGE"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* All perk levels accordion */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="font-bold text-lg text-amber-300 mb-4">All Prestige Tiers</h2>
              <div className="space-y-2">
                {PRESTIGE_PERKS.map(p => {
                  const unlocked = p.level <= currentPrestige;
                  const isNext = p.level === currentPrestige + 1;
                  return (
                    <div key={p.level}
                      className={`rounded-lg border transition-all cursor-pointer ${
                        unlocked ? "border-amber-600/50 bg-amber-950/20" :
                        isNext   ? "border-yellow-600/40 bg-yellow-950/10" :
                                   "border-gray-700 bg-gray-800/30"
                      }`}
                      onClick={() => setExpandedLevel(expandedLevel === p.level ? null : p.level)}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xl">{p.icon}</span>
                        <div className="flex-1">
                          <span className={`font-semibold ${unlocked ? "text-amber-300" : isNext ? "text-yellow-400" : "text-gray-400"}`}>
                            Prestige {p.level} — {p.title}
                          </span>
                          {isNext && <span className="ml-2 text-xs bg-yellow-700 text-yellow-100 px-1.5 py-0.5 rounded">NEXT</span>}
                          {unlocked && <span className="ml-2 text-xs bg-amber-700 text-amber-100 px-1.5 py-0.5 rounded">EARNED</span>}
                        </div>
                        <span className="text-gray-500 text-sm">{expandedLevel === p.level ? "▲" : "▼"}</span>
                      </div>
                      {expandedLevel === p.level && (
                        <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-2">
                          <p className="text-gray-400 text-sm italic">"{p.flavorText}"</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {p.statMult > 0     && <span className="bg-green-900/40  text-green-300  border border-green-800  px-2 py-0.5 rounded">+{p.statMult}% all stats</span>}
                            {p.goldBonus > 0    && <span className="bg-yellow-900/40 text-yellow-300 border border-yellow-800 px-2 py-0.5 rounded">+{p.goldBonus}% gold</span>}
                            {p.xpBonus > 0      && <span className="bg-blue-900/40   text-blue-300   border border-blue-800   px-2 py-0.5 rounded">+{p.xpBonus}% XP</span>}
                            {p.tpBonus > 0      && <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">+{p.tpBonus}% TP</span>}
                            {p.critBonus > 0    && <span className="bg-red-900/40    text-red-300    border border-red-800    px-2 py-0.5 rounded">+{p.critBonus}% crit</span>}
                            {p.lifestealBonus > 0 && <span className="bg-pink-900/40 text-pink-300   border border-pink-800   px-2 py-0.5 rounded">+{p.lifestealBonus}% lifesteal</span>}
                            <span className="bg-amber-900/40 text-amber-300 border border-amber-800 px-2 py-0.5 rounded">{p.tokens} token{p.tokens !== 1 ? "s" : ""}</span>
                          </div>
                          {p.unlockedContent.length > 0 && (
                            <p className="text-emerald-400 text-xs">🔓 {p.unlockedContent.join(" · ")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SHOP TAB ────────────────────────────────────────────────────── */}
        {tab === "shop" && (
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-amber-300 font-bold">Prestige Shop</p>
                <p className="text-gray-400 text-sm">Spend Prestige Tokens on exclusive items and permanent power.</p>
              </div>
              <div className="text-right">
                <div className="text-amber-300 font-bold text-xl">{tokens}</div>
                <div className="text-gray-500 text-xs">Tokens</div>
              </div>
            </div>

            {currentPrestige === 0 ? (
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-gray-300 font-semibold">Shop unlocks after your first Prestige</p>
                <p className="text-gray-500 text-sm mt-1">Reach Mythical Legend rank and prestige once to access this shop.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {SHOP_ITEMS.filter(item => item.minPrestige <= currentPrestige).map(item => {
                  const canAfford = tokens >= item.tokenCost;
                  const catColor = item.category === "power" ? "border-green-700/50 bg-green-950/20" :
                                   item.category === "special" ? "border-purple-700/50 bg-purple-950/20" :
                                   item.category === "cosmetic" ? "border-pink-700/50 bg-pink-950/20" :
                                   "border-gray-700 bg-gray-800/50";
                  return (
                    <div key={item.id} className={`rounded-xl border p-4 flex items-center justify-between ${catColor}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{item.icon}</span>
                        <div>
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-gray-400 text-sm">{item.description}</div>
                          <div className="text-xs mt-1 text-gray-500 capitalize">{item.category}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => buyMut.mutate(item.id)}
                        disabled={!canAfford || buyMut.isPending}
                        className="shrink-0 ml-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm"
                      >
                        {item.tokenCost} 🪙
                      </button>
                    </div>
                  );
                })}
                {SHOP_ITEMS.filter(item => item.minPrestige > currentPrestige).length > 0 && (
                  <div className="mt-2">
                    <p className="text-gray-600 text-xs mb-2">🔒 Locked items (higher prestige required)</p>
                    {SHOP_ITEMS.filter(item => item.minPrestige > currentPrestige).map(item => (
                      <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 flex items-center gap-3 opacity-50 mb-2">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-400">{item.name} <span className="text-xs">(requires Prestige {item.minPrestige})</span></div>
                          <div className="text-gray-600 text-sm">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h2 className="font-bold text-lg text-amber-300 mb-4">Prestige History</h2>
              {history.length === 0 ? (
                <p className="text-gray-500 text-sm">No prestige events yet. Reach Mythical Legend to begin your legend.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h: any, i: number) => (
                    <div key={h.id ?? i} className="flex items-center gap-4 bg-amber-950/20 border border-amber-800/30 rounded-lg p-4">
                      <span className="text-3xl">{PRESTIGE_PERKS[h.prestigeLevel - 1]?.icon ?? "⭐"}</span>
                      <div className="flex-1">
                        <div className="font-bold text-amber-300">Prestige {h.prestigeLevel} — {PRESTIGE_PERKS[h.prestigeLevel - 1]?.title}</div>
                        <div className="text-gray-400 text-sm">Previous rank: {h.previousRank} · Gold kept: {fmt(h.goldKept ?? 0)}</div>
                        <div className="text-gray-500 text-xs">{new Date(h.prestigedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
