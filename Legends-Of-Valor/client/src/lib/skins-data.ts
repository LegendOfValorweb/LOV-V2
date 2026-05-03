export interface SkinDefinition {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "mythic";
  race: string;
  cssFilter: string;
  glowColor: string;
  category: string;
  rubyPrice: number;
}

// ─── CSS filter presets for skin variants ──────────────────────────────────────
const C: string[] = [
  // 15 common filters
  "none",
  "hue-rotate(30deg) saturate(1.1)",
  "hue-rotate(60deg) saturate(1.1)",
  "hue-rotate(90deg) saturate(1.2)",
  "hue-rotate(120deg) saturate(1.2)",
  "hue-rotate(150deg) saturate(1.1)",
  "hue-rotate(180deg) saturate(1.1)",
  "hue-rotate(210deg) saturate(1.2)",
  "hue-rotate(240deg) saturate(1.2)",
  "hue-rotate(270deg) saturate(1.1)",
  "hue-rotate(300deg) saturate(1.2)",
  "hue-rotate(330deg) saturate(1.1)",
  "brightness(0.8) saturate(0.9)",
  "brightness(1.15) saturate(0.8)",
  "sepia(0.3) saturate(1.2)",
];

const R: string[] = [
  // 20 rare filters
  "hue-rotate(20deg) saturate(1.6) brightness(1.1)",
  "hue-rotate(50deg) saturate(1.8) brightness(1.05)",
  "hue-rotate(80deg) saturate(1.7) brightness(1.1)",
  "hue-rotate(110deg) saturate(1.6) brightness(1.1)",
  "hue-rotate(140deg) saturate(1.7) brightness(1.05)",
  "hue-rotate(170deg) saturate(1.8) brightness(1.1)",
  "hue-rotate(200deg) saturate(1.6) brightness(1.1)",
  "hue-rotate(230deg) saturate(1.7) brightness(1.05)",
  "hue-rotate(260deg) saturate(1.8) brightness(1.1)",
  "hue-rotate(290deg) saturate(1.6) brightness(1.1)",
  "hue-rotate(315deg) saturate(1.7) brightness(1.05)",
  "hue-rotate(345deg) saturate(1.8) brightness(1.1)",
  "sepia(0.5) saturate(2.0) brightness(1.1)",
  "contrast(1.3) saturate(1.5) brightness(1.1)",
  "contrast(1.2) hue-rotate(45deg) saturate(1.6)",
  "contrast(1.2) hue-rotate(135deg) saturate(1.6)",
  "contrast(1.2) hue-rotate(225deg) saturate(1.6)",
  "contrast(1.2) hue-rotate(315deg) saturate(1.6)",
  "brightness(1.3) saturate(2.0) hue-rotate(15deg)",
  "brightness(1.3) saturate(2.0) hue-rotate(195deg)",
];

const E: string[] = [
  // 22 epic filters
  "hue-rotate(30deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(60deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(120deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(180deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(240deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(300deg) saturate(2.5) brightness(1.2) contrast(1.2)",
  "hue-rotate(45deg) saturate(3.0) brightness(1.3) contrast(1.3)",
  "hue-rotate(135deg) saturate(3.0) brightness(1.3) contrast(1.3)",
  "hue-rotate(225deg) saturate(3.0) brightness(1.3) contrast(1.3)",
  "hue-rotate(315deg) saturate(3.0) brightness(1.3) contrast(1.3)",
  "brightness(1.6) saturate(2.5) contrast(1.4)",
  "brightness(0.5) saturate(3.0) contrast(1.6) hue-rotate(180deg)",
  "brightness(0.6) saturate(2.0) contrast(1.8)",
  "sepia(0.8) saturate(3.0) brightness(1.2) contrast(1.3)",
  "invert(0.15) saturate(2.5) brightness(1.2) hue-rotate(30deg)",
  "invert(0.15) saturate(2.5) brightness(1.2) hue-rotate(180deg)",
  "invert(0.2) saturate(3.0) brightness(1.1) hue-rotate(90deg)",
  "invert(0.2) saturate(3.0) brightness(1.1) hue-rotate(270deg)",
  "contrast(2.0) saturate(2.0) brightness(1.3)",
  "contrast(1.8) hue-rotate(60deg) saturate(2.5) brightness(1.2)",
  "contrast(1.8) hue-rotate(200deg) saturate(2.5) brightness(1.2)",
  "hue-rotate(90deg) saturate(3.5) brightness(1.4) contrast(1.5)",
];

