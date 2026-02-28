import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { X, ChevronRight, ChevronLeft, MapPin, Sword, ShoppingBag, Star, Fish, Users, Sparkles, BookOpen } from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  message: string;
  icon: React.ReactNode;
  action?: { label: string; route: string };
  highlightZone?: string;
  tip?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Legends of Valor!",
    icon: <Sparkles className="h-6 w-6 text-amber-400" />,
    message: `Greetings, brave adventurer! I am VALOR, your AI Game Master. I'll guide you through your first steps in this world.\n\nYou've chosen your race and started your journey. The realm of Valor is vast — filled with dungeons, fierce creatures, loyal companions, and legendary treasures. Let's get you started!`,
    tip: "Your race gives you unique stat bonuses. Elves excel at magic, Orcs at strength, and Dwarves at crafting.",
  },
  {
    id: "base",
    title: "Your Base — Home & Headquarters",
    icon: <MapPin className="h-6 w-6 text-amber-400" />,
    message: `Every hero needs a home. Your Base is your personal fortress where you can:\n\n🏰 Store items in your Vault\n⚒ Upgrade rooms over time\n📦 Access your full inventory\n🛌 Set offline training to earn XP while you sleep\n\nTap "Visit Base" to take your first look!`,
    action: { label: "Visit Base", route: "/base" },
    tip: "Upgrade your Storage room first — you'll need the space as you collect loot.",
  },
  {
    id: "tower",
    title: "Mystic Tower — Your First Battle",
    icon: <Sword className="h-6 w-6 text-red-400" />,
    message: `The Mystic Tower is where your combat journey begins. Each floor has an NPC enemy to defeat.\n\n⚔ Floor 1 is a Goblin Scout — manageable even at Novice rank\n📈 Each floor you clear earns XP and raises your rank\n🏆 Clearing floors unlocks new skills and gear\n\nHead to the Tower and win your first fight!`,
    action: { label: "Go to Mystic Tower", route: "/npc-battle" },
    tip: "Use your starting stats to guide your build. Str = physical damage, Int = spell power, Spd = who attacks first.",
  },
  {
    id: "weapon",
    title: "The Shop — Get Your First Weapon",
    icon: <ShoppingBag className="h-6 w-6 text-amber-400" />,
    message: `Every adventurer needs proper gear. Capital City's General Shop sells starter weapons and armor.\n\n🗡 Buy a Novice Weapon for your build type\n🛡 Pick up basic Armor to improve your Defense\n💰 You started with 10,000 Gold — spend it wisely!\n\nVisit the Shop and equip your first weapon.`,
    action: { label: "Visit the Shop", route: "/shop" },
    tip: "Check your Inventory after buying — tap an item to equip it. Equipped gear shows in yellow.",
  },
  {
    id: "pet",
    title: "Your First Pet — Loyal Companions",
    icon: <Star className="h-6 w-6 text-purple-400" />,
    message: `Pets are powerful allies that fight alongside you and provide passive bonuses.\n\n🥚 Hatch a Basic Egg in the Pet Sanctuary to get your first companion\n🐾 Equip your pet from the Pets page to bring it into battle\n⚡ Pets have elements that counter enemies — plan your team!\n\nHead to the Pet Sanctuary to hatch your first egg.`,
    action: { label: "Pet Sanctuary", route: "/pets" },
    tip: "Normal-tier pets are free to start. Super Rare and above need Soul Gins to hatch — earn these from battles.",
  },
  {
    id: "fishing",
    title: "Crystal Lake — Relax & Earn",
    icon: <Fish className="h-6 w-6 text-blue-400" />,
    message: `Not everything in Valor is combat! Fishing at Crystal Lake lets you:\n\n🎣 Catch fish that sell for Gold\n🔮 Rare fish are crafting materials for powerful gear\n⚡ Uses Energy — fish when you have spare energy to burn\n\nFishing is a great way to earn Gold between battles.`,
    action: { label: "Go Fishing", route: "/fishing" },
    tip: "Aquatic race characters get bonus fishing XP. Use your Bait supply for better catches.",
  },
  {
    id: "guild",
    title: "Guild Hall — Join Forces",
    icon: <Users className="h-6 w-6 text-green-400" />,
    message: `No hero conquers alone. Joining a Guild unlocks:\n\n⚜ Guild Dungeons for rare loot\n🏰 Shared Guild Bank and resources\n⚔ Guild Wars and World Boss events\n🤝 Unity Quests for bonus rewards\n\nFind a guild that matches your playstyle and join up!`,
    action: { label: "Guild Hall", route: "/guild" },
    tip: "Guild Masters earn Unity Coins from quests — these buy powerful exclusive items.",
  },
  {
    id: "complete",
    title: "You're Ready, Champion!",
    icon: <BookOpen className="h-6 w-6 text-amber-400" />,
    message: `You've completed the Legends of Valor tutorial!\n\nHere's your quick reference:\n🗺 World Map — navigate between all zones\n☰ HUD Menu — access any feature quickly\n💬 AI Chat — ask me anything about the game anytime\n⚙ Settings — music controls and options\n\nThe realm of Valor awaits. May your blade stay sharp and your legend grow!`,
    tip: "Tap the 💬 icon in the top bar anytime to chat with me for advice, lore, or battle strategy.",
  },
];

