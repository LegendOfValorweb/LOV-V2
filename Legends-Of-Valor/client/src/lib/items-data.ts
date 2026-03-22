import type { Item, ItemTier } from "@shared/schema";
import { ITEM_WEIGHT_BY_TIER, FISH_WEIGHT_BY_RARITY, RESOURCE_WEIGHT_BY_RARITY, calculateCarryCapacity } from "@shared/schema";

export function getItemWeight(tier: string): number {
  return ITEM_WEIGHT_BY_TIER[tier] || 1;
}

export function getFishWeight(rarity: string): number {
  return FISH_WEIGHT_BY_RARITY[rarity] || 1;
}

export function getResourceWeight(rarity: string): number {
  return RESOURCE_WEIGHT_BY_RARITY[rarity] || 1;
}

export { calculateCarryCapacity };

const tier1Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Arcane Staff", "type": "weapon", "stats": {"Int": 20}, "price": 300},
  {"name": "Thunder Hammer", "type": "weapon", "stats": {"Str": 12, "Luck": 5}, "special": "Stun 5%", "price": 280},
  {"name": "Shadow Cloak", "type": "armor", "stats": {"Spd": 10, "Luck": 5}, "price": 300},
  {"name": "Mystic Robes", "type": "armor", "stats": {"Int": 20}, "price": 300},
  {"name": "Guardian Plate", "type": "armor", "stats": {"Str": 15}, "price": 320},
  {"name": "Frost Dagger", "type": "weapon", "stats": {"Spd": 15}, "special": "Freeze 1t", "price": 330},
  {"name": "Ember Wand", "type": "weapon", "stats": {"Int": 18}, "special": "Burn 2t", "price": 340},
  {"name": "Lucky Ring", "type": "accessory", "stats": {"Luck": 20}, "price": 345},
  {"name": "Flame Cloak", "type": "armor", "stats": {"Str": 15}, "special": "Fire Resist", "price": 350},
  {"name": "Swift Helm", "type": "armor", "stats": {"Spd": 12, "Int": 5}, "price": 355},
  {"name": "Thunder Bow", "type": "weapon", "stats": {"Spd": 18}, "special": "Stun 5%", "price": 360},
  {"name": "Arcane Amulet", "type": "accessory", "stats": {"Int": 20}, "special": "Mana Regen", "price": 365},
  {"name": "Shadow Saber", "type": "weapon", "stats": {"Str": 20}, "special": "Critical +5%", "price": 370},
  {"name": "Frost Robes", "type": "armor", "stats": {"Int": 18}, "special": "Freeze", "price": 365},
  {"name": "Lucky Pendant", "type": "accessory", "stats": {"Luck": 22, "Str": 6}, "price": 370},
];

const tier2Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Elemental Vest", "type": "armor", "stats": {"Str": 10, "Spd": 10, "Int": 10, "Luck": 10}, "price": 400},
  {"name": "SR Ring of Fortune", "type": "accessory", "stats": {"Luck": 20}, "price": 420},
  {"name": "Frost Bow", "type": "weapon", "stats": {"Spd": 10, "Luck": 10}, "special": "Critical +8%", "price": 430},
  {"name": "Ember Robes", "type": "armor", "stats": {"Int": 18}, "special": "Fire Resist", "price": 440},
  {"name": "Shadow Fang", "type": "weapon", "stats": {"Str": 20}, "special": "Stun 8%", "price": 445},
  {"name": "Arcane Sabre", "type": "weapon", "stats": {"Str": 22}, "special": "Critical +8%", "price": 450},
  {"name": "Lightning Dagger", "type": "weapon", "stats": {"Spd": 18}, "special": "Life Steal 5%", "price": 455},
  {"name": "SR Ring of Insight", "type": "accessory", "stats": {"Int": 22, "Luck": 10}, "price": 460},
  {"name": "SR Swift Boots", "type": "armor", "stats": {"Spd": 20, "Str": 12}, "price": 465},
  {"name": "SR Ember Staff", "type": "weapon", "stats": {"Int": 25}, "special": "Burn 3t", "price": 470},
  {"name": "SR Frost Fang", "type": "weapon", "stats": {"Str": 25}, "special": "Stun 8%", "price": 470},
  {"name": "SR Lucky Pendant", "type": "accessory", "stats": {"Luck": 25, "Str": 15}, "price": 475},
  {"name": "Shadow Blade", "type": "weapon", "stats": {"Str": 27}, "special": "Life Steal 5%", "price": 480},
  {"name": "SR Arcane Mantle", "type": "armor", "stats": {"Int": 27}, "special": "Magic Shield", "price": 480},
  {"name": "Ring of Valor", "type": "accessory", "stats": {"Luck": 28, "Int": 18}, "price": 490},
];

