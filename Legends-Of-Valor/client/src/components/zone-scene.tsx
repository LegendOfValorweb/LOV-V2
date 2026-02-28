import { useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";

interface InteractableObject {
  id: string;
  type: "npc" | "resource" | "shop" | "portal" | "object";
  name: string;
  emoji: string;
  position: { x: number; y: number };
  animation?: "glow" | "bob" | "shimmer" | "pulse";
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
}

interface ZoneSceneProps {
  zoneName: string;
  backdrop: string;
  children: ReactNode;
  interactables?: InteractableObject[];
  loreText?: string;
  showPlayerSprite?: boolean;
  overlayOpacity?: number;
  ambientClass?: string;
}

const ZONE_LORE: Record<string, string[]> = {
  "General Shop": [
    "The merchants of Capital City offer wares from across the realm...",
    "Gold flows like water in the bustling marketplace.",
    "\"The best deals are found by those who look carefully.\"",
  ],
  "Fishing Grounds": [
    "The crystal-clear waters shimmer with the promise of rare catches...",
    "Patient anglers are rewarded with the finest fish in the realm.",
    "\"Even the smallest fish can feed the mightiest pet.\"",
  ],
  "Mining Camp": [
    "The mountain echoes with the sound of pickaxes striking ore...",
    "Rich veins of precious metals await the determined miner.",
    "\"Dig deep enough and you may find what legends are made of.\"",
  ],
  "Home Base": [
    "Your fortress stands as a testament to your journey...",
    "Within these walls, you rest, train, and prepare for battle.",
    "\"A hero is only as strong as the foundation they build.\"",
  ],
  "Pet Sanctuary": [
    "Mystical creatures stir in their enclosures, sensing your presence...",
    "The bond between warrior and companion is sacred in this realm.",
    "\"A well-trained pet is worth more than a legendary sword.\"",
  ],
  "Guild Hall": [
    "The banners of great guilds hang from the rafters above...",
    "United, warriors achieve what none could alone.",
    "\"In unity, there is strength beyond measure.\"",
  ],
  "Aviary": [
    "Exotic birds sing melodies that echo through the enchanted forest...",
    "Focus Shards shimmer among the branches, waiting to be claimed.",
    "\"The sky belongs to those who dare to soar.\"",
  ],
  "Skill Chamber": [
    "Ancient tomes float in mid-air, their pages turning of their own accord...",
    "Knowledge is the most powerful weapon of all.",
    "\"Master one spell well, rather than many poorly.\"",
  ],
  "NPC Battle": [
    "The tower looms above, each floor more treacherous than the last...",
    "Only the bravest dare to climb the Mystic Tower.",
    "\"Every floor conquered brings you closer to legend.\"",
  ],
  "Trading Post": [
    "Traders from distant lands gather here to exchange rare goods...",
    "A fair trade benefits both parties equally.",
    "\"Trust is the currency that matters most in trade.\"",
  ],
  "Hell Zone": [
    "The air itself burns with infernal energy...",
    "No safe return exists once you enter. Victory or death.",
    "\"Only fools enter unprepared. Only legends emerge.\"",
  ],
  "Ruby Mines": [
    "Crimson crystals pulse with ancient power deep underground...",
    "The mines hold treasures beyond mortal comprehension.",
    "\"Fortune favors those who strike the deepest veins.\"",
  ],
};

export function ZoneScene({
  zoneName,
  backdrop,
  children,
  interactables = [],
  loreText,
  showPlayerSprite = true,
  overlayOpacity = 0.4,
  ambientClass = "",
}: ZoneSceneProps) {
  const { account } = useGame();
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [showLore, setShowLore] = useState(true);
  const [loreIndex, setLoreIndex] = useState(0);
  const [activeInteractable, setActiveInteractable] = useState<string | null>(null);

  const loreTips = loreText
    ? [loreText]
    : ZONE_LORE[zoneName] || ["Entering " + zoneName + "..."];

  useEffect(() => {
    setLoreIndex(Math.floor(Math.random() * loreTips.length));
  }, [loreTips.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLore(false);
    }, 1800);
    const transTimer = setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
    return () => {
      clearTimeout(timer);
      clearTimeout(transTimer);
    };
  }, []);

  const getPortraitPath = useCallback(() => {
    if (!account) return "/portraits/human_male.png";
    if (
      (account as any).equippedCharacterSkin &&
      (account as any).equippedCharacterSkin !== "default"
    ) {
      return `/skins/character/${(account as any).equippedCharacterSkin}.png`;
    }
    if (account.portrait) {
      if (account.portrait.startsWith("skins/")) return `/${account.portrait}.png`;
      if (account.portrait.includes("/")) return account.portrait;
      return `/portraits/${account.portrait}.png`;
    }
    if (account.race && account.gender)
      return `/portraits/${account.race}_${account.gender}.png`;
    return "/portraits/human_male.png";
  }, [account]);

  const handleInteractableClick = (obj: InteractableObject) => {
    if (obj.disabled) return;
    setActiveInteractable(obj.id);
    obj.onClick?.();
    setTimeout(() => setActiveInteractable(null), 300);
  };

  return (
    <div className="zone-scene">
      {showLore && (
        <div className={`zone-loading-overlay ${!isTransitioning ? "zone-loading-fade" : ""}`}>
          <div className="zone-loading-content">
            <h2 className="zone-loading-title">{zoneName}</h2>
            <div className="zone-loading-divider" />
            <p className="zone-loading-lore">{loreTips[loreIndex]}</p>
            <div className="zone-loading-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}

      <div className="zone-layer zone-layer-bg">
        <div
          className="zone-backdrop"
          style={{ backgroundImage: `url('${backdrop}')` }}
        />
        <div
          className="zone-backdrop-overlay"
          style={{ opacity: overlayOpacity }}
        />
      </div>

      {ambientClass && <div className={`zone-layer zone-layer-ambient ${ambientClass}`} />}

      <div className="zone-layer zone-layer-midground">
        {interactables.map((obj) => (
          <button
            key={obj.id}
            className={`zone-interactable zone-interactable-${obj.type} ${
              obj.animation ? `zone-anim-${obj.animation}` : ""
            } ${obj.disabled ? "zone-interactable-disabled" : ""} ${
              activeInteractable === obj.id ? "zone-interactable-active" : ""
            }`}
            style={{
              left: `${obj.position.x}%`,
              top: `${obj.position.y}%`,
            }}
            onClick={() => handleInteractableClick(obj)}
            title={obj.tooltip || obj.name}
            disabled={obj.disabled}
          >
            <span className="zone-interactable-icon">{obj.emoji}</span>
            <span className="zone-interactable-label">{obj.name}</span>
          </button>
        ))}
      </div>

      {showPlayerSprite && account && (
        <div className="zone-layer zone-layer-foreground">
          <div className="zone-player-sprite">
            <img
              src={getPortraitPath()}
              alt={account.username}
              className="zone-player-portrait"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/portraits/human_male.png";
              }}
            />
            <span className="zone-player-name">{account.username}</span>
          </div>
        </div>
      )}

      <div className="zone-layer zone-layer-ui">
        {children}
      </div>
    </div>
  );
}

export function ZoneTransition({
  to,
  zoneName,
  children,
  onComplete,
}: {
  to: string;
  zoneName: string;
  children: ReactNode;
  onComplete?: () => void;
}) {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<"idle" | "fadeOut" | "showing" | "fadeIn">("idle");

  const startTransition = useCallback(() => {
    setPhase("fadeOut");
    setTimeout(() => {
      setPhase("showing");
      setTimeout(() => {
        setPhase("fadeIn");
        navigate(to);
        onComplete?.();
        setTimeout(() => setPhase("idle"), 500);
      }, 800);
    }, 500);
  }, [to, navigate, onComplete]);

  return (
    <>
      {phase !== "idle" && (
        <div
          className={`zone-transition-screen ${
            phase === "fadeOut"
              ? "zone-transition-fadeout"
              : phase === "showing"
              ? "zone-transition-show"
              : "zone-transition-fadein"
          }`}
        >
          <span className="zone-transition-name">{zoneName}</span>
        </div>
      )}
      <span onClick={startTransition}>{children}</span>
    </>
  );
}

export type { InteractableObject };
