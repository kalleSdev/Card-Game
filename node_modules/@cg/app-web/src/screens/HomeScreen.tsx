import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BG } from "../backgrounds";

// Fullscreen ambient particle canvas — slow cursed-energy motes drifting upward
function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    interface Mote { x: number; y: number; vx: number; vy: number; size: number; alpha: number; hue: number }
    const motes: Mote[] = [];

    const spawnMote = () => {
      motes.push({
        x:     Math.random() * canvas.width,
        y:     canvas.height + 10,
        vx:    (Math.random() - 0.5) * 0.4,
        vy:    -(0.25 + Math.random() * 0.55),
        size:  1.2 + Math.random() * 2.8,
        alpha: 0.12 + Math.random() * 0.22,
        hue:   260 + Math.random() * 60,   // purple → blue range
      });
    };

    let tick = 0;
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;
      if (tick % 3 === 0 && motes.length < 90) spawnMote();

      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.x    += m.vx;
        m.y    += m.vy;
        m.vx   += (Math.random() - 0.5) * 0.04;
        m.alpha -= 0.00035;
        if (m.alpha <= 0 || m.y < -20) { motes.splice(i, 1); continue; }

        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size);
        g.addColorStop(0,   `hsla(${m.hue},80%,70%,${m.alpha})`);
        g.addColorStop(1,   `hsla(${m.hue},80%,50%,0)`);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
    }} />
  );
}

