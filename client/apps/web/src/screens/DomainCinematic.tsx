import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Expansion Cinematic
//
// Character-specific spectacle when a player activates their domain.
// Phases: flash → build → peak → hold → exit (total ~4.2s)
//
// Each domain style has unique:
//   • Color palette and background
//   • Canvas particle system
//   • Geometric SVG decorations
//   • Japanese + English domain name typography
// ─────────────────────────────────────────────────────────────────────────────

type DomainKind =
  | "void"      // Gojo — Infinite Void: infinite blue starfield, concentric rings
  | "shrine"    // Sukuna — Malevolent Shrine: red slashes, torii, debris
  | "transfig"  // Mahito — Self-Embodiment: cold distortion waves
  | "coffin"    // Jogo — Coffin: volcanic fire, magma rising
  | "horizon"   // Dagon — Horizon: ocean depth, wave rings
  | "shadow"    // Megumi — Chimera Shadow: ink spreading from center
  | "love"      // Yuta — True Love: ethereal purple/pink
  | "uzumaki"   // Geto — Maximum Uzumaki: curse spirit vortex
  | "gamble"    // Hakari — Idle Death Gamble: casino sparks, jackpot
  | "judgment"  // Higuruma — Deadly Sentencing: courtroom gold
  | "demon"     // Dabura — Demon Realm: dark crimson
  | "default";  // Generic cursed technique: purple/gold burst

interface DomainTheme {
  nameJP: string;
  nameEN: string;
  technique: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  kind: DomainKind;
}

const THEMES: Record<string, DomainTheme> = {
  "gojo-base": {
    nameJP: "無量空処", nameEN: "Unlimited Void", technique: "Infinite Void",
    primary: "#00aaff", secondary: "#6633ff", accent: "#ffffff",
    bg: "#000814", kind: "void",
  },
  "sukuna": {
    nameJP: "伏魔御廚子", nameEN: "Malevolent Shrine", technique: "Dismantle & Cleave",
    primary: "#cc2200", secondary: "#cc8800", accent: "#ff4422",
    bg: "#0e0000", kind: "shrine",
  },
  "mahito": {
    nameJP: "蕩蕩滅覚", nameEN: "Self-Embodiment of Perfection", technique: "Idle Transfiguration",
    primary: "#5577cc", secondary: "#334466", accent: "#aabbdd",
    bg: "#080c14", kind: "transfig",
  },
  "jogo": {
    nameJP: "蓋棺鉄囲山", nameEN: "Coffin of the Iron Mountain", technique: "Disaster Flames",
    primary: "#ff6600", secondary: "#cc2200", accent: "#ffaa00",
    bg: "#0e0400", kind: "coffin",
  },
  "dagon": {
    nameJP: "摂受魚籃色身", nameEN: "Horizon of the Captivating Skandha", technique: "Disaster Sea",
    primary: "#0077cc", secondary: "#005588", accent: "#22aadd",
    bg: "#000c18", kind: "horizon",
  },
  "megumi": {
    nameJP: "嵌合暗翳庭", nameEN: "Chimera Shadow Garden", technique: "Ten Shadows Technique",
    primary: "#2244aa", secondary: "#112233", accent: "#4466cc",
    bg: "#000208", kind: "shadow",
  },
  "yuta": {
    nameJP: "真贋相愛", nameEN: "True Mutual Love", technique: "True Love's Curse",
    primary: "#cc44ff", secondary: "#880088", accent: "#ff88ff",
    bg: "#0e0018", kind: "love",
  },
  "geto": {
    nameJP: "「うずまき」", nameEN: "Maximum: Uzumaki", technique: "Cursed Spirit Manipulation",
    primary: "#aa22ff", secondary: "#440066", accent: "#cc66ff",
    bg: "#080010", kind: "uzumaki",
  },
  "hakari": {
    nameJP: "不戦敗賭博", nameEN: "Idle Death Gamble", technique: "Jackpot-Infinite CE",
    primary: "#ffcc00", secondary: "#cc6600", accent: "#ffee44",
    bg: "#0c0800", kind: "gamble",
  },
  "higuruma": {
    nameJP: "死刑宣告", nameEN: "Deadly Sentencing", technique: "Judgeman",
    primary: "#ddaa00", secondary: "#886600", accent: "#ffffff",
    bg: "#0a0800", kind: "judgment",
  },
  "dabura": {
    nameJP: "魔界", nameEN: "Demon Realm", technique: "Darkness Sword",
    primary: "#880022", secondary: "#330000", accent: "#ff2255",
    bg: "#0a0000", kind: "demon",
  },
};

