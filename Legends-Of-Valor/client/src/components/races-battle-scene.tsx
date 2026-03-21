import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "ember" | "spark" | "orb" | "smoke" | "lightning" | "impact";
  hue: number;
  alpha: number;
}

const RACES = [
  "human", "elf", "dwarf", "orc", "beastfolk", "mystic",
  "fae", "elemental", "undead", "demon", "draconic", "celestial", "aquatic", "titan",
];
const GENDERS = ["male", "female"] as const;

type FightState = "idle" | "lunge" | "hit" | "recoil" | "dying";

interface Fighter {
  race: string;
  gender: "male" | "female";
  startingHp: number;
}

let lastRacePair: [string, string] = ["", ""];

function randomRacePair(): [Fighter, Fighter] {
  let shuffled: string[];
  do {
    shuffled = [...RACES].sort(() => Math.random() - 0.5);
  } while (shuffled[0] === lastRacePair[0] && shuffled[1] === lastRacePair[1]);
  lastRacePair = [shuffled[0], shuffled[1]];
  return [
    { race: shuffled[0], gender: GENDERS[Math.floor(Math.random() * 2)], startingHp: 3 + Math.floor(Math.random() * 3) },
    { race: shuffled[1], gender: GENDERS[Math.floor(Math.random() * 2)], startingHp: 3 + Math.floor(Math.random() * 3) },
  ];
}

