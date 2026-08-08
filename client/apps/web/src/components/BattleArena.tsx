import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { DOMAIN_COLOR, DEFAULT_DOMAIN_COLOR } from "../theme";

// Parallax background for the battle board. All CSS and SVG, no image files.
// Each layer multiplies the same pointer spring by its own depth so the far
// stuff barely moves and the props up front swing about.

const ARENA_CSS = `
@keyframes cg-miasma-a { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity:.30 } 50% { transform: translate3d(6%,-3%,0) scale(1.15); opacity:.50 } }
@keyframes cg-miasma-b { 0%,100% { transform: translate3d(0,0,0) scale(1.1); opacity:.22 } 50% { transform: translate3d(-7%,4%,0) scale(1); opacity:.42 } }
@keyframes cg-seal-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes cg-seal-spin-rev { from { transform: rotate(360deg) } to { transform: rotate(0deg) } }
@keyframes cg-seal-pulse { 0%,100% { opacity:.16 } 50% { opacity:.36 } }
@keyframes cg-ember { 0% { transform: translateY(0) translateX(0); opacity:0 } 12% { opacity:.85 } 100% { transform: translateY(-88vh) translateX(var(--cg-drift)); opacity:0 } }
@keyframes cg-fog { 0% { transform: translateX(-14%) } 100% { transform: translateX(14%) } }
@keyframes cg-flame { 0%,100% { transform: scaleY(1) scaleX(1); opacity:.9 } 50% { transform: scaleY(1.22) scaleX(.9); opacity:1 } }
@keyframes cg-banner { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
@keyframes cg-runeline { 0%,100% { opacity:.10 } 50% { opacity:.30 } }
@keyframes cg-petal { 0% { transform: translateY(-6vh) translateX(0) rotate(0deg); opacity:0 } 10% { opacity:.55 } 90% { opacity:.4 } 100% { transform: translateY(104vh) translateX(var(--cg-drift)) rotate(720deg); opacity:0 } }
@keyframes cg-lightning { 0%,92%,100% { opacity:0 } 93% { opacity:.5 } 94% { opacity:0 } 95% { opacity:.75 } 97% { opacity:0 } }
@keyframes cg-crow { 0% { transform: translateX(-12vw) translateY(0) } 100% { transform: translateX(114vw) translateY(-6vh) } }
@keyframes cg-wing { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.35) } }
@keyframes cg-chain { 0%,100% { transform: rotate(-2.4deg) } 50% { transform: rotate(2.4deg) } }
@keyframes cg-brazier { 0%,100% { transform: translateY(0) scaleX(1); opacity:.85 } 50% { transform: translateY(-4px) scaleX(1.12); opacity:1 } }
@keyframes cg-waterfall { 0% { background-position: 0 0 } 100% { background-position: 0 240px } }
`;

// ── Parallax layer ────────────────────────────────────────────────────────────
function Layer({
  depth, children, style, zIndex,
  px, py,
}: {
  depth: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  zIndex: number;
  px: ReturnType<typeof useSpring>;
  py: ReturnType<typeof useSpring>;
}) {
  const x = useTransform(px, v => v * depth);
  const y = useTransform(py, v => v * depth);
  return (
    <motion.div style={{ position: "absolute", inset: -40, x, y, zIndex, pointerEvents: "none", ...style }}>
      {children}
    </motion.div>
  );
}

