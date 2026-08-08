import { motion } from "framer-motion";

// Burning rope timer. Hidden until the turn clock gets low, then it burns down
// with a flame on the end.

const ROPE_CSS = `
@keyframes cg-rope-flicker { 0%,100% { transform: scale(1) rotate(-4deg); opacity:.95 } 50% { transform: scale(1.22) rotate(5deg); opacity:1 } }
@keyframes cg-rope-ember { 0% { transform: translate(0,0) scale(1); opacity:.95 } 100% { transform: translate(var(--ex), -26px) scale(0); opacity:0 } }
@keyframes cg-rope-twist { 0% { background-position: 0 0 } 100% { background-position: 24px 0 } }
`;

export default function RopeTimer({
  secondsLeft,
  showFrom = 20,
}: {
  secondsLeft: number;
  /** Rope appears when this many seconds remain. */
  showFrom?: number;
}) {
  if (secondsLeft > showFrom) return null;

  const frac = Math.max(0, Math.min(1, secondsLeft / showFrom));
  const panic = secondsLeft <= 5;

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: "100%",
      display: "flex", justifyContent: "center", alignItems: "center",
      pointerEvents: "none", zIndex: 60, paddingBottom: 6,
    }}>
      <style>{ROPE_CSS}</style>

      <div style={{ position: "relative", width: 340, height: 16 }}>
        {/* Burnt remainder — what the flame has already eaten */}
        <div style={{
          position: "absolute", left: 0, top: 5, height: 6, right: 0,
          borderRadius: 3, background: "rgba(30,22,18,0.55)",
        }} />

        {/* The rope itself, shrinking from the right */}
        <motion.div
          animate={{ width: `${frac * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
          style={{
            position: "absolute", left: 0, top: 4, height: 8,
            borderRadius: 4,
            background: `repeating-linear-gradient(115deg,
              #c9922f 0px, #c9922f 5px,
              #a3701f 5px, #a3701f 10px,
              #dcae52 10px, #dcae52 12px)`,
            backgroundSize: "24px 100%",
            animation: "cg-rope-twist 1.4s linear infinite",
            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        />

        {/* Flame riding the burning end */}
        <motion.div
          animate={{ left: `${frac * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
          style={{ position: "absolute", top: -6, width: 0, height: 0 }}
        >
          <div style={{
            position: "absolute", left: -13, top: -4,
            width: 26, height: 26, borderRadius: "50% 50% 46% 46%",
            background: panic
              ? "radial-gradient(circle at 50% 70%, #fff3b0, #ff5a1f 55%, rgba(255,60,0,0) 78%)"
              : "radial-gradient(circle at 50% 70%, #ffe08a, #ff7a1f 55%, rgba(255,110,0,0) 78%)",
            filter: "blur(0.6px)",
            animation: "cg-rope-flicker 0.32s ease-in-out infinite",
          }} />
          {/* Embers peeling off the flame */}
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{
              position: "absolute", left: -2, top: 0,
              width: 3, height: 3, borderRadius: "50%",
              background: i % 2 ? "#ffd27a" : "#ff8a3d",
              boxShadow: "0 0 6px rgba(255,150,50,0.9)",
              ["--ex" as string]: `${(i - 1.5) * 11}px`,
              animation: `cg-rope-ember ${0.75 + i * 0.16}s linear ${i * 0.19}s infinite`,
            } as React.CSSProperties} />
          ))}
        </motion.div>

        {/* Smoke trailing from the burn point */}
        <motion.div
          animate={{ left: `${frac * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
          style={{ position: "absolute", top: -22, width: 0, height: 0 }}
        >
          <motion.div
            animate={{ opacity: [0.18, 0.34, 0.18], y: [0, -7, 0] }}
            transition={{ duration: 2.1, repeat: Infinity }}
            style={{
              position: "absolute", left: -16, width: 32, height: 26, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(150,140,135,0.5), transparent 70%)",
              filter: "blur(5px)",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
