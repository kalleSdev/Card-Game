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

export default function HomeScreen({ onSelect, onGallery, onBack }: { onSelect: () => void; onGallery: () => void; onBack?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [galleryHovered, setGalleryHovered] = useState(false);
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
          ← HOME
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

        {/* Mode cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.32, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}
        >
          {/* JJK — active */}
          <motion.div
            onClick={onSelect}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            whileHover={{ y: -6, scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            style={{
              width: 280, padding: "22px 28px", borderRadius: 16, cursor: "pointer",
              background: hovered ? "rgba(40,20,70,0.88)" : "rgba(14,8,26,0.82)",
              border: `2px solid ${hovered ? "#9933ffcc" : "#44226688"}`,
              backdropFilter: "blur(10px)",
              textAlign: "center", userSelect: "none",
              boxShadow: hovered
                ? "0 0 0 1px #9933ff44, 0 0 48px #6600ff44, 0 8px 40px rgba(0,0,0,0.7)"
                : "0 0 24px #44007722, 0 4px 20px rgba(0,0,0,0.5)",
              position: "relative", overflow: "hidden",
              display: "flex", alignItems: "center", gap: 22,
            }}
          >
            {/* Scanning light on hover */}
            {hovered && (
              <motion.div
                animate={{ left: ["-40%", "140%"] }}
                transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", top: 0, bottom: 0, width: "40%",
                  background: "linear-gradient(90deg, transparent, rgba(180,100,255,0.12), rgba(255,255,255,0.08), rgba(180,100,255,0.12), transparent)",
                  transform: "skewX(-12deg)", pointerEvents: "none",
                }}
              />
            )}

            {/* Kanji icon */}
            <motion.div
              animate={hovered
                ? { textShadow: "0 0 20px #cc88ffcc, 0 0 40px #9933ff88" }
                : { textShadow: "0 0 8px #7722cc44" }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: 44, flexShrink: 0, color: hovered ? "#dd99ff" : "#9966cc" }}
            >
              呪
            </motion.div>

            <div style={{ textAlign: "left" }}>
              <div style={{
                fontSize: 22, fontWeight: "bold", letterSpacing: 4,
                color: hovered ? "#ffffff" : "#e0ccf8",
              }}>JJK</div>
              <div style={{ fontSize: 10, color: hovered ? "#cc99ee" : "#9977aa", letterSpacing: 1, marginBottom: 10 }}>
                Jujutsu Kaisen
              </div>
              <motion.div
                animate={hovered ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{
                  padding: "4px 16px",
                  background: hovered ? "rgba(180,80,255,0.18)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${hovered ? "#cc66ffcc" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 20, display: "inline-block",
                  boxShadow: hovered ? "0 0 12px #9933ff55" : "none",
                }}
              >
                <span style={{ fontSize: 9, color: hovered ? "#dd99ff" : "#9988bb", letterSpacing: 2 }}>
                  ▶ START GAME
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Card Gallery button */}
          <motion.div
            onClick={onGallery}
            onHoverStart={() => setGalleryHovered(true)}
            onHoverEnd={() => setGalleryHovered(false)}
            whileHover={{ y: -4, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            style={{
              width: 280, padding: "16px 28px", borderRadius: 14, cursor: "pointer",
              background: galleryHovered ? "rgba(20,28,50,0.88)" : "rgba(10,14,26,0.72)",
              border: `1px solid ${galleryHovered ? "#4488ffaa" : "#1a2a4488"}`,
              backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", gap: 18,
              boxShadow: galleryHovered
                ? "0 0 0 1px #2244ff33, 0 0 32px #1133ff22, 0 4px 24px rgba(0,0,0,0.5)"
                : "0 0 12px #00112211, 0 2px 12px rgba(0,0,0,0.4)",
              position: "relative", overflow: "hidden",
            }}
          >
            {galleryHovered && (
              <motion.div
                animate={{ left: ["-40%", "140%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", top: 0, bottom: 0, width: "40%",
                  background: "linear-gradient(90deg, transparent, rgba(80,140,255,0.10), rgba(200,220,255,0.06), rgba(80,140,255,0.10), transparent)",
                  transform: "skewX(-12deg)", pointerEvents: "none",
                }}
              />
            )}
            <div style={{ fontSize: 36, flexShrink: 0, color: galleryHovered ? "#88aaff" : "#334466", filter: galleryHovered ? "drop-shadow(0 0 8px #4488ffaa)" : "none" }}>
              📖
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: 3, color: galleryHovered ? "#bbddff" : "#7799bb" }}>
                CARD GALLERY
              </div>
              <div style={{ fontSize: 9, color: galleryHovered ? "#88aacc" : "#556677", letterSpacing: 1 }}>
                Browse all 34 characters
              </div>
            </div>
          </motion.div>
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