const tier3Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Titan's Hammer", "type": "weapon", "stats": {"Str": 40, "Luck": 20}, "special": "Poison 3t", "price": 1000},
  {"name": "Infinity Bow", "type": "weapon", "stats": {"Spd": 40, "Luck": 20}, "special": "Freeze 2t", "price": 1000},
  {"name": "Sage's Staff", "type": "weapon", "stats": {"Int": 40}, "special": "Life Steal 8%", "price": 1000},
  {"name": "Omniguard Armor", "type": "armor", "stats": {"Str": 35, "Spd": 35, "Int": 35, "Luck": 35}, "price": 1050},
  {"name": "Dragonfang Blade", "type": "weapon", "stats": {"Str": 45, "Spd": 25}, "special": "Critical +10%", "price": 1100},
  {"name": "Archmage Robes", "type": "armor", "stats": {"Int": 45, "Luck": 25}, "price": 1100},
  {"name": "Shadow Eclipse Cloak", "type": "armor", "stats": {"Spd": 42, "Luck": 30}, "price": 1120},
  {"name": "Phoenix Saber", "type": "weapon", "stats": {"Str": 50}, "special": "Critical +10%", "price": 1150},
  {"name": "Frostbite Bow", "type": "weapon", "stats": {"Spd": 48}, "special": "Freeze 2t", "price": 1150},
  {"name": "Orb of Wisdom", "type": "accessory", "stats": {"Int": 45, "Luck": 20}, "price": 1130},
  {"name": "Titan Gauntlets", "type": "armor", "stats": {"Str": 40, "Spd": 20}, "price": 1050},
  {"name": "Lightning Hammer", "type": "weapon", "stats": {"Str": 48}, "special": "Poison 3t", "price": 1150},
  {"name": "Mystic Staff", "type": "weapon", "stats": {"Int": 50}, "special": "Life Steal 8%", "price": 1150},
  {"name": "Ring of Omniscience", "type": "accessory", "stats": {"Luck": 45}, "price": 1150},
];

const tier4Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Oblivion Fang", "type": "weapon", "stats": {"Str": 80, "Luck": 50}, "special": "Stun 10%", "price": 10000},
  {"name": "Eternal Eclipse Blade", "type": "weapon", "stats": {"Str": 85, "Spd": 45}, "special": "Double Strike", "price": 10500},
  {"name": "Archmage's Eternal Robe", "type": "armor", "stats": {"Int": 85, "Luck": 50}, "price": 10500},
  {"name": "Shadow Eclipse Mantle", "type": "armor", "stats": {"Spd": 80, "Luck": 50}, "price": 10200},
  {"name": "Phoenix Soul Saber", "type": "weapon", "stats": {"Str": 90}, "special": "Double Strike", "price": 11000},
  {"name": "Frost Reaper Bow", "type": "weapon", "stats": {"Spd": 88}, "special": "Silence 1t", "price": 11000},
  {"name": "Orb of Divine Insight", "type": "accessory", "stats": {"Int": 85, "Luck": 45}, "price": 10700},
  {"name": "Titan's Gauntlets", "type": "armor", "stats": {"Str": 80, "Spd": 50}, "price": 10200},
  {"name": "Lightning Devastator", "type": "weapon", "stats": {"Str": 90}, "special": "Life Steal 12%", "price": 11000},
  {"name": "Mystic Grand Staff", "type": "weapon", "stats": {"Int": 90}, "special": "Stun 10%", "price": 11000},
  {"name": "Ring of Eternal Omniscience", "type": "accessory", "stats": {"Luck": 90}, "price": 11000},
  {"name": "Pendant of Absolute Luck", "type": "accessory", "stats": {"Luck": 90, "Str": 45}, "price": 11200},
];

