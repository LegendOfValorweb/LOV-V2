import { useState } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/lib/game-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  User, 
  Home,
  Dog,
  Bird,
  ArrowLeft,
  Check,
  Crown,
  Gem,
  Ticket
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CosmeticItem {
  id: string;
  name: string;
  rarity: string;
  skinTicketCost: number;
  rubyPrice: number;
}

interface CosmeticsShop {
  character: CosmeticItem[];
  pet: CosmeticItem[];
  bird: CosmeticItem[];
  base: CosmeticItem[];
}

const rarityColors: Record<string, string> = {
  common: "bg-gray-500/20 border-gray-500 text-gray-300",
  rare: "bg-blue-500/20 border-blue-500 text-blue-300",
  epic: "bg-purple-500/20 border-purple-500 text-purple-300",
  legendary: "bg-yellow-500/20 border-yellow-500 text-yellow-300",
  mythic: "bg-red-500/20 border-red-500 text-red-300",
};

const categoryIcons: Record<string, React.ReactNode> = {
  character: <User className="w-5 h-5" />,
  pet: <Dog className="w-5 h-5" />,
  bird: <Bird className="w-5 h-5" />,
  base: <Home className="w-5 h-5" />,
};

export default function CosmeticsShop() {
  const [, navigate] = useLocation();
  const { account, refetchAccount } = useGame();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("character");
  const [selectedItem, setSelectedItem] = useState<{ item: CosmeticItem; category: string } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const { data: shopData } = useQuery<{ shop: CosmeticsShop }>({
    queryKey: ["/api/cosmetics-shop"],
  });

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const shop = shopData?.shop;
  const ownedSkins = account.unlockedSkins || [];

  const handlePurchase = async (paymentType: "tickets" | "rubies") => {
    if (!selectedItem) return;
    
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/cosmetics-shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account?.id,
          skinId: selectedItem.item.id,
          category: selectedItem.category,
          paymentType
        })
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Purchase Successful!",
          description: `You now own ${selectedItem.item.name}!`,
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
        description: "Failed to process purchase",
        variant: "destructive"
      });
    } finally {
      setIsPurchasing(false);
      setSelectedItem(null);
    }
  };

  const handleEquip = async (skinId: string, category: string) => {
    try {
      const res = await fetch("/api/cosmetics/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account?.id, skinId, category })
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Equipped!", description: `Skin equipped successfully` });
        refetchAccount?.();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Failed", description: "Could not equip skin", variant: "destructive" });
    }
  };

  const currentItems = shop ? shop[activeCategory as keyof CosmeticsShop] : [];

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backdrops/shop.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />
      
      <div className="relative z-10">
        <header className="border-b border-border/50 bg-black/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h1 className="text-2xl font-serif font-bold">Cosmetics Shop</h1>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Ticket className="w-4 h-4 text-green-400" />
                  <span>{account.skinTickets || 0} Tickets</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Ticket className="w-4 h-4 text-blue-400" />
                  <span>{account.rareSkinTickets || 0} Rare</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Ticket className="w-4 h-4 text-purple-400" />
                  <span>{account.epicSkinTickets || 0} Epic</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg">
                  <Gem className="w-4 h-4 text-pink-400" />
                  <span>{(account.rubies || 0).toLocaleString()} Rubies</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid grid-cols-4 w-full max-w-md mx-auto mb-8 bg-black/50">
              <TabsTrigger value="character" className="flex items-center gap-2">
                <User className="w-4 h-4" /> Character
              </TabsTrigger>
              <TabsTrigger value="pet" className="flex items-center gap-2">
                <Dog className="w-4 h-4" /> Pet
              </TabsTrigger>
              <TabsTrigger value="bird" className="flex items-center gap-2">
                <Bird className="w-4 h-4" /> Bird
              </TabsTrigger>
              <TabsTrigger value="base" className="flex items-center gap-2">
                <Home className="w-4 h-4" /> Base
              </TabsTrigger>
            </TabsList>

            {["character", "pet", "bird", "base"].map(category => (
              <TabsContent key={category} value={category}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(shop?.[category as keyof CosmeticsShop] || []).map((item) => {
                    const fullId = `${category}_${item.id}`;
                    const isOwned = ownedSkins.includes(fullId);

                    return (
                      <Card 
                        key={item.id}
                        className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${rarityColors[item.rarity]} ${isOwned ? 'ring-2 ring-green-500' : ''}`}
                        onClick={() => !isOwned && setSelectedItem({ item, category })}
                      >
                        {isOwned && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            {categoryIcons[category]}
                            <CardTitle className="text-base">{item.name}</CardTitle>
                          </div>
                          <Badge className={rarityColors[item.rarity]}>
                            {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          {isOwned ? (
                            <Button 
                              size="sm" 
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEquip(item.id, category);
                              }}
                            >
                              Equip
                            </Button>
                          ) : (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Ticket</span>
                                <span>1 {item.rarity} ticket</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1"><Gem className="w-3 h-3" /> Rubies</span>
                                <span>{item.rubyPrice.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </main>

        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Purchase {selectedItem?.item.name}
              </DialogTitle>
              <DialogDescription>
                Choose your payment method
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="py-4 space-y-4">
                <div className={`p-4 rounded-lg ${rarityColors[selectedItem.item.rarity]}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedItem.item.name}</span>
                    <Badge>{selectedItem.item.rarity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.category.charAt(0).toUpperCase() + selectedItem.category.slice(1)} skin
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handlePurchase("tickets")}
                    disabled={isPurchasing}
                    className="flex flex-col h-auto py-4 bg-gradient-to-br from-green-600 to-green-800"
                  >
                    <Ticket className="w-6 h-6 mb-1" />
                    <span>1 {selectedItem.item.rarity} Ticket</span>
                  </Button>
                  <Button
                    onClick={() => handlePurchase("rubies")}
                    disabled={isPurchasing || (account.rubies || 0) < selectedItem.item.rubyPrice}
                    className="flex flex-col h-auto py-4 bg-gradient-to-br from-pink-600 to-purple-800"
                  >
                    <Gem className="w-6 h-6 mb-1" />
                    <span>{selectedItem.item.rubyPrice.toLocaleString()} Rubies</span>
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)} disabled={isPurchasing}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
