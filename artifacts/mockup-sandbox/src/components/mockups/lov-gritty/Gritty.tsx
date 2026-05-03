import React from "react";
import { Shield, Sword, Skull, Crown, ChevronRight, Gem, Flame, ShieldAlert } from "lucide-react";

export function Gritty() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#b3b3b3] selection:bg-[#4a3b2c] selection:text-[#e8dcc4] flex flex-col font-sans overflow-x-hidden">
      {/* Import Cinzel Font */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;800&family=Inter:wght@300;400;500&display=swap');
        
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-cinzel-dec { font-family: 'Cinzel Decorative', serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        
        .gritty-texture {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }

        .gold-gradient-text {
          background: linear-gradient(to bottom, #d4c4a8, #8a7350);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .border-tarnished {
          border-color: #3e3832;
        }

        .bg-tarnished {
          background-color: #1a1816;
        }
        
        .text-tarnished {
          color: #a89f91;
        }
      `}} />

      {/* Global Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none gritty-texture z-50 opacity-40 mix-blend-overlay"></div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 border-b border-tarnished bg-[#080808]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword className="w-6 h-6 text-[#8a7350]" />
            <h1 className="font-cinzel-dec text-xl tracking-widest gold-gradient-text font-bold">LEGENDS OF VALOR</h1>
            <Sword className="w-6 h-6 text-[#8a7350] scale-x-[-1]" />
          </div>
          <div className="hidden md:flex items-center gap-8 font-cinzel text-sm tracking-widest text-tarnished">
            <a href="#" className="hover:text-[#d4c4a8] transition-colors">The World</a>
            <a href="#" className="hover:text-[#d4c4a8] transition-colors">Races</a>
            <a href="#" className="hover:text-[#d4c4a8] transition-colors">Compendium</a>
            <button className="px-5 py-2 border border-[#8a7350] text-[#d4c4a8] hover:bg-[#8a7350]/20 transition-all uppercase tracking-widest">
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20 border-b border-tarnished overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/gritty-bg.png" 
            alt="Dark fantasy landscape" 
            className="w-full h-full object-cover object-center opacity-40 grayscale-[0.3] sepia-[0.2]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl px-6 flex flex-col items-center">
          <div className="w-px h-24 bg-gradient-to-b from-transparent to-[#8a7350] mb-8" />
          <h2 className="font-cinzel-dec text-5xl md:text-7xl font-bold tracking-tight gold-gradient-text mb-6 drop-shadow-2xl">
            EMBRACE THE ASH
          </h2>
          <p className="font-body text-lg md:text-xl text-[#8b8b8b] mb-12 max-w-2xl leading-relaxed font-light">
            A mature dark-fantasy RPG. 14 races. 10,000 floors of the Mystic Tower. No heroes, only survivors. Prepare for unforgiving turn-based combat.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <button className="group relative px-8 py-4 bg-[#1a1a1a] border border-[#8a7350] overflow-hidden flex items-center gap-3">
              <div className="absolute inset-0 bg-[#8a7350] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
              <span className="relative z-10 font-cinzel tracking-widest text-[#d4c4a8] group-hover:text-[#0a0a0a] font-bold transition-colors">
                Begin Your Journey
              </span>
              <ChevronRight className="relative z-10 w-5 h-5 text-[#8a7350] group-hover:text-[#0a0a0a] transition-colors" />
            </button>
            <button className="px-8 py-4 border border-tarnished text-tarnished hover:text-[#d4c4a8] hover:border-[#5a5042] font-cinzel tracking-widest transition-all">
              Admin Login
            </button>
          </div>
          <div className="w-px h-24 bg-gradient-to-t from-transparent to-[#8a7350] mt-16" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#0a0a0a] relative border-b border-tarnished">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Skull className="w-8 h-8 text-[#8a7350]" />}
              title="14 Races"
              desc="From accursed Undead to noble Celestials, choose your lineage carefully."
            />
            <FeatureCard 
              icon={<Crown className="w-8 h-8 text-[#8a7350]" />}
              title="15 Ranks"
              desc="Ascend through brutal trials to claim the ultimate title of legend."
            />
            <FeatureCard 
              icon={<Gem className="w-8 h-8 text-[#8a7350]" />}
              title="Epic Loot"
              desc="Scavenge tarnished ruins for ancient artifacts and forgotten weapons."
            />
            <FeatureCard 
              icon={<Shield className="w-8 h-8 text-[#8a7350]" />}
              title="Pets & Guilds"
              desc="Forge uneasy alliances and bind dark creatures to your will."
            />
          </div>
        </div>
      </section>

      {/* UI Preview Section */}
      <section className="py-32 relative bg-[#0d0c0b]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="font-cinzel text-3xl text-[#d4c4a8] tracking-widest">The Tools of Survival</h3>
            <div className="h-px w-32 bg-[#8a7350]/50 mx-auto mt-6" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* Stat Panel */}
            <div className="bg-[#121110] border border-[#2a2622] p-6 shadow-2xl relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#8a7350]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#8a7350]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#8a7350]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#8a7350]" />
              
              <div className="flex items-center gap-4 mb-8 border-b border-[#2a2622] pb-4">
                <div className="w-16 h-16 bg-[#1a1816] border border-[#3e3832] flex items-center justify-center">
                  <Skull className="w-8 h-8 text-[#666]" />
                </div>
                <div>
                  <h4 className="font-cinzel text-xl text-[#d4c4a8]">Tarnished One</h4>
                  <p className="font-body text-sm text-[#8b8b8b]">Level 42 • Vagabond</p>
                </div>
              </div>

              <div className="space-y-5">
                <StatBar label="Strength (STR)" value={78} color="bg-[#8a3f35]" />
                <StatBar label="Defense (DEF)" value={65} color="bg-[#5a5c4f]" />
                <StatBar label="Speed (SPD)" value={45} color="bg-[#4a5c68]" />
                <StatBar label="Intelligence (INT)" value={20} color="bg-[#4d405a]" />
              </div>
            </div>

            {/* Item Card */}
            <div className="bg-[#121110] border border-[#2a2622] p-1 shadow-2xl">
              <div className="border border-[#3e3832] p-6 h-full flex flex-col relative bg-gradient-to-b from-[#1a1816] to-[#0a0a0a]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-cinzel text-lg text-[#b8860b] font-bold">Moonlight Greatsword</h4>
                    <p className="font-body text-xs text-[#b8860b]/70 tracking-widest uppercase mt-1">Mythic Weapon</p>
                  </div>
                  <Sword className="w-6 h-6 text-[#b8860b]" />
                </div>
                
                <div className="aspect-[2/1] bg-[#080808] border border-[#2a2622] mb-6 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#b8860b]/5 opacity-50" />
                  <Flame className="w-12 h-12 text-[#b8860b]/40" />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#0f0e0d] p-3 border border-[#2a2622]">
                    <span className="font-body text-xs text-[#666] block mb-1">Attack Rating</span>
                    <span className="font-cinzel text-[#d4c4a8] text-lg">342</span>
                  </div>
                  <div className="bg-[#0f0e0d] p-3 border border-[#2a2622]">
                    <span className="font-body text-xs text-[#666] block mb-1">Durability</span>
                    <span className="font-cinzel text-[#d4c4a8] text-lg">45/100</span>
                  </div>
                </div>

                <p className="font-body text-sm text-[#8b8b8b] italic leading-relaxed mb-6 flex-grow">
                  "A legendary sword bathed in pale moonlight. It is said that only those who have stared into the abyss may safely wield its power."
                </p>

                <button className="w-full py-3 bg-[#1a1a1a] border border-[#3e3832] font-cinzel text-[#a89f91] hover:text-[#d4c4a8] hover:border-[#8a7350] transition-colors text-sm tracking-widest">
                  Equip Item
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-tarnished py-12 bg-[#050505] text-center">
        <div className="flex justify-center items-center gap-2 mb-6 opacity-50">
          <Sword className="w-4 h-4" />
          <span className="font-cinzel text-sm tracking-widest">LEGENDS OF VALOR</span>
          <Sword className="w-4 h-4 scale-x-[-1]" />
        </div>
        <p className="font-body text-xs text-[#444] uppercase tracking-widest">
          © {new Date().getFullYear()} Tarnished Realms. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group p-8 bg-[#121110] border border-[#2a2622] hover:border-[#8a7350]/50 transition-colors relative">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-transparent group-hover:border-[#8a7350] transition-colors" />
      <div className="mb-6 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
        {icon}
      </div>
      <h4 className="font-cinzel text-xl text-[#d4c4a8] mb-3">{title}</h4>
      <p className="font-body text-sm text-[#8b8b8b] leading-relaxed">{desc}</p>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between font-body text-xs mb-2">
        <span className="text-[#a89f91] uppercase tracking-wider">{label}</span>
        <span className="text-[#d4c4a8] font-cinzel">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-[#1a1816] border border-[#2a2622] overflow-hidden">
        <div className={`h-full ${color} opacity-80`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
