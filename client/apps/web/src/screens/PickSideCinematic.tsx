import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardDef } from "@cg/contracts";
import CharacterCard from "../components/CharacterCard";
import { TornHalf } from "./TornPanel";

// Half-screen Persona 5 cinematic when a high-rarity card is PICKED
// Smaller panel, tilted card, torn edges rip through the card

type Phase = "in" | "hold" | "out";

const RARITY_COLOR: Record<string, string> = {
  SS:  "#ff22cc",
  SSS: "#00ff88",
  X:   "#ff2222",
};

export default function PickSideCinematic({
  defId, def, side, onDone,
}: {
  defId: string;
  def: CardDef;
  side: "left" | "right";
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("in");
  const color = RARITY_COLOR[def.rarity] ?? "#ff22cc";
  const isLeft = side === "left";

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("out"),  2000);
    const t3 = setTimeout(onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Slash bars sweep from the attachment edge inward
  const bars = [
    { top: "5%",  h: 55,  wPct: 110, delay: 0     },
    { top: "30%", h: 40,  wPct: 95,  delay: 0.035  },
    { top: "55%", h: 48,  wPct: 105, delay: 0.07   },
    { top: "78%", h: 36,  wPct: 88,  delay: 0.105  },
  ];

  // Card tilt: lean toward the player's side
  const cardTilt = isLeft ? -10 : 10;

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0 }}
          transition={{ duration: 0.16, ease: [0.2, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            top: "12%", bottom: "12%",
            [isLeft ? "left" : "right"]: 0,
            width: "36%",
            zIndex: 150,
            transformOrigin: isLeft ? "left center" : "right center",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          <TornHalf
            accentColor={color}
            style={{ position: "absolute", inset: 0 }}
            innerStyle={{ background: "#000" }}
          >
            {/* BG — radial wash from card center */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(ellipse at 50% 50%, ${color}2a 0%, #000 68%)`,
                zIndex: 0,
              }}
            />

            {/* Slash bars sweep in */}
            {bars.map((b, i) => (
              <motion.div
                key={i}
                initial={{ x: isLeft ? "-115%" : "115%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 0.15, delay: b.delay, ease: [0.2, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  top: b.top,
                  [isLeft ? "left" : "right"]: "-5%",
                  width: `${b.wPct}%`, height: b.h,
                  background: `linear-gradient(${isLeft ? "90deg" : "270deg"}, ${color}30, ${color}14, transparent)`,
                  border: `1px solid ${color}40`,
                  transform: "skewY(-6deg)",
                  zIndex: 2,
                }}
              />
            ))}

            {/* Bloom behind card */}
            <motion.div
              animate={{ opacity: [0.28, 0.5, 0.28] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                position: "absolute", left: "50%", top: "50%",
                width: 420, height: 420,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(ellipse at center, ${color}44 0%, transparent 65%)`,
                borderRadius: "50%", zIndex: 3, pointerEvents: "none",
              }}
            />

            {/* Card — tilted, centered, slams down from above */}
            <motion.div
              initial={{ y: -260, rotate: cardTilt * 2, scale: 0.6, opacity: 0 }}
              animate={{ y: 0, rotate: cardTilt, scale: 1, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.36, ease: [0.15, 1.7, 0.3, 1] }}
              style={{
                position: "absolute",
                left: "50%", top: "50%",
                transform: `translate(-50%, -50%) rotate(${cardTilt}deg)`,
                zIndex: 10,
                filter: `drop-shadow(0 0 55px ${color}99) drop-shadow(0 22px 44px rgba(0,0,0,0.98))`,
              }}
            >
              {/* Pulse ring */}
              <motion.div
                animate={{ scale: [1, 1.07, 1], opacity: [0.32, 0.58, 0.32] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  position: "absolute", inset: -18,
                  border: `2px solid ${color}77`,
                  borderRadius: 22, zIndex: -1,
                  boxShadow: `0 0 44px ${color}44`,
                }}
              />
              <div style={{ transform: "scale(1.85)", transformOrigin: "center center" }}>
                <CharacterCard defId={defId} def={def} size="lg" />
              </div>
            </motion.div>
          </TornHalf>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