const DEFAULT_THEME: DomainTheme = {
  nameJP: "領域展開", nameEN: "Domain Expansion", technique: "Cursed Technique",
  primary: "#8833cc", secondary: "#330066", accent: "#cc88ff",
  bg: "#060010", kind: "default",
};

// ── Canvas particle systems ───────────────────────────────────────────────────
function DomainCanvas({ kind, primary, secondary, accent }: {
  kind: DomainKind; primary: string; secondary: string; accent: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H / 2;
    let raf = 0, t = 0;

    const hexToRgb = (hex: string): [number, number, number] => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };
    const [pr, pg, pb] = hexToRgb(primary);
    const [sr, sg, sb] = hexToRgb(secondary);
    const [ar, ag, ab] = hexToRgb(accent);

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; r: number; speed: number;
    }

    if (kind === "void") {
      // Stars radiating outward from center — infinite void
      const stars: Array<Particle & { angle: number; dist: number }> = [];
      for (let i = 0; i < 400; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30;
        const speed = 2 + Math.random() * 8;
        stars.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: Math.random(), maxLife: 0.8 + Math.random() * 0.2,
          r: 1 + Math.random() * 2.5, speed, angle, dist });
      }
      const loop = () => {
        ctx.fillStyle = `rgba(0,8,20,0.18)`;
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const s of stars) {
          s.x += s.vx; s.y += s.vy;
          s.vx *= 1.018; s.vy *= 1.018; // accelerate outward
          s.life += 0.008;
          if (s.life > s.maxLife) {
            // Reset star from center
            const a = Math.random() * Math.PI * 2;
            s.x = cx; s.y = cy;
            s.vx = Math.cos(a) * s.speed * 0.3; s.vy = Math.sin(a) * s.speed * 0.3;
            s.vx *= 1.05; s.vy *= 1.05;
            s.life = 0;
          }
          const alpha = Math.min(s.life / 0.2, 1) * Math.max(0, 1 - s.life / s.maxLife);
          ctx.globalAlpha = alpha * 0.9;
          const progress = s.life / s.maxLife;
          const r = sr + (pr - sr) * progress;
          const g = sg + (pg - sg) * progress;
          const b = sb + (pb - sb) * progress;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * (0.3 + progress * 0.7), 0, Math.PI * 2);
          ctx.fill();
        }
        // Concentric expanding rings
        for (let i = 0; i < 5; i++) {
          const phase = ((t * 0.4 + i * 0.2) % 1);
          const radius = phase * Math.max(W, H) * 0.75;
          ctx.globalAlpha = (1 - phase) * 0.35;
          ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
          ctx.lineWidth = 2 - phase * 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else if (kind === "shrine") {
      // Debris fragments fly outward + red energy pulses
      interface Fragment { x: number; y: number; vx: number; vy: number; rot: number; vrot: number; w: number; h: number; life: number }
      const frags: Fragment[] = [];
      for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 14;
        frags.push({ x: cx + (Math.random()-0.5)*40, y: cy + (Math.random()-0.5)*40,
          vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 2,
          rot: Math.random()*Math.PI*2, vrot: (Math.random()-0.5)*0.15,
          w: 6 + Math.random()*28, h: 4 + Math.random()*14, life: 1 });
      }
      const loop = () => {
        ctx.fillStyle = "rgba(14,0,0,0.20)";
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const f of frags) {
          f.x += f.vx; f.y += f.vy;
          f.vy += 0.18; f.vx *= 0.993; f.life -= 0.006; f.rot += f.vrot;
          if (f.life <= 0) {
            const a = Math.random() * Math.PI * 2, s = 4 + Math.random()*12;
            f.x = cx; f.y = cy; f.vx = Math.cos(a)*s; f.vy = Math.sin(a)*s - 3;
            f.life = 0.7 + Math.random()*0.3;
          }
          ctx.globalAlpha = f.life * 0.75;
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          const g = ctx.createLinearGradient(-f.w/2, 0, f.w/2, 0);
          g.addColorStop(0, `rgb(${pr},${pg},${pb})`);
          g.addColorStop(1, `rgb(${sr},${sg},${sb})`);
          ctx.fillStyle = g;
          ctx.fillRect(-f.w/2, -f.h/2, f.w, f.h);
          ctx.restore();
        }
        // Radial slash burst lines
        const numSlashes = 8;
        for (let i = 0; i < numSlashes; i++) {
          const angle = (i / numSlashes) * Math.PI * 2 + t * 0.3;
          const len = (0.6 + 0.4 * Math.abs(Math.sin(t * 2 + i))) * Math.max(W, H) * 0.65;
          ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 3 + i);
          ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
          ctx.lineWidth = 1 + Math.abs(Math.sin(t + i * 0.5));
          ctx.beginPath();
          ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle)*len, cy + Math.sin(angle)*len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else if (kind === "coffin") {
      // Fire/ember particles rising from bottom
      interface Ember { x: number; y: number; vx: number; vy: number; life: number; r: number }
      const embers: Ember[] = [];
      for (let i = 0; i < 350; i++) {
        embers.push({ x: cx + (Math.random()-0.5)*W*0.8, y: H + Math.random()*200,
          vx: (Math.random()-0.5)*3, vy: -(4 + Math.random()*10),
          life: Math.random(), r: 2 + Math.random()*8 });
      }
      const loop = () => {
        ctx.fillStyle = "rgba(14,4,0,0.22)";
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const e of embers) {
          e.x += e.vx + Math.sin(t * 2 + e.y * 0.01) * 0.5;
          e.y += e.vy; e.vx *= 0.99; e.life -= 0.007;
          if (e.life <= 0 || e.y < -50) {
            e.x = cx + (Math.random()-0.5)*W*0.7; e.y = H + 20;
            e.vy = -(3 + Math.random()*12); e.vx = (Math.random()-0.5)*3;
            e.life = 0.6 + Math.random()*0.4; e.r = 2 + Math.random()*8;
          }
          const phase = 1 - e.life;
          const r = pr + (ar - pr) * phase;
          const g = pg + (ag - pg) * phase;
          const b = pb + (ab - pb) * phase;
          ctx.globalAlpha = e.life * 0.8;
          const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
          grad.addColorStop(0, `rgb(255,220,${Math.round(b*0.3)})`);
          grad.addColorStop(0.4, `rgb(${Math.round(r)},${Math.round(g*0.5)},0)`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else if (kind === "horizon") {
      // Ocean waves — concentric oval ripples + blue particles
      const loop = () => {
        ctx.fillStyle = "rgba(0,12,24,0.2)";
        ctx.fillRect(0, 0, W, H);
        t += 0.012;
        for (let i = 0; i < 7; i++) {
          const phase = ((t * 0.35 + i * 0.143) % 1);
          const rx = phase * W * 0.85, ry = phase * H * 0.55;
          ctx.globalAlpha = (1 - phase) * 0.28;
          ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
          ctx.lineWidth = 2 - phase;
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
        }
        // Floating light particles
        for (let i = 0; i < 3; i++) {
          const x = cx + Math.sin(t * (0.7 + i * 0.3) + i * 2) * W * 0.35;
          const y = cy + Math.cos(t * (0.5 + i * 0.2) + i) * H * 0.25;
          ctx.globalAlpha = 0.15 + 0.05 * Math.sin(t * 3 + i);
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 80);
          grad.addColorStop(0, `rgb(${ar},${ag},${ab})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, 80, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else if (kind === "shadow") {
      // Ink/shadow tendrils spreading from center
      interface Tendril { angle: number; len: number; width: number; speed: number; phase: number }
      const tendrils: Tendril[] = Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        len: 0, width: 6 + Math.random() * 18, speed: 5 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
      }));
      const maxLen = Math.max(W, H) * 0.85;
      const loop = () => {
        ctx.fillStyle = "rgba(0,2,8,0.25)";
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const tr of tendrils) {
          tr.len = Math.min(maxLen, tr.len + tr.speed * (1 + t * 0.5));
          const x2 = cx + Math.cos(tr.angle + Math.sin(t * 0.5 + tr.phase) * 0.15) * tr.len;
          const y2 = cy + Math.sin(tr.angle + Math.sin(t * 0.5 + tr.phase) * 0.15) * tr.len;
          ctx.globalAlpha = 0.6;
          const grad = ctx.createLinearGradient(cx, cy, x2, y2);
          grad.addColorStop(0, `rgb(${pr},${pg},${pb})`);
          grad.addColorStop(0.5, `rgb(${sr},${sg},${sb})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = tr.width * (1 - tr.len / maxLen * 0.7);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else if (kind === "gamble") {
      // Casino sparks — random flashing lights + spiral
      interface Spark { x: number; y: number; vx: number; vy: number; life: number; r: number; hue: number }
      const sparks: Spark[] = [];
      for (let i = 0; i < 300; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 14;
        sparks.push({ x: cx, y: cy, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
          life: Math.random(), r: 1 + Math.random()*4, hue: 40 + Math.random()*40 });
      }
      const loop = () => {
        ctx.fillStyle = "rgba(12,8,0,0.20)";
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const s of sparks) {
          s.x += s.vx; s.y += s.vy; s.vy += 0.08; s.life -= 0.008;
          if (s.life <= 0) {
            const a = Math.random()*Math.PI*2, sp = 2 + Math.random()*15;
            s.x = cx; s.y = cy; s.vx = Math.cos(a)*sp; s.vy = Math.sin(a)*sp;
            s.life = 0.6 + Math.random()*0.4; s.hue = 30 + Math.random()*50;
          }
          ctx.globalAlpha = s.life * 0.85;
          ctx.fillStyle = `hsl(${s.hue},100%,65%)`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
        }
        // Spiral
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 300; i++) {
          const a = i * 0.08 + t, r2 = i * 2.2;
          const x = cx + Math.cos(a) * r2, y = cy + Math.sin(a) * r2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

    } else {
      // Default / love / uzumaki / judgment / demon / transfig — vortex of colored particles
      const particles: Particle[] = [];
      for (let i = 0; i < 280; i++) {
        const angle = Math.random() * Math.PI * 2, dist = 10 + Math.random() * 300;
        particles.push({ x: cx + Math.cos(angle)*dist, y: cy + Math.sin(angle)*dist,
          vx: 0, vy: 0, life: Math.random(), maxLife: 0.7 + Math.random()*0.3,
          r: 1.5 + Math.random()*4, speed: 0.8 + Math.random()*2.5 });
      }
      let i = 0;
      for (const p of particles) { p.vx = -Math.sin(i * 0.22) * p.speed; p.vy = Math.cos(i * 0.22) * p.speed; i++; }
      const loop = () => {
        ctx.fillStyle = "rgba(4,0,10,0.18)";
        ctx.fillRect(0, 0, W, H);
        t += 0.016;
        for (const p of particles) {
          const dx = cx - p.x, dy = cy - p.y;
          const dist2 = Math.sqrt(dx*dx + dy*dy) + 1;
          const attraction = 0.08;
          p.vx += dx / dist2 * attraction; p.vy += dy / dist2 * attraction;
          p.vx *= 0.995; p.vy *= 0.995;
          p.x += p.vx; p.y += p.vy; p.life += 0.006;
          if (p.life > p.maxLife) {
            const angle = Math.random()*Math.PI*2, d = 50 + Math.random()*350;
            p.x = cx + Math.cos(angle)*d; p.y = cy + Math.sin(angle)*d;
            p.life = 0;
          }
          const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.85;
          const progress = p.life / p.maxLife;
          const r = Math.round(pr + (ar - pr) * progress);
          const g = Math.round(pg + (ag - pg) * progress);
          const b = Math.round(pb + (ab - pb) * progress);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        }
        // Rotating radial lines
        for (let j = 0; j < 12; j++) {
          const angle = (j / 12) * Math.PI * 2 + t * 0.4;
          const len2 = (0.5 + 0.25 * Math.sin(t + j)) * Math.min(W, H) * 0.55;
          ctx.globalAlpha = 0.07;
          ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle)*len2, cy + Math.sin(angle)*len2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => { cancelAnimationFrame(raf); };
  }, [kind, primary, secondary, accent]);

  return (
    <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
  );
}

// ── Geometric decorations per domain ─────────────────────────────────────────
function DomainGeometry({ kind, primary, secondary, accent, show }: {
  kind: DomainKind; primary: string; secondary: string; accent: string; show: boolean;
}) {
  if (kind === "void") {
    // Concentric ring frames
    return (
      <AnimatePresence>
        {show && (
          <>
            {[0.28, 0.46, 0.68].map((scale, i) => (
              <motion.div key={i}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: [0.22, 1.2, 0.36, 1] }}
                style={{
                  position: "absolute", left: "50%", top: "50%",
                  width: `${scale * 100}vmin`, height: `${scale * 100}vmin`,
                  transform: "translate(-50%,-50%)",
                  border: `2px solid ${primary}44`, borderRadius: "50%",
                  boxShadow: `0 0 30px ${primary}22, inset 0 0 30px ${primary}11`,
                }}
              />
            ))}
            {/* Six eyes dots */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.div key={`eye-${i}`}
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.3, ease: [0.22, 1.5, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${Math.cos(a) * 22}vmin)`,
                    top: `calc(50% + ${Math.sin(a) * 22}vmin)`,
                    width: 12, height: 12, borderRadius: "50%",
                    background: accent, transform: "translate(-50%,-50%)",
                    boxShadow: `0 0 20px ${accent}, 0 0 40px ${primary}`,
                  }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
    );
  }

  if (kind === "shrine") {
    // Torii gate silhouette — P5 black outline
    return (
      <AnimatePresence>
        {show && (
          <motion.svg
            viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
            initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1.2, 0.36, 1] }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {/* Simplified torii */}
            <rect x="10" y="20" width="80" height="6" fill={primary} fillOpacity="0.5" />
            <rect x="12" y="26" width="76" height="4" fill={secondary} fillOpacity="0.4" />
            <rect x="28" y="30" width="8" height="62" fill={primary} fillOpacity="0.35" />
            <rect x="64" y="30" width="8" height="62" fill={primary} fillOpacity="0.35" />
            {/* Diagonal slash lines across torii */}
            <line x1="0" y1="40" x2="100" y2="55" stroke={accent} strokeOpacity="0.3" strokeWidth="1" />
            <line x1="0" y1="60" x2="100" y2="72" stroke={accent} strokeOpacity="0.2" strokeWidth="0.5" />
          </motion.svg>
        )}
      </AnimatePresence>
    );
  }

  // Default: diagonal P5 bars
  return (
    <AnimatePresence>
      {show && (
        <>
          {[
            { top: "20%", w: "60%", left: "0%", delay: 0 },
            { top: "45%", w: "45%", left: "55%", delay: 0.08 },
            { top: "70%", w: "55%", left: "5%", delay: 0.15 },
          ].map((b, i) => (
            <motion.div key={i}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
              transition={{ delay: b.delay, duration: 0.18, ease: [0.2, 1, 0.3, 1] }}
              style={{
                position: "absolute", top: b.top, left: b.left,
                width: b.w, height: "2px",
                background: `linear-gradient(90deg, ${primary}88, ${primary}22, transparent)`,
                transform: "skewY(-2deg)",
                transformOrigin: "left center",
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

// ── P5 diagonal slash frame bars ─────────────────────────────────────────────
function SlashFrame({ primary, show }: { primary: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Top-left thick bar */}
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.14 }}
            style={{ position: "absolute", top: "8%", left: 0, width: "35%", height: 14,
              background: primary, transformOrigin: "left center", zIndex: 10 }} />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.14, delay: 0.05 }}
            style={{ position: "absolute", top: "calc(8% + 18px)", left: 0, width: "18%", height: 5,
              background: primary + "99", transformOrigin: "left center", zIndex: 10 }} />
          {/* Bottom-right thick bar */}
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.14, delay: 0.08 }}
            style={{ position: "absolute", bottom: "8%", right: 0, width: "40%", height: 14,
              background: primary, transformOrigin: "right center", zIndex: 10 }} />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.14, delay: 0.12 }}
            style={{ position: "absolute", bottom: "calc(8% + 18px)", right: 0, width: "22%", height: 5,
              background: primary + "99", transformOrigin: "right center", zIndex: 10 }} />
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// Called when EXPAND DOMAIN is clicked — shows a 4s character-specific cinematic
type DomainPhase = "flash" | "build" | "peak" | "hold" | "exit";

export default function DomainCinematic({
  leaderDefId,
  characterName,
  onDone,
}: {
  leaderDefId: string;
  characterName: string;
  onDone: () => void;
}) {
  const theme = THEMES[leaderDefId] ?? DEFAULT_THEME;
  const [phase, setPhase] = useState<DomainPhase>("flash");

  useEffect(() => {
    const seq: [number, DomainPhase][] = [
      [220,  "build"],
      [700,  "peak"],
      [2800, "hold"],
      [3800, "exit"],
    ];
    const timers = seq.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    const done = setTimeout(onDone, 4400);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  const showContent = ["build","peak","hold"].includes(phase);
  const showNames   = ["peak","hold"].includes(phase);

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "flash" ? [0, 1, 0.9] : 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: phase === "flash" ? 0.22 : 0.35,
            ease: "easeOut",
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: theme.bg,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Initial white flash overlay */}
          {phase === "flash" && (
            <motion.div
              initial={{ opacity: 0.9 }} animate={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 50 }}
            />
          )}

          {/* Radial gradient base atmosphere */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: showContent ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute", inset: 0,
              background: `
                radial-gradient(ellipse at 50% 50%,
                  ${theme.primary}55 0%,
                  ${theme.secondary}33 35%,
                  rgba(0,0,0,0) 70%)
              `,
            }}
          />

          {/* Canvas particle effect */}
          {showContent && (
            <DomainCanvas
              kind={theme.kind}
              primary={theme.primary}
              secondary={theme.secondary}
              accent={theme.accent}
            />
          )}

          {/* Geometric decoration */}
          <DomainGeometry
            kind={theme.kind}
            primary={theme.primary}
            secondary={theme.secondary}
            accent={theme.accent}
            show={showContent}
          />

          {/* P5 corner slash bars */}
          <SlashFrame primary={theme.primary} show={showContent} />

          {/* Pulsing radial bloom at center */}
          {showContent && (
            <motion.div
              animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%,-50%)",
                width: "45vmin", height: "45vmin", borderRadius: "50%",
                background: `radial-gradient(circle, ${theme.primary}66 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Domain name typography — center stage */}
          <AnimatePresence>
            {showNames && (
              <motion.div
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.4, ease: [0.15, 1.5, 0.3, 1] }}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  zIndex: 20, pointerEvents: "none",
                  gap: 10,
                }}
              >
                {/* Header label */}
                <motion.div
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  style={{
                    background: theme.primary, padding: "5px 32px 5px 24px",
                    transform: "skewX(-12deg)", display: "inline-block",
                    boxShadow: `0 0 36px ${theme.primary}bb, 0 0 72px ${theme.primary}44`,
                  }}
                >
                  <span style={{
                    fontSize: 11, letterSpacing: 8,
                    color: "#000", fontWeight: 900,
                    display: "block", transform: "skewX(12deg)",
                  }}>
                    領 域 展 開
                  </span>
                </motion.div>

                {/* Japanese name — massive */}
                <motion.div
                  initial={{ x: -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.18, duration: 0.45, ease: [0.15, 1.4, 0.3, 1] }}
                  style={{
                    fontSize: "clamp(52px, 9vw, 110px)",
                    fontWeight: 900, color: theme.primary,
                    letterSpacing: 6, lineHeight: 0.9,
                    textShadow: `
                      0 0 50px ${theme.primary}ff,
                      0 0 100px ${theme.primary}88,
                      0 0 180px ${theme.primary}44
                    `,
                    WebkitTextStroke: `2px ${theme.secondary}`,
                  }}
                >
                  {theme.nameJP}
                </motion.div>

                {/* English name */}
                <motion.div
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.28, duration: 0.4, ease: [0.15, 1.4, 0.3, 1] }}
                >
                  <div style={{
                    background: "#000", padding: "10px 32px",
                    transform: "skewX(-10deg)", display: "inline-block",
                    borderLeft: `6px solid ${theme.primary}`,
                    boxShadow: `0 0 28px rgba(0,0,0,0.95), 0 0 10px ${theme.primary}33`,
                  }}>
                    <div style={{
                      fontSize: "clamp(18px, 2.5vw, 30px)",
                      fontWeight: 900, color: "#fff",
                      letterSpacing: 3, transform: "skewX(10deg)",
                      textShadow: `0 0 18px ${theme.primary}88`,
                    }}>
                      {theme.nameEN.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 10, color: theme.primary + "bb",
                      letterSpacing: 6, marginTop: 4,
                      transform: "skewX(10deg)", fontWeight: 700,
                    }}>
                      {theme.technique.toUpperCase()} — {characterName.toUpperCase()}
                    </div>
                  </div>
                </motion.div>

                {/* Bonus: technique type badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <div style={{
                    border: `2px solid ${theme.primary}`,
                    padding: "4px 20px", display: "inline-block",
                    transform: "skewX(-10deg)",
                    boxShadow: `0 0 18px ${theme.primary}44`,
                  }}>
                    <span style={{
                      fontSize: 11, color: theme.primary,
                      letterSpacing: 10, fontWeight: 900,
                      display: "block", transform: "skewX(10deg)",
                    }}>
                      DOMAIN EXPANSION
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Build phase: pre-name flash text */}
          <AnimatePresence>
            {phase === "build" && (
              <motion.div
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.5 }}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 18, pointerEvents: "none",
                }}
              >
                <div style={{
                  fontSize: "clamp(26px, 4vw, 42px)",
                  fontWeight: 900, color: theme.accent,
                  letterSpacing: 12, fontStyle: "italic",
                  textShadow: `0 0 40px ${theme.primary}dd`,
                  WebkitTextStroke: `2px #000`,
                }}>
                  領 域 展 開
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vignette frame */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)`,
            zIndex: 5,
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
