import { playerRanks } from "../shared/schema";

export interface ResourceNode {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "mythic";
  baseChance: number;
  minAmount: number;
  maxAmount: number;
  rankRequired: number;
  weight: number;
  sellPrice: number;
}

export interface ZoneResourceConfig {
  zoneId: string;
  zoneName: string;
  resources: ResourceNode[];
}

export interface ResourceExhaustionState {
  resourceId: string;
  zoneId: string;
  currentSupply: number;
  maxSupply: number;
  lastGathered: number;
  regenRatePerMinute: number;
}

export interface GatherResult {
  resourceId: string;
  resourceName: string;
  rarity: string;
  amount: number;
  weight: number;
  sellPrice: number;
}

const RANK_INDEX: Record<string, number> = {};
playerRanks.forEach((r, i) => { RANK_INDEX[r] = i; });

function getRankIndex(rank: string): number {
  return RANK_INDEX[rank] ?? 0;
}

export const ZONE_RESOURCES: ZoneResourceConfig[] = [
  {
    zoneId: "mountain_caverns",
    zoneName: "Glorifac Cave",
    resources: [
      { id: "iron_ore", name: "Iron Ore", rarity: "common", baseChance: 0.65, minAmount: 1, maxAmount: 5, rankRequired: 0, weight: 1, sellPrice: 15 },
      { id: "silver_ore", name: "Silver Ore", rarity: "uncommon", baseChance: 0.40, minAmount: 1, maxAmount: 3, rankRequired: 2, weight: 1, sellPrice: 40 },
      { id: "ruby_chunk", name: "Ruby Chunk", rarity: "rare", baseChance: 0.20, minAmount: 1, maxAmount: 2, rankRequired: 4, weight: 2, sellPrice: 120 },
      { id: "mythril_ore", name: "Mythril Ore", rarity: "epic", baseChance: 0.10, minAmount: 1, maxAmount: 1, rankRequired: 7, weight: 3, sellPrice: 500 },
      { id: "plasma_core", name: "Plasma Core", rarity: "epic", baseChance: 0.05, minAmount: 1, maxAmount: 1, rankRequired: 10, weight: 3, sellPrice: 1200 },
      { id: "chrono_crystal", name: "Chrono Crystal", rarity: "mythic", baseChance: 0.02, minAmount: 1, maxAmount: 1, rankRequired: 12, weight: 5, sellPrice: 5000 },
    ],
  },
  {
    zoneId: "enchanted_forest",
    zoneName: "Whispering Forest",
    resources: [
      { id: "wood", name: "Wood", rarity: "common", baseChance: 0.70, minAmount: 2, maxAmount: 8, rankRequired: 0, weight: 1, sellPrice: 10 },
      { id: "fiber", name: "Fiber", rarity: "common", baseChance: 0.60, minAmount: 2, maxAmount: 6, rankRequired: 0, weight: 1, sellPrice: 12 },
      { id: "beast_hide", name: "Beast Hide", rarity: "uncommon", baseChance: 0.35, minAmount: 1, maxAmount: 3, rankRequired: 3, weight: 1, sellPrice: 45 },
      { id: "nature_essence", name: "Nature Essence", rarity: "rare", baseChance: 0.15, minAmount: 1, maxAmount: 2, rankRequired: 5, weight: 2, sellPrice: 150 },
      { id: "soul_shard_resource", name: "Soul Shard", rarity: "epic", baseChance: 0.06, minAmount: 1, maxAmount: 1, rankRequired: 8, weight: 3, sellPrice: 800 },
    ],
  },
  {
    zoneId: "coastal_village",
    zoneName: "Lavic Town",
    resources: [
      { id: "aether_fragment", name: "Aether Fragment", rarity: "rare", baseChance: 0.12, minAmount: 1, maxAmount: 2, rankRequired: 5, weight: 2, sellPrice: 200 },
      { id: "sea_salt", name: "Sea Salt", rarity: "common", baseChance: 0.65, minAmount: 2, maxAmount: 6, rankRequired: 0, weight: 1, sellPrice: 8 },
      { id: "coral_piece", name: "Coral Piece", rarity: "uncommon", baseChance: 0.40, minAmount: 1, maxAmount: 3, rankRequired: 2, weight: 1, sellPrice: 35 },
      { id: "crafting_reagent", name: "Crafting Reagent", rarity: "uncommon", baseChance: 0.30, minAmount: 1, maxAmount: 2, rankRequired: 3, weight: 1, sellPrice: 50 },
    ],
  },
  {
    zoneId: "mystic_tower",
    zoneName: "Mystic Tower",
    resources: [
      { id: "rare_essence", name: "Rare Essence", rarity: "rare", baseChance: 0.18, minAmount: 1, maxAmount: 2, rankRequired: 6, weight: 2, sellPrice: 180 },
      { id: "tempest_stone", name: "Tempest Stone", rarity: "epic", baseChance: 0.08, minAmount: 1, maxAmount: 1, rankRequired: 9, weight: 3, sellPrice: 900 },
      { id: "arcane_dust", name: "Arcane Dust", rarity: "common", baseChance: 0.55, minAmount: 1, maxAmount: 4, rankRequired: 4, weight: 1, sellPrice: 25 },
      { id: "mana_crystal", name: "Mana Crystal", rarity: "uncommon", baseChance: 0.30, minAmount: 1, maxAmount: 2, rankRequired: 5, weight: 1, sellPrice: 60 },
    ],
  },
  {
    zoneId: "ruby_mines",
    zoneName: "Ruby Mines",
    resources: [
      { id: "raw_ruby", name: "Raw Ruby", rarity: "uncommon", baseChance: 0.45, minAmount: 1, maxAmount: 3, rankRequired: 2, weight: 1, sellPrice: 55 },
      { id: "gold_nugget", name: "Gold Nugget", rarity: "rare", baseChance: 0.20, minAmount: 1, maxAmount: 2, rankRequired: 4, weight: 2, sellPrice: 130 },
      { id: "deep_iron", name: "Deep Iron", rarity: "common", baseChance: 0.60, minAmount: 2, maxAmount: 5, rankRequired: 1, weight: 1, sellPrice: 18 },
      { id: "crystal_shard", name: "Crystal Shard", rarity: "epic", baseChance: 0.07, minAmount: 1, maxAmount: 1, rankRequired: 8, weight: 3, sellPrice: 650 },
    ],
  },
  {
    zoneId: "crystal_lake",
    zoneName: "Crystal Lake",
    resources: [
      { id: "lake_crystal", name: "Lake Crystal", rarity: "uncommon", baseChance: 0.35, minAmount: 1, maxAmount: 3, rankRequired: 2, weight: 1, sellPrice: 42 },
      { id: "water_lily", name: "Water Lily", rarity: "common", baseChance: 0.55, minAmount: 1, maxAmount: 4, rankRequired: 0, weight: 1, sellPrice: 14 },
      { id: "moonstone", name: "Moonstone", rarity: "rare", baseChance: 0.12, minAmount: 1, maxAmount: 1, rankRequired: 6, weight: 2, sellPrice: 160 },
    ],
  },
  {
    zoneId: "ancient_ruins",
    zoneName: "Ancient Ruins",
    resources: [
      { id: "ancient_relic", name: "Ancient Relic", rarity: "rare", baseChance: 0.15, minAmount: 1, maxAmount: 1, rankRequired: 5, weight: 2, sellPrice: 170 },
      { id: "ruin_stone", name: "Ruin Stone", rarity: "common", baseChance: 0.55, minAmount: 1, maxAmount: 4, rankRequired: 1, weight: 1, sellPrice: 20 },
      { id: "shadow_fragment", name: "Shadow Fragment", rarity: "uncommon", baseChance: 0.30, minAmount: 1, maxAmount: 2, rankRequired: 3, weight: 1, sellPrice: 55 },
      { id: "void_shard", name: "Void Shard", rarity: "epic", baseChance: 0.05, minAmount: 1, maxAmount: 1, rankRequired: 9, weight: 3, sellPrice: 1000 },
    ],
  },
  {
    zoneId: "hell_zone",
    zoneName: "Hell Zone",
    resources: [
      { id: "hellfire_ember", name: "Hellfire Ember", rarity: "rare", baseChance: 0.20, minAmount: 1, maxAmount: 2, rankRequired: 8, weight: 2, sellPrice: 250 },
      { id: "demon_bone", name: "Demon Bone", rarity: "uncommon", baseChance: 0.35, minAmount: 1, maxAmount: 3, rankRequired: 6, weight: 1, sellPrice: 70 },
      { id: "abyssal_core", name: "Abyssal Core", rarity: "mythic", baseChance: 0.03, minAmount: 1, maxAmount: 1, rankRequired: 12, weight: 5, sellPrice: 4000 },
    ],
  },
];

