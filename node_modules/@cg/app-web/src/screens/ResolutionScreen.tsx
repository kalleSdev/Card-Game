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
  | "black"      // brief black
  | "slash"      // diagonal cut reveals leader portraits as backgrounds
  | "leaders"    // leader cards slam in
  | "slideshow"  // non-leader cards scatter
  | "exclaim"    // P5 full-screen !! impact
  | "winner"     // winner's leader + scattered cards fills screen
  | "stats";     // scrollable breakdown

// ── Rarity color helper ───────────────────────────────────────────────────────
function rarityColor(rarity: string | undefined): string {
  if (rarity === "SS")  return "#ff22cc";
  if (rarity === "SSS") return "#00ff88";
  if (rarity === "X")   return "#ff2222";
  if (rarity === "S")   return "#ffd700";
  if (rarity === "A")   return "#cc44ff";
  return "#4a9eff";
}

const PLAYER_COLOR: Record<PlayerId, string> = {
  P1: "#4a9eff",
  P2: "#ff6666",
};

// ── Particle burst ────────────────────────────────────────────────────────────
function WinnerParticles({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = window.innerWidth; c.height = window.innerHeight;
    interface P { x: number; y: number; vx: number; vy: number; life: number; r: number }
    const ps: P[] = [];
    const cx = c.width / 2, cy = c.height * 0.38;
    for (let i = 0; i < 280; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 12;
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, life: 1, r: 2 + Math.random() * 5 });
    }
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = false;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.97; p.life -= 0.014;
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

// ── P5 Exclamation — overlaid on the squareoff, NOT full screen ──────────────
function ExclaimOverlay({ show, winnerColor }: { show: boolean; winnerColor: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.4, times: [0, 0.08, 0.7, 1] }}
          style={{
            position: "fixed", inset: 0, zIndex: 80,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Radial flash that fades quickly */}
          <motion.div
            initial={{ opacity: 0.6, scale: 0.1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: "70vw", height: "70vw",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${winnerColor}88 0%, transparent 70%)`,
              zIndex: 1,
            }}
          />

          {/* Giant !! centered, visible over the squareoff */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 2 }}>
            {["!", "!"].map((ch, i) => (
              <motion.div key={i}
                initial={{ scale: 4, opacity: 0, y: -80 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.28, delay: i * 0.06, ease: [0.12, 1.6, 0.28, 1] }}
                style={{
                  fontSize: "clamp(100px, 20vw, 260px)",
                  fontWeight: 900,
                  fontStyle: "italic",
                  color: "#fff",
                  WebkitTextStroke: "clamp(4px, 0.8vw, 12px) #000",
                  lineHeight: 0.88,
                  textShadow: `0 0 40px ${winnerColor}cc, 0 8px 32px rgba(0,0,0,0.8)`,
                  transform: `rotate(${i === 0 ? -10 : -5}deg)`,
                  filter: `drop-shadow(0 0 24px ${winnerColor}88)`,
                  userSelect: "none",
                }}
              >
                {ch}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Diagonal slash panel (two halves of screen) ───────────────────────────────
const SLASH_SKEW = 8;

function SlashPanel({ side, pid, state, children, show, expand, loserFade }: {
  side: "left" | "right"; pid: PlayerId; state: GameState;
  children: React.ReactNode; show: boolean; expand: boolean; loserFade?: boolean;
}) {
  const isLeft = side === "left";
  const leaderDefId = state.players[pid].board.leader?.defId;
  const leaderDef = leaderDefId ? state.cardDb[leaderDefId] : null;
  const leaderRarityColor = leaderDef ? rarityColor(leaderDef.rarity) : PLAYER_COLOR[pid];

  const clipLeft  = `polygon(0 0, calc(50% + ${SLASH_SKEW * 4}px) 0, calc(50% - ${SLASH_SKEW * 4}px) 100%, 0 100%)`;
  const clipRight = `polygon(calc(50% + ${SLASH_SKEW * 4}px) 0, 100% 0, 100% 100%, calc(50% - ${SLASH_SKEW * 4}px) 100%)`;
  const clipFull  = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";

  return (
    <motion.div
      animate={{
        clipPath: !show ? (isLeft ? "polygon(0 0,0 0,0 100%,0 100%)" : "polygon(100% 0,100% 0,100% 100%,100% 100%)")
          : expand ? clipFull
          : isLeft ? clipLeft : clipRight,
        opacity: !show ? 0 : loserFade ? 0 : 1,
      }}
      transition={{ duration: show ? 0.65 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "absolute", inset: 0, zIndex: 2 }}
    >
      {/* Leader portrait as background — fit to half, not zoomed in */}
      {leaderDefId && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={`/cards/${leaderDefId}.PNG`}
            alt=""
            draggable={false}
            style={{
              maxWidth: "75%", maxHeight: "88%",
              width: "auto", height: "auto",
              objectFit: "contain",
              opacity: 0.28,
              filter: `saturate(1.1) brightness(0.85)`,
            }}
          />
        </div>
      )}

      {/* Color gradient overlay based on leader rarity */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(${isLeft ? "135deg" : "225deg"},
          ${leaderRarityColor}28 0%,
          rgba(4,4,12,0.88) 100%)`,
      }} />

      {/* Rarity pulsing edge glow */}
      <motion.div
        animate={{ opacity: [0.12, 0.32, 0.12] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", inset: 0,
          boxShadow: isLeft
            ? `inset -60px 0 80px ${leaderRarityColor}22`
            : `inset 60px 0 80px ${leaderRarityColor}22`,
          pointerEvents: "none",
        }}
      />

      {children}
    </motion.div>
  );
}

