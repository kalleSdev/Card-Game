import React, { useState, useEffect, useRef } from "react";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerId } from "@cg/contracts";
import type { PlayerIcons, PlayerNames } from "../types";
import { BG } from "../backgrounds";
import PlayerIcon from "../components/PlayerIcon";

// Burst ring — one-shot expand
function BurstRing({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0.8 }}
      animate={{ scale: 2.8, opacity: 0 }}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
      style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `2px solid ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}

// Ambient sparks — spawns around the coin center
function SparkCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = 320;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const cx = SIZE / 2, cy = SIZE / 2;

    interface Spark { x: number; y: number; vx: number; vy: number; size: number; alpha: number }
    const sparks: Spark[] = [];
    let raf = 0;
    let tick = 0;

    const spawn = () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 52 + Math.random() * 16;
      sparks.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: Math.cos(angle) * (0.4 + Math.random() * 1.2),
        vy: Math.sin(angle) * (0.4 + Math.random() * 1.2) - 0.8,
        size: 0.8 + Math.random() * 2.2,
        alpha: 0.7 + Math.random() * 0.3,
      });
    };

    const loop = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      tick++;
      if (active && tick % 2 === 0 && sparks.length < 60) spawn();
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.vy -= 0.02;
        s.alpha -= 0.012;
        if (s.alpha <= 0) { sparks.splice(i, 1); continue; }
        const g2 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
        g2.addColorStop(0, `rgba(255,220,80,${s.alpha})`);
        g2.addColorStop(1, `rgba(255,140,0,0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = g2;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas ref={canvasRef} width={320} height={320}
      style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 0 }} />
  );
}

