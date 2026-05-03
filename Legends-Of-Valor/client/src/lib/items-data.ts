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

// ─── FLOOR TARGET POWER RANGES (5x per floor) ────────────────────────────────
// Floor 1: 100-500       Floor 2: 500-2500      Floor 3: 2500-12500
// Floor 4: 12500-62500   Floor 5: 62500-312500  Floor 6: 312K-1.56M
// Floor 7: 1.56M-7.8M   Floor 8: 7.8M-39M      Floor 9: 39M-195M
// Floor10: 195M-976M     Floor11: 976M-4.9B     Floor12: 4.9B-24.4B
// Items need combined stats from 3 gear slots ≈ 1.3× floor midpoint

// ─── TIER 1 – Normal (Novice / Floor 1–2, targets ~400 per main stat) ─────────
const tier1Items: Omit<Item, "id" | "tier">[] = [
  { name: "Arcane Staff",       type: "weapon",    stats: { Int: 350 },                  special: "Mana Regen",       price: 300 },
  { name: "Thunder Hammer",     type: "weapon",    stats: { Str: 280, Luck: 80 },        special: "Stun 5%",          price: 280 },
  { name: "Shadow Cloak",       type: "armor",     stats: { Spd: 260, Luck: 80 },                                     price: 300 },
  { name: "Mystic Robes",       type: "armor",     stats: { Int: 320 },                                               price: 300 },
  { name: "Guardian Plate",     type: "armor",     stats: { Str: 350 },                                               price: 320 },
  { name: "Frost Dagger",       type: "weapon",    stats: { Spd: 320 },                  special: "Freeze 1t",        price: 330 },
  { name: "Ember Wand",         type: "weapon",    stats: { Int: 310 },                  special: "Burn 2t",          price: 340 },
  { name: "Lucky Ring",         type: "accessory", stats: { Luck: 380 },                                              price: 345 },
  { name: "Flame Cloak",        type: "armor",     stats: { Str: 330 },                  special: "Fire Resist",      price: 350 },
  { name: "Swift Helm",         type: "armor",     stats: { Spd: 280, Int: 100 },                                     price: 355 },
  { name: "Thunder Bow",        type: "weapon",    stats: { Spd: 360 },                  special: "Stun 5%",          price: 360 },
  { name: "Arcane Amulet",      type: "accessory", stats: { Int: 340 },                  special: "Mana Regen",       price: 365 },
  { name: "Shadow Saber",       type: "weapon",    stats: { Str: 380 },                  special: "Critical +5%",     price: 370 },
  { name: "Frost Robes",        type: "armor",     stats: { Int: 340 },                  special: "Freeze",           price: 365 },
  { name: "Lucky Pendant",      type: "accessory", stats: { Luck: 400, Str: 120 },                                    price: 370 },
];

// ─── TIER 2 – Super Rare (Novice / Floor 1–2, ~700 per main stat) ─────────────
const tier2Items: Omit<Item, "id" | "tier">[] = [
  { name: "Elemental Vest",         type: "armor",     stats: { Str: 200, Spd: 200, Int: 200, Luck: 200 },                          price: 400 },
  { name: "SR Ring of Fortune",     type: "accessory", stats: { Luck: 750 },                                                         price: 420 },
  { name: "Frost Bow",              type: "weapon",    stats: { Spd: 600, Luck: 250 },               special: "Critical +8%",        price: 430 },
  { name: "Ember Robes",            type: "armor",     stats: { Int: 680 },                           special: "Fire Resist",         price: 440 },
  { name: "Shadow Fang",            type: "weapon",    stats: { Str: 720 },                           special: "Stun 8%",             price: 445 },
  { name: "Arcane Sabre",           type: "weapon",    stats: { Str: 760 },                           special: "Critical +8%",        price: 450 },
  { name: "Lightning Dagger",       type: "weapon",    stats: { Spd: 700 },                           special: "Life Steal 5%",       price: 455 },
  { name: "SR Ring of Insight",     type: "accessory", stats: { Int: 700, Luck: 280 },                                               price: 460 },
  { name: "SR Swift Boots",         type: "armor",     stats: { Spd: 720, Str: 280 },                                               price: 465 },
  { name: "SR Ember Staff",         type: "weapon",    stats: { Int: 780 },                           special: "Burn 3t",             price: 470 },
  { name: "SR Frost Fang",          type: "weapon",    stats: { Str: 800 },                           special: "Stun 8%",             price: 470 },
  { name: "SR Lucky Pendant",       type: "accessory", stats: { Luck: 820, Str: 300 },                                               price: 475 },
  { name: "Shadow Blade",           type: "weapon",    stats: { Str: 850 },                           special: "Life Steal 5%",       price: 480 },
  { name: "SR Arcane Mantle",       type: "armor",     stats: { Int: 850 },                           special: "Magic Shield",        price: 480 },
  { name: "Ring of Valor",          type: "accessory", stats: { Luck: 900, Int: 400 },                                               price: 490 },
];

