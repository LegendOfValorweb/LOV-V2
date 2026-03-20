export interface ZoneNPCTemplate {
  id: string;
  zoneId: string;
  name: string;
  race: string;
  element: string;
  personality: string;
  lore: string;
  dialogue: {
    greeting: string;
    hints: string[];
    onDefeat: string;
    onPlayerDefeat: string;
  };
  baseStats: {
    Str: number;
    Def: number;
    Spd: number;
    Int: number;
    Luck: number;
  };
  hpMultiplier: number;
  growthRate: number;
  rewards: {
    gold: number;
    trainingPoints: number;
    soulShards: number;
    rubies: number;
  };
  rewardMultiplier: number;
  portrait: string;
  emoji: string;
}

export const ZONE_NPCS: ZoneNPCTemplate[] = [
  {
    id: "capital_sentinel",
    zoneId: "capital_city",
    name: "Varis the Sentinel",
    race: "human",
    element: "Light",
    personality: "Stoic and protective",
    lore: "Varis has guarded the gates of Capital City for over three decades. A veteran of the Valorian Wars, he carries the weight of countless battles in his weary eyes. He trains new arrivals not out of duty, but because he believes everyone deserves a fighting chance.",
    dialogue: {
      greeting: "Welcome to Capital City, traveler. I am Varis. These gates have stood for a century — and so have I. What brings you here?",
      hints: [
        "New to the realm? Visit the shop first to gear up. A warrior without weapons is just a target.",
        "Your rank determines what zones you can enter. Train hard and challenge others to rise faster.",
        "The Guild Hall is worth joining early — guilds provide buffs and resources that solo players miss entirely.",
        "Don't neglect your stats. A balanced build survives longer than a glass cannon.",
      ],
      onDefeat: "Impressive. You have strength beyond what I expected. Come back whenever you wish to test yourself again.",
      onPlayerDefeat: "You fought well. But the real world has no second chances — train harder.",
    },
    baseStats: { Str: 12, Def: 14, Spd: 8, Int: 10, Luck: 8 },
    hpMultiplier: 1.0,
    growthRate: 0.08,
    rewards: { gold: 500, trainingPoints: 20, soulShards: 2, rubies: 0 },
    rewardMultiplier: 1.0,
    portrait: "human_male",
    emoji: "🛡️",
  },
  {
    id: "cavern_warden",
    zoneId: "mountain_caverns",
    name: "Dura Stoneheart",
    race: "dwarf",
    element: "Earth",
    personality: "Gruff but fair",
    lore: "Dura Stoneheart has mined these caverns since she was old enough to hold a pickaxe. She discovered something ancient in the deep veins — something that changed her. She now guards the mountain's secrets, challenging any who would plunder its depths without respect.",
    dialogue: {
      greeting: "Aye, another surface-dweller come to raid my mountain. State your business before I send you back up in pieces.",
      hints: [
        "The deeper you mine, the rarer the ore — but the monsters grow fiercer too. Know your limits.",
        "Crystal Guardians deep in the cavern drop rare gems. Worth the risk if you're strong enough.",
        "Earth-element attacks are strong here. Bring gear that resists it if you plan to go deep.",
        "Mining gives Training Points passively. Leave it running while you do other things.",
      ],
      onDefeat: "Ha! Didn't expect that from a surface-dweller. Maybe the mountain accepts you after all.",
      onPlayerDefeat: "The earth doesn't yield to the weak. Come back when your bones are harder.",
    },
    baseStats: { Str: 16, Def: 20, Spd: 6, Int: 10, Luck: 8 },
    hpMultiplier: 1.4,
    growthRate: 0.10,
    rewards: { gold: 1200, trainingPoints: 35, soulShards: 5, rubies: 1 },
    rewardMultiplier: 1.2,
    portrait: "dwarf_female",
    emoji: "⛏️",
  },
  {
    id: "ruins_keeper",
    zoneId: "ancient_ruins",
    name: "Serath the Undying",
    race: "undead",
    element: "Dark",
    personality: "Ancient and cryptic",
    lore: "Serath was once the High Archivist of the Valorian Empire. When the empire fell, he bound his soul to the ruins rather than let its secrets die with him. Centuries of isolation have frayed his sanity, but his power remains absolute. He challenges trespassers not to protect the ruins, but because conflict is the only thing that makes him feel alive.",
    dialogue: {
      greeting: "You walk upon the graves of empires, mortal. I have watched a thousand like you come and go. Most did not leave. What makes you different?",
      hints: [
        "The ruins hold fragments of the Valorian Pact. Seek the lore scrolls — they unlock ancient knowledge.",
        "Cursed spirits here are immune to physical damage. Spells and elemental attacks are the only way.",
        "The Forbidden Vault contains artifact shards. These are crafting materials for high-tier items.",
        "Undead enemies regenerate health. Burst them down quickly before they recover.",
      ],
      onDefeat: "Remarkable. Perhaps the empire will rise again in you after all. But I shall be stronger next time...",
      onPlayerDefeat: "Time always favors the patient. As it favors me.",
    },
    baseStats: { Str: 14, Def: 12, Spd: 14, Int: 20, Luck: 12 },
    hpMultiplier: 1.2,
    growthRate: 0.12,
    rewards: { gold: 1800, trainingPoints: 50, soulShards: 8, rubies: 1 },
    rewardMultiplier: 1.3,
    portrait: "undead_male",
    emoji: "💀",
  },
  {
    id: "forest_warden",
    zoneId: "enchanted_forest",
    name: "Lyris Moonweave",
    race: "elf",
    element: "Nature",
    personality: "Wise and serene",
    lore: "Lyris has lived in the Enchanted Forest for over four hundred years, longer than most kingdoms have existed. She is the forest's memory and its protector. She once loved a mortal warrior who died defending her home, and she has trained countless champions in his honor.",
    dialogue: {
      greeting: "The forest whispers your name, traveler. It knows all who enter. I am Lyris — its voice. Are you here to learn, or merely to take?",
      hints: [
        "Faerie Dust has a very low drop rate here, but it's worth farming — crafters will pay a fortune for it.",
        "Nature-element pets thrive in this zone. Capture and train them here for maximum efficiency.",
        "The Ancient Ent boss only appears when moon phase conditions are right. Check zone lore for hints.",
        "Elven race abilities activate strongly in natural zones. Consider your race when choosing where to grind.",
      ],
      onDefeat: "The forest has accepted you. A rare honor. Return whenever you seek its wisdom.",
      onPlayerDefeat: "The forest has no mercy for the impatient. Growth takes time.",
    },
    baseStats: { Str: 10, Def: 10, Spd: 18, Int: 18, Luck: 15 },
    hpMultiplier: 1.1,
    growthRate: 0.10,
    rewards: { gold: 1400, trainingPoints: 40, soulShards: 6, rubies: 1 },
    rewardMultiplier: 1.2,
    portrait: "elf_female",
    emoji: "🌿",
  },
  {
    id: "lake_guardian",
    zoneId: "crystal_lake",
    name: "Coral the Tidecaller",
    race: "aquatic",
    element: "Water",
    personality: "Calm and mysterious",
    lore: "Coral emerged from the Crystal Lake three hundred years ago and has never left. She is the lake's guardian spirit made flesh. They say she grants visions to worthy anglers — glimpses of future treasures hiding beneath the water. She tolerates visitors who show the lake proper respect.",
    dialogue: {
      greeting: "The lake is still today. Your arrival ripples its surface. I am Coral. What do you seek in these waters?",
      hints: [
        "Fish here daily — the daily catch limit resets every day. Rare fish give pet stat bonuses.",
        "Crystal Lake has hidden fishing spots that only appear at certain times. Patience is rewarded.",
        "Water Crystals and Spirit Essence are crafting materials for elemental equipment.",
        "Pet bonding works best near water. Bring your aquatic pets here for double bond experience.",
      ],
      onDefeat: "The tide turns for everyone eventually. You've earned my respect, surface-walker.",
      onPlayerDefeat: "Even the mightiest river eventually meets the sea. Keep flowing.",
    },
    baseStats: { Str: 10, Def: 12, Spd: 16, Int: 16, Luck: 14 },
    hpMultiplier: 1.0,
    growthRate: 0.09,
    rewards: { gold: 1000, trainingPoints: 30, soulShards: 5, rubies: 1 },
    rewardMultiplier: 1.0,
    portrait: "aquatic_female",
    emoji: "🌊",
  },
  {
    id: "mines_warlord",
    zoneId: "ruby_mines",
    name: "Krag the Bloodstained",
    race: "orc",
    element: "Fire",
    personality: "Brutal and ambitious",
    lore: "Krag clawed his way to the top of the Ruby Mines by defeating every rival who challenged him. The rubies he's bathed in have seeped into his skin, giving his strikes a fiery edge. He respects only strength, and fights anyone who enters his domain just to see if they're worth his time.",
    dialogue: {
      greeting: "You want rubies? Then earn them. Everyone who enters here fights me first. I am Krag. Try not to die.",
      hints: [
        "Blood Rubies are the rarest drop here — they power the strongest crafted equipment.",
        "PvP is enabled in Ruby Mines. Watch your back when other players are nearby.",
        "The Ruby Wyrm boss drops rare crafting materials. It requires Expert rank minimum to challenge.",
        "Gem Golems have high defense but low speed. Use speed-based skills to land multiple hits.",
      ],
      onDefeat: "HA! You're worth more than the rubies you came for! Strong warrior. Come back and we'll fight again!",
      onPlayerDefeat: "Weak. Get out of my mines and come back when you're actually dangerous.",
    },
    baseStats: { Str: 22, Def: 16, Spd: 14, Int: 10, Luck: 10 },
    hpMultiplier: 1.6,
    growthRate: 0.14,
    rewards: { gold: 3000, trainingPoints: 70, soulShards: 12, rubies: 3 },
    rewardMultiplier: 1.8,
    portrait: "orc_male",
    emoji: "💎",
  },
  {
    id: "hell_warden",
    zoneId: "hell_zone",
    name: "Zareth the Fallen",
    race: "demon",
    element: "Dark",
    personality: "Ruthless and calculating",
    lore: "Zareth was once a Celestial Guardian who fell from grace during the War of Shards. His descent transformed him into something neither angel nor demon — something worse. He rules the Hell Zone not as a king, but as a sentence. Every fighter who enters must prove they deserve to leave.",
    dialogue: {
      greeting: "Another fool who thinks they can survive the Hell Zone. I have seen ten thousand like you. I remember none of their names. Will I remember yours?",
      hints: [
        "The Hell Zone has permadeath risk. Death here costs significant gold and resources. Prepare thoroughly.",
        "Mythic drops are only available here. The risk matches the reward.",
        "Battle Royale mode activates periodically in the Hell Zone. Registration is open — glory and gold await.",
        "Demon-element attacks deal bonus damage here. Bring elemental countermeasures.",
      ],
      onDefeat: "...Impressive. I confess, I did not expect that. Perhaps I underestimated you. Do not become comfortable. The Hell Zone does not forgive twice.",
      onPlayerDefeat: "There is no shame in dying here. Only shame in coming back unprepared.",
    },
    baseStats: { Str: 28, Def: 22, Spd: 20, Int: 24, Luck: 14 },
    hpMultiplier: 2.0,
    growthRate: 0.18,
    rewards: { gold: 8000, trainingPoints: 150, soulShards: 30, rubies: 5 },
    rewardMultiplier: 2.5,
    portrait: "demon_male",
    emoji: "🔥",
  },
  {
    id: "tower_sage",
    zoneId: "mystic_tower",
    name: "Aelindra the Ascendant",
    race: "celestial",
    element: "Aether",
    personality: "Enigmatic and ancient",
    lore: "Aelindra built the Mystic Tower in a time before recorded history. She created it as a test — not to kill challengers, but to forge them. Each floor represents a stage of mastery she herself passed through. She watches every battle from the peak, waiting for someone worthy to reach her.",
    dialogue: {
      greeting: "The Tower was built for seekers, not conquerors. I am Aelindra. Tell me — what are you truly seeking at its peak?",
      hints: [
        "The Mystic Tower is the primary NPC progression path. Each floor is harder but rewards more.",
        "Floor bosses drop unique loot that cannot be obtained elsewhere. Push as high as you can.",
        "Aether-element skills are especially effective against Tower Guardians. Research your build before climbing.",
        "Your NPC floor score appears on the leaderboard. Reach the top floors for legendary status.",
      ],
      onDefeat: "You have surprised me. Few reach this point. The Tower recognizes your worth — climb further, seeker.",
      onPlayerDefeat: "The Tower does not yield to those who are not ready. Grow stronger. The floors will wait for you.",
    },
    baseStats: { Str: 18, Def: 20, Spd: 16, Int: 26, Luck: 16 },
    hpMultiplier: 1.8,
    growthRate: 0.16,
    rewards: { gold: 5000, trainingPoints: 100, soulShards: 20, rubies: 4 },
    rewardMultiplier: 2.0,
    portrait: "celestial_female",
    emoji: "✨",
  },
];