interface TutorialOverlayProps {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [displayedText, setDisplayedText] = useState("");
  const [, navigate] = useLocation();
  const { account } = useGame();

  const step = TUTORIAL_STEPS[currentStep];
  const fullText = step.message;

  useEffect(() => {
    setIsTyping(true);
    setDisplayedText("");
    let i = 0;
    const speed = 18;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayedText(fullText.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [currentStep, fullText]);

  const skipTyping = () => {
    if (isTyping) {
      setDisplayedText(fullText);
      setIsTyping(false);
    }
  };

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleComplete = useCallback(async () => {
    if (account?.id) {
      try {
        await apiRequest("PATCH", `/api/accounts/${account.id}`, { tutorialCompleted: true });
      } catch {}
    }
    onComplete();
  }, [account?.id, onComplete]);

  const handleAction = (route: string) => {
    navigate(route);
    nextStep();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md mb-2"
        onClick={skipTyping}
      >
        <div className="bg-zinc-900/97 border border-amber-700/60 rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 0 40px rgba(255,191,0,0.15), 0 20px 60px rgba(0,0,0,0.8)" }}>

          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800">
            <div className="w-10 h-10 rounded-full bg-amber-900/60 border border-amber-600/40 flex items-center justify-center flex-shrink-0">
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">VALOR — Game Master</div>
              <div className="text-sm font-bold text-white font-serif truncate">{step.title}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleComplete(); }}
              className="text-zinc-500 hover:text-white transition-colors p-1"
              title="Skip tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="px-4 py-4 min-h-[120px] cursor-pointer"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
              {displayedText}
              {isTyping && <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle" />}
            </p>

            {!isTyping && step.tip && (
              <div className="mt-3 p-2.5 bg-amber-950/40 border border-amber-700/30 rounded-lg">
                <p className="text-xs text-amber-300/90">
                  <span className="font-bold text-amber-400">💡 Tip: </span>{step.tip}
                </p>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 flex flex-col gap-2">
            {!isTyping && step.action && (
              <Button
                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold h-10"
                onClick={(e) => { e.stopPropagation(); handleAction(step.action!.route); }}
              >
                {step.action.label} →
              </Button>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); prevStep(); }}
                disabled={currentStep === 0}
                className="flex-shrink-0 h-8 w-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1.5">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all ${i === currentStep ? "w-4 h-2 bg-amber-400" : i < currentStep ? "w-2 h-2 bg-amber-700" : "w-2 h-2 bg-zinc-700"}`}
                  />
                ))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTyping) { skipTyping(); return; }
                  nextStep();
                }}
                className="flex-shrink-0 h-8 px-3 rounded-full border border-amber-700/60 bg-amber-900/30 flex items-center gap-1 text-amber-300 hover:bg-amber-800/40 text-xs font-bold transition-all"
              >
                {currentStep === TUTORIAL_STEPS.length - 1 ? "Finish!" : "Next"}
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