// ─── TIER 3 – X-Tier (Novice / Floor 2–3, ~1500 per main stat) ───────────────
const tier3Items: Omit<Item, "id" | "tier">[] = [
  { name: "Titan's Hammer",          type: "weapon",    stats: { Str: 1800, Luck: 600 },   special: "Poison 3t",        price: 1000 },
  { name: "Infinity Bow",            type: "weapon",    stats: { Spd: 1800, Luck: 600 },   special: "Freeze 2t",        price: 1000 },
  { name: "Sage's Staff",            type: "weapon",    stats: { Int: 1800 },               special: "Life Steal 8%",    price: 1000 },
  { name: "Omniguard Armor",         type: "armor",     stats: { Str: 1000, Spd: 1000, Int: 1000, Luck: 1000 },         price: 1050 },
  { name: "Dragonfang Blade",        type: "weapon",    stats: { Str: 2000, Spd: 700 },     special: "Critical +10%",    price: 1100 },
  { name: "Archmage Robes",          type: "armor",     stats: { Int: 2000, Luck: 700 },                                 price: 1100 },
  { name: "Shadow Eclipse Cloak",    type: "armor",     stats: { Spd: 1800, Luck: 900 },                                 price: 1120 },
  { name: "Phoenix Saber",           type: "weapon",    stats: { Str: 2200 },               special: "Critical +10%",    price: 1150 },
  { name: "Frostbite Bow",           type: "weapon",    stats: { Spd: 2100 },               special: "Freeze 2t",        price: 1150 },
  { name: "Orb of Wisdom",           type: "accessory", stats: { Int: 1900, Luck: 700 },                                 price: 1130 },
  { name: "Titan Gauntlets",         type: "armor",     stats: { Str: 1800, Spd: 700 },                                  price: 1050 },
  { name: "Lightning Hammer",        type: "weapon",    stats: { Str: 2100 },               special: "Poison 3t",        price: 1150 },
  { name: "Mystic Staff",            type: "weapon",    stats: { Int: 2200 },               special: "Life Steal 8%",    price: 1150 },
  { name: "Ring of Omniscience",     type: "accessory", stats: { Luck: 2100 },                                           price: 1150 },
];

// ─── TIER 4 – UMR (Novice / Floor 3, ~4000 per main stat) ────────────────────
const tier4Items: Omit<Item, "id" | "tier">[] = [
  { name: "Oblivion Fang",              type: "weapon",    stats: { Str: 4500, Luck: 1800 },   special: "Stun 10%",         price: 10000 },
  { name: "Eternal Eclipse Blade",      type: "weapon",    stats: { Str: 4800, Spd: 1800 },    special: "Double Strike",    price: 10500 },
  { name: "Archmage's Eternal Robe",    type: "armor",     stats: { Int: 4800, Luck: 1800 },                                price: 10500 },
  { name: "Shadow Eclipse Mantle",      type: "armor",     stats: { Spd: 4500, Luck: 1800 },                                price: 10200 },
  { name: "Phoenix Soul Saber",         type: "weapon",    stats: { Str: 5200 },               special: "Double Strike",    price: 11000 },
  { name: "Frost Reaper Bow",           type: "weapon",    stats: { Spd: 5000 },               special: "Silence 1t",       price: 11000 },
  { name: "Orb of Divine Insight",      type: "accessory", stats: { Int: 4800, Luck: 1600 },                                price: 10700 },
  { name: "Titan's Gauntlets",          type: "armor",     stats: { Str: 4500, Spd: 1800 },                                price: 10200 },
  { name: "Lightning Devastator",       type: "weapon",    stats: { Str: 5200 },               special: "Life Steal 12%",   price: 11000 },
  { name: "Mystic Grand Staff",         type: "weapon",    stats: { Int: 5200 },               special: "Stun 10%",         price: 11000 },
  { name: "Ring of Eternal Omniscience",type: "accessory", stats: { Luck: 5200 },                                           price: 11000 },
  { name: "Pendant of Absolute Luck",   type: "accessory", stats: { Luck: 5200, Str: 2200 },                                price: 11200 },
];