// ── Leader display (slam in from edge) ───────────────────────────────────────
function LeaderDisplay({ pid, state, playerNames, playerIcons, show, side }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons;
  show: boolean; side: "left" | "right";
}) {
  const leader = state.players[pid].board.leader;
  const def = leader ? state.cardDb[leader.defId] : null;
  const pColor = PLAYER_COLOR[pid];
  const leaderColor = def ? rarityColor(def.rarity) : pColor;
  const isLeft = side === "left";

  return (
    <motion.div
      initial={{ x: isLeft ? -100 : 100, opacity: 0, scale: 0.85 }}
      animate={show ? { x: 0, opacity: 1, scale: 1 } : { x: isLeft ? -100 : 100, opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.6, ease: [0.22, 1.2, 0.36, 1], delay: 0.1 }}
      style={{
        position: "absolute",
        [isLeft ? "left" : "right"]: 0,
        top: 0, bottom: 0, width: "48%",
        display: "flex", flexDirection: "column",
        alignItems: isLeft ? "flex-start" : "flex-end",
        justifyContent: "center",
        padding: isLeft ? "0 0 0 48px" : "0 48px 0 0",
        zIndex: 3,
      }}
    >
      {/* Player name + icon */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={show ? { y: 0, opacity: 1 } : {}}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          flexDirection: isLeft ? "row" : "row-reverse" }}
      >
        <PlayerIcon icon={playerIcons[pid]} size={52}
          style={{ borderRadius: 10, border: `2px solid ${leaderColor}88` }} />
        <div style={{ textAlign: isLeft ? "left" : "right" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: leaderColor,
            letterSpacing: 3, textShadow: `0 0 24px ${leaderColor}88` }}>
            {playerNames[pid].toUpperCase()}
          </div>
          <div style={{ fontSize: 9, color: leaderColor + "66", letterSpacing: 4 }}>{pid}</div>
        </div>
      </motion.div>

      {/* Leader card */}
      {def && leader && (
        <motion.div
          initial={{ y: 40, scale: 0.8, opacity: 0 }}
          animate={show ? { y: 0, scale: 1, opacity: 1 } : {}}
          transition={{ delay: 0.18, duration: 0.6, ease: [0.22, 1.2, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 36px ${leaderColor}66) drop-shadow(0 8px 24px rgba(0,0,0,0.8))` }}
        >
          <div style={{ transform: "scale(1.5)", transformOrigin: isLeft ? "top left" : "top right" }}>
            <CharacterCard defId={leader.defId} def={def} size="xl" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}


function CardSlideshow({ pid, state, show, side, expanded }: {
  pid: PlayerId; state: GameState; show: boolean; side: "left" | "right"; expanded?: boolean;
}) {
  const zones = state.players[pid];
  const combatCards  = zones.board.combat.filter(Boolean)  as CardInstance[];
  const supportCards = zones.board.support.filter(Boolean) as CardInstance[];
  const allCards     = [...combatCards, ...supportCards];
  const isLeft = side === "left";
  const pColor = PLAYER_COLOR[pid];
  const leaderDef = zones.board.leader ? state.cardDb[zones.board.leader.defId] : null;
  const accentColor = leaderDef ? rarityColor(leaderDef.rarity) : pColor;

  if (expanded) {
    // Winner layout: cards fanned out centered at bottom of full screen
    return (
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.55, ease: [0.22, 1.1, 0.36, 1] }}
        style={{
          position: "absolute", bottom: 32, left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 10, zIndex: 4, paddingBottom: 8,
        }}
      >
        {/* Combat row */}
        {combatCards.length > 0 && (
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {combatCards.map((card, i) => {
              const def = state.cardDb[card.defId];
              if (!def) return null;
              return (
                <motion.div key={card.instanceId}
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.08, duration: 0.45, ease: [0.22, 1.2, 0.36, 1] }}
                  style={{ filter: `drop-shadow(0 0 18px ${accentColor}55) drop-shadow(0 4px 14px rgba(0,0,0,0.85))` }}
                >
                  <div style={{ transform: "scale(1.35)", transformOrigin: "bottom center" }}>
                    <CharacterCard defId={card.defId} def={def} size="sm" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {/* Support row */}
        {supportCards.length > 0 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {supportCards.map((card, i) => {
              const def = state.cardDb[card.defId];
              if (!def) return null;
              return (
                <motion.div key={card.instanceId}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.85 + i * 0.07, duration: 0.4, ease: [0.22, 1.1, 0.36, 1] }}
                  style={{ filter: `drop-shadow(0 0 12px ${accentColor}33) drop-shadow(0 3px 10px rgba(0,0,0,0.8))` }}
                >
                  <CharacterCard defId={card.defId} def={def} size="sm" />
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // Normal squareoff layout: cards along the bottom edge of the player's half
  return (
    <div style={{
      position: "absolute",
      bottom: 40,
      [isLeft ? "left" : "right"]: 0,
      width: "48%",
      display: "flex",
      flexDirection: isLeft ? "row" : "row-reverse",
      gap: 8, padding: isLeft ? "0 0 0 28px" : "0 28px 0 0",
      alignItems: "flex-end", zIndex: 4, overflow: "visible",
    }}>
      {allCards.map((card, i) => {
        const def = state.cardDb[card.defId];
        if (!def) return null;
        return (
          <motion.div key={card.instanceId}
            initial={{ x: isLeft ? -120 : 120, opacity: 0, y: 20 }}
            animate={show ? { x: 0, opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.22, 1.1, 0.36, 1] }}
            style={{ filter: `drop-shadow(0 0 14px ${pColor}55)`, flexShrink: 0 }}
          >
            <div style={{ transform: "scale(1.4)", transformOrigin: isLeft ? "bottom left" : "bottom right" }}>
              <CharacterCard defId={card.defId} def={def} size="sm" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Victory name overlay — shown on top of the expanded winner panel ──────────
function VictoryOverlay({ pid, state, playerNames, show }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; show: boolean;
}) {
  const leaderDef = state.players[pid].board.leader
    ? state.cardDb[state.players[pid].board.leader!.defId] : null;
  const lColor = leaderDef ? rarityColor(leaderDef.rarity) : PLAYER_COLOR[pid];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.15, 1.5, 0.3, 1], delay: 0.5 }}
          style={{
            position: "fixed", top: "4%", left: 0, right: 0,
            textAlign: "center", zIndex: 30, pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: 14, color: lColor + "aa", marginBottom: 4 }}>
            VICTORY
          </div>
          <div style={{
            fontSize: "clamp(42px, 6vw, 80px)",
            fontWeight: 900, color: "#fff",
            WebkitTextStroke: "3px #000",
            fontStyle: "italic",
            textShadow: `0 0 60px ${lColor}dd, 0 0 110px ${lColor}55`,
            letterSpacing: 6, lineHeight: 1,
          }}>
            {playerNames[pid].toUpperCase()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Detailed stats breakdown ──────────────────────────────────────────────────
function StatsSection({ pid, state, playerNames, playerIcons, isWinner }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons; isWinner: boolean;
}) {
  const pColor  = PLAYER_COLOR[pid];
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

      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3,
          background: isWinner ? "linear-gradient(90deg,#ffd70066,#ffd700)" : `linear-gradient(90deg,${pColor}66,${pColor})`,
          width: "100%", boxShadow: isWinner ? "0 0 12px #ffd70066" : `0 0 8px ${pColor}44` }} />
      </div>

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

      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 5, padding: "3px 8px" }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ResolutionScreen({ state, onRestart, playerNames, playerIcons }: {
  state: GameState; onRestart: () => void; playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const p1Final = state.players.P1.scorePreview;
  const p2Final = state.players.P2.scorePreview;
  const winner: PlayerId | "DRAW" = p1Final > p2Final ? "P1" : p2Final > p1Final ? "P2" : "DRAW";

  const winnerLeaderDef = winner !== "DRAW"
    ? (state.players[winner as PlayerId].board.leader
        ? state.cardDb[state.players[winner as PlayerId].board.leader!.defId]
        : null)
    : null;
  const winnerColor = winnerLeaderDef ? rarityColor(winnerLeaderDef.rarity) : "#ffd700";

  const [phase, setPhase] = useState<CinPhase>("black");
  const [showParticles, setShowParticles] = useState(false);
  const [showExclaim, setShowExclaim] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seq: [number, CinPhase][] = [
      [180,  "slash"],
      [620,  "leaders"],
      [1900, "slideshow"],
      [3500, "exclaim"],
      [5100, "winner"],
    ];
    const timers = seq.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === "exclaim") {
      setShowExclaim(true);
      setTimeout(() => setShowExclaim(false), 1600);
    }
    if (phase === "winner") {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 3200);
    }
  }, [phase]);

  const isStats = phase === "stats";
  const showSlash     = ["slash","leaders","slideshow","exclaim","winner","stats"].includes(phase);
  const showLeaders   = ["leaders","slideshow","exclaim","winner","stats"].includes(phase);
  const showSlideshow = ["slideshow","exclaim","winner","stats"].includes(phase);
  const showWinner    = ["winner","stats"].includes(phase);
  const p1IsWinner = winner === "P1";
  const p2IsWinner = winner === "P2";
  // When winner phase: expand winner panel, fade loser panel
  const p1Expand   = showWinner && p1IsWinner;
  const p2Expand   = showWinner && p2IsWinner;
  const p1LoserFade = showWinner && p2IsWinner;
  const p2LoserFade = showWinner && p1IsWinner;

  return (
    <div style={{
      minHeight: "100vh", background: "#04040a",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e0e0e0", position: "relative", overflow: "hidden",
    }}>
      {/* P5 !! overlay — shown over the squareoff, not full-screen */}
      <ExclaimOverlay show={showExclaim} winnerColor={winnerColor} />

      {/* ── CINEMATIC SECTION — always present, winner panel expands ── */}
      <AnimatePresence>
        {!isStats && (
          <motion.div
            key="cinematic"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: "fixed", inset: 0, zIndex: 10,
              background: "#04040a",
              backgroundImage: BG.resolution, backgroundSize: "cover", backgroundPosition: "center",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "rgba(4,4,12,0.55)", zIndex: 0 }} />

            {/* Left slash panel — expands if P1 wins, fades if P2 wins */}
            <SlashPanel side="left" pid="P1" state={state} show={showSlash}
              expand={p1Expand} loserFade={p1LoserFade}>
              {showLeaders && (
                <LeaderDisplay pid="P1" state={state} playerNames={playerNames} playerIcons={playerIcons}
                  show={showLeaders} side="left" />
              )}
              {showSlideshow && (
                <CardSlideshow pid="P1" state={state} show={showSlideshow} side="left"
                  expanded={p1Expand} />
              )}
            </SlashPanel>

            {/* Right slash panel — expands if P2 wins, fades if P1 wins */}
            <SlashPanel side="right" pid="P2" state={state} show={showSlash}
              expand={p2Expand} loserFade={p2LoserFade}>
              {showLeaders && (
                <LeaderDisplay pid="P2" state={state} playerNames={playerNames} playerIcons={playerIcons}
                  show={showLeaders} side="right" />
              )}
              {showSlideshow && (
                <CardSlideshow pid="P2" state={state} show={showSlideshow} side="right"
                  expanded={p2Expand} />
              )}
            </SlashPanel>

            {/* Center slash line — hidden when winner expands */}
            <AnimatePresence>
              {showSlash && !showWinner && (
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{
                    position: "absolute", zIndex: 9,
                    left: "calc(50% - 3px)", top: 0, bottom: 0, width: 6,
                    background: "linear-gradient(180deg, transparent, #fff 20%, #fff 80%, transparent)",
                    transform: `skewX(-${SLASH_SKEW}deg)`,
                    transformOrigin: "top center",
                    boxShadow: "0 0 16px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Score display — hidden when winner expands */}
            <AnimatePresence>
              {showLeaders && !showWinner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  style={{
                    position: "absolute", bottom: 24, left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 12, textAlign: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: "#4a9eff",
                      textShadow: "0 0 24px #4a9eff88", fontVariantNumeric: "tabular-nums" }}>
                      {p1Final.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "#446", letterSpacing: 5 }}>VS</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: "#ff6666",
                      textShadow: "0 0 24px #ff666688", fontVariantNumeric: "tabular-nums" }}>
                      {p2Final.toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory name overlay — on top of expanded panel */}
      {winner !== "DRAW" && (
        <VictoryOverlay
          pid={winner as PlayerId}
          state={state}
          playerNames={playerNames}
          show={showWinner && !isStats}
        />
      )}

      {/* REVIEW button */}
      <AnimatePresence>
        {showWinner && !isStats && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5, ease: "easeOut" }}
            style={{
              position: "fixed", bottom: 44, left: 0, right: 0,
              textAlign: "center", zIndex: 50,
            }}
          >
            <button
              onClick={() => {
                setPhase("stats");
                setTimeout(() => statsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
              style={{
                padding: "14px 52px",
                background: "rgba(0,0,0,0.65)", border: `1px solid ${winnerColor}66`,
                borderRadius: 10, color: "#ddd", fontWeight: "bold",
                cursor: "pointer", fontSize: 13, letterSpacing: 5, fontFamily: "inherit",
                backdropFilter: "blur(10px)",
                boxShadow: `0 0 24px ${winnerColor}33`,
              }}
            >
              REVIEW ↓
            </button>
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
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 7, color: "#445", marginBottom: 6 }}>FINAL ROUND</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 6, color: "#fff", textShadow: "0 0 40px rgba(255,215,0,0.2)" }}>
              RESOLUTION
            </div>
            <div style={{ height: 1, width: 240, margin: "14px auto 0",
              background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)" }} />
          </div>

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
                    textShadow: "0 0 48px #ffd700cc, 0 0 96px #ffd70055", letterSpacing: 5,
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

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #4a9eff44)" }} />
            <div style={{ fontSize: 12, color: "#334", letterSpacing: 5 }}>VS</div>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #ff666644, transparent)" }} />
          </div>

          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            <StatsSection pid="P1" state={state} playerNames={playerNames} playerIcons={playerIcons} isWinner={p1IsWinner} />
            <StatsSection pid="P2" state={state} playerNames={playerNames} playerIcons={playerIcons} isWinner={p2IsWinner} />
          </div>

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
      </div>
    </div>
  );
}
