import { useGame } from "@/lib/game-context";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CombatLogEntry } from "@shared/schema";

export default function CombatLog() {
  const [, navigate] = useLocation();
  const { account } = useGame();

  const { data: log = [], isLoading } = useQuery<CombatLogEntry[]>({
    queryKey: ["/api/accounts", account?.id, "combat-log"],
    queryFn: async () => {
      if (!account?.id) return [];
      const res = await fetch(`/api/accounts/${account.id}/combat-log`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  if (!account || account.role !== "player") {
    navigate("/");
    return null;
  }

  const wins = log.filter(e => e.result === "win").length;
  const losses = log.filter(e => e.result === "loss").length;
  const totalGold = log.reduce((sum, e) => sum + (e.goldChange || 0), 0);
  const totalShards = log.reduce((sum, e) => sum + (e.shardsGained || 0), 0);

  return (
    <div className="game-page-scroll overflow-y-auto" style={{ background: "hsl(240 10% 6%)", minHeight: "100vh", padding: "16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => navigate("/npc-battle")}
            style={{
              background: "hsl(240 15% 12%)", border: "1px solid hsl(240 15% 22%)",
              borderRadius: 5, padding: "6px 14px", color: "hsl(240 20% 70%)",
              cursor: "pointer", fontFamily: "var(--font-serif)", fontSize: "0.8rem",
            }}
          >
            ← Back
          </button>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", color: "hsl(45 80% 65%)", margin: 0 }}>
            ⚔ Combat Log
          </h1>
        </div>

        {log.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20,
          }}>
            {[
              { label: "Total Fights", value: log.length, color: "hsl(210 80% 65%)" },
              { label: "Wins", value: wins, color: "hsl(142 70% 55%)" },
              { label: "Losses", value: losses, color: "hsl(0 75% 60%)" },
              { label: "Gold Earned", value: `⬤ ${totalGold.toLocaleString()}`, color: "hsl(45 90% 60%)" },
            ].map(s => (
              <div key={s.label} style={{
                background: "hsl(240 15% 10%)", border: "1px solid hsl(240 15% 18%)",
                borderRadius: 7, padding: "10px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: "0.6rem", color: "hsl(240 20% 55%)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {isLoading && (
            <div style={{ textAlign: "center", padding: 40, color: "hsl(240 20% 50%)" }}>Loading combat history...</div>
          )}
          {!isLoading && log.length === 0 && (
            <div style={{
              textAlign: "center", padding: 50, color: "hsl(240 20% 45%)",
              background: "hsl(240 15% 10%)", borderRadius: 8, border: "1px solid hsl(240 15% 18%)",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📋</div>
              <div style={{ fontFamily: "var(--font-serif)" }}>No battles recorded yet.</div>
              <div style={{ fontSize: "0.75rem", marginTop: 6 }}>Fight some NPCs to build your history!</div>
              <Button className="mt-4" onClick={() => navigate("/npc-battle")}>Go to NPC Battle</Button>
            </div>
          )}
          {[...log].reverse().map((entry, i) => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "hsl(240 15% 10%)", border: `1px solid ${entry.result === "win" ? "hsl(142 40% 20%)" : "hsl(0 40% 20%)"}`,
                borderLeft: `3px solid ${entry.result === "win" ? "hsl(142 70% 45%)" : "hsl(0 70% 50%)"}`,
                borderRadius: 6, padding: "10px 14px",
              }}>
                <div style={{ fontSize: "1.4rem", minWidth: 28 }}>
                  {entry.result === "win" ? "⚔" : "💀"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: "0.85rem", color: "hsl(240 20% 80%)" }}>
                      {entry.opponentName}
                    </span>
                    <Badge
                      style={{
                        background: entry.result === "win" ? "hsl(142 50% 18%)" : "hsl(0 50% 18%)",
                        color: entry.result === "win" ? "hsl(142 70% 60%)" : "hsl(0 70% 65%)",
                        border: "none", fontSize: "0.6rem", padding: "1px 6px",
                      }}
                    >
                      {entry.result === "win" ? "VICTORY" : "DEFEAT"}
                    </Badge>
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "hsl(240 20% 45%)", marginTop: 2, display: "flex", gap: 12 }}>
                    <span>Floor {entry.floor} · Level {entry.level}</span>
                    {entry.goldChange > 0 && <span style={{ color: "hsl(45 80% 55%)" }}>+⬤ {entry.goldChange.toLocaleString()}</span>}
                    {entry.shardsGained > 0 && <span style={{ color: "hsl(271 70% 65%)" }}>+{entry.shardsGained} shards</span>}
                  </div>
                </div>
                <div style={{ fontSize: "0.6rem", color: "hsl(240 20% 40%)", textAlign: "right" }}>
                  <div>{timeStr}</div>
                  <div>{dateStr}</div>
                </div>
              </div>
            );
          })}
          {log.length > 0 && (
            <div style={{ textAlign: "center", fontSize: "0.65rem", color: "hsl(240 20% 35%)", padding: "8px 0" }}>
              Showing last {log.length} battles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
