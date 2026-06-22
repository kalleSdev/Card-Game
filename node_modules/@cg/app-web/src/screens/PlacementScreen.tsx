import { useState, useRef } from "react";
import { motion, useAnimation, useMotionValue, animate } from "framer-motion";
import type { BindingVowId, CardDef, CardInstance, GameState, Intent, PlayerId, PlayerZones, SlotRef } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { rc, slotLabel, getBoardCard, isBoardFull } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";
import AmbientOverlay from "../components/AmbientOverlay";
import AmbientCanvas from "../components/AmbientCanvas";

export function VowBadge({ vowId }: { vowId: BindingVowId | null }) {
  if (!vowId) return <span style={{ fontSize: 10, color: "#333" }}>No vow</span>;
  const vow = VOW_DEFS[vowId];
  return (
    <span style={{
      fontSize: 10, color: "#cc9900", background: "#1a1100",
      border: "1px solid #443300", borderRadius: 4, padding: "2px 6px",
    }}>
      {vow.icon} {vow.name}
    </span>
  );
}

// ── Hand card — draggable ────────────────────────────────────────────────────
export function HandCard({ def, defId, selected, onClick, onDragStart, onDrop }: {
  instance?: CardInstance; def: CardDef; defId: string; selected: boolean;
  onClick: () => void;
  onDragStart?: () => void;
  onDrop?: (point: { x: number; y: number }) => void;
}) {
  const rotateZ = useMotionValue(0);

  return (
    <motion.div
      drag
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 550, bounceDamping: 38 }}
      onDragStart={() => { onDragStart?.(); }}
      onDrag={(_: unknown, info: { velocity: { x: number } }) => {
        rotateZ.set(Math.max(-14, Math.min(14, info.velocity.x / 45)));
      }}
      onDragEnd={(_: unknown, info: { point: { x: number; y: number } }) => {
        animate(rotateZ, 0, { type: "spring", stiffness: 420, damping: 26 });
        onDrop?.({ x: info.point.x, y: info.point.y });
      }}
      onClick={onClick}
      animate={selected ? { y: -10, scale: 1.06 } : { y: 0, scale: 1 }}
      whileHover={!selected ? { y: -6, scale: 1.04, transition: { type: "spring", stiffness: 400, damping: 22 } } : undefined}
      whileDrag={{
        scale: 1.12,
        zIndex: 999,
        cursor: "grabbing",
        filter: [
          "brightness(1.09)",
          "drop-shadow(0 32px 50px rgba(0,0,0,0.95))",
          "drop-shadow(0 12px 20px rgba(0,0,0,0.75))",
          "drop-shadow(0 0 18px rgba(160,140,255,0.28))",
        ].join(" "),
      }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{ rotateZ, cursor: "grab", userSelect: "none", position: "relative", touchAction: "none" }}
    >
      <CharacterCard defId={defId} def={def} size="md" selected={selected} noHover />
    </motion.div>
  );
}

// ── Slot cell ────────────────────────────────────────────────────────────────
const SLOT_ICONS: Record<string, string> = {
  LEADER: "👑", COMBAT: "💥", SUPPORT: "✨",
};