// ─── TIER 5 – SSUMR (Apprentice / Floor 3–4, ~10000 per main stat) ───────────
const tier5Items: Omit<Item, "id" | "tier">[] = [
  { name: "SSUMR Dragon Slayer",   type: "weapon",    stats: { Str: 10000, Luck: 3000 },  special: "Dragon Bane",      price: 5000 },
  { name: "SSUMR Sage Staff",      type: "weapon",    stats: { Int: 10000, Luck: 3000 },  special: "Sage Wisdom",      price: 5000 },
  { name: "SSUMR Void Blade",      type: "weapon",    stats: { Str: 11000, Spd: 4000 },   special: "Void Slash",       price: 5500 },
  { name: "SSUMR Spirit Robe",     type: "armor",     stats: { Int: 9500, Spd: 4000 },                                  price: 5200 },
  { name: "SSUMR Titan Plate",     type: "armor",     stats: { Str: 10000, Pot: 4000 },                                 price: 5300 },
  { name: "SSUMR Fortune Ring",    type: "accessory", stats: { Luck: 12000, Int: 4000 },                                price: 5800 },
];

// ─── TIER 6 – Divine (Apprentice / Floor 4, ~18000 per main stat) ────────────
const tier6Items: Omit<Item, "id" | "tier">[] = [
  { name: "Divine World Breaker",   type: "weapon",    stats: { Str: 20000, Luck: 6000 },  special: "World Ender",      price: 15000 },
  { name: "Divine Eternity Wand",   type: "weapon",    stats: { Int: 20000, Luck: 6000 },  special: "Eternal Mana",     price: 15000 },
  { name: "Divine Aegis Plate",     type: "armor",     stats: { Str: 18000, Pot: 8000 },                                price: 14000 },
  { name: "Divine Veil Robe",       type: "armor",     stats: { Int: 18000, Spd: 7000 },                                price: 14000 },
  { name: "Divine Star Amulet",     type: "accessory", stats: { Luck: 22000, Int: 8000 },                               price: 16000 },
  { name: "Divine Storm Bow",       type: "weapon",    stats: { Spd: 20000, Luck: 6000 },  special: "Stun 10%",         price: 15500 },
];

// ─── Initiate (Initiate / Floor 4–5, ~35000 per main stat) ───────────────────
const initiateItems: Omit<Item, "id" | "tier">[] = [
  { name: "Initiate War Blade",        type: "weapon",    stats: { Str: 38000, Luck: 12000 },   special: "Critical +12%",   price: 35000 },
  { name: "Initiate Arcane Rod",       type: "weapon",    stats: { Int: 38000, Luck: 12000 },   special: "Silence 1t",      price: 35000 },
  { name: "Initiate Swift Bow",        type: "weapon",    stats: { Spd: 40000, Luck: 12000 },   special: "Freeze 2t",       price: 36000 },
  { name: "Initiate Iron Plate",       type: "armor",     stats: { Str: 35000, Pot: 15000 },                               price: 33000 },
  { name: "Initiate Mage Robe",        type: "armor",     stats: { Int: 35000, Spd: 14000 },                               price: 33000 },
  { name: "Initiate Luck Stone",       type: "accessory", stats: { Luck: 45000, Str: 15000 },                              price: 38000 },
  { name: "Initiate Focus Charm",      type: "accessory", stats: { Int: 42000, Luck: 14000 },                              price: 37000 },
];

