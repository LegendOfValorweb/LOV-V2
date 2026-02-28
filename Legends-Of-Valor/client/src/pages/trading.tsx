import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Account, InventoryItem, Trade, TradeItem, SoulLink } from "@shared/schema";
import { useGame } from "@/lib/game-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeftRight, 
  Package, 
  ShoppingBag, 
  LogOut, 
  Shield, 
  Heart, 
  Sparkles,
  Plus,
  Check,
  X,
  Clock,
  Link2,
  History,
  Lock,
  Timer,
  Coins
} from "lucide-react";
import { ALL_ITEMS } from "@/lib/items-data";

type TradeWithDetails = Trade & {
  initiatorName: string;
  recipientName: string;
  items: TradeItem[];
};

type SoulLinkWithDetails = SoulLink & {
  player1Name: string;
  player2Name: string;
  player1Stats?: any;
  player2Stats?: any;
};

type TradeHistoryEntry = {
  id: string;
  tradeId: string;
  initiatorId: string;
  recipientId: string;
  initiatorName: string;
  recipientName: string;
  initiatorItems: { type: string; refId: string; name: string }[];
  recipientItems: { type: string; refId: string; name: string }[];
  status: string;
  completedAt: string;
};

function TimeLockCountdown({ timeLockUntil }: { timeLockUntil: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(timeLockUntil).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timeLockUntil]);

  if (remaining <= 0) return <Badge variant="outline" className="text-green-500"><Lock className="w-3 h-3 mr-1" /> Ready to confirm</Badge>;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <Badge variant="outline" className="text-amber-500">
      <Timer className="w-3 h-3 mr-1" /> Time lock: {mins}:{secs.toString().padStart(2, "0")}
    </Badge>
  );
}