function PlayerSide({ pid, playerNames, playerIcons, isWinner, isLoser, showBurst }: {
  pid: PlayerId; playerNames: PlayerNames; playerIcons: PlayerIcons;
  isWinner: boolean; isLoser: boolean; showBurst: boolean;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  return (
    <motion.div
      animate={isLoser ? { opacity: 0.15, scale: 0.96 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: pid === "P1" ? "flex-start" : "flex-end", padding: "0 44px" }}
    >
      <div style={{ position: "relative", marginBottom: 20 }}>
        {showBurst && <>
          <BurstRing color={pColor} delay={0} />
          <BurstRing color={pColor} delay={0.18} />
          <BurstRing color={pColor} delay={0.36} />
        </>}
        <motion.div
          animate={isWinner
            ? { boxShadow: [`0 0 40px ${pColor}88, 0 0 80px ${pColor}44`, `0 0 64px ${pColor}cc, 0 0 120px ${pColor}66`, `0 0 40px ${pColor}88, 0 0 80px ${pColor}44`] }
            : { boxShadow: "0 0 0px transparent" }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ borderRadius: 16, overflow: "hidden", border: `3px solid ${isWinner ? pColor : "#1a1a28"}`, transition: "border-color 0.5s" }}
        >
          <PlayerIcon icon={playerIcons[pid]} size={110} style={{ display: "block" }} />
        </motion.div>
      </div>
      <motion.div
        animate={isWinner ? { textShadow: `0 0 28px ${pColor}` } : { textShadow: "none" }}
        style={{ fontSize: 28, fontWeight: 900, color: isWinner ? pColor : "#444", letterSpacing: 3, textAlign: pid === "P1" ? "left" : "right" }}
      >
        {playerNames[pid].toUpperCase()}
      </motion.div>
      <div style={{ fontSize: 11, color: "#333", letterSpacing: 4, marginTop: 6, textAlign: pid === "P1" ? "left" : "right" }}>{pid}</div>
      <AnimatePresence>
        {isWinner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 22 }}
            style={{ marginTop: 16, fontSize: 14, letterSpacing: 4, color: pColor, fontWeight: "bold" }}
          >
            PICKS FIRST ✦
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// CSS 3D coin — idle shows purple "FLIP" face; after click shows P1/P2 and spins to winner
function Coin3D({ phase, result, p1Color, p2Color, p1Name, p2Name, onClick }: {
  phase: string; result: PlayerId | null;
  p1Color: string; p2Color: string; p1Name: string; p2Name: string;
  onClick: () => void;
}) {
  const baseRotations = 1440;
  const landAngle = result === "P2" ? baseRotations + 180 : baseRotations;
  const isIdle = phase === "idle";

  const faceBase: React.CSSProperties = {
    position: "absolute",
    width: "100%", height: "100%",
    borderRadius: "50%",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    gap: 6,
    userSelect: "none",
  };

  return (
    <div
      onClick={phase === "idle" ? onClick : undefined}
      style={{ width: 130, height: 130, perspective: "600px", cursor: phase === "idle" ? "pointer" : "default", position: "relative", zIndex: 2 }}
    >
      {isIdle ? (
        /* Idle: single flat purple FLIP coin */
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 4,
          background: "radial-gradient(circle at 35% 35%, #7733cc55 0%, #1a0830 60%, #0d0520 100%)",
          border: "3px solid #9933ffcc",
          boxShadow: "0 0 28px #9933ff44, inset 0 0 24px #6600ff22",
          animation: "coinIdlePulse 2.4s ease-in-out infinite",
          userSelect: "none",
        }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#cc88ff", textShadow: "0 0 14px #9933ffaa", lineHeight: 1 }}>FLIP</div>
          <div style={{ fontSize: 9, color: "#7744aa", letterSpacing: 3, lineHeight: 1 }}>CLICK</div>
        </div>
      ) : (
        /* Spinning / landing — 3D with P1 / P2 faces */
        <div style={{
          width: "100%", height: "100%",
          transformStyle: "preserve-3d",
          animation: phase === "spinning"
            ? "coinSpin3D 0.22s linear infinite"
            : phase === "landing" || phase === "done"
              ? "coinLand3D 0.85s cubic-bezier(0.25,1.4,0.5,1) forwards"
              : "none",
          ["--land-angle" as string]: `${landAngle}deg`,
        }}>
          {/* Front — P1 */}
          <div style={{
            ...faceBase,
            background: `radial-gradient(circle at 35% 35%, ${p1Color}55 0%, #0a0a14 60%, #050510 100%)`,
            border: `3px solid ${p1Color}cc`,
            boxShadow: `0 0 28px ${p1Color}44, inset 0 0 24px ${p1Color}22`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: p1Color, letterSpacing: 2 }}>P1</div>
            <div style={{ fontSize: 9, color: p1Color + "88", letterSpacing: 3 }}>{p1Name.toUpperCase().slice(0, 6)}</div>
          </div>
          {/* Back — P2 */}
          <div style={{
            ...faceBase,
            transform: "rotateY(180deg)",
            background: `radial-gradient(circle at 35% 35%, ${p2Color}55 0%, #0a0a14 60%, #050510 100%)`,
            border: `3px solid ${p2Color}cc`,
            boxShadow: `0 0 28px ${p2Color}44, inset 0 0 24px ${p2Color}22`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: p2Color, letterSpacing: 2 }}>P2</div>
            <div style={{ fontSize: 9, color: p2Color + "88", letterSpacing: 3 }}>{p2Name.toUpperCase().slice(0, 6)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoinFlipScreen({ onFlip, playerNames, playerIcons, onHome }: {
  onFlip: (firstPicker: PlayerId) => void;
  playerNames: PlayerNames;
  playerIcons: PlayerIcons;
  onHome?: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "done">("idle");
  const [result, setResult] = useState<PlayerId | null>(null);
  const [showBurst, setShowBurst] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  const flip = () => {
    if (phase !== "idle") return;
    setPhase("spinning");
    const winner: PlayerId = Math.random() < 0.5 ? "P1" : "P2";
    setTimeout(() => {
      setResult(winner);
      setPhase("landing");
      setShowBurst(true);
      setFlashKey(k => k + 1);
      setTimeout(() => setShowBurst(false), 1000);
    }, 1900);
    setTimeout(() => setPhase("done"), 2800);
  };

  const pColor = result === "P1" ? "#4a9eff" : result === "P2" ? "#ff6666" : "#ffd700";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04040a",
      backgroundImage: BG.coinflip, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 70s ease-in-out infinite",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <AmbientCanvas theme="snow" />
      <AmbientOverlay theme="purple" />
      {onHome && (
        <button
          onClick={onHome}
          style={{
            position: "fixed", top: 18, left: 18, zIndex: 10,
            padding: "8px 18px", background: "rgba(255,255,255,0.04)",
            border: "1px solid #2a2a3a", borderRadius: 8,
            color: "#666", cursor: "pointer", fontSize: 11,
            letterSpacing: 2, fontFamily: "inherit",
          }}
        >
          ← HOME
        </button>
      )}
      <motion.div
        animate={{ background: phase === "spinning" ? "rgba(2,2,6,0.72)" : "rgba(4,4,10,0.45)" }}
        transition={{ duration: 0.6 }}
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
      />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(2,2,8,0.75) 100%)",
      }} />

      {/* Result flash */}
      <AnimatePresence>
        {showBurst && (
          <motion.div
            key={flashKey}
            initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} exit={{}}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none",
              background: `radial-gradient(ellipse at center, ${pColor}66 0%, ${pColor}28 35%, transparent 65%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ textAlign: "center", marginBottom: 56, position: "relative", zIndex: 2 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 8, color: "#333344", marginBottom: 10 }}>BEFORE THE DRAFT</div>
        <motion.div
          animate={{ textShadow: ["0 2px 20px rgba(0,0,0,0.8)", "0 0 40px rgba(255,215,0,0.15), 0 2px 20px rgba(0,0,0,0.8)", "0 2px 20px rgba(0,0,0,0.8)"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 48, fontWeight: "bold", letterSpacing: 8, color: "#fff" }}
        >
          COIN FLIP
        </motion.div>
      </motion.div>

      {/* Main row */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 1100 }}>
        <PlayerSide pid="P1" playerNames={playerNames} playerIcons={playerIcons}
          isWinner={phase === "done" && result === "P1"}
          isLoser={phase === "done" && result === "P2"}
          showBurst={showBurst && result === "P1"} />

        {/* Center — coin + effects all relative to the coin area */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 280 }}>

          {/* Coin wrapper — all effects positioned relative to coin */}
          <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Spark canvas — exactly centered on coin */}
            <SparkCanvas active={phase === "spinning"} />

            {/* Glow ring — centered on coin */}
            <motion.div
              animate={phase === "spinning"
                ? { opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.1, 0.9] }
                : phase === "done" && result
                  ? { opacity: [0.5, 0.9, 0.5], scale: [1, 1.15, 1] }
                  : { opacity: 0.1, scale: 1 }}
              transition={{ duration: 0.5, repeat: phase === "idle" ? 0 : Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", inset: -10,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${phase === "done" && result ? pColor : "#ffd700"}55 0%, transparent 70%)`,
                filter: "blur(10px)",
                pointerEvents: "none", zIndex: 1,
              }}
            />

            {/* The coin itself */}
            <Coin3D
              phase={phase} result={result}
              p1Color="#4a9eff" p2Color="#ff6666"
              p1Name={playerNames.P1} p2Name={playerNames.P2}
              onClick={flip}
            />
          </div>

          {/* Shadow under coin */}
          <div style={{
            width: 160, height: 10, borderRadius: "50%",
            background: "radial-gradient(ellipse at center, #3a2a18 0%, #1a0e08 50%, transparent 100%)",
            margin: "6px 0 4px",
            boxShadow: "0 2px 20px rgba(0,0,0,0.7)",
          }} />
          <div style={{
            width: "60%", height: 3,
            background: "linear-gradient(90deg, transparent, #3a2a1a 20%, #5a4028 50%, #3a2a1a 80%, transparent)",
            borderRadius: 2, boxShadow: "0 1px 12px rgba(0,0,0,0.9)",
          }} />

          {/* Controls — only shown after result */}
          <div style={{ marginTop: 28, textAlign: "center", minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ fontSize: 11, color: "#2a2a3a", letterSpacing: 3 }}>click the coin to flip</div>
                </motion.div>
              )}
              {phase === "spinning" && (
                <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.4, repeat: Infinity }}>
                  <div style={{ fontSize: 14, color: "#555533", letterSpacing: 6 }}>FLIPPING...</div>
                </motion.div>
              )}
              {phase === "done" && result && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 280, damping: 22 }}>
                  <motion.button
                    whileHover={{ scale: 1.06, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    animate={{ boxShadow: [`0 0 28px ${pColor}44`, `0 0 52px ${pColor}66`, `0 0 28px ${pColor}44`] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    onClick={() => onFlip(result)}
                    style={{
                      padding: "14px 52px",
                      background: `linear-gradient(135deg, #0a1800, #050e00)`,
                      border: `2px solid ${pColor}99`,
                      borderRadius: 12, color: pColor, fontWeight: "bold", cursor: "pointer",
                      fontSize: 18, letterSpacing: 4, fontFamily: "inherit",
                    }}
                  >
                    START DRAFT →
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <PlayerSide pid="P2" playerNames={playerNames} playerIcons={playerIcons}
          isWinner={phase === "done" && result === "P2"}
          isLoser={phase === "done" && result === "P1"}
          showBurst={showBurst && result === "P2"} />
      </div>

      <style>{`
        @keyframes coinSpin3D {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes coinLand3D {
          0%   { transform: rotateY(0deg); }
          80%  { transform: rotateY(var(--land-angle)); }
          88%  { transform: rotateY(calc(var(--land-angle) + 12deg)); }
          94%  { transform: rotateY(calc(var(--land-angle) - 5deg)); }
          100% { transform: rotateY(var(--land-angle)); }
        }
        @keyframes coinIdlePulse {
          0%,100% { box-shadow: 0 0 28px #9933ff44, inset 0 0 24px #6600ff22; border-color: #9933ffcc; }
          50%     { box-shadow: 0 0 52px #9933ff88, 0 0 90px #6600ff44, inset 0 0 32px #6600ff44; border-color: #cc66ffee; }
        }
      `}</style>
    </div>
  );
}