// ─── Journeyman (Journeyman / Floor 5–6, ~100000 per main stat) ──────────────
const journeymanItems: Omit<Item, "id" | "tier">[] = [
  { name: "Journeyman Steel Blade",    type: "weapon",    stats: { Str: 110000, Luck: 35000 },  special: "Critical +12%",   price: 120000 },
  { name: "Journeyman Focus Staff",    type: "weapon",    stats: { Int: 110000, Luck: 35000 },  special: "Life Steal 10%",  price: 120000 },
  { name: "Journeyman War Bow",        type: "weapon",    stats: { Spd: 115000, Luck: 35000 },  special: "Poison 3t",       price: 125000 },
  { name: "Journeyman Battle Plate",   type: "armor",     stats: { Str: 100000, Pot: 40000 },                               price: 110000 },
  { name: "Journeyman Sage Robe",      type: "armor",     stats: { Int: 100000, Spd: 38000 },                               price: 110000 },
  { name: "Journeyman Power Ring",     type: "accessory", stats: { Luck: 125000, Str: 40000 },                              price: 130000 },
  { name: "Journeyman Mana Crystal",   type: "accessory", stats: { Int: 120000, Luck: 38000 },                              price: 128000 },
];

// ─── Adept (Adept / Floor 6–7, ~300000 per main stat) ────────────────────────
const adeptItems: Omit<Item, "id" | "tier">[] = [
  { name: "Adept Battle Axe",          type: "weapon",    stats: { Str: 340000, Luck: 100000 }, special: "Double Strike",   price: 350000 },
  { name: "Adept Mystic Orb",          type: "weapon",    stats: { Int: 340000, Luck: 100000 }, special: "Stun 12%",        price: 350000 },
  { name: "Adept Storm Lance",         type: "weapon",    stats: { Spd: 360000, Luck: 100000 }, special: "Critical +15%",   price: 370000 },
  { name: "Adept Fortress Plate",      type: "armor",     stats: { Str: 310000, Pot: 120000 },                              price: 320000 },
  { name: "Adept Arcana Robe",         type: "armor",     stats: { Int: 310000, Spd: 110000 },                              price: 320000 },
  { name: "Adept Destiny Ring",        type: "accessory", stats: { Luck: 400000, Str: 120000 },                             price: 390000 },
  { name: "Adept Wisdom Pendant",      type: "accessory", stats: { Int: 380000, Luck: 115000 },                             price: 380000 },
];

// ─── Expert (Expert / Floor 7–8, ~1000000 per main stat) ─────────────────────
const expertItems: Omit<Item, "id" | "tier">[] = [
  { name: "Expert War Hammer",         type: "weapon",    stats: { Str: 1100000, Luck: 350000 },  special: "Dragon Bane",     price: 1200000 },
  { name: "Expert Sorcerer Cane",      type: "weapon",    stats: { Int: 1100000, Luck: 350000 },  special: "Silence 2t",      price: 1200000 },
  { name: "Expert Phantom Bow",        type: "weapon",    stats: { Spd: 1150000, Luck: 350000 },  special: "Poison 4t",       price: 1250000 },
  { name: "Expert Titan Plate",        type: "armor",     stats: { Str: 1000000, Pot: 400000 },                               price: 1100000 },
  { name: "Expert Archmage Robe",      type: "armor",     stats: { Int: 1000000, Spd: 380000 },                               price: 1100000 },
  { name: "Expert Chaos Ring",         type: "accessory", stats: { Luck: 1300000, Str: 420000 },                              price: 1350000 },
  { name: "Expert Sage Talisman",      type: "accessory", stats: { Int: 1250000, Luck: 400000 },                              price: 1300000 },
];

// ─── Master (Master / Floor 8–9, ~4000000 per main stat) ─────────────────────
const masterItems: Omit<Item, "id" | "tier">[] = [
  { name: "Master Katana",             type: "weapon",    stats: { Str: 4500000, Luck: 1400000 },  special: "Life Steal 15%",  price: 5000000 },
  { name: "Master Archmage Staff",     type: "weapon",    stats: { Int: 4500000, Luck: 1400000 },  special: "Stun 15%",        price: 5000000 },
  { name: "Master Eclipse Bow",        type: "weapon",    stats: { Spd: 4700000, Luck: 1500000 },  special: "Freeze 3t",       price: 5200000 },
  { name: "Master Celestial Plate",    type: "armor",     stats: { Str: 4200000, Pot: 1600000 },                               price: 4600000 },
  { name: "Master Void Robe",          type: "armor",     stats: { Int: 4200000, Spd: 1500000 },                               price: 4600000 },
  { name: "Master Eternity Ring",      type: "accessory", stats: { Luck: 5500000, Str: 1700000 },                              price: 5800000 },
  { name: "Master Genesis Orb",        type: "accessory", stats: { Int: 5200000, Luck: 1600000 },                              price: 5600000 },
];