// ── Stone lantern (clickable prop) ────────────────────────────────────────────
function StoneLantern({ side, onSpark }: { side: "left" | "right"; onSpark: (x: number, y: number) => void }) {
  const [lit, setLit] = useState(false);
  return (
    <div
      onClick={(e) => {
        setLit(true);
        setTimeout(() => setLit(false), 900);
        onSpark(e.clientX, e.clientY);
      }}
      style={{
        position: "absolute", bottom: "6%",
        [side]: "2.2%",
        width: 74, height: 150,
        cursor: "pointer", pointerEvents: "auto",
        opacity: 0.85,
      } as React.CSSProperties}
      title="…something stirs"
    >
      <svg viewBox="0 0 74 150" width="74" height="150">
        {/* base */}
        <path d="M14 150 L60 150 L54 132 L20 132 Z" fill="#0d0d18" stroke="#2a2440" strokeWidth="1" />
        <rect x="28" y="92" width="18" height="42" fill="#0b0b14" stroke="#2a2440" strokeWidth="1" />
        {/* light box */}
        <path d="M16 92 L58 92 L52 62 L22 62 Z" fill="#0f0d1c" stroke="#3a3055" strokeWidth="1.2" />
        {/* window glow */}
        <path d="M25 86 L49 86 L45 68 L29 68 Z"
          fill={lit ? "rgba(255,190,90,0.95)" : "rgba(190,130,255,0.35)"}
          style={{ transition: "fill 0.35s" }} />
        {/* roof */}
        <path d="M8 62 L66 62 L58 48 L16 48 Z" fill="#12101f" stroke="#3a3055" strokeWidth="1.2" />
        <path d="M37 48 L37 40" stroke="#3a3055" strokeWidth="2" />
        <circle cx="37" cy="37" r="4" fill="#12101f" stroke="#3a3055" strokeWidth="1.2" />
      </svg>
      {/* flame halo */}
      <div style={{
        position: "absolute", left: "50%", top: 62, width: 60, height: 60,
        transform: "translateX(-50%)",
        borderRadius: "50%",
        background: lit
          ? "radial-gradient(circle, rgba(255,180,70,0.55), transparent 68%)"
          : "radial-gradient(circle, rgba(170,110,255,0.28), transparent 68%)",
        filter: "blur(7px)",
        animation: "cg-flame 2.4s ease-in-out infinite",
        transition: "background 0.35s",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Hanging banner (clickable prop) ───────────────────────────────────────────
function ShrineBanner({ kanji, side, onSpark }: { kanji: string; side: "left" | "right"; onSpark: (x: number, y: number) => void }) {
  const [swing, setSwing] = useState(false);
  return (
    <div
      onClick={(e) => {
        setSwing(true);
        setTimeout(() => setSwing(false), 1200);
        onSpark(e.clientX, e.clientY);
      }}
      style={{
        position: "absolute", top: -6,
        [side]: "12%",
        width: 46, height: 140,
        cursor: "pointer", pointerEvents: "auto",
        transformOrigin: "top center",
        animation: swing ? "cg-banner 0.42s ease-in-out 3" : "cg-banner 6s ease-in-out infinite",
        opacity: 0.8,
      } as React.CSSProperties}
      title="…a warning, or a welcome"
    >
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(180deg, rgba(70,20,30,0.9), rgba(30,8,14,0.85))",
        border: "1px solid rgba(180,70,90,0.35)",
        borderTop: "3px solid rgba(180,140,90,0.5)",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 14, gap: 6,
        boxShadow: "0 6px 26px rgba(0,0,0,0.6)",
      }}>
        {kanji.split("").map((ch, i) => (
          <span key={i} style={{
            fontSize: 20, color: "rgba(240,200,190,0.55)", lineHeight: 1,
            textShadow: "0 0 10px rgba(255,90,90,0.35)", fontWeight: 700,
          }}>{ch}</span>
        ))}
      </div>
    </div>
  );
}

// ── Cursed spirit that peeks from the edge ────────────────────────────────────
function PeekingSpirit({ onSpark }: { onSpark: (x: number, y: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [startled, setStartled] = useState(false);

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      // Appears at unpredictable intervals, lingers briefly, ducks away
      const wait = 9000 + Math.random() * 16000;
      setTimeout(() => {
        if (!alive) return;
        setVisible(true);
        setTimeout(() => { if (alive) { setVisible(false); loop(); } }, 3600);
      }, wait);
    };
    loop();
    return () => { alive = false; };
  }, []);

  return (
    <motion.div
      animate={{
        y: visible && !startled ? 0 : 70,
        opacity: visible && !startled ? 0.9 : 0,
      }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
      onClick={(e) => {
        setStartled(true);
        onSpark(e.clientX, e.clientY);
        setTimeout(() => setStartled(false), 2000);
      }}
      style={{
        position: "absolute", bottom: -4, left: "23%",
        width: 58, height: 66, cursor: "pointer", pointerEvents: "auto",
      }}
      title="…it saw you"
    >
      <svg viewBox="0 0 58 66" width="58" height="66">
        <path d="M29 4 C13 4 6 20 8 38 C9 52 18 62 29 62 C40 62 49 52 50 38 C52 20 45 4 29 4 Z"
          fill="rgba(28,12,44,0.92)" stroke="rgba(150,90,220,0.5)" strokeWidth="1.4" />
        {/* eyes */}
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1] }}
          transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.86, 0.9, 0.94] }}
          style={{ transformOrigin: "center" }}
        >
          <ellipse cx="21" cy="32" rx="5" ry="7" fill="#ffe066" />
          <ellipse cx="38" cy="32" rx="5" ry="7" fill="#ffe066" />
          <ellipse cx="21" cy="33" rx="2" ry="4" fill="#1a0a10" />
          <ellipse cx="38" cy="33" rx="2" ry="4" fill="#1a0a10" />
        </motion.g>
        {/* grin */}
        <path d="M18 47 Q29 55 40 47" stroke="rgba(255,120,120,0.6)" strokeWidth="1.6" fill="none" />
      </svg>
    </motion.div>
  );
}