const M: string[] = [
  // 15 mythic filters
  "brightness(2.0) saturate(3.5) contrast(1.8) hue-rotate(30deg)",
  "brightness(2.0) saturate(3.5) contrast(1.8) hue-rotate(90deg)",
  "brightness(2.0) saturate(3.5) contrast(1.8) hue-rotate(180deg)",
  "brightness(2.0) saturate(3.5) contrast(1.8) hue-rotate(270deg)",
  "invert(0.4) saturate(4.0) brightness(1.5) contrast(2.0) hue-rotate(30deg)",
  "invert(0.4) saturate(4.0) brightness(1.5) contrast(2.0) hue-rotate(150deg)",
  "invert(0.4) saturate(4.0) brightness(1.5) contrast(2.0) hue-rotate(270deg)",
  "invert(0.6) saturate(5.0) brightness(1.8) contrast(2.5)",
  "invert(0.6) saturate(5.0) brightness(1.8) contrast(2.5) hue-rotate(90deg)",
  "invert(0.6) saturate(5.0) brightness(1.8) contrast(2.5) hue-rotate(180deg)",
  "sepia(1.0) saturate(5.0) brightness(2.0) contrast(2.0) hue-rotate(280deg)",
  "sepia(1.0) saturate(5.0) brightness(2.0) contrast(2.0) hue-rotate(60deg)",
  "brightness(3.0) saturate(5.0) contrast(2.5) hue-rotate(45deg)",
  "brightness(3.0) saturate(5.0) contrast(2.5) hue-rotate(225deg)",
  "brightness(2.5) invert(0.5) saturate(5.0) contrast(3.0) hue-rotate(120deg)",
];

const GLOW_COMMON = ["#888", "#aaa", "#4a8", "#48a", "#a84", "#88a", "#a88", "#8a8", "#8aa", "#a8a", "#aaa", "#666", "#555", "#bbb", "#966"];
const GLOW_RARE = ["#4af", "#af4", "#fa4", "#f4a", "#4fa", "#a4f", "#48f", "#f84", "#4f8", "#8f4", "#84f", "#f48", "#ff6", "#6ff", "#f6f", "#6f6", "#ff8", "#8ff", "#f88", "#88f"];
const GLOW_EPIC = ["#f0f", "#0ff", "#ff0", "#f80", "#80f", "#08f", "#f08", "#0f8", "#8f0", "#8f8", "#f8f", "#8ff", "#ff8", "#808", "#080", "#f44", "#44f", "#4f4", "#f4f", "#4ff", "#ff4", "#444"];
const GLOW_MYTHIC = ["#fff", "#ffd700", "#ff4500", "#00ffff", "#ff00ff", "#7fff00", "#ff1493", "#00ff7f", "#4169e1", "#ff6347", "#dda0dd", "#f0e68c", "#e0e0ff", "#ffe4e1", "#f5f5dc"];