// ─── Grandmaster (Grandmaster / Floor 9–10, ~15000000 per main stat) ──────────
const grandmasterItems: Omit<Item, "id" | "tier">[] = [
  { name: "Grandmaster Greatsword",    type: "weapon",    stats: { Str: 17000000, Luck: 5500000 },  special: "Double Strike",    price: 20000000 },
  { name: "Grandmaster Void Wand",     type: "weapon",    stats: { Int: 17000000, Luck: 5500000 },  special: "Arcane Burst",     price: 20000000 },
  { name: "Grandmaster Storm Bow",     type: "weapon",    stats: { Spd: 18000000, Luck: 5500000 },  special: "Poison 4t",        price: 21000000 },
  { name: "Grandmaster Dragonplate",   type: "armor",     stats: { Str: 15000000, Pot: 6000000 },                                price: 18000000 },
  { name: "Grandmaster Phantom Robe",  type: "armor",     stats: { Int: 15000000, Spd: 5800000 },                                price: 18000000 },
  { name: "Grandmaster Omega Ring",    type: "accessory", stats: { Luck: 21000000, Str: 6500000 },                               price: 23000000 },
  { name: "Grandmaster Arcane Stone",  type: "accessory", stats: { Int: 20000000, Luck: 6000000 },                               price: 22000000 },
];

// ─── Champion (Champion / Floor 10–11, ~70000000 per main stat) ───────────────
const championItems: Omit<Item, "id" | "tier">[] = [
  { name: "Champion Lance",            type: "weapon",    stats: { Str: 75000000, Luck: 24000000 },  special: "World Shatter",    price: 90000000 },
  { name: "Champion Celestial Harp",   type: "weapon",    stats: { Int: 75000000, Luck: 24000000 },  special: "Silence 2t",       price: 90000000 },
  { name: "Champion Void Bow",         type: "weapon",    stats: { Spd: 80000000, Luck: 24000000 },  special: "Critical +18%",    price: 95000000 },
  { name: "Champion Genesis Plate",    type: "armor",     stats: { Str: 68000000, Pot: 27000000 },                                price: 82000000 },
  { name: "Champion Aether Robe",      type: "armor",     stats: { Int: 68000000, Spd: 25000000 },                                price: 82000000 },
  { name: "Champion Legend Ring",      type: "accessory", stats: { Luck: 95000000, Str: 29000000 },                               price: 105000000 },
  { name: "Champion Eternity Gem",     type: "accessory", stats: { Int: 90000000, Luck: 27000000 },                               price: 100000000 },
];

// ─── Overlord (Overlord / Floor 11–12, ~280000000 per main stat) ──────────────
const overlordItems: Omit<Item, "id" | "tier">[] = [
  { name: "Overlord Scythe",           type: "weapon",    stats: { Str: 300000000, Luck: 95000000 },  special: "Soul Harvest",     price: 380000000 },
  { name: "Overlord Chaos Orb",        type: "weapon",    stats: { Int: 300000000, Luck: 95000000 },  special: "Chaos Rift",       price: 380000000 },
  { name: "Overlord Genesis Bow",      type: "weapon",    stats: { Spd: 320000000, Luck: 95000000 },  special: "Void Arrow",       price: 400000000 },
  { name: "Overlord Titan Plate",      type: "armor",     stats: { Str: 270000000, Pot: 110000000 },                               price: 340000000 },
  { name: "Overlord Void Mantle",      type: "armor",     stats: { Int: 270000000, Spd: 100000000 },                               price: 340000000 },
  { name: "Overlord Omega Ring",       type: "accessory", stats: { Luck: 380000000, Str: 115000000 },                              price: 450000000 },
  { name: "Overlord Arcane Heart",     type: "accessory", stats: { Int: 360000000, Luck: 110000000 },                              price: 430000000 },
];

