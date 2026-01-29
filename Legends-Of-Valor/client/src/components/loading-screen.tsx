import { Sword, Shield, Sparkles } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[9998] bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 flex flex-col items-center justify-center">
      <div className="text-center space-y-8">
        <div className="relative">
          <div className="flex items-center justify-center gap-4">
            <Sword className="w-12 h-12 text-amber-400 animate-pulse" style={{ animationDelay: '0s' }} />
            <Shield className="w-16 h-16 text-amber-500 animate-bounce" style={{ animationDuration: '1.5s' }} />
            <Sword className="w-12 h-12 text-amber-400 animate-pulse transform scale-x-[-1]" style={{ animationDelay: '0.5s' }} />
          </div>
          <Sparkles className="w-8 h-8 text-amber-300 absolute -top-4 left-1/2 -translate-x-1/2 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-400 font-serif tracking-wide">
            Legends of Valor
          </h2>
          
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
          
          <p className="text-slate-400 text-sm">{message}</p>
        </div>
        
        <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 rounded-full animate-loading-bar" />
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 0; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
