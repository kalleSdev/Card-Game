import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// ── Dual-layer particle canvas ──────────────────────────────────────────────
// Layer 1: slow drifting ink motes (amber/gold)
// Layer 2: fast rising sparks (white/blue)
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    window.addEventListener("resize", resize);

    interface Mote { x: number; y: number; vx: number; vy: number; size: number; alpha: number; hue: number; fast: boolean }
    const motes: Mote[] = [];

    const spawnMote = (fast = false) => motes.push({
      x:     Math.random() * c.width,
      y:     fast ? c.height + 10 : c.height * 0.6 + Math.random() * c.height * 0.4 + 10,
      vx:    (Math.random() - 0.5) * (fast ? 0.8 : 0.35),
      vy:    fast ? -(1.4 + Math.random() * 2.0) : -(0.2 + Math.random() * 0.5),
      size:  fast ? 0.8 + Math.random() * 1.4 : 1.5 + Math.random() * 3.5,
      alpha: fast ? 0.5 + Math.random() * 0.4 : 0.08 + Math.random() * 0.14,
      hue:   fast ? 200 + Math.random() * 40 : 38 + Math.random() * 18,
      fast,
    });

    let tick = 0, raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      tick++;
      if (tick % 3  === 0 && motes.filter(m => !m.fast).length < 70) spawnMote(false);
      if (tick % 8  === 0 && motes.filter(m => m.fast).length  < 35) spawnMote(true);

      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.x += m.vx; m.y += m.vy;
        m.vx += (Math.random() - 0.5) * (m.fast ? 0.06 : 0.03);
        m.alpha -= m.fast ? 0.008 : 0.0003;
        if (m.alpha <= 0 || m.y < -20) { motes.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size);
        const col = m.fast
          ? `hsla(${m.hue},60%,90%,${m.alpha})`
          : `hsla(${m.hue},75%,65%,${m.alpha})`;
        g.addColorStop(0, col);
        g.addColorStop(1, `hsla(${m.hue},60%,50%,0)`);
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
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2 }} />;
}

// ── God rays: angled light beams ─────────────────────────────────────────────
function GodRays() {
  const rays = [
    { left: "8%",  w: "5%",  rot: -6, dur: 5.5, del: 0    },
    { left: "22%", w: "3%",  rot: -3, dur: 7.2, del: 1.0  },
    { left: "40%", w: "6%",  rot: -1, dur: 6.0, del: 0.4  },
    { left: "58%", w: "4%",  rot:  2, dur: 8.0, del: 1.8  },
    { left: "74%", w: "3.5%",rot:  5, dur: 6.5, del: 0.8  },
    { left: "88%", w: "5%",  rot:  8, dur: 5.8, del: 2.2  },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
      {rays.map((r, i) => (
        <div key={i} style={{
          position: "absolute",
          top: "-15%", left: r.left,
          width: r.w, height: "130%",
          background: "linear-gradient(180deg, rgba(220,180,80,0.14) 0%, rgba(200,140,40,0.06) 50%, transparent 100%)",
          transform: `rotate(${r.rot}deg)`,
          transformOrigin: "top center",
          animation: `rayPulse ${r.dur}s ease-in-out infinite`,
          animationDelay: `${r.del}s`,
        }} />
      ))}
    </div>
  );
}