// ── Shared mode button component ──────────────────────────────────────────────
function ModeBtn({ btn, isHov, onHover }: {
  btn: { id: string; icon: string; title: string; sub: string; color: string; badge?: string; onClick: () => void };
  isHov: boolean;
  onHover: (id: string | null) => void;
}) {
  const bgMap: Record<string, string> = {
    "#9933ff": "40,20,70", "#ff9922": "60,35,10", "#44ff88": "10,50,28",
    "#22ccaa": "10,50,44", "#4488ff": "15,25,50",
  };
  const bgRgb = bgMap[btn.color] ?? "20,20,40";
  return (
    <motion.div
      onClick={btn.onClick}
      onHoverStart={() => onHover(btn.id)}
      onHoverEnd={() => onHover(null)}
      whileHover={{ y: -5, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={{
        width: 260, padding: "18px 24px", borderRadius: 14, cursor: "pointer",
        background: isHov ? `rgba(${bgRgb},0.9)` : "rgba(10,8,20,0.82)",
        border: `2px solid ${isHov ? btn.color + "cc" : btn.color + "33"}`,
        backdropFilter: "blur(10px)",
        boxShadow: isHov ? `0 0 40px ${btn.color}33, 0 8px 32px rgba(0,0,0,0.7)` : "0 2px 16px rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", gap: 18,
        position: "relative", overflow: "hidden", userSelect: "none",
      }}
    >
      {isHov && (
        <motion.div
          animate={{ left: ["-40%", "140%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", top: 0, bottom: 0, width: "40%",
            background: `linear-gradient(90deg, transparent, ${btn.color}18, ${btn.color}0a, transparent)`,
            transform: "skewX(-12deg)", pointerEvents: "none",
          }}
        />
      )}
      <div style={{
        position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3,
        background: isHov ? btn.color : btn.color + "44",
        borderRadius: 2, boxShadow: isHov ? `0 0 12px ${btn.color}` : "none",
        transition: "all 0.2s",
      }} />
      <motion.div
        animate={isHov ? { textShadow: `0 0 20px ${btn.color}cc` } : { textShadow: "none" }}
        style={{ fontSize: 36, flexShrink: 0, marginLeft: 8 }}
      >{btn.icon}</motion.div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, color: isHov ? "#fff" : "#ccc" }}>
            {btn.title}
          </div>
          {btn.badge && (
            <div style={{
              fontSize: 8, fontWeight: 900, letterSpacing: 2,
              background: btn.color, color: "#000",
              padding: "2px 7px", borderRadius: 4,
              boxShadow: `0 0 8px ${btn.color}88`,
            }}>{btn.badge}</div>
          )}
        </div>
        <div style={{ fontSize: 9, color: isHov ? btn.color + "cc" : "#445", letterSpacing: 1, marginTop: 3 }}>
          {btn.sub}
        </div>
      </div>
      <motion.div
        animate={isHov ? { opacity: 1, x: 0 } : { opacity: 0.3, x: -4 }}
        style={{ fontSize: 14, color: btn.color }}
      >›</motion.div>
    </motion.div>
  );
}

export default function HomeScreen({ onSelect, onDraftBattle, onNormalMode, onGallery, onProfiles, onRanking, onBack }: { onSelect: () => void; onDraftBattle: () => void; onNormalMode: () => void; onGallery: () => void; onProfiles: () => void; onRanking: () => void; onBack?: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  // Pulse the kanji every few seconds
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.home,
      backgroundSize: "cover", backgroundPosition: "center",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden", position: "relative",
    }}>
      {/* Base dark overlay — lighter so background shows */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,3,10,0.26)", pointerEvents: "none", zIndex: 0 }} />

      {/* Back to splash */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: "fixed", top: 18, left: 18, zIndex: 10,
            padding: "8px 18px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#556", cursor: "pointer", fontSize: 11,
            letterSpacing: 2, fontFamily: "inherit",
          }}
        >
          ← BACK
        </button>
      )}

      {/* Ambient particles */}
      <AmbientCanvas />

      {/* Vignette */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(2,2,8,0.45) 100%)",
      }} />

      {/* ── Main content ── */}
      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Title block */}
        <motion.div
          initial={{ y: -30, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.175, 0.885, 0.32, 1.275] }}
          style={{ textAlign: "center", marginBottom: 56 }}
        >
          {/* Giant cursed kanji */}
          <motion.div
            animate={pulse
              ? { textShadow: ["0 0 60px #9933ffcc, 0 0 120px #6600ff88", "0 0 20px #6600ff44", "0 0 60px #9933ffcc, 0 0 120px #6600ff88"] }
              : { textShadow: "0 0 30px #7722cc66, 0 0 60px #44007744" }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            style={{
              fontSize: 112, fontWeight: 900, lineHeight: 1,
              color: "#d8aaff",
              userSelect: "none", letterSpacing: 4,
            }}
          >
            呪
          </motion.div>

          <motion.div
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
            style={{
              fontSize: 13, fontWeight: "bold", letterSpacing: 16,
              color: "#b899dd",
              marginTop: 8, textTransform: "uppercase",
            }}
          >
            CARD BATTLE
          </motion.div>

          {/* Decorative line */}
          <motion.div
            animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              height: 1, width: 180, margin: "16px auto 0",
              background: "linear-gradient(90deg, transparent, #9933ff88, rgba(255,255,255,0.5), #9933ff88, transparent)",
              borderRadius: 1,
            }}
          />
        </motion.div>

        {/* Mode buttons — 3-column layout */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.32, ease: "easeOut" }}
          style={{ display: "flex", gap: 0, alignItems: "flex-start" }}
        >
          {/* LEFT column: Ranking + Profiles + Gallery */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              { id: "ranking",  icon: "🏆", title: "RANKING",    sub: "Global leaderboard · Top players", color: "#ffd700", onClick: onRanking  },
              { id: "profiles", icon: "👤", title: "PROFILES",   sub: "Stats · Rankings · History",       color: "#22ccaa", onClick: onProfiles },
              { id: "gallery",  icon: "📖", title: "GALLERY",    sub: "Browse all 34 characters",         color: "#4488ff", onClick: onGallery  },
            ] as const).map(btn => {
              const isHov = hovered === btn.id;
              return <ModeBtn key={btn.id} btn={btn} isHov={isHov} onHover={setHovered} />;
            })}
          </div>

          {/* Divider between LEFT and MIDDLE */}
          <div style={{
            width: 1, alignSelf: "stretch", margin: "0 8px",
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)",
          }} />

          {/* MIDDLE column: Quick Match + Quick Draft */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              { id: "quick", icon: "⚡", title: "QUICK MATCH", sub: "Fast draft · Score battle",            color: "#9933ff", onClick: onSelect      },
              { id: "draft", icon: "🃏", title: "QUICK DRAFT", sub: "Draft your deck · Battle it out",      color: "#ff9922", onClick: onDraftBattle },
            ] as const).map(btn => {
              const isHov = hovered === btn.id;
              return <ModeBtn key={btn.id} btn={btn} isHov={isHov} onHover={setHovered} />;
            })}
          </div>

          {/* Divider between MIDDLE and RIGHT */}
          <div style={{
            width: 1, alignSelf: "stretch", margin: "0 8px",
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)",
          }} />

          {/* RIGHT column: Normal Mode */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([
              { id: "normal", icon: "⚔️", title: "NORMAL MODE", sub: "Use your collected deck · Build your legacy", color: "#44ff88", badge: "NEW", onClick: onNormalMode },
            ] as const).map(btn => {
              const isHov = hovered === btn.id;
              return <ModeBtn key={btn.id} btn={btn} isHov={isHov} onHover={setHovered} />;
            })}
          </div>
        </motion.div>

        {/* Footer hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          style={{ marginTop: 48, fontSize: 10, color: "#9966bb", letterSpacing: 5 }}
        >
          SELECT A GAME MODE TO BEGIN
        </motion.div>
      </div>
    </div>
  );
}
