import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";

// ── Rarity themes ─────────────────────────────────────────────────────────────
const RARITY_THEME: Record<string, { primary: string; bg: string; dark: string; mid: string }> = {
  SS:  { primary: "#ff22cc", bg: "#1e0016", dark: "#0c0008", mid: "#3a0028" },
  SSS: { primary: "#00ff88", bg: "#001a0c", dark: "#000c06", mid: "#003018" },
  X:   { primary: "#ff3322", bg: "#200000", dark: "#0c0000", mid: "#380000" },
  S:   { primary: "#ffd700", bg: "#1c1400", dark: "#0a0800", mid: "#2e2200" },
  A:   { primary: "#cc44ff", bg: "#160020", dark: "#080010", mid: "#280038" },
};
const DEFAULT_THEME = RARITY_THEME.SS;

// Corner bracket accent — P5 styled corner frame pieces
function CornerBrackets({ color }: { color: string }) {
  const size = 28;
  const thick = 4;
  const corners = [
    { top: 0,    left: 0,    borderTop: thick, borderLeft: thick,  borderBottom: 0, borderRight: 0 },
    { top: 0,    right: 0,   borderTop: thick, borderRight: thick, borderBottom: 0, borderLeft: 0  },
    { bottom: 0, left: 0,    borderBottom: thick, borderLeft: thick, borderTop: 0, borderRight: 0  },
    { bottom: 0, right: 0,   borderBottom: thick, borderRight: thick, borderTop: 0, borderLeft: 0  },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18, delay: 0.05 + i * 0.03, ease: [0.12, 1.8, 0.3, 1] }}
          style={{
            position: "absolute",
            width: size, height: size,
            borderColor: color,
            borderStyle: "solid",
            borderTopWidth: c.borderTop ?? 0,
            borderLeftWidth: c.borderLeft ?? 0,
            borderBottomWidth: c.borderBottom ?? 0,
            borderRightWidth: c.borderRight ?? 0,
            ...("top" in c ? { top: c.top } : {}),
            ...("bottom" in c ? { bottom: c.bottom } : {}),
            ...("left" in c ? { left: c.left } : {}),
            ...("right" in c ? { right: c.right } : {}),
            zIndex: 4,
            boxShadow: `0 0 12px ${color}88`,
          }}
        />
      ))}
    </>
  );
}

// Diagonal P5 flash bars — behind the card
function FlashBars({ color, show }: { color: string; show: boolean }) {
  return (
    <>
      {[
        { top: "15%", w: "160%", h: 22, delay: 0,    op: 0.13 },
        { top: "44%", w: "140%", h: 36, delay: 0.03, op: 0.09 },
        { top: "70%", w: "150%", h: 18, delay: 0.06, op: 0.11 },
      ].map((b, i) => (
        <motion.div key={i}
          initial={{ x: "-130%", opacity: 0 }}
          animate={show ? { x: "0%", opacity: b.op } : { x: "130%", opacity: 0 }}
          transition={{ duration: 0.2, delay: b.delay, ease: [0.2, 1, 0.3, 1] }}
          style={{
            position: "absolute", top: b.top, left: "-30%",
            width: b.w, height: b.h,
            background: `linear-gradient(90deg, transparent, ${color}cc, ${color}44, transparent)`,
            transform: "skewY(-3deg)", mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

// Rarity label strip — slides in from the side
function RarityLabel({ rarity, color, show, isLeft }: { rarity: string; color: string; show: boolean; isLeft: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: isLeft ? -80 : 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, delay: 0.1, ease: [0.18, 1.4, 0.3, 1] }}
          style={{
            position: "absolute",
            bottom: -36,
            left: "50%",
            transform: "translateX(-50%)",
            background: color,
            padding: "3px 20px",
            transform: "translateX(-50%) skewX(-12deg)",
            zIndex: 6,
          }}
        >
          <span style={{
            fontSize: 11, fontWeight: 900, letterSpacing: 8,
            color: "#000", display: "block", transform: "skewX(12deg)",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}>
            {rarity}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
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
    const t3 = setTimeout(onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const showCard = phase !== "out";
  const showInfo = phase === "hold";
  const cardTilt = isLeft ? -4 : 4;

  const containerStyle: React.CSSProperties = isLeft
    ? { position: "fixed", left: "4%", top: 0, bottom: 0, display: "flex", alignItems: "center" }
    : { position: "fixed", right: "4%", top: 0, bottom: 0, display: "flex", alignItems: "center" };

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ ...containerStyle, zIndex: 150, pointerEvents: "none" }}
        >
          {/* Background flash bars (no background panel — transparent) */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <FlashBars color={theme.primary} show={showCard} />
          </div>

          {/* Card + border frame */}
          <AnimatePresence>
            {showCard && (
              <motion.div
                initial={{ y: isLeft ? -240 : -240, rotate: cardTilt - 18, scale: 0.45, opacity: 0 }}
                animate={{ y: 0, rotate: cardTilt, scale: 1, opacity: 1 }}
                exit={{ y: 40, scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.44, ease: [0.12, 1.7, 0.26, 1] }}
                style={{ position: "relative", zIndex: 8 }}
              >
                {/* Outer glow halo */}
                <motion.div
                  animate={{ opacity: [0.5, 0.9, 0.5] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    inset: -28,
                    borderRadius: 22,
                    background: `radial-gradient(ellipse at 50% 50%, ${theme.primary}44 0%, transparent 70%)`,
                    zIndex: -1,
                  }}
                />

                {/* Solid border frame */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12, delay: 0.08 }}
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: 16,
                    border: `2px solid ${theme.primary}`,
                    boxShadow: `
                      0 0 0 1px #000,
                      0 0 20px ${theme.primary}99,
                      0 0 50px ${theme.primary}44,
                      inset 0 0 12px ${theme.primary}22
                    `,
                    zIndex: 3,
                  }}
                />

                {/* Inner thin accent border */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, delay: 0.12 }}
                  style={{
                    position: "absolute",
                    inset: -12,
                    borderRadius: 20,
                    border: `1px solid ${theme.primary}55`,
                    boxShadow: `0 0 30px ${theme.primary}33`,
                    zIndex: 2,
                  }}
                />

                {/* P5 corner brackets on outer border */}
                <div style={{ position: "absolute", inset: -12, zIndex: 4 }}>
                  <CornerBrackets color={theme.primary} />
                </div>

                {/* Drop shadow behind card */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 12,
                  boxShadow: `0 24px 60px rgba(0,0,0,0.95), 0 8px 20px rgba(0,0,0,0.8)`,
                  zIndex: -1,
                }} />

                {/* The card itself — full size, unclipped */}
                <div style={{ transform: "scale(1.45)", transformOrigin: "center center", display: "block" }}>
                  <CharacterCard defId={defId} def={def} size="lg" />
                </div>

                {/* Rarity strip below card */}
                <RarityLabel rarity={def.rarity} color={theme.primary} show={showInfo} isLeft={isLeft} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
