import { useState, useEffect } from "react";
import { RotateCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileLandscapePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedKey = 'lov_landscape_dismissed';
    const wasDismissed = sessionStorage.getItem(dismissedKey);
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const checkOrientation = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('lov_landscape_dismissed', 'true');
    setDismissed(true);
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-gradient-to-r from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4 shadow-xl">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 relative">
          <Smartphone className="w-10 h-10 text-amber-400" />
          <RotateCcw className="w-5 h-5 text-amber-300 absolute -right-1 top-1/2 -translate-y-1/2 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-amber-400 font-semibold text-sm">
            Rotate for best experience
          </h3>
          <p className="text-slate-300 text-xs mt-0.5">
            Landscape mode is recommended for this game
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0 border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