// ─── Race skin name banks ──────────────────────────────────────────────────────
const RACE_SKIN_NAMES: Record<string, { prefix: string; common: string[]; rare: string[]; epic: string[]; mythic: string[] }> = {
  human: {
    prefix: "Human",
    common: ["Iron Guard", "Steel Squire", "Bronze Knight", "Silver Sentinel", "Common Folk", "Town Guard", "Field Soldier", "Village Hero", "Copper Shield", "Militia Man", "Peasant Warrior", "Farm Defender", "River Ranger", "Coastal Watch", "Hill Climber"],
    rare: ["Silver Knight", "Gold Paladin", "Crimson Crusader", "Sapphire Knight", "Emerald Guardian", "Amber Templar", "Ivory Defender", "Obsidian Shield", "Pearl Sentinel", "Ruby Warden", "Topaz Vanguard", "Onyx Knight", "Azure Champion", "Jade Guard", "Violet Paladin", "Scarlet Sentinel", "Cerulean Knight", "Tawny Shield", "Slate Defender", "Flint Warden"],
    epic: ["Champion of Valor", "Knight of Eternity", "Radiant Crusader", "Void Knight", "Celestial Paladin", "Abyssal Sentinel", "Phantom Knight", "Spectral Guard", "Infernal Crusader", "Aurora Champion", "Eclipse Knight", "Nebula Defender", "Prism Sentinel", "Cosmos Guard", "Void Paladin", "Storm Champion", "Blaze Crusader", "Frost Knight", "Thunder Guard", "Nature Sentinel", "Shadow Champion", "Light Defender"],
    mythic: ["Mythical Valor", "Legend of Humans", "Omega Knight", "Alpha Crusader", "Final Paladin", "Ultimate Sentinel", "Apex Defender", "Supreme Guard", "Transcendent Knight", "Eternal Champion", "Infinite Crusader", "Absolute Valor", "Genesis Knight", "Void Overlord", "Mythic Legend"],
  },
  elf: {
    prefix: "Elf",
    common: ["Forest Walker", "Moon Dancer", "Star Grazer", "Dawn Archer", "Dusk Warden", "Leaf Runner", "Wind Rider", "River Song", "Tree Keeper", "Silver Bow", "Twilight Scout", "Morning Sight", "Brook Singer", "Grove Watcher", "Meadow Archer"],
    rare: ["Moonlight Archer", "Starfire Warden", "Forest Empress", "Dawn Sentinel", "Dusk Oracle", "Aurora Ranger", "Celestial Bowman", "Mystic Scout", "Ancient Grove", "Elder Star", "Night Bloom", "Sun Dancer", "Horizon Archer", "Sky Warden", "Twilight Sentinel", "Starfall Scout", "Moonbeam Dancer", "Prism Ranger", "Crystal Archer", "Void Warden"],
    epic: ["Arcane Starfire", "Phantom Moon", "Eclipse Dancer", "Nebula Archer", "Void Grove", "Spectral Sentinel", "Abyssal Moon", "Cosmic Ranger", "Infinity Forest", "Aurora Eclipse", "Prism Storm", "Star Collapse", "Luna Eclipse", "Astral Dancer", "Void Sentinel", "Phantom Star", "Galaxy Archer", "Cosmos Warden", "Storm Star", "Blaze Moon", "Frost Forest", "Thunder Dancer"],
    mythic: ["Mythic Moonfire", "Legend of Elves", "Omega Starfire", "Alpha Forest", "Final Eclipse", "Ultimate Archer", "Apex Dancer", "Supreme Star", "Transcendent Moon", "Eternal Starfire", "Infinite Forest", "Absolute Eclipse", "Genesis Star", "Void Cosmos", "Mythic Arcana"],
  },
  dwarf: {
    prefix: "Dwarf",
    common: ["Stone Miner", "Iron Forger", "Copper Smith", "Rock Carver", "Bronze Caster", "Hammer Hand", "Anvil Master", "Cave Walker", "Deep Digger", "Mountain Dweller", "Tunnel Worker", "Ore Seeker", "Boulder Breaker", "Granite Grinder", "Crystal Cutter"],
    rare: ["Rune Forger", "Master Smith", "Diamond Cutter", "Mythril Miner", "Gold Crafter", "Steel Hammer", "Dragon Forger", "Thunder Anvil", "Flame Smith", "Frost Forger", "Shadow Hammer", "Storm Smith", "Star Caster", "Moon Forger", "Sun Smith", "Void Hammer", "Dark Forger", "Light Smith", "Blood Caster", "Soul Hammer"],
    epic: ["Titan Forger", "Legendary Smith", "Omega Hammer", "Void Anvil", "Cosmic Forger", "Nebula Smith", "Phantom Hammer", "Spectral Forger", "Abyssal Smith", "Aurora Hammer", "Prism Forger", "Galaxy Smith", "Infinity Hammer", "Star Collapse Forger", "Eclipse Smith", "Astral Hammer", "Chaos Forger", "Order Smith", "Storm Hammer", "Blaze Forger", "Frost Smith", "Thunder Hammer"],
    mythic: ["Mythic Master Smith", "Legend of Dwarves", "Omega Forger", "Alpha Hammer", "Final Smith", "Ultimate Forger", "Apex Anvil", "Supreme Smith", "Transcendent Forger", "Eternal Smith", "Infinite Forger", "Absolute Smith", "Genesis Hammer", "Void Forger", "Mythic Legend"],
  },
  orc: {
    prefix: "Orc",
    common: ["Battle Grunt", "War Crusher", "Blood Basher", "Skull Smasher", "Bone Cruncher", "Rage Fighter", "Primal Warrior", "Feral Brawler", "Wild Berserker", "Savage Bruiser", "Mob Warrior", "Clan Brawler", "Horde Smite", "Warchief's Guard", "Tribal Defender"],
    rare: ["Blood Warlord", "Crimson Berserker", "Thunder Basher", "Storm Crusher", "Flame Smasher", "Frost Warrior", "Shadow Brawler", "Dark Berserker", "Void Crusher", "Soul Basher", "Chaos Warrior", "Star Crusher", "Moon Smasher", "Sun Basher", "Night Crusher", "Day Warrior", "Dawn Smasher", "Dusk Basher", "Prism Crusher", "Crystal Berserker"],
    epic: ["Warchief Supreme", "Destroyer of Worlds", "Omega Basher", "Void Warlord", "Cosmic Berserker", "Nebula Crusher", "Phantom Warlord", "Spectral Berserker", "Abyssal Crusher", "Aurora Warlord", "Prism Berserker", "Galaxy Crusher", "Infinity Warlord", "Star Collapse Berserker", "Eclipse Crusher", "Astral Warlord", "Chaos Berserker", "Order Crusher", "Storm Warlord", "Blaze Berserker", "Frost Crusher", "Thunder Warlord"],
    mythic: ["Mythic Warlord", "Legend of Orcs", "Omega Destroyer", "Alpha Warchief", "Final Berserker", "Ultimate Crusher", "Apex Warlord", "Supreme Berserker", "Transcendent Crusher", "Eternal Warlord", "Infinite Berserker", "Absolute Crusher", "Genesis Warlord", "Void Destroyer", "Mythic Legend"],
  },
  beastfolk: {
    prefix: "Beastfolk",
    common: ["Pack Scout", "Feral Hunter", "Wild Stalker", "Swift Pouncer", "Keen Tracker", "Agile Runner", "Prey Seeker", "Claw Striker", "Fang Fighter", "Beast Caller", "Forest Stalker", "River Hunter", "Cliff Climber", "Plains Runner", "Sky Watcher"],
    rare: ["Alpha Hunter", "Pack Leader", "Swift Stalker", "Feral Elite", "Wild Champion", "Thunder Claw", "Storm Fang", "Flame Hunter", "Frost Stalker", "Shadow Scout", "Void Tracker", "Crystal Pouncer", "Prism Runner", "Star Hunter", "Moon Stalker", "Sun Scout", "Night Hunter", "Day Tracker", "Dawn Stalker", "Dusk Scout"],
    epic: ["Apex Predator", "Supreme Hunter", "Omega Stalker", "Void Predator", "Cosmic Hunter", "Nebula Stalker", "Phantom Predator", "Spectral Hunter", "Abyssal Stalker", "Aurora Predator", "Prism Hunter", "Galaxy Stalker", "Infinity Predator", "Star Hunter Elite", "Eclipse Stalker", "Astral Predator", "Chaos Hunter", "Order Stalker", "Storm Predator", "Blaze Hunter", "Frost Stalker", "Thunder Predator"],
    mythic: ["Mythic Apex", "Legend of Beastfolk", "Omega Predator", "Alpha Hunter", "Final Stalker", "Ultimate Predator", "Apex Supreme", "Supreme Stalker", "Transcendent Predator", "Eternal Hunter", "Infinite Stalker", "Absolute Predator", "Genesis Hunter", "Void Apex", "Mythic Legend"],
  },
  mystic: {
    prefix: "Mystic",
    common: ["Grove Tender", "Nature Whisperer", "Herb Healer", "Root Speaker", "Bark Walker", "Leaf Chanter", "Moss Keeper", "Dew Weaver", "Rain Caller", "Wind Listener", "Earth Speaker", "Stone Singer", "Fire Dancer", "Water Weaver", "Spirit Tender"],
    rare: ["Nature Oracle", "Grove Sage", "Spirit Weaver", "Elemental Tender", "Ancient Mystic", "Elder Caller", "Star Healer", "Moon Weaver", "Sun Singer", "Storm Oracle", "Thunder Sage", "Flame Tender", "Frost Weaver", "Shadow Oracle", "Void Sage", "Crystal Healer", "Prism Weaver", "Nebula Tender", "Aurora Oracle", "Galaxy Sage"],
    epic: ["Grand Oracle", "Nature Supreme", "Omega Weaver", "Void Oracle", "Cosmic Sage", "Nebula Tender Elite", "Phantom Oracle", "Spectral Sage", "Abyssal Weaver", "Aurora Oracle Elite", "Prism Sage", "Galaxy Weaver", "Infinity Oracle", "Star Oracle Elite", "Eclipse Sage", "Astral Weaver", "Chaos Oracle", "Order Sage", "Storm Weaver", "Blaze Oracle", "Frost Sage", "Thunder Weaver"],
    mythic: ["Mythic Oracle", "Legend of Mystics", "Omega Sage", "Alpha Weaver", "Final Oracle", "Ultimate Sage", "Apex Weaver", "Supreme Oracle", "Transcendent Sage", "Eternal Weaver", "Infinite Oracle", "Absolute Sage", "Genesis Weaver", "Void Oracle Elite", "Mythic Legend"],
  },
  fae: {
    prefix: "Fae",
    common: ["Pixie Dancer", "Glimmer Sprite", "Luck Bringer", "Whimsy Weaver", "Mist Flitter", "Dream Walker", "Illusion Caster", "Trick Player", "Charm Weaver", "Fancy Dancer", "Bubble Maker", "Rainbow Rider", "Cloud Hopper", "Star Flicker", "Moon Glimmer"],
    rare: ["Fortune Fae", "Lucky Charmer", "Illusion Master", "Dream Weaver", "Mist Dancer", "Star Fairy", "Moon Charmer", "Sun Dancer", "Storm Fairy", "Thunder Charmer", "Flame Dancer", "Frost Fairy", "Shadow Charmer", "Void Dancer", "Crystal Fairy", "Prism Charmer", "Nebula Dancer", "Aurora Fairy", "Galaxy Charmer", "Chaos Dancer"],
    epic: ["Grand Illusionist", "Fortune Supreme", "Omega Charmer", "Void Fairy", "Cosmic Dancer", "Nebula Charmer", "Phantom Fairy", "Spectral Dancer", "Abyssal Charmer", "Aurora Dancer Elite", "Prism Fairy", "Galaxy Charmer Elite", "Infinity Fairy", "Star Charmer Elite", "Eclipse Dancer", "Astral Charmer", "Chaos Fairy", "Order Dancer", "Storm Charmer", "Blaze Fairy", "Frost Dancer", "Thunder Charmer"],
    mythic: ["Mythic Fortune", "Legend of Fae", "Omega Fairy", "Alpha Dancer", "Final Charmer", "Ultimate Fairy", "Apex Dancer", "Supreme Charmer", "Transcendent Fairy", "Eternal Dancer", "Infinite Charmer", "Absolute Fairy", "Genesis Dancer", "Void Fortune", "Mythic Legend"],
  },
  elemental: {
    prefix: "Elemental",
    common: ["Ember Spark", "Frost Shard", "Gale Gust", "Stone Chip", "Wave Ripple", "Thunder Crackle", "Earth Tremor", "Wind Whisper", "Ice Sliver", "Fire Flicker", "Storm Breeze", "Water Drop", "Rock Pebble", "Leaf Rustle", "Light Flare"],
    rare: ["Inferno Elemental", "Blizzard Elemental", "Tornado Elemental", "Earthquake Elemental", "Tsunami Elemental", "Lightning Elemental", "Magma Elemental", "Glacier Elemental", "Cyclone Elemental", "Quake Elemental", "Tempest Elemental", "Tidal Elemental", "Volcanic Elemental", "Arctic Elemental", "Thunder Elemental", "Flash Elemental", "Storm Elemental", "Frost Elemental", "Flame Elemental", "Gale Elemental"],
    epic: ["Ancient Elemental", "Primal Inferno", "Void Blizzard", "Cosmic Tornado", "Nebula Quake", "Phantom Tsunami", "Spectral Lightning", "Abyssal Magma", "Aurora Glacier", "Prism Cyclone", "Galaxy Quake", "Infinity Tempest", "Star Tide", "Eclipse Volcanic", "Astral Arctic", "Chaos Thunder", "Order Flash", "Storm Supreme", "Blaze Supreme", "Frost Supreme", "Thunder Supreme", "Omega Elemental"],
    mythic: ["Mythic Elemental", "Legend of Elements", "Omega Inferno", "Alpha Blizzard", "Final Tornado", "Ultimate Quake", "Apex Tsunami", "Supreme Lightning", "Transcendent Magma", "Eternal Glacier", "Infinite Cyclone", "Absolute Quake", "Genesis Tempest", "Void Elemental", "Mythic Legend"],
  },
  undead: {
    prefix: "Undead",
    common: ["Grave Walker", "Bone Shuffler", "Death Stalker", "Hollow Knight", "Shadow Haunt", "Pale Shambler", "Wraith Crawler", "Curse Bringer", "Soul Whisper", "Crypt Keeper", "Tomb Wanderer", "Skeleton Guard", "Zombie Fighter", "Ghost Lurker", "Specter Scout"],
    rare: ["Death Knight", "Lich Knight", "Bone Warden", "Soul Reaper", "Crypt Guardian", "Grave Warden", "Shadow Reaper", "Void Knight Undead", "Dark Reaper", "Chaos Knight Undead", "Star Reaper", "Moon Knight", "Sun Reaper", "Thunder Knight", "Storm Reaper", "Flame Knight", "Frost Reaper", "Crystal Knight", "Prism Reaper", "Nebula Knight"],
    epic: ["Undead Overlord", "Death Supreme", "Omega Reaper", "Void Death Knight", "Cosmic Lich", "Nebula Reaper", "Phantom Overlord", "Spectral Reaper", "Abyssal Death Knight", "Aurora Lich", "Prism Reaper Elite", "Galaxy Death Knight", "Infinity Lich", "Star Reaper Elite", "Eclipse Death Knight", "Astral Lich", "Chaos Reaper", "Order Death Knight", "Storm Lich", "Blaze Reaper", "Frost Death Knight", "Thunder Lich"],
    mythic: ["Mythic Lich", "Legend of Undead", "Omega Death Knight", "Alpha Lich", "Final Reaper", "Ultimate Death Knight", "Apex Lich", "Supreme Reaper", "Transcendent Death Knight", "Eternal Lich", "Infinite Reaper", "Absolute Death Knight", "Genesis Lich", "Void Death", "Mythic Legend"],
  },
  demon: {
    prefix: "Demon",
    common: ["Impling Scout", "Hellfire Grunt", "Brimstone Crawler", "Sulfur Stalker", "Chaos Imp", "Dark Minion", "Infernal Scout", "Shadow Imp", "Void Crawler", "Flame Scout", "Pit Lurker", "Ash Walker", "Ember Crawler", "Smoke Scout", "Cinder Lurker"],
    rare: ["Infernal Knight", "Chaos Warlord", "Hellfire Demon", "Shadow Demon", "Void Demon", "Dark Demon", "Blood Demon", "Soul Demon", "Flame Demon", "Frost Demon", "Thunder Demon", "Storm Demon", "Star Demon", "Moon Demon", "Sun Demon", "Crystal Demon", "Prism Demon", "Nebula Demon", "Aurora Demon", "Galaxy Demon"],
    epic: ["Archon of Chaos", "Demon Supreme", "Omega Infernal", "Void Archon", "Cosmic Demon", "Nebula Infernal", "Phantom Archon", "Spectral Demon", "Abyssal Archon", "Aurora Infernal", "Prism Archon", "Galaxy Demon Elite", "Infinity Archon", "Star Demon Elite", "Eclipse Infernal", "Astral Archon", "Chaos Supreme", "Order Infernal", "Storm Archon", "Blaze Infernal", "Frost Archon", "Thunder Infernal"],
    mythic: ["Mythic Archon", "Legend of Demons", "Omega Infernal", "Alpha Archon", "Final Demon", "Ultimate Archon", "Apex Infernal", "Supreme Archon", "Transcendent Demon", "Eternal Archon", "Infinite Demon", "Absolute Archon", "Genesis Infernal", "Void Archon Elite", "Mythic Legend"],
  },
  draconic: {
    prefix: "Draconic",
    common: ["Wyrmling Scout", "Drake Pup", "Scale Scout", "Claw Crawler", "Fang Tracker", "Tail Swipe", "Breath Seeker", "Wing Hopper", "Hoard Guard", "Nest Watcher", "Young Drake", "Baby Wyrm", "Flame Pup", "Frost Pup", "Storm Hatchling"],
    rare: ["Fire Drake", "Frost Drake", "Thunder Drake", "Storm Drake", "Shadow Drake", "Void Drake", "Crystal Drake", "Prism Drake", "Nebula Drake", "Aurora Drake", "Star Drake", "Moon Drake", "Sun Drake", "Chaos Drake", "Order Drake", "Water Drake", "Earth Drake", "Wind Drake", "Iron Drake", "Gold Drake"],
    epic: ["Ancient Dragon", "Elder Wyrm", "Omega Drake", "Void Dragon", "Cosmic Wyrm", "Nebula Dragon", "Phantom Wyrm", "Spectral Dragon", "Abyssal Wyrm", "Aurora Dragon", "Prism Wyrm", "Galaxy Dragon", "Infinity Wyrm", "Star Dragon Elite", "Eclipse Wyrm", "Astral Dragon", "Chaos Wyrm", "Order Dragon", "Storm Wyrm", "Blaze Dragon", "Frost Wyrm", "Thunder Dragon"],
    mythic: ["Mythic Dragon", "Legend of Draconics", "Omega Wyrm", "Alpha Dragon", "Final Drake", "Ultimate Dragon", "Apex Wyrm", "Supreme Dragon", "Transcendent Wyrm", "Eternal Dragon", "Infinite Wyrm", "Absolute Dragon", "Genesis Wyrm", "Void Dragon Elite", "Mythic Legend"],
  },
  celestial: {
    prefix: "Celestial",
    common: ["Light Bearer", "Holy Guard", "Divine Scout", "Heaven's Watch", "Star Singer", "Cloud Walker", "Sun Gazer", "Moon Tender", "Halo Wearer", "Wing Feather", "Blessed Soul", "Sacred Heart", "Pure Light", "Heaven Guard", "Angel Scout"],
    rare: ["Seraph Guard", "Archangel Scout", "Holy Sentinel", "Divine Warden", "Celestial Knight", "Heaven's Champion", "Star Angel", "Moon Angel", "Sun Angel", "Storm Angel", "Thunder Angel", "Flame Angel", "Frost Angel", "Shadow Angel", "Void Angel", "Crystal Angel", "Prism Angel", "Nebula Angel", "Aurora Angel", "Galaxy Angel"],
    epic: ["Celestial Supreme", "Archangel Elite", "Omega Holy", "Void Celestial", "Cosmic Seraph", "Nebula Archangel", "Phantom Seraph", "Spectral Archangel", "Abyssal Seraph", "Aurora Archangel", "Prism Seraph", "Galaxy Archangel", "Infinity Seraph", "Star Archangel Elite", "Eclipse Seraph", "Astral Archangel", "Chaos Seraph", "Order Archangel", "Storm Seraph", "Blaze Archangel", "Frost Seraph", "Thunder Archangel"],
    mythic: ["Mythic Seraph", "Legend of Celestials", "Omega Archangel", "Alpha Seraph", "Final Archangel", "Ultimate Seraph", "Apex Archangel", "Supreme Seraph", "Transcendent Archangel", "Eternal Seraph", "Infinite Archangel", "Absolute Seraph", "Genesis Archangel", "Void Seraph Elite", "Mythic Legend"],
  },
  aquatic: {
    prefix: "Aquatic",
    common: ["Tide Walker", "Wave Rider", "Coral Scout", "Deep Diver", "Pearl Seeker", "Kelp Dancer", "Shell Finder", "Sea Foam", "Salt Spray", "Rock Pool", "Shallow Scout", "Reef Runner", "Current Rider", "Undertow Walker", "Surf Dancer"],
    rare: ["Kraken Scout", "Sea Dragon", "Tide Warden", "Ocean Sage", "Deep Sea Knight", "Wave Master", "Storm Swimmer", "Thunder Tide", "Flame Coral", "Frost Wave", "Shadow Current", "Void Tide", "Crystal Coral", "Prism Wave", "Nebula Tide", "Aurora Current", "Galaxy Wave", "Star Tide", "Moon Swimmer", "Sun Diver"],
    epic: ["Ocean Supreme", "Leviathan Elite", "Omega Tide", "Void Leviathan", "Cosmic Kraken", "Nebula Leviathan", "Phantom Kraken", "Spectral Leviathan", "Abyssal Kraken", "Aurora Leviathan", "Prism Kraken", "Galaxy Leviathan", "Infinity Kraken", "Star Leviathan Elite", "Eclipse Kraken", "Astral Leviathan", "Chaos Kraken", "Order Leviathan", "Storm Kraken", "Blaze Leviathan", "Frost Kraken", "Thunder Leviathan"],
    mythic: ["Mythic Leviathan", "Legend of Aquatics", "Omega Kraken", "Alpha Leviathan", "Final Kraken", "Ultimate Leviathan", "Apex Kraken", "Supreme Leviathan", "Transcendent Kraken", "Eternal Leviathan", "Infinite Kraken", "Absolute Leviathan", "Genesis Kraken", "Void Leviathan Elite", "Mythic Legend"],
  },
  titan: {
    prefix: "Titan",
    common: ["Stone Golem", "Iron Giant", "Rock Colossus", "Boulder Titan", "Mountain Mover", "Earth Shaker", "Ground Pounder", "Cliff Walker", "Cave Giant", "Valley Crusher", "Hill Stomper", "Plateau Guard", "Ridge Warden", "Summit Watcher", "Peak Defender"],
    rare: ["Iron Colossus", "Steel Giant", "Adamant Titan", "Mythril Colossus", "Gold Giant", "Diamond Titan", "Thunder Colossus", "Storm Giant", "Flame Titan", "Frost Colossus", "Shadow Giant", "Void Titan", "Crystal Colossus", "Prism Giant", "Nebula Titan", "Aurora Colossus", "Galaxy Giant", "Star Titan", "Moon Colossus", "Sun Giant"],
    epic: ["Titan Supreme", "Ancient Colossus", "Omega Titan", "Void Colossus", "Cosmic Titan", "Nebula Colossus", "Phantom Titan", "Spectral Colossus", "Abyssal Titan", "Aurora Colossus Elite", "Prism Titan", "Galaxy Colossus", "Infinity Titan", "Star Colossus Elite", "Eclipse Titan", "Astral Colossus", "Chaos Titan", "Order Colossus", "Storm Titan", "Blaze Colossus", "Frost Titan", "Thunder Colossus"],
    mythic: ["Mythic Titan", "Legend of Titans", "Omega Colossus", "Alpha Titan", "Final Colossus", "Ultimate Titan", "Apex Colossus", "Supreme Titan", "Transcendent Colossus", "Eternal Titan", "Infinite Colossus", "Absolute Titan", "Genesis Colossus", "Void Titan Elite", "Mythic Legend"],
  },
};

