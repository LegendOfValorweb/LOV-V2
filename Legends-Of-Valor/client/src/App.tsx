import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/lib/game-context";
import AudioPlayer from "@/components/audio-player";
import FloatingAIButton from "@/components/floating-ai-button";
import { GameHUD } from "@/components/game-hud";
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
import WorldMap from "@/pages/world-map";
import Base from "@/pages/base";
import PetArena from "@/pages/pet-arena";
import Achievements from "@/pages/achievements";
import ValorShop from "@/pages/valor-shop";
import AuctionHouse from "@/pages/auction-house";
import CosmeticsShop from "@/pages/cosmetics-shop";
import Tournaments from "@/pages/tournaments";
import PetShop from "@/pages/pet-shop";
import Mining from "@/pages/mining";
import RubyMines from "@/pages/ruby-mines";
import HellZone from "@/pages/hell-zone";
import Valorpedia from "@/pages/valorpedia";
import Reputation from "@/pages/reputation";
import BlackMarket from "@/pages/black-market";
import NotFound from "@/pages/not-found";
import { MobileLandscapePrompt } from "@/components/mobile-landscape-prompt";
import { AppLoadingWrapper } from "@/components/app-loading-wrapper";
import { GameViewport } from "@/components/game-viewport";
import { WeatherOverlay } from "@/components/weather-overlay";

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
      <Route path="/world-map" component={WorldMap} />
      <Route path="/base" component={Base} />
      <Route path="/pet-arena" component={PetArena} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/valor-shop" component={ValorShop} />
      <Route path="/auction-house" component={AuctionHouse} />
      <Route path="/cosmetics-shop" component={CosmeticsShop} />
      <Route path="/tournaments" component={Tournaments} />
      <Route path="/pet-shop" component={PetShop} />
      <Route path="/mining" component={Mining} />
      <Route path="/ruby-mines" component={RubyMines} />
      <Route path="/hell-zone" component={HellZone} />
      <Route path="/valorpedia" component={Valorpedia} />
      <Route path="/reputation" component={Reputation} />
      <Route path="/black-market" component={BlackMarket} />
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
          <MobileLandscapePrompt />
          <GameViewport>
            <AppLoadingWrapper>
              <Toaster />
              <AudioPlayer />
              <GameHUD />
              <FloatingAIButton />
              <WeatherOverlay />
              <Router />
            </AppLoadingWrapper>
          </GameViewport>
        </GameProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