// ── Braziers flanking the arena floor ─────────────────────────────────────────
function Brazier({ side, onSpark }: { side: "left" | "right"; onSpark: (x: number, y: number) => void }) {
  const [surge, setSurge] = useState(false);
  return (
    <div
      onClick={(e) => { setSurge(true); setTimeout(() => setSurge(false), 1100); onSpark(e.clientX, e.clientY); }}
      style={{
        position: "absolute", bottom: "30%", [side]: "17%",
        width: 46, height: 62, cursor: "pointer", pointerEvents: "auto", opacity: 0.9,
      } as React.CSSProperties}
      title="…the fire remembers"
    >
      {/* bowl */}
      <svg viewBox="0 0 46 62" width="46" height="62" style={{ position: "absolute", bottom: 0 }}>
        <path d="M8 62 L38 62 L34 48 L12 48 Z" fill="#0c0a16" stroke="#2e2445" strokeWidth="1" />
        <ellipse cx="23" cy="47" rx="16" ry="5" fill="#141024" stroke="#2e2445" strokeWidth="1" />
      </svg>
      {/* flame */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        width: surge ? 30 : 20, height: surge ? 46 : 30,
        borderRadius: "50% 50% 42% 42%",
        background: surge
          ? "linear-gradient(0deg, rgba(255,90,40,0.95), rgba(255,220,120,0.85))"
          : "linear-gradient(0deg, rgba(150,60,220,0.85), rgba(220,160,255,0.7))",
        filter: "blur(3px)",
        animation: "cg-brazier 1.5s ease-in-out infinite",
        transition: "width .3s, height .3s, background .35s",
      }} />
      <div style={{
        position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
        width: 70, height: 70, borderRadius: "50%",
        background: surge
          ? "radial-gradient(circle, rgba(255,150,60,0.4), transparent 68%)"
          : "radial-gradient(circle, rgba(170,90,255,0.28), transparent 68%)",
        filter: "blur(8px)", transition: "background .35s", pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Hanging cursed chains ─────────────────────────────────────────────────────
function Chains({ side }: { side: "left" | "right" }) {
  return (
    <div style={{
      position: "absolute", top: -10, [side]: "30%",
      width: 12, height: 190, transformOrigin: "top center",
      animation: "cg-chain 9s ease-in-out infinite", opacity: 0.34,
    } as React.CSSProperties}>
      <svg viewBox="0 0 12 190" width="12" height="190">
        {Array.from({ length: 11 }).map((_, i) => (
          <ellipse key={i} cx="6" cy={10 + i * 17} rx="4.5" ry="8"
            fill="none" stroke="rgba(180,160,220,0.65)" strokeWidth="1.6" />
        ))}
        <path d="M6 190 l-5 10 h10 z" fill="rgba(180,160,220,0.5)" />
      </svg>
    </div>
  );
}

// ── Crow that drifts across the sky occasionally ──────────────────────────────
function Crow({ delay, top, dur }: { delay: number; top: string; dur: number }) {
  return (
    <div style={{
      position: "absolute", top, left: 0, width: 22, height: 12,
      animation: `cg-crow ${dur}s linear ${delay}s infinite`, opacity: 0.5,
    }}>
      <svg viewBox="0 0 22 12" width="22" height="12" style={{ animation: "cg-wing 0.34s ease-in-out infinite" }}>
        <path d="M1 6 Q6 0 11 6 Q16 0 21 6" fill="none" stroke="rgba(230,220,255,0.85)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ── Main arena ────────────────────────────────────────────────────────────────
export default function BattleArena({
  domainLeaderId = null,
}: {
  /** Leader whose domain is currently active, or null. Floods the arena with their colour. */
  domainLeaderId?: string | null;
}) {
  const domainColor = domainLeaderId
    ? (DOMAIN_COLOR[domainLeaderId] ?? DEFAULT_DOMAIN_COLOR)
    : null;
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 60, damping: 22, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 60, damping: 22, mass: 0.6 });

  const [sparks, setSparks] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // -1 … 1 normalised, scaled to a max ~26px drift at depth 1
      rawX.set(((e.clientX / window.innerWidth) - 0.5) * 52);
      rawY.set(((e.clientY / window.innerHeight) - 0.5) * 34);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [rawX, rawY]);

  const spark = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setSparks(s => [...s, { id, x, y }]);
    setTimeout(() => setSparks(s => s.filter(p => p.id !== id)), 800);
  };

  // Stable ember configuration — regenerating each render would make them jitter
  const [embers] = useState(() =>
    Array.from({ length: 26 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 14,
      dur: 13 + Math.random() * 12,
      size: 1.5 + Math.random() * 2.5,
      drift: `${(Math.random() - 0.5) * 120}px`,
      warm: i % 4 === 0,
    }))
  );

  // Falling petals — slow, sparse, drifting sideways as they tumble
  const [petals] = useState(() =>
    Array.from({ length: 14 }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 26,
      dur: 20 + Math.random() * 18,
      size: 5 + Math.random() * 5,
      drift: `${(Math.random() - 0.5) * 260}px`,
    }))
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
      <style>{ARENA_CSS}</style>

      {/* 0 — Cursed sky */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: "linear-gradient(180deg, #07060f 0%, #0d0819 34%, #150a22 62%, #0a0611 100%)",
      }} />
      {/* drifting miasma */}
      <Layer depth={0.10} zIndex={1} px={px} py={py}>
        <div style={{
          position: "absolute", top: "4%", left: "8%", width: "58%", height: "56%",
          background: "radial-gradient(ellipse at 40% 40%, rgba(120,50,190,0.30), transparent 66%)",
          filter: "blur(46px)", animation: "cg-miasma-a 24s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "10%", right: "4%", width: "52%", height: "50%",
          background: "radial-gradient(ellipse at 60% 40%, rgba(190,40,90,0.22), transparent 66%)",
          filter: "blur(52px)", animation: "cg-miasma-b 31s ease-in-out infinite",
        }} />
      </Layer>

      {/* heat lightning behind the clouds */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 40% at 62% 14%, rgba(200,170,255,0.35), transparent 62%)",
        animation: "cg-lightning 17s linear infinite",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 34% at 26% 20%, rgba(255,170,200,0.28), transparent 62%)",
        animation: "cg-lightning 29s linear 8s infinite",
      }} />

      {/* crows drifting across the sky */}
      <Layer depth={0.14} zIndex={2} px={px} py={py}>
        <Crow delay={4} top="12%" dur={38} />
        <Crow delay={21} top="19%" dur={46} />
        <Crow delay={33} top="8%" dur={52} />
      </Layer>

      {/* 1 — Distant ridge */}
      <Layer depth={0.18} zIndex={2} px={px} py={py}>
        <svg viewBox="0 0 1440 420" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: "34%", left: 0, width: "100%", height: "34%", opacity: 0.55 }}>
          <path d="M0,420 L0,250 L150,160 L280,240 L420,120 L560,230 L700,150 L860,250 L1000,170 L1160,255 L1300,190 L1440,260 L1440,420 Z"
            fill="#0a0714" />
          <path d="M0,420 L0,300 L180,235 L340,300 L500,215 L660,295 L820,230 L980,300 L1140,245 L1300,305 L1440,255 L1440,420 Z"
            fill="#0d0a1b" />
        </svg>
      </Layer>

      {/* 2 — Torii gates */}
      <Layer depth={0.30} zIndex={3} px={px} py={py}>
        {[{ side: "left" as const, pos: "3%", s: 0.92 }, { side: "right" as const, pos: "3%", s: 0.92 }].map((t, i) => (
          <svg key={i} viewBox="0 0 200 300" width={200 * t.s} height={300 * t.s}
            style={{
              position: "absolute", bottom: "26%", [t.side]: t.pos,
              opacity: 0.42,
              transform: t.side === "right" ? "scaleX(-1)" : undefined,
            } as React.CSSProperties}>
            <path d="M6 40 L194 40 L188 54 L12 54 Z" fill="#160a14" />
            <path d="M0 26 L200 26 L192 42 L8 42 Z" fill="#1d0d18" />
            <rect x="34" y="54" width="16" height="230" fill="#180b15" />
            <rect x="150" y="54" width="16" height="230" fill="#180b15" />
            <rect x="30" y="96" width="140" height="10" fill="#1d0d18" />
          </svg>
        ))}
      </Layer>

      {/* 3 — Shrine floor plate + cursed seal */}
      <Layer depth={0.12} zIndex={4} px={px} py={py}>
        <div style={{
          position: "absolute", left: "50%", top: "44%",
          width: "132%", height: "78%",
          transform: "translateX(-50%) perspective(760px) rotateX(56deg)",
          transformOrigin: "center top",
          background: `
            radial-gradient(ellipse at 50% 40%, rgba(90,55,150,0.22), rgba(14,9,26,0.55) 58%, transparent 76%),
            repeating-linear-gradient(0deg, transparent 0 68px, rgba(150,120,220,0.045) 68px 69px),
            repeating-linear-gradient(90deg, transparent 0 68px, rgba(150,120,220,0.045) 68px 69px)
          `,
          borderRadius: "46%",
          boxShadow: "inset 0 0 120px rgba(90,40,160,0.16)",
        }} />
        {/* rotating cursed seal beneath the board */}
        <div style={{
          position: "absolute", left: "50%", top: "46%",
          width: 620, height: 620, marginLeft: -310, marginTop: -220,
          transform: "perspective(760px) rotateX(60deg)",
          animation: "cg-seal-pulse 7s ease-in-out infinite",
        }}>
          <div style={{ position: "absolute", inset: 0, animation: "cg-seal-spin 90s linear infinite" }}>
            <svg viewBox="0 0 620 620" width="620" height="620">
              <circle cx="310" cy="310" r="298" fill="none" stroke="rgba(170,110,255,0.30)" strokeWidth="1.5" />
              <circle cx="310" cy="310" r="252" fill="none" stroke="rgba(170,110,255,0.18)" strokeWidth="1" strokeDasharray="14 10" />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line key={i}
                    x1={310 + Math.cos(a) * 252} y1={310 + Math.sin(a) * 252}
                    x2={310 + Math.cos(a) * 298} y2={310 + Math.sin(a) * 298}
                    stroke="rgba(190,130,255,0.28)" strokeWidth="1.5" />
                );
              })}
            </svg>
          </div>
          <div style={{ position: "absolute", inset: 70, animation: "cg-seal-spin-rev 62s linear infinite" }}>
            <svg viewBox="0 0 480 480" width="100%" height="100%">
              <circle cx="240" cy="240" r="228" fill="none" stroke="rgba(255,90,120,0.16)" strokeWidth="1" />
              <polygon points="240,20 430,350 50,350" fill="none" stroke="rgba(190,130,255,0.20)" strokeWidth="1.4" />
              <polygon points="240,460 50,130 430,130" fill="none" stroke="rgba(190,130,255,0.14)" strokeWidth="1.4" />
            </svg>
          </div>
        </div>
      </Layer>

      {/* horizon seam where the two sides meet */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "49.5%", height: 1, zIndex: 5,
        background: "linear-gradient(90deg, transparent, rgba(190,140,255,0.30) 22%, rgba(255,120,140,0.30) 50%, rgba(190,140,255,0.30) 78%, transparent)",
        animation: "cg-runeline 5s ease-in-out infinite",
      }} />

      {/* 4 — Rising embers */}
      <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
        {embers.map((e, i) => (
          <span key={i} style={{
            position: "absolute", bottom: -10, left: `${e.left}%`,
            width: e.size, height: e.size, borderRadius: "50%",
            background: domainColor ?? (e.warm ? "rgba(255,180,90,0.9)" : "rgba(190,140,255,0.85)"),
            boxShadow: domainColor
              ? `0 0 9px ${domainColor}`
              : e.warm ? "0 0 7px rgba(255,160,60,0.8)" : "0 0 7px rgba(170,110,255,0.8)",
            transition: "background 0.8s, box-shadow 0.8s",
            ["--cg-drift" as string]: e.drift,
            animation: `cg-ember ${e.dur}s linear ${e.delay}s infinite`,
            opacity: 0,
          } as React.CSSProperties} />
        ))}
      </div>

      {/* falling petals */}
      <div style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
        {petals.map((p2, i) => (
          <span key={i} style={{
            position: "absolute", top: 0, left: `${p2.left}%`,
            width: p2.size, height: p2.size * 0.66,
            borderRadius: "60% 0 60% 0",
            background: i % 3 === 0 ? "rgba(255,170,200,0.6)" : "rgba(210,170,255,0.5)",
            ["--cg-drift" as string]: p2.drift,
            animation: `cg-petal ${p2.dur}s linear ${p2.delay}s infinite`,
            opacity: 0,
          } as React.CSSProperties} />
        ))}
      </div>

      {/* 5 — Foreground props (interactive) */}
      <Layer depth={0.38} zIndex={7} px={px} py={py} style={{ pointerEvents: "none" }}>
        <Brazier side="left" onSpark={spark} />
        <Brazier side="right" onSpark={spark} />
      </Layer>
      <Layer depth={0.75} zIndex={7} px={px} py={py} style={{ pointerEvents: "none" }}>
        <StoneLantern side="left" onSpark={spark} />
        <StoneLantern side="right" onSpark={spark} />
        <PeekingSpirit onSpark={spark} />
      </Layer>
      <Layer depth={0.45} zIndex={7} px={px} py={py} style={{ pointerEvents: "none" }}>
        <ShrineBanner kanji="呪術" side="left" onSpark={spark} />
        <ShrineBanner kanji="高専" side="right" onSpark={spark} />
        <Chains side="left" />
        <Chains side="right" />
      </Layer>

      {/* 6 — Fog + vignette */}
      <div style={{
        position: "absolute", left: "-20%", right: "-20%", bottom: "-6%", height: "34%", zIndex: 8,
        background: "linear-gradient(0deg, rgba(90,60,150,0.16), transparent)",
        filter: "blur(26px)",
        animation: "cg-fog 34s ease-in-out infinite alternate",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 9,
        background: "radial-gradient(ellipse 88% 78% at 50% 50%, transparent 52%, rgba(2,1,8,0.72) 100%)",
      }} />

      {/* Click sparks from props */}
      {sparks.map(s => (
        <div key={s.id} style={{ position: "fixed", left: s.x, top: s.y, zIndex: 60, pointerEvents: "none" }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.span key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                style={{
                  position: "absolute", width: 4, height: 4, borderRadius: "50%",
                  background: i % 2 ? "#ffcc66" : "#cc88ff",
                  boxShadow: "0 0 8px rgba(255,190,120,0.9)",
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Domain takeover — the arena adopts the active leader's signature colour */}
      <AnimatePresence>
        {domainColor && (
          <motion.div
            key="domain-flood"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}
          >
            {/* Colour wash from the horizon outward */}
            <motion.div
              animate={{ opacity: [0.22, 0.42, 0.22] }}
              transition={{ duration: 2.6, repeat: Infinity }}
              style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${domainColor}44, transparent 70%)`,
              }}
            />
            {/* Edge bleed — the domain closing in around the board */}
            <motion.div
              animate={{ opacity: [0.35, 0.6, 0.35] }}
              transition={{ duration: 3.4, repeat: Infinity }}
              style={{
                position: "absolute", inset: 0,
                boxShadow: `inset 0 0 220px ${domainColor}55, inset 0 0 90px ${domainColor}33`,
              }}
            />
            {/* Sigil ring that snaps in when the domain opens */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{
                position: "absolute", left: "50%", top: "48%",
                width: 620, height: 620, marginLeft: -310, marginTop: -310,
                borderRadius: "50%",
                border: `2px solid ${domainColor}`,
                boxShadow: `0 0 60px ${domainColor}88`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