// ─── Sovereign (Sovereign / Floor 12–13, ~1200000000 per main stat) ───────────
const sovereignItems: Omit<Item, "id" | "tier">[] = [
  { name: "Sovereign Excalibur",       type: "weapon",    stats: { Str: 1300000000, Luck: 420000000 },  special: "Holy Slash",       price: 1600000000 },
  { name: "Sovereign Genesis Staff",   type: "weapon",    stats: { Int: 1300000000, Luck: 420000000 },  special: "Genesis Ray",      price: 1600000000 },
  { name: "Sovereign Storm Spear",     type: "weapon",    stats: { Spd: 1400000000, Luck: 420000000 },  special: "Storm Pierce",     price: 1700000000 },
  { name: "Sovereign Aegis Plate",     type: "armor",     stats: { Str: 1150000000, Pot: 460000000 },                               price: 1450000000 },
  { name: "Sovereign Eclipse Robe",    type: "armor",     stats: { Int: 1150000000, Spd: 440000000 },                               price: 1450000000 },
  { name: "Sovereign Cosmos Ring",     type: "accessory", stats: { Luck: 1650000000, Str: 490000000 },                              price: 1950000000 },
  { name: "Sovereign Void Crystal",    type: "accessory", stats: { Int: 1550000000, Luck: 470000000 },                              price: 1850000000 },
];

// ─── Ascendant (Ascendant / Floor 13–14, ~5000000000 per main stat) ───────────
const ascendantItems: Omit<Item, "id" | "tier">[] = [
  { name: "Ascendant Star-Eater",      type: "weapon",    stats: { Str: 5500000000, Luck: 1800000000 },  special: "Star Crush",       price: 7000000000 },
  { name: "Ascendant Nebula Wand",     type: "weapon",    stats: { Int: 5500000000, Luck: 1800000000 },  special: "Nebula Burst",     price: 7000000000 },
  { name: "Ascendant Cosmic Bow",      type: "weapon",    stats: { Spd: 5800000000, Luck: 1800000000 },  special: "Starfall",         price: 7400000000 },
  { name: "Ascendant Nova Plate",      type: "armor",     stats: { Str: 5000000000, Pot: 2000000000 },                               price: 6200000000 },
  { name: "Ascendant Infinity Robe",   type: "armor",     stats: { Int: 5000000000, Spd: 1900000000 },                               price: 6200000000 },
  { name: "Ascendant Eternity Ring",   type: "accessory", stats: { Luck: 7200000000, Str: 2100000000 },                              price: 8500000000 },
  { name: "Ascendant Genesis Jewel",   type: "accessory", stats: { Int: 6800000000, Luck: 2000000000 },                              price: 8100000000 },
];

// ─── Legend (Legend / Floor 14–15, ~20000000000 per main stat) ────────────────
const legendItems: Omit<Item, "id" | "tier">[] = [
  { name: "Legendary Ragnarok",        type: "weapon",    stats: { Str: 22000000000, Luck: 7000000000 },  special: "Ragnarok Strike",  price: 28000000000 },
  { name: "Legendary Chronos Staff",   type: "weapon",    stats: { Int: 22000000000, Luck: 7000000000 },  special: "Time Warp",        price: 28000000000 },
  { name: "Legendary Void Bow",        type: "weapon",    stats: { Spd: 24000000000, Luck: 7000000000 },  special: "Void Arrow",       price: 30000000000 },
  { name: "Legendary Titan Plate",     type: "armor",     stats: { Str: 20000000000, Pot: 8000000000 },                               price: 25000000000 },
  { name: "Legendary Arcane Robe",     type: "armor",     stats: { Int: 20000000000, Spd: 7500000000 },                               price: 25000000000 },
  { name: "Legendary Fate Ring",       type: "accessory", stats: { Luck: 28000000000, Str: 8500000000 },                              price: 34000000000 },
  { name: "Legendary Genesis Gem",     type: "accessory", stats: { Int: 26000000000, Luck: 8000000000 },                              price: 32000000000 },
];

