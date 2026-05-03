import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Map, Crown, Coins, Zap, Gem } from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useState, useEffect } from "react";
import GameBackground from "@/components/game-background";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  backdrop?: string;
  showPlayerInfo?: boolean;
}

const ZONE_ICONS: Record<string, string> = {
  "Inventory": "🎒",
  "Skills": "📖",
  "Shop": "🛒",
  "Base": "🏰",
  "World Map": "🗺",
  "Quests": "📜",
  "Guild Hall": "⚜",
  "Pets": "🐾",
  "Birds": "🦅",
  "Leaderboard": "🏆",
  "Achievements": "🎖",
  "Trading Post": "🤝",
  "Fishing": "🎣",
  "Mining": "⛏",
  "Tournaments": "⚔",
  "Combat Log": "📋",
  "Black Market": "💀",
  "Events": "📅",
  "Challenges": "🎯",
  "Reputation": "🏅",
  "Co-op": "🤺",
  "Pet Arena": "🐉",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function PageLayout({ children, title, backdrop, showPlayerInfo = true }: PageLayoutProps) {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [energyData, setEnergyData] = useState<{ energy: number; maxEnergy: number } | null>(null);

  useEffect(() => {
    if (!account || account.role !== "player") return;
    const fetchEnergy = async () => {
      try {
        const res = await fetch(`/api/accounts/${account.id}/energy`);
        if (res.ok) {
          const data = await res.json();
          setEnergyData({ energy: data.energy, maxEnergy: data.maxEnergy });
        }
      } catch {}
    };
    fetchEnergy();
    const interval = setInterval(fetchEnergy, 30000);
    return () => clearInterval(interval);
  }, [account]);

  const getPortraitPath = () => {
    if (!account) return '/portraits/human_male.png';
    if (account.equippedCharacterSkin && account.equippedCharacterSkin !== 'default') {
      return `/skins/character/${account.equippedCharacterSkin}.png`;
    }
    if (account.portrait) {
      if (account.portrait.startsWith('skins/')) return `/${account.portrait}.png`;
      if (account.portrait.includes('/')) return account.portrait;
      return `/portraits/${account.portrait}.png`;
    }
    if (account.race && account.gender) return `/portraits/${account.race}_${account.gender}.png`;
    return '/portraits/human_male.png';
  };
  const portraitPath = getPortraitPath();

  const zoneIcon = ZONE_ICONS[title] || "⚔";
  const energy = energyData?.energy ?? account?.energy ?? 50;
  const maxEnergy = energyData?.maxEnergy ?? account?.maxEnergy ?? 50;
  const energyPct = Math.min(100, (energy / maxEnergy) * 100);

  return (
    <div className="game-page relative">
      <GameBackground />

      {backdrop && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('${backdrop}')`,
              filter: "brightness(0.25) saturate(0.6)",
            }}
          />
        </div>
      )}

      <div className="relative flex flex-col h-full" style={{ zIndex: 2 }}>
        <div className="page-layout-header flex-shrink-0">
          <div className="page-layout-header-inner">

            {showPlayerInfo && account ? (
              <div className="pl-player-block">
                <div className="pl-portrait-frame">
                  <img
                    src={portraitPath}
                    alt={account.username}
                    className="pl-portrait-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/portraits/human_male.png";
                    }}
                  />
                </div>
                <div className="pl-player-info">
                  <div className="pl-player-name">
                    {account.username}
                    {account.vipUntil && new Date(account.vipUntil) > new Date() && (
                      <Crown className="pl-vip-icon" />
                    )}
                  </div>
                  <div className="pl-player-rank">{account.rank}</div>
                  <div className="pl-resources">
                    <span className="pl-res pl-res-gold">
                      <Coins className="pl-res-icon" />
                      {formatNumber(account.gold || 0)}
                    </span>
                    <span className="pl-res pl-res-ruby">
                      <Gem className="pl-res-icon" />
                      {formatNumber(account.rubies || 0)}
                    </span>
                    <span className="pl-res pl-res-energy">
                      <Zap className="pl-res-icon" />
                      {energy}/{maxEnergy}
                    </span>
                  </div>
                  <div className="pl-energy-bar-track">
                    <div
                      className="pl-energy-bar-fill"
                      style={{ width: `${energyPct}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="pl-empty-left" />
            )}

            <div className="pl-title-block">
              <div className="pl-title-decorators">
                <span className="pl-title-line" />
                <span className="pl-title-diamond">◆</span>
                <span className="pl-title-line" />
              </div>
              <h1 className="pl-title">
                <span className="pl-title-icon">{zoneIcon}</span>
                {title}
              </h1>
              <div className="pl-title-decorators">
                <span className="pl-title-line" />
                <span className="pl-title-diamond pl-title-diamond-sm">◆</span>
                <span className="pl-title-line" />
              </div>
            </div>

            <div className="pl-nav-block">
              <Button
                className="pl-map-btn"
                onClick={() => navigate("/world-map")}
              >
                <Map className="pl-map-btn-icon" />
                <span>World Map</span>
              </Button>
            </div>

          </div>
          <div className="page-layout-separator" />
        </div>

        <div className="pl-content">
          {children}
        </div>
      </div>
    </div>
  );
}
