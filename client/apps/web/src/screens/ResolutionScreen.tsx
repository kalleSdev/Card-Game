import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import { BG } from "../backgrounds";
import type { CardInstance, GameState, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { SYNERGY_LABEL } from "../constants";
import type { PlayerIcons, PlayerNames } from "../types";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

// ── Sequence phases ──────────────────────────────────────────────────────────
type CinPhase =
  | "black"       // brief black flash before anything
  | "slash"       // diagonal slash line sweeps across
  | "leaders"     // leader cards slam in on both sides
  | "slideshow"   // non-leader cards slide in from edges
  | "winner"      // loser dims, winner expands + flash
  | "stats";      // scrollable detailed breakdown

// ── Particle burst ───────────────────────────────────────────────────────────
function WinnerParticles({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    interface P { x: number; y: number; vx: number; vy: number; life: number; r: number }
    const ps: P[] = [];
    const cx = c.width / 2, cy = c.height * 0.38;
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 10;
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, life: 1, r: 2 + Math.random() * 5 });
    }
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = false;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.97; p.life -= 0.016;
        if (p.life <= 0) continue; alive = true;
        ctx.globalAlpha = p.life * 0.85;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [color]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 20 }} />;
}

// ── Diagonal slash cut — Persona 5 style ────────────────────────────────────
const SLASH_SKEW = 8; // degrees

