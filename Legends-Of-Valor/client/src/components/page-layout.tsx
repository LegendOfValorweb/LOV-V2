import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Map, Crown, Coins, Heart } from "lucide-react";
import { useGame } from "@/lib/game-context";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  backdrop?: string;
  showPlayerInfo?: boolean;
}

export function PageLayout({ children, title, backdrop, showPlayerInfo = true }: PageLayoutProps) {
  const [, navigate] = useLocation();
  const { account } = useGame();

  const getPortraitPath = () => {
    if (!account) return '/portraits/human_male.png';
    if (account.portrait && account.portrait.includes('/')) {
      return account.portrait;
    }
    if (account.portrait) {
      return `/portraits/${account.portrait}.png`;
    }
    if (account.race && account.gender) {
      return `/portraits/${account.race}_${account.gender}.png`;
    }
    return '/portraits/human_male.png';
  };
  const portraitPath = getPortraitPath();

  return (
    <div className="min-h-screen relative">
      {backdrop && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backdrop}')` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      
      <div className={`relative z-10 min-h-screen ${backdrop ? '' : 'bg-background'}`}>
        <div className="p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
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
                      <div className="font-serif font-bold text-sm">{account.username}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-yellow-400" />
                          <span>{(account.gold || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-red-400 font-bold">$V</span>
                          <span className="text-red-300">{(account.valorTokens || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
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

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