const tier5Items: Omit<Item, "id" | "tier">[] = [
  {"name": "SSUMR Dragon Slayer", "type": "weapon", "stats": {"Str": 120}, "special": "Dragon Bane", "price": 5000},
  {"name": "SSUMR Sage Staff", "type": "weapon", "stats": {"Int": 120}, "special": "Sage Wisdom", "price": 5000},
];

const tier6Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Divine World Breaker", "type": "weapon", "stats": {"Str": 250}, "special": "World Ender", "price": 15000},
  {"name": "Divine Eternity Wand", "type": "weapon", "stats": {"Int": 250}, "special": "Eternal Mana", "price": 15000},
];

const initiateItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Initiate Training Sword", "type": "weapon", "stats": {"Str": 40}, "price": 600},
  {"name": "Initiate Apprentice Wand", "type": "weapon", "stats": {"Int": 40}, "price": 600},
];

const journeymanItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Journeyman Steel Blade", "type": "weapon", "stats": {"Str": 80}, "price": 1200},
  {"name": "Journeyman Focus Staff", "type": "weapon", "stats": {"Int": 80}, "price": 1200},
];

const adeptItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Adept Battle Axe", "type": "weapon", "stats": {"Str": 150}, "price": 2500},
  {"name": "Adept Mystic Orb", "type": "weapon", "stats": {"Int": 150}, "price": 2500},
];

const expertItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Expert War Hammer", "type": "weapon", "stats": {"Str": 300}, "price": 6000},
  {"name": "Expert Sorcerer Cane", "type": "weapon", "stats": {"Int": 300}, "price": 6000},
];

const masterItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Master Katana", "type": "weapon", "stats": {"Str": 600}, "price": 15000},
  {"name": "Master Archmage Staff", "type": "weapon", "stats": {"Int": 600}, "price": 15000},
];

const grandmasterItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Grandmaster Greatsword", "type": "weapon", "stats": {"Str": 1200}, "price": 40000},
  {"name": "Grandmaster Void Wand", "type": "weapon", "stats": {"Int": 1200}, "price": 40000},
];

const championItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Champion Lance", "type": "weapon", "stats": {"Str": 2500}, "price": 100000},
  {"name": "Champion Celestial Harp", "type": "weapon", "stats": {"Int": 2500}, "price": 100000},
];

const overlordItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Overlord Scythe", "type": "weapon", "stats": {"Str": 5000}, "price": 250000},
  {"name": "Overlord Chaos Orb", "type": "weapon", "stats": {"Int": 5000}, "price": 250000},
];

const sovereignItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Sovereign Excalibur", "type": "weapon", "stats": {"Str": 10000}, "price": 750000},
  {"name": "Sovereign Genesis Staff", "type": "weapon", "stats": {"Int": 10000}, "price": 750000},
];

const ascendantItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Ascendant Star-Eater", "type": "weapon", "stats": {"Str": 25000}, "price": 2000000},
  {"name": "Ascendant Nebula Wand", "type": "weapon", "stats": {"Int": 25000}, "price": 2000000},
];

const legendItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Legendary Ragnarok", "type": "weapon", "stats": {"Str": 75000}, "price": 10000000},
  {"name": "Legendary Chronos Staff", "type": "weapon", "stats": {"Int": 75000}, "price": 10000000},
];

const eliteItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Elite Vanguard Blade", "type": "weapon", "stats": {"Str": 200000}, "price": 50000000},
  {"name": "Elite Oracle Eye", "type": "weapon", "stats": {"Int": 200000}, "price": 50000000},
];

const mythicalLegendItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Mythical Legend's Worldsplitter", "type": "weapon", "stats": {"Str": 10000, "Luck": 6000}, "special": "Double Strike", "price": 2000000000},
  {"name": "Bow of Eternal Myths", "type": "weapon", "stats": {"Spd": 10000, "Luck": 6000}, "special": "Life Steal 25%", "price": 2000000000},
  {"name": "Staff of Creation's End", "type": "weapon", "stats": {"Int": 12000}, "special": "Stun 15%", "price": 2200000000},
  {"name": "Armor of Mythical Perfection", "type": "armor", "stats": {"Str": 8000, "Spd": 8000, "Int": 6000, "Luck": 6000}, "special": "Myth Shield", "price": 2500000000},
  {"name": "Crown of Mythical Legends", "type": "accessory", "stats": {"Int": 9000, "Luck": 6000}, "special": "Legendary Wisdom", "price": 1800000000},
  {"name": "Blade of Infinite Myths", "type": "weapon", "stats": {"Str": 11000, "Spd": 5500}, "special": "Double Strike", "price": 2300000000},
  {"name": "Mythical Legend's Starweave", "type": "armor", "stats": {"Spd": 9500, "Int": 7000}, "special": "Star Barrier", "price": 2100000000},
  {"name": "Ring of Legendary Eternity", "type": "accessory", "stats": {"Luck": 9500, "Str": 5000}, "special": "Eternal Legend", "price": 2150000000},
  {"name": "The Final Blade", "type": "weapon", "stats": {"Str": 15000, "Spd": 8000, "Luck": 8000}, "special": "Life Steal 25%", "price": 5000000000},
  {"name": "Armor of the One True Legend", "type": "armor", "stats": {"Str": 12000, "Spd": 12000, "Int": 10000, "Luck": 10000}, "special": "Invincibility", "price": 5000000000},
  {"name": "Mythos Obliterator", "type": "weapon", "stats": {"Str": 12000, "Spd": 6000, "Luck": 7000}, "special": "Stun 15%", "price": 2600000000},
  {"name": "Legend's Final Bow", "type": "weapon", "stats": {"Spd": 11500, "Luck": 7000}, "special": "Critical +20%", "price": 2400000000},
  {"name": "Mythical Fortress Plate", "type": "armor", "stats": {"Str": 10000, "Int": 8000, "Luck": 7000}, "price": 2300000000},
  {"name": "Mythical Oracle Amulet", "type": "accessory", "stats": {"Int": 10000, "Luck": 7000}, "special": "Genesis Collapse", "price": 2000000000},
  {"name": "Mythical Titan's Last Stand", "type": "armor", "stats": {"Str": 11000, "Spd": 11000, "Int": 8000}, "price": 2700000000},
];

const forestWeaponItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Novice Meadow Stick", "type": "weapon", "stats": {"Str": 15, "Luck": 5}, "special": "Nature's Touch", "price": 200},
  {"name": "Apprentice Faerie Wand", "type": "weapon", "stats": {"Int": 35, "Luck": 10}, "special": "Pixie Dust", "price": 550},
  {"name": "Initiate Spirit Blade", "type": "weapon", "stats": {"Str": 55, "Spd": 15}, "special": "Spirit Strike", "price": 900},
  {"name": "Journeyman Grove Bow", "type": "weapon", "stats": {"Spd": 95, "Luck": 25}, "special": "Nature's Arrow", "price": 1800},
  {"name": "Adept Elder Branch", "type": "weapon", "stats": {"Int": 175, "Str": 50}, "special": "Elder Wisdom", "price": 3500},
  {"name": "Expert Forest Fang", "type": "weapon", "stats": {"Str": 350, "Spd": 80}, "special": "Creature's Bite", "price": 8000},
  {"name": "Master Heartwood Staff", "type": "weapon", "stats": {"Int": 700, "Luck": 150}, "special": "Heart of the Forest", "price": 20000},
  {"name": "Grandmaster Void Leaf", "type": "weapon", "stats": {"Str": 1400, "Int": 500}, "special": "Void Thorns", "price": 55000},
  {"name": "Champion World Tree Spear", "type": "weapon", "stats": {"Str": 2800, "Spd": 800}, "special": "World Tree's Fury", "price": 130000},
  {"name": "Overlord Genesis Blade", "type": "weapon", "stats": {"Str": 5500, "Luck": 1200}, "special": "Genesis Slash", "price": 300000},
  {"name": "Sovereign Primordial Bow", "type": "weapon", "stats": {"Spd": 11000, "Luck": 2500}, "special": "Primordial Shot", "price": 900000},
  {"name": "Ascendant Essence Scythe", "type": "weapon", "stats": {"Str": 27000, "Int": 8000}, "special": "Life's Harvest", "price": 2500000},
  {"name": "Legend's Heartwood Ragnarok", "type": "weapon", "stats": {"Str": 80000, "Int": 20000}, "special": "Forest Ragnarok", "price": 12000000},
  {"name": "Mythic Forest Obliterator", "type": "weapon", "stats": {"Str": 200000, "Spd": 80000, "Luck": 50000}, "special": "Mythic Overgrowth", "price": 60000000},
  {"name": "Mythical Legend's World-Root", "type": "weapon", "stats": {"Str": 12000, "Int": 8000, "Luck": 6000}, "special": "Root of Creation", "price": 2100000000},
];

