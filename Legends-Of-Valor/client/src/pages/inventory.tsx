import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { getItemById, ALL_ITEMS, TIER_LABELS } from "@/lib/items-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Coins, DollarSign, Star } from "lucide-react";
import type { Item, ItemTier, InventoryItem, Stats } from "@shared/schema";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

function ItemTooltip({ item, invItem, position, currentEquipped, slot }: {
  item: Item;
  invItem?: InventoryItem | null;
  position: { x: number; y: number };
  currentEquipped?: { item: Item; invItem: InventoryItem } | null;
  slot?: string;
}) {
  const boostedStats = (invItem?.stats as Partial<Stats>) || {};

  const tierColorMap: Partial<Record<ItemTier, string>> = {
    normal: "hsl(0 0% 70%)", super_rare: "hsl(271 70% 60%)", x_tier: "hsl(45 90% 55%)",
    umr: "hsl(0 85% 60%)", ssumr: "hsl(330 100% 70%)", divine: "hsl(200 100% 70%)",
    initiate: "hsl(148 60% 50%)", journeyman: "hsl(35 90% 55%)", adept: "hsl(16 85% 55%)",
    expert: "hsl(280 80% 60%)", master: "hsl(15 95% 55%)", grandmaster: "hsl(260 90% 70%)",
    champion: "hsl(0 85% 60%)", overlord: "hsl(240 30% 50%)", sovereign: "hsl(45 100% 50%)",
    ascendant: "hsl(200 90% 55%)", legend: "hsl(50 100% 50%)", elite: "hsl(300 100% 60%)",
    mythical_legend: "hsl(350 100% 55%)",
  };

  const tierColor = tierColorMap[item.tier] || "hsl(0 0% 70%)";

  const equippedTotalStats: Record<string, number> = {};
  if (currentEquipped) {
    const eqBoosted = (currentEquipped.invItem.stats as Partial<Stats>) || {};
    for (const stat of ["Str", "Def", "Spd", "Int", "Luck", "Pot"]) {
      const base = (currentEquipped.item.stats as any)[stat] || 0;
      const boost = (eqBoosted as any)[stat] || 0;
      equippedTotalStats[stat] = base + boost;
    }
  }

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
        const baseVal = (item.stats as any)[stat] || 0;
        const boostVal = (boostedStats as any)[stat] || 0;
        const total = baseVal + boostVal;
        if (total === 0 && !equippedTotalStats[stat]) return null;

        const eqVal = equippedTotalStats[stat] || 0;
        const diff = total - eqVal;
        const showCompare = currentEquipped && diff !== 0;

        return (
          <div key={stat} className="rpg-tooltip-stat">
            <span className="rpg-tooltip-stat-name">{STAT_ICONS[stat]} {stat}</span>
            <span>
              <span className="rpg-tooltip-stat-value" style={{ color: STAT_COLORS[stat] }}>
                +{total}
              </span>
              {boostVal > 0 && (
                <span style={{ color: "hsl(45 90% 55%)", fontSize: "0.6rem", marginLeft: 2 }}>
                  (+{boostVal})
                </span>
              )}
              {showCompare && (
                <span className={cn("rpg-tooltip-stat-compare", diff > 0 ? "rpg-tooltip-stat-up" : "rpg-tooltip-stat-down")}>
                  {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {item.special && (
        <div className="rpg-tooltip-special">✦ {item.special}</div>
      )}
      <div className="rpg-tooltip-price">
        <span>⬤</span> {item.price.toLocaleString()} gold
      </div>
    </div>
  );
}

export default function Inventory() {
  const [, navigate] = useLocation();
  const { account, inventory, logout, setAccount, refreshInventory } = useGame();
  const { toast } = useToast();
  const [equipDialog, setEquipDialog] = useState<{ slot: string; type: "weapon" | "armor" | "accessory" } | null>(null);
  const [boostDialog, setBoostDialog] = useState<InventoryItem | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);
  const [boostScaling, setBoostScaling] = useState(1);
  const [sellDialog, setSellDialog] = useState<{ inventoryItem: InventoryItem; item: Item } | null>(null);
  const [isSelling, setIsSelling] = useState(false);
  const [isTrainingStat, setIsTrainingStat] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "weapon" | "armor" | "accessory">("all");
  const [hoveredItem, setHoveredItem] = useState<{ item: Item; invItem?: InventoryItem; pos: { x: number; y: number }; slot?: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ item: Item; invItem: InventoryItem } | null>(null);

  const { data: carryCapacity } = useQuery<{ currentWeight: number; maxCapacity: number; remaining: number; isFull: boolean; petsCarryBonus: number }>({
    queryKey: ["/api/accounts", account?.id, "carry-capacity"],
    queryFn: async () => {
      if (!account?.id) return { currentWeight: 0, maxCapacity: 50, remaining: 50, isFull: false, petsCarryBonus: 0 };
      const res = await fetch(`/api/accounts/${account.id}/carry-capacity`);
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  const SELL_RANKS = ["Journeyman", "Expert", "Master", "Grandmaster", "Legend", "Elite"];
  const canSell = account ? SELL_RANKS.includes(account.rank) : false;

  const maxBoostByRank = useMemo(() => {
    const rankMaxBoost: Record<string, number> = {
      "Novice": 999, "Apprentice": 9999, "Journeyman": 99999, "Expert": 999999,
      "Master": 9999999, "Grandmaster": 99999999, "Legend": 999999999, "Elite": 9999999999,
    };
    return rankMaxBoost[account?.rank || "Novice"] || 999;
  }, [account?.rank]);

  const inventoryItems = useMemo(() => {
    return inventory
      .map((inv) => {
        const baseItem = getItemById(inv.itemId);
        if (!baseItem) return undefined;
        return { ...baseItem, inventoryId: inv.id, invItem: inv, boostedStats: (inv.stats as Partial<Stats>) || {} };
      })
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
  }, [inventory]);

  const filteredInventoryItems = useMemo(() => {
    if (activeTab === "all") return inventoryItems;
    return inventoryItems.filter(item => item.type === activeTab);
  }, [inventoryItems, activeTab]);

  const equippedItems = useMemo(() => {
    if (!account) return { weapon: null, armor: null, accessory1: null, accessory2: null };
    const findInvItem = (itemId: string | null) => {
      if (!itemId) return null;
      const inv = inventory.find(i => i.itemId === itemId);
      if (!inv) return null;
      return { item: getItemById(inv.itemId)!, invItem: inv };
    };
    return {
      weapon: findInvItem(account.equipped?.weapon),
      armor: findInvItem(account.equipped?.armor),
      accessory1: findInvItem(account.equipped?.accessory1),
      accessory2: findInvItem(account.equipped?.accessory2),
    };
  }, [account, inventory]);

  const calculatedStats = useMemo(() => {
    const base = account?.stats || { Str: 10, Def: 10, Spd: 10, Int: 10, Luck: 10, Pot: 0 };
    const bonus: Record<string, number> = { Str: 0, Def: 0, Spd: 0, Int: 0, Luck: 0, Pot: 0 };
    Object.values(equippedItems).forEach((equipped) => {
      if (equipped) {
        const { item, invItem } = equipped;
        const boosted = (invItem.stats as Partial<Stats>) || {};
        for (const stat of Object.keys(bonus)) {
          bonus[stat] += ((item.stats as any)[stat] || 0) + ((boosted as any)[stat] || 0);
        }
      }
    });
    return {
      Str: (base as any).Str + bonus.Str,
      Def: (base as any).Def + bonus.Def,
      Spd: (base as any).Spd + bonus.Spd,
      Int: (base as any).Int + bonus.Int,
      Luck: (base as any).Luck + bonus.Luck,
      Pot: (base as any).Pot + bonus.Pot,
    };
  }, [account, equippedItems]);

  const getPortraitPath = useCallback(() => {
    if (!account) return '/portraits/human_male.png';
    if (account.equippedCharacterSkin && account.equippedCharacterSkin !== 'default')
      return `/skins/character/${account.equippedCharacterSkin}.png`;
    if (account.portrait) {
      if (account.portrait.startsWith('skins/')) return `/${account.portrait}.png`;
      if (account.portrait.includes('/')) return account.portrait;
      return `/portraits/${account.portrait}.png`;
    }
    if (account.race && account.gender) return `/portraits/${account.race}_${account.gender}.png`;
    return '/portraits/human_male.png';
  }, [account]);

  const totalValue = useMemo(() => {
    return inventoryItems.reduce((sum, item) => sum + item.price, 0);
  }, [inventoryItems]);

  const handleEquip = async (item: { inventoryId: string; id: string }, slot: string) => {
    if (!account) return;
    const newEquipped = { ...account.equipped, [slot]: item.id };
    try {
      await apiRequest("PATCH", `/api/accounts/${account.id}`, { equipped: newEquipped });
      setAccount({ ...account, equipped: newEquipped });
      setEquipDialog(null);
      await refreshInventory();
    } catch (error) {
      console.error("Failed to equip item:", error);
    }
  };

  const handleUnequip = async (slot: string) => {
    if (!account) return;
    const newEquipped = { ...account.equipped, [slot]: null };
    try {
      await apiRequest("PATCH", `/api/accounts/${account.id}`, { equipped: newEquipped });
      setAccount({ ...account, equipped: newEquipped });
      await refreshInventory();
    } catch (error) {
      console.error("Failed to unequip item:", error);
    }
  };

  const handleQuickEquip = async (invItem: typeof inventoryItems[0]) => {
    if (!account) return;
    let slot = invItem.type === "weapon" ? "weapon" : invItem.type === "armor" ? "armor" : "accessory1";
    if (invItem.type === "accessory" && account.equipped?.accessory1) {
      slot = "accessory2";
    }
    await handleEquip({ inventoryId: invItem.inventoryId, id: invItem.id }, slot);
  };

  const handleBoost = async (stat: keyof Stats, amount: number = 1) => {
    if (!boostDialog || !account) return;
    const tpRequired = 10 * amount;
    if (account.trainingPoints < tpRequired) {
      toast({ title: "Insufficient Training Points", description: `You need ${tpRequired} TP to boost by ${amount}.`, variant: "destructive" });
      return;
    }
    setIsBoosting(true);
    try {
      const res = await apiRequest("POST", `/api/inventory/${boostDialog.id}/boost`, { stat, amount });
      const data = await res.json();
      await refreshInventory();
      const accountRes = await apiRequest("GET", `/api/accounts/${account.id}`);
      setAccount(await accountRes.json());
      setBoostDialog({ ...boostDialog, stats: data.stats });
      toast({ title: "Stat Boosted!", description: `+${amount} ${stat}.` });
    } catch (error) {
      toast({ title: "Boost Failed", description: "Could not boost stat.", variant: "destructive" });
    } finally {
      setIsBoosting(false);
    }
  };

  const handleSell = async () => {
    if (!sellDialog || !account) return;
    setIsSelling(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/inventory/${sellDialog.inventoryItem.id}/sell`, { originalPrice: sellDialog.item.price });
      const data = await res.json();
      await refreshInventory();
      const accountRes = await apiRequest("GET", `/api/accounts/${account.id}`);
      setAccount(await accountRes.json());
      toast({ title: "Item Sold!", description: `Received ${data.goldReceived.toLocaleString()} gold.` });
      setSellDialog(null);
      setSelectedItem(null);
    } catch (error: any) {
      const errorData = await error.json?.() || { error: "Could not sell item." };
      toast({ title: "Sell Failed", description: errorData.error, variant: "destructive" });
    } finally {
      setIsSelling(false);
    }
  };

  const handleTrainStat = async (stat: string, amount: number) => {
    if (!account) return;
    const tpCost = amount * 10;
    if ((account.trainingPoints || 0) < tpCost) {
      toast({ title: "Insufficient Training Points", description: `You need ${tpCost} TP.`, variant: "destructive" });
      return;
    }
    setIsTrainingStat(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/train-stat`, { stat, amount });
      const updatedAccount = await res.json();
      setAccount(updatedAccount);
      toast({ title: "Stat Trained!", description: `+${amount} ${stat} for ${tpCost} TP.` });
    } catch (error) {
      toast({ title: "Training Failed", description: "Could not train stat.", variant: "destructive" });
    } finally {
      setIsTrainingStat(false);
    }
  };

  const handleItemHover = useCallback((e: React.MouseEvent, item: Item, invItem?: InventoryItem, slot?: string) => {
    setHoveredItem({ item, invItem: invItem || undefined, pos: { x: e.clientX, y: e.clientY }, slot });
  }, []);

  const handleItemLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const handleItemClick = useCallback((item: typeof inventoryItems[0]) => {
    setSelectedItem(prev => prev?.item.id === item.id ? null : { item, invItem: item.invItem });
  }, []);

  const getCurrentEquippedForSlot = useCallback((type: string) => {
    if (type === "weapon") return equippedItems.weapon;
    if (type === "armor") return equippedItems.armor;
    return equippedItems.accessory1 || equippedItems.accessory2;
  }, [equippedItems]);

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const capPercent = carryCapacity ? Math.min(100, (carryCapacity.currentWeight / carryCapacity.maxCapacity) * 100) : 0;
  const capClass = carryCapacity?.isFull ? "rpg-cap-full" : capPercent > 80 ? "rpg-cap-warn" : "rpg-cap-ok";

  const emptySlotCount = Math.max(0, 24 - filteredInventoryItems.length);

  return (
    <div className="game-page-scroll" style={{ background: "hsl(240 10% 6%)" }}>
      <div style={{ padding: "8px 12px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, minHeight: "calc(100vh - 60px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">
                ⚔ Character
                <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "hsl(45 90% 55%)" }}>
                  ⬤ {(account.gold || 0).toLocaleString()}
                </span>
              </div>

              <div className="rpg-paperdoll">
                <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                    <div
                      className={cn("rpg-equip-slot", equippedItems.weapon && "rpg-slot-filled rpg-inv-slot-rarity-" + equippedItems.weapon.item.tier)}
                      onClick={() => equippedItems.weapon ? handleUnequip("weapon") : setEquipDialog({ slot: "weapon", type: "weapon" })}
                      onMouseEnter={(e) => equippedItems.weapon && handleItemHover(e, equippedItems.weapon.item, equippedItems.weapon.invItem, "weapon")}
                      onMouseLeave={handleItemLeave}
                      title={equippedItems.weapon ? equippedItems.weapon.item.name : "Weapon Slot"}
                    >
                      <span className="rpg-slot-icon">{equippedItems.weapon ? "⚔" : "⚔"}</span>
                      <span className="rpg-slot-label">Weapon</span>
                    </div>
                    <div
                      className={cn("rpg-equip-slot", equippedItems.accessory1 && "rpg-slot-filled rpg-inv-slot-rarity-" + equippedItems.accessory1.item.tier)}
                      onClick={() => equippedItems.accessory1 ? handleUnequip("accessory1") : setEquipDialog({ slot: "accessory1", type: "accessory" })}
                      onMouseEnter={(e) => equippedItems.accessory1 && handleItemHover(e, equippedItems.accessory1.item, equippedItems.accessory1.invItem, "accessory1")}
                      onMouseLeave={handleItemLeave}
                      title={equippedItems.accessory1 ? equippedItems.accessory1.item.name : "Accessory 1"}
                    >
                      <span className="rpg-slot-icon">{equippedItems.accessory1 ? "💎" : "💎"}</span>
                      <span className="rpg-slot-label">Ring 1</span>
                    </div>
                  </div>

                  <div className="rpg-paperdoll-body">
                    <div className="rpg-paperdoll-silhouette">
                      <img
                        src={getPortraitPath()}
                        alt={account.username}
                        onError={(e) => { (e.target as HTMLImageElement).src = "/portraits/human_male.png"; }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                    <div
                      className={cn("rpg-equip-slot", equippedItems.armor && "rpg-slot-filled rpg-inv-slot-rarity-" + equippedItems.armor.item.tier)}
                      onClick={() => equippedItems.armor ? handleUnequip("armor") : setEquipDialog({ slot: "armor", type: "armor" })}
                      onMouseEnter={(e) => equippedItems.armor && handleItemHover(e, equippedItems.armor.item, equippedItems.armor.invItem, "armor")}
                      onMouseLeave={handleItemLeave}
                      title={equippedItems.armor ? equippedItems.armor.item.name : "Armor Slot"}
                    >
                      <span className="rpg-slot-icon">{equippedItems.armor ? "🛡" : "🛡"}</span>
                      <span className="rpg-slot-label">Armor</span>
                    </div>
                    <div
                      className={cn("rpg-equip-slot", equippedItems.accessory2 && "rpg-slot-filled rpg-inv-slot-rarity-" + equippedItems.accessory2.item.tier)}
                      onClick={() => equippedItems.accessory2 ? handleUnequip("accessory2") : setEquipDialog({ slot: "accessory2", type: "accessory" })}
                      onMouseEnter={(e) => equippedItems.accessory2 && handleItemHover(e, equippedItems.accessory2.item, equippedItems.accessory2.invItem, "accessory2")}
                      onMouseLeave={handleItemLeave}
                      title={equippedItems.accessory2 ? equippedItems.accessory2.item.name : "Accessory 2"}
                    >
                      <span className="rpg-slot-icon">{equippedItems.accessory2 ? "💎" : "💎"}</span>
                      <span className="rpg-slot-label">Ring 2</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "0.8rem", fontWeight: 600, color: "hsl(45 10% 85%)" }}>
                    {account.username}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "hsl(45 10% 55%)", fontFamily: "var(--font-serif)" }}>
                    {account.rank} · {account.race || "Unknown"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">📊 Stats</div>
              <div className="rpg-stats-panel">
                {[
                  { stat: "Str", val: calculatedStats.Str },
                  { stat: "Def", val: calculatedStats.Def },
                  { stat: "Spd", val: calculatedStats.Spd },
                  { stat: "Int", val: calculatedStats.Int },
                  { stat: "Luck", val: calculatedStats.Luck },
                  { stat: "Pot", val: calculatedStats.Pot },
                ].map(({ stat, val }) => (
                  <div key={stat} className="rpg-stat-row">
                    <span className="rpg-stat-row-label">{STAT_ICONS[stat]} {stat}</span>
                    <span className="rpg-stat-row-value" style={{ color: STAT_COLORS[stat] }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "4px 12px 8px", display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "hsl(45 10% 50%)" }}>
                <span>{account.wins}W / {account.losses}L</span>
                <span style={{ color: "hsl(45 90% 55%)" }}>⭐ {account.trainingPoints || 0} TP</span>
              </div>
            </div>

            <div className="rpg-inv-panel">
              <div className="rpg-inv-panel-header">🏋 Train Stats</div>
              <div style={{ padding: 8 }}>
                {["Str", "Def", "Spd", "Int", "Luck"].map(stat => (
                  <div key={stat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 4px", fontSize: "0.7rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "hsl(45 10% 55%)", width: 40 }}>{STAT_ICONS[stat]} {stat}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: STAT_COLORS[stat], width: 40 }}>{(account.stats as any)?.[stat] || 10}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1, 10, 100].map(amt => (
                        <button
                          key={amt}
                          onClick={() => handleTrainStat(stat, amt)}
                          disabled={isTrainingStat || (account.trainingPoints || 0) < amt * 10}
                          style={{
                            padding: "2px 6px", fontSize: "0.55rem", fontFamily: "var(--font-mono)",
                            background: "hsl(240 8% 16%)", border: "1px solid hsl(240 8% 25%)", borderRadius: 2,
                            color: (account.trainingPoints || 0) >= amt * 10 ? "hsl(45 10% 80%)" : "hsl(45 10% 35%)",
                            cursor: (account.trainingPoints || 0) >= amt * 10 && !isTrainingStat ? "pointer" : "not-allowed",
                          }}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="rpg-inv-panel" style={{ flex: 1 }}>
              <div className="rpg-inv-panel-header">
                🎒 Inventory
                <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "hsl(45 10% 60%)" }}>
                  {inventoryItems.length} items · {totalValue.toLocaleString()} gold value
                </span>
              </div>

              <div className="rpg-inv-tab-bar">
                {(["all", "weapon", "armor", "accessory"] as const).map(tab => (
                  <div
                    key={tab}
                    className={cn("rpg-inv-tab", activeTab === tab && "rpg-inv-tab-active")}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "all" ? "All" : tab === "weapon" ? "⚔ Wpn" : tab === "armor" ? "🛡 Arm" : "💎 Acc"}
                  </div>
                ))}
              </div>

              <div className="rpg-inv-grid" style={{ gridTemplateColumns: "repeat(8, 48px)" }}>
                {filteredInventoryItems.map((item) => (
                  <div
                    key={item.inventoryId}
                    className={cn(
                      "rpg-inv-slot",
                      `rpg-inv-slot-rarity-${item.tier}`,
                      selectedItem?.item.id === item.id && "rpg-inv-slot-selected"
                    )}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={(e) => handleItemHover(e, item, item.invItem)}
                    onMouseLeave={handleItemLeave}
                    onDoubleClick={() => handleQuickEquip(item)}
                    title={item.name}
                  >
                    {ITEM_TYPE_ICONS[item.type] || "?"}
                  </div>
                ))}
                {Array.from({ length: emptySlotCount }).map((_, i) => (
                  <div key={`empty-${i}`} className="rpg-inv-slot rpg-inv-slot-empty" />
                ))}
              </div>

              {carryCapacity && (
                <div className="rpg-capacity-bar">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "hsl(45 10% 50%)", marginBottom: 4 }}>
                    <span>Capacity</span>
                    <span className={cn(carryCapacity.isFull && "text-red-400")}>
                      {carryCapacity.currentWeight} / {carryCapacity.maxCapacity}
                      {carryCapacity.petsCarryBonus > 0 && ` (+${carryCapacity.petsCarryBonus} pet)`}
                    </span>
                  </div>
                  <div className="rpg-capacity-bar-track">
                    <div className={cn("rpg-capacity-bar-fill", capClass)} style={{ width: `${capPercent}%` }} />
                  </div>
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="rpg-inv-panel">
                <div className="rpg-inv-panel-header">
                  📋 {selectedItem.item.name}
                  <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "hsl(45 10% 50%)", cursor: "pointer" }} onClick={() => setSelectedItem(null)}>✕</span>
                </div>
                <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleQuickEquip(inventoryItems.find(i => i.id === selectedItem.item.id)!)}
                    className="rpg-button"
                    style={{ padding: "4px 12px", fontSize: "0.7rem" }}
                  >
                    Equip
                  </button>
                  <button
                    onClick={() => {
                      const baseItem = getItemById(selectedItem.invItem.itemId);
                      if (baseItem && (baseItem.type === "weapon" || baseItem.type === "armor" || baseItem.type === "accessory")) {
                        setBoostDialog(selectedItem.invItem);
                      }
                    }}
                    className="rpg-button-secondary"
                    style={{ padding: "4px 12px", fontSize: "0.7rem" }}
                  >
                    ⭐ Boost
                  </button>
                  {canSell && (
                    <button
                      onClick={() => setSellDialog({ inventoryItem: selectedItem.invItem, item: selectedItem.item })}
                      style={{
                        padding: "4px 12px", fontSize: "0.7rem", fontFamily: "var(--font-serif)",
                        background: "linear-gradient(180deg, hsl(142 50% 35%) 0%, hsl(142 40% 25%) 100%)",
                        border: "1px solid hsl(142 40% 40% / 0.5)", borderRadius: 3,
                        color: "hsl(142 20% 90%)", cursor: "pointer",
                      }}
                    >
                      💰 Sell ({Math.floor(selectedItem.item.price * 0.5).toLocaleString()}g)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {hoveredItem && (
        <ItemTooltip
          item={hoveredItem.item}
          invItem={hoveredItem.invItem}
          position={hoveredItem.pos}
          currentEquipped={getCurrentEquippedForSlot(hoveredItem.item.type)}
          slot={hoveredItem.slot}
        />
      )}

      <Dialog open={!!equipDialog} onOpenChange={() => setEquipDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Equip {equipDialog?.type}</DialogTitle>
            <DialogDescription>Select an item from your inventory to equip.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(() => {
              const items = inventoryItems.filter(item => item.type === equipDialog?.type);
              return items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No {equipDialog?.type} items in inventory</p>
              ) : (
                items.map((item) => (
                  <Button
                    key={item.inventoryId}
                    variant="outline"
                    className="w-full justify-start h-auto py-2"
                    onClick={() => equipDialog && handleEquip(item, equipDialog.slot)}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-serif font-bold">{item.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.stats).map(([stat, val]) => {
                          const boost = item.boostedStats[stat as keyof Stats] || 0;
                          const total = (val || 0) + boost;
                          if (total === 0) return null;
                          return (
                            <Badge key={stat} variant="secondary" className="text-[10px] px-1 h-4">+{total} {stat}</Badge>
                          );
                        })}
                      </div>
                    </div>
                  </Button>
                ))
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!boostDialog} onOpenChange={() => { setBoostDialog(null); setBoostScaling(1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Boost Equipment Stats</DialogTitle>
            <DialogDescription>Spend 10 TP per stat point. Max {maxBoostByRank.toLocaleString()} ({account?.rank}).</DialogDescription>
          </DialogHeader>
          {boostDialog && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-tier-x/10 border border-tier-x/20">
                <span className="text-sm font-medium">Available TP</span>
                <span className="font-mono font-bold text-tier-x">{account.trainingPoints || 0} TP</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Amount:</span>
                {[1, 10, 100, 1000].map((scale) => (
                  <Button key={scale} size="sm" variant={boostScaling === scale ? "default" : "outline"} onClick={() => setBoostScaling(scale)}>+{scale}</Button>
                ))}
              </div>
              <div className="text-center text-xs text-muted-foreground">Cost: {10 * boostScaling} TP per boost</div>
              <div className="grid gap-2">
                {["Str", "Int", "Spd", "Luck", "Pot"].map((stat) => {
                  const baseItem = getItemById(boostDialog.itemId);
                  if (!baseItem) return null;
                  const currentBoost = (boostDialog.stats as any)?.[stat] || 0;
                  const baseStat = (baseItem.stats as any)[stat] || 0;
                  const total = baseStat + currentBoost;
                  const tpRequired = 10 * boostScaling;
                  return (
                    <div key={stat} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold uppercase">{stat}</span>
                        <span className="text-xs text-muted-foreground">Total: {total} (Base: {baseStat} + Boost: {currentBoost})</span>
                      </div>
                      <Button size="sm" disabled={isBoosting || account.trainingPoints < tpRequired || total >= maxBoostByRank} onClick={() => handleBoost(stat as keyof Stats, boostScaling)} className="gap-1">
                        +{boostScaling} {stat}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBoostDialog(null); setBoostScaling(1); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sellDialog} onOpenChange={() => setSellDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Sell Item
            </DialogTitle>
            <DialogDescription>Sell this item for 50% of its original value.</DialogDescription>
          </DialogHeader>
          {sellDialog && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-serif font-semibold">{sellDialog.item.name}</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(sellDialog.item.stats).map(([stat, val]) => {
                    if (!val) return null;
                    return <Badge key={stat} variant="secondary" className="text-xs">+{val} {stat}</Badge>;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-secondary/30">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Original Price</p>
                  <p className="font-mono font-bold text-muted-foreground line-through">{sellDialog.item.price.toLocaleString()} gold</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-green-500">You Receive</p>
                  <p className="font-mono font-bold text-green-500">{Math.floor(sellDialog.item.price * 0.5).toLocaleString()} gold</p>
                </div>
              </div>
              <div className="text-center text-xs text-amber-500">This action cannot be undone!</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialog(null)}>Cancel</Button>
            <Button onClick={handleSell} disabled={isSelling} className="bg-green-600 hover:bg-green-700">
              <Coins className="w-4 h-4 mr-2" />
              {isSelling ? "Selling..." : "Sell Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