export function SlotCell({ slot, instance, defId, def, canPlace, canReturn, onClick, dragActive, draggedAffinity }: {
  slot: SlotRef; instance?: CardInstance | null; defId?: string; def: CardDef | undefined;
  canPlace: boolean; canReturn: boolean; onClick: () => void;
  /** A card is currently being dragged from hand */
  dragActive?: boolean;
  /** Affinity of the card being dragged (for correct-slot highlight) */
  draggedAffinity?: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const cardColor = def ? rc(def.rarity) : null;

  const occupied = !!def;
  const isDroppable = dragActive && !occupied && slot.type !== "UNLEASH";
  const isCorrectMatch = isDroppable && draggedAffinity === slot.type;

  // Visual state priority: drag-hover > drag-available > click-hover > normal
  const glowing = (canPlace || canReturn) && hovered;

  // Border
  const borderColor = (() => {
    if (isCorrectMatch)            return "#ffd700cc";
    if (isDroppable && hovered)    return "#ffd70099";
    if (isDroppable)               return "#44448888";
    if (def && canReturn && hovered) return "#ff6644aa";
    if (def)                       return (cardColor ?? "#444") + "aa";
    if (glowing)                   return "#ffd70099";
    if (canPlace)                  return "#44446a";
    return "#18182a";
  })();

  // Background
  const bgColor = (() => {
    if (isCorrectMatch)  return "rgba(255,215,0,0.07)";
    if (isDroppable)     return hovered ? "rgba(255,215,0,0.04)" : "rgba(20,20,50,0.7)";
    if (def)             return `linear-gradient(180deg, ${cardColor}0a 0%, #0a0a1e 100%)`;
    if (glowing)         return "rgba(255,215,0,0.05)";
    if (canPlace)        return "rgba(30,30,60,0.6)";
    return "rgba(6,6,18,0.8)";
  })();

  // Box shadow
  const shadow = (() => {
    if (isCorrectMatch)            return "0 0 32px #ffd70055, 0 0 64px #ffd70022, inset 0 0 20px #ffd70010";
    if (isDroppable && hovered)    return "0 0 20px #ffd70033, inset 0 0 16px #ffd70008";
    if (isDroppable)               return "0 0 10px #44448833";
    if (def && canReturn && hovered) return "0 0 20px #ff664433, inset 0 0 16px #ff664408";
    if (def)                       return `0 0 16px ${cardColor}33, inset 0 0 20px ${cardColor}08`;
    if (glowing)                   return "0 0 20px #ffd70033, inset 0 0 16px #ffd70008";
    if (canPlace)                  return "0 0 8px #44446a33";
    return "none";
  })();

  return (
    <div
      // Data attributes for drop-detection via document.elementFromPoint
      data-slot-type={slot.type}
      data-slot-index={String(slot.index)}
      onClick={(canPlace || canReturn) ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: 138, height: 194,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: (canPlace || canReturn || isDroppable) ? "pointer" : "default",
        transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
        boxShadow: shadow,
        flexShrink: 0,
        backdropFilter: "blur(2px)",
        overflow: "hidden",
      }}
    >
      {/* Top accent line */}
      {def && cardColor && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: cardColor, opacity: 0.7, borderRadius: "12px 12px 0 0",
        }} />
      )}

      {/* Correct-slot match shimmer */}
      {isCorrectMatch && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, zIndex: 0, overflow: "hidden",
          pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", top: 0, bottom: 0, width: "55%",
            background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.08), rgba(255,240,150,0.14), rgba(255,215,0,0.08), transparent)",
            animation: "slotShimmer 1.6s ease-in-out infinite",
            transform: "skewX(-12deg)",
          }} />
        </div>
      )}

      {/* Drag-over "DROP HERE" hint */}
      {isDroppable && hovered && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, zIndex: 3,
          background: "rgba(255,215,0,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: 10, color: isCorrectMatch ? "#ffd700" : "#888899",
            fontWeight: "bold", letterSpacing: 2,
            textShadow: isCorrectMatch ? "0 0 10px #ffd70088" : "none",
          }}>
            {isCorrectMatch ? "✦ PERFECT" : "DROP"}
          </span>
        </div>
      )}

      {/* Return hint overlay */}
      {def && canReturn && hovered && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(255,80,30,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 10, zIndex: 2,
        }}>
          <span style={{ fontSize: 11, color: "#ff9966", fontWeight: "bold", letterSpacing: 1, textShadow: "0 0 8px #ff664466" }}>↩ RETURN</span>
        </div>
      )}

      {def && defId ? (
        <div style={{ position: "relative", zIndex: 1 }}>
          <CharacterCard defId={defId} def={def} size="md" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <div style={{
            fontSize: 28,
            opacity: isCorrectMatch ? 0.8 : isDroppable ? 0.45 : canPlace ? (glowing ? 0.6 : 0.25) : 0.08,
            transition: "opacity 0.15s",
            filter: isCorrectMatch ? "drop-shadow(0 0 8px #ffd70099)" : "none",
          }}>
            {SLOT_ICONS[slot.type] ?? "?"}
          </div>
          <div style={{
            fontSize: 9,
            color: isCorrectMatch ? "#ffd700" : isDroppable ? "#666688" : canPlace ? (glowing ? "#ffd700" : "#44446a") : "#1a1a2a",
            letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold",
            transition: "color 0.15s",
          }}>
            {slotLabel(slot)}
          </div>
          {(canPlace && !dragActive) && (
            <div style={{ fontSize: 9, color: glowing ? "#ffd700" : "#33335a", transition: "color 0.15s" }}>
              {glowing ? "← PLACE" : "click"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Board panel ──────────────────────────────────────────────────────────────
export function BoardPanel({ pid, zones, cardDb, isActive, selectedCard, onSlotClick, onReturnCard, playerName, dragActive, draggedAffinity }: {
  pid: PlayerId; zones: PlayerZones; cardDb: Record<string, CardDef>;
  isActive: boolean; selectedCard: string | null;
  onSlotClick: (slot: SlotRef) => void;
  onReturnCard: (slot: SlotRef) => void;
  playerName: string;
  dragActive?: boolean;
  draggedAffinity?: string | null;
}) {
  const canPlace = isActive && !!selectedCard;
  const full = isBoardFull(zones);
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";

  // Board glows as a drop zone while dragging
  const dragTargetGlow = dragActive && isActive;

  const slot = (s: SlotRef) => {
    const inst = getBoardCard(zones, s);
    const def = inst ? cardDb[inst.defId] : undefined;
    const occupied = !!inst;
    const placeable = canPlace && !occupied && s.type !== "UNLEASH";
    const returnable = isActive && !selectedCard && !dragActive && occupied;
    return (
      <SlotCell
        key={`${s.type}-${s.index}`}
        slot={s} instance={inst} defId={inst?.defId} def={def}
        canPlace={placeable}
        canReturn={returnable}
        dragActive={dragActive && isActive}
        draggedAffinity={draggedAffinity}
        onClick={() => {
          if (placeable) onSlotClick(s);
          else if (returnable) onReturnCard(s);
        }}
      />
    );
  };

  return (
    <div style={{
      flex: 1,
      background: dragTargetGlow
        ? `rgba(${pid === "P1" ? "6,16,40" : "40,6,6"},0.80)`
        : isActive
          ? `rgba(${pid === "P1" ? "6,14,36" : "36,6,6"},0.72)`
          : "rgba(6,6,14,0.38)",
      borderRadius: 16,
      border: `${isActive ? "2px" : "1px"} solid ${dragTargetGlow ? pColor + "cc" : isActive ? pColor + "aa" : "#1a1a22"}`,
      padding: "14px 12px",
      backdropFilter: "blur(6px)",
      boxShadow: dragTargetGlow
        ? `0 0 80px ${pColor}66, 0 0 180px ${pColor}28, inset 0 0 60px ${pColor}22`
        : isActive
          ? `0 0 70px ${pColor}55, 0 0 140px ${pColor}22, inset 0 0 50px ${pColor}18, 0 0 30px ${pColor}44`
          : "none",
      transition: "all 0.25s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: "bold", fontSize: 13, color: isActive ? pColor : "#444" }}>{playerName}</span>
          {isActive && !dragActive && <span style={{ fontSize: 9, color: "#ffd700", background: "#1a1400", borderRadius: 4, padding: "2px 6px", fontWeight: "bold", letterSpacing: 1 }}>YOUR TURN</span>}
          {dragActive && isActive && <span style={{ fontSize: 9, color: pColor, background: `${pColor}11`, border: `1px solid ${pColor}33`, borderRadius: 4, padding: "2px 6px", fontWeight: "bold", letterSpacing: 1, animation: "slotPulse 0.8s ease-in-out infinite" }}>DROP ZONE</span>}
          {full && isActive && !dragActive && <span style={{ fontSize: 9, color: "#4a9eff", background: "#0a1020", borderRadius: 4, padding: "2px 6px", letterSpacing: 1 }}>FULL</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#ffd700" }}>{zones.scorePreview.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: "#333", letterSpacing: 1 }}>SCORE</div>
        </div>
      </div>

      {/* Synergies */}
      {zones.activeSynergies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
          {zones.activeSynergies.map(s => (
            <span key={s} style={{ fontSize: 9, color: "#9b59ff", background: "#0f0a1a", border: "1px solid #2a1a4a", borderRadius: 4, padding: "2px 5px" }}>
              {SYNERGY_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}

      {/* Board layout */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {slot({ type: "LEADER", index: 0 })}
        </div>

        <div style={{ width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #2a2a4a, transparent)" }} />

        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          {slot({ type: "COMBAT", index: 0 })}
          {slot({ type: "COMBAT", index: 1 })}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {slot({ type: "SUPPORT", index: 0 })}
          {slot({ type: "SUPPORT", index: 1 })}
          {slot({ type: "SUPPORT", index: 2 })}
        </div>
      </div>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function PlacementScreen({ state, onSend, playerNames, playerIcons, selectedCard, setSelectedCard }: {
  state: GameState; onSend: (i: Intent) => void;
  playerNames: Record<PlayerId, string>; playerIcons: Record<PlayerId, string>;
  selectedCard: string | null; setSelectedCard: (id: string | null) => void;
  log?: string[];
}) {
  const me = state.activePlayerId;
  const myZones = state.players[me];
  const boardFull = isBoardFull(myZones);
  const bothBoardsFull = isBoardFull(state.players.P1) && isBoardFull(state.players.P2);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [isDraggingFromHand, setIsDraggingFromHand] = useState(false);
  const [draggedAffinity, setDraggedAffinity] = useState<string | null>(null);
  // We keep the dragged card ID in a ref so it's always current inside onDrop
  const draggingCardId = useRef<string | null>(null);

  // ── Placement effects ─────────────────────────────────────────────────────
  const shakeControls = useAnimation();
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const triggerPlacementEffect = async (rarity: string, color: string, isCorrectSlot: boolean) => {
    const baseIntensity = rarity === "X" ? 6 : rarity === "SSS" ? 4.5 : rarity === "SS" ? 3 : 1.5;
    const intensity = isCorrectSlot ? baseIntensity * 1.5 : baseIntensity;
    const duration  = isCorrectSlot ? 0.50 : 0.32;
    const flashMs   = isCorrectSlot ? 1000 : 600;

    setFlashColor(color);
    setFlashKey(k => k + 1);
    setTimeout(() => setFlashColor(null), flashMs);

    if (isCorrectSlot) {
      await shakeControls.start({
        x: [0, -intensity, intensity, -intensity * 0.9, intensity * 0.9,
             -intensity * 0.7, intensity * 0.7, -intensity * 0.4, intensity * 0.4,
             -intensity * 0.2, intensity * 0.2, 0],
        transition: {
          duration,
          times: [0, 0.06, 0.14, 0.22, 0.32, 0.42, 0.54, 0.64, 0.74, 0.84, 0.92, 1],
          ease: "easeOut",
        },
      });
    } else {
      await shakeControls.start({
        x: [0, -intensity, intensity, -intensity * 0.8, intensity * 0.8,
             -intensity * 0.5, intensity * 0.5, -2, 2, 0],
        transition: {
          duration,
          times: [0, 0.08, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 1],
          ease: "easeOut",
        },
      });
    }
  };

  // ── Shared place-card logic (used by both click and drag) ─────────────────
  const placeCard = (cardInstanceId: string, slot: SlotRef) => {
    const inst = myZones.hand.find(c => c.instanceId === cardInstanceId);
    if (inst) {
      const def = state.cardDb[inst.defId];
      if (def) {
        const isHigh = ["SS", "SSS", "X"].includes(def.rarity);
        const isMed  = ["S", "A"].includes(def.rarity);
        const isCorrectSlot = def.affinity === slot.type;
        if (isHigh || (isMed && isCorrectSlot)) {
          triggerPlacementEffect(def.rarity, rc(def.rarity), isCorrectSlot);
        }
      }
    }
    onSend({ type: "PLACE_CARD", playerId: me, cardInstanceId, target: slot });
    setSelectedCard(null);
  };

  // ── Click-to-place ────────────────────────────────────────────────────────
  const handleSlotClick = (slot: SlotRef) => {
    if (!selectedCard) return;
    placeCard(selectedCard, slot);
  };

  // ── Drag-to-place ─────────────────────────────────────────────────────────
  const handleDragStart = (instanceId: string, affinity: string | undefined) => {
    draggingCardId.current = instanceId;
    setIsDraggingFromHand(true);
    setDraggedAffinity(affinity ?? null);
    // Auto-select while dragging for visual feedback
    setSelectedCard(instanceId);
  };

  const handleDrop = (point: { x: number; y: number }) => {
    setIsDraggingFromHand(false);
    setDraggedAffinity(null);

    const cardId = draggingCardId.current;
    draggingCardId.current = null;
    if (!cardId) return;

    // elementsFromPoint (plural) gets ALL elements at this point, top to bottom.
    // The dragged card is on top (zIndex 999) so elementFromPoint would return
    // the card itself — we need to pierce through it to find the slot underneath.
    const els = document.elementsFromPoint(point.x, point.y);
    const slotEl = els.find(el => (el as HTMLElement).hasAttribute?.("data-slot-type")) as HTMLElement | null;
    if (!slotEl) { setSelectedCard(null); return; }

    const type = slotEl.getAttribute("data-slot-type") as SlotRef["type"];
    const index = parseInt(slotEl.getAttribute("data-slot-index") ?? "0", 10);
    if (!type || type === "UNLEASH") { setSelectedCard(null); return; }

    const slot: SlotRef = { type, index };

    // If slot is occupied, return the existing card first (swap behaviour)
    const existing = getBoardCard(myZones, slot);
    if (existing) {
      onSend({ type: "RETURN_CARD", playerId: me, target: slot });
    }

    placeCard(cardId, slot);
  };

  const handleReturnCard = (slot: SlotRef) => {
    onSend({ type: "RETURN_CARD", playerId: me, target: slot });
  };

  const pColor = me === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b",
      backgroundImage: BG.placement, backgroundSize: "cover", backgroundPosition: "center", animation: "bgPan 58s ease-in-out infinite",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 14, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10,
      position: "relative",
    }}>
      <AmbientCanvas theme="dust" />
      <AmbientOverlay theme="dark" />
      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.42)", pointerEvents: "none", zIndex: 0 }} />

      {/* Full-screen colour flash for placements */}
      {flashColor && (
        <motion.div
          key={flashKey}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: `radial-gradient(ellipse at center, ${flashColor}66 0%, ${flashColor}28 40%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <motion.div animate={shakeControls} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>

        {/* ── Compact top bar ── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "6px 12px", background: "rgba(10,10,21,0.5)", borderRadius: 10,
          border: "1px solid #1a1a2e", backdropFilter: "blur(4px)", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <PlayerIcon icon={playerIcons.P1} size={24} />
            <span style={{ fontWeight: "bold", fontSize: 12, color: me === "P1" ? "#4a9eff" : "#555" }}>{playerNames.P1}</span>
            <VowBadge vowId={state.vowsChosen.P1} />
            {state.lockedIn.P1 && <span style={{ fontSize: 9, color: "#4a9eff" }}>✓</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#333", letterSpacing: 2, flexShrink: 0 }}>VS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
            {state.lockedIn.P2 && <span style={{ fontSize: 9, color: "#ff6666" }}>✓</span>}
            <VowBadge vowId={state.vowsChosen.P2} />
            <span style={{ fontWeight: "bold", fontSize: 12, color: me === "P2" ? "#ff6666" : "#555" }}>{playerNames.P2}</span>
            <PlayerIcon icon={playerIcons.P2} size={24} />
          </div>
        </div>

        {/* ── Boards + center proceed column ── */}
        <div style={{ display: "flex", gap: 12, flex: 1, alignItems: "stretch" }}>
          <BoardPanel pid="P1" zones={state.players.P1} cardDb={state.cardDb}
            isActive={me === "P1"} selectedCard={me === "P1" ? selectedCard : null}
            onSlotClick={handleSlotClick} onReturnCard={handleReturnCard}
            playerName={playerNames.P1}
            dragActive={isDraggingFromHand && me === "P1"}
            draggedAffinity={draggedAffinity}
          />

          {/* Center proceed panel */}
          <div style={{
            width: 160, flexShrink: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14,
          }}>
            {state.lockedIn[me] ? (
              <div style={{ textAlign: "center", fontSize: 11, color: "#44cc44", letterSpacing: 1, lineHeight: 1.6 }}>
                ✓ LOCKED IN<br />
                <span style={{ fontSize: 9, color: "#333" }}>waiting for<br />opponent</span>
              </div>
            ) : bothBoardsFull ? (
              <>
                <div style={{ fontSize: 9, color: "#44ff88", letterSpacing: 2, textAlign: "center" }}>READY</div>
                <button
                  onClick={() => { setSelectedCard(null); onSend({ type: "LOCK_IN", playerId: me }); }}
                  style={{
                    padding: "16px 0", width: 140,
                    background: "linear-gradient(135deg, #0d1a00, #001a0d)",
                    border: "2px solid #66ff44", borderRadius: 12, color: "#66ff44",
                    fontWeight: "bold", cursor: "pointer", fontSize: 15, letterSpacing: 3,
                    boxShadow: "0 0 28px #66ff4444, 0 0 60px #66ff4418",
                    animation: "proceedPulse 2s ease-in-out infinite", textAlign: "center",
                  }}
                >
                  PROCEED<br />
                  <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>→ AUGMENTS</span>
                </button>
              </>
            ) : boardFull ? (
              <>
                <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, textAlign: "center" }}>BOARD FULL</div>
                <button
                  onClick={() => { setSelectedCard(null); onSend({ type: "LOCK_IN", playerId: me }); }}
                  style={{
                    padding: "12px 0", width: 130,
                    background: "rgba(8,16,0,0.8)", border: "1px solid #44aa22",
                    borderRadius: 10, color: "#66cc44",
                    fontWeight: "bold", cursor: "pointer", fontSize: 13, letterSpacing: 2,
                    boxShadow: "0 0 12px #44aa2233", textAlign: "center",
                  }}
                >
                  LOCK IN
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#222", letterSpacing: 1, marginBottom: 8 }}>PLACE ALL<br />CARDS</div>
                <div style={{ fontSize: 22, color: "#1a1a2e" }}>⬡</div>
              </div>
            )}
          </div>

          <BoardPanel pid="P2" zones={state.players.P2} cardDb={state.cardDb}
            isActive={me === "P2"} selectedCard={me === "P2" ? selectedCard : null}
            onSlotClick={handleSlotClick} onReturnCard={handleReturnCard}
            playerName={playerNames.P2}
            dragActive={isDraggingFromHand && me === "P2"}
            draggedAffinity={draggedAffinity}
          />
        </div>

        {/* ── Hand tray ── */}
        <div style={{
          padding: "10px 14px",
          background: isDraggingFromHand ? "rgba(10,10,26,0.55)" : "rgba(8,8,22,0.4)",
          borderRadius: 12,
          border: `1px solid ${isDraggingFromHand ? pColor + "33" : selectedCard ? "#ffd70044" : "#1a1a2e"}`,
          backdropFilter: "blur(6px)",
          transition: "border-color 0.2s, background 0.2s",
        }}>
          <div style={{ fontSize: 10, color: "#44446a", marginBottom: 8, letterSpacing: 2 }}>
            {isDraggingFromHand
              ? <span style={{ color: pColor + "cc" }}>drag onto a slot above to place ·
                  {draggedAffinity && <span style={{ color: "#ffd700" }}> ✦ matching {draggedAffinity} slot glows gold</span>}
                </span>
              : selectedCard
                ? <span style={{ color: "#ffd700" }}>drag to a slot · or click a slot above · click occupied slot to return</span>
                : <span>drag a card to a slot · or click to select then click a slot</span>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {myZones.hand.map(inst => {
              const def = state.cardDb[inst.defId];
              if (!def) return null;
              return (
                <HandCard
                  key={inst.instanceId}
                  instance={inst} def={def} defId={inst.defId}
                  selected={selectedCard === inst.instanceId}
                  onClick={() => setSelectedCard(selectedCard === inst.instanceId ? null : inst.instanceId)}
                  onDragStart={() => handleDragStart(inst.instanceId, def.affinity)}
                  onDrop={handleDrop}
                />
              );
            })}
            {myZones.hand.length === 0 && (
              <span style={{ color: "#2a2a3a", fontSize: 12 }}>All cards placed — hover a slot to return it</span>
            )}
          </div>
        </div>

      </motion.div>

      <style>{`
        @keyframes proceedPulse {
          0%,100% { box-shadow: 0 0 28px #66ff4444, 0 0 60px #66ff4418; }
          50%      { box-shadow: 0 0 40px #66ff4477, 0 0 80px #66ff4430; }
        }
        @keyframes slotShimmer {
          0%   { left: -60%; }
          100% { left: 160%; }
        }
        @keyframes slotPulse {
          0%,100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