function generateItems(items: Omit<Item, "id" | "tier">[], tier: ItemTier): Item[] {
  return items.map((item, index) => ({
    ...item,
    id: `${tier}-${index}`,
    tier,
  }));
}

const FOREST_WEAPON_RANKS: ItemTier[] = [
  "initiate", "initiate", "initiate", "journeyman", "adept",
  "expert", "master", "grandmaster", "champion", "overlord",
  "sovereign", "ascendant", "legend", "elite", "mythical_legend",
];

export const FOREST_WEAPONS: Item[] = forestWeaponItems.map((item, index) => ({
  ...item,
  id: `forest_weapon-${index}`,
  tier: FOREST_WEAPON_RANKS[index],
}));

export const ALL_ITEMS: Item[] = [
  ...generateItems(tier1Items, "normal"),
  ...generateItems(tier2Items, "super_rare"),
  ...generateItems(tier3Items, "x_tier"),
  ...generateItems(tier4Items, "umr"),
  ...generateItems(tier5Items, "ssumr"),
  ...generateItems(tier6Items, "divine"),
  ...generateItems(initiateItems, "initiate"),
  ...generateItems(journeymanItems, "journeyman"),
  ...generateItems(adeptItems, "adept"),
  ...generateItems(expertItems, "expert"),
  ...generateItems(masterItems, "master"),
  ...generateItems(grandmasterItems, "grandmaster"),
  ...generateItems(championItems, "champion"),
  ...generateItems(overlordItems, "overlord"),
  ...generateItems(sovereignItems, "sovereign"),
  ...generateItems(ascendantItems, "ascendant"),
  ...generateItems(legendItems, "legend"),
  ...generateItems(eliteItems, "elite"),
  ...generateItems(mythicalLegendItems, "mythical_legend"),
  ...FOREST_WEAPONS,
];

export const TIER_LABELS: Record<string, string> = {
  normal: "Normal",
  super_rare: "Super Rare",
  x_tier: "X-Tier",
  umr: "UMR",
  ssumr: "SSUMR",
  divine: "Divine",
  initiate: "Initiate",
  journeyman: "Journeyman",
  adept: "Adept",
  expert: "Expert",
  master: "Master",
  grandmaster: "Grandmaster",
  champion: "Champion",
  overlord: "Overlord",
  sovereign: "Sovereign",
  ascendant: "Ascendant",
  legend: "Legend",
  elite: "Elite",
  mythical_legend: "Mythical Legend",
};

export function getItemById(id: string): Item | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}

export interface ResourceItem {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "mythic";
  sellPrice: number;
  type: "resource";
  zone: string;
}

