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
      "Thou hast chosen a path of glory in this realm of legend.",
      "Legends of Valor is a browser RPG with 14 races, 15 ranks, turn-based combat, pets, guilds, fishing, crafting, and much more.",
      "This brief guide shall prepare thee for adventure.",
    ],
    action: "Click Continue to learn about thy race and starting stats.",
    highlight: null,
  },
  {
    id: "race",
    title: "Thy Race & Stats",
    icon: "🧬",
    content: [
      "Each race bestows unique bonuses: Elves gain speed and magic, Orcs gain strength, Dwarves gain defense, and so forth.",
      "Thy base stats are Strength (STR), Defense (DEF), Speed (SPD), Intelligence (INT), and Luck (LUK).",
      "Thou hast received 10 Training Points, 35,000 gold, a Thunder Hammer, Shadow Cloak, and Lucky Ring to begin thy adventure.",
    ],
    action: "Do this: After the tutorial, open your Inventory to equip starter gear, then go to Training Grounds to spend Training Points.",
    highlight: "base",
  },
  {
    id: "combat",
    title: "Turn-Based Combat",
    icon: "⚔️",
    content: [
      "In PvP, choose Attack, Defend, or Spell each turn. Defend negates all damage if thy Defense exceeds enemy Attack.",
      "Spells bypass Defense entirely. Stuns, Freezes, and Silences can be applied by powerful foes.",
      "Death is not permanent — lose some gold and return as a Ghost. Visit thy Base to respawn.",
    ],
    action: "Do this: Head to the Mystic Tower on the World Map to fight your first NPC battle.",
    highlight: "challenges",
  },
  {
    id: "npc_tower",
    title: "The NPC Tower",
    icon: "🗼",
    content: [
      "The Mystic Tower holds 50 floors, each with 100 NPC levels. Defeat all to climb higher.",
      "Floor bosses drop special runes. Higher floors grant greater gold and soul shard rewards.",
      "Auto-fight lets thee battle up to 100 times automatically while thou art away.",
    ],
    action: "Do this: First equip your starter gear from Inventory, then click the Mystic Tower on the World Map and press Battle.",
    highlight: "npc-battle",
  },
  {
    id: "pets",
    title: "Pets & Companions",
    icon: "🐾",
    content: [
      "Pets hatch from eggs and gain power through feeding, battles, and care.",
      "Each pet has elements that deal bonus damage against opposing elements in combat.",
      "Feed pets fish from the Coastal Village, train them in Pet Training grounds, and evolve them through tiers.",
    ],
    action: "Do this: Visit Pet Training Grounds on the World Map to train and evolve your starting pet.",
    highlight: "pets",
  },
  {
    id: "world",
    title: "The World of Valor",
    icon: "🗺️",
    content: [
      "Twelve zones await exploration: from the Capital City to Ancient Ruins to the Crystal Lake.",
      "Weather changes dynamically — thunderstorms spawn rare bosses, fog hides champions, blizzards empower the darkness.",
      "Zone dungeons offer special challenges for guilds and solo adventurers alike.",
    ],
    action: "Do this: Open the World Map and explore — look for the glowing Mystic Tower marker for beginners.",
    highlight: "world-map",
  },
  {
    id: "guild",
    title: "Guilds & Factions",
    icon: "🏰",
    content: [
      "Join or create a guild to unlock guild dungeons, shared vaults, and cooperative buffs.",
      "Build reputation with four factions — Merchants, Warriors, Scholars, and Nature Wardens — to unlock exclusive rewards.",
      "Guild members can challenge each other to earn guild experience and climb the guild leaderboard.",
    ],
    action: "Do this: After your first battle, visit the Guild Hall to join an existing guild.",
    highlight: "guild",
  },
  {
    id: "economy",
    title: "Economy & Crafting",
    icon: "💰",
    content: [
      "Gold, Rubies, Soul Shards, and Training Points are the currencies of this realm.",
      "Shop prices fluctuate with supply and demand — buy low and sell high on the Auction House.",
      "Craft items from fishing catches, mine rubies, and collect resources throughout the world.",
    ],
    action: "Do this: Visit the Capital City Shop to buy your first gear upgrade with your starting gold.",
    highlight: "shop",
  },
  {
    id: "complete",
    title: "Thy Adventure Begins!",
    icon: "🌟",
    content: [
      "Thou art now prepared to face the realm of Valor.",
      "Check thy First Steps checklist on the Home Base — complete each objective to grow quickly.",
      "May fortune favor thee, brave adventurer!",
    ],
    action: "Do this: Go to your Home Base now and check the First Steps panel to begin your journey.",
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
