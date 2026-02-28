import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Map, Crown, Coins, Heart, Zap } from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useState, useEffect } from "react";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  backdrop?: string;
  showPlayerInfo?: boolean;
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
    // Check for equipped character skin first
    if (account.equippedCharacterSkin && account.equippedCharacterSkin !== 'default') {
      return `/skins/character/${account.equippedCharacterSkin}.png`;
    }
    // Check portrait field (may contain skin path or race_gender)
    if (account.portrait) {
      if (account.portrait.startsWith('skins/')) {
        return `/${account.portrait}.png`;
      }
      if (account.portrait.includes('/')) {
        return account.portrait;
      }
      return `/portraits/${account.portrait}.png`;
    }
    // Default to race/gender portrait
    if (account.race && account.gender) {
      return `/portraits/${account.race}_${account.gender}.png`;
    }
    return '/portraits/human_male.png';
  };
  const portraitPath = getPortraitPath();

  return (
    <div className="game-page relative">
      {backdrop && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backdrop}')` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      
      <div className={`relative z-10 h-full flex flex-col ${backdrop ? '' : 'bg-background'}`}>
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center justify-between">
            {showPlayerInfo && account ? (
              <Card className="bg-card/90 backdrop-blur">
                <CardContent className="p-2 flex items-center gap-3">
                  <img 
                    src={portraitPath}
                    alt={account.username}
                    className="w-10 h-10 rounded-lg border border-primary object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/portraits/human_male.png";
                    }}
                  />
                  <div>
                    <div className="font-serif font-bold text-sm flex items-center gap-1 rpg-gold-text">
                      {account.username}
                      {account.vipUntil && new Date(account.vipUntil) > new Date() && (
                        <Crown className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground rpg-stat-number">
                      <div className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-yellow-400" />
                        <span>{(account.gold || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-red-400 font-bold">$V</span>
                        <span className="text-red-300">{(account.valorTokens || 0).toLocaleString()}</span>
                      </div>
                      {energyData && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          <span className="text-cyan-300">{energyData.energy}/{energyData.maxEnergy}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <h1 className="rpg-title text-2xl font-bold rpg-gold-text">{title}</h1>
            )}

            <Button 
              variant="outline" 
              className="bg-card/90 backdrop-blur"
              onClick={() => navigate("/world-map")}
            >
              <Map className="w-4 h-4 mr-2" />
              World Map
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
