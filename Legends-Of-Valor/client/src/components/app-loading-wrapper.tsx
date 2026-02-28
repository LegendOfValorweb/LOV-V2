import { ReactNode } from "react";
import { useGame } from "@/lib/game-context";
import { LoadingScreen } from "./loading-screen";

interface AppLoadingWrapperProps {
  children: ReactNode;
}

export function AppLoadingWrapper({ children }: AppLoadingWrapperProps) {
  const { isLoading } = useGame();

  if (isLoading) {
    return <LoadingScreen message="Preparing your adventure..." />;
  }

  return <div className="relative w-full h-full">{children}</div>;
}
