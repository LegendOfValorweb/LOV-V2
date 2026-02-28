import { ReactNode } from "react";

interface GameViewportProps {
  children: ReactNode;
}

export function GameViewport({ children }: GameViewportProps) {
  return (
    <div className="game-viewport-container">
      <div className="game-viewport">
        {children}
      </div>
    </div>
  );
}
