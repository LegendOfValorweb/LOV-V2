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
  {"name": "Godslayer Blade", "type": "weapon", "stats": {"Str": 150, "Luck": 100}, "special": "Poison 5t", "price": 100000},
  {"name": "Celestial Bow", "type": "weapon", "stats": {"Spd": 150, "Luck": 100}, "special": "Critical +15%", "price": 100000},
  {"name": "Divine Staff", "type": "weapon", "stats": {"Int": 150}, "special": "Burn 4t", "price": 100000},
  {"name": "Omnipotent Armor", "type": "armor", "stats": {"Str": 100, "Spd": 100, "Int": 100, "Luck": 100}, "price": 120000},
  {"name": "Crown of the Gods", "type": "accessory", "stats": {"Int": 120, "Luck": 80}, "price": 95000},
  {"name": "Eternal Flame Saber", "type": "weapon", "stats": {"Str": 160}, "special": "Freeze 3t", "price": 110000},
  {"name": "Frostfall Reaper", "type": "weapon", "stats": {"Spd": 155}, "special": "Poison 5t", "price": 110000},
  {"name": "Amulet of Infinity", "type": "accessory", "stats": {"Luck": 150, "Str": 80}, "price": 115000},
  {"name": "World Ender", "type": "weapon", "stats": {"Str": 200}, "special": "Burn 4t", "price": 150000},
  {"name": "Ethereal Mantle", "type": "armor", "stats": {"Int": 140, "Spd": 60}, "special": "Phase Shift", "price": 125000},
];

const tier6Items: Omit<Item, "id" | "tier">[] = [
  {"name": "Primordial Void Blade", "type": "weapon", "stats": {"Str": 300, "Luck": 200}, "special": "Life Steal 20%", "price": 500000},
  {"name": "Astral Annihilator Bow", "type": "weapon", "stats": {"Spd": 300, "Luck": 200}, "special": "Double Strike", "price": 500000},
  {"name": "Staff of Infinite Cosmos", "type": "weapon", "stats": {"Int": 350}, "special": "Stun 15%", "price": 550000},
  {"name": "Armor of the First Light", "type": "armor", "stats": {"Str": 200, "Spd": 200, "Int": 200, "Luck": 200}, "special": "Divine Shield", "price": 650000},
  {"name": "Crown of Eternal Dominion", "type": "accessory", "stats": {"Int": 250, "Luck": 180}, "special": "Mind Control", "price": 480000},
  {"name": "Blade of Shattered Realities", "type": "weapon", "stats": {"Str": 350, "Spd": 150}, "special": "Critical +20%", "price": 580000},
  {"name": "Frostfire Extinction", "type": "weapon", "stats": {"Spd": 320, "Int": 100}, "special": "Life Steal 20%", "price": 560000},
  {"name": "Ring of Omnipotence", "type": "accessory", "stats": {"Luck": 300, "Str": 150}, "special": "Fate Manipulation", "price": 600000},
  {"name": "The Oblivion Hammer", "type": "weapon", "stats": {"Str": 400}, "special": "Stun 15%", "price": 750000},
  {"name": "Vestments of Creation", "type": "armor", "stats": {"Int": 280, "Spd": 120}, "special": "Genesis Barrier", "price": 620000},
  {"name": "Pendant of Primordial Power", "type": "accessory", "stats": {"Str": 200, "Int": 200, "Luck": 100}, "special": "Power Surge", "price": 550000},
  {"name": "Gauntlets of the Divine", "type": "armor", "stats": {"Str": 250, "Spd": 180}, "special": "Crushing Divinity", "price": 580000},
  {"name": "Shadowvoid Hammer", "type": "weapon", "stats": {"Str": 370, "Spd": 130}, "special": "Double Strike", "price": 620000},
  {"name": "Primal Aegis Plate", "type": "armor", "stats": {"Str": 220, "Int": 180, "Luck": 120}, "special": "Barrier Wall", "price": 640000},
  {"name": "Eternity Sigil Ring", "type": "accessory", "stats": {"Int": 270, "Luck": 190}, "special": "Critical +20%", "price": 510000},
];

const initiateItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Initiate's Training Blade", "type": "weapon", "stats": {"Str": 380, "Luck": 220}, "special": "Stun 5%", "price": 800000},
  {"name": "Learner's Longbow", "type": "weapon", "stats": {"Spd": 380, "Luck": 220}, "special": "Critical +5%", "price": 800000},
  {"name": "Staff of Beginning Wisdom", "type": "weapon", "stats": {"Int": 420}, "special": "Burn 2t", "price": 850000},
  {"name": "Initiate's Ward Armor", "type": "armor", "stats": {"Str": 280, "Spd": 280, "Int": 150, "Luck": 150}, "special": "Training Shield", "price": 900000},
  {"name": "Pendant of New Beginnings", "type": "accessory", "stats": {"Int": 320, "Luck": 200}, "special": "Fresh Start", "price": 750000},
  {"name": "Blade of First Blood", "type": "weapon", "stats": {"Str": 420, "Spd": 150}, "special": "Stun 5%", "price": 880000},
  {"name": "Initiate's Cloak", "type": "armor", "stats": {"Spd": 350, "Luck": 220}, "special": "Quick Step", "price": 820000},
  {"name": "Ring of Potential", "type": "accessory", "stats": {"Luck": 350, "Str": 150}, "special": "Growth Surge", "price": 850000},
  {"name": "Neophyte's Waraxe", "type": "weapon", "stats": {"Str": 440, "Spd": 160}, "special": "Critical +5%", "price": 870000},
  {"name": "Ember Fang Dagger", "type": "weapon", "stats": {"Spd": 400, "Luck": 200}, "special": "Burn 2t", "price": 840000},
  {"name": "Initiate's Iron Plate", "type": "armor", "stats": {"Str": 300, "Spd": 180, "Int": 100}, "price": 860000},
  {"name": "First Step Helm", "type": "armor", "stats": {"Str": 260, "Int": 180, "Luck": 100}, "price": 810000},
  {"name": "Beginner's Sash", "type": "accessory", "stats": {"Str": 280, "Luck": 200}, "price": 780000},
  {"name": "Focus Amulet", "type": "accessory", "stats": {"Int": 350, "Spd": 150}, "special": "Mana Regen", "price": 820000},
  {"name": "Initiate's Gauntlets", "type": "armor", "stats": {"Str": 290, "Spd": 210}, "price": 830000},
];

const journeymanItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Journeyman's Warblade", "type": "weapon", "stats": {"Str": 500, "Luck": 300}, "special": "Life Steal 5%", "price": 1500000},
  {"name": "Wanderer's Longbow", "type": "weapon", "stats": {"Spd": 500, "Luck": 300}, "special": "Freeze 1t", "price": 1500000},
  {"name": "Staff of Learned Wisdom", "type": "weapon", "stats": {"Int": 550}, "special": "Stun 8%", "price": 1600000},
  {"name": "Traveler's Plate", "type": "armor", "stats": {"Str": 350, "Spd": 350, "Int": 200, "Luck": 200}, "special": "Road Ward", "price": 1800000},
  {"name": "Medallion of Experience", "type": "accessory", "stats": {"Int": 400, "Luck": 280}, "special": "Wisdom Aura", "price": 1400000},
  {"name": "Blade of Many Battles", "type": "weapon", "stats": {"Str": 550, "Spd": 200}, "special": "Life Steal 5%", "price": 1700000},
  {"name": "Cloak of the Traveler", "type": "armor", "stats": {"Spd": 450, "Luck": 300}, "special": "Swift Passage", "price": 1550000},
  {"name": "Ring of Earned Glory", "type": "accessory", "stats": {"Luck": 450, "Str": 200}, "special": "Glory Surge", "price": 1650000},
  {"name": "Wayfarers Axe", "type": "weapon", "stats": {"Str": 520, "Spd": 180}, "special": "Freeze 1t", "price": 1560000},
  {"name": "Crossroads Bow", "type": "weapon", "stats": {"Spd": 480, "Luck": 280}, "special": "Stun 8%", "price": 1520000},
  {"name": "Traveler's Robe", "type": "armor", "stats": {"Int": 380, "Luck": 260}, "price": 1480000},
  {"name": "Road-Worn Shield Plate", "type": "armor", "stats": {"Str": 370, "Int": 200, "Spd": 160}, "price": 1530000},
  {"name": "Signet of the Road", "type": "accessory", "stats": {"Luck": 420, "Int": 260}, "price": 1420000},
  {"name": "Journey's End Amulet", "type": "accessory", "stats": {"Int": 430, "Str": 210}, "special": "Power Surge", "price": 1460000},
  {"name": "Wanderer's Gauntlets", "type": "armor", "stats": {"Str": 360, "Spd": 300}, "price": 1510000},
];

const adeptItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Adept's Waraxe", "type": "weapon", "stats": {"Str": 650, "Luck": 400}, "special": "Critical +8%", "price": 3000000},
  {"name": "Marksman's Pride Bow", "type": "weapon", "stats": {"Spd": 650, "Luck": 400}, "special": "Burn 3t", "price": 3000000},
  {"name": "Staff of Adept Sorcery", "type": "weapon", "stats": {"Int": 720}, "special": "Poison 3t", "price": 3200000},
  {"name": "Adept's Battle Armor", "type": "armor", "stats": {"Str": 450, "Spd": 450, "Int": 320, "Luck": 320}, "special": "Combat Focus", "price": 3500000},
  {"name": "Medallion of Proficiency", "type": "accessory", "stats": {"Int": 520, "Luck": 360}, "special": "Skill Mastery", "price": 2800000},
  {"name": "Blade of Swift Execution", "type": "weapon", "stats": {"Str": 700, "Spd": 320}, "special": "Critical +8%", "price": 3400000},
  {"name": "Adept's Shadow Cloak", "type": "armor", "stats": {"Spd": 580, "Int": 400}, "special": "Fade Away", "price": 3100000},
  {"name": "Ring of Practiced Art", "type": "accessory", "stats": {"Luck": 580, "Str": 280}, "special": "Refined Technique", "price": 3200000},
  {"name": "Adept's Vorpal Dagger", "type": "weapon", "stats": {"Spd": 680, "Luck": 380}, "special": "Poison 3t", "price": 3050000},
  {"name": "Sorcerer's Adept Staff", "type": "weapon", "stats": {"Int": 740, "Luck": 200}, "special": "Burn 3t", "price": 3250000},
  {"name": "Adept's Iron Fortress", "type": "armor", "stats": {"Str": 480, "Int": 300, "Luck": 280}, "price": 3150000},
  {"name": "Adept's Reinforced Helm", "type": "armor", "stats": {"Str": 420, "Spd": 360, "Luck": 200}, "price": 2950000},
  {"name": "Signet of Adept Power", "type": "accessory", "stats": {"Str": 480, "Luck": 360}, "price": 2850000},
  {"name": "Adept's Wisdom Stone", "type": "accessory", "stats": {"Int": 560, "Luck": 340}, "special": "Knowledge Burst", "price": 2900000},
  {"name": "Adept's Plate Gauntlets", "type": "armor", "stats": {"Str": 460, "Spd": 400}, "price": 3000000},
];

const expertItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Expert's Decimator", "type": "weapon", "stats": {"Str": 800, "Luck": 500}, "special": "Life Steal 8%", "price": 5000000},
  {"name": "Precision Destroyer Bow", "type": "weapon", "stats": {"Spd": 800, "Luck": 500}, "special": "Critical +10%", "price": 5000000},
  {"name": "Arcane Mastery Staff", "type": "weapon", "stats": {"Int": 900}, "special": "Freeze 2t", "price": 5500000},
  {"name": "Expert Battlewear", "type": "armor", "stats": {"Str": 550, "Spd": 550, "Int": 400, "Luck": 400}, "special": "Combat Mastery", "price": 6000000},
  {"name": "Amulet of Expertise", "type": "accessory", "stats": {"Int": 650, "Luck": 450}, "special": "Expert Knowledge", "price": 4800000},
  {"name": "Blade of a Thousand Cuts", "type": "weapon", "stats": {"Str": 850, "Spd": 400}, "special": "Life Steal 8%", "price": 5800000},
  {"name": "Expert's Aegis", "type": "armor", "stats": {"Spd": 700, "Int": 500}, "special": "Perfect Defense", "price": 5200000},
  {"name": "Ring of True Skill", "type": "accessory", "stats": {"Luck": 700, "Str": 350}, "special": "Skill Enhancement", "price": 5500000},
  {"name": "Expert's Voidblade", "type": "weapon", "stats": {"Str": 870, "Spd": 380}, "special": "Critical +10%", "price": 5600000},
  {"name": "Sniper's Perfection Bow", "type": "weapon", "stats": {"Spd": 820, "Luck": 480}, "special": "Freeze 2t", "price": 5100000},
  {"name": "Expert's Reinforced Plate", "type": "armor", "stats": {"Str": 600, "Int": 380, "Luck": 320}, "price": 5300000},
  {"name": "Expert's Nightweave Cloak", "type": "armor", "stats": {"Spd": 650, "Luck": 480}, "price": 4900000},
  {"name": "Vanguard's Emblem", "type": "accessory", "stats": {"Str": 620, "Luck": 440}, "price": 4700000},
  {"name": "Expert's Oracle Stone", "type": "accessory", "stats": {"Int": 700, "Spd": 350}, "special": "Spell Mastery", "price": 4850000},
  {"name": "Expert's War Gauntlets", "type": "armor", "stats": {"Str": 570, "Spd": 520}, "price": 5050000},
];

const masterItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Master's Worldbreaker", "type": "weapon", "stats": {"Str": 1200, "Luck": 800}, "special": "Double Strike", "price": 15000000},
  {"name": "Bow of the Grandmaster", "type": "weapon", "stats": {"Spd": 1200, "Luck": 800}, "special": "Stun 10%", "price": 15000000},
  {"name": "Staff of Supreme Sorcery", "type": "weapon", "stats": {"Int": 1400}, "special": "Life Steal 12%", "price": 16000000},
  {"name": "Master's Transcendent Armor", "type": "armor", "stats": {"Str": 900, "Spd": 900, "Int": 700, "Luck": 700}, "special": "Absolute Defense", "price": 18000000},
  {"name": "Crown of Mastery", "type": "accessory", "stats": {"Int": 1000, "Luck": 700}, "special": "Mind Dominion", "price": 14000000},
  {"name": "Blade of Utter Devastation", "type": "weapon", "stats": {"Str": 1350, "Spd": 600}, "special": "Double Strike", "price": 17000000},
  {"name": "Master's Shroud", "type": "armor", "stats": {"Spd": 1100, "Int": 800}, "special": "Shadow Master", "price": 15500000},
  {"name": "Ring of Absolute Power", "type": "accessory", "stats": {"Luck": 1100, "Str": 550}, "special": "Power Unlimited", "price": 16000000},
  {"name": "Master's Runic Hammer", "type": "weapon", "stats": {"Str": 1280, "Spd": 520}, "special": "Stun 10%", "price": 15800000},
  {"name": "Master's Phantom Bow", "type": "weapon", "stats": {"Spd": 1250, "Luck": 780}, "special": "Life Steal 12%", "price": 15200000},
  {"name": "Master's Obsidian Plate", "type": "armor", "stats": {"Str": 950, "Int": 680, "Luck": 600}, "price": 16500000},
  {"name": "Master's Voidweave Robe", "type": "armor", "stats": {"Int": 1050, "Spd": 720}, "price": 14800000},
  {"name": "Signet of the Master", "type": "accessory", "stats": {"Str": 950, "Luck": 680}, "price": 13500000},
  {"name": "Master's Ascension Amulet", "type": "accessory", "stats": {"Int": 1050, "Luck": 720}, "special": "Arcane Mastery", "price": 13800000},
  {"name": "Master's Titan Gauntlets", "type": "armor", "stats": {"Str": 920, "Spd": 840}, "price": 15000000},
];

const grandmasterItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Grandmaster's Galaxy Edge", "type": "weapon", "stats": {"Str": 1800, "Luck": 1200}, "special": "Burn 4t", "price": 50000000},
  {"name": "Bow of Stellar Destruction", "type": "weapon", "stats": {"Spd": 1800, "Luck": 1200}, "special": "Critical +15%", "price": 50000000},
  {"name": "Staff of Universal Law", "type": "weapon", "stats": {"Int": 2200}, "special": "Freeze 3t", "price": 55000000},
  {"name": "Grandmaster's Cosmic Plate", "type": "armor", "stats": {"Str": 1400, "Spd": 1400, "Int": 1100, "Luck": 1100}, "special": "Cosmic Shield", "price": 60000000},
  {"name": "Pendant of the Cosmos", "type": "accessory", "stats": {"Int": 1600, "Luck": 1100}, "special": "Universal Wisdom", "price": 48000000},
  {"name": "Blade of Infinite Stars", "type": "weapon", "stats": {"Str": 2000, "Spd": 1000}, "special": "Burn 4t", "price": 58000000},
  {"name": "Grandmaster's Void Cloak", "type": "armor", "stats": {"Spd": 1700, "Int": 1300}, "special": "Void Walk", "price": 52000000},
  {"name": "Ring of Cosmic Authority", "type": "accessory", "stats": {"Luck": 1700, "Str": 900}, "special": "Cosmic Command", "price": 54000000},
  {"name": "Grandmaster's Solar Axe", "type": "weapon", "stats": {"Str": 1950, "Spd": 900}, "special": "Critical +15%", "price": 56000000},
  {"name": "Nebula Piercer Bow", "type": "weapon", "stats": {"Spd": 1870, "Luck": 1160}, "special": "Freeze 3t", "price": 51000000},
  {"name": "Grandmaster's Star Aegis", "type": "armor", "stats": {"Str": 1450, "Int": 1050, "Luck": 950}, "price": 53000000},
  {"name": "Grandmaster's Quasar Robe", "type": "armor", "stats": {"Int": 1800, "Spd": 1200}, "price": 49000000},
  {"name": "Stellar Signet", "type": "accessory", "stats": {"Str": 1500, "Luck": 1050}, "price": 46000000},
  {"name": "Grandmaster's Cosmos Seal", "type": "accessory", "stats": {"Int": 1680, "Luck": 1140}, "special": "Reality Warp", "price": 47000000},
  {"name": "Grandmaster's Nova Gauntlets", "type": "armor", "stats": {"Str": 1420, "Spd": 1280}, "price": 50000000},
];

const championItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Champion's Glory Blade", "type": "weapon", "stats": {"Str": 2200, "Luck": 1400}, "special": "Poison 5t", "price": 80000000},
  {"name": "Bow of Arena Champions", "type": "weapon", "stats": {"Spd": 2200, "Luck": 1400}, "special": "Life Steal 15%", "price": 80000000},
  {"name": "Staff of Tournament Victory", "type": "weapon", "stats": {"Int": 2600}, "special": "Double Strike", "price": 88000000},
  {"name": "Champion's Tournament Plate", "type": "armor", "stats": {"Str": 1700, "Spd": 1700, "Int": 1300, "Luck": 1300}, "special": "Undefeated Aura", "price": 95000000},
  {"name": "Medal of Champions", "type": "accessory", "stats": {"Int": 1900, "Luck": 1300}, "special": "Champion's Will", "price": 75000000},
  {"name": "Blade of Endless Victories", "type": "weapon", "stats": {"Str": 2400, "Spd": 1200}, "special": "Poison 5t", "price": 90000000},
  {"name": "Champion's Battle Cloak", "type": "armor", "stats": {"Spd": 2000, "Int": 1500}, "special": "Arena Dodge", "price": 82000000},
  {"name": "Ring of True Champions", "type": "accessory", "stats": {"Luck": 2000, "Str": 1100}, "special": "Victory Surge", "price": 85000000},
  {"name": "Champion's Thunder Hammer", "type": "weapon", "stats": {"Str": 2350, "Spd": 1100}, "special": "Life Steal 15%", "price": 86000000},
  {"name": "Champion's Void Piercer", "type": "weapon", "stats": {"Spd": 2260, "Luck": 1360}, "special": "Double Strike", "price": 81000000},
  {"name": "Champion's Fortress Plate", "type": "armor", "stats": {"Str": 1800, "Int": 1200, "Luck": 1100}, "price": 87000000},
  {"name": "Champion's Phantom Robe", "type": "armor", "stats": {"Int": 2100, "Spd": 1600}, "price": 78000000},
  {"name": "Champion's Crest Ring", "type": "accessory", "stats": {"Str": 1850, "Luck": 1250}, "price": 73000000},
  {"name": "Champion's Oracle Pendant", "type": "accessory", "stats": {"Int": 2000, "Spd": 1000}, "special": "Arena Storm", "price": 76000000},
  {"name": "Champion's Iron Gauntlets", "type": "armor", "stats": {"Str": 1750, "Spd": 1600}, "price": 80000000},
];

const overlordItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Overlord's Dominion Blade", "type": "weapon", "stats": {"Str": 3500, "Luck": 2200}, "special": "Critical +18%", "price": 250000000},
  {"name": "Bow of Absolute Rule", "type": "weapon", "stats": {"Spd": 3500, "Luck": 2200}, "special": "Stun 12%", "price": 250000000},
  {"name": "Staff of Supreme Authority", "type": "weapon", "stats": {"Int": 4200}, "special": "Life Steal 18%", "price": 275000000},
  {"name": "Overlord's Iron Throne Armor", "type": "armor", "stats": {"Str": 2800, "Spd": 2800, "Int": 2100, "Luck": 2100}, "special": "Ruler's Barrier", "price": 300000000},
  {"name": "Crown of the Overlord", "type": "accessory", "stats": {"Int": 3200, "Luck": 2100}, "special": "Absolute Command", "price": 240000000},
  {"name": "Blade of Conquered Realms", "type": "weapon", "stats": {"Str": 3800, "Spd": 1900}, "special": "Critical +18%", "price": 280000000},
  {"name": "Overlord's Shadow Mantle", "type": "armor", "stats": {"Spd": 3200, "Int": 2500}, "special": "Dark Dominion", "price": 260000000},
  {"name": "Ring of Total Control", "type": "accessory", "stats": {"Luck": 3200, "Str": 1800}, "special": "Mind Dominion", "price": 270000000},
  {"name": "Overlord's Titan Crusher", "type": "weapon", "stats": {"Str": 3700, "Spd": 1800}, "special": "Stun 12%", "price": 265000000},
  {"name": "Overlord's Void Bow", "type": "weapon", "stats": {"Spd": 3600, "Luck": 2100}, "special": "Life Steal 18%", "price": 255000000},
  {"name": "Overlord's Fortress Plate", "type": "armor", "stats": {"Str": 2900, "Int": 2000, "Luck": 1900}, "price": 270000000},
  {"name": "Overlord's Void Shroud", "type": "armor", "stats": {"Int": 3400, "Spd": 2600}, "price": 245000000},
  {"name": "Overlord's Dominion Signet", "type": "accessory", "stats": {"Str": 3000, "Luck": 1900}, "price": 230000000},
  {"name": "Overlord's Tyrant Amulet", "type": "accessory", "stats": {"Int": 3300, "Luck": 2000}, "special": "Domination Wave", "price": 235000000},
  {"name": "Overlord's Crushing Gauntlets", "type": "armor", "stats": {"Str": 2850, "Spd": 2700}, "price": 255000000},
];

const sovereignItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Sovereign's Royal Blade", "type": "weapon", "stats": {"Str": 4200, "Luck": 2700}, "special": "Burn 5t", "price": 400000000},
  {"name": "Bow of Divine Mandate", "type": "weapon", "stats": {"Spd": 4200, "Luck": 2700}, "special": "Double Strike", "price": 400000000},
  {"name": "Staff of Imperial Law", "type": "weapon", "stats": {"Int": 5000}, "special": "Critical +20%", "price": 440000000},
  {"name": "Sovereign's Celestial Plate", "type": "armor", "stats": {"Str": 3400, "Spd": 3400, "Int": 2600, "Luck": 2600}, "special": "Divine Right", "price": 480000000},
  {"name": "Crown of Eternal Sovereignty", "type": "accessory", "stats": {"Int": 3800, "Luck": 2600}, "special": "Royal Authority", "price": 380000000},
  {"name": "Blade of the First King", "type": "weapon", "stats": {"Str": 4600, "Spd": 2300}, "special": "Burn 5t", "price": 450000000},
  {"name": "Sovereign's Ermine Cloak", "type": "armor", "stats": {"Spd": 3900, "Int": 3000}, "special": "Noble Shield", "price": 420000000},
  {"name": "Ring of Royal Blood", "type": "accessory", "stats": {"Luck": 3900, "Str": 2200}, "special": "Bloodline Power", "price": 430000000},
  {"name": "Sovereign's Scepter of Ruin", "type": "weapon", "stats": {"Str": 4400, "Spd": 2100}, "special": "Double Strike", "price": 425000000},
  {"name": "Sovereign's Sky Piercer", "type": "weapon", "stats": {"Spd": 4300, "Luck": 2600}, "special": "Critical +20%", "price": 408000000},
  {"name": "Sovereign's Absolute Plate", "type": "armor", "stats": {"Str": 3500, "Int": 2500, "Luck": 2400}, "price": 440000000},
  {"name": "Sovereign's Regal Robe", "type": "armor", "stats": {"Int": 4000, "Spd": 3100}, "price": 400000000},
  {"name": "Sovereign's Imperial Ring", "type": "accessory", "stats": {"Str": 3600, "Luck": 2400}, "price": 360000000},
  {"name": "Sovereign's Bloodline Amulet", "type": "accessory", "stats": {"Int": 4000, "Luck": 2700}, "special": "Royal Judgment", "price": 370000000},
  {"name": "Sovereign's War Gauntlets", "type": "armor", "stats": {"Str": 3450, "Spd": 3200}, "price": 415000000},
];

const ascendantItems: Omit<Item, "id" | "tier">[] = [
  {"name": "Ascendant's Transcendent Blade", "type": "weapon", "stats": {"Str": 4800, "Luck": 3100}, "special": "Life Steal 20%", "price": 600000000},
  {"name": "Bow of Heavenly Ascension", "type": "weapon", "stats": {"Spd": 4800, "Luck": 3100}, "special": "Freeze 3t", "price": 600000000},
  {"name": "Staff of Higher Planes", "type": "weapon", "stats": {"Int": 5800}, "special": "Poison 5t", "price": 660000000},
  {"name": "Ascendant's Ethereal Armor", "type": "armor", "stats": {"Str": 3900, "Spd": 3900, "Int": 3000, "Luck": 3000}, "special": "Ethereal Shield", "price": 720000000},
  {"name": "Halo of the Ascended", "type": "accessory", "stats": {"Int": 4400, "Luck": 3000}, "special": "Enlightenment", "price": 580000000},
  {"name": "Blade of Broken Limits", "type": "weapon", "stats": {"Str": 5200, "Spd": 2700}, "special": "Life Steal 20%", "price": 680000000},
  {"name": "Ascendant's Wings Cloak", "type": "armor", "stats": {"Spd": 4500, "Int": 3400}, "special": "Heavenly Flight", "price": 640000000},
  {"name": "Ring of Transcendence", "type": "accessory", "stats": {"Luck": 4500, "Str": 2500}, "special": "Beyond Mortal", "price": 650000000},
  {"name": "Ascendant's Celestial Hammer", "type": "weapon", "stats": {"Str": 5000, "Spd": 2500}, "special": "Freeze 3t", "price": 645000000},
  {"name": "Ascendant's Rift Bow", "type": "weapon", "stats": {"Spd": 4900, "Luck": 3050}, "special": "Poison 5t", "price": 610000000},
  {"name": "Ascendant's Astral Plate", "type": "armor", "stats": {"Str": 4000, "Int": 2900, "Luck": 2800}, "price": 655000000},
  {"name": "Ascendant's Heaven Robe", "type": "armor", "stats": {"Int": 4700, "Spd": 3600}, "price": 620000000},
  {"name": "Ascendant's Radiance Ring", "type": "accessory", "stats": {"Str": 4200, "Luck": 2900}, "price": 560000000},
  {"name": "Ascendant's Ether Amulet", "type": "accessory", "stats": {"Int": 4600, "Luck": 3100}, "special": "Planar Rift", "price": 575000000},
  {"name": "Ascendant's Titan Gauntlets", "type": "armor", "stats": {"Str": 3950, "Spd": 3750}, "price": 635000000},
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
