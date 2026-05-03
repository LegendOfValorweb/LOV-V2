import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Mirror of server definitions (rarity styles + trait data)
const RARITY_STYLES = {
  Common:    { bg:"from-gray-800 to-gray-900",       border:"border-gray-600",    text:"text-gray-300",    badge:"bg-gray-700 text-gray-300",     star:"⚫" },
  Uncommon:  { bg:"from-emerald-950 to-green-950",   border:"border-emerald-700", text:"text-emerald-300", badge:"bg-emerald-800 text-emerald-200",star:"🟢" },
  Rare:      { bg:"from-blue-950 to-indigo-950",     border:"border-blue-700",    text:"text-blue-300",    badge:"bg-blue-800 text-blue-200",      star:"🔵" },
  Epic:      { bg:"from-purple-950 to-violet-950",   border:"border-purple-600",  text:"text-purple-300",  badge:"bg-purple-700 text-purple-200",  star:"🟣" },
  Legendary: { bg:"from-amber-950 to-yellow-950",    border:"border-amber-500",   text:"text-amber-300",   badge:"bg-amber-700 text-amber-200",    star:"🟡" },
  Mythic:    { bg:"from-red-950 to-pink-950",        border:"border-red-500",     text:"text-red-300",     badge:"bg-red-700 text-red-200",        star:"🔴" },
} as const;

const RARITY_ORDER = ["Common","Uncommon","Rare","Epic","Legendary","Mythic"] as const;

type TraitEffect = { type: string; stat?: string; mult?: number; value?: number; specialKey?: string; description: string };

type Trait = {
  id: string; name: string; rarity: keyof typeof RARITY_STYLES; icon: string;
  tagline: string; lore: string; category: string; effects: TraitEffect[];
};

