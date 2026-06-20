import { useState } from "react";
import type { BindingVowId, CardDef, CardInstance, GameState, Intent, PlayerId, PlayerZones, SlotRef } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import { rc, slotLabel, getBoardCard, isBoardFull } from "../helpers";
import { SYNERGY_LABEL } from "../constants";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";

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

export function HandCard({ def, defId, selected, onClick }: {
  instance?: CardInstance; def: CardDef; defId: string; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer", userSelect: "none",
        transform: selected ? "translateY(-8px) scale(1.06)" : "none",
        transition: "transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
        filter: selected ? "brightness(1.15)" : "none",
      }}
    >
      <CharacterCard defId={defId} def={def} size="md" selected={selected} />
    </div>
  );
}

// ── Slot cell ────────────────────────────────────────────────────────────────
const SLOT_ICONS: Record<string, string> = {
  LEADER: "👑", COMBAT: "💥", SUPPORT: "✨",
};

export function SlotCell({ slot, instance, defId, def, canPlace, canReturn, onClick }: {
  slot: SlotRef; instance?: CardInstance | null; defId?: string; def: CardDef | undefined;
  canPlace: boolean; canReturn: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cardColor = def ? rc(def.rarity) : null;
  const glowing = (canPlace || canReturn) && hovered;

  return (
    <div
      onClick={(canPlace || canReturn) ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: 138, height: 194,
        borderRadius: 12,
        border: `2px solid ${
          def && canReturn && hovered ? "#ff6644aa" :
          def ? (cardColor + "aa") :
          glowing ? "#ffd70099" :
          canPlace ? "#44446a" : "#18182a"
        }`,
        background: def
          ? `linear-gradient(180deg, ${cardColor}0a 0%, #0a0a1e 100%)`
          : canPlace
            ? glowing ? "rgba(255,215,0,0.05)" : "rgba(30,30,60,0.6)"
            : "rgba(6,6,18,0.8)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: (canPlace || canReturn) ? "pointer" : "default",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        boxShadow: def && canReturn && hovered
          ? "0 0 20px #ff664433, inset 0 0 16px #ff664408"
          : def
            ? `0 0 16px ${cardColor}33, inset 0 0 20px ${cardColor}08`
            : canPlace && glowing
              ? "0 0 20px #ffd70033, inset 0 0 16px #ffd70008"
              : canPlace
                ? "0 0 8px #44446a33"
                : "none",
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
        <CharacterCard defId={defId} def={def} size="md" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{
            fontSize: 28, opacity: canPlace ? (glowing ? 0.6 : 0.25) : 0.08,
            transition: "opacity 0.15s",
          }}>
            {SLOT_ICONS[slot.type] ?? "?"}
          </div>
          <div style={{
            fontSize: 9, color: canPlace ? (glowing ? "#ffd700" : "#44446a") : "#1a1a2a",
            letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold",
            transition: "color 0.15s",
          }}>
            {slotLabel(slot)}
          </div>
          {canPlace && (
            <div style={{
              fontSize: 9, color: glowing ? "#ffd700" : "#33335a",
              transition: "color 0.15s",
            }}>
              {glowing ? "← PLACE" : "click"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Board panel ──────────────────────────────────────────────────────────────
export function BoardPanel({ pid, zones, cardDb, isActive, selectedCard, onSlotClick, onReturnCard, playerName }: {
  pid: PlayerId; zones: PlayerZones; cardDb: Record<string, CardDef>;
  isActive: boolean; selectedCard: string | null;
  onSlotClick: (slot: SlotRef) => void;
  onReturnCard: (slot: SlotRef) => void;
  playerName: string;
}) {
  const canPlace = isActive && !!selectedCard;
  const full = isBoardFull(zones);
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";

  const slot = (s: SlotRef) => {
    const inst = getBoardCard(zones, s);
    const def = inst ? cardDb[inst.defId] : undefined;
    const occupied = !!inst;
    // Can place here: active, has card selected, slot empty (not UNLEASH)
    const placeable = canPlace && !occupied && s.type !== "UNLEASH";
    // Can return: active, no card selected, slot occupied
    const returnable = isActive && !selectedCard && occupied;
    return (
      <SlotCell
        key={`${s.type}-${s.index}`}
        slot={s} instance={inst} defId={inst?.defId} def={def}
        canPlace={placeable}
        canReturn={returnable}
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
      background: "rgba(6,6,14,0.38)",
      borderRadius: 16,
      border: `1px solid ${isActive ? pColor + "44" : "#1a1a22"}`,
      padding: "14px 12px",
      backdropFilter: "blur(6px)",
      boxShadow: isActive ? `0 0 24px ${pColor}18` : "none",
      transition: "box-shadow 0.3s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: "bold", fontSize: 13, color: isActive ? pColor : "#444" }}>{playerName}</span>
          {isActive && <span style={{ fontSize: 9, color: "#ffd700", background: "#1a1400", borderRadius: 4, padding: "2px 6px", fontWeight: "bold", letterSpacing: 1 }}>YOUR TURN</span>}
          {full && isActive && <span style={{ fontSize: 9, color: "#4a9eff", background: "#0a1020", borderRadius: 4, padding: "2px 6px", letterSpacing: 1 }}>FULL</span>}
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
        {/* Leader */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {slot({ type: "LEADER", index: 0 })}
        </div>

        <div style={{ width: "80%", height: 1, background: "linear-gradient(90deg, transparent, #2a2a4a, transparent)" }} />

        {/* Combat */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          {slot({ type: "COMBAT", index: 0 })}
          {slot({ type: "COMBAT", index: 1 })}
        </div>

        {/* Support */}
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

  const handleSlotClick = (slot: SlotRef) => {
    if (!selectedCard) return;
    onSend({ type: "PLACE_CARD", playerId: me, cardInstanceId: selectedCard, target: slot });
    setSelectedCard(null);
  };

  const handleReturnCard = (slot: SlotRef) => {
    onSend({ type: "RETURN_CARD", playerId: me, target: slot });
  };

  const pColor = me === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      minHeight: "100vh", background: "#05050b",
      backgroundImage: BG.placement, backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 14, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.42)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>

        {/* ── Compact top bar ── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "6px 12px", background: "rgba(10,10,21,0.5)", borderRadius: 10,
          border: "1px solid #1a1a2e", backdropFilter: "blur(4px)", gap: 8,
        }}>
          {/* P1 side */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <PlayerIcon icon={playerIcons.P1} size={24} />
            <span style={{ fontWeight: "bold", fontSize: 12, color: me === "P1" ? "#4a9eff" : "#555" }}>{playerNames.P1}</span>
            <VowBadge vowId={state.vowsChosen.P1} />
            {state.lockedIn.P1 && <span style={{ fontSize: 9, color: "#4a9eff" }}>✓</span>}
          </div>

          {/* VS center */}
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#333", letterSpacing: 2, flexShrink: 0 }}>VS</div>

          {/* P2 side */}
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
            playerName={playerNames.P1} />

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
              // Both boards full — this lock-in advances the game
              <>
                <div style={{ fontSize: 9, color: "#44ff88", letterSpacing: 2, textAlign: "center" }}>READY</div>
                <button
                  onClick={() => { setSelectedCard(null); onSend({ type: "LOCK_IN", playerId: me }); }}
                  style={{
                    padding: "16px 0", width: 140,
                    background: "linear-gradient(135deg, #0d1a00, #001a0d)",
                    border: "2px solid #66ff44",
                    borderRadius: 12, color: "#66ff44",
                    fontWeight: "bold", cursor: "pointer", fontSize: 15, letterSpacing: 3,
                    boxShadow: "0 0 28px #66ff4444, 0 0 60px #66ff4418",
                    animation: "proceedPulse 2s ease-in-out infinite",
                    textAlign: "center",
                  }}
                >
                  PROCEED<br />
                  <span style={{ fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>→ AUGMENTS</span>
                </button>
              </>
            ) : boardFull ? (
              // My board full but opponent not done yet — lock in and wait
              <>
                <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, textAlign: "center" }}>BOARD FULL</div>
                <button
                  onClick={() => { setSelectedCard(null); onSend({ type: "LOCK_IN", playerId: me }); }}
                  style={{
                    padding: "12px 0", width: 130,
                    background: "rgba(8,16,0,0.8)",
                    border: "1px solid #44aa22",
                    borderRadius: 10, color: "#66cc44",
                    fontWeight: "bold", cursor: "pointer", fontSize: 13, letterSpacing: 2,
                    boxShadow: "0 0 12px #44aa2233",
                    textAlign: "center",
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
            playerName={playerNames.P2} />
        </div>

        {/* ── Hand tray ── */}
        <div style={{
          padding: "10px 14px",
          background: "rgba(8,8,22,0.4)", borderRadius: 12,
          border: `1px solid ${selectedCard ? "#ffd70044" : "#1a1a2e"}`,
          backdropFilter: "blur(6px)",
          transition: "border-color 0.2s",
        }}>
          <div style={{ fontSize: 10, color: "#44446a", marginBottom: 8, letterSpacing: 2 }}>
            {selectedCard
              ? <span style={{ color: "#ffd700" }}>select a slot ↑ to place · click occupied slot to return</span>
              : <span>click a card to place it · click placed card to return it to hand</span>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {myZones.hand.map(inst => {
              const def = state.cardDb[inst.defId];
              if (!def) return null;
              return (
                <HandCard key={inst.instanceId} instance={inst} def={def} defId={inst.defId}
                  selected={selectedCard === inst.instanceId}
                  onClick={() => setSelectedCard(selectedCard === inst.instanceId ? null : inst.instanceId)} />
              );
            })}
            {myZones.hand.length === 0 && (
              <span style={{ color: "#2a2a3a", fontSize: 12 }}>All cards placed — hover a slot to return it</span>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes proceedPulse {
          0%,100% { box-shadow: 0 0 28px #66ff4444, 0 0 60px #66ff4418; }
          50%      { box-shadow: 0 0 40px #66ff4477, 0 0 80px #66ff4430; }
        }
      `}</style>
    </div>
  );
}
