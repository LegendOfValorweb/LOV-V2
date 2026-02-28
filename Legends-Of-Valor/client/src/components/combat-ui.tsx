import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CombatState {
  round: number;
  player1: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    action: string | null;
    element?: string;
    portrait?: string;
    race?: string;
    gender?: string;
    pet?: { name: string; element: string; tier: string } | null;
    statusEffects?: { type: string; turns: number }[];
  };
  player2: {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    action: string | null;
    element?: string;
    portrait?: string;
    race?: string;
    gender?: string;
    pet?: { name: string; element: string; tier: string } | null;
    statusEffects?: { type: string; turns: number }[];
  };
  log: string[];
  status: "waiting" | "resolved" | "finished";
  winnerId?: string;
  lastAction?: {
    attackerId: string;
    defenderId: string;
    type: string;
    damage?: number;
    isCrit?: boolean;
    isAoE?: boolean;
    element?: string;
    healed?: number;
    dodged?: boolean;
    blocked?: boolean;
  };
}

interface CombatUIProps {
  challengeId: string;
  currentPlayerId: string;
  challengerName: string;
  challengedName: string;
  onCombatEnd?: () => void;
}

interface FloatingNumber {
  id: number;
  value: string;
  x: number;
  y: number;
  color: string;
  isCrit: boolean;
}

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#ff4400",
  Water: "#0088ff",
  Air: "#88ddff",
  Earth: "#aa7722",
  Nature: "#22cc44",
  Light: "#ffee88",
  Dark: "#8833aa",
  Plasma: "#ff44aa",
  Space: "#6666ff",
  Time: "#ddaa33",
  Aether: "#7799ff",
  Soul: "#cc88ff",
  Void: "#555566",
  Storm: "#ffdd00",
  Metal: "#99aabb",
  Blood: "#cc2222",
  Crystal: "#88eeff",
  Arcane: "#aa44ff",
};

const STATUS_ICONS: Record<string, string> = {
  stun: "💫",
  freeze: "🧊",
  silence: "🤐",
  burn: "🔥",
  poison: "☠️",
  bleed: "🩸",
  weakness: "⬇️",
  buff_str: "⬆️",
  buff_def: "🛡️",
  buff_spd: "💨",
  buff_int: "🧠",
};

const ACTION_DATA = {
  attack: { icon: "⚔️", label: "Attack", desc: "Strike with STR", color: "combat-btn-attack" },
  defend: { icon: "🛡️", label: "Defend", desc: "Guard with DEF", color: "combat-btn-defend" },
  dodge: { icon: "💨", label: "Dodge", desc: "Evade with SPD", color: "combat-btn-dodge" },
  spell: { icon: "✨", label: "Spell", desc: "Cast with INT", color: "combat-btn-spell" },
} as const;

let floatingIdCounter = 0;

