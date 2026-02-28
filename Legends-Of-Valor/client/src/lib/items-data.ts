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
  {"name": "Mythical Origin Sword", "type": "weapon", "stats": {"Str": 1000000}, "price": 1000000000},
  {"name": "Mythical Eternity Core", "type": "weapon", "stats": {"Int": 1000000}, "price": 1000000000},
];

const legendItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Legendary Realm Splitter", "type": "weapon", "stats": {"Str": 2800, "Luck": 1800}, "special": "Critical +12%", "price": 150000000},
  {"name": "Bow of Mythic Legends", "type": "weapon", "stats": {"Spd": 2800, "Luck": 1800}, "special": "Stun 10%", "price": 150000000},
  {"name": "Staff of Eternal Myth", "type": "weapon", "stats": {"Int": 3400}, "special": "Burn 3t", "price": 165000000},
  {"name": "Legendary Hero's Armor", "type": "armor", "stats": {"Str": 2200, "Spd": 2200, "Int": 1700, "Luck": 1700}, "special": "Heroic Aura", "price": 180000000},
  {"name": "Heart of Legends", "type": "accessory", "stats": {"Int": 2500, "Luck": 1700}, "special": "Legendary Will", "price": 140000000},
  {"name": "Blade of Ancient Heroes", "type": "weapon", "stats": {"Str": 3100, "Spd": 1500}, "special": "Critical +12%", "price": 175000000},
  {"name": "Legendary Shadowweave", "type": "armor", "stats": {"Spd": 2600, "Int": 2000}, "special": "Legend's Cloak", "price": 158000000},
  {"name": "Ring of Timeless Glory", "type": "accessory", "stats": {"Luck": 2600, "Str": 1400}, "special": "Eternal Fame", "price": 162000000},
  {"name": "Legend's Runic Greatsword", "type": "weapon", "stats": {"Str": 2950, "Spd": 1400}, "special": "Stun 10%", "price": 168000000},
  {"name": "Legend's Spirit Bow", "type": "weapon", "stats": {"Spd": 2880, "Luck": 1760}, "special": "Burn 3t", "price": 155000000},
  {"name": "Legend's Monument Plate", "type": "armor", "stats": {"Str": 2300, "Int": 1650, "Luck": 1600}, "price": 165000000},
  {"name": "Legend's Myth Robe", "type": "armor", "stats": {"Int": 2750, "Spd": 2100}, "price": 148000000},
  {"name": "Legend's Heroic Signet", "type": "accessory", "stats": {"Str": 2400, "Luck": 1600}, "price": 135000000},
  {"name": "Legend's Eternal Amulet", "type": "accessory", "stats": {"Int": 2650, "Luck": 1800}, "special": "Hero's Legacy", "price": 138000000},
  {"name": "Legend's Titan Gauntlets", "type": "armor", "stats": {"Str": 2250, "Spd": 2100}, "price": 155000000},
];

const eliteItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Elite Omega Destroyer", "type": "weapon", "stats": {"Str": 5000, "Luck": 3000}, "special": "Double Strike", "price": 500000000},
  {"name": "Bow of Ultimate Annihilation", "type": "weapon", "stats": {"Spd": 5000, "Luck": 3000}, "special": "Life Steal 20%", "price": 500000000},
  {"name": "Staff of Absolute Infinity", "type": "weapon", "stats": {"Int": 6000}, "special": "Critical +20%", "price": 550000000},
  {"name": "Elite Transcendence Armor", "type": "armor", "stats": {"Str": 4000, "Spd": 4000, "Int": 3000, "Luck": 3000}, "special": "Transcendent Shield", "price": 600000000},
  {"name": "Crown of the Elite", "type": "accessory", "stats": {"Int": 4500, "Luck": 3000}, "special": "Elite Dominion", "price": 480000000},
  {"name": "Blade of Final Reckoning", "type": "weapon", "stats": {"Str": 5500, "Spd": 2800}, "special": "Double Strike", "price": 580000000},
  {"name": "Elite Voidweave Mantle", "type": "armor", "stats": {"Spd": 4700, "Int": 3500}, "special": "Void Mastery", "price": 520000000},
  {"name": "Ring of Ultimate Supremacy", "type": "accessory", "stats": {"Luck": 4700, "Str": 2500}, "special": "Supreme Authority", "price": 540000000},
  {"name": "Elite Null-Blade", "type": "weapon", "stats": {"Str": 5300, "Spd": 2700}, "special": "Life Steal 20%", "price": 565000000},
  {"name": "Elite Void Piercer Bow", "type": "weapon", "stats": {"Spd": 5100, "Luck": 2950}, "special": "Critical +20%", "price": 510000000},
  {"name": "Elite Bastion Plate", "type": "armor", "stats": {"Str": 4200, "Int": 2900, "Luck": 2800}, "price": 540000000},
  {"name": "Elite Nullweave Robe", "type": "armor", "stats": {"Int": 4900, "Spd": 3800}, "price": 500000000},
  {"name": "Elite Supreme Signet", "type": "accessory", "stats": {"Str": 4400, "Luck": 2800}, "price": 460000000},
  {"name": "Elite Oracle Medallion", "type": "accessory", "stats": {"Int": 4700, "Luck": 3050}, "special": "Infinity Cascade", "price": 475000000},
  {"name": "Elite Titan Gauntlets", "type": "armor", "stats": {"Str": 4100, "Spd": 3900}, "price": 515000000},
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

function generateItems(items: Omit<Item, "id" | "tier">[], tier: ItemTier): Item[] {
  return items.map((item, index) => ({
    ...item,
    id: `${tier}-${index}`,
    tier,
  }));
}

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