// ─── Elite (Elite / Floor 15–16, ~80000000000 per main stat) ──────────────────
const eliteItems: Omit<Item, "id" | "tier">[] = [
  { name: "Elite Vanguard Blade",      type: "weapon",    stats: { Str: 90000000000, Luck: 28000000000 },  special: "Vanguard Slash",   price: 110000000000 },
  { name: "Elite Oracle Eye",          type: "weapon",    stats: { Int: 90000000000, Luck: 28000000000 },  special: "Oracle Blast",     price: 110000000000 },
  { name: "Elite Abyss Bow",           type: "weapon",    stats: { Spd: 95000000000, Luck: 28000000000 },  special: "Abyss Arrow",      price: 115000000000 },
  { name: "Elite Titan's Armor",       type: "armor",     stats: { Str: 82000000000, Pot: 32000000000 },                               price: 100000000000 },
  { name: "Elite Void Shroud",         type: "armor",     stats: { Int: 82000000000, Spd: 30000000000 },                               price: 100000000000 },
  { name: "Elite Omega Ring",          type: "accessory", stats: { Luck: 115000000000, Str: 34000000000 }, special: "Omega Luck",       price: 135000000000 },
  { name: "Elite Genesis Core",        type: "accessory", stats: { Int: 108000000000, Luck: 32000000000 },                              price: 128000000000 },
];

// ─── Mythical Legend (Mythical Legend / Floor 17+, massive multi-stat) ────────
const mythicalLegendItems: Omit<Item, "id" | "tier">[] = [
  { name: "Mythical Legend's Worldsplitter", type: "weapon",    stats: { Str: 320000000000, Spd: 150000000000, Luck: 180000000000 }, special: "World Shatter",        price: 2000000000000 },
  { name: "Bow of Eternal Myths",            type: "weapon",    stats: { Spd: 350000000000, Luck: 200000000000 },                    special: "Life Steal 25%",       price: 2000000000000 },
  { name: "Staff of Creation's End",         type: "weapon",    stats: { Int: 380000000000, Luck: 180000000000 },                    special: "Stun 15%",             price: 2200000000000 },
  { name: "Armor of Mythical Perfection",    type: "armor",     stats: { Str: 280000000000, Spd: 280000000000, Int: 220000000000, Luck: 220000000000 }, special: "Myth Shield", price: 2500000000000 },
  { name: "Crown of Mythical Legends",       type: "accessory", stats: { Int: 300000000000, Luck: 220000000000 },                    special: "Legendary Wisdom",     price: 1800000000000 },
  { name: "Blade of Infinite Myths",         type: "weapon",    stats: { Str: 360000000000, Spd: 180000000000 },                     special: "Double Strike",        price: 2300000000000 },
  { name: "Mythical Legend's Starweave",     type: "armor",     stats: { Spd: 300000000000, Int: 240000000000 },                     special: "Star Barrier",         price: 2100000000000 },
  { name: "Ring of Legendary Eternity",      type: "accessory", stats: { Luck: 320000000000, Str: 180000000000 },                    special: "Eternal Legend",       price: 2150000000000 },
  { name: "The Final Blade",                 type: "weapon",    stats: { Str: 500000000000, Spd: 250000000000, Luck: 250000000000 }, special: "Life Steal 25%",       price: 5000000000000 },
  { name: "Armor of the One True Legend",    type: "armor",     stats: { Str: 400000000000, Spd: 400000000000, Int: 350000000000, Luck: 350000000000 }, special: "Invincibility", price: 5000000000000 },
  { name: "Mythos Obliterator",              type: "weapon",    stats: { Str: 420000000000, Spd: 200000000000, Luck: 230000000000 }, special: "Stun 15%",             price: 2600000000000 },
  { name: "Legend's Final Bow",              type: "weapon",    stats: { Spd: 390000000000, Luck: 240000000000 },                    special: "Critical +20%",        price: 2400000000000 },
  { name: "Mythical Fortress Plate",         type: "armor",     stats: { Str: 340000000000, Int: 270000000000, Luck: 230000000000 },                                   price: 2300000000000 },
  { name: "Mythical Oracle Amulet",          type: "accessory", stats: { Int: 340000000000, Luck: 240000000000 },                    special: "Genesis Collapse",     price: 2000000000000 },
  { name: "Mythical Titan's Last Stand",     type: "armor",     stats: { Str: 370000000000, Spd: 370000000000, Int: 270000000000 },                                   price: 2700000000000 },
];

