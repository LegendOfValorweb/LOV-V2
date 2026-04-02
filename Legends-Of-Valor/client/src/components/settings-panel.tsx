import { useState } from "react";
import { useAudio, MUSIC_TRACKS } from "@/lib/audio-context";
import { useGame } from "@/lib/game-context";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Loader2, Music, BookOpen, ChevronDown, ChevronRight, X, User, Lock, Eye, EyeOff, CheckCircle,
} from "lucide-react";

interface GuideSectionData {
  icon: string;
  title: string;
  content: React.ReactNode;
}

const GUIDE_SECTIONS: GuideSectionData[] = [
  {
    icon: "🗺",
    title: "Getting Started",
    content: (
      <div className="space-y-2 text-sm">
        <p>Welcome to <strong className="text-amber-400">Legends of Valor</strong> — a fantasy MMORPG with 14 races, 15 ranks, deep economy, and epic battles.</p>
        <p className="font-semibold text-amber-300 mt-2">Creating Your Character</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>From the landing screen click <strong>Start as Player</strong></li>
          <li>Choose your <strong>Race</strong> — each has unique stat modifiers and a passive racial ability</li>
          <li>Choose your <strong>Gender</strong> — affects your portrait</li>
          <li>Pick a username and password</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">14 Playable Races</p>
        <p className="text-gray-300">Human, Elf, Dwarf, Orc, Demon, Elemental, Undead, Dragon, Angel, Void, Beast, Fairy, Titan, and Celestial — each grants different bonuses to Str, Def, Spd, Int, or Luck.</p>
        <p className="font-semibold text-amber-300 mt-2">Currency Overview</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><span className="text-yellow-400">⬤ Gold</span> — main currency, earned from combat and quests</li>
          <li><span className="text-red-400">◆ Rubies</span> — premium currency for the Valor Shop</li>
          <li><span className="text-purple-400">$V Valor Tokens</span> — special tokens for exclusive cosmetics</li>
          <li><span className="text-cyan-400">⚡ Energy</span> — consumed by gathering, fishing, and crafting</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🗺",
    title: "World Map & Navigation",
    content: (
      <div className="space-y-2 text-sm">
        <p>The <strong className="text-amber-400">World Map</strong> is your main hub for travelling between zones. Access it via the map icon in the left sidebar or from the HUD.</p>
        <p className="font-semibold text-amber-300 mt-2">Navigation</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Left sidebar icons</strong> — quick access to World Map, Inventory, Skills, Quests</li>
          <li><strong>☰ Menu button</strong> — opens a full grid of all game areas</li>
          <li>Click any zone on the World Map to travel there instantly</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Zones</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Standard Zones</strong> — combat areas with different monster tiers</li>
          <li><strong>Ancient Ruins</strong> — high-level dungeon content</li>
          <li><strong>Hell Zone</strong> — extreme challenge with unique rewards</li>
          <li><strong>Enchanted Forest</strong> — nature-themed zone with rare drops</li>
          <li>Weather changes per zone and affects combat and drops</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "⚔",
    title: "Combat",
    content: (
      <div className="space-y-2 text-sm">
        <p>Legends of Valor uses a <strong className="text-amber-400">turn-based V2 combat system</strong> with elemental affinities and status effects.</p>
        <p className="font-semibold text-amber-300 mt-2">NPC Battles</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Navigate to <strong>NPC Battle</strong> from the menu to fight zone monsters</li>
          <li>Choose Attack, Defend, Use Skill, or Flee each turn</li>
          <li>Your equipped pet participates in battle alongside you</li>
          <li>Win Gold, XP, and loot — lose and face a death penalty</li>
          <li>30-second combat cooldown between fights</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Player Challenges (Bounties)</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Go to <strong>Challenges</strong> to issue or accept PvP duels</li>
          <li>You may challenge NPC players up to 2 times per day each</li>
          <li>Challenge outcomes affect your Win/Loss record</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Combat Stats</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><span className="text-red-400">Str</span> — physical attack power</li>
          <li><span className="text-blue-400">Def</span> — damage reduction</li>
          <li><span className="text-green-400">Spd</span> — turn order and dodge chance</li>
          <li><span className="text-purple-400">Int</span> — magic damage and skill power</li>
          <li><span className="text-yellow-400">Luck</span> — crit chance and loot quality</li>
          <li><span className="text-orange-400">Pot</span> — potion and healing effectiveness</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🎒",
    title: "Inventory & Equipment",
    content: (
      <div className="space-y-2 text-sm">
        <p>Open <strong className="text-amber-400">Inventory</strong> from the sidebar to manage all your items and gear.</p>
        <p className="font-semibold text-amber-300 mt-2">Equipment Slots</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Weapon</strong> — boosts Str and combat damage</li>
          <li><strong>Armor</strong> — boosts Def and reduces incoming damage</li>
          <li><strong>Accessory 1 & 2</strong> — rings or trinkets for mixed bonuses</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Item Tiers (rarity)</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><span className="text-green-400">Normal</span> → <span className="text-purple-400">Super Rare</span> → <span className="text-yellow-400">X</span> → <span className="text-red-400">UMR</span> → <span className="text-pink-400">SSUMR</span> → <span className="text-cyan-400">Divine</span></li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Item Actions</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Equip</strong> — put item in an equipment slot</li>
          <li><strong>Sell</strong> — sell to shop for gold</li>
          <li><strong>Repair</strong> — restore durability at the shop</li>
          <li><strong>Socket Gem</strong> — upgrade items with gem sockets in the crafting tab</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Carry Capacity</p>
        <p className="text-gray-300">Your inventory has a weight limit that scales with your rank. Heavier items cost more carry capacity.</p>
      </div>
    ),
  },
  {
    icon: "📖",
    title: "Skills",
    content: (
      <div className="space-y-2 text-sm">
        <p>The <strong className="text-amber-400">Skill Chamber</strong> lets you unlock and upgrade powerful active and passive abilities.</p>
        <p className="font-semibold text-amber-300 mt-2">Training Points</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Earn Training Points from quests, combat wins, and achievements</li>
          <li>Spend them to unlock new skills or upgrade existing ones</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Racial Abilities</p>
        <p className="text-gray-300">Every race has a unique passive and active skill. Your active racial spell can be used once per combat turn for powerful effects.</p>
        <p className="font-semibold text-amber-300 mt-2">Offline Training</p>
        <p className="text-gray-300">Set a stat to train while offline. When you return, you receive XP gains based on how long you were away.</p>
      </div>
    ),
  },
  {
    icon: "📜",
    title: "Quests",
    content: (
      <div className="space-y-2 text-sm">
        <p>Visit the <strong className="text-amber-400">Quest Board</strong> to pick up tasks that reward gold, XP, items, and training points.</p>
        <p className="font-semibold text-amber-300 mt-2">Quest Types</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Combat Quests</strong> — defeat a number of specific monsters</li>
          <li><strong>Gathering Quests</strong> — collect resources from mining or fishing</li>
          <li><strong>Delivery Quests</strong> — bring items to certain locations</li>
          <li><strong>Guild Quests</strong> — cooperative missions for guild members</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Tips</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Complete daily quests for bonus rewards</li>
          <li>Higher-rank quests give proportionally better rewards</li>
          <li>Some quests require a certain rank to unlock</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "💰",
    title: "Economy & Shops",
    content: (
      <div className="space-y-2 text-sm">
        <p>Legends of Valor has a <strong className="text-amber-400">dynamic player-driven economy</strong> where prices shift based on supply and demand.</p>
        <p className="font-semibold text-amber-300 mt-2">General Shop</p>
        <p className="text-gray-300">Buy weapons, armor, potions, and consumables with Gold. Sell your unwanted loot here.</p>
        <p className="font-semibold text-amber-300 mt-2">Valor Shop</p>
        <p className="text-gray-300">Spend Rubies on rare items, pets, and exclusive gear not found elsewhere.</p>
        <p className="font-semibold text-amber-300 mt-2">Auction House</p>
        <p className="text-gray-300">List your items for other players to bid on. Set a starting price and duration. There is a listing fee and a sale tax taken on successful sales.</p>
        <p className="font-semibold text-amber-300 mt-2">Black Market</p>
        <p className="text-gray-300">High-risk, high-reward underground trading. Access exclusive items and deals unavailable in regular shops.</p>
        <p className="font-semibold text-amber-300 mt-2">Trading Post</p>
        <p className="text-gray-300">Directly trade items and gold with other online players in real time.</p>
        <p className="font-semibold text-amber-300 mt-2">Gold Vault</p>
        <p className="text-gray-300">Deposit gold in the vault to earn passive interest over time. There is a maximum vault capacity.</p>
      </div>
    ),
  },
  {
    icon: "🐾",
    title: "Pets",
    content: (
      <div className="space-y-2 text-sm">
        <p><strong className="text-amber-400">Pets</strong> are companions that fight alongside you in battle and provide passive stat bonuses.</p>
        <p className="font-semibold text-amber-300 mt-2">Getting Pets</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Purchase eggs or pets from the <strong>Pet Shop</strong></li>
          <li>Win rare pets through <strong>Events</strong> and <strong>Tournaments</strong></li>
          <li>Hatch eggs to discover your pet's element and tier</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Pet Elements</p>
        <p className="text-gray-300">Fire, Water, Earth, Wind, Lightning, Dark, Light — each has strengths against specific enemy elements.</p>
        <p className="font-semibold text-amber-300 mt-2">Pet Management</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Equip</strong> a pet to bring it into battle (shown in the bottom-right HUD)</li>
          <li><strong>Feed</strong> your pet to gain experience and level it up</li>
          <li><strong>Rebirth</strong> max-level pets for a power boost at a lower tier</li>
          <li><strong>Pet Arena</strong> — battle your pet against others for exclusive rewards</li>
          <li>Fainted pets cannot battle until revived with a revive consumable</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Pet Mutations</p>
        <p className="text-gray-300">Pets have a chance to gain mutation traits when leveling — these grant powerful bonus effects in combat.</p>
      </div>
    ),
  },
  {
    icon: "🦅",
    title: "Birds & Aviary",
    content: (
      <div className="space-y-2 text-sm">
        <p>The <strong className="text-amber-400">Aviary</strong> lets you train and deploy birds as secondary companions.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Birds provide Def and Spd bonuses to your stats</li>
          <li>Train birds over time to increase their tier and stats</li>
          <li>Your active bird is shown in the bottom-right HUD alongside your pet</li>
          <li>Higher-tier birds unlock better passive bonuses</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🎣",
    title: "Fishing",
    content: (
      <div className="space-y-2 text-sm">
        <p>Head to the <strong className="text-amber-400">Fishing Grounds</strong> to catch fish for cooking, crafting, and pet feeding.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Fishing costs Energy per cast</li>
          <li>Different fish rarities: Common, Uncommon, Rare, Legendary</li>
          <li>Your rank unlocks better fishing rods with higher catch rates</li>
          <li>There is a daily catch limit that scales with your rank</li>
          <li>Rare fish can be used to craft powerful consumables or fed to pets for stat boosts</li>
          <li>Legendary fish sell for high prices on the market</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "⛏",
    title: "Mining & Resources",
    content: (
      <div className="space-y-2 text-sm">
        <p>Gather raw materials at the <strong className="text-amber-400">Mining Camp</strong> and push deeper into the <strong className="text-amber-400">Ruby Mines</strong> for premium ores.</p>
        <p className="font-semibold text-amber-300 mt-2">Mining Camp</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Mine Stone, Iron, Gold Ore, and more — each costs Energy</li>
          <li>Resources are used for crafting equipment at the Forge</li>
          <li>Zone resource deposits can be exhausted — they respawn over time</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Ruby Mines</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Mine for Rubies (premium currency) and rare gems</li>
          <li>Gems can be socketed into equipment for bonus stats</li>
          <li>Higher ranks unlock deeper mine levels with better yields</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "⚜",
    title: "Guilds",
    content: (
      <div className="space-y-2 text-sm">
        <p>Join or create a <strong className="text-amber-400">Guild</strong> to cooperate with other players for shared rewards and bonuses.</p>
        <p className="font-semibold text-amber-300 mt-2">Joining a Guild</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Browse open guilds in the Guild Hall and submit an application</li>
          <li>Guild leaders review and accept or reject applications</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Guild Features</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Guild Bank</strong> — shared gold pool all members can contribute to</li>
          <li><strong>Guild Buffs</strong> — purchase temporary boosts for all members</li>
          <li><strong>Guild Quests</strong> — cooperative objectives with shared rewards</li>
          <li><strong>Guild Battles</strong> — compete against rival guilds</li>
          <li><strong>Guild Chat</strong> — communicate with your guild in real time</li>
          <li><strong>Guild Dungeon</strong> — exclusive high-difficulty content for guild groups</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Guild Roles</p>
        <p className="text-gray-300">Leader, Officer, Member. Leaders manage membership and bank. Officers can manage quests and invites.</p>
      </div>
    ),
  },
  {
    icon: "🏰",
    title: "Home Base",
    content: (
      <div className="space-y-2 text-sm">
        <p>Your <strong className="text-amber-400">Home Base</strong> is a personal stronghold you can upgrade over time for passive bonuses.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Upgrade your Base Tier by spending gold — each tier unlocks new rooms</li>
          <li><strong>Training Room</strong> — boosts offline training XP gains</li>
          <li><strong>Forge</strong> — craft and repair equipment</li>
          <li><strong>Vault Room</strong> — increases your gold vault maximum</li>
          <li><strong>Garden</strong> — generates resources passively over time</li>
          <li>Base upgrades require a minimum rank to unlock higher tiers</li>
          <li>Cosmetic skins can change the visual appearance of your base</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🏆",
    title: "Ranking Up & Progression",
    content: (
      <div className="space-y-2 text-sm">
        <p>Progress through <strong className="text-amber-400">15 ranks</strong> from Novice to Mythical Legend by earning enough XP and gold.</p>
        <p className="font-semibold text-amber-300 mt-2">The 15 Ranks</p>
        <ol className="list-decimal list-inside space-y-0.5 text-gray-300 text-xs">
          <li>Novice</li><li>Apprentice</li><li>Initiate</li><li>Journeyman</li>
          <li>Adept</li><li>Expert</li><li>Master</li><li>Grandmaster</li>
          <li>Champion</li><li>Overlord</li><li>Sovereign</li><li>Ascendant</li>
          <li>Legend</li><li>Mythic</li><li>Mythical Legend</li>
        </ol>
        <p className="font-semibold text-amber-300 mt-2">Heritage Rebirth</p>
        <p className="text-gray-300">At max rank you can choose to Heritage Rebirth — resetting your rank in exchange for permanent bonus stats that carry over to future playthroughs. Stack up to the maximum rebirths for an enormous power advantage.</p>
        <p className="font-semibold text-amber-300 mt-2">Leaderboard</p>
        <p className="text-gray-300">The <strong>Hall of Fame</strong> ranks all players by power, gold, wins, and other metrics. Compete for the top spot!</p>
      </div>
    ),
  },
  {
    icon: "⚔",
    title: "Tournaments & Events",
    content: (
      <div className="space-y-2 text-sm">
        <p><strong className="text-amber-400">Tournaments</strong> are scheduled PvP competitions with prize pools and exclusive rewards.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Register before the deadline to enter</li>
          <li>Bracket-style elimination — defeat opponents to advance</li>
          <li>Bet on tournament outcomes in the betting arena for extra gold</li>
          <li>First place wins rare items and a special title</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Events</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Timed limited events appear in the <strong>Events Hall</strong></li>
          <li>World Bosses spawn periodically — deal damage for proportional loot</li>
          <li>Battle Royale mode: last player standing wins the prize pool</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🎖",
    title: "Achievements & Reputation",
    content: (
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-amber-300">Trophy Hall (Achievements)</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Earn achievements by hitting milestones: kills, gold earned, items crafted, etc.</li>
          <li>Achievements reward bonus Training Points and exclusive cosmetics</li>
          <li>Check your progress and claim completed achievement rewards</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Faction Reputation</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Build reputation with in-game factions through specific quests and actions</li>
          <li>Higher reputation unlocks faction-exclusive shop items and discounts</li>
          <li>Some zones and dungeons require a minimum reputation level to access</li>
        </ul>
        <p className="font-semibold text-amber-300 mt-2">Valorpedia</p>
        <p className="text-gray-300">The <strong>Valorpedia</strong> is your in-game encyclopedia. Discover lore, monster entries, item details, and game world history as you play. Complete discoveries to earn milestone rewards.</p>
      </div>
    ),
  },
  {
    icon: "🎨",
    title: "Cosmetics & Customisation",
    content: (
      <div className="space-y-2 text-sm">
        <p>Customise your character's appearance through the <strong className="text-amber-400">Cosmetics Shop</strong>.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li><strong>Character Skins</strong> — change how your portrait looks across the HUD and combat</li>
          <li><strong>Base Skins</strong> — change the visual theme of your Home Base</li>
          <li><strong>Pet Skins</strong> — give your companion a unique look</li>
          <li>Cosmetics are purely visual and do not affect gameplay stats</li>
          <li>Some skins require Valor Tokens ($V) rather than Gold</li>
          <li><strong>VIP Status</strong> — grants a VIP badge and exclusive perks for a duration</li>
        </ul>
      </div>
    ),
  },
  {
    icon: "🤖",
    title: "AI Game Master",
    content: (
      <div className="space-y-2 text-sm">
        <p>The <strong className="text-amber-400">AI Game Master</strong> is an in-game assistant powered by AI that can answer questions, narrate lore, and guide you through the game world.</p>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Access via the floating AI button or navigate to <strong>Game Master</strong> in the menu</li>
          <li>Ask about game mechanics, lore, item descriptions, or strategy tips</li>
          <li>The AI is aware of your character's current state and can give personalised advice</li>
        </ul>
      </div>
    ),
  },
];

function GuideSection({ section }: { section: GuideSectionData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-guide-section">
      <button
        className="settings-guide-header"
        onClick={() => setOpen(o => !o)}
      >
        <span className="settings-guide-icon">{section.icon}</span>
        <span className="settings-guide-title">{section.title}</span>
        {open
          ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-amber-400" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
        }
      </button>
      {open && (
        <div className="settings-guide-body">
          {section.content}
        </div>
      )}
    </div>
  );
}

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<"music" | "guide" | "account">("music");
  const {
    isPlaying, volume, isMuted, currentTrack, isLoading, hasError,
    togglePlay, toggleMute, nextTrack, prevTrack, setVolume, selectTrack,
  } = useAudio();
  const { account, setAccount } = useGame();

  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setUsernameLoading(true);
    setUsernameMsg(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}/change-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: newUsername.trim(), currentPassword: usernamePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameMsg({ ok: false, text: data.error || "Failed to change username" });
      } else {
        setAccount({ ...account, username: newUsername.trim() });
        setUsernameMsg({ ok: true, text: "Username updated successfully!" });
        setNewUsername("");
        setUsernamePassword("");
      }
    } catch {
      setUsernameMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setUsernameLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: "New password must be at least 6 characters." });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ ok: false, text: data.error || "Failed to change password" });
      } else {
        setPasswordMsg({ ok: true, text: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-panel-header">
          <span className="settings-panel-title">⚙ Settings</span>
          <button className="settings-panel-close" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${tab === "music" ? "settings-tab-active" : ""}`}
            onClick={() => setTab("music")}
          >
            <Music className="h-3.5 w-3.5" />
            Music
          </button>
          <button
            className={`settings-tab ${tab === "account" ? "settings-tab-active" : ""}`}
            onClick={() => setTab("account")}
          >
            <User className="h-3.5 w-3.5" />
            Account
          </button>
          <button
            className={`settings-tab ${tab === "guide" ? "settings-tab-active" : ""}`}
            onClick={() => setTab("guide")}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Guide
          </button>
        </div>

        <div className="settings-panel-body">
          {tab === "music" && (
            <div className="settings-music">
              <div className="settings-music-now-playing">
                <Music className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <div className="settings-music-track-info">
                  <span className="settings-music-label">Now Playing</span>
                  <span className={`settings-music-track-name ${hasError ? "text-red-400" : ""}`}>
                    {hasError
                      ? `${MUSIC_TRACKS[currentTrack].name} (Error)`
                      : isLoading
                      ? `${MUSIC_TRACKS[currentTrack].name} (Loading…)`
                      : MUSIC_TRACKS[currentTrack].name}
                  </span>
                </div>
              </div>

              <div className="settings-music-controls">
                <button className="settings-music-btn" onClick={prevTrack} title="Previous Track">
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  className="settings-music-btn settings-music-btn-play"
                  onClick={togglePlay}
                  disabled={isLoading}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isLoading
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : isPlaying
                    ? <Pause className="h-5 w-5" />
                    : <Play className="h-5 w-5 ml-0.5" />}
                </button>
                <button className="settings-music-btn" onClick={nextTrack} title="Next Track">
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              <div className="settings-music-volume">
                <button className="settings-music-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted || volume === 0
                    ? <VolumeX className="h-4 w-4" />
                    : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : Math.round(volume * 100)}
                  onChange={e => setVolume(parseInt(e.target.value) / 100)}
                  className="settings-music-slider"
                />
                <span className="settings-music-volume-label">
                  {isMuted ? 0 : Math.round(volume * 100)}%
                </span>
              </div>

              <div className="settings-music-tracklist">
                <p className="settings-music-tracklist-label">Playlist</p>
                <div className="settings-music-tracks">
                  {MUSIC_TRACKS.map((track, i) => (
                    <button
                      key={i}
                      className={`settings-music-track-row ${i === currentTrack ? "settings-music-track-active" : ""}`}
                      onClick={() => selectTrack(i)}
                    >
                      {i === currentTrack && isPlaying
                        ? <span className="settings-track-playing-dot" />
                        : <span className="settings-track-number">{i + 1}</span>}
                      <span className="settings-track-name">{track.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "account" && (
            <div className="space-y-5 p-1">
              {!account && (
                <p className="text-sm text-gray-400 text-center py-6">Please log in to manage account settings.</p>
              )}
              {account && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-3">Logged in as <span className="text-amber-400 font-semibold">{account.username}</span></p>
                  </div>

                  <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                      <User className="h-4 w-4" /> Change Username
                    </h3>
                    <form onSubmit={handleChangeUsername} className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">New Username</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={e => setNewUsername(e.target.value)}
                          placeholder="3–32 characters"
                          minLength={3}
                          maxLength={32}
                          required
                          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showUsernamePassword ? "text" : "password"}
                            value={usernamePassword}
                            onChange={e => setUsernamePassword(e.target.value)}
                            placeholder="Confirm with your password"
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowUsernamePassword(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                          >
                            {showUsernamePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      {usernameMsg && (
                        <p className={`text-xs flex items-center gap-1 ${usernameMsg.ok ? "text-green-400" : "text-red-400"}`}>
                          {usernameMsg.ok && <CheckCircle className="h-3.5 w-3.5" />}
                          {usernameMsg.text}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={usernameLoading || !newUsername.trim() || !usernamePassword}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded py-1.5 transition-colors flex items-center justify-center gap-2"
                      >
                        {usernameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Username"}
                      </button>
                    </form>
                  </div>

                  <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Change Password
                    </h3>
                    <form onSubmit={handleChangePassword} className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPw ? "text" : "password"}
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            placeholder="Your current password"
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                          >
                            {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPw ? "text" : "password"}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            minLength={6}
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPw(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                          >
                            {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          required
                          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      {passwordMsg && (
                        <p className={`text-xs flex items-center gap-1 ${passwordMsg.ok ? "text-green-400" : "text-red-400"}`}>
                          {passwordMsg.ok && <CheckCircle className="h-3.5 w-3.5" />}
                          {passwordMsg.text}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded py-1.5 transition-colors flex items-center justify-center gap-2"
                      >
                        {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "guide" && (
            <div className="settings-guide">
              <p className="settings-guide-intro">
                Everything you need to know about playing <span className="text-amber-400 font-semibold">Legends of Valor</span>. Tap any section to expand it.
              </p>
              <div className="settings-guide-list">
                {GUIDE_SECTIONS.map((section, i) => (
                  <GuideSection key={i} section={section} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
