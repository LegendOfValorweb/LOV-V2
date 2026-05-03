import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Lock, Unlock, Sparkles, Shield, Swords, Star,
  ChevronUp, CheckCircle, LogOut,
} from "lucide-react";
import type { SkillTreeNodeDef } from "@shared/skill-tree-data";

// ─── types ────────────────────────────────────────────────────────────────────
type NodeWithState = SkillTreeNodeDef & { isUnlocked: boolean; canUnlock: boolean };

// ─── palette ─────────────────────────────────────────────────────────────────
const BRANCH_STYLE = {
  combat: {
    label: "Combat",
    icon: <Swords className="h-4 w-4" />,
    color: "text-red-400",
    bg: "from-red-950/50 to-black",
    border: "border-red-700/40",
    activeBorder: "border-red-400",
    nodeActive: "bg-red-950/60 border-red-500",
    nodeUnlocked: "bg-red-900/40 border-red-600/60",
    nodeLocked: "bg-black/30 border-slate-700/40",
    tab: "data-[state=active]:bg-red-900",
  },
  mastery: {
    label: "Mastery",
    icon: <Shield className="h-4 w-4" />,
    color: "text-blue-400",
    bg: "from-blue-950/50 to-black",
    border: "border-blue-700/40",
    activeBorder: "border-blue-400",
    nodeActive: "bg-blue-950/60 border-blue-500",
    nodeUnlocked: "bg-blue-900/40 border-blue-600/60",
    nodeLocked: "bg-black/30 border-slate-700/40",
    tab: "data-[state=active]:bg-blue-900",
  },
  ascension: {
    label: "Ascension",
    icon: <Star className="h-4 w-4" />,
    color: "text-purple-400",
    bg: "from-purple-950/50 to-black",
    border: "border-purple-700/40",
    activeBorder: "border-purple-400",
    nodeActive: "bg-purple-950/60 border-purple-500",
    nodeUnlocked: "bg-purple-900/40 border-purple-600/60",
    nodeLocked: "bg-black/30 border-slate-700/40",
    tab: "data-[state=active]:bg-purple-900",
  },
} as const;

