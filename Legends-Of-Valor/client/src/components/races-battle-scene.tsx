import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "ember" | "spark" | "orb" | "smoke" | "lightning";
  hue: number;
  alpha: number;
}

export default function RacesBattleScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [shakeX, setShakeX] = useState(0);
  const [shakeY, setShakeY] = useState(0);
  const imageControls = useAnimation();

  const kenBurnsKeyframes = [
    { scale: 1.0, x: 0, y: 0 },
    { scale: 1.12, x: -30, y: -20 },
    { scale: 1.08, x: 20, y: -10 },
    { scale: 1.15, x: -15, y: 15 },
    { scale: 1.05, x: 10, y: -25 },
    { scale: 1.0, x: 0, y: 0 },
  ];

  useEffect(() => {
    let frameIndex = 0;
    let cancelled = false;

    async function runKenBurns() {
      while (!cancelled) {
        const from = kenBurnsKeyframes[frameIndex % kenBurnsKeyframes.length];
        const to = kenBurnsKeyframes[(frameIndex + 1) % kenBurnsKeyframes.length];
        frameIndex++;

        await imageControls.start({
          scale: to.scale,
          x: to.x,
          y: to.y,
          transition: { duration: 6, ease: "easeInOut" },
        });
      }
    }

    imageControls.set(kenBurnsKeyframes[0]);
    runKenBurns();

    return () => {
      cancelled = true;
    };
  }, [imageControls]);

  useEffect(() => {
    let clashTimeout: ReturnType<typeof setTimeout>;

    function triggerClash() {
      setFlashOpacity(0.55);
      const shx = (Math.random() - 0.5) * 14;
      const shy = (Math.random() - 0.5) * 10;
      setShakeX(shx);
      setShakeY(shy);

      setTimeout(() => {
        setFlashOpacity(0.2);
        setShakeX(-shx * 0.5);
        setShakeY(-shy * 0.5);
      }, 80);

      setTimeout(() => {
        setFlashOpacity(0);
        setShakeX(0);
        setShakeY(0);
      }, 200);

      const nextDelay = 8000 + Math.random() * 4000;
      clashTimeout = setTimeout(triggerClash, nextDelay);
    }

    const initialDelay = 4000 + Math.random() * 4000;
    clashTimeout = setTimeout(triggerClash, initialDelay);

    return () => clearTimeout(clashTimeout);
  }, []);

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

    function spawnParticle() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;

      const type = (() => {
        const r = Math.random();
        if (r < 0.38) return "ember";
        if (r < 0.60) return "spark";
        if (r < 0.78) return "orb";
        if (r < 0.90) return "smoke";
        return "lightning";
      })() as Particle["type"];

      let x: number, y: number, vx: number, vy: number, size: number, hue: number, maxLife: number;

      switch (type) {
        case "ember":
          x = Math.random() * w;
          y = h * (0.3 + Math.random() * 0.7);
          vx = (Math.random() - 0.5) * 1.5;
          vy = -(0.5 + Math.random() * 1.5);
          size = 1.5 + Math.random() * 3;
          hue = 20 + Math.random() * 30;
          maxLife = 60 + Math.random() * 100;
          break;
        case "spark":
          x = Math.random() * w;
          y = h * (0.4 + Math.random() * 0.5);
          vx = (Math.random() - 0.5) * 3;
          vy = -(1 + Math.random() * 3);
          size = 1 + Math.random() * 2;
          hue = 35 + Math.random() * 20;
          maxLife = 30 + Math.random() * 50;
          break;
        case "orb":
          x = Math.random() * w;
          y = h * (0.1 + Math.random() * 0.8);
          vx = (Math.random() - 0.5) * 0.6;
          vy = (Math.random() - 0.5) * 0.6;
          size = 3 + Math.random() * 6;
          hue = 180 + Math.random() * 180;
          maxLife = 120 + Math.random() * 180;
          break;
        case "smoke":
          x = Math.random() * w;
          y = h * (0.5 + Math.random() * 0.5);
          vx = (Math.random() - 0.5) * 0.4;
          vy = -(0.2 + Math.random() * 0.5);
          size = 20 + Math.random() * 40;
          hue = 220 + Math.random() * 40;
          maxLife = 150 + Math.random() * 150;
          break;
        case "lightning":
          x = Math.random() * w;
          y = h * (0.05 + Math.random() * 0.4);
          vx = 0;
          vy = 0;
          size = 40 + Math.random() * 80;
          hue = 200 + Math.random() * 60;
          maxLife = 8 + Math.random() * 12;
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
        if (particlesRef.current.length < 250) spawnParticle();
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

        if (p.type === "ember") {
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

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)`, transition: "transform 0.05s ease-out" }}
    >
      <motion.div
        animate={imageControls}
        className="absolute inset-0 w-full h-full"
        style={{ willChange: "transform" }}
      >
        <img
          src="/races-battle.png"
          alt="Playable Races Battle Scene"
          className="w-full h-full object-cover"
          style={{ filter: "brightness(0.75) saturate(1.2)" }}
        />
      </motion.div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%),
            radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.8) 0%, transparent 60%)
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(to bottom,
              rgba(15,5,30,0.55) 0%,
              transparent 30%,
              transparent 70%,
              rgba(10,3,20,0.7) 100%
            )
          `,
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "35%",
          background: "linear-gradient(to top, rgba(80,30,10,0.25), transparent)",
        }}
      />

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
    </div>
  );
}