// ── Lens flare: a bright source that activates periodically ──────────────────
function LensFlare() {
  const [pos, setPos]       = useState({ x: 72, y: 20 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const cycle = () => {
      setPos({ x: 55 + Math.random() * 35, y: 8 + Math.random() * 30 });
      setActive(true);
      const dur = 900 + Math.random() * 600;
      setTimeout(() => setActive(false), dur);
    };
    const first = setTimeout(cycle, 400);
    const id = setInterval(cycle, 3200 + Math.random() * 1800);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3,
      transition: "opacity 0.45s ease",
      opacity: active ? 1 : 0,
    }}>
      {/* Core bright point */}
      <div style={{
        position: "absolute",
        left: `${pos.x}%`, top: `${pos.y}%`,
        width: 6, height: 6,
        background: "#fff",
        borderRadius: "50%",
        transform: "translate(-50%,-50%)",
        boxShadow: "0 0 12px 4px #fff, 0 0 32px 10px rgba(255,220,140,0.6)",
      }} />
      {/* Bloom */}
      <div style={{
        position: "absolute",
        left: `${pos.x}%`, top: `${pos.y}%`,
        width: 320, height: 320,
        transform: "translate(-50%,-50%)",
        background: "radial-gradient(ellipse at center, rgba(255,230,150,0.45) 0%, rgba(255,190,80,0.12) 28%, transparent 65%)",
        borderRadius: "50%",
      }} />
      {/* Star cross-flare — horizontal */}
      <div style={{
        position: "absolute",
        left: `${pos.x}%`, top: `${pos.y}%`,
        width: 280, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(255,230,160,0.55), rgba(255,255,255,0.7), rgba(255,230,160,0.55), transparent)",
        transform: "translate(-50%,-50%)",
      }} />
      {/* Star cross-flare — vertical */}
      <div style={{
        position: "absolute",
        left: `${pos.x}%`, top: `${pos.y}%`,
        width: 2, height: 220,
        background: "linear-gradient(180deg, transparent, rgba(255,220,140,0.45), rgba(255,255,255,0.6), rgba(255,220,140,0.45), transparent)",
        transform: "translate(-50%,-50%)",
      }} />
      {/* Secondary rings */}
      {[80, 140, 200].map((r, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${pos.x}%`, top: `${pos.y}%`,
          width: r, height: r,
          border: `1px solid rgba(255,200,100,${0.22 - i * 0.06})`,
          borderRadius: "50%",
          transform: "translate(-50%,-50%)",
        }} />
      ))}
      {/* Ghost flare — offset */}
      <div style={{
        position: "absolute",
        left: `${100 - pos.x * 0.7}%`,
        top: `${100 - pos.y * 0.7}%`,
        width: 80, height: 80,
        background: "radial-gradient(circle, rgba(140,180,255,0.22) 0%, transparent 70%)",
        borderRadius: "50%",
        transform: "translate(-50%,-50%)",
      }} />
    </div>
  );
}

// ── Light source flash — sudden bright pulse from top ────────────────────────
function LightFlash() {
  const [flashKey, setFlashKey] = useState(0);
  const [showing, setShowing]   = useState(false);

  useEffect(() => {
    const cycle = () => {
      setFlashKey(k => k + 1);
      setShowing(true);
      setTimeout(() => setShowing(false), 350);
    };
    const id = setInterval(cycle, 5000 + Math.random() * 4000);
    return () => clearInterval(id);
  }, []);

  if (!showing) return null;
  return (
    <motion.div
      key={flashKey}
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "radial-gradient(ellipse at 65% 0%, rgba(255,230,140,0.35) 0%, transparent 55%)",
      }}
    />
  );
}

const LOCKED_MODES = [
  { title: "ONE PIECE", subtitle: "Grand Line", kanji: "海" },
  { title: "???",       subtitle: "???",        kanji: "謎" },
];

function InkStroke({ width = 200, opacity = 0.18 }: { width?: number; opacity?: number }) {
  return (
    <div style={{
      height: 1, width, margin: "0 auto",
      background: `linear-gradient(90deg, transparent, rgba(180,140,80,${opacity * 3}), transparent)`,
    }} />
  );
}

export default function SplashScreen({ onSelectJJK }: { onSelectJJK: () => void }) {
  const [jjkHovered, setJjkHovered] = useState(false);
  const [pulse, setPulse]           = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03020a",
      backgroundImage: "url(/backgrounds/splash.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      animation: "bgDrift 60s ease-in-out infinite",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>

      {/* Very light base overlay — let image breathe */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(3,2,10,0.28)", pointerEvents: "none", zIndex: 0 }} />

      {/* Soft edge vignette only */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(2,1,8,0.38) 100%)",
      }} />

      {/* Atmosphere: rays → particles → flares */}
      <GodRays />
      <ParticleCanvas />
      <LensFlare />
      <LightFlash />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 4, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 800 }}>

        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.2, 0.9, 0.4, 1] }}
          style={{ textAlign: "center", marginBottom: 52 }}
        >
          <div style={{ fontSize: 11, letterSpacing: 10, color: "rgba(200,160,80,0.6)", marginBottom: 18 }}>
            対戦カードゲーム
          </div>

          {/* Giant kanji with animated glow */}
          <motion.div
            animate={pulse
              ? { textShadow: ["0 0 60px rgba(200,160,80,0.85)", "0 0 20px rgba(200,160,80,0.2)", "0 0 60px rgba(200,160,80,0.85)"] }
              : { textShadow: "0 0 28px rgba(200,160,80,0.28)" }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
            style={{ fontSize: 112, fontWeight: 900, color: "rgba(230,195,120,0.95)", lineHeight: 1, letterSpacing: 6 }}
          >
            戦
          </motion.div>

          {/* Subtitle breathing */}
          <motion.div
            animate={{ opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: 11, fontWeight: "bold", letterSpacing: 12, color: "rgba(200,160,80,0.65)", marginTop: 10 }}
          >
            CARD BATTLE
          </motion.div>

          <div style={{ marginTop: 16 }}>
            <InkStroke width={160} opacity={0.25} />
          </div>
        </motion.div>

        {/* Select label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{ fontSize: 9, letterSpacing: 6, color: "rgba(200,160,80,0.38)", marginBottom: 28 }}
        >
          SELECT UNIVERSE
        </motion.div>

        {/* Mode cards */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7, ease: "easeOut" }}
          style={{ display: "flex", gap: 24, alignItems: "stretch", justifyContent: "center" }}
        >
          {/* JJK — active */}
          <motion.div
            onClick={onSelectJJK}
            onHoverStart={() => setJjkHovered(true)}
            onHoverEnd={() => setJjkHovered(false)}
            whileHover={{ y: -10, scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 20 }}
            style={{
              width: 228, padding: "34px 24px 30px",
              borderRadius: 18, cursor: "pointer",
              background: jjkHovered
                ? "linear-gradient(160deg, rgba(40,20,70,0.94) 0%, rgba(20,8,40,0.94) 100%)"
                : "linear-gradient(160deg, rgba(14,8,26,0.82) 0%, rgba(8,4,18,0.82) 100%)",
              border: `1px solid ${jjkHovered ? "rgba(190,100,255,0.6)" : "rgba(90,44,140,0.35)"}`,
              backdropFilter: "blur(14px)",
              textAlign: "center",
              boxShadow: jjkHovered
                ? "0 0 0 1px rgba(160,80,255,0.22), 0 0 60px rgba(120,40,200,0.35), 0 16px 56px rgba(0,0,0,0.75)"
                : "0 0 28px rgba(60,20,100,0.22), 0 4px 24px rgba(0,0,0,0.55)",
              position: "relative", overflow: "hidden",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}
          >
            {/* Shimmer */}
            {jjkHovered && (
              <motion.div
                animate={{ left: ["-50%", "150%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                style={{
                  position: "absolute", top: 0, bottom: 0, width: "40%",
                  background: "linear-gradient(90deg, transparent, rgba(200,120,255,0.10), rgba(255,255,255,0.06), rgba(200,120,255,0.10), transparent)",
                  transform: "skewX(-12deg)", pointerEvents: "none",
                }}
              />
            )}

            {/* Kanji */}
            <motion.div
              animate={jjkHovered
                ? { textShadow: "0 0 30px rgba(190,100,255,0.95), 0 0 60px rgba(130,50,220,0.7)" }
                : { textShadow: "0 0 12px rgba(120,60,180,0.45)" }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: 60, color: jjkHovered ? "#cc88ff" : "#8844bb", lineHeight: 1 }}
            >
              呪
            </motion.div>

            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 5, color: jjkHovered ? "#fff" : "#ccaaee", marginBottom: 5 }}>
                JJK
              </div>
              <div style={{ fontSize: 9, color: jjkHovered ? "#aa88cc" : "#55446a", letterSpacing: 1 }}>
                Jujutsu Kaisen
              </div>
            </div>

            <InkStroke width={80} opacity={0.18} />

            <motion.div
              animate={jjkHovered ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.9 }}
              transition={{ duration: 0.9, repeat: Infinity }}
              style={{
                padding: "6px 20px",
                background: jjkHovered ? "rgba(160,80,255,0.20)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${jjkHovered ? "rgba(190,100,255,0.75)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 20,
                boxShadow: jjkHovered ? "0 0 16px rgba(150,60,255,0.45)" : "none",
              }}
            >
              <span style={{ fontSize: 9, color: jjkHovered ? "#cc88ff" : "#664488", letterSpacing: 3 }}>▶ SELECT</span>
            </motion.div>
          </motion.div>

          {/* Locked modes */}
          {LOCKED_MODES.map((mode, i) => (
            <motion.div
              key={mode.title}
              animate={{ opacity: [0.38, 0.52, 0.38] }}
              transition={{ duration: 4.2 + i * 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 1.5 }}
              style={{
                width: 164, padding: "34px 20px 30px",
                borderRadius: 18,
                background: "linear-gradient(160deg, rgba(10,8,14,0.75) 0%, rgba(6,5,10,0.75) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(38,28,48,0.5)",
                textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                boxShadow: "inset 0 0 28px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: 46, color: "rgba(38,28,48,0.75)", textShadow: "0 0 22px rgba(40,20,60,0.5)", filter: "blur(0.5px)", lineHeight: 1 }}>
                {mode.kanji}
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: "bold", letterSpacing: 2, color: "rgba(55,42,65,0.85)", marginBottom: 3 }}>
                  {mode.title}
                </div>
                <div style={{ fontSize: 8, color: "rgba(38,30,46,0.6)", letterSpacing: 1 }}>
                  {mode.subtitle}
                </div>
              </div>

              <InkStroke width={60} opacity={0.07} />

              <div style={{ padding: "4px 14px", background: "rgba(8,6,12,0.8)", border: "1px solid rgba(28,20,38,0.6)", borderRadius: 20 }}>
                <span style={{ fontSize: 8, color: "rgba(34,26,42,0.8)", letterSpacing: 3 }}>SEALED</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
          style={{ marginTop: 56, fontSize: 9, color: "rgba(200,160,80,0.45)", letterSpacing: 6 }}
        >
          宇宙を選択してください
        </motion.div>
      </div>

      <style>{`
        @keyframes bgDrift {
          0%   { background-position: 50% 50%; }
          20%  { background-position: 52% 47%; }
          40%  { background-position: 48% 53%; }
          60%  { background-position: 53% 50%; }
          80%  { background-position: 47% 52%; }
          100% { background-position: 50% 50%; }
        }
        @keyframes rayPulse {
          0%   { opacity: 0.4; }
          50%  { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