// ─── single node card ─────────────────────────────────────────────────────────
function NodeCard({
  node, style, onUnlock, unlocking,
}: {
  node: NodeWithState;
  style: typeof BRANCH_STYLE[keyof typeof BRANCH_STYLE];
  onUnlock: (id: string) => void;
  unlocking: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const tierLabel = ["", "I", "II", "II", "IV"][node.tier];

  const borderClass = node.isUnlocked
    ? style.nodeUnlocked
    : node.canUnlock
    ? `${style.nodeActive} ring-1 ring-offset-1 ring-offset-black ring-opacity-60 ring-current`
    : style.nodeLocked;

  return (
    <div
      className={`relative rounded-lg border p-3 cursor-pointer transition-all ${borderClass} ${node.isKeystone ? "ring-2 ring-yellow-500/40" : ""}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Keystone badge */}
      {node.isKeystone && (
        <div className="absolute -top-2 left-2">
          <Badge className="text-[10px] bg-yellow-600 text-black px-1 py-0">KEYSTONE</Badge>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className={`text-[10px] font-mono ${style.color} opacity-60`}>T{node.tier}</span>
            {node.isUnlocked && <CheckCircle className="h-3 w-3 text-green-400" />}
            {!node.isUnlocked && node.canUnlock && <Unlock className="h-3 w-3 text-yellow-400 animate-pulse" />}
            {!node.isUnlocked && !node.canUnlock && <Lock className="h-3 w-3 text-slate-600" />}
          </div>
          <p className={`text-sm font-semibold leading-tight ${node.isUnlocked ? style.color : node.canUnlock ? "text-foreground" : "text-muted-foreground"}`}>
            {node.name}
          </p>
          <p className={`text-xs mt-0.5 ${node.isUnlocked ? "text-green-300" : "text-muted-foreground"}`}>
            {node.effect.description}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {node.isUnlocked ? (
            <Badge className="bg-green-800/60 text-green-300 border-green-600/40 text-xs">Owned</Badge>
          ) : (
            <Badge className={`text-xs ${node.canUnlock ? "bg-yellow-800/60 text-yellow-300 border-yellow-600/40" : "bg-slate-800/60 text-slate-500 border-slate-600/40"}`}>
              {node.cost} TP
            </Badge>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs text-muted-foreground">
          <p className="italic">{node.lore}</p>
          <p>Rank required: <span className="text-yellow-400">{node.rankRequirement}</span></p>
          {node.prerequisites.length > 0 && (
            <p>Requires: <span className="text-orange-400">{node.prerequisites.join(" or ")}</span></p>
          )}
          {node.canUnlock && !node.isUnlocked && (
            <Button size="sm" className={`w-full mt-1 ${style.color} bg-transparent border font-bold`}
              style={{ borderColor: "currentColor" }}
              onClick={e => { e.stopPropagation(); onUnlock(node.id); }}
              disabled={unlocking}>
              {unlocking ? "Unlocking…" : `Unlock — ${node.cost} Training Points`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── branch panel ─────────────────────────────────────────────────────────────
function BranchPanel({
  branch, nodes, onUnlock, unlocking,
}: {
  branch: keyof typeof BRANCH_STYLE;
  nodes: NodeWithState[];
  onUnlock: (id: string) => void;
  unlocking: boolean;
}) {
  const style = BRANCH_STYLE[branch];
  const branchNodes = nodes.filter(n => n.branch === branch);
  const tiers: { [t: number]: NodeWithState[] } = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of branchNodes) tiers[n.tier].push(n);
  const unlockedCount = branchNodes.filter(n => n.isUnlocked).length;

  return (
    <div className={`space-y-4 p-4 rounded-xl border bg-gradient-to-br ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 font-cinzel font-bold ${style.color}`}>
          {style.icon} {style.label}
        </div>
        <Badge className="bg-black/40 text-muted-foreground border-white/10 text-xs">
          {unlockedCount}/{branchNodes.length} unlocked
        </Badge>
      </div>

      {[1, 2, 3, 4].map(tier => {
        const tierNodes = tiers[tier];
        if (!tierNodes.length) return null;
        return (
          <div key={tier} className="space-y-2">
            {tier > 1 && (
              <div className={`flex justify-center ${style.color} opacity-30`}>
                <ChevronUp className="h-4 w-4" />
              </div>
            )}
            <div className={`grid gap-2 ${tierNodes.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {tierNodes.map(n => (
                <NodeCard key={n.id} node={n} style={style} onUnlock={onUnlock} unlocking={unlocking} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function SkillTree() {
  const [, navigate] = useLocation();
  const { account, logout } = useGame();
  const { toast } = useToast();
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const { data: treeData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounts", account?.id, "skill-tree"],
    queryFn: async () => {
      if (!account?.id) return null;
      const r = await fetch(`/api/accounts/${account.id}/skill-tree`);
      if (!r.ok) throw new Error("Failed to load skill tree");
      return r.json();
    },
    enabled: !!account?.id,
  });

  const unlockMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const r = await apiRequest("POST", `/api/accounts/${account!.id}/skill-tree/unlock`, { nodeId });
      return r.json();
    },
    onMutate: (nodeId) => setUnlockingId(nodeId),
    onSuccess: (data) => {
      setUnlockingId(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
      toast({ title: `✨ ${data.nodeName} unlocked!`, description: `${data.remainingTP} training points remaining` });
    },
    onError: async (e: any) => {
      setUnlockingId(null);
      toast({ title: "Cannot unlock", description: e?.message, variant: "destructive" });
    },
  });

  if (!account) return (
    <div className="h-full flex items-center justify-center">
      <Card className="p-6"><p>Please log in.</p></Card>
    </div>
  );

  return (
    <ZoneScene zoneName="Skill Sanctum" backdrop="/backdrops/tower.png" ambientClass="zone-ambient-tower" overlayOpacity={0.55}>
      <div className="h-full flex flex-col">

        {/* Header */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/skills")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-cinzel font-bold text-primary flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Skill Tree
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Training Points: </span>
                <span className="font-bold text-yellow-400">{treeData?.trainingPoints ?? account.trainingPoints ?? 0}</span>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading skill tree…</div>
          ) : !treeData ? (
            <div className="text-center py-16 text-muted-foreground">Could not load skill tree.</div>
          ) : (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-card/60 border border-border">
                <div className="text-sm capitalize">
                  <span className="text-muted-foreground">Race: </span>
                  <span className="font-bold text-primary capitalize">{treeData.race}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Rank: </span>
                  <span className="font-bold text-yellow-400">{treeData.rank}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Nodes: </span>
                  <span className="font-bold text-green-400">{treeData.unlockedCount}/{treeData.totalNodes}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-auto">
                  Click any node to expand it. Unlock in order from top to bottom.
                </p>
              </div>

              {/* Three branch tabs on mobile, side-by-side on desktop */}
              <div className="block md:hidden">
                <Tabs defaultValue="combat">
                  <TabsList className="grid grid-cols-3 w-full">
                    {(["combat","mastery","ascension"] as const).map(b => (
                      <TabsTrigger key={b} value={b} className={BRANCH_STYLE[b].tab}>
                        {BRANCH_STYLE[b].icon}
                        <span className="ml-1 text-xs">{BRANCH_STYLE[b].label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {(["combat","mastery","ascension"] as const).map(b => (
                    <TabsContent key={b} value={b} className="mt-4">
                      <BranchPanel
                        branch={b}
                        nodes={treeData.nodes}
                        onUnlock={nodeId => unlockMutation.mutate(nodeId)}
                        unlocking={unlockMutation.isPending}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div className="hidden md:grid md:grid-cols-3 gap-4">
                {(["combat","mastery","ascension"] as const).map(b => (
                  <BranchPanel
                    key={b}
                    branch={b}
                    nodes={treeData.nodes}
                    onUnlock={nodeId => unlockMutation.mutate(nodeId)}
                    unlocking={unlockMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </ZoneScene>
  );
}