export const RESOURCE_ITEMS: Record<string, ResourceItem> = {
  iron_ore: { id: "iron_ore", name: "Iron Ore", rarity: "common", sellPrice: 15, type: "resource", zone: "Mountain Caverns" },
  silver_ore: { id: "silver_ore", name: "Silver Ore", rarity: "uncommon", sellPrice: 40, type: "resource", zone: "Mountain Caverns" },
  ruby_chunk: { id: "ruby_chunk", name: "Ruby Chunk", rarity: "rare", sellPrice: 120, type: "resource", zone: "Mountain Caverns" },
  mythril_ore: { id: "mythril_ore", name: "Mythril Ore", rarity: "epic", sellPrice: 500, type: "resource", zone: "Mountain Caverns" },
  plasma_core: { id: "plasma_core", name: "Plasma Core", rarity: "epic", sellPrice: 1200, type: "resource", zone: "Mountain Caverns" },
  chrono_crystal: { id: "chrono_crystal", name: "Chrono Crystal", rarity: "mythic", sellPrice: 5000, type: "resource", zone: "Mountain Caverns" },
  wood: { id: "wood", name: "Wood", rarity: "common", sellPrice: 10, type: "resource", zone: "Enchanted Forest" },
  fiber: { id: "fiber", name: "Fiber", rarity: "common", sellPrice: 12, type: "resource", zone: "Enchanted Forest" },
  healing_herb: { id: "healing_herb", name: "Healing Herb", rarity: "common", sellPrice: 18, type: "resource", zone: "Enchanted Forest" },
  wildflower_petal: { id: "wildflower_petal", name: "Wildflower Petal", rarity: "common", sellPrice: 14, type: "resource", zone: "Enchanted Forest" },
  meadow_moss: { id: "meadow_moss", name: "Meadow Moss", rarity: "common", sellPrice: 16, type: "resource", zone: "Enchanted Forest" },
  faerie_dust: { id: "faerie_dust", name: "Faerie Dust", rarity: "uncommon", sellPrice: 55, type: "resource", zone: "Enchanted Forest" },
  beast_hide: { id: "beast_hide", name: "Beast Hide", rarity: "uncommon", sellPrice: 45, type: "resource", zone: "Enchanted Forest" },
  glowing_mushroom: { id: "glowing_mushroom", name: "Glowing Mushroom", rarity: "uncommon", sellPrice: 50, type: "resource", zone: "Enchanted Forest" },
  luminous_crystal: { id: "luminous_crystal", name: "Luminous Crystal", rarity: "uncommon", sellPrice: 65, type: "resource", zone: "Enchanted Forest" },
  pixie_wing_dust: { id: "pixie_wing_dust", name: "Pixie Wing Dust", rarity: "uncommon", sellPrice: 70, type: "resource", zone: "Enchanted Forest" },
  nature_essence: { id: "nature_essence", name: "Nature Essence", rarity: "rare", sellPrice: 150, type: "resource", zone: "Enchanted Forest" },
  spirit_bark: { id: "spirit_bark", name: "Spirit Bark", rarity: "rare", sellPrice: 130, type: "resource", zone: "Enchanted Forest" },
  elder_wood_sap: { id: "elder_wood_sap", name: "Elder Wood Sap", rarity: "rare", sellPrice: 140, type: "resource", zone: "Enchanted Forest" },
  forest_spirit_essence: { id: "forest_spirit_essence", name: "Forest Spirit Essence", rarity: "rare", sellPrice: 180, type: "resource", zone: "Enchanted Forest" },
  ancient_leaf: { id: "ancient_leaf", name: "Ancient Leaf", rarity: "rare", sellPrice: 160, type: "resource", zone: "Enchanted Forest" },
  creature_fang: { id: "creature_fang", name: "Creature Fang", rarity: "epic", sellPrice: 400, type: "resource", zone: "Enchanted Forest" },
  mythic_beast_hide: { id: "mythic_beast_hide", name: "Mythic Beast Hide", rarity: "epic", sellPrice: 500, type: "resource", zone: "Enchanted Forest" },
  void_crystal: { id: "void_crystal", name: "Void Crystal", rarity: "epic", sellPrice: 600, type: "resource", zone: "Enchanted Forest" },
  rare_pet_fragment: { id: "rare_pet_fragment", name: "Rare Pet Fragment", rarity: "epic", sellPrice: 800, type: "resource", zone: "Enchanted Forest" },
  soul_shard_resource: { id: "soul_shard_resource", name: "Soul Shard", rarity: "epic", sellPrice: 800, type: "resource", zone: "Enchanted Forest" },
  heartwood_crystal: { id: "heartwood_crystal", name: "Heartwood Crystal", rarity: "mythic", sellPrice: 2500, type: "resource", zone: "Enchanted Forest" },
  world_tree_sap: { id: "world_tree_sap", name: "World Tree Sap", rarity: "mythic", sellPrice: 3000, type: "resource", zone: "Enchanted Forest" },
  primordial_seed: { id: "primordial_seed", name: "Primordial Seed", rarity: "mythic", sellPrice: 3500, type: "resource", zone: "Enchanted Forest" },
  essence_of_life: { id: "essence_of_life", name: "Essence of Life", rarity: "mythic", sellPrice: 4000, type: "resource", zone: "Enchanted Forest" },
  genesis_fragment: { id: "genesis_fragment", name: "Genesis Fragment", rarity: "mythic", sellPrice: 5000, type: "resource", zone: "Enchanted Forest" },
  aether_fragment: { id: "aether_fragment", name: "Aether Fragment", rarity: "rare", sellPrice: 200, type: "resource", zone: "Coastal Village" },
  sea_salt: { id: "sea_salt", name: "Sea Salt", rarity: "common", sellPrice: 8, type: "resource", zone: "Coastal Village" },
  coral_piece: { id: "coral_piece", name: "Coral Piece", rarity: "uncommon", sellPrice: 35, type: "resource", zone: "Coastal Village" },
  crafting_reagent: { id: "crafting_reagent", name: "Crafting Reagent", rarity: "uncommon", sellPrice: 50, type: "resource", zone: "Coastal Village" },
  rare_essence: { id: "rare_essence", name: "Rare Essence", rarity: "rare", sellPrice: 180, type: "resource", zone: "Mystic Tower" },
  tempest_stone: { id: "tempest_stone", name: "Tempest Stone", rarity: "epic", sellPrice: 900, type: "resource", zone: "Mystic Tower" },
  arcane_dust: { id: "arcane_dust", name: "Arcane Dust", rarity: "common", sellPrice: 25, type: "resource", zone: "Mystic Tower" },
  mana_crystal: { id: "mana_crystal", name: "Mana Crystal", rarity: "uncommon", sellPrice: 60, type: "resource", zone: "Mystic Tower" },
  raw_ruby: { id: "raw_ruby", name: "Raw Ruby", rarity: "uncommon", sellPrice: 55, type: "resource", zone: "Ruby Mines" },
  gold_nugget: { id: "gold_nugget", name: "Gold Nugget", rarity: "rare", sellPrice: 130, type: "resource", zone: "Ruby Mines" },
  deep_iron: { id: "deep_iron", name: "Deep Iron", rarity: "common", sellPrice: 18, type: "resource", zone: "Ruby Mines" },
  crystal_shard: { id: "crystal_shard", name: "Crystal Shard", rarity: "epic", sellPrice: 650, type: "resource", zone: "Ruby Mines" },
  lake_crystal: { id: "lake_crystal", name: "Lake Crystal", rarity: "uncommon", sellPrice: 42, type: "resource", zone: "Crystal Lake" },
  water_lily: { id: "water_lily", name: "Water Lily", rarity: "common", sellPrice: 14, type: "resource", zone: "Crystal Lake" },
  moonstone: { id: "moonstone", name: "Moonstone", rarity: "rare", sellPrice: 160, type: "resource", zone: "Crystal Lake" },
  ancient_relic: { id: "ancient_relic", name: "Ancient Relic", rarity: "rare", sellPrice: 170, type: "resource", zone: "Ancient Ruins" },
  ruin_stone: { id: "ruin_stone", name: "Ruin Stone", rarity: "common", sellPrice: 20, type: "resource", zone: "Ancient Ruins" },
  shadow_fragment: { id: "shadow_fragment", name: "Shadow Fragment", rarity: "uncommon", sellPrice: 55, type: "resource", zone: "Ancient Ruins" },
  void_shard: { id: "void_shard", name: "Void Shard", rarity: "epic", sellPrice: 1000, type: "resource", zone: "Ancient Ruins" },
  hellfire_ember: { id: "hellfire_ember", name: "Hellfire Ember", rarity: "rare", sellPrice: 250, type: "resource", zone: "Hell Zone" },
  demon_bone: { id: "demon_bone", name: "Demon Bone", rarity: "uncommon", sellPrice: 70, type: "resource", zone: "Hell Zone" },
  abyssal_core: { id: "abyssal_core", name: "Abyssal Core", rarity: "mythic", sellPrice: 4000, type: "resource", zone: "Hell Zone" },
};

export function getResourceById(id: string): ResourceItem | undefined {
  return RESOURCE_ITEMS[id];
}