export default function RacesBattleScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [shakeX, setShakeX] = useState(0);
  const [shakeY, setShakeY] = useState(0);

  const [[leftFighter, rightFighter], setFighters] = useState<[Fighter, Fighter]>(() => randomRacePair());
  const [roundVisible, setRoundVisible] = useState(true);
  const [leftState, setLeftState] = useState<FightState>("idle");
  const [rightState, setRightState] = useState<FightState>("idle");

  const leftControls = useAnimation();
  const rightControls = useAnimation();
  const clashTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      clashTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const spawnImpactBurst = useCallback((canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 20 + Math.random() * 25,
        size: 1.5 + Math.random() * 3.5,
        type: "impact",
        hue: 30 + Math.random() * 40,
        alpha: 0,
      });
    }
  }, []);

  const triggerClash = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas) spawnImpactBurst(canvas);

    setFlashOpacity(0.6);
    const shx = (Math.random() - 0.5) * 16;
    const shy = (Math.random() - 0.5) * 10;
    setShakeX(shx);
    setShakeY(shy);

    clashTimersRef.current.push(
      setTimeout(() => {
        setFlashOpacity(0.25);
        setShakeX(-shx * 0.5);
        setShakeY(-shy * 0.5);
      }, 80)
    );

    clashTimersRef.current.push(
      setTimeout(() => {
        setFlashOpacity(0);
        setShakeX(0);
        setShakeY(0);
      }, 200)
    );
  }, [spawnImpactBurst]);

  const startNewRound = useCallback(() => {
    const [l, r] = randomRacePair();
    setFighters([l, r]);
    setLeftState("idle");
    setRightState("idle");
    leftControls.set({ x: 0, y: 0, opacity: 1, scaleX: 1 });
    rightControls.set({ x: 0, y: 0, opacity: 1, scaleX: -1 });
    setRoundVisible(true);
  }, [leftControls, rightControls]);

  useEffect(() => {
    let cancelled = false;
    let currentLeftHp = leftFighter.startingHp;
    let currentRightHp = rightFighter.startingHp;

    leftControls.set({ x: 0, y: 0, opacity: 1, scaleX: 1 });
    rightControls.set({ x: 0, y: 0, opacity: 1, scaleX: -1 });
    setLeftState("idle");
    setRightState("idle");

    async function idleBob(controls: ReturnType<typeof useAnimation>) {
      while (!cancelled) {
        await controls.start({
          y: [0, -8, 0],
          transition: { duration: 1.8 + Math.random() * 0.6, ease: "easeInOut" },
        });
      }
    }

    async function fightLoop() {
      idleBob(leftControls);
      idleBob(rightControls);

      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));

      while (!cancelled && currentLeftHp > 0 && currentRightHp > 0) {
        const attackerIsLeft = Math.random() > 0.5;
        const attackerControls = attackerIsLeft ? leftControls : rightControls;
        const defenderControls = attackerIsLeft ? rightControls : leftControls;
        const lungeDir = attackerIsLeft ? 1 : -1;

        if (attackerIsLeft) setLeftState("lunge");
        else setRightState("lunge");

        await attackerControls.start({
          x: lungeDir * 80,
          y: 0,
          transition: { duration: 0.35, ease: "easeIn" },
        });

        if (cancelled) break;

        triggerClash(canvasRef.current);

        if (attackerIsLeft) {
          currentRightHp--;
          setRightState("hit");
          setLeftState("recoil");
        } else {
          currentLeftHp--;
          setLeftState("hit");
          setRightState("recoil");
        }

        await Promise.all([
          attackerControls.start({
            x: lungeDir * 40,
            transition: { duration: 0.15, ease: "easeOut" },
          }),
          defenderControls.start({
            x: -lungeDir * 25,
            transition: { duration: 0.15, ease: "easeOut" },
          }),
        ]);

        await new Promise(r => setTimeout(r, 150));

        await Promise.all([
          attackerControls.start({ x: 0, y: 0, transition: { duration: 0.5, ease: "easeOut" } }),
          defenderControls.start({ x: 0, transition: { duration: 0.5, ease: "easeOut" } }),
        ]);

        if (attackerIsLeft) {
          setLeftState("idle");
          setRightState(currentRightHp <= 0 ? "dying" : "idle");
        } else {
          setRightState("idle");
          setLeftState(currentLeftHp <= 0 ? "dying" : "idle");
        }

        if (cancelled || currentLeftHp <= 0 || currentRightHp <= 0) break;

        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
      }

      if (cancelled) return;

      const loserControls = currentLeftHp <= 0 ? leftControls : rightControls;
      if (currentLeftHp <= 0) setLeftState("dying");
      else setRightState("dying");

      await loserControls.start({
        opacity: 0,
        y: 40,
        transition: { duration: 1.2, ease: "easeIn" },
      });

      if (cancelled) return;

      setRoundVisible(false);
      await new Promise(r => setTimeout(r, 1500));
      if (cancelled) return;

      startNewRound();
    }

    fightLoop();

    return () => { cancelled = true; };
  }, [leftFighter.race, rightFighter.race, leftControls, rightControls, triggerClash, startNewRound, leftFighter.startingHp, rightFighter.startingHp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    function spawnAmbientParticle() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      const r = Math.random();
      const type: Particle["type"] = r < 0.38 ? "ember" : r < 0.60 ? "spark" : r < 0.78 ? "orb" : r < 0.90 ? "smoke" : "lightning";

      let x: number, y: number, vx: number, vy: number, size: number, hue: number, maxLife: number;

      switch (type) {
        case "ember":
          x = Math.random() * w; y = h * (0.3 + Math.random() * 0.7);
          vx = (Math.random() - 0.5) * 1.5; vy = -(0.5 + Math.random() * 1.5);
          size = 1.5 + Math.random() * 3; hue = 20 + Math.random() * 30; maxLife = 60 + Math.random() * 100;
          break;
        case "spark":
          x = Math.random() * w; y = h * (0.4 + Math.random() * 0.5);
          vx = (Math.random() - 0.5) * 3; vy = -(1 + Math.random() * 3);
          size = 1 + Math.random() * 2; hue = 35 + Math.random() * 20; maxLife = 30 + Math.random() * 50;
          break;
        case "orb":
          x = Math.random() * w; y = h * (0.1 + Math.random() * 0.8);
          vx = (Math.random() - 0.5) * 0.6; vy = (Math.random() - 0.5) * 0.6;
          size = 3 + Math.random() * 6; hue = 180 + Math.random() * 180; maxLife = 120 + Math.random() * 180;
          break;
        case "smoke":
          x = Math.random() * w; y = h * (0.5 + Math.random() * 0.5);
          vx = (Math.random() - 0.5) * 0.4; vy = -(0.2 + Math.random() * 0.5);
          size = 20 + Math.random() * 40; hue = 220 + Math.random() * 40; maxLife = 150 + Math.random() * 150;
          break;
        case "lightning":
        default:
          x = Math.random() * w; y = h * (0.05 + Math.random() * 0.4);
          vx = 0; vy = 0;
          size = 40 + Math.random() * 80; hue = 200 + Math.random() * 60; maxLife = 8 + Math.random() * 12;
          break;
      }

      particlesRef.current.push({ x, y, vx, vy, life: 0, maxLife, size, type, hue, alpha: 0 });
    }

    let frameCount = 0;
    function loop() {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      frameCount++;
      const spawnRate = frameCount % 2 === 0 ? 3 : 2;
      for (let i = 0; i < spawnRate; i++) {
        if (particlesRef.current.length < 280) spawnAmbientParticle();
      }

      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);

      for (const p of particlesRef.current) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        const progress = p.life / p.maxLife;
        const fadeIn = Math.min(progress * 5, 1);
        const fadeOut = 1 - Math.pow(progress, 2);
        p.alpha = fadeIn * fadeOut;

        if (p.type === "impact") {
          p.vy += 0.15;
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          grd.addColorStop(0, `hsla(${p.hue}, 100%, 95%, ${p.alpha})`);
          grd.addColorStop(0.4, `hsla(${p.hue + 15}, 100%, 70%, ${p.alpha * 0.7})`);
          grd.addColorStop(1, `hsla(${p.hue + 30}, 100%, 50%, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.9;
          ctx.strokeStyle = `hsl(${p.hue}, 100%, 85%)`;
          ctx.lineWidth = p.size * 0.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "ember") {
          p.vx += (Math.random() - 0.5) * 0.1;
          p.vy += (Math.random() - 0.5) * 0.05;
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grd.addColorStop(0, `hsla(${p.hue}, 100%, 90%, ${p.alpha})`);
          grd.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "spark") {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = `hsl(${p.hue}, 100%, 80%)`;
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "orb") {
          const pulse = 0.7 + 0.3 * Math.sin(p.life * 0.08);
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * pulse);
          grd.addColorStop(0, `hsla(${p.hue}, 100%, 90%, ${p.alpha * 0.9})`);
          grd.addColorStop(0.5, `hsla(${p.hue}, 80%, 60%, ${p.alpha * 0.4})`);
          grd.addColorStop(1, `hsla(${p.hue}, 70%, 40%, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "smoke") {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.12;
          ctx.fillStyle = `hsl(${p.hue}, 20%, 70%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + progress), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "lightning") {
          ctx.save();
          ctx.globalAlpha = p.alpha * 0.85;
          ctx.strokeStyle = `hsla(${p.hue}, 100%, 90%, 1)`;
          ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 1.5 + Math.random() * 1.5;
          ctx.beginPath();
          let lx = p.x;
          let ly = p.y;
          const segments = 6 + Math.floor(Math.random() * 4);
          const segLen = p.size / segments;
          ctx.moveTo(lx, ly);
          for (let s = 0; s < segments; s++) {
            lx += (Math.random() - 0.5) * segLen * 1.2;
            ly += segLen * (0.6 + Math.random() * 0.4);
            ctx.lineTo(lx, ly);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const leftPortrait = `/portraits/${leftFighter.race}_${leftFighter.gender}.png`;
  const rightPortrait = `/portraits/${rightFighter.race}_${rightFighter.gender}.png`;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)`, transition: "transform 0.05s ease-out" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #0a0314 0%, #10062a 30%, #1a0a3a 60%, #0d0520 100%)",
        }}
      />

      <img
        src="/races-battle.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ opacity: 0.07, mixBlendMode: "screen" }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%),
            radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.85) 0%, transparent 60%)
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <AnimatePresence>
        {roundVisible && (
          <motion.div
            key={`${leftFighter.race}-${rightFighter.race}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div
              className="absolute inset-0 flex justify-around"
              style={{ paddingLeft: "5%", paddingRight: "5%", alignItems: "flex-end", paddingBottom: "4%" }}
            >
              <motion.div
                animate={leftControls}
                initial={{ x: 0, y: 0, opacity: 1, scaleX: 1 }}
                className="relative flex flex-col items-center"
                style={{ width: "clamp(140px, 18vw, 280px)" }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 50% 60%, rgba(120,60,200,0.35) 0%, transparent 70%)",
                    filter: "blur(20px)",
                    transform: "scale(1.3)",
                  }}
                />
                <img
                  src={leftPortrait}
                  alt={leftFighter.race}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    filter: leftState === "hit"
                      ? "brightness(2) saturate(0.3) drop-shadow(0 0 12px rgba(255,100,50,0.9))"
                      : leftState === "dying"
                      ? "brightness(0.5) saturate(0)"
                      : "brightness(1.05) drop-shadow(0 0 18px rgba(100,60,200,0.5))",
                    transition: "filter 0.15s ease",
                  }}
                />
              </motion.div>

              <motion.div
                animate={rightControls}
                initial={{ x: 0, y: 0, opacity: 1, scaleX: -1 }}
                className="relative flex flex-col items-center"
                style={{ width: "clamp(140px, 18vw, 280px)" }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 50% 60%, rgba(200,60,60,0.35) 0%, transparent 70%)",
                    filter: "blur(20px)",
                    transform: "scale(1.3)",
                  }}
                />
                <img
                  src={rightPortrait}
                  alt={rightFighter.race}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    filter: rightState === "hit"
                      ? "brightness(2) saturate(0.3) drop-shadow(0 0 12px rgba(255,100,50,0.9))"
                      : rightState === "dying"
                      ? "brightness(0.5) saturate(0)"
                      : "brightness(1.05) drop-shadow(0 0 18px rgba(200,60,60,0.5))",
                    transition: "filter 0.15s ease",
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: "screen" }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: `rgba(255, 160, 60, ${flashOpacity})`,
          transition: "background-color 0.05s ease-out",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "30%",
          background: "linear-gradient(to top, rgba(80,30,10,0.3), transparent)",
        }}
      />
    </div>
  );
}