const ZONE_RESOURCE_MAP: Record<string, ZoneResourceConfig> = {};
for (const zone of ZONE_RESOURCES) {
  ZONE_RESOURCE_MAP[zone.zoneId] = zone;
}

const exhaustionStates = new Map<string, ResourceExhaustionState>();

const INITIAL_SUPPLY = 100;
const REGEN_RATES: Record<string, number> = {
  common: 5.0,
  uncommon: 3.0,
  rare: 1.5,
  epic: 0.5,
  mythic: 0.2,
};

function getExhaustionKey(zoneId: string, resourceId: string): string {
  return `${zoneId}:${resourceId}`;
}

function getExhaustionState(zoneId: string, resource: ResourceNode): ResourceExhaustionState {
  const key = getExhaustionKey(zoneId, resource.id);
  let state = exhaustionStates.get(key);
  if (!state) {
    state = {
      resourceId: resource.id,
      zoneId,
      currentSupply: INITIAL_SUPPLY,
      maxSupply: INITIAL_SUPPLY,
      lastGathered: Date.now(),
      regenRatePerMinute: REGEN_RATES[resource.rarity] || 1.0,
    };
    exhaustionStates.set(key, state);
  }
  return state;
}

function regenerateSupply(state: ResourceExhaustionState): void {
  const now = Date.now();
  const elapsedMinutes = (now - state.lastGathered) / 60000;
  if (elapsedMinutes > 0 && state.currentSupply < state.maxSupply) {
    const regen = Math.floor(elapsedMinutes * state.regenRatePerMinute);
    state.currentSupply = Math.min(state.maxSupply, state.currentSupply + regen);
    if (regen > 0) {
      state.lastGathered = now;
    }
  }
}

