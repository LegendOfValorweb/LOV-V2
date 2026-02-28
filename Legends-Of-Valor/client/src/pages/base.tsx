import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Castle, Package, Dumbbell, Shield, Sparkles, Home, Palette, Swords, Users, Crown } from "lucide-react";
import { useGame } from "@/lib/game-context";
import { useToast } from "@/hooks/use-toast";
import { ZoneScene } from "@/components/zone-scene";

export default function Base() {
  const [, navigate] = useLocation();
  const { account } = useGame();
  
  if (!account) return null;

  return (
    <div className="game-page-scroll">
      <ZoneScene zoneName="Home Base" backdrop="/backdrops/base.png" ambientClass="zone-ambient-shop" overlayOpacity={0.35}>
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-serif text-amber-400">Your Base</h1>
            <Button variant="outline" size="sm" onClick={() => navigate("/world-map")}>World Map</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-zinc-900/80 border-amber-900/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-amber-400"/>Overview</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-zinc-400">Welcome to your stronghold, {account.username}.</p></CardContent>
            </Card>
          </div>
        </div>
      </ZoneScene>
    </div>
  );
}
