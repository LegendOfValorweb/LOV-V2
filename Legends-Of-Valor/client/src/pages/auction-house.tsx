import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Gavel, 
  Clock, 
  TrendingUp, 
  Coins, 
  ArrowLeft, 
  Search, 
  Filter,
  Plus,
  Zap,
  Shield,
  Sword,
  Gem
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Auction, InventoryItem, PlayerSkill } from "@shared/schema";
import { getItemById } from "@/lib/items-data";
import { ALL_SKILLS, getSkillById } from "@shared/skills-data";

export default function AuctionHouse() {
  const [, navigate] = useLocation();
  const { account, refetchAccount } = useGame();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("gold");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedItemForAuction, setSelectedItemForAuction] = useState<string | null>(null);
  const [itemType, setItemType] = useState<"item" | "skill">("item");
  const [startingPrice, setStartingPrice] = useState(100);
  const [duration, setDuration] = useState(24);
  const [minIncrement, setMinIncrement] = useState(1);

  const { data: auctions = [], isLoading: isAuctionsLoading } = useQuery<Auction[]>({
    queryKey: ["/api/auctions", { type: activeTab }],
    refetchInterval: 10000,
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    enabled: isCreateDialogOpen && itemType === "item",
  });

  const { data: playerSkills = [] } = useQuery<PlayerSkill[]>({
    queryKey: ["/api/player-skills"],
    enabled: isCreateDialogOpen && itemType === "skill",
  });

  const handleCreateAuction = async () => {
    if (!selectedItemForAuction) return;
    try {
      await apiRequest("POST", "/api/auctions", {
        itemId: selectedItemForAuction,
        itemType,
        startingPrice,
        duration,
        type: activeTab,
        minIncrement,
      });
      toast({ title: "Auction created!" });
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      refetchAccount?.();
    } catch (error: any) {
      toast({ title: "Failed to create auction", description: error.message, variant: "destructive" });
    }
  };

  const handleBid = async (auctionId: string, amount: number) => {
    try {
      await apiRequest("POST", `/api/auctions/${auctionId}/bid`, { amount });
      toast({ title: "Bid placed successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      refetchAccount?.();
    } catch (error: any) {
      toast({ title: "Failed to place bid", description: error.message, variant: "destructive" });
    }
  };

  if (!account) return null;

  return (
    <div className="h-full relative overflow-hidden bg-slate-950 text-slate-100">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: "url('/backdrops/shop.png')" }}
      />
      
      <div className="relative z-10 flex flex-col h-full">
        <header className="border-b border-amber-500/30 bg-black/60 backdrop-blur p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/world-map")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="font-serif text-2xl font-bold text-amber-400 flex items-center gap-2">
                <Gavel className="w-6 h-6" />
                Auction House
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-400">Balance</p>
                <div className="flex gap-4">
                  <p className="text-amber-400 font-bold flex items-center gap-1">
                    <Coins className="w-4 h-4" /> {account.gold.toLocaleString()}
                  </p>
                  <p className="text-red-400 font-bold flex items-center gap-1">
                    <Zap className="w-4 h-4" /> {account.valorTokens.toLocaleString()}
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" /> List Item
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="container mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-900/50 border border-slate-800">
                <TabsTrigger value="gold" className="data-[state=active]:bg-amber-600">Gold Auctions</TabsTrigger>
                <TabsTrigger value="vip" className="data-[state=active]:bg-red-600">VIP Auctions ($Valor)</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {isAuctionsLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
                  </div>
                ) : auctions.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/30 rounded-xl border border-slate-800">
                    <Gavel className="w-16 h-16 mx-auto text-slate-700 mb-4" />
                    <h3 className="text-xl font-bold text-slate-400">No active auctions</h3>
                    <p className="text-slate-500">Be the first to list an item!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {auctions.map((auction) => {
                      const itemData = auction.itemType === "item" ? getItemById(auction.itemId) : getSkillById(auction.itemId);
                      const timeLeft = Math.max(0, new Date(auction.endAt).getTime() - Date.now());
                      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                      return (
                        <Card key={auction.id} className="bg-slate-900/80 border-slate-800 overflow-hidden group hover:border-amber-500/50 transition-all">
                          <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                              <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-400">
                                {auction.itemType}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-amber-400">
                                <Clock className="w-3 h-3" />
                                {hoursLeft}h {minutesLeft}m
                              </div>
                            </div>
                            <CardTitle className="text-lg text-slate-100 group-hover:text-amber-400 transition-colors">
                              {itemData?.name || "Unknown Item"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-4">
                            <div className="aspect-square rounded-lg bg-slate-800/50 flex items-center justify-center border border-slate-700">
                               {auction.itemType === "item" ? <Package className="w-12 h-12 text-slate-600" /> : <Zap className="w-12 h-12 text-amber-500" />}
                            </div>
                            
                            <div className="space-y-1">
                              <p className="text-xs text-slate-500">Current Bid</p>
                              <p className="text-xl font-bold flex items-center gap-1">
                                {auction.type === "gold" ? <Coins className="w-5 h-5 text-amber-400" /> : <Zap className="w-5 h-5 text-red-400" />}
                                {auction.currentBid.toLocaleString()}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <Button 
                                size="sm" 
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700"
                                onClick={() => handleBid(auction.id, Math.floor(auction.currentBid * (1 + (auction.minIncrement / 100))))}
                                disabled={auction.sellerId === account.id}
                              >
                                Min Bid
                              </Button>
                              <Button 
                                size="sm" 
                                className="bg-amber-600 hover:bg-amber-700"
                                onClick={() => {
                                   const amount = prompt("Enter bid amount:");
                                   if (amount) handleBid(auction.id, parseInt(amount));
                                }}
                                disabled={auction.sellerId === account.id}
                              >
                                Custom
                              </Button>
                            </div>
                            {auction.sellerId === account.id && (
                              <p className="text-[10px] text-center text-amber-500/70 italic">Your Listing</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-amber-400 font-serif text-xl">List Item for Auction</DialogTitle>
            <DialogDescription className="text-slate-400">Choose an item or skill from your inventory to list.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={itemType} onValueChange={(v: any) => { setItemType(v); setSelectedItemForAuction(null); }}>
                  <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="item">Equipment</SelectItem>
                    <SelectItem value="skill">Spell / Skill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select {itemType === "item" ? "Equipment" : "Skill"}</Label>
                <Select value={selectedItemForAuction || ""} onValueChange={setSelectedItemForAuction}>
                  <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {itemType === "item" ? 
                      inventory.map(inv => <SelectItem key={inv.id} value={inv.id}>{getItemById(inv.itemId)?.name}</SelectItem>) :
                      playerSkills.map(ps => <SelectItem key={ps.id} value={ps.id}>{getSkillById(ps.skillId)?.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Starting Price</Label>
                <Input type="number" value={startingPrice} onChange={e => setStartingPrice(parseInt(e.target.value))} className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label>Duration (h)</Label>
                <Select value={duration.toString()} onValueChange={v => setDuration(parseInt(v))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="12">12 Hours</SelectItem>
                    <SelectItem value="24">24 Hours</SelectItem>
                    <SelectItem value="48">48 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min Inc (%)</Label>
                <Input type="number" min="1" max="5" value={minIncrement} onChange={e => setMinIncrement(parseInt(e.target.value))} className="bg-slate-800 border-slate-700" />
              </div>
            </div>
            
            <div className="p-3 bg-amber-500/10 rounded border border-amber-500/20 text-xs text-amber-200">
              <p>Listing Fee: 5% of starting price ({Math.floor(startingPrice * 0.05).toLocaleString()} Gold)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAuction} className="bg-amber-600 hover:bg-amber-700" disabled={!selectedItemForAuction}>
              Start Auction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  )
}
