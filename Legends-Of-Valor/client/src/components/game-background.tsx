import { useEffect, useRef } from "react";

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

export default function GameBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const orbsRef = useRef<Orb[]>([]);
  const embersRef = useRef<Ember[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnOrb = () => {
      if (!canvas) return;
      orbsRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: 5 + Math.random() * 10,
        hue: 200 + Math.random() * 160,
        life: 0,
        maxLife: 250 + Math.random() * 350,
      });
    };

    const spawnEmber = () => {
      if (!canvas) return;
      embersRef.current.push({
        x: Math.random() * canvas.width,
        y: canvas.height * (0.4 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.3 + Math.random() * 0.8),
        size: 1.2 + Math.random() * 2,
        life: 0,
        maxLife: 80 + Math.random() * 120,
      });
    };

    for (let i = 0; i < 15; i++) spawnOrb();
    for (let i = 0; i < 20; i++) spawnEmber();

    let frame = 0;
    const loop = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      if (frame % 18 === 0 && orbsRef.current.length < 25) spawnOrb();
      if (frame % 4 === 0 && embersRef.current.length < 60) spawnEmber();

      orbsRef.current = orbsRef.current.filter(o => o.life < o.maxLife);
      embersRef.current = embersRef.current.filter(e => e.life < e.maxLife);

      for (const o of orbsRef.current) {
        o.life++;
        o.x += o.vx;
        o.y += o.vy;
        const p = o.life / o.maxLife;
        const alpha = Math.min(p * 4, 1) * (1 - p) * 0.28;
        const pulse = 0.75 + 0.25 * Math.sin(o.life * 0.05);
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.size * pulse);
        grd.addColorStop(0, `hsla(${o.hue}, 90%, 80%, ${alpha})`);
        grd.addColorStop(0.5, `hsla(${o.hue}, 70%, 55%, ${alpha * 0.4})`);
        grd.addColorStop(1, `hsla(${o.hue}, 60%, 40%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const e of embersRef.current) {
        e.life++;
        e.x += e.vx + (Math.random() - 0.5) * 0.12;
        e.y += e.vy;
        const p = e.life / e.maxLife;
        const alpha = Math.min(p * 6, 1) * (1 - p) * 0.55;
        const hue = 20 + Math.random() * 25;
        const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size);
        grd.addColorStop(0, `hsla(${hue}, 100%, 90%, ${alpha})`);
        grd.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <img
        src="/races-battle.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(0.32) saturate(0.75)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(8,4,20,0.5) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 100%, rgba(5,2,14,0.85) 0%, transparent 55%),
            linear-gradient(to bottom,
              rgba(8,4,20,0.55) 0%,
              rgba(6,3,16,0.35) 40%,
              rgba(6,3,16,0.35) 60%,
              rgba(8,4,20,0.65) 100%
            )
          `,
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ mixBlendMode: "screen", opacity: 0.6 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(4,2,12,0.65) 100%)",
        }}
      />
    </div>
  );
}
