import React from 'react';
import { Sword, Shield, Skull, Scroll, Flame, Gem, Crosshair, Users, ChevronRight } from 'lucide-react';

export function Gothic() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#d4c5b9] overflow-x-hidden selection:bg-[#7a0000] selection:text-[#f0e6d2] font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-cinzel-dec { font-family: 'Cinzel Decorative', serif; }
        .font-body { font-family: 'Playfair Display', serif; }
        
        .bg-stone-texture {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }
        
        .gothic-border {
          border: 1px solid #3a2e26;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 4px 15px rgba(0,0,0,0.5);
          position: relative;
        }
        
        .gothic-border::before, .gothic-border::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          background: #8b7355;
          z-index: 10;
        }
        
        .gothic-border::before { top: -1px; left: -1px; box-shadow: calc(100% + 2px) 0 0 #8b7355; }
        .gothic-border::after { bottom: -1px; left: -1px; box-shadow: calc(100% + 2px) 0 0 #8b7355; }
        
        .blood-gradient {
          background: linear-gradient(180deg, #7a0000 0%, #3d0000 100%);
        }
        
        .text-glow {
          text-shadow: 0 0 10px rgba(122, 0, 0, 0.8), 0 0 20px rgba(122, 0, 0, 0.4);
        }
      `}} />

      {/* Navbar */}
      <header className="relative z-50 border-b border-[#3a2e26] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="absolute bottom-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#8b7355] to-transparent opacity-50"></div>
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword className="w-6 h-6 text-[#8b7355] transform -rotate-45" />
            <h1 className="font-cinzel-dec text-2xl font-bold tracking-widest text-[#e8dcc4] text-glow">
              Legends of Valor
            </h1>
            <Sword className="w-6 h-6 text-[#8b7355] transform rotate-45" />
          </div>
          <nav className="hidden md:flex items-center gap-8 font-cinzel text-sm tracking-widest text-[#a3947c]">
            <a href="#" className="hover:text-[#e8dcc4] hover:text-glow transition-all duration-300">Features</a>
            <a href="#" className="hover:text-[#e8dcc4] hover:text-glow transition-all duration-300">Races</a>
            <a href="#" className="hover:text-[#e8dcc4] hover:text-glow transition-all duration-300">Media</a>
            <a href="#" className="hover:text-[#e8dcc4] hover:text-glow transition-all duration-300">Community</a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="font-cinzel text-xs tracking-widest text-[#a3947c] hover:text-[#e8dcc4] transition-colors">
              LOGIN
            </button>
            <button className="gothic-border bg-[#1a1512] hover:bg-[#2a221d] px-6 py-2 font-cinzel font-bold text-xs tracking-widest text-[#e8dcc4] transition-colors">
              PLAY FREE
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/gothic-hero-bg.png" 
            alt="Dark Castle Background" 
            className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)]"></div>
        </div>

        <div className="container relative z-10 px-6 mx-auto text-center flex flex-col items-center">
          <div className="inline-block mb-6 px-4 py-1 border border-[#3a2e26] bg-[#0f0c0a]/80 backdrop-blur-sm">
            <span className="font-cinzel text-xs tracking-[0.3em] text-[#8b7355] uppercase">Dark Fantasy RPG</span>
          </div>
          
          <h2 className="font-cinzel-dec text-6xl md:text-8xl font-black mb-6 tracking-wider text-[#e8dcc4] uppercase leading-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
            Conquer The<br />
            <span className="text-[#7a0000] text-glow">Darkness</span>
          </h2>
          
          <p className="font-body text-lg md:text-xl text-[#a3947c] max-w-2xl mb-12 leading-relaxed">
            Ascend the 10,000-floor Mystic Tower. Forge your legacy in a world consumed by shadow, where every choice demands a sacrifice.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6">
            <button className="group relative overflow-hidden bg-[#7a0000] hover:bg-[#990000] text-[#f0e6d2] px-10 py-4 font-cinzel font-bold tracking-widest transition-all duration-300">
              <span className="relative z-10 flex items-center gap-2">
                Begin Your Journey
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 border border-[#f0e6d2]/30 m-1"></div>
            </button>
            
            <button className="group relative bg-[#0a0a0a]/80 hover:bg-[#1a1512] border border-[#3a2e26] text-[#a3947c] hover:text-[#e8dcc4] px-10 py-4 font-cinzel font-bold tracking-widest transition-all duration-300">
              <span className="relative z-10 flex items-center gap-2">
                Admin Login
                <Skull className="w-4 h-4 opacity-50" />
              </span>
              <div className="absolute inset-0 bg-[#3a2e26] opacity-0 group-hover:opacity-10 transition-opacity"></div>
            </button>
          </div>
        </div>
      </section>

      {/* Features Row */}
      <section className="relative z-20 -mt-20 pb-20 px-6 container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Users, title: "14 Races", desc: "Choose your bloodline from Humans to Undead." },
            { icon: Crosshair, title: "15 Ranks", desc: "Ascend from Novice to transcendent Godhood." },
            { icon: Gem, title: "Epic Loot", desc: "Unearth ancient relics and forge mythic gear." },
            { icon: Shield, title: "Pets & Guilds", desc: "Tame legendary beasts and conquer together." }
          ].map((feature, i) => (
            <div key={i} className="gothic-border bg-[#110e0c] bg-stone-texture p-8 flex flex-col items-center text-center group hover:-translate-y-2 transition-transform duration-500">
              <div className="w-16 h-16 rounded-full border border-[#3a2e26] bg-[#0a0a0a] flex items-center justify-center mb-6 group-hover:border-[#7a0000] group-hover:shadow-[0_0_15px_rgba(122,0,0,0.5)] transition-all duration-500">
                <feature.icon className="w-8 h-8 text-[#8b7355] group-hover:text-[#7a0000] transition-colors duration-500" />
              </div>
              <h3 className="font-cinzel text-xl font-bold tracking-wider text-[#e8dcc4] mb-3">{feature.title}</h3>
              <p className="font-body text-[#8b7355] text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Inner Game UI Preview */}
      <section className="py-24 relative border-t border-[#3a2e26] bg-[#080706]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-cinzel-dec text-4xl text-[#e8dcc4] mb-4">The Interface of War</h2>
            <div className="w-24 h-[1px] bg-[#7a0000] mx-auto"></div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Character Stat Panel */}
            <div className="gothic-border bg-[#120f0d] bg-stone-texture p-8 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8b7355] to-transparent opacity-30"></div>
              
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-[#3a2e26]">
                <div className="w-20 h-20 bg-[#0a0a0a] border border-[#3a2e26] p-1 relative group cursor-pointer">
                  <div className="w-full h-full bg-[#1a1512] flex items-center justify-center group-hover:bg-[#2a221d] transition-colors">
                    <Skull className="w-8 h-8 text-[#5a4a3e]" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-[#1a1512] border border-[#3a2e26] px-2 py-0.5 text-xs font-cinzel text-[#8b7355]">Lv.84</div>
                </div>
                <div>
                  <h3 className="font-cinzel text-2xl text-[#e8dcc4] tracking-wider mb-1">Vaelen the Accursed</h3>
                  <p className="font-body text-[#8b7355] text-sm flex items-center gap-2">
                    <span className="text-[#7a0000]">Undead</span> • Shadow Knight • Rank 8
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { label: "Strength", val: 845, max: 1000, color: "#7a0000" },
                  { label: "Defense", val: 620, max: 1000, color: "#5a4a3e" },
                  { label: "Speed", val: 410, max: 1000, color: "#8b7355" },
                  { label: "Intelligence", val: 125, max: 1000, color: "#2d4a5c" }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between font-cinzel text-xs tracking-widest text-[#a3947c] mb-2 uppercase">
                      <span>{stat.label}</span>
                      <span className="text-[#e8dcc4]">{stat.val}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#0a0a0a] border border-[#2a221d] overflow-hidden">
                      <div 
                        className="h-full relative"
                        style={{ width: \`\${(stat.val/stat.max)*100}%\`, backgroundColor: stat.color }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory Item Card */}
            <div className="gothic-border bg-[#120f0d] bg-stone-texture p-8 flex flex-col items-center relative overflow-hidden group">
              {/* Mythic glow effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#7a0000]/10 blur-[50px] pointer-events-none group-hover:bg-[#7a0000]/20 transition-colors duration-700"></div>
              
              <div className="w-full flex justify-between items-start mb-6 z-10">
                <span className="font-cinzel text-xs tracking-widest text-[#7a0000] font-bold uppercase drop-shadow-[0_0_5px_rgba(122,0,0,0.5)]">Mythic Tier</span>
                <span className="font-cinzel text-xs text-[#5a4a3e]">Weapon / 2H</span>
              </div>

              <div className="w-32 h-32 bg-[#0a0a0a] border border-[#7a0000] p-2 mb-6 relative rotate-45 group-hover:rotate-0 transition-all duration-700">
                <div className="w-full h-full bg-[#1a0a0a] flex items-center justify-center -rotate-45 group-hover:rotate-0 transition-all duration-700">
                  <Sword className="w-16 h-16 text-[#7a0000] drop-shadow-[0_0_10px_rgba(122,0,0,0.8)]" />
                </div>
              </div>

              <h3 className="font-cinzel text-2xl text-[#e8dcc4] tracking-wider mb-2 text-glow text-center z-10">Bloodletter of the Abyss</h3>
              <div className="w-16 h-[1px] bg-[#3a2e26] mb-6 z-10"></div>
              
              <div className="w-full space-y-3 mb-6 z-10">
                <div className="flex justify-between items-center px-4 py-2 bg-[#0a0a0a]/50 border border-[#2a221d]">
                  <span className="font-body text-[#8b7355] text-sm">Attack Power</span>
                  <span className="font-cinzel text-[#e8dcc4] text-lg">1,450 - 1,820</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-[#0a0a0a]/50 border border-[#2a221d]">
                  <span className="font-body text-[#8b7355] text-sm">Lifesteal</span>
                  <span className="font-cinzel text-[#7a0000] text-lg">+15%</span>
                </div>
              </div>
              
              <p className="font-body text-[#5a4a3e] text-sm italic text-center px-4 z-10">
                "Forged in the deepest pits of the Hell Zone. It hungers constantly."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3a2e26] bg-[#050505] py-12 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#7a0000] to-transparent opacity-30"></div>
        <Sword className="w-8 h-8 text-[#3a2e26] mx-auto mb-6" />
        <h2 className="font-cinzel-dec text-xl tracking-[0.2em] text-[#5a4a3e] mb-4">Legends of Valor</h2>
        <p className="font-body text-[#3a2e26] text-xs">© 2025 All Rights Reserved. Prepare to die.</p>
      </footer>
    </div>
  );
}