const RARITY_RUBY_PRICE: Record<string, number> = {
  common: 100,
  rare: 500,
  epic: 2000,
  mythic: 10000,
};

function buildRaceSkins(race: string): SkinDefinition[] {
  const bank = RACE_SKIN_NAMES[race];
  if (!bank) return [];
  const skins: SkinDefinition[] = [];

  bank.common.forEach((name, i) => {
    skins.push({ id: `${race}_c_${i}`, name: `${bank.prefix} ${name}`, rarity: "common", race, cssFilter: C[i] || C[0], glowColor: GLOW_COMMON[i] || "#888", category: "standard", rubyPrice: 100 });
  });
  bank.rare.forEach((name, i) => {
    skins.push({ id: `${race}_r_${i}`, name: `${bank.prefix} ${name}`, rarity: "rare", race, cssFilter: R[i] || R[0], glowColor: GLOW_RARE[i] || "#4af", category: "elemental", rubyPrice: 500 });
  });
  bank.epic.forEach((name, i) => {
    skins.push({ id: `${race}_e_${i}`, name: `${bank.prefix} ${name}`, rarity: "epic", race, cssFilter: E[i] || E[0], glowColor: GLOW_EPIC[i] || "#f0f", category: "legendary", rubyPrice: 2000 });
  });
  bank.mythic.forEach((name, i) => {
    skins.push({ id: `${race}_m_${i}`, name: `${bank.prefix} ${name}`, rarity: "mythic", race, cssFilter: M[i] || M[0], glowColor: GLOW_MYTHIC[i] || "#fff", category: "mythic", rubyPrice: 10000 });
  });

  return skins;
}

