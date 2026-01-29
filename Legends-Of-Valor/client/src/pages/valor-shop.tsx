import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Gift, 
  Crown, 
  Gem, 
  Star, 
  Zap, 
  Shield, 
  Sword, 
  ArrowLeft,
  Check,
  Clock,
  TrendingUp,
  Package,
  Coins
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ValorBundle {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  contents: string[];
  icon: React.ReactNode;
  tier: "starter" | "popular" | "premium" | "ultimate" | "legendary";
  featured?: boolean;
  limitedTime?: boolean;
  bestValue?: boolean;
}

const VALOR_BUNDLES: ValorBundle[] = [
  {
    id: "tiny-adventurer",
    name: "Tiny Adventurer",
    price: 0.99,
    description: "Perfect for new heroes just starting their journey",
    contents: ["500 Gold", "1 Training Point", "5 Beak Coins"],
    icon: <Gift className="w-6 h-6" />,
    tier: "starter"
  },
  {
    id: "gold-tp-stack",
    name: "Gold & TP Stack",
    price: 2.99,
    description: "A balanced boost for growing warriors",
    contents: ["2,500 Gold", "5 Training Points", "20 Beak Coins", "1 Soul Gin"],
    icon: <Coins className="w-6 h-6" />,
    tier: "starter"
  },
  {
    id: "adventurers-starter",
    name: "Adventurer's Starter",
    price: 4.99,
    description: "Everything you need to accelerate your progress",
    contents: ["5,000 Gold", "10 Training Points", "50 Beak Coins", "3 Soul Gins", "1 Random Pet Egg"],
    icon: <Package className="w-6 h-6" />,
    tier: "popular",
    featured: true
  },
  {
    id: "warriors-arsenal",
    name: "Warrior's Arsenal",
    price: 7.99,
    description: "Gear up with powerful equipment bonuses",
    contents: ["8,000 Gold", "15 Training Points", "100 Beak Coins", "5 Soul Gins", "1 Super Rare Item Box"],
    icon: <Sword className="w-6 h-6" />,
    tier: "popular"
  },
  {
    id: "champions-loot",
    name: "Champion's Loot",
    price: 9.99,
    originalPrice: 14.99,
    description: "The champion's choice for serious adventurers",
    contents: ["15,000 Gold", "25 Training Points", "200 Beak Coins", "10 Soul Gins", "2 Super Rare Item Boxes", "500 Valor Tokens"],
    icon: <Star className="w-6 h-6" />,
    tier: "popular",
    bestValue: true
  },
  {
    id: "elite-guardian",
    name: "Elite Guardian",
    price: 14.99,
    description: "For those who protect their realm with honor",
    contents: ["25,000 Gold", "40 Training Points", "350 Beak Coins", "15 Soul Gins", "1 X-Tier Item Box", "1,000 Valor Tokens"],
    icon: <Shield className="w-6 h-6" />,
    tier: "premium"
  },
  {
    id: "legends-treasure",
    name: "Legend's Treasure",
    price: 19.99,
    originalPrice: 29.99,
    description: "Treasures worthy of the greatest legends",
    contents: ["50,000 Gold", "75 Training Points", "500 Beak Coins", "25 Soul Gins", "2 X-Tier Item Boxes", "1 Legendary Pet Egg", "2,500 Valor Tokens"],
    icon: <Gem className="w-6 h-6" />,
    tier: "premium"
  },
  {
    id: "mythic-hoard",
    name: "Mythic Hoard",
    price: 29.99,
    description: "A hoard of mythical proportions",
    contents: ["100,000 Gold", "100 Training Points", "750 Beak Coins", "40 Soul Gins", "3 X-Tier Item Boxes", "1 Divine Pet Egg", "5,000 Valor Tokens"],
    icon: <Zap className="w-6 h-6" />,
    tier: "premium",
    limitedTime: true
  },
  {
    id: "valor-hero",
    name: "Valor Hero Bundle",
    price: 49.99,
    originalPrice: 79.99,
    description: "Become the hero your realm deserves",
    contents: ["250,000 Gold", "200 Training Points", "1,500 Beak Coins", "75 Soul Gins", "5 X-Tier Item Boxes", "1 UMR Item Box", "2 Divine Pet Eggs", "10,000 Valor Tokens", "Exclusive Hero Title"],
    icon: <Crown className="w-6 h-6" />,
    tier: "legendary",
    featured: true
  },
  {
    id: "conquerors-legacy",
    name: "Conqueror's Legacy",
    price: 99.99,
    originalPrice: 149.99,
    description: "The ultimate package for true conquerors",
    contents: ["1,000,000 Gold", "500 Training Points", "5,000 Beak Coins", "200 Soul Gins", "10 X-Tier Item Boxes", "3 UMR Item Boxes", "1 SSUMR Item Box", "5 Divine Pet Eggs", "50,000 Valor Tokens", "Exclusive Conqueror Title", "Unique Skin Unlock", "VIP Status (30 days)"],
    icon: <Sparkles className="w-6 h-6" />,
    tier: "ultimate",
    bestValue: true
  },
  {
    id: "season-pass",
    name: "Season Battle Pass",
    price: 12.99,
    description: "Unlock exclusive rewards throughout the season",
    contents: ["50 Season Levels", "Exclusive Season Skin", "Weekly Bonus Chests", "Double XP Weekends", "3,000 Valor Tokens"],
    icon: <TrendingUp className="w-6 h-6" />,
    tier: "popular",
    limitedTime: true
  },
  {
    id: "pet-collectors",
    name: "Pet Collector's Pack",
    price: 24.99,
    description: "For those who love their companions",
    contents: ["5 Random Pet Eggs", "2 Legendary Pet Eggs", "1 Divine Pet Egg", "Pet Food x100", "Pet Training Scrolls x50", "2,500 Beak Coins"],
    icon: <Gift className="w-6 h-6" />,
    tier: "premium"
  },
  {
    id: "guild-supporter",
    name: "Guild Supporter Pack",
    price: 34.99,
    description: "Strengthen your guild with these resources",
    contents: ["Guild Bank Deposit: 500,000 Gold", "Guild XP Boost (7 days)", "Guild Banner Unlock", "20 Guild Dungeon Keys", "10,000 Valor Tokens"],
    icon: <Shield className="w-6 h-6" />,
    tier: "legendary"
  },
  {
    id: "founders-pack",
    name: "Founder's Exclusive",
    price: 199.99,
    description: "Limited edition pack for true supporters",
    contents: ["5,000,000 Gold", "1,000 Training Points", "10,000 Beak Coins", "500 Soul Gins", "Full X-Tier Set", "Full UMR Set", "1 SSUMR Divine Weapon", "Founder's Title (Permanent)", "Founder's Mount", "Founder's Pet", "VIP Status (Lifetime)", "100,000 Valor Tokens"],
    icon: <Crown className="w-6 h-6" />,
    tier: "ultimate",
    limitedTime: true
  }
];