// ─── Forest Zone Weapons (multi-tier) ─────────────────────────────────────────
const forestWeaponItems: Omit<Item, "id" | "tier">[] = [
  { name: "Novice Meadow Stick",           type: "weapon", stats: { Str: 180, Luck: 60 },                  special: "Nature's Touch",     price: 200 },
  { name: "Apprentice Faerie Wand",        type: "weapon", stats: { Int: 750, Luck: 250 },                  special: "Pixie Dust",         price: 550 },
  { name: "Initiate Spirit Blade",         type: "weapon", stats: { Str: 4000, Spd: 1500 },                 special: "Spirit Strike",      price: 900 },
  { name: "Journeyman Grove Bow",          type: "weapon", stats: { Spd: 120000, Luck: 38000 },             special: "Nature's Arrow",     price: 1800 },
  { name: "Adept Elder Branch",            type: "weapon", stats: { Int: 360000, Str: 110000 },             special: "Elder Wisdom",       price: 3500 },
  { name: "Expert Forest Fang",            type: "weapon", stats: { Str: 1200000, Spd: 380000 },            special: "Creature's Bite",    price: 8000 },
  { name: "Master Heartwood Staff",        type: "weapon", stats: { Int: 4800000, Luck: 1500000 },          special: "Heart of the Forest",price: 20000 },
  { name: "Grandmaster Void Leaf",         type: "weapon", stats: { Str: 18000000, Int: 5500000 },          special: "Void Thorns",        price: 55000 },
  { name: "Champion World Tree Spear",     type: "weapon", stats: { Str: 80000000, Spd: 25000000 },         special: "World Tree's Fury",  price: 130000 },
  { name: "Overlord Genesis Blade",        type: "weapon", stats: { Str: 320000000, Luck: 100000000 },      special: "Genesis Slash",      price: 300000 },
  { name: "Sovereign Primordial Bow",      type: "weapon", stats: { Spd: 1400000000, Luck: 440000000 },     special: "Primordial Shot",    price: 900000 },
  { name: "Ascendant Essence Scythe",      type: "weapon", stats: { Str: 5800000000, Int: 1800000000 },     special: "Life's Harvest",     price: 2500000 },
  { name: "Legend's Heartwood Ragnarok",   type: "weapon", stats: { Str: 24000000000, Int: 7500000000 },    special: "Forest Ragnarok",    price: 12000000 },
  { name: "Mythic Forest Obliterator",     type: "weapon", stats: { Str: 95000000000, Spd: 30000000000, Luck: 28000000000 }, special: "Mythic Overgrowth", price: 60000000 },
  { name: "Mythical Legend's World-Root",  type: "weapon", stats: { Str: 380000000000, Int: 260000000000, Luck: 200000000000 }, special: "Root of Creation", price: 2100000000000 },
];

function generateItems(items: Omit<Item, "id" | "tier">[], tier: ItemTier): Item[] {
  return items.map((item, index) => ({
    ...item,
    id: `${tier}-${index}`,
    tier,
  }));
}

const FOREST_WEAPON_RANKS: ItemTier[] = [
  "normal", "super_rare", "umr", "journeyman", "adept",
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
  copper_ore: { id: "copper_ore", name: "Copper Ore", rarity: "common", sellPrice: 8, type: "resource", zone: "Mountain Caverns" },
  iron_ore: { id: "iron_ore", name: "Iron Ore", rarity: "common", sellPrice: 15, type: "resource", zone: "Mountain Caverns" },
  silver_ore: { id: "silver_ore", name: "Silver Ore", rarity: "uncommon", sellPrice: 40, type: "resource", zone: "Mountain Caverns" },
  gold_ore: { id: "gold_ore", name: "Gold Ore", rarity: "rare", sellPrice: 90, type: "resource", zone: "Mountain Caverns" },
  ruby_chunk: { id: "ruby_chunk", name: "Ruby Chunk", rarity: "rare", sellPrice: 120, type: "resource", zone: "Mountain Caverns" },
  mythril_ore: { id: "mythril_ore", name: "Mythril Ore", rarity: "epic", sellPrice: 500, type: "resource", zone: "Mountain Caverns" },
  adamantite_ore: { id: "adamantite_ore", name: "Adamantite Ore", rarity: "epic", sellPrice: 800, type: "resource", zone: "Mountain Caverns" },
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
