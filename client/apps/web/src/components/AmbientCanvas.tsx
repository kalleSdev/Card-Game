/**
 * AmbientCanvas — Layer B per-screen particle effects.
 *
 * Each theme produces different particles rendered on a fixed full-screen canvas.
 * Runs a requestAnimationFrame loop; all particles are pooled and recycled.
 */

import { useEffect, useRef } from "react";

export type AmbientTheme =
  | "embers"      // draft: slow-falling orange/red embers + rising sparks
  | "wisps"       // vow: drifting purple/red cursed-energy wisps
  | "rain"        // resolution: diagonal golden light streaks falling
  | "dust"        // placement: slow-falling dark dust motes, slightly luminous
  | "sparks"      // reveal: drifting upward multi-colour sparks
  | "snow"        // coinflip: tiny purple/white drifting particles
  | "energy"      // setup: subtle blue floating energy orbs

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number; alphaDecay: number;
  color: string;
  life: number; maxLife: number;
  // wisps: wobble
  wobbleAmp?: number; wobbleSpeed?: number; wobbleOffset?: number;
}

// ── Theme configs ─────────────────────────────────────────────────────────────
type ThemeConfig = {
  maxParticles: number;
  spawnPerFrame: number;
  spawn: (w: number, h: number, t: number) => Particle;
  update: (p: Particle, t: number) => void;
  draw: (ctx: CanvasRenderingContext2D, p: Particle) => void;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeEmbers(w: number, h: number): Particle {
  const rising = Math.random() < 0.35;
  return {
    x: rand(0, w), y: rising ? rand(h * 0.4, h) : -8,
    vx: rand(-0.7, 0.7), vy: rising ? rand(-0.8, -2.0) : rand(0.5, 1.4),
    size: rand(1.6, 4.0), alpha: rand(0.7, 1.0), alphaDecay: rand(0.003, 0.007),
    color: Math.random() < 0.5 ? "#ff6622" : Math.random() < 0.5 ? "#ffaa22" : "#ff3300",
    life: 0, maxLife: 999,
  };
}

function makeWisp(w: number, h: number): Particle {
  return {
    x: rand(0, w), y: rand(h * 0.2, h),
    vx: rand(-0.3, 0.3), vy: rand(-0.4, -0.9),
    size: rand(5, 14), alpha: rand(0.45, 0.75), alphaDecay: rand(0.002, 0.005),
    color: Math.random() < 0.5 ? "#aa22ff" : Math.random() < 0.5 ? "#cc0044" : "#8800cc",
    life: 0, maxLife: 999,
    wobbleAmp: rand(14, 36), wobbleSpeed: rand(0.015, 0.04), wobbleOffset: rand(0, Math.PI * 2),
  };
}

function makeRainStreak(w: number, h: number): Particle {
  const angle = 0.35;
  const len = rand(24, 60);
  return {
    x: rand(-50, w + 50), y: rand(-50, h * 0.6),
    vx: Math.sin(angle) * rand(2.5, 5),
    vy: Math.cos(angle) * rand(4, 8),
    size: len, alpha: rand(0.22, 0.50), alphaDecay: 0,
    color: Math.random() < 0.6 ? "#ffd700" : "#ffffff",
    life: 0, maxLife: 999,
  };
}

function makeDust(w: number, h: number): Particle {
  return {
    x: rand(0, w), y: rand(-10, h * 0.5),
    vx: rand(-0.25, 0.25), vy: rand(0.18, 0.6),
    size: rand(1.2, 3.0), alpha: rand(0.35, 0.65), alphaDecay: rand(0.001, 0.003),
    color: Math.random() < 0.5 ? "#9999bb" : "#bbbbdd",
    life: 0, maxLife: 999,
  };
}

function makeSpark(w: number, h: number): Particle {
  const colors = ["#ff44cc", "#44aaff", "#ffd700", "#44ff88", "#ff6633", "#cc44ff"];
  return {
    x: rand(0, w), y: rand(h * 0.3, h),
    vx: rand(-0.8, 0.8), vy: rand(-1.0, -2.5),
    size: rand(1.8, 3.5), alpha: rand(0.75, 1.0), alphaDecay: rand(0.004, 0.010),
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 0, maxLife: 999,
  };
}

function makeSnow(w: number, h: number): Particle {
  return {
    x: rand(0, w), y: rand(-10, h * 0.3),
    vx: rand(-0.4, 0.4), vy: rand(0.25, 0.7),
    size: rand(1.2, 3.2), alpha: rand(0.45, 0.80), alphaDecay: rand(0.001, 0.003),
    color: Math.random() < 0.6 ? "#dd99ff" : "#ffffff",
    life: 0, maxLife: 999,
    wobbleAmp: rand(5, 16), wobbleSpeed: rand(0.02, 0.05), wobbleOffset: rand(0, Math.PI * 2),
  };
}

function makeEnergy(w: number, h: number): Particle {
  return {
    x: rand(0, w), y: rand(h * 0.2, h),
    vx: rand(-0.2, 0.2), vy: rand(-0.4, -0.8),
    size: rand(3, 7), alpha: rand(0.35, 0.65), alphaDecay: rand(0.001, 0.003),
    color: Math.random() < 0.6 ? "#4488ff" : "#aaccff",
    life: 0, maxLife: 999,
    wobbleAmp: rand(8, 20), wobbleSpeed: rand(0.01, 0.03), wobbleOffset: rand(0, Math.PI * 2),
  };
}

const THEMES: Record<AmbientTheme, ThemeConfig> = {
  embers: {
    maxParticles: 160, spawnPerFrame: 1.4,
    spawn: makeEmbers,
    update(p, _t) {
      p.x += p.vx + (Math.random() - 0.5) * 0.3;
      p.y += p.vy;
      p.alpha -= p.alphaDecay;
      p.life++;
    },
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    },
  },
  wisps: {
    maxParticles: 55, spawnPerFrame: 0.5,
    spawn: makeWisp,
    update(p, t) {
      const wobble = (p.wobbleAmp ?? 0) * Math.sin((t + (p.wobbleOffset ?? 0)) * (p.wobbleSpeed ?? 0.02));
      p.x += p.vx + wobble * 0.05;
      p.y += p.vy;
      p.alpha -= p.alphaDecay;
      p.size += 0.012;
      p.life++;
    },
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0"));
      g.addColorStop(0.5, p.color + Math.round(p.alpha * 0.4 * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    },
  },
  rain: {
    maxParticles: 200, spawnPerFrame: 3.0,
    spawn: makeRainStreak,
    update(p, _t) {
      p.x += p.vx; p.y += p.vy;
      p.life++;
      // fade out streaks that are old
      if (p.life > 30) p.alpha -= 0.006;
    },
    draw(ctx, p) {
      const endX = p.x - p.vx * (p.size / 5);
      const endY = p.y - p.vy * (p.size / 5);
      const g = ctx.createLinearGradient(endX, endY, p.x, p.y);
      const hex = Math.round(p.alpha * 255).toString(16).padStart(2, "0");
      g.addColorStop(0, "transparent");
      g.addColorStop(1, p.color + hex);
      ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke();
    },
  },
  dust: {
    maxParticles: 110, spawnPerFrame: 0.9,
    spawn: makeDust,
    update(p, _t) {
      p.x += p.vx + (Math.random() - 0.5) * 0.15;
      p.y += p.vy;
      p.alpha -= p.alphaDecay;
      p.life++;
    },
    draw(ctx, p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
    },
  },
  sparks: {
    maxParticles: 160, spawnPerFrame: 1.8,
    spawn: makeSpark,
    update(p, _t) {
      p.x += p.vx; p.y += p.vy;
      p.vy -= 0.01; // slight float
      p.alpha -= p.alphaDecay;
      p.life++;
    },
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, p.color + "ff");
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    },
  },
  snow: {
    maxParticles: 120, spawnPerFrame: 1.0,
    spawn: makeSnow,
    update(p, t) {
      const w = (p.wobbleAmp ?? 0) * Math.sin((t + (p.wobbleOffset ?? 0)) * (p.wobbleSpeed ?? 0.03));
      p.x += p.vx + w * 0.04;
      p.y += p.vy;
      p.alpha -= p.alphaDecay;
      p.life++;
    },
    draw(ctx, p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
    },
  },
  energy: {
    maxParticles: 80, spawnPerFrame: 0.65,
    spawn: makeEnergy,
    update(p, t) {
      const w = (p.wobbleAmp ?? 0) * Math.sin((t + (p.wobbleOffset ?? 0)) * (p.wobbleSpeed ?? 0.02));
      p.x += p.vx + w * 0.03;
      p.y += p.vy;
      p.alpha -= p.alphaDecay;
      p.size += 0.01;
      p.life++;
    },
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      g.addColorStop(0, p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AmbientCanvas({ theme }: { theme: AmbientTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = THEMES[theme];
    const particles: Particle[] = [];
    let raf = 0;
    let t = 0;
    let spawnAccum = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      t++;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      // Spawn
      spawnAccum += cfg.spawnPerFrame;
      while (spawnAccum >= 1 && particles.length < cfg.maxParticles) {
        particles.push(cfg.spawn(w, h, t));
        spawnAccum -= 1;
      }

      // Update + draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        cfg.update(p, t);
        // Recycle when off-screen or faded
        if (p.alpha <= 0 || p.x < -60 || p.x > w + 60 || p.y < -80 || p.y > h + 80) {
          particles.splice(i, 1);
          continue;
        }
        cfg.draw(ctx, p);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0,
        width: "100vw", height: "100vh",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}
