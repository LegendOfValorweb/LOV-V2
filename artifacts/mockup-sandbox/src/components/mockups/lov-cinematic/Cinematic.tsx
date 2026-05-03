import React from 'react';
import { Sword, Shield, Gem, Users, Zap, Star } from 'lucide-react';

export function Cinematic() {
  return (
    <div className="min-h-screen bg-[#070514] text-slate-300 font-sans overflow-x-hidden relative selection:bg-purple-900/50">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800&family=Cinzel+Decorative:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap');
        
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-decorative { font-family: 'Cinzel Decorative', serif; }
        
        .glass-panel {
          background: linear-gradient(135deg, rgba(20, 15, 45, 0.7) 0%, rgba(10, 5, 25, 0.8) 100%);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(139, 92, 246, 0.2);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
        }
        
        .text-glow {
          text-shadow: 0 0 10px rgba(217, 119, 6, 0.6), 0 0 20px rgba(217, 119, 6, 0.3);
        }
        
        .purple-glow {
          text-shadow: 0 0 10px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.3);
        }
      `}} />

      {/* Decorative Top Border */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent absolute top-0 z-50"></div>

      {/* Navbar */}
      <header className="absolute top-0 w-full z-40 px-6 py-4 flex justify-between items-center glass-panel border-b border-purple-900/30">
        <div className="flex items-center gap-3">
          <Sword className="w-6 h-6 text-amber-500 transform -rotate-45" />
          <h1 className="font-decorative text-2xl font-bold tracking-widest text-white">
            LEGENDS<span className="text-amber-500"> OF </span>VALOR
          </h1>
          <Sword className="w-6 h-6 text-amber-500 transform rotate-45" />
        </div>
        <nav className="hidden md:flex gap-8 font-cinzel text-sm tracking-widest text-slate-300">
          <a href="#" className="hover:text-amber-400 transition-colors">GAME GUIDE</a>
          <a href="#" className="hover:text-amber-400 transition-colors">RANKINGS</a>
          <a href="#" className="hover:text-amber-400 transition-colors">COMMUNITY</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20">
        {/* Background Image & Overlays */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#070514]/80 via-transparent to-[#070514] z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070514]/90 via-transparent to-[#070514]/90 z-10" />
          <img 
            src="/__mockup/images/lov-cinematic-bg.png" 
            alt="Dark Fantasy Landscape" 
            className="w-full h-full object-cover object-top opacity-60 mix-blend-screen scale-105"
          />
          {/* Ambient Purple Glow */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/40 rounded-full blur-[120px] mix-blend-screen z-10" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-900/30 rounded-full blur-[150px] mix-blend-screen z-10" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 text-center max-w-4xl px-4 flex flex-col items-center mt-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-900/20 backdrop-blur-md mb-8">
            <Star className="w-4 h-4 text-purple-400" />
            <span className="text-xs uppercase tracking-[0.2em] text-purple-200 font-semibold">Season 4: The Void Awakens</span>
          </div>
          
          <h2 className="font-decorative text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-tight drop-shadow-2xl">
            CONQUER <br className="hidden md:block"/> THE <span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 text-glow">DARKNESS</span>
          </h2>
          
          <p className="text-lg md:text-xl text-slate-300 font-light max-w-2xl mx-auto mb-12 drop-shadow-lg leading-relaxed">
            A mature dark-fantasy browser RPG. Choose your race, build your guild, and ascend the 10,000-floor Mystic Tower.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
            <button className="relative group px-10 py-4 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-amber-400 opacity-90 transition-transform group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-200 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute top-0 inset-x-0 h-px bg-white/50"></div>
              <div className="absolute bottom-0 inset-x-0 h-px bg-black/50"></div>
              <div className="relative flex items-center gap-3">
                <span className="font-cinzel font-bold text-black tracking-[0.1em] text-lg">BEGIN YOUR JOURNEY</span>
                <Sword className="w-5 h-5 text-black" />
              </div>
            </button>
            
            <button className="relative group px-10 py-4 overflow-hidden rounded-sm glass-panel hover:bg-white/5 transition-colors">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
              <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
              <div className="relative flex items-center gap-3">
                <span className="font-cinzel font-semibold text-purple-200 tracking-[0.1em] text-lg group-hover:text-white transition-colors">ADMIN LOGIN</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Features Row */}
      <section className="relative z-20 max-w-7xl mx-auto px-6 -mt-16 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "14 Races", desc: "Unique passive abilities & lore", icon: Users, color: "from-blue-600 to-blue-900" },
            { title: "15 Ranks", desc: "Ascend from Novice to Mythic", icon: Shield, color: "from-purple-600 to-purple-900" },
            { title: "Epic Loot", desc: "Procedurally generated gear", icon: Gem, color: "from-amber-500 to-amber-800" },
            { title: "Pets & Guilds", desc: "Forge alliances and capture beasts", icon: Zap, color: "from-emerald-600 to-emerald-900" }
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-6 rounded-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} opacity-70`}></div>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
              
              <feature.icon className="w-10 h-10 text-white mb-4 opacity-80" />
              <h3 className="font-cinzel text-xl font-bold text-white mb-2 tracking-wide">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* In-Game UI Preview */}
      <section className="relative z-20 max-w-5xl mx-auto px-6 pb-32">
        <div className="text-center mb-12">
          <h2 className="font-decorative text-3xl text-white mb-4 purple-glow">BEYOND THE VEIL</h2>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          
          {/* Stat Panel Mockup */}
          <div className="glass-panel rounded-xl p-1 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 z-0"></div>
             <div className="relative z-10 bg-[#0a0710]/80 rounded-lg p-6 border border-purple-500/20">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div>
                    <h3 className="font-cinzel font-bold text-amber-500 text-xl tracking-widest">Kael'thas</h3>
                    <p className="text-xs text-purple-300 uppercase tracking-widest mt-1">Lvl 42 • Void Mage</p>
                  </div>
                  <div className="w-12 h-12 rounded bg-purple-900/50 border border-purple-500/30 flex items-center justify-center">
                    <img src="/Legends-Of-Valor/client/public/portraits/mystic_male.png" alt="" className="w-full h-full object-cover opacity-80 mix-blend-luminosity" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <Users className="w-6 h-6 text-purple-400 absolute opacity-50" />
                  </div>
                </div>

                <div className="space-y-5">
                  {[
                    { label: "STRENGTH", val: "24", pct: "30%", color: "bg-red-900" },
                    { label: "DEFENSE", val: "38", pct: "45%", color: "bg-blue-900" },
                    { label: "SPEED", val: "65", pct: "70%", color: "bg-emerald-900" },
                    { label: "INTELLIGENCE", val: "142", pct: "95%", color: "bg-purple-600" }
                  ].map((stat, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-semibold tracking-wider mb-2">
                        <span className="text-slate-400">{stat.label}</span>
                        <span className="text-white font-mono">{stat.val}</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div className={`h-full ${stat.color} relative`} style={{width: stat.pct}}>
                          <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-r from-transparent to-white/30"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Item Card Mockup */}
          <div className="glass-panel rounded-xl p-1 relative overflow-hidden group">
             {/* Epic Glow Effect */}
             <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-amber-900/20 z-0 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
             
             <div className="relative z-10 bg-[#0a0710]/90 rounded-lg p-6 border border-amber-500/30 shadow-[0_0_30px_rgba(217,119,6,0.1)]">
                {/* Item Header */}
                <div className="flex gap-4 items-start mb-6">
                  <div className="w-16 h-16 rounded bg-gradient-to-br from-amber-900 to-black border-2 border-amber-500/50 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
                    <Sword className="w-8 h-8 text-amber-400 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)]" />
                  </div>
                  <div>
                    <h3 className="font-cinzel font-bold text-amber-400 text-lg text-glow">Oblivion's Edge</h3>
                    <p className="text-xs text-amber-200/60 uppercase tracking-widest mt-1">Mythic Two-Handed Sword</p>
                    <div className="flex gap-1 mt-2">
                      {[1,2,3,4,5].map(star => <Star key={star} className="w-3 h-3 text-amber-500 fill-amber-500" />)}
                    </div>
                  </div>
                </div>

                {/* Item Stats */}
                <div className="bg-black/40 rounded p-4 border border-white/5 mb-4">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Sword className="w-4 h-4 text-red-400" /> +850 DMG
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Zap className="w-4 h-4 text-purple-400" /> +45% CRIT
                    </div>
                  </div>
                </div>

                {/* Item Description */}
                <p className="text-sm text-slate-400 italic font-serif leading-relaxed">
                  "Forged in the dying embers of a collapsed star, this blade whispers promises of power to those strong enough to wield it without losing their mind."
                </p>
                
                <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Durability: 100/100</span>
                  <span className="text-amber-500/70">Level Req: 40</span>
                </div>
             </div>
          </div>

        </div>
      </section>

    </div>
  );
}