const tierStyles = {
  starter: "from-slate-500 to-slate-600 border-slate-400",
  popular: "from-blue-500 to-indigo-600 border-blue-400",
  premium: "from-purple-500 to-pink-600 border-purple-400",
  legendary: "from-yellow-500 to-orange-600 border-yellow-400",
  ultimate: "from-red-500 to-rose-600 border-red-400 animate-pulse-slow"
};

const tierLabels = {
  starter: "Starter",
  popular: "Popular",
  premium: "Premium",
  legendary: "Legendary",
  ultimate: "Ultimate"
};

export default function ValorShop() {
  const [, navigate] = useLocation();
  const { account, refetchAccount } = useGame();
  const { toast } = useToast();
  const [selectedBundle, setSelectedBundle] = useState<ValorBundle | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = (bundle: ValorBundle) => {
    setSelectedBundle(bundle);
  };

  const confirmPurchase = async () => {
    if (!selectedBundle || !account) return;
    
    const valorCost = Math.ceil(selectedBundle.price);
    const currentValor = account.valorTokens || 0;
    
    if (currentValor < valorCost) {
      toast({
        title: "Insufficient $Valor",
        description: `You need ${valorCost} $Valor tokens but only have ${currentValor}. Get more from the admin!`,
        variant: "destructive"
      });
      return;
    }
    
    setIsPurchasing(true);
    
    try {
      const bundleIdMap: Record<string, string> = {
        "tiny-adventurer": "tiny_adventurer",
        "gold-tp-stack": "gold_tp_stack",
        "adventurers-starter": "adventurer_starter",
        "warriors-arsenal": "champion_loot",
        "champions-loot": "champion_loot",
        "elite-guardian": "legend_treasure",
        "legends-treasure": "legend_treasure",
        "mythic-hoard": "valor_hero",
        "valor-hero": "valor_hero",
        "conquerors-legacy": "conqueror_legacy",
        "season-pass": "adventurer_starter",
        "collectors-vault": "conqueror_legacy",
        "dragon-slayer": "valor_hero",
        "divine-ascension": "conqueror_legacy",
      };
      
      const backendBundleId = bundleIdMap[selectedBundle.id] || selectedBundle.id.replace(/-/g, "_");
      
      const res = await fetch("/api/valor-shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          bundleId: backendBundleId
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Purchase Successful!",
          description: `You purchased ${data.bundle}! Rewards have been added to your account.`,
        });
        refetchAccount?.();
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || "Something went wrong",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: "Failed to process purchase. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPurchasing(false);
      setSelectedBundle(null);
    }
  };

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const featuredBundles = VALOR_BUNDLES.filter(b => b.featured);
  const regularBundles = VALOR_BUNDLES.filter(b => !b.featured);

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/shop.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70" />
      
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-red-500/30 bg-black/80 backdrop-blur">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/world-map")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to World
                </Button>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-red-400" />
                  <h1 className="font-serif text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    $Valor Shop
                  </h1>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{account.username}</p>
                <p className="text-sm font-medium text-yellow-400">{account.valorTokens?.toLocaleString() || 0} Valor Tokens</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-white mb-2">Premium Bundles</h2>
            <p className="text-muted-foreground">Power up your adventure with exclusive value packs</p>
          </div>

          {featuredBundles.length > 0 && (
            <div className="mb-12">
              <h3 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" />
                Featured Bundles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featuredBundles.map((bundle) => (
                  <Card 
                    key={bundle.id}
                    className={`relative overflow-hidden border-2 bg-gradient-to-br ${tierStyles[bundle.tier]} bg-opacity-20 hover:scale-[1.02] transition-transform cursor-pointer`}
                    onClick={() => handlePurchase(bundle)}
                  >
                    {bundle.bestValue && (
                      <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        BEST VALUE
                      </div>
                    )}
                    {bundle.limitedTime && (
                      <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg flex items-center gap-1">
                        <Clock className="w-3 h-3" /> LIMITED
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${tierStyles[bundle.tier]}`}>
                            {bundle.icon}
                          </div>
                          <div>
                            <CardTitle className="text-xl text-white">{bundle.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">{tierLabels[bundle.tier]}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          {bundle.originalPrice && (
                            <p className="text-sm text-muted-foreground line-through">${bundle.originalPrice}</p>
                          )}
                          <p className="text-2xl font-bold text-green-400">${bundle.price}</p>
                        </div>
                      </div>
                      <CardDescription className="text-slate-300 mt-2">{bundle.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {bundle.contents.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-200">
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <Button className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
                        Purchase Now
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold text-white mb-4">All Bundles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regularBundles.map((bundle) => (
                <Card 
                  key={bundle.id}
                  className={`relative overflow-hidden border bg-black/50 hover:bg-black/70 hover:scale-[1.02] transition-all cursor-pointer`}
                  onClick={() => handlePurchase(bundle)}
                >
                  {bundle.bestValue && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-bl-lg">
                      BEST VALUE
                    </div>
                  )}
                  {bundle.limitedTime && (
                    <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-br-lg flex items-center gap-1">
                      <Clock className="w-3 h-3" /> LIMITED
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${tierStyles[bundle.tier]}`}>
                        {bundle.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base text-white">{bundle.name}</CardTitle>
                        <Badge variant="outline" className="text-xs mt-0.5">{tierLabels[bundle.tier]}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{bundle.description}</p>
                    <div className="space-y-1 mb-3 max-h-24 overflow-y-auto">
                      {bundle.contents.slice(0, 4).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs text-slate-300">
                          <Check className="w-3 h-3 text-green-400 shrink-0" />
                          <span className="truncate">{item}</span>
                        </div>
                      ))}
                      {bundle.contents.length > 4 && (
                        <p className="text-xs text-muted-foreground">+{bundle.contents.length - 4} more items</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {bundle.originalPrice && (
                        <p className="text-xs text-muted-foreground line-through">${bundle.originalPrice}</p>
                      )}
                      <p className="text-lg font-bold text-green-400">${bundle.price}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>

        <Dialog open={!!selectedBundle} onOpenChange={() => setSelectedBundle(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Confirm Purchase
              </DialogTitle>
              <DialogDescription>
                You're about to purchase {selectedBundle?.name}
              </DialogDescription>
            </DialogHeader>
            
            {selectedBundle && (
              <div className="py-4">
                <div className={`p-4 rounded-lg bg-gradient-to-br ${tierStyles[selectedBundle.tier]} bg-opacity-20 mb-4`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${tierStyles[selectedBundle.tier]}`}>
                      {selectedBundle.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{selectedBundle.name}</h3>
                      <p className="text-2xl font-bold text-green-400">${selectedBundle.price}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {selectedBundle.contents.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">Your $Valor Balance:</span>
                  <span className="font-bold text-red-400">{account?.valorTokens?.toLocaleString() || 0} $Valor</span>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  $Valor tokens will be deducted from your account.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedBundle(null)} disabled={isPurchasing}>
                Cancel
              </Button>
              <Button 
                onClick={confirmPurchase}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                disabled={isPurchasing || (account?.valorTokens || 0) < Math.ceil(selectedBundle?.price || 0)}
              >
                {isPurchasing ? "Processing..." : `Purchase for ${Math.ceil(selectedBundle?.price || 0)} $Valor`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
