import { ReactNode } from "react";
import { useLocation } from "wouter";
import GameBackground from "@/components/game-background";

interface GameViewportProps {
  children: ReactNode;
}

export function GameViewport({ children }: GameViewportProps) {
  const [location] = useLocation();
  const isLanding = location === "/";

  return (
    <div className="game-viewport-container">
      <div className={isLanding ? "w-full h-full relative overflow-y-auto overflow-x-hidden" : "game-viewport"}>
        {!isLanding && <GameBackground />}
        {children}
      </div>
    </div>
  );
}