function SlashPanel({ side, color, children, show, expand }: {
  side: "left" | "right"; color: string;
  children: React.ReactNode;
  show: boolean; expand: boolean;
}) {
  const isLeft = side === "left";
  const clipLeft  = `polygon(0 0, calc(50% + ${SLASH_SKEW * 4}px) 0, calc(50% - ${SLASH_SKEW * 4}px) 100%, 0 100%)`;
  const clipRight = `polygon(calc(50% + ${SLASH_SKEW * 4}px) 0, 100% 0, 100% 100%, calc(50% - ${SLASH_SKEW * 4}px) 100%)`;
  const clipFull  = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";

  return (
    <motion.div
      animate={{
        clipPath: !show ? (isLeft ? "polygon(0 0,0 0,0 100%,0 100%)" : "polygon(100% 0,100% 0,100% 100%,100% 100%)")
          : expand ? clipFull
          : isLeft ? clipLeft : clipRight,
        opacity: show ? 1 : 0,
      }}
      transition={{ duration: show ? 0.55 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(${isLeft ? "135deg" : "225deg"}, ${color}22 0%, rgba(4,4,12,0.92) 100%)`,
        zIndex: 2,
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Giant leader image ───────────────────────────────────────────────────────
function LeaderDisplay({ pid, state, playerNames, playerIcons, show, side }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons;
  show: boolean; side: "left" | "right";
}) {
  const leader = state.players[pid].board.leader;
  const def = leader ? state.cardDb[leader.defId] : null;
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const isLeft = side === "left";

  return (
    <motion.div
      initial={{ x: isLeft ? -80 : 80, opacity: 0, scale: 0.88 }}
      animate={show ? { x: 0, opacity: 1, scale: 1 } : { x: isLeft ? -80 : 80, opacity: 0, scale: 0.88 }}
      transition={{ duration: 0.65, ease: [0.22, 1.2, 0.36, 1], delay: 0.1 }}
      style={{
        position: "absolute",
        [isLeft ? "left" : "right"]: 0,
        top: 0, bottom: 0,
        width: "48%",
        display: "flex", flexDirection: "column",
        alignItems: isLeft ? "flex-start" : "flex-end",
        justifyContent: "center",
        padding: isLeft ? "0 0 0 48px" : "0 48px 0 0",
        zIndex: 3,
      }}
    >
      {/* Player name bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={show ? { y: 0, opacity: 1 } : {}}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          flexDirection: isLeft ? "row" : "row-reverse",
        }}
      >
        <PlayerIcon icon={playerIcons[pid]} size={52} style={{ borderRadius: 10, border: `2px solid ${pColor}88` }} />
        <div style={{ textAlign: isLeft ? "left" : "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: pColor, letterSpacing: 3, textShadow: `0 0 24px ${pColor}88` }}>
            {playerNames[pid].toUpperCase()}
          </div>
          <div style={{ fontSize: 9, color: pColor + "88", letterSpacing: 4 }}>{pid}</div>
        </div>
      </motion.div>

      {/* Leader card — giant */}
      {def && leader && (
        <motion.div
          initial={{ y: 30, scale: 0.85, opacity: 0 }}
          animate={show ? { y: 0, scale: 1, opacity: 1 } : {}}
          transition={{ delay: 0.18, duration: 0.6, ease: [0.22, 1.2, 0.36, 1] }}
          style={{
            filter: `drop-shadow(0 0 32px ${pColor}66) drop-shadow(0 8px 24px rgba(0,0,0,0.8))`,
          }}
        >
          <div style={{ transform: "scale(1.5)", transformOrigin: isLeft ? "top left" : "top right" }}>
            <CharacterCard defId={leader.defId} def={def} size="xl" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Card slideshow — cards fly in from edge in sequence ──────────────────────
function CardSlideshow({ pid, state, show, side }: {
  pid: PlayerId; state: GameState; show: boolean; side: "left" | "right";
}) {
  const zones = state.players[pid];
  const cards: CardInstance[] = [
    ...zones.board.combat.filter(Boolean) as CardInstance[],
    ...zones.board.support.filter(Boolean) as CardInstance[],
  ];
  const isLeft = side === "left";
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      position: "absolute",
      bottom: 40,
      [isLeft ? "left" : "right"]: 0,
      width: "48%",
      display: "flex",
      flexDirection: isLeft ? "row" : "row-reverse",
      gap: 10,
      padding: isLeft ? "0 0 0 32px" : "0 32px 0 0",
      alignItems: "flex-end",
      zIndex: 4,
      overflow: "visible",
    }}>
      {cards.map((card, i) => {
        const def = state.cardDb[card.defId];
        if (!def) return null;
        return (
          <motion.div
            key={card.instanceId}
            initial={{ x: isLeft ? -120 : 120, opacity: 0, y: 20 }}
            animate={show ? { x: 0, opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.12 * i, duration: 0.5, ease: [0.22, 1.1, 0.36, 1] }}
            style={{ filter: `drop-shadow(0 0 14px ${pColor}55)`, flexShrink: 0 }}
          >
            <div style={{ transform: "scale(1.5)", transformOrigin: isLeft ? "bottom left" : "bottom right" }}>
              <CharacterCard defId={card.defId} def={def} size="sm" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}


// ── Detailed stats breakdown (scroll section) ────────────────────────────────
function StatsSection({ pid, state, playerNames, playerIcons, isWinner }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons; isWinner: boolean;
}) {
  const pColor  = pid === "P1" ? "#4a9eff" : "#ff6666";
  const zones   = state.players[pid];
  const slots: Array<{ label: string; card: CardInstance | null }> = [
    { label: "Leader",    card: zones.board.leader },
    { label: "Combat 1",  card: zones.board.combat[0] },
    { label: "Combat 2",  card: zones.board.combat[1] },
    { label: "Support 1", card: zones.board.support[0] },
    { label: "Support 2", card: zones.board.support[1] },
    { label: "Support 3", card: zones.board.support[2] },
  ];
  const score = state.players[pid].scorePreview;

  return (
    <div style={{
      flex: 1, borderRadius: 22, padding: "28px 26px",
      background: isWinner ? "rgba(16,14,4,0.94)" : "rgba(8,8,18,0.80)",
      border: `1px solid ${isWinner ? "#ffd70044" : "#1a1a3a"}`,
      boxShadow: isWinner ? "0 0 80px #ffd70018, inset 0 0 60px #ffd7000a" : "none",
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <PlayerIcon icon={playerIcons[pid]} size={64} style={{
          borderRadius: 12,
          border: `2px solid ${isWinner ? "#ffd70088" : pColor + "44"}`,
          boxShadow: isWinner ? "0 0 28px #ffd70055" : "none",
        }} />
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3,
            color: isWinner ? "#ffd700" : pColor,
            textShadow: isWinner ? "0 0 24px #ffd70088" : "none" }}>
            {playerNames[pid].toUpperCase()}
          </div>
          {isWinner && <div style={{ fontSize: 10, letterSpacing: 5, color: "#ffd70088", marginTop: 3 }}>✦ WINNER ✦</div>}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 50, fontWeight: 900, color: isWinner ? "#ffd700" : pColor,
            textShadow: isWinner ? "0 0 32px #ffd70088" : "none",
            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {score.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: "#445", letterSpacing: 3 }}>TOTAL POINTS</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3,
          background: isWinner ? "linear-gradient(90deg,#ffd70066,#ffd700)" : `linear-gradient(90deg,${pColor}66,${pColor})`,
          width: "100%", boxShadow: isWinner ? "0 0 12px #ffd70066" : `0 0 8px ${pColor}44` }} />
      </div>

      {/* Domain + vow */}
      {state.domainOutcome?.[pid] && (() => {
        const d = state.domainOutcome![pid];
        return (
          <div style={{ padding: "7px 12px", marginBottom: 7,
            background: d.activated ? "rgba(40,0,80,0.4)" : "rgba(8,8,14,0.4)",
            border: `1px solid ${d.activated ? "#7722cc55" : "#1a1a28"}`,
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: d.activated ? "#cc88ff" : "#333" }}>
              {d.activated ? "✦" : "○"} {d.name}
              {d.clashed && <span style={{ fontSize: 10, color: "#664488", marginLeft: 6 }}>(clash)</span>}
            </span>
            {d.activated && <span style={{ fontSize: 14, fontWeight: "bold", color: "#cc88ff" }}>+{d.pct}%</span>}
          </div>
        );
      })()}

      {state.vowsChosen[pid] && (() => {
        const vow = VOW_DEFS[state.vowsChosen[pid]!];
        const outcome = state.vowOutcome?.[pid];
        return (
          <div style={{ padding: "7px 12px", marginBottom: 7,
            background: "rgba(20,12,0,0.45)", border: "1px solid #443300aa",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#cc9900" }}>{vow.icon} {vow.name}</span>
            {outcome && outcome.pct !== 0 && (
              <span style={{ fontSize: 14, fontWeight: "bold", color: outcome.pct > 0 ? "#44dd44" : "#dd4444" }}>
                {outcome.pct > 0 ? "+" : ""}{outcome.pct}%
              </span>
            )}
          </div>
        );
      })()}

      {/* Synergies */}
      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 5, padding: "3px 8px" }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
        {slots.map(({ label, card }) => {
          const def = card ? state.cardDb[card.defId] : null;
          return (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              {def && card
                ? <CharacterCard defId={card.defId} def={def} size="lg" />
                : <div style={{ width: 168, height: 238, borderRadius: 9, border: "1px solid #1a1a2a", background: "#060610",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, color: "#222" }}>—</span>
                  </div>
              }
              <span style={{ fontSize: 8, color: "#446" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ResolutionScreen({ state, onRestart, playerNames, playerIcons }: {
  state: GameState; onRestart: () => void; playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const p1Final = state.players.P1.scorePreview;
  const p2Final = state.players.P2.scorePreview;
  const winner: PlayerId | "DRAW" = p1Final > p2Final ? "P1" : p2Final > p1Final ? "P2" : "DRAW";
  const winnerColor = winner === "P1" ? "#4a9eff" : winner === "P2" ? "#ff6666" : "#ffd700";

  const [phase, setPhase] = useState<CinPhase>("black");
  const [showParticles, setShowParticles] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Timed phase sequence
  useEffect(() => {
    const seq: [number, CinPhase][] = [
      [180,  "slash"],
      [620,  "leaders"],
      [1900, "slideshow"],
      [3600, "winner"],
    ];
    const timers = seq.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === "winner") {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 3000);
    }
  }, [phase]);

  const isStats = phase === "stats";
  const showSlash     = ["slash","leaders","slideshow","winner","stats"].includes(phase);
  const showLeaders   = ["leaders","slideshow","winner","stats"].includes(phase);
  const showSlideshow = ["slideshow","winner","stats"].includes(phase);
  const showWinner    = ["winner","stats"].includes(phase);

  const p1IsWinner = winner === "P1";
  const p2IsWinner = winner === "P2";

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e0e0e0", position: "relative", overflow: "hidden",
    }}>
      {/* ── CINEMATIC SECTION ── */}
      <AnimatePresence>
        {!isStats && (
          <motion.div
            key="cinematic"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: "fixed", inset: 0, zIndex: 10,
              background: "#04040a",
              backgroundImage: BG.resolution, backgroundSize: "cover", backgroundPosition: "center",
            }}
          >
            {/* Dark base */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(4,4,12,0.6)", zIndex: 0 }} />

            {/* Left slash panel */}
            <SlashPanel side="left" color="#4a9eff" show={showSlash} expand={showWinner && p1IsWinner}>
              {showLeaders && (
                <LeaderDisplay pid="P1" state={state} playerNames={playerNames} playerIcons={playerIcons}
                  show={showLeaders} side="left" />
              )}
              {showSlideshow && <CardSlideshow pid="P1" state={state} show={showSlideshow} side="left" />}

              {/* Loser overlay */}
              <AnimatePresence>
                {showWinner && !p1IsWinner && winner !== "DRAW" && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9 }}
                    style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.72)", zIndex: 7, backdropFilter: "blur(2px)" }}
                  />
                )}
              </AnimatePresence>
            </SlashPanel>

            {/* Right slash panel */}
            <SlashPanel side="right" color="#ff6666" show={showSlash} expand={showWinner && p2IsWinner}>
              {showLeaders && (
                <LeaderDisplay pid="P2" state={state} playerNames={playerNames} playerIcons={playerIcons}
                  show={showLeaders} side="right" />
              )}
              {showSlideshow && <CardSlideshow pid="P2" state={state} show={showSlideshow} side="right" />}

              <AnimatePresence>
                {showWinner && !p2IsWinner && winner !== "DRAW" && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9 }}
                    style={{ position: "absolute", inset: 0, background: "rgba(2,2,8,0.72)", zIndex: 7, backdropFilter: "blur(2px)" }}
                  />
                )}
              </AnimatePresence>
            </SlashPanel>

            {/* Diagonal slash line */}
            <AnimatePresence>
              {showSlash && (
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{
                    position: "absolute", zIndex: 9,
                    left: "calc(50% - 3px)", top: 0, bottom: 0, width: 6,
                    background: `linear-gradient(180deg, transparent, #fff 20%, #fff 80%, transparent)`,
                    transform: `skewX(-${SLASH_SKEW}deg)`,
                    transformOrigin: "top center",
                    boxShadow: "0 0 16px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)",
                    opacity: showWinner ? 0 : 1,
                  }}
                />
              )}
            </AnimatePresence>

            {/* Winner flash radial */}
            <AnimatePresence>
              {showWinner && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
                    background: `radial-gradient(ellipse at ${p1IsWinner ? "30%" : "70%"} 40%, ${winnerColor}30 0%, transparent 65%)`,
                  }}
                />
              )}
            </AnimatePresence>

            {/* WINNER text */}
            <AnimatePresence>
              {showWinner && winner !== "DRAW" && (
                <motion.div
                  initial={{ y: -60, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.65, ease: [0.22, 1.4, 0.36, 1], delay: 0.15 }}
                  style={{
                    position: "absolute", zIndex: 12,
                    top: "6%", left: 0, right: 0,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: 12, color: "#ffd70066", marginBottom: 4 }}>VICTORY</div>
                  <div style={{
                    fontSize: 72, fontWeight: 900, color: "#ffd700",
                    textShadow: "0 0 48px #ffd700cc, 0 0 100px #ffd70055",
                    letterSpacing: 6, lineHeight: 1,
                  }}>
                    {playerNames[winner as PlayerId].toUpperCase()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* View stats button */}
            <AnimatePresence>
              {showWinner && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
                  style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", zIndex: 12 }}
                >
                  <button
                    onClick={() => {
                      setPhase("stats");
                      setTimeout(() => statsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    }}
                    style={{
                      padding: "14px 48px",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 10, color: "#ccc", fontWeight: "bold",
                      cursor: "pointer", fontSize: 13, letterSpacing: 4, fontFamily: "inherit",
                    }}
                  >
                    VIEW STATS ↓
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {showParticles && <WinnerParticles color={winnerColor} />}

      {/* ── STATS SECTION ── */}
      <div
        ref={statsRef}
        style={{
          minHeight: "100vh", background: "#04040a",
          backgroundImage: BG.resolution, backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "36px 28px",
          position: "relative",
          opacity: isStats ? 1 : 0,
          pointerEvents: isStats ? "auto" : "none",
          transition: "opacity 0.6s",
        }}
      >
        <AmbientCanvas theme="rain" />
        <AmbientOverlay theme="gold" />
        <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,12,0.55)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1300, display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 7, color: "#445", marginBottom: 6 }}>FINAL ROUND</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: "0 0 40px rgba(255,215,0,0.2)" }}>
              RESOLUTION
            </div>
            <div style={{ height: 1, width: 240, margin: "14px auto 0",
              background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)" }} />
          </div>

          {/* Winner banner */}
          <div style={{ textAlign: "center" }}>
            {winner === "DRAW" ? (
              <div style={{ fontSize: 60, color: "#888", letterSpacing: 8, fontWeight: 900 }}>DRAW</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 10, color: "#ffd70066" }}>WINNER</div>
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <PlayerIcon icon={playerIcons[winner as PlayerId]} size={80} style={{
                    borderRadius: 16, border: "3px solid #ffd70088",
                    boxShadow: "0 0 36px #ffd70066, 0 0 80px #ffd70033",
                  }} />
                  <div style={{
                    fontSize: 60, fontWeight: 900, color: "#ffd700",
                    textShadow: "0 0 48px #ffd700cc, 0 0 96px #ffd70055",
                    letterSpacing: 5,
                  }}>
                    {playerNames[winner as PlayerId].toUpperCase()}
                  </div>
                </div>
                <div style={{ fontSize: 16, color: "#9a8050", letterSpacing: 3 }}>
                  {(winner === "P1" ? p1Final : p2Final).toLocaleString()} points
                </div>
              </div>
            )}
          </div>

          {/* VS bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #4a9eff44)" }} />
            <div style={{ fontSize: 12, color: "#334", letterSpacing: 5 }}>VS</div>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ff666644, transparent)" }} />
          </div>

          {/* Player stat panels */}
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            <StatsSection pid="P1" state={state} playerNames={playerNames} playerIcons={playerIcons} isWinner={p1IsWinner} />
            <StatsSection pid="P2" state={state} playerNames={playerNames} playerIcons={playerIcons} isWinner={p2IsWinner} />
          </div>

          {/* Play Again */}
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 48 }}>
            <button
              onClick={onRestart}
              style={{
                padding: "16px 64px",
                background: "rgba(255,255,255,0.05)", border: "1px solid #3a3a4a",
                borderRadius: 12, color: "#778", fontWeight: "bold",
                cursor: "pointer", fontSize: 14, letterSpacing: 5, fontFamily: "inherit",
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.10)"; b.style.color = "#aab"; b.style.borderColor = "#5a5a6a"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.05)"; b.style.color = "#778"; b.style.borderColor = "#3a3a4a"; }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>

        <style>{`
          @keyframes bgPan {
            0%   { background-position: 50% 50%; }
            33%  { background-position: 52% 48%; }
            66%  { background-position: 48% 52%; }
            100% { background-position: 50% 50%; }
          }
        `}</style>
      </div>
    </div>
  );
}
