import React, { useState } from "react";
import type { BindingVowId, CardDef, DraftPoolCard, GameState, Intent, PlayerId } from "@cg/contracts";
import { VOW_DEFS } from "@cg/engine";
import type { PlayerIcons, PlayerNames } from "../types";
import CharacterCard, { CardBack } from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";
import { BG } from "../backgrounds";

// ─────────────────────────────────────────────────────────────────────────────
// Pool card — shown in the center draft area (xs size)
// ─────────────────────────────────────────────────────────────────────────────
function PoolCard({
  card, cardDb, selected, isMyTurn, cardRevealUsed,
  onSelect, onPick, onSpellCardReveal, onSpellGlobalRate, onSpellFakeReveal,
  spellsLeft, debugRevealMode,
}: {
  card: DraftPoolCard; cardDb: Record<string, CardDef>; selected: boolean;
  isMyTurn: boolean; cardRevealUsed: number;
  onSelect: () => void; onPick: () => void;
  onSpellCardReveal: () => void; onSpellGlobalRate: () => void; onSpellFakeReveal: () => void;
  spellsLeft: number; debugRevealMode: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const def = cardDb[card.defId];

  const lift = selected
    ? "translateY(-10px) scale(1.08)"
    : hovered && isMyTurn ? "translateY(-4px) scale(1.03)" : "none";

  const handleClick = () => {
    if (!isMyTurn) return;
    if (debugRevealMode && !card.identityRevealed) { onSpellCardReveal(); }
    else { onSelect(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          cursor: isMyTurn ? "pointer" : "default",
          userSelect: "none",
          transform: lift,
          transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
          filter: debugRevealMode && !card.identityRevealed && isMyTurn
            ? "brightness(1.2) drop-shadow(0 0 6px #ff990066)"
            : selected ? "brightness(1.18)" : hovered && isMyTurn ? "brightness(1.08)" : "none",
        }}
      >
        {card.identityRevealed && def ? (
          <CharacterCard defId={card.defId} def={def} size="sm" selected={selected} />
        ) : (
          <CardBack size="sm" shownRarity={card.shownRarity} shownRole={card.shownRole} />
        )}
      </div>

      {/* Spell/pick buttons — only when selected on your turn */}
      {selected && isMyTurn && !debugRevealMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 72 }}>
          <button onClick={onPick} style={{
            padding: "4px 0", background: "#0a1800", border: "1px solid #44aa22",
            borderRadius: 5, color: "#66cc44", fontWeight: "bold", cursor: "pointer", fontSize: 10, letterSpacing: 1,
          }}>PICK</button>

          {!card.identityRevealed && cardRevealUsed < 2 && (
            <button onClick={onSpellCardReveal} disabled={spellsLeft <= 0} style={{
              padding: "3px 0", background: spellsLeft > 0 ? "#180a00" : "#060606",
              border: `1px solid ${spellsLeft > 0 ? "#cc6600" : "#1a1a1a"}`,
              borderRadius: 5, color: spellsLeft > 0 ? "#ff9944" : "#333",
              cursor: spellsLeft > 0 ? "pointer" : "not-allowed", fontSize: 9,
            }}>🃏 REVEAL</button>
          )}

          {!card.shownRarity && !card.identityRevealed && (
            <button onClick={onSpellGlobalRate} disabled={spellsLeft <= 0} style={{
              padding: "3px 0", background: spellsLeft > 0 ? "#180018" : "#060606",
              border: `1px solid ${spellsLeft > 0 ? "#882299" : "#1a1a1a"}`,
              borderRadius: 5, color: spellsLeft > 0 ? "#cc44ee" : "#333",
              cursor: spellsLeft > 0 ? "pointer" : "not-allowed", fontSize: 9,
            }}>📊 RATE</button>
          )}
        </div>
      )}
      {selected && isMyTurn && debugRevealMode && (
        <button onClick={onPick} style={{
          padding: "4px 0", background: "#0a1800", border: "1px solid #44aa22",
          borderRadius: 5, color: "#66cc44", fontWeight: "bold", cursor: "pointer",
          fontSize: 10, letterSpacing: 1, width: 72,
        }}>PICK</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// YGO-style side panel for one player
// ─────────────────────────────────────────────────────────────────────────────
function PlayerHandPanel({ pid, state, playerNames, playerIcons, isActive, spellsLeft, revealsUsed }: {
  pid: PlayerId; state: GameState; playerNames: PlayerNames; playerIcons: PlayerIcons;
  isActive: boolean; spellsLeft: number; revealsUsed: number;
}) {
  const pColor = pid === "P1" ? "#4a9eff" : "#ff6666";
  const picks = state.players[pid].hand;
  const vowId = state.vowsChosen[pid] as BindingVowId | null;
  const vowDef = vowId ? VOW_DEFS[vowId] : null;

  return (
    <div style={{
      width: "35%", minWidth: 260, maxWidth: 400,
      display: "flex", flexDirection: "column",
      background: isActive ? "rgba(8,8,20,0.4)" : "rgba(5,5,12,0.3)",
      borderRight: pid === "P1" ? `1px solid ${isActive ? pColor + "44" : "#1a1a28"}` : "none",
      borderLeft: pid === "P2" ? `1px solid ${isActive ? pColor + "44" : "#1a1a28"}` : "none",
      boxShadow: isActive ? (pid === "P1" ? `inset -8px 0 24px ${pColor}14` : `inset 8px 0 24px ${pColor}14`) : "none",
      transition: "all 0.3s",
    }}>
      {/* ── Top identity bar ── */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: `1px solid ${isActive ? pColor + "33" : "#1a1a28"}`,
        background: isActive ? `${pColor}08` : "transparent",
        transition: "all 0.3s",
        display: "flex",
        flexDirection: pid === "P1" ? "row" : "row-reverse",
        alignItems: "stretch",
        gap: 12,
      }}>
        {/* Icon — tall, hugs top/bottom of this bar */}
        <div style={{
          borderRadius: 10,
          border: `2px solid ${isActive ? pColor : "#2a2a38"}`,
          boxShadow: isActive ? `0 0 20px ${pColor}66` : "none",
          transition: "all 0.3s",
          overflow: "hidden", flexShrink: 0,
          alignSelf: "stretch",
          display: "flex",
        }}>
          <PlayerIcon icon={playerIcons[pid]} size={72} style={{ display: "block", width: 72, height: "100%", objectFit: "cover" } as React.CSSProperties} />
        </div>

        {/* Name + info column */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div style={{
            fontSize: 18, fontWeight: "bold",
            color: isActive ? pColor : "#666",
            textAlign: pid === "P1" ? "left" : "right",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textShadow: isActive ? `0 0 18px ${pColor}99` : "none",
            transition: "all 0.3s",
          }}>
            {playerNames[pid]}
          </div>
          <div style={{
            fontSize: 9, color: isActive ? pColor + "aa" : "#444",
            letterSpacing: 2, textAlign: pid === "P1" ? "left" : "right",
          }}>
            {isActive ? "▶ YOUR TURN" : pid}
          </div>

          {/* Vow badge */}
          {vowDef ? (
            <div style={{
              fontSize: 10, color: "#cc9900", background: "#1a110022",
              border: "1px solid #443300", borderRadius: 5,
              padding: "3px 7px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              textAlign: pid === "P1" ? "left" : "right",
            }}>
              {vowDef.icon} {vowDef.name}
            </div>
          ) : null}

          {/* Spell + reveal charges */}
          <div style={{ display: "flex", gap: 8, justifyContent: pid === "P1" ? "flex-start" : "flex-end" }}>
            <span style={{
              fontSize: 13, fontWeight: "bold",
              color: isActive ? pColor : "#3a3a4a",
              textShadow: isActive ? `0 0 10px ${pColor}66` : "none",
            }}>
              {"⚡".repeat(Math.min(spellsLeft, 3))}{"·".repeat(Math.max(0, 3 - spellsLeft))}
            </span>
            <span style={{
              fontSize: 13, fontWeight: "bold",
              color: isActive ? pColor : "#3a3a4a",
              borderLeft: `1px solid ${isActive ? pColor + "33" : "#2a2a3a"}`,
              paddingLeft: 8,
              textShadow: isActive ? `0 0 10px ${pColor}66` : "none",
            }}>
              🃏 {2 - revealsUsed}/2
            </span>
          </div>
        </div>
      </div>

      {/* ── Hand card grid (fills remaining space) ── */}
      <div style={{
        flex: 1,
        margin: "8px 8px 12px",
        padding: "12px 10px",
        background: "rgba(7,7,15,0.3)",
        border: `1px solid ${isActive ? pColor + "33" : "rgba(24,24,42,0.4)"}`,
        borderRadius: 10,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{
          fontSize: 8, color: isActive ? pColor + "88" : "#2a2a38",
          letterSpacing: 2, marginBottom: 4, textAlign: "center",
        }}>
          HAND — {picks.length}/6
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, justifyItems: "center" }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const inst = picks[i] as (typeof picks)[0] | undefined;
            const vis = inst?.visibility;
            const def = inst ? state.cardDb[inst.defId] : null;

            if (!inst) {
              return (
                <div key={i} style={{
                  aspectRatio: "96/136",
                  borderRadius: 7,
                  border: "1px dashed #1a1a2a",
                  background: "rgba(6,6,14,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 9, color: "#1a1a2a" }}>{i + 1}</span>
                </div>
              );
            }
            if (vis?.identityRevealed && def) {
              return <CharacterCard key={inst.instanceId} defId={inst.defId} def={def} size="md" />;
            }
            if (vis?.shownRarity) {
              return <CardBack key={inst.instanceId} size="md" shownRarity={vis.shownRarity} shownRole={vis.shownRole} />;
            }
            return <CardBack key={inst.instanceId} size="md" />;
          })}
        </div>
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
  const revealsUsed = draft.cardRevealUsed[me];
  const totalPicks = state.players.P1.hand.length + state.players.P2.hand.length;
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [debugRevealMode, setDebugRevealMode] = useState(false);

  const select = (instanceId: string) =>
    setSelectedCard(prev => prev === instanceId ? null : instanceId);

  const debugReveal = (cardInstanceId: string) => {
    onSend({ type: "DEBUG_REFILL_SPELLS", playerId: me });
    onSend({ type: "SPELL_CARD_REVEAL", playerId: me, cardInstanceId });
  };

  const meColor = me === "P1" ? "#4a9eff" : "#ff6666";

  return (
    <div style={{
      height: "100vh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "#05050b",
      backgroundImage: BG.draft,
      backgroundSize: "cover", backgroundPosition: "center",
      color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative",
    }}>
      {/* Semi-transparent overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,11,0.38)", pointerEvents: "none", zIndex: 0 }} />

      {/* 3-column body */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── P1 side panel ── */}
        <PlayerHandPanel
          pid="P1" state={state}
          playerNames={playerNames} playerIcons={playerIcons}
          isActive={me === "P1"}
          spellsLeft={spellsLeft} revealsUsed={revealsUsed}
        />

        {/* ── Center pool ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
          padding: "12px 14px",
        }}>
          {/* Turn indicator header */}
          <div style={{
            textAlign: "center", marginBottom: 12,
            padding: "8px 16px",
            background: `${meColor}08`,
            border: `1px solid ${meColor}28`,
            borderRadius: 10,
            boxShadow: `0 0 20px ${meColor}18`,
            animation: "pulseBorder 2s ease-in-out infinite",
          }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#444", marginBottom: 3 }}>PHASE 1 · DRAFT</div>
            <div style={{ fontSize: 14, fontWeight: "bold", color: meColor, letterSpacing: 2 }}>
              {playerNames[me].toUpperCase()}'S TURN
            </div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
              {totalPicks}/12 picked · {draft.pool.length} remaining
              {debugRevealMode && <span style={{ color: "#ff9944", marginLeft: 10 }}>👁 REVEAL MODE</span>}
            </div>
          </div>

          {/* Card pool — scrollable, styled waves */}
          <div style={{
            flex: 1, overflow: "auto",
            background: "linear-gradient(180deg, rgba(8,8,15,0.28) 0%, rgba(5,5,9,0.28) 100%)",
            borderRadius: 12, border: "1px solid rgba(26,26,46,0.4)",
            padding: "16px 10px 24px",
            backdropFilter: "blur(4px)",
          }}>
            {(() => {
              // Wave config: [count, vertOffsets[], rowGapTop]
              // vertOffset per card position (negative = elevated)
              const waves: Array<{ count: number; offsets: number[]; gapTop: number }> = [
                { count: 9, offsets: [0,-8,4,-12,0,-10,6,-6,2],  gapTop: 0  },
                { count: 6, offsets: [10,-4,0,-14,2,-8],          gapTop: 6  },
                { count: 9, offsets: [4,-6,12,-4,0,-8,4,-10,6],  gapTop: 6  },
                { count: 6, offsets: [0,-10,6,-4,10,-6],          gapTop: 6  },
                { count: 9, offsets: [0,-8,4,-12,0,-10,6,-6,2],  gapTop: 6  }, // handles remainder
              ];

              const pool = draft.pool;

              const makePoolCard = (card: typeof pool[0]) => (
                <PoolCard
                  key={card.instanceId}
                  card={card}
                  cardDb={state.cardDb}
                  selected={selectedCard === card.instanceId}
                  isMyTurn={true}
                  cardRevealUsed={draft.cardRevealUsed[me]}
                  onSelect={() => select(card.instanceId)}
                  onPick={() => {
                    onSend({ type: "DRAFT_PICK", playerId: me, cardInstanceId: card.instanceId });
                    setSelectedCard(null);
                  }}
                  onSpellCardReveal={() => {
                    if (debugRevealMode) { debugReveal(card.instanceId); }
                    else { onSend({ type: "SPELL_CARD_REVEAL", playerId: me, cardInstanceId: card.instanceId }); }
                    setSelectedCard(null);
                  }}
                  onSpellGlobalRate={() => {
                    onSend({ type: "SPELL_GLOBAL_RATE", playerId: me, cardInstanceId: card.instanceId });
                    setSelectedCard(null);
                  }}
                  onSpellFakeReveal={() => {
                    onSend({ type: "SPELL_FAKE_REVEAL", playerId: me, cardInstanceId: card.instanceId });
                    setSelectedCard(null);
                  }}
                  spellsLeft={spellsLeft}
                  debugRevealMode={debugRevealMode}
                />
              );

              const rows: React.ReactNode[] = [];
              let idx = 0;
              for (const wave of waves) {
                if (idx >= pool.length) break;
                const rowCards = pool.slice(idx, idx + wave.count);
                idx += wave.count;

                const isSmallRow = wave.count <= 6;

                rows.push(
                  <div key={`wave-${idx}`} style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: wave.gapTop,
                    paddingTop: isSmallRow ? 4 : 0,
                  }}>
                    {rowCards.map((card, ci) => {
                      const offset = wave.offsets[ci] ?? 0;
                      return (
                        <div key={card.instanceId} style={{
                          transform: `translateY(${offset}px)`,
                          transition: "transform 0.2s",
                          filter: offset < -8 ? "drop-shadow(0 8px 16px rgba(0,0,0,0.5))" : "none",
                          zIndex: offset < -8 ? 2 : 1,
                          position: "relative",
                        }}>
                          {makePoolCard(card)}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return rows;
            })()}
          </div>

          {/* Bottom bar */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
            <button
              onClick={() => { onSend({ type: "DRAFT_SKIP", playerId: me }); setSelectedCard(null); }}
              style={{
                padding: "6px 18px", background: "rgba(10,10,24,0.5)",
                border: "1px solid #4a4a88",
                borderRadius: 8, color: "#8888cc",
                fontWeight: "bold", cursor: "pointer",
                fontSize: 11, letterSpacing: 1,
              }}
            >
              SKIP
            </button>

            <button
              onClick={() => { setDebugRevealMode(m => !m); setSelectedCard(null); }}
              title="DEV: click any face-down card to reveal it instantly"
              style={{
                padding: "6px 14px",
                background: debugRevealMode ? "#1a0e00" : "#0a0800",
                border: `1px dashed ${debugRevealMode ? "#ff9944" : "#443300"}`,
                borderRadius: 8,
                color: debugRevealMode ? "#ff9944" : "#664400",
                fontWeight: "bold", cursor: "pointer", fontSize: 10, letterSpacing: 1,
              }}
            >
              {debugRevealMode ? "👁 ON" : "👁 REVEAL"}
            </button>
          </div>
        </div>

        {/* ── P2 side panel ── */}
        <PlayerHandPanel
          pid="P2" state={state}
          playerNames={playerNames} playerIcons={playerIcons}
          isActive={me === "P2"}
          spellsLeft={spellsLeft} revealsUsed={draft.cardRevealUsed[me === "P1" ? "P2" : "P1"]}
        />
      </div>

      <style>{`
        @keyframes pulseBorder {
          0%,100% { box-shadow: 0 0 20px ${meColor}18; }
          50%      { box-shadow: 0 0 32px ${meColor}38; }
        }
      `}</style>
    </div>
  );
}