const UNIVERSAL_SKINS: SkinDefinition[] = [
  { id: "uni_0",  name: "Original",           rarity: "common",  race: "all", cssFilter: "none",                                            glowColor: "#888", category: "universal", rubyPrice: 0 },
  { id: "uni_1",  name: "Golden Aura",         rarity: "rare",    race: "all", cssFilter: "hue-rotate(40deg) saturate(2.0) brightness(1.3)", glowColor: "#ffd700", category: "universal", rubyPrice: 500 },
  { id: "uni_2",  name: "Shadow Veil",         rarity: "rare",    race: "all", cssFilter: "brightness(0.4) saturate(0.5) contrast(1.5)",     glowColor: "#333", category: "universal", rubyPrice: 500 },
  { id: "uni_3",  name: "Crimson Tide",        rarity: "rare",    race: "all", cssFilter: "hue-rotate(330deg) saturate(2.0) brightness(1.1)",glowColor: "#f00", category: "universal", rubyPrice: 500 },
  { id: "uni_4",  name: "Ocean Depths",        rarity: "rare",    race: "all", cssFilter: "hue-rotate(210deg) saturate(2.0) brightness(1.0)",glowColor: "#06f", category: "universal", rubyPrice: 500 },
  { id: "uni_5",  name: "Emerald Dream",       rarity: "rare",    race: "all", cssFilter: "hue-rotate(120deg) saturate(2.2) brightness(1.0)",glowColor: "#0f0", category: "universal", rubyPrice: 500 },
  { id: "uni_6",  name: "Void Form",           rarity: "epic",    race: "all", cssFilter: "invert(0.6) saturate(3.0) brightness(0.7)",       glowColor: "#808", category: "universal", rubyPrice: 2000 },
  { id: "uni_7",  name: "Celestial Light",     rarity: "epic",    race: "all", cssFilter: "brightness(1.8) saturate(1.5) contrast(1.3)",     glowColor: "#fef", category: "universal", rubyPrice: 2000 },
  { id: "uni_8",  name: "Inferno",             rarity: "epic",    race: "all", cssFilter: "hue-rotate(350deg) saturate(3.5) brightness(1.4) contrast(1.4)", glowColor: "#f60", category: "universal", rubyPrice: 2000 },
  { id: "uni_9",  name: "Glacier",             rarity: "epic",    race: "all", cssFilter: "hue-rotate(195deg) saturate(3.0) brightness(1.5) contrast(1.3)", glowColor: "#9ef", category: "universal", rubyPrice: 2000 },
  { id: "uni_10", name: "Thunder God",         rarity: "epic",    race: "all", cssFilter: "hue-rotate(60deg) saturate(3.5) brightness(1.5) contrast(1.5)",  glowColor: "#ff0", category: "universal", rubyPrice: 2000 },
  { id: "uni_11", name: "Phantom",             rarity: "epic",    race: "all", cssFilter: "opacity(0.85) brightness(1.2) saturate(0.2) contrast(2.0)",      glowColor: "#8af", category: "universal", rubyPrice: 2000 },
  { id: "uni_12", name: "Nature's Wrath",      rarity: "epic",    race: "all", cssFilter: "hue-rotate(105deg) saturate(3.5) brightness(1.3) contrast(1.4)", glowColor: "#0a0", category: "universal", rubyPrice: 2000 },
  { id: "uni_13", name: "Dark Abyss",          rarity: "epic",    race: "all", cssFilter: "brightness(0.3) saturate(2.0) contrast(2.5) hue-rotate(240deg)", glowColor: "#006", category: "universal", rubyPrice: 2000 },
  { id: "uni_14", name: "Prism Burst",         rarity: "mythic",  race: "all", cssFilter: "hue-rotate(90deg) saturate(5.0) brightness(2.0) contrast(2.5)",  glowColor: "#fff", category: "universal", rubyPrice: 10000 },
  { id: "uni_15", name: "Void Walker",         rarity: "mythic",  race: "all", cssFilter: "invert(0.8) saturate(5.0) brightness(1.5) contrast(3.0)",        glowColor: "#f0f", category: "universal", rubyPrice: 10000 },
  { id: "uni_16", name: "Star Forge",          rarity: "mythic",  race: "all", cssFilter: "brightness(3.0) saturate(5.0) contrast(3.0) hue-rotate(45deg)",  glowColor: "#ffd700", category: "universal", rubyPrice: 10000 },
  { id: "uni_17", name: "Genesis Form",        rarity: "mythic",  race: "all", cssFilter: "brightness(2.5) saturate(5.0) contrast(2.5) hue-rotate(200deg)", glowColor: "#0ff", category: "universal", rubyPrice: 10000 },
  { id: "uni_18", name: "Eternal Eclipse",     rarity: "mythic",  race: "all", cssFilter: "invert(0.5) brightness(2.0) saturate(5.0) contrast(3.5) hue-rotate(270deg)", glowColor: "#f8f", category: "universal", rubyPrice: 10000 },
  { id: "uni_19", name: "Omega Ascension",     rarity: "mythic",  race: "all", cssFilter: "brightness(4.0) saturate(5.0) contrast(4.0) hue-rotate(15deg)",  glowColor: "#fff", category: "universal", rubyPrice: 10000 },
];

// Build all race skins
const ALL_RACE_SKINS: SkinDefinition[] = [
  "human", "elf", "dwarf", "orc", "beastfolk", "mystic",
  "fae", "elemental", "undead", "demon", "draconic",
  "celestial", "aquatic", "titan",
].flatMap(buildRaceSkins);

export const ALL_SKINS: SkinDefinition[] = [...ALL_RACE_SKINS, ...UNIVERSAL_SKINS];

export function getSkinsForRace(race: string): SkinDefinition[] {
  return ALL_SKINS.filter(s => s.race === race || s.race === "all");
}

export function getSkinById(id: string): SkinDefinition | undefined {
  return ALL_SKINS.find(s => s.id === id);
}

export function applySkinStyle(skinId: string | null | undefined): { filter?: string; transition?: string } {
  if (!skinId) return {};
  const skin = getSkinById(skinId);
  if (!skin || skin.cssFilter === "none") return {};
  return {
    filter: skin.cssFilter,
    transition: "filter 0.3s ease",
  };
}

export const RARITY_LABEL_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#60a5fa",
  epic: "#c084fc",
  mythic: "#f87171",
};
