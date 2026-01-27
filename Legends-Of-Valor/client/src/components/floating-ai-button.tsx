import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FloatingAIButton() {
  const [location, navigate] = useLocation();

  if (location === "/" || location === "/ai-chat") {
    return null;
  }

  return (
    <Button
      onClick={() => navigate("/ai-chat")}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30 z-50 p-0"
      aria-label="AI Game Master"
    >
      <MessageCircle className="w-6 h-6 text-white" />
    </Button>
  );
}