function EffectBadge({ eff }: { eff: TraitEffect }) {
  const isPositive = !eff.description.startsWith("-");
  return (
    <div className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${isPositive ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-red-950/40 border-red-800 text-red-300"}`}>
      <span>{isPositive ? "+" : ""}{eff.description}</span>
    </div>
  );
}

function TraitCard({ trait, size = "full" }: { trait: Trait; size?: "full" | "compact" }) {
  const styles = RARITY_STYLES[trait.rarity] ?? RARITY_STYLES.Common;
  const [expanded, setExpanded] = useState(false);

  if (size === "compact") {
    return (
      <div className={`rounded-lg border ${styles.border} overflow-hidden cursor-pointer transition-all hover:opacity-80`}
        onClick={() => setExpanded(!expanded)}>
        <div className={`bg-gradient-to-r ${styles.bg} px-3 py-2 flex items-center gap-2`}>
          <span className="text-xl">{trait.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm ${styles.text} truncate`}>{trait.name}</div>
            <div className="text-gray-500 text-xs truncate">{trait.tagline}</div>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${styles.badge} shrink-0`}>{trait.rarity}</span>
        </div>
        {expanded && (
          <div className="px-3 py-2 bg-black/30 border-t border-white/5 space-y-1">
            {trait.effects.map((e, i) => <EffectBadge key={i} eff={e} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${styles.border} overflow-hidden shadow-lg`}>
      <div className={`px-5 py-4 bg-gradient-to-br ${styles.bg}`}>
        <div className="flex items-start gap-4">
          <div className={`text-5xl p-2 rounded-xl bg-black/30 border ${styles.border}`}>{trait.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>{trait.rarity}</span>
              <span className="text-gray-500 text-xs">{trait.category}</span>
            </div>
            <h3 className={`text-xl font-bold ${styles.text}`}>{trait.name}</h3>
            <p className="text-gray-400 text-sm italic mt-0.5">"{trait.tagline}"</p>
          </div>
        </div>
        <p className="text-gray-400 text-xs mt-3 leading-relaxed">{trait.lore}</p>
      </div>
      <div className="px-5 py-4 bg-black/40 border-t border-white/5">
        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2 font-semibold">Effects</p>
        <div className="flex flex-col gap-1.5">
          {trait.effects.map((eff, i) => <EffectBadge key={i} eff={eff} />)}
        </div>
      </div>
    </div>
  );
}

const RARITY_DROP_RATES: Record<string, string> = {
  Common: "~40%", Uncommon: "~29%", Rare: "~19%", Epic: "~9%", Legendary: "~2.3%", Mythic: "~0.7%",
};

export default function Traits() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [codexOpen, setCodexOpen] = useState(false);
  const [codexRarity, setCodexRarity] = useState<string>("all");

  const { data: account } = useQuery<any>({ queryKey: ["/api/accounts/me"] });
  const acctId = account?.id;

  const { data: traitData, isLoading } = useQuery<{ traits: Trait[]; allTraits: Trait[] }>({
    queryKey: [`/api/accounts/${acctId}/traits`],
    enabled: !!acctId,
  });

  const assignMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/accounts/${acctId}/traits/assign`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/accounts/${acctId}/traits`] });
      toast({ title: "Traits assigned!", description: "Your genetic blueprint has been determined." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!account) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Please log in.</p>
    </div>
  );

  const myTraits = traitData?.traits ?? [];
  const allTraits = traitData?.allTraits ?? [];
  const hasTraits = myTraits.length > 0;

  const topRarity = hasTraits
    ? RARITY_ORDER.slice().reverse().find(r => myTraits.some((t: Trait) => t.rarity === r)) ?? "Common"
    : null;

  const filteredCodex = allTraits.filter(t => codexRarity === "all" || t.rarity === codexRarity);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-950 via-fuchsia-950 to-violet-950 border-b border-fuchsia-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🧬</div>
            <div>
              <h1 className="text-2xl font-bold text-fuchsia-200">Genetic Traits</h1>
              <p className="text-fuchsia-400 text-sm">Permanent gifts written into your blood at birth — unchangeable, uniquely yours</p>
            </div>
          </div>
          {topRarity && (
            <div className={`text-right text-xs font-bold px-3 py-1 rounded-full ${RARITY_STYLES[topRarity as keyof typeof RARITY_STYLES]?.badge ?? ""}`}>
              Best: {topRarity}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* No traits yet */}
        {!isLoading && !hasTraits && (
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-5xl mb-4">🧬</p>
            <p className="text-white font-bold text-lg mb-2">No Traits Assigned</p>
            <p className="text-gray-400 text-sm mb-6">Your genetic blueprint has not been read yet. The traits you receive are permanent and cannot be changed.</p>
            <button
              onClick={() => assignMut.mutate()}
              disabled={assignMut.isPending}
              className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-fuchsia-700 to-violet-700 hover:from-fuchsia-600 hover:to-violet-600 transition-all disabled:opacity-50">
              {assignMut.isPending ? "Reading Blueprint…" : "🧬 Reveal My Genetic Traits"}
            </button>
          </div>
        )}

        {/* My 3 traits */}
        {hasTraits && (
          <>
            <div>
              <h2 className="text-fuchsia-300 font-bold text-lg mb-3">Your Genetic Blueprint</h2>
              <p className="text-gray-500 text-sm mb-4">
                These 3 traits were assigned at your creation and are permanently woven into your character. They cannot be removed, rerolled, or transferred.
              </p>
              <div className="space-y-4">
                {myTraits.map((trait: Trait) => <TraitCard key={trait.id} trait={trait} />)}
              </div>
            </div>

            {/* Summary of all active bonuses */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h3 className="font-bold text-gray-200 mb-3">📊 Combined Trait Bonuses</h3>
              <div className="grid grid-cols-2 gap-2">
                {myTraits.flatMap((t: Trait) => t.effects).map((eff, i) => (
                  <div key={i} className="bg-gray-800/60 rounded px-3 py-1.5 text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-emerald-400 text-xs">✓</span>
                    {eff.description}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Trait Codex toggle */}
        <div>
          <button
            onClick={() => setCodexOpen(!codexOpen)}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl py-3 font-semibold text-gray-300 flex items-center justify-center gap-2 transition-all">
            {codexOpen ? "▲ Hide" : "▼ Open"} Trait Codex ({allTraits.length} traits)
          </button>

          {codexOpen && (
            <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              {/* Rarity filter */}
              <div className="flex gap-1 p-3 border-b border-gray-700 overflow-x-auto">
                {["all", ...RARITY_ORDER].map(r => (
                  <button key={r} onClick={() => setCodexRarity(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${codexRarity === r ? "bg-fuchsia-700 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}>
                    {r === "all" ? "All" : `${RARITY_STYLES[r as keyof typeof RARITY_STYLES]?.star ?? ""} ${r}`}
                    {r !== "all" && <span className="ml-1 opacity-60">{RARITY_DROP_RATES[r] ?? ""}</span>}
                  </button>
                ))}
              </div>
              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                {filteredCodex.map((t: Trait) => (
                  <TraitCard key={t.id} trait={t} size="compact" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 p-5 text-sm text-gray-400 space-y-2">
          <p className="font-semibold text-gray-300 mb-2">How Genetic Traits Work</p>
          <p>• Every player is assigned exactly <strong className="text-white">3 traits</strong> at character creation — these are permanent.</p>
          <p>• Traits are rolled across 3 progressively luckier slots — your third slot can reach Mythic rarity.</p>
          <p>• Trait bonuses stack with all other bonuses: race, prestige, equipment, skills, and base rooms.</p>
          <p>• Stat multipliers from traits are applied before combat calculations, making high-rarity traits genuinely impactful at all stages of the game.</p>
          <p>• Special traits (Undying Will, True Sight, etc.) have unique mechanics that fire during combat automatically.</p>
        </div>
      </div>
    </div>
  );
}
