import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/lib/game-context";
import AudioPlayer from "@/components/audio-player";
import FloatingAIButton from "@/components/floating-ai-button";
import Landing from "@/pages/landing";
import Shop from "@/pages/shop";
import Inventory from "@/pages/inventory";
import Events from "@/pages/events";
import Challenges from "@/pages/challenges";
import Pets from "@/pages/pets";
import NpcBattle from "@/pages/npc-battle";
import Leaderboard from "@/pages/leaderboard";
import Quests from "@/pages/quests";
import Guild from "@/pages/guild";
import Skills from "@/pages/skills";
import Trading from "@/pages/trading";
import Admin from "@/pages/admin";
import AIChat from "@/pages/ai-chat";
import Birds from "@/pages/birds";
import Fishing from "@/pages/fishing";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/shop" component={Shop} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/events" component={Events} />
      <Route path="/challenges" component={Challenges} />
      <Route path="/pets" component={Pets} />
      <Route path="/npc-battle" component={NpcBattle} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/quests" component={Quests} />
      <Route path="/guild" component={Guild} />
      <Route path="/skills" component={Skills} />
      <Route path="/trading" component={Trading} />
      <Route path="/ai-chat" component={AIChat} />
      <Route path="/birds" component={Birds} />
      <Route path="/fishing" component={Fishing} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GameProvider>
          <Toaster />
          <AudioPlayer />
          <FloatingAIButton />
          <Router />
        </GameProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
