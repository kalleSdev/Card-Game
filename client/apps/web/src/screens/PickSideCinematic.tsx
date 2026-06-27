import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import { TornHalf } from "./TornPanel";

// ── Rarity themes ─────────────────────────────────────────────────────────────
const RARITY_THEME: Record<string, { primary: string; bg: string; dark: string; mid: string }> = {
  SS:  { primary: "#ff22cc", bg: "#1e0016", dark: "#0c0008", mid: "#3a0028" },
  SSS: { primary: "#00ff88", bg: "#001a0c", dark: "#000c06", mid: "#003018" },
  X:   { primary: "#ff3322", bg: "#200000", dark: "#0c0000", mid: "#380000" },
  S:   { primary: "#ffd700", bg: "#1c1400", dark: "#0a0800", mid: "#2e2200" },
  A:   { primary: "#cc44ff", bg: "#160020", dark: "#080010", mid: "#280038" },
};
const DEFAULT_THEME = RARITY_THEME.SS;

// Diagonal energy flash inside the torn area
function FlashBars({ color, show }: { color: string; show: boolean }) {
  return (
    <>
      {[
        { top: "22%", w: "110%", h: 18, delay: 0,    op: 0.16 },
        { top: "50%", w: "95%",  h: 28, delay: 0.04, op: 0.12 },
        { top: "74%", w: "105%", h: 14, delay: 0.07, op: 0.14 },
      ].map((b, i) => (
        <motion.div key={i}
          initial={{ x: "-120%", opacity: 0 }}
          animate={show ? { x: "0%", opacity: b.op } : { x: "120%", opacity: 0 }}
          transition={{ duration: 0.18, delay: b.delay, ease: [0.2, 1, 0.3, 1] }}
          style={{
            position: "absolute", top: b.top, left: "-8%",
            width: b.w, height: b.h,
            background: `linear-gradient(90deg, ${color}cc, ${color}44, transparent)`,
            transform: "skewY(-2.5deg)", mixBlendMode: "screen",
          }}
        />
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PickSideCinematic({
  defId, def, side, onDone,
}: {
  defId: string; def: CardDef; side: "left" | "right"; onDone: () => void;
}) {
  const theme = RARITY_THEME[def.rarity] ?? DEFAULT_THEME;
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const isLeft = side === "left";

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 160);
    const t2 = setTimeout(() => setPhase("out"),  2000);
    const t3 = setTimeout(onDone, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const showCard = phase !== "out";
  const cardTilt = isLeft ? -5 : 5;

  // Container: tight — just enough for the torn panel + a little padding
  // Narrower than before: 36% of screen width
  const containerStyle: React.CSSProperties = isLeft
    ? { position: "fixed", left: 0, top: 0, bottom: 0, width: "36%" }
    : { position: "fixed", right: 0, top: 0, bottom: 0, width: "36%" };

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ ...containerStyle, zIndex: 150, pointerEvents: "none",
            fontFamily: "'Segoe UI', system-ui, sans-serif" }}
        >
          {/* TornHalf panel — compact vertical slice, 20% vertical margin */}
          <TornHalf
            style={{ position: "absolute", left: 0, top: "16%", right: 0, bottom: "16%" }}
            innerStyle={{
              background: `linear-gradient(160deg, ${theme.dark} 0%, ${theme.bg} 45%, ${theme.mid} 100%)`,
            }}
            accentColor={theme.primary}
          >
            {/* Radial bloom */}
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at 50% 50%, ${theme.primary}33 0%, transparent 65%)`,
            }} />

            <FlashBars color={theme.primary} show={showCard} />

            {/* Card — centered in panel, slams in from above, same scale as before */}
            <AnimatePresence>
              {showCard && (
                <motion.div
                  initial={{ y: -200, rotate: cardTilt - 20, scale: 0.5, opacity: 0 }}
                  animate={{ y: 0, rotate: cardTilt, scale: 1, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.12, 1.7, 0.26, 1] }}
                  style={{
                    position: "absolute",
                    left: "50%", top: "48%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 8,
                    filter: `
                      drop-shadow(0 0 48px ${theme.primary}cc)
                      drop-shadow(0 0 18px ${theme.primary}55)
                      drop-shadow(0 18px 44px rgba(0,0,0,0.99))
                    `,
                  }}
                >
                  {/* Aura ring */}
                  <motion.div
                    animate={{ scale: [1, 1.09, 1], opacity: [0.4, 0.72, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute", inset: -20,
                      border: `3px solid ${theme.primary}77`,
                      borderRadius: 18, zIndex: -1,
                      boxShadow: `0 0 55px ${theme.primary}44`,
                    }}
                  />
                  <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
                    <CharacterCard defId={defId} def={def} size="lg" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TornHalf>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