function depleteSupply(state: ResourceExhaustionState, amount: number): void {
  state.currentSupply = Math.max(0, state.currentSupply - amount);
  state.lastGathered = Date.now();
}

function getExhaustionMultiplier(state: ResourceExhaustionState): number {
  if (state.currentSupply <= 0) return 0;
  if (state.currentSupply >= state.maxSupply * 0.5) return 1.0;
  return state.currentSupply / (state.maxSupply * 0.5);
}

export function getZoneResources(zoneId: string): ZoneResourceConfig | null {
  return ZONE_RESOURCE_MAP[zoneId] || null;
}

export function getAllGatherableZones(): { zoneId: string; zoneName: string; resourceCount: number }[] {
  return ZONE_RESOURCES.map(z => ({
    zoneId: z.zoneId,
    zoneName: z.zoneName,
    resourceCount: z.resources.length,
  }));
}

export function getAvailableResources(zoneId: string, playerRank: string): (ResourceNode & { exhaustionPercent: number })[] {
  const zone = ZONE_RESOURCE_MAP[zoneId];
  if (!zone) return [];

  const rankIdx = getRankIndex(playerRank);

  return zone.resources
    .filter(r => rankIdx >= r.rankRequired)
    .map(r => {
      const state = getExhaustionState(zoneId, r);
      regenerateSupply(state);
      return {
        ...r,
        exhaustionPercent: Math.round((state.currentSupply / state.maxSupply) * 100),
      };
    });
}

export function gatherResources(
  zoneId: string,
  playerRank: string,
  playerLuck: number,
  birdResourceLuck: number
): GatherResult[] {
  const zone = ZONE_RESOURCE_MAP[zoneId];
  if (!zone) return [];

  const rankIdx = getRankIndex(playerRank);
  const effectiveLuck = playerLuck + birdResourceLuck;
  const luckBonus = Math.min(effectiveLuck * 0.005, 0.30);

  const results: GatherResult[] = [];

  for (const resource of zone.resources) {
    if (rankIdx < resource.rankRequired) continue;

    const state = getExhaustionState(zoneId, resource);
    regenerateSupply(state);

    const exhaustionMult = getExhaustionMultiplier(state);
    if (exhaustionMult <= 0) continue;

    const effectiveChance = Math.min(0.95, (resource.baseChance + luckBonus) * exhaustionMult);

    if (Math.random() < effectiveChance) {
      const range = resource.maxAmount - resource.minAmount + 1;
      let amount = Math.floor(Math.random() * range) + resource.minAmount;

      if (birdResourceLuck > 0 && Math.random() < birdResourceLuck * 0.01) {
        amount = Math.min(amount + 1, resource.maxAmount + 1);
      }

      depleteSupply(state, amount);

      results.push({
        resourceId: resource.id,
        resourceName: resource.name,
        rarity: resource.rarity,
        amount,
        weight: resource.weight * amount,
        sellPrice: resource.sellPrice * amount,
      });
    }
  }

  return results;
}

export function getZoneExhaustionInfo(zoneId: string): { resourceId: string; name: string; rarity: string; supplyPercent: number }[] {
  const zone = ZONE_RESOURCE_MAP[zoneId];
  if (!zone) return [];

  return zone.resources.map(r => {
    const state = getExhaustionState(zoneId, r);
    regenerateSupply(state);
    return {
      resourceId: r.id,
      name: r.name,
      rarity: r.rarity,
      supplyPercent: Math.round((state.currentSupply / state.maxSupply) * 100),
    };
  });
}

export function getRankRequirementLabel(rankRequired: number): string {
  if (rankRequired >= playerRanks.length) return playerRanks[playerRanks.length - 1];
  return playerRanks[rankRequired];
}