export function getZoneNPC(zoneId: string): ZoneNPCTemplate | null {
  const normalized = zoneId.replace(/-/g, "_");
  return ZONE_NPCS.find(n => n.zoneId === normalized) || null;
}

export function getZoneNPCById(npcId: string): ZoneNPCTemplate | null {
  return ZONE_NPCS.find(n => n.id === npcId) || null;
}

export function calculateNPCStats(
  npc: ZoneNPCTemplate,
  playerRankIndex: number,
  defeatCount: number
): {
  Str: number; Def: number; Spd: number; Int: number; Luck: number; Pot: number;
  hp: number;
} {
  const rankScale = 1 + playerRankIndex * 0.4;
  const growthScale = 1 + defeatCount * npc.growthRate;
  const combined = rankScale * growthScale;

  const stats = {
    Str: Math.max(5, Math.floor(npc.baseStats.Str * combined)),
    Def: Math.max(5, Math.floor(npc.baseStats.Def * combined)),
    Spd: Math.max(5, Math.floor(npc.baseStats.Spd * combined)),
    Int: Math.max(5, Math.floor(npc.baseStats.Int * combined)),
    Luck: Math.max(5, Math.floor(npc.baseStats.Luck * combined)),
    Pot: 0,
  };

  const baseHp = (stats.Str + stats.Def) * 6;
  const hp = Math.max(20, Math.floor(baseHp * npc.hpMultiplier));

  return { ...stats, hp };
}

export function calculateNPCRewards(
  npc: ZoneNPCTemplate,
  playerRankIndex: number,
  defeatCount: number
): { gold: number; trainingPoints: number; soulShards: number; rubies: number } {
  const rankMult = 1 + playerRankIndex * 0.3;
  const growthMult = 1 + defeatCount * npc.growthRate * 0.5;
  const total = rankMult * growthMult * npc.rewardMultiplier;

  return {
    gold: Math.floor(npc.rewards.gold * total),
    trainingPoints: Math.floor(npc.rewards.trainingPoints * total),
    soulShards: Math.floor(npc.rewards.soulShards * total),
    rubies: npc.rewards.rubies,
  };
}
