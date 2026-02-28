import { ReactNode } from "react";
import { useLocation } from "wouter";

interface GameViewportProps {
  children: ReactNode;
}

export function GameViewport({ children }: GameViewportProps) {
  const [location] = useLocation();
  const isLanding = location === "/";

  return (
    <div className="game-viewport-container">
      <div className={isLanding ? "w-full h-full relative overflow-hidden" : "game-viewport"}>
        {children}
      </div>
    </div>
  );
}
