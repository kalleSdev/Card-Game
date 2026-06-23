import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import { TornFull } from "./TornPanel";

// Persona 5-style full-screen cinematic for SS / SSS / X reveals via the Reveal spell

type CinPhase = "flash" | "slash" | "card" | "hold" | "exit";

// Rarity themes — map to actual rarity colors from the game
const RARITY_THEME: Record<string, {
  primary: string; secondary: string; label: string; bg: string;
  panelColor: string; textOnPrimary: string;
}> = {
  SS:  { primary: "#ff22cc", secondary: "#ffaaee", label: "SS",   bg: "rgba(50,0,35,0.97)",  panelColor: "#ff22cc", textOnPrimary: "#fff" },
  SSS: { primary: "#00ff88", secondary: "#aaffdd", label: "SSS",  bg: "rgba(0,28,14,0.97)",  panelColor: "#00ff88", textOnPrimary: "#001a0a" },
  X:   { primary: "#ff2222", secondary: "#ffaaaa", label: "X",    bg: "rgba(22,0,0,0.97)",   panelColor: "#ff2222", textOnPrimary: "#fff" },
};

// ── Diagonal sweep bars ───────────────────────────────────────────────────────
function SlashBars({ color, show }: { color: string; show: boolean }) {
  const bars = [
    { top: "5%",  width: "115%", delay: 0,     h: 55 },
    { top: "30%", width: "100%", delay: 0.04,  h: 40 },
    { top: "54%", width: "110%", delay: 0.08,  h: 50 },
    { top: "78%", width: "92%",  delay: 0.12,  h: 38 },
  ];
  return (
    <>
      {bars.map((b, i) => (
        <motion.div
          key={i}
          initial={{ x: "-115%", opacity: 0 }}
          animate={show ? { x: "0%", opacity: 1 } : { x: "115%", opacity: 0 }}
          transition={{ duration: 0.16, delay: b.delay, ease: [0.2, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            top: b.top, left: "-8%",
            width: b.width, height: b.h,
            background: `linear-gradient(90deg, ${color}44, ${color}22, transparent)`,
            border: `1px solid ${color}55`,
            transform: "skewY(-7deg)",
            zIndex: 2,
          }}
        />
      ))}
    </>
  );
}

// ── Thick accent bars ─────────────────────────────────────────────────────────
function AccentBars({ color, show }: { color: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Top-left solid bar */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ position: "absolute", top: 0, left: 0, zIndex: 6,
              width: 260, height: 10, background: color, transformOrigin: "left center" }}
          />
          {/* Second thin line below */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.03, ease: "easeOut" }}
            style={{ position: "absolute", top: 12, left: 0, zIndex: 6,
              width: 140, height: 3, background: color, transformOrigin: "left center" }}
          />
          {/* Bottom-right */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.05, ease: "easeOut" }}
            style={{ position: "absolute", bottom: 0, right: 0, zIndex: 6,
              width: 310, height: 10, background: color, transformOrigin: "right center" }}
          />
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
            transition={{ duration: 0.12, delay: 0.08, ease: "easeOut" }}
            style={{ position: "absolute", bottom: 12, right: 0, zIndex: 6,
              width: 160, height: 3, background: color, transformOrigin: "right center" }}
          />
          {/* Left vertical line */}
          <motion.div
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: "absolute", top: 0, left: 28, bottom: 0, zIndex: 5,
              width: 4, background: `linear-gradient(180deg, ${color}, transparent)`, transformOrigin: "top center" }}
          />
          {/* Right vertical line */}
          <motion.div
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
            transition={{ duration: 0.18, delay: 0.04 }}
            style={{ position: "absolute", top: 0, right: 28, bottom: 0, zIndex: 5,
              width: 4, background: `linear-gradient(180deg, transparent, ${color})`, transformOrigin: "bottom center" }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ── Card section (left side) ──────────────────────────────────────────────────
function CardSection({ defId, def, color, show }: { defId: string; def: CardDef; color: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -220, rotate: -18, scale: 0.65, opacity: 0 }}
          animate={{ y: 0, rotate: def.rarity === "X" ? -4 : -9, scale: 1, opacity: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.38, ease: [0.15, 1.6, 0.3, 1] }}
          style={{
            position: "absolute",
            left: "50%", top: "44%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            filter: `drop-shadow(0 0 50px ${color}88) drop-shadow(0 20px 40px rgba(0,0,0,0.95))`,
          }}
        >
          <div style={{ transform: "scale(1.9)", transformOrigin: "center center" }}>
            <CharacterCard defId={defId} def={def} size="lg" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Info panel (right side) ───────────────────────────────────────────────────
function InfoPanel({
  def, theme, show,
}: { def: CardDef; theme: typeof RARITY_THEME[string]; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: 160, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 1.4, 0.3, 1] }}
          style={{
            position: "absolute",
            right: "4%", top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            maxWidth: "38%",
          }}
        >
          {/* Series tag */}
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.06, duration: 0.18 }}
            style={{
              display: "inline-block",
              background: theme.panelColor,
              padding: "5px 18px 5px 14px",
              marginBottom: 14,
              transform: "skewX(-10deg)",
              boxShadow: `0 0 24px ${theme.primary}88`,
            }}
          >
            <span style={{
              fontSize: 10, letterSpacing: 7,
              color: theme.textOnPrimary,
              fontWeight: 900, display: "block",
              transform: "skewX(10deg)",
            }}>
              JUJUTSU KAISEN
            </span>
          </motion.div>

          {/* Giant rarity label */}
          <motion.div
            initial={{ scale: 1.8, opacity: 0, skewX: -8 }}
            animate={{ scale: 1, opacity: 1, skewX: -4 }}
            transition={{ delay: 0.1, duration: 0.28, ease: [0.15, 1.5, 0.3, 1] }}
            style={{
              fontSize: 100, fontWeight: 900,
              color: theme.primary,
              letterSpacing: -4, lineHeight: 0.85,
              textShadow: `0 0 0 2px #000, 0 0 30px ${theme.primary}cc, 0 0 80px ${theme.primary}55`,
              WebkitTextStroke: `3px ${theme.textOnPrimary === "#fff" ? "#000" : "#fff"}`,
              fontStyle: "italic",
            }}
          >
            {theme.label}
          </motion.div>

          {/* "RATED" label */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.2 }}
            style={{
              display: "inline-block",
              background: "#000",
              padding: "4px 18px",
              marginTop: 10,
              transform: "skewX(-8deg)",
              border: `2px solid ${theme.primary}`,
              boxShadow: `0 0 16px ${theme.primary}55`,
            }}
          >
            <span style={{
              fontSize: 18, fontWeight: 900, letterSpacing: 12,
              color: "#fff",
              transform: "skewX(8deg)",
              display: "block",
            }}>
              RATED
            </span>
          </motion.div>

          {/* Card name */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.22 }}
            style={{
              marginTop: 24,
              display: "inline-block",
              background: "#000",
              padding: "10px 22px",
              transform: "skewX(-8deg)",
              borderLeft: `5px solid ${theme.primary}`,
              boxShadow: `inset 0 0 20px rgba(0,0,0,0.8)`,
            }}
          >
            <div style={{
              fontSize: 26, fontWeight: 900, color: "#fff",
              letterSpacing: 2, transform: "skewX(8deg)",
              textShadow: `0 0 14px ${theme.primary}66`,
            }}>
              {def.name.toUpperCase()}
            </div>
            <div style={{
              fontSize: 10, color: theme.primary, letterSpacing: 5,
              marginTop: 5, transform: "skewX(8deg)",
              fontWeight: 700,
            }}>
              {def.affinity === "LEADER" ? "— LEADER CLASS —" : def.affinity === "COMBAT" ? "— COMBAT CLASS —" : "— SUPPORT CLASS —"}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Pulse ring behind card ────────────────────────────────────────────────────
