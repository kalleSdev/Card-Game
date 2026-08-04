import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import { TornFull } from "./TornPanel";

// ── Rarity themes ─────────────────────────────────────────────────────────────
const RARITY_THEME: Record<string, {
  primary: string; bg: string; dark: string; mid: string; textOn: string;
}> = {
  SS:  { primary: "#ff22cc", bg: "#1e0016",  dark: "#0c0008",  mid: "#3a0028",  textOn: "#fff" },
  SSS: { primary: "#00ff88", bg: "#001a0c",  dark: "#000c06",  mid: "#003018",  textOn: "#001a0a" },
  X:   { primary: "#ff3322", bg: "#200000",  dark: "#0c0000",  mid: "#380000",  textOn: "#fff" },
  S:   { primary: "#ffd700", bg: "#1c1400",  dark: "#0a0800",  mid: "#2e2200",  textOn: "#0a0800" },
  A:   { primary: "#cc44ff", bg: "#160020",  dark: "#080010",  mid: "#280038",  textOn: "#fff" },
};
const DEFAULT_THEME = RARITY_THEME.SS;

type Phase = "in" | "card" | "hold" | "out";

// ── P5 energy bars inside the panel ──────────────────────────────────────────
function EnergyBars({ color, show }: { color: string; show: boolean }) {
  const bars = [
    { top: "18%", w: "95%",  h: 28, delay: 0,     opacity: 0.18 },
    { top: "38%", w: "110%", h: 42, delay: 0.03,  opacity: 0.13 },
    { top: "58%", w: "90%",  h: 22, delay: 0.055, opacity: 0.16 },
    { top: "75%", w: "105%", h: 30, delay: 0.08,  opacity: 0.11 },
  ];
  return (
    <>
      {bars.map((b, i) => (
        <motion.div key={i}
          initial={{ x: "-120%", opacity: 0 }}
          animate={show ? { x: "0%", opacity: b.opacity } : { x: "120%", opacity: 0 }}
          transition={{ duration: 0.2, delay: b.delay, ease: [0.2, 1, 0.3, 1] }}
          style={{
            position: "absolute", top: b.top, left: "-8%",
            width: b.w, height: b.h,
            background: `linear-gradient(90deg, ${color}cc, ${color}66, transparent)`,
            transform: "skewY(-3deg)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </>
  );
}

// ── Corner accent lines (P5 signature) ───────────────────────────────────────
function CornerAccents({ color, show }: { color: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Top-left cluster */}
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12 }}
            style={{ position: "absolute", top: "12%", left: 0, width: 200, height: 10,
              background: color, transformOrigin: "left center", zIndex: 6 }} />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.04 }}
            style={{ position: "absolute", top: "calc(12% + 14px)", left: 0, width: 100, height: 4,
              background: color + "99", transformOrigin: "left center", zIndex: 6 }} />
          {/* Bottom-right cluster */}
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.06 }}
            style={{ position: "absolute", bottom: "12%", right: 0, width: 240, height: 10,
              background: color, transformOrigin: "right center", zIndex: 6 }} />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.09 }}
            style={{ position: "absolute", bottom: "calc(12% + 14px)", right: 0, width: 120, height: 4,
              background: color + "99", transformOrigin: "right center", zIndex: 6 }} />
        </>
      )}
    </AnimatePresence>
  );
}

