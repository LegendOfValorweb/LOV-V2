import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGame } from "@/lib/game-context";
import { apiRequest } from "@/lib/queryClient";
import { ZoneScene } from "@/components/zone-scene";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GoldDisplay } from "@/components/gold-display";
import {
  ArrowLeft, Dices, Sword, Circle, TrendingUp, TrendingDown, Minus,
  Trophy, History, BarChart3, Map, LogOut,
} from "lucide-react";
import { queryClient as qc } from "@/lib/queryClient";

// ─── constants ───────────────────────────────────────────────────────────────
const CARD_SUITS = ["♠", "♥", "♦", "♣"];
const CARD_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const WHEEL_SEGMENTS = [
  ...Array(12).fill({ label: "LOSE", multiplier: 0,   color: "#dc2626" }),
  ...Array(5).fill( { label: "1.9×", multiplier: 1.9, color: "#ca8a04" }),
  ...Array(2).fill( { label: "3.5×", multiplier: 3.5, color: "#2563eb" }),
                    { label: "10×",  multiplier: 10,  color: "#7c3aed" },
];

function fmtGold(n: number) {
  return n.toLocaleString();
}

// ─── Bet Input ───────────────────────────────────────────────────────────────
function BetInput({
  value, onChange, maxBet, gold,
}: { value: number; onChange: (v: number) => void; maxBet: number; gold: number }) {
  const presets = [100, 1_000, 10_000, 100_000].filter(p => p <= Math.min(maxBet, gold));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="flex-1 px-3 py-2 bg-black/40 border border-yellow-700/50 rounded text-yellow-100 text-sm font-mono"
          value={value}
          min={100}
          max={Math.min(maxBet, gold)}
          onChange={e => onChange(Math.max(100, Math.min(Math.min(maxBet, gold), parseInt(e.target.value) || 100)))}
        />
        <Button size="sm" variant="outline" className="shrink-0 border-yellow-700/50 text-yellow-400 text-xs"
          onClick={() => onChange(Math.min(maxBet, gold))}>Max</Button>
      </div>
      <div className="flex gap-1 flex-wrap">
        {presets.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className="px-2 py-0.5 text-xs rounded bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-800/40">
            {p >= 1_000 ? `${p / 1000}k` : p}
          </button>
        ))}
        <button onClick={() => onChange(Math.min(Math.min(maxBet, gold), Math.floor(value * 2)))}
          className="px-2 py-0.5 text-xs rounded bg-green-900/30 border border-green-700/40 text-green-300 hover:bg-green-800/40">
          ×2
        </button>
        <button onClick={() => onChange(Math.max(100, Math.floor(value / 2)))}
          className="px-2 py-0.5 text-xs rounded bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-800/40">
          ½
        </button>
      </div>
    </div>
  );
}

// ─── Result Flash ─────────────────────────────────────────────────────────────
function ResultFlash({ netGain, visible }: { netGain: number; visible: boolean }) {
  if (!visible) return null;
  if (netGain > 0) return <div className="text-2xl font-bold text-green-400 animate-bounce">+{fmtGold(netGain)} 🎉</div>;
  if (netGain < 0) return <div className="text-2xl font-bold text-red-400">-{fmtGold(Math.abs(netGain))} 💸</div>;
  return <div className="text-2xl font-bold text-yellow-400">PUSH — Bet returned 🤝</div>;
}

// ─── Dice Game ────────────────────────────────────────────────────────────────
function DiceGame({ accountId, gold, maxBet, onResult }: { accountId: string; gold: number; maxBet: number; onResult: () => void }) {
  const [bet, setBet] = useState(100);
  const [choice, setChoice] = useState<string>("high");
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const diceFaces = ["⚀","⚁","⚂","⚃","⚄","⚅"];

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/casino/dice", { accountId, betAmount: bet, choice }).then(r => r.json()),
    onMutate: () => { setRolling(true); setResult(null); },
    onSuccess: (data) => {
      setTimeout(() => {
        setRolling(false);
        setResult(data);
        onResult();
        if (data.win) toast({ title: `🎲 You rolled ${data.roll}! Won ${fmtGold(data.payout)} gold!` });
        else toast({ title: `🎲 Rolled ${data.roll}. Better luck next time.`, variant: "destructive" });
      }, 1200);
    },
    onError: async (e: any) => {
      setRolling(false);
      const msg = e?.message || "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-yellow-700">High or Low: 1.9× payout (5% house edge) · Exact number: 5.5× payout</p>

      <div className="flex justify-center">
        <div className={`text-7xl transition-all duration-300 ${rolling ? "animate-spin" : ""}`}>
          {rolling ? "🎲" : result ? diceFaces[(result.roll - 1)] : "🎲"}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {["low","high","1","2","3","4","5","6"].map(c => (
          <button key={c} onClick={() => setChoice(c)}
            className={`py-2 rounded text-sm font-bold border transition-all ${
              choice === c
                ? "bg-yellow-600 border-yellow-400 text-black"
                : "bg-black/40 border-yellow-700/40 text-yellow-300 hover:border-yellow-500"
            }`}>
            {c === "low" ? "LOW\n1-3" : c === "high" ? "HIGH\n4-6" : `#${c}`}
          </button>
        ))}
      </div>

      <BetInput value={bet} onChange={setBet} maxBet={maxBet} gold={gold} />

      <Button
        className="w-full bg-yellow-700 hover:bg-yellow-600 text-black font-bold"
        onClick={() => mutation.mutate()}
        disabled={rolling || gold < bet}>
        {rolling ? "Rolling…" : `Roll — ${fmtGold(bet)} gold`}
      </Button>

      {result && !rolling && (
        <div className="text-center space-y-1 py-2">
          <ResultFlash netGain={result.netGain} visible />
          <p className="text-xs text-muted-foreground">Rolled: {result.roll} · Choice: {choice.toUpperCase()}</p>
        </div>
      )}
    </div>
  );
}