export default function Trading() {
  const [, navigate] = useLocation();
  const { account, inventory } = useGame();
  const { toast } = useToast();

  const [newTradeDialog, setNewTradeDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [addItemsDialog, setAddItemsDialog] = useState(false);
  const [itemsToAdd, setItemsToAdd] = useState<string[]>([]);
  const [soulLinkDialog, setSoulLinkDialog] = useState(false);
  const [soulLinkTarget, setSoulLinkTarget] = useState<string>("");

  const { data: players = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery<TradeWithDetails[]>({
    queryKey: ["/api/trades", account?.id],
    enabled: !!account?.id,
    refetchInterval: 5000,
  });

  const { data: soulLinks = [] } = useQuery<SoulLinkWithDetails[]>({
    queryKey: ["/api/soul-links", account?.id],
    enabled: !!account?.id,
  });

  const { data: tradeHistoryData = [] } = useQuery<TradeHistoryEntry[]>({
    queryKey: ["/api/trade-history", account?.id],
    enabled: !!account?.id,
  });

  const createTradeMutation = useMutation({
    mutationFn: async () => {
      if (!account || !selectedRecipient) return;
      const trade = await apiRequest("POST", "/api/trades", {
        initiatorId: account.id,
        recipientId: selectedRecipient,
      });
      return trade.json();
    },
    onSuccess: (trade) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Trade created!", description: "Add items to your offer." });
      setNewTradeDialog(false);
      setSelectedRecipient("");
      if (trade) {
        setActiveTradeId(trade.id);
        setAddItemsDialog(true);
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to create trade";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const addItemsMutation = useMutation({
    mutationFn: async ({ tradeId, itemIds }: { tradeId: string; itemIds: string[] }) => {
      if (!account) return { succeeded: [], failed: [] };
      const succeeded: string[] = [];
      const failed: string[] = [];
      
      for (const itemId of itemIds) {
        try {
          await apiRequest("POST", `/api/trades/${tradeId}/items`, {
            ownerId: account.id,
            type: "item",
            refId: itemId,
          });
          succeeded.push(itemId);
        } catch (error) {
          failed.push(itemId);
        }
      }
      
      return { succeeded, failed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      
      if (!result) return;
      
      const { succeeded, failed } = result;
      
      if (failed.length === 0) {
        toast({ title: "Items added to trade!" });
      } else if (succeeded.length === 0) {
        toast({ title: "Failed to add items", variant: "destructive" });
      } else {
        toast({ 
          title: "Partial success", 
          description: `${succeeded.length} item(s) added, ${failed.length} item(s) failed`,
          variant: "destructive" 
        });
      }
      
      setAddItemsDialog(false);
      setItemsToAdd([]);
    },
    onError: () => {
      toast({ title: "Failed to add items", variant: "destructive" });
    },
  });

  const acceptTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!account) return;
      const res = await apiRequest("PATCH", `/api/trades/${tradeId}/accept`, {
        accountId: account.id,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      if (data?.timeLockUntil) {
        toast({ title: "Both parties accepted!", description: "Time lock active. You can confirm after the lock expires." });
      } else {
        toast({ title: "Trade accepted! Waiting for other party." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept trade", description: error.message, variant: "destructive" });
    },
  });

  const confirmTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!account) return;
      await apiRequest("PATCH", `/api/trades/${tradeId}/confirm`, {
        accountId: account.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade-history"] });
      toast({ title: "Trade completed!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to confirm trade", description: error.message, variant: "destructive" });
    },
  });

  const cancelTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      await apiRequest("PATCH", `/api/trades/${tradeId}/cancel`, {
        accountId: account?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Trade cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel trade", variant: "destructive" });
    },
  });

  const createSoulLinkMutation = useMutation({
    mutationFn: async () => {
      if (!account || !soulLinkTarget) return;
      const res = await apiRequest("POST", "/api/soul-links", {
        player1Id: account.id,
        player2Id: soulLinkTarget,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/soul-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Soul Link Established!", description: data?.message });
      setSoulLinkDialog(false);
      setSoulLinkTarget("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create soul link", description: error.message, variant: "destructive" });
    },
  });

  const cancelSoulLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      if (!account) return;
      await apiRequest("PATCH", `/api/soul-links/${linkId}/cancel`, {
        accountId: account.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soul-links"] });
      toast({ title: "Soul link cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel soul link", variant: "destructive" });
    },
  });

  const otherPlayers = useMemo(() => {
    return players.filter(p => p.id !== account?.id && p.role === "player");
  }, [players, account]);

  const activeTrades = useMemo(() => {
    return trades.filter(t => t.status === "pending" || t.status === "accepted");
  }, [trades]);

  const completedTrades = useMemo(() => {
    return trades.filter(t => t.status === "completed");
  }, [trades]);

  const cancelledTrades = useMemo(() => {
    return trades.filter(t => t.status === "cancelled");
  }, [trades]);

  const getItemById = (itemId: string) => {
    return ALL_ITEMS.find(item => item.id === itemId);
  };

  const getItemByInventoryId = (inventoryItemId: string) => {
    const invItem = inventory.find(i => i.id === inventoryItemId);
    if (invItem) {
      return ALL_ITEMS.find(item => item.id === invItem.itemId);
    }
    return null;
  };

  const getTradeItemDetails = (tradeItem: TradeItem) => {
    if (tradeItem.type === "item") {
      const item = getItemByInventoryId(tradeItem.refId);
      return { type: "item" as const, item, refId: tradeItem.refId };
    }
    if (tradeItem.type === "skill") {
      return { type: "skill" as const, skillId: tradeItem.refId };
    }
    return null;
  };

  const handleLogout = () => {
    navigate("/");
  };

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  return (
    <div className="h-full bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <h1 className="font-serif text-xl font-bold text-foreground" data-testid="text-trading-title">
                <ArrowLeftRight className="inline w-6 h-6 mr-2 text-primary" />
                Player Trading
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")} data-testid="button-nav-shop">
                <ShoppingBag className="w-4 h-4 mr-2" /> Shop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} data-testid="button-nav-inventory">
                <Package className="w-4 h-4 mr-2" /> Inventory
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/guild")} data-testid="button-nav-guild">
                <Shield className="w-4 h-4 mr-2" /> Guild
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pets")} data-testid="button-nav-pets">
                <Heart className="w-4 h-4 mr-2" /> Pets
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-muted-foreground">Trade items and skills with other players, or soul-link for shared stats</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={soulLinkDialog} onOpenChange={setSoulLinkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-soul-link">
                  <Link2 className="w-4 h-4 mr-2" />
                  Soul Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Create Soul Link</DialogTitle>
                  <DialogDescription>
                    Soul-link with another player to temporarily share 10% of each other's stats. Costs 50,000 gold each. Lasts 1 hour.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label>Select Player</Label>
                  <Select value={soulLinkTarget} onValueChange={setSoulLinkTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a player..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherPlayers.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.username} ({player.rank})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    <Coins className="inline w-3 h-3 mr-1" />
                    Cost: 50,000 gold per player
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSoulLinkDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => createSoulLinkMutation.mutate()}
                    disabled={!soulLinkTarget || createSoulLinkMutation.isPending}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Create Soul Link
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={newTradeDialog} onOpenChange={setNewTradeDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-trade">
                  <Plus className="w-4 h-4 mr-2" />
                  New Trade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Start a Trade</DialogTitle>
                  <DialogDescription>
                    Select a player to trade with. Both players must be at least Apprentice rank, and within 5 ranks of each other.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label>Select Player</Label>
                  <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                    <SelectTrigger data-testid="select-trade-recipient">
                      <SelectValue placeholder="Choose a player..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherPlayers.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.username} ({player.rank})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewTradeDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createTradeMutation.mutate()}
                    disabled={!selectedRecipient || createTradeMutation.isPending}
                    data-testid="button-create-trade"
                  >
                    Create Trade
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {soulLinks.length > 0 && (
          <div className="mb-6">
            <h3 className="font-serif text-lg font-bold mb-3">
              <Link2 className="inline w-5 h-5 mr-2 text-purple-500" />
              Active Soul Links
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {soulLinks.map(link => {
                const partnerId = link.player1Id === account.id ? link.player2Id : link.player1Id;
                const partnerName = link.player1Id === account.id ? link.player2Name : link.player1Name;
                const partnerStats = link.player1Id === account.id ? link.player2Stats : link.player1Stats;
                const expiresAt = new Date(link.expiresAt);
                const timeLeft = Math.max(0, expiresAt.getTime() - Date.now());
                const minsLeft = Math.ceil(timeLeft / 60000);

                return (
                  <Card key={link.id} className="border-purple-500/30">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Linked with {partnerName}</p>
                          <p className="text-xs text-muted-foreground">
                            Sharing {link.statSharePercent}% stats | {minsLeft} min remaining
                          </p>
                          {partnerStats && (
                            <p className="text-xs text-purple-400 mt-1">
                              Bonus: +{Math.floor((partnerStats.Str || 10) * link.statSharePercent / 100)} Str,
                              +{Math.floor((partnerStats.Def || 10) * link.statSharePercent / 100)} Def,
                              +{Math.floor((partnerStats.Spd || 10) * link.statSharePercent / 100)} Spd,
                              +{Math.floor((partnerStats.Int || 10) * link.statSharePercent / 100)} Int
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelSoulLinkMutation.mutate(link.id)}
                          disabled={cancelSoulLinkMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-pending-trades">
              <Clock className="w-4 h-4 mr-2" />
              Active ({activeTrades.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-trades">
              <Check className="w-4 h-4 mr-2" />
              Completed ({completedTrades.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              History ({tradeHistoryData.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled-trades">
              <X className="w-4 h-4 mr-2" />
              Cancelled ({cancelledTrades.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {tradesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading trades...</div>
            ) : activeTrades.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active trades</p>
                  <p className="text-sm">Start a new trade with another player!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeTrades.map(trade => {
                  const isInitiator = trade.initiatorId === account.id;
                  const otherPlayer = isInitiator ? trade.recipientName : trade.initiatorName;
                  const myItems = trade.items.filter(item => item.ownerId === account.id);
                  const theirItems = trade.items.filter(item => item.ownerId !== account.id);
                  const iAccepted = (isInitiator && trade.initiatorAccepted) || (!isInitiator && trade.recipientAccepted);
                  const theyAccepted = (isInitiator && trade.recipientAccepted) || (!isInitiator && trade.initiatorAccepted);
                  const bothAccepted = trade.initiatorAccepted && trade.recipientAccepted;
                  const hasTimeLock = !!trade.timeLockUntil;
                  const timeLockExpired = hasTimeLock && new Date(trade.timeLockUntil!) <= new Date();

                  return (
                    <Card key={trade.id} data-testid={`card-trade-${trade.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-lg font-serif">
                            Trade with {otherPlayer}
                          </CardTitle>
                          <div className="flex gap-2 flex-wrap">
                            {iAccepted && <Badge variant="outline" className="text-green-500">You Accepted</Badge>}
                            {theyAccepted && <Badge variant="outline" className="text-blue-500">They Accepted</Badge>}
                            {hasTimeLock && (
                              <TimeLockCountdown timeLockUntil={trade.timeLockUntil!.toString()} />
                            )}
                          </div>
                        </div>
                        <CardDescription>
                          {isInitiator ? "You initiated this trade" : `${trade.initiatorName} wants to trade with you`}
                          {trade.status === "accepted" && " — Both parties accepted, waiting for time lock"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Your Offer</h4>
                            <div className="p-3 rounded-lg border min-h-[80px]">
                              {myItems.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No items added yet</p>
                              ) : (
                                <div className="space-y-1">
                                  {myItems.map((item, idx) => {
                                    const details = getTradeItemDetails(item);
                                    if (!details) return null;
                                    if (details.type === "item" && details.item) {
                                      return (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <Package className="w-4 h-4" />
                                          {details.item.name}
                                        </div>
                                      );
                                    }
                                    if (details.type === "skill") {
                                      return (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <Sparkles className="w-4 h-4 text-purple-500" />
                                          Skill
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Their Offer</h4>
                            <div className="p-3 rounded-lg border min-h-[80px]">
                              {theirItems.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Waiting for their offer...</p>
                              ) : (
                                <div className="space-y-1">
                                  {theirItems.map((item, idx) => {
                                    const details = getTradeItemDetails(item);
                                    if (!details) return null;
                                    if (details.type === "item" && details.item) {
                                      return (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <Package className="w-4 h-4" />
                                          {details.item.name}
                                        </div>
                                      );
                                    }
                                    if (details.type === "skill") {
                                      return (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <Sparkles className="w-4 h-4 text-purple-500" />
                                          Skill
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {trade.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveTradeId(trade.id);
                                setAddItemsDialog(true);
                              }}
                              data-testid={`button-add-items-${trade.id}`}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Items
                            </Button>
                          )}
                          {!iAccepted && trade.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => acceptTradeMutation.mutate(trade.id)}
                              disabled={acceptTradeMutation.isPending}
                              data-testid={`button-accept-trade-${trade.id}`}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Accept Trade
                            </Button>
                          )}
                          {bothAccepted && hasTimeLock && timeLockExpired && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => confirmTradeMutation.mutate(trade.id)}
                              disabled={confirmTradeMutation.isPending}
                              data-testid={`button-confirm-trade-${trade.id}`}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Confirm & Complete Trade
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelTradeMutation.mutate(trade.id)}
                            disabled={cancelTradeMutation.isPending}
                            data-testid={`button-cancel-trade-${trade.id}`}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedTrades.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Check className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No completed trades yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {completedTrades.map(trade => (
                  <Card key={trade.id} className="opacity-75">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-serif">
                        Trade with {trade.initiatorId === account.id ? trade.recipientName : trade.initiatorName}
                      </CardTitle>
                      <CardDescription>Completed</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {tradeHistoryData.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No trade history yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tradeHistoryData.map(entry => {
                  const isInitiator = entry.initiatorId === account.id;
                  return (
                    <Card key={entry.id} className="opacity-85">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-serif">
                          Trade with {isInitiator ? entry.recipientName : entry.initiatorName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(entry.completedAt).toLocaleString()} — {entry.status}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-medium mb-1">{entry.initiatorName} offered:</p>
                            {entry.initiatorItems.length === 0 ? (
                              <p className="text-muted-foreground">Nothing</p>
                            ) : (
                              entry.initiatorItems.map((item, i) => (
                                <p key={i}>{item.name} ({item.type})</p>
                              ))
                            )}
                          </div>
                          <div>
                            <p className="font-medium mb-1">{entry.recipientName} offered:</p>
                            {entry.recipientItems.length === 0 ? (
                              <p className="text-muted-foreground">Nothing</p>
                            ) : (
                              entry.recipientItems.map((item, i) => (
                                <p key={i}>{item.name} ({item.type})</p>
                              ))
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled">
            {cancelledTrades.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <X className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No cancelled trades</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {cancelledTrades.map(trade => (
                  <Card key={trade.id} className="opacity-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-serif">
                        Trade with {trade.initiatorId === account.id ? trade.recipientName : trade.initiatorName}
                      </CardTitle>
                      <CardDescription>Cancelled</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={addItemsDialog} onOpenChange={setAddItemsDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="font-serif">Add to Trade</DialogTitle>
              <DialogDescription>
                Select items to add to your offer
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <div className="space-y-2">
                <Label>Your Inventory Items</Label>
                <ScrollArea className="h-48 border rounded-md p-2">
                  {inventory.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No items in inventory</p>
                  ) : (
                    <div className="space-y-2">
                      {inventory.map(invItem => {
                        const item = getItemById(invItem.itemId);
                        if (!item) return null;
                        return (
                          <div
                            key={invItem.id}
                            className="flex items-center gap-2 p-2 rounded-lg border hover-elevate cursor-pointer"
                            onClick={() => {
                              setItemsToAdd(prev => 
                                prev.includes(invItem.id) 
                                  ? prev.filter(id => id !== invItem.id)
                                  : [...prev, invItem.id]
                              );
                            }}
                            data-testid={`item-select-${invItem.id}`}
                          >
                            <Checkbox
                              checked={itemsToAdd.includes(invItem.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setItemsToAdd(prev => [...prev, invItem.id]);
                                } else {
                                  setItemsToAdd(prev => prev.filter(id => id !== invItem.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.tier.replace("_", " ")} {item.type}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button variant="outline" onClick={() => setAddItemsDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (activeTradeId && itemsToAdd.length > 0) {
                    addItemsMutation.mutate({
                      tradeId: activeTradeId,
                      itemIds: itemsToAdd,
                    });
                  }
                }}
                disabled={addItemsMutation.isPending || itemsToAdd.length === 0}
                data-testid="button-confirm-add-items"
              >
                Add to Trade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