// ── !! exclamation impact marks ───────────────────────────────────────────────
function ExclaimMarks({ color, show }: { color: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: 80, y: -40, opacity: 0, scale: 0.4 }}
          animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.3, ease: [0.12, 1.8, 0.28, 1] }}
          style={{
            position: "absolute",
            right: "3%", top: "-1%",
            zIndex: 25, display: "flex", alignItems: "flex-end",
            gap: -10, pointerEvents: "none",
          }}
        >
          {[
            { rot: -13, scale: 0.78, blur: 0.5 },
            { rot:  -5, scale: 1.00, blur: 0 },
          ].map(({ rot, scale, blur }, i) => (
            <div key={i} style={{
              fontSize: "clamp(120px, 22vh, 250px)",
              fontWeight: 900, fontStyle: "italic",
              color: "#fff",
              WebkitTextStroke: "clamp(5px, 1vw, 13px) #000",
              lineHeight: 0.82,
              transform: `rotate(${rot}deg) scale(${scale})`,
              transformOrigin: "bottom center",
              userSelect: "none",
              filter: `drop-shadow(0 0 18px ${color}bb) blur(${blur}px)`,
            }}>!</div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CardRevealCinematic({
  defId, def, onDone,
}: {
  defId: string; def: CardDef; onDone: () => void;
}) {
  const theme = RARITY_THEME[def.rarity] ?? DEFAULT_THEME;
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    const seq: [number, Phase][] = [
      [180,  "card"],
      [460,  "hold"],
      [2900, "out"],
    ];
    const timers = seq.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    const done = setTimeout(onDone, 3600);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  const showPanel = phase !== "out";
  const showCard  = ["card", "hold"].includes(phase);
  const showText  = phase === "hold";

  // Rarity-specific tilt
  const cardTilt = def.rarity === "X" ? -4 : def.rarity === "SSS" ? -7 : -9;

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          {/* Torn panel — 88% wide, 80% tall, centered */}
          <TornFull
            style={{ position: "absolute", left: "6%", top: "10%", right: "6%", bottom: "10%" }}
            innerStyle={{
              background: `linear-gradient(160deg, ${theme.dark} 0%, ${theme.bg} 40%, ${theme.mid} 100%)`,
            }}
            accentColor={theme.primary}
          >
            {/* Radial color bloom from card position */}
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at 32% 50%, ${theme.primary}3a 0%, transparent 60%)`,
              pointerEvents: "none",
            }} />

            {/* Diagonal energy bars */}
            <EnergyBars color={theme.primary} show={showCard} />

            {/* Corner accents */}
            <CornerAccents color={theme.primary} show={showCard} />

            {/* ── Card — slams in, tilted, centered-left ─────────────────── */}
            <AnimatePresence>
              {showCard && (
                <motion.div
                  initial={{ y: -180, rotate: cardTilt - 18, scale: 0.5, opacity: 0 }}
                  animate={{ y: 0, rotate: cardTilt, scale: 1, opacity: 1 }}
                  exit={{ y: 40, opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.12, 1.7, 0.26, 1] }}
                  style={{
                    position: "absolute",
                    left: "28%", top: "33%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 8,
                    filter: `
                      drop-shadow(0 0 50px ${theme.primary}cc)
                      drop-shadow(0 0 20px ${theme.primary}66)
                      drop-shadow(0 20px 48px rgba(0,0,0,0.99))
                    `,
                  }}
                >
                  {/* Pulsing rarity aura ring */}
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.75, 0.45] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute", inset: -24,
                      border: `3px solid ${theme.primary}88`,
                      borderRadius: 20, zIndex: -1,
                      boxShadow: `0 0 60px ${theme.primary}55, inset 0 0 30px ${theme.primary}11`,
                    }}
                  />
                  {/* Second smaller ring */}
                  <motion.div
                    animate={{ scale: [1, 1.04, 1], opacity: [0.25, 0.55, 0.25] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                    style={{
                      position: "absolute", inset: -8,
                      border: `2px solid ${theme.primary}55`,
                      borderRadius: 16, zIndex: -1,
                    }}
                  />
                  <div style={{ transform: "scale(1.75)", transformOrigin: "center center" }}>
                    <CharacterCard defId={defId} def={def} size="lg" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Info panel — right of card ─────────────────────────────── */}
            <AnimatePresence>
              {showText && (
                <motion.div
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.18, 1.4, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    left: "54%", top: "33%",
                    transform: "translateY(-50%)",
                    zIndex: 12,
                  }}
                >
                  {/* JUJUTSU KAISEN header */}
                  <div style={{
                    background: theme.primary, padding: "4px 20px 4px 14px",
                    transform: "skewX(-12deg)", marginBottom: 12, display: "inline-block",
                    boxShadow: `0 0 28px ${theme.primary}aa`,
                  }}>
                    <span style={{
                      fontSize: 9, letterSpacing: 8, color: theme.textOn,
                      fontWeight: 900, display: "block", transform: "skewX(12deg)",
                    }}>JUJUTSU KAISEN</span>
                  </div>

                  {/* Giant rarity */}
                  <div style={{
                    fontSize: "clamp(72px, 10vw, 110px)",
                    fontWeight: 900, color: theme.primary,
                    letterSpacing: -4, lineHeight: 0.82, fontStyle: "italic",
                    WebkitTextStroke: "3px #000",
                    textShadow: `0 0 40px ${theme.primary}dd, 0 0 90px ${theme.primary}55`,
                    marginBottom: 6,
                  }}>
                    {def.rarity}
                  </div>

                  {/* Name block */}
                  <div style={{
                    display: "inline-block",
                    background: "#000", padding: "10px 24px 10px 18px", marginBottom: 10,
                    transform: "skewX(-9deg)",
                    borderLeft: `6px solid ${theme.primary}`,
                    boxShadow: `0 0 18px rgba(0,0,0,0.95), 0 0 8px ${theme.primary}33`,
                  }}>
                    <div style={{
                      fontSize: 24, fontWeight: 900, color: "#fff",
                      letterSpacing: 2, transform: "skewX(9deg)",
                      textShadow: `0 0 14px ${theme.primary}77`,
                    }}>
                      {def.name.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 9, color: theme.primary + "bb", letterSpacing: 6,
                      marginTop: 5, transform: "skewX(9deg)", fontWeight: 700,
                    }}>
                      {def.affinity === "LEADER" ? "— LEADER CLASS —"
                        : def.affinity === "COMBAT" ? "— COMBAT CLASS —"
                        : "— SUPPORT CLASS —"}
                    </div>
                  </div>

                  {/* REVEALED badge */}
                  <div>
                    <div style={{
                      display: "inline-block",
                      background: "#000", padding: "5px 22px",
                      transform: "skewX(-9deg)",
                      border: `2px solid ${theme.primary}`,
                      boxShadow: `0 0 18px ${theme.primary}66`,
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: 900, letterSpacing: 11,
                        color: "#fff", display: "block", transform: "skewX(9deg)",
                      }}>REVEALED</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TornFull>

          {/* !! marks — outside the torn panel, top-right corner */}
          <div style={{ position: "absolute", right: "2%", top: "5%", zIndex: 220 }}>
            <ExclaimMarks color={theme.primary} show={showCard} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
