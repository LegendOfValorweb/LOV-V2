export const AUCTION_LISTING_TAX_RATE = 0.05;
export const AUCTION_SALE_TAX_RATE = 0.10;

export const REPAIR_COST_PER_DURABILITY: Record<string, number> = {
  normal: 30,
  super_rare: 50,
  x_tier: 80,
  umr: 120,
  ssumr: 180,
  divine: 250,
  initiate: 40,
  journeyman: 60,
  adept: 90,
  expert: 130,
  master: 200,
  grandmaster: 300,
  champion: 450,
  overlord: 700,
  sovereign: 1000,
  ascendant: 1500,
  legend: 2500,
  elite: 4000,
  mythical_legend: 8000,
};

export function calculateRepairCost(itemTier: string, durabilityToRepair: number): number {
  const costPerPoint = REPAIR_COST_PER_DURABILITY[itemTier] || 50;
  return durabilityToRepair * costPerPoint;
}

export function calculateAuctionListingFee(startingPrice: number): number {
  return Math.floor(startingPrice * AUCTION_LISTING_TAX_RATE);
}

export function calculateAuctionSaleTax(salePrice: number): number {
  return Math.floor(salePrice * AUCTION_SALE_TAX_RATE);
}

interface MarketItem {
  itemId: string;
  basePrice: number;
  currentPrice: number;
  supply: number;
  demand: number;
  lastUpdated: number;
}

const marketPrices = new Map<string, MarketItem>();
const purchaseHistory: { itemId: string; timestamp: number }[] = [];
const saleHistory: { itemId: string; timestamp: number }[] = [];

const MARKET_UPDATE_INTERVAL = 30 * 60 * 1000;
const HISTORY_WINDOW = 60 * 60 * 1000;
const MIN_PRICE_MULTIPLIER = 0.5;
const MAX_PRICE_MULTIPLIER = 2.0;

export function initializeMarketItem(itemId: string, basePrice: number): void {
  if (!marketPrices.has(itemId)) {
    marketPrices.set(itemId, {
      itemId,
      basePrice,
      currentPrice: basePrice,
      supply: 10,
      demand: 10,
      lastUpdated: Date.now(),
    });
  }
}

export function recordPurchase(itemId: string): void {
  purchaseHistory.push({ itemId, timestamp: Date.now() });
  const market = marketPrices.get(itemId);
  if (market) {
    market.demand = Math.min(50, market.demand + 1);
    market.supply = Math.max(1, market.supply - 1);
  }
}

export function recordSale(itemId: string): void {
  saleHistory.push({ itemId, timestamp: Date.now() });
  const market = marketPrices.get(itemId);
  if (market) {
    market.supply = Math.min(50, market.supply + 1);
    market.demand = Math.max(1, market.demand - 1);
  }
}

export function recalculateMarketPrices(): void {
  const now = Date.now();
  const cutoff = now - HISTORY_WINDOW;

  const recentPurchases = purchaseHistory.filter(p => p.timestamp > cutoff);
  const recentSales = saleHistory.filter(s => s.timestamp > cutoff);

  while (purchaseHistory.length > 0 && purchaseHistory[0].timestamp <= cutoff) {
    purchaseHistory.shift();
  }
  while (saleHistory.length > 0 && saleHistory[0].timestamp <= cutoff) {
    saleHistory.shift();
  }

  const purchaseCounts = new Map<string, number>();
  for (const p of recentPurchases) {
    purchaseCounts.set(p.itemId, (purchaseCounts.get(p.itemId) || 0) + 1);
  }
  const saleCounts = new Map<string, number>();
  for (const s of recentSales) {
    saleCounts.set(s.itemId, (saleCounts.get(s.itemId) || 0) + 1);
  }

  const entries = Array.from(marketPrices.entries());
  for (const [itemId, market] of entries) {
    const purchases = purchaseCounts.get(itemId) || 0;
    const sales = saleCounts.get(itemId) || 0;

    const demandPressure = purchases - sales;
    const priceShift = demandPressure * 0.05;

    let multiplier = 1.0 + priceShift;
    multiplier = Math.max(MIN_PRICE_MULTIPLIER, Math.min(MAX_PRICE_MULTIPLIER, multiplier));

    market.currentPrice = Math.max(1, Math.floor(market.basePrice * multiplier));

    market.demand = Math.max(1, 10 + purchases);
    market.supply = Math.max(1, 10 + sales);
    market.lastUpdated = now;
  }
}

export function getMarketPrice(itemId: string, basePrice: number): number {
  initializeMarketItem(itemId, basePrice);
  const market = marketPrices.get(itemId);
  return market ? market.currentPrice : basePrice;
}

export function getAllMarketPrices(): MarketItem[] {
  return Array.from(marketPrices.values());
}

export function getMarketItemInfo(itemId: string): MarketItem | null {
  return marketPrices.get(itemId) || null;
}

let marketUpdateTimer: ReturnType<typeof setInterval> | null = null;

export function startMarketUpdates(): void {
  if (marketUpdateTimer) return;
  recalculateMarketPrices();
  marketUpdateTimer = setInterval(() => {
    recalculateMarketPrices();
    console.log(`[ECONOMY] Market prices recalculated. ${marketPrices.size} items tracked.`);
  }, MARKET_UPDATE_INTERVAL);
}

export function stopMarketUpdates(): void {
  if (marketUpdateTimer) {
    clearInterval(marketUpdateTimer);
    marketUpdateTimer = null;
  }
}
