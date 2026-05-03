import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, X } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Legends of Valor",
    icon: "⚔️",
    content: [
      "Legends of Valor is a browser RPG where you rise from Novice all the way to Mythical Legend across 15 ranks.",
      "14 unique races, turn-based combat, guild warfare, army raids, pets, fishing, crafting, and dozens of zones await.",
      "Use the bottom navigation bar to move between key areas quickly from anywhere in the game.",
    ],
    action: "Click Continue to learn about your race and starting stats.",
    highlight: null,
  },
  {
    id: "race",
    title: "Thy Race & Stats",
    icon: "🧬",
    content: [
      "Each race grants unique bonuses: Elves gain speed and magic, Orcs gain strength, Dwarves gain defense, Titans gain raw power.",
      "Your 5 base stats are: Strength (STR), Defense (DEF), Speed (SPD), Intelligence (INT), and Luck (LUK).",
      "You start with 10 Training Points, 35,000 gold, and starter gear: Thunder Hammer, Shadow Cloak, and Lucky Ring.",
    ],
    action: "Do this: Open Inventory (🎒 icon in the left bar), equip your starter gear, then visit Base to spend Training Points.",
    highlight: "base",
  },
  {
    id: "rank_power",
    title: "Rank Progression & Power",
    icon: "⭐",
    content: [
      "Every rank-up grants a permanent stat bonus stacking to +96% ALL stats at Mythical Legend — your rank IS your power.",
      "Gold rewards also scale with rank: Mythical Legends earn up to 6× more gold from the same content.",
      "Higher rank unlocks new zones, harder content, and the army system (Barracks unlocks at Expert rank).",
    ],
    action: "Do this: Win battles to earn XP. Rank up by meeting the XP threshold shown in your Base First Steps panel.",
    highlight: null,
  },
  {
    id: "combat",
    title: "Turn-Based Combat",
    icon: "⚔️",
    content: [
      "Each turn choose Attack, Defend, or Spell. Defend blocks all damage when your DEF exceeds the enemy's ATK.",
      "Spells and CC effects (stun, freeze, silence) bypass defense entirely — time them wisely.",
      "Death is not permanent: you become a Ghost and lose some gold. Visit your Base or use a Revive Token to return.",
    ],
    action: "Do this: Tap ⚔ Tower in the bottom bar. Equip your gear first, then press Battle to start climbing.",
    highlight: "npc-battle",
  },
  {
    id: "npc_tower",
    title: "The Mystic Tower",
    icon: "🗼",
    content: [
      "50 floors × 100 levels each. Clear every level on a floor to advance — floor bosses drop powerful runes.",
      "Gold rewards scale with your rank. Auto-fight battles up to 100 times automatically while you are away.",
      "Soul Shards from the tower are used to upgrade skills and unlock special abilities.",
    ],
    action: "Do this: Tap ⚔ Tower in the bottom bar. The glowing green Start Here marker shows the best first destination.",
    highlight: "npc-battle",
  },
  {
    id: "army",
    title: "Army & War Front",
    icon: "🪖",
    content: [
      "Upgrade your Base Keep to Tier 3 (Expert rank) to unlock the Barracks and raise a personal army.",
      "Train infantry, archers, cavalry, siege engines, and elite guards. Each troop type serves a different role in raids.",
      "Your hero's stats power your army — STR boosts attack, INT boosts siege power, LUK improves hit rates.",
    ],
    action: "Do this: Tap 🪖 Army in the bottom bar. Build your Barracks once your Base Keep reaches Tier 3.",
    highlight: "warfront",
  },
  {
    id: "pets",
    title: "Pets & Companions",
    icon: "🐾",
    content: [
      "Pets hatch from eggs and grow through feeding, battles, and care. Equip your best pet before every fight.",
      "Each pet has an element — Fire, Water, Earth, etc. — that deals bonus damage against opposing elements.",
      "A bird companion provides passive DEF bonuses in all combat modes. Collect both a pet and a bird early.",
    ],
    action: "Do this: Visit Pet Training Grounds on the World Map to train your starting pet and unlock its abilities.",
    highlight: "pets",
  },
  {
    id: "quests_guild",
    title: "Quests, Events & Guilds",
    icon: "📜",
    content: [
      "The Quest Board generates daily quests scaled to your rank — combat goals, tower targets, and wealth milestones.",
      "World Bosses appear server-wide. Everyone shares the damage pool; defeating one grants legendary loot for all.",
      "Guilds unlock dungeons, shared vaults, and cooperative buffs. Join one early for faster progression.",
    ],
    action: "Do this: Tap 📜 Quests in the bottom bar to pick up your first daily quests, then join a Guild.",
    highlight: "guild",
  },
  {
    id: "complete",
    title: "Thy Adventure Begins!",
    icon: "🌟",
    content: [
      "You are now ready to face Legends of Valor. Use the bottom navigation bar to reach key areas at any time.",
      "Check your Home Base First Steps checklist — completing each objective is the fastest path to early power.",
      "May fortune favor thee, brave adventurer!",
    ],
    action: "Do this: Tap 🏰 Base in the bottom bar to check your First Steps checklist and begin your journey.",
    highlight: null,
  },
];

interface TutorialOverlayProps {
  onComplete: () => void;
}

export default function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const { account } = useGame();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const progress = ((step) / (TUTORIAL_STEPS.length - 1)) * 100;

  const handleNext = async () => {
    if (isLast) {
      await handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      if (account?.id) {
        await apiRequest("POST", `/api/ai/tutorial/${account.id}/complete`, {});
        queryClient.invalidateQueries({ queryKey: ["/api/ai/storyline", account.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/ai/story-act", account.id] });
        // Trigger AI story start with a concrete first directive
        apiRequest("POST", "/api/ai/chat", {
          accountId: account.id,
          message: "I have just arrived in Valor as a brand new adventurer. What is the single most important thing I should do right now to get started? Give me one clear, concrete action.",
        }).catch(() => {});
      }
    } catch (e) {
    } finally {
      onComplete();
      navigate("/base");
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950/30 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
                Step {step + 1} of {TUTORIAL_STEPS.length}
              </Badge>
              <span className="text-xs text-muted-foreground">Tutorial</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Skip
            </Button>
          </div>

          <Progress value={progress} className="h-1 mb-8 bg-gray-800" />

          <div className="text-center mb-8">
            <div className="text-6xl mb-4 filter drop-shadow-lg">{current.icon}</div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-2">
              {current.title}
            </h2>
          </div>

          <div className="space-y-4 mb-6">
            {current.content.map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-amber-400 mt-0.5 shrink-0">◆</span>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

          {current.action && (
            <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/40 px-4 py-3">
              <p className="text-sm font-bold text-amber-300">{current.action}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {TUTORIAL_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === step
                      ? "bg-amber-400 w-6"
                      : i < step
                      ? "bg-amber-600/60"
                      : "bg-gray-700"
                  }`}
                />
              ))}
            </div>
            <Button
              onClick={handleNext}
              disabled={isCompleting}
              className="bg-amber-600 hover:bg-amber-500 text-black font-semibold px-6 gap-2"
            >
              {isLast ? (
                isCompleting ? "Starting..." : "Begin Adventure!"
              ) : (
                <>Continue <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
