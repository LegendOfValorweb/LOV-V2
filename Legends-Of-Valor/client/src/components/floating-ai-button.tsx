import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FloatingAIButton() {
  const [location, navigate] = useLocation();

  if (location === "/" || location === "/ai-chat" || location === "/admin") {
    return null;
  }

  return (
    <Button
      onClick={() => navigate("/ai-chat")}
      className="absolute bottom-20 right-4 w-11 h-11 rounded-full z-50 p-0 border-2 border-purple-500/50 shadow-[0_0_16px_rgba(168,85,247,0.3)] hover:shadow-[0_0_24px_rgba(168,85,247,0.5)]"
      aria-label="AI Game Master"
    >
      <MessageCircle className="w-6 h-6 text-white" />
    </Button>
  );
}
