import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation, useMotionValue, animate } from "framer-motion";
import type { BindingVowId, CardDef, DraftPoolCard, GameState, Intent, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import type { PlayerIcons, PlayerNames } from "../types";
import CharacterCard, { CardBack } from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import { rc } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";
import CardRevealCinematic from "./CardRevealCinematic";
import PickSideCinematic from "./PickSideCinematic";
import RateSideCinematic from "./RateSideCinematic";

// ─────────────────────────────────────────────────────────────────────────────
// Spell type
// ─────────────────────────────────────────────────────────────────────────────
type ActiveSpell = "REVEAL" | "RATE" | "DENY" | "FREEZE" | "EXTEND_FREEZE" | null;

// ─────────────────────────────────────────────────────────────────────────────
// Pool card — drag to hand to pick. Click only matters in spell-targeting mode.
// ─────────────────────────────────────────────────────────────────────────────
function PoolCard({
  card, cardDb, isMyTurn, myPlayerId,
  activeSpell, onSpellFired,
  onPick,
  debugRevealMode,
  currentTurn,
  onDragStart, onDragEnd, onRevealEffect, onPickHighRarity, onRateHighRarity,
}: {
  card: DraftPoolCard; cardDb: Record<string, CardDef>;
  isMyTurn: boolean; myPlayerId: PlayerId;
  activeSpell: ActiveSpell;
  onSpellFired: (spell: ActiveSpell, cardInstanceId: string) => void;
  onPick: () => void;
  debugRevealMode: boolean;
  currentTurn: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onRevealEffect?: (rarity: string, color: string, defId: string) => void;
  onPickHighRarity?: (defId: string, def: CardDef) => void;
  onRateHighRarity?: (rarity: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const rotateZ = useMotionValue(0);
  const def = cardDb[card.defId];

  // Detect reveal/rate transitions → screen effect
  const prevRevealed = useRef(card.identityRevealed);
  const prevShownRarity = useRef(card.shownRarity);
  useEffect(() => {
    if (!prevRevealed.current && card.identityRevealed && def)
      onRevealEffect?.(def.rarity, rc(def.rarity), card.defId);
    prevRevealed.current = card.identityRevealed;
  }, [card.identityRevealed]);
  useEffect(() => {
    if (!prevShownRarity.current && card.shownRarity) {
      onRevealEffect?.(card.shownRarity, rc(card.shownRarity), card.defId);
      if (["SS", "SSS", "X"].includes(card.shownRarity))
        onRateHighRarity?.(card.shownRarity);
    }
    prevShownRarity.current = card.shownRarity;
  }, [card.shownRarity]);

  // Is this card a valid target for the active spell?
  const isDenied        = !!card.denied;
  const isFrozen        = !!card.frozenUntilTurn;
  const canTargetReveal       = activeSpell === "REVEAL"        && !card.identityRevealed && !isDenied && !isFrozen;
  const canTargetRate         = activeSpell === "RATE"          && !card.shownRarity && !card.identityRevealed && !isDenied && !isFrozen;
  const canTargetDeny         = activeSpell === "DENY"          && !isDenied && !isFrozen;
  const canTargetFreeze       = activeSpell === "FREEZE"        && !isDenied && !isFrozen;
  const canTargetExtendFreeze = activeSpell === "EXTEND_FREEZE" && isFrozen && !isDenied;
  const isSpellTarget         = canTargetReveal || canTargetRate || canTargetDeny || canTargetFreeze || canTargetExtendFreeze;

  const handleClick = () => {
    if (canTargetExtendFreeze) { onSpellFired("EXTEND_FREEZE", card.instanceId); return; }
    if (!isMyTurn || isDenied || isFrozen) return;

    if (debugRevealMode && !card.identityRevealed) {
      onSpellFired("REVEAL", card.instanceId);
      return;
    }

    if (activeSpell && isSpellTarget) {
      onSpellFired(activeSpell, card.instanceId);
    }
  };

  const handleDragEnd = (_: unknown, info: { point: { x: number; y: number } }) => {
    setIsDragging(false);
    onDragEnd?.();
    if (!isMyTurn) return;

    // elementsFromPoint (plural) returns ALL elements at this point, top to bottom.
    // We need this because the dragged card itself (zIndex 9999) sits on top at the
    // release point — elementFromPoint (singular) would return the card, not the
    // hand panel underneath it.
    const els = document.elementsFromPoint(info.point.x, info.point.y);
    const dropZone = els.find(el => (el as HTMLElement).hasAttribute?.("data-drop-hand")) as HTMLElement | undefined;
    if (dropZone && dropZone.getAttribute("data-drop-hand") === myPlayerId) {
      if (card.identityRevealed && def && ["SS", "SSS", "X"].includes(def.rarity))
        onPickHighRarity?.(card.defId, def);
      onPick();
    }
  };

  // Visual state
  const spellGlow = isSpellTarget
    ? activeSpell === "REVEAL"        ? "drop-shadow(0 0 10px #ff994499)"
    : activeSpell === "DENY"          ? "drop-shadow(0 0 10px #ff333399)"
    : activeSpell === "FREEZE"        ? "drop-shadow(0 0 12px #44aaff99)"
    : activeSpell === "EXTEND_FREEZE" ? "drop-shadow(0 0 14px #aaeeffcc)"
    : "drop-shadow(0 0 10px #cc44ee99)"
    : undefined;

  const cardEl = card.identityRevealed && def
    ? <CharacterCard defId={card.defId} def={def} size="sm" noHover />
    : <CardBack size="s" shownRarity={card.shownRarity} shownRole={card.shownRole} noHover />;

  return (
    <motion.div
      drag={isMyTurn && !activeSpell && !isDenied && !isFrozen}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 550, bounceDamping: 38 }}
      onClick={handleClick}
      onDoubleClick={() => {
        if (isMyTurn && !activeSpell && !isDenied && !isFrozen) {
          if (card.identityRevealed && def && ["SS", "SSS", "X"].includes(def.rarity))
            onPickHighRarity?.(card.defId, def);
          onPick();
        }
      }}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart?.();
      }}
      onDrag={(_: unknown, info: { velocity: { x: number }; point: { x: number; y: number } }) => {
        rotateZ.set(Math.max(-14, Math.min(14, info.velocity.x / 45)));
      }}
      onDragEnd={(e: unknown, info: { point: { x: number; y: number } }) => {
        animate(rotateZ, 0, { type: "spring", stiffness: 420, damping: 26 });
        handleDragEnd(e, info);
      }}
      whileHover={isMyTurn && !isDragging ? {
        y: activeSpell ? (isSpellTarget ? -6 : 0) : -6,
        scale: activeSpell ? (isSpellTarget ? 1.05 : 1) : 1.04,
        transition: { type: "spring", stiffness: 420, damping: 26 },
      } : undefined}
      whileDrag={{
        scale: 1.12, zIndex: 9999,
        filter: [
          "brightness(1.09)",
          "drop-shadow(0 32px 50px rgba(0,0,0,0.95))",
          "drop-shadow(0 12px 20px rgba(0,0,0,0.75))",
          `drop-shadow(0 0 18px ${card.identityRevealed && def ? "rgba(180,180,255,0.22)" : "rgba(80,80,200,0.32)"})`,
        ].join(" "),
      }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      style={{
        rotateZ,
        cursor: isMyTurn
          ? activeSpell
            ? isSpellTarget ? "pointer" : "default"
            : (isDenied || isFrozen) ? "default" : isDragging ? "grabbing" : "grab"
          : "default",
        userSelect: "none",
        position: "relative",
        zIndex: isDragging ? 9999 : 1,
        touchAction: "none",
        filter: [
          debugRevealMode && !card.identityRevealed && isMyTurn && !isDragging
            ? "brightness(1.15) drop-shadow(0 0 6px #ff990066)"
            : undefined,
          spellGlow,
          // dim non-targetable cards while a spell is active
          activeSpell && !isSpellTarget && !isDragging ? "brightness(0.72)" : undefined,
        ].filter(Boolean).join(" ") || undefined,
        transition: "filter 0.15s",
      }}
    >
      <div style={{ position: "relative" }}>
        {cardEl}

        {/* Denied — lock overlay */}
        {isDenied && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{ fontSize: 28, opacity: 0.70, filter: "drop-shadow(0 0 8px #ff333388)" }}>🔒</div>
          </div>
        )}

        {/* Frozen — ice overlay */}
        {isFrozen && !isDenied && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "linear-gradient(160deg, rgba(30,80,160,0.55) 0%, rgba(10,40,100,0.72) 100%)",
            border: "1px solid #44aaffaa",
            boxShadow: "inset 0 0 18px rgba(100,200,255,0.25)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            pointerEvents: "none",
          }}>
            <div style={{ fontSize: 26, filter: "drop-shadow(0 0 8px #44ccff88)" }}>🧊</div>
            <div style={{ fontSize: 8, color: "#88ccff", letterSpacing: 1, fontWeight: "bold" }}>
              FROZEN
            </div>
            <div style={{ fontSize: 10, color: "#aaddff", fontWeight: "bold" }}>
              {Math.max(0, (card.frozenUntilTurn ?? 0) - currentTurn)}t
            </div>
          </div>
        )}

        {/* Spell-target pulse ring — also shows on frozen card for EXTEND_FREEZE */}
        {isSpellTarget && !isDenied && (
          <motion.div
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", inset: -4, borderRadius: 12,
              border: `2px solid ${activeSpell === "DENY" ? "#ff3333" : activeSpell === "REVEAL" ? "#ff9944" : activeSpell === "FREEZE" ? "#44aaff" : activeSpell === "EXTEND_FREEZE" ? "#aaeeff" : "#cc44ee"}`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player hand panel + spell buttons below it
// ─────────────────────────────────────────────────────────────────────────────
function PlayerHandPanel({
  pid, state, playerNames, playerIcons,
  isActive, spellsLeft, revealsUsed, revealCap, iceCharges,
  isDragTarget,
}: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons;
  isActive: boolean; spellsLeft: number; revealsUsed: number; revealCap: number;
  iceCharges: number;
  isDragTarget: boolean;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const picks = state.players[pid].hand;
  const vowId = state.vowsChosen[pid] as BindingVowId | null;
  const vowDef = vowId ? VOW_DEFS[vowId] : null;

  return (
    <div style={{
      width: "36%", minWidth: 296, maxWidth: 418,
      display: "flex", flexDirection: "column", minHeight: 0,
      background: isDragTarget ? `rgba(10,10,24,0.90)` : isActive ? `rgba(${pid === "P1" ? "6,14,30" : "28,6,6"},0.72)` : "rgba(5,5,12,0.3)",
      borderRight: pid === "P1" ? `${isActive ? "2px" : "1px"} solid ${isDragTarget ? pColor + "cc" : isActive ? pColor + "88" : "#1a1a28"}` : "none",
      borderLeft: pid === "P2" ? `${isActive ? "2px" : "1px"} solid ${isDragTarget ? pColor + "cc" : isActive ? pColor + "88" : "#1a1a28"}` : "none",
      boxShadow: isDragTarget
        ? (pid === "P1" ? `inset -14px 0 48px ${pColor}28, 0 0 48px ${pColor}22` : `inset 14px 0 48px ${pColor}28, 0 0 48px ${pColor}22`)
        : isActive
          ? (pid === "P1"
            ? `inset -20px 0 60px ${pColor}28, inset -4px 0 20px ${pColor}18, 0 0 60px ${pColor}22`
            : `inset 20px 0 60px ${pColor}28, inset 4px 0 20px ${pColor}18, 0 0 60px ${pColor}22`)
          : "none",
      transition: "all 0.22s",
      position: "relative",
    }}>

      {/* Drag pulse overlay */}
      {isDragTarget && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          background: `linear-gradient(${pid === "P1" ? "270deg" : "90deg"}, ${pColor}16 0%, transparent 55%)`,
          animation: "dropZonePulse 0.75s ease-in-out infinite",
          borderRadius: 4,
        }} />
      )}

      {/* Identity bar */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: `1px solid ${isDragTarget ? pColor + "44" : isActive ? pColor + "33" : "#1a1a28"}`,
        background: isActive ? `${pColor}08` : "transparent",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: pid === "P1" ? "row" : "row-reverse",
        alignItems: "stretch",
        gap: 12,
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          borderRadius: 10,
          border: `2px solid ${isDragTarget ? pColor + "99" : isActive ? pColor : "#2a2a38"}`,
          boxShadow: isDragTarget ? `0 0 28px ${pColor}88` : isActive ? `0 0 20px ${pColor}66` : "none",
          transition: "all 0.2s",
          overflow: "hidden", flexShrink: 0, alignSelf: "stretch", display: "flex",
        }}>
          <PlayerIcon icon={playerIcons[pid]} size={72}
            style={{ display: "block", width: 72, height: "100%", objectFit: "cover" } as React.CSSProperties} />
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
          <div style={{
            fontSize: 18, fontWeight: "bold",
            color: isDragTarget ? pColor : isActive ? pColor : "#666",
            textAlign: pid === "P1" ? "left" : "right",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textShadow: isDragTarget ? `0 0 24px ${pColor}cc` : isActive ? `0 0 18px ${pColor}99` : "none",
            transition: "all 0.2s",
          }}>
            {playerNames[pid]}
          </div>
          <div style={{
            fontSize: 9, letterSpacing: 2, textAlign: pid === "P1" ? "left" : "right",
            color: isDragTarget ? pColor + "cc" : isActive ? pColor + "aa" : "#444",
            fontWeight: isDragTarget ? "bold" : "normal",
          }}>
            {isDragTarget ? "▼ DROP TO PICK" : isActive ? "▶ YOUR TURN" : pid}
          </div>

          {vowDef && (
            <div style={{
              fontSize: 10, color: "#cc9900", background: "#1a110022",
              border: "1px solid #443300", borderRadius: 5, padding: "3px 7px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              textAlign: pid === "P1" ? "left" : "right",
            }}>
              {vowDef.icon} {vowDef.name}
            </div>
          )}

        </div>
      </div>

      {/* Hand card grid — the actual drop zone */}
      <div
        data-drop-hand={pid}
        style={{
          flex: 1,
          margin: "8px 8px 0",
          padding: "10px 8px",
          background: isDragTarget
            ? `rgba(${pid === "P1" ? "10,20,40" : "40,10,10"},0.45)`
            : "rgba(7,7,15,0.3)",
          border: `${isDragTarget ? "2px" : "1px"} solid ${isDragTarget ? pColor + "66" : isActive ? pColor + "33" : "rgba(24,24,42,0.4)"}`,
          borderRadius: "10px 10px 0 0",
          display: "flex", flexDirection: "column",
          alignItems: "center",
          position: "relative", zIndex: 1,
          transition: "all 0.18s",
          boxShadow: isDragTarget ? `inset 0 0 18px ${pColor}0c` : "none",
          minHeight: 0,
        }}
      >
        <div style={{
          fontSize: 11,
          color: isDragTarget ? pColor : isActive ? pColor + "cc" : "#3a3a48",
          letterSpacing: 2, marginBottom: 8, textAlign: "center", fontWeight: "bold",
          textShadow: isDragTarget ? `0 0 12px ${pColor}88` : "none",
          transition: "all 0.18s",
          flexShrink: 0, alignSelf: "stretch",
        }}>
          {isDragTarget ? "▼ DROP CARD HERE" : `HAND — ${picks.length}/6`}
        </div>

        {/* Big + overlay when dragging over this panel */}
        {isDragTarget && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.28, 0.48, 0.28] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 96, color: pColor, lineHeight: 1, fontWeight: 100, userSelect: "none" }}
            >
              +
            </motion.div>
          </div>
        )}

        {/* 6-slot grid — centered, md-size cards (30 % bigger than before) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 128px)",
          gap: "12px 10px",
          justifyContent: "center",
        }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const inst = picks[i] as (typeof picks)[0] | undefined;
            const vis = inst?.visibility;
            const def = inst ? state.cardDb[inst.defId] : null;
            if (!inst) {
              return (
                <div
                  key={i}
                  style={{
                    width: 128, height: 182, borderRadius: 10,
                    border: isDragTarget ? `1px dashed ${pColor}33` : "1px dashed #1e1e30",
                    background: isDragTarget ? `rgba(${pid === "P1" ? "14,28,60" : "60,14,14"},0.18)` : "rgba(6,6,14,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s",
                  }}
                >
                  <span style={{ fontSize: 10, color: isDragTarget ? pColor + "44" : "#252535" }}>{i + 1}</span>
                </div>
              );
            }
            if (vis?.identityRevealed && def)
              return <CharacterCard key={inst.instanceId} defId={inst.defId} def={def} size="mdl" />;
            if (vis?.shownRarity)
              return <CardBack key={inst.instanceId} size="mdl" shownRarity={vis.shownRarity} shownRole={vis.shownRole} />;
            return <CardBack key={inst.instanceId} size="mdl" />;
          })}
        </div>
      </div>

      {/* Resources + synergy hints — below the card grid */}
      <div style={{
        margin: "0 8px 8px", padding: "8px 12px",
        background: "rgba(6,6,14,0.55)",
        border: `1px solid ${isActive ? pColor + "22" : "#16161e"}`,
        borderTop: "none", borderRadius: "0 0 10px 10px",
        display: "flex", flexDirection: "column", gap: 8,
        position: "relative", zIndex: 1,
      }}>
        {/* Energy row */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} style={{
                fontSize: 25, lineHeight: 1,
                opacity: i < spellsLeft ? 1 : 0.18,
                filter: i < spellsLeft && isActive ? `drop-shadow(0 0 8px ${pColor}88)` : "none",
                transition: "all 0.2s",
              }}>⚡</span>
            ))}
            <span style={{ fontSize: 12, color: "#445", letterSpacing: 1, marginLeft: 4 }}>SPELLS</span>
          </div>

          <div style={{ width: 1, height: 26, background: "#1a1a28" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 25, lineHeight: 1,
              opacity: iceCharges > 0 ? 1 : 0.18,
              filter: iceCharges > 0 && isActive ? "drop-shadow(0 0 8px #44aaff88)" : "none",
              textDecoration: iceCharges <= 0 ? "line-through" : "none",
              transition: "all 0.2s",
            }}>🧊</span>
            <span style={{ fontSize: 12, color: "#445", letterSpacing: 1 }}>FREEZE</span>
          </div>

          <div style={{ width: 1, height: 26, background: "#1a1a28" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 25, lineHeight: 1, opacity: isActive ? 1 : 0.35, filter: isActive ? `drop-shadow(0 0 8px ${pColor}66)` : "none" }}>🃏</span>
            <span style={{
              fontSize: 17, fontWeight: "bold",
              color: isActive ? pColor : "#3a3a4a",
              textShadow: isActive ? `0 0 8px ${pColor}66` : "none",
            }}>
              {revealCap - revealsUsed}/{revealCap}
            </span>
            <span style={{ fontSize: 12, color: "#445", letterSpacing: 1 }}>REVEALS</span>
          </div>
        </div>

        {/* Synergy hints — active synergies this player currently has */}
        {state.players[pid].activeSynergies.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", borderTop: "1px solid #14141e", paddingTop: 7 }}>
            {state.players[pid].activeSynergies.map(syn => {
              const label = (SYNERGY_LABEL as Record<string, string>)[syn] ?? syn;
              return (
                <span key={syn} style={{
                  fontSize: 9, color: "#aa77ff", background: "#0d0620",
                  border: "1px solid #2a1060", borderRadius: 5, padding: "2px 7px",
                  letterSpacing: 0.5, animation: "synPulse 2s ease-in-out infinite",
                }}>
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DraftScreen({ state, onSend, playerNames, playerIcons }: {
  state: GameState; onSend: (i: Intent) => void;
  playerNames: PlayerNames; playerIcons: PlayerIcons;
}) {
  const me = state.activePlayerId;
  const draft = state.draft!;
  const spellsLeft = draft.spellsRemaining[me];
  const cardRevealUsed = draft.cardRevealUsed[me];
  const specialRevealVows = ["HEAVENLY_RESTRICTION_VOW", "BROTHERHOOD_PACT", "KING_OF_CURSES_VOW"];
  const hasSpecialVow = specialRevealVows.includes(state.vowsChosen[me] ?? "");
  const revealTotalCap = hasSpecialVow ? 8 : 2;
  const revealThisTurn = draft.cardRevealUsedThisTurn?.[me] ?? 0;
  const deniesLeft = draft.deniesRemaining?.[me] ?? 0;
  const lastDenyTurn = draft.lastDenyTurn?.[me] ?? 0;
  const denyOnCooldown = lastDenyTurn > 0 && state.turn - lastDenyTurn < 2;
  const freezesLeft = draft.freezesRemaining?.[me] ?? 0;
  const iceCharges = draft.iceCharges?.[me] ?? 0;
  const extendsLeft = draft.extendsRemaining?.[me] ?? 0;
  const hasFrozenCard = draft.pool.some(c => c.frozenUntilTurn && c.frozenUntilTurn > state.turn);
  const totalPicks = state.players.P1.hand.length + state.players.P2.hand.length;

  const [activeSpell, setActiveSpell] = useState<ActiveSpell>(null);
  const [debugRevealMode, setDebugRevealMode] = useState(false);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [cinematicCard, setCinematicCard] = useState<{ defId: string; def: CardDef } | null>(null);
  const [pickCinematic, setPickCinematic] = useState<{ defId: string; def: CardDef } | null>(null);
  const [rateCinematic, setRateCinematic] = useState<{ rarity: string } | null>(null);
  // Per-player skip counter across the whole draft (not reset per turn)
  const [skipsUsed, setSkipsUsed] = useState<Record<string, number>>({ P1: 0, P2: 0 });

  const handFull = state.players[me].hand.length >= 6;
  const skipsLeft = Math.max(0, 2 - (skipsUsed[me] ?? 0));
  const canSkip = handFull || skipsLeft > 0;

  // Reset spell on turn change
  useEffect(() => { setActiveSpell(null); }, [me]);

  // Preload all card art images as soon as the pool arrives so flips are instant
  useEffect(() => {
    const ids = new Set<string>();
    // All pool cards
    for (const c of draft.pool) ids.add(c.defId);
    // All cards already in hands (from previous picks)
    for (const p of Object.values(state.players)) {
      for (const c of p.hand) ids.add(c.defId);
    }
    for (const id of ids) {
      const img = new Image();
      img.src = `/cards/${id}.PNG`;
    }
  }, [draft.pool.length]);

  // ── Screen shake + colour flash ───────────────────────────────────────────
  const shakeControls = useAnimation();
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const handleRevealEffect = async (rarity: string, color: string, defId?: string) => {
    if (!["SS", "SSS", "X"].includes(rarity)) return;
    // Trigger P5-style cinematic for high-rarity reveals
    if (defId) {
      const def = state.cardDb[defId];
      if (def) { setCinematicCard({ defId, def }); return; } // cinematic handles all drama
    }
    setFlashColor(color);
    setFlashKey(k => k + 1);
    setTimeout(() => setFlashColor(null), 800);
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

  // Fires when a pool card is clicked in spell-targeting mode
  const handleSpellFired = (spell: ActiveSpell, cardInstanceId: string) => {
    if (!spell) return;
    if (spell === "REVEAL") {
      if (debugRevealMode) {
        onSend({ type: "DEBUG_REFILL_SPELLS", playerId: me });
      }
      onSend({ type: "SPELL_CARD_REVEAL", playerId: me, cardInstanceId });
    } else if (spell === "DENY") {
      onSend({ type: "DRAFT_DENY", playerId: me, cardInstanceId });
    } else if (spell === "FREEZE") {
      onSend({ type: "DRAFT_FREEZE", playerId: me, cardInstanceId });
    } else if (spell === "EXTEND_FREEZE") {
      onSend({ type: "DRAFT_EXTEND_FREEZE", playerId: me, cardInstanceId });
    } else {
      onSend({ type: "SPELL_GLOBAL_RATE", playerId: me, cardInstanceId });
    }
    setActiveSpell(null);
  };

  const meColor = me === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div
      style={{
        height: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        background: "#05050b",
        backgroundImage: BG.draft,
        backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 65s ease-in-out infinite",
        color: "#e0e0e0",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        position: "relative",
      }}
    >
      <AmbientCanvas theme="embers" />
      <AmbientOverlay theme="blue" />
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.38)", pointerEvents: "none", zIndex: 0 }} />

      {/* P5 cinematic overlay for SS/SSS/X reveals (full screen) */}
      {cinematicCard && (
        <CardRevealCinematic
          defId={cinematicCard.defId}
          def={cinematicCard.def}
          onDone={() => setCinematicCard(null)}
        />
      )}

      {/* P5 half-screen cinematic when SS/SSS/X card is PICKED */}
      {pickCinematic && (
        <PickSideCinematic
          defId={pickCinematic.defId}
          def={pickCinematic.def}
          side={me === "P1" ? "left" : "right"}
          onDone={() => setPickCinematic(null)}
        />
      )}

      {/* P5 bottom strip cinematic when SS/SSS/X card is RATED */}
      {rateCinematic && (
        <RateSideCinematic
          rarity={rateCinematic.rarity}
          side={me === "P1" ? "left" : "right"}
          onDone={() => setRateCinematic(null)}
        />
      )}

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

      {/* Active spell banner */}
      {activeSpell && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
            zIndex: 40, pointerEvents: "none",
            padding: "6px 24px",
            background: activeSpell === "REVEAL" ? "rgba(40,20,0,0.9)" : activeSpell === "DENY" ? "rgba(30,5,5,0.9)" : activeSpell === "FREEZE" ? "rgba(5,20,50,0.9)" : "rgba(20,0,30,0.9)",
            border: `1px solid ${activeSpell === "REVEAL" ? "#ff994466" : activeSpell === "DENY" ? "#ff333366" : activeSpell === "FREEZE" ? "#44aaff66" : "#cc44ee66"}`,
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            fontSize: 11, letterSpacing: 3,
            color: activeSpell === "REVEAL" ? "#ffaa55" : activeSpell === "FREEZE" ? "#88ccff" : "#dd88ff",
            fontWeight: "bold",
          }}
        >
          {activeSpell === "REVEAL" ? "🃏 SELECT A CARD TO REVEAL" : activeSpell === "DENY" ? "🔒 SELECT A CARD TO DENY — it will be revealed and locked" : activeSpell === "FREEZE" ? "🧊 SELECT A CARD TO FREEZE — revealed and locked for 3 turns" : "📊 SELECT A CARD TO RATE"}
        </motion.div>
      )}

      <motion.div
        animate={shakeControls}
        style={{
          position: "relative", zIndex: 1,
          display: "flex", flex: 1,
          overflow: isDraggingAny ? "visible" : "hidden",
        }}
      >
        {/* P1 panel */}
        <PlayerHandPanel
          pid="P1" state={state}
          playerNames={playerNames} playerIcons={playerIcons}
          isActive={me === "P1"}
          spellsLeft={draft.spellsRemaining["P1"]} revealsUsed={draft.cardRevealUsed["P1"]}
          revealCap={specialRevealVows.includes(state.vowsChosen["P1"] ?? "") ? 6 : 2}
          iceCharges={draft.iceCharges?.["P1"] ?? 0}
          isDragTarget={isDraggingAny && me === "P1"}
        />

        {/* Center pool */}
        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            overflow: isDraggingAny ? "visible" : "hidden",
            padding: "12px 14px",
          }}
        >
          {/* Header */}
          <div style={{
            textAlign: "center", marginBottom: 12,
            padding: "8px 16px",
            background: `${meColor}08`,
            border: `1px solid ${activeSpell ? (activeSpell === "REVEAL" ? "#ff994433" : "#cc44ee33") : meColor + "28"}`,
            borderRadius: 10,
            boxShadow: `0 0 20px ${meColor}18`,
            animation: "pulseBorder 2s ease-in-out infinite",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#666", marginBottom: 3 }}>PHASE 1 · DRAFT</div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: meColor, letterSpacing: 2 }}>
              {playerNames[me].toUpperCase()}'S TURN
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {totalPicks}/12 picked · {draft.pool.length} remaining
              {activeSpell && <span style={{ color: activeSpell === "REVEAL" ? "#ff9944" : "#cc44ee", marginLeft: 10 }}>
                {activeSpell === "REVEAL" ? "🃏 click a card to reveal" : "📊 click a card to rate"}
              </span>}
              {isDraggingAny && !activeSpell && <span style={{ color: meColor, marginLeft: 10 }}>→ drag to your panel</span>}
              {debugRevealMode && <span style={{ color: "#ff9944", marginLeft: 10 }}>👁 REVEAL MODE</span>}
            </div>
          </div>

          {/* Card pool */}
          <div style={{
            flex: 1,
            overflow: isDraggingAny ? "visible" : "auto",
            background: "linear-gradient(180deg, rgba(8,8,15,0.28) 0%, rgba(5,5,9,0.28) 100%)",
            borderRadius: 12,
            border: `1px solid ${activeSpell ? (activeSpell === "REVEAL" ? "#ff994428" : "#cc44ee28") : "rgba(26,26,46,0.4)"}`,
            padding: "16px 10px 24px",
            backdropFilter: isDraggingAny ? "none" : "blur(4px)",
            transition: "border-color 0.2s",
          }}>
            {(() => {
              const waves: Array<{ count: number; offsets: number[]; gapTop: number }> = [
                { count: 9, offsets: [0,-8,4,-12,0,-10,6,-6,2],  gapTop: 0 },
                { count: 6, offsets: [10,-4,0,-14,2,-8],          gapTop: 6 },
                { count: 9, offsets: [4,-6,12,-4,0,-8,4,-10,6],  gapTop: 6 },
                { count: 6, offsets: [0,-10,6,-4,10,-6],          gapTop: 6 },
                { count: 9, offsets: [0,-8,4,-12,0,-10,6,-6,2],  gapTop: 6 },
              ];
              const pool = draft.pool;
              const rows: React.ReactNode[] = [];
              let idx = 0;
              for (const wave of waves) {
                if (idx >= pool.length) break;
                const rowCards = pool.slice(idx, idx + wave.count);
                idx += wave.count;
                rows.push(
                  <div key={`wave-${idx}`} style={{
                    display: "flex", justifyContent: "center",
                    gap: "8px", marginTop: wave.gapTop,
                    paddingTop: wave.count <= 6 ? 4 : 0,
                  }}>
                    {rowCards.map((card, ci) => {
                      const offset = wave.offsets[ci] ?? 0;
                      // Stagger float phase by card position so they don't all bob in sync
                      const floatDelay = ((idx - rowCards.length + ci) * 0.27) % 2.8;
                      return (
                        <motion.div
                          key={card.instanceId}
                          animate={{ y: [offset, offset - 4, offset] }}
                          transition={{
                            duration: 2.8,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: floatDelay,
                          }}
                          style={{
                            filter: offset < -8 ? "drop-shadow(0 8px 16px rgba(0,0,0,0.5))" : "none",
                            zIndex: offset < -8 ? 2 : 1,
                            position: "relative",
                          }}>
                          <PoolCard
                            card={card}
                            cardDb={state.cardDb}
                            isMyTurn={true}
                            myPlayerId={me}
                            activeSpell={activeSpell}
                            onSpellFired={handleSpellFired}
                            onPick={() => {
                              onSend({ type: "DRAFT_PICK", playerId: me, cardInstanceId: card.instanceId });
                              setIsDraggingAny(false);
                            }}
                            debugRevealMode={debugRevealMode}
                            currentTurn={state.turn}
                            onDragStart={() => { setIsDraggingAny(true); setActiveSpell(null); }}
                            onDragEnd={() => setIsDraggingAny(false)}
                            onRevealEffect={handleRevealEffect}
                            onPickHighRarity={(defId, def) => setPickCinematic({ defId, def })}
                            onRateHighRarity={(rarity) => setRateCinematic({ rarity })}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                );
              }
              return rows;
            })()}
          </div>

          {/* Bottom bar — spells + skip */}
          <div style={{ display: "flex", gap: 5, justifyContent: "center", alignItems: "stretch", marginTop: 10, flexShrink: 0, padding: "0 4px" }}>
            {/* REVEAL spell */}
            {(() => {
              const canReveal = spellsLeft > 0 && cardRevealUsed < revealTotalCap &&
                (!hasSpecialVow || revealThisTurn < 2);
              const active = activeSpell === "REVEAL";
              return (
                <button
                  onClick={e => { e.stopPropagation(); setActiveSpell(active ? null : "REVEAL"); }}
                  disabled={!canReveal}
                  style={{
                    padding: "11px 18px", flex: 1,
                    background: active ? "rgba(255,140,40,0.26)" : canReveal ? "rgba(30,14,0,0.82)" : "rgba(8,8,8,0.5)",
                    border: `${active ? "2px" : "1px"} solid ${active ? "#ffaa55ff" : canReveal ? "#aa5500" : "#1a1a1a"}`,
                    borderRadius: 10, color: active ? "#ffcc77" : canReveal ? "#dd7722" : "#444",
                    cursor: canReveal ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: "bold", letterSpacing: 1, transition: "all 0.15s",
                    boxShadow: active ? "0 0 22px #ff994466, 0 0 8px #ff994433" : canReveal ? "0 0 10px #ff994422" : "none",
                    animation: active ? "spellPulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  🃏 REVEAL
                  <div style={{ fontSize: 9, color: active ? "#ff9944" : canReveal ? "#775533" : "#333", marginTop: 3, letterSpacing: 0, fontWeight: "normal" }}>
                    {revealTotalCap - cardRevealUsed}/{revealTotalCap}
                    {hasSpecialVow && <span style={{ marginLeft: 3, opacity: 0.7 }}>(turn: {2 - revealThisTurn})</span>}
                  </div>
                </button>
              );
            })()}

            {/* RATE spell */}
            {(() => {
              const canRate = spellsLeft > 0;
              const active = activeSpell === "RATE";
              return (
                <button
                  onClick={e => { e.stopPropagation(); setActiveSpell(active ? null : "RATE"); }}
                  disabled={!canRate}
                  style={{
                    padding: "11px 18px", flex: 1,
                    background: active ? "rgba(180,40,255,0.26)" : canRate ? "rgba(22,0,30,0.82)" : "rgba(8,8,8,0.5)",
                    border: `${active ? "2px" : "1px"} solid ${active ? "#cc44eeff" : canRate ? "#881199" : "#1a1a1a"}`,
                    borderRadius: 10, color: active ? "#ee99ff" : canRate ? "#bb44dd" : "#444",
                    cursor: canRate ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: "bold", letterSpacing: 1, transition: "all 0.15s",
                    boxShadow: active ? "0 0 22px #cc44ee66, 0 0 8px #cc44ee33" : canRate ? "0 0 10px #cc44ee22" : "none",
                    animation: active ? "spellPulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  📊 RATE
                  <div style={{ fontSize: 9, color: active ? "#cc44ee" : canRate ? "#664488" : "#333", marginTop: 3, letterSpacing: 0, fontWeight: "normal" }}>
                    ⚡ {spellsLeft}
                  </div>
                </button>
              );
            })()}

            {/* DENY */}
            {(() => {
              const canDeny = deniesLeft > 0 && !denyOnCooldown;
              const active = activeSpell === "DENY";
              return (
                <button
                  onClick={e => { e.stopPropagation(); setActiveSpell(active ? null : "DENY"); }}
                  disabled={!canDeny}
                  title={denyOnCooldown ? "On cooldown — wait 1 more turn" : deniesLeft <= 0 ? "No denies left this draft" : "Reveal and lock a card — it can never be picked"}
                  style={{
                    padding: "11px 18px", flex: 1,
                    background: active ? "rgba(200,20,20,0.30)" : canDeny ? "rgba(26,4,4,0.82)" : "rgba(8,8,8,0.5)",
                    border: `${active ? "2px" : "1px"} solid ${active ? "#ff4444ff" : canDeny ? "#881111" : "#1a1a1a"}`,
                    borderRadius: 10, color: active ? "#ff8888" : canDeny ? "#cc3333" : "#444",
                    cursor: canDeny ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: "bold", letterSpacing: 1, transition: "all 0.15s",
                    boxShadow: active ? "0 0 22px #ff333366, 0 0 8px #ff333333" : canDeny ? "0 0 10px #ff333322" : "none",
                    animation: active ? "spellPulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  🔒 DENY
                  <div style={{ fontSize: 9, color: active ? "#ff4444" : canDeny ? "#772222" : "#333", marginTop: 3, letterSpacing: 0, fontWeight: "normal" }}>
                    {deniesLeft}/2{denyOnCooldown ? " ⏳" : " FREE"}
                  </div>
                </button>
              );
            })()}

            {/* FREEZE */}
            {(() => {
              const canFreeze = freezesLeft > 0 && iceCharges > 0;
              const active = activeSpell === "FREEZE";
              return (
                <button
                  onClick={e => { e.stopPropagation(); setActiveSpell(active ? null : "FREEZE"); }}
                  disabled={!canFreeze}
                  title={freezesLeft <= 0 ? "Already used freeze this draft" : iceCharges <= 0 ? "No ice energy this turn" : "Freeze a card for 2 turns"}
                  style={{
                    padding: "11px 18px", flex: 1,
                    background: active ? "rgba(20,70,180,0.34)" : canFreeze ? "rgba(4,14,44,0.82)" : "rgba(8,8,8,0.5)",
                    border: `${active ? "2px" : "1px"} solid ${active ? "#55bbffff" : canFreeze ? "#1155aa" : "#1a1a1a"}`,
                    borderRadius: 10, color: active ? "#99ddff" : canFreeze ? "#4499dd" : "#444",
                    cursor: canFreeze ? "pointer" : "not-allowed",
                    fontSize: 13, fontWeight: "bold", letterSpacing: 1, transition: "all 0.15s",
                    boxShadow: active ? "0 0 22px #44aaff66, 0 0 8px #44aaff33" : canFreeze ? "0 0 10px #44aaff22" : "none",
                    animation: active ? "spellPulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  🧊 FREEZE
                  <div style={{ fontSize: 9, color: active ? "#44aaff" : canFreeze ? "#335588" : "#333", marginTop: 3, letterSpacing: 0, fontWeight: "normal" }}>
                    {freezesLeft}/1 · 🧊{iceCharges > 0 ? "" : " spent"}
                  </div>
                </button>
              );
            })()}

            {/* EXTEND FREEZE — small button, only lights up when there's a frozen card */}
            {(() => {
              const canExtend = extendsLeft > 0 && iceCharges > 0 && hasFrozenCard;
              const active = activeSpell === "EXTEND_FREEZE";
              return (
                <button
                  onClick={e => { e.stopPropagation(); setActiveSpell(active ? null : "EXTEND_FREEZE"); }}
                  disabled={!canExtend}
                  title={extendsLeft <= 0 ? "No extends remaining this draft" : !hasFrozenCard ? "No frozen cards on the board" : iceCharges <= 0 ? "No ice energy this turn" : "Extend freeze on a frozen card by 1 turn"}
                  style={{
                    padding: "8px 10px", flexShrink: 0, minWidth: 60,
                    background: active ? "rgba(100,200,255,0.22)" : canExtend ? "rgba(4,20,50,0.82)" : "rgba(8,8,8,0.5)",
                    border: `${active ? "2px" : "1px"} solid ${active ? "#aaeeffff" : canExtend ? "#2288bb" : "#1a1a1a"}`,
                    borderRadius: 10, color: active ? "#ccf4ff" : canExtend ? "#55bbdd" : "#333",
                    cursor: canExtend ? "pointer" : "not-allowed",
                    fontSize: 10, fontWeight: "bold", letterSpacing: 0.5, transition: "all 0.15s",
                    boxShadow: active ? "0 0 18px #aaeeff55, 0 0 6px #aaeeff33" : canExtend ? "0 0 10px #44aaff33" : "none",
                    animation: active ? "spellPulse 1s ease-in-out infinite" : "none",
                    lineHeight: 1.2,
                  }}
                >
                  +⏱
                  <div style={{ fontSize: 8, color: active ? "#aaeeff" : canExtend ? "#226688" : "#333", marginTop: 2, letterSpacing: 0, fontWeight: "normal" }}>
                    {extendsLeft}/3
                  </div>
                </button>
              );
            })()}

            {/* Divider */}
            <div style={{ width: 1, background: "#2a2a44", margin: "4px 2px", flexShrink: 0 }} />

            {/* SKIP */}
            <button
              disabled={!canSkip}
              onClick={() => {
                if (!canSkip) return;
                if (!handFull) setSkipsUsed(prev => ({ ...prev, [me]: (prev[me] ?? 0) + 1 }));
                onSend({ type: "DRAFT_SKIP", playerId: me });
                setActiveSpell(null);
              }}
              style={{
                padding: "11px 18px", flex: 1,
                background: canSkip ? "rgba(14,14,36,0.72)" : "rgba(5,5,12,0.4)",
                border: `1px solid ${canSkip ? "#4a4a88" : "#1a1a28"}`,
                borderRadius: 10,
                color: canSkip ? "#aaaadd" : "#444",
                fontWeight: "bold",
                cursor: canSkip ? "pointer" : "not-allowed",
                fontSize: 13, letterSpacing: 1, transition: "all 0.15s",
                boxShadow: canSkip ? "0 0 10px #4a4a8822" : "none",
              }}
            >
              SKIP
              <div style={{ fontSize: 9, color: canSkip ? "#6666aa" : "#2a2a2a", marginTop: 3, fontWeight: "normal", letterSpacing: 0 }}>
                {handFull ? "∞" : `${skipsLeft}/2`}
              </div>
            </button>

            {/* Debug */}
            <button
              onClick={() => { setDebugRevealMode(m => !m); setActiveSpell(null); }}
              title="DEV: click any face-down card to reveal it instantly"
              style={{
                padding: "6px 10px",
                background: debugRevealMode ? "#1a0e00" : "#0a0800",
                border: `1px dashed ${debugRevealMode ? "#ff9944" : "#443300"}`,
                borderRadius: 8, color: debugRevealMode ? "#ff9944" : "#553300",
                cursor: "pointer", fontSize: 10, letterSpacing: 1,
              }}
            >
              {debugRevealMode ? "👁 ON" : "👁"}
            </button>
          </div>
        </div>

        {/* P2 panel */}
        <PlayerHandPanel
          pid="P2" state={state}
          playerNames={playerNames} playerIcons={playerIcons}
          isActive={me === "P2"}
          spellsLeft={draft.spellsRemaining["P2"]}
          revealsUsed={draft.cardRevealUsed["P2"]}
          revealCap={specialRevealVows.includes(state.vowsChosen["P2"] ?? "") ? 6 : 2}
          iceCharges={draft.iceCharges?.["P2"] ?? 0}
          isDragTarget={isDraggingAny && me === "P2"}
        />
      </motion.div>

      <style>{`
        @keyframes pulseBorder {
          0%,100% { box-shadow: 0 0 20px ${meColor}18; }
          50%      { box-shadow: 0 0 32px ${meColor}38; }
        }
        @keyframes dropZonePulse {
          0%,100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes slotBreathe {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes spellPulse {
          0%,100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