export default function CombatUI({
  challengeId,
  currentPlayerId,
  challengerName,
  challengedName,
  onCombatEnd,
}: CombatUIProps) {
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [playerShake, setPlayerShake] = useState(false);
  const [enemyShake, setEnemyShake] = useState(false);
  const [critFlash, setCritFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [hitSpark, setHitSpark] = useState<{ x: number; y: number; element: string } | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showDefeat, setShowDefeat] = useState(false);
  const [playerDefeated, setPlayerDefeated] = useState(false);
  const [enemyDefeated, setEnemyDefeated] = useState(false);
  const prevStateRef = useRef<CombatState | null>(null);
  const battlefieldRef = useRef<HTMLDivElement>(null);

  const { data: combatState, isLoading, refetch } = useQuery<CombatState | null>({
    queryKey: ["/api/challenges", challengeId, "combat"],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${challengeId}/combat`);
      if (!res.ok) throw new Error("Failed to fetch combat state");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await apiRequest("POST", `/api/challenges/${challengeId}/combat-action`, {
        playerId: currentPlayerId,
        action,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/challenges", challengeId, "combat"] });

      if (data.combatState?.status === "finished") {
        const isWinner = data.combatState.winnerId === currentPlayerId;
        if (isWinner) {
          setShowVictory(true);
        } else {
          setShowDefeat(true);
        }
        setTimeout(() => onCombatEnd?.(), 4000);
      } else if (data.message) {
        toast({ title: "Action Submitted", description: data.message });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
    },
  });

  const spawnFloatingNumber = useCallback(
    (value: string, side: "player" | "enemy", color: string, isCrit: boolean) => {
      const baseX = side === "player" ? 22 : 72;
      const x = baseX + (Math.random() - 0.5) * 10;
      const y = 30 + (Math.random() - 0.5) * 10;
      const id = ++floatingIdCounter;
      setFloatingNumbers((prev) => [...prev, { id, value, x, y, color, isCrit }]);
      setTimeout(() => {
        setFloatingNumbers((prev) => prev.filter((n) => n.id !== id));
      }, 1200);
    },
    []
  );

  const triggerHitSpark = useCallback((side: "player" | "enemy", element: string) => {
    const x = side === "player" ? 25 : 75;
    const y = 40;
    setHitSpark({ x, y, element });
    setTimeout(() => setHitSpark(null), 400);
  }, []);

  useEffect(() => {
    if (!combatState || !prevStateRef.current) {
      prevStateRef.current = combatState || null;
      return;
    }
    const prev = prevStateRef.current;
    const curr = combatState;

    if (curr.status === "resolved" || curr.round !== prev.round) {
      const isPlayer1 = curr.player1.id === currentPlayerId;
      const myState = isPlayer1 ? curr.player1 : curr.player2;
      const opState = isPlayer1 ? curr.player2 : curr.player1;
      const prevMyState = isPlayer1 ? prev.player1 : prev.player2;
      const prevOpState = isPlayer1 ? prev.player2 : prev.player1;

      if (myState.hp < prevMyState.hp) {
        const dmg = prevMyState.hp - myState.hp;
        setPlayerShake(true);
        setTimeout(() => setPlayerShake(false), 500);
        spawnFloatingNumber(`-${dmg}`, "player", "#ff4444", false);
        triggerHitSpark("player", opState.element || "Fire");
      }

      if (opState.hp < prevOpState.hp) {
        const dmg = prevOpState.hp - opState.hp;
        setEnemyShake(true);
        setTimeout(() => setEnemyShake(false), 500);

        const lastLog = curr.log[curr.log.length - 1] || "";
        const isCrit = lastLog.toLowerCase().includes("crit");
        const color = isCrit ? "#ffdd00" : "#ffffff";
        spawnFloatingNumber(`-${dmg}`, "enemy", color, isCrit);
        triggerHitSpark("enemy", myState.element || "Fire");

        if (isCrit) {
          setCritFlash(true);
          setTimeout(() => setCritFlash(false), 300);
        }
      }

      if (myState.hp > prevMyState.hp) {
        const heal = myState.hp - prevMyState.hp;
        spawnFloatingNumber(`+${heal}`, "player", "#44ff88", false);
      }

      if (myState.hp <= 0 && prevMyState.hp > 0) {
        setPlayerDefeated(true);
      }
      if (opState.hp <= 0 && prevOpState.hp > 0) {
        setEnemyDefeated(true);
      }
    }

    if (curr.status === "finished" && prev.status !== "finished") {
      const isWinner = curr.winnerId === currentPlayerId;
      setTimeout(() => {
        if (isWinner) setShowVictory(true);
        else setShowDefeat(true);
      }, 800);
    }

    prevStateRef.current = curr;
  }, [combatState, currentPlayerId, spawnFloatingNumber, triggerHitSpark]);

  const handleAction = (action: string) => {
    setSelectedAction(action);
    actionMutation.mutate(action);
  };

  if (isLoading) {
    return (
      <div className="combat-scene">
        <div className="combat-loading">
          <div className="combat-loading-spinner" />
          <span>Preparing battle...</span>
        </div>
      </div>
    );
  }

  if (!combatState || !combatState.player1 || !combatState.player2) {
    return (
      <div className="combat-scene">
        <div className="combat-loading">
          <div className="combat-loading-spinner" />
          <span>Initializing combat...</span>
          <button className="combat-refresh-btn" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const isPlayer1 = combatState.player1.id === currentPlayerId;
  const myState = isPlayer1 ? combatState.player1 : combatState.player2;
  const opponentState = isPlayer1 ? combatState.player2 : combatState.player1;
  const hasSubmittedAction = myState.action !== null;
  const waitingForOpponent = hasSubmittedAction && opponentState.action === null;

  const getPortrait = (state: CombatState["player1"]) => {
    if (state.portrait) {
      if (state.portrait.startsWith("skins/")) return `/${state.portrait}.png`;
      if (state.portrait.includes("/")) return state.portrait;
      return `/portraits/${state.portrait}.png`;
    }
    if (state.race && state.gender) return `/portraits/${state.race}_${state.gender}.png`;
    return "/portraits/human_male.png";
  };

  const hpPercent = (hp: number, max: number) => Math.max(0, Math.min(100, (hp / max) * 100));
  const hpColor = (pct: number) =>
    pct > 60 ? "combat-hp-high" : pct > 25 ? "combat-hp-mid" : "combat-hp-low";

  if (showVictory) {
    return (
      <div className="combat-scene">
        <div className="combat-backdrop combat-backdrop-arena" />
        <div className="combat-victory-screen">
          <div className="combat-victory-banner">🏆 VICTORY 🏆</div>
          <div className="combat-victory-text">You defeated {opponentState.name}!</div>
          <div className="combat-log-mini">
            {combatState.log.slice(-5).map((entry, i) => (
              <div key={i} className="combat-log-entry">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showDefeat) {
    return (
      <div className="combat-scene">
        <div className="combat-backdrop combat-backdrop-arena" />
        <div className="combat-defeat-screen">
          <div className="combat-defeat-banner">💀 DEFEAT 💀</div>
          <div className="combat-defeat-text">You were defeated by {opponentState.name}</div>
          <div className="combat-log-mini">
            {combatState.log.slice(-5).map((entry, i) => (
              <div key={i} className="combat-log-entry">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (combatState.status === "finished") {
    const isWinner = combatState.winnerId === currentPlayerId;
    return (
      <div className="combat-scene">
        <div className="combat-backdrop combat-backdrop-arena" />
        <div className={isWinner ? "combat-victory-screen" : "combat-defeat-screen"}>
          <div className={isWinner ? "combat-victory-banner" : "combat-defeat-banner"}>
            {isWinner ? "🏆 VICTORY 🏆" : "💀 DEFEAT 💀"}
          </div>
          <div className={isWinner ? "combat-victory-text" : "combat-defeat-text"}>
            {isWinner ? "You won the battle!" : "Better luck next time!"}
          </div>
          <div className="combat-log-mini">
            {combatState.log.slice(-5).map((entry, i) => (
              <div key={i} className="combat-log-entry">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`combat-scene ${screenShake ? "combat-screen-shake" : ""}`}>
      {critFlash && <div className="combat-crit-flash" />}

      <div className="combat-backdrop combat-backdrop-arena" />
      <div className="combat-backdrop-vignette" />

      <div className="combat-round-banner">
        <span className="combat-round-label">Round {combatState.round}</span>
        {!hasSubmittedAction && (
          <span className="combat-turn-indicator">⚔ YOUR TURN ⚔</span>
        )}
        {waitingForOpponent && (
          <span className="combat-waiting-indicator">Waiting for {opponentState.name}...</span>
        )}
      </div>

      <div className="combat-battlefield" ref={battlefieldRef}>
        <div className={`combat-combatant combat-combatant-player ${playerShake ? "combat-shake" : ""} ${playerDefeated ? "combat-defeated" : ""}`}>
          <div className="combat-status-effects">
            {(myState.statusEffects || []).map((fx, i) => (
              <div key={i} className="combat-status-icon" title={`${fx.type} (${fx.turns} turns)`}>
                <span>{STATUS_ICONS[fx.type] || "❓"}</span>
                <span className="combat-status-turns">{fx.turns}</span>
              </div>
            ))}
          </div>

          <div className="combat-hp-bar-container">
            <div className="combat-combatant-name">{myState.name}</div>
            <div className="combat-hp-bar">
              <div
                className={`combat-hp-fill ${hpColor(hpPercent(myState.hp, myState.maxHp))}`}
                style={{ width: `${hpPercent(myState.hp, myState.maxHp)}%` }}
              />
            </div>
            <div className="combat-hp-text">
              {myState.hp} / {myState.maxHp}
            </div>
          </div>

          <div className="combat-sprite-frame">
            <img
              src={getPortrait(myState)}
              alt={myState.name}
              className="combat-sprite-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/portraits/human_male.png";
              }}
            />
            {myState.element && (
              <div
                className="combat-element-badge"
                style={{ color: ELEMENT_COLORS[myState.element] || "#fff" }}
              >
                {myState.element}
              </div>
            )}
          </div>

          {myState.pet && (
            <div className="combat-pet-sprite">
              <span className="combat-pet-icon">🐾</span>
              <span className="combat-pet-name">{myState.pet.name}</span>
            </div>
          )}
        </div>

        <div className="combat-vs-divider">
          <span>VS</span>
        </div>

        <div className={`combat-combatant combat-combatant-enemy ${enemyShake ? "combat-shake" : ""} ${enemyDefeated ? "combat-defeated" : ""}`}>
          <div className="combat-status-effects">
            {(opponentState.statusEffects || []).map((fx, i) => (
              <div key={i} className="combat-status-icon" title={`${fx.type} (${fx.turns} turns)`}>
                <span>{STATUS_ICONS[fx.type] || "❓"}</span>
                <span className="combat-status-turns">{fx.turns}</span>
              </div>
            ))}
          </div>

          <div className="combat-hp-bar-container">
            <div className="combat-combatant-name">{opponentState.name}</div>
            <div className="combat-hp-bar">
              <div
                className={`combat-hp-fill ${hpColor(hpPercent(opponentState.hp, opponentState.maxHp))}`}
                style={{ width: `${hpPercent(opponentState.hp, opponentState.maxHp)}%` }}
              />
            </div>
            <div className="combat-hp-text">
              {opponentState.hp} / {opponentState.maxHp}
            </div>
          </div>

          <div className="combat-sprite-frame combat-sprite-enemy">
            <img
              src={getPortrait(opponentState)}
              alt={opponentState.name}
              className="combat-sprite-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/portraits/human_male.png";
              }}
            />
            {opponentState.element && (
              <div
                className="combat-element-badge"
                style={{ color: ELEMENT_COLORS[opponentState.element] || "#fff" }}
              >
                {opponentState.element}
              </div>
            )}
          </div>

          {opponentState.pet && (
            <div className="combat-pet-sprite">
              <span className="combat-pet-icon">🐾</span>
              <span className="combat-pet-name">{opponentState.pet.name}</span>
            </div>
          )}
        </div>

        {floatingNumbers.map((fn) => (
          <div
            key={fn.id}
            className={`combat-floating-number ${fn.isCrit ? "combat-floating-crit" : ""}`}
            style={{
              left: `${fn.x}%`,
              top: `${fn.y}%`,
              color: fn.color,
            }}
          >
            {fn.value}
          </div>
        ))}

        {hitSpark && (
          <div
            className="combat-hit-spark"
            style={{
              left: `${hitSpark.x}%`,
              top: `${hitSpark.y}%`,
              color: ELEMENT_COLORS[hitSpark.element] || "#ffaa00",
            }}
          />
        )}
      </div>

      {combatState.log.length > 0 && (
        <div className="combat-log-panel">
          {combatState.log.slice(-3).map((entry, i) => (
            <div key={i} className="combat-log-entry">
              {entry}
            </div>
          ))}
        </div>
      )}

      <div className="combat-action-panel">
        {waitingForOpponent ? (
          <div className="combat-waiting-panel">
            <div className="combat-waiting-spinner" />
            <span>Waiting for opponent...</span>
          </div>
        ) : hasSubmittedAction ? (
          <div className="combat-submitted-panel">
            <span>Action submitted: <strong className="capitalize">{myState.action}</strong></span>
          </div>
        ) : (
          <div className="combat-action-grid">
            {(Object.keys(ACTION_DATA) as Array<keyof typeof ACTION_DATA>).map((action) => {
              const data = ACTION_DATA[action];
              return (
                <button
                  key={action}
                  className={`combat-action-btn ${data.color} ${selectedAction === action ? "combat-action-selected" : ""}`}
                  onClick={() => handleAction(action)}
                  disabled={actionMutation.isPending}
                >
                  <span className="combat-action-icon">{data.icon}</span>
                  <span className="combat-action-label">{data.label}</span>
                  <span className="combat-action-desc">{data.desc}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
