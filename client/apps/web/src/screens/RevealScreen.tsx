import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import type { CardInstance, GameState, Intent, PlayerId } from "@cg/contracts";
import { rc } from "../helpers";
import CharacterCard, { CardBack } from "../components/CharacterCard";
import { BG } from "../backgrounds";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import type { PlayerNames } from "../types";

// ── Top hand grid ─────────────────────────────────────────────────────────────
function HandGrid({ pId, revealedIds, state, playerNames }: {
  pId: PlayerId; revealedIds: string[]; state: GameState; playerNames: PlayerNames;
}) {
  const hand = state.players[pId].hand;
  const pColor = pId === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div>
      <div style={{ fontSize: 10, color: pColor + "99", letterSpacing: 3, marginBottom: 12, textAlign: "center" }}>
        {playerNames[pId]} &nbsp;·&nbsp; {revealedIds.length} / 6 REVEALED
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 10px", justifyItems: "center" }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const inst = hand[i] as CardInstance | undefined;
          const isRevealed = inst ? revealedIds.includes(inst.instanceId) : false;
          const def = inst ? state.cardDb[inst.defId] : undefined;

          if (isRevealed && inst && def) {
            return (
              <motion.div
                key={inst.instanceId}
                initial={{ y: 30, opacity: 0, scale: 0.88 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
              >
                <CharacterCard defId={inst.defId} def={def} size="mdl" />
              </motion.div>
            );
          }

          // Empty slot — card hasn't been added yet
          return (
            <div key={inst?.instanceId ?? `empty-${i}`} style={{
              width: 141, height: 200, borderRadius: 10,
              border: "1px dashed #1e1e30",
              background: "rgba(8,8,18,0.4)", flexShrink: 0,
            }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Per-card: flip in place, then click to fly to hand ───────────────────────
//
// Phases:
//   "back"     — face-down, first click starts flip
//   "flip-out" — scaleX 1→0 (card face closes)
//   "face"     — scaleX 0→1 (face opens), then idle with pulse ring
//   "depart"   — flies up, fires REVEAL_CARD when gone
//   "gone"     — returns null
//
// Hover is tracked as React state and folded into `animate` so it never
// conflicts with Framer Motion's gesture-animation priority system.
// ─────────────────────────────────────────────────────────────────────────────
type CardPhase = "back" | "flip-out" | "face" | "depart" | "gone";

function RevealHandCard({ inst, state, onRevealIntent, onFlipEffect }: {
  inst: CardInstance;
  state: GameState;
  onRevealIntent: () => void;
  onFlipEffect: (rarity: string, color: string) => void;
}) {
  const def = state.cardDb[inst.defId];
  const draftRevealed = !!inst.visibility?.identityRevealed;
  const color = def ? rc(def.rarity) : "#4a4a88";

  const [phase, setPhase]       = useState<CardPhase>(draftRevealed ? "face" : "back");
  const [showFace, setShowFace] = useState(draftRevealed);
  const [hovered, setHovered]   = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  if (phase === "gone") return null;

  // ── Animate object (no whileHover — avoids gesture priority conflict) ─────
  const animTarget = (() => {
    if (phase === "flip-out") return { scaleX: 0 };
    if (phase === "depart")   return { y: -200, scale: 0.38, opacity: 0 };
    const canHover = phase === "back" || phase === "face";
    return {
      scaleX: 1,
      y:      hovered && canHover ? -10 : 0,
      scale:  hovered && canHover ? 1.06 : 1,
      opacity: 1,
    };
  })();

  const transTarget = (() => {
    if (phase === "flip-out") return { duration: 0.13, ease: "easeIn" as const };
    if (phase === "depart")   return { duration: 0.32, ease: [0.4, 0, 0.8, 1] as const };
    return {
      scaleX: { duration: 0.17, ease: "easeOut" as const },
      y:      { type: "spring" as const, stiffness: 420, damping: 24 },
      scale:  { type: "spring" as const, stiffness: 420, damping: 24 },
    };
  })();

  // ── Animation complete handler ────────────────────────────────────────────
  const onComplete = () => {
    if (phase === "flip-out") {
      setShowFace(true);
      setShowGlow(true);
      setTimeout(() => setShowGlow(false), 700);
      if (def) onFlipEffect(def.rarity, color);
      setPhase("face");
    } else if (phase === "depart") {
      setPhase("gone");
      onRevealIntent();
    }
  };

  const handleClick = () => {
    if (phase === "back") {
      setHovered(false);
      setPhase("flip-out");
    } else if (phase === "face") {
      setHovered(false);
      setPhase("depart");
    }
  };

  const isClickable = phase === "back" || phase === "face";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, position: "relative" }}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Hover: expanding ripple rings (pack-opening anticipation) ── */}
      {hovered && isClickable && [0, 0.38, 0.76].map(delay => (
        <motion.div
          key={delay}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2.0, opacity: 0 }}
          transition={{ duration: 1.1, delay, repeat: Infinity, ease: "easeOut" }}
          style={{
            position: "absolute", inset: 0, borderRadius: 14,
            border: `2px solid ${color}`,
            pointerEvents: "none", zIndex: 0,
          }}
        />
      ))}

      {/* ── Hover glow — breathes while hovered ── */}
      <motion.div
        animate={hovered && isClickable
          ? { opacity: [0.7, 1.0, 0.7], scale: [1, 1.04, 1] }
          : { opacity: 0, scale: 1 }}
        transition={hovered && isClickable
          ? { duration: 1.0, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.22 }}
        style={{
          position: "absolute", inset: -16, borderRadius: 20,
          background: `radial-gradient(ellipse at center, ${color}55 0%, ${color}22 45%, transparent 70%)`,
          boxShadow: `0 0 48px ${color}66, 0 0 90px ${color}28`,
          pointerEvents: "none", zIndex: 0,
        }}
      />

      {/* ── Scan line sweeping over back card on hover (mystery / anticipation) ── */}
      {hovered && phase === "back" && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden", pointerEvents: "none", zIndex: 2 }}>
          <motion.div
            animate={{ top: ["-8%", "108%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute", left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, transparent 0%, ${color}cc 40%, rgba(255,255,255,0.9) 50%, ${color}cc 60%, transparent 100%)`,
            }}
          />
        </div>
      )}

      {/* ── Rarity glow burst on flip — larger and multi-layered ── */}
      {showGlow && (
        <>
          <motion.div
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{
              position: "absolute", inset: -110,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color}88 0%, ${color}44 35%, transparent 65%)`,
              pointerEvents: "none", zIndex: 0,
            }}
          />
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{
              position: "absolute", inset: -60,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(255,255,255,0.55) 0%, ${color}66 25%, transparent 60%)`,
              pointerEvents: "none", zIndex: 0,
            }}
          />
        </>
      )}

      <motion.div
        animate={animTarget}
        transition={transTarget}
        onAnimationComplete={onComplete}
        onClick={handleClick}
        style={{
          cursor: isClickable ? "pointer" : "default",
          position: "relative",
          zIndex: 1,
          transformOrigin: "center",
        }}
      >
        {showFace && def
          ? <CharacterCard defId={inst.defId} def={def} size="lg" />
          : <CardBack
              size="lg"
              shownRarity={inst.visibility?.shownRarity}
              shownRole={inst.visibility?.shownRole}
              noHover
            />
        }

        {/* Face-up scan line on hover (ready to pick) */}
        {hovered && phase === "face" && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
            <motion.div
              animate={{ top: ["-8%", "108%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.7), ${color}cc, rgba(255,255,255,0.7), transparent)`,
              }}
            />
          </div>
        )}

        {/* Multi-ring pulse when face-up and ready to add */}
        {phase === "face" && [0, 0.55].map(delay => (
          <motion.div
            key={delay}
            animate={{ opacity: [0, 0.55, 0], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay }}
            style={{
              position: "absolute", inset: -5, borderRadius: 14,
              border: `2px solid ${color}`,
              boxShadow: `0 0 12px ${color}55`,
              pointerEvents: "none",
            }}
          />
        ))}
      </motion.div>

      {/* Hint label */}
      <div style={{
        fontSize: 9, letterSpacing: 2, userSelect: "none",
        color: phase === "face" ? color + "99" : hovered ? color + "66" : "#2e2e4a",
        transition: "color 0.3s",
        textShadow: hovered && isClickable ? `0 0 10px ${color}88` : "none",
      }}>
        {phase === "back"     && (hovered ? "▼ CLICK TO REVEAL" : "click to flip")}
        {phase === "face"     && "click to add →"}
        {phase === "flip-out" && "· · ·"}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function RevealScreen({ state, onSend, playerNames }: {
  state: GameState; onSend: (i: Intent) => void; playerNames: PlayerNames;
}) {
  const me = state.activePlayerId;
  const rp = state.revealPhase!;
  const meColor = me === "P1" ? "#4a9eff" : "#ff6666";

  const myHand = state.players[me].hand;
  const myUnrevealed = myHand.filter(c => !rp.revealed.includes(c.instanceId));
  const revealsLeft = myUnrevealed.length;

  const p1Revealed = rp.revealed.filter(id => state.players.P1.hand.some(c => c.instanceId === id));
  const p2Revealed = rp.revealed.filter(id => state.players.P2.hand.some(c => c.instanceId === id));

  // ── Screen shake + colour flash for SS / SSS / X reveals ─────────────────
  const shakeControls = useAnimation();
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const handleFlipEffect = async (rarity: string, color: string) => {
    if (!["SS", "SSS", "X"].includes(rarity)) return;

    // Color flash overlay
    setFlashColor(color);
    setFlashKey(k => k + 1);
    setTimeout(() => setFlashColor(null), 800);

    // Screen shake (Framer Motion keyframe array)
    const intensity = rarity === "X" ? 14 : rarity === "SSS" ? 10 : 7;
    await shakeControls.start({
      x: [0, -intensity, intensity, -intensity * 0.8, intensity * 0.8,
           -intensity * 0.5, intensity * 0.5, -2, 2, 0],
      transition: {
        duration: rarity === "X" ? 0.55 : 0.42,
        times: [0, 0.08, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 1],
        ease: "easeOut",
      },
    });
  };

  return (
    // height:100vh + overflow:hidden ensures the depart animation and glow bursts
    // can never cause the page to extend and become scrollable
    <div style={{
      height: "100vh", overflow: "hidden", background: "#04040a",
      backgroundImage: BG.reveal, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 52s ease-in-out infinite",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      <AmbientCanvas theme="sparks" />
      <AmbientOverlay theme="dark" />
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.4)", pointerEvents: "none", zIndex: 0 }} />

      {/* Full-screen colour flash for SS/SSS/X */}
      {flashColor && (
        <motion.div
          key={flashKey}
          initial={{ opacity: 0.65 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: `radial-gradient(ellipse at center, ${flashColor}55 0%, ${flashColor}22 40%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content — wrapped in shakeControls motion.div */}
      <motion.div
        animate={shakeControls}
        style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, padding: "20px 20px 12px", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: 5, color: "#2a2a2a" }}>PHASE 2</div>
          <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 5, color: "#fff", marginBottom: 4 }}>REVEAL</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            <span style={{ color: meColor }}>{playerNames[me]}</span>
            &nbsp;— flip each card, then click again to add to hand &nbsp;·&nbsp;
            <span style={{ color: revealsLeft > 0 ? "#ffd700" : "#44dd44" }}>{revealsLeft} remaining</span>
          </div>
        </div>

        {/* Both players' top grids */}
        <div style={{ display: "flex", gap: 20, marginBottom: 20, justifyContent: "center" }}>
          <div style={{
            flex: 1, maxWidth: 580,
            background: "rgba(8,8,18,0.35)", borderRadius: 14,
            border: "1px solid #1a1a33", padding: "20px 18px",
            backdropFilter: "blur(4px)",
          }}>
            <HandGrid pId="P1" revealedIds={p1Revealed} state={state} playerNames={playerNames} />
          </div>
          <div style={{ width: 1, background: "#111", alignSelf: "stretch" }} />
          <div style={{
            flex: 1, maxWidth: 580,
            background: "rgba(8,8,18,0.35)", borderRadius: 14,
            border: "1px solid #1a1a33", padding: "20px 18px",
            backdropFilter: "blur(4px)",
          }}>
            <HandGrid pId="P2" revealedIds={p2Revealed} state={state} playerNames={playerNames} />
          </div>
        </div>

        {/* Active player hand — cards flip in place here, then fly up */}
        <div style={{
          background: "rgba(6,6,16,0.35)", borderRadius: 14,
          border: `1px solid ${meColor}22`, padding: "18px 20px",
          backdropFilter: "blur(4px)", textAlign: "center",
          overflow: "hidden", // clip glow bursts to this panel
        }}>
          <div style={{ fontSize: 10, color: "#3a3a5a", letterSpacing: 3, marginBottom: 18 }}>
            YOUR HAND — flip a card, then click it again to add to hand
          </div>
          <div style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap", minHeight: 260, alignItems: "center" }}>
            {myUnrevealed.map(inst => (
              <RevealHandCard
                key={inst.instanceId}
                inst={inst}
                state={state}
                onRevealIntent={() =>
                  onSend({ type: "REVEAL_CARD", playerId: me, cardInstanceId: inst.instanceId })
                }
                onFlipEffect={handleFlipEffect}
              />
            ))}
            {myUnrevealed.length === 0 && (
              <div style={{ color: "#2a2a3a", fontSize: 13, padding: "20px 0" }}>
                All revealed — waiting for opponent...
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