// ─── Card War ─────────────────────────────────────────────────────────────────
function CardWar({ accountId, gold, maxBet, onResult }: { accountId: string; gold: number; maxBet: number; onResult: () => void }) {
  const [bet, setBet] = useState(100);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [suit] = useState(() => CARD_SUITS[Math.floor(Math.random() * 4)]);
  const [dSuit] = useState(() => CARD_SUITS[Math.floor(Math.random() * 4)]);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/casino/war", { accountId, betAmount: bet }).then(r => r.json()),
    onMutate: () => { setFlipping(true); setResult(null); },
    onSuccess: (data) => {
      setTimeout(() => {
        setFlipping(false);
        setResult(data);
        onResult();
        if (data.result === "win") toast({ title: `🃏 ${data.pCardName} vs ${data.dCardName} — You win!` });
        else if (data.result === "push") toast({ title: `🃏 ${data.pCardName} vs ${data.dCardName} — Push! Bet returned.` });
        else toast({ title: `🃏 ${data.pCardName} vs ${data.dCardName} — Dealer wins.`, variant: "destructive" });
      }, 1500);
    },
    onError: async (e: any) => {
      setFlipping(false);
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    },
  });

  function CardFace({ value, suit, hidden }: { value: number; suit: string; hidden?: boolean }) {
    const isRed = suit === "♥" || suit === "♦";
    if (hidden) return (
      <div className="w-20 h-28 rounded-lg border-2 border-yellow-600/50 bg-gradient-to-br from-blue-900 to-indigo-950 flex items-center justify-center text-3xl">🂠</div>
    );
    return (
      <div className={`w-20 h-28 rounded-lg border-2 border-yellow-600/50 bg-white flex flex-col items-center justify-center gap-1 ${flipping ? "animate-pulse" : ""}`}>
        <span className={`text-xl font-bold ${isRed ? "text-red-600" : "text-slate-900"}`}>{CARD_NAMES[value]}</span>
        <span className={`text-2xl ${isRed ? "text-red-600" : "text-slate-900"}`}>{suit}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-yellow-700">Draw cards — higher card wins 1.9×. Equal cards push (bet returned).</p>

      <div className="flex justify-center items-center gap-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">You</p>
          {result && !flipping
            ? <CardFace value={result.pCard} suit={suit} />
            : <CardFace value={0} suit={suit} hidden={!result || flipping} />
          }
        </div>
        <div className="text-2xl font-bold text-yellow-400">VS</div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">Dealer</p>
          {result && !flipping
            ? <CardFace value={result.dCard} suit={dSuit} />
            : <CardFace value={0} suit={dSuit} hidden />
          }
        </div>
      </div>

      <BetInput value={bet} onChange={setBet} maxBet={maxBet} gold={gold} />

      <Button className="w-full bg-red-800 hover:bg-red-700 text-white font-bold"
        onClick={() => mutation.mutate()} disabled={flipping || gold < bet}>
        {flipping ? "Drawing…" : `Go to War — ${fmtGold(bet)} gold`}
      </Button>

      {result && !flipping && (
        <div className="text-center space-y-1 py-2">
          <ResultFlash netGain={result.netGain} visible />
          <p className="text-xs text-muted-foreground capitalize">
            {result.pCardName} vs {result.dCardName} — {result.result}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Fortune Wheel ────────────────────────────────────────────────────────────
function FortuneWheel({ accountId, gold, maxBet, onResult }: { accountId: string; gold: number; maxBet: number; onResult: () => void }) {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const baseRef = useRef(0);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/casino/wheel", { accountId, betAmount: bet }).then(r => r.json()),
    onMutate: () => {
      setSpinning(true);
      setResult(null);
      // Spin freely for animation, result revealed after
      const spins = 5 + Math.random() * 3;
      baseRef.current = rotation + spins * 360;
      setRotation(baseRef.current);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setSpinning(false);
        setResult(data);
        onResult();
        if (data.netGain > 0) toast({ title: `🎡 ${data.segment.label} — Won ${fmtGold(data.payout)} gold!` });
        else toast({ title: `🎡 ${data.segment.label} — No luck this spin.`, variant: "destructive" });
      }, 3200);
    },
    onError: async (e: any) => {
      setSpinning(false);
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    },
  });

  // Build conic gradient for wheel
  const segAngle = 360 / WHEEL_SEGMENTS.length; // 18°
  const gradient = WHEEL_SEGMENTS.map((s, i) => {
    const start = i * segAngle;
    const end = start + segAngle;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(", ");

  const segGroups = [
    { label: "LOSE",  count: 12, pct: "60%", color: "#dc2626" },
    { label: "1.9×",  count: 5,  pct: "25%", color: "#ca8a04" },
    { label: "3.5×",  count: 2,  pct: "10%", color: "#2563eb" },
    { label: "10×",   count: 1,  pct: "5%",  color: "#7c3aed" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-yellow-700">Spin the wheel of fortune. Big payouts await the lucky!</p>

      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {/* Pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 text-yellow-400 text-2xl">▼</div>
          <div
            className="w-40 h-40 rounded-full border-4 border-yellow-600 shadow-lg shadow-yellow-900/40"
            style={{
              background: `conic-gradient(${gradient})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3s cubic-bezier(0.17, 0.67, 0.21, 0.99)" : "none",
            }}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {segGroups.map(g => (
            <div key={g.label} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ background: g.color }} />
              <span className="text-muted-foreground">{g.label}</span>
              <span className="text-yellow-600">{g.pct}</span>
            </div>
          ))}
        </div>
      </div>

      <BetInput value={bet} onChange={setBet} maxBet={maxBet} gold={gold} />

      <Button className="w-full bg-purple-800 hover:bg-purple-700 text-white font-bold"
        onClick={() => mutation.mutate()} disabled={spinning || gold < bet}>
        {spinning ? "Spinning…" : `Spin — ${fmtGold(bet)} gold`}
      </Button>

      {result && !spinning && (
        <div className="text-center space-y-1 py-2">
          <ResultFlash netGain={result.netGain} visible />
          <p className="text-xs text-muted-foreground">Landed: {result.segment.label}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const MAX_BET_BY_RANK: Record<string, number> = {
  "Novice": 10_000, "Apprentice": 25_000, "Initiate": 50_000,
  "Journeyman": 100_000, "Adept": 250_000, "Expert": 500_000,
  "Master": 1_000_000, "Grandmaster": 2_000_000, "Champion": 5_000_000,
  "Overlord": 10_000_000, "Sovereign": 25_000_000, "Ascendant": 50_000_000,
  "Legend": 100_000_000, "Mythic": 250_000_000, "Mythical Legend": 500_000_000,
};

export default function Casino() {
  const [, navigate] = useLocation();
  const { account, logout } = useGame();

  const maxBet = account ? (MAX_BET_BY_RANK[account.rank] ?? 10_000) : 10_000;

  const { data: stats, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/casino/stats", account?.id],
    queryFn: async () => {
      if (!account?.id) return null;
      const r = await fetch(`/api/casino/stats/${account.id}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!account?.id,
  });

  const { data: history = [], refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["/api/casino/history", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const r = await fetch(`/api/casino/history/${account.id}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!account?.id,
  });

  function handleResult() {
    refetchStats();
    refetchHistory();
    qc.invalidateQueries({ queryKey: ["/api/accounts", account?.id] });
  }

  if (!account) return (
    <div className="h-full bg-background flex items-center justify-center">
      <Card className="p-6"><p className="text-muted-foreground">Please log in.</p></Card>
    </div>
  );

  return (
    <ZoneScene zoneName="The Golden Den" backdrop="/backdrops/black_market.png" ambientClass="" overlayOpacity={0.6}>
      <div className="h-full flex flex-col">

        {/* Header */}
        <header className="sticky top-0 z-50 bg-black/90 border-b border-yellow-800/50 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/world-map")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-cinzel font-bold text-yellow-400 flex items-center gap-2">
                🎰 The Golden Den
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <GoldDisplay amount={account.gold} size="sm" />
              <Button variant="outline" size="sm" onClick={logout} className="border-yellow-700/50 text-yellow-400">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">

          {/* Max bet banner */}
          <div className="text-center p-2 rounded bg-yellow-900/20 border border-yellow-700/30 text-xs text-yellow-500">
            Your rank <span className="font-bold text-yellow-300">{account.rank}</span> allows bets up to{" "}
            <span className="font-bold text-yellow-300">{fmtGold(maxBet)} gold</span> per game
          </div>

          <Tabs defaultValue="dice" className="space-y-6">
            <TabsList className="grid grid-cols-4 bg-black/60 border border-yellow-800/40">
              <TabsTrigger value="dice" className="data-[state=active]:bg-yellow-800 data-[state=active]:text-black font-bold">
                <Dices className="h-4 w-4 mr-1" /> Dice
              </TabsTrigger>
              <TabsTrigger value="war" className="data-[state=active]:bg-red-800 data-[state=active]:text-white font-bold">
                <Sword className="h-4 w-4 mr-1" /> War
              </TabsTrigger>
              <TabsTrigger value="wheel" className="data-[state=active]:bg-purple-800 data-[state=active]:text-white font-bold">
                <Circle className="h-4 w-4 mr-1" /> Wheel
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-slate-700 font-bold">
                <History className="h-4 w-4 mr-1" /> History
              </TabsTrigger>
            </TabsList>

            {/* ── Dice ── */}
            <TabsContent value="dice">
              <Card className="bg-gradient-to-br from-yellow-950/60 to-black border-yellow-700/40">
                <CardHeader>
                  <CardTitle className="font-cinzel text-yellow-400 flex items-center gap-2">
                    <Dices /> Lucky Dice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DiceGame accountId={account.id} gold={account.gold} maxBet={maxBet} onResult={handleResult} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── War ── */}
            <TabsContent value="war">
              <Card className="bg-gradient-to-br from-red-950/60 to-black border-red-700/40">
                <CardHeader>
                  <CardTitle className="font-cinzel text-red-400 flex items-center gap-2">
                    <Sword /> Card War
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardWar accountId={account.id} gold={account.gold} maxBet={maxBet} onResult={handleResult} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Wheel ── */}
            <TabsContent value="wheel">
              <Card className="bg-gradient-to-br from-purple-950/60 to-black border-purple-700/40">
                <CardHeader>
                  <CardTitle className="font-cinzel text-purple-400 flex items-center gap-2">
                    <Circle /> Fortune Wheel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FortuneWheel accountId={account.id} gold={account.gold} maxBet={maxBet} onResult={handleResult} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── History ── */}
            <TabsContent value="history" className="space-y-4">
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Games", value: stats.totalGames, icon: <BarChart3 className="h-4 w-4" /> },
                    { label: "Wagered", value: `${fmtGold(stats.totalWagered)}g`, icon: <Trophy className="h-4 w-4" /> },
                    {
                      label: "Net Gain",
                      value: `${stats.netGain >= 0 ? "+" : ""}${fmtGold(stats.netGain)}g`,
                      icon: stats.netGain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
                      color: stats.netGain >= 0 ? "text-green-400" : "text-red-400",
                    },
                    { label: "Best Win", value: `+${fmtGold(stats.biggestWin)}g`, icon: <Trophy className="h-4 w-4 text-yellow-400" /> },
                  ].map(s => (
                    <Card key={s.label} className="bg-black/40 border-yellow-800/30">
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className="text-muted-foreground">{s.icon}</div>
                        <div>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className={`font-bold text-sm ${(s as any).color || "text-yellow-300"}`}>{s.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="bg-black/40 border-yellow-800/30">
                <CardHeader>
                  <CardTitle className="text-sm text-yellow-400">Recent Games</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No games played yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                      {history.map((h: any) => (
                        <div key={h.id} className={`flex items-center justify-between p-2 rounded text-xs border ${
                          h.netGain > 0 ? "bg-green-950/30 border-green-800/30" :
                          h.netGain < 0 ? "bg-red-950/30 border-red-800/30" :
                          "bg-yellow-950/20 border-yellow-800/20"}`}>
                          <div className="flex items-center gap-2">
                            <span className="uppercase font-bold text-muted-foreground w-10">{h.game}</span>
                            <span className="text-muted-foreground">Bet {fmtGold(h.betAmount)}g</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {h.netGain > 0 ? <TrendingUp className="h-3 w-3 text-green-400" /> :
                             h.netGain < 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> :
                             <Minus className="h-3 w-3 text-yellow-400" />}
                            <span className={`font-bold ${h.netGain > 0 ? "text-green-400" : h.netGain < 0 ? "text-red-400" : "text-yellow-400"}`}>
                              {h.netGain >= 0 ? "+" : ""}{fmtGold(h.netGain)}g
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ZoneScene>
  );
}
