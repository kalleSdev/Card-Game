import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Bottom-of-screen energy burst when a high-rarity card is RATED
// Pure color — no text, no banner, just a punchy cinematic flash

const RARITY_COLOR: Record<string, string> = {
  SS:  "#ff22cc",
  SSS: "#00ff88",
  X:   "#ff2222",
};

// Upward-shooting energy beam
function Beam({ color, x, width, delay, dur }: {
  color: string; x: string; width: number; delay: number; dur: number;
}) {
  return (
    <motion.div
      initial={{ scaleY: 0, opacity: 0.9 }}
      animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 0.7, 0] }}
      transition={{ duration: dur, delay, ease: "easeOut" }}
      style={{
        position: "absolute",
        bottom: 0, left: x,
        width,
        height: "100%",
        background: `linear-gradient(0deg, ${color}ee 0%, ${color}88 40%, ${color}22 75%, transparent 100%)`,
        transformOrigin: "bottom center",
        borderRadius: "2px 2px 0 0",
        filter: `blur(${width > 14 ? 1 : 0}px)`,
        zIndex: 2,
      }}
    />
  );
}

// P5-style diagonal speed line
function SpeedLine({ color, y, delay, skew }: {
  color: string; y: string; delay: number; skew: number;
}) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0.7 }}
      animate={{ scaleX: [0, 1], opacity: [0.7, 0] }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      style={{
        position: "absolute",
        top: y, left: 0,
        width: "100%", height: 2,
        background: `linear-gradient(90deg, ${color}cc, ${color}44, transparent)`,
        transform: `skewY(${skew}deg)`,
        transformOrigin: "left center",
        zIndex: 3,
      }}
    />
  );
}

export default function RateSideCinematic({
  rarity, side, onDone,
}: {
  rarity: string;
  side: "left" | "right";
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const color = RARITY_COLOR[rarity] ?? "#ff22cc";
  const isLeft = side === "left";

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 1400);
    const t2 = setTimeout(onDone, 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const beams = [
    { x: "4%",  w: 8,   delay: 0,     dur: 0.9 },
    { x: "14%", w: 22,  delay: 0.03,  dur: 1.1 },
    { x: "24%", w: 6,   delay: 0.06,  dur: 0.85 },
    { x: "34%", w: 18,  delay: 0.02,  dur: 1.0 },
    { x: "44%", w: 40,  delay: 0,     dur: 1.2 },  // wide central beam
    { x: "56%", w: 12,  delay: 0.05,  dur: 0.95 },
    { x: "64%", w: 8,   delay: 0.03,  dur: 0.88 },
    { x: "74%", w: 24,  delay: 0.01,  dur: 1.05 },
    { x: "86%", w: 7,   delay: 0.04,  dur: 0.82 },
  ];

  const speedLines = [
    { y: "18%", delay: 0.05, skew: -3 },
    { y: "32%", delay: 0.08, skew:  2 },
    { y: "46%", delay: 0.04, skew: -2 },
    { y: "60%", delay: 0.10, skew:  3 },
    { y: "72%", delay: 0.06, skew: -1 },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            bottom: 0,
            [isLeft ? "left" : "right"]: 0,
            width: "50%",
            height: "42%",
            zIndex: 160,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {/* Ground bloom — radial burst rising from bottom edge */}
          <motion.div
            initial={{ scaleY: 0, scaleX: 0.4, opacity: 0 }}
            animate={{ scaleY: [0, 1.2, 0.9, 0], scaleX: [0.4, 1, 0.85, 0], opacity: [0, 1, 0.8, 0] }}
            transition={{ duration: 1.1, times: [0, 0.2, 0.6, 1], ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: 0, left: "50%",
              width: "140%", height: "120%",
              transform: "translateX(-50%)",
              background: `radial-gradient(ellipse at 50% 100%, ${color}cc 0%, ${color}55 35%, ${color}11 65%, transparent 80%)`,
              transformOrigin: "50% 100%",
              zIndex: 1,
            }}
          />

          {/* Energy beams shooting upward */}
          {beams.map((b, i) => (
            <Beam key={i} color={color} x={b.x} width={b.w} delay={b.delay} dur={b.dur} />
          ))}

          {/* Horizontal speed lines */}
          {speedLines.map((s, i) => (
            <SpeedLine key={i} color={color} y={s.y} delay={s.delay} skew={s.skew} />
          ))}

          {/* Bright base flash at bottom edge */}
          <motion.div
            initial={{ opacity: 0.9, scaleY: 1 }}
            animate={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              height: "18%",
              background: `linear-gradient(0deg, ${color}ff 0%, ${color}aa 50%, transparent 100%)`,
              transformOrigin: "bottom center",
              zIndex: 4,
              filter: `blur(1px)`,
            }}
          />

          {/* Initial white flash */}
          <motion.div
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute", inset: 0,
              background: color,
              zIndex: 5,
              mixBlendMode: "screen",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
