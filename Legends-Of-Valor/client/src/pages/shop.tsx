import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Item, ItemTier, ItemType } from "@shared/schema";
import { playerRanks } from "@shared/schema";
import { ALL_ITEMS, TIER_LABELS } from "@/lib/items-data";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ITEM_TYPE_ICONS: Record<string, string> = {
  weapon: "⚔",
  armor: "🛡",
  accessory: "💎",
};

const STAT_ICONS: Record<string, string> = {
  Str: "⚡", Def: "🛡", Spd: "💨", Int: "🧠", Luck: "🍀", Pot: "✨",
};

const STAT_COLORS: Record<string, string> = {
  Str: "hsl(0 75% 55%)", Def: "hsl(210 80% 55%)", Spd: "hsl(142 70% 50%)",
  Int: "hsl(210 80% 55%)", Luck: "hsl(45 90% 55%)", Pot: "hsl(271 70% 60%)",
};

function formatPrice(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

const tierColorMap: Partial<Record<ItemTier, string>> = {
  normal: "hsl(0 0% 70%)", super_rare: "hsl(271 70% 60%)", x_tier: "hsl(45 90% 55%)",
  umr: "hsl(0 85% 60%)", ssumr: "hsl(330 100% 70%)", divine: "hsl(200 100% 70%)",
  initiate: "hsl(148 60% 50%)", journeyman: "hsl(35 90% 55%)", adept: "hsl(16 85% 55%)",
  expert: "hsl(280 80% 60%)", master: "hsl(15 95% 55%)", grandmaster: "hsl(260 90% 70%)",
  champion: "hsl(0 85% 60%)", overlord: "hsl(240 30% 50%)", sovereign: "hsl(45 100% 50%)",
  ascendant: "hsl(200 90% 55%)", legend: "hsl(50 100% 50%)", elite: "hsl(300 100% 60%)",
  mythical_legend: "hsl(350 100% 55%)",
};

function ShopTooltip({ item, position }: { item: Item; position: { x: number; y: number } }) {
  const tierColor = tierColorMap[item.tier] || "hsl(0 0% 70%)";
  const tooltipStyle: React.CSSProperties = {
    left: Math.min(position.x + 12, window.innerWidth - 300),
    top: Math.min(position.y - 10, window.innerHeight - 300),
  };

  return (
    <div className="rpg-item-tooltip" style={tooltipStyle}>
      <div className="rpg-tooltip-name" style={{ color: tierColor }}>{item.name}</div>
      <div className="rpg-tooltip-tier" style={{ color: tierColor }}>{TIER_LABELS[item.tier]}</div>
      <div className="rpg-tooltip-divider" />
      {["Str", "Def", "Spd", "Int", "Luck", "Pot"].map(stat => {
        const val = (item.stats as any)[stat] || 0;
        if (val === 0) return null;
        return (
          <div key={stat} className="rpg-tooltip-stat">
            <span className="rpg-tooltip-stat-name">{STAT_ICONS[stat]} {stat}</span>
            <span className="rpg-tooltip-stat-value" style={{ color: STAT_COLORS[stat] }}>+{val}</span>
          </div>
        );
      })}
      {item.special && <div className="rpg-tooltip-special">✦ {item.special}</div>}
      <div className="rpg-tooltip-price"><span>⬤</span> {item.price.toLocaleString()} gold</div>
      <div className="rpg-tooltip-actions">Click to purchase</div>
    </div>
  );
}

export default function Shop() {
  const [, navigate] = useLocation();
  const { account, inventory, addToInventory, logout } = useGame();
  const { toast } = useToast();

  const { data: marketPrices } = useQuery<Record<string, any>>({
    queryKey: ["/api/economy/market-prices"],
  });

  const [selectedTier, setSelectedTier] = useState<ItemTier | "all">("all");
  const [selectedType, setSelectedType] = useState<ItemType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmItem, setConfirmItem] = useState<Item | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ item: Item; pos: { x: number; y: number } } | null>(null);

  const ownedItemIds = useMemo(() => inventory.map((inv) => inv.itemId), [inventory]);

  const tierRankRequirements: Record<ItemTier, typeof playerRanks[number]> = {
    normal: "Novice", super_rare: "Novice", x_tier: "Novice", umr: "Novice", ssumr: "Novice",
    divine: "Apprentice", initiate: "Initiate", journeyman: "Journeyman", adept: "Adept",
    expert: "Expert", master: "Master", grandmaster: "Grandmaster", champion: "Champion",
    overlord: "Overlord", sovereign: "Sovereign", ascendant: "Ascendant", legend: "Legend",
    elite: "Mythic", mythical_legend: "Mythical Legend",
  };

  const excludedTiers = useMemo(() => {
    if (!account) return ["divine", "initiate", "journeyman", "adept", "expert", "master", "grandmaster", "champion", "overlord", "sovereign", "ascendant", "legend", "elite", "mythical_legend"] as ItemTier[];
    const playerRankIndex = playerRanks.indexOf(account.rank);
    return (Object.entries(tierRankRequirements) as [ItemTier, typeof playerRanks[number]][])
      .filter(([_, requiredRank]) => playerRanks.indexOf(requiredRank) > playerRankIndex)
      .map(([tier]) => tier);
  }, [account]);

  const filteredItems = useMemo(() => {
    return ALL_ITEMS.filter((item) => {
      if (selectedTier !== "all" && item.tier !== selectedTier) return false;
      if (selectedType !== "all" && item.type !== selectedType) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [selectedTier, selectedType, searchQuery]);

  const handleBuy = (item: Item) => {
    setConfirmItem(item);
  };

  const confirmPurchase = async () => {
    if (!confirmItem || !account) return;
    if (account.gold < confirmItem.price) {
      toast({ title: "Not enough gold!", description: `You need ${confirmItem.price.toLocaleString()} gold.`, variant: "destructive" });
      setConfirmItem(null);
      return;
    }
    const success = await addToInventory(confirmItem);
    if (success) {
      toast({ title: "Purchase successful!", description: `You acquired ${confirmItem.name}!` });
    } else {
      toast({ title: "Purchase failed", description: "Something went wrong.", variant: "destructive" });
    }
    setConfirmItem(null);
  };

  const handleItemHover = useCallback((e: React.MouseEvent, item: Item) => {
    setHoveredItem({ item, pos: { x: e.clientX, y: e.clientY } });
  }, []);

  const handleItemLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  function getPriceTrend(itemId: string, basePrice: number): { indicator: string; color: string } | null {
    if (!marketPrices) return null;
    const market = marketPrices[itemId];
    if (!market) return null;
    if (market.currentPrice > market.basePrice * 1.05) return { indicator: "↑", color: "#ef4444" };
    if (market.currentPrice < market.basePrice * 0.95) return { indicator: "↓", color: "#22c55e" };
    return null;
  }

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const availableTiers: (ItemTier | "all")[] = ["all", ...["normal", "super_rare", "x_tier", "umr", "ssumr", "divine", "initiate", "journeyman", "adept", "expert", "master", "grandmaster", "champion", "overlord", "sovereign", "ascendant", "legend", "elite", "mythical_legend"].filter(t => !excludedTiers.includes(t as ItemTier)) as ItemTier[]];

  const hotItems = useMemo(() => {
    if (!marketPrices) return [];
    return ALL_ITEMS.filter(item => {
      const trend = getPriceTrend(item.id, item.price);
      return trend && trend.indicator === "↑";
    }).slice(0, 5);
  }, [marketPrices]);

  const discountedItems = useMemo(() => {
    if (!marketPrices) return [];
    return ALL_ITEMS.filter(item => {
      const trend = getPriceTrend(item.id, item.price);
      return trend && trend.indicator === "↓";
    }).slice(0, 5);
  }, [marketPrices]);

  return (
    <div className="game-page-scroll" style={{ background: "hsl(240 10% 6%)" }}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/shop.png')", opacity: 0.15 }}
      />
      <div style={{ position: "relative", zIndex: 1, padding: "8px 12px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, minHeight: "calc(100vh - 60px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">
                📈 Market Trends
              </div>
              <div style={{ padding: 8, fontSize: "0.65rem", display: "flex", flexDirection: "column", gap: 6 }}>
                {hotItems.length > 0 && (
                  <div>
                    <div style={{ color: "#ef4444", fontWeight: "bold", marginBottom: 2 }}>🔥 Hot items (high demand):</div>
                    <div style={{ color: "hsl(45 10% 70%)" }}>{hotItems.map(i => i.name).join(", ")}</div>
                  </div>
                )}
                {discountedItems.length > 0 && (
                  <div>
                    <div style={{ color: "#22c55e", fontWeight: "bold", marginBottom: 2 }}>🏷️ Discounted items:</div>
                    <div style={{ color: "hsl(45 10% 70%)" }}>{discountedItems.map(i => i.name).join(", ")}</div>
                  </div>
                )}
                {hotItems.length === 0 && discountedItems.length === 0 && (
                  <div style={{ color: "hsl(45 10% 50%)", textAlign: "center", fontStyle: "italic" }}>Market is stable</div>
                )}
              </div>
            </div>

            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">
                🛒 Item Shop
              </div>
              <div style={{ padding: 8 }}>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "hsl(45 10% 45%)" }} />
                  <Input
                    type="search"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 28, height: 28, fontSize: "0.7rem", background: "hsl(240 8% 12%)", border: "1px solid hsl(240 8% 22%)" }}
                  />
                </div>

                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: "0.6rem", color: "hsl(45 10% 50%)", fontFamily: "var(--font-serif)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(["all", "weapon", "armor", "accessory"] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        style={{
                          padding: "3px 8px", fontSize: "0.6rem", fontFamily: "var(--font-serif)",
                          background: selectedType === type ? "hsl(45 60% 35% / 0.3)" : "hsl(240 8% 14%)",
                          border: `1px solid ${selectedType === type ? "hsl(45 60% 45% / 0.6)" : "hsl(240 8% 22%)"}`,
                          borderRadius: 3, color: selectedType === type ? "hsl(45 80% 60%)" : "hsl(45 10% 55%)", cursor: "pointer",
                        }}
                      >
                        {type === "all" ? "All" : type === "weapon" ? "⚔" : type === "armor" ? "🛡" : "💎"} {type === "all" ? "" : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.6rem", color: "hsl(45 10% 50%)", fontFamily: "var(--font-serif)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tier</div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 200, overflowY: "auto" }}>
                    {availableTiers.map(tier => (
                      <button
                        key={tier}
                        onClick={() => setSelectedTier(tier)}
                        style={{
                          padding: "2px 6px", fontSize: "0.55rem", fontFamily: "var(--font-serif)",
                          background: selectedTier === tier ? "hsl(45 60% 35% / 0.3)" : "hsl(240 8% 14%)",
                          border: `1px solid ${selectedTier === tier ? "hsl(45 60% 45% / 0.6)" : "hsl(240 8% 22%)"}`,
                          borderRadius: 2, cursor: "pointer",
                          color: tier === "all" ? (selectedTier === tier ? "hsl(45 80% 60%)" : "hsl(45 10% 55%)") : (tierColorMap[tier as ItemTier] || "hsl(45 10% 55%)"),
                        }}
                      >
                        {tier === "all" ? "All" : TIER_LABELS[tier as ItemTier]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">💰 Wallet</div>
              <div style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "hsl(45 10% 55%)" }}>Gold</span>
                  <span style={{ color: "hsl(45 90% 55%)", fontWeight: 700 }}>⬤ {(account.gold || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  <span style={{ color: "hsl(45 10% 55%)" }}>Inventory</span>
                  <span style={{ color: "hsl(45 10% 70%)" }}>{inventory.length} items</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.6rem", color: "hsl(45 10% 45%)", fontFamily: "var(--font-mono)", padding: "0 4px" }}>
              {filteredItems.length} items available
            </div>
          </div>

          <div className="rpg-inv-panel" style={{ flex: 1 }}>
            <div className="rpg-inv-panel-header">
              📦 Wares
              <span style={{ marginLeft: "auto", fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "hsl(45 10% 50%)" }}>
                Hover for details · Click to buy
              </span>
            </div>
            <div className="rpg-shop-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              {filteredItems.map((item) => {
                const isOwned = ownedItemIds.includes(item.id);
                const cantAfford = item.price > (account.gold || 0) && !isOwned;
                const isLocked = excludedTiers.includes(item.tier);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rpg-shop-slot",
                      `rpg-inv-slot-rarity-${item.tier}`,
                      isLocked && "rpg-shop-slot-locked",
                      cantAfford && !isLocked && "rpg-shop-slot-cant-afford",
                      isOwned && "rpg-shop-slot-owned"
                    )}
                    onClick={() => !isLocked && handleBuy(item)}
                    onMouseEnter={(e) => handleItemHover(e, item)}
                    onMouseLeave={handleItemLeave}
                    title={item.name}
                  >
                    {isLocked ? (
                      <span style={{ fontSize: "1rem", opacity: 0.4 }}>🔒</span>
                    ) : (
                      <>
                        <span className="rpg-shop-slot-icon">
                          {isOwned ? "✓" : ITEM_TYPE_ICONS[item.type] || "?"}
                        </span>
                        <span className="rpg-shop-slot-price">
                          {formatPrice(item.price)}
                          {(() => {
                            const trend = getPriceTrend(item.id || item.name, item.price || item.cost || 0);
                            return trend ? <span style={{color: trend.color, fontWeight: "bold", fontSize: 10, marginLeft: 2}}>{trend.indicator}</span> : null;
                          })()}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {hoveredItem && <ShopTooltip item={hoveredItem.item} position={hoveredItem.pos} />}

      <Dialog open={!!confirmItem} onOpenChange={() => setConfirmItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Confirm Purchase</DialogTitle>
            <DialogDescription>Are you sure you want to buy this item?</DialogDescription>
          </DialogHeader>
          {confirmItem && (
            <div className="py-4">
              <div className="rpg-inv-panel" style={{ padding: 12 }}>
                <div style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "1rem", color: tierColorMap[confirmItem.tier], marginBottom: 4 }}>
                  {confirmItem.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: tierColorMap[confirmItem.tier], fontFamily: "var(--font-serif)", marginBottom: 8 }}>
                  {TIER_LABELS[confirmItem.tier]} · {confirmItem.type}
                </div>
                <div className="rpg-tooltip-divider" />
                {["Str", "Def", "Spd", "Int", "Luck", "Pot"].map(stat => {
                  const val = (confirmItem.stats as any)[stat] || 0;
                  if (val === 0) return null;
                  return (
                    <div key={stat} className="rpg-tooltip-stat" style={{ fontSize: "0.8rem" }}>
                      <span className="rpg-tooltip-stat-name">{STAT_ICONS[stat]} {stat}</span>
                      <span className="rpg-tooltip-stat-value" style={{ color: STAT_COLORS[stat] }}>+{val}</span>
                    </div>
                  );
                })}
                {confirmItem.special && <div className="rpg-tooltip-special" style={{ marginTop: 8 }}>✦ {confirmItem.special}</div>}
                <div style={{ marginTop: 12, textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.1rem", color: "hsl(45 90% 55%)" }}>
                  ⬤ {confirmItem.price.toLocaleString()} gold
                  {(() => {
                    const trend = getPriceTrend(confirmItem.id || confirmItem.name, confirmItem.price || 0);
                    return trend ? <span style={{color: trend.color, fontWeight: "bold", fontSize: 14, marginLeft: 4}}>{trend.indicator}</span> : null;
                  })()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmItem(null)}>Cancel</Button>
            <Button onClick={confirmPurchase}>
              <Coins className="w-4 h-4 mr-2" />
              Buy for {confirmItem?.price.toLocaleString()} gold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
