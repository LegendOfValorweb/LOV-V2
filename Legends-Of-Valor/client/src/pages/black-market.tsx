import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skull, ShoppingBag, Clock, AlertTriangle, Gem, LogOut } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BlackMarket() {
  const [, navigate] = useLocation();
  const { account, logout } = useGame();
  const { toast } = useToast();
  const [confirmItem, setConfirmItem] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/black-market"],
    queryFn: async () => {
      const res = await fetch("/api/black-market");
      if (!res.ok) throw new Error("Failed to fetch black market");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data?.refreshesAt) return;
    const tick = () => {
      const diff = data.refreshesAt - Date.now();
      if (diff <= 0) { setTimeLeft("Refreshing..."); refetch(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.refreshesAt]);

  const purchaseMutation = useMutation({
    mutationFn: async ({ accountId, itemId }: { accountId: string; itemId: string }) => {
      const res = await apiRequest("POST", "/api/black-market/purchase", { accountId, itemId });
      return res.json();
    },
    onSuccess: (result) => {
      setConfirmItem(null);
      if (result.counterfeit) {
        toast({
          title: "You got scammed!",
          description: "The item was a counterfeit — worthless junk.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Purchase successful!",
          description: `${result.item?.name} added to your inventory.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
    },
    onError: (err: any) => {
      setConfirmItem(null);
      toast({ title: "Purchase failed", description: err?.message || "Server error", variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const rubies = (account as any)?.rubies || 0;

  const statTypeColor: Record<string, string> = {
    weapon: "text-red-400",
    armor: "text-blue-400",
    accessory: "text-purple-400",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground">
      <header className="border-b border-red-900/40 bg-black/90 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold font-serif text-red-400 flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Black Market
            </h1>
            <nav className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/world-map")}>World Map</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")}>
                <ShoppingBag className="w-4 h-4 mr-1" />Shop
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm flex items-center gap-1 text-purple-300">
              <Gem className="w-4 h-4" /> {rubies.toLocaleString()} Rubies
            </span>
            <span className="text-sm text-muted-foreground">{account?.username}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          <div className="bg-red-950/30 border border-red-500/40 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Illegal Goods — Buy at Your Own Risk</p>
              <p className="text-sm text-red-400/80 mt-1">
                Items here are of questionable origin. There is a 10% chance any item is a counterfeit — you won't know until after purchase.
                No refunds. No questions asked.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-amber-200">Today's Offerings</h2>
            {timeLeft && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Refreshes in: <span className="font-mono text-amber-400">{timeLeft}</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading black market...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(data?.items || []).map((item: any) => (
                <Card key={item.id} className="bg-zinc-900/80 border-red-900/40 hover:border-red-500/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <span className={`font-semibold ${statTypeColor[item.type] || "text-foreground"}`}>
                        💀 {item.name}
                      </span>
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <Gem className="w-3 h-3" /> {item.rubyPrice}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Type: {item.type}</span>
                        <span>Tier: {item.tier}</span>
                      </div>
                      {item.special && (
                        <p className="text-amber-400 font-medium">✦ {item.special}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.stats || {}).map(([k, v]) => (
                          <span key={k} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                            {k}: {v as number}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-red-400/80">
                      <AlertTriangle className="w-3 h-3" />
                      10% counterfeit risk
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-red-900/60 hover:bg-red-800/80 border border-red-700/40"
                      disabled={rubies < item.rubyPrice}
                      onClick={() => setConfirmItem(item)}
                      data-testid={`button-buy-${item.id}`}
                    >
                      {rubies < item.rubyPrice ? "Not enough Rubies" : "Purchase"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-8 p-4 bg-zinc-900/40 border border-white/5 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">
              The Black Market refreshes every 6 hours. Items are sourced from... undisclosed channels.
              All sales are final. The market bears no responsibility for counterfeit goods.
            </p>
          </div>
        </div>
      </main>

      <Dialog open={!!confirmItem} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent className="bg-zinc-900 border-red-900/40">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Confirm Purchase
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to buy <strong>{confirmItem?.name}</strong> for <strong>{confirmItem?.rubyPrice} Rubies</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-950/30 border border-red-500/30 rounded p-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Remember: there is a 10% chance this item is a counterfeit. You will not know until after purchase.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!account || !confirmItem) return;
                purchaseMutation.mutate({ accountId: account.id, itemId: confirmItem.id });
              }}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? "Purchasing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
