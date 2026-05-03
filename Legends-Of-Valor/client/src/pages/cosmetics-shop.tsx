import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, User, Home, Dog, Bird, ArrowLeft, Check, Gem, Ticket, Filter
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ALL_SKINS, getSkinsForRace, getSkinById, RARITY_LABEL_COLORS, type SkinDefinition } from "@/lib/skins-data";

interface CosmeticItem {
  id: string;
  name: string;
  rarity: string;
  skinTicketCost: number;
  rubyPrice: number;
}

interface CosmeticsShop {
  character: CosmeticItem[];
  pet: CosmeticItem[];
  bird: CosmeticItem[];
  base: CosmeticItem[];
}

const rarityBg: Record<string, string> = {
  common:    "bg-gray-500/10 border-gray-500/50 text-gray-300",
  rare:      "bg-blue-500/10 border-blue-500/50 text-blue-300",
  epic:      "bg-purple-500/10 border-purple-500/50 text-purple-300",
  legendary: "bg-yellow-500/10 border-yellow-500/50 text-yellow-300",
  mythic:    "bg-red-500/10 border-red-500/50 text-red-300",
};

function SkinCard({ skin, isOwned, onBuy, onEquip }: { skin: SkinDefinition; isOwned: boolean; onBuy: () => void; onEquip: () => void }) {
  const rarityColor = RARITY_LABEL_COLORS[skin.rarity] || "#9ca3af";

  return (
    <div
      className={`relative rounded-lg border cursor-pointer transition-all hover:scale-105 ${rarityBg[skin.rarity] || rarityBg.common} ${isOwned ? "ring-2 ring-green-500/60" : ""}`}
      style={{ padding: 10 }}
      onClick={isOwned ? onEquip : onBuy}
    >
      {isOwned && (
        <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      {/* Visual preview using CSS filter */}
      <div className="flex items-center justify-center mb-2" style={{ height: 64 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${skin.glowColor}cc, ${skin.glowColor}22)`,
            border: `2px solid ${skin.glowColor}88`,
            filter: skin.cssFilter === "none" ? undefined : skin.cssFilter,
            boxShadow: `0 0 12px ${skin.glowColor}66`,
          }}
        />
      </div>
      <div className="text-center">
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: rarityColor, lineHeight: 1.3, marginBottom: 2 }}>{skin.name}</div>
        <div style={{ fontSize: "0.55rem", color: rarityColor, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{skin.rarity}</div>
      </div>
      <div className="mt-2 text-center">
        {isOwned ? (
          <span style={{ fontSize: "0.6rem", color: "#4ade80", fontWeight: 600 }}>Tap to Equip</span>
        ) : (
          <span style={{ fontSize: "0.6rem", color: "#f9a8d4" }}>
            <Gem className="inline w-3 h-3 mr-0.5" />{skin.rubyPrice.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CosmeticsShop() {
  const [, navigate] = useLocation();
  const { account, refetchAccount } = useGame();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("character");
  const [selectedSkin, setSelectedSkin] = useState<SkinDefinition | null>(null);
  const [selectedLegacy, setSelectedLegacy] = useState<{ item: CosmeticItem; category: string } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<string>("all");

  const { data: shopData } = useQuery<{ shop: CosmeticsShop }>({
    queryKey: ["/api/cosmetics-shop"],
  });

  if (!account || account.role !== "player" && account.role !== "admin") {
    navigate("/");
    return null;
  }

  const playerRace = account.race || "human";
  const ownedSkins = account.unlockedSkins || [];

  // Character skins: from skins-data.ts (race-specific + universal)
  const raceSkins = useMemo(() => {
    const skins = getSkinsForRace(playerRace);
    if (rarityFilter === "all") return skins;
    return skins.filter(s => s.rarity === rarityFilter);
  }, [playerRace, rarityFilter]);

  const shop = shopData?.shop;

  const handleBuySkin = async (skin: SkinDefinition) => {
    if ((account.rubies || 0) < skin.rubyPrice) {
      toast({ title: "Not enough Rubies", description: `Need ${skin.rubyPrice.toLocaleString()} rubies`, variant: "destructive" });
      return;
    }
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/cosmetics-shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, skinId: skin.id, category: "character", paymentType: "rubies" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purchased!", description: `${skin.name} added to your collection` });
        refetchAccount?.();
      } else {
        toast({ title: "Failed", description: data.error || "Purchase failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Purchase failed", variant: "destructive" });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleEquipSkin = async (skin: SkinDefinition) => {
    try {
      const res = await fetch("/api/cosmetics/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, skinId: skin.id, category: "character" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Equipped!", description: `${skin.name} is now active` });
        refetchAccount?.();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed", description: "Could not equip skin", variant: "destructive" });
    }
  };

  const handleLegacyPurchase = async (paymentType: "tickets" | "rubies") => {
    if (!selectedLegacy) return;
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/cosmetics-shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, skinId: selectedLegacy.item.id, category: selectedLegacy.category, paymentType }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purchase Successful!", description: `You now own ${selectedLegacy.item.name}!` });
        refetchAccount?.();
      } else {
        toast({ title: "Purchase Failed", description: data.error || "Something went wrong", variant: "destructive" });
      }
    } catch {
      toast({ title: "Purchase Failed", description: "Failed to process purchase", variant: "destructive" });
    } finally {
      setIsPurchasing(false);
      setSelectedLegacy(null);
    }
  };

  const handleLegacyEquip = async (skinId: string, category: string) => {
    try {
      const res = await fetch("/api/cosmetics/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, skinId, category }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Equipped!", description: "Skin equipped successfully" });
        refetchAccount?.();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed", description: "Could not equip skin", variant: "destructive" });
    }
  };

  const raceDisplayName = playerRace.charAt(0).toUpperCase() + playerRace.slice(1);
  const raceSkinCount = getSkinsForRace(playerRace).length;
  const ownedCount = raceSkins.filter(s => ownedSkins.includes(s.id) || ownedSkins.includes(`character_${s.id}`)).length;

  return (
    <div className="game-page">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/backdrops/shop.png')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />

      <div className="absolute inset-0 z-10 overflow-y-auto">
        <header className="border-b border-border/50 bg-black/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h1 className="text-xl font-serif font-bold">Cosmetics Shop</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg">
                  <Ticket className="w-3.5 h-3.5 text-green-400" />
                  <span>{account.skinTickets || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg">
                  <Ticket className="w-3.5 h-3.5 text-blue-400" />
                  <span>{account.rareSkinTickets || 0} Rare</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg">
                  <Ticket className="w-3.5 h-3.5 text-purple-400" />
                  <span>{account.epicSkinTickets || 0} Epic</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-lg">
                  <Gem className="w-3.5 h-3.5 text-pink-400" />
                  <span>{(account.rubies || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid grid-cols-4 w-full max-w-md mx-auto mb-6 bg-black/50">
              <TabsTrigger value="character" className="flex items-center gap-1 text-xs"><User className="w-3.5 h-3.5" /> Character</TabsTrigger>
              <TabsTrigger value="pet" className="flex items-center gap-1 text-xs"><Dog className="w-3.5 h-3.5" /> Pet</TabsTrigger>
              <TabsTrigger value="bird" className="flex items-center gap-1 text-xs"><Bird className="w-3.5 h-3.5" /> Bird</TabsTrigger>
              <TabsTrigger value="base" className="flex items-center gap-1 text-xs"><Home className="w-3.5 h-3.5" /> Base</TabsTrigger>
            </TabsList>

            {/* Character tab — uses race-specific skins from skins-data.ts */}
            <TabsContent value="character">
              {/* Race banner */}
              <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-500/20 border border-purple-500/40 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-purple-300 font-semibold">{raceDisplayName} Skins</span>
                    <span className="text-gray-400 ml-2 text-xs">({ownedCount}/{raceSkinCount} owned)</span>
                  </div>
                </div>
                {/* Rarity filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  {["all", "common", "rare", "epic", "mythic"].map(r => (
                    <button
                      key={r}
                      onClick={() => setRarityFilter(r)}
                      style={{
                        padding: "2px 8px", fontSize: "0.65rem", borderRadius: 4,
                        background: rarityFilter === r ? "rgba(139,92,246,0.3)" : "rgba(0,0,0,0.4)",
                        border: `1px solid ${rarityFilter === r ? "#7c3aed" : "#374151"}`,
                        color: rarityFilter === r ? "#c4b5fd" : "#9ca3af",
                        cursor: "pointer", textTransform: "capitalize",
                      }}
                    >{r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {raceSkins.map(skin => {
                  const isOwned = ownedSkins.includes(skin.id) || ownedSkins.includes(`character_${skin.id}`);
                  return (
                    <SkinCard
                      key={skin.id}
                      skin={skin}
                      isOwned={isOwned}
                      onBuy={() => {
                        if (skin.rubyPrice === 0) {
                          handleEquipSkin(skin);
                        } else {
                          setSelectedSkin(skin);
                        }
                      }}
                      onEquip={() => handleEquipSkin(skin)}
                    />
                  );
                })}
              </div>
            </TabsContent>

            {/* Pet / Bird / Base tabs — use existing server-side shop data */}
            {["pet", "bird", "base"].map(category => (
              <TabsContent key={category} value={category}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(shop?.[category as keyof CosmeticsShop] || []).map(item => {
                    const fullId = `${category}_${item.id}`;
                    const isOwned = ownedSkins.includes(fullId);
                    return (
                      <div
                        key={item.id}
                        className={`relative rounded-lg border cursor-pointer transition-all hover:scale-105 p-3 ${rarityBg[item.rarity] || rarityBg.common} ${isOwned ? "ring-2 ring-green-500/60" : ""}`}
                        onClick={() => !isOwned && setSelectedLegacy({ item, category })}
                      >
                        {isOwned && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="font-semibold text-sm mb-1">{item.name}</div>
                        <Badge className={`text-xs ${rarityBg[item.rarity]}`}>
                          {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                        </Badge>
                        {isOwned ? (
                          <Button size="sm" className="w-full mt-2 bg-green-600 hover:bg-green-700 text-xs"
                            onClick={e => { e.stopPropagation(); handleLegacyEquip(item.id, category); }}>
                            Equip
                          </Button>
                        ) : (
                          <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                            <Gem className="w-3 h-3" /> {item.rubyPrice.toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </main>

        {/* Buy dialog for new skin system */}
        <Dialog open={!!selectedSkin} onOpenChange={() => setSelectedSkin(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Purchase Skin
              </DialogTitle>
              <DialogDescription>Unlock this skin for your {raceDisplayName}</DialogDescription>
            </DialogHeader>
            {selectedSkin && (
              <div className="py-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 35%, ${selectedSkin.glowColor}cc, ${selectedSkin.glowColor}22)`,
                    border: `2px solid ${selectedSkin.glowColor}88`,
                    filter: selectedSkin.cssFilter === "none" ? undefined : selectedSkin.cssFilter,
                    boxShadow: `0 0 20px ${selectedSkin.glowColor}66`,
                    flexShrink: 0,
                  }} />
                  <div>
                    <div className="font-bold text-lg" style={{ color: RARITY_LABEL_COLORS[selectedSkin.rarity] }}>{selectedSkin.name}</div>
                    <div className="text-sm text-gray-400 capitalize">{selectedSkin.rarity} · {raceDisplayName}</div>
                    <div className="flex items-center gap-1 mt-1 text-pink-300 font-semibold">
                      <Gem className="w-4 h-4" /> {selectedSkin.rubyPrice.toLocaleString()} Rubies
                    </div>
                  </div>
                </div>
                {(account.rubies || 0) < selectedSkin.rubyPrice && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded p-2">
                    Not enough Rubies ({(account.rubies || 0).toLocaleString()} / {selectedSkin.rubyPrice.toLocaleString()})
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedSkin(null)} disabled={isPurchasing}>Cancel</Button>
              <Button
                disabled={isPurchasing || !selectedSkin || (account.rubies || 0) < (selectedSkin?.rubyPrice ?? 0)}
                onClick={() => selectedSkin && handleBuySkin(selectedSkin).then(() => setSelectedSkin(null))}
                className="bg-gradient-to-r from-pink-600 to-purple-600"
              >
                <Gem className="w-4 h-4 mr-2" />
                Buy for {selectedSkin?.rubyPrice.toLocaleString()} Rubies
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Legacy shop dialog (pets/birds/bases) */}
        <Dialog open={!!selectedLegacy} onOpenChange={() => setSelectedLegacy(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Purchase {selectedLegacy?.item.name}
              </DialogTitle>
              <DialogDescription>Choose your payment method</DialogDescription>
            </DialogHeader>
            {selectedLegacy && (
              <div className="py-4 space-y-4">
                <div className={`p-4 rounded-lg ${rarityBg[selectedLegacy.item.rarity] || rarityBg.common}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedLegacy.item.name}</span>
                    <Badge>{selectedLegacy.item.rarity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">{selectedLegacy.category} skin</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleLegacyPurchase("tickets")} disabled={isPurchasing}
                    className="flex flex-col h-auto py-4 bg-gradient-to-br from-green-600 to-green-800">
                    <Ticket className="w-6 h-6 mb-1" />
                    <span>1 {selectedLegacy.item.rarity} Ticket</span>
                  </Button>
                  <Button onClick={() => handleLegacyPurchase("rubies")} disabled={isPurchasing || (account.rubies || 0) < selectedLegacy.item.rubyPrice}
                    className="flex flex-col h-auto py-4 bg-gradient-to-br from-pink-600 to-purple-800">
                    <Gem className="w-6 h-6 mb-1" />
                    <span>{selectedLegacy.item.rubyPrice.toLocaleString()} Rubies</span>
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLegacy(null)} disabled={isPurchasing}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
