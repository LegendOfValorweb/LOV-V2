import { useState, useEffect } from "react";
import { RotateCcw, Smartphone } from "lucide-react";

export function MobileLandscapePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
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

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="relative">
          <Smartphone className="w-24 h-24 text-amber-400 mx-auto animate-pulse" />
          <RotateCcw className="w-12 h-12 text-amber-300 absolute -right-4 top-1/2 -translate-y-1/2 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        
        <h1 className="text-3xl font-bold text-amber-400 font-serif">
          Rotate Your Device
        </h1>
        
        <p className="text-lg text-slate-300 max-w-xs mx-auto">
          Legends of Valor is best experienced in <span className="text-amber-400 font-semibold">landscape mode</span>
        </p>
        
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
          <div className="w-16 h-10 border-2 border-amber-400/50 rounded-lg flex items-center justify-center">
            <div className="w-10 h-6 bg-amber-400/30 rounded" />
          </div>
          <span>Turn your phone sideways</span>
        </div>
        
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-600/30 rounded-full text-amber-300 text-sm">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            Waiting for landscape orientation...
          </div>
        </div>
      </div>
    </div>
  );
}