function PulseRing({ color, show }: { color: string; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", left: "50%", top: "44%",
              width: 280, height: 390,
              transform: "translate(-50%, -50%) scale(1.9)",
              border: `2px solid ${color}66`,
              borderRadius: 18, zIndex: 4,
              boxShadow: `0 0 60px ${color}44, inset 0 0 40px ${color}11`,
            }}
          />
          {/* Glow bloom behind card */}
          <motion.div
            animate={{ opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{
              position: "absolute", left: "50%", top: "44%",
              width: 600, height: 600,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(ellipse at center, ${color}33 0%, transparent 65%)`,
              borderRadius: "50%", zIndex: 3, pointerEvents: "none",
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CardRevealCinematic({
  defId, def, onDone,
}: {
  defId: string;
  def: CardDef;
  onDone: () => void;
}) {
  const theme = RARITY_THEME[def.rarity] ?? RARITY_THEME.SS;
  const [phase, setPhase] = useState<CinPhase>("flash");

  useEffect(() => {
    const seq: [number, CinPhase][] = [
      [70,   "slash"],
      [280,  "card"],
      [520,  "hold"],
      [2900, "exit"],
    ];
    const timers = seq.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    const done = setTimeout(onDone, 3500);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, []);

  const showSlash = ["slash", "card", "hold"].includes(phase);
  const showCard  = ["card", "hold"].includes(phase);
  const showText  = phase === "hold";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{ duration: phase === "exit" ? 0.4 : 0.03 }}
      style={{
        position: "fixed",
        left: "10%", top: "8%",
        width: "80%", height: "84%",
        zIndex: 200,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <TornFull
        accentColor={theme.primary}
        style={{ position: "absolute", inset: 0 }}
        innerStyle={{ background: "#000" }}
      >
        {/* Colored background wash */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showCard ? 1 : 0 }}
          transition={{ duration: 0.28 }}
          style={{ position: "absolute", inset: 0, background: theme.bg, zIndex: 0 }}
        />

        {/* Film grain overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px", opacity: 0.45, mixBlendMode: "overlay",
        }} />

        <SlashBars color={theme.primary} show={showSlash} />
        <AccentBars color={theme.primary} show={showSlash} />
        <PulseRing color={theme.primary} show={showCard} />
        <CardSection defId={defId} def={def} color={theme.primary} show={showCard} />
        <InfoPanel def={def} theme={theme} show={showText} />

        <AnimatePresence>
          {phase === "flash" && (
            <motion.div
              initial={{ opacity: 1 }} animate={{ opacity: 0 }}
              transition={{ duration: 0.07 }}
              style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 50 }}
            />
          )}
        </AnimatePresence>
      </TornFull>
    </motion.div>
  );
}
