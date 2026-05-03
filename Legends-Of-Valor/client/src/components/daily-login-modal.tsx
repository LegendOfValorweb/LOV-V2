import { useState, useEffect } from "react";
import { useGame } from "@/lib/game-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STREAK_REWARDS: { day: number; label: string; gold?: number; rubies?: number; soulShards?: number; trainingPoints?: number }[] = [
  { day: 1, label: "Day 1", gold: 500 },
  { day: 2, label: "Day 2", gold: 1000, rubies: 5 },
  { day: 3, label: "Day 3", gold: 2000, soulShards: 1 },
  { day: 4, label: "Day 4", rubies: 10, trainingPoints: 50 },
  { day: 5, label: "Day 5", gold: 5000, soulShards: 2 },
  { day: 6, label: "Day 6", rubies: 15, trainingPoints: 100 },
  { day: 7, label: "Day 7 ★", gold: 10000, rubies: 20, soulShards: 5, trainingPoints: 200 },
];

function rewardLabel(r: typeof STREAK_REWARDS[0]) {
  const parts: string[] = [];
  if (r.gold) parts.push(`⬤ ${r.gold.toLocaleString()}`);
  if (r.rubies) parts.push(`◆ ${r.rubies}`);
  if (r.soulShards) parts.push(`✦ ${r.soulShards} Shard${r.soulShards > 1 ? "s" : ""}`);
  if (r.trainingPoints) parts.push(`⚡ ${r.trainingPoints} TP`);
  return parts.join("  ");
}

export function DailyLoginModal() {
  const { account, refetchAccount } = useGame();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedData, setClaimedData] = useState<{ streak: number; rewards: typeof STREAK_REWARDS[0] } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!account?.id || account.role !== "player" || checked) return;
    setChecked(true);

    const today = new Date().toISOString().slice(0, 10);
    if (account.lastLoginDate === today) return;

    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [account?.id, account?.role, account?.lastLoginDate, checked]);

  const handleClaim = async () => {
    if (!account?.id || claiming) return;
    setClaiming(true);
    try {
      const res = await apiRequest("POST", `/api/accounts/${account.id}/daily-login`);
      const data = await res.json();
      if (data.alreadyClaimed) {
        setOpen(false);
        return;
      }
      setClaimedData({ streak: data.streak, rewards: STREAK_REWARDS[(data.streak - 1) % 7] });
      await refetchAccount();
      toast({
        title: `Day ${data.streak} Login Reward!`,
        description: `Claimed: ${rewardLabel(STREAK_REWARDS[(data.streak - 1) % 7])}`,
        duration: 6000,
      });
    } catch {
      toast({ title: "Error", description: "Failed to claim login reward", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  if (!open || !account) return null;

  const streakDay = ((account.loginStreak ?? 0) % 7) + 1;
  const todayReward = STREAK_REWARDS[streakDay - 1];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !claiming) setOpen(false); }}
    >
      <div style={{
        background: "linear-gradient(180deg, hsl(240 15% 10%) 0%, hsl(240 10% 7%) 100%)",
        border: "1px solid hsl(45 60% 35% / 0.6)",
        borderRadius: 10, padding: "28px 32px", minWidth: 340, maxWidth: 420,
        boxShadow: "0 0 40px hsl(45 80% 25% / 0.4)",
        fontFamily: "var(--font-serif)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 6 }}>🌅</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "hsl(45 90% 70%)" }}>Daily Login Reward</div>
          <div style={{ fontSize: "0.75rem", color: "hsl(45 20% 55%)", marginTop: 4 }}>
            {account.loginStreak ? `${account.loginStreak}-day streak!` : "Welcome back!"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 20 }}>
          {STREAK_REWARDS.map((r, i) => {
            const day = i + 1;
            const isCurrent = day === streakDay;
            const isPast = day < streakDay;
            return (
              <div key={day} style={{
                borderRadius: 5, padding: "6px 2px", textAlign: "center", fontSize: "0.55rem",
                background: isCurrent ? "hsl(45 70% 20%)" : isPast ? "hsl(240 15% 15%)" : "hsl(240 10% 12%)",
                border: `1px solid ${isCurrent ? "hsl(45 80% 45%)" : "hsl(240 15% 20%)"}`,
                color: isCurrent ? "hsl(45 90% 75%)" : isPast ? "hsl(240 15% 40%)" : "hsl(240 20% 65%)",
                fontWeight: isCurrent ? 700 : 400,
              }}>
                <div style={{ fontSize: "0.65rem", marginBottom: 2 }}>{r.day === 7 ? "★" : `D${day}`}</div>
                {r.gold && <div>⬤</div>}
                {r.rubies && <div>◆</div>}
                {r.soulShards && <div>✦</div>}
                {r.trainingPoints && <div>⚡</div>}
              </div>
            );
          })}
        </div>

        <div style={{
          background: "hsl(45 40% 12%)", border: "1px solid hsl(45 60% 30% / 0.5)",
          borderRadius: 7, padding: "14px 16px", marginBottom: 18, textAlign: "center",
        }}>
          <div style={{ fontSize: "0.7rem", color: "hsl(45 30% 55%)", marginBottom: 6 }}>Today's Reward (Day {streakDay})</div>
          <div style={{ fontSize: "1.1rem", color: "hsl(45 90% 70%)", fontWeight: 700 }}>{rewardLabel(todayReward)}</div>
        </div>

        {claimedData ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "hsl(142 70% 60%)", fontSize: "1rem", marginBottom: 12 }}>✓ Reward Claimed!</div>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "8px 28px", background: "hsl(240 20% 20%)", border: "1px solid hsl(240 20% 30%)",
                borderRadius: 5, color: "hsl(240 20% 70%)", cursor: "pointer", fontFamily: "var(--font-serif)", fontSize: "0.85rem",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              width: "100%", padding: "10px 0", fontSize: "0.9rem", fontWeight: 700, cursor: claiming ? "not-allowed" : "pointer",
              background: "linear-gradient(180deg, hsl(45 70% 40%) 0%, hsl(45 60% 28%) 100%)",
              border: "1px solid hsl(45 70% 50% / 0.6)", borderRadius: 6,
              color: "hsl(45 90% 85%)", fontFamily: "var(--font-serif)",
              opacity: claiming ? 0.7 : 1,
            }}
          >
            {claiming ? "Claiming..." : "Claim Reward"}
          </button>
        )}
      </div>
    </div>
  );
}
