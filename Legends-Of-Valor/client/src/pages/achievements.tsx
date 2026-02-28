import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Shield, Map, Sword, Castle, Coins, Users, Compass, Package, Crown, Tag } from "lucide-react";

export default function Achievements() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  const [selectedCategory, setSelectedCategory] = useState("Combat");

  if (!account) return null;

  return (
    <div className="game-page-scroll h-full bg-gradient-to-br from-background via-background to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="font-serif text-3xl font-bold">Achievements</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/world-map")}><Map className="w-4 h-4 mr-2" />World Map</Button>
        </div>
        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>
          <TabsContent value="achievements">
            <Card className="bg-zinc-900/80 border-amber-900/50"><CardHeader><CardTitle>Your Progress</CardTitle></CardHeader><CardContent><p>Track your legendary feats here.</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
